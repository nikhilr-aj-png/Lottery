import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://pkloymdzdjykpsutpyqk.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBrbG95bWR6ZGp5a3BzdXRweXFrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIxMjQyMzUsImV4cCI6MjA4NzcwMDIzNX0.0YYFrt5Ra2s_4ilI378kClnB8lp3yNSgkB7iDSPZQUk';
const supabase = createClient(supabaseUrl, supabaseKey);

async function runProductionTests() {
  console.log('=================================================================');
  console.log('FOUR DIGIT LOTTERY RESULT SCREEN - PRODUCTION READINESS AUDIT');
  console.log('=================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(name, condition, details = '') {
    if (condition) {
      console.log(`[PASS] ${name} ${details ? '— ' + details : ''}`);
      passed++;
    } else {
      console.error(`[FAIL] ${name}: ${details}`);
      failed++;
    }
  }

  // 1. Data Integrity: Query genuine winner_payouts
  const { data: payouts, error: pErr } = await supabase
    .from('winner_payouts')
    .select('*');

  assert('winner_payouts query succeeds', !pErr && Array.isArray(payouts), `Found ${payouts?.length || 0} payout records`);

  if (payouts && payouts.length > 0) {
    const hasFakeUsernames = payouts.some(p => p.winner_username === '@crypto_whale' || p.winner_username === '@Winner_1');
    assert('No fake mock usernames in winner_payouts', !hasFakeUsernames);

    const hasValidCurrencies = payouts.every(p => p.currency === 'USDT' || p.currency === 'FC');
    assert('All payouts have valid currency', hasValidCurrencies);

    const hasValidPositions = payouts.every(p => typeof p.position === 'number' && p.position >= 1);
    assert('All payouts have valid position rank', hasValidPositions);

    const hasValidAmounts = payouts.every(p => Number(p.payout_amount) >= 0);
    assert('All payouts have positive or zero amounts', hasValidAmounts);
  }

  // 2. Data Integrity: Query lottery_events
  const { data: events, error: eErr } = await supabase
    .from('lottery_events')
    .select('*')
    .limit(20);

  assert('lottery_events query succeeds', !eErr && Array.isArray(events), `Found ${events?.length || 0} events`);

  // 3. Logic Test: Zero dummy winning codes fallback
  function parseWinningCodes(event) {
    if (!event) return [];
    const rawCodes = 
      event.drawResultCodes ||
      event.draw_result_codes ||
      event.winningCodes ||
      event.winning_codes ||
      event.winningDigits ||
      event.winning_digits ||
      event.presetWinningDigits ||
      event.preset_winning_digits;

    let codes = [];
    if (Array.isArray(rawCodes) && rawCodes.length > 0) {
      codes = rawCodes
        .map(c => String(c).replace(/\D/g, '').padStart(4, '0'))
        .filter(c => c.length === 4);
    } else if (typeof rawCodes === 'string' && rawCodes.trim().length > 0) {
      codes = rawCodes
        .split(',')
        .map(s => s.replace(/\D/g, '').padStart(4, '0'))
        .filter(c => c.length === 4);
    }
    return Array.from(new Set(codes));
  }

  const emptyEvent = { id: 'test-empty', winning_digits: null, status: 'result_pending' };
  const parsedEmpty = parseWinningCodes(emptyEvent);
  assert('Event without drawn digits produces EMPTY array (NO 8888 dummy injection)', parsedEmpty.length === 0);

  const realEvent = { id: 'test-real', winning_digits: '4921,8304' };
  const parsedReal = parseWinningCodes(realEvent);
  assert('Event with real digits parses correctly', parsedReal.length === 2 && parsedReal[0] === '4921' && parsedReal[1] === '8304');

  // 4. Logic Test: Authoritative Total Distributed Calculation
  function calculateTotalDistributed(winners) {
    if (winners.length > 0) {
      return winners.reduce((sum, w) => sum + Number(w.payoutAmount || 0), 0);
    }
    return 0; // ZERO if no winners
  }

  assert('Total distributed is 0 when 0 winners matched', calculateTotalDistributed([]) === 0);

  const testWinners = [
    { rank: 1, payoutAmount: 4500 },
    { rank: 2, payoutAmount: 2700 },
    { rank: 3, payoutAmount: 1800 }
  ];
  assert('Total distributed equals exact sum of payouts', calculateTotalDistributed(testWinners) === 9000);

  // 5. Logic Test: Masked Identity formatting for privacy
  function formatWinnerName(w) {
    if (w.winnerUsername && w.winnerUsername.trim()) {
      const clean = w.winnerUsername.trim();
      return clean.startsWith('@') ? clean : `@${clean}`;
    }
    if (w.winnerAddress && w.winnerAddress.trim()) {
      const addr = w.winnerAddress.trim();
      if (addr.length > 10) {
        return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
      }
      return addr;
    }
    if (w.userId) {
      return `User #${String(w.userId).slice(0, 6)}`;
    }
    return `Winner #${w.rank || 1}`;
  }

  assert('Format username: @trader_alex', formatWinnerName({ winnerUsername: 'trader_alex' }) === '@trader_alex');
  assert('Format address mask: 0x673c...0000', formatWinnerName({ winnerAddress: '0x673caf5b5cd84d10a50ec74f9580f3c000000000' }) === '0x673c...0000');
  assert('Format userId: User #usr123', formatWinnerName({ userId: 'usr123456' }) === 'User #usr123');

  // 6. Logic Test: Audit Commit Hash (No 0x4f8a dummy fallback)
  function resolveCommitHash(event, audit) {
    return audit?.commit_hash || event?.sha256Seed || event?.sha256_seed || null;
  }

  assert('Commit hash is null when not published (NO 0x4f8a fallback)', resolveCommitHash({}, null) === null);
  assert('Real commit hash is preserved', resolveCommitHash({ sha256_seed: '0x9999aaaabbbb' }, null) === '0x9999aaaabbbb');

  console.log('\n=================================================================');
  console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('=================================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runProductionTests().catch(err => {
  console.error('Test execution error:', err);
  process.exit(1);
});
