-- ====================================================================
-- Phase 2 Migration: Dedicated Game Rooms, Tables & Configurations
-- ====================================================================

-- 1. Table: public.game_configurations (Authoritative game settings)
CREATE TABLE IF NOT EXISTS public.game_configurations (
  game_id text PRIMARY KEY,
  game_name text NOT NULL,
  category text NOT NULL,
  is_enabled boolean NOT NULL DEFAULT true,
  min_stake_fc numeric NOT NULL DEFAULT 1 CHECK (min_stake_fc >= 0),
  max_stake_fc numeric NOT NULL DEFAULT 1000 CHECK (max_stake_fc >= min_stake_fc),
  default_stake_fc numeric NOT NULL DEFAULT 10,
  house_edge numeric NOT NULL DEFAULT 1.0,
  rtp numeric NOT NULL DEFAULT 99.0,
  max_multiplier numeric NOT NULL DEFAULT 1000.0,
  rules_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 2. Table: public.game_rooms (Configurable rooms, tables, and sessions)
CREATE TABLE IF NOT EXISTS public.game_rooms (
  id text PRIMARY KEY,
  game_id text NOT NULL,
  room_name text NOT NULL,
  room_type text NOT NULL DEFAULT 'standard', -- 'casual', 'standard', 'high_roller', 'vip', 'turbo'
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'waiting', 'running', 'paused', 'completed', 'disabled')),
  description text,
  min_stake_fc numeric NOT NULL DEFAULT 1 CHECK (min_stake_fc >= 0),
  max_stake_fc numeric NOT NULL DEFAULT 1000 CHECK (max_stake_fc >= min_stake_fc),
  player_capacity integer NOT NULL DEFAULT 100 CHECK (player_capacity >= 1),
  current_players integer NOT NULL DEFAULT 0 CHECK (current_players >= 0),
  sort_order integer NOT NULL DEFAULT 0,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_game_rooms_game ON public.game_rooms(game_id, status);
CREATE INDEX IF NOT EXISTS idx_game_rooms_status ON public.game_rooms(status);

-- 3. Extend game_rounds table to optionally track room_id
ALTER TABLE public.game_rounds 
  ADD COLUMN IF NOT EXISTS room_id text;

-- 4. Enable RLS
ALTER TABLE public.game_configurations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_rooms ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "game_configurations_read_all" ON public.game_configurations;
CREATE POLICY "game_configurations_read_all" ON public.game_configurations
  FOR SELECT TO authenticated, anon USING (true);

DROP POLICY IF EXISTS "game_rooms_read_all" ON public.game_rooms;
CREATE POLICY "game_rooms_read_all" ON public.game_rooms
  FOR SELECT TO authenticated, anon USING (true);

DROP POLICY IF EXISTS "game_rooms_admin_all" ON public.game_rooms;
CREATE POLICY "game_rooms_admin_all" ON public.game_rooms
  FOR ALL TO authenticated USING ((SELECT public.is_admin())) WITH CHECK ((SELECT public.is_admin()));

DROP POLICY IF EXISTS "game_configurations_admin_all" ON public.game_configurations;
CREATE POLICY "game_configurations_admin_all" ON public.game_configurations
  FOR ALL TO authenticated USING ((SELECT public.is_admin())) WITH CHECK ((SELECT public.is_admin()));

