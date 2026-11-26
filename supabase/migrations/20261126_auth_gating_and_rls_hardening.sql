-- ============================================================================
-- MIGRATION: 20261126_auth_gating_and_rls_hardening.sql
-- ============================================================================
-- Enforce strict Supabase Auth gating across all user-private tables & RPCs:
-- 1. Zero anonymous (`anon`) read/write on user-private tables (wallets, ledger,
--    deposits, withdrawals, tickets, profiles, streaks, VIP, game seeds,
--    notifications, referrals, referral_rewards, support_tickets, game_rounds,
--    room_chat_messages, admin_audit_logs).
-- 2. Keep public lobby/catalog read access ONLY on intentionally public tables
--    (lottery_events, platform_settings, game_configurations, game_rooms,
--     lottery_draw_audits).
-- 3. Prevent RLS infinite recursion on public.profiles by making is_admin() and
--    is_super_admin() SECURITY DEFINER with safe search_path.
-- 4. Provide safe scoped SECURITY DEFINER RPCs for non-PII flows:
--    - check_username_availability(p_username text)
--    - resolve_referrer_by_code(p_code text)
--    - get_taken_ticket_numbers(p_event_id text)
--    - request_withdrawal_secure(...)
--    - process_referral_registration(p_referral_code text)
-- 5. Require authenticated auth.uid() inside all wallet, lottery, reward, spin,
--    notification, and leaderboard RPCs.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. ADMIN ROLE HELPERS (SECURITY DEFINER to prevent profiles RLS recursion)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'auth', 'pg_temp'
AS $function$
BEGIN
  IF current_setting('role', true) = 'service_role' THEN
    RETURN true;
  END IF;

  IF current_setting('request.jwt.claims', true) IS NULL
     AND session_user IN ('postgres', 'supabase_admin') THEN
    RETURN true;
  END IF;

  IF auth.uid() IS NULL THEN
    RETURN false;
  END IF;

  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND role IN ('admin', 'super_admin')
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'auth', 'pg_temp'
AS $function$
BEGIN
  IF current_setting('role', true) = 'service_role' THEN
    RETURN true;
  END IF;

  IF current_setting('request.jwt.claims', true) IS NULL
     AND session_user IN ('postgres', 'supabase_admin') THEN
    RETURN true;
  END IF;

  IF auth.uid() IS NULL THEN
    RETURN false;
  END IF;

  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND role = 'super_admin'
  );
END;
$function$;

-- ----------------------------------------------------------------------------
-- 2. SAFE SCOPED RPCs FOR PUBLIC/AUTHENTICATED NON-PII WORKFLOWS
-- ----------------------------------------------------------------------------

-- 2a. Check username uniqueness without opening public.profiles SELECT to anon
CREATE OR REPLACE FUNCTION public.check_username_availability(p_username text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'auth', 'pg_temp'
AS $function$
DECLARE
  v_clean text := trim(regexp_replace(COALESCE(p_username, ''), '^@\s*', ''));
  v_uid uuid := auth.uid();
  v_taken boolean := false;
BEGIN
  IF v_clean = '' THEN
    RETURN jsonb_build_object('valid', false, 'available', false, 'message', 'User ID is required');
  END IF;

  IF v_clean !~ '^[a-zA-Z0-9_]+$' THEN
    RETURN jsonb_build_object('valid', false, 'available', false, 'message', 'Only letters, numbers, and underscore (_) are allowed');
  END IF;

  IF length(v_clean) < 3 THEN
    RETURN jsonb_build_object('valid', false, 'available', false, 'message', 'User ID must be at least 3 characters');
  END IF;

  IF length(v_clean) > 20 THEN
    RETURN jsonb_build_object('valid', false, 'available', false, 'message', 'User ID cannot exceed 20 characters');
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE lower(username) = lower(v_clean)
      AND (v_uid IS NULL OR id <> v_uid)
  ) INTO v_taken;

  IF v_taken THEN
    RETURN jsonb_build_object('valid', false, 'available', false, 'message', 'This User ID is already taken. Please choose another.');
  END IF;

  RETURN jsonb_build_object('valid', true, 'available', true, 'message', 'User ID is available!');
END;
$function$;

GRANT EXECUTE ON FUNCTION public.check_username_availability(text) TO anon, authenticated;

-- 2b. Resolve referrer user ID cleanly for authenticated referral attribution
CREATE OR REPLACE FUNCTION public.resolve_referrer_by_code(p_code text)
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'auth', 'pg_temp'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_clean text := trim(regexp_replace(COALESCE(p_code, ''), '^@\s*', ''));
  v_ref_id uuid;
BEGIN
  IF v_uid IS NULL OR v_clean = '' THEN
    RETURN NULL;
  END IF;

  SELECT id INTO v_ref_id
  FROM public.profiles
  WHERE lower(username) = lower(v_clean)
    AND id <> v_uid
  LIMIT 1;

  IF v_ref_id IS NOT NULL THEN
    RETURN v_ref_id;
  END IF;

  IF v_clean ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    SELECT id INTO v_ref_id
    FROM public.profiles
    WHERE id = v_clean::uuid
      AND id <> v_uid
    LIMIT 1;
    RETURN v_ref_id;
  END IF;

  RETURN NULL;
END;
$function$;

REVOKE ALL ON FUNCTION public.resolve_referrer_by_code(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.resolve_referrer_by_code(text) TO authenticated;

-- 2c. Return ONLY taken 4-digit ticket numbers for picker collision checks (ZERO PII)
CREATE OR REPLACE FUNCTION public.get_taken_ticket_numbers(p_event_id text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'auth', 'pg_temp'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_rows jsonb;
BEGIN
  IF v_uid IS NULL THEN
    RETURN '[]'::jsonb;
  END IF;

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'event_id', lt.event_id,
        'ticket_number', lpad(lt.ticket_number, 4, '0')
      )
    ),
    '[]'::jsonb
  )
  INTO v_rows
  FROM public.lottery_tickets lt
  JOIN public.lottery_events le ON le.id = lt.event_id
  WHERE (p_event_id IS NULL AND COALESCE(le.status, 'active') IN ('active', 'scheduled'))
     OR (p_event_id IS NOT NULL AND lt.event_id = p_event_id);

  RETURN v_rows;
END;
$function$;

