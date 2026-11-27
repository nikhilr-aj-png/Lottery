-- ============================================================================
-- Migration: 20261127_event_lifecycle_and_tickets_security.sql
-- Purpose:
--   1. Server-authoritative event lifecycle, 1-hour availability window, and
--      room-entry verification RPC (verify_room_entry_secure).
--   2. Server-timestamped ticket + joined event/room fetcher
--      (get_user_tickets_with_events) preserving historical records while
--      stripping private/admin-only fields (server_seed, preset_winning_digits).
--   3. Harden buy_lottery_tickets_secure to enforce start_time, expiration
--      window, active/non-deleted/non-paused flags, 4-digit format, and limits
--      while preserving Lifetime Referral Commission calculation.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_server_time_ms()
RETURNS bigint
LANGUAGE sql
STABLE
AS $$
  SELECT (EXTRACT(EPOCH FROM clock_timestamp()) * 1000)::bigint;
$$;

CREATE OR REPLACE FUNCTION public._compute_event_window_end(
  p_start_time bigint,
  p_draw_time bigint,
  p_duration_value text,
  p_duration_unit text
)
RETURNS bigint
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_dur_num numeric := 0;
  v_unit text := lower(trim(COALESCE(p_duration_unit, 'hours')));
  v_dur_ms bigint := 0;
  v_window_end bigint := 0;
BEGIN
  BEGIN
    v_dur_num := GREATEST(0, COALESCE(NULLIF(trim(COALESCE(p_duration_value, '')), '')::numeric, 0));
  EXCEPTION WHEN OTHERS THEN
    v_dur_num := 0;
  END;

  IF v_dur_num > 0 THEN
    IF v_unit LIKE 'min%' THEN
      v_dur_ms := (v_dur_num * 60 * 1000)::bigint;
    ELSIF v_unit LIKE 'day%' THEN
      v_dur_ms := (v_dur_num * 86400 * 1000)::bigint;
    ELSE
      v_dur_ms := (v_dur_num * 3600 * 1000)::bigint;
    END IF;
  END IF;

  IF p_start_time IS NOT NULL AND p_start_time > 0 AND v_dur_ms > 0 THEN
    v_window_end := p_start_time + v_dur_ms;
  END IF;

  IF p_draw_time IS NOT NULL AND p_draw_time > 0 AND v_window_end > 0 THEN
    RETURN LEAST(p_draw_time, v_window_end);
  ELSIF p_draw_time IS NOT NULL AND p_draw_time > 0 THEN
    RETURN p_draw_time;
  ELSIF v_window_end > 0 THEN
    RETURN v_window_end;
  END IF;

  RETURN 0;
END;
$$;

