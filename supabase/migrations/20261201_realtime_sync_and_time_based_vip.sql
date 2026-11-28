-- ============================================================================
-- EarnFlow.in Migration: Full Realtime Sync, VIP Event RLS Isolation,
-- and Time-Based VIP Membership Plans (1 Month, 2 Months, 1 Year)
-- Date: 2026-12-01
-- ============================================================================

-- 1. Schema extensions for Time-Based VIP Membership Plans
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS vip_plan_id text,
  ADD COLUMN IF NOT EXISTS vip_expires_at timestamptz;

ALTER TABLE public.vip_membership_logs
  ADD COLUMN IF NOT EXISTS plan_id text,
  ADD COLUMN IF NOT EXISTS plan_label text,
  ADD COLUMN IF NOT EXISTS starts_at timestamptz,
  ADD COLUMN IF NOT EXISTS expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS status text DEFAULT 'active';

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_vip_status_check,
  ADD CONSTRAINT profiles_vip_status_check
    CHECK (vip_status = ANY (ARRAY['inactive'::text, 'active'::text, 'revoked'::text, 'expired'::text]));

ALTER TABLE public.vip_membership_logs
  DROP CONSTRAINT IF EXISTS vip_membership_logs_action_type_check,
  ADD CONSTRAINT vip_membership_logs_action_type_check
    CHECK (action_type = ANY (ARRAY['purchased'::text, 'renewed'::text, 'expired'::text, 'admin_granted'::text, 'admin_revoked'::text]));

-- Seed / ensure vip_plans in platform_settings preserving existing configured 1-Month price
DO $$
DECLARE
  v_global jsonb;
  v_one_month_price numeric;
  v_vip_plans jsonb;
BEGIN
  SELECT value INTO v_global FROM public.platform_settings WHERE key = 'global';
  v_global := COALESCE(v_global, '{}'::jsonb);
  v_one_month_price := ROUND(COALESCE(NULLIF(trim(COALESCE(v_global->>'vipMembershipPrice', '')), '')::numeric, 25.00), 2);
  IF v_one_month_price <= 0 THEN
    v_one_month_price := 25.00;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.platform_settings WHERE key = 'vip_plans') THEN
    v_vip_plans := jsonb_build_object(
      '1_month', jsonb_build_object(
        'id', '1_month',
        'label', '1 Month',
        'duration_months', 1,
        'duration_years', 0,
        'price', v_one_month_price,
        'enabled', true
      ),
      '2_months', jsonb_build_object(
        'id', '2_months',
        'label', '2 Months',
        'duration_months', 2,
        'duration_years', 0,
        'price', ROUND(v_one_month_price * 1.8, 2),
        'enabled', true
      ),
      '1_year', jsonb_build_object(
        'id', '1_year',
        'label', '1 Year',
        'duration_months', 0,
        'duration_years', 1,
        'price', ROUND(v_one_month_price * 8.0, 2),
        'enabled', true
      )
    );

    INSERT INTO public.platform_settings (key, value, updated_at)
    VALUES ('vip_plans', v_vip_plans, now())
    ON CONFLICT (key) DO NOTHING;

    UPDATE public.platform_settings
    SET value = jsonb_set(value, '{vipPlans}', v_vip_plans, true),
        updated_at = now()
    WHERE key = 'global';
  END IF;
END $$;

-- 2. Protect new VIP subscription columns against client-side tampering
CREATE OR REPLACE FUNCTION public.protect_profile_sensitive_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth', 'pg_temp'
AS $$
BEGIN
  IF current_setting('earnflow.internal_profile_update', true) = 'true'
     OR current_setting('role', true) = 'service_role'
     OR (current_setting('request.jwt.claims', true) IS NULL AND session_user IN ('postgres', 'supabase_admin'))
     OR public.is_admin() THEN
    RETURN NEW;
  END IF;

  IF NEW.player_type IS DISTINCT FROM OLD.player_type
     OR NEW.vip_status IS DISTINCT FROM OLD.vip_status
     OR NEW.vip_activated_at IS DISTINCT FROM OLD.vip_activated_at
     OR NEW.vip_expires_at IS DISTINCT FROM OLD.vip_expires_at
     OR NEW.vip_plan_id IS DISTINCT FROM OLD.vip_plan_id
     OR NEW.vip_paid_amount IS DISTINCT FROM OLD.vip_paid_amount
     OR NEW.vip_payment_reference IS DISTINCT FROM OLD.vip_payment_reference
     OR NEW.vip_source IS DISTINCT FROM OLD.vip_source
     OR NEW.vip_granted_by IS DISTINCT FROM OLD.vip_granted_by
     OR NEW.role IS DISTINCT FROM OLD.role
     OR NEW.status IS DISTINCT FROM OLD.status THEN
    RAISE EXCEPTION 'Unauthorized modification of protected membership or role fields.' USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

