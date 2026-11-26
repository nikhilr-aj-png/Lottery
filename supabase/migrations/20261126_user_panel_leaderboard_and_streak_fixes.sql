-- ============================================================================
-- MIGRATION: 20261126_user_panel_leaderboard_and_streak_fixes.sql
-- ============================================================================
-- 1. Fix Seven-Day Check-In schema mismatch (`highest_streak` missing on
--    public.user_daily_streaks) and harden streak tracking + anti-duplicate locks.
-- 2. Enforce strict Top 100 limit inside `public.get_leaderboard_rankings` and
--    require authenticated session.
-- 3. Reuse `public.platform_settings` safely with RLS + Super Admin RPCs for
--    monthly leaderboard prize distribution & announcement publishing
--    (drafts isolated from regular users; published announcement read-only).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. FIX user_daily_streaks TABLE SCHEMA (`highest_streak`)
-- ----------------------------------------------------------------------------
ALTER TABLE public.user_daily_streaks
ADD COLUMN IF NOT EXISTS highest_streak INTEGER NOT NULL DEFAULT 0;

UPDATE public.user_daily_streaks
SET highest_streak = GREATEST(COALESCE(highest_streak, 0), COALESCE(current_streak, 0))
WHERE highest_streak < COALESCE(current_streak, 0);

-- Return wallet_address alongside tx info from internal credit helper so streak
-- records always bind cleanly even for a brand-new user claiming bonus first.
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
      SELECT balance, address INTO v_new_balance, v_addr FROM public.lottery_wallets
      WHERE (v_uid IS NOT NULL AND user_id = v_uid) OR (p_user_address IS NOT NULL AND address = p_user_address)
      ORDER BY updated_at DESC LIMIT 1;
      RETURN jsonb_build_object(
        'success', true,
        'already_processed', true,
        'new_balance', COALESCE(v_new_balance, 0),
        'wallet_address', COALESCE(v_addr, p_user_address),
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
    v_addr := COALESCE(NULLIF(trim(COALESCE(p_user_address, '')), ''), '0x' || substr(md5(random()::text || clock_timestamp()::text), 1, 40));
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
    'wallet_address', v_addr,
    'credited', v_exact_amount,
    'currency', 'USDT',
    'transaction_id', v_tx_id
  );
END;
$function$;

REVOKE ALL ON FUNCTION public._internal_credit_virtual_credits(numeric, text, text, text, text, uuid, jsonb) FROM PUBLIC, anon, authenticated;

