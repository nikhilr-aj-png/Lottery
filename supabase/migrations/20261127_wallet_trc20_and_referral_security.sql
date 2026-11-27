-- ============================================================================
-- Migration: 20261127_wallet_trc20_and_referral_security.sql
-- Purpose:
--   1. Enforce USDT TRC-20 ONLY for new deposits & withdrawals on the backend
--      while preserving 100% of existing legitimate wallet balances & history.
--   2. Synchronize authoritative Admin referral & withdrawal settings in
--      platform_settings ('referral_settings', 'global', 'withdrawal_settings').
--   3. Harden referral registration (0 reward support, self/circular block,
--      immutability, risk scoring & backend rate limiting).
--   4. Implement atomic First Deposit Bonus & Lifetime Referral Commission
--      calculation + duplicate/idempotency constraints.
--   5. Harden RLS policies & RPC execution privileges.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- A. Additive Security & Anti-Abuse Schema Extensions
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.referral_security_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  related_user_id uuid,
  event_type text NOT NULL,
  severity text NOT NULL DEFAULT 'info',
  risk_score integer NOT NULL DEFAULT 0,
  device_fingerprint text,
  ip_hash text,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.security_rate_limits (
  bucket_key text PRIMARY KEY,
  window_started_at timestamptz NOT NULL DEFAULT now(),
  hit_count integer NOT NULL DEFAULT 1,
  blocked_until timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_referrals
  ADD COLUMN IF NOT EXISTS device_fingerprint text,
  ADD COLUMN IF NOT EXISTS ip_hash text,
  ADD COLUMN IF NOT EXISTS risk_score integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS risk_flags jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS is_flagged boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS first_deposit_bonus_amount numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS first_deposit_id text,
  ADD COLUMN IF NOT EXISTS attribution_locked_at timestamptz DEFAULT now();

ALTER TABLE public.referral_rewards
  ADD COLUMN IF NOT EXISTS source_tx_id text;

-- Database-level idempotency constraints (additive, safe for existing records)
CREATE UNIQUE INDEX IF NOT EXISTS uq_referral_rewards_one_time
  ON public.referral_rewards (referred_user_id, reward_type)
  WHERE reward_type IN ('registration', 'first_deposit');

CREATE UNIQUE INDEX IF NOT EXISTS uq_referral_rewards_source_commission
  ON public.referral_rewards (source_tx_id, reward_type)
  WHERE source_tx_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_lottery_deposits_payment_id
  ON public.lottery_deposits (payment_id)
  WHERE payment_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_wallet_ledger_ref_type
  ON public.wallet_ledger (reference_id, transaction_type)
  WHERE reference_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_referral_security_events_user
  ON public.referral_security_events (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_user_referrals_device_fp
  ON public.user_referrals (device_fingerprint, created_at DESC)
  WHERE device_fingerprint IS NOT NULL;

-- ----------------------------------------------------------------------------
-- B. Synchronize Authoritative Platform Settings (Preserve active Admin values)
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  v_global jsonb;
  v_ref jsonb;
  v_reg_enabled boolean;
  v_reg_amount numeric;
  v_fd_enabled boolean;
  v_fd_percent numeric;
  v_min_deposit numeric;
  v_max_bonus numeric;
  v_lc_enabled boolean;
  v_lc_percent numeric;
  v_min_wd numeric;
  v_max_wd numeric;
  v_canonical jsonb;
BEGIN
  SELECT value INTO v_global FROM public.platform_settings WHERE key = 'global';
  SELECT value INTO v_ref FROM public.platform_settings WHERE key = 'referral_settings';

  v_global := COALESCE(v_global, '{}'::jsonb);
  v_ref := COALESCE(v_ref, '{}'::jsonb);

  -- Prefer explicit Admin flat settings in global.referralSettings if present, else existing nested values
  v_reg_enabled := COALESCE(
    (v_ref->>'registration_reward_enabled')::boolean,
    (v_global->'referralSettings'->>'registration_reward_enabled')::boolean,
    (v_ref->'registration_reward'->>'enabled')::boolean,
    true
  );

  v_reg_amount := GREATEST(0, COALESCE(
    CASE WHEN (v_ref ? 'registration_reward_amount') THEN (v_ref->>'registration_reward_amount')::numeric END,
    CASE WHEN ((v_global->'referralSettings') ? 'registration_reward_amount') THEN (v_global->'referralSettings'->>'registration_reward_amount')::numeric END,
    CASE WHEN ((v_ref->'registration_reward') ? 'amount') THEN (v_ref->'registration_reward'->>'amount')::numeric END,
    0.25
  ));

  v_fd_enabled := COALESCE(
    (v_ref->>'first_deposit_reward_enabled')::boolean,
    (v_global->'referralSettings'->>'first_deposit_reward_enabled')::boolean,
    (v_ref->'first_deposit_reward'->>'enabled')::boolean,
    true
  );

  -- Keep 5% active First Deposit Bonus from referral_settings if no explicit custom value differs,
  -- respecting nested amount=5 over stale fallback default 10 unless admin updates it later.
  v_fd_percent := GREATEST(0, COALESCE(
    CASE WHEN (v_ref ? 'first_deposit_reward_percent') THEN (v_ref->>'first_deposit_reward_percent')::numeric END,
    CASE WHEN ((v_ref->'first_deposit_reward') ? 'amount') THEN (v_ref->'first_deposit_reward'->>'amount')::numeric END,
    CASE WHEN ((v_global->'referralSettings') ? 'first_deposit_reward_percent') THEN (v_global->'referralSettings'->>'first_deposit_reward_percent')::numeric END,
    5
  ));

  v_min_deposit := GREATEST(0, COALESCE(
    CASE WHEN (v_ref ? 'minimum_qualifying_deposit') THEN (v_ref->>'minimum_qualifying_deposit')::numeric END,
    CASE WHEN ((v_ref->'first_deposit_reward') ? 'min_deposit') THEN (v_ref->'first_deposit_reward'->>'min_deposit')::numeric END,
    10
  ));

  v_max_bonus := GREATEST(0, COALESCE(
    CASE WHEN (v_ref ? 'maximum_first_deposit_bonus') THEN (v_ref->>'maximum_first_deposit_bonus')::numeric END,
    CASE WHEN ((v_ref->'first_deposit_reward') ? 'max_reward') THEN (v_ref->'first_deposit_reward'->>'max_reward')::numeric END,
    50
  ));

  v_lc_enabled := COALESCE(
    (v_ref->>'lifetime_commission_enabled')::boolean,
    (v_global->'referralSettings'->>'lifetime_commission_enabled')::boolean,
    (v_ref->'lifetime_commission'->>'enabled')::boolean,
    true
  );

  -- Preserve the Admin Panel's active 2% Lifetime Commission and mirror it everywhere
  v_lc_percent := GREATEST(0, COALESCE(
    CASE WHEN (v_ref ? 'lifetime_commission_percent') THEN (v_ref->>'lifetime_commission_percent')::numeric END,
    CASE WHEN ((v_global->'referralSettings') ? 'lifetime_commission_percent') THEN (v_global->'referralSettings'->>'lifetime_commission_percent')::numeric END,
    CASE WHEN ((v_ref->'lifetime_commission') ? 'percent') THEN (v_ref->'lifetime_commission'->>'percent')::numeric END,
    2
  ));

  v_canonical := jsonb_build_object(
    'enabled', COALESCE((v_ref->>'enabled')::boolean, (v_global->'referralSettings'->>'enabled')::boolean, true),
    'reward_currency', 'USDT',
    'supported_network', 'TRC-20',
    'config_version', COALESCE((v_ref->>'config_version')::integer, 1),
    'updated_at', to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
    'registration_reward_enabled', v_reg_enabled,
    'registration_reward_amount', ROUND(v_reg_amount, 2),
    'first_deposit_reward_enabled', v_fd_enabled,
    'first_deposit_reward_percent', ROUND(v_fd_percent, 2),
    'minimum_qualifying_deposit', ROUND(v_min_deposit, 2),
    'maximum_first_deposit_bonus', ROUND(v_max_bonus, 2),
    'lifetime_commission_enabled', v_lc_enabled,
    'lifetime_commission_percent', ROUND(v_lc_percent, 2),
    'lifetime_commission_activity', COALESCE(v_ref->>'lifetime_commission_activity', v_ref->'lifetime_commission'->>'activity', 'ticket_purchase'),
    'registration_reward', jsonb_build_object(
      'enabled', v_reg_enabled,
      'amount', ROUND(v_reg_amount, 2)
    ),
    'first_deposit_reward', jsonb_build_object(
      'enabled', v_fd_enabled,
      'amount', ROUND(v_fd_percent, 2),
      'mode', 'percentage',
      'min_deposit', ROUND(v_min_deposit, 2),
      'max_reward', ROUND(v_max_bonus, 2)
    ),
    'lifetime_commission', jsonb_build_object(
      'enabled', v_lc_enabled,
      'percent', ROUND(v_lc_percent, 2),
      'activity', COALESCE(v_ref->>'lifetime_commission_activity', v_ref->'lifetime_commission'->>'activity', 'ticket_purchase')
    )
  );

  INSERT INTO public.platform_settings (key, value, updated_at)
  VALUES ('referral_settings', v_canonical, now())
  ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now();

  v_min_wd := GREATEST(2, COALESCE((v_global->>'minWithdrawal')::numeric, 5));
  v_max_wd := GREATEST(v_min_wd, COALESCE((v_global->>'maxWithdrawal')::numeric, 10000));

  v_global := jsonb_set(v_global, '{referralSettings}', v_canonical, true);
  v_global := jsonb_set(v_global, '{supportedNetwork}', '"TRC-20"'::jsonb, true);
  v_global := jsonb_set(v_global, '{supportedCurrency}', '"USDT"'::jsonb, true);
  v_global := jsonb_set(v_global, '{minWithdrawal}', to_jsonb(v_min_wd), true);
  v_global := jsonb_set(v_global, '{maxWithdrawal}', to_jsonb(v_max_wd), true);

  INSERT INTO public.platform_settings (key, value, updated_at)
  VALUES ('global', v_global, now())
  ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now();

  INSERT INTO public.platform_settings (key, value, updated_at)
  VALUES (
    'withdrawal_settings',
    jsonb_build_object(
      'supportedNetwork', 'TRC-20',
      'supportedCurrency', 'USDT',
      'minWithdrawal', v_min_wd,
      'maxWithdrawal', v_max_wd,
      'networkFee', 1.00
    ),
    now()
  )
  ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now();
END $$;

-- ----------------------------------------------------------------------------
-- C. Internal Rate-Limit & Authoritative Config Helpers
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._check_rate_limit(
  p_bucket_key text,
  p_max_hits integer,
  p_window_seconds integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_now timestamptz := now();
  v_rec record;
BEGIN
  IF p_bucket_key IS NULL OR trim(p_bucket_key) = '' THEN
    RETURN jsonb_build_object('allowed', true);
  END IF;

  INSERT INTO public.security_rate_limits (bucket_key, window_started_at, hit_count, updated_at)
  VALUES (p_bucket_key, v_now, 1, v_now)
  ON CONFLICT (bucket_key) DO UPDATE
  SET
    window_started_at = CASE
      WHEN security_rate_limits.window_started_at + make_interval(secs => p_window_seconds) <= v_now THEN v_now
      ELSE security_rate_limits.window_started_at
    END,
    hit_count = CASE
      WHEN security_rate_limits.window_started_at + make_interval(secs => p_window_seconds) <= v_now THEN 1
      ELSE security_rate_limits.hit_count + 1
    END,
    blocked_until = CASE
      WHEN (CASE
        WHEN security_rate_limits.window_started_at + make_interval(secs => p_window_seconds) <= v_now THEN 1
        ELSE security_rate_limits.hit_count + 1
      END) > p_max_hits THEN v_now + interval '60 seconds'
      ELSE NULL
    END,
    updated_at = v_now
  RETURNING * INTO v_rec;

  IF v_rec.hit_count > p_max_hits THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'hit_count', v_rec.hit_count,
      'retry_after_seconds', GREATEST(1, EXTRACT(EPOCH FROM (v_rec.window_started_at + make_interval(secs => p_window_seconds) - v_now))::integer)
    );
  END IF;

  RETURN jsonb_build_object('allowed', true, 'hit_count', v_rec.hit_count);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_authoritative_referral_settings()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_ref jsonb;
  v_global jsonb;
  v_src jsonb;
  v_enabled boolean;
  v_reg_enabled boolean;
  v_reg_amount numeric;
  v_fd_enabled boolean;
  v_fd_percent numeric;
  v_min_dep numeric;
  v_max_bonus numeric;
  v_lc_enabled boolean;
  v_lc_percent numeric;
  v_ver integer;
BEGIN
  SELECT value INTO v_ref FROM public.platform_settings WHERE key = 'referral_settings';
  IF v_ref IS NULL THEN
    SELECT value->'referralSettings' INTO v_global FROM public.platform_settings WHERE key = 'global';
    v_src := v_global;
  ELSE
    v_src := v_ref;
  END IF;

  -- Fail closed (disabled) if configuration row is completely missing rather than silently hardcoding non-zero rewards
  IF v_src IS NULL THEN
    RETURN jsonb_build_object(
      'configured', false,
      'enabled', false,
      'registration_reward_enabled', false,
      'registration_reward_amount', 0,
      'first_deposit_reward_enabled', false,
      'first_deposit_reward_percent', 0,
      'minimum_qualifying_deposit', 0,
      'maximum_first_deposit_bonus', 0,
      'lifetime_commission_enabled', false,
      'lifetime_commission_percent', 0,
      'reward_currency', 'USDT',
      'supported_network', 'TRC-20',
      'config_version', 0
    );
  END IF;

  v_enabled := COALESCE((v_src->>'enabled')::boolean, true);
  v_reg_enabled := COALESCE(
    (v_src->>'registration_reward_enabled')::boolean,
    (v_src->'registration_reward'->>'enabled')::boolean,
    true
  );
  v_reg_amount := COALESCE(
    CASE WHEN (v_src ? 'registration_reward_amount') THEN (v_src->>'registration_reward_amount')::numeric END,
    CASE WHEN ((v_src->'registration_reward') ? 'amount') THEN (v_src->'registration_reward'->>'amount')::numeric END,
    0
  );

  v_fd_enabled := COALESCE(
    (v_src->>'first_deposit_reward_enabled')::boolean,
    (v_src->'first_deposit_reward'->>'enabled')::boolean,
    true
  );
  v_fd_percent := COALESCE(
    CASE WHEN (v_src ? 'first_deposit_reward_percent') THEN (v_src->>'first_deposit_reward_percent')::numeric END,
    CASE WHEN ((v_src->'first_deposit_reward') ? 'amount') THEN (v_src->'first_deposit_reward'->>'amount')::numeric END,
    0
  );
  v_min_dep := COALESCE(
    CASE WHEN (v_src ? 'minimum_qualifying_deposit') THEN (v_src->>'minimum_qualifying_deposit')::numeric END,
    CASE WHEN ((v_src->'first_deposit_reward') ? 'min_deposit') THEN (v_src->'first_deposit_reward'->>'min_deposit')::numeric END,
    0
  );
  v_max_bonus := COALESCE(
    CASE WHEN (v_src ? 'maximum_first_deposit_bonus') THEN (v_src->>'maximum_first_deposit_bonus')::numeric END,
    CASE WHEN ((v_src->'first_deposit_reward') ? 'max_reward') THEN (v_src->'first_deposit_reward'->>'max_reward')::numeric END,
    0
  );

  v_lc_enabled := COALESCE(
    (v_src->>'lifetime_commission_enabled')::boolean,
    (v_src->'lifetime_commission'->>'enabled')::boolean,
    true
  );
  v_lc_percent := COALESCE(
    CASE WHEN (v_src ? 'lifetime_commission_percent') THEN (v_src->>'lifetime_commission_percent')::numeric END,
    CASE WHEN ((v_src->'lifetime_commission') ? 'percent') THEN (v_src->'lifetime_commission'->>'percent')::numeric END,
    0
  );

  v_ver := COALESCE((v_src->>'config_version')::integer, 1);

  RETURN jsonb_build_object(
    'configured', true,
    'enabled', v_enabled,
    'reward_currency', 'USDT',
    'supported_network', 'TRC-20',
    'config_version', v_ver,
    'registration_reward_enabled', v_reg_enabled,
    'registration_reward_amount', GREATEST(0, ROUND(v_reg_amount, 2)),
    'first_deposit_reward_enabled', v_fd_enabled,
    'first_deposit_reward_percent', GREATEST(0, ROUND(v_fd_percent, 2)),
    'minimum_qualifying_deposit', GREATEST(0, ROUND(v_min_dep, 2)),
    'maximum_first_deposit_bonus', GREATEST(0, ROUND(v_max_bonus, 2)),
    'lifetime_commission_enabled', v_lc_enabled,
    'lifetime_commission_percent', GREATEST(0, ROUND(v_lc_percent, 2)),
    'lifetime_commission_activity', COALESCE(v_src->>'lifetime_commission_activity', v_src->'lifetime_commission'->>'activity', 'ticket_purchase')
  );
END;
$$;

-- ----------------------------------------------------------------------------
-- D. Admin Authoritative Referral Configuration Update RPC (with Audit Log)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_update_referral_settings_secure(
  p_payload jsonb,
  p_ip_address text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth', 'pg_temp'
AS $$
DECLARE
  v_admin_id uuid := auth.uid();
  v_admin_email text;
  v_prev_ref jsonb;
  v_global jsonb;
  v_enabled boolean;
  v_reg_enabled boolean;
  v_reg_amount numeric;
  v_fd_enabled boolean;
  v_fd_percent numeric;
  v_min_dep numeric;
  v_max_bonus numeric;
  v_lc_enabled boolean;
  v_lc_percent numeric;
  v_next_ver integer;
  v_canonical jsonb;
BEGIN
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized: Admin privileges required.');
  END IF;

  IF p_payload IS NULL OR jsonb_typeof(p_payload) <> 'object' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid referral settings payload.');
  END IF;

  SELECT value INTO v_prev_ref FROM public.platform_settings WHERE key = 'referral_settings';
  SELECT value INTO v_global FROM public.platform_settings WHERE key = 'global';
  v_prev_ref := COALESCE(v_prev_ref, '{}'::jsonb);
  v_global := COALESCE(v_global, '{}'::jsonb);

  SELECT email INTO v_admin_email FROM public.profiles WHERE id = v_admin_id;

  v_enabled := COALESCE((p_payload->>'enabled')::boolean, (v_prev_ref->>'enabled')::boolean, true);
  v_reg_enabled := COALESCE((p_payload->>'registration_reward_enabled')::boolean, (v_prev_ref->>'registration_reward_enabled')::boolean, true);
  v_fd_enabled := COALESCE((p_payload->>'first_deposit_reward_enabled')::boolean, (v_prev_ref->>'first_deposit_reward_enabled')::boolean, true);
  v_lc_enabled := COALESCE((p_payload->>'lifetime_commission_enabled')::boolean, (v_prev_ref->>'lifetime_commission_enabled')::boolean, true);

  BEGIN
    v_reg_amount := COALESCE(
      CASE WHEN (p_payload ? 'registration_reward_amount') THEN (p_payload->>'registration_reward_amount')::numeric END,
      (v_prev_ref->>'registration_reward_amount')::numeric,
      0
    );
    v_fd_percent := COALESCE(
      CASE WHEN (p_payload ? 'first_deposit_reward_percent') THEN (p_payload->>'first_deposit_reward_percent')::numeric END,
      (v_prev_ref->>'first_deposit_reward_percent')::numeric,
      0
    );
    v_min_dep := COALESCE(
      CASE WHEN (p_payload ? 'minimum_qualifying_deposit') THEN (p_payload->>'minimum_qualifying_deposit')::numeric END,
      (v_prev_ref->>'minimum_qualifying_deposit')::numeric,
      10
    );
    v_max_bonus := COALESCE(
      CASE WHEN (p_payload ? 'maximum_first_deposit_bonus') THEN (p_payload->>'maximum_first_deposit_bonus')::numeric END,
      (v_prev_ref->>'maximum_first_deposit_bonus')::numeric,
      50
    );
    v_lc_percent := COALESCE(
      CASE WHEN (p_payload ? 'lifetime_commission_percent') THEN (p_payload->>'lifetime_commission_percent')::numeric END,
      (v_prev_ref->>'lifetime_commission_percent')::numeric,
      0
    );
  EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', 'All financial reward inputs must be valid numbers.');
  END;

  -- Strict server-side numeric bounds validation
  IF v_reg_amount < 0 OR v_reg_amount > 1000 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Registration reward must be between 0 and 1000 USDT.');
  END IF;
  IF v_fd_percent < 0 OR v_fd_percent > 100 THEN
    RETURN jsonb_build_object('success', false, 'error', 'First deposit bonus percentage must be between 0% and 100%.');
  END IF;
  IF v_lc_percent < 0 OR v_lc_percent > 50 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Lifetime commission percentage must be between 0% and 50%.');
  END IF;
  IF v_min_dep < 0 OR v_min_dep > 100000 OR v_max_bonus < 0 OR v_max_bonus > 100000 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Qualifying deposit and max bonus bounds must be between 0 and 100,000 USDT.');
  END IF;

  v_next_ver := COALESCE((v_prev_ref->>'config_version')::integer, 0) + 1;

  v_canonical := jsonb_build_object(
    'enabled', v_enabled,
    'reward_currency', 'USDT',
    'supported_network', 'TRC-20',
    'config_version', v_next_ver,
    'updated_by', v_admin_id,
    'updated_by_email', v_admin_email,
    'updated_at', to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
    'registration_reward_enabled', v_reg_enabled,
    'registration_reward_amount', ROUND(v_reg_amount, 2),
    'first_deposit_reward_enabled', v_fd_enabled,
    'first_deposit_reward_percent', ROUND(v_fd_percent, 2),
    'minimum_qualifying_deposit', ROUND(v_min_dep, 2),
    'maximum_first_deposit_bonus', ROUND(v_max_bonus, 2),
    'lifetime_commission_enabled', v_lc_enabled,
    'lifetime_commission_percent', ROUND(v_lc_percent, 2),
    'lifetime_commission_activity', COALESCE(p_payload->>'lifetime_commission_activity', v_prev_ref->>'lifetime_commission_activity', 'ticket_purchase'),
    'registration_reward', jsonb_build_object(
      'enabled', v_reg_enabled,
      'amount', ROUND(v_reg_amount, 2)
    ),
    'first_deposit_reward', jsonb_build_object(
      'enabled', v_fd_enabled,
      'amount', ROUND(v_fd_percent, 2),
      'mode', 'percentage',
      'min_deposit', ROUND(v_min_dep, 2),
      'max_reward', ROUND(v_max_bonus, 2)
    ),
    'lifetime_commission', jsonb_build_object(
      'enabled', v_lc_enabled,
      'percent', ROUND(v_lc_percent, 2),
      'activity', COALESCE(p_payload->>'lifetime_commission_activity', v_prev_ref->>'lifetime_commission_activity', 'ticket_purchase')
    )
  );

  INSERT INTO public.platform_settings (key, value, updated_at)
  VALUES ('referral_settings', v_canonical, now())
  ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now();

  v_global := jsonb_set(v_global, '{referralSettings}', v_canonical, true);
  INSERT INTO public.platform_settings (key, value, updated_at)
  VALUES ('global', v_global, now())
  ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now();

  INSERT INTO public.admin_audit_logs (
    admin_id, admin_email, action_type, target_type, target_id, changes, ip_address, created_at
  ) VALUES (
    v_admin_id,
    v_admin_email,
    'UPDATE_REFERRAL_SETTINGS',
    'platform_settings',
    'referral_settings',
    jsonb_build_object('before', v_prev_ref, 'after', v_canonical),
    p_ip_address,
    now()
  );

  RETURN jsonb_build_object('success', true, 'settings', v_canonical);
END;
$$;

-- ----------------------------------------------------------------------------
-- E. Hardened Registration Referral Attribution & Reward RPC
-- ----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.process_referral_registration(text);

CREATE OR REPLACE FUNCTION public.process_referral_registration(
  p_referral_code text,
  p_device_fingerprint text DEFAULT NULL,
  p_client_ip text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth', 'extensions', 'pg_temp'
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_clean text := trim(regexp_replace(COALESCE(p_referral_code, ''), '^@\s*', ''));
  v_referrer_id uuid;
  v_existing record;
  v_ref_addr text;
  v_ref_name text;
  v_own_addr text;
  v_own_name text;
  v_cfg jsonb;
  v_enabled boolean;
  v_reg_enabled boolean;
  v_amount numeric;
  v_cfg_ver integer;
  v_rate jsonb;
  v_device_fp text := NULLIF(left(trim(COALESCE(p_device_fingerprint, '')), 128), '');
  v_ip_hash text := CASE
    WHEN NULLIF(trim(COALESCE(p_client_ip, '')), '') IS NOT NULL
    THEN encode(extensions.digest(trim(p_client_ip), 'sha256'), 'hex')
    ELSE NULL
  END;
  v_shared_device_count integer := 0;
  v_recent_device_count integer := 0;
  v_risk_score integer := 0;
  v_risk_flags jsonb := '[]'::jsonb;
  v_flagged boolean := false;
  v_credit_res jsonb;
  v_tx_id text;
  v_should_credit boolean := false;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Authentication required.');
  END IF;

  IF v_clean = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Empty referral code.');
  END IF;

  -- Serialize attribution per referred user to guarantee atomic single execution
  PERFORM pg_advisory_xact_lock(hashtext('ref_reg_' || v_uid::text));

  v_rate := public._check_rate_limit('ref_reg_uid_' || v_uid::text, 10, 3600);
  IF NOT COALESCE((v_rate->>'allowed')::boolean, true) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Too many referral verification requests. Please wait.');
  END IF;

  v_referrer_id := public.resolve_referrer_by_code(v_clean);
  IF v_referrer_id IS NULL THEN
    IF EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = v_uid
        AND (lower(username) = lower(v_clean) OR id::text = lower(v_clean))
    ) THEN
      INSERT INTO public.referral_security_events (
        user_id, related_user_id, event_type, severity, risk_score, device_fingerprint, ip_hash, details
      ) VALUES (
        v_uid, v_uid, 'self_referral_attempt', 'high', 90, v_device_fp, v_ip_hash,
        jsonb_build_object('referral_code', v_clean)
      );
      RETURN jsonb_build_object('success', false, 'error', 'Self-referral is not allowed.');
    END IF;
    RETURN jsonb_build_object('success', false, 'error', 'Referrer not found.');
  END IF;

  -- 1. Block self-referral and record security audit event
  IF v_referrer_id = v_uid THEN
    INSERT INTO public.referral_security_events (
      user_id, related_user_id, event_type, severity, risk_score, device_fingerprint, ip_hash, details
    ) VALUES (
      v_uid, v_referrer_id, 'self_referral_attempt', 'high', 90, v_device_fp, v_ip_hash,
      jsonb_build_object('referral_code', v_clean)
    );
    RETURN jsonb_build_object('success', false, 'error', 'Self-referral is not allowed.');
  END IF;

  -- 2. Check existing attribution immutability
  SELECT * INTO v_existing FROM public.user_referrals WHERE referred_user_id = v_uid FOR UPDATE;
  IF FOUND THEN
    IF v_existing.referrer_id <> v_referrer_id THEN
      INSERT INTO public.referral_security_events (
        user_id, related_user_id, event_type, severity, risk_score, device_fingerprint, ip_hash, details
      ) VALUES (
        v_uid, v_referrer_id, 'attribution_reassignment_attempt', 'high', 85, v_device_fp, v_ip_hash,
        jsonb_build_object('locked_referrer_id', v_existing.referrer_id, 'attempted_referrer_id', v_referrer_id)
      );
      RETURN jsonb_build_object('success', false, 'error', 'Referral ownership is locked once assigned.');
    END IF;

    RETURN jsonb_build_object(
      'success', true,
      'already_attributed', true,
      'referrer_id', v_existing.referrer_id,
      'reward_credited', 0
    );
  END IF;

  -- 3. Block circular referrals (e.g., A referred B, and B tries to refer A; up to 3 hops)
  IF EXISTS (
    SELECT 1 FROM public.user_referrals ur
    WHERE ur.referrer_id = v_uid AND ur.referred_user_id = v_referrer_id
  ) OR EXISTS (
    SELECT 1
    FROM public.user_referrals ur1
    JOIN public.user_referrals ur2 ON ur1.referred_user_id = ur2.referrer_id
    WHERE ur1.referrer_id = v_uid AND ur2.referred_user_id = v_referrer_id
  ) THEN
    INSERT INTO public.referral_security_events (
      user_id, related_user_id, event_type, severity, risk_score, device_fingerprint, ip_hash, details
    ) VALUES (
      v_uid, v_referrer_id, 'circular_referral_attempt', 'high', 95, v_device_fp, v_ip_hash,
      jsonb_build_object('referral_code', v_clean)
    );
    RETURN jsonb_build_object('success', false, 'error', 'Circular referral relationship rejected.');
  END IF;

  -- 4. Risk scoring based on device & velocity signals (non-blocking for normal shared networks)
  IF v_device_fp IS NOT NULL THEN
    SELECT COUNT(*) INTO v_shared_device_count
    FROM public.user_referrals
    WHERE device_fingerprint = v_device_fp;

    SELECT COUNT(*) INTO v_recent_device_count
    FROM public.user_referrals
    WHERE device_fingerprint = v_device_fp
      AND created_at >= now() - interval '1 hour';

    IF v_shared_device_count >= 2 THEN
      v_risk_score := v_risk_score + 40;
      v_risk_flags := v_risk_flags || '["shared_device_signal"]'::jsonb;
    END IF;
    IF v_recent_device_count >= 4 THEN
      v_risk_score := v_risk_score + 50;
      v_risk_flags := v_risk_flags || '["high_velocity_device_cluster"]'::jsonb;
      v_flagged := true;
    END IF;
  END IF;

  IF v_risk_score >= 40 THEN
    INSERT INTO public.referral_security_events (
      user_id, related_user_id, event_type, severity, risk_score, device_fingerprint, ip_hash, details
    ) VALUES (
      v_uid, v_referrer_id,
      CASE WHEN v_flagged THEN 'referral_velocity_flagged' ELSE 'shared_device_notice' END,
      CASE WHEN v_flagged THEN 'high' ELSE 'medium' END,
      v_risk_score, v_device_fp, v_ip_hash,
      jsonb_build_object('shared_device_count', v_shared_device_count, 'recent_1h', v_recent_device_count, 'flags', v_risk_flags)
    );
  END IF;

  SELECT username, trc20_address INTO v_ref_name, v_ref_addr FROM public.profiles WHERE id = v_referrer_id;
  SELECT username, trc20_address INTO v_own_name, v_own_addr FROM public.profiles WHERE id = v_uid;

  v_cfg := public.get_authoritative_referral_settings();
  v_enabled := COALESCE((v_cfg->>'enabled')::boolean, false);
  v_reg_enabled := COALESCE((v_cfg->>'registration_reward_enabled')::boolean, false);
  v_amount := GREATEST(0, COALESCE((v_cfg->>'registration_reward_amount')::numeric, 0));
  v_cfg_ver := COALESCE((v_cfg->>'config_version')::integer, 1);

  -- Strict zero-reward & disabled enforcement: NO credit & NO reward/ledger entry when amount = 0 or disabled
  v_should_credit := (v_enabled AND v_reg_enabled AND v_amount > 0 AND NOT v_flagged);

  INSERT INTO public.user_referrals (
    referrer_id, referrer_address, referrer_username,
    referred_user_id, referred_address, referred_username,
    referral_code, status, registration_reward_credited,
    total_commission_earned, device_fingerprint, ip_hash,
    risk_score, risk_flags, is_flagged, attribution_locked_at,
    created_at, updated_at
  ) VALUES (
    v_referrer_id, v_ref_addr, v_ref_name,
    v_uid, v_own_addr, v_own_name,
    v_clean,
    CASE WHEN v_flagged THEN 'under_review' ELSE 'active' END,
    v_should_credit,
    CASE WHEN v_should_credit THEN v_amount ELSE 0 END,
    v_device_fp, v_ip_hash,
    v_risk_score, v_risk_flags, v_flagged, now(),
    now(), now()
  );

  IF v_should_credit THEN
    v_credit_res := public._internal_credit_virtual_credits(
      v_amount,
      'referral_registration_reward',
      'ref-reg-' || v_uid::text,
      'Referral registration reward for inviting ' || COALESCE(NULLIF(v_own_name, ''), substr(v_uid::text, 1, 8)),
      v_ref_addr,
      v_referrer_id,
      jsonb_build_object(
        'reward_category', 'registration',
        'referred_user_id', v_uid,
        'referral_code', v_clean,
        'configured_amount', v_amount,
        'config_version', v_cfg_ver,
        'currency', 'USDT',
        'network', 'TRC-20'
      )
    );

    v_tx_id := v_credit_res->>'transaction_id';

    INSERT INTO public.referral_rewards (
      referrer_id, referred_user_id, reward_type, amount, currency, status, ledger_tx_id, source_tx_id, details, created_at
    ) VALUES (
      v_referrer_id, v_uid, 'registration', v_amount, 'USDT', 'credited', v_tx_id, 'reg-' || v_uid::text,
      jsonb_build_object(
        'description', 'Registration bonus for inviting ' || COALESCE(NULLIF(v_own_name, ''), substr(v_uid::text, 1, 8)),
        'config_version', v_cfg_ver,
        'applied_amount', v_amount
      ),
      now()
    ) ON CONFLICT DO NOTHING;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'referrer_id', v_referrer_id,
    'reward_credited', CASE WHEN v_should_credit THEN v_amount ELSE 0 END,
    'reward_disabled_or_zero', (NOT v_should_credit),
    'flagged', v_flagged
  );
END;
$$;

-- ----------------------------------------------------------------------------
-- F. Atomic Deposit Confirmation + First Deposit Bonus Engine (Service/Admin Only)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.process_confirmed_deposit_secure(
  p_deposit_id text DEFAULT NULL,
  p_payment_id text DEFAULT NULL,
  p_status text DEFAULT 'waiting',
  p_paid_amount numeric DEFAULT NULL,
  p_pay_currency text DEFAULT NULL,
  p_price_currency text DEFAULT 'usd',
  p_raw_payload jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth', 'pg_temp'
AS $$
DECLARE
  v_norm_status text := lower(trim(COALESCE(p_status, '')));
  v_norm_pay_curr text := lower(trim(COALESCE(p_pay_currency, '')));
  v_norm_price_curr text := lower(trim(COALESCE(p_price_currency, 'usd')));
  v_dep record;
  v_user_addr text;
  v_credit_amount numeric;
  v_credit_res jsonb;
  v_tx_id text;
  v_ref record;
  v_cfg jsonb;
  v_bonus_pct numeric;
  v_min_dep numeric;
  v_max_bonus numeric;
  v_raw_bonus numeric;
  v_bonus numeric := 0;
  v_bonus_res jsonb;
  v_bonus_tx_id text;
  v_ref_addr text;
  v_cfg_ver integer;
BEGIN
  IF NOT (
    current_setting('role', true) = 'service_role'
    OR (current_setting('request.jwt.claims', true) IS NULL AND session_user IN ('postgres', 'supabase_admin'))
    OR public.is_admin()
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized: backend service role or admin required.');
  END IF;

  -- Locate & lock the deposit order
  SELECT * INTO v_dep FROM public.lottery_deposits
  WHERE (p_deposit_id IS NOT NULL AND id = p_deposit_id)
     OR (p_payment_id IS NOT NULL AND payment_id = p_payment_id)
  ORDER BY created_at DESC LIMIT 1
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Deposit record not found.');
  END IF;

  -- Enforce USDT-TRC20 ONLY
  IF lower(COALESCE(v_dep.pay_currency, '')) <> 'usdttrc20' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unsupported historical payment currency/network: only usdttrc20 is accepted.');
  END IF;

  IF v_norm_pay_curr <> '' AND v_norm_pay_curr <> 'usdttrc20' THEN
    INSERT INTO public.referral_security_events (
      user_id, event_type, severity, risk_score, details
    ) VALUES (
      v_dep.user_id, 'unsupported_deposit_currency_webhook', 'high', 80,
      jsonb_build_object('deposit_id', v_dep.id, 'received_pay_currency', p_pay_currency, 'status', v_norm_status)
    );
    RETURN jsonb_build_object('success', false, 'error', 'Rejected non-TRC20 deposit callback (' || COALESCE(p_pay_currency, 'unknown') || ').');
  END IF;

  IF v_norm_price_curr NOT IN ('usd', 'usdt', 'usdttrc20') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unsupported invoice price currency.');
  END IF;

  -- Idempotency: Never downgrade or re-process an already completed deposit
  IF lower(COALESCE(v_dep.status, '')) IN ('finished', 'confirmed') THEN
    RETURN jsonb_build_object(
      'success', true,
      'already_processed', true,
      'deposit_id', v_dep.id,
      'status', v_dep.status,
      'credited_amount', 0,
      'first_deposit_bonus', 0
    );
  END IF;

  -- Handle terminal failed/expired/cancelled/partially_paid/pending states without crediting
  IF v_norm_status NOT IN ('finished', 'confirmed') THEN
    UPDATE public.lottery_deposits
    SET status = CASE WHEN v_norm_status IN ('waiting', 'confirming', 'sending', 'partially_paid', 'failed', 'expired', 'refunded', 'cancelled') THEN v_norm_status ELSE status END,
        payment_id = COALESCE(lottery_deposits.payment_id, NULLIF(trim(COALESCE(p_payment_id, '')), '')),
        updated_at = now()
    WHERE id = v_dep.id;

    RETURN jsonb_build_object(
      'success', true,
      'already_processed', false,
      'deposit_id', v_dep.id,
      'status', v_norm_status,
      'credited_amount', 0,
      'first_deposit_bonus', 0
    );
  END IF;

  -- Completed status ('finished' / 'confirmed')
  -- Verify amount integrity: protect against severe underpayment even if provider marks finished
  v_credit_amount := ROUND(COALESCE(NULLIF(p_paid_amount, 0), v_dep.amount), 2);
  IF v_credit_amount <= 0 OR v_credit_amount < (v_dep.amount * 0.90) THEN
    UPDATE public.lottery_deposits
    SET status = 'partially_paid',
        payment_id = COALESCE(lottery_deposits.payment_id, NULLIF(trim(COALESCE(p_payment_id, '')), '')),
        updated_at = now()
    WHERE id = v_dep.id;
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Underpaid deposit flagged as partially_paid; manual reconciliation required.',
      'deposit_id', v_dep.id,
      'paid_amount', v_credit_amount,
      'expected_amount', v_dep.amount
    );
  END IF;

  -- Cap credited amount cleanly if slight rounding tolerance exists, or credit actual received up to invoice amount
  SELECT COALESCE(NULLIF(v_dep.user_address, ''), lw.address, p.trc20_address)
  INTO v_user_addr
  FROM public.profiles p
  LEFT JOIN public.lottery_wallets lw ON lw.user_id = p.id
  WHERE p.id = v_dep.user_id
  ORDER BY lw.updated_at DESC NULLS LAST
  LIMIT 1;

  v_credit_res := public._internal_credit_virtual_credits(
    v_credit_amount,
    'deposit',
    v_dep.id,
    'Confirmed USDT (TRC-20) Deposit',
    v_user_addr,
    v_dep.user_id,
    jsonb_build_object(
      'deposit_id', v_dep.id,
      'payment_id', COALESCE(p_payment_id, v_dep.payment_id),
      'pay_currency', 'usdttrc20',
      'network', 'TRC-20',
      'invoice_amount', v_dep.amount,
      'paid_amount', v_credit_amount,
      'provider_status', v_norm_status
    )
  );

  IF NOT COALESCE((v_credit_res->>'success')::boolean, false) THEN
    RETURN jsonb_build_object('success', false, 'error', COALESCE(v_credit_res->>'error', 'Failed to credit deposit.'));
  END IF;

  v_tx_id := v_credit_res->>'transaction_id';

  UPDATE public.lottery_deposits
  SET status = 'finished',
      payment_id = COALESCE(lottery_deposits.payment_id, NULLIF(trim(COALESCE(p_payment_id, '')), '')),
      updated_at = now()
  WHERE id = v_dep.id;

  -- If deposit itself was already in wallet_ledger before status flipped, skip bonus double check
  IF COALESCE((v_credit_res->>'already_processed')::boolean, false) THEN
    RETURN jsonb_build_object(
      'success', true,
      'already_processed', true,
      'deposit_id', v_dep.id,
      'status', 'finished',
      'credited_amount', 0,
      'first_deposit_bonus', 0
    );
  END IF;

  -- --------------------------------------------------------------------------
  -- First Deposit Bonus Engine (Atomic, Strictly Once per Referred User)
  -- --------------------------------------------------------------------------
  IF v_dep.user_id IS NOT NULL THEN
    -- Lock all existing referral attribution row(s) for this depositor
    SELECT * INTO v_ref FROM public.user_referrals
    WHERE referred_user_id = v_dep.user_id
    FOR UPDATE;

    IF FOUND
       AND v_ref.status = 'active'
       AND NOT COALESCE(v_ref.is_flagged, false)
       AND NOT v_ref.first_deposit_reward_credited
       AND v_ref.referrer_id IS NOT NULL
       AND v_ref.referrer_id <> v_dep.user_id
       AND NOT EXISTS (
         SELECT 1 FROM public.lottery_deposits ld
         WHERE ld.user_id = v_dep.user_id
           AND ld.id <> v_dep.id
           AND lower(COALESCE(ld.status, '')) IN ('finished', 'confirmed')
       )
       AND NOT EXISTS (
         SELECT 1 FROM public.referral_rewards rr
         WHERE rr.referred_user_id = v_dep.user_id
           AND rr.reward_type = 'first_deposit'
       ) THEN

      v_cfg := public.get_authoritative_referral_settings();
      IF COALESCE((v_cfg->>'enabled')::boolean, false)
         AND COALESCE((v_cfg->>'first_deposit_reward_enabled')::boolean, false) THEN
        v_bonus_pct := GREATEST(0, COALESCE((v_cfg->>'first_deposit_reward_percent')::numeric, 0));
        v_min_dep := GREATEST(0, COALESCE((v_cfg->>'minimum_qualifying_deposit')::numeric, 0));
        v_max_bonus := GREATEST(0, COALESCE((v_cfg->>'maximum_first_deposit_bonus')::numeric, 0));
        v_cfg_ver := COALESCE((v_cfg->>'config_version')::integer, 1);

        IF v_bonus_pct > 0 AND v_credit_amount >= v_min_dep THEN
          v_raw_bonus := ROUND((v_credit_amount * v_bonus_pct) / 100.0, 2);
          v_bonus := CASE WHEN v_max_bonus > 0 THEN LEAST(v_raw_bonus, v_max_bonus) ELSE v_raw_bonus END;

          IF v_bonus > 0 THEN
            SELECT COALESCE(NULLIF(v_ref.referrer_address, ''), p.trc20_address)
            INTO v_ref_addr
            FROM public.profiles p WHERE p.id = v_ref.referrer_id;

            v_bonus_res := public._internal_credit_virtual_credits(
              v_bonus,
              'referral_reward',
              'ref-1st-dep-' || v_dep.user_id::text,
              'First Deposit Bonus (' || trim(to_char(v_bonus_pct, 'FM999990.##')) || '%) from invited user deposit',
              v_ref_addr,
              v_ref.referrer_id,
              jsonb_build_object(
                'reward_category', 'first_deposit',
                'referred_user_id', v_dep.user_id,
                'source_deposit_id', v_dep.id,
                'payment_id', COALESCE(p_payment_id, v_dep.payment_id),
                'qualifying_deposit_amount', v_credit_amount,
                'configured_percent', v_bonus_pct,
                'max_bonus_cap', v_max_bonus,
                'calculated_bonus', v_bonus,
                'config_version', v_cfg_ver,
                'currency', 'USDT',
                'network', 'TRC-20'
              )
            );

            v_bonus_tx_id := v_bonus_res->>'transaction_id';

            IF COALESCE((v_bonus_res->>'success')::boolean, false) THEN
              INSERT INTO public.referral_rewards (
                referrer_id, referred_user_id, reward_type, amount, currency, status, ledger_tx_id, source_tx_id, details, created_at
              ) VALUES (
                v_ref.referrer_id, v_dep.user_id, 'first_deposit', v_bonus, 'USDT', 'credited', v_bonus_tx_id, v_dep.id,
                jsonb_build_object(
                  'description', 'First Deposit Match (' || trim(to_char(v_bonus_pct, 'FM999990.##')) || '% of ' || v_credit_amount || ' USDT)',
                  'source_deposit_id', v_dep.id,
                  'qualifying_deposit_amount', v_credit_amount,
                  'applied_percent', v_bonus_pct,
                  'max_bonus_cap', v_max_bonus,
                  'config_version', v_cfg_ver
                ),
                now()
              ) ON CONFLICT DO NOTHING;

              UPDATE public.user_referrals
              SET first_deposit_amount = v_credit_amount,
                  first_deposit_reward_credited = true,
                  first_deposit_bonus_amount = v_bonus,
                  first_deposit_id = v_dep.id,
                  total_commission_earned = COALESCE(total_commission_earned, 0) + v_bonus,
                  updated_at = now()
              WHERE id = v_ref.id;
            END IF;
          END IF;
        END IF;
      END IF;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'already_processed', false,
    'deposit_id', v_dep.id,
    'status', 'finished',
    'credited_amount', v_credit_amount,
    'ledger_tx_id', v_tx_id,
    'first_deposit_bonus', v_bonus,
    'first_deposit_bonus_tx_id', v_bonus_tx_id
  );
END;
$$;

-- ----------------------------------------------------------------------------
-- G. Update buy_lottery_tickets_secure with Synchronized Lifetime Commission
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

  IF v_event.status <> 'active' THEN
    RETURN jsonb_build_object('success', false, 'error', 'This lottery draw is no longer active.');
  END IF;

  IF v_event.draw_time IS NOT NULL AND v_event.draw_time <= (EXTRACT(EPOCH FROM now()) * 1000) THEN
    RETURN jsonb_build_object('success', false, 'error', 'This lottery has reached its draw cutoff time.');
  END IF;

  FOREACH v_num IN ARRAY p_ticket_numbers LOOP
    IF EXISTS (
      SELECT 1 FROM public.lottery_tickets
      WHERE event_id = p_event_id AND lpad(ticket_number, 4, '0') = lpad(v_num, 4, '0')
    ) THEN
      RETURN jsonb_build_object('success', false, 'error', 'Ticket #' || lpad(v_num, 4, '0') || ' is already taken. Please choose another combination.');
    END IF;
  END LOOP;

  v_total_cost := v_event.ticket_price * v_num_tickets;
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

  v_new_balance := round(v_wallet.balance - v_total_cost, 2);
  UPDATE public.lottery_wallets
  SET balance = v_new_balance, updated_at = now()
  WHERE address = v_wallet.address;

  v_now_ms := (EXTRACT(EPOCH FROM now()) * 1000)::bigint;
  v_order_ref := 'tkt-order-' || v_now_ms || '-' || floor(random() * 8999 + 1000)::text;
  v_user_display := COALESCE(p_username, '@' || substring(v_wallet.address from 1 for 6));

  FOREACH v_num IN ARRAY p_ticket_numbers LOOP
    v_ticket_id := 'tkt-' || v_now_ms || '-' || floor(random() * 8999 + 1000)::text || '-' || floor(random() * 899 + 100)::text;
    INSERT INTO public.lottery_tickets (
      id, user_id, user_address, username, event_id, event_title, ticket_number,
      price, purchase_time, status, match_tier, won_amount, claimed, currency, created_at
    ) VALUES (
      v_ticket_id, v_uid, v_wallet.address, v_user_display,
      p_event_id, v_event.title, lpad(v_num, 4, '0'), v_event.ticket_price, v_now_ms,
      'active', NULL, 0, false, v_curr, now()
    );
  END LOOP;

  UPDATE public.lottery_events
  SET pool_prize = round(pool_prize + (v_total_cost * 0.95), 2),
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
    jsonb_build_object('event_id', p_event_id, 'tickets_count', v_num_tickets, 'currency', 'USDT'),
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

-- ----------------------------------------------------------------------------
-- H. Strict USDT TRC-20 ONLY Withdrawal Security RPC + Admin Resolution RPC
-- ----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.request_withdrawal_secure(numeric, text, text, text);

CREATE OR REPLACE FUNCTION public.request_withdrawal_secure(
  p_amount numeric,
  p_destination_address text,
  p_network text DEFAULT 'TRC-20'::text,
  p_user_address text DEFAULT NULL::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth', 'pg_temp'
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_wallet record;
  v_global jsonb;
  v_wd_cfg jsonb;
  v_min_limit numeric := 5;
  v_max_limit numeric := 10000;
  v_amount numeric;
  v_fee numeric := 1.00;
  v_net numeric;
  v_new_balance numeric;
  v_wd_id text;
  v_tx_id text;
  v_now_ms bigint;
  v_norm_net text := upper(regexp_replace(trim(COALESCE(p_network, '')), '[-_\s]', '', 'g'));
  v_clean_dest text := trim(COALESCE(p_destination_address, ''));
  v_rate jsonb;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Authentication required to submit a withdrawal request.');
  END IF;

  -- Serialize withdrawals per user to prevent double-spend & concurrent balance races
  PERFORM pg_advisory_xact_lock(hashtext('wd_req_' || v_uid::text));

  -- Backend rate limiting (max 5 withdrawal submissions per 5 minutes per user)
  v_rate := public._check_rate_limit('wd_uid_' || v_uid::text, 5, 300);
  IF NOT COALESCE((v_rate->>'allowed')::boolean, true) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Too many withdrawal attempts. Please wait a moment before trying again.');
  END IF;

  -- STRICT ENFORCEMENT: ONLY USDT on TRON (TRC-20) is permitted
  IF v_norm_net NOT IN ('TRC20', 'USDTTRC20', 'TRONTRC20') THEN
    INSERT INTO public.referral_security_events (
      user_id, event_type, severity, risk_score, details
    ) VALUES (
      v_uid, 'unsupported_withdrawal_network_attempt', 'medium', 60,
      jsonb_build_object('attempted_network', p_network, 'amount', p_amount)
    );
    RETURN jsonb_build_object('success', false, 'error', 'Unsupported withdrawal network. Only USDT on TRON (TRC-20) is supported.');
  END IF;

  -- Strict TRON Base58 TRC-20 destination validation (starts with 'T', 34 Base58 chars)
  IF v_clean_dest !~ '^T[1-9A-HJ-NP-Za-km-z]{33}$' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid TRON (TRC-20) destination address. Must be a 34-character address starting with T.');
  END IF;

  IF p_amount IS NULL OR p_amount <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid withdrawal amount.');
  END IF;

  v_amount := ROUND(p_amount, 2);

  -- Read authoritative min/max withdrawal bounds from 'global' (and 'withdrawal_settings')
  SELECT value INTO v_global FROM public.platform_settings WHERE key = 'global';
  SELECT value INTO v_wd_cfg FROM public.platform_settings WHERE key = 'withdrawal_settings';

  v_min_limit := COALESCE(
    (v_global->>'minWithdrawal')::numeric,
    (v_wd_cfg->>'minWithdrawal')::numeric,
    5
  );
  v_max_limit := COALESCE(
    (v_global->>'maxWithdrawal')::numeric,
    (v_wd_cfg->>'maxWithdrawal')::numeric,
    10000
  );
  v_fee := COALESCE((v_wd_cfg->>'networkFee')::numeric, 1.00);

  IF v_amount < v_min_limit THEN
    RETURN jsonb_build_object('success', false, 'error', 'Minimum withdrawal is ' || v_min_limit || ' USDT.');
  END IF;
  IF v_amount > v_max_limit THEN
    RETURN jsonb_build_object('success', false, 'error', 'Maximum single withdrawal is ' || v_max_limit || ' USDT.');
  END IF;

  -- Guard against accidental duplicate identical pending withdrawals within 60 seconds
  v_now_ms := (EXTRACT(EPOCH FROM now()) * 1000)::bigint;
  IF EXISTS (
    SELECT 1 FROM public.lottery_withdrawals
    WHERE user_id = v_uid
      AND status = 'processing'
      AND amount = v_amount
      AND destination_address = v_clean_dest
      AND requested_at >= (v_now_ms - 60000)
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Duplicate withdrawal detected. Your previous identical request is already processing.');
  END IF;

  v_net := ROUND(v_amount - v_fee, 2);
  IF v_net <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Withdrawal amount must exceed the ' || v_fee || ' USDT TRC-20 network fee.');
  END IF;

  SELECT * INTO v_wallet FROM public.lottery_wallets
  WHERE user_id = v_uid
  ORDER BY updated_at DESC LIMIT 1
  FOR UPDATE;

  IF NOT FOUND OR COALESCE(v_wallet.balance, 0) < v_amount THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Insufficient balance. Available: ' || COALESCE(v_wallet.balance, 0) || ' USDT, Requested: ' || v_amount || ' USDT.'
    );
  END IF;

  v_new_balance := ROUND(v_wallet.balance - v_amount, 2);
  UPDATE public.lottery_wallets
  SET balance = v_new_balance, updated_at = now()
  WHERE address = v_wallet.address;

  v_wd_id := 'wd_' || v_now_ms || '_' || substr(md5(random()::text), 1, 6);
  v_tx_id := 'tx_' || to_char(now(), 'YYYYMMDDHH24MISS') || '_' || substr(md5(random()::text), 1, 8);

  INSERT INTO public.lottery_withdrawals (
    id, user_id, user_address, amount, net_disbursal, network_fee,
    network, destination_address, requested_at, sla_target_ms, status, created_at
  ) VALUES (
    v_wd_id, v_uid, v_wallet.address, v_amount, v_net, v_fee,
    'TRC-20', v_clean_dest, v_now_ms, v_now_ms + (24 * 60 * 60 * 1000), 'processing', now()
  );

  INSERT INTO public.wallet_ledger (
    id, user_id, wallet_address, transaction_type, amount, balance_before, balance_after,
    currency, reference_id, description, metadata, created_at
  ) VALUES (
    v_tx_id, v_uid, v_wallet.address, 'withdrawal',
    -v_amount, v_wallet.balance, v_new_balance, 'USDT', v_wd_id,
    'USDT (TRC-20) withdrawal to ' || substr(v_clean_dest, 1, 6) || '...' || right(v_clean_dest, 4),
    jsonb_build_object(
      'network', 'TRC-20',
      'asset', 'USDT',
      'fee', v_fee,
      'net_disbursal', v_net,
      'destination', v_clean_dest,
      'withdrawal_id', v_wd_id
    ),
    now()
  );

  RETURN jsonb_build_object(
    'success', true,
    'order_id', v_wd_id,
    'withdrawal_id', v_wd_id,
    'amount', v_amount,
    'net_disbursal', v_net,
    'network_fee', v_fee,
    'network', 'TRC-20',
    'destination_address', v_clean_dest,
    'new_balance', v_new_balance,
    'transaction_id', v_tx_id,
    'status', 'processing'
  );
END;
$$;

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
    v_final_hash := NULLIF(trim(COALESCE(p_tx_hash, '')), '');
    IF v_final_hash IS NULL THEN
      v_final_hash := '0x' || substr(md5(v_wd.id || clock_timestamp()::text), 1, 32);
    END IF;

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

  -- Rejection / Refund atomically to the requesting user's wallet
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

-- ----------------------------------------------------------------------------
-- I. Harden RLS Policies & Execution Privileges
-- ----------------------------------------------------------------------------
ALTER TABLE public.referral_security_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.security_rate_limits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS referral_security_events_admin_select ON public.referral_security_events;
CREATE POLICY referral_security_events_admin_select
  ON public.referral_security_events
  FOR SELECT TO authenticated
  USING ((SELECT public.is_admin()));

-- Remove direct client INSERT on user_referrals; must go through process_referral_registration RPC
DROP POLICY IF EXISTS user_referrals_insert_policy ON public.user_referrals;
CREATE POLICY user_referrals_insert_policy
  ON public.user_referrals
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT public.is_admin()));

-- Remove direct client INSERT of fake finished deposits; new orders come from Edge Function (service_role)
DROP POLICY IF EXISTS lottery_deposits_insert_policy ON public.lottery_deposits;
CREATE POLICY lottery_deposits_insert_policy
  ON public.lottery_deposits
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT public.is_admin()));

