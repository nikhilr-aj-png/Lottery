-- ============================================================================
-- EarnFlow.in Migration:
--   1. Automatic Direct-to-Wallet Winner Reward Credits (Zero Manual Approval)
--   2. Idempotent Unique Indexes on Wallet Ledger & Winner Payouts
--   3. Remove Obsolete Manual Winner Payout Approval RPCs (Preserve Historical Records)
--   4. Strictly Active-Only Server-Side Filter for My Ticket (get_user_tickets_with_events)
-- Date: 2026-12-02
-- ============================================================================

-- 1. Enforce strict database-level idempotency against duplicate reward credits
CREATE UNIQUE INDEX IF NOT EXISTS idx_wallet_ledger_ref_type_unique
  ON public.wallet_ledger (reference_id, transaction_type)
  WHERE reference_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_winner_payouts_ref_unique
  ON public.winner_payouts (payout_reference)
  WHERE payout_reference IS NOT NULL AND COALESCE(is_deleted, false) = false;

-- 2. Upgrade finalize_lottery_draw_secure:
--    Automatically calculates winner rewards and credits each winner's wallet directly
--    via _internal_credit_virtual_credits('lottery_win', unique_ref) inside the atomic settlement.
--    No pending_approval queue or manual Admin approval is ever required.
CREATE OR REPLACE FUNCTION public.finalize_lottery_draw_secure(
  p_event_id text,
  p_winning_codes jsonb DEFAULT NULL::jsonb,
  p_draw_mode text DEFAULT NULL::text,
  p_custom_winner_count integer DEFAULT NULL::integer,
  p_custom_digits text DEFAULT NULL::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth', 'extensions', 'pg_temp'
AS $function$
DECLARE
  v_event record;
  v_now_ms bigint;
  v_codes_array text[] := ARRAY[]::text[];
  v_temp_code text;
  v_code_count integer := 1;
  v_winning_mode text;
  v_effective_draw_mode text;
  v_distribution jsonb;
  v_jackpot_mode text;
  v_min_jp numeric := 0;
  v_max_jp numeric := 0;
  v_event_prize_pool numeric := 0;
  v_actual_tickets_sold integer := 0;
  v_actual_collected numeric := 0;
  v_gross_pool numeric := 0;
  v_house_charge_total numeric := 0;
  v_net_funding_total numeric := 0;
  v_total_allocated numeric := 0;
  v_total_credited_now numeric := 0;
  v_primary_digits text;
  v_curr_code text;
  v_pos_share_percent numeric;
  v_pos_pool numeric;
  v_pos_matches text[];
  v_pos_match_count integer;
  v_payout_per_ticket numeric;
  v_matching_tkt record;
  v_resolved_uid uuid;
  v_resolved_username text;
  v_payout_id text;
  v_payout_ref text;
  v_credit_res jsonb;
  v_tx_id text;
  v_all_winning_tkt_ids text[] := ARRAY[]::text[];
  v_winning_tickets jsonb := '[]'::jsonb;
  v_finalized_at timestamptz;
  v_visibility_until timestamptz;
  v_audit_id text;
  v_revealed_seed text;
  v_client_seed text;
  v_commit_hash text;
  v_outcome_hash text;
  v_range_hash text;
  v_range_ratio numeric;
  v_temp_num integer;
  i integer;
BEGIN
  IF NOT (
    current_setting('role', true) = 'service_role'
    OR (current_setting('request.jwt.claims', true) IS NULL AND session_user IN ('postgres', 'supabase_admin'))
    OR public.is_admin()
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized: Admin privileges required.');
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('finalize_draw:' || p_event_id));
  PERFORM set_config('earnflow.internal_finalizing', 'true', true);

  SELECT * INTO v_event FROM public.lottery_events WHERE id = p_event_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Event not found: ' || p_event_id);
  END IF;

  IF COALESCE(v_event.is_deleted, false) OR v_event.status = 'deleted' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Deleted events cannot be finalized.');
  END IF;

  IF v_event.status IN ('completed', 'settled') THEN
    RETURN jsonb_build_object(
      'success', true,
      'already_finalized', true,
      'reconciled_stuck_status', false,
      'event_id', p_event_id,
      'winning_digits', v_event.winning_digits,
      'winning_codes', COALESCE(v_event.draw_result_codes, v_event.winning_codes),
      'finalized_at', v_event.finalized_at,
      'ticket_visibility_until', v_event.ticket_visibility_until,
      'result_published_at', v_event.result_published_at,
      'result_visible_until', v_event.result_visible_until,
      'audit_id', v_event.draw_audit_id,
      'message', 'Event is already finalized.'
    );
  END IF;

  IF v_event.finalized_at IS NOT NULL AND v_event.draw_audit_id IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM public.lottery_draw_audits WHERE id = v_event.draw_audit_id AND event_id = p_event_id)
       AND NOT EXISTS (SELECT 1 FROM public.lottery_tickets WHERE event_id = p_event_id AND status = 'active')
       AND NOT EXISTS (
         SELECT 1 FROM public.lottery_tickets
         WHERE event_id = p_event_id AND status = 'won' AND COALESCE(won_amount, 0) > 0 AND COALESCE(claimed, false) = false
       ) THEN
      UPDATE public.lottery_events
      SET status = 'completed',
          is_active = false,
          codes_locked = true,
          processing_error = NULL,
          processing_error_at = NULL
      WHERE id = p_event_id AND status <> 'completed';

      INSERT INTO public.admin_audit_logs (
        admin_id, action_type, target_type, target_id, changes
      ) VALUES (
        auth.uid(), 'RECOVER_FINALIZED_STATUS', 'lottery_events', p_event_id,
        jsonb_build_object(
          'previous_status', v_event.status,
          'recovered_status', 'completed',
          'draw_audit_id', v_event.draw_audit_id,
          'finalized_at', v_event.finalized_at,
          'zero_duplicate_payouts', true
        )
      );

      RETURN jsonb_build_object(
        'success', true,
        'already_finalized', true,
        'reconciled_stuck_status', true,
        'event_id', p_event_id,
        'winning_digits', v_event.winning_digits,
        'finalized_at', v_event.finalized_at,
        'audit_id', v_event.draw_audit_id,
        'message', 'Reconciled finalized event status to completed without duplicate payouts.'
      );
    END IF;
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Event has finalized_at timestamp with incomplete settlement records. Manual investigation required.'
    );
  END IF;

  v_winning_mode := COALESCE(v_event.winner_mode, 'single');
  v_effective_draw_mode := lower(trim(COALESCE(NULLIF(trim(COALESCE(p_draw_mode, '')), ''), v_event.draw_mode, 'random')));
  v_distribution := COALESCE(v_event.winner_distribution, '[{"position": 1, "percent": 100}]'::jsonb);

  -- Prefer locked/saved DB winning codes when available
  IF v_event.winning_codes IS NOT NULL AND jsonb_typeof(v_event.winning_codes) = 'array' AND jsonb_array_length(v_event.winning_codes) > 0 THEN
    FOR i IN 0..(jsonb_array_length(v_event.winning_codes) - 1) LOOP
      v_temp_code := trim(COALESCE(v_event.winning_codes->>i, ''));
      IF v_temp_code ~ '^\d{1,4}$' THEN
        v_temp_code := lpad(v_temp_code, 4, '0');
        IF NOT (v_temp_code = ANY(v_codes_array)) THEN
          v_codes_array := array_append(v_codes_array, v_temp_code);
        END IF;
      END IF;
    END LOOP;
  ELSIF v_event.preset_winning_digits IS NOT NULL AND trim(v_event.preset_winning_digits) ~ '^\d{1,4}$' THEN
    v_codes_array := ARRAY[lpad(trim(v_event.preset_winning_digits), 4, '0')];
  ELSIF p_winning_codes IS NOT NULL AND jsonb_typeof(p_winning_codes) = 'array' AND jsonb_array_length(p_winning_codes) > 0 THEN
    FOR i IN 0..(jsonb_array_length(p_winning_codes) - 1) LOOP
      v_temp_code := trim(COALESCE(p_winning_codes->>i, ''));
      IF v_temp_code ~ '^\d{1,4}$' THEN
        v_temp_code := lpad(v_temp_code, 4, '0');
        IF NOT (v_temp_code = ANY(v_codes_array)) THEN
          v_codes_array := array_append(v_codes_array, v_temp_code);
        END IF;
      END IF;
    END LOOP;
  ELSIF p_custom_digits IS NOT NULL AND trim(p_custom_digits) ~ '^\d{1,4}$' THEN
    v_codes_array := ARRAY[lpad(trim(p_custom_digits), 4, '0')];
  END IF;

  IF v_effective_draw_mode = 'preset' AND COALESCE(array_length(v_codes_array, 1), 0) = 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Winning digits have not been saved for this preset event. Cannot finalize without winning digits.'
    );
  END IF;

  v_code_count := CASE
    WHEN v_winning_mode = 'single' THEN 1
    ELSE GREATEST(2, COALESCE(v_event.winning_code_count, v_event.winner_count, p_custom_winner_count, 3))
  END;

  IF v_winning_mode = 'single' AND array_length(v_codes_array, 1) > 1 THEN
    v_codes_array := ARRAY[v_codes_array[1]];
  END IF;

  WHILE COALESCE(array_length(v_codes_array, 1), 0) < v_code_count LOOP
    IF v_effective_draw_mode = 'preset' AND COALESCE(array_length(v_codes_array, 1), 0) >= 1 THEN
      EXIT;
    END IF;
    v_temp_num := floor(random() * 10000)::integer;
    v_temp_code := lpad(v_temp_num::text, 4, '0');
    IF NOT (v_temp_code = ANY(v_codes_array)) THEN
      v_codes_array := array_append(v_codes_array, v_temp_code);
    END IF;
  END LOOP;

  v_primary_digits := v_codes_array[1];

  -- Compute actual sales, house charge, and net funding from tickets (strict reconciliation)
  SELECT COUNT(*)::integer,
         COALESCE(SUM(COALESCE(price, 0)), 0)::numeric,
         COALESCE(SUM(COALESCE(house_charge_amount, 0)), 0)::numeric,
         COALESCE(SUM(COALESCE(net_prize_contribution, COALESCE(price, 0))), 0)::numeric
  INTO v_actual_tickets_sold, v_actual_collected, v_house_charge_total, v_net_funding_total
  FROM public.lottery_tickets
  WHERE event_id = p_event_id
    AND COALESCE(status, 'active') <> 'refunded';

  v_actual_tickets_sold := COALESCE(v_actual_tickets_sold, 0);
  v_gross_pool := ROUND(COALESCE(v_actual_collected, 0), 2);
  v_house_charge_total := ROUND(COALESCE(v_house_charge_total, 0), 2);
  v_net_funding_total := ROUND(COALESCE(v_net_funding_total, 0), 2);

  v_finalized_at := clock_timestamp();
  v_visibility_until := v_finalized_at + (
    COALESCE(
      (SELECT NULLIF(trim(COALESCE(value->>'duration_hours', value->>'retention_duration_hours', '')), '')::numeric FROM public.platform_settings WHERE key = 'results_retention'),
      (SELECT NULLIF(trim(COALESCE(value->>'resultsRetentionHours', '')), '')::numeric FROM public.platform_settings WHERE key = 'global'),
      1.0
    ) * interval '1 hour'
  );

  v_revealed_seed := COALESCE(NULLIF(trim(COALESCE(v_event.revealed_seed, '')), ''), v_event.server_seed, 'seed_' || md5(p_event_id || v_finalized_at::text));
  v_client_seed := COALESCE(NULLIF(trim(COALESCE(v_event.client_seed, '')), ''), 'earnflow-official-draw');
  v_commit_hash := COALESCE(NULLIF(trim(COALESCE(v_event.sha256_seed, '')), ''), '0x' || encode(extensions.digest(v_revealed_seed, 'sha256'), 'hex'));
  v_outcome_hash := encode(extensions.digest(v_revealed_seed || ':' || v_client_seed || ':' || p_event_id, 'sha256'), 'hex');

  -- AUTHORITATIVE PRIZE RESOLUTION BY EVENT PRIZE MODEL (Fixed Jackpot vs Jackpot Range)
  v_jackpot_mode := lower(trim(COALESCE(v_event.jackpot_mode, 'fixed')));

  IF v_jackpot_mode = 'range' THEN
    v_min_jp := ROUND(GREATEST(0, COALESCE(v_event.min_jackpot, v_event.locked_jackpot, v_event.pool_prize, 0)), 2);
    v_max_jp := ROUND(GREATEST(v_min_jp, COALESCE(v_event.max_jackpot, v_min_jp)), 2);

    IF lower(COALESCE(v_event.jackpot_selection_method, 'manual')) = 'random' AND v_event.locked_jackpot IS NULL THEN
      v_range_hash := encode(extensions.digest(v_revealed_seed || ':' || v_client_seed || ':' || p_event_id || ':jackpot', 'sha256'), 'hex');
      v_range_ratio := (('x' || substr(v_range_hash, 1, 8))::bit(32)::bigint)::numeric / 4294967295.0;
      v_event_prize_pool := ROUND(v_min_jp + ((v_max_jp - v_min_jp) * v_range_ratio), 2);
      v_event_prize_pool := GREATEST(v_min_jp, LEAST(v_max_jp, v_event_prize_pool));
    ELSE
      v_event_prize_pool := ROUND(COALESCE(v_event.locked_jackpot, v_event.pool_prize, v_min_jp), 2);
      v_event_prize_pool := GREATEST(v_min_jp, LEAST(v_max_jp, v_event_prize_pool));
    END IF;
  ELSE
    v_event_prize_pool := ROUND(GREATEST(0, COALESCE(v_event.locked_jackpot, v_event.pool_prize, 0)), 2);
  END IF;

  -- Identify all eligible winning tickets, calculate payouts using existing distribution rules,
  -- and AUTOMATICALLY credit each winner's wallet + wallet_ledger directly (NO manual approval!)
  FOR i IN 1..array_length(v_codes_array, 1) LOOP
    v_curr_code := v_codes_array[i];
    v_pos_matches := ARRAY[]::text[];

    IF jsonb_array_length(v_distribution) >= i THEN
      v_pos_share_percent := COALESCE((v_distribution->(i - 1)->>'percent')::numeric, (100.0 / array_length(v_codes_array, 1)));
    ELSE
      v_pos_share_percent := 100.0 / array_length(v_codes_array, 1);
    END IF;

    v_pos_pool := ROUND((v_event_prize_pool * v_pos_share_percent) / 100.0, 2);

    FOR v_matching_tkt IN
      SELECT t.id
      FROM public.lottery_tickets t
      WHERE t.event_id = p_event_id
        AND t.status = 'active'
        AND lpad(regexp_replace(t.ticket_number::text, '\D', '', 'g'), 4, '0') = v_curr_code
      ORDER BY t.created_at ASC
    LOOP
      v_pos_matches := array_append(v_pos_matches, v_matching_tkt.id);
    END LOOP;

    v_pos_match_count := COALESCE(array_length(v_pos_matches, 1), 0);

    IF v_pos_match_count > 0 THEN
      v_payout_per_ticket := ROUND(v_pos_pool / v_pos_match_count, 2);

      FOR v_matching_tkt IN
        SELECT t.id, t.user_id, t.user_address, t.username, t.ticket_number
        FROM public.lottery_tickets t
        WHERE t.id = ANY(v_pos_matches)
        ORDER BY t.created_at ASC
        FOR UPDATE
      LOOP
        SELECT COALESCE(
          v_matching_tkt.user_id,
          (SELECT lw.user_id FROM public.lottery_wallets lw WHERE v_matching_tkt.user_address IS NOT NULL AND lower(lw.address) = lower(v_matching_tkt.user_address) LIMIT 1),
          (SELECT p.id FROM public.profiles p WHERE p.trc20_address IS NOT NULL AND v_matching_tkt.user_address IS NOT NULL AND lower(p.trc20_address) = lower(v_matching_tkt.user_address) LIMIT 1)
        ) INTO v_resolved_uid;

        IF v_resolved_uid IS NULL AND (v_matching_tkt.user_address IS NULL OR trim(v_matching_tkt.user_address) = '') THEN
          RAISE EXCEPTION 'Unable to resolve authenticated winner owner for ticket % in event %.', v_matching_tkt.id, p_event_id;
        END IF;

        SELECT COALESCE(
          NULLIF(regexp_replace(COALESCE(
            (SELECT p.username FROM public.profiles p WHERE p.id = v_resolved_uid LIMIT 1),
            v_matching_tkt.username
          ), '^@+', ''), ''),
          CASE WHEN v_matching_tkt.user_address IS NOT NULL AND length(v_matching_tkt.user_address) > 10
            THEN left(v_matching_tkt.user_address, 6) || '...' || right(v_matching_tkt.user_address, 4)
            ELSE 'Player'
          END
        ) INTO v_resolved_username;

        v_payout_id := 'wp-' || p_event_id || '-' || v_matching_tkt.id;
        v_payout_ref := 'lottery-' || p_event_id || '-' || v_matching_tkt.id;
        v_tx_id := NULL;

        IF v_payout_per_ticket > 0 THEN
          v_credit_res := public._internal_credit_virtual_credits(
            v_payout_per_ticket,
            'lottery_win',
            v_payout_ref,
            'Four-Digit Lottery Winner Reward – #' || v_curr_code || ' (' || COALESCE(v_event.title, 'Lottery Draw') || ')',
            v_matching_tkt.user_address,
            v_resolved_uid,
            jsonb_build_object(
              'payout_id', v_payout_id,
              'payout_type', 'lottery_win',
              'payout_reference', v_payout_ref,
              'event_id', p_event_id,
              'event_title', v_event.title,
              'ticket_id', v_matching_tkt.id,
              'winning_digits', v_curr_code,
              'position', i,
              'auto_credited', true
            )
          );

          IF NOT COALESCE((v_credit_res->>'success')::boolean, false) THEN
            RAISE EXCEPTION 'Automatic winner wallet credit failed for ticket %: %',
              v_matching_tkt.id, COALESCE(v_credit_res->>'error', 'Unknown error');
          END IF;

          v_tx_id := v_credit_res->>'transaction_id';
          IF NOT COALESCE((v_credit_res->>'already_processed')::boolean, false) THEN
            v_total_credited_now := ROUND(v_total_credited_now + v_payout_per_ticket, 2);
          END IF;
        END IF;

        -- Preserve completed settlement record in winner_payouts for historical reporting & audit
        INSERT INTO public.winner_payouts (
          id, event_id, event_title, ticket_id, user_id,
          winner_address, winner_username, winning_digits,
          tickets_sold, ticket_price, total_pool_collected,
          winner_share_percent, calculated_amount, payout_amount, max_allowed_amount,
          status, tx_hash, approved_at, position, currency, payout_type, payout_reference, notes, created_at
        ) VALUES (
          v_payout_id, p_event_id, v_event.title, v_matching_tkt.id, v_resolved_uid,
          COALESCE(NULLIF(v_credit_res->>'wallet_address', ''), v_matching_tkt.user_address, ''),
          v_resolved_username, v_curr_code,
          v_actual_tickets_sold, COALESCE(v_event.ticket_price, 0), v_gross_pool,
          ROUND(v_pos_share_percent, 2),
          v_payout_per_ticket, v_payout_per_ticket, GREATEST(v_pos_pool, v_payout_per_ticket),
          'completed', COALESCE(v_tx_id, v_payout_ref), v_finalized_at,
          i, 'USDT', 'lottery_win', v_payout_ref,
          CASE WHEN v_pos_match_count > 1
            THEN 'Auto-credited directly to user wallet · Tie-split across ' || v_pos_match_count || ' matching tickets'
            ELSE 'Auto-credited directly to user wallet on draw settlement'
          END,
          v_finalized_at
        )
        ON CONFLICT (id) DO UPDATE SET
          status = 'completed',
          tx_hash = COALESCE(EXCLUDED.tx_hash, public.winner_payouts.tx_hash),
          approved_at = COALESCE(public.winner_payouts.approved_at, EXCLUDED.approved_at),
          failure_reason = NULL;

        UPDATE public.lottery_tickets
        SET status = 'won',
            won_amount = v_payout_per_ticket,
            claimed = true,
            match_tier = 'EXACT 4/4 MATCH (POS #' || i || ')'
        WHERE id = v_matching_tkt.id;

        v_all_winning_tkt_ids := array_append(v_all_winning_tkt_ids, v_matching_tkt.id);
        v_total_allocated := ROUND(v_total_allocated + v_payout_per_ticket, 2);

        v_winning_tickets := v_winning_tickets || jsonb_build_object(
          'ticket_id', v_matching_tkt.id,
          'user_id', v_resolved_uid,
          'position', i,
          'code', v_curr_code,
          'payout', v_payout_per_ticket,
          'ledger_tx_id', v_tx_id,
          'auto_credited', true
        );
      END LOOP;
    END IF;
  END LOOP;

  -- Mark all remaining active tickets for this event as lost (historical records preserved)
  UPDATE public.lottery_tickets
  SET status = 'lost',
      match_tier = 'NO MATCH',
      won_amount = 0
  WHERE event_id = p_event_id AND status = 'active';

  v_audit_id := 'draw_audit_' || to_char(v_finalized_at, 'YYYYMMDDHH24MISS') || '_' || substr(md5(p_event_id || random()::text), 1, 6);

  INSERT INTO public.lottery_draw_audits (
    id, event_id, event_title, draw_timestamp, winning_digits,
    commit_hash, revealed_seed, client_seed, outcome_hash,
    tickets_snapshot_count, winner_count, total_payout_fc, verified, metadata, created_at
  ) VALUES (
    v_audit_id, p_event_id, v_event.title, v_finalized_at, v_primary_digits,
    v_commit_hash, v_revealed_seed, v_client_seed, v_outcome_hash,
    v_actual_tickets_sold, COALESCE(array_length(v_all_winning_tkt_ids, 1), 0), v_total_allocated,
    true,
    jsonb_build_object(
      'winning_codes', to_jsonb(v_codes_array),
      'draw_mode', v_effective_draw_mode,
      'prize_model', v_jackpot_mode,
      'configured_prize_pool', v_event_prize_pool,
      'gross_ticket_sales', v_gross_pool,
      'house_charge_collected', v_house_charge_total,
      'net_prize_funding', v_net_funding_total,
      'auto_credited_wallets', true,
      'ticket_visibility_until', v_visibility_until
    ),
    v_finalized_at
  );

  -- Mark Completed ONLY as the final atomic step after every winner credit, ledger entry, ticket update, and audit succeeds
  UPDATE public.lottery_events
  SET status = 'completed',
      is_active = false,
      codes_locked = true,
      tickets_sold = v_actual_tickets_sold,
      gross_ticket_sales = v_gross_pool,
      house_charge_collected = v_house_charge_total,
      net_prize_funding = v_net_funding_total,
      pool_prize = v_event_prize_pool,
      locked_jackpot = v_event_prize_pool,
      winning_digits = v_primary_digits,
      winning_codes = to_jsonb(v_codes_array),
      draw_result_codes = to_jsonb(v_codes_array),
      draw_result_details = jsonb_build_object(
        'codes', to_jsonb(v_codes_array),
        'winning_tickets', v_winning_tickets,
        'tickets_sold', v_actual_tickets_sold,
        'gross_pool', v_gross_pool,
        'house_charge_collected', v_house_charge_total,
        'net_prize_funding', v_net_funding_total,
        'prize_model', v_jackpot_mode,
        'configured_prize_pool', v_event_prize_pool,
        'min_jackpot', v_event.min_jackpot,
        'max_jackpot', v_event.max_jackpot,
        'total_allocated', v_total_allocated,
        'distributable_pool', v_event_prize_pool,
        'auto_credited', true,
        'winner_count', COALESCE(array_length(v_all_winning_tkt_ids, 1), 0)
      ),
      revealed_seed = v_revealed_seed,
      client_seed = v_client_seed,
      draw_audit_id = v_audit_id,
      draw_executed_at = v_finalized_at,
      finalized_at = v_finalized_at,
      ticket_visibility_until = v_visibility_until,
      result_published_at = v_finalized_at,
      result_visible_until = v_visibility_until,
      processing_error = NULL,
      processing_error_at = NULL
  WHERE id = p_event_id;

  INSERT INTO public.admin_audit_logs (
    admin_id, action_type, target_type, target_id, changes
  ) VALUES (
    auth.uid(), 'FINALIZE_LOTTERY_DRAW', 'lottery_events', p_event_id,
    jsonb_build_object(
      'winning_digits', v_primary_digits,
      'winning_codes', to_jsonb(v_codes_array),
      'prize_model', v_jackpot_mode,
      'configured_prize_pool', v_event_prize_pool,
      'gross_ticket_sales', v_gross_pool,
      'house_charge_collected', v_house_charge_total,
      'total_allocated', v_total_allocated,
      'total_credited_now', v_total_credited_now,
      'winner_count', COALESCE(array_length(v_all_winning_tkt_ids, 1), 0),
      'auto_credited', true,
      'ticket_visibility_until', v_visibility_until
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'event_id', p_event_id,
    'winning_digits', v_primary_digits,
    'winning_codes', to_jsonb(v_codes_array),
    'prize_model', v_jackpot_mode,
    'configured_prize_pool', v_event_prize_pool,
    'gross_pool', v_gross_pool,
    'house_charge_collected', v_house_charge_total,
    'net_prize_funding', v_net_funding_total,
    'distributable_pool', v_event_prize_pool,
    'total_allocated', v_total_allocated,
    'total_paid_out', v_total_allocated,
    'auto_credited', true,
    'winner_count', COALESCE(array_length(v_all_winning_tkt_ids, 1), 0),
    'finalized_at', v_finalized_at,
    'result_published_at', v_finalized_at,
    'result_visible_until', v_visibility_until,
    'ticket_visibility_until', v_visibility_until,
    'audit_id', v_audit_id
  );
END;
$function$;

-- 3. Update finalize_monthly_leaderboard_competition so it ALSO auto-credits winners directly
--    without queuing obsolete 'pending_approval' records.
DO $$
DECLARE
  v_def text;
BEGIN
  SELECT pg_get_functiondef(p.oid) INTO v_def
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'finalize_monthly_leaderboard_competition';

  IF v_def IS NOT NULL AND position('Auto-credited directly to user wallet' in v_def) = 0 THEN
    CREATE OR REPLACE FUNCTION public.finalize_monthly_leaderboard_competition(
      p_month_key text DEFAULT NULL::text,
      p_force boolean DEFAULT false
    )
    RETURNS jsonb
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path TO 'public', 'auth', 'pg_temp'
    AS $lb$
    DECLARE
      v_uid uuid := auth.uid();
      v_is_privileged_cron boolean := (
        current_setting('role', true) = 'service_role'
        OR (current_setting('request.jwt.claims', true) IS NULL AND session_user IN ('postgres', 'supabase_admin'))
      );
      v_month text;
      v_end timestamptz;
      v_month_label text;
      v_config jsonb;
      v_months jsonb;
      v_month_cfg jsonb;
      v_published jsonb;
      v_prizes jsonb;
      v_top10 jsonb;
      v_item jsonb;
      v_rank integer;
      v_user_id uuid;
      v_username text;
      v_wallet_addr text;
      v_reward_amt numeric;
      v_payout_id text;
      v_payout_ref text;
      v_credit_res jsonb;
      v_created_count integer := 0;
      v_skipped_count integer := 0;
      v_now timestamptz := now();
    BEGIN
      IF NOT v_is_privileged_cron AND NOT public.is_super_admin() THEN
        RETURN jsonb_build_object('success', false, 'error', 'Unauthorized: Super Admin privileges required.');
      END IF;

      IF p_month_key IS NULL OR trim(p_month_key) = '' THEN
        v_month := to_char(((date_trunc('month', now() AT TIME ZONE 'UTC') - interval '1 day')::date), 'YYYY-MM');
      ELSE
        v_month := trim(p_month_key);
      END IF;

      IF v_month !~ '^\d{4}-(0[1-9]|1[0-2])$' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Invalid month format. Expected YYYY-MM.');
      END IF;

      v_end := ((to_date(v_month || '-01', 'YYYY-MM-DD') + interval '1 month')::timestamp AT TIME ZONE 'UTC');
      v_month_label := trim(to_char(to_date(v_month || '-01', 'YYYY-MM-DD'), 'FMMonth YYYY'));

      IF v_now < v_end AND NOT COALESCE(p_force, false) THEN
        RETURN jsonb_build_object(
          'success', false,
          'month_key', v_month,
          'error', 'Competition month ' || v_month_label || ' has not ended yet. Scheduled finalization runs after ' || to_char(v_end AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI"Z"') || '.'
        );
      END IF;

      IF COALESCE(p_force, false) AND NOT v_is_privileged_cron AND NOT public.is_super_admin() THEN
        RETURN jsonb_build_object('success', false, 'error', 'Only Super Admin can manually finalize early.');
      END IF;

      PERFORM pg_advisory_xact_lock(hashtext('lb_finalize:' || v_month));

      SELECT value INTO v_config FROM public.platform_settings WHERE key = 'monthly_leaderboard_config';
      SELECT value INTO v_published FROM public.platform_settings WHERE key = 'monthly_leaderboard_published';
      v_config := COALESCE(v_config, '{}'::jsonb);
      v_months := COALESCE(v_config->'months', '{}'::jsonb);
      v_month_cfg := v_months->v_month;

      IF v_month_cfg IS NULL AND v_published IS NOT NULL AND COALESCE(v_published->>'month_key', '') = v_month THEN
        v_month_cfg := v_published;
      END IF;

      IF v_month_cfg IS NULL THEN
        RETURN jsonb_build_object('success', false, 'month_key', v_month, 'error', 'No Super Admin prize configuration saved for ' || v_month_label || '.');
      END IF;

      v_prizes := COALESCE(v_month_cfg->'prizes', '[]'::jsonb);
      v_top10 := public.get_monthly_competition_top10(v_month);

      FOR v_item IN SELECT * FROM jsonb_array_elements(v_top10) LOOP
        v_rank := COALESCE((v_item->>'rank')::integer, 0);
        v_user_id := NULLIF(v_item->>'user_id', '')::uuid;
        v_username := COALESCE(NULLIF(v_item->>'username', ''), 'Player');
        v_wallet_addr := NULLIF(trim(COALESCE(v_item->>'wallet_address', '')), '');

        IF v_wallet_addr IS NULL AND v_user_id IS NOT NULL THEN
          SELECT COALESCE(
            NULLIF(trim(p.trc20_address), ''),
            (SELECT lw.address FROM public.lottery_wallets lw WHERE lw.user_id = v_user_id ORDER BY lw.updated_at DESC LIMIT 1)
          )
          INTO v_wallet_addr
          FROM public.profiles p
          WHERE p.id = v_user_id;
        END IF;

        SELECT ROUND(COALESCE((elem->>'reward_usdt')::numeric, (elem->>'amount')::numeric, 0), 2)
        INTO v_reward_amt
        FROM jsonb_array_elements(v_prizes) AS elem
        WHERE COALESCE((elem->>'rank')::integer, 0) = v_rank
        LIMIT 1;

        IF v_rank BETWEEN 1 AND 10
           AND v_user_id IS NOT NULL
           AND v_wallet_addr IS NOT NULL
           AND COALESCE(v_reward_amt, 0) > 0 THEN

          v_payout_ref := 'lb-' || v_month || '-rank-' || v_rank || '-' || v_user_id::text;
          v_payout_id := 'WP-LB-' || replace(v_month, '-', '') || '-R' || v_rank;

          IF NOT EXISTS (
            SELECT 1 FROM public.winner_payouts wp
            WHERE (
              wp.payout_reference = v_payout_ref
              OR (
                wp.payout_type = 'monthly_leaderboard'
                AND wp.competition_month = v_month
                AND (wp.user_id = v_user_id OR wp.leaderboard_rank = v_rank)
                AND COALESCE(wp.is_deleted, false) = false
                AND wp.status NOT IN ('cancelled', 'rejected')
              )
            )
          ) THEN
            v_credit_res := public._internal_credit_virtual_credits(
              v_reward_amt,
              'monthly_leaderboard_reward',
              v_payout_ref,
              'Monthly Leaderboard Reward – Rank #' || v_rank || ' (' || v_month_label || ')',
              v_wallet_addr,
              v_user_id,
              jsonb_build_object(
                'payout_id', v_payout_id,
                'payout_type', 'monthly_leaderboard',
                'payout_reference', v_payout_ref,
                'competition_month', v_month,
                'leaderboard_rank', v_rank,
                'auto_credited', true
              )
            );

            IF COALESCE((v_credit_res->>'success')::boolean, false) THEN
              INSERT INTO public.winner_payouts (
                id, event_id, event_title, ticket_id, user_id,
                winner_address, winner_username, winning_digits,
                tickets_sold, ticket_price, total_pool_collected,
                winner_share_percent, calculated_amount, payout_amount, max_allowed_amount,
                status, tx_hash, approved_at, position, currency, payout_type,
                competition_month, leaderboard_rank, payout_reference, notes, created_at
              ) VALUES (
                v_payout_id, 'leaderboard-' || v_month, v_month_label || ' Monthly Leaderboard', 'RANK-' || v_rank,
                v_user_id, v_wallet_addr, v_username, 'RANK #' || v_rank,
                0, 0, v_reward_amt, 100, v_reward_amt, v_reward_amt, v_reward_amt,
                'completed', COALESCE(v_credit_res->>'transaction_id', v_payout_ref), v_now,
                v_rank, 'USDT', 'monthly_leaderboard',
                v_month, v_rank, v_payout_ref,
                'Auto-credited directly to user wallet for ' || v_month_label || ' Rank #' || v_rank,
                v_now
              )
              ON CONFLICT DO NOTHING;
              v_created_count := v_created_count + 1;
            ELSE
              v_skipped_count := v_skipped_count + 1;
            END IF;
          ELSE
            v_skipped_count := v_skipped_count + 1;
          END IF;
        ELSE
          v_skipped_count := v_skipped_count + 1;
        END IF;
      END LOOP;

      v_month_cfg := v_month_cfg || jsonb_build_object(
        'finalized', true,
        'finalized_at', v_now,
        'finalized_winners_count', v_created_count
      );
      v_months := v_months || jsonb_build_object(v_month, v_month_cfg);
      v_config := v_config || jsonb_build_object('months', v_months, 'updated_at', v_now);

      INSERT INTO public.platform_settings (key, value, updated_at)
      VALUES ('monthly_leaderboard_config', v_config, v_now)
      ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = v_now;

      INSERT INTO public.admin_audit_logs (admin_id, action_type, target_type, target_id, changes)
      VALUES (
        v_uid, 'FINALIZE_MONTHLY_LEADERBOARD', 'monthly_leaderboard', v_month,
        jsonb_build_object(
          'month_key', v_month,
          'credited_payouts', v_created_count,
          'skipped_or_existing', v_skipped_count,
          'auto_credited', true,
          'forced', COALESCE(p_force, false)
        )
      );

      RETURN jsonb_build_object(
        'success', true,
        'month_key', v_month,
        'month_label', v_month_label,
        'created_count', v_created_count,
        'skipped_count', v_skipped_count
      );
    END;
    $lb$;
  END IF;
END $$;

-- 4. Remove obsolete manual Winner Payout Approval backend RPCs
--    (Preserving historical winner_payouts table, rows, wallet_ledger, and audit records!)
DROP FUNCTION IF EXISTS public.admin_disburse_winner_secure(text, numeric, text, text);
DROP FUNCTION IF EXISTS public.admin_disburse_winner_secure(text, numeric, text);
DROP FUNCTION IF EXISTS public.admin_cancel_or_delete_payout_secure(text, text, text);

-- 5. Strictly Active-Only Server-Side Filter for My Ticket (get_user_tickets_with_events)
--    Returns ONLY tickets belonging to authenticated user's currently ACTIVE, non-expired events.
--    All expired/completed/winning/losing tickets remain safely preserved in public.lottery_tickets,
--    but never appear in My Ticket once the event expires!
CREATE OR REPLACE FUNCTION public.get_user_tickets_with_events()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'auth', 'pg_temp'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_now_ts timestamptz := clock_timestamp();
  v_now_ms bigint := (EXTRACT(EPOCH FROM v_now_ts) * 1000)::bigint;
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
        'currency', COALESCE(le.currency, lt.currency, 'USDT'),
        'purchase_time', lt.purchase_time,
        'created_at', lt.created_at,
        'status', lt.status,
        'match_tier', lt.match_tier,
        'won_amount', lt.won_amount,
        'claimed', lt.claimed,
        'user_address', lt.user_address,
        'username', lt.username,
        'ledger_tx_ref', tx.ledger_id,
        'event_exists', true,
        'room_id', COALESCE(le.room_id, 'room-' || lt.event_id),
        'room_name', COALESCE(le.room_name, le.title, lt.event_title, 'Lottery Room'),
        'lottery_type', COALESCE(le.game_id, 'four-digit-lottery'),
        'start_time', COALESCE(le.start_time, 0),
        'draw_time', public._compute_event_window_end(le.start_time, le.draw_time, le.duration_value::text, le.duration_unit),
        'duration_value', le.duration_value,
        'duration_unit', le.duration_unit,
        'pool_prize', COALESCE(le.pool_prize, 0),
        'event_status', le.status,
        'event_is_active', COALESCE(le.is_active, false),
        'event_is_deleted', false,
        'event_is_paused', false,
        'is_finalized', false,
        'finalized_at', NULL,
        'finalized_at_ms', NULL,
        'ticket_visibility_until', NULL,
        'ticket_visibility_until_ms', NULL,
        'is_post_finalization_hidden', false,
        'winning_digits', NULL,
        'draw_result_codes', '[]'::jsonb
      ) AS row_data
    FROM public.lottery_tickets lt
    INNER JOIN public.lottery_events le ON le.id = lt.event_id
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
      AND COALESCE(le.is_deleted, false) = false
      AND COALESCE(le.is_paused, false) = false
      AND COALESCE(le.is_active, true) = true
      AND lower(COALESCE(le.status, '')) = 'active'
      AND le.finalized_at IS NULL
      AND public._compute_event_window_end(
        le.start_time,
        le.draw_time,
        le.duration_value::text,
        le.duration_unit
      ) > v_now_ms
  ) sub;

  RETURN jsonb_build_object(
    'server_now_ms', v_now_ms,
    'tickets', v_rows
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.get_user_tickets_with_events() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_user_tickets_with_events() TO authenticated;
