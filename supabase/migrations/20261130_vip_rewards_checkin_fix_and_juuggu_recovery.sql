-- ============================================================================
-- EARNFLOW.IN: UNIFIED VIP REWARDS (SPIN WHEEL, 7-DAY CHECK-IN, PROMOTIONS),
--              WALLET ADJUSTMENT AUDIT CLEANUP, DAILY CHECK-IN IST PROGRESSION FIX,
--              & JUUGGU / PROCESSING DIAGNOSTICS + SAFE RECOVERY
-- ============================================================================

-- 1. Helper: Server-authoritative VIP category check & non-compounding reward resolution
CREATE OR REPLACE FUNCTION public._is_user_vip(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = p_user_id
      AND lower(COALESCE(player_type, 'normal')) = 'vip'
      AND lower(COALESCE(vip_status, 'inactive')) = 'active'
  );
$$;

REVOKE ALL ON FUNCTION public._is_user_vip(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public._is_user_vip(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public._resolve_vip_reward_amount(
  p_is_vip boolean,
  p_normal_amt numeric,
  p_custom_vip_amt numeric,
  p_vip_mode text DEFAULT 'double_normal'
)
RETURNS numeric
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_norm numeric := GREATEST(0, COALESCE(p_normal_amt, 0));
  v_mode text := lower(trim(COALESCE(p_vip_mode, 'double_normal')));
BEGIN
  IF NOT COALESCE(p_is_vip, false) THEN
    RETURN ROUND(v_norm, 2);
  END IF;

  -- Strictly apply EITHER custom VIP amount OR exact 2x Normal reward (never both)
  IF v_mode = 'custom' THEN
    RETURN ROUND(GREATEST(0, COALESCE(p_custom_vip_amt, v_norm * 2.0)), 2);
  END IF;

  RETURN ROUND(v_norm * 2.0, 2);
END;
$$;

-- 2. Initialize unified VIP reward configuration keys safely in platform_settings
-- 2A. Spin Wheel Settings (strip require_kyc, add enabled_for_normal, enabled_for_vip, vip_reward_mode, segment vip_usdt_amount)
DO $$
DECLARE
  v_sw jsonb;
  v_global jsonb;
  v_segs jsonb;
  v_new_segs jsonb := '[]'::jsonb;
  v_seg jsonb;
  v_amt numeric;
  v_vip_amt numeric;
  i integer;
BEGIN
  SELECT value INTO v_sw FROM public.platform_settings WHERE key = 'spin_wheel_settings';
  SELECT value INTO v_global FROM public.platform_settings WHERE key = 'global';
  v_sw := COALESCE(v_sw, v_global->'spinWheelSettings', '{}'::jsonb) - 'require_kyc';
  v_segs := COALESCE(v_sw->'segments', '[]'::jsonb);

  IF jsonb_typeof(v_segs) = 'array' THEN
    FOR i IN 0..(jsonb_array_length(v_segs) - 1) LOOP
      v_seg := v_segs->i;
      v_amt := ROUND(GREATEST(0.01, COALESCE(NULLIF(v_seg->>'usdt_amount', '')::numeric, NULLIF(v_seg->>'amount', '')::numeric, 0.10)), 2);
      v_vip_amt := ROUND(GREATEST(0.01, COALESCE(NULLIF(v_seg->>'vip_usdt_amount', '')::numeric, NULLIF(v_seg->>'vip_amount', '')::numeric, v_amt * 2.0)), 2);
      v_seg := v_seg
        || jsonb_build_object(
          'usdt_amount', v_amt,
          'amount', v_amt,
          'vip_usdt_amount', v_vip_amt,
          'vip_amount', v_vip_amt
        );
      v_new_segs := v_new_segs || jsonb_build_array(v_seg);
    END LOOP;
  END IF;

  v_sw := v_sw || jsonb_build_object(
    'enabled_for_normal', COALESCE((v_sw->>'enabled_for_normal')::boolean, true),
    'enabled_for_vip', COALESCE((v_sw->>'enabled_for_vip')::boolean, true),
    'vip_reward_mode', CASE WHEN lower(COALESCE(v_sw->>'vip_reward_mode', 'double_normal')) = 'custom' THEN 'custom' ELSE 'double_normal' END,
    'segments', v_new_segs
  );

  INSERT INTO public.platform_settings (key, value, updated_at)
  VALUES ('spin_wheel_settings', v_sw, now())
  ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now();

  IF v_global IS NOT NULL THEN
    v_global := jsonb_set(v_global, '{spinWheelSettings}', v_sw, true);
    UPDATE public.platform_settings SET value = v_global, updated_at = now() WHERE key = 'global';
  END IF;
END $$;

-- 2B. Seven-Day Check-In Settings (normal + VIP enable switches, vip_reward_mode, vip_streak_rewards, timezone: Asia/Kolkata)
DO $$
DECLARE
  v_dc jsonb;
  v_norm jsonb;
  v_vip jsonb;
BEGIN
  SELECT value INTO v_dc FROM public.platform_settings WHERE key = 'daily_checkin';
  v_dc := COALESCE(v_dc, '{}'::jsonb);
  v_norm := COALESCE(v_dc->'streak_rewards', jsonb_build_object(
    'day1', 0.10, 'day2', 0.15, 'day3', 0.20,
    'day4', 0.25, 'day5', 0.30, 'day6', 0.40, 'day7', 1.00
  ));
  v_vip := COALESCE(v_dc->'vip_streak_rewards', jsonb_build_object(
    'day1', ROUND(COALESCE((v_norm->>'day1')::numeric, 0.10) * 2, 2),
    'day2', ROUND(COALESCE((v_norm->>'day2')::numeric, 0.15) * 2, 2),
    'day3', ROUND(COALESCE((v_norm->>'day3')::numeric, 0.20) * 2, 2),
    'day4', ROUND(COALESCE((v_norm->>'day4')::numeric, 0.25) * 2, 2),
    'day5', ROUND(COALESCE((v_norm->>'day5')::numeric, 0.30) * 2, 2),
    'day6', ROUND(COALESCE((v_norm->>'day6')::numeric, 0.40) * 2, 2),
    'day7', ROUND(COALESCE((v_norm->>'day7')::numeric, 1.00) * 2, 2)
  ));

  v_dc := v_dc || jsonb_build_object(
    'enabled', COALESCE((v_dc->>'enabled')::boolean, true),
    'enabled_for_normal', COALESCE((v_dc->>'enabled_for_normal')::boolean, true),
    'enabled_for_vip', COALESCE((v_dc->>'enabled_for_vip')::boolean, true),
    'vip_reward_mode', CASE WHEN lower(COALESCE(v_dc->>'vip_reward_mode', 'double_normal')) = 'custom' THEN 'custom' ELSE 'double_normal' END,
    'missed_day_policy', CASE WHEN lower(COALESCE(v_dc->>'missed_day_policy', 'reset')) = 'continue' THEN 'continue' ELSE 'reset' END,
    'timezone', 'Asia/Kolkata',
    'streak_rewards', v_norm,
    'vip_streak_rewards', v_vip
  );

  INSERT INTO public.platform_settings (key, value, updated_at)
  VALUES ('daily_checkin', v_dc, now())
  ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now();
END $$;

-- 2C. Promotional / Referral Settings (normal_enabled, vip_enabled, vip_reward_mode, custom VIP values)
DO $$
DECLARE
  v_ref jsonb;
  v_global jsonb;
BEGIN
  SELECT value INTO v_ref FROM public.platform_settings WHERE key = 'referral_settings';
  SELECT value INTO v_global FROM public.platform_settings WHERE key = 'global';
  v_ref := COALESCE(v_ref, v_global->'referralSettings', '{}'::jsonb);

  v_ref := v_ref || jsonb_build_object(
    'normal_enabled', COALESCE((v_ref->>'normal_enabled')::boolean, true),
    'vip_enabled', COALESCE((v_ref->>'vip_enabled')::boolean, true),
    'vip_reward_mode', CASE WHEN lower(COALESCE(v_ref->>'vip_reward_mode', 'double_normal')) = 'custom' THEN 'custom' ELSE 'double_normal' END,
    'vip_registration_reward_amount', ROUND(GREATEST(0, COALESCE((v_ref->>'vip_registration_reward_amount')::numeric, COALESCE((v_ref->>'registration_reward_amount')::numeric, 0) * 2)), 2),
    'vip_first_deposit_reward_percent', ROUND(GREATEST(0, COALESCE((v_ref->>'vip_first_deposit_reward_percent')::numeric, COALESCE((v_ref->>'first_deposit_reward_percent')::numeric, 0) * 2)), 2),
    'vip_lifetime_commission_percent', ROUND(GREATEST(0, COALESCE((v_ref->>'vip_lifetime_commission_percent')::numeric, COALESCE((v_ref->>'lifetime_commission_percent')::numeric, 0) * 2)), 2)
  );

  INSERT INTO public.platform_settings (key, value, updated_at)
  VALUES ('referral_settings', v_ref, now())
  ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now();

  IF v_global IS NOT NULL THEN
    v_global := jsonb_set(v_global, '{referralSettings}', v_ref, true);
    UPDATE public.platform_settings SET value = v_global, updated_at = now() WHERE key = 'global';
  END IF;
END $$;

-- 3. Update admin_adjust_user_wallet_secure: remove required Admin Note input; retain full internal audit
DROP FUNCTION IF EXISTS public.admin_adjust_user_wallet_secure(uuid, text, numeric, text, text);
CREATE OR REPLACE FUNCTION public.admin_adjust_user_wallet_secure(
  p_target_user_id uuid,
  p_action text,
  p_amount numeric,
  p_reason text DEFAULT 'admin_balance_adjustment',
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
  v_clean_reason text := COALESCE(NULLIF(trim(COALESCE(p_reason, '')), ''), 'admin_balance_adjustment');
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
  v_now timestamptz := clock_timestamp();
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

  PERFORM pg_advisory_xact_lock(hashtext('adm_wallet_adj_' || p_target_user_id::text));

  v_ref_id := COALESCE(
    NULLIF(trim(COALESCE(p_idempotency_key, '')), ''),
    'adm-adj-' || p_target_user_id::text || '-' || (EXTRACT(EPOCH FROM v_now) * 1000)::bigint::text || '-' || substr(md5(random()::text), 1, 6)
  );

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
    VALUES (p_target_user_id, v_target_addr, 0, 0, 'TRC-20', v_now)
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
      updated_at = v_now
  WHERE address = v_wallet.address;

  SELECT email INTO v_admin_email FROM public.profiles WHERE id = v_admin_id;
  v_tx_id := 'tx_' || to_char(v_now, 'YYYYMMDDHH24MISS') || '_' || substr(md5(v_ref_id || random()::text), 1, 8);

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
    v_clean_reason,
    jsonb_build_object(
      'user_id', p_target_user_id,
      'admin_id', v_admin_id,
      'admin_email', v_admin_email,
      'adjustment_type', v_norm_action,
      'amount', v_amount,
      'previous_balance', v_prev_balance,
      'new_balance', v_new_balance,
      'reference_id', v_ref_id,
      'timestamp', v_now
    ),
    v_now
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
      'admin_id', v_admin_id,
      'adjustment_type', v_norm_action,
      'amount', v_amount,
      'previous_balance', v_prev_balance,
      'new_balance', v_new_balance,
      'description', v_clean_reason,
      'reference_id', v_ref_id,
      'transaction_id', v_tx_id,
      'timestamp', v_now
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

-- 4. Upgrade spin_lucky_wheel() to enforce Normal/VIP access + Double Normal vs Custom VIP reward
CREATE OR REPLACE FUNCTION public.spin_lucky_wheel(
  p_user_address text,
  p_user_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth', 'extensions', 'pg_temp'
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_is_vip boolean := false;
  v_addr text;
  v_last_spin timestamptz;
  v_now timestamptz := clock_timestamp();
  v_wheel_settings jsonb;
  v_global_settings jsonb;
  v_enabled boolean := true;
  v_enabled_normal boolean := true;
  v_enabled_vip boolean := true;
  v_vip_mode text := 'double_normal';
  v_min_dep numeric := 0;
  v_user_dep numeric := 0;
  v_cooldown integer := 86400;
  v_elapsed integer;
  v_rand numeric;
  v_slice_index integer := 0;
  v_normal_prize numeric := 0.10;
  v_custom_vip_prize numeric;
  v_final_prize numeric := 0.10;
  v_spin_ref text;
  v_credit_res jsonb;
  v_segments jsonb;
  v_seg record;
  v_cum_prob numeric := 0;
  v_found boolean := false;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Authentication required to spin the Lucky Wheel.');
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('spin_wheel:' || v_uid::text));

  v_is_vip := public._is_user_vip(v_uid);

  SELECT address INTO v_addr
  FROM public.lottery_wallets
  WHERE user_id = v_uid
  ORDER BY updated_at DESC NULLS LAST
  LIMIT 1;

  IF v_addr IS NULL THEN
    v_addr := NULLIF(trim(COALESCE(p_user_address, '')), '');
  END IF;

  IF v_addr IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Wallet address is required.');
  END IF;

  SELECT value INTO v_wheel_settings FROM public.platform_settings WHERE key = 'spin_wheel_settings';
  IF v_wheel_settings IS NULL THEN
    SELECT value->'spinWheelSettings' INTO v_global_settings FROM public.platform_settings WHERE key = 'global';
    v_wheel_settings := v_global_settings;
  END IF;

  IF v_wheel_settings IS NOT NULL THEN
    v_enabled := COALESCE((v_wheel_settings->>'enabled')::boolean, (v_wheel_settings->>'is_active')::boolean, true);
    v_enabled_normal := COALESCE((v_wheel_settings->>'enabled_for_normal')::boolean, true);
    v_enabled_vip := COALESCE((v_wheel_settings->>'enabled_for_vip')::boolean, true);
    v_vip_mode := CASE WHEN lower(COALESCE(v_wheel_settings->>'vip_reward_mode', 'double_normal')) = 'custom' THEN 'custom' ELSE 'double_normal' END;
    v_min_dep := GREATEST(0, COALESCE((v_wheel_settings->>'min_deposit_required')::numeric, 0));
    v_cooldown := GREATEST(60, COALESCE((v_wheel_settings->>'cooldown_hours')::integer * 3600, 86400));
    v_segments := v_wheel_settings->'segments';
  END IF;

  IF NOT v_enabled THEN
    RETURN jsonb_build_object('success', false, 'error', 'Lucky Spin Wheel is currently disabled.');
  END IF;

  IF v_is_vip AND NOT v_enabled_vip THEN
    RETURN jsonb_build_object('success', false, 'error', 'Lucky Spin Wheel is currently disabled for VIP Players.');
  END IF;

  IF (NOT v_is_vip) AND NOT v_enabled_normal THEN
    RETURN jsonb_build_object('success', false, 'error', 'Lucky Spin Wheel is currently disabled for Normal Players. Upgrade to VIP to participate!');
  END IF;

  IF v_min_dep > 0 THEN
    SELECT COALESCE(SUM(COALESCE(paid_amount, price_amount, 0)), 0) INTO v_user_dep
    FROM public.lottery_deposits
    WHERE user_id = v_uid AND lower(COALESCE(status, '')) IN ('finished', 'confirmed');
    IF v_user_dep < v_min_dep THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'Minimum confirmed deposit of ' || to_char(v_min_dep, 'FM999999990.00') || ' USDT is required to spin the Lucky Wheel.'
      );
    END IF;
  END IF;

  SELECT last_wheel_spin_at INTO v_last_spin
  FROM public.user_vip_progress
  WHERE user_id = v_uid OR wallet_address = v_addr
  ORDER BY (user_id = v_uid) DESC NULLS LAST, last_wheel_spin_at DESC NULLS LAST
  LIMIT 1;

  IF v_last_spin IS NULL THEN
    SELECT created_at INTO v_last_spin
    FROM public.wallet_ledger
    WHERE (user_id = v_uid OR wallet_address = v_addr)
      AND transaction_type = 'lucky_wheel_spin'
    ORDER BY created_at DESC LIMIT 1;
  END IF;

  IF v_last_spin IS NOT NULL THEN
    v_elapsed := EXTRACT(EPOCH FROM (v_now - v_last_spin))::integer;
    IF v_elapsed < v_cooldown THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'Lucky Wheel on cooldown. Return in ' || ((v_cooldown - v_elapsed) / 3600) || ' hour(s).',
        'seconds_remaining', (v_cooldown - v_elapsed)
      );
    END IF;
  END IF;

  v_rand := random() * 100.0;

  IF v_segments IS NOT NULL AND jsonb_typeof(v_segments) = 'array' AND jsonb_array_length(v_segments) > 0 THEN
    FOR v_seg IN
      SELECT
        COALESCE((s->>'index')::integer, ord::integer - 1) AS idx,
        COALESCE(NULLIF(s->>'usdt_amount', '')::numeric, NULLIF(s->>'amount', '')::numeric, 0.10) AS norm_amt,
        COALESCE(NULLIF(s->>'vip_usdt_amount', '')::numeric, NULLIF(s->>'vip_amount', '')::numeric) AS vip_amt,
        COALESCE(NULLIF(s->>'probability_percent', '')::numeric, NULLIF(s->>'probability', '')::numeric, 12.5) AS prob
      FROM jsonb_array_elements(v_segments) WITH ORDINALITY AS t(s, ord)
    LOOP
      v_cum_prob := v_cum_prob + v_seg.prob;
      IF v_rand <= v_cum_prob AND NOT v_found THEN
        v_slice_index := v_seg.idx;
        v_normal_prize := ROUND(GREATEST(0.01, v_seg.norm_amt), 2);
        v_custom_vip_prize := CASE WHEN v_seg.vip_amt IS NOT NULL THEN ROUND(GREATEST(0.01, v_seg.vip_amt), 2) ELSE NULL END;
        v_found := true;
      END IF;
    END LOOP;
  END IF;

  IF NOT v_found THEN
    v_slice_index := 0;
    v_normal_prize := 0.10;
    v_custom_vip_prize := 0.20;
  END IF;

  v_final_prize := public._resolve_vip_reward_amount(v_is_vip, v_normal_prize, v_custom_vip_prize, v_vip_mode);
  v_spin_ref := 'wheel-' || to_char((v_now AT TIME ZONE 'Asia/Kolkata')::date, 'YYYY-MM-DD') || '-' || v_uid::text;

  v_credit_res := public._internal_credit_virtual_credits(
    v_final_prize,
    'lucky_wheel_spin',
    v_spin_ref,
    CASE WHEN v_is_vip
      THEN 'Daily Lucky Wheel Prize (VIP): ' || to_char(v_final_prize, 'FM999999990.00') || ' USDT'
      ELSE 'Daily Lucky Wheel Prize: ' || to_char(v_final_prize, 'FM999999990.00') || ' USDT'
    END,
    v_addr,
    v_uid,
    jsonb_build_object(
      'slice', v_slice_index,
      'amount', v_final_prize,
      'normal_amount', v_normal_prize,
      'player_category', CASE WHEN v_is_vip THEN 'vip' ELSE 'normal' END,
      'vip_reward_mode', v_vip_mode,
      'currency', 'USDT'
    )
  );

  IF COALESCE((v_credit_res->>'already_processed')::boolean, false) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Lucky Wheel already spun for today.',
      'seconds_remaining', v_cooldown
    );
  END IF;

  INSERT INTO public.user_vip_progress (wallet_address, user_id, last_wheel_spin_at, updated_at)
  VALUES (v_addr, v_uid, v_now, v_now)
  ON CONFLICT (wallet_address) DO UPDATE SET
    user_id = COALESCE(EXCLUDED.user_id, public.user_vip_progress.user_id),
    last_wheel_spin_at = v_now,
    updated_at = v_now;

  RETURN jsonb_build_object(
    'success', true,
    'slice_index', v_slice_index,
    'normal_prize', v_normal_prize,
    'final_prize', v_final_prize,
    'player_category', CASE WHEN v_is_vip THEN 'vip' ELSE 'normal' END,
    'vip_reward_mode', v_vip_mode,
    'currency', 'USDT',
    'new_balance', (v_credit_res->>'new_balance')::numeric,
    'message', 'Congratulations! You won ' || to_char(v_final_prize, 'FM999999990.00') || ' USDT!'
  );