-- 5. Seed Initial Configurations for All 12 Games
INSERT INTO public.game_configurations (game_id, game_name, category, is_enabled, min_stake_fc, max_stake_fc, default_stake_fc, house_edge, rtp, max_multiplier, rules_config)
VALUES 
  ('lottery', 'Four-Digit Lottery', 'lottery', true, 1, 500, 10, 5.0, 95.0, 1000.0, '{"dials": 4, "range": [0, 9999]}'::jsonb),
  ('crash', 'Crash', 'instant', true, 1, 1000, 10, 1.0, 99.0, 1000.0, '{"curve_speed": 1.0, "auto_cashout_min": 1.01}'::jsonb),
  ('dice', 'Dice', 'instant', true, 1, 2000, 10, 1.0, 99.0, 990.0, '{"min_target": 1.0, "max_target": 98.0}'::jsonb),
  ('mines', 'Mines', 'arcade', true, 1, 1000, 10, 1.0, 99.0, 10000.0, '{"grid_size": 25, "min_mines": 1, "max_mines": 24}'::jsonb),
  ('plinko', 'Plinko', 'arcade', true, 1, 1000, 10, 1.0, 99.0, 1000.0, '{"rows": [8, 10, 12, 14, 16], "risk": ["low", "medium", "high"]}'::jsonb),
  ('roulette', 'European Roulette', 'table', true, 1, 1000, 10, 2.7, 97.3, 36.0, '{"type": "european", "pockets": 37}'::jsonb),
  ('coinflip', 'Coinflip', 'instant', true, 1, 2500, 10, 2.0, 98.0, 1.98, '{"options": ["heads", "tails"], "payout_multiplier": 1.98}'::jsonb),
  ('blackjack', 'Blackjack 21', 'card', true, 1, 1000, 10, 0.5, 99.5, 2.5, '{"decks": 6, "dealer_stands": 17, "blackjack_payout": 2.5}'::jsonb),
  ('slots', 'Golden Reels Slot', 'slots', true, 1, 500, 10, 2.5, 97.5, 250.0, '{"reels": 3, "paylines": 5, "jackpot_symbol": "777"}'::jsonb),
  ('poker', 'Texas Hold''em Poker', 'card', true, 5, 1000, 25, 1.5, 98.5, 50.0, '{"table_type": "texas_holdem", "seats": 6, "blinds": [5, 10]}'::jsonb),
  ('keno', 'Classic Keno', 'arcade', true, 1, 500, 10, 3.0, 97.0, 500.0, '{"total_balls": 40, "draw_count": 10, "max_picks": 10}'::jsonb),
  ('limbo', 'Limbo', 'instant', true, 1, 1000, 10, 1.0, 99.0, 10000.0, '{"min_multiplier": 1.01, "max_multiplier": 10000.0}'::jsonb)
ON CONFLICT (game_id) DO UPDATE SET 
  updated_at = now();

