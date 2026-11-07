-- ============================================================================
-- MIGRATION: LIVE LEADERBOARD, VIP LOYALTY PROGRESSION & DAILY LUCKY WHEEL
-- ============================================================================

-- 1. Create user_vip_progress table
CREATE TABLE IF NOT EXISTS public.user_vip_progress (
  wallet_address text PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  username text,
  total_wagered numeric DEFAULT 0,
  total_rounds_played integer DEFAULT 0,
  xp_points numeric DEFAULT 0,
  current_tier text DEFAULT 'Bronze',
  tier_level integer DEFAULT 1,
  faucet_multiplier numeric DEFAULT 1.0,
  last_wheel_spin_at timestamptz,
  last_daily_claim_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_user_vip_progress_xp ON public.user_vip_progress(xp_points DESC);
CREATE INDEX IF NOT EXISTS idx_user_vip_progress_user_id ON public.user_vip_progress(user_id);

-- Enable RLS
ALTER TABLE public.user_vip_progress ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view VIP leaderboard data" ON public.user_vip_progress;
CREATE POLICY "Public can view VIP leaderboard data"
  ON public.user_vip_progress FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Users can upsert own VIP data" ON public.user_vip_progress;
CREATE POLICY "Users can upsert own VIP data"
  ON public.user_vip_progress FOR ALL
  USING (auth.uid() = user_id OR auth.uid() IS NULL);

-- ============================================================================
-- 2. RPC: get_or_update_user_vip
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_or_update_user_vip(
  p_wallet_address text,
  p_user_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth', 'pg_temp'
AS $$
DECLARE
  v_uid uuid := COALESCE(p_user_id, auth.uid());
  v_uname text;
  v_game_wagered numeric := 0;
  v_game_rounds integer := 0;
  v_ticket_wagered numeric := 0;
  v_ticket_count integer := 0;
  v_total_wagered numeric := 0;
  v_total_rounds integer := 0;
  v_xp numeric := 0;
  v_tier text := 'Bronze';
  v_tier_level integer := 1;
  v_multiplier numeric := 1.0;
  v_next_tier text := 'Silver';
  v_target_xp numeric := 1000;
  v_base_xp numeric := 0;
  v_progress_pct numeric := 0;
  v_last_wheel timestamptz;
  v_last_claim timestamptz;
  v_rec record;
BEGIN
  IF p_wallet_address IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Wallet address is required');
  END IF;

  -- Get username
  SELECT username INTO v_uname FROM public.profiles 
  WHERE trc20_address = p_wallet_address OR (v_uid IS NOT NULL AND id = v_uid) 
  LIMIT 1;

  -- Aggregate Game Rounds
  SELECT 
    COALESCE(SUM(bet_amount), 0),
    COUNT(*)
  INTO v_game_wagered, v_game_rounds
  FROM public.game_rounds
  WHERE wallet_address = p_wallet_address OR (v_uid IS NOT NULL AND user_id = v_uid);

  -- Aggregate Lottery Tickets
  SELECT 
    COALESCE(COUNT(*) * 10.0, 0),
    COUNT(*)
  INTO v_ticket_wagered, v_ticket_count
  FROM public.lottery_tickets
  WHERE user_address = p_wallet_address OR (v_uid IS NOT NULL AND user_id = v_uid);

  v_total_wagered := v_game_wagered + v_ticket_wagered;
  v_total_rounds := v_game_rounds + v_ticket_count;
  v_xp := v_total_wagered * 10; -- 1 FC = 10 XP

  -- Calculate Tier & Multipliers
  IF v_xp >= 500000 THEN
    v_tier := 'Obsidian';
    v_tier_level := 6;
    v_multiplier := 3.0;
    v_next_tier := 'Max Tier';
    v_base_xp := 500000;
    v_target_xp := 500000;
    v_progress_pct := 100;
  ELSIF v_xp >= 100000 THEN
    v_tier := 'Diamond';
    v_tier_level := 5;
    v_multiplier := 2.0;
    v_next_tier := 'Obsidian';
    v_base_xp := 100000;
    v_target_xp := 500000;
    v_progress_pct := LEAST(100, ROUND(((v_xp - v_base_xp) / (v_target_xp - v_base_xp)) * 100, 1));
  ELSIF v_xp >= 20000 THEN
    v_tier := 'Platinum';
    v_tier_level := 4;
    v_multiplier := 1.5;
    v_next_tier := 'Diamond';
    v_base_xp := 20000;
    v_target_xp := 100000;
    v_progress_pct := LEAST(100, ROUND(((v_xp - v_base_xp) / (v_target_xp - v_base_xp)) * 100, 1));
  ELSIF v_xp >= 5000 THEN
    v_tier := 'Gold';
    v_tier_level := 3;
    v_multiplier := 1.25;
    v_next_tier := 'Platinum';
    v_base_xp := 5000;
    v_target_xp := 20000;
    v_progress_pct := LEAST(100, ROUND(((v_xp - v_base_xp) / (v_target_xp - v_base_xp)) * 100, 1));
  ELSIF v_xp >= 1000 THEN
    v_tier := 'Silver';
    v_tier_level := 2;
    v_multiplier := 1.1;
    v_next_tier := 'Gold';
    v_base_xp := 1000;
    v_target_xp := 5000;
    v_progress_pct := LEAST(100, ROUND(((v_xp - v_base_xp) / (v_target_xp - v_base_xp)) * 100, 1));
  ELSE
    v_tier := 'Bronze';
    v_tier_level := 1;
    v_multiplier := 1.0;
    v_next_tier := 'Silver';
    v_base_xp := 0;
    v_target_xp := 1000;
    v_progress_pct := LEAST(100, ROUND((v_xp / v_target_xp) * 100, 1));
  END IF;

  -- Upsert into user_vip_progress
  INSERT INTO public.user_vip_progress (
    wallet_address,
    user_id,
    username,
    total_wagered,
    total_rounds_played,
    xp_points,
    current_tier,
    tier_level,
    faucet_multiplier,
    updated_at
  ) VALUES (
    p_wallet_address,
    v_uid,
    COALESCE(v_uname, 'Player_' || substring(p_wallet_address from 3 for 6)),
    v_total_wagered,
    v_total_rounds,
    v_xp,
    v_tier,
    v_tier_level,
    v_multiplier,
    now()
  )
  ON CONFLICT (wallet_address) DO UPDATE SET
    user_id = COALESCE(EXCLUDED.user_id, public.user_vip_progress.user_id),
    username = COALESCE(EXCLUDED.username, public.user_vip_progress.username),
    total_wagered = EXCLUDED.total_wagered,
    total_rounds_played = EXCLUDED.total_rounds_played,
    xp_points = EXCLUDED.xp_points,
    current_tier = EXCLUDED.current_tier,
    tier_level = EXCLUDED.tier_level,
    faucet_multiplier = EXCLUDED.faucet_multiplier,
    updated_at = now()
  RETURNING last_wheel_spin_at, last_daily_claim_at INTO v_last_wheel, v_last_claim;

  RETURN jsonb_build_object(
    'success', true,
    'wallet_address', p_wallet_address,
    'username', COALESCE(v_uname, 'Player'),
    'current_tier', v_tier,
    'tier_level', v_tier_level,
    'total_wagered', v_total_wagered,
    'total_rounds', v_total_rounds,
    'xp_points', v_xp,
    'faucet_multiplier', v_multiplier,
    'next_tier', v_next_tier,
    'target_xp', v_target_xp,
    'progress_pct', v_progress_pct,
    'last_wheel_spin_at', v_last_wheel,
    'last_daily_claim_at', v_last_claim
  );
END;
$$;

-- ============================================================================
-- 3. RPC: spin_lucky_wheel
-- ============================================================================
CREATE OR REPLACE FUNCTION public.spin_lucky_wheel(
  p_user_address text,
  p_user_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth', 'pg_temp'
AS $$
DECLARE
  v_uid uuid := COALESCE(p_user_id, auth.uid());
  v_last_spin timestamptz;
  v_now timestamptz := now();
  v_cooldown integer := 86400; -- 24 hours
  v_elapsed integer;
  v_rand numeric;
  v_slice_index integer;
  v_base_prize numeric;
  v_multiplier numeric := 1.0;
  v_final_prize numeric;
  v_tier text := 'Bronze';
  v_spin_ref text;
  v_credit_res jsonb;
BEGIN
  IF p_user_address IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Wallet address is required');
  END IF;

  -- Check cooldown from user_vip_progress or wallet_ledger
  SELECT last_wheel_spin_at INTO v_last_spin 
  FROM public.user_vip_progress 
  WHERE wallet_address = p_user_address;

  IF v_last_spin IS NULL THEN
    SELECT created_at INTO v_last_spin
    FROM public.wallet_ledger
    WHERE wallet_address = p_user_address AND transaction_type = 'lucky_wheel_spin'
    ORDER BY created_at DESC LIMIT 1;
  END IF;

  IF v_last_spin IS NOT NULL THEN
    v_elapsed := EXTRACT(EPOCH FROM (v_now - v_last_spin))::integer;
    IF v_elapsed < v_cooldown THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'Lucky Wheel on 24-hour cooldown. Return in ' || ((v_cooldown - v_elapsed) / 3600) || ' hour(s).',
        'seconds_remaining', (v_cooldown - v_elapsed)
      );
    END IF;
  END IF;

  -- Fetch current VIP multiplier
  SELECT faucet_multiplier, current_tier 
  INTO v_multiplier, v_tier
  FROM public.user_vip_progress 
  WHERE wallet_address = p_user_address;

  IF v_multiplier IS NULL THEN
    v_multiplier := 1.0;
    v_tier := 'Bronze';
  END IF;

  -- Deterministic random prize slice calculation
  -- Slices: [50, 100, 150, 200, 250, 300, 500, 1000]
  v_rand := random() * 100.0;

  IF v_rand < 0.5 THEN
    v_slice_index := 7; v_base_prize := 1000.0; -- 0.5% Jackpot
  ELSIF v_rand < 3.0 THEN
    v_slice_index := 6; v_base_prize := 500.0;  -- 2.5%
  ELSIF v_rand < 8.0 THEN
    v_slice_index := 5; v_base_prize := 300.0;  -- 5.0%
  ELSIF v_rand < 16.0 THEN
    v_slice_index := 4; v_base_prize := 250.0;  -- 8.0%
  ELSIF v_rand < 30.0 THEN
    v_slice_index := 3; v_base_prize := 200.0;  -- 14.0%
  ELSIF v_rand < 50.0 THEN
    v_slice_index := 2; v_base_prize := 150.0;  -- 20.0%
  ELSIF v_rand < 75.0 THEN
    v_slice_index := 1; v_base_prize := 100.0;  -- 25.0%
  ELSE
    v_slice_index := 0; v_base_prize := 50.0;   -- 25.0%
  END IF;

  v_final_prize := ROUND(v_base_prize * v_multiplier, 2);
  v_spin_ref := 'wheel-' || to_char(v_now, 'YYYY-MM-DD') || '-' || substring(p_user_address from 3 for 8);

  -- Credit virtual wallet
  v_credit_res := public.credit_virtual_credits(
    v_final_prize,
    'lucky_wheel_spin',
    v_spin_ref,
    'Daily Lucky Wheel Prize: ' || v_final_prize || ' FC (' || v_tier || ' Tier ' || v_multiplier || 'x)',
    p_user_address,
    v_uid,
    jsonb_build_object('slice', v_slice_index, 'base', v_base_prize, 'vip_mult', v_multiplier)
  );

  -- Upsert last_wheel_spin_at in user_vip_progress
  INSERT INTO public.user_vip_progress (wallet_address, user_id, last_wheel_spin_at, updated_at)
  VALUES (p_user_address, v_uid, v_now, v_now)
  ON CONFLICT (wallet_address) DO UPDATE SET
    last_wheel_spin_at = v_now,
    updated_at = v_now;

  RETURN jsonb_build_object(
    'success', true,
    'slice_index', v_slice_index,
    'base_prize', v_base_prize,
    'vip_multiplier', v_multiplier,
    'final_prize', v_final_prize,
    'vip_tier', v_tier,
    'new_balance', (v_credit_res->>'new_balance')::numeric,
    'message', 'Congratulations! You won ' || v_final_prize || ' Flow Coins!'
  );
END;
$$;

-- ============================================================================
-- 4. RPC: get_game_leaderboard
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_game_leaderboard(
  p_timeframe text DEFAULT 'all',     -- 'today' | 'weekly' | 'all'
  p_metric text DEFAULT 'earnings',   -- 'earnings' | 'multiplier' | 'wagered'
  p_limit integer DEFAULT 25,
  p_game_id text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth', 'pg_temp'
AS $$
DECLARE
  v_since timestamptz := NULL;
  v_rows jsonb;
BEGIN
  IF p_timeframe = 'today' THEN
    v_since := now() - interval '24 hours';
  ELSIF p_timeframe = 'weekly' THEN
    v_since := now() - interval '7 days';
  END IF;

  SELECT jsonb_agg(sub) INTO v_rows FROM (
    SELECT 
      ROW_NUMBER() OVER(
        ORDER BY 
          CASE WHEN p_metric = 'multiplier' THEN MAX(gr.multiplier)
               WHEN p_metric = 'wagered' THEN SUM(gr.bet_amount)
               ELSE SUM(gr.net_profit)
          END DESC
      ) AS rank,
      COALESCE(p.username, gr.username, 'Player_' || substring(gr.wallet_address from 3 for 6)) AS username,
      gr.wallet_address AS address,
      COALESCE(vip.current_tier, 'Bronze') AS vip_tier,
      COALESCE(vip.tier_level, 1) AS vip_level,
      ROUND(SUM(gr.payout), 2) AS total_won_fc,
      ROUND(SUM(gr.net_profit), 2) AS total_net_profit,
      ROUND(SUM(gr.bet_amount), 2) AS total_wagered,
      ROUND(MAX(gr.multiplier), 2) AS biggest_mult,
      COUNT(*)::integer AS rounds_count,
      (MODE() WITHIN GROUP (ORDER BY gr.game_id)) AS fav_game
    FROM public.game_rounds gr
    LEFT JOIN public.profiles p ON p.trc20_address = gr.wallet_address OR (gr.user_id IS NOT NULL AND p.id = gr.user_id)
    LEFT JOIN public.user_vip_progress vip ON vip.wallet_address = gr.wallet_address
    WHERE (v_since IS NULL OR gr.created_at >= v_since)
      AND (p_game_id IS NULL OR gr.game_id = p_game_id)
      AND gr.status = 'settled'
    GROUP BY gr.wallet_address, p.username, gr.username, vip.current_tier, vip.tier_level
    ORDER BY 
      CASE WHEN p_metric = 'multiplier' THEN MAX(gr.multiplier)
           WHEN p_metric = 'wagered' THEN SUM(gr.bet_amount)
           ELSE SUM(gr.net_profit)
      END DESC
    LIMIT p_limit
  ) sub;

  RETURN COALESCE(v_rows, '[]'::jsonb);
END;
$$;