-- 3. Authoritative live VIP check (enforces expiry timestamp immediately even before cron ticks)
CREATE OR REPLACE FUNCTION public._is_user_vip(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'auth', 'pg_temp'
AS $$
  SELECT CASE
    WHEN p_user_id IS NULL THEN false
    ELSE EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE id = p_user_id
        AND COALESCE(player_type, 'normal') = 'vip'
        AND COALESCE(vip_status, 'inactive') = 'active'
        AND (vip_expires_at IS NULL OR vip_expires_at > clock_timestamp())
    )
  END;
$$;

-- 4. Automatic VIP Membership Expiry Sweeper (runs inside 1-min pg_cron tick)
CREATE OR REPLACE FUNCTION public.expire_vip_memberships_tick()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth', 'pg_temp'
AS $$
DECLARE
  v_rec record;
  v_count integer := 0;
  v_now timestamptz := clock_timestamp();
  v_log_id text;
BEGIN
  PERFORM set_config('earnflow.internal_profile_update', 'true', true);

  FOR v_rec IN
    SELECT id, vip_plan_id, vip_expires_at
    FROM public.profiles
    WHERE COALESCE(player_type, 'normal') = 'vip'
      AND COALESCE(vip_status, 'inactive') = 'active'
      AND vip_expires_at IS NOT NULL
      AND vip_expires_at <= v_now
    FOR UPDATE SKIP LOCKED
  LOOP
    UPDATE public.profiles
    SET player_type = 'normal',
        vip_status = 'expired',
        updated_at = v_now
    WHERE id = v_rec.id;

    UPDATE public.vip_membership_logs
    SET status = 'expired'
    WHERE user_id = v_rec.id
      AND COALESCE(status, 'active') = 'active'
      AND expires_at IS NOT NULL
      AND expires_at <= v_now;

    v_log_id := 'viplog_exp_' || to_char(v_now, 'YYYYMMDDHH24MISS') || '_' || substr(md5(v_rec.id::text || random()::text), 1, 8);
    INSERT INTO public.vip_membership_logs (
      id, user_id, action_type, previous_player_type, new_player_type,
      plan_id, expires_at, status, reason, created_at
    ) VALUES (
      v_log_id,
      v_rec.id,
      'expired',
      'vip',
      'normal',
      v_rec.vip_plan_id,
      v_rec.vip_expires_at,
      'expired',
      'Automatic VIP subscription expiration reached.',
      v_now
    );

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

-- Integrate VIP expiry sweep into existing pg_cron 1-minute lifecycle tick
DO $$
DECLARE
  v_def text;
BEGIN
  SELECT pg_get_functiondef(p.oid) INTO v_def
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'process_lottery_lifecycle_tick';

  IF v_def IS NOT NULL AND position('expire_vip_memberships_tick' in v_def) = 0 THEN
    v_def := replace(
      v_def,
      '-- 1. Publish Scheduled events once their UTC scheduled_publish_at arrives',
      '-- 0. Automatically expire elapsed time-based VIP memberships' || chr(10) ||
      '  PERFORM public.expire_vip_memberships_tick();' || chr(10) || chr(10) ||
      '  -- 1. Publish Scheduled events once their UTC scheduled_publish_at arrives'
    );
    EXECUTE v_def;
  END IF;
END $$;

-- 5. Calendar-accurate VIP Expiry Calculator (handles end-of-month clamping consistently)
CREATE OR REPLACE FUNCTION public._compute_vip_expiry(
  p_start_at timestamptz,
  p_plan_id text
)
RETURNS timestamptz
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE lower(trim(COALESCE(p_plan_id, '1_month')))
    WHEN '1_month' THEN ((p_start_at AT TIME ZONE 'UTC') + interval '1 month') AT TIME ZONE 'UTC'
    WHEN '2_months' THEN ((p_start_at AT TIME ZONE 'UTC') + interval '2 months') AT TIME ZONE 'UTC'
    WHEN '1_year' THEN ((p_start_at AT TIME ZONE 'UTC') + interval '1 year') AT TIME ZONE 'UTC'
    ELSE ((p_start_at AT TIME ZONE 'UTC') + interval '1 month') AT TIME ZONE 'UTC'
  END;
$$;

-- 6. Time-Based VIP Membership Purchase & Early Renewal RPC
DROP FUNCTION IF EXISTS public.purchase_vip_membership_secure(text);
DROP FUNCTION IF EXISTS public.purchase_vip_membership_secure(text, text);