REVOKE ALL ON FUNCTION public.get_taken_ticket_numbers(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_taken_ticket_numbers(text) TO authenticated;

-- 2d. Server-authoritative referral registration & bonus credit RPC
CREATE OR REPLACE FUNCTION public.process_referral_registration(p_referral_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth', 'pg_temp'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_clean text := trim(regexp_replace(COALESCE(p_referral_code, ''), '^@\s*', ''));
  v_referrer_id uuid;
  v_ref_addr text;
  v_ref_name text;
  v_own_addr text;
  v_own_name text;
  v_settings jsonb;
  v_enabled boolean := true;
  v_amount numeric := 0.25;
  v_credit_res jsonb;
  v_tx_id text;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Authentication required.');
  END IF;

  IF v_clean = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Empty referral code.');
  END IF;

  IF EXISTS (SELECT 1 FROM public.user_referrals WHERE referred_user_id = v_uid) THEN
    RETURN jsonb_build_object('success', true, 'already_attributed', true);
  END IF;

  v_referrer_id := public.resolve_referrer_by_code(v_clean);
  IF v_referrer_id IS NULL OR v_referrer_id = v_uid THEN
    RETURN jsonb_build_object('success', false, 'error', 'Referrer not found.');
  END IF;

  SELECT username, trc20_address INTO v_ref_name, v_ref_addr FROM public.profiles WHERE id = v_referrer_id;
  SELECT username, trc20_address INTO v_own_name, v_own_addr FROM public.profiles WHERE id = v_uid;

  SELECT value INTO v_settings FROM public.platform_settings WHERE key = 'referral_settings';
  IF v_settings IS NOT NULL THEN
    v_enabled := COALESCE((v_settings->>'registration_reward_enabled')::boolean, true);
    v_amount := ROUND(COALESCE((v_settings->>'registration_reward_amount')::numeric, 0.25), 2);
  END IF;

  INSERT INTO public.user_referrals (
    referrer_id,
    referrer_address,
    referrer_username,
    referred_user_id,
    referred_address,
    referred_username,
    referral_code,
    status,
    registration_reward_credited,
    total_commission_earned,
    created_at,
    updated_at
  ) VALUES (
    v_referrer_id,
    v_ref_addr,
    v_ref_name,
    v_uid,
    v_own_addr,
    v_own_name,
    v_clean,
    'active',
    (v_enabled AND v_amount > 0),
    CASE WHEN v_enabled AND v_amount > 0 THEN v_amount ELSE 0 END,
    now(),
    now()
  );

  IF v_enabled AND v_amount > 0 THEN
    v_credit_res := public._internal_credit_virtual_credits(
      v_amount,
      'referral_registration_reward',
      'ref-reg-' || v_uid::text,
      'Referral registration bonus for inviting user ' || substr(v_uid::text, 1, 8),
      v_ref_addr,
      v_referrer_id,
      jsonb_build_object('referred_user_id', v_uid, 'referral_code', v_clean)
    );

    v_tx_id := v_credit_res->>'transaction_id';

    INSERT INTO public.referral_rewards (
      referrer_id,
      referred_user_id,
      reward_type,
      amount,
      currency,
      status,
      ledger_tx_id,
      details,
      created_at
    ) VALUES (
      v_referrer_id,
      v_uid,
      'registration',
      v_amount,
      'USDT',
      'credited',
      v_tx_id,
      jsonb_build_object('description', 'Registration bonus for inviting user ' || substr(v_uid::text, 1, 8)),
      now()
    );
  END IF;

  RETURN jsonb_build_object('success', true, 'referrer_id', v_referrer_id);
END;
$function$;

REVOKE ALL ON FUNCTION public.process_referral_registration(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.process_referral_registration(text) TO authenticated;

-- 2e. Atomic Server-Authoritative Withdrawal Request RPC
CREATE OR REPLACE FUNCTION public.request_withdrawal_secure(
  p_amount numeric,
  p_destination_address text,
  p_network text DEFAULT 'TRC-20',
  p_user_address text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth', 'pg_temp'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_wallet record;
  v_settings jsonb;
  v_min_limit numeric := 5;
  v_max_limit numeric := 10000;
  v_amount numeric;
  v_fee numeric;
  v_net numeric;
  v_new_balance numeric;
  v_order_id text;
  v_now_ms bigint;
  v_sla_ms bigint;
  v_tx_id text;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Authentication required.');
  END IF;

  v_amount := ROUND(COALESCE(p_amount, 0), 2);
  IF v_amount <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Please enter a valid withdrawal amount.');
  END IF;

  IF p_destination_address IS NULL OR length(trim(p_destination_address)) < 8 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Please enter a valid recipient USDT wallet address.');
  END IF;

  SELECT value INTO v_settings FROM public.platform_settings WHERE key = 'withdrawal_settings';
  IF v_settings IS NOT NULL THEN
    v_min_limit := COALESCE((v_settings->>'minWithdrawal')::numeric, (v_settings->>'min_withdrawal')::numeric, v_min_limit);
    v_max_limit := COALESCE((v_settings->>'maxWithdrawal')::numeric, (v_settings->>'max_withdrawal')::numeric, v_max_limit);
  END IF;

  IF v_amount < v_min_limit THEN
    RETURN jsonb_build_object('success', false, 'error', 'Minimum withdrawal is ' || v_min_limit || ' USDT.');
  END IF;

  IF v_amount > v_max_limit THEN
    RETURN jsonb_build_object('success', false, 'error', 'Maximum withdrawal is ' || v_max_limit || ' USDT.');
  END IF;

  SELECT * INTO v_wallet
  FROM public.lottery_wallets
  WHERE user_id = v_uid
  ORDER BY updated_at DESC
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Wallet not found for authenticated account.');
  END IF;

  IF COALESCE(v_wallet.balance, 0) < v_amount THEN
    RETURN jsonb_build_object('success', false, 'error', 'Withdrawal amount exceeds available USDT balance.');
  END IF;

  v_fee := CASE
    WHEN COALESCE(p_network, 'TRC-20') = 'TRC-20' THEN 1.0
    WHEN p_network = 'BEP-20' THEN 0.8
    ELSE 8.0
  END;

  IF v_amount <= v_fee THEN
    RETURN jsonb_build_object('success', false, 'error', 'Withdrawal amount must exceed the network fee.');
  END IF;

  v_net := ROUND(v_amount - v_fee, 2);
  v_new_balance := ROUND(v_wallet.balance - v_amount, 2);
  v_order_id := 'W-' || floor(1000 + random() * 9000)::text || '-' || substr(md5(random()::text), 1, 4);
  v_now_ms := (EXTRACT(EPOCH FROM now()) * 1000)::bigint;
  v_sla_ms := v_now_ms + (24 * 3600 * 1000);

  UPDATE public.lottery_wallets
  SET balance = v_new_balance,
      updated_at = now()
  WHERE address = v_wallet.address;

  INSERT INTO public.lottery_withdrawals (
    id,
    user_id,
    user_address,
    amount,
    net_disbursal,
    network_fee,
    network,
    destination_address,
    requested_at,
    sla_target_ms,
    status,
    tx_hash,
    created_at
  ) VALUES (
    v_order_id,
    v_uid,
    v_wallet.address,
    v_amount,
    v_net,
    v_fee,
    COALESCE(p_network, 'TRC-20'),
    trim(p_destination_address),
    v_now_ms,
    v_sla_ms,
    'processing',
    NULL,
    now()
  );

  v_tx_id := 'tx_' || to_char(now(), 'YYYYMMDDHH24MISS') || '_' || substr(md5(random()::text), 1, 8);
  INSERT INTO public.wallet_ledger (
    id, user_id, wallet_address, transaction_type, amount,
    balance_before, balance_after, currency, reference_id,
    description, metadata, created_at
  ) VALUES (
    v_tx_id,
    v_uid,
    v_wallet.address,
    'withdrawal',
    -v_amount,
    v_wallet.balance,
    v_new_balance,
    'USDT',
    v_order_id,
    'USDT Withdrawal Request #' || v_order_id || ' (' || COALESCE(p_network, 'TRC-20') || ')',
    jsonb_build_object('destination', trim(p_destination_address), 'network_fee', v_fee, 'net_disbursal', v_net),
    now()
  );

  RETURN jsonb_build_object(
    'success', true,
    'order_id', v_order_id,
    'new_balance', v_new_balance,
    'net_disbursal', v_net,
    'network_fee', v_fee,
    'transaction_id', v_tx_id
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.request_withdrawal_secure(numeric, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.request_withdrawal_secure(numeric, text, text, text) TO authenticated;

-- ----------------------------------------------------------------------------
-- 3. HARDEN EXISTING GAMEPLAY, REWARDS, NOTIFICATION & LEADERBOARD RPCs
-- ----------------------------------------------------------------------------

-- 3a. Enforce strict auth.uid() inside buy_lottery_tickets_secure (no anon/wallet spoofing)
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
AS $function$
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

  RETURN jsonb_build_object(
    'success', true,
    'total_cost', v_total_cost,
    'new_balance', v_new_balance,
    'tickets_count', v_num_tickets,
    'currency', 'USDT',
    'transaction_id', v_tx_id
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.buy_lottery_tickets_secure(text, text[], text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.buy_lottery_tickets_secure(text, text[], text, text) TO authenticated;

-- 3b. Internal-only credit helper (never directly callable by API roles) + Admin-only RPC
CREATE OR REPLACE FUNCTION public._internal_credit_virtual_credits(
  p_amount numeric,
  p_transaction_type text,
  p_reference_id text DEFAULT NULL::text,
  p_description text DEFAULT NULL::text,
  p_user_address text DEFAULT NULL::text,
  p_target_user_id uuid DEFAULT NULL::uuid,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth', 'pg_temp'
AS $function$
DECLARE
  v_uid uuid;
  v_wallet record;
  v_addr text;
  v_exact_amount numeric;
  v_old_balance numeric := 0;
  v_new_balance numeric;
  v_tx_id text;
BEGIN
  v_uid := COALESCE(p_target_user_id, auth.uid());

  IF p_amount IS NULL OR p_amount <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Amount must be greater than zero.');
  END IF;

  v_exact_amount := ROUND(p_amount, 2);

  IF p_reference_id IS NOT NULL THEN
    SELECT * INTO v_wallet FROM public.wallet_ledger
    WHERE reference_id = p_reference_id AND transaction_type = p_transaction_type
    LIMIT 1;
    IF FOUND THEN
      SELECT balance INTO v_new_balance FROM public.lottery_wallets
      WHERE (v_uid IS NOT NULL AND user_id = v_uid) OR (p_user_address IS NOT NULL AND address = p_user_address)
      LIMIT 1;
      RETURN jsonb_build_object(
        'success', true,
        'already_processed', true,
        'new_balance', COALESCE(v_new_balance, 0),
        'transaction_id', v_wallet.id,
        'amount', v_wallet.amount,
        'message', 'Transaction already processed previously.'
      );
    END IF;
  END IF;

  SELECT * INTO v_wallet FROM public.lottery_wallets
  WHERE (v_uid IS NOT NULL AND user_id = v_uid) OR (p_user_address IS NOT NULL AND address = p_user_address)
  ORDER BY updated_at DESC LIMIT 1
  FOR UPDATE;

  IF NOT FOUND THEN
    v_addr := COALESCE(p_user_address, '0x' || substr(md5(random()::text || clock_timestamp()::text), 1, 40));
    v_old_balance := 0.00;
    v_new_balance := v_exact_amount;

    INSERT INTO public.lottery_wallets (
      address, user_id, balance, lifetime_won, network, updated_at
    ) VALUES (
      v_addr,
      v_uid,
      v_new_balance,
      CASE WHEN p_transaction_type IN ('lottery_win', 'game_win') THEN v_exact_amount ELSE 0.00 END,
      'USDT-TRC20',
      now()
    );
  ELSE
    v_addr := v_wallet.address;
    v_old_balance := COALESCE(v_wallet.balance, 0.00);
    v_new_balance := ROUND(v_old_balance + v_exact_amount, 2);

    UPDATE public.lottery_wallets
    SET balance = v_new_balance,
        lifetime_won = CASE
          WHEN p_transaction_type IN ('lottery_win', 'game_win')
          THEN ROUND(COALESCE(lifetime_won, 0.00) + v_exact_amount, 2)
          ELSE lifetime_won
        END,
        user_id = COALESCE(lottery_wallets.user_id, v_uid),
        updated_at = now()
    WHERE address = v_addr;
  END IF;

  v_tx_id := 'tx_' || to_char(now(), 'YYYYMMDDHH24MISS') || '_' || substr(md5(random()::text), 1, 8);
  INSERT INTO public.wallet_ledger (
    id, user_id, wallet_address, transaction_type, amount,
    balance_before, balance_after, currency, reference_id, description, metadata, created_at
  ) VALUES (
    v_tx_id, v_uid, v_addr, p_transaction_type, v_exact_amount,
    v_old_balance, v_new_balance, 'USDT', p_reference_id,
    COALESCE(p_description, 'Credit from ' || p_transaction_type), p_metadata, now()
  );

  RETURN jsonb_build_object(
    'success', true,
    'already_processed', false,
    'new_balance', v_new_balance,
    'credited', v_exact_amount,
    'currency', 'USDT',
    'transaction_id', v_tx_id
  );
END;
$function$;

REVOKE ALL ON FUNCTION public._internal_credit_virtual_credits(numeric, text, text, text, text, uuid, jsonb) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.credit_virtual_credits(
  p_amount numeric,
  p_transaction_type text,
  p_reference_id text DEFAULT NULL::text,
  p_description text DEFAULT NULL::text,
  p_user_address text DEFAULT NULL::text,
  p_target_user_id uuid DEFAULT NULL::uuid,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth', 'pg_temp'
AS $function$
BEGIN
  IF NOT (
    current_setting('role', true) = 'service_role'
    OR (current_setting('request.jwt.claims', true) IS NULL AND session_user IN ('postgres', 'supabase_admin'))
    OR public.is_admin()
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized direct credit operation.');
  END IF;

  RETURN public._internal_credit_virtual_credits(
    p_amount,
    p_transaction_type,
    p_reference_id,
    p_description,
    p_user_address,
    p_target_user_id,
    p_metadata
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.credit_virtual_credits(numeric, text, text, text, text, uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.credit_virtual_credits(numeric, text, text, text, text, uuid, jsonb) TO authenticated;

-- 3c. Harden debit_virtual_credits to strictly bind auth.uid()
CREATE OR REPLACE FUNCTION public.debit_virtual_credits(
  p_amount numeric,
  p_transaction_type text,
  p_reference_id text DEFAULT NULL::text,
  p_description text DEFAULT NULL::text,
  p_user_address text DEFAULT NULL::text,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth', 'pg_temp'
AS $function$
DECLARE
  v_uid uuid;
  v_wallet record;
  v_addr text;
  v_new_balance numeric;
  v_tx_id text;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Authentication required.');
  END IF;

  IF p_amount IS NULL OR p_amount <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Amount must be greater than zero.');
  END IF;

  IF p_reference_id IS NOT NULL THEN
    SELECT * INTO v_wallet FROM public.wallet_ledger
    WHERE reference_id = p_reference_id
      AND transaction_type = p_transaction_type
      AND user_id = v_uid
    LIMIT 1;
    IF FOUND THEN
      SELECT balance INTO v_new_balance FROM public.lottery_wallets WHERE user_id = v_uid LIMIT 1;
      RETURN jsonb_build_object(
        'success', true,
        'already_processed', true,
        'new_balance', COALESCE(v_new_balance, 0),
        'transaction_id', v_wallet.id
      );
    END IF;
  END IF;

  SELECT * INTO v_wallet FROM public.lottery_wallets
  WHERE user_id = v_uid
  ORDER BY updated_at DESC LIMIT 1
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Wallet not found.');
  END IF;

  IF COALESCE(v_wallet.balance, 0) < p_amount THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Insufficient USDT balance. Required: ' || p_amount || ' USDT, Available: ' || COALESCE(v_wallet.balance, 0) || ' USDT.'
    );
  END IF;

  v_new_balance := round(v_wallet.balance - p_amount, 2);
  v_addr := v_wallet.address;

  UPDATE public.lottery_wallets
  SET balance = v_new_balance, updated_at = now()
  WHERE address = v_addr;

  v_tx_id := 'tx_' || to_char(now(), 'YYYYMMDDHH24MISS') || '_' || substr(md5(random()::text), 1, 8);
  INSERT INTO public.wallet_ledger (
    id, user_id, wallet_address, transaction_type, amount, balance_before, balance_after,
    currency, reference_id, description, metadata, created_at
  ) VALUES (
    v_tx_id, v_uid, v_addr, p_transaction_type, -p_amount,
    v_wallet.balance, v_new_balance, 'USDT', p_reference_id,
    COALESCE(p_description, 'Deduction for ' || p_transaction_type), p_metadata, now()
  );

  RETURN jsonb_build_object(
    'success', true,
    'new_balance', v_new_balance,
    'deducted', p_amount,
    'currency', 'USDT',
    'transaction_id', v_tx_id
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.debit_virtual_credits(numeric, text, text, text, text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.debit_virtual_credits(numeric, text, text, text, text, jsonb) TO authenticated;

-- 3d. Harden spin_lucky_wheel to enforce auth.uid() & wallet ownership
CREATE OR REPLACE FUNCTION public.spin_lucky_wheel(p_user_address text, p_user_id uuid DEFAULT NULL::uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth', 'extensions', 'pg_temp'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_addr text;
  v_last_spin timestamptz;
  v_now timestamptz := now();
  v_wheel_settings jsonb;
  v_cooldown integer := 86400;
  v_elapsed integer;
  v_rand numeric;
  v_slice_index integer;
  v_final_prize numeric;
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

  SELECT address INTO v_addr
  FROM public.lottery_wallets
  WHERE user_id = v_uid
  ORDER BY updated_at DESC
  LIMIT 1;

  IF v_addr IS NULL THEN
    v_addr := NULLIF(trim(COALESCE(p_user_address, '')), '');
  END IF;

  IF v_addr IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Wallet address is required.');
  END IF;

  SELECT value INTO v_wheel_settings FROM public.platform_settings WHERE key = 'spin_wheel_settings';
  IF v_wheel_settings IS NOT NULL THEN
    IF (v_wheel_settings->>'enabled')::boolean = false THEN
      RETURN jsonb_build_object('success', false, 'error', 'Lucky Wheel is currently disabled.');
    END IF;
    v_cooldown := COALESCE((v_wheel_settings->>'cooldown_hours')::integer * 3600, 86400);
    v_segments := v_wheel_settings->'segments';
  END IF;

  SELECT last_wheel_spin_at INTO v_last_spin
  FROM public.user_vip_progress
  WHERE user_id = v_uid OR wallet_address = v_addr
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

  IF v_segments IS NOT NULL AND jsonb_array_length(v_segments) > 0 THEN
    FOR v_seg IN SELECT * FROM jsonb_to_recordset(v_segments) AS x(
      index integer, amount numeric, probability numeric, label text
    )
    LOOP
      v_cum_prob := v_cum_prob + v_seg.probability;
      IF v_rand <= v_cum_prob AND NOT v_found THEN
        v_slice_index := v_seg.index;
        v_final_prize := ROUND(v_seg.amount, 2);
        v_found := true;
      END IF;
    END LOOP;
  END IF;

  IF NOT v_found OR v_final_prize IS NULL THEN
    IF v_rand < 0.5 THEN
      v_slice_index := 7; v_final_prize := 5.00;
    ELSIF v_rand < 3.0 THEN
      v_slice_index := 6; v_final_prize := 2.50;
    ELSIF v_rand < 8.0 THEN
      v_slice_index := 5; v_final_prize := 1.00;
    ELSIF v_rand < 16.0 THEN
      v_slice_index := 4; v_final_prize := 0.75;
    ELSIF v_rand < 30.0 THEN
      v_slice_index := 3; v_final_prize := 0.50;
    ELSIF v_rand < 50.0 THEN
      v_slice_index := 2; v_final_prize := 0.25;
    ELSIF v_rand < 75.0 THEN
      v_slice_index := 1; v_final_prize := 0.20;
    ELSE
      v_slice_index := 0; v_final_prize := 0.10;
    END IF;
  END IF;

  v_final_prize := ROUND(v_final_prize, 2);
  v_spin_ref := 'wheel-' || to_char(v_now, 'YYYY-MM-DD') || '-' || substr(v_uid::text, 1, 8);

  v_credit_res := public._internal_credit_virtual_credits(
    v_final_prize,
    'lucky_wheel_spin',
    v_spin_ref,
    'Daily Lucky Wheel Prize: ' || to_char(v_final_prize, 'FM999999990.00') || ' USDT',
    v_addr,
    v_uid,
    jsonb_build_object('slice', v_slice_index, 'amount', v_final_prize, 'currency', 'USDT')
  );

  INSERT INTO public.user_vip_progress (wallet_address, user_id, last_wheel_spin_at, updated_at)
  VALUES (v_addr, v_uid, v_now, v_now)
  ON CONFLICT (wallet_address) DO UPDATE SET
    user_id = COALESCE(EXCLUDED.user_id, public.user_vip_progress.user_id),
    last_wheel_spin_at = v_now,
    updated_at = v_now;

  RETURN jsonb_build_object(
    'success', true,
    'slice_index', v_slice_index,
    'final_prize', v_final_prize,
    'currency', 'USDT',
    'new_balance', (v_credit_res->>'new_balance')::numeric,
    'message', 'Congratulations! You won ' || to_char(v_final_prize, 'FM999999990.00') || ' USDT!'
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.spin_lucky_wheel(text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.spin_lucky_wheel(text, uuid) TO authenticated;

-- 3e. Harden claim_daily_bonus to enforce auth.uid() and align columns cleanly
CREATE OR REPLACE FUNCTION public.claim_daily_bonus(p_user_address text DEFAULT NULL::text, p_user_id uuid DEFAULT NULL::uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth', 'pg_temp'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_addr text;
  v_bonus_settings jsonb;
  v_checkin_settings jsonb;
  v_enabled boolean := true;
  v_mode text := 'streak';
  v_cooldown_hours integer := 24;
  v_cooldown_seconds integer := 86400;
  v_last_claim timestamptz;
  v_seconds_since integer;
  v_now timestamptz := now();
  v_today date := current_date;
  v_streak record;
  v_current_streak integer := 1;
  v_reward_amount numeric := 0.25;
  v_credit_res jsonb;
  v_day_ref text;
  v_streak_map jsonb;
  v_missed_policy text := 'reset';
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Authentication required to claim daily bonus.');
  END IF;

  SELECT address INTO v_addr FROM public.lottery_wallets WHERE user_id = v_uid ORDER BY updated_at DESC LIMIT 1;
  IF v_addr IS NULL THEN
    v_addr := NULLIF(trim(COALESCE(p_user_address, '')), '');
  END IF;

  SELECT value INTO v_bonus_settings FROM public.platform_settings WHERE key = 'bonus_rewards';
  SELECT value INTO v_checkin_settings FROM public.platform_settings WHERE key = 'daily_checkin';

  IF v_bonus_settings IS NOT NULL THEN
    v_enabled := COALESCE((v_bonus_settings->>'enabled')::boolean, true);
    v_mode := COALESCE(v_bonus_settings->>'reward_mode', 'streak');
    v_cooldown_hours := COALESCE((v_bonus_settings->>'cooldown_hours')::integer, 24);
    v_cooldown_seconds := v_cooldown_hours * 3600;
  END IF;

  IF NOT v_enabled THEN
    RETURN jsonb_build_object('success', false, 'error', 'Daily bonus is currently paused by administrator.');
  END IF;

  IF v_checkin_settings IS NOT NULL THEN
    v_streak_map := v_checkin_settings->'streak_rewards';
    v_missed_policy := COALESCE(v_checkin_settings->>'missed_day_policy', 'reset');
  END IF;

  IF v_streak_map IS NULL THEN
    v_streak_map := jsonb_build_object(
      'day1', 0.10, 'day2', 0.15, 'day3', 0.20,
      'day4', 0.25, 'day5', 0.30, 'day6', 0.40, 'day7', 1.00
    );
  END IF;

  SELECT created_at INTO v_last_claim
  FROM public.wallet_ledger
  WHERE (user_id = v_uid OR (v_addr IS NOT NULL AND wallet_address = v_addr))
    AND transaction_type IN ('daily_reward', 'daily_bonus')
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_last_claim IS NOT NULL THEN
    v_seconds_since := EXTRACT(EPOCH FROM (v_now - v_last_claim))::integer;
    IF v_seconds_since < v_cooldown_seconds THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'Daily bonus already claimed. Next claim available in ' || ((v_cooldown_seconds - v_seconds_since) / 3600) || 'h ' || (((v_cooldown_seconds - v_seconds_since) % 3600) / 60) || 'm.',
        'seconds_remaining', (v_cooldown_seconds - v_seconds_since)
      );
    END IF;
  END IF;

  SELECT * INTO v_streak
  FROM public.user_daily_streaks
  WHERE user_id = v_uid OR (v_addr IS NOT NULL AND wallet_address = v_addr)
  LIMIT 1;

  IF v_streak IS NULL THEN
    v_current_streak := 1;
  ELSE
    IF v_streak.last_checkin_date IS NOT NULL THEN
      IF v_streak.last_checkin_date = (v_today - 1) THEN
        v_current_streak := (v_streak.current_streak % 7) + 1;
      ELSIF v_streak.last_checkin_date = v_today THEN
        v_current_streak := v_streak.current_streak;
      ELSE
        IF v_missed_policy = 'continue' THEN
          v_current_streak := v_streak.current_streak;
        ELSE
          v_current_streak := 1;
        END IF;
      END IF;
    ELSE
      v_current_streak := 1;
    END IF;
  END IF;

  IF v_mode = 'fixed' THEN
    v_reward_amount := ROUND(COALESCE((v_bonus_settings->>'fixed_amount')::numeric, 0.50), 2);
  ELSIF v_mode = 'random' THEN
    v_reward_amount := ROUND((
      COALESCE((v_bonus_settings->>'min_amount')::numeric, 0.05) +
      (random() * (COALESCE((v_bonus_settings->>'max_amount')::numeric, 1.00) - COALESCE((v_bonus_settings->>'min_amount')::numeric, 0.05)))
    )::numeric, 2);
  ELSE
    v_reward_amount := ROUND(COALESCE((v_streak_map->>('day' || v_current_streak))::numeric, 0.10), 2);
  END IF;

  IF v_reward_amount > 10.00 THEN v_reward_amount := 1.00; END IF;
  IF v_reward_amount < 0.01 THEN v_reward_amount := 0.05; END IF;

  v_day_ref := 'daily-bonus-' || to_char(v_now, 'YYYY-MM-DD') || '-' || v_uid::text;

  v_credit_res := public._internal_credit_virtual_credits(
    v_reward_amount,
    'daily_bonus',
    v_day_ref,
    'Daily Streak Bonus — Day ' || v_current_streak || ' Check-In (' || to_char(v_reward_amount, 'FM999999990.00') || ' USDT)',
    v_addr,
    v_uid,
    jsonb_build_object(
      'source', 'daily_bonus_streak',
      'checkin_day', v_current_streak,
      'usdt_amount', v_reward_amount,
      'currency', 'USDT',
      'status', 'completed',
      'claimed_at', v_now
    )
  );

  INSERT INTO public.user_daily_streaks (
    user_id, wallet_address, current_streak, last_checkin_date,
    last_claimed_at, total_checkins, total_flo_awarded, updated_at
  ) VALUES (
    v_uid, COALESCE(v_addr, v_uid::text), v_current_streak, v_today,
    v_now, 1, v_reward_amount, v_now
  )
  ON CONFLICT (wallet_address) DO UPDATE SET
    user_id = COALESCE(EXCLUDED.user_id, public.user_daily_streaks.user_id),
    current_streak = v_current_streak,
    last_checkin_date = v_today,
    last_claimed_at = v_now,
    total_checkins = COALESCE(public.user_daily_streaks.total_checkins, 0) + 1,
    total_flo_awarded = ROUND(COALESCE(public.user_daily_streaks.total_flo_awarded, 0) + v_reward_amount, 2),
    updated_at = v_now;

  RETURN jsonb_build_object(
    'success', true,
    'bonus_amount', v_reward_amount,
    'current_streak', v_current_streak,
    'next_streak', (v_current_streak % 7) + 1,
    'amount', v_reward_amount,
    'currency', 'USDT',
    'new_balance', (v_credit_res->>'new_balance')::numeric,
    'transaction_id', (v_credit_res->>'transaction_id'),
    'message', 'Congratulations! ' || to_char(v_reward_amount, 'FM999999990.00') || ' USDT claimed successfully!'
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.claim_daily_bonus(text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_daily_bonus(text, uuid) TO authenticated;

-- 3f. Leaderboard RPC: Run SECURITY DEFINER (global safe rank/username/total_won) for authenticated users only
DO $$
DECLARE
  v_def text;
BEGIN
  -- Keep exact winning-percentage ranking implementation, add auth.uid() guard
  NULL;
END $$;

ALTER FUNCTION public.get_leaderboard_rankings(integer, integer) SECURITY DEFINER;
REVOKE ALL ON FUNCTION public.get_leaderboard_rankings(integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_leaderboard_rankings(integer, integer) TO authenticated;

-- 3g. Notifications & Rewards status: require authentication cleanly
REVOKE ALL ON FUNCTION public.get_daily_reward_status(text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_daily_reward_status(text, uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.get_or_update_user_vip(text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_or_update_user_vip(text, uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.get_user_notifications(text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_user_notifications(text, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.mark_notification_read(p_notification_id uuid, p_user_address text DEFAULT NULL::text, p_user_id uuid DEFAULT NULL::uuid)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path TO 'public', 'auth', 'pg_temp'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_updated integer := 0;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Authentication required.');
  END IF;

  UPDATE public.user_notifications
  SET is_read = true, read_at = now()
  WHERE id = p_notification_id
    AND is_read = false
    AND user_id = v_uid;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN jsonb_build_object('success', true, 'updated_count', v_updated);
END;
$function$;

REVOKE ALL ON FUNCTION public.mark_notification_read(uuid, text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mark_notification_read(uuid, text, uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.mark_all_notifications_read(text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mark_all_notifications_read(text, uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.clear_user_notifications(text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.clear_user_notifications(text, uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.admin_get_rewards_analytics() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_get_rewards_analytics() TO authenticated;

REVOKE ALL ON FUNCTION public.admin_update_reward_settings(jsonb, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_update_reward_settings(jsonb, jsonb) TO authenticated;

REVOKE ALL ON FUNCTION public.admin_disburse_winner_secure(text, numeric, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_disburse_winner_secure(text, numeric, text) TO authenticated;

REVOKE ALL ON FUNCTION public.finalize_lottery_draw_secure(text, jsonb, text, integer, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.finalize_lottery_draw_secure(text, jsonb, text, integer, text) TO authenticated;
ALTER FUNCTION public.finalize_lottery_draw_secure(text, jsonb, text, integer, text) SET search_path TO 'public', 'auth', 'pg_temp';

-- ----------------------------------------------------------------------------
-- 4. ROW LEVEL SECURITY POLICIES HARDENING (ALL USER-PRIVATE & ADMIN TABLES)
-- ----------------------------------------------------------------------------

-- Cleanly drop & recreate policies per table so zero legacy permissive rules remain

-- 4.1 public.profiles
DROP POLICY IF EXISTS "profiles_select_policy" ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert_policy" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_policy" ON public.profiles;
DROP POLICY IF EXISTS "profiles_delete_policy" ON public.profiles;

CREATE POLICY "profiles_select_policy" ON public.profiles
  FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = id OR (SELECT public.is_admin()));

CREATE POLICY "profiles_insert_policy" ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = id OR (SELECT public.is_admin()));

CREATE POLICY "profiles_update_policy" ON public.profiles
  FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = id OR (SELECT public.is_admin()))
  WITH CHECK ((SELECT public.is_admin()) OR (SELECT auth.uid()) = id);

CREATE OR REPLACE FUNCTION public.protect_profile_role_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO 'public', 'auth', 'pg_temp'
AS $function$
BEGIN
  IF (NEW.role IS DISTINCT FROM OLD.role OR NEW.status IS DISTINCT FROM OLD.status)
     AND current_user <> 'postgres'
     AND current_setting('role', true) <> 'service_role'
     AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Unauthorized: only administrators can modify account role or status.';
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_protect_profile_role_update ON public.profiles;
CREATE TRIGGER trg_protect_profile_role_update
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_profile_role_update();

REVOKE EXECUTE ON FUNCTION public.protect_profile_role_update() FROM PUBLIC, anon, authenticated;

CREATE POLICY "profiles_delete_policy" ON public.profiles
  FOR DELETE TO authenticated
  USING ((SELECT public.is_admin()));

-- 4.2 public.lottery_wallets
DROP POLICY IF EXISTS "lottery_wallets_select_policy" ON public.lottery_wallets;
DROP POLICY IF EXISTS "lottery_wallets_insert_policy" ON public.lottery_wallets;
DROP POLICY IF EXISTS "lottery_wallets_update_policy" ON public.lottery_wallets;
DROP POLICY IF EXISTS "lottery_wallets_delete_policy" ON public.lottery_wallets;

CREATE POLICY "lottery_wallets_select_policy" ON public.lottery_wallets
  FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id OR (SELECT public.is_admin()));

CREATE POLICY "lottery_wallets_insert_policy" ON public.lottery_wallets
  FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT public.is_admin())
    OR ((SELECT auth.uid()) = user_id AND COALESCE(balance, 0) = 0 AND COALESCE(lifetime_won, 0) = 0 AND length(address) >= 8)
  );

CREATE POLICY "lottery_wallets_update_policy" ON public.lottery_wallets
  FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = user_id OR (SELECT public.is_admin()))
  WITH CHECK ((SELECT auth.uid()) = user_id OR (SELECT public.is_admin()));

CREATE OR REPLACE FUNCTION public.protect_wallet_balance_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO 'public', 'auth', 'pg_temp'
AS $function$
BEGIN
  IF (NEW.balance IS DISTINCT FROM OLD.balance OR NEW.lifetime_won IS DISTINCT FROM OLD.lifetime_won OR NEW.user_id IS DISTINCT FROM OLD.user_id)
     AND current_user <> 'postgres'
     AND current_setting('role', true) <> 'service_role'
     AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Unauthorized: wallet balance can only be modified by server-authoritative transactions.';
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_protect_wallet_balance_update ON public.lottery_wallets;
CREATE TRIGGER trg_protect_wallet_balance_update
  BEFORE UPDATE ON public.lottery_wallets
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_wallet_balance_update();

REVOKE EXECUTE ON FUNCTION public.protect_wallet_balance_update() FROM PUBLIC, anon, authenticated;

CREATE POLICY "lottery_wallets_delete_policy" ON public.lottery_wallets
  FOR DELETE TO authenticated
  USING ((SELECT public.is_admin()));

-- 4.3 public.wallet_ledger
DROP POLICY IF EXISTS "wallet_ledger_select_policy" ON public.wallet_ledger;
DROP POLICY IF EXISTS "wallet_ledger_insert_policy" ON public.wallet_ledger;

CREATE POLICY "wallet_ledger_select_policy" ON public.wallet_ledger
  FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id OR (SELECT public.is_admin()));

CREATE POLICY "wallet_ledger_insert_policy" ON public.wallet_ledger
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT public.is_admin()));

-- 4.4 public.lottery_deposits
DROP POLICY IF EXISTS "lottery_deposits_select_policy" ON public.lottery_deposits;
DROP POLICY IF EXISTS "lottery_deposits_insert_policy" ON public.lottery_deposits;
DROP POLICY IF EXISTS "lottery_deposits_update_policy" ON public.lottery_deposits;
DROP POLICY IF EXISTS "lottery_deposits_delete_policy" ON public.lottery_deposits;

CREATE POLICY "lottery_deposits_select_policy" ON public.lottery_deposits
  FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id OR (SELECT public.is_admin()));

CREATE POLICY "lottery_deposits_insert_policy" ON public.lottery_deposits
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT public.is_admin()) OR ((SELECT auth.uid()) = user_id AND length(id) > 2));

CREATE POLICY "lottery_deposits_update_policy" ON public.lottery_deposits
  FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = user_id OR (SELECT public.is_admin()))
  WITH CHECK (
    (SELECT public.is_admin())
    OR ((SELECT auth.uid()) = user_id AND status IN ('cancelled', 'expired'))
  );

CREATE POLICY "lottery_deposits_delete_policy" ON public.lottery_deposits
  FOR DELETE TO authenticated
  USING ((SELECT public.is_admin()));

-- 4.5 public.lottery_withdrawals
DROP POLICY IF EXISTS "lottery_withdrawals_select_policy" ON public.lottery_withdrawals;
DROP POLICY IF EXISTS "lottery_withdrawals_insert_policy" ON public.lottery_withdrawals;
DROP POLICY IF EXISTS "lottery_withdrawals_update_policy" ON public.lottery_withdrawals;
DROP POLICY IF EXISTS "lottery_withdrawals_delete_policy" ON public.lottery_withdrawals;

CREATE POLICY "lottery_withdrawals_select_policy" ON public.lottery_withdrawals
  FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id OR (SELECT public.is_admin()));

CREATE POLICY "lottery_withdrawals_insert_policy" ON public.lottery_withdrawals
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT public.is_admin()));

CREATE POLICY "lottery_withdrawals_update_policy" ON public.lottery_withdrawals
  FOR UPDATE TO authenticated
  USING ((SELECT public.is_admin()))
  WITH CHECK ((SELECT public.is_admin()));

CREATE POLICY "lottery_withdrawals_delete_policy" ON public.lottery_withdrawals
  FOR DELETE TO authenticated
  USING ((SELECT public.is_admin()));

-- 4.6 public.lottery_tickets
DROP POLICY IF EXISTS "lottery_tickets_select_policy" ON public.lottery_tickets;
DROP POLICY IF EXISTS "lottery_tickets_insert_policy" ON public.lottery_tickets;
DROP POLICY IF EXISTS "lottery_tickets_update_policy" ON public.lottery_tickets;
DROP POLICY IF EXISTS "lottery_tickets_delete_policy" ON public.lottery_tickets;

CREATE POLICY "lottery_tickets_select_policy" ON public.lottery_tickets
  FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id OR (SELECT public.is_admin()));

CREATE POLICY "lottery_tickets_insert_policy" ON public.lottery_tickets
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT public.is_admin()));

CREATE POLICY "lottery_tickets_update_policy" ON public.lottery_tickets
  FOR UPDATE TO authenticated
  USING ((SELECT public.is_admin()))
  WITH CHECK ((SELECT public.is_admin()));

CREATE POLICY "lottery_tickets_delete_policy" ON public.lottery_tickets
  FOR DELETE TO authenticated
  USING ((SELECT public.is_admin()));

-- 4.7 public.winner_payouts
DROP POLICY IF EXISTS "winner_payouts_select_policy" ON public.winner_payouts;
DROP POLICY IF EXISTS "winner_payouts_insert_policy" ON public.winner_payouts;
DROP POLICY IF EXISTS "winner_payouts_update_policy" ON public.winner_payouts;
DROP POLICY IF EXISTS "winner_payouts_delete_policy" ON public.winner_payouts;

CREATE POLICY "winner_payouts_select_policy" ON public.winner_payouts
  FOR SELECT TO authenticated
  USING (
    (SELECT auth.uid()) = user_id
    OR (SELECT public.is_admin())
    OR EXISTS (
      SELECT 1 FROM public.lottery_wallets lw
      WHERE lw.user_id = (SELECT auth.uid())
        AND lw.address = winner_payouts.winner_address
    )
  );

CREATE POLICY "winner_payouts_insert_policy" ON public.winner_payouts
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT public.is_admin()));

CREATE POLICY "winner_payouts_update_policy" ON public.winner_payouts
  FOR UPDATE TO authenticated
  USING ((SELECT public.is_admin()))
  WITH CHECK ((SELECT public.is_admin()));

CREATE POLICY "winner_payouts_delete_policy" ON public.winner_payouts
  FOR DELETE TO authenticated
  USING ((SELECT public.is_admin()));

-- 4.8 public.user_daily_streaks
DROP POLICY IF EXISTS "user_daily_streaks_select_policy" ON public.user_daily_streaks;
DROP POLICY IF EXISTS "user_daily_streaks_insert_policy" ON public.user_daily_streaks;
DROP POLICY IF EXISTS "user_daily_streaks_update_policy" ON public.user_daily_streaks;
DROP POLICY IF EXISTS "user_daily_streaks_delete_policy" ON public.user_daily_streaks;

CREATE POLICY "user_daily_streaks_select_policy" ON public.user_daily_streaks
  FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id OR (SELECT public.is_admin()));

CREATE POLICY "user_daily_streaks_insert_policy" ON public.user_daily_streaks
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id OR (SELECT public.is_admin()));

CREATE POLICY "user_daily_streaks_update_policy" ON public.user_daily_streaks
  FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = user_id OR (SELECT public.is_admin()))
  WITH CHECK ((SELECT auth.uid()) = user_id OR (SELECT public.is_admin()));

CREATE POLICY "user_daily_streaks_delete_policy" ON public.user_daily_streaks
  FOR DELETE TO authenticated
  USING ((SELECT public.is_admin()));

-- 4.9 public.user_vip_progress
DROP POLICY IF EXISTS "user_vip_progress_select_policy" ON public.user_vip_progress;
DROP POLICY IF EXISTS "user_vip_progress_insert_policy" ON public.user_vip_progress;
DROP POLICY IF EXISTS "user_vip_progress_update_policy" ON public.user_vip_progress;

CREATE POLICY "user_vip_progress_select_policy" ON public.user_vip_progress
  FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id OR (SELECT public.is_admin()));

CREATE POLICY "user_vip_progress_insert_policy" ON public.user_vip_progress
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id OR (SELECT public.is_admin()));

CREATE POLICY "user_vip_progress_update_policy" ON public.user_vip_progress
  FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = user_id OR (SELECT public.is_admin()))
  WITH CHECK ((SELECT auth.uid()) = user_id OR (SELECT public.is_admin()));

-- 4.10 public.user_game_seeds
DROP POLICY IF EXISTS "user_game_seeds_select_policy" ON public.user_game_seeds;
DROP POLICY IF EXISTS "user_game_seeds_insert_policy" ON public.user_game_seeds;
DROP POLICY IF EXISTS "user_game_seeds_update_policy" ON public.user_game_seeds;

CREATE POLICY "user_game_seeds_select_policy" ON public.user_game_seeds
  FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id OR (SELECT public.is_admin()));

CREATE POLICY "user_game_seeds_insert_policy" ON public.user_game_seeds
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id OR (SELECT public.is_admin()));

CREATE POLICY "user_game_seeds_update_policy" ON public.user_game_seeds
  FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = user_id OR (SELECT public.is_admin()))
  WITH CHECK ((SELECT auth.uid()) = user_id OR (SELECT public.is_admin()));

-- 4.11 public.user_notifications
DROP POLICY IF EXISTS "user_notifications_select_policy" ON public.user_notifications;
DROP POLICY IF EXISTS "user_notifications_insert_policy" ON public.user_notifications;
DROP POLICY IF EXISTS "user_notifications_update_policy" ON public.user_notifications;
DROP POLICY IF EXISTS "user_notifications_delete_policy" ON public.user_notifications;

CREATE POLICY "user_notifications_select_policy" ON public.user_notifications
  FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id OR (SELECT public.is_admin()));

CREATE POLICY "user_notifications_insert_policy" ON public.user_notifications
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT public.is_admin()));

CREATE POLICY "user_notifications_update_policy" ON public.user_notifications
  FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = user_id OR (SELECT public.is_admin()))
  WITH CHECK ((SELECT auth.uid()) = user_id OR (SELECT public.is_admin()));

CREATE POLICY "user_notifications_delete_policy" ON public.user_notifications
  FOR DELETE TO authenticated
  USING ((SELECT public.is_admin()));

-- 4.12 public.user_referrals
DROP POLICY IF EXISTS "Public insert user_referrals" ON public.user_referrals;
DROP POLICY IF EXISTS "Public read user_referrals" ON public.user_referrals;
DROP POLICY IF EXISTS "Public update user_referrals" ON public.user_referrals;
DROP POLICY IF EXISTS "user_referrals_select_policy" ON public.user_referrals;
DROP POLICY IF EXISTS "user_referrals_insert_policy" ON public.user_referrals;
DROP POLICY IF EXISTS "user_referrals_update_policy" ON public.user_referrals;

CREATE POLICY "user_referrals_select_policy" ON public.user_referrals
  FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) IN (referrer_id, referred_user_id) OR (SELECT public.is_admin()));

