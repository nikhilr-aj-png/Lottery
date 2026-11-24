import { runSql } from './supabase_admin.mjs';

async function main() {
  console.log('================================================================');
  console.log('AUDIT & FIX USDT REWARDS PRECISION & IDEMPOTENCY');
  console.log('================================================================\n');

  // Step 1: Audit historical transactions
  console.log('[Step 1] Auditing historical transactions in public.wallet_ledger...');
  const auditRes = await runSql(`
    SELECT id, wallet_address, transaction_type, amount, balance_before, balance_after, currency, reference_id, description, created_at 
    FROM public.wallet_ledger 
    WHERE transaction_type IN ('lucky_wheel_spin', 'daily_bonus', 'daily_reward') 
       OR amount >= 50
    ORDER BY created_at DESC 
    LIMIT 25;
  `);
  console.log('Audit findings count:', auditRes?.length || 0);
  console.log('Audit records:');
  console.log(JSON.stringify(auditRes, null, 2));

  // Step 2: Update public.credit_virtual_credits
  console.log('\n[Step 2] Updating public.credit_virtual_credits to enforce exact USDT decimal precision & idempotency...');
  const creditRpcSql = `
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
  v_exact_amount numeric;
  v_old_balance numeric := 0;
  v_new_balance numeric;
  v_tx_id text;
BEGIN
  v_uid := COALESCE(p_target_user_id, auth.uid());

  IF p_amount IS NULL OR p_amount <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Amount must be greater than zero.');
  END IF;

  -- Enforce exact 2-decimal precision for USDT
  v_exact_amount := ROUND(p_amount, 2);

  -- 1. Idempotency check: if this reference was already credited, prevent duplicate payouts
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

  -- 2. Find or create user wallet
  SELECT * INTO v_wallet FROM public.lottery_wallets 
  WHERE (v_uid IS NOT NULL AND user_id = v_uid) OR (p_user_address IS NOT NULL AND address = p_user_address)
  ORDER BY updated_at DESC LIMIT 1
  FOR UPDATE;

  IF NOT FOUND THEN
    -- Generate fresh wallet address if not provided
    v_addr := COALESCE(p_user_address, '0x' || substr(md5(random()::text || clock_timestamp()::text), 1, 40));
    v_old_balance := 0.00;
    v_new_balance := v_exact_amount;

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

  -- 3. Record in immutable double-entry ledger
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
    v_exact_amount,
    v_old_balance,
    v_new_balance,
    'USDT',
    p_reference_id,
    COALESCE(p_description, 'Credit from ' || p_transaction_type),
    p_metadata,
    now()
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
$$;
GRANT EXECUTE ON FUNCTION public.credit_virtual_credits(numeric, text, text, text, text, uuid, jsonb) TO anon, authenticated, service_role;
  `;
  await runSql(creditRpcSql);
  console.log('✓ public.credit_virtual_credits successfully updated');

  // Step 3: Update public.claim_daily_bonus
  console.log('\n[Step 3] Updating public.claim_daily_bonus stored procedure...');
  const dailyBonusSql = `
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
  v_reward_amount numeric := 0.25;
  v_credit_res jsonb;
  v_day_ref text;
  v_streak_map jsonb;
  v_missed_policy text := 'reset';
BEGIN
  v_uid := COALESCE(p_user_id, auth.uid());
  v_addr := p_user_address;

  IF v_uid IS NULL AND v_addr IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Authentication required to claim daily bonus.');
  END IF;

  -- 1. Read admin settings directly from platform_settings
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
        'error', 'Daily bonus already claimed. Next claim available in ' || ((v_cooldown_seconds - v_seconds_since) / 3600) || 'h ' || (((v_cooldown_seconds - v_seconds_since) % 3600) / 60) || 'm.',
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

  -- 4. Calculate exact USDT reward amount strictly from configuration
  IF v_mode = 'fixed' THEN
    v_reward_amount := ROUND(COALESCE((v_bonus_settings->>'fixed_amount')::numeric, 0.50), 2);
  ELSIF v_mode = 'random' THEN
    v_reward_amount := ROUND((
      COALESCE((v_bonus_settings->>'min_amount')::numeric, 0.05) + 
      (random() * (COALESCE((v_bonus_settings->>'max_amount')::numeric, 1.00) - COALESCE((v_bonus_settings->>'min_amount')::numeric, 0.05)))
    )::numeric, 2);
  ELSE
    -- Streak mode
    v_reward_amount := ROUND(COALESCE((v_streak_map->>('day' || v_current_streak))::numeric, 0.10), 2);
  END IF;

  -- Strict bounds check
  IF v_reward_amount > 10.00 THEN v_reward_amount := 1.00; END IF;
  IF v_reward_amount < 0.01 THEN v_reward_amount := 0.05; END IF;

  -- 5. Reference ID for idempotency (per user/day)
  v_day_ref := 'daily-bonus-' || to_char(v_now, 'YYYY-MM-DD') || '-' || COALESCE(v_uid::text, v_addr);

  -- 6. Atomically credit user virtual credits in wallet and ledger
  v_credit_res := public.credit_virtual_credits(
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

  -- 7. Update user daily streaks
  INSERT INTO public.user_daily_streaks (
    user_id,
    wallet_address,
    current_streak,
    highest_streak,
    last_checkin_date,
    total_claimed_rewards,
    updated_at
  ) VALUES (
    v_uid,
    v_addr,
    v_current_streak,
    v_current_streak,
    v_today,
    v_reward_amount,
    v_now
  )
  ON CONFLICT (wallet_address) DO UPDATE SET
    current_streak = v_current_streak,
    highest_streak = GREATEST(user_daily_streaks.highest_streak, v_current_streak),
    last_checkin_date = v_today,
    total_claimed_rewards = ROUND(COALESCE(user_daily_streaks.total_claimed_rewards, 0) + v_reward_amount, 2),
    updated_at = v_now;

  RETURN jsonb_build_object(
    'success', true,
    'day', v_current_streak,
    'amount', v_reward_amount,
    'currency', 'USDT',
    'new_balance', (v_credit_res->>'new_balance')::numeric,
    'transaction_id', (v_credit_res->>'transaction_id'),
    'message', 'Congratulations! ' || to_char(v_reward_amount, 'FM999999990.00') || ' USDT claimed successfully!'
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.claim_daily_bonus(TEXT, UUID) TO anon, authenticated, service_role;
  `;
  await runSql(dailyBonusSql);
  console.log('✓ public.claim_daily_bonus successfully updated');

  // Step 4: Update public.spin_lucky_wheel
  console.log('\n[Step 4] Updating public.spin_lucky_wheel stored procedure...');
  const spinWheelSql = `
CREATE OR REPLACE FUNCTION public.spin_lucky_wheel(p_user_address text, p_user_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth', 'extensions', 'pg_temp'
AS $function$
DECLARE
  v_uid uuid := COALESCE(p_user_id, auth.uid());
  v_last_spin timestamptz;
  v_now timestamptz := now();
  v_wheel_settings jsonb;
  v_cooldown integer := 86400; -- 24 hours
  v_elapsed integer;
  v_rand numeric;
  v_slice_index integer;
  v_final_prize numeric;
  v_tier text := 'Standard';
  v_spin_ref text;
  v_credit_res jsonb;
  v_segments jsonb;
  v_seg record;
  v_cum_prob numeric := 0;
  v_found boolean := false;
BEGIN
  IF p_user_address IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Wallet address is required');
  END IF;

  -- 1. Read spin wheel settings directly from platform_settings
  SELECT value INTO v_wheel_settings FROM public.platform_settings WHERE key = 'spin_wheel_settings';
  IF v_wheel_settings IS NOT NULL THEN
    IF (v_wheel_settings->>'enabled')::boolean = false THEN
      RETURN jsonb_build_object('success', false, 'error', 'Lucky Wheel is currently disabled.');
    END IF;
    v_cooldown := COALESCE((v_wheel_settings->>'cooldown_hours')::integer * 3600, 86400);
    v_segments := v_wheel_settings->'segments';
  END IF;

  -- 2. Check cooldown from user_vip_progress or wallet_ledger
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
        'error', 'Lucky Wheel on cooldown. Return in ' || ((v_cooldown - v_elapsed) / 3600) || ' hour(s).',
        'seconds_remaining', (v_cooldown - v_elapsed)
      );
    END IF;
  END IF;

  -- 3. Deterministic probability slice calculation in EXACT USDT
  -- If segments are configured in platform_settings, dynamically evaluate cumulative probability
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

  -- Fallback if segments not found or probability boundary missed
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

  -- Exact 2 decimal USDT rounding
  v_final_prize := ROUND(v_final_prize, 2);

  -- 4. Idempotency reference for the day
  v_spin_ref := 'wheel-' || to_char(v_now, 'YYYY-MM-DD') || '-' || substring(p_user_address from 3 for 8);

  -- 5. Credit virtual wallet via double-entry ledger in EXACT USDT (NO arbitrary VIP multipliers)
  v_credit_res := public.credit_virtual_credits(
    v_final_prize,
    'lucky_wheel_spin',
    v_spin_ref,
    'Daily Lucky Wheel Prize: ' || to_char(v_final_prize, 'FM999999990.00') || ' USDT',
    p_user_address,
    v_uid,
    jsonb_build_object('slice', v_slice_index, 'amount', v_final_prize, 'currency', 'USDT')
  );

  -- 6. Record spin history
  INSERT INTO public.user_vip_progress (wallet_address, user_id, last_wheel_spin_at, updated_at)
  VALUES (p_user_address, v_uid, v_now, v_now)
  ON CONFLICT (wallet_address) DO UPDATE SET
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
GRANT EXECUTE ON FUNCTION public.spin_lucky_wheel(text, uuid) TO anon, authenticated, service_role;
  `;
  await runSql(spinWheelSql);
  console.log('✓ public.spin_lucky_wheel successfully updated');

  // Step 5: Test all 9 required credit values for USDT precision
  console.log('\n[Step 5] Testing exact decimal precision credits across all 9 required values...');
  const testAmounts = [0.01, 0.05, 0.10, 0.25, 0.50, 1.00, 2.50, 10.00, 100.00];
  const testAddr = '0x_test_usdt_precision_' + Date.now();
  let expectedBalance = 0.00;

  for (const amt of testAmounts) {
    const ref = `test-credit-${amt}-${Date.now()}`;
    const testRes = await runSql(`
      SELECT public.credit_virtual_credits(
        ${amt},
        'test_precision_credit',
        '${ref}',
        'Test precision credit of ${amt} USDT',
        '${testAddr}',
        NULL,
        '{"test": true, "nominal": ${amt}}'::jsonb
      ) as res;
    `);
    const parsed = testRes[0].res;
    expectedBalance = Math.round((expectedBalance + amt) * 100) / 100;
    const actualBal = Number(parsed.new_balance);
    const credited = Number(parsed.credited);

    if (credited !== amt || actualBal !== expectedBalance) {
      throw new Error(`Precision mismatch! Sent: ${amt}, Credited: ${credited}, Expected Balance: ${expectedBalance}, Actual: ${actualBal}`);
    }
    console.log(`  ✓ Credited ${amt.toFixed(2)} USDT -> Result: ${credited.toFixed(2)} USDT, Balance: ${actualBal.toFixed(2)} USDT (Match)`);

    // Test idempotency on the same reference ID
    const duplicateRes = await runSql(`
      SELECT public.credit_virtual_credits(
        ${amt},
        'test_precision_credit',
        '${ref}',
        'Test duplicate',
        '${testAddr}',
        NULL,
        '{"test": true}'::jsonb
      ) as res;
    `);
    const dupParsed = duplicateRes[0].res;
    if (!dupParsed.already_processed || Number(dupParsed.new_balance) !== actualBal) {
      throw new Error(`Idempotency check failed for ref ${ref}!`);
    }
    console.log(`    ↳ Idempotency verified: already_processed=true, balance unchanged (${dupParsed.new_balance})`);
  }

  // Clean up test address from database
  console.log('\n[Step 6] Cleaning up test wallet and ledger transactions...');
  await runSql(`DELETE FROM public.wallet_ledger WHERE wallet_address = '${testAddr}';`);
  await runSql(`DELETE FROM public.lottery_wallets WHERE address = '${testAddr}';`);
  console.log('✓ Test records cleaned up.');

  console.log('\n================================================================');
  console.log('ALL PRECISION CHECKS & IDEMPOTENCY TESTS PASSED SUCCESSFULLY!');
  console.log('================================================================');
}

main().catch(err => {
  console.error('Migration & test failed:', err);
  process.exit(1);
});