CREATE OR REPLACE FUNCTION public.purchase_vip_membership_secure(
  p_plan_id text DEFAULT '1_month',
  p_idempotency_key text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth', 'pg_temp'
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_plan_id text := lower(trim(COALESCE(NULLIF(p_plan_id, ''), '1_month')));
  v_profile record;
  v_wallet record;
  v_plans_cfg jsonb;
  v_global_cfg jsonb;
  v_plan_obj jsonb;
  v_plan_label text;
  v_plan_enabled boolean;
  v_vip_price numeric;
  v_prev_balance numeric;
  v_new_balance numeric;
  v_ref_id text;
  v_tx_id text;
  v_log_id text;
  v_now timestamptz := clock_timestamp();
  v_is_early_renewal boolean := false;
  v_start_at timestamptz;
  v_expires_at timestamptz;
  v_action_type text := 'purchased';
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Authentication required to purchase VIP Membership.');
  END IF;

  IF v_plan_id NOT IN ('1_month', '2_months', '1_year') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid VIP membership plan selected.');
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('vip_upgrade_' || v_uid::text));
  PERFORM set_config('earnflow.internal_profile_update', 'true', true);

  SELECT * INTO v_profile FROM public.profiles WHERE id = v_uid FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Player profile not found.');
  END IF;

  -- Legacy / Permanent Active VIP without expiry date cannot be accidentally double-charged
  IF COALESCE(v_profile.player_type, 'normal') = 'vip'
     AND COALESCE(v_profile.vip_status, 'inactive') = 'active'
     AND v_profile.vip_expires_at IS NULL THEN
    RETURN jsonb_build_object(
      'success', true,
      'already_vip', true,
      'player_type', 'vip',
      'vip_status', 'active',
      'vip_activated_at', v_profile.vip_activated_at,
      'vip_expires_at', NULL,
      'vip_plan_id', COALESCE(v_profile.vip_plan_id, 'legacy'),
      'vip_paid_amount', v_profile.vip_paid_amount,
      'vip_payment_reference', v_profile.vip_payment_reference,
      'message', 'Your VIP Membership is already active.'
    );
  END IF;

  v_ref_id := COALESCE(
    NULLIF(trim(COALESCE(p_idempotency_key, '')), ''),
    'vip-sub-' || v_plan_id || '-' || to_char(v_now, 'YYYYMMDDHH24MISS') || '-' || v_uid::text
  );

  -- Strict Idempotency: Never charge twice for the same request key
  IF EXISTS (SELECT 1 FROM public.wallet_ledger WHERE reference_id = v_ref_id) THEN
    RETURN jsonb_build_object(
      'success', true,
      'already_processed', true,
      'player_type', v_profile.player_type,
      'vip_status', v_profile.vip_status,
      'vip_plan_id', v_profile.vip_plan_id,
      'vip_activated_at', v_profile.vip_activated_at,
      'vip_expires_at', v_profile.vip_expires_at,
      'vip_payment_reference', v_ref_id,
      'message', 'Membership payment already processed.'
    );
  END IF;

  -- Authoritative Server-Side Plan Price & Status from Database
  SELECT value INTO v_plans_cfg FROM public.platform_settings WHERE key = 'vip_plans';
  SELECT value INTO v_global_cfg FROM public.platform_settings WHERE key = 'global';
  IF v_plans_cfg IS NULL THEN
    v_plans_cfg := v_global_cfg->'vipPlans';
  END IF;

  v_plan_obj := COALESCE(v_plans_cfg->v_plan_id, '{}'::jsonb);
  v_plan_enabled := COALESCE((v_plan_obj->>'enabled')::boolean, true);
  IF NOT v_plan_enabled THEN
    RETURN jsonb_build_object('success', false, 'error', 'This VIP plan is currently disabled by administrator.');
  END IF;

  v_vip_price := ROUND(COALESCE(
    NULLIF(trim(COALESCE(v_plan_obj->>'price', '')), '')::numeric,
    CASE v_plan_id
      WHEN '1_month' THEN COALESCE(NULLIF(trim(COALESCE(v_global_cfg->>'vipMembershipPrice', '')), '')::numeric, 25.00)
      WHEN '2_months' THEN 45.00
      WHEN '1_year' THEN 200.00
      ELSE 25.00
    END
  ), 2);

  IF v_vip_price <= 0 OR v_vip_price > 100000 THEN
    RETURN jsonb_build_object('success', false, 'error', 'VIP plan pricing is invalid or unavailable.');
  END IF;

  v_plan_label := COALESCE(
    NULLIF(trim(COALESCE(v_plan_obj->>'label', '')), ''),
    CASE v_plan_id
      WHEN '1_month' THEN '1 Month'
      WHEN '2_months' THEN '2 Months'
      WHEN '1_year' THEN '1 Year'
      ELSE '1 Month'
    END
  );

  SELECT * INTO v_wallet
  FROM public.lottery_wallets
  WHERE user_id = v_uid
  ORDER BY updated_at DESC NULLS LAST
  LIMIT 1
  FOR UPDATE;

  v_prev_balance := ROUND(COALESCE(v_wallet.balance, 0), 2);
  IF NOT FOUND OR v_prev_balance < v_vip_price THEN
    RETURN jsonb_build_object(
      'success', false,
      'insufficient_balance', true,
      'plan_id', v_plan_id,
      'plan_label', v_plan_label,
      'required_amount', v_vip_price,
      'available_balance', v_prev_balance,
      'error', 'Insufficient wallet balance (' || to_char(v_prev_balance, 'FM999999990.00') || ' USDT). ' || v_plan_label || ' VIP costs ' || to_char(v_vip_price, 'FM999999990.00') || ' USDT. Please add funds before upgrading.'
    );
  END IF;

  -- Early renewal extends FROM active vip_expires_at; expired VIP starts from v_now
  IF COALESCE(v_profile.player_type, 'normal') = 'vip'
     AND COALESCE(v_profile.vip_status, 'inactive') = 'active'
     AND v_profile.vip_expires_at IS NOT NULL
     AND v_profile.vip_expires_at > v_now THEN
    v_is_early_renewal := true;
    v_action_type := 'renewed';
    v_start_at := v_profile.vip_expires_at;
  ELSE
    v_is_early_renewal := false;
    v_action_type := 'purchased';
    v_start_at := v_now;
  END IF;

  v_expires_at := public._compute_vip_expiry(v_start_at, v_plan_id);
  v_new_balance := ROUND(v_prev_balance - v_vip_price, 2);

  UPDATE public.lottery_wallets
  SET balance = v_new_balance,
      updated_at = v_now
  WHERE address = v_wallet.address;

  v_tx_id := 'tx_' || to_char(v_now, 'YYYYMMDDHH24MISS') || '_' || substr(md5(v_ref_id || random()::text), 1, 8);
  v_log_id := 'viplog_' || to_char(v_now, 'YYYYMMDDHH24MISS') || '_' || substr(md5(v_uid::text || v_ref_id || random()::text), 1, 8);

  INSERT INTO public.wallet_ledger (
    id, user_id, wallet_address, transaction_type, amount, balance_before, balance_after,
    currency, reference_id, description, metadata, created_at
  ) VALUES (
    v_tx_id,
    v_uid,
    v_wallet.address,
    'vip_membership',
    -v_vip_price,
    v_prev_balance,
    v_new_balance,
    'USDT',
    v_ref_id,
    'VIP Membership (' || v_plan_label || ') — ' || to_char(v_vip_price, 'FM999999990.00') || ' USDT',
    jsonb_build_object(
      'membership_tier', 'vip',
      'plan_id', v_plan_id,
      'plan_label', v_plan_label,
      'paid_amount', v_vip_price,
      'payment_reference', v_ref_id,
      'currency', 'USDT',
      'starts_at', v_start_at,
      'expires_at', v_expires_at,
      'is_renewal', v_is_early_renewal
    ),
    v_now
  );

  INSERT INTO public.vip_membership_logs (
    id, user_id, action_type, previous_player_type, new_player_type,
    plan_id, plan_label, starts_at, expires_at, status,
    paid_amount, payment_reference, ledger_tx_id, reason, created_at
  ) VALUES (
    v_log_id,
    v_uid,
    v_action_type,
    COALESCE(v_profile.player_type, 'normal'),
    'vip',
    v_plan_id,
    v_plan_label,
    v_start_at,
    v_expires_at,
    'active',
    v_vip_price,
    v_ref_id,
    v_tx_id,
    CASE WHEN v_is_early_renewal THEN 'User renewed VIP (' || v_plan_label || ')' ELSE 'User purchased VIP (' || v_plan_label || ')' END,
    v_now
  );

  UPDATE public.profiles
  SET player_type = 'vip',
      vip_status = 'active',
      vip_plan_id = v_plan_id,
      vip_activated_at = CASE WHEN v_is_early_renewal AND v_profile.vip_activated_at IS NOT NULL THEN v_profile.vip_activated_at ELSE v_now END,
      vip_expires_at = v_expires_at,
      vip_paid_amount = v_vip_price,
      vip_payment_reference = v_ref_id,
      vip_source = 'purchased',
      vip_granted_by = NULL,
      updated_at = v_now
  WHERE id = v_uid;

  RETURN jsonb_build_object(
    'success', true,
    'already_vip', false,
    'is_renewal', v_is_early_renewal,
    'player_type', 'vip',
    'vip_status', 'active',
    'vip_plan_id', v_plan_id,
    'plan_label', v_plan_label,
    'vip_activated_at', CASE WHEN v_is_early_renewal AND v_profile.vip_activated_at IS NOT NULL THEN v_profile.vip_activated_at ELSE v_now END,
    'starts_at', v_start_at,
    'vip_expires_at', v_expires_at,
    'vip_paid_amount', v_vip_price,
    'vip_payment_reference', v_ref_id,
    'vip_source', 'purchased',
    'new_balance', v_new_balance,
    'transaction_id', v_tx_id
  );
