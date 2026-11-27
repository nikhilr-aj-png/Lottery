-- ============================================================================
-- EARNFLOW.IN: FINANCIAL SETTINGS CLEANUP, HOUSE CHARGE & PRIZE MODELS
-- ============================================================================
-- 1. Remove obsolete settings from platform_settings ('global'):
--    - treasuryTrc20 (Master Treasury / Distribution Hot Wallet placeholder)
--    - defaultWinnerSharePercent (redundant/conflicting 90% global share)
-- 2. Add idempotent server-side house-charge accounting columns & ledger table
--    (without altering historical wallet balances or historical ledger rows).
-- 3. Activate houseFeePercent dynamically inside buy_lottery_tickets_secure()
--    with clear separation from referral commissions & advertised event jackpots.
-- 4. Update finalize_lottery_draw_secure() to settle strictly by prize model:
--    - 'fixed': exact predetermined locked_jackpot / pool_prize (no 90% cut)
--    - 'range': exact prize strictly within [min_jackpot, max_jackpot] (manual or
--      server-side deterministic random at finalization, no 90% cut)
-- 5. Stop fabricating fake '0x...' / 'TX-...' hashes in withdrawal/payout RPCs.
-- ============================================================================

-- 1. Clean obsolete keys from global platform_settings (preserve existing houseFeePercent & withdrawal bounds)
UPDATE public.platform_settings
SET value = COALESCE(value, '{}'::jsonb) - 'treasuryTrc20' - 'defaultWinnerSharePercent',
    updated_at = now()
WHERE key = 'global';

-- Ensure houseFeePercent is always numeric if missing
UPDATE public.platform_settings
SET value = jsonb_set(COALESCE(value, '{}'::jsonb), '{houseFeePercent}', '5'::jsonb, true),
    updated_at = now()
WHERE key = 'global'
  AND (value->>'houseFeePercent' IS NULL OR trim(value->>'houseFeePercent') = '');

-- 2. Add non-destructive accounting columns to lottery_events & lottery_tickets
ALTER TABLE public.lottery_events
  ADD COLUMN IF NOT EXISTS gross_ticket_sales numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS house_charge_collected numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS net_prize_funding numeric DEFAULT 0;

-- Remove old 90% default on new events cleanly (does NOT touch existing rows)
ALTER TABLE public.lottery_events
  ALTER COLUMN winner_payout_share_percent SET DEFAULT 100;

ALTER TABLE public.winner_payouts
  ALTER COLUMN winner_share_percent SET DEFAULT 100;

ALTER TABLE public.lottery_tickets
  ADD COLUMN IF NOT EXISTS house_charge_percent numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS house_charge_amount numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS net_prize_contribution numeric DEFAULT 0;

