-- ============================================================================
-- MIGRATION: RANDOM DAILY FLO COIN REWARDS (UP TO 1.00 FLO = 1.00 USDT)
-- ============================================================================
-- 1. Enforces 24-hour cooldown between claims.
-- 2. Generates server-side random fractional reward between 0.05 and 1.00 FLO.
-- 3. Strict security: never exceeds 1.00 FLO Coin (1.00 USDT).
-- 4. Records atomic double-entry credit in public.wallet_ledger.
-- ============================================================================

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
  v_bonus_amount numeric;
  v_credit_res jsonb;
  v_day_ref text;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL AND p_user_address IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Authentication required to claim daily FLO Coins.');
  END IF;

  -- 1. Check last claim in wallet_ledger (checks both daily_bonus and daily_reward)
  SELECT created_at INTO v_last_claim 
  FROM public.wallet_ledger 
  WHERE ((v_uid IS NOT NULL AND user_id = v_uid) OR wallet_address = p_user_address)
    AND transaction_type IN ('daily_bonus', 'daily_reward')
  ORDER BY created_at DESC 
  LIMIT 1;

  IF v_last_claim IS NOT NULL THEN
    v_seconds_since_last := EXTRACT(EPOCH FROM (v_now - v_last_claim))::integer;
    IF v_seconds_since_last < v_cooldown_seconds THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'Daily FLO Coin reward already claimed. Please return in ' || ((v_cooldown_seconds - v_seconds_since_last) / 3600) || ' hour(s).',
        'seconds_remaining', (v_cooldown_seconds - v_seconds_since_last)
      );
    END IF;
  END IF;

  -- 2. Server-side random fractional reward between 0.05 and 1.00 FLO Coin (never exceeds 1.00 FLO)
  -- 1 FLO = 1 USDT
  v_bonus_amount := ROUND((0.05 + (random() * 0.95))::numeric, 2);
  IF v_bonus_amount > 1.00 THEN
    v_bonus_amount := 1.00;
  END IF;
  IF v_bonus_amount < 0.01 THEN
    v_bonus_amount := 0.05;
  END IF;

  -- 3. Use date string as idempotency reference (e.g. daily-flo-2026-11-12-addr)
  v_day_ref := 'daily-flo-' || to_char(v_now, 'YYYY-MM-DD') || '-' || COALESCE(v_uid::text, p_user_address);

  -- 4. Credit daily reward atomically into wallet and ledger
  v_credit_res := public.credit_virtual_credits(
    v_bonus_amount,
    'daily_reward',
    v_day_ref,
    'Daily FLO Coin Reward (' || v_bonus_amount || ' FLO = ' || v_bonus_amount || ' USDT)',
    p_user_address,
    v_uid,
    jsonb_build_object(
      'source', 'daily_flo_reward', 
      'flo_amount', v_bonus_amount,
      'usdt_value', v_bonus_amount, 
      'rate', '1 FLO = 1 USDT',
      'status', 'completed'
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'bonus_amount', v_bonus_amount,
    'usdt_value', v_bonus_amount,
    'new_balance', (v_credit_res->>'new_balance')::numeric,
    'transaction_id', (v_credit_res->>'transaction_id'),
    'message', 'Congratulations! ' || v_bonus_amount || ' FLO Coins (' || v_bonus_amount || ' USDT) added to your wallet.'
  );
END;
$$;