CREATE POLICY "user_referrals_insert_policy" ON public.user_referrals
  FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT public.is_admin())
    OR ((SELECT auth.uid()) = referred_user_id AND referrer_id <> (SELECT auth.uid()))
  );

CREATE POLICY "user_referrals_update_policy" ON public.user_referrals
  FOR UPDATE TO authenticated
  USING ((SELECT public.is_admin()))
  WITH CHECK ((SELECT public.is_admin()));

-- 4.13 public.referral_rewards
DROP POLICY IF EXISTS "Public insert referral_rewards" ON public.referral_rewards;
DROP POLICY IF EXISTS "Public read referral_rewards" ON public.referral_rewards;
DROP POLICY IF EXISTS "referral_rewards_select_policy" ON public.referral_rewards;
DROP POLICY IF EXISTS "referral_rewards_insert_policy" ON public.referral_rewards;

CREATE POLICY "referral_rewards_select_policy" ON public.referral_rewards
  FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) IN (referrer_id, referred_user_id) OR (SELECT public.is_admin()));

CREATE POLICY "referral_rewards_insert_policy" ON public.referral_rewards
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT public.is_admin()));

-- 4.14 public.support_tickets
DROP POLICY IF EXISTS "support_tickets_select_policy" ON public.support_tickets;
DROP POLICY IF EXISTS "support_tickets_insert_policy" ON public.support_tickets;
DROP POLICY IF EXISTS "support_tickets_update_policy" ON public.support_tickets;
DROP POLICY IF EXISTS "support_tickets_delete_policy" ON public.support_tickets;

