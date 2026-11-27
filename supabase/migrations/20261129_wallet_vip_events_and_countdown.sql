-- ============================================================================
-- EARNFLOW.IN: USER WALLET ADJUSTMENTS, VIP MEMBERSHIP, NORMAL/VIP EVENTS,
--              SPIN WHEEL KYC CLEANUP & RESULT DISPLAY COUNTDOWN
-- ============================================================================

-- 1. Strip unused require_kyc from spin_wheel_settings & global; add default vipMembershipPrice (25 USDT)
UPDATE public.platform_settings
SET value = (COALESCE(value, '{}'::jsonb) #- '{spinWheelSettings,require_kyc}')
            || CASE WHEN NOT (COALESCE(value, '{}'::jsonb) ? 'vipMembershipPrice')
                 THEN jsonb_build_object('vipMembershipPrice', 25)
                 ELSE '{}'::jsonb
               END,
    updated_at = now()
WHERE key = 'global';

UPDATE public.platform_settings
SET value = COALESCE(value, '{}'::jsonb) - 'require_kyc',
    updated_at = now()
WHERE key = 'spin_wheel_settings';

-- 2. Extend public.profiles with server-authoritative Player Category & VIP Membership fields
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS player_type text NOT NULL DEFAULT 'normal',
  ADD COLUMN IF NOT EXISTS vip_status text NOT NULL DEFAULT 'inactive',
  ADD COLUMN IF NOT EXISTS vip_activated_at timestamptz,
  ADD COLUMN IF NOT EXISTS vip_paid_amount numeric(18,2),
  ADD COLUMN IF NOT EXISTS vip_payment_reference text,
  ADD COLUMN IF NOT EXISTS vip_source text NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS vip_granted_by uuid;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'profiles_player_type_check') THEN
    ALTER TABLE public.profiles ADD CONSTRAINT profiles_player_type_check CHECK (player_type IN ('normal', 'vip'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'profiles_vip_status_check') THEN
    ALTER TABLE public.profiles ADD CONSTRAINT profiles_vip_status_check CHECK (vip_status IN ('inactive', 'active', 'revoked'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'profiles_vip_source_check') THEN
    ALTER TABLE public.profiles ADD CONSTRAINT profiles_vip_source_check CHECK (vip_source IN ('none', 'purchased', 'admin_granted'));
  END IF;
END $$;

-- Protect VIP / Role / Status columns on profiles from direct non-admin PostgREST tampering
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

DROP TRIGGER IF EXISTS trg_protect_profile_sensitive_columns ON public.profiles;
CREATE TRIGGER trg_protect_profile_sensitive_columns
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_profile_sensitive_columns();

-- 3. Auditable VIP Membership Logs Table
CREATE TABLE IF NOT EXISTS public.vip_membership_logs (
  id text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action_type text NOT NULL CHECK (action_type IN ('purchased', 'admin_granted', 'admin_revoked')),
  previous_player_type text NOT NULL DEFAULT 'normal',
  new_player_type text NOT NULL,
  paid_amount numeric(18,2),
  payment_reference text UNIQUE,
  ledger_tx_id text,
  admin_id uuid,
  admin_email text,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vip_membership_logs_user
  ON public.vip_membership_logs (user_id, created_at DESC);

ALTER TABLE public.vip_membership_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS vip_membership_logs_select_own_or_admin ON public.vip_membership_logs;
CREATE POLICY vip_membership_logs_select_own_or_admin
  ON public.vip_membership_logs
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR public.is_admin());

-- 4. Event Category ('normal' | 'vip') and Result Countdown fields on lottery_events
ALTER TABLE public.lottery_events
  ADD COLUMN IF NOT EXISTS event_category text NOT NULL DEFAULT 'normal',
  ADD COLUMN IF NOT EXISTS result_published_at timestamptz,
  ADD COLUMN IF NOT EXISTS result_visible_until timestamptz;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'lottery_events_event_category_check') THEN
    ALTER TABLE public.lottery_events
      ADD CONSTRAINT lottery_events_event_category_check CHECK (event_category IN ('normal', 'vip'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_lottery_events_category_status
  ON public.lottery_events (event_category, status);

-- Backfill result_published_at / result_visible_until strictly for already-finalized events
UPDATE public.lottery_events
SET result_published_at = COALESCE(result_published_at, finalized_at),
    result_visible_until = COALESCE(result_visible_until, ticket_visibility_until)
WHERE finalized_at IS NOT NULL
  AND (result_published_at IS NULL OR result_visible_until IS NULL);

-- 5. Update admin_update_platform_settings_secure to validate & persist vipMembershipPrice
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
  v_vip_price numeric;
  v_username_fee numeric;
  v_retention numeric;
  v_support_email text;
  v_apk_url text;
  v_clean_wheel jsonb;
BEGIN
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized: Admin privileges required.');
  END IF;

  SELECT value INTO v_prev_global FROM public.platform_settings WHERE key = 'global';
  v_prev_global := (COALESCE(v_prev_global, '{}'::jsonb) - 'treasuryTrc20' - 'defaultWinnerSharePercent') #- '{spinWheelSettings,require_kyc}';

  v_min_wd := ROUND(COALESCE(NULLIF(trim(COALESCE(p_payload->>'minWithdrawal', '')), '')::numeric, (v_prev_global->>'minWithdrawal')::numeric, 5), 2);
  v_max_wd := ROUND(COALESCE(NULLIF(trim(COALESCE(p_payload->>'maxWithdrawal', '')), '')::numeric, (v_prev_global->>'maxWithdrawal')::numeric, 10000), 2);
  v_house_fee := ROUND(COALESCE(NULLIF(trim(COALESCE(p_payload->>'houseFeePercent', '')), '')::numeric, (v_prev_global->>'houseFeePercent')::numeric, 5), 2);
  v_vip_price := ROUND(COALESCE(NULLIF(trim(COALESCE(p_payload->>'vipMembershipPrice', '')), '')::numeric, (v_prev_global->>'vipMembershipPrice')::numeric, 25), 2);
  v_username_fee := ROUND(COALESCE(NULLIF(trim(COALESCE(p_payload->>'usernameChangeFee', '')), '')::numeric, (v_prev_global->>'usernameChangeFee')::numeric, 5), 2);
  v_retention := COALESCE(NULLIF(trim(COALESCE(p_payload->>'resultsRetentionHours', '')), '')::numeric, (v_prev_global->>'resultsRetentionHours')::numeric, 1);
  v_support_email := COALESCE(NULLIF(trim(COALESCE(p_payload->>'supportEmail', '')), ''), v_prev_global->>'supportEmail', 'earnflow.user@gmail.com');
  v_apk_url := COALESCE(NULLIF(trim(COALESCE(p_payload->>'apkDownloadUrl', '')), ''), v_prev_global->>'apkDownloadUrl', '/download/earnflow.apk');

  IF v_house_fee < 0 OR v_house_fee > 30 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Platform House Charge must be between 0% and 30%.');
  END IF;

  IF v_vip_price <= 0 OR v_vip_price > 100000 THEN
    RETURN jsonb_build_object('success', false, 'error', 'VIP Membership Price must be greater than 0 and up to 100,000 USDT.');
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

  IF v_retention < 0.01 OR v_retention > 168 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Results display duration must be between 0.01 and 168 hours.');
  END IF;

  v_next_global := ((v_prev_global || COALESCE(p_payload, '{}'::jsonb))
    - 'treasuryTrc20'
    - 'defaultWinnerSharePercent')
    #- '{spinWheelSettings,require_kyc}'
    || jsonb_build_object(
      'supportedCurrency', 'USDT',
      'supportedNetwork', 'TRC-20',
      'minWithdrawal', v_min_wd,
      'maxWithdrawal', v_max_wd,
      'houseFeePercent', v_house_fee,
      'vipMembershipPrice', v_vip_price,
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
      'minWithdrawal', v_min_wd,
      'maxWithdrawal', v_max_wd,
      'usernameChangeFee', v_username_fee,
      'resultsRetentionHours', v_retention
    )
  );

  RETURN jsonb_build_object('success', true, 'settings', v_next_global);
END;
$$;

-- 6. Admin Secure User Directory with Live Wallet Balance & Membership Details
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
      COALESCE(p.player_type, 'normal') AS player_type,
      COALESCE(p.vip_status, 'inactive') AS vip_status,
      p.vip_activated_at,
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

REVOKE ALL ON FUNCTION public.admin_get_users_with_wallets() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_get_users_with_wallets() TO authenticated;

-- 7. Admin Wallet Adjustment RPC (Add / Deduct with validation, atomic ledger & idempotency)
CREATE OR REPLACE FUNCTION public.admin_adjust_user_wallet_secure(
  p_target_user_id uuid,
  p_action text,
  p_amount numeric,
  p_reason text,
  p_idempotency_key text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth', 'pg_temp'
AS $$
DECLARE
  v_admin_id uuid := auth.uid();
  v_admin_email text;
  v_norm_action text := lower(trim(COALESCE(p_action, '')));
  v_clean_reason text := trim(COALESCE(p_reason, ''));
  v_amount numeric;
  v_profile record;
  v_wallet record;
  v_prev_balance numeric;
  v_new_balance numeric;
  v_signed_delta numeric;
  v_ref_id text;
  v_tx_id text;
  v_existing_tx record;
  v_target_addr text;
BEGIN
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized: Admin privileges required.');
  END IF;

  IF p_target_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Target user ID is required.');
  END IF;

  IF v_norm_action NOT IN ('add', 'deduct') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid adjustment type. Choose add or deduct.');
  END IF;

  IF p_amount IS NULL OR p_amount <= 0 OR p_amount > 1000000 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Adjustment amount must be greater than 0 and up to 1,000,000 USDT.');
  END IF;

  v_amount := ROUND(p_amount, 2);
  IF v_amount <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Adjustment amount must be at least 0.01 USDT.');
  END IF;

  IF v_clean_reason = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Admin note / reason is required for wallet adjustments.');
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('adm_wallet_adj_' || p_target_user_id::text));

  v_ref_id := COALESCE(
    NULLIF(trim(COALESCE(p_idempotency_key, '')), ''),
    'adm-adj-' || p_target_user_id::text || '-' || (EXTRACT(EPOCH FROM clock_timestamp()) * 1000)::bigint::text || '-' || substr(md5(random()::text), 1, 6)
  );

  -- Idempotency check: prevent duplicate ledger adjustments on retries
  SELECT id, balance_after, amount, created_at INTO v_existing_tx
  FROM public.wallet_ledger
  WHERE reference_id = v_ref_id
  LIMIT 1;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'success', true,
      'already_processed', true,
      'transaction_id', v_existing_tx.id,
      'reference_id', v_ref_id,
      'new_balance', v_existing_tx.balance_after
    );
  END IF;

  SELECT * INTO v_profile FROM public.profiles WHERE id = p_target_user_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Target user profile not found.');
  END IF;

  SELECT * INTO v_wallet
  FROM public.lottery_wallets
  WHERE user_id = p_target_user_id
     OR (v_profile.trc20_address IS NOT NULL AND lower(address) = lower(v_profile.trc20_address))
  ORDER BY (user_id = p_target_user_id) DESC, updated_at DESC NULLS LAST
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND THEN
    IF v_norm_action = 'deduct' THEN
      RETURN jsonb_build_object('success', false, 'error', 'User does not have an active wallet with funds to deduct.');
    END IF;
    v_target_addr := COALESCE(NULLIF(trim(COALESCE(v_profile.trc20_address, '')), ''), 'USER-' || replace(p_target_user_id::text, '-', ''));
    INSERT INTO public.lottery_wallets (user_id, address, balance, lifetime_won, network, updated_at)
    VALUES (p_target_user_id, v_target_addr, 0, 0, 'TRC-20', now())
    RETURNING * INTO v_wallet;
  END IF;

  v_prev_balance := ROUND(COALESCE(v_wallet.balance, 0), 2);

  IF v_norm_action = 'deduct' THEN
    IF v_prev_balance < v_amount THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'Insufficient user wallet balance. Available: ' || to_char(v_prev_balance, 'FM999999990.00') || ' USDT, Requested deduction: ' || to_char(v_amount, 'FM999999990.00') || ' USDT.'
      );
    END IF;
    v_signed_delta := -v_amount;
    v_new_balance := ROUND(v_prev_balance - v_amount, 2);
  ELSE
    v_signed_delta := v_amount;
    v_new_balance := ROUND(v_prev_balance + v_amount, 2);
  END IF;

  UPDATE public.lottery_wallets
  SET balance = v_new_balance,
      user_id = COALESCE(user_id, p_target_user_id),
      updated_at = now()
  WHERE address = v_wallet.address;

  SELECT email INTO v_admin_email FROM public.profiles WHERE id = v_admin_id;
  v_tx_id := 'tx_' || to_char(clock_timestamp(), 'YYYYMMDDHH24MISS') || '_' || substr(md5(v_ref_id || random()::text), 1, 8);

  INSERT INTO public.wallet_ledger (
    id, user_id, wallet_address, transaction_type, amount, balance_before, balance_after,
    currency, reference_id, description, metadata, created_at
  ) VALUES (
    v_tx_id,
    p_target_user_id,
    v_wallet.address,
    'admin_adjustment',
    v_signed_delta,
    v_prev_balance,
    v_new_balance,
    'USDT',
    v_ref_id,
    CASE WHEN v_norm_action = 'add' THEN 'Admin Wallet Credit: ' || v_clean_reason ELSE 'Admin Wallet Deduction: ' || v_clean_reason END,
    jsonb_build_object(
      'adjustment_type', CASE WHEN v_norm_action = 'add' THEN 'credit' ELSE 'debit' END,
      'amount', v_amount,
      'previous_balance', v_prev_balance,
      'new_balance', v_new_balance,
      'admin_id', v_admin_id,
      'admin_email', v_admin_email,
      'reason', v_clean_reason,
      'timestamp', clock_timestamp()
    ),
    clock_timestamp()
  );

  INSERT INTO public.admin_audit_logs (
    admin_id, admin_email, action_type, target_type, target_id, changes
  ) VALUES (
    v_admin_id,
    v_admin_email,
    CASE WHEN v_norm_action = 'add' THEN 'ADMIN_WALLET_CREDIT' ELSE 'ADMIN_WALLET_DEDUCT' END,
    'lottery_wallets',
    v_wallet.address,
    jsonb_build_object(
      'target_user_id', p_target_user_id,
      'adjustment_type', v_norm_action,
      'amount', v_amount,
      'previous_balance', v_prev_balance,
      'new_balance', v_new_balance,
      'reason', v_clean_reason,
      'reference_id', v_ref_id,
      'ledger_tx_id', v_tx_id
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'already_processed', false,
    'target_user_id', p_target_user_id,
    'wallet_address', v_wallet.address,
    'adjustment_type', v_norm_action,
    'amount', v_amount,
    'previous_balance', v_prev_balance,
    'new_balance', v_new_balance,
    'reference_id', v_ref_id,
    'transaction_id', v_tx_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_adjust_user_wallet_secure(uuid, text, numeric, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_adjust_user_wallet_secure(uuid, text, numeric, text, text) TO authenticated;

-- 8. Admin Update Player Membership Category RPC (NO fake payment or wallet transaction)
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
    (v_norm_type = 'vip' AND v_profile.vip_status = 'active')
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

  -- Preserve vip_paid_amount & vip_payment_reference if historical paid upgrade exists!
  UPDATE public.profiles
  SET player_type = v_norm_type,
      vip_status = CASE WHEN v_norm_type = 'vip' THEN 'active' ELSE 'inactive' END,
      vip_source = CASE WHEN v_norm_type = 'vip' THEN 'admin_granted' ELSE CASE WHEN vip_paid_amount IS NOT NULL THEN vip_source ELSE 'none' END END,
      vip_granted_by = CASE WHEN v_norm_type = 'vip' THEN v_admin_id ELSE NULL END,
      vip_activated_at = CASE WHEN v_norm_type = 'vip' THEN COALESCE(vip_activated_at, v_now) ELSE vip_activated_at END,
      updated_at = v_now
  WHERE id = p_target_user_id;

  v_log_id := 'viplog_' || to_char(v_now, 'YYYYMMDDHH24MISS') || '_' || substr(md5(p_target_user_id::text || random()::text), 1, 8);

  INSERT INTO public.vip_membership_logs (
    id, user_id, action_type, previous_player_type, new_player_type,
    admin_id, admin_email, reason, created_at
  ) VALUES (
    v_log_id,
    p_target_user_id,
    CASE WHEN v_norm_type = 'vip' THEN 'admin_granted' ELSE 'admin_revoked' END,
    v_prev_type,
    v_norm_type,
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

REVOKE ALL ON FUNCTION public.admin_update_user_player_category_secure(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_update_user_player_category_secure(uuid, text, text) TO authenticated;

-- 9. User Paid VIP Membership Upgrade RPC (Atomic, Idempotent, Server-Price Authoritative)
CREATE OR REPLACE FUNCTION public.purchase_vip_membership_secure(
  p_idempotency_key text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth', 'pg_temp'
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_profile record;
  v_wallet record;
  v_global_cfg jsonb;
  v_vip_price numeric;
  v_prev_balance numeric;
  v_new_balance numeric;
  v_ref_id text;
  v_tx_id text;
  v_log_id text;
  v_now timestamptz := clock_timestamp();
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Authentication required to upgrade to VIP Membership.');
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('vip_upgrade_' || v_uid::text));
  PERFORM set_config('earnflow.internal_profile_update', 'true', true);

  SELECT * INTO v_profile FROM public.profiles WHERE id = v_uid FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Player profile not found.');
  END IF;

  -- Prevent charging an already active VIP member again
  IF COALESCE(v_profile.player_type, 'normal') = 'vip' AND COALESCE(v_profile.vip_status, 'inactive') = 'active' THEN
    RETURN jsonb_build_object(
      'success', true,
      'already_vip', true,
      'player_type', 'vip',
      'vip_status', 'active',
      'vip_activated_at', v_profile.vip_activated_at,
      'vip_paid_amount', v_profile.vip_paid_amount,
      'vip_payment_reference', v_profile.vip_payment_reference,
      'message', 'Your VIP Membership is already active.'
    );
  END IF;

  v_ref_id := COALESCE(
    NULLIF(trim(COALESCE(p_idempotency_key, '')), ''),
    'vip-upgrade-' || v_uid::text
  );

  -- Idempotency check if ledger payment already recorded for this key
  IF EXISTS (SELECT 1 FROM public.wallet_ledger WHERE reference_id = v_ref_id) THEN
    RETURN jsonb_build_object(
      'success', true,
      'already_vip', true,
      'player_type', v_profile.player_type,
      'vip_status', v_profile.vip_status,
      'vip_payment_reference', v_ref_id
    );
  END IF;

  -- Authoritative Server-Side VIP Membership Price
  SELECT value INTO v_global_cfg FROM public.platform_settings WHERE key = 'global';
  v_vip_price := ROUND(COALESCE(NULLIF(trim(COALESCE(v_global_cfg->>'vipMembershipPrice', '')), '')::numeric, 25.0), 2);
  IF v_vip_price <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'VIP Membership pricing is currently unavailable.');
  END IF;

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
      'required_amount', v_vip_price,
      'available_balance', v_prev_balance,
      'error', 'Insufficient wallet balance (' || to_char(v_prev_balance, 'FM999999990.00') || ' USDT). VIP Membership costs ' || to_char(v_vip_price, 'FM999999990.00') || ' USDT. Please add funds before upgrading.'
    );
  END IF;

  v_new_balance := ROUND(v_prev_balance - v_vip_price, 2);

  UPDATE public.lottery_wallets
  SET balance = v_new_balance,
      updated_at = v_now
  WHERE address = v_wallet.address;

  v_tx_id := 'tx_' || to_char(v_now, 'YYYYMMDDHH24MISS') || '_' || substr(md5(v_ref_id || random()::text), 1, 8);
  v_log_id := 'viplog_' || to_char(v_now, 'YYYYMMDDHH24MISS') || '_' || substr(md5(v_uid::text || random()::text), 1, 8);

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
    'VIP Membership Upgrade (' || to_char(v_vip_price, 'FM999999990.00') || ' USDT)',
    jsonb_build_object(
      'membership_tier', 'vip',
      'paid_amount', v_vip_price,
      'payment_reference', v_ref_id,
      'currency', 'USDT',
      'activated_at', v_now
    ),
    v_now
  );

  INSERT INTO public.vip_membership_logs (
    id, user_id, action_type, previous_player_type, new_player_type,
    paid_amount, payment_reference, ledger_tx_id, reason, created_at
  ) VALUES (
    v_log_id,
    v_uid,
    'purchased',
    COALESCE(v_profile.player_type, 'normal'),
    'vip',
    v_vip_price,
    v_ref_id,
    v_tx_id,
    'User purchased lifetime VIP Membership',
    v_now
  );

  UPDATE public.profiles
  SET player_type = 'vip',
      vip_status = 'active',
      vip_activated_at = v_now,
      vip_paid_amount = v_vip_price,
      vip_payment_reference = v_ref_id,
      vip_source = 'purchased',
      vip_granted_by = NULL,
      updated_at = v_now
  WHERE id = v_uid;

  RETURN jsonb_build_object(
    'success', true,
    'already_vip', false,
    'player_type', 'vip',
    'vip_status', 'active',
    'vip_activated_at', v_now,
    'vip_paid_amount', v_vip_price,
    'vip_payment_reference', v_ref_id,
    'vip_source', 'purchased',
    'new_balance', v_new_balance,
    'transaction_id', v_tx_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.purchase_vip_membership_secure(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.purchase_vip_membership_secure(text) TO authenticated;

-- 10. Enforce Normal vs VIP Event Access in verify_room_entry_secure()
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
  v_prof record;
  v_event record;
  v_expires_at bigint;
  v_evt_cat text;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'unauthenticated',
      'message', 'Please log in to enter a lottery room.',
      'server_now_ms', v_now_ms
    );
  END IF;

  SELECT status, COALESCE(player_type, 'normal') AS player_type, COALESCE(vip_status, 'inactive') AS vip_status
  INTO v_prof
  FROM public.profiles
  WHERE id = v_uid;

  IF lower(COALESCE(v_prof.status, 'active')) IN ('suspended', 'banned', 'blocked') THEN
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

  IF (v_event.status IN ('scheduled', 'draft') AND v_event.published_at IS NULL) THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'upcoming',
      'event_id', v_event.id,
      'room_id', v_event.room_id,
      'message', 'This event has not been published yet.',
      'server_now_ms', v_now_ms
    );
  END IF;

  IF lower(COALESCE(v_event.status, '')) IN ('completed', 'ended', 'settled', 'result_pending', 'expired')
     OR v_event.finalized_at IS NOT NULL
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
      'starts_at', v_event.start_time,
      'message', 'This lottery event has not started yet.',
      'server_now_ms', v_now_ms
    );
  END IF;

  IF v_expires_at > 0 AND v_now_ms >= v_expires_at THEN
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

  -- STRICT VIP EVENT ACCESS CONTROL
  v_evt_cat := lower(trim(COALESCE(v_event.event_category, 'normal')));
  IF v_evt_cat = 'vip' AND NOT (COALESCE(v_prof.player_type, 'normal') = 'vip' AND COALESCE(v_prof.vip_status, 'inactive') = 'active') THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'vip_required',
      'vip_required', true,
      'event_category', 'vip',
      'event_id', v_event.id,
      'room_id', v_event.room_id,
      'message', 'VIP Membership is required to enter this VIP Event. Please upgrade from Normal Player to VIP Player.',
      'server_now_ms', v_now_ms
    );
  END IF;

  RETURN jsonb_build_object(
    'allowed', true,
    'reason', 'active',
    'event_id', v_event.id,
    'room_id', v_event.room_id,
    'event_category', v_evt_cat,
    'expires_at', v_expires_at,
    'server_now_ms', v_now_ms
  );
