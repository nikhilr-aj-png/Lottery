-- ============================================================================
-- MIGRATION: NOTIFICATIONS SYSTEM & ADMIN REWARD CONTROLS
-- ============================================================================
-- 1. Persistent User Notifications table with read/cleared tracking.
-- 2. Admin-configurable Bonus and Daily Check-in Streak reward settings.
-- 3. User Daily Streaks tracking table.
-- 4. Server-authoritative claim_daily_bonus & get_daily_reward_status RPCs.
-- 5. Admin management and analytics RPCs.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. USER NOTIFICATIONS TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  wallet_address TEXT,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'info', -- 'reward', 'bonus', 'security', 'lottery', 'game', 'system'
  action_url TEXT,
  is_read BOOLEAN NOT NULL DEFAULT false,
  read_at TIMESTAMPTZ,
  is_cleared BOOLEAN NOT NULL DEFAULT false,
  cleared_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_notif_user ON public.user_notifications(user_id, is_cleared, is_read);
CREATE INDEX IF NOT EXISTS idx_user_notif_wallet ON public.user_notifications(wallet_address, is_cleared, is_read);
CREATE INDEX IF NOT EXISTS idx_user_notif_created ON public.user_notifications(created_at DESC);

ALTER TABLE public.user_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access for user notifications"
  ON public.user_notifications
  FOR SELECT
  USING (true);

CREATE POLICY "Allow public insert/update for user notifications"
  ON public.user_notifications
  FOR ALL
  USING (true);

-- ----------------------------------------------------------------------------
-- 2. USER DAILY STREAKS TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_daily_streaks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  wallet_address TEXT NOT NULL,
  current_streak INTEGER NOT NULL DEFAULT 1,
  last_checkin_date DATE,
  last_claimed_at TIMESTAMPTZ,
  total_checkins INTEGER NOT NULL DEFAULT 0,
  total_flo_awarded NUMERIC(18, 4) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_streaks_wallet ON public.user_daily_streaks(wallet_address);
CREATE INDEX IF NOT EXISTS idx_user_streaks_user ON public.user_daily_streaks(user_id);

ALTER TABLE public.user_daily_streaks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to user_daily_streaks"
  ON public.user_daily_streaks
  FOR ALL
  USING (true);

-- ----------------------------------------------------------------------------
-- 3. ENSURE PLATFORM_SETTINGS ROWS FOR BONUS & DAILY CHECKIN
-- ----------------------------------------------------------------------------
INSERT INTO public.platform_settings (key, value, updated_at)
VALUES (
  'bonus_rewards',
  jsonb_build_object(
    'enabled', true,
    'reward_mode', 'streak', -- 'streak' | 'random' | 'fixed'
    'fixed_amount', 0.50,
    'min_amount', 0.05,
    'max_amount', 1.00,
    'cooldown_hours', 24,
    'eligibility', 'all'
  ),
  now()
)
ON CONFLICT (key) DO UPDATE
SET value = COALESCE(public.platform_settings.value, EXCLUDED.value);

INSERT INTO public.platform_settings (key, value, updated_at)
VALUES (
  'daily_checkin',
  jsonb_build_object(
    'enabled', true,
    'streak_rewards', jsonb_build_object(
      'day1', 0.10,
      'day2', 0.15,
      'day3', 0.20,
      'day4', 0.25,
      'day5', 0.30,
      'day6', 0.40,
      'day7', 1.00
    ),
    'full_streak_bonus', 1.00,
    'missed_day_policy', 'reset' -- 'reset' | 'continue'
  ),
  now()
)
ON CONFLICT (key) DO UPDATE
SET value = COALESCE(public.platform_settings.value, EXCLUDED.value);