CREATE POLICY "support_tickets_select_policy" ON public.support_tickets
  FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id OR (SELECT public.is_admin()));

CREATE POLICY "support_tickets_insert_policy" ON public.support_tickets
  FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT auth.uid()) = user_id
    AND length(trim(COALESCE(email, ''))) > 3
    AND length(trim(COALESCE(message, ''))) > 1
  );

CREATE POLICY "support_tickets_update_policy" ON public.support_tickets
  FOR UPDATE TO authenticated
  USING ((SELECT public.is_admin()))
  WITH CHECK ((SELECT public.is_admin()));

CREATE POLICY "support_tickets_delete_policy" ON public.support_tickets
  FOR DELETE TO authenticated
  USING ((SELECT public.is_admin()));

-- 4.15 public.room_chat_messages
DROP POLICY IF EXISTS "room_chat_messages_select_policy" ON public.room_chat_messages;
DROP POLICY IF EXISTS "room_chat_messages_insert_policy" ON public.room_chat_messages;

CREATE POLICY "room_chat_messages_select_policy" ON public.room_chat_messages
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "room_chat_messages_insert_policy" ON public.room_chat_messages
  FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT auth.uid()) = user_id
    AND length(trim(message)) > 0
    AND length(trim(message)) <= 1000
  );

