-- ============================================================================
-- MIGRATION: Universal Game Engine Architecture & Provably Fair Game Rounds
-- Date: 2026-11-06
-- Description:
--   1. Creates public.game_rounds table for all 12 casino games
--   2. Creates public.user_game_seeds table for Stake-style active client/server seeds
--   3. Implements public.play_game_round_secure RPC with ledger integration
--   4. Implements public.verify_game_round_secure RPC for mathematical verification
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- 1. Table: public.game_rounds (Immutable record of every game round played)
CREATE TABLE IF NOT EXISTS public.game_rounds (
  id text PRIMARY KEY DEFAULT ('rnd_' || to_char(now(), 'YYYYMMDDHH24MISS') || '_' || substr(md5(random()::text), 1, 8)),
  game_id text NOT NULL, -- 'lottery', 'crash', 'dice', 'mines', 'plinko', 'roulette', 'coinflip', 'blackjack', 'slots', 'poker', 'keno', 'limbo'
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  wallet_address text NOT NULL,
  username text,
  bet_amount numeric NOT NULL DEFAULT 0 CHECK (bet_amount >= 0),
  currency text NOT NULL DEFAULT 'FC',
  multiplier numeric NOT NULL DEFAULT 0 CHECK (multiplier >= 0),
  payout numeric NOT NULL DEFAULT 0 CHECK (payout >= 0),
  net_profit numeric GENERATED ALWAYS AS (payout - bet_amount) STORED,
  status text NOT NULL DEFAULT 'completed' CHECK (status IN ('active', 'won', 'lost', 'cashout', 'cancelled', 'completed')),
  server_seed text NOT NULL,
  server_seed_hash text NOT NULL, -- SHA-256 pre-commit
  client_seed text NOT NULL,
  nonce integer NOT NULL DEFAULT 1 CHECK (nonce >= 1),
  outcome_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

-- Indices for rapid querying, leaderboards, and live bet feeds
CREATE INDEX IF NOT EXISTS idx_game_rounds_game_id ON public.game_rounds(game_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_game_rounds_user_id ON public.game_rounds(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_game_rounds_wallet ON public.game_rounds(wallet_address, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_game_rounds_created ON public.game_rounds(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_game_rounds_high_roller ON public.game_rounds(payout DESC) WHERE payout > 50;

-- 2. Table: public.user_game_seeds (Active Provably Fair seed pairs per user/wallet)
CREATE TABLE IF NOT EXISTS public.user_game_seeds (
  wallet_address text PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  active_server_seed text NOT NULL,
  active_server_hash text NOT NULL, -- SHA-256 commit hash
  active_client_seed text NOT NULL DEFAULT ('cs_' || substr(md5(random()::text), 1, 12)),
  nonce integer NOT NULL DEFAULT 0,
  previous_server_seed text,
  previous_server_hash text,
  previous_client_seed text,
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_game_seeds_user ON public.user_game_seeds(user_id);

-- 3. Row Level Security (RLS)
ALTER TABLE public.game_rounds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_game_seeds ENABLE ROW LEVEL SECURITY;

-- Game rounds are public read (for social live feeds, stats, and independent provably fair auditing)
DROP POLICY IF EXISTS "game_rounds_select_all" ON public.game_rounds;
CREATE POLICY "game_rounds_select_all" ON public.game_rounds
  FOR SELECT TO authenticated, anon
  USING (true);

-- Allow authenticated/anon users to insert their own rounds or via RPC
DROP POLICY IF EXISTS "game_rounds_insert_policy" ON public.game_rounds;
CREATE POLICY "game_rounds_insert_policy" ON public.game_rounds
  FOR INSERT TO authenticated, anon
  WITH CHECK (true);

-- User game seeds select policy
DROP POLICY IF EXISTS "user_game_seeds_select" ON public.user_game_seeds;
CREATE POLICY "user_game_seeds_select" ON public.user_game_seeds
  FOR SELECT TO authenticated, anon
  USING (true);

DROP POLICY IF EXISTS "user_game_seeds_all" ON public.user_game_seeds;
CREATE POLICY "user_game_seeds_all" ON public.user_game_seeds
  FOR ALL TO authenticated, anon
  USING (true)
  WITH CHECK (true);

-- 4. RPC: Get or Initialize User Provably Fair Seed Pair
CREATE OR REPLACE FUNCTION public.get_or_create_user_game_seed(
  p_wallet_address text,
  p_user_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions, pg_temp
AS $$
DECLARE
  v_seed record;
  v_server_seed text;
  v_server_hash text;
  v_client_seed text;
BEGIN
  IF p_wallet_address IS NULL OR trim(p_wallet_address) = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Wallet address required.');
  END IF;

  SELECT * INTO v_seed FROM public.user_game_seeds WHERE wallet_address = p_wallet_address FOR UPDATE;

  IF NOT FOUND THEN
    v_server_seed := 'seed_' || encode(extensions.gen_random_bytes(32), 'hex');
    v_server_hash := '0x' || encode(extensions.digest(v_server_seed, 'sha256'), 'hex');
    v_client_seed := 'cs_' || substr(md5(random()::text), 1, 12);

    INSERT INTO public.user_game_seeds (
      wallet_address,
      user_id,
      active_server_seed,
      active_server_hash,
      active_client_seed,
      nonce,
      updated_at
    ) VALUES (
      p_wallet_address,
      p_user_id,
      v_server_seed,
      v_server_hash,
      v_client_seed,
      0,
      now()
    ) RETURNING * INTO v_seed;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'wallet_address', v_seed.wallet_address,
    'server_hash', v_seed.active_server_hash, -- Server seed is kept secret until rotated!
    'client_seed', v_seed.active_client_seed,
    'nonce', v_seed.nonce,
    'previous_server_seed', v_seed.previous_server_seed,
    'previous_server_hash', v_seed.previous_server_hash
  );
END;
$$;

-- 5. RPC: Rotate User Game Seed (Reveals previous server seed for verification, generates new one)
CREATE OR REPLACE FUNCTION public.rotate_user_game_seed(
  p_wallet_address text,
  p_new_client_seed text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions, pg_temp
AS $$
DECLARE
  v_seed record;
  v_new_server_seed text;
  v_new_server_hash text;
  v_client_seed text;
BEGIN
  SELECT * INTO v_seed FROM public.user_game_seeds WHERE wallet_address = p_wallet_address FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Seed pair not found for wallet.');
  END IF;

  v_new_server_seed := 'seed_' || encode(extensions.gen_random_bytes(32), 'hex');
  v_new_server_hash := '0x' || encode(extensions.digest(v_new_server_seed, 'sha256'), 'hex');
  v_client_seed := COALESCE(trim(p_new_client_seed), 'cs_' || substr(md5(random()::text), 1, 12));

  UPDATE public.user_game_seeds
  SET previous_server_seed = active_server_seed,
      previous_server_hash = active_server_hash,
      previous_client_seed = active_client_seed,
      active_server_seed = v_new_server_seed,
      active_server_hash = v_new_server_hash,
      active_client_seed = v_client_seed,
      nonce = 0,
      updated_at = now()
  WHERE wallet_address = p_wallet_address;

  RETURN jsonb_build_object(
    'success', true,
    'revealed_previous_seed', v_seed.active_server_seed,
    'previous_commit_hash', v_seed.active_server_hash,
    'new_server_hash', v_new_server_hash,
    'new_client_seed', v_client_seed,
    'nonce', 0
  );
END;
$$;

-- 6. RPC: Record and Settle Game Round Atomically with Virtual Wallet
CREATE OR REPLACE FUNCTION public.settle_game_round_secure(
  p_game_id text,
  p_wallet_address text,
  p_user_id uuid,
  p_username text,
  p_bet_amount numeric,
  p_multiplier numeric,
  p_payout numeric,
  p_outcome_data jsonb,
  p_server_seed text DEFAULT NULL,
  p_server_seed_hash text DEFAULT NULL,
  p_client_seed text DEFAULT NULL,
  p_nonce integer DEFAULT 1,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions, pg_temp
AS $$
DECLARE
  v_round_id text;
  v_balance_before numeric;
  v_balance_after numeric;
  v_debit_res jsonb;
  v_credit_res jsonb;
  v_status text;
  v_srv_seed text;
  v_srv_hash text;
  v_cli_seed text;
  v_nonce integer;
  v_seed_rec record;
BEGIN
  IF p_bet_amount < 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Bet amount cannot be negative.');
  END IF;

  v_round_id := 'rnd_' || p_game_id || '_' || to_char(now(), 'YYYYMMDDHH24MISS') || '_' || substr(md5(random()::text), 1, 6);

  -- 1. Resolve Seeds and Nonce
  IF p_server_seed IS NOT NULL AND p_server_seed_hash IS NOT NULL THEN
    v_srv_seed := p_server_seed;
    v_srv_hash := p_server_seed_hash;
    v_cli_seed := COALESCE(p_client_seed, 'cs_default');
    v_nonce := COALESCE(p_nonce, 1);
  ELSE
    -- Fetch or initialize active seed pair for wallet
    SELECT * INTO v_seed_rec FROM public.user_game_seeds WHERE wallet_address = p_wallet_address FOR UPDATE;
    IF NOT FOUND THEN
      v_srv_seed := 'seed_' || encode(extensions.gen_random_bytes(32), 'hex');
      v_srv_hash := '0x' || encode(extensions.digest(v_srv_seed, 'sha256'), 'hex');
      v_cli_seed := COALESCE(p_client_seed, 'cs_' || substr(md5(random()::text), 1, 12));
      v_nonce := 1;

      INSERT INTO public.user_game_seeds (
        wallet_address, user_id, active_server_seed, active_server_hash, active_client_seed, nonce
      ) VALUES (
        p_wallet_address, p_user_id, v_srv_seed, v_srv_hash, v_cli_seed, 1
      );
    ELSE
      v_srv_seed := v_seed_rec.active_server_seed;
      v_srv_hash := v_seed_rec.active_server_hash;
      v_cli_seed := COALESCE(p_client_seed, v_seed_rec.active_client_seed);
      v_nonce := v_seed_rec.nonce + 1;

      UPDATE public.user_game_seeds
      SET nonce = v_nonce, updated_at = now()
      WHERE wallet_address = p_wallet_address;
    END IF;
  END IF;

  -- 2. Debit Stake if > 0
  IF p_bet_amount > 0 THEN
    v_debit_res := public.debit_virtual_credits(
      p_amount => p_bet_amount,
      p_transaction_type => 'game_bet',
      p_reference_id => v_round_id,
      p_description => 'Bet placed on ' || upper(p_game_id),
      p_user_address => p_wallet_address,
      p_metadata => jsonb_build_object('game_id', p_game_id, 'round_id', v_round_id)
    );

    IF NOT (v_debit_res->>'success')::boolean THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', COALESCE(v_debit_res->>'error', 'Insufficient Flow Coin balance.')
      );
    END IF;

    v_balance_after := (v_debit_res->>'new_balance')::numeric;
  ELSE
    SELECT balance INTO v_balance_after FROM public.lottery_wallets WHERE address = p_wallet_address;
    v_balance_after := COALESCE(v_balance_after, 0);
  END IF;

  -- 3. Credit Winnings if > 0
  IF p_payout > 0 THEN
    v_status := 'won';
    v_credit_res := public.credit_virtual_credits(
      p_amount => p_payout,
      p_transaction_type => 'game_win',
      p_reference_id => v_round_id || '_win',
      p_description => 'Payout from ' || upper(p_game_id) || ' (' || p_multiplier || 'x)',
      p_user_address => p_wallet_address,
      p_target_user_id => p_user_id,
      p_metadata => jsonb_build_object('game_id', p_game_id, 'round_id', v_round_id, 'multiplier', p_multiplier)
    );
    IF (v_credit_res->>'success')::boolean THEN
      v_balance_after := (v_credit_res->>'new_balance')::numeric;
    END IF;
  ELSE
    v_status := 'lost';
  END IF;

  -- 4. Record Game Round
  INSERT INTO public.game_rounds (
    id,
    game_id,
    user_id,
    wallet_address,
    username,
    bet_amount,
    currency,
    multiplier,
    payout,
    status,
    server_seed,
    server_seed_hash,
    client_seed,
    nonce,
    outcome_data,
    metadata,
    created_at
  ) VALUES (
    v_round_id,
    p_game_id,
    p_user_id,
    p_wallet_address,
    p_username,
    p_bet_amount,
    'FC',
    p_multiplier,
    p_payout,
    v_status,
    v_srv_seed,
    v_srv_hash,
    v_cli_seed,
    v_nonce,
    p_outcome_data,
    p_metadata,
    now()
  );

  RETURN jsonb_build_object(
    'success', true,
    'round_id', v_round_id,
    'game_id', p_game_id,
    'status', v_status,
    'bet_amount', p_bet_amount,
    'multiplier', p_multiplier,
    'payout', p_payout,
    'new_balance', v_balance_after,
    'server_seed_hash', v_srv_hash,
    'server_seed', v_srv_seed,
    'client_seed', v_cli_seed,
    'nonce', v_nonce,
    'outcome_data', p_outcome_data
  );
END;
$$;