END;
$$;

-- 5. Fix Seven-Day Daily Check-In Progression & Add VIP Check-In Rewards
CREATE OR REPLACE FUNCTION public.get_daily_reward_status(
  p_user_address text DEFAULT NULL,
  p_user_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'auth', 'pg_temp'
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_is_vip boolean := false;
  v_addr text;
  v_bonus_settings jsonb;
  v_checkin_settings jsonb;
  v_last_ledger_claim timestamptz;
  v_last_claim timestamptz;
  v_last_date date;
  v_cooldown_hours integer := 24;
  v_cooldown_seconds integer := 86400;
  v_seconds_since integer;
  v_can_claim boolean := true;
  v_seconds_remaining integer := 0;
  v_streak record;
  v_display_streak integer := 1;
  v_upcoming_day integer := 1;
  v_next_streak integer := 2;
  v_highest_streak integer := 0;
  v_available_reward numeric := 0.10;
  v_next_reward numeric := 0.15;
  v_now timestamptz := clock_timestamp();
  v_today date := (clock_timestamp() AT TIME ZONE 'Asia/Kolkata')::date;
  v_next_day_start timestamptz := (((clock_timestamp() AT TIME ZONE 'Asia/Kolkata')::date + 1)::timestamp AT TIME ZONE 'Asia/Kolkata');
  v_mode text := 'streak';
  v_missed_policy text := 'reset';
  v_enabled boolean := true;
  v_checkin_enabled boolean := true;
  v_enabled_normal boolean := true;
  v_enabled_vip boolean := true;
  v_vip_mode text := 'double_normal';
  v_streak_map jsonb;
  v_vip_streak_map jsonb;
  v_effective_map jsonb := '{}'::jsonb;
  v_d integer;
  v_d_norm numeric;
  v_d_vip numeric;
  v_elig_error text := NULL;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Authentication required.');
  END IF;

  v_is_vip := public._is_user_vip(v_uid);

  SELECT address INTO v_addr
  FROM public.lottery_wallets
  WHERE user_id = v_uid
  ORDER BY updated_at DESC NULLS LAST
  LIMIT 1;

  IF v_addr IS NULL THEN
    v_addr := NULLIF(trim(COALESCE(p_user_address, '')), '');
  END IF;

  SELECT value INTO v_bonus_settings FROM public.platform_settings WHERE key = 'bonus_rewards';
  SELECT value INTO v_checkin_settings FROM public.platform_settings WHERE key = 'daily_checkin';

  IF v_bonus_settings IS NOT NULL THEN
    v_enabled := COALESCE((v_bonus_settings->>'enabled')::boolean, true);
    v_cooldown_hours := GREATEST(1, COALESCE((v_bonus_settings->>'cooldown_hours')::integer, 24));
    v_cooldown_seconds := v_cooldown_hours * 3600;
    v_mode := COALESCE(v_bonus_settings->>'reward_mode', 'streak');
  END IF;

  IF v_checkin_settings IS NOT NULL THEN
    v_checkin_enabled := COALESCE((v_checkin_settings->>'enabled')::boolean, true);
    v_enabled_normal := COALESCE((v_checkin_settings->>'enabled_for_normal')::boolean, true);
    v_enabled_vip := COALESCE((v_checkin_settings->>'enabled_for_vip')::boolean, true);
    v_vip_mode := CASE WHEN lower(COALESCE(v_checkin_settings->>'vip_reward_mode', 'double_normal')) = 'custom' THEN 'custom' ELSE 'double_normal' END;
    v_streak_map := v_checkin_settings->'streak_rewards';
    v_vip_streak_map := v_checkin_settings->'vip_streak_rewards';
    v_missed_policy := COALESCE(v_checkin_settings->>'missed_day_policy', 'reset');
  END IF;

  IF v_streak_map IS NULL THEN
    v_streak_map := jsonb_build_object(
      'day1', 0.10, 'day2', 0.15, 'day3', 0.20,
      'day4', 0.25, 'day5', 0.30, 'day6', 0.40, 'day7', 1.00
    );
  END IF;

  IF NOT v_enabled OR NOT v_checkin_enabled THEN
    v_elig_error := 'Daily Check-In is currently paused by administrator.';
  ELSIF v_is_vip AND NOT v_enabled_vip THEN
    v_elig_error := 'Daily Check-In is currently paused for VIP Players.';
  ELSIF (NOT v_is_vip) AND NOT v_enabled_normal THEN
    v_elig_error := 'Daily Check-In is currently restricted to VIP Players.';
  END IF;

  -- Build authoritative day1..day7 map for this user's verified category (display always equals credit)
  FOR v_d IN 1..7 LOOP
    v_d_norm := COALESCE((v_streak_map->>('day' || v_d))::numeric, CASE v_d WHEN 7 THEN 1.00 ELSE 0.05 * (v_d + 1) END);
    v_d_vip := CASE WHEN v_vip_streak_map IS NOT NULL AND (v_vip_streak_map ? ('day' || v_d))
      THEN (v_vip_streak_map->>('day' || v_d))::numeric
      ELSE NULL
    END;
    v_effective_map := v_effective_map || jsonb_build_object(
      'day' || v_d,
      GREATEST(0.01, public._resolve_vip_reward_amount(v_is_vip, v_d_norm, v_d_vip, v_vip_mode))
    );
  END LOOP;

  -- Prioritize user_id match first to stay invariant across wallet changes or sessions
  SELECT * INTO v_streak
  FROM public.user_daily_streaks
  WHERE user_id = v_uid
     OR (user_id IS NULL AND v_addr IS NOT NULL AND wallet_address = v_addr)
  ORDER BY (user_id = v_uid) DESC NULLS LAST, last_claimed_at DESC NULLS LAST, updated_at DESC NULLS LAST
  LIMIT 1;

  SELECT created_at INTO v_last_ledger_claim
  FROM public.wallet_ledger
  WHERE (user_id = v_uid OR (user_id IS NULL AND v_addr IS NOT NULL AND wallet_address = v_addr))
    AND transaction_type IN ('daily_reward', 'daily_bonus')
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_streak IS NOT NULL AND v_streak.last_claimed_at IS NOT NULL AND v_last_ledger_claim IS NOT NULL THEN
    v_last_claim := GREATEST(v_streak.last_claimed_at, v_last_ledger_claim);
  ELSE
    v_last_claim := COALESCE(v_last_ledger_claim, v_streak.last_claimed_at);
  END IF;

  v_last_date := COALESCE(
    v_streak.last_checkin_date,
    CASE WHEN v_last_ledger_claim IS NOT NULL THEN (v_last_ledger_claim AT TIME ZONE 'Asia/Kolkata')::date ELSE NULL END
  );

  -- Standard daily check-in (cooldown_hours = 24): strictly one claim per Asia/Kolkata calendar date
  IF v_cooldown_hours = 24 THEN
    IF v_last_date IS NOT NULL AND v_last_date >= v_today THEN
      v_can_claim := false;
      v_seconds_remaining := GREATEST(1, EXTRACT(EPOCH FROM (v_next_day_start - v_now))::integer);
    ELSE
      v_can_claim := true;
      v_seconds_remaining := 0;
    END IF;
  ELSE
    IF v_last_claim IS NOT NULL THEN
      v_seconds_since := EXTRACT(EPOCH FROM (v_now - v_last_claim))::integer;
      IF v_seconds_since < v_cooldown_seconds THEN
        v_can_claim := false;
        v_seconds_remaining := GREATEST(1, v_cooldown_seconds - v_seconds_since);
      END IF;
    END IF;
  END IF;

  IF v_elig_error IS NOT NULL THEN
    v_can_claim := false;
  END IF;

  IF v_streak IS NOT NULL THEN
    v_highest_streak := GREATEST(COALESCE(v_streak.highest_streak, 0), COALESCE(v_streak.current_streak, 0));
    IF NOT v_can_claim AND v_last_date = v_today THEN
      v_display_streak := GREATEST(1, LEAST(7, COALESCE(v_streak.current_streak, 1)));
      v_upcoming_day := v_display_streak;
      v_next_streak := (v_display_streak % 7) + 1;
    ELSE
      IF v_last_date IS NULL THEN
        v_upcoming_day := 1;
      ELSIF v_last_date = (v_today - 1) OR (v_cooldown_hours < 24 AND v_last_date = v_today) THEN
        v_upcoming_day := (COALESCE(v_streak.current_streak, 0) % 7) + 1;
      ELSIF v_missed_policy = 'continue' THEN
        v_upcoming_day := (COALESCE(v_streak.current_streak, 0) % 7) + 1;
      ELSE
        v_upcoming_day := 1;
      END IF;
      v_display_streak := v_upcoming_day;
      v_next_streak := (v_upcoming_day % 7) + 1;
    END IF;
  ELSE
    v_highest_streak := 0;
    v_display_streak := 1;
    v_upcoming_day := 1;
    v_next_streak := 2;
  END IF;

  IF v_mode = 'fixed' THEN
    v_available_reward := public._resolve_vip_reward_amount(
      v_is_vip,
      COALESCE((v_bonus_settings->>'fixed_amount')::numeric, 0.50),
      NULL,
      v_vip_mode
    );
    v_next_reward := v_available_reward;
  ELSIF v_mode = 'random' THEN
    v_available_reward := public._resolve_vip_reward_amount(
      v_is_vip,
      ROUND((COALESCE((v_bonus_settings->>'min_amount')::numeric, 0.05) +
        ((COALESCE((v_bonus_settings->>'max_amount')::numeric, 1.00) - COALESCE((v_bonus_settings->>'min_amount')::numeric, 0.05)) * 0.4))::numeric, 2),
      NULL,
      v_vip_mode
    );
    v_next_reward := v_available_reward;
  ELSE
    v_available_reward := ROUND(COALESCE((v_effective_map->>('day' || v_upcoming_day))::numeric, 0.10), 2);
    v_next_reward := ROUND(COALESCE((v_effective_map->>('day' || v_next_streak))::numeric, 0.15), 2);
  END IF;

  v_available_reward := LEAST(1000.00, GREATEST(0.01, v_available_reward));
  v_next_reward := LEAST(1000.00, GREATEST(0.01, v_next_reward));

  RETURN jsonb_build_object(
    'success', true,
    'can_claim', v_can_claim,
    'eligibility_error', v_elig_error,
    'seconds_remaining', v_seconds_remaining,
    'available_reward', v_available_reward,
    'current_streak', v_display_streak,
    'highest_streak', v_highest_streak,
    'next_streak', v_next_streak,
    'next_reward_amount', v_next_reward,
    'player_category', CASE WHEN v_is_vip THEN 'vip' ELSE 'normal' END,
    'vip_reward_mode', v_vip_mode,
    'effective_streak_rewards', v_effective_map,
    'timezone', 'Asia/Kolkata',
    'today_date', v_today,
    'last_checkin_date', v_last_date,
    'bonus_settings', v_bonus_settings,
    'checkin_settings', v_checkin_settings,
    'last_claimed_at', v_last_claim
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.claim_daily_bonus(
  p_user_address text DEFAULT NULL,
  p_user_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth', 'pg_temp'
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_is_vip boolean := false;
  v_addr text;
  v_bonus_settings jsonb;
  v_checkin_settings jsonb;
  v_enabled boolean := true;
  v_checkin_enabled boolean := true;
  v_enabled_normal boolean := true;
  v_enabled_vip boolean := true;
  v_vip_mode text := 'double_normal';
  v_mode text := 'streak';
  v_cooldown_hours integer := 24;
  v_cooldown_seconds integer := 86400;
  v_last_ledger_claim timestamptz;
  v_last_claim timestamptz;
  v_last_date date;
  v_seconds_since integer;
  v_now timestamptz := clock_timestamp();
  v_today date := (clock_timestamp() AT TIME ZONE 'Asia/Kolkata')::date;
  v_next_day_start timestamptz := (((clock_timestamp() AT TIME ZONE 'Asia/Kolkata')::date + 1)::timestamp AT TIME ZONE 'Asia/Kolkata');
  v_streak record;
  v_current_streak integer := 1;
  v_highest_streak integer := 1;
  v_normal_amt numeric := 0.10;
  v_custom_vip_amt numeric;
  v_reward_amount numeric := 0.10;
  v_credit_res jsonb;
  v_resolved_addr text;
  v_day_ref text;
  v_streak_map jsonb;
  v_vip_streak_map jsonb;
  v_missed_policy text := 'reset';
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Authentication required to claim daily bonus.');
  END IF;

  -- Transaction-scoped per-user advisory lock guarantees zero concurrent duplicate credits
  PERFORM pg_advisory_xact_lock(hashtext('daily_bonus:' || v_uid::text));

  v_is_vip := public._is_user_vip(v_uid);

  SELECT address INTO v_addr
  FROM public.lottery_wallets
  WHERE user_id = v_uid
  ORDER BY updated_at DESC NULLS LAST
  LIMIT 1
  FOR UPDATE;

  IF v_addr IS NULL THEN
    v_addr := NULLIF(trim(COALESCE(p_user_address, '')), '');
  END IF;

  SELECT value INTO v_bonus_settings FROM public.platform_settings WHERE key = 'bonus_rewards';
  SELECT value INTO v_checkin_settings FROM public.platform_settings WHERE key = 'daily_checkin';

  IF v_bonus_settings IS NOT NULL THEN
    v_enabled := COALESCE((v_bonus_settings->>'enabled')::boolean, true);
    v_mode := COALESCE(v_bonus_settings->>'reward_mode', 'streak');
    v_cooldown_hours := GREATEST(1, COALESCE((v_bonus_settings->>'cooldown_hours')::integer, 24));
    v_cooldown_seconds := v_cooldown_hours * 3600;
  END IF;

  IF v_checkin_settings IS NOT NULL THEN
    v_checkin_enabled := COALESCE((v_checkin_settings->>'enabled')::boolean, true);
    v_enabled_normal := COALESCE((v_checkin_settings->>'enabled_for_normal')::boolean, true);
    v_enabled_vip := COALESCE((v_checkin_settings->>'enabled_for_vip')::boolean, true);
    v_vip_mode := CASE WHEN lower(COALESCE(v_checkin_settings->>'vip_reward_mode', 'double_normal')) = 'custom' THEN 'custom' ELSE 'double_normal' END;
    v_streak_map := v_checkin_settings->'streak_rewards';
    v_vip_streak_map := v_checkin_settings->'vip_streak_rewards';
    v_missed_policy := COALESCE(v_checkin_settings->>'missed_day_policy', 'reset');
  END IF;

  IF NOT v_enabled OR NOT v_checkin_enabled THEN
    RETURN jsonb_build_object('success', false, 'error', 'Daily Check-In bonus is currently paused by administrator.');
  END IF;

  IF v_is_vip AND NOT v_enabled_vip THEN
    RETURN jsonb_build_object('success', false, 'error', 'Daily Check-In is currently disabled for VIP Players.');
  END IF;

  IF (NOT v_is_vip) AND NOT v_enabled_normal THEN
    RETURN jsonb_build_object('success', false, 'error', 'Daily Check-In is currently restricted to VIP Players.');
  END IF;

  IF v_streak_map IS NULL THEN
    v_streak_map := jsonb_build_object(
      'day1', 0.10, 'day2', 0.15, 'day3', 0.20,
      'day4', 0.25, 'day5', 0.30, 'day6', 0.40, 'day7', 1.00
    );
  END IF;

  SELECT * INTO v_streak
  FROM public.user_daily_streaks
  WHERE user_id = v_uid
     OR (user_id IS NULL AND v_addr IS NOT NULL AND wallet_address = v_addr)
  ORDER BY (user_id = v_uid) DESC NULLS LAST, last_claimed_at DESC NULLS LAST, updated_at DESC NULLS LAST
  LIMIT 1
  FOR UPDATE;

  SELECT created_at INTO v_last_ledger_claim
  FROM public.wallet_ledger
  WHERE (user_id = v_uid OR (user_id IS NULL AND v_addr IS NOT NULL AND wallet_address = v_addr))
    AND transaction_type IN ('daily_reward', 'daily_bonus')
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_streak IS NOT NULL AND v_streak.last_claimed_at IS NOT NULL AND v_last_ledger_claim IS NOT NULL THEN
    v_last_claim := GREATEST(v_streak.last_claimed_at, v_last_ledger_claim);
  ELSE
    v_last_claim := COALESCE(v_last_ledger_claim, v_streak.last_claimed_at);
  END IF;

  v_last_date := COALESCE(
    v_streak.last_checkin_date,
    CASE WHEN v_last_ledger_claim IS NOT NULL THEN (v_last_ledger_claim AT TIME ZONE 'Asia/Kolkata')::date ELSE NULL END
  );

  IF v_cooldown_hours = 24 THEN
    IF v_last_date IS NOT NULL AND v_last_date >= v_today THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'Daily bonus already claimed for today.',
        'seconds_remaining', GREATEST(1, EXTRACT(EPOCH FROM (v_next_day_start - v_now))::integer)
      );
    END IF;
  ELSE
    IF v_last_claim IS NOT NULL THEN
      v_seconds_since := EXTRACT(EPOCH FROM (v_now - v_last_claim))::integer;
      IF v_seconds_since < v_cooldown_seconds THEN
        RETURN jsonb_build_object(
          'success', false,
          'error', 'Daily bonus already claimed. Next claim available in ' || ((v_cooldown_seconds - v_seconds_since) / 3600) || 'h ' || (((v_cooldown_seconds - v_seconds_since) % 3600) / 60) || 'm.',
          'seconds_remaining', GREATEST(1, v_cooldown_seconds - v_seconds_since)
        );
      END IF;
    END IF;
  END IF;

  -- Server-authoritative progression Day 1 -> 2 -> 3 -> 4 -> 5 -> 6 -> 7 -> 1
  IF v_streak IS NULL OR v_last_date IS NULL THEN
    v_current_streak := 1;
  ELSIF v_last_date = (v_today - 1) OR (v_cooldown_hours < 24 AND v_last_date = v_today) THEN
    v_current_streak := (COALESCE(v_streak.current_streak, 0) % 7) + 1;
  ELSIF v_missed_policy = 'continue' THEN
    v_current_streak := (COALESCE(v_streak.current_streak, 0) % 7) + 1;
  ELSE
    v_current_streak := 1;
  END IF;

  v_highest_streak := GREATEST(COALESCE(v_streak.highest_streak, 0), v_current_streak);

  IF v_mode = 'fixed' THEN
    v_normal_amt := COALESCE((v_bonus_settings->>'fixed_amount')::numeric, 0.50);
    v_custom_vip_amt := NULL;
    v_reward_amount := public._resolve_vip_reward_amount(v_is_vip, v_normal_amt, v_custom_vip_amt, v_vip_mode);
  ELSIF v_mode = 'random' THEN
    v_normal_amt := ROUND((
      COALESCE((v_bonus_settings->>'min_amount')::numeric, 0.05) +
      (random() * (COALESCE((v_bonus_settings->>'max_amount')::numeric, 1.00) - COALESCE((v_bonus_settings->>'min_amount')::numeric, 0.05)))
    )::numeric, 2);
    v_custom_vip_amt := NULL;
    v_reward_amount := public._resolve_vip_reward_amount(v_is_vip, v_normal_amt, v_custom_vip_amt, v_vip_mode);
  ELSE
    v_normal_amt := COALESCE((v_streak_map->>('day' || v_current_streak))::numeric, 0.10);
    v_custom_vip_amt := CASE WHEN v_vip_streak_map IS NOT NULL AND (v_vip_streak_map ? ('day' || v_current_streak))
      THEN (v_vip_streak_map->>('day' || v_current_streak))::numeric
      ELSE NULL
    END;
    v_reward_amount := public._resolve_vip_reward_amount(v_is_vip, v_normal_amt, v_custom_vip_amt, v_vip_mode);
  END IF;

  v_reward_amount := LEAST(1000.00, GREATEST(0.01, ROUND(v_reward_amount, 2)));

  IF v_cooldown_hours >= 24 THEN
    v_day_ref := 'daily-bonus-' || to_char(v_today, 'YYYY-MM-DD') || '-' || v_uid::text;
  ELSE
    v_day_ref := 'daily-bonus-' || floor(EXTRACT(EPOCH FROM v_now) / GREATEST(v_cooldown_seconds, 60))::bigint::text || '-' || v_uid::text;
  END IF;

  v_credit_res := public._internal_credit_virtual_credits(
    v_reward_amount,
    'daily_bonus',
    v_day_ref,
    'Daily Streak Bonus — Day ' || v_current_streak || CASE WHEN v_is_vip THEN ' VIP' ELSE '' END || ' Check-In (' || to_char(v_reward_amount, 'FM999999990.00') || ' USDT)',
    v_addr,
    v_uid,
    jsonb_build_object(
      'source', 'daily_bonus_streak',
      'checkin_day', v_current_streak,
      'checkin_date_ist', v_today,
      'highest_streak', v_highest_streak,
      'player_category', CASE WHEN v_is_vip THEN 'vip' ELSE 'normal' END,
      'vip_reward_mode', v_vip_mode,
      'normal_amount', ROUND(v_normal_amt, 2),
      'usdt_amount', v_reward_amount,
      'currency', 'USDT',
      'status', 'completed',
      'claimed_at', v_now
    )
  );

  IF COALESCE((v_credit_res->>'already_processed')::boolean, false) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Daily bonus already claimed for this period.',
      'seconds_remaining', v_cooldown_seconds
    );
  END IF;

  v_resolved_addr := COALESCE(NULLIF(v_credit_res->>'wallet_address', ''), v_addr, v_uid::text);

  IF v_streak IS NOT NULL THEN
    UPDATE public.user_daily_streaks
    SET user_id = COALESCE(user_id, v_uid),
        wallet_address = COALESCE(NULLIF(wallet_address, ''), v_resolved_addr),
        current_streak = v_current_streak,
        highest_streak = GREATEST(COALESCE(highest_streak, 0), v_current_streak),
        last_checkin_date = v_today,
        last_claimed_at = v_now,
        total_checkins = COALESCE(total_checkins, 0) + 1,
        total_flo_awarded = ROUND(COALESCE(total_flo_awarded, 0) + v_reward_amount, 2),
        updated_at = v_now
    WHERE id = v_streak.id;
  ELSE
    INSERT INTO public.user_daily_streaks (
      user_id, wallet_address, current_streak, highest_streak, last_checkin_date,
      last_claimed_at, total_checkins, total_flo_awarded, created_at, updated_at
    ) VALUES (
      v_uid, v_resolved_addr, v_current_streak, v_highest_streak, v_today,
      v_now, 1, v_reward_amount, v_now, v_now
    )
    ON CONFLICT (wallet_address) DO UPDATE SET
      user_id = COALESCE(EXCLUDED.user_id, public.user_daily_streaks.user_id),
      current_streak = v_current_streak,
      highest_streak = GREATEST(COALESCE(public.user_daily_streaks.highest_streak, 0), v_current_streak),
      last_checkin_date = v_today,
      last_claimed_at = v_now,
      total_checkins = COALESCE(public.user_daily_streaks.total_checkins, 0) + 1,
      total_flo_awarded = ROUND(COALESCE(public.user_daily_streaks.total_flo_awarded, 0) + v_reward_amount, 2),
      updated_at = v_now;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'bonus_amount', v_reward_amount,
    'current_streak', v_current_streak,
    'highest_streak', v_highest_streak,
    'next_streak', (v_current_streak % 7) + 1,
    'player_category', CASE WHEN v_is_vip THEN 'vip' ELSE 'normal' END,
    'amount', v_reward_amount,
    'currency', 'USDT',
    'new_balance', (v_credit_res->>'new_balance')::numeric,
    'transaction_id', (v_credit_res->>'transaction_id'),
    'message', 'Congratulations! Day ' || v_current_streak || ' (+' || to_char(v_reward_amount, 'FM999999990.00') || ' USDT) claimed!'
  );