-- Users may only cancel/expire still-pending deposits, never overwrite finished/confirmed deposits
DROP POLICY IF EXISTS lottery_deposits_update_policy ON public.lottery_deposits;
CREATE POLICY lottery_deposits_update_policy
  ON public.lottery_deposits
  FOR UPDATE TO authenticated
  USING (
    ((SELECT public.is_admin()))
    OR (
      (SELECT auth.uid()) = user_id
      AND lower(COALESCE(status, '')) IN ('waiting', 'confirming', 'sending')
    )
  )
  WITH CHECK (
    ((SELECT public.is_admin()))
    OR (
      (SELECT auth.uid()) = user_id
      AND status = ANY (ARRAY['cancelled'::text, 'expired'::text])
    )
  );

-- Restrict internal / privileged functions from direct invocation by anon / authenticated users
REVOKE ALL ON FUNCTION public._internal_credit_virtual_credits(numeric, text, text, text, text, uuid, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._check_rate_limit(text, integer, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.process_confirmed_deposit_secure(text, text, text, numeric, text, text, jsonb) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.get_authoritative_referral_settings() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_update_referral_settings_secure(jsonb, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.process_referral_registration(text, text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.buy_lottery_tickets_secure(text, text[], text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.request_withdrawal_secure(numeric, text, text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_process_withdrawal_secure(text, text, text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.process_confirmed_deposit_secure(text, text, text, numeric, text, text, jsonb) TO service_role;