END;
$$;

-- 11. Re-enforce VIP restriction inside buy_lottery_tickets_secure() by patching check cleanly
DO $$
DECLARE
  v_def text;
BEGIN
  SELECT pg_get_functiondef(p.oid)
  INTO v_def
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'buy_lottery_tickets_secure';

  IF v_def IS NOT NULL AND position('vip_required' in v_def) = 0 THEN
    v_def := replace(
      v_def,
      '  IF v_event.status <> ''active'' THEN',
      '  IF lower(COALESCE(v_event.event_category, ''normal'')) = ''vip'' AND NOT EXISTS (
    SELECT 1 FROM public.profiles pr
    WHERE pr.id = v_uid AND COALESCE(pr.player_type, ''normal'') = ''vip'' AND COALESCE(pr.vip_status, ''inactive'') = ''active''
  ) THEN
    RETURN jsonb_build_object(''success'', false, ''vip_required'', true, ''error'', ''VIP Membership is required to purchase tickets for VIP Events. Upgrade to VIP Player first.'');
  END IF;

  IF v_event.status <> ''active'' THEN'
    );
    EXECUTE v_def;
  END IF;
END $$;

-- 12. Patch finalize_lottery_draw_secure() to:
--     a) Read configured result display duration from platform_settings ('results_retention' / 'global', default 1h)
--     b) Set BOTH finalized_at / ticket_visibility_until AND result_published_at / result_visible_until cleanly
DO $$
DECLARE
  v_def text;