-- ----------------------------------------------------------------------------
-- 2. HARDEN get_daily_reward_status AND claim_daily_bonus
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_daily_reward_status(
  p_user_address text DEFAULT NULL::text,
  p_user_id uuid DEFAULT NULL::uuid
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path TO 'public', 'auth', 'pg_temp'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_addr text;
  v_bonus_settings jsonb;
  v_checkin_settings jsonb;
  v_last_ledger_claim timestamptz;
  v_last_claim timestamptz;
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
  v_today date := current_date;
  v_mode text := 'streak';
  v_missed_policy text := 'reset';
  v_streak_map jsonb;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Authentication required.');
  END IF;

  SELECT address INTO v_addr
  FROM public.lottery_wallets
  WHERE user_id = v_uid
  ORDER BY updated_at DESC
  LIMIT 1;

  IF v_addr IS NULL THEN
    v_addr := NULLIF(trim(COALESCE(p_user_address, '')), '');
  END IF;

  SELECT value INTO v_bonus_settings FROM public.platform_settings WHERE key = 'bonus_rewards';
  SELECT value INTO v_checkin_settings FROM public.platform_settings WHERE key = 'daily_checkin';

  IF v_bonus_settings IS NOT NULL THEN
    v_cooldown_hours := GREATEST(1, COALESCE((v_bonus_settings->>'cooldown_hours')::integer, 24));
    v_cooldown_seconds := v_cooldown_hours * 3600;
    v_mode := COALESCE(v_bonus_settings->>'reward_mode', 'streak');
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

  SELECT * INTO v_streak
  FROM public.user_daily_streaks
  WHERE user_id = v_uid
     OR (v_addr IS NOT NULL AND wallet_address = v_addr)
  ORDER BY updated_at DESC
  LIMIT 1;

  SELECT created_at INTO v_last_ledger_claim
  FROM public.wallet_ledger
  WHERE (user_id = v_uid OR (v_addr IS NOT NULL AND wallet_address = v_addr))
    AND transaction_type IN ('daily_reward', 'daily_bonus')
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_streak IS NOT NULL AND v_streak.last_claimed_at IS NOT NULL AND v_last_ledger_claim IS NOT NULL THEN
    v_last_claim := GREATEST(v_streak.last_claimed_at, v_last_ledger_claim);
  ELSE
    v_last_claim := COALESCE(v_last_ledger_claim, v_streak.last_claimed_at);
  END IF;

  IF v_last_claim IS NOT NULL THEN
    v_seconds_since := EXTRACT(EPOCH FROM (now() - v_last_claim))::integer;
    IF v_seconds_since < v_cooldown_seconds THEN
      v_can_claim := false;
      v_seconds_remaining := GREATEST(1, v_cooldown_seconds - v_seconds_since);
    END IF;
  END IF;

  IF v_cooldown_hours >= 24 AND v_streak IS NOT NULL AND v_streak.last_checkin_date = v_today AND v_can_claim THEN
    v_can_claim := false;
    v_seconds_remaining := GREATEST(1, EXTRACT(EPOCH FROM ((v_today + 1)::timestamptz - now()))::integer);
  END IF;

  IF v_streak IS NOT NULL THEN
    v_highest_streak := COALESCE(v_streak.highest_streak, COALESCE(v_streak.current_streak, 0));
    IF NOT v_can_claim THEN
      v_display_streak := GREATEST(1, LEAST(7, COALESCE(v_streak.current_streak, 1)));
      v_upcoming_day := v_display_streak;
      v_next_streak := (v_display_streak % 7) + 1;
    ELSE
      IF v_streak.last_checkin_date = (v_today - 1) THEN
        v_upcoming_day := (COALESCE(v_streak.current_streak, 0) % 7) + 1;
      ELSIF v_streak.last_checkin_date = v_today THEN
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
    v_available_reward := ROUND(COALESCE((v_bonus_settings->>'fixed_amount')::numeric, 0.50), 2);
  ELSIF v_mode = 'random' THEN
    v_available_reward := ROUND((COALESCE((v_bonus_settings->>'min_amount')::numeric, 0.05) +
      ((COALESCE((v_bonus_settings->>'max_amount')::numeric, 1.00) - COALESCE((v_bonus_settings->>'min_amount')::numeric, 0.05)) * 0.4))::numeric, 2);
  ELSE
    v_available_reward := ROUND(COALESCE((v_streak_map->>('day' || v_upcoming_day))::numeric, 0.10), 2);
  END IF;

  IF v_available_reward > 10.00 THEN v_available_reward := 1.00; END IF;
  IF v_available_reward < 0.01 THEN v_available_reward := 0.05; END IF;

  RETURN jsonb_build_object(
    'success', true,
    'can_claim', v_can_claim,
    'seconds_remaining', v_seconds_remaining,
    'available_reward', v_available_reward,
    'current_streak', v_display_streak,
    'highest_streak', v_highest_streak,
    'next_streak', v_next_streak,
    'next_reward_amount', ROUND(COALESCE((v_streak_map->>('day' || v_next_streak))::numeric, 0.15), 2),
    'bonus_settings', v_bonus_settings,
    'checkin_settings', v_checkin_settings,
    'last_claimed_at', v_last_claim
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.get_daily_reward_status(text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_daily_reward_status(text, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.claim_daily_bonus(
  p_user_address text DEFAULT NULL::text,
  p_user_id uuid DEFAULT NULL::uuid
)
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
  v_checkin_enabled boolean := true;
  v_mode text := 'streak';
  v_cooldown_hours integer := 24;
  v_cooldown_seconds integer := 86400;
  v_last_ledger_claim timestamptz;
  v_last_claim timestamptz;
  v_seconds_since integer;
  v_now timestamptz := now();
  v_today date := current_date;
  v_streak record;
  v_current_streak integer := 1;
  v_highest_streak integer := 1;
  v_reward_amount numeric := 0.10;
  v_credit_res jsonb;
  v_resolved_addr text;
  v_day_ref text;
  v_streak_map jsonb;
  v_missed_policy text := 'reset';
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Authentication required to claim daily bonus.');
  END IF;

  -- Transaction-scoped lock per user guarantees zero concurrent duplicate claims
  PERFORM pg_advisory_xact_lock(hashtext('daily_bonus:' || v_uid::text));

  SELECT address INTO v_addr
  FROM public.lottery_wallets
  WHERE user_id = v_uid
  ORDER BY updated_at DESC
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
    v_streak_map := v_checkin_settings->'streak_rewards';
    v_missed_policy := COALESCE(v_checkin_settings->>'missed_day_policy', 'reset');
  END IF;

  IF NOT v_enabled OR NOT v_checkin_enabled THEN
    RETURN jsonb_build_object('success', false, 'error', 'Daily Check-In bonus is currently paused by administrator.');
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
     OR (v_addr IS NOT NULL AND wallet_address = v_addr)
  ORDER BY updated_at DESC
  LIMIT 1
  FOR UPDATE;

  SELECT created_at INTO v_last_ledger_claim
  FROM public.wallet_ledger
  WHERE (user_id = v_uid OR (v_addr IS NOT NULL AND wallet_address = v_addr))
    AND transaction_type IN ('daily_reward', 'daily_bonus')
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_streak IS NOT NULL AND v_streak.last_claimed_at IS NOT NULL AND v_last_ledger_claim IS NOT NULL THEN
    v_last_claim := GREATEST(v_streak.last_claimed_at, v_last_ledger_claim);
  ELSE
    v_last_claim := COALESCE(v_last_ledger_claim, v_streak.last_claimed_at);
  END IF;

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

  IF v_cooldown_hours >= 24 AND v_streak IS NOT NULL AND v_streak.last_checkin_date = v_today THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Daily bonus already claimed for today.',
      'seconds_remaining', GREATEST(1, EXTRACT(EPOCH FROM ((v_today + 1)::timestamptz - v_now))::integer)
    );
  END IF;

  IF v_streak IS NULL THEN
    v_current_streak := 1;
  ELSE
    IF v_streak.last_checkin_date IS NOT NULL THEN
      IF v_streak.last_checkin_date = (v_today - 1) THEN
        v_current_streak := (COALESCE(v_streak.current_streak, 0) % 7) + 1;
      ELSIF v_streak.last_checkin_date = v_today THEN
        v_current_streak := (COALESCE(v_streak.current_streak, 0) % 7) + 1;
      ELSE
        IF v_missed_policy = 'continue' THEN
          v_current_streak := (COALESCE(v_streak.current_streak, 0) % 7) + 1;
        ELSE
          v_current_streak := 1;
        END IF;
      END IF;
    ELSE
      v_current_streak := 1;
    END IF;
  END IF;

  v_highest_streak := GREATEST(COALESCE(v_streak.highest_streak, 0), v_current_streak);

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

  IF v_cooldown_hours >= 24 THEN
    v_day_ref := 'daily-bonus-' || to_char(v_today, 'YYYY-MM-DD') || '-' || v_uid::text;
  ELSE
    v_day_ref := 'daily-bonus-' || floor(EXTRACT(EPOCH FROM v_now) / GREATEST(v_cooldown_seconds, 60))::bigint::text || '-' || v_uid::text;
  END IF;

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
      'highest_streak', v_highest_streak,
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
        wallet_address = COALESCE(wallet_address, v_resolved_addr),
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

-- ----------------------------------------------------------------------------
-- 3. STRICT BACKEND TOP 100 LIMIT + AUTH CHECK ON LEADERBOARD RANKINGS RPC
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_leaderboard_rankings(
  p_days integer DEFAULT 28,
  p_limit integer DEFAULT 100
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth', 'pg_temp'
AS $function$
DECLARE
  v_days integer := GREATEST(1, LEAST(COALESCE(p_days, 28), 365));
  -- Hard backend cap of 100 ranked players (never exceeds Top 100)
  v_limit integer := GREATEST(1, LEAST(COALESCE(p_limit, 100), 100));
  v_now timestamptz := now();
  v_cutoff timestamptz := v_now - make_interval(days => v_days);
  v_rows jsonb;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN '[]'::jsonb;
  END IF;

  WITH raw_payout_wins AS (
    SELECT
      COALESCE(
        wp.user_id,
        lt.user_id,
        lw.user_id,
        prof_addr.id
      ) AS resolved_user_id,
      NULLIF(trim(COALESCE(wp.winner_address, lt.user_address, '')), '') AS resolved_address,
      NULLIF(regexp_replace(trim(COALESCE(
        prof_id.username,
        prof_addr.username,
        CASE
          WHEN lt.username IS NOT NULL
            AND trim(lt.username) <> ''
            AND lower(trim(lt.username)) NOT IN ('player', 'anonymous', 'lucky winner', 'you')
            AND trim(lt.username) !~* '^0x[0-9a-f]{16,}$'
          THEN lt.username
          ELSE NULL
        END,
        CASE
          WHEN wp.winner_username IS NOT NULL
            AND trim(wp.winner_username) <> ''
            AND lower(trim(wp.winner_username)) NOT IN ('player', 'anonymous', 'lucky winner', 'you')
            AND trim(wp.winner_username) !~* '^0x[0-9a-f]{16,}$'
          THEN wp.winner_username
          ELSE NULL
        END,
        ''
      )), '^@+', ''), '') AS resolved_username,
      ('lwin:' || COALESCE(NULLIF(NULLIF(trim(wp.ticket_id), ''), 'MANUAL'), wp.id)) AS entry_ref,
      NULLIF(NULLIF(trim(wp.ticket_id), ''), 'MANUAL') AS covered_ticket_id,
      COALESCE(wp.payout_amount, 0)::numeric AS won_usdt,
      COALESCE(wp.approved_at, wp.created_at) AS event_ts
    FROM public.winner_payouts wp
    LEFT JOIN public.lottery_tickets lt ON lt.id = wp.ticket_id
    LEFT JOIN public.lottery_wallets lw ON lower(lw.address) = lower(COALESCE(wp.winner_address, lt.user_address, ''))
    LEFT JOIN public.profiles prof_addr ON prof_addr.trc20_address IS NOT NULL
      AND lower(prof_addr.trc20_address) = lower(COALESCE(wp.winner_address, lt.user_address, ''))
    LEFT JOIN public.profiles prof_id ON prof_id.id = COALESCE(wp.user_id, lt.user_id, lw.user_id, prof_addr.id)
    WHERE lower(COALESCE(wp.status, '')) IN ('paid', 'approved', 'completed')
      AND COALESCE(wp.payout_amount, 0) > 0
      AND COALESCE(wp.approved_at, wp.created_at) >= v_cutoff
      AND COALESCE(wp.approved_at, wp.created_at) <= v_now
  ),
  direct_ticket_wins AS (
    SELECT
      COALESCE(lt.user_id, lw.user_id, prof_addr.id) AS resolved_user_id,
      NULLIF(trim(COALESCE(lt.user_address, '')), '') AS resolved_address,
      NULLIF(regexp_replace(trim(COALESCE(
        prof_id.username,
        prof_addr.username,
        CASE
          WHEN lt.username IS NOT NULL
            AND trim(lt.username) <> ''
            AND lower(trim(lt.username)) NOT IN ('player', 'anonymous', 'lucky winner', 'you')
            AND trim(lt.username) !~* '^0x[0-9a-f]{16,}$'
          THEN lt.username
          ELSE NULL
        END,
        ''
      )), '^@+', ''), '') AS resolved_username,
      ('lwin:' || lt.id) AS entry_ref,
      lt.id AS covered_ticket_id,
      COALESCE(lt.won_amount, 0)::numeric AS won_usdt,
      COALESCE(
        le.draw_executed_at,
        CASE WHEN le.draw_time IS NOT NULL AND le.status = 'completed' THEN to_timestamp(le.draw_time / 1000.0) END,
        lt.created_at
      ) AS event_ts
    FROM public.lottery_tickets lt
    LEFT JOIN public.lottery_events le ON le.id = lt.event_id
    LEFT JOIN public.lottery_wallets lw ON lower(lw.address) = lower(COALESCE(lt.user_address, ''))
    LEFT JOIN public.profiles prof_addr ON prof_addr.trc20_address IS NOT NULL
      AND lower(prof_addr.trc20_address) = lower(COALESCE(lt.user_address, ''))
    LEFT JOIN public.profiles prof_id ON prof_id.id = COALESCE(lt.user_id, lw.user_id, prof_addr.id)
    WHERE lower(COALESCE(lt.status, '')) = 'won'
      AND COALESCE(lt.won_amount, 0) > 0
      AND NOT EXISTS (
        SELECT 1 FROM raw_payout_wins pw WHERE pw.covered_ticket_id = lt.id
      )
      AND COALESCE(
        le.draw_executed_at,
        CASE WHEN le.draw_time IS NOT NULL AND le.status = 'completed' THEN to_timestamp(le.draw_time / 1000.0) END,
        lt.created_at
      ) >= v_cutoff
      AND COALESCE(
        le.draw_executed_at,
        CASE WHEN le.draw_time IS NOT NULL AND le.status = 'completed' THEN to_timestamp(le.draw_time / 1000.0) END,
        lt.created_at
      ) <= v_now
  ),
  settled_lottery_entries AS (
    SELECT
      COALESCE(lt.user_id, lw.user_id, prof_addr.id) AS resolved_user_id,
      NULLIF(trim(COALESCE(lt.user_address, '')), '') AS resolved_address,
      NULLIF(regexp_replace(trim(COALESCE(
        prof_id.username,
        prof_addr.username,
        CASE
          WHEN lt.username IS NOT NULL
            AND trim(lt.username) <> ''
            AND lower(trim(lt.username)) NOT IN ('player', 'anonymous', 'lucky winner', 'you')
            AND trim(lt.username) !~* '^0x[0-9a-f]{16,}$'
          THEN lt.username
          ELSE NULL
        END,
        ''
      )), '^@+', ''), '') AS resolved_username,
      ('lwin:' || lt.id) AS entry_ref,
      CASE WHEN lower(COALESCE(lt.status, '')) = 'won' THEN 1 ELSE 0 END AS is_win,
      0::numeric AS won_usdt,
      COALESCE(
        wp_paid.payout_ts,
        le.draw_executed_at,
        CASE WHEN le.draw_time IS NOT NULL AND le.status = 'completed' THEN to_timestamp(le.draw_time / 1000.0) END,
        lt.created_at
      ) AS event_ts
    FROM public.lottery_tickets lt
    LEFT JOIN public.lottery_events le ON le.id = lt.event_id
    LEFT JOIN LATERAL (
      SELECT MAX(COALESCE(wp.approved_at, wp.created_at)) AS payout_ts
      FROM public.winner_payouts wp
      WHERE wp.ticket_id = lt.id
        AND lower(COALESCE(wp.status, '')) IN ('paid', 'approved', 'completed')
    ) wp_paid ON true
    LEFT JOIN public.lottery_wallets lw ON lower(lw.address) = lower(COALESCE(lt.user_address, ''))
    LEFT JOIN public.profiles prof_addr ON prof_addr.trc20_address IS NOT NULL
      AND lower(prof_addr.trc20_address) = lower(COALESCE(lt.user_address, ''))
    LEFT JOIN public.profiles prof_id ON prof_id.id = COALESCE(lt.user_id, lw.user_id, prof_addr.id)
    WHERE (
        lower(COALESCE(lt.status, '')) IN ('won', 'lost')
        OR lower(COALESCE(le.status, '')) = 'completed'
      )
      AND COALESCE(
        wp_paid.payout_ts,
        le.draw_executed_at,
        CASE WHEN le.draw_time IS NOT NULL AND le.status = 'completed' THEN to_timestamp(le.draw_time / 1000.0) END,
        lt.created_at
      ) >= v_cutoff
      AND COALESCE(
        wp_paid.payout_ts,
        le.draw_executed_at,
        CASE WHEN le.draw_time IS NOT NULL AND le.status = 'completed' THEN to_timestamp(le.draw_time / 1000.0) END,
        lt.created_at
      ) <= v_now
  ),
  settled_round_entries AS (
    SELECT
      COALESCE(gr.user_id, lw.user_id, prof_addr.id) AS resolved_user_id,
      NULLIF(trim(COALESCE(gr.wallet_address, '')), '') AS resolved_address,
      NULLIF(regexp_replace(trim(COALESCE(
        prof_id.username,
        prof_addr.username,
        CASE
          WHEN gr.username IS NOT NULL
            AND trim(gr.username) <> ''
            AND lower(trim(gr.username)) NOT IN ('player', 'anonymous', 'lucky winner', 'you')
            AND trim(gr.username) !~* '^0x[0-9a-f]{16,}$'
          THEN gr.username
          ELSE NULL
        END,
        ''
      )), '^@+', ''), '') AS resolved_username,
      ('rnd:' || gr.id) AS entry_ref,
      CASE
        WHEN COALESCE(gr.payout, 0) > 0 OR lower(COALESCE(gr.status, '')) IN ('won', 'win') THEN 1
        ELSE 0
      END AS is_win,
      CASE
        WHEN COALESCE(gr.payout, 0) > 0 THEN gr.payout::numeric
        ELSE 0::numeric
      END AS won_usdt,
      gr.created_at AS event_ts
    FROM public.game_rounds gr
    LEFT JOIN public.lottery_wallets lw ON lower(lw.address) = lower(COALESCE(gr.wallet_address, ''))
    LEFT JOIN public.profiles prof_addr ON prof_addr.trc20_address IS NOT NULL
      AND lower(prof_addr.trc20_address) = lower(COALESCE(gr.wallet_address, ''))
    LEFT JOIN public.profiles prof_id ON prof_id.id = COALESCE(gr.user_id, lw.user_id, prof_addr.id)
    WHERE lower(COALESCE(gr.status, '')) IN ('won', 'win', 'lost', 'completed', 'settled', 'cashout')
      AND gr.created_at >= v_cutoff
      AND gr.created_at <= v_now
  ),
  combined_events AS (
    SELECT resolved_user_id, resolved_address, resolved_username, entry_ref, 1 AS is_win, won_usdt, event_ts FROM raw_payout_wins
    UNION ALL
    SELECT resolved_user_id, resolved_address, resolved_username, entry_ref, 1 AS is_win, won_usdt, event_ts FROM direct_ticket_wins
    UNION ALL
    SELECT resolved_user_id, resolved_address, resolved_username, entry_ref, is_win, won_usdt, event_ts FROM settled_lottery_entries
    UNION ALL
    SELECT resolved_user_id, resolved_address, resolved_username, entry_ref, is_win, won_usdt, event_ts FROM settled_round_entries
  ),
  keyed_events AS (
    SELECT
      COALESCE(
        resolved_user_id::text,
        CASE WHEN resolved_address IS NOT NULL THEN 'addr:' || lower(resolved_address) END,
        CASE WHEN resolved_username IS NOT NULL THEN 'name:' || lower(resolved_username) END
      ) AS user_key,
      resolved_username,
      resolved_address,
      entry_ref,
      is_win,
      won_usdt,
      event_ts
    FROM combined_events
    WHERE COALESCE(resolved_user_id::text, resolved_address, resolved_username) IS NOT NULL
  ),
  deduped_entries AS (
    SELECT
      user_key,
      MAX(resolved_username) AS best_username,
      MAX(resolved_address) AS best_address,
      entry_ref,
      MAX(is_win) AS entry_won,
      SUM(won_usdt) AS entry_won_usdt,
      MIN(CASE WHEN is_win = 1 THEN event_ts END) AS win_ts
    FROM keyed_events
    GROUP BY user_key, entry_ref
  ),
  aggregated_users AS (
    SELECT
      user_key,
      COALESCE(
        NULLIF(MAX(best_username), ''),
        CASE
          WHEN MAX(best_address) IS NOT NULL AND length(MAX(best_address)) > 10
            THEN left(MAX(best_address), 6) || '...' || right(MAX(best_address), 4)
          ELSE COALESCE(MAX(best_address), 'Player')
        END
      ) AS username,
      COUNT(*)::integer AS total_entries,
      SUM(entry_won)::integer AS wins_count,
      ROUND(SUM(entry_won_usdt), 2) AS total_won_usdt,
      MIN(win_ts) AS first_win_at
    FROM deduped_entries
    GROUP BY user_key
    HAVING SUM(entry_won) > 0 AND SUM(entry_won_usdt) > 0
  ),
  scored_and_ranked AS (
    SELECT
      ROW_NUMBER() OVER (
        ORDER BY
          (wins_count::numeric / GREATEST(total_entries, 1)::numeric) DESC,
          total_won_usdt DESC,
          wins_count DESC,
          first_win_at ASC NULLS LAST,
          username ASC
      ) AS rank,
      username,
      total_won_usdt
    FROM aggregated_users
    LIMIT v_limit
  )
  SELECT jsonb_agg(
    jsonb_build_object(
      'rank', rank,
      'username', username,
      'total_won_usdt', total_won_usdt
    )
    ORDER BY rank ASC
  )
  INTO v_rows
  FROM scored_and_ranked;

  RETURN COALESCE(v_rows, '[]'::jsonb);
END;
$function$;

REVOKE ALL ON FUNCTION public.get_leaderboard_rankings(integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_leaderboard_rankings(integer, integer) TO authenticated;

-- ----------------------------------------------------------------------------
-- 4. MONTHLY LEADERBOARD PRIZE CONFIGURATION & ANNOUNCEMENT (RLS + RPCs)
-- ----------------------------------------------------------------------------
-- Store drafts & per-month competitions under key = 'monthly_leaderboard_config'
-- (readable & writable ONLY by Super Admin), and active published announcement
-- under key = 'monthly_leaderboard_published' (read-only for users, writable
-- ONLY by Super Admin).

DROP POLICY IF EXISTS "platform_settings_select_policy" ON public.platform_settings;
CREATE POLICY "platform_settings_select_policy" ON public.platform_settings
  FOR SELECT TO public
  USING (
    key <> 'monthly_leaderboard_config'
    OR (SELECT public.is_super_admin())
  );

DROP POLICY IF EXISTS "platform_settings_insert_policy" ON public.platform_settings;
CREATE POLICY "platform_settings_insert_policy" ON public.platform_settings
  FOR INSERT TO authenticated
  WITH CHECK (
    CASE
      WHEN key IN ('monthly_leaderboard_config', 'monthly_leaderboard_published') THEN (SELECT public.is_super_admin())
      ELSE (SELECT public.is_admin())
    END
  );

DROP POLICY IF EXISTS "platform_settings_update_policy" ON public.platform_settings;
CREATE POLICY "platform_settings_update_policy" ON public.platform_settings
  FOR UPDATE TO authenticated
  USING (
    CASE
      WHEN key IN ('monthly_leaderboard_config', 'monthly_leaderboard_published') THEN (SELECT public.is_super_admin())
      ELSE (SELECT public.is_admin())
    END
  )
  WITH CHECK (
    CASE
      WHEN key IN ('monthly_leaderboard_config', 'monthly_leaderboard_published') THEN (SELECT public.is_super_admin())
      ELSE (SELECT public.is_admin())
    END
  );

-- User-facing read-only RPC returning ONLY published announcement (never drafts)
CREATE OR REPLACE FUNCTION public.get_published_monthly_leaderboard_announcement()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'auth', 'pg_temp'
AS $function$
DECLARE
  v_val jsonb;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('is_published', false);
  END IF;

  SELECT value INTO v_val
  FROM public.platform_settings
  WHERE key = 'monthly_leaderboard_published';

  IF v_val IS NULL OR COALESCE((v_val->>'is_published')::boolean, false) IS NOT TRUE THEN
    RETURN jsonb_build_object('is_published', false);
  END IF;

  RETURN v_val;
END;
$function$;

REVOKE ALL ON FUNCTION public.get_published_monthly_leaderboard_announcement() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_published_monthly_leaderboard_announcement() TO authenticated;

-- Super Admin-only management RPC for Ranks 1-10 per-month competition config & publishing
CREATE OR REPLACE FUNCTION public.admin_manage_monthly_leaderboard_announcement(
  p_action text DEFAULT 'get_all',
  p_month_key text DEFAULT NULL::text,
  p_title text DEFAULT NULL::text,
  p_description text DEFAULT NULL::text,
  p_prizes jsonb DEFAULT NULL::jsonb,
  p_publish boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth', 'pg_temp'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_action text := lower(trim(COALESCE(p_action, 'get_all')));
  v_month text := trim(COALESCE(p_month_key, to_char(now(), 'YYYY-MM')));
  v_month_label text;
  v_config jsonb;
  v_months jsonb;
  v_published jsonb;
  v_clean_prizes jsonb := '[]'::jsonb;
  v_rank integer;
  v_amt numeric;
  v_entry jsonb;
  v_now timestamptz := now();
  v_pub_flag boolean;
BEGIN
  IF NOT public.is_super_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized: Super Admin privileges required.');
  END IF;

  SELECT value INTO v_config FROM public.platform_settings WHERE key = 'monthly_leaderboard_config';
  SELECT value INTO v_published FROM public.platform_settings WHERE key = 'monthly_leaderboard_published';

  v_config := COALESCE(v_config, '{}'::jsonb);
  v_months := COALESCE(v_config->'months', '{}'::jsonb);

  IF v_action = 'get_all' THEN
    RETURN jsonb_build_object(
      'success', true,
      'config', v_config,
      'published', COALESCE(v_published, jsonb_build_object('is_published', false))
    );
  END IF;

  IF v_month !~ '^\d{4}-(0[1-9]|1[0-2])$' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid month format. Expected YYYY-MM.');
  END IF;

  v_month_label := trim(to_char(to_date(v_month || '-01', 'YYYY-MM-DD'), 'FMMonth YYYY'));

  IF v_action = 'unpublish' THEN
    IF v_months ? v_month THEN
      v_entry := (v_months->v_month) || jsonb_build_object('is_published', false, 'updated_at', v_now);
      v_months := v_months || jsonb_build_object(v_month, v_entry);
      v_config := v_config || jsonb_build_object('months', v_months, 'updated_at', v_now);
      INSERT INTO public.platform_settings (key, value, updated_at)
      VALUES ('monthly_leaderboard_config', v_config, v_now)
      ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = v_now;
    END IF;

    IF v_published IS NOT NULL AND COALESCE(v_published->>'month_key', '') = v_month THEN
      v_published := v_published || jsonb_build_object('is_published', false, 'unpublished_at', v_now);
      INSERT INTO public.platform_settings (key, value, updated_at)
      VALUES ('monthly_leaderboard_published', v_published, v_now)
      ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = v_now;
    END IF;

    INSERT INTO public.admin_audit_logs (admin_id, action_type, target_type, target_id, changes)
    VALUES (v_uid, 'UNPUBLISH_LEADERBOARD_ANNOUNCEMENT', 'platform_settings', v_month, jsonb_build_object('month_key', v_month));

    RETURN jsonb_build_object(
      'success', true,
      'config', v_config,
      'published', COALESCE(v_published, jsonb_build_object('is_published', false))
    );
  END IF;

  IF v_action = 'save' THEN
    IF p_prizes IS NULL OR jsonb_typeof(p_prizes) <> 'array' THEN
      RETURN jsonb_build_object('success', false, 'error', 'Prizes payload must contain ranks 1 through 10.');
    END IF;

    FOR v_rank IN 1..10 LOOP
      SELECT COALESCE((elem->>'reward_usdt')::numeric, (elem->>'amount')::numeric, 0)
      INTO v_amt
      FROM jsonb_array_elements(p_prizes) AS elem
      WHERE COALESCE((elem->>'rank')::integer, 0) = v_rank
      LIMIT 1;

      v_amt := ROUND(GREATEST(0, COALESCE(v_amt, 0)), 2);
      v_clean_prizes := v_clean_prizes || jsonb_build_object(
        'rank', v_rank,
        'reward_usdt', v_amt
      );
    END LOOP;

    v_pub_flag := COALESCE(p_publish, false);

    v_entry := jsonb_build_object(
      'month_key', v_month,
      'month_label', v_month_label,
      'title', COALESCE(NULLIF(trim(COALESCE(p_title, '')), ''), v_month_label || ' Top 10 Prize Pool'),
      'description', COALESCE(NULLIF(trim(COALESCE(p_description, '')), ''), 'Top 10 ranked players by win rate share this month''s official USDT prize pool.'),
      'prizes', v_clean_prizes,
      'is_published', v_pub_flag,
      'updated_at', v_now,
      'published_at', CASE WHEN v_pub_flag THEN v_now ELSE (v_months->v_month->>'published_at')::timestamptz END
    );

    v_months := v_months || jsonb_build_object(v_month, v_entry);
    v_config := jsonb_build_object(
      'active_month', v_month,
      'months', v_months,
      'updated_at', v_now
    );

    INSERT INTO public.platform_settings (key, value, updated_at)
    VALUES ('monthly_leaderboard_config', v_config, v_now)
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = v_now;

    IF v_pub_flag THEN
      v_published := v_entry || jsonb_build_object('is_published', true, 'published_at', v_now);
      INSERT INTO public.platform_settings (key, value, updated_at)
      VALUES ('monthly_leaderboard_published', v_published, v_now)
      ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = v_now;
    ELSIF v_published IS NOT NULL AND COALESCE(v_published->>'month_key', '') = v_month THEN
      v_published := v_published || jsonb_build_object('is_published', false, 'unpublished_at', v_now);
      INSERT INTO public.platform_settings (key, value, updated_at)
      VALUES ('monthly_leaderboard_published', v_published, v_now)
      ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = v_now;
    END IF;

    INSERT INTO public.admin_audit_logs (admin_id, action_type, target_type, target_id, changes)
    VALUES (
      v_uid,
      CASE WHEN v_pub_flag THEN 'PUBLISH_LEADERBOARD_ANNOUNCEMENT' ELSE 'SAVE_LEADERBOARD_ANNOUNCEMENT_DRAFT' END,
      'platform_settings',
      v_month,
      v_entry
    );

    RETURN jsonb_build_object(
      'success', true,
      'config', v_config,
      'published', COALESCE(v_published, jsonb_build_object('is_published', false))
    );
  END IF;

  RETURN jsonb_build_object('success', false, 'error', 'Unsupported action: ' || v_action);
END;
$function$;

REVOKE ALL ON FUNCTION public.admin_manage_monthly_leaderboard_announcement(text, text, text, text, jsonb, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_manage_monthly_leaderboard_announcement(text, text, text, text, jsonb, boolean) TO authenticated;
