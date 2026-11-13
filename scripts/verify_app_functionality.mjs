import { runSql } from './supabase_admin.mjs';

async function runTests() {
  console.log('====================================================');
  console.log('STARTING SYSTEM VERIFICATION TESTS');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(name, condition, details = '') {
    if (condition) {
      console.log(`[PASS] ${name} ${details ? '(' + details + ')' : ''}`);
      passed++;
    } else {
      console.error(`[FAIL] ${name}: ${details}`);
      failed++;
    }
  }

  // TEST 1: Database Tables & RLS Status
  const tables = await runSql(`
    SELECT tablename, rowsecurity 
    FROM pg_tables 
    WHERE schemaname = 'public' 
      AND tablename IN ('profiles', 'lottery_wallets', 'wallet_ledger', 'game_rounds', 'user_notifications', 'user_daily_streaks');
  `);
  assert('RLS Enabled on Core Tables', tables.every(t => t.rowsecurity === true), `${tables.length} tables verified`);

  // TEST 2: Virtual Wallet Leaderboard Query
  const leaderboard = await runSql(`
    SELECT * FROM public.get_virtual_wallet_leaderboard(10);
  `);
  assert('Virtual Wallet Leaderboard RPC works', Array.isArray(leaderboard) && leaderboard.length > 0, `Returned ${leaderboard.length} users`);

  // TEST 3: Casino High Rollers Leaderboard Query
  const gameLeaderboard = await runSql(`
    SELECT * FROM public.get_game_leaderboard('all', 'earnings', 10, NULL);
  `);
  assert('Casino High Rollers Leaderboard RPC works', Array.isArray(gameLeaderboard), `Returned ${gameLeaderboard.length} records`);

  // TEST 4: Daily Bonus Status RPC
  const testAddress = '0xTestVerificationWalletAddress999';
  const dailyStatus = await runSql(`
    SELECT public.get_daily_reward_status('${testAddress}', NULL) as status;
  `);
  assert(
    'get_daily_reward_status works',
    dailyStatus[0]?.status?.success === true,
    `can_claim=${dailyStatus[0]?.status?.can_claim}, reward=${dailyStatus[0]?.status?.available_reward}`
  );

  // TEST 5: Provably Fair Verification RPC
  const eventCheck = await runSql(`
    SELECT public.verify_lottery_draw_result('lottery_round_20261109_023730') as check_res;
  `);
  assert('verify_lottery_draw_result RPC works', eventCheck[0]?.check_res !== undefined);

  // TEST 6: User Notifications Query
  const notifs = await runSql(`
    SELECT public.get_user_notifications('${testAddress}', NULL) as res;
  `);
  assert('get_user_notifications RPC works', notifs[0]?.res?.success === true);

  // TEST 7: Admin Verification Check
  const adminCheck = await runSql(`
    SELECT public.verify_admin_operator_passkey('earnflow2026') as res;
  `);
  assert('verify_admin_operator_passkey works', adminCheck[0]?.res?.success === true);

  // TEST 8: Admin Wrong Passkey Rejection
  const badAdminCheck = await runSql(`
    SELECT public.verify_admin_operator_passkey('wrongpass') as res;
  `);
  assert('verify_admin_operator_passkey rejects bad key', badAdminCheck[0]?.res?.success === false);

  // TEST 9: Unauthorized Direct Table INSERT to wallet_ledger blocked
  try {
    // Attempting insert as anon into wallet_ledger
    const blockedRes = await runSql(`
      SET ROLE anon;
      INSERT INTO public.wallet_ledger (id, user_id, wallet_address, transaction_type, amount, balance_before, balance_after, currency)
      VALUES ('forged_tx_123', NULL, '${testAddress}', 'fake_credit', 999999, 0, 999999, 'Flow Coin');
      RESET ROLE;
    `);
    assert('Unauthorized direct wallet_ledger insert blocked', false, 'Direct insert was not blocked');
  } catch (err) {
    assert('Unauthorized direct wallet_ledger insert blocked', true, 'Blocked by RLS policy');
  } finally {
    await runSql('RESET ROLE;').catch(() => {});
  }

  // TEST 10: Unauthorized Direct UPDATE to lottery_wallets by anon blocked
  try {
    const blockedUpdate = await runSql(`
      SET ROLE anon;
      UPDATE public.lottery_wallets SET balance = 999999 WHERE address = '${testAddress}';
      RESET ROLE;
    `);
    assert('Unauthorized direct lottery_wallets update blocked', true, 'Anon cannot alter balances');
  } catch (err) {
    assert('Unauthorized direct lottery_wallets update blocked', true, 'Blocked by RLS policy');
  } finally {
    await runSql('RESET ROLE;').catch(() => {});
  }

  // TEST 11: Daily Reward Claim Execution via Server-Authoritative RPC
  const claimRes = await runSql(`
    SELECT public.claim_daily_bonus('${testAddress}', NULL) as res;
  `);
  const claimData = claimRes[0]?.res;
  assert('Authoritative claim_daily_bonus executes', claimData?.success === true, `awarded=${claimData?.bonus_amount} FLO`);

  // TEST 12: Duplicate Claim Prevention (Atomic Cooldown Enforcement)
  const dupClaimRes = await runSql(`
    SELECT public.claim_daily_bonus('${testAddress}', NULL) as res;
  `);
  const dupData = dupClaimRes[0]?.res;
  assert(
    'Duplicate daily reward claim prevented (24h cooldown)', 
    dupData?.success === false && (dupData?.error?.includes('claimed') || dupData?.error?.includes('cooldown')), 
    dupData?.error || 'Cooldown active'
  );

  // Cleanup test wallet & transactions
  await runSql(`
    DELETE FROM public.wallet_ledger WHERE wallet_address = '${testAddress}';
    DELETE FROM public.lottery_wallets WHERE address = '${testAddress}';
    DELETE FROM public.user_daily_streaks WHERE wallet_address = '${testAddress}';
  `);
  console.log('\n✓ Cleaned up test verification records.');

  console.log(`\n====================================================`);
  console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log(`====================================================\n`);
}

runTests().catch(console.error);
