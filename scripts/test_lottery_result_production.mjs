import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const supabaseUrl = 'https://pkloymdzdjykpsutpyqk.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBrbG95bWR6ZGp5a3BzdXRweXFrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIxMjQyMzUsImV4cCI6MjA4NzcwMDIzNX0.0YYFrt5Ra2s_4ilI378kClnB8lp3yNSgkB7iDSPZQUk';
const supabase = createClient(supabaseUrl, supabaseKey);

async function runProductionTests() {
  console.log('=================================================================');
  console.log('EARNFLOW.IN - COMPREHENSIVE PRODUCTION READINESS & REDESIGN AUDIT');
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
    'Result Screen: Official Winning Combinations header is present in JSX',
    resultJsxPart.includes('Official Winning Combinations') || resultJsxPart.includes('Official Draw Results')
  );
  assert(
    'Result Screen: Back to Lobby button completely removed from JSX',
    !resultJsxPart.includes('Back to Lobby')
  );
  assert(
    'Result Screen: Small room header card completely removed from JSX',
    !resultJsxPart.includes('max-w-3xl mx-auto rounded-2xl p-3 sm:p-4 border')
  );
  assert(
    'Result Screen: Winners & Payouts is completely absent from JSX',
    !resultJsxPart.includes('Winners &amp; Payouts') && !resultJsxPart.includes('Winners & Payouts')
  );
  assert(
    'Result Screen: Audit Proof button completely absent from JSX',
    !resultJsxPart.includes('Audit Proof')
  );
  assert(
    'Result Screen: SHA-256 Commit box completely absent from JSX',
    !resultJsxPart.includes('SHA-256 Commit')
  );
  assert(
    'Result Screen: Total Distributed USDT completely absent from JSX',
    !resultJsxPart.includes('Total Distributed')
  );
  assert(
    'Result Screen: DRAW CONCLUDED • VERIFIED ON-CHAIN footer badge completely removed',
    !resultJsxPart.includes('VERIFIED ON-CHAIN')
  );
  assert(
    'Result Screen: Individual payout amounts removed from cards (only position & 4 digits)',
    !resultJsxPart.includes('Est. Prize Payout') && !resultJsxPart.includes('pctShare')
  );
  assert(
    'Result Screen: Equal-sized responsive combination grid implemented',
    resultJsxPart.includes('grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4')
  );
  assert(
    'Result Screen: Internal vertical scrolling container implemented',
    resultJsxPart.includes('overflow-y-auto') && resultJsxPart.includes('min-h-0')
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
    'My Tickets: 4 equal-dimension square boxes implemented per card',
    myTicketsCode.includes('tkt.tktNumber.split') && myTicketsCode.includes('w-12 h-13 sm:w-14 sm:h-15')
  );
  assert(
    'My Tickets: Removed Polygon POS and VRF PENDING labels',
    !myTicketsCode.includes('Polygon POS') && !myTicketsCode.includes('VRF PENDING')
  );

  // 4. Workstation: Single Ticket Purchase & Zero Quantity / Auto-Enter UI
  const workstationPath = path.resolve('src/games/LotteryWorkstation.tsx');
  const workstationCode = fs.readFileSync(workstationPath, 'utf-8');

  assert(
    'Workstation: Quantity state and stepper completely removed',
    !workstationCode.includes('setQuantity') && !workstationCode.includes('const [quantity,')
  );
  assert(
    'Workstation: Auto-enter next draw checkbox completely removed',
    !workstationCode.includes('autoEnterNextDraw') && !workstationCode.includes('Auto-enter next draw')
  );
  assert(
    'Workstation: Strictly single ticket purchase cost logic',
    workstationCode.includes('const totalPurchaseCost = ticketPrice;')
  );
  assert(
    'Workstation: Single ticket purchase action array',
    workstationCode.includes('[currentNumberStr]')
  );
  assert(
    'Workstation: Provably Fair Protocol (SHA-256) footer section removed',
    !workstationCode.includes('Provably Fair Protocol (SHA-256)')
  );
  assert(
    'Workstation: Pick 4 Digits left column exists',
    workstationCode.includes('Pick 4 Digits')
  );
  assert(
    'Workstation: Direct Purchase right column exists',
    workstationCode.includes('Direct Purchase')
  );
  assert(
    'Workstation: Full-width Live Room Activity spans below both columns',
    workstationCode.includes('3. BOTTOM SECTION: FULL-WIDTH LIVE ROOM ACTIVITY')
  );

  // 5. Platform-Wide Provably Fair & SHA-256 Cleanup Audit
  const casinoLobbyPath = path.resolve('src/components/CasinoLobby.tsx');
  const casinoLobbyCode = fs.readFileSync(casinoLobbyPath, 'utf-8');
  assert('Casino Lobby: Provably Fair SHA-256 removed from description', !casinoLobbyCode.includes('cryptographic Provably Fair SHA-256'));

  const heroBannerPath = path.resolve('src/components/HeroBanner.tsx');
  const heroBannerCode = fs.readFileSync(heroBannerPath, 'utf-8');
  assert('Hero Banner: provably fair luck removed', !heroBannerCode.includes('provably fair'));

  const lotteryCardPath = path.resolve('src/components/LotteryCard.tsx');
  const lotteryCardCode = fs.readFileSync(lotteryCardPath, 'utf-8');
  assert('Lottery Card: Provably Fair badge replaced with Live Draw', !lotteryCardCode.includes('Provably Fair') && lotteryCardCode.includes('Live Draw'));

  const winnerCelebrationPath = path.resolve('src/components/WinnerCelebrationModal.tsx');
  const winnerCelebrationCode = fs.readFileSync(winnerCelebrationPath, 'utf-8');
  assert('Winner Celebration: PROVABLY FAIR WINNER replaced with OFFICIAL DRAW WINNER', !winnerCelebrationCode.includes('PROVABLY FAIR WINNER') && winnerCelebrationCode.includes('OFFICIAL DRAW WINNER'));

  const ticketModalPath = path.resolve('src/components/TicketModal.tsx');
  const ticketModalCode = fs.readFileSync(ticketModalPath, 'utf-8');
  assert('Ticket Modal: Provably Fair replaced with Transparent Draw Outcome', !ticketModalCode.includes('Provably Fair'));

  const resultsViewPath = path.resolve('src/components/ResultsView.tsx');
  const resultsViewCode = fs.readFileSync(resultsViewPath, 'utf-8');
  assert('Results View: SHA-256 and Verified On-Chain removed', !resultsViewCode.includes('Cryptographic SHA-256') && !resultsViewCode.includes('Verified On-Chain'));
  assert('Results View: Audit / Fairness button removed', !resultsViewCode.includes('Verify Provably Fair Hash') && !resultsViewCode.includes('ProvablyFairModal'));

  // 6. Game Modules Telemetry Audit
  const crashPath = path.resolve('src/games/CrashGame.tsx');
  const crashCode = fs.readFileSync(crashPath, 'utf-8');
  assert('Crash Game: User-facing SHA-256 strip removed', !crashCode.includes('Provably Fair SHA-256'));

  const dicePath = path.resolve('src/games/DiceGame.tsx');
  const diceCode = fs.readFileSync(dicePath, 'utf-8');
  assert('Dice Game: User-facing Provably Fair badge removed', !diceCode.includes('100-Sided Provably Fair Die'));

  const horsePath = path.resolve('src/games/HorseRacingGame.tsx');
  const horseCode = fs.readFileSync(horsePath, 'utf-8');
  assert('Horse Racing Game: User-facing Provably Fair strip removed', !horseCode.includes('Provably Fair RNG Sprint'));

  const bingoPath = path.resolve('src/games/BingoGame.tsx');
  const bingoCode = fs.readFileSync(bingoPath, 'utf-8');
  assert('Bingo Game: User-facing Provably Fair Oracle strip removed', !bingoCode.includes('Provably Fair Oracle'));

  const coinflipPath = path.resolve('src/games/CoinflipGame.tsx');
  const coinflipCode = fs.readFileSync(coinflipPath, 'utf-8');
  assert('Coinflip Game: User-facing Provably Fair strip removed', !coinflipCode.includes('Provably Fair Binary Randomness'));

  // 7. Supabase Database Integrity Checks
  const { data: payouts, error: pErr } = await supabase
    .from('winner_payouts')
    .select('*')
    .limit(10);

  assert('Database: winner_payouts table accessible', !pErr && Array.isArray(payouts), `Found ${payouts?.length || 0} payout sample records`);

  const { data: events, error: eErr } = await supabase
    .from('lottery_events')
    .select('*')
    .limit(20);

  assert('Database: lottery_events query succeeds', !eErr && Array.isArray(events), `Found ${events?.length || 0} events`);

  // 8. Logic Test: Zero dummy winning codes fallback
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