-- ----------------------------------------------------------------------------
-- Server-Authoritative Room Entry Verification RPC
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.verify_room_entry_secure(
  p_event_or_room_id text
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'auth', 'pg_temp'
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_key text := trim(COALESCE(p_event_or_room_id, ''));
  v_now_ms bigint := (EXTRACT(EPOCH FROM clock_timestamp()) * 1000)::bigint;
  v_prof_status text;
  v_event record;
  v_expires_at bigint;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'unauthenticated',
      'message', 'Please log in to enter a lottery room.',
      'server_now_ms', v_now_ms
    );
  END IF;

  SELECT status INTO v_prof_status FROM public.profiles WHERE id = v_uid;
  IF lower(COALESCE(v_prof_status, 'active')) IN ('suspended', 'banned') THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'account_restricted',
      'message', 'Your account does not currently have room access permission.',
      'server_now_ms', v_now_ms
    );
  END IF;

  IF v_key = '' THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'invalid_room',
      'message', 'Invalid lottery room identifier.',
      'server_now_ms', v_now_ms
    );
  END IF;

  SELECT * INTO v_event
  FROM public.lottery_events
  WHERE id = v_key OR room_id = v_key
  ORDER BY created_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'not_found',
      'message', 'This lottery event could not be found.',
      'server_now_ms', v_now_ms
    );
  END IF;

  v_expires_at := public._compute_event_window_end(
    v_event.start_time,
    v_event.draw_time,
    v_event.duration_value::text,
    v_event.duration_unit
  );

  IF COALESCE(v_event.is_deleted, false) OR lower(COALESCE(v_event.status, '')) = 'deleted' THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'deleted',
      'event_id', v_event.id,
      'room_id', v_event.room_id,
      'message', 'This event has expired. Room entry is no longer available.',
      'server_now_ms', v_now_ms
    );
  END IF;

  IF COALESCE(v_event.is_paused, false) OR lower(COALESCE(v_event.status, '')) = 'paused' THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'paused',
      'event_id', v_event.id,
      'room_id', v_event.room_id,
      'message', COALESCE(NULLIF(trim(COALESCE(v_event.pause_reason, '')), ''), 'This event room is temporarily paused.'),
      'server_now_ms', v_now_ms
    );
  END IF;

  IF lower(COALESCE(v_event.status, '')) IN ('completed', 'ended', 'settled', 'result_pending', 'expired')
     OR v_event.winning_digits IS NOT NULL
     OR NOT COALESCE(v_event.is_active, true) THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'expired',
      'event_id', v_event.id,
      'room_id', v_event.room_id,
      'expires_at', v_expires_at,
      'message', 'This event has expired. Room entry is no longer available.',
      'server_now_ms', v_now_ms
    );
  END IF;

  IF v_event.start_time IS NOT NULL AND v_event.start_time > 0 AND v_now_ms < v_event.start_time THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'upcoming',
      'event_id', v_event.id,
      'room_id', v_event.room_id,
      'start_time', v_event.start_time,
      'expires_at', v_expires_at,
      'message', 'This event has not started yet. Room entry opens at the scheduled start time.',
      'server_now_ms', v_now_ms
    );
  END IF;

  IF v_expires_at <= 0 OR v_now_ms >= v_expires_at THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'expired',
      'event_id', v_event.id,
      'room_id', v_event.room_id,
      'expires_at', v_expires_at,
      'message', 'This event has expired. Room entry is no longer available.',
      'server_now_ms', v_now_ms
    );
  END IF;

  RETURN jsonb_build_object(
    'allowed', true,
    'reason', 'active',
    'event_id', v_event.id,
    'room_id', COALESCE(v_event.room_id, 'room-' || v_event.id),
    'room_name', COALESCE(v_event.room_name, v_event.title),
    'title', v_event.title,
    'start_time', v_event.start_time,
    'expires_at', v_expires_at,
    'server_now_ms', v_now_ms
  );
END;
$$;

-- ----------------------------------------------------------------------------
-- Server-Authoritative Authenticated User Tickets + Event/Room Join RPC
-- Excludes private admin/oracle fields (server_seed, preset_winning_digits)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_user_tickets_with_events()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'auth', 'pg_temp'
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_now_ms bigint := (EXTRACT(EPOCH FROM clock_timestamp()) * 1000)::bigint;
  v_rows jsonb;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('server_now_ms', v_now_ms, 'tickets', '[]'::jsonb);
  END IF;

  SELECT COALESCE(jsonb_agg(row_data ORDER BY purchase_ts DESC), '[]'::jsonb)
  INTO v_rows
  FROM (
    SELECT
      COALESCE(lt.purchase_time, (EXTRACT(EPOCH FROM lt.created_at) * 1000)::bigint) AS purchase_ts,
      jsonb_build_object(
        'id', lt.id,
        'event_id', lt.event_id,
        'event_title', COALESCE(le.title, lt.event_title, 'Lottery Draw Room'),
        'ticket_number', lpad(lt.ticket_number, 4, '0'),
        'price', lt.price,
        'currency', COALESCE(lt.currency, le.currency, 'USDT'),
        'purchase_time', lt.purchase_time,
        'created_at', lt.created_at,
        'status', lt.status,
        'match_tier', lt.match_tier,
        'won_amount', lt.won_amount,
        'claimed', lt.claimed,
        'user_address', lt.user_address,
        'username', lt.username,
        'ledger_tx_ref', tx.ledger_id,
        'event_exists', (le.id IS NOT NULL),
        'room_id', COALESCE(le.room_id, 'room-' || lt.event_id),
        'room_name', COALESCE(le.room_name, le.title, lt.event_title, 'Lottery Room'),
        'lottery_type', COALESCE(le.game_id, 'four-digit-lottery'),
        'start_time', COALESCE(le.start_time, 0),
        'draw_time', public._compute_event_window_end(le.start_time, le.draw_time, le.duration_value::text, le.duration_unit),
        'duration_value', le.duration_value,
        'duration_unit', le.duration_unit,
        'pool_prize', COALESCE(le.pool_prize, 0),
        'event_status', CASE
          WHEN le.id IS NULL THEN 'expired'
          ELSE COALESCE(le.status, 'expired')
        END,
        'event_is_active', COALESCE(le.is_active, false),
        'event_is_deleted', COALESCE(le.is_deleted, false),
        'event_is_paused', COALESCE(le.is_paused, false),
        'winning_digits', CASE
          WHEN COALESCE(le.status, '') IN ('completed', 'settled', 'ended') OR le.winning_digits IS NOT NULL
          THEN le.winning_digits
          ELSE NULL
        END,
        'draw_result_codes', CASE
          WHEN COALESCE(le.status, '') IN ('completed', 'settled', 'ended') OR le.winning_digits IS NOT NULL
          THEN COALESCE(le.draw_result_codes, '[]'::jsonb)
          ELSE '[]'::jsonb
        END
      ) AS row_data
    FROM public.lottery_tickets lt
    LEFT JOIN public.lottery_events le ON le.id = lt.event_id
    LEFT JOIN LATERAL (
      SELECT wl.id AS ledger_id
      FROM public.wallet_ledger wl
      WHERE wl.user_id = v_uid
        AND wl.transaction_type = 'ticket_purchase'
        AND lt.created_at IS NOT NULL
        AND wl.created_at BETWEEN lt.created_at - interval '3 seconds' AND lt.created_at + interval '3 seconds'
      ORDER BY abs(EXTRACT(EPOCH FROM (wl.created_at - lt.created_at))) ASC
      LIMIT 1
    ) tx ON true
    WHERE lt.user_id = v_uid
  ) sub;

  RETURN jsonb_build_object(
    'server_now_ms', v_now_ms,
    'tickets', v_rows
  );
