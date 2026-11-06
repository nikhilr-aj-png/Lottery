-- ====================================================================
-- Phase 2 Migration: Virtual Wallet Ledger & Flow Coin Architecture
-- ====================================================================

-- 1. Create wallet_ledger table for immutable audit tracking
CREATE TABLE IF NOT EXISTS public.wallet_ledger (
  id text PRIMARY KEY DEFAULT ('tx_' || to_char(now(), 'YYYYMMDDHH24MISS') || '_' || substr(md5(random()::text), 1, 8)),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  wallet_address text NOT NULL,
  transaction_type text NOT NULL, -- 'welcome_grant', 'daily_bonus', 'ticket_purchase', 'lottery_win', 'game_bet', 'game_win', 'admin_adjustment', 'username_fee'
  amount numeric NOT NULL, -- negative for debit, positive for credit
  balance_before numeric NOT NULL,
  balance_after numeric NOT NULL,
  currency text NOT NULL DEFAULT 'Flow Coin',
  reference_id text, -- unique event/ticket/round/order reference
  description text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

-- Index for speedy user ledger queries
CREATE INDEX IF NOT EXISTS idx_wallet_ledger_user ON public.wallet_ledger(user_id);
CREATE INDEX IF NOT EXISTS idx_wallet_ledger_addr ON public.wallet_ledger(wallet_address);
CREATE INDEX IF NOT EXISTS idx_wallet_ledger_created ON public.wallet_ledger(created_at DESC);

-- Unique constraint for idempotency on reference_id + transaction_type (when reference_id is provided)
CREATE UNIQUE INDEX IF NOT EXISTS idx_wallet_ledger_idempotency 
  ON public.wallet_ledger(reference_id, transaction_type) 
  WHERE reference_id IS NOT NULL;

-- 2. Configure Row Level Security (RLS) on wallet_ledger
ALTER TABLE public.wallet_ledger ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "wallet_ledger_select_policy" ON public.wallet_ledger;
CREATE POLICY "wallet_ledger_select_policy" ON public.wallet_ledger
  FOR SELECT TO authenticated, anon
  USING (
    (auth.uid() IS NOT NULL AND auth.uid() = user_id) OR
    (SELECT public.is_admin())
  );

-- Revoke direct inserts/updates/deletes from client roles; mutations only via SECURITY DEFINER functions
REVOKE INSERT, UPDATE, DELETE ON public.wallet_ledger FROM anon, authenticated, PUBLIC;

-- 3. Atomic Virtual Credit Debit RPC (Used by Games, Lottery, Username fee)
CREATE OR REPLACE FUNCTION public.debit_virtual_credits(
  p_amount numeric,
  p_transaction_type text,
  p_reference_id text DEFAULT NULL,
  p_description text DEFAULT NULL,
  p_user_address text DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_uid uuid;
  v_wallet record;
  v_addr text;
  v_new_balance numeric;
  v_tx_id text;
BEGIN
  v_uid := auth.uid();
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Amount must be greater than zero.');
  END IF;

  -- 1. Idempotency check: if this reference was already debited, prevent double-charge
  IF p_reference_id IS NOT NULL THEN
    SELECT * INTO v_wallet FROM public.wallet_ledger 
    WHERE reference_id = p_reference_id AND transaction_type = p_transaction_type 
    LIMIT 1;
    IF FOUND THEN
      SELECT balance INTO v_new_balance FROM public.lottery_wallets WHERE (v_uid IS NOT NULL AND user_id = v_uid) OR address = p_user_address LIMIT 1;
      RETURN jsonb_build_object(
        'success', true, 
        'already_processed', true, 
        'new_balance', COALESCE(v_new_balance, 0),
        'transaction_id', v_wallet.id
      );
    END IF;
  END IF;

  -- 2. Lock user wallet with FOR UPDATE
  SELECT * INTO v_wallet FROM public.lottery_wallets 
  WHERE (v_uid IS NOT NULL AND user_id = v_uid) OR (p_user_address IS NOT NULL AND address = p_user_address)
  ORDER BY updated_at DESC LIMIT 1
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Wallet not found.');
  END IF;

  IF COALESCE(v_wallet.balance, 0) < p_amount THEN
    RETURN jsonb_build_object(
      'success', false, 
      'error', 'Insufficient Flow Coins. Required: ' || p_amount || ' FC, Available: ' || COALESCE(v_wallet.balance, 0) || ' FC.'
    );
  END IF;

  -- 3. Deduct balance atomically
  v_new_balance := round(v_wallet.balance - p_amount, 2);
  v_addr := v_wallet.address;

  UPDATE public.lottery_wallets
  SET balance = v_new_balance, updated_at = now()
  WHERE address = v_addr;

  -- 4. Record in immutable ledger
  v_tx_id := 'tx_' || to_char(now(), 'YYYYMMDDHH24MISS') || '_' || substr(md5(random()::text), 1, 8);
  INSERT INTO public.wallet_ledger (
    id,
    user_id,
    wallet_address,
    transaction_type,
    amount,
    balance_before,
    balance_after,
    currency,
    reference_id,
    description,
    metadata,
    created_at
  ) VALUES (
    v_tx_id,
    COALESCE(v_wallet.user_id, v_uid),
    v_addr,
    p_transaction_type,
    -p_amount,
    v_wallet.balance,
    v_new_balance,
    'Flow Coin',
    p_reference_id,
    COALESCE(p_description, 'Deduction for ' || p_transaction_type),
    p_metadata,
    now()
  );

  RETURN jsonb_build_object(
    'success', true,
    'new_balance', v_new_balance,
    'deducted', p_amount,
    'transaction_id', v_tx_id
  );
END;
$$;

-- 4. Atomic Virtual Credit Credit RPC (Used by Games wins, Lottery payouts, Daily bonus, Grants)
CREATE OR REPLACE FUNCTION public.credit_virtual_credits(
  p_amount numeric,
  p_transaction_type text,
  p_reference_id text DEFAULT NULL,
  p_description text DEFAULT NULL,
  p_user_address text DEFAULT NULL,
  p_target_user_id uuid DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_uid uuid;
  v_wallet record;
  v_addr text;
  v_old_balance numeric := 0;
  v_new_balance numeric;
  v_tx_id text;
BEGIN
  v_uid := COALESCE(p_target_user_id, auth.uid());

  IF p_amount IS NULL OR p_amount <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Amount must be greater than zero.');
  END IF;

  -- 1. Idempotency check: if this reference was already credited, prevent duplicate payouts
  IF p_reference_id IS NOT NULL THEN
    SELECT * INTO v_wallet FROM public.wallet_ledger 
    WHERE reference_id = p_reference_id AND transaction_type = p_transaction_type 
    LIMIT 1;
    IF FOUND THEN
      SELECT balance INTO v_new_balance FROM public.lottery_wallets WHERE (v_uid IS NOT NULL AND user_id = v_uid) OR address = p_user_address LIMIT 1;
      RETURN jsonb_build_object(
        'success', true, 
        'already_processed', true, 
        'new_balance', COALESCE(v_new_balance, 0),
        'transaction_id', v_wallet.id
      );
    END IF;
  END IF;

  -- 2. Find or create user wallet
  SELECT * INTO v_wallet FROM public.lottery_wallets 
  WHERE (v_uid IS NOT NULL AND user_id = v_uid) OR (p_user_address IS NOT NULL AND address = p_user_address)
  ORDER BY updated_at DESC LIMIT 1
  FOR UPDATE;

  IF NOT FOUND THEN
    -- Generate fresh wallet address if not provided
    v_addr := COALESCE(p_user_address, '0x' || substr(md5(random()::text || clock_timestamp()::text), 1, 40));
    v_old_balance := 0;
    v_new_balance := round(p_amount, 2);

    INSERT INTO public.lottery_wallets (
      address,
      user_id,
      balance,
      lifetime_won,
      network,
      updated_at
    ) VALUES (
      v_addr,
      v_uid,
      v_new_balance,
      CASE WHEN p_transaction_type IN ('lottery_win', 'game_win') THEN p_amount ELSE 0 END,
      'FC-Virtual',
      now()
    );
  ELSE
    v_addr := v_wallet.address;
    v_old_balance := COALESCE(v_wallet.balance, 0);
    v_new_balance := round(v_old_balance + p_amount, 2);

    UPDATE public.lottery_wallets
    SET balance = v_new_balance,
        lifetime_won = CASE 
          WHEN p_transaction_type IN ('lottery_win', 'game_win') 
          THEN round(COALESCE(lifetime_won, 0) + p_amount, 2)
          ELSE lifetime_won 
        END,
        user_id = COALESCE(lottery_wallets.user_id, v_uid),
        updated_at = now()
    WHERE address = v_addr;
  END IF;

  -- 3. Record in immutable ledger
  v_tx_id := 'tx_' || to_char(now(), 'YYYYMMDDHH24MISS') || '_' || substr(md5(random()::text), 1, 8);
  INSERT INTO public.wallet_ledger (
    id,
    user_id,
    wallet_address,
    transaction_type,
    amount,
    balance_before,
    balance_after,
    currency,
    reference_id,
    description,
    metadata,
    created_at
  ) VALUES (
    v_tx_id,
    v_uid,
    v_addr,
    p_transaction_type,
    p_amount,
    v_old_balance,
    v_new_balance,
    'Flow Coin',
    p_reference_id,
    COALESCE(p_description, 'Credit from ' || p_transaction_type),
    p_metadata,
    now()
  );

  RETURN jsonb_build_object(
    'success', true,
    'new_balance', v_new_balance,
    'credited', p_amount,
    'transaction_id', v_tx_id
  );
END;
$$;

-- 5. Daily Free Flow Coin Bonus Claim RPC (100 Flow Coins every 24 hours)
CREATE OR REPLACE FUNCTION public.claim_daily_bonus(
  p_user_address text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_uid uuid;
  v_last_claim timestamptz;
  v_now timestamptz := now();
  v_cooldown_seconds integer := 86400; -- 24 hours
  v_seconds_since_last integer;
  v_bonus_amount numeric := 100.00;
  v_credit_res jsonb;
  v_day_ref text;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL AND p_user_address IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Authentication required to claim daily Flow Coins.');
  END IF;

  -- Check last claim
  SELECT created_at INTO v_last_claim 
  FROM public.wallet_ledger 
  WHERE ((v_uid IS NOT NULL AND user_id = v_uid) OR wallet_address = p_user_address)
    AND transaction_type = 'daily_bonus'
  ORDER BY created_at DESC 
  LIMIT 1;

  IF v_last_claim IS NOT NULL THEN
    v_seconds_since_last := EXTRACT(EPOCH FROM (v_now - v_last_claim))::integer;
    IF v_seconds_since_last < v_cooldown_seconds THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'Daily bonus already claimed. Please return in ' || ((v_cooldown_seconds - v_seconds_since_last) / 3600) || ' hour(s).',
        'seconds_remaining', (v_cooldown_seconds - v_seconds_since_last)
      );
    END IF;
  END IF;

  -- Use date string as idempotency reference (e.g. daily-2026-11-06-uid)
  v_day_ref := 'daily-' || to_char(v_now, 'YYYY-MM-DD') || '-' || COALESCE(v_uid::text, p_user_address);

  -- Credit daily bonus
  v_credit_res := public.credit_virtual_credits(
    v_bonus_amount,
    'daily_bonus',
    v_day_ref,
    'Free Daily Social Grant: 100 Flow Coins',
    p_user_address,
    v_uid,
    jsonb_build_object('source', 'daily_faucet')
  );

  RETURN jsonb_build_object(
    'success', true,
    'bonus_amount', v_bonus_amount,
    'new_balance', (v_credit_res->>'new_balance')::numeric,
    'message', 'Congratulations! 100 Flow Coins added to your wallet.'
  );
END;
$$;

-- 6. Upgrade buy_lottery_tickets_secure with ledger recording and Flow Coin messaging
CREATE OR REPLACE FUNCTION public.buy_lottery_tickets_secure(
  p_event_id text,
  p_ticket_numbers text[],
  p_user_address text,
  p_username text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
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
BEGIN
  v_uid := auth.uid();
  v_num_tickets := array_length(p_ticket_numbers, 1);
  
  IF v_num_tickets IS NULL OR v_num_tickets <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'No ticket numbers provided.');
  END IF;

  -- 1. Fetch and lock event
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

  -- 2. Check if any ticket number is already sold
  FOREACH v_num IN ARRAY p_ticket_numbers LOOP
    IF EXISTS (
      SELECT 1 FROM public.lottery_tickets 
      WHERE event_id = p_event_id AND lpad(ticket_number, 4, '0') = lpad(v_num, 4, '0')
    ) THEN
      RETURN jsonb_build_object('success', false, 'error', 'Ticket #' || lpad(v_num, 4, '0') || ' is already taken. Please choose another combination.');
    END IF;
  END LOOP;

  -- 3. Calculate total cost
  v_total_cost := v_event.ticket_price * v_num_tickets;

  -- 4. Find & lock user wallet
  SELECT * INTO v_wallet FROM public.lottery_wallets 
  WHERE (v_uid IS NOT NULL AND user_id = v_uid) OR (address = p_user_address)
  ORDER BY updated_at DESC LIMIT 1
  FOR UPDATE;

  IF NOT FOUND OR COALESCE(v_wallet.balance, 0) < v_total_cost THEN
    RETURN jsonb_build_object(
      'success', false, 
      'error', 'Insufficient Flow Coins. Required: ' || v_total_cost || ' FC, Available: ' || COALESCE(v_wallet.balance, 0) || ' FC.'
    );
  END IF;

  -- 5. Deduct wallet balance
  v_new_balance := round(v_wallet.balance - v_total_cost, 2);
  UPDATE public.lottery_wallets
  SET balance = v_new_balance, updated_at = now()
  WHERE address = v_wallet.address;

  v_now_ms := (EXTRACT(EPOCH FROM now()) * 1000)::bigint;
  v_order_ref := 'tkt-order-' || v_now_ms || '-' || floor(random() * 8999 + 1000)::text;
  v_user_display := COALESCE(p_username, '@' || substring(p_user_address from 1 for 6));

  -- 6. Insert tickets
  FOREACH v_num IN ARRAY p_ticket_numbers LOOP
    v_ticket_id := 'tkt-' || v_now_ms || '-' || floor(random() * 8999 + 1000)::text || '-' || floor(random() * 899 + 100)::text;
    INSERT INTO public.lottery_tickets (
      id,
      user_id,
      user_address,
      username,
      event_id,
      event_title,
      ticket_number,
      price,
      purchase_time,
      status,
      match_tier,
      won_amount,
      claimed,
      created_at
    ) VALUES (
      v_ticket_id,
      COALESCE(v_wallet.user_id, v_uid),
      v_wallet.address,
      v_user_display,
      p_event_id,
      v_event.title,
      lpad(v_num, 4, '0'),
      v_event.ticket_price,
      v_now_ms,
      'active',
      NULL,
      0,
      false,
      now()
    );
  END LOOP;

  -- 7. Update event stats
  UPDATE public.lottery_events
  SET pool_prize = round(pool_prize + (v_total_cost * 0.95), 2),
      tickets_sold = COALESCE(tickets_sold, 0) + v_num_tickets,
      participants_count = COALESCE(participants_count, 0) + 1
  WHERE id = p_event_id;

  -- 8. Record in wallet_ledger
  v_tx_id := 'tx_' || to_char(now(), 'YYYYMMDDHH24MISS') || '_' || substr(md5(random()::text), 1, 8);
  INSERT INTO public.wallet_ledger (
    id,
    user_id,
    wallet_address,
    transaction_type,
    amount,
    balance_before,
    balance_after,
    currency,
    reference_id,
    description,
    metadata,
    created_at
  ) VALUES (
    v_tx_id,
    COALESCE(v_wallet.user_id, v_uid),
    v_wallet.address,
    'ticket_purchase',
    -v_total_cost,
    v_wallet.balance,
    v_new_balance,
    'Flow Coin',
    v_order_ref,
    'Purchased ' || v_num_tickets || ' ticket(s) for ' || v_event.title,
    jsonb_build_object('event_id', p_event_id, 'tickets_count', v_num_tickets),
    now()
  );

  RETURN jsonb_build_object(
    'success', true,
    'new_balance', v_new_balance,
    'tickets_bought', v_num_tickets,
    'total_spent', v_total_cost,
    'transaction_id', v_tx_id
  );
END;
$$;

-- 7. Upgrade admin_disburse_winner_secure with wallet_ledger recording
CREATE OR REPLACE FUNCTION public.admin_disburse_winner_secure(
  p_payout_id text,
  p_final_amount numeric,
  p_tx_hash text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_payout record;
  v_target_address text;
  v_hash text;
  v_wallet record;
  v_old_balance numeric := 0;
  v_new_balance numeric;
  v_tx_id text;
BEGIN
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized: Admin role required.');
  END IF;

  SELECT * INTO v_payout FROM public.winner_payouts WHERE id = p_payout_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Payout record not found.');
  END IF;

  IF v_payout.status = 'completed' THEN
    RETURN jsonb_build_object('success', true, 'already_completed', true, 'message', 'Payout was already processed.');
  END IF;

  v_target_address := v_payout.winner_address;
  v_hash := COALESCE(p_tx_hash, 'FC-' || md5(random()::text || clock_timestamp()::text));

  -- Lock wallet
  SELECT * INTO v_wallet FROM public.lottery_wallets WHERE address = v_target_address FOR UPDATE;
  IF NOT FOUND THEN
    v_old_balance := 0;
    v_new_balance := p_final_amount;
    INSERT INTO public.lottery_wallets (address, user_id, balance, lifetime_won, network, updated_at)
    VALUES (v_target_address, v_payout.user_id, v_new_balance, p_final_amount, 'FC-Virtual', now());
  ELSE
    v_old_balance := COALESCE(v_wallet.balance, 0);
    v_new_balance := round(v_old_balance + p_final_amount, 2);
    UPDATE public.lottery_wallets
    SET balance = v_new_balance,
        lifetime_won = round(COALESCE(lifetime_won, 0) + p_final_amount, 2),
        updated_at = now()
    WHERE address = v_target_address;
  END IF;

  -- Mark payout completed
  UPDATE public.winner_payouts
  SET status = 'completed',
      payout_amount = p_final_amount,
      tx_hash = v_hash,
      approved_at = now()
  WHERE id = p_payout_id;

  -- Mark ticket claimed if exists
  IF v_payout.ticket_id IS NOT NULL AND v_payout.ticket_id <> 'MANUAL' THEN
    UPDATE public.lottery_tickets
    SET claimed = true, won_amount = p_final_amount
    WHERE id = v_payout.ticket_id;
  END IF;

  -- Record in wallet_ledger
  v_tx_id := 'tx_' || to_char(now(), 'YYYYMMDDHH24MISS') || '_' || substr(md5(random()::text), 1, 8);
  INSERT INTO public.wallet_ledger (
    id,
    user_id,
    wallet_address,
    transaction_type,
    amount,
    balance_before,
    balance_after,
    currency,
    reference_id,
    description,
    metadata,
    created_at
  ) VALUES (
    v_tx_id,
    v_payout.user_id,
    v_target_address,
    'lottery_win',
    p_final_amount,
    v_old_balance,
    v_new_balance,
    'Flow Coin',
    p_payout_id,
    'Lottery Winner Prize Disbursement: ' || COALESCE(v_payout.event_title, 'Pool Prize'),
    jsonb_build_object('event_id', v_payout.event_id, 'ticket_id', v_payout.ticket_id),
    now()
  );

  RETURN jsonb_build_object(
    'success', true,
    'payout_id', p_payout_id,
    'credited_amount', p_final_amount,
    'new_balance', v_new_balance,
    'tx_hash', v_hash,
    'transaction_id', v_tx_id
  );
END;
$$;

-- 8. Give starting welcome grant (500 Flow Coins) to any existing wallet with 0 balance
DO $$
DECLARE
  wal record;
  v_tx_id text;
BEGIN
  FOR wal IN SELECT * FROM public.lottery_wallets WHERE balance = 0 LOOP
    UPDATE public.lottery_wallets 
    SET balance = 500.00, updated_at = now() 
    WHERE address = wal.address;

    v_tx_id := 'tx_' || to_char(now(), 'YYYYMMDDHH24MISS') || '_' || substr(md5(random()::text), 1, 8);
    INSERT INTO public.wallet_ledger (
      id, user_id, wallet_address, transaction_type, amount, balance_before, balance_after, currency, reference_id, description, created_at
    ) VALUES (
      v_tx_id, wal.user_id, wal.address, 'welcome_grant', 500.00, 0, 500.00, 'Flow Coin', 'welcome-' || wal.address, 'Welcome Bonus: 500 Free Flow Coins', now()
    ) ON CONFLICT DO NOTHING;
  END LOOP;
END;
$$;