-- 6. Seed Default Rooms/Tables for All 12 Games
INSERT INTO public.game_rooms (id, game_id, room_name, room_type, status, description, min_stake_fc, max_stake_fc, player_capacity, current_players, sort_order)
VALUES
  -- Four-Digit Lottery Rooms
  ('lottery-room-1', 'lottery', 'Standard Daily Draw', 'standard', 'active', 'Classic 4-digit draw pool with guaranteed jackpot split.', 1, 50, 500, 12, 1),
  ('lottery-room-2', 'lottery', 'VIP Mega Pot', 'vip', 'active', 'High-stakes 4-digit draw with amplified prize pool in Flow Coins.', 10, 500, 200, 8, 2),
  ('lottery-room-3', 'lottery', 'Festive Special', 'turbo', 'active', 'Fast-paced celebratory draw with dynamic prize tiers.', 5, 100, 300, 15, 3),

  -- Crash Rooms
  ('crash-room-1', 'crash', 'Casual Flight Lounge', 'casual', 'active', 'Low stakes room ideal for casual players and test flights.', 1, 50, 1000, 42, 1),
  ('crash-room-2', 'crash', 'Main Rocket Arena', 'standard', 'active', 'High volume main launch pad with auto-cashout controls.', 5, 250, 2000, 87, 2),
  ('crash-room-3', 'crash', 'High Rollers Orbit', 'high_roller', 'active', 'Uncapped multipliers for strategic high rollers.', 50, 1000, 500, 19, 3),

  -- Dice Rooms
  ('dice-room-1', 'dice', 'Classic Roller Table', 'standard', 'active', 'Standard 100-sided die with Roll Over and Roll Under.', 1, 100, 1000, 31, 1),
  ('dice-room-2', 'dice', 'High Stakes Dice Arena', 'high_roller', 'active', 'Maximum precision rolls with flexible target range.', 20, 2000, 500, 14, 2),

  -- Mines Rooms
  ('mines-room-1', 'mines', 'Standard 5x5 Minefield', 'standard', 'active', 'Classic 25-tile grid with 1 to 24 configurable mines.', 1, 100, 1000, 53, 1),
  ('mines-room-2', 'mines', 'VIP Diamond Vault', 'vip', 'active', 'Premium multipliers with step-by-step cashout ladder.', 25, 1000, 500, 22, 2),

  -- Plinko Rooms
  ('plinko-room-1', 'plinko', 'Arcade Pegboard Hall', 'standard', 'active', '8 to 16 configurable rows with Low, Medium & High risk.', 1, 100, 1000, 68, 1),
  ('plinko-room-2', 'plinko', 'High Multiplier Drop Zone', 'high_roller', 'active', '16-row high-risk pyramid targeting 1000x edges.', 10, 1000, 500, 35, 2),

  -- European Roulette Rooms
  ('roulette-room-1', 'roulette', 'Monte Carlo Table', 'standard', 'active', 'Single-zero European wheel with complete inside and outside betting.', 1, 200, 100, 27, 1),
  ('roulette-room-2', 'roulette', 'VIP Salon Privé', 'vip', 'active', 'Exclusive French/European layout with higher stake allowances.', 25, 1000, 50, 9, 2),

  -- Coinflip Rooms
  ('coinflip-room-1', 'coinflip', 'Instant Flip 50/50', 'standard', 'active', 'Pure heads or tails with instant Provably Fair resolution.', 1, 100, 1000, 44, 1),
  ('coinflip-room-2', 'coinflip', 'Streak Challenge Arena', 'high_roller', 'active', 'High stake coinflip for winning streak champions.', 20, 2500, 500, 18, 2),

  -- Blackjack 21 Rooms
  ('blackjack-room-1', 'blackjack', 'Emerald 6-Deck Table', 'standard', 'active', 'Dealer stands on soft 17, 3:2 natural blackjack, double down supported.', 1, 100, 7, 5, 1),
  ('blackjack-room-2', 'blackjack', 'Diamond High Roller Table', 'vip', 'active', 'VIP single table experience with elevated table limits.', 25, 1000, 7, 3, 2),

  -- Golden Reels Slot Rooms
  ('slots-room-1', 'slots', 'Vegas Classic 3-Reel', 'standard', 'active', '5 active paylines with wild diamonds and 777 jackpot.', 1, 50, 1000, 61, 1),
  ('slots-room-2', 'slots', 'High Roller Gold Spinner', 'high_roller', 'active', 'Higher stake denominations for massive line hit payouts.', 10, 500, 500, 29, 2),

  -- Texas Hold''em Poker Rooms
  ('poker-room-1', 'poker', 'Novice Table (5/10 Blinds)', 'casual', 'active', '6-seat Hold''em table. Practice standard hand rankings and betting rounds.', 5, 100, 6, 4, 1),
  ('poker-room-2', 'poker', 'Champions Table (25/50 Blinds)', 'high_roller', 'active', 'Competitive Hold''em table with strategic flop, turn, and river action.', 25, 1000, 6, 5, 2),

  -- Classic Keno Rooms
  ('keno-room-1', 'keno', 'Quick Draw 40-Ball Room', 'standard', 'active', 'Select 1 to 10 lucky numbers and watch 10 balls draw in real time.', 1, 100, 1000, 39, 1),
  ('keno-room-2', 'keno', 'Golden Keno Jackpot Hall', 'vip', 'active', 'High hit-multiplier paytable for master keno players.', 10, 500, 500, 16, 2),

  -- Limbo Rooms
  ('limbo-room-1', 'limbo', 'Standard Multiplier Lab', 'standard', 'active', 'Target multipliers up to 100x with dynamic probability display.', 1, 100, 1000, 47, 1),
  ('limbo-room-2', 'limbo', '10,000x Astronomical Arena', 'high_roller', 'active', 'Target extreme multipliers up to 10,000x.', 10, 1000, 500, 23, 2)
ON CONFLICT (id) DO UPDATE SET 
  updated_at = now();