END;
$$;

-- Secure admin_update_reward_settings with admin check
CREATE OR REPLACE FUNCTION public.admin_update_reward_settings(
  p_bonus_settings jsonb DEFAULT NULL,
  p_checkin_settings jsonb DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth', 'pg_temp'
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized: Admin privileges required.');
  END IF;

  IF p_bonus_settings IS NOT NULL THEN
    INSERT INTO public.platform_settings (key, value, updated_at)
    VALUES ('bonus_rewards', p_bonus_settings, now())
    ON CONFLICT (key) DO UPDATE
    SET value = p_bonus_settings, updated_at = now();
  END IF;

  IF p_checkin_settings IS NOT NULL THEN
    INSERT INTO public.platform_settings (key, value, updated_at)
    VALUES ('daily_checkin', p_checkin_settings || jsonb_build_object('timezone', 'Asia/Kolkata'), now())
    ON CONFLICT (key) DO UPDATE
    SET value = EXCLUDED.value, updated_at = now();
  END IF;

  RETURN jsonb_build_object('success', true, 'message', 'Reward settings updated successfully.');
END;
$$;

-- 6. Upgrade Promotional / Referral Settings & RPCs for Normal vs VIP Affiliate Rewards
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
  v_normal_enabled boolean;
  v_vip_enabled boolean;
  v_vip_mode text;
  v_reg_enabled boolean;
  v_reg_amount numeric;
  v_vip_reg_amount numeric;
  v_fd_enabled boolean;
  v_fd_percent numeric;
  v_vip_fd_percent numeric;
  v_min_dep numeric;
  v_max_bonus numeric;
  v_lc_enabled boolean;
  v_lc_percent numeric;
  v_vip_lc_percent numeric;
  v_ver integer;
BEGIN
  SELECT value INTO v_ref FROM public.platform_settings WHERE key = 'referral_settings';
  IF v_ref IS NULL THEN
    SELECT value->'referralSettings' INTO v_global FROM public.platform_settings WHERE key = 'global';
    v_src := v_global;
  ELSE
    v_src := v_ref;
  END IF;

  IF v_src IS NULL THEN
    RETURN jsonb_build_object(
      'configured', false,
      'enabled', false,
      'normal_enabled', false,
      'vip_enabled', false,
      'vip_reward_mode', 'double_normal',
      'registration_reward_enabled', false,
      'registration_reward_amount', 0,
      'vip_registration_reward_amount', 0,
      'first_deposit_reward_enabled', false,
      'first_deposit_reward_percent', 0,
      'vip_first_deposit_reward_percent', 0,
      'minimum_qualifying_deposit', 0,
      'maximum_first_deposit_bonus', 0,
      'lifetime_commission_enabled', false,
      'lifetime_commission_percent', 0,
      'vip_lifetime_commission_percent', 0,
      'reward_currency', 'USDT',
      'supported_network', 'TRC-20',
      'config_version', 0
    );
  END IF;

  v_enabled := COALESCE((v_src->>'enabled')::boolean, true);
  v_normal_enabled := COALESCE((v_src->>'normal_enabled')::boolean, true);
  v_vip_enabled := COALESCE((v_src->>'vip_enabled')::boolean, true);
  v_vip_mode := CASE WHEN lower(COALESCE(v_src->>'vip_reward_mode', 'double_normal')) = 'custom' THEN 'custom' ELSE 'double_normal' END;

  v_reg_enabled := COALESCE((v_src->>'registration_reward_enabled')::boolean, (v_src->'registration_reward'->>'enabled')::boolean, true);
  v_reg_amount := GREATEST(0, COALESCE(
    CASE WHEN (v_src ? 'registration_reward_amount') THEN (v_src->>'registration_reward_amount')::numeric END,
    CASE WHEN ((v_src->'registration_reward') ? 'amount') THEN (v_src->'registration_reward'->>'amount')::numeric END,
    0
  ));
  v_vip_reg_amount := GREATEST(0, COALESCE(
    CASE WHEN (v_src ? 'vip_registration_reward_amount') THEN (v_src->>'vip_registration_reward_amount')::numeric END,
    v_reg_amount * 2.0
  ));

  v_fd_enabled := COALESCE((v_src->>'first_deposit_reward_enabled')::boolean, (v_src->'first_deposit_reward'->>'enabled')::boolean, true);
  v_fd_percent := GREATEST(0, COALESCE(
    CASE WHEN (v_src ? 'first_deposit_reward_percent') THEN (v_src->>'first_deposit_reward_percent')::numeric END,
    CASE WHEN ((v_src->'first_deposit_reward') ? 'amount') THEN (v_src->'first_deposit_reward'->>'amount')::numeric END,
    0
  ));
  v_vip_fd_percent := GREATEST(0, COALESCE(
    CASE WHEN (v_src ? 'vip_first_deposit_reward_percent') THEN (v_src->>'vip_first_deposit_reward_percent')::numeric END,
    v_fd_percent * 2.0
  ));

  v_min_dep := GREATEST(0, COALESCE(
    CASE WHEN (v_src ? 'minimum_qualifying_deposit') THEN (v_src->>'minimum_qualifying_deposit')::numeric END,
    CASE WHEN ((v_src->'first_deposit_reward') ? 'min_deposit') THEN (v_src->'first_deposit_reward'->>'min_deposit')::numeric END,
    0
  ));
  v_max_bonus := GREATEST(0, COALESCE(
    CASE WHEN (v_src ? 'maximum_first_deposit_bonus') THEN (v_src->>'maximum_first_deposit_bonus')::numeric END,
    CASE WHEN ((v_src->'first_deposit_reward') ? 'max_reward') THEN (v_src->'first_deposit_reward'->>'max_reward')::numeric END,
    0
  ));

  v_lc_enabled := COALESCE((v_src->>'lifetime_commission_enabled')::boolean, (v_src->'lifetime_commission'->>'enabled')::boolean, true);
  v_lc_percent := GREATEST(0, COALESCE(
    CASE WHEN (v_src ? 'lifetime_commission_percent') THEN (v_src->>'lifetime_commission_percent')::numeric END,
    CASE WHEN ((v_src->'lifetime_commission') ? 'percent') THEN (v_src->'lifetime_commission'->>'percent')::numeric END,
    0
  ));
  v_vip_lc_percent := GREATEST(0, COALESCE(
    CASE WHEN (v_src ? 'vip_lifetime_commission_percent') THEN (v_src->>'vip_lifetime_commission_percent')::numeric END,
    v_lc_percent * 2.0
  ));

  v_ver := COALESCE((v_src->>'config_version')::integer, 1);

  RETURN jsonb_build_object(
    'configured', true,
    'enabled', v_enabled,
    'normal_enabled', v_normal_enabled,
    'vip_enabled', v_vip_enabled,
    'vip_reward_mode', v_vip_mode,
    'reward_currency', 'USDT',
    'supported_network', 'TRC-20',
    'config_version', v_ver,
    'registration_reward_enabled', v_reg_enabled,
    'registration_reward_amount', ROUND(v_reg_amount, 2),
    'vip_registration_reward_amount', ROUND(v_vip_reg_amount, 2),
    'first_deposit_reward_enabled', v_fd_enabled,
    'first_deposit_reward_percent', ROUND(v_fd_percent, 2),
    'vip_first_deposit_reward_percent', ROUND(v_vip_fd_percent, 2),
    'minimum_qualifying_deposit', ROUND(v_min_dep, 2),
    'maximum_first_deposit_bonus', ROUND(v_max_bonus, 2),
    'lifetime_commission_enabled', v_lc_enabled,
    'lifetime_commission_percent', ROUND(v_lc_percent, 2),
    'vip_lifetime_commission_percent', ROUND(v_vip_lc_percent, 2),
    'lifetime_commission_activity', COALESCE(v_src->>'lifetime_commission_activity', v_src->'lifetime_commission'->>'activity', 'ticket_purchase')
  );
END;
$$;

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
  v_normal_enabled boolean;
  v_vip_enabled boolean;
  v_vip_mode text;
  v_reg_enabled boolean;
  v_reg_amount numeric;
  v_vip_reg_amount numeric;
  v_fd_enabled boolean;
  v_fd_percent numeric;
  v_vip_fd_percent numeric;
  v_min_dep numeric;
  v_max_bonus numeric;
  v_lc_enabled boolean;
  v_lc_percent numeric;
  v_vip_lc_percent numeric;
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
  v_normal_enabled := COALESCE((p_payload->>'normal_enabled')::boolean, (v_prev_ref->>'normal_enabled')::boolean, true);
  v_vip_enabled := COALESCE((p_payload->>'vip_enabled')::boolean, (v_prev_ref->>'vip_enabled')::boolean, true);
  v_vip_mode := CASE WHEN lower(COALESCE(p_payload->>'vip_reward_mode', v_prev_ref->>'vip_reward_mode', 'double_normal')) = 'custom' THEN 'custom' ELSE 'double_normal' END;
  v_reg_enabled := COALESCE((p_payload->>'registration_reward_enabled')::boolean, (v_prev_ref->>'registration_reward_enabled')::boolean, true);
  v_fd_enabled := COALESCE((p_payload->>'first_deposit_reward_enabled')::boolean, (v_prev_ref->>'first_deposit_reward_enabled')::boolean, true);
  v_lc_enabled := COALESCE((p_payload->>'lifetime_commission_enabled')::boolean, (v_prev_ref->>'lifetime_commission_enabled')::boolean, true);

  BEGIN
    v_reg_amount := COALESCE(CASE WHEN (p_payload ? 'registration_reward_amount') THEN (p_payload->>'registration_reward_amount')::numeric END, (v_prev_ref->>'registration_reward_amount')::numeric, 0);
    v_vip_reg_amount := COALESCE(CASE WHEN (p_payload ? 'vip_registration_reward_amount') THEN (p_payload->>'vip_registration_reward_amount')::numeric END, (v_prev_ref->>'vip_registration_reward_amount')::numeric, v_reg_amount * 2);
    v_fd_percent := COALESCE(CASE WHEN (p_payload ? 'first_deposit_reward_percent') THEN (p_payload->>'first_deposit_reward_percent')::numeric END, (v_prev_ref->>'first_deposit_reward_percent')::numeric, 0);
    v_vip_fd_percent := COALESCE(CASE WHEN (p_payload ? 'vip_first_deposit_reward_percent') THEN (p_payload->>'vip_first_deposit_reward_percent')::numeric END, (v_prev_ref->>'vip_first_deposit_reward_percent')::numeric, v_fd_percent * 2);
    v_min_dep := COALESCE(CASE WHEN (p_payload ? 'minimum_qualifying_deposit') THEN (p_payload->>'minimum_qualifying_deposit')::numeric END, (v_prev_ref->>'minimum_qualifying_deposit')::numeric, 10);
    v_max_bonus := COALESCE(CASE WHEN (p_payload ? 'maximum_first_deposit_bonus') THEN (p_payload->>'maximum_first_deposit_bonus')::numeric END, (v_prev_ref->>'maximum_first_deposit_bonus')::numeric, 50);
    v_lc_percent := COALESCE(CASE WHEN (p_payload ? 'lifetime_commission_percent') THEN (p_payload->>'lifetime_commission_percent')::numeric END, (v_prev_ref->>'lifetime_commission_percent')::numeric, 0);
    v_vip_lc_percent := COALESCE(CASE WHEN (p_payload ? 'vip_lifetime_commission_percent') THEN (p_payload->>'vip_lifetime_commission_percent')::numeric END, (v_prev_ref->>'vip_lifetime_commission_percent')::numeric, v_lc_percent * 2);
  EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', 'All financial reward inputs must be valid numbers.');
  END;

  IF v_reg_amount < 0 OR v_reg_amount > 1000 OR v_vip_reg_amount < 0 OR v_vip_reg_amount > 2000 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Registration rewards must be between 0 and 2000 USDT.');
  END IF;
  IF v_fd_percent < 0 OR v_fd_percent > 100 OR v_vip_fd_percent < 0 OR v_vip_fd_percent > 100 THEN
    RETURN jsonb_build_object('success', false, 'error', 'First deposit bonus percentages must be between 0% and 100%.');
  END IF;
  IF v_lc_percent < 0 OR v_lc_percent > 50 OR v_vip_lc_percent < 0 OR v_vip_lc_percent > 50 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Lifetime commission percentages must be between 0% and 50%.');
  END IF;
  IF v_min_dep < 0 OR v_min_dep > 100000 OR v_max_bonus < 0 OR v_max_bonus > 100000 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Qualifying deposit and max bonus bounds must be between 0 and 100,000 USDT.');
  END IF;

  v_next_ver := COALESCE((v_prev_ref->>'config_version')::integer, 0) + 1;

  v_canonical := jsonb_build_object(
    'enabled', v_enabled,
    'normal_enabled', v_normal_enabled,
    'vip_enabled', v_vip_enabled,
    'vip_reward_mode', v_vip_mode,
    'reward_currency', 'USDT',
    'supported_network', 'TRC-20',
    'config_version', v_next_ver,
    'updated_by', v_admin_id,
    'updated_by_email', v_admin_email,
    'updated_at', to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
    'registration_reward_enabled', v_reg_enabled,
    'registration_reward_amount', ROUND(v_reg_amount, 2),
    'vip_registration_reward_amount', ROUND(v_vip_reg_amount, 2),
    'first_deposit_reward_enabled', v_fd_enabled,
    'first_deposit_reward_percent', ROUND(v_fd_percent, 2),
    'vip_first_deposit_reward_percent', ROUND(v_vip_fd_percent, 2),
    'minimum_qualifying_deposit', ROUND(v_min_dep, 2),
    'maximum_first_deposit_bonus', ROUND(v_max_bonus, 2),
    'lifetime_commission_enabled', v_lc_enabled,
    'lifetime_commission_percent', ROUND(v_lc_percent, 2),
    'vip_lifetime_commission_percent', ROUND(v_vip_lc_percent, 2),
    'lifetime_commission_activity', COALESCE(p_payload->>'lifetime_commission_activity', v_prev_ref->>'lifetime_commission_activity', 'ticket_purchase'),
    'registration_reward', jsonb_build_object('enabled', v_reg_enabled, 'amount', ROUND(v_reg_amount, 2)),
    'first_deposit_reward', jsonb_build_object('enabled', v_fd_enabled, 'amount', ROUND(v_fd_percent, 2), 'mode', 'percentage', 'min_deposit', ROUND(v_min_dep, 2), 'max_reward', ROUND(v_max_bonus, 2)),
    'lifetime_commission', jsonb_build_object('enabled', v_lc_enabled, 'percent', ROUND(v_lc_percent, 2), 'activity', COALESCE(p_payload->>'lifetime_commission_activity', v_prev_ref->>'lifetime_commission_activity', 'ticket_purchase'))
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
    v_admin_id, v_admin_email, 'UPDATE_REFERRAL_SETTINGS', 'platform_settings', 'referral_settings',
    jsonb_build_object('before', v_prev_ref, 'after', v_canonical), p_ip_address, now()
  );

  RETURN jsonb_build_object('success', true, 'settings', v_canonical);
END;
$$;

-- Patch process_referral_registration, process_confirmed_deposit_secure & buy_lottery_tickets_secure cleanly for VIP Promo Rewards
DO $$
DECLARE
  v_def text;
BEGIN
  -- A. process_referral_registration
  SELECT pg_get_functiondef(p.oid) INTO v_def
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'process_referral_registration';
  IF v_def IS NOT NULL AND position('vip_reward_mode' in v_def) = 0 THEN
    v_def := replace(
      v_def,
      '  v_cfg := public.get_authoritative_referral_settings();
  v_enabled := COALESCE((v_cfg->>''enabled'')::boolean, false);
  v_reg_enabled := COALESCE((v_cfg->>''registration_reward_enabled'')::boolean, false);
  v_amount := GREATEST(0, COALESCE((v_cfg->>''registration_reward_amount'')::numeric, 0));
  v_cfg_ver := COALESCE((v_cfg->>''config_version'')::integer, 1);

  -- Strict zero-reward & disabled enforcement: NO credit & NO reward/ledger entry when amount = 0 or disabled
  v_should_credit := (v_enabled AND v_reg_enabled AND v_amount > 0 AND NOT v_flagged);',
      '  v_cfg := public.get_authoritative_referral_settings();
  v_enabled := COALESCE((v_cfg->>''enabled'')::boolean, false) AND (
    CASE WHEN public._is_user_vip(v_referrer_id)
      THEN COALESCE((v_cfg->>''vip_enabled'')::boolean, true)
      ELSE COALESCE((v_cfg->>''normal_enabled'')::boolean, true)
    END
  );
  v_reg_enabled := COALESCE((v_cfg->>''registration_reward_enabled'')::boolean, false);
  v_amount := public._resolve_vip_reward_amount(
    public._is_user_vip(v_referrer_id),
    COALESCE((v_cfg->>''registration_reward_amount'')::numeric, 0),
    NULLIF((v_cfg->>''vip_registration_reward_amount'')::numeric, NULL),
    COALESCE(v_cfg->>''vip_reward_mode'', ''double_normal'')
  );
  v_cfg_ver := COALESCE((v_cfg->>''config_version'')::integer, 1);

  v_should_credit := (v_enabled AND v_reg_enabled AND v_amount > 0 AND NOT v_flagged);'
    );
    EXECUTE v_def;
  END IF;

  -- B. process_confirmed_deposit_secure
  SELECT pg_get_functiondef(p.oid) INTO v_def
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'process_confirmed_deposit_secure';
  IF v_def IS NOT NULL AND position('vip_reward_mode' in v_def) = 0 THEN
    v_def := replace(
      v_def,
      '      v_cfg := public.get_authoritative_referral_settings();
      IF COALESCE((v_cfg->>''enabled'')::boolean, false)
         AND COALESCE((v_cfg->>''first_deposit_reward_enabled'')::boolean, false) THEN
        v_bonus_pct := GREATEST(0, COALESCE((v_cfg->>''first_deposit_reward_percent'')::numeric, 0));',
      '      v_cfg := public.get_authoritative_referral_settings();
      IF COALESCE((v_cfg->>''enabled'')::boolean, false)
         AND (
           CASE WHEN public._is_user_vip(v_ref.referrer_id)
             THEN COALESCE((v_cfg->>''vip_enabled'')::boolean, true)
             ELSE COALESCE((v_cfg->>''normal_enabled'')::boolean, true)
           END
         )
         AND COALESCE((v_cfg->>''first_deposit_reward_enabled'')::boolean, false) THEN
        v_bonus_pct := LEAST(100, public._resolve_vip_reward_amount(
          public._is_user_vip(v_ref.referrer_id),
          COALESCE((v_cfg->>''first_deposit_reward_percent'')::numeric, 0),
          NULLIF((v_cfg->>''vip_first_deposit_reward_percent'')::numeric, NULL),
          COALESCE(v_cfg->>''vip_reward_mode'', ''double_normal'')
        ));'
    );
    EXECUTE v_def;
  END IF;

  -- C. buy_lottery_tickets_secure
  SELECT pg_get_functiondef(p.oid) INTO v_def
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'buy_lottery_tickets_secure';
  IF v_def IS NOT NULL AND position('vip_reward_mode' in v_def) = 0 THEN
    v_def := replace(
      v_def,
      '      v_cfg := public.get_authoritative_referral_settings();
      IF COALESCE((v_cfg->>''enabled'')::boolean, false)
         AND COALESCE((v_cfg->>''lifetime_commission_enabled'')::boolean, false)
         AND COALESCE(v_cfg->>''lifetime_commission_activity'', ''ticket_purchase'') = ''ticket_purchase'' THEN
        v_comm_pct := GREATEST(0, COALESCE((v_cfg->>''lifetime_commission_percent'')::numeric, 0));',
      '      v_cfg := public.get_authoritative_referral_settings();
      IF COALESCE((v_cfg->>''enabled'')::boolean, false)
         AND (
           CASE WHEN public._is_user_vip(v_ref.referrer_id)
             THEN COALESCE((v_cfg->>''vip_enabled'')::boolean, true)
             ELSE COALESCE((v_cfg->>''normal_enabled'')::boolean, true)
           END
         )
         AND COALESCE((v_cfg->>''lifetime_commission_enabled'')::boolean, false)
         AND COALESCE(v_cfg->>''lifetime_commission_activity'', ''ticket_purchase'') = ''ticket_purchase'' THEN
        v_comm_pct := LEAST(50, public._resolve_vip_reward_amount(
          public._is_user_vip(v_ref.referrer_id),
          COALESCE((v_cfg->>''lifetime_commission_percent'')::numeric, 0),
          NULLIF((v_cfg->>''vip_lifetime_commission_percent'')::numeric, NULL),
          COALESCE(v_cfg->>''vip_reward_mode'', ''double_normal'')
        ));'
    );
    EXECUTE v_def;
  END IF;
END $$;

-- 7. Event Processing Diagnostics, Idempotent Reconciliation & Safe Recovery for Juuggu (evt-mwycvmyb-611)
ALTER TABLE public.lottery_events
  ADD COLUMN IF NOT EXISTS processing_error text,
  ADD COLUMN IF NOT EXISTS processing_error_at timestamptz,
  ADD COLUMN IF NOT EXISTS processing_attempts integer NOT NULL DEFAULT 0;

-- Patch finalize_lottery_draw_secure to safely reconcile events stuck in processing/result_pending
-- that already have finalized_at + draw_audit_id and zero unfinalized active tickets
DO $$
DECLARE
  v_def text;
BEGIN
  SELECT pg_get_functiondef(p.oid) INTO v_def
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'finalize_lottery_draw_secure';

  IF v_def IS NOT NULL AND position('reconciled_stuck_status' in v_def) = 0 THEN
    v_def := replace(
      v_def,
      '  IF v_event.status IN (''completed'', ''settled'') OR v_event.finalized_at IS NOT NULL THEN
    RETURN jsonb_build_object(
      ''success'', true,
      ''already_finalized'', true,
      ''event_id'', p_event_id,
      ''winning_digits'', v_event.winning_digits,
      ''winning_codes'', COALESCE(v_event.draw_result_codes, v_event.winning_codes),
      ''finalized_at'', v_event.finalized_at,
      ''ticket_visibility_until'', v_event.ticket_visibility_until,
      ''audit_id'', v_event.draw_audit_id,
      ''message'', ''Event is already finalized.''
    );
  END IF;',
      '  IF v_event.status IN (''completed'', ''settled'') THEN
    RETURN jsonb_build_object(
      ''success'', true,
      ''already_finalized'', true,
      ''reconciled_stuck_status'', false,
      ''event_id'', p_event_id,
      ''winning_digits'', v_event.winning_digits,
      ''winning_codes'', COALESCE(v_event.draw_result_codes, v_event.winning_codes),
      ''finalized_at'', v_event.finalized_at,
      ''ticket_visibility_until'', v_event.ticket_visibility_until,
      ''audit_id'', v_event.draw_audit_id,
      ''message'', ''Event is already finalized.''
    );
  END IF;

  IF v_event.finalized_at IS NOT NULL AND v_event.draw_audit_id IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM public.lottery_draw_audits WHERE id = v_event.draw_audit_id AND event_id = p_event_id)
       AND NOT EXISTS (SELECT 1 FROM public.lottery_tickets WHERE event_id = p_event_id AND status = ''active'') THEN
      UPDATE public.lottery_events
      SET status = ''completed'',
          is_active = false,
          codes_locked = true,
          processing_error = NULL,
          processing_error_at = NULL
      WHERE id = p_event_id AND status <> ''completed'';

      INSERT INTO public.admin_audit_logs (
        admin_id, action_type, target_type, target_id, changes
      ) VALUES (
        auth.uid(), ''RECOVER_FINALIZED_STATUS'', ''lottery_events'', p_event_id,
        jsonb_build_object(
          ''previous_status'', v_event.status,
          ''recovered_status'', ''completed'',
          ''draw_audit_id'', v_event.draw_audit_id,
          ''finalized_at'', v_event.finalized_at,
          ''zero_duplicate_payouts'', true
        )
      );

      RETURN jsonb_build_object(
        ''success'', true,
        ''already_finalized'', true,
        ''reconciled_stuck_status'', true,
        ''event_id'', p_event_id,
        ''winning_digits'', v_event.winning_digits,
        ''finalized_at'', v_event.finalized_at,
        ''audit_id'', v_event.draw_audit_id,
        ''message'', ''Reconciled finalized event status to completed without duplicate payouts.''
      );
    END IF;
    RETURN jsonb_build_object(
      ''success'', false,
      ''error'', ''Event has finalized_at timestamp but incomplete audit/ticket settlement. Manual administrator audit required.''
    );
  END IF;'
    );

    v_def := replace(
      v_def,
      '      result_visible_until = v_visibility_until
  WHERE id = p_event_id;',
      '      result_visible_until = v_visibility_until,
      processing_error = NULL,
      processing_error_at = NULL
  WHERE id = p_event_id;'
    );
    EXECUTE v_def;
  END IF;