BEGIN
  SELECT pg_get_functiondef(p.oid)
  INTO v_def
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'finalize_lottery_draw_secure';

  IF v_def IS NOT NULL AND position('result_visible_until' in v_def) = 0 THEN
    v_def := replace(
      v_def,
      '  v_finalized_at := clock_timestamp();
  v_visibility_until := v_finalized_at + interval ''1 hour'';',
      '  v_finalized_at := clock_timestamp();
  v_visibility_until := v_finalized_at + (
    COALESCE(
      (SELECT NULLIF(trim(COALESCE(value->>''duration_hours'', value->>''retention_duration_hours'', '''')), '''')::numeric FROM public.platform_settings WHERE key = ''results_retention''),
      (SELECT NULLIF(trim(COALESCE(value->>''resultsRetentionHours'', '''')), '''')::numeric FROM public.platform_settings WHERE key = ''global''),
      1.0
    ) * interval ''1 hour''
  );'
    );
    v_def := replace(
      v_def,
      '      finalized_at = v_finalized_at,
      ticket_visibility_until = v_visibility_until',
      '      finalized_at = v_finalized_at,
      ticket_visibility_until = v_visibility_until,
      result_published_at = v_finalized_at,
      result_visible_until = v_visibility_until'
    );
    EXECUTE v_def;
  END IF;
END $$;