-- Dedicated idempotent house-charge accounting ledger (keeps wallet_ledger cleanly user-scoped)
CREATE TABLE IF NOT EXISTS public.house_charge_ledger (
  id text PRIMARY KEY,
  order_ref text NOT NULL UNIQUE,
  event_id text NOT NULL,
  user_id uuid,
  tickets_count integer NOT NULL DEFAULT 1,
  gross_amount numeric(18,2) NOT NULL DEFAULT 0,
  house_charge_percent numeric(6,2) NOT NULL DEFAULT 0,
  house_charge_amount numeric(18,2) NOT NULL DEFAULT 0,
  net_amount_for_prize numeric(18,2) NOT NULL DEFAULT 0,
  referral_commission_amount numeric(18,2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'USDT',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_house_charge_ledger_event_id
  ON public.house_charge_ledger (event_id, created_at DESC);

ALTER TABLE public.house_charge_ledger ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS house_charge_ledger_admin_select ON public.house_charge_ledger;
CREATE POLICY house_charge_ledger_admin_select
  ON public.house_charge_ledger
  FOR SELECT
  TO authenticated
  USING (public.is_admin());

-- 3. Authoritative server-side Platform Settings update RPC (rejects invalid ranges & strips obsolete fields)
CREATE OR REPLACE FUNCTION public.admin_update_platform_settings_secure(
  p_payload jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth', 'pg_temp'
AS $$
DECLARE
  v_admin_uid uuid := auth.uid();
  v_admin_email text;
  v_prev_global jsonb := '{}'::jsonb;
  v_next_global jsonb;
  v_min_wd numeric;
  v_max_wd numeric;
  v_house_fee numeric;
  v_username_fee numeric;
  v_retention numeric;
  v_support_email text;
  v_apk_url text;
BEGIN
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized: Admin privileges required.');
  END IF;

  SELECT value INTO v_prev_global FROM public.platform_settings WHERE key = 'global';
  v_prev_global := COALESCE(v_prev_global, '{}'::jsonb) - 'treasuryTrc20' - 'defaultWinnerSharePercent';

  v_min_wd := ROUND(COALESCE(NULLIF(trim(COALESCE(p_payload->>'minWithdrawal', '')), '')::numeric, (v_prev_global->>'minWithdrawal')::numeric, 5), 2);
  v_max_wd := ROUND(COALESCE(NULLIF(trim(COALESCE(p_payload->>'maxWithdrawal', '')), '')::numeric, (v_prev_global->>'maxWithdrawal')::numeric, 10000), 2);
  v_house_fee := ROUND(COALESCE(NULLIF(trim(COALESCE(p_payload->>'houseFeePercent', '')), '')::numeric, (v_prev_global->>'houseFeePercent')::numeric, 5), 2);
  v_username_fee := ROUND(COALESCE(NULLIF(trim(COALESCE(p_payload->>'usernameChangeFee', '')), '')::numeric, (v_prev_global->>'usernameChangeFee')::numeric, 5), 2);
  v_retention := COALESCE(NULLIF(trim(COALESCE(p_payload->>'resultsRetentionHours', '')), '')::numeric, (v_prev_global->>'resultsRetentionHours')::numeric, 1);
  v_support_email := COALESCE(NULLIF(trim(COALESCE(p_payload->>'supportEmail', '')), ''), v_prev_global->>'supportEmail', 'earnflow.user@gmail.com');
  v_apk_url := COALESCE(NULLIF(trim(COALESCE(p_payload->>'apkDownloadUrl', '')), ''), v_prev_global->>'apkDownloadUrl', '/download/earnflow.apk');

  IF v_house_fee < 0 OR v_house_fee > 30 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Platform House Charge must be between 0% and 30%.');
  END IF;

  IF v_min_wd < 1 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Minimum withdrawal must be at least 1.00 USDT.');
  END IF;

  IF v_max_wd < v_min_wd THEN
    RETURN jsonb_build_object('success', false, 'error', 'Maximum withdrawal must be greater than or equal to minimum withdrawal.');
  END IF;

  IF v_username_fee < 0 OR v_username_fee > 1000 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Username change fee must be between 0 and 1000 USDT.');
  END IF;

  IF v_retention < 0.1 OR v_retention > 168 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Results display duration must be between 0.1 and 168 hours.');
  END IF;

  v_next_global := (v_prev_global || COALESCE(p_payload, '{}'::jsonb))
    - 'treasuryTrc20'
    - 'defaultWinnerSharePercent'
    || jsonb_build_object(
      'supportedCurrency', 'USDT',
      'supportedNetwork', 'TRC-20',
      'minWithdrawal', v_min_wd,
      'maxWithdrawal', v_max_wd,
      'houseFeePercent', v_house_fee,
      'usernameChangeFee', v_username_fee,
      'resultsRetentionHours', v_retention,
      'supportEmail', v_support_email,
      'apkDownloadUrl', v_apk_url
    );

  INSERT INTO public.platform_settings (key, value, updated_at)
  VALUES ('global', v_next_global, now())
  ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now();

  INSERT INTO public.platform_settings (key, value, updated_at)
  VALUES (
    'withdrawal_settings',
    jsonb_build_object(
      'supportedNetwork', 'TRC-20',
      'supportedCurrency', 'USDT',
      'minWithdrawal', v_min_wd,
      'maxWithdrawal', v_max_wd,
      'networkFee', 1.0
    ),
    now()
  )
  ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now();

  IF p_payload ? 'resultsRetentionHours' THEN
    INSERT INTO public.platform_settings (key, value, updated_at)
    VALUES (
      'results_retention',
      jsonb_build_object(
        'duration_hours', v_retention,
        'retention_duration_hours', v_retention,
        'default_option', CASE WHEN v_retention >= 1 THEN v_retention::text || '_hour' || CASE WHEN v_retention = 1 THEN '' ELSE 's' END ELSE round(v_retention * 60)::text || '_min' END,
        'label', v_retention::text || ' hour(s)'
      ),
      now()
    )
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now();
  END IF;

  IF p_payload ? 'spinWheelSettings' THEN
    INSERT INTO public.platform_settings (key, value, updated_at)
    VALUES ('spin_wheel_settings', p_payload->'spinWheelSettings', now())
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now();
  END IF;

  SELECT email INTO v_admin_email FROM public.profiles WHERE id = v_admin_uid;
  INSERT INTO public.admin_audit_logs (
    admin_id, admin_email, action_type, target_type, target_id, changes
  ) VALUES (
    v_admin_uid, v_admin_email, 'UPDATE_PLATFORM_SETTINGS', 'platform_settings', 'global',
    jsonb_build_object(
      'houseFeePercent', v_house_fee,
      'minWithdrawal', v_min_wd,
      'maxWithdrawal', v_max_wd,
      'usernameChangeFee', v_username_fee
    )
  );

  RETURN jsonb_build_object('success', true, 'settings', v_next_global);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_update_platform_settings_secure(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_update_platform_settings_secure(jsonb) TO authenticated;

-- 4. Update buy_lottery_tickets_secure:
--    - Dynamically read authoritative houseFeePercent from platform_settings ('global')
--    - Calculate gross sales, house charge, and net prize funding server-side
--    - Preserve advertised Fixed Jackpot / Jackpot Range (do NOT overwrite pool_prize!)
--    - Record idempotent house-charge breakdown in house_charge_ledger, lottery_tickets, wallet_ledger, & lottery_events
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
  v_ticket_id text;
  v_user_display text;
  v_tx_id text;
  v_order_ref text;
  v_curr text := 'USDT';
  v_global_cfg jsonb;
  v_house_fee_pct numeric := 5;
  v_house_charge_total numeric := 0;
  v_net_prize_total numeric := 0;
  v_per_ticket_hc numeric := 0;
  v_per_ticket_net numeric := 0;
  v_rem_hc numeric := 0;
  v_rem_net numeric := 0;
  v_tkt_idx integer := 0;
  v_hc_this numeric := 0;
  v_net_this numeric := 0;
  v_hc_ledger_id text;
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

  IF v_event.status <> 'active' THEN
    RETURN jsonb_build_object('success', false, 'error', 'This lottery draw is no longer active.');
  END IF;

  IF v_event.draw_time IS NOT NULL AND v_event.draw_time <= (EXTRACT(EPOCH FROM now()) * 1000) THEN
    RETURN jsonb_build_object('success', false, 'error', 'This lottery has reached its draw cutoff time.');
  END IF;

  IF COALESCE(v_event.ticket_limit_mode, 'unlimited') = 'limited'
     AND v_event.max_total_tickets IS NOT NULL
     AND (COALESCE(v_event.tickets_sold, 0) + v_num_tickets) > v_event.max_total_tickets THEN
    RETURN jsonb_build_object('success', false, 'error', 'Requested ticket count exceeds remaining event ticket capacity.');
  END IF;

  FOREACH v_num IN ARRAY p_ticket_numbers LOOP
    IF EXISTS (
      SELECT 1 FROM public.lottery_tickets
      WHERE event_id = p_event_id AND lpad(ticket_number, 4, '0') = lpad(v_num, 4, '0')
    ) THEN
      RETURN jsonb_build_object('success', false, 'error', 'Ticket #' || lpad(v_num, 4, '0') || ' is already taken. Please choose another combination.');
    END IF;
  END LOOP;

  -- Authoritative Server-Side Platform House Charge (%)
  SELECT value INTO v_global_cfg FROM public.platform_settings WHERE key = 'global';
  v_house_fee_pct := LEAST(30, GREATEST(0, COALESCE(NULLIF(trim(COALESCE(v_global_cfg->>'houseFeePercent', '')), '')::numeric, 5.0)));

  v_total_cost := ROUND(v_event.ticket_price * v_num_tickets, 2);
  v_house_charge_total := ROUND((v_total_cost * v_house_fee_pct) / 100.0, 2);
  v_net_prize_total := ROUND(v_total_cost - v_house_charge_total, 2);
  v_curr := 'USDT';

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

  v_now_ms := (EXTRACT(EPOCH FROM now()) * 1000)::bigint;
  v_order_ref := 'tkt-order-' || v_now_ms || '-' || substr(md5(random()::text || v_uid::text), 1, 8);
  v_user_display := COALESCE(p_username, '@' || substring(v_wallet.address from 1 for 6));

  v_per_ticket_hc := ROUND(v_house_charge_total / v_num_tickets, 2);
  v_per_ticket_net := ROUND(v_event.ticket_price - v_per_ticket_hc, 2);
  v_rem_hc := v_house_charge_total;
  v_rem_net := v_net_prize_total;
  v_tkt_idx := 0;

  FOREACH v_num IN ARRAY p_ticket_numbers LOOP
    v_tkt_idx := v_tkt_idx + 1;
    IF v_tkt_idx = v_num_tickets THEN
      v_hc_this := v_rem_hc;
      v_net_this := v_rem_net;
    ELSE
      v_hc_this := v_per_ticket_hc;
      v_net_this := v_per_ticket_net;
      v_rem_hc := ROUND(v_rem_hc - v_hc_this, 2);
      v_rem_net := ROUND(v_rem_net - v_net_this, 2);
    END IF;

    v_ticket_id := 'tkt-' || v_now_ms || '-' || floor(random() * 8999 + 1000)::text || '-' || floor(random() * 899 + 100)::text;
    INSERT INTO public.lottery_tickets (
      id, user_id, user_address, username, event_id, event_title, ticket_number,
      price, purchase_time, status, match_tier, won_amount, claimed, currency,
      house_charge_percent, house_charge_amount, net_prize_contribution, created_at
    ) VALUES (
      v_ticket_id, v_uid, v_wallet.address, v_user_display,
      p_event_id, v_event.title, lpad(v_num, 4, '0'), v_event.ticket_price, v_now_ms,
      'active', NULL, 0, false, v_curr,
      v_house_fee_pct, v_hc_this, v_net_this, now()
    );
  END LOOP;

  -- Update event sales & house charge accounting WITHOUT mutating advertised Fixed Jackpot / Range pool_prize
  UPDATE public.lottery_events
  SET gross_ticket_sales = ROUND(COALESCE(gross_ticket_sales, 0) + v_total_cost, 2),
      house_charge_collected = ROUND(COALESCE(house_charge_collected, 0) + v_house_charge_total, 2),
      net_prize_funding = ROUND(COALESCE(net_prize_funding, 0) + v_net_prize_total, 2),
      tickets_sold = COALESCE(tickets_sold, 0) + v_num_tickets,
      participants_count = COALESCE(participants_count, 0) + 1
  WHERE id = p_event_id;

  -- Synchronized Lifetime Referral Commission on eligible gross ticket purchase turnover (accounted separately)
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

          v_tx_id := 'tx_' || to_char(now(), 'YYYYMMDDHH24MISS') || '_' || substr(md5(v_order_ref), 1, 8);
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

  v_tx_id := COALESCE(v_tx_id, 'tx_' || to_char(now(), 'YYYYMMDDHH24MISS') || '_' || substr(md5(v_order_ref), 1, 8));
  INSERT INTO public.wallet_ledger (
    id, user_id, wallet_address, transaction_type, amount, balance_before, balance_after,
    currency, reference_id, description, metadata, created_at
  ) VALUES (
    v_tx_id, v_uid, v_wallet.address, 'ticket_purchase',
    -v_total_cost, v_wallet.balance, v_new_balance, 'USDT', v_order_ref,
    'Purchased ' || v_num_tickets || ' ticket(s) for ' || v_event.title,
    jsonb_build_object(
      'event_id', p_event_id,
      'tickets_count', v_num_tickets,
      'currency', 'USDT',
      'gross_ticket_sales', v_total_cost,
      'house_charge_percent', v_house_fee_pct,
      'house_charge_amount', v_house_charge_total,
      'net_prize_allocation', v_net_prize_total,
      'referral_commission_amount', v_comm_amt,
      'prize_model', COALESCE(v_event.jackpot_mode, 'fixed')
    ),
    now()
  );

  v_hc_ledger_id := 'hc_' || to_char(now(), 'YYYYMMDDHH24MISS') || '_' || substr(md5(v_order_ref), 1, 8);
  INSERT INTO public.house_charge_ledger (
    id, order_ref, event_id, user_id, tickets_count,
    gross_amount, house_charge_percent, house_charge_amount, net_amount_for_prize,
    referral_commission_amount, currency, created_at
  ) VALUES (
    v_hc_ledger_id, v_order_ref, p_event_id, v_uid, v_num_tickets,
    v_total_cost, v_house_fee_pct, v_house_charge_total, v_net_prize_total,
    v_comm_amt, 'USDT', now()
  )
  ON CONFLICT (order_ref) DO NOTHING;

  RETURN jsonb_build_object(
    'success', true,
    'total_cost', v_total_cost,
    'gross_ticket_sales', v_total_cost,
    'house_charge_percent', v_house_fee_pct,
    'house_charge_amount', v_house_charge_total,
    'net_prize_funding', v_net_prize_total,
    'new_balance', v_new_balance,
    'tickets_count', v_num_tickets,
    'currency', 'USDT',
    'transaction_id', v_tx_id,
    'referral_commission_credited', v_comm_amt
  );
END;
$$;

-- 5. Update admin_save_event_winning_digits_secure (no hardcoded 90% share deduction)
CREATE OR REPLACE FUNCTION public.admin_save_event_winning_digits_secure(
  p_event_id text,
  p_winning_codes jsonb,
  p_winner_mode text DEFAULT 'single'::text,
  p_draw_mode text DEFAULT 'preset'::text,
  p_payout_share_percent numeric DEFAULT 100,
  p_winner_distribution jsonb DEFAULT NULL::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth', 'pg_temp'
AS $$
DECLARE
  v_admin_uid uuid := auth.uid();
  v_event record;
  v_now_ms bigint;
  v_expires_at_ms bigint;
  v_dur_ms numeric;
  v_clean_codes text[] := ARRAY[]::text[];
  v_code text;
  v_i integer;
  v_mode text;
  v_draw_mode text;
  v_dist jsonb;
  v_is_sched_unpublished boolean;
BEGIN
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized: Admin privileges required.');
  END IF;

  IF p_event_id IS NULL OR trim(p_event_id) = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Event ID is required.');
  END IF;

  SELECT * INTO v_event FROM public.lottery_events WHERE id = p_event_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Event not found: ' || p_event_id);
  END IF;

  IF COALESCE(v_event.is_deleted, false) OR v_event.status = 'deleted' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Deleted events cannot be modified.');
  END IF;

  v_now_ms := floor(EXTRACT(EPOCH FROM clock_timestamp()) * 1000)::bigint;
  v_is_sched_unpublished := (v_event.status IN ('scheduled', 'draft') AND v_event.published_at IS NULL);

  IF COALESCE(v_event.duration_value, 0) > 0 THEN
    v_dur_ms := CASE
      WHEN lower(COALESCE(v_event.duration_unit, 'hours')) LIKE 'min%' THEN v_event.duration_value * 60 * 1000
      WHEN lower(COALESCE(v_event.duration_unit, 'hours')) LIKE 'day%' THEN v_event.duration_value * 86400 * 1000
      ELSE v_event.duration_value * 3600 * 1000
    END;
  ELSE
    v_dur_ms := 0;
  END IF;

  v_expires_at_ms := COALESCE(
    v_event.draw_time,
    CASE WHEN COALESCE(v_event.start_time, 0) > 0 AND v_dur_ms > 0 THEN floor(v_event.start_time + v_dur_ms)::bigint ELSE 0 END
  );

  IF v_event.status IN ('completed', 'settled', 'processing', 'expired', 'result_pending')
     OR v_event.finalized_at IS NOT NULL
     OR COALESCE(v_event.codes_locked, false)
     OR (NOT v_is_sched_unpublished AND v_expires_at_ms > 0 AND v_now_ms >= v_expires_at_ms) THEN

    IF NOT COALESCE(v_event.codes_locked, false) AND v_event.status = 'active' THEN
      UPDATE public.lottery_events
      SET codes_locked = true,
          status = 'expired',
          is_active = false
      WHERE id = p_event_id;
    END IF;

    RETURN jsonb_build_object(
      'success', false,
      'locked', true,
      'error', 'Event expiration time has passed or event is finalized. Winning digits are permanently locked and cannot be edited.'
    );
  END IF;

  v_mode := CASE WHEN lower(trim(COALESCE(p_winner_mode, v_event.winner_mode, 'single'))) = 'multiple' THEN 'multiple' ELSE 'single' END;
  v_draw_mode := CASE WHEN lower(trim(COALESCE(p_draw_mode, v_event.draw_mode, 'preset'))) = 'random' THEN 'random' ELSE 'preset' END;

  IF p_winning_codes IS NULL OR jsonb_typeof(p_winning_codes) <> 'array' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Winning codes must be an array of 4-digit strings.');
  END IF;

  FOR v_i IN 0..(jsonb_array_length(p_winning_codes) - 1) LOOP
    v_code := trim(COALESCE(p_winning_codes->>v_i, ''));
    IF v_code !~ '^\d{4}$' THEN
      RETURN jsonb_build_object('success', false, 'error', 'Every winning code must be an exact 4-digit string (0000-9999), preserving leading zeros.');
    END IF;
    IF NOT (v_code = ANY(v_clean_codes)) THEN
      v_clean_codes := array_append(v_clean_codes, v_code);
    END IF;
  END LOOP;

  IF v_mode = 'single' THEN
    IF array_length(v_clean_codes, 1) IS DISTINCT FROM 1 THEN
      RETURN jsonb_build_object('success', false, 'error', 'Single Winner events must specify exactly 1 unique 4-digit winning number.');
    END IF;
    v_dist := '[{"position": 1, "percent": 100}]'::jsonb;
  ELSE
    IF COALESCE(array_length(v_clean_codes, 1), 0) < 2 THEN
      RETURN jsonb_build_object('success', false, 'error', 'Multiple Winner events require at least 2 unique 4-digit winning numbers.');
    END IF;
    IF v_event.winner_count IS NOT NULL AND v_event.winner_count >= 2 AND array_length(v_clean_codes, 1) <> v_event.winner_count THEN
      RETURN jsonb_build_object('success', false, 'error', 'Multiple Winner events require exactly ' || v_event.winner_count || ' unique winning numbers.');
    END IF;
    v_dist := COALESCE(p_winner_distribution, v_event.winner_distribution, '[{"position": 1, "percent": 50}, {"position": 2, "percent": 50}]'::jsonb);
  END IF;

  UPDATE public.lottery_events
  SET winner_mode = v_mode,
      draw_mode = v_draw_mode,
      winner_count = array_length(v_clean_codes, 1),
      winning_code_count = array_length(v_clean_codes, 1),
      preset_winning_digits = v_clean_codes[1],
      winning_codes = to_jsonb(v_clean_codes),
      codes_timing = 'configured',
      winner_distribution = v_dist,
      metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
        'winner_mode', v_mode,
        'draw_mode', v_draw_mode,
        'winner_count', array_length(v_clean_codes, 1),
        'preset_winning_digits', v_clean_codes[1],
        'winning_codes', to_jsonb(v_clean_codes),
        'winner_distribution', v_dist
      )
  WHERE id = p_event_id;

  INSERT INTO public.admin_audit_logs (
    admin_id, action_type, target_type, target_id, changes
  ) VALUES (
    v_admin_uid, 'SAVE_EVENT_WINNING_DIGITS', 'lottery_events', p_event_id,
    jsonb_build_object(
      'winning_codes', to_jsonb(v_clean_codes),
      'winner_mode', v_mode,
      'draw_mode', v_draw_mode
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'event_id', p_event_id,
    'winning_codes', to_jsonb(v_clean_codes),
    'preset_winning_digits', v_clean_codes[1],
    'winner_count', array_length(v_clean_codes, 1),
    'locked', false
  );
END;
$$;

-- 6. Update finalize_lottery_draw_secure:
--    - Settles strictly by Event Prize Model:
--      * 'fixed': exact configured locked_jackpot / pool_prize (NO 90% cut!)
--      * 'range': exact prize strictly within [min_jackpot, max_jackpot] (manual or deterministic RNG)
--    - House charge is accounted for separately in ticket purchases & event gross/house/net totals
--    - Winner payouts split v_event_prize_pool across positions according to winner_distribution (100% total)
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
AS $$
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

  IF v_event.status IN ('completed', 'settled') OR v_event.finalized_at IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success', true,
      'already_finalized', true,
      'event_id', p_event_id,
      'winning_digits', v_event.winning_digits,
      'winning_codes', COALESCE(v_event.draw_result_codes, v_event.winning_codes),
      'finalized_at', v_event.finalized_at,
      'ticket_visibility_until', v_event.ticket_visibility_until,
      'audit_id', v_event.draw_audit_id,
      'message', 'Event is already finalized.'
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
  v_visibility_until := v_finalized_at + interval '1 hour';

  v_revealed_seed := COALESCE(NULLIF(trim(COALESCE(v_event.revealed_seed, '')), ''), v_event.server_seed, 'seed_' || md5(p_event_id || v_finalized_at::text));
  v_client_seed := COALESCE(NULLIF(trim(COALESCE(v_event.client_seed, '')), ''), 'earnflow-official-draw');
  v_commit_hash := COALESCE(NULLIF(trim(COALESCE(v_event.sha256_seed, '')), ''), '0x' || encode(extensions.digest(v_revealed_seed, 'sha256'), 'hex'));
  v_outcome_hash := encode(extensions.digest(v_revealed_seed || ':' || v_client_seed || ':' || p_event_id, 'sha256'), 'hex');

  -- AUTHORITATIVE PRIZE RESOLUTION BY EVENT PRIZE MODEL (Fixed Jackpot vs Jackpot Range; NO 90% override)
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
    -- 'fixed': exact predetermined fixed jackpot configured by administrator
    v_event_prize_pool := ROUND(GREATEST(0, COALESCE(v_event.locked_jackpot, v_event.pool_prize, 0)), 2);
  END IF;

  -- Distribute v_event_prize_pool strictly by configured winner positions (summing to 100%)
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
      LOOP
        SELECT COALESCE(
          v_matching_tkt.user_id,
          (SELECT lw.user_id FROM public.lottery_wallets lw WHERE lower(lw.address) = lower(v_matching_tkt.user_address) LIMIT 1),
          (SELECT p.id FROM public.profiles p WHERE p.trc20_address IS NOT NULL AND lower(p.trc20_address) = lower(v_matching_tkt.user_address) LIMIT 1)
        ) INTO v_resolved_uid;

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

        INSERT INTO public.winner_payouts (
          id, event_id, event_title, ticket_id, user_id,
          winner_address, winner_username, winning_digits,
          tickets_sold, ticket_price, total_pool_collected,
          winner_share_percent, calculated_amount, payout_amount, max_allowed_amount,
          status, position, currency, payout_type, payout_reference, notes, created_at
        ) VALUES (
          v_payout_id, p_event_id, v_event.title, v_matching_tkt.id, v_resolved_uid,
          COALESCE(v_matching_tkt.user_address, ''), v_resolved_username, v_curr_code,
          v_actual_tickets_sold, COALESCE(v_event.ticket_price, 0), v_gross_pool,
          ROUND(v_pos_share_percent, 2),
          v_payout_per_ticket, v_payout_per_ticket, GREATEST(v_pos_pool, v_payout_per_ticket),
          'pending_approval', i, 'USDT', 'lottery_win', v_payout_ref,
          CASE WHEN v_pos_match_count > 1 THEN 'Tie-split across ' || v_pos_match_count || ' matching tickets' ELSE NULL END,
          v_finalized_at
        )
        ON CONFLICT (id) DO NOTHING;

        UPDATE public.lottery_tickets
        SET status = 'won',
            won_amount = v_payout_per_ticket,
            claimed = false,
            match_tier = 'EXACT 4/4 MATCH (POS #' || i || ')'
        WHERE id = v_matching_tkt.id;

        v_all_winning_tkt_ids := array_append(v_all_winning_tkt_ids, v_matching_tkt.id);
        v_total_allocated := ROUND(v_total_allocated + v_payout_per_ticket, 2);

        v_winning_tickets := v_winning_tickets || jsonb_build_object(
          'ticket_id', v_matching_tkt.id,
          'position', i,
          'code', v_curr_code,
          'payout', v_payout_per_ticket
        );
      END LOOP;
    END IF;
  END LOOP;

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
      'ticket_visibility_until', v_visibility_until
    ),
    v_finalized_at
  );

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
        'winner_count', COALESCE(array_length(v_all_winning_tkt_ids, 1), 0)
      ),
      revealed_seed = v_revealed_seed,
      client_seed = v_client_seed,
      draw_audit_id = v_audit_id,
      draw_executed_at = v_finalized_at,
      finalized_at = v_finalized_at,
      ticket_visibility_until = v_visibility_until
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
      'winner_count', COALESCE(array_length(v_all_winning_tkt_ids, 1), 0),
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
    'winner_count', COALESCE(array_length(v_all_winning_tkt_ids, 1), 0),
    'finalized_at', v_finalized_at,
    'ticket_visibility_until', v_visibility_until,
    'audit_id', v_audit_id
  );
END;
$$;

-- 7. Remove fake hash fabrication from withdrawal approval RPC
CREATE OR REPLACE FUNCTION public.admin_process_withdrawal_secure(
  p_order_id text,
  p_action text,
  p_tx_hash text DEFAULT NULL,
  p_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth', 'pg_temp'
AS $$
DECLARE
  v_admin_id uuid := auth.uid();
  v_admin_email text;
  v_wd record;
  v_norm_action text := lower(trim(COALESCE(p_action, '')));
  v_refund_res jsonb;
  v_final_hash text;
BEGIN
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized: Admin privileges required.');
  END IF;

  IF v_norm_action NOT IN ('approve', 'reject') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid action. Use approve or reject.');
  END IF;

  SELECT * INTO v_wd FROM public.lottery_withdrawals WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Withdrawal order not found.');
  END IF;

  IF v_wd.status IN ('completed', 'flagged', 'rejected') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Withdrawal has already been finalized (' || v_wd.status || ').');
  END IF;

  SELECT email INTO v_admin_email FROM public.profiles WHERE id = v_admin_id;

  IF v_norm_action = 'approve' THEN
    -- Preserve NULL if no real external TRON transaction hash was provided (never generate fake hashes)
    v_final_hash := NULLIF(trim(COALESCE(p_tx_hash, '')), '');

    UPDATE public.lottery_withdrawals
    SET status = 'completed',
        tx_hash = v_final_hash,
        admin_notes = COALESCE(NULLIF(trim(COALESCE(p_notes, '')), ''), admin_notes)
    WHERE id = v_wd.id;

    INSERT INTO public.admin_audit_logs (
      admin_id, admin_email, action_type, target_type, target_id, changes
    ) VALUES (
      v_admin_id, v_admin_email, 'APPROVE_WITHDRAWAL', 'lottery_withdrawals', v_wd.id,
      jsonb_build_object('amount', v_wd.amount, 'net_disbursal', v_wd.net_disbursal, 'network', v_wd.network, 'tx_hash', v_final_hash)
    );

    RETURN jsonb_build_object('success', true, 'status', 'completed', 'tx_hash', v_final_hash, 'order_id', v_wd.id);
  END IF;

  v_refund_res := public._internal_credit_virtual_credits(
    v_wd.amount,
    'withdrawal_refund',
    'wd-refund-' || v_wd.id,
    'Refund for rejected withdrawal #' || v_wd.id,
    v_wd.user_address,
    v_wd.user_id,
    jsonb_build_object('withdrawal_id', v_wd.id, 'reason', COALESCE(p_notes, 'Admin flagged/rejected'))
  );

  IF NOT COALESCE((v_refund_res->>'success')::boolean, false) THEN
    RETURN jsonb_build_object('success', false, 'error', COALESCE(v_refund_res->>'error', 'Failed to refund user wallet.'));
  END IF;

  UPDATE public.lottery_withdrawals
  SET status = 'flagged',
      admin_notes = COALESCE(NULLIF(trim(COALESCE(p_notes, '')), ''), 'Flagged/Rejected by Admin')
  WHERE id = v_wd.id;

  INSERT INTO public.admin_audit_logs (
    admin_id, admin_email, action_type, target_type, target_id, changes
  ) VALUES (
    v_admin_id, v_admin_email, 'REJECT_WITHDRAWAL', 'lottery_withdrawals', v_wd.id,
    jsonb_build_object('amount', v_wd.amount, 'refund_tx_id', v_refund_res->>'transaction_id', 'user_id', v_wd.user_id)
  );

  RETURN jsonb_build_object(
    'success', true,
    'status', 'flagged',
    'order_id', v_wd.id,
    'refund_tx_id', v_refund_res->>'transaction_id',
    'user_new_balance', v_refund_res->>'new_balance'
  );
END;
$$;

-- 8. Remove fake 'TX-...' hash fabrication on internal wallet credits in admin_disburse_winner_secure
--    (Keep tx_hash = NULL unless a real p_tx_hash is supplied; payout_reference holds internal ref)
DO $$
DECLARE
  v_def text;
BEGIN
  SELECT pg_get_functiondef(p.oid)
  INTO v_def
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'admin_disburse_winner_secure';

  IF v_def IS NOT NULL AND position('TX-' in v_def) > 0 THEN
    v_def := regexp_replace(
      v_def,
      'v_hash\s*:=\s*COALESCE\(NULLIF\(trim\(COALESCE\(p_tx_hash,\s*''''\)\),\s*''''\),\s*''TX-''\s*\|\|\s*upper\(substr\(md5\(v_payout_ref\s*\|\|\s*v_now::text\),\s*1,\s*24\)\)\);',
      'v_hash := NULLIF(trim(COALESCE(p_tx_hash, '''')), '''');',
      'n'
    );
    EXECUTE v_def;
  END IF;
END $$;