END $$;

-- Upgrade process_lottery_lifecycle_tick() to capture processing_error + reconcile stuck finalized rows
CREATE OR REPLACE FUNCTION public.process_lottery_lifecycle_tick()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth', 'extensions', 'pg_temp'
AS $$
DECLARE
  v_now_ts timestamptz := clock_timestamp();
  v_now_ms bigint := (EXTRACT(EPOCH FROM v_now_ts) * 1000)::bigint;
  v_evt record;
  v_window_end bigint;
  v_dur_ms bigint;
  v_dur_num numeric;
  v_unit text;
  v_published_count integer := 0;
  v_expired_count integer := 0;
  v_finalized_count integer := 0;
  v_reconciled_count integer := 0;
  v_pending_count integer := 0;
  v_has_digits boolean;
  v_res jsonb;
BEGIN
  -- 1. Publish Scheduled events once their UTC scheduled_publish_at arrives
  FOR v_evt IN
    SELECT id, duration_value, duration_unit, scheduled_publish_at
    FROM public.lottery_events
    WHERE status = 'scheduled'
      AND published_at IS NULL
      AND scheduled_publish_at IS NOT NULL
      AND scheduled_publish_at <= v_now_ts
      AND COALESCE(is_deleted, false) = false
      AND COALESCE(is_paused, false) = false
  LOOP
    PERFORM pg_advisory_xact_lock(hashtext('publish_sched:' || v_evt.id));

    v_dur_num := GREATEST(1, COALESCE(v_evt.duration_value, 60));
    v_unit := lower(COALESCE(v_evt.duration_unit, 'minutes'));
    v_dur_ms := CASE
      WHEN v_unit LIKE 'min%' THEN (v_dur_num * 60 * 1000)::bigint
      WHEN v_unit LIKE 'day%' THEN (v_dur_num * 86400 * 1000)::bigint
      ELSE (v_dur_num * 3600 * 1000)::bigint
    END;

    UPDATE public.lottery_events
    SET status = 'active',
        is_active = true,
        published_at = v_now_ts,
        start_time = (EXTRACT(EPOCH FROM v_evt.scheduled_publish_at) * 1000)::bigint,
        draw_time = (EXTRACT(EPOCH FROM v_evt.scheduled_publish_at) * 1000)::bigint + v_dur_ms
    WHERE id = v_evt.id
      AND status = 'scheduled'
      AND published_at IS NULL;

    IF FOUND THEN
      INSERT INTO public.admin_audit_logs (
        admin_id, action_type, target_type, target_id, changes
      ) VALUES (
        NULL, 'AUTO_PUBLISH_SCHEDULED_EVENT', 'lottery_events', v_evt.id,
        jsonb_build_object('scheduled_publish_at', v_evt.scheduled_publish_at, 'published_at', v_now_ts)
      );
      v_published_count := v_published_count + 1;
    END IF;
  END LOOP;

  -- 2. Transition elapsed active events strictly to 'expired' & lock winning digits
  FOR v_evt IN
    SELECT id, start_time, draw_time, duration_value, duration_unit
    FROM public.lottery_events
    WHERE status = 'active'
      AND COALESCE(is_deleted, false) = false
      AND COALESCE(is_paused, false) = false
  LOOP
    v_window_end := public._compute_event_window_end(
      v_evt.start_time, v_evt.draw_time, v_evt.duration_value::text, v_evt.duration_unit
    );
    IF v_window_end > 0 AND v_now_ms >= v_window_end THEN
      UPDATE public.lottery_events
      SET status = 'expired',
          is_active = false,
          codes_locked = true
      WHERE id = v_evt.id AND status = 'active';
      v_expired_count := v_expired_count + 1;
    END IF;
  END LOOP;

  -- 3. Safely reconcile events stuck in processing/result_pending that already completed finalization
  FOR v_evt IN
    SELECT id
    FROM public.lottery_events
    WHERE status IN ('expired', 'processing', 'result_pending')
      AND finalized_at IS NOT NULL
      AND draw_audit_id IS NOT NULL
      AND COALESCE(is_deleted, false) = false
  LOOP
    BEGIN
      v_res := public.finalize_lottery_draw_secure(v_evt.id);
      IF COALESCE((v_res->>'reconciled_stuck_status')::boolean, false) THEN
        v_reconciled_count := v_reconciled_count + 1;
      ELSIF NOT COALESCE((v_res->>'success')::boolean, false) THEN
        UPDATE public.lottery_events
        SET processing_error = COALESCE(v_res->>'error', 'Reconciliation blocked for manual review'),
            processing_error_at = v_now_ts
        WHERE id = v_evt.id;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      UPDATE public.lottery_events
      SET processing_error = SQLERRM,
          processing_error_at = v_now_ts
      WHERE id = v_evt.id;
    END;
  END LOOP;

  -- 4. Process unfinalized Expired / Processing / Result Pending events automatically
  FOR v_evt IN
    SELECT id, draw_mode, preset_winning_digits, winning_codes
    FROM public.lottery_events
    WHERE status IN ('expired', 'processing', 'result_pending')
      AND COALESCE(is_deleted, false) = false
      AND COALESCE(is_paused, false) = false
      AND finalized_at IS NULL
  LOOP
    v_has_digits := (
      (v_evt.preset_winning_digits IS NOT NULL AND trim(v_evt.preset_winning_digits) ~ '^\d{1,4}$')
      OR (v_evt.winning_codes IS NOT NULL AND jsonb_typeof(v_evt.winning_codes) = 'array' AND jsonb_array_length(v_evt.winning_codes) > 0)
    );

    IF lower(COALESCE(v_evt.draw_mode, 'random')) = 'random' OR v_has_digits THEN
      BEGIN
        UPDATE public.lottery_events
        SET status = 'processing',
            codes_locked = true,
            processing_started_at = COALESCE(processing_started_at, v_now_ts),
            processing_attempts = COALESCE(processing_attempts, 0) + 1
        WHERE id = v_evt.id AND finalized_at IS NULL;

        v_res := public.finalize_lottery_draw_secure(v_evt.id);
        IF COALESCE((v_res->>'success')::boolean, false) THEN
          v_finalized_count := v_finalized_count + 1;
        ELSE
          UPDATE public.lottery_events
          SET status = 'processing',
              processing_error = COALESCE(v_res->>'error', 'Finalization returned unsuccessful status'),
              processing_error_at = v_now_ts
          WHERE id = v_evt.id AND finalized_at IS NULL;
          v_pending_count := v_pending_count + 1;
        END IF;
      EXCEPTION WHEN OTHERS THEN
        UPDATE public.lottery_events
        SET status = 'processing',
            processing_error = SQLERRM,
            processing_error_at = v_now_ts
        WHERE id = v_evt.id AND finalized_at IS NULL;
        v_pending_count := v_pending_count + 1;
      END;
    ELSE
      UPDATE public.lottery_events
      SET status = 'result_pending',
          codes_locked = true,
          processing_error = 'Awaiting winning 4-digit code configuration before finalization.',
          processing_error_at = v_now_ts
      WHERE id = v_evt.id AND finalized_at IS NULL;
      v_pending_count := v_pending_count + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'server_now_ms', v_now_ms,
    'auto_published', v_published_count,
    'transitioned_expired', v_expired_count,
    'reconciled_stuck', v_reconciled_count,
    'auto_finalized', v_finalized_count,
    'awaiting_or_errored', v_pending_count
  );
END;
$$;

-- Safe non-destructive recovery of Juuggu (evt-mwycvmyb-611) using our verified reconciliation path
SELECT public.finalize_lottery_draw_secure('evt-mwycvmyb-611') AS juuggu_recovery_result;