-- ----------------------------------------------------------------------------
-- 4. RPC: GET USER NOTIFICATIONS
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_user_notifications(
  p_user_address TEXT DEFAULT NULL,
  p_user_id UUID DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_res jsonb;
  v_unread_count integer := 0;
BEGIN
  IF p_user_address IS NULL AND p_user_id IS NULL THEN
    RETURN jsonb_build_object('success', true, 'notifications', '[]'::jsonb, 'unread_count', 0);
  END IF;

  -- Count unread active notifications
  SELECT COUNT(*) INTO v_unread_count
  FROM public.user_notifications
  WHERE is_cleared = false
    AND is_read = false
    AND (
      (p_user_id IS NOT NULL AND user_id = p_user_id)
      OR (p_user_address IS NOT NULL AND wallet_address = p_user_address)
    );

  -- Fetch up to 50 recent uncleared notifications
  SELECT jsonb_agg(
    jsonb_build_object(
      'id', id,
      'title', title,
      'message', message,
      'type', type,
      'action_url', action_url,
      'is_read', is_read,
      'read_at', read_at,
      'created_at', created_at
    ) ORDER BY created_at DESC
  ) INTO v_res
  FROM public.user_notifications
  WHERE is_cleared = false
    AND (
      (p_user_id IS NOT NULL AND user_id = p_user_id)
      OR (p_user_address IS NOT NULL AND wallet_address = p_user_address)
    );

  RETURN jsonb_build_object(
    'success', true,
    'notifications', COALESCE(v_res, '[]'::jsonb),
    'unread_count', v_unread_count
  );
END;
$$;

-- ----------------------------------------------------------------------------
-- 5. RPC: MARK NOTIFICATION READ
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.mark_notification_read(
  p_notification_id UUID,
  p_user_address TEXT DEFAULT NULL,
  p_user_id UUID DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_updated integer := 0;
BEGIN
  UPDATE public.user_notifications
  SET is_read = true, read_at = now()
  WHERE id = p_notification_id
    AND is_read = false
    AND (
      (p_user_id IS NOT NULL AND user_id = p_user_id)
      OR (p_user_address IS NOT NULL AND wallet_address = p_user_address)
      OR (p_user_id IS NULL AND p_user_address IS NULL)
    );
  
  GET DIAGNOSTICS v_updated = ROW_COUNT;

  RETURN jsonb_build_object('success', true, 'updated_count', v_updated);
END;
$$;

-- ----------------------------------------------------------------------------
-- 6. RPC: MARK ALL NOTIFICATIONS READ
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.mark_all_notifications_read(
  p_user_address TEXT DEFAULT NULL,
  p_user_id UUID DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_updated integer := 0;
BEGIN
  UPDATE public.user_notifications
  SET is_read = true, read_at = now()
  WHERE is_read = false
    AND is_cleared = false
    AND (
      (p_user_id IS NOT NULL AND user_id = p_user_id)
      OR (p_user_address IS NOT NULL AND wallet_address = p_user_address)
    );

  GET DIAGNOSTICS v_updated = ROW_COUNT;

  RETURN jsonb_build_object('success', true, 'updated_count', v_updated);
END;
$$;

-- ----------------------------------------------------------------------------
-- 7. RPC: CLEAR USER NOTIFICATIONS
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.clear_user_notifications(
  p_user_address TEXT DEFAULT NULL,
  p_user_id UUID DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_cleared integer := 0;
BEGIN
  UPDATE public.user_notifications
  SET is_cleared = true, cleared_at = now()
  WHERE is_cleared = false
    AND (
      (p_user_id IS NOT NULL AND user_id = p_user_id)
      OR (p_user_address IS NOT NULL AND wallet_address = p_user_address)
    );

  GET DIAGNOSTICS v_cleared = ROW_COUNT;

  RETURN jsonb_build_object('success', true, 'cleared_count', v_cleared);
END;
$$;

-- ----------------------------------------------------------------------------
-- 8. RPC: CREATE USER NOTIFICATION
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_user_notification(
  p_user_address TEXT,
  p_user_id UUID DEFAULT NULL,
  p_title TEXT DEFAULT 'Notification',
  p_message TEXT DEFAULT '',
  p_type TEXT DEFAULT 'info',
  p_action_url TEXT DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_notif_id UUID;
BEGIN
  INSERT INTO public.user_notifications (
    user_id,
    wallet_address,
    title,
    message,
    type,
    action_url,
    is_read,
    is_cleared,
    created_at
  ) VALUES (
    p_user_id,
    p_user_address,
    p_title,
    p_message,
    p_type,
    p_action_url,
    false,
    false,
    now()
  )
  RETURNING id INTO v_notif_id;

  RETURN jsonb_build_object('success', true, 'id', v_notif_id);
END;
$$;

-- ----------------------------------------------------------------------------
-- 9. RPC: GET SERVER-AUTHORITATIVE REWARD STATUS
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_daily_reward_status(
  p_user_address TEXT DEFAULT NULL,
  p_user_id UUID DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_bonus_settings jsonb;
  v_checkin_settings jsonb;
  v_last_claim timestamptz;
  v_cooldown_hours integer := 24;
  v_cooldown_seconds integer := 86400;
  v_seconds_since integer;
  v_can_claim boolean := true;
  v_seconds_remaining integer := 0;
  v_streak record;
  v_current_streak integer := 1;
  v_next_streak integer := 1;
  v_available_reward numeric := 0.25;
  v_today date := current_date;
  v_mode text := 'streak';
  v_missed_policy text := 'reset';
  v_streak_map jsonb;
BEGIN
  -- Read admin configurations
  SELECT value INTO v_bonus_settings FROM public.platform_settings WHERE key = 'bonus_rewards';
  SELECT value INTO v_checkin_settings FROM public.platform_settings WHERE key = 'daily_checkin';

  IF v_bonus_settings IS NOT NULL THEN
    v_cooldown_hours := COALESCE((v_bonus_settings->>'cooldown_hours')::integer, 24);
    v_cooldown_seconds := v_cooldown_hours * 3600;
    v_mode := COALESCE(v_bonus_settings->>'reward_mode', 'streak');
  END IF;

  IF v_checkin_settings IS NOT NULL THEN
    v_streak_map := v_checkin_settings->'streak_rewards';
    v_missed_policy := COALESCE(v_checkin_settings->>'missed_day_policy', 'reset');
  END IF;

  -- Default streak map if empty
  IF v_streak_map IS NULL THEN
    v_streak_map := jsonb_build_object(
      'day1', 0.10, 'day2', 0.15, 'day3', 0.20,
      'day4', 0.25, 'day5', 0.30, 'day6', 0.40, 'day7', 1.00
    );
  END IF;

  -- Check existing streak for user
  SELECT * INTO v_streak
  FROM public.user_daily_streaks
  WHERE (p_user_address IS NOT NULL AND wallet_address = p_user_address)
     OR (p_user_id IS NOT NULL AND user_id = p_user_id)
  LIMIT 1;

  IF v_streak IS NOT NULL THEN
    v_current_streak := COALESCE(v_streak.current_streak, 1);
  END IF;

  -- Check last claim in wallet_ledger
  SELECT created_at INTO v_last_claim
  FROM public.wallet_ledger
  WHERE ((p_user_id IS NOT NULL AND user_id = p_user_id) OR (p_user_address IS NOT NULL AND wallet_address = p_user_address))
    AND transaction_type IN ('daily_reward', 'daily_bonus')
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_last_claim IS NOT NULL THEN
    v_seconds_since := EXTRACT(EPOCH FROM (now() - v_last_claim))::integer;
    IF v_seconds_since < v_cooldown_seconds THEN
      v_can_claim := false;
      v_seconds_remaining := v_cooldown_seconds - v_seconds_since;
    END IF;
  END IF;

  -- Determine reward amount according to active mode
  IF v_mode = 'fixed' THEN
    v_available_reward := COALESCE((v_bonus_settings->>'fixed_amount')::numeric, 0.50);
  ELSIF v_mode = 'random' THEN
    v_available_reward := ROUND((COALESCE((v_bonus_settings->>'min_amount')::numeric, 0.05) + 
      ((COALESCE((v_bonus_settings->>'max_amount')::numeric, 1.00) - COALESCE((v_bonus_settings->>'min_amount')::numeric, 0.05)) * 0.4))::numeric, 2);
  ELSE
    -- Streak mode: calculate based on current streak
    v_available_reward := COALESCE((v_streak_map->>('day' || v_current_streak))::numeric, 0.10);
  END IF;

  -- Invariant: strictly capped at <= 1.00 FLO
  IF v_available_reward > 1.00 THEN v_available_reward := 1.00; END IF;
  IF v_available_reward < 0.01 THEN v_available_reward := 0.05; END IF;

  v_next_streak := (v_current_streak % 7) + 1;

  RETURN jsonb_build_object(
    'success', true,
    'can_claim', v_can_claim,
    'seconds_remaining', v_seconds_remaining,
    'available_reward', v_available_reward,
    'current_streak', v_current_streak,
    'next_streak', v_next_streak,
    'next_reward_amount', COALESCE((v_streak_map->>('day' || v_next_streak))::numeric, 0.15),
    'bonus_settings', v_bonus_settings,
    'checkin_settings', v_checkin_settings,
    'last_claimed_at', v_last_claim
  );
END;
$$;

-- ----------------------------------------------------------------------------
-- 10. RPC: ATOMIC DAILY BONUS / CHECK-IN CLAIM
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.claim_daily_bonus(
  p_user_address TEXT DEFAULT NULL,
  p_user_id UUID DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_uid UUID;
  v_addr TEXT;
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
  v_next_streak integer := 1;
  v_reward_amount numeric := 0.25;
  v_credit_res jsonb;
  v_day_ref text;
  v_streak_map jsonb;
  v_missed_policy text := 'reset';
  v_notif_res jsonb;
BEGIN
  v_uid := COALESCE(p_user_id, auth.uid());
  v_addr := p_user_address;

  IF v_uid IS NULL AND v_addr IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Authentication required to claim daily FLO Coin rewards.');
  END IF;

  -- 1. Read admin settings
  SELECT value INTO v_bonus_settings FROM public.platform_settings WHERE key = 'bonus_rewards';
  SELECT value INTO v_checkin_settings FROM public.platform_settings WHERE key = 'daily_checkin';

  IF v_bonus_settings IS NOT NULL THEN
    v_enabled := COALESCE((v_bonus_settings->>'enabled')::boolean, true);
    v_mode := COALESCE(v_bonus_settings->>'reward_mode', 'streak');
    v_cooldown_hours := COALESCE((v_bonus_settings->>'cooldown_hours')::integer, 24);
    v_cooldown_seconds := v_cooldown_hours * 3600;
  END IF;

  IF NOT v_enabled THEN
    RETURN jsonb_build_object('success', false, 'error', 'Daily rewards are currently paused by administrator.');
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

  -- 2. Verify cooldown from wallet_ledger
  SELECT created_at INTO v_last_claim
  FROM public.wallet_ledger
  WHERE ((v_uid IS NOT NULL AND user_id = v_uid) OR (v_addr IS NOT NULL AND wallet_address = v_addr))
    AND transaction_type IN ('daily_reward', 'daily_bonus')
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_last_claim IS NOT NULL THEN
    v_seconds_since := EXTRACT(EPOCH FROM (v_now - v_last_claim))::integer;
    IF v_seconds_since < v_cooldown_seconds THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'Daily FLO Coin reward already claimed. Next claim available in ' || ((v_cooldown_seconds - v_seconds_since) / 3600) || 'h ' || (((v_cooldown_seconds - v_seconds_since) % 3600) / 60) || 'm.',
        'seconds_remaining', (v_cooldown_seconds - v_seconds_since)
      );
    END IF;
  END IF;

  -- 3. Calculate streak
  SELECT * INTO v_streak
  FROM public.user_daily_streaks
  WHERE (v_addr IS NOT NULL AND wallet_address = v_addr)
     OR (v_uid IS NOT NULL AND user_id = v_uid)
  LIMIT 1;

  IF v_streak IS NULL THEN
    v_current_streak := 1;
  ELSE
    IF v_streak.last_checkin_date IS NOT NULL THEN
      IF v_streak.last_checkin_date = (v_today - 1) THEN
        -- Consecutive day
        v_current_streak := (v_streak.current_streak % 7) + 1;
      ELSIF v_streak.last_checkin_date = v_today THEN
        v_current_streak := v_streak.current_streak;
      ELSE
        -- Missed day
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

  -- 4. Calculate reward amount
  IF v_mode = 'fixed' THEN
    v_reward_amount := COALESCE((v_bonus_settings->>'fixed_amount')::numeric, 0.50);
  ELSIF v_mode = 'random' THEN
    v_reward_amount := ROUND((
      COALESCE((v_bonus_settings->>'min_amount')::numeric, 0.05) + 
      (random() * (COALESCE((v_bonus_settings->>'max_amount')::numeric, 1.00) - COALESCE((v_bonus_settings->>'min_amount')::numeric, 0.05)))
    )::numeric, 2);
  ELSE
    -- Streak mode
    v_reward_amount := COALESCE((v_streak_map->>('day' || v_current_streak))::numeric, 0.10);
  END IF;

  -- Invariant: strictly capped at <= 1.00 FLO
  IF v_reward_amount > 1.00 THEN v_reward_amount := 1.00; END IF;
  IF v_reward_amount < 0.01 THEN v_reward_amount := 0.05; END IF;

  -- 5. Reference ID for idempotency
  v_day_ref := 'daily-flo-' || to_char(v_now, 'YYYY-MM-DD') || '-' || COALESCE(v_uid::text, v_addr);

  -- 6. Atomically credit user virtual credits in wallet and ledger
  v_credit_res := public.credit_virtual_credits(
    v_reward_amount,
    'daily_reward',
    v_day_ref,
    'Daily FLO Coin Reward — Day ' || v_current_streak || ' Check-In (' || v_reward_amount || ' FLO = ' || v_reward_amount || ' USDT)',
    v_addr,
    v_uid,
    jsonb_build_object(
      'source', 'daily_flo_reward',
      'checkin_day', v_current_streak,
      'flo_amount', v_reward_amount,
      'usdt_value', v_reward_amount,
      'rate', '1 FLO = 1 USDT',
      'status', 'completed',
      'claimed_at', v_now
    )
  );

  -- 7. Update user daily streaks
  INSERT INTO public.user_daily_streaks (
    user_id,
    wallet_address,
    current_streak,
    last_checkin_date,
    last_claimed_at,
    total_checkins,
    total_flo_awarded,
    updated_at
  ) VALUES (
    v_uid,
    COALESCE(v_addr, v_uid::text),
    v_current_streak,
    v_today,
    v_now,
    1,
    v_reward_amount,
    v_now
  )
  ON CONFLICT (wallet_address) DO UPDATE SET
    current_streak = EXCLUDED.current_streak,
    last_checkin_date = EXCLUDED.last_checkin_date,
    last_claimed_at = EXCLUDED.last_claimed_at,
    total_checkins = public.user_daily_streaks.total_checkins + 1,
    total_flo_awarded = public.user_daily_streaks.total_flo_awarded + v_reward_amount,
    updated_at = v_now;

  -- 8. Create real persistent notification in user_notifications
  PERFORM public.create_user_notification(
    v_addr,
    v_uid,
    'Daily Reward Credited (Day ' || v_current_streak || ')',
    'Successfully claimed +' || v_reward_amount || ' FLO Coins (≈ $' || v_reward_amount || ' USDT). Come back tomorrow for Day ' || ((v_current_streak % 7) + 1) || '!',
    'reward',
    '/wallet'
  );

  v_next_streak := (v_current_streak % 7) + 1;

  RETURN jsonb_build_object(
    'success', true,
    'bonus_amount', v_reward_amount,
    'usdt_value', v_reward_amount,
    'new_balance', (v_credit_res->>'new_balance')::numeric,
    'current_streak', v_current_streak,
    'next_streak', v_next_streak,
    'transaction_id', (v_credit_res->>'transaction_id'),
    'message', 'Congratulations! +' || v_reward_amount || ' FLO Coins (' || v_reward_amount || ' USDT) added to your wallet.'
  );
END;
$$;

-- ----------------------------------------------------------------------------
-- 11. RPC: ADMIN UPDATE REWARD SETTINGS
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_update_reward_settings(
  p_bonus_settings JSONB DEFAULT NULL,
  p_checkin_settings JSONB DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
BEGIN
  IF p_bonus_settings IS NOT NULL THEN
    INSERT INTO public.platform_settings (key, value, updated_at)
    VALUES ('bonus_rewards', p_bonus_settings, now())
    ON CONFLICT (key) DO UPDATE
    SET value = p_bonus_settings, updated_at = now();
  END IF;

  IF p_checkin_settings IS NOT NULL THEN
    INSERT INTO public.platform_settings (key, value, updated_at)
    VALUES ('daily_checkin', p_checkin_settings, now())
    ON CONFLICT (key) DO UPDATE
    SET value = p_checkin_settings, updated_at = now();
  END IF;

  RETURN jsonb_build_object('success', true, 'message', 'Reward settings updated successfully.');
END;
$$;

-- ----------------------------------------------------------------------------
-- 12. RPC: ADMIN GET REWARDS ANALYTICS
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_get_rewards_analytics()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_total_claims integer := 0;
  v_total_distributed numeric := 0;
  v_active_streaks integer := 0;
  v_bonus_settings jsonb;
  v_checkin_settings jsonb;
  v_recent_claims jsonb;
BEGIN
  SELECT COUNT(*), COALESCE(SUM(amount), 0)
  INTO v_total_claims, v_total_distributed
  FROM public.wallet_ledger
  WHERE transaction_type IN ('daily_reward', 'daily_bonus');

  SELECT COUNT(*) INTO v_active_streaks
  FROM public.user_daily_streaks
  WHERE last_claimed_at >= (now() - interval '48 hours');

  SELECT value INTO v_bonus_settings FROM public.platform_settings WHERE key = 'bonus_rewards';
  SELECT value INTO v_checkin_settings FROM public.platform_settings WHERE key = 'daily_checkin';

  SELECT jsonb_agg(
    jsonb_build_object(
      'id', id,
      'wallet_address', wallet_address,
      'amount', amount,
      'balance_after', balance_after,
      'created_at', created_at,
      'description', description
    ) ORDER BY created_at DESC
  ) INTO v_recent_claims
  FROM (
    SELECT id, wallet_address, amount, balance_after, created_at, description
    FROM public.wallet_ledger
    WHERE transaction_type IN ('daily_reward', 'daily_bonus')
    ORDER BY created_at DESC
    LIMIT 20
  ) sub;

  RETURN jsonb_build_object(
    'success', true,
    'total_claims', v_total_claims,
    'total_distributed_flo', v_total_distributed,
    'active_streaks_count', v_active_streaks,
    'bonus_settings', v_bonus_settings,
    'checkin_settings', v_checkin_settings,
    'recent_claims', COALESCE(v_recent_claims, '[]'::jsonb)
  );
END;
$$;