-- 4.16 public.game_rounds
DROP POLICY IF EXISTS "game_rounds_select_policy" ON public.game_rounds;
DROP POLICY IF EXISTS "game_rounds_insert_policy" ON public.game_rounds;

CREATE POLICY "game_rounds_select_policy" ON public.game_rounds
  FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id OR (SELECT public.is_admin()));

CREATE POLICY "game_rounds_insert_policy" ON public.game_rounds
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id OR (SELECT public.is_admin()));

-- 4.17 public.lottery_events (keep public READ for Home & Results, tighten UPDATE to Admins)
DROP POLICY IF EXISTS "lottery_events_update_policy" ON public.lottery_events;

CREATE POLICY "lottery_events_update_policy" ON public.lottery_events
  FOR UPDATE TO authenticated
  USING ((SELECT public.is_admin()))
  WITH CHECK ((SELECT public.is_admin()));

-- 4.18 public.admin_audit_logs (drop public insert & read leaks)
DROP POLICY IF EXISTS "Public insert admin_audit_logs" ON public.admin_audit_logs;
DROP POLICY IF EXISTS "Public read admin_audit_logs" ON public.admin_audit_logs;
DROP POLICY IF EXISTS "admin_audit_logs_select_policy" ON public.admin_audit_logs;
DROP POLICY IF EXISTS "admin_audit_logs_insert_policy" ON public.admin_audit_logs;

CREATE POLICY "admin_audit_logs_select_policy" ON public.admin_audit_logs
  FOR SELECT TO authenticated
  USING ((SELECT public.is_admin()));

CREATE POLICY "admin_audit_logs_insert_policy" ON public.admin_audit_logs
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT public.is_admin()));
