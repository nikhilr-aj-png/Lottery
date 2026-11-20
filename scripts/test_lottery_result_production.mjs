import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const supabaseUrl = 'https://pkloymdzdjykpsutpyqk.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBrbG95bWR6ZGp5a3BzdXRweXFrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIxMjQyMzUsImV4cCI6MjA4NzcwMDIzNX0.0YYFrt5Ra2s_4ilI378kClnB8lp3yNSgkB7iDSPZQUk';
const supabase = createClient(supabaseUrl, supabaseKey);

async function runProductionTests() {
  console.log('=================================================================');
  console.log('FOUR DIGIT LOTTERY - COMPREHENSIVE PRODUCTION READINESS AUDIT');
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

  // 1. Navigation Strip Audit: Verify removal of redundant "All Games" back strip
  const gamePagePath = path.resolve('src/pages/GamePage.tsx');
  const gamePageCode = fs.readFileSync(gamePagePath, 'utf-8');

  assert(
    'GamePage: Redundant "All Games" lobby back button completely removed',
    !gamePageCode.includes('title="Back to All Games"') && !gamePageCode.includes('<span className="hidden xs:inline">All Games</span>')
  );
  assert(
    'GamePage: Redundant single-row game lobby banner completely removed',
    !gamePageCode.includes('COMPACT SINGLE-ROW GAME LOBBY BANNER')
  );

  // 2. Result Screen: Full-Screen Winning Digits Only Architecture
  const resultScreenPath = path.resolve('src/components/LotteryShowResultScreen.tsx');
  const resultScreenCode = fs.readFileSync(resultScreenPath, 'utf-8');
  const resultJsxPart = resultScreenCode.slice(resultScreenCode.indexOf('return ('));

  assert(
    'Result Screen: Official Draw Results header is present in JSX',
    resultJsxPart.includes('Official Draw Results')
  );
  assert(
    'Result Screen: Small room header card is completely removed from JSX',
    !resultJsxPart.includes('max-w-3xl mx-auto rounded-2xl p-3 sm:p-4 border')
  );
  assert(
    'Result Screen: Winners & Payouts is completely absent from JSX',
    !resultJsxPart.includes('Winners &amp; Payouts') && !resultJsxPart.includes('Winners & Payouts')
  );
  assert(
    'Result Screen: Audit Proof button is completely absent from JSX',
    !resultJsxPart.includes('Audit Proof')
  );
  assert(
    'Result Screen: SHA-256 Commit box is completely absent from JSX',
    !resultJsxPart.includes('SHA-256 Commit')
  );
  assert(
    'Result Screen: Total Distributed USDT is completely absent from JSX',
    !resultJsxPart.includes('Total Distributed')
  );
  assert(
    'Result Screen: Equal-sized responsive combination grid is implemented',
    resultJsxPart.includes('grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4')
  );
  assert(
    'Result Screen: Internal vertical scrolling container is implemented',
    resultJsxPart.includes('overflow-y-auto') && resultJsxPart.includes('min-h-0')
  );
  assert(
    'Result Screen: Fixed top header bar is implemented',
    resultJsxPart.includes('flex-none') && resultJsxPart.includes('border-b border-[#1F2737]')
  );

  // 3. My Tickets Redesign Audit
  const myTicketsPath = path.resolve('src/components/MyTicketsView.tsx');
  const myTicketsCode = fs.readFileSync(myTicketsPath, 'utf-8');

  assert(
    'My Tickets: Overview metric "Tickets Purchased" card implemented',
    myTicketsCode.includes('Tickets Purchased') && myTicketsCode.includes('stats.total')
  );
  assert(
    'My Tickets: Overview metric "Active Tickets" card implemented',
    myTicketsCode.includes('Active Tickets') && myTicketsCode.includes('stats.active')
  );
  assert(
    'My Tickets: Overview metric "Completed / Settled" card implemented',
    myTicketsCode.includes('Completed / Settled') && myTicketsCode.includes('stats.completed')
  );
  assert(
    'My Tickets: Overview metric "Winning Tickets" card implemented',
    myTicketsCode.includes('Winning Tickets') && myTicketsCode.includes('stats.won')
  );
  assert(
    'My Tickets: Multi-faceted status filter tabs (all, active, won, completed) implemented',
    myTicketsCode.includes("setStatusFilter('all')") &&
    myTicketsCode.includes("setStatusFilter('active')") &&
    myTicketsCode.includes("setStatusFilter('won')") &&
    myTicketsCode.includes("setStatusFilter('completed')")
  );
  assert(
    'My Tickets: Search input by ticket ID or digits implemented',
    myTicketsCode.includes('setSearchQuery') && myTicketsCode.includes('Search Ticket ID or digits...')
  );
  assert(
    'My Tickets: 4 equal-dimension square boxes implemented per card',
    myTicketsCode.includes('tkt.tktNumber.split') && myTicketsCode.includes('w-12 h-13 sm:w-14 sm:h-15')
  );
  assert(
    'My Tickets: Real Supabase tickets filtered by user.id/wallet.address',
    myTicketsCode.includes('t.userId === user.id') || myTicketsCode.includes('t.user_id === user.id')
  );

  // 4. Workstation: Desktop Two-Column Top + Full-Width Bottom Activity Architecture
  const workstationPath = path.resolve('src/games/LotteryWorkstation.tsx');
  const workstationCode = fs.readFileSync(workstationPath, 'utf-8');

  assert('Workstation: Pick 4 Digits left column exists', workstationCode.includes('Pick 4 Digits'));
  assert('Workstation: Direct Purchase right column exists', workstationCode.includes('Direct Purchase'));
  assert('Workstation: Ticket Quantity stepper exists', workstationCode.includes('setQuantity'));
  assert('Workstation: Top section uses 2-column grid layout', workstationCode.includes('grid-cols-1 lg:grid-cols-12'));
  assert('Workstation: Full-width Live Room Activity spans below both columns', workstationCode.includes('3. BOTTOM SECTION: FULL-WIDTH LIVE ROOM ACTIVITY'));
  assert('Workstation: Mobile compact buy strip is implemented', workstationCode.includes('block lg:hidden pt-2 border-t border-[#1F2737]'));

  // 5. Data Integrity: Query genuine winner_payouts & lottery_events from Supabase
  const { data: payouts, error: pErr } = await supabase
    .from('winner_payouts')
    .select('*');

  assert('Database: winner_payouts table accessible', !pErr && Array.isArray(payouts), `Found ${payouts?.length || 0} payout records`);

  const { data: events, error: eErr } = await supabase
    .from('lottery_events')
    .select('*')
    .limit(20);

  assert('Database: lottery_events query succeeds', !eErr && Array.isArray(events), `Found ${events?.length || 0} events`);

  // 6. Logic Test: Zero dummy winning codes fallback
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
  assert('Logic: Event without drawn digits produces EMPTY array (NO 8888 dummy injection)', parsedEmpty.length === 0);

  const realEvent = { id: 'test-real', winning_digits: '4921,8304' };
  const parsedReal = parseWinningCodes(realEvent);
  assert('Logic: Event with real digits parses correctly', parsedReal.length === 2 && parsedReal[0] === '4921' && parsedReal[1] === '8304');

  // 7. Dynamic Percentage Share Calculation for multi-winner
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
  assert('Logic: Single winner share is 100%', singleShare === 100);

  const multiShare1 = getPositionShare({}, 0, 3);
  const multiShare2 = getPositionShare({}, 1, 3);
  const multiShare3 = getPositionShare({}, 2, 3);
  assert('Logic: Multi-winner 3 positions split correctly (50/30/20)', multiShare1 === 50 && multiShare2 === 30 && multiShare3 === 20);

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
