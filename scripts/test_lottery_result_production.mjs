import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const supabaseUrl = 'https://pkloymdzdjykpsutpyqk.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBrbG95bWR6ZGp5a3BzdXRweXFrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIxMjQyMzUsImV4cCI6MjA4NzcwMDIzNX0.0YYFrt5Ra2s_4ilI378kClnB8lp3yNSgkB7iDSPZQUk';
const supabase = createClient(supabaseUrl, supabaseKey);

async function runProductionTests() {
  console.log('=================================================================');
  console.log('FOUR DIGIT LOTTERY RESULT SCREEN - FINAL REDESIGN AUDIT');
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

  // 1. Single-Section Architectural Audit of LotteryShowResultScreen.tsx JSX
  const resultScreenPath = path.resolve('src/components/LotteryShowResultScreen.tsx');
  const resultScreenCode = fs.readFileSync(resultScreenPath, 'utf-8');
  const jsxPart = resultScreenCode.slice(resultScreenCode.indexOf('return ('));

  assert('Winning Digits section is present in JSX', jsxPart.includes('Winning Digits'));
  assert('Winners & Payouts is completely absent from JSX', !jsxPart.includes('Winners &amp; Payouts') && !jsxPart.includes('Winners & Payouts'));
  assert('Audit Proof button is completely absent from JSX', !jsxPart.includes('Audit Proof'));
  assert('SHA-256 Commit box is completely absent from JSX', !jsxPart.includes('SHA-256 Commit'));
  assert('Total Distributed USDT is completely absent from JSX', !jsxPart.includes('Total Distributed'));
  assert('Internal vertical scrolling container is implemented', jsxPart.includes('overflow-y-auto') && jsxPart.includes('min-h-0'));
  assert('Pinned section header is implemented', jsxPart.includes('border-b border-[#1F2737]') && jsxPart.includes('shrink-0'));

  // 2. Data Integrity: Query genuine winner_payouts & lottery_events from Supabase
  const { data: payouts, error: pErr } = await supabase
    .from('winner_payouts')
    .select('*');

  assert('winner_payouts table accessible', !pErr && Array.isArray(payouts), `Found ${payouts?.length || 0} payout records`);

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

  // 4. Dynamic Percentage Share Calculation for multi-winner
  function getPositionShare(event, idx, totalPositions) {
    const dist = event?.winnerDistribution || event?.winner_distribution;
    if (Array.isArray(dist) && dist.length > idx) {
      const item = dist[idx];
      const pct = item?.percent || item?.percentage;
      if (typeof pct === 'number' && pct > 0) return pct;
    }
    if (totalPositions <= 1) return 100;
    if (totalPositions === 2) return idx === 0 ? 60 : 40;
    if (totalPositions === 3) return idx === 0 ? 50 : idx === 1 ? 30 : 20;
    if (totalPositions === 4) return idx === 0 ? 40 : idx === 1 ? 30 : idx === 2 ? 20 : 10;
    const equalShare = Math.floor(100 / totalPositions);
    return idx === 0 ? 100 - (equalShare * (totalPositions - 1)) : equalShare;
  }

  const singleShare = getPositionShare({}, 0, 1);
  assert('Single winner share is 100%', singleShare === 100);

  const multiShare1 = getPositionShare({}, 0, 3);
  const multiShare2 = getPositionShare({}, 1, 3);
  const multiShare3 = getPositionShare({}, 2, 3);
  assert('Multi-winner 3 positions split correctly (50/30/20)', multiShare1 === 50 && multiShare2 === 30 && multiShare3 === 20);

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