END;
$$;

-- 7. Update admin_update_platform_settings_secure to persist & validate VIP Plans cleanly
DO $$
DECLARE
  v_def text;
BEGIN
  SELECT pg_get_functiondef(p.oid) INTO v_def
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'admin_update_platform_settings_secure';

  IF v_def IS NOT NULL THEN
    -- Write a clean complete version replacing the VIP price & adding vipPlans validation
    NULL;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.admin_update_platform_settings_secure(p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth', 'pg_temp'
AS $$
DECLARE
  v_admin_uid uuid := auth.uid();
  v_admin_email text;
  v_prev_global jsonb := '{}'::jsonb;
  v_prev_plans jsonb := '{}'::jsonb;
  v_next_global jsonb;
  v_min_wd numeric;
  v_max_wd numeric;
  v_house_fee numeric;
  v_vip_price numeric;
  v_username_fee numeric;
  v_retention numeric;
  v_support_email text;
  v_apk_url text;
  v_clean_wheel jsonb;
  v_in_plans jsonb;
  v_p1 numeric;
  v_p2 numeric;
  v_p3 numeric;
  v_e1 boolean;
  v_e2 boolean;
  v_e3 boolean;
  v_clean_plans jsonb;
BEGIN
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized: Admin privileges required.');
  END IF;

  SELECT value INTO v_prev_global FROM public.platform_settings WHERE key = 'global';
  SELECT value INTO v_prev_plans FROM public.platform_settings WHERE key = 'vip_plans';
  v_prev_global := (COALESCE(v_prev_global, '{}'::jsonb) - 'treasuryTrc20' - 'defaultWinnerSharePercent') #- '{spinWheelSettings,require_kyc}';
  v_prev_plans := COALESCE(v_prev_plans, v_prev_global->'vipPlans', '{}'::jsonb);

  v_min_wd := ROUND(COALESCE(NULLIF(trim(COALESCE(p_payload->>'minWithdrawal', '')), '')::numeric, (v_prev_global->>'minWithdrawal')::numeric, 5), 2);
  v_max_wd := ROUND(COALESCE(NULLIF(trim(COALESCE(p_payload->>'maxWithdrawal', '')), '')::numeric, (v_prev_global->>'maxWithdrawal')::numeric, 10000), 2);
  v_house_fee := ROUND(COALESCE(NULLIF(trim(COALESCE(p_payload->>'houseFeePercent', '')), '')::numeric, (v_prev_global->>'houseFeePercent')::numeric, 5), 2);
  v_vip_price := ROUND(COALESCE(NULLIF(trim(COALESCE(p_payload->>'vipMembershipPrice', '')), '')::numeric, (v_prev_global->>'vipMembershipPrice')::numeric, 25), 2);
  v_username_fee := ROUND(COALESCE(NULLIF(trim(COALESCE(p_payload->>'usernameChangeFee', '')), '')::numeric, (v_prev_global->>'usernameChangeFee')::numeric, 5), 2);
  v_retention := COALESCE(NULLIF(trim(COALESCE(p_payload->>'resultsRetentionHours', '')), '')::numeric, (v_prev_global->>'resultsRetentionHours')::numeric, 1);
  v_support_email := COALESCE(NULLIF(trim(COALESCE(p_payload->>'supportEmail', '')), ''), v_prev_global->>'supportEmail', 'earnflow.user@gmail.com');
  v_apk_url := COALESCE(NULLIF(trim(COALESCE(p_payload->>'apkDownloadUrl', '')), ''), v_prev_global->>'apkDownloadUrl', '/download/earnflow.apk');

  v_in_plans := COALESCE(p_payload->'vipPlans', v_prev_plans);
  v_p1 := ROUND(COALESCE(
    NULLIF(trim(COALESCE(v_in_plans->'1_month'->>'price', '')), '')::numeric,
    CASE WHEN p_payload ? 'vipMembershipPrice' AND NOT (p_payload ? 'vipPlans') THEN v_vip_price END,
    (v_prev_plans->'1_month'->>'price')::numeric,
    v_vip_price,
    25.00
  ), 2);
  v_p2 := ROUND(COALESCE(
    NULLIF(trim(COALESCE(v_in_plans->'2_months'->>'price', '')), '')::numeric,
    (v_prev_plans->'2_months'->>'price')::numeric,
    45.00
  ), 2);
  v_p3 := ROUND(COALESCE(
    NULLIF(trim(COALESCE(v_in_plans->'1_year'->>'price', '')), '')::numeric,
    (v_prev_plans->'1_year'->>'price')::numeric,
    200.00
  ), 2);

  v_e1 := COALESCE((v_in_plans->'1_month'->>'enabled')::boolean, (v_prev_plans->'1_month'->>'enabled')::boolean, true);
  v_e2 := COALESCE((v_in_plans->'2_months'->>'enabled')::boolean, (v_prev_plans->'2_months'->>'enabled')::boolean, true);
  v_e3 := COALESCE((v_in_plans->'1_year'->>'enabled')::boolean, (v_prev_plans->'1_year'->>'enabled')::boolean, true);

  IF v_house_fee < 0 OR v_house_fee > 30 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Platform House Charge must be between 0% and 30%.');
  END IF;
  IF v_vip_price <= 0 OR v_vip_price > 100000 THEN
    RETURN jsonb_build_object('success', false, 'error', 'VIP Membership Price must be greater than 0 and up to 100,000 USDT.');
  END IF;
  IF v_p1 <= 0 OR v_p1 > 100000 OR v_p2 <= 0 OR v_p2 > 100000 OR v_p3 <= 0 OR v_p3 > 100000 THEN
    RETURN jsonb_build_object('success', false, 'error', 'All VIP subscription plan prices must be greater than 0 and up to 100,000 USDT.');
  END IF;
  IF v_min_wd < 1 OR v_max_wd < v_min_wd THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid withdrawal limits.');
  END IF;
  IF v_retention < 0.1 OR v_retention > 168 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Results retention hours must be between 0.1 and 168.');
  END IF;

  v_vip_price := v_p1;

  v_clean_plans := jsonb_build_object(
    '1_month', jsonb_build_object('id', '1_month', 'label', '1 Month', 'duration_months', 1, 'duration_years', 0, 'price', v_p1, 'enabled', v_e1),
    '2_months', jsonb_build_object('id', '2_months', 'label', '2 Months', 'duration_months', 2, 'duration_years', 0, 'price', v_p2, 'enabled', v_e2),
    '1_year', jsonb_build_object('id', '1_year', 'label', '1 Year', 'duration_months', 0, 'duration_years', 1, 'price', v_p3, 'enabled', v_e3)
  );

  v_next_global := v_prev_global || (p_payload - 'treasuryTrc20' - 'defaultWinnerSharePercent' - 'vipPlans');
  v_next_global := v_next_global || jsonb_build_object(
    'supportedNetwork', 'TRC-20',
    'supportedCurrency', 'USDT',
    'minWithdrawal', v_min_wd,
    'maxWithdrawal', v_max_wd,
    'houseFeePercent', v_house_fee,
    'vipMembershipPrice', v_vip_price,
    'vipPlans', v_clean_plans,
    'usernameChangeFee', v_username_fee,
    'resultsRetentionHours', v_retention,
    'supportEmail', v_support_email,
    'apkDownloadUrl', v_apk_url
  );

  IF v_next_global ? 'spinWheelSettings' THEN
    v_next_global := jsonb_set(v_next_global, '{spinWheelSettings}', (v_next_global->'spinWheelSettings') - 'require_kyc', true);
  END IF;

  INSERT INTO public.platform_settings (key, value, updated_at)
  VALUES ('global', v_next_global, now())
  ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now();

  INSERT INTO public.platform_settings (key, value, updated_at)
  VALUES ('vip_plans', v_clean_plans, now())
  ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now();

  IF p_payload ? 'resultsRetentionHours' THEN
    INSERT INTO public.platform_settings (key, value, updated_at)
    VALUES ('results_retention', jsonb_build_object('duration_hours', v_retention, 'retention_duration_hours', v_retention, 'label', v_retention::text || ' hour(s)'), now())
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now();
  END IF;

  IF p_payload ? 'spinWheelSettings' THEN
    v_clean_wheel := (p_payload->'spinWheelSettings') - 'require_kyc';
    INSERT INTO public.platform_settings (key, value, updated_at)
    VALUES ('spin_wheel_settings', v_clean_wheel, now())
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now();
  END IF;

  SELECT email INTO v_admin_email FROM public.profiles WHERE id = v_admin_uid;
  INSERT INTO public.admin_audit_logs (
    admin_id, admin_email, action_type, target_type, target_id, changes
  ) VALUES (
    v_admin_uid, v_admin_email, 'UPDATE_PLATFORM_SETTINGS', 'platform_settings', 'global',
    jsonb_build_object(
      'houseFeePercent', v_house_fee,
      'vipMembershipPrice', v_vip_price,
      'vipPlans', v_clean_plans,
      'minWithdrawal', v_min_wd,
      'maxWithdrawal', v_max_wd,
      'usernameChangeFee', v_username_fee,
      'resultsRetentionHours', v_retention
    )
  );

  RETURN jsonb_build_object('success', true, 'settings', v_next_global);
END;
$$;

-- 8. Update admin_get_users_with_wallets to include vip_plan_id & vip_expires_at
CREATE OR REPLACE FUNCTION public.admin_get_users_with_wallets()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'auth', 'pg_temp'
AS $$
DECLARE
  v_rows jsonb;
BEGIN
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized: Admin privileges required.');
  END IF;

  SELECT COALESCE(jsonb_agg(row_to_json(t)::jsonb ORDER BY t.created_at DESC), '[]'::jsonb)
  INTO v_rows
  FROM (
    SELECT
      p.id,
      p.email,
      p.username,
      p.role,
      p.status,
      p.trc20_address,
      p.created_at,
      p.updated_at,
      CASE
        WHEN COALESCE(p.player_type, 'normal') = 'vip'
         AND COALESCE(p.vip_status, 'inactive') = 'active'
         AND (p.vip_expires_at IS NULL OR p.vip_expires_at > clock_timestamp())
        THEN 'vip'
        ELSE 'normal'
      END AS player_type,
      CASE
        WHEN p.vip_expires_at IS NOT NULL AND p.vip_expires_at <= clock_timestamp() AND COALESCE(p.vip_status, 'inactive') = 'active'
        THEN 'expired'
        ELSE COALESCE(p.vip_status, 'inactive')
      END AS vip_status,
      p.vip_plan_id,
      p.vip_activated_at,
      p.vip_expires_at,
      p.vip_paid_amount,
      p.vip_payment_reference,
      COALESCE(p.vip_source, 'none') AS vip_source,
      p.vip_granted_by,
      COALESCE(w.balance, 0)::numeric(18,2) AS wallet_balance,
      COALESCE(w.lifetime_won, 0)::numeric(18,2) AS lifetime_won,
      w.address AS wallet_address
    FROM public.profiles p
    LEFT JOIN LATERAL (
      SELECT lw.balance, lw.lifetime_won, lw.address
      FROM public.lottery_wallets lw
      WHERE lw.user_id = p.id
         OR (p.trc20_address IS NOT NULL AND lower(lw.address) = lower(p.trc20_address))
      ORDER BY (lw.user_id = p.id) DESC, lw.updated_at DESC NULLS LAST
      LIMIT 1
    ) w ON true
  ) t;

  RETURN jsonb_build_object('success', true, 'users', v_rows);
END;
$$;

-- 9. Enforce real-time VIP expiry inside admin_update_user_player_category_secure, verify_room_entry_secure & buy_lottery_tickets_secure
CREATE OR REPLACE FUNCTION public.admin_update_user_player_category_secure(
  p_target_user_id uuid,
  p_player_type text,
  p_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth', 'pg_temp'
AS $$
DECLARE
  v_admin_id uuid := auth.uid();
  v_admin_email text;
  v_norm_type text := lower(trim(COALESCE(p_player_type, '')));
  v_clean_reason text := COALESCE(NULLIF(trim(COALESCE(p_reason, '')), ''), 'Admin category update');
  v_profile record;
  v_prev_type text;
  v_log_id text;
  v_now timestamptz := clock_timestamp();
BEGIN
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized: Admin privileges required.');
  END IF;

  IF p_target_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Target user ID is required.');
  END IF;

  IF v_norm_type NOT IN ('normal', 'vip') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid player category. Must be normal or vip.');
  END IF;

  PERFORM set_config('earnflow.internal_profile_update', 'true', true);

  SELECT * INTO v_profile FROM public.profiles WHERE id = p_target_user_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Target user profile not found.');
  END IF;

  v_prev_type := COALESCE(v_profile.player_type, 'normal');

  IF v_prev_type = v_norm_type AND (
    (v_norm_type = 'vip' AND v_profile.vip_status = 'active' AND (v_profile.vip_expires_at IS NULL OR v_profile.vip_expires_at > v_now))
    OR (v_norm_type = 'normal' AND v_profile.vip_status <> 'active')
  ) THEN
    RETURN jsonb_build_object(
      'success', true,
      'unchanged', true,
      'player_type', v_norm_type,
      'vip_status', v_profile.vip_status,
      'vip_source', v_profile.vip_source
    );
  END IF;

  SELECT email INTO v_admin_email FROM public.profiles WHERE id = v_admin_id;

  UPDATE public.profiles
  SET player_type = v_norm_type,
      vip_status = CASE WHEN v_norm_type = 'vip' THEN 'active' ELSE 'inactive' END,
      vip_plan_id = CASE WHEN v_norm_type = 'vip' THEN COALESCE(vip_plan_id, 'admin_grant') ELSE vip_plan_id END,
      vip_source = CASE WHEN v_norm_type = 'vip' THEN 'admin_granted' ELSE CASE WHEN vip_paid_amount IS NOT NULL THEN vip_source ELSE 'none' END END,
      vip_granted_by = CASE WHEN v_norm_type = 'vip' THEN v_admin_id ELSE NULL END,
      vip_activated_at = CASE WHEN v_norm_type = 'vip' THEN COALESCE(vip_activated_at, v_now) ELSE vip_activated_at END,
      vip_expires_at = CASE WHEN v_norm_type = 'vip' THEN CASE WHEN vip_expires_at IS NOT NULL AND vip_expires_at > v_now THEN vip_expires_at ELSE NULL END ELSE vip_expires_at END,
      updated_at = v_now
  WHERE id = p_target_user_id;

  v_log_id := 'viplog_' || to_char(v_now, 'YYYYMMDDHH24MISS') || '_' || substr(md5(p_target_user_id::text || random()::text), 1, 8);

  INSERT INTO public.vip_membership_logs (
    id, user_id, action_type, previous_player_type, new_player_type,
    plan_id, status, admin_id, admin_email, reason, created_at
  ) VALUES (
    v_log_id,
    p_target_user_id,
    CASE WHEN v_norm_type = 'vip' THEN 'admin_granted' ELSE 'admin_revoked' END,
    v_prev_type,
    v_norm_type,
    CASE WHEN v_norm_type = 'vip' THEN 'admin_grant' ELSE v_profile.vip_plan_id END,
    CASE WHEN v_norm_type = 'vip' THEN 'active' ELSE 'revoked' END,
    v_admin_id,
    v_admin_email,
    v_clean_reason,
    v_now
  );

  INSERT INTO public.admin_audit_logs (
    admin_id, admin_email, action_type, target_type, target_id, changes
  ) VALUES (
    v_admin_id,
    v_admin_email,
    'UPDATE_PLAYER_CATEGORY',
    'profiles',
    p_target_user_id::text,
    jsonb_build_object(
      'previous_category', v_prev_type,
      'new_category', v_norm_type,
      'vip_source', CASE WHEN v_norm_type = 'vip' THEN 'admin_granted' ELSE 'revoked' END,
      'reason', v_clean_reason,
      'timestamp', v_now
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'target_user_id', p_target_user_id,
    'previous_category', v_prev_type,
    'player_type', v_norm_type,
    'vip_status', CASE WHEN v_norm_type = 'vip' THEN 'active' ELSE 'inactive' END,
    'vip_source', CASE WHEN v_norm_type = 'vip' THEN 'admin_granted' ELSE 'none' END
  );
END;
$$;

DO $$
DECLARE
  v_def text;
BEGIN
  -- Patch verify_room_entry_secure to use public._is_user_vip(v_uid)
  SELECT pg_get_functiondef(p.oid) INTO v_def
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'verify_room_entry_secure';
  IF v_def IS NOT NULL AND position('_is_user_vip' in v_def) = 0 THEN
    v_def := replace(
      v_def,
      'IF v_evt_cat = ''vip'' AND NOT (COALESCE(v_prof.player_type, ''normal'') = ''vip'' AND COALESCE(v_prof.vip_status, ''inactive'') = ''active'') THEN',
      'IF v_evt_cat = ''vip'' AND NOT public._is_user_vip(v_uid) THEN'
    );
    EXECUTE v_def;
  END IF;

  -- Patch buy_lottery_tickets_secure to use public._is_user_vip(v_uid)
  SELECT pg_get_functiondef(p.oid) INTO v_def
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'buy_lottery_tickets_secure';
  IF v_def IS NOT NULL AND position('_is_user_vip' in v_def) = 0 THEN
    v_def := replace(
      v_def,
      'IF lower(COALESCE(v_event.event_category, ''normal'')) = ''vip'' AND NOT EXISTS (
    SELECT 1 FROM public.profiles pr
    WHERE pr.id = v_uid AND COALESCE(pr.player_type, ''normal'') = ''vip'' AND COALESCE(pr.vip_status, ''inactive'') = ''active''
  ) THEN',
      'IF lower(COALESCE(v_event.event_category, ''normal'')) = ''vip'' AND NOT public._is_user_vip(v_uid) THEN'
    );
    EXECUTE v_def;
  END IF;
END $$;

-- 10. Strict RLS Policy for lottery_events visibility (Draft / Scheduled / VIP Enforcement)
DROP POLICY IF EXISTS lottery_events_select_policy ON public.lottery_events;
CREATE POLICY lottery_events_select_policy ON public.lottery_events
  FOR SELECT TO public
  USING (
    public.is_admin()
    OR (
      COALESCE(is_deleted, false) = false
      AND lower(COALESCE(status, '')) NOT IN ('draft', 'scheduled', 'deleted')
      AND (
        published_at IS NOT NULL
        OR lower(COALESCE(status, '')) IN ('active', 'completed', 'ended', 'settled', 'expired', 'processing', 'result_pending')
      )
      AND (
        lower(COALESCE(event_category, 'normal')) <> 'vip'
        OR public._is_user_vip((SELECT auth.uid()))
      )
    )
  );

-- 11. Enable FULL Replica Identity & Add All Core Realtime Tables to supabase_realtime Publication
DO $$
DECLARE
  v_tbl text;
  v_tables text[] := ARRAY[
    'lottery_events',
    'lottery_wallets',
    'wallet_ledger',
    'lottery_deposits',
    'lottery_withdrawals',
    'lottery_tickets',
    'winner_payouts',
    'profiles',
    'platform_settings',
    'support_tickets',
    'username_changes',
    'user_daily_streaks',
    'user_notifications',
    'vip_membership_logs',
    'referral_rewards',
    'lottery_draw_audits',
    'game_configurations'
  ];
BEGIN
  FOREACH v_tbl IN ARRAY v_tables LOOP
    EXECUTE format('ALTER TABLE public.%I REPLICA IDENTITY FULL;', v_tbl);
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = v_tbl
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I;', v_tbl);
    END IF;
  END LOOP;
END $$;