END;
$$;

-- ----------------------------------------------------------------------------
-- Harden buy_lottery_tickets_secure with Full Lifecycle & 1-Hour Window Checks
-- (Preserves Lifetime Referral Commission crediting)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.buy_lottery_tickets_secure(
  p_event_id text,
  p_ticket_numbers text[],
  p_user_address text,
  p_username text DEFAULT NULL::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth', 'pg_temp'
AS $$
DECLARE
  v_uid uuid;
  v_event record;
  v_wallet record;
  v_num_tickets integer;
  v_total_cost numeric;
  v_new_balance numeric;
  v_num text;
  v_now_ms bigint;
  v_expires_at bigint;
  v_existing_user_tkt_count integer := 0;
  v_ticket_id text;
  v_user_display text;
  v_tx_id text;
  v_order_ref text;
  v_curr text := 'USDT';
  v_ref record;
  v_cfg jsonb;
  v_comm_pct numeric;
  v_comm_amt numeric := 0;
  v_cfg_ver integer;
  v_ref_addr text;
  v_comm_res jsonb;
  v_comm_tx_id text;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Authentication required to purchase lottery tickets.');
  END IF;

  v_num_tickets := array_length(p_ticket_numbers, 1);
  IF v_num_tickets IS NULL OR v_num_tickets <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'No ticket numbers provided.');
  END IF;

  SELECT * INTO v_event FROM public.lottery_events WHERE id = p_event_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Lottery event not found.');
  END IF;

  IF COALESCE(v_event.is_deleted, false) OR v_event.status = 'deleted' THEN
    RETURN jsonb_build_object('success', false, 'error', 'This event has been archived and ticket sales are closed.');
  END IF;

  IF COALESCE(v_event.is_paused, false) OR v_event.status = 'paused' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Ticket purchasing is temporarily paused for this room.');
  END IF;

  IF v_event.status <> 'active' OR NOT COALESCE(v_event.is_active, true) OR v_event.winning_digits IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'This lottery draw is no longer active.');
  END IF;

  v_now_ms := (EXTRACT(EPOCH FROM clock_timestamp()) * 1000)::bigint;
  v_expires_at := public._compute_event_window_end(
    v_event.start_time,
    v_event.draw_time,
    v_event.duration_value::text,
    v_event.duration_unit
  );

  IF v_event.start_time IS NOT NULL AND v_event.start_time > 0 AND v_now_ms < v_event.start_time THEN
    RETURN jsonb_build_object('success', false, 'error', 'This event has not started yet. Sales open at the scheduled start time.');
  END IF;

  IF v_expires_at <= 0 OR v_now_ms >= v_expires_at THEN
    RETURN jsonb_build_object('success', false, 'error', 'This event has expired. Room entry and ticket purchasing are no longer available.');
  END IF;

  -- Enforce room capacity limits if configured
  IF COALESCE(v_event.ticket_limit_mode, 'unlimited') = 'limited' AND v_event.max_total_tickets IS NOT NULL THEN
    IF COALESCE(v_event.tickets_sold, 0) + v_num_tickets > v_event.max_total_tickets THEN
      RETURN jsonb_build_object('success', false, 'error', 'Room ticket capacity exceeded.');
    END IF;
  END IF;

  IF v_event.max_tickets_per_user IS NOT NULL AND v_event.max_tickets_per_user > 0 THEN
    SELECT COUNT(*) INTO v_existing_user_tkt_count
    FROM public.lottery_tickets
    WHERE event_id = p_event_id AND user_id = v_uid;

    IF v_existing_user_tkt_count + v_num_tickets > v_event.max_tickets_per_user THEN
      RETURN jsonb_build_object('success', false, 'error', 'Per-user ticket limit (' || v_event.max_tickets_per_user || ') exceeded for this room.');
    END IF;
  END IF;

  -- Validate 4-digit format & global uniqueness inside locked event
  FOREACH v_num IN ARRAY p_ticket_numbers LOOP
    IF trim(COALESCE(v_num, '')) !~ '^\d{1,4}$' THEN
      RETURN jsonb_build_object('success', false, 'error', 'Invalid 4-digit ticket number format.');
    END IF;
    IF EXISTS (
      SELECT 1 FROM public.lottery_tickets
      WHERE event_id = p_event_id AND lpad(ticket_number, 4, '0') = lpad(trim(v_num), 4, '0')
    ) THEN
      RETURN jsonb_build_object('success', false, 'error', 'Ticket #' || lpad(trim(v_num), 4, '0') || ' is already taken. Please choose another combination.');
    END IF;
  END LOOP;

  v_total_cost := ROUND(v_event.ticket_price * v_num_tickets, 2);
  v_curr := COALESCE(v_event.currency, 'USDT');

  SELECT * INTO v_wallet FROM public.lottery_wallets
  WHERE user_id = v_uid
  ORDER BY updated_at DESC LIMIT 1
  FOR UPDATE;

  IF NOT FOUND OR COALESCE(v_wallet.balance, 0) < v_total_cost THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Insufficient USDT balance. Required: ' || v_total_cost || ' USDT, Available: ' || COALESCE(v_wallet.balance, 0) || ' USDT.'
    );
  END IF;

  v_new_balance := ROUND(v_wallet.balance - v_total_cost, 2);
  UPDATE public.lottery_wallets
  SET balance = v_new_balance, updated_at = now()
  WHERE address = v_wallet.address;

  v_order_ref := 'tkt-order-' || v_now_ms || '-' || floor(random() * 8999 + 1000)::text;
  v_user_display := COALESCE(p_username, '@' || substring(v_wallet.address from 1 for 6));

  FOREACH v_num IN ARRAY p_ticket_numbers LOOP
    v_ticket_id := 'tkt-' || v_now_ms || '-' || floor(random() * 8999 + 1000)::text || '-' || floor(random() * 899 + 100)::text;
    INSERT INTO public.lottery_tickets (
      id, user_id, user_address, username, event_id, event_title, ticket_number,
      price, purchase_time, status, match_tier, won_amount, claimed, currency, created_at
    ) VALUES (
      v_ticket_id, v_uid, v_wallet.address, v_user_display,
      p_event_id, v_event.title, lpad(trim(v_num), 4, '0'), v_event.ticket_price, v_now_ms,
      'active', NULL, 0, false, v_curr, now()
    );
  END LOOP;

  UPDATE public.lottery_events
  SET pool_prize = ROUND(pool_prize + (v_total_cost * 0.95), 2),
      tickets_sold = COALESCE(tickets_sold, 0) + v_num_tickets,
      participants_count = COALESCE(participants_count, 0) + 1
  WHERE id = p_event_id;

  v_tx_id := 'tx_' || to_char(now(), 'YYYYMMDDHH24MISS') || '_' || substr(md5(random()::text), 1, 8);
  INSERT INTO public.wallet_ledger (
    id, user_id, wallet_address, transaction_type, amount, balance_before, balance_after,
    currency, reference_id, description, metadata, created_at
  ) VALUES (
    v_tx_id, v_uid, v_wallet.address, 'ticket_purchase',
    -v_total_cost, v_wallet.balance, v_new_balance, 'USDT', v_order_ref,
    'Purchased ' || v_num_tickets || ' ticket(s) for ' || v_event.title,
    jsonb_build_object(
      'event_id', p_event_id,
      'room_id', COALESCE(v_event.room_id, 'room-' || p_event_id),
      'tickets_count', v_num_tickets,
      'currency', 'USDT'
    ),
    now()
  );

  -- Synchronized Lifetime Referral Commission on eligible ticket purchase turnover
  IF v_total_cost > 0 THEN
    SELECT * INTO v_ref FROM public.user_referrals
    WHERE referred_user_id = v_uid
    FOR UPDATE;

    IF FOUND
       AND v_ref.status = 'active'
       AND NOT COALESCE(v_ref.is_flagged, false)
       AND v_ref.referrer_id IS NOT NULL
       AND v_ref.referrer_id <> v_uid THEN

      v_cfg := public.get_authoritative_referral_settings();
      IF COALESCE((v_cfg->>'enabled')::boolean, false)
         AND COALESCE((v_cfg->>'lifetime_commission_enabled')::boolean, false)
         AND COALESCE(v_cfg->>'lifetime_commission_activity', 'ticket_purchase') = 'ticket_purchase' THEN
        v_comm_pct := GREATEST(0, COALESCE((v_cfg->>'lifetime_commission_percent')::numeric, 0));
        v_cfg_ver := COALESCE((v_cfg->>'config_version')::integer, 1);
        v_comm_amt := ROUND((v_total_cost * v_comm_pct) / 100.0, 2);

        IF v_comm_pct > 0 AND v_comm_amt > 0 THEN
          SELECT COALESCE(NULLIF(v_ref.referrer_address, ''), p.trc20_address)
          INTO v_ref_addr
          FROM public.profiles p WHERE p.id = v_ref.referrer_id;

          v_comm_res := public._internal_credit_virtual_credits(
            v_comm_amt,
            'referral_commission',
            'ref-comm-' || v_tx_id,
            'Lifetime Commission (' || trim(to_char(v_comm_pct, 'FM999990.##')) || '%) on ticket purchase',
            v_ref_addr,
            v_ref.referrer_id,
            jsonb_build_object(
              'reward_category', 'lifetime_commission',
              'activity', 'ticket_purchase',
              'referred_user_id', v_uid,
              'source_tx_id', v_tx_id,
              'source_order_ref', v_order_ref,
              'base_amount', v_total_cost,
              'applied_percent', v_comm_pct,
              'calculated_commission', v_comm_amt,
              'config_version', v_cfg_ver,
              'currency', 'USDT'
            )
          );

          v_comm_tx_id := v_comm_res->>'transaction_id';

          IF COALESCE((v_comm_res->>'success')::boolean, false) AND NOT COALESCE((v_comm_res->>'already_processed')::boolean, false) THEN
            INSERT INTO public.referral_rewards (
              referrer_id, referred_user_id, reward_type, amount, currency, status, ledger_tx_id, source_tx_id, details, created_at
            ) VALUES (
              v_ref.referrer_id, v_uid, 'lifetime_commission', v_comm_amt, 'USDT', 'credited', v_comm_tx_id, v_tx_id,
              jsonb_build_object(
                'description', 'Lifetime commission (' || trim(to_char(v_comm_pct, 'FM999990.##')) || '% of ' || v_total_cost || ' USDT)',
                'source_tx_id', v_tx_id,
                'base_amount', v_total_cost,
                'applied_percent', v_comm_pct,
                'config_version', v_cfg_ver
              ),
              now()
            ) ON CONFLICT DO NOTHING;

            UPDATE public.user_referrals
            SET total_commission_earned = COALESCE(total_commission_earned, 0) + v_comm_amt,
                updated_at = now()
            WHERE id = v_ref.id;
          END IF;
        END IF;
      END IF;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'total_cost', v_total_cost,
    'new_balance', v_new_balance,
    'tickets_count', v_num_tickets,
    'currency', 'USDT',
    'transaction_id', v_tx_id,
    'referral_commission_credited', v_comm_amt
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_server_time_ms() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public._compute_event_window_end(bigint, bigint, text, text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.verify_room_entry_secure(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_user_tickets_with_events() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.buy_lottery_tickets_secure(text, text[], text, text) TO authenticated, service_role;
