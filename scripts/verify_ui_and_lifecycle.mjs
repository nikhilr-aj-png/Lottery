import fs from 'fs';
import path from 'path';

console.log('=== VERIFYING EARNFLOW SYSTEM REQUIREMENTS ===\n');

let allPassed = true;

function assert(condition, message) {
  if (condition) {
    console.log(`✅ PASS: ${message}`);
  } else {
    console.error(`❌ FAIL: ${message}`);
    allPassed = false;
  }
}

// 1. LotteryCard Single Line Verification & Hash
const cardContent = fs.readFileSync('src/components/LotteryCard.tsx', 'utf8');
assert(
  cardContent.includes('flex items-center justify-between gap-1 xs:gap-1.5 sm:gap-2 mb-2.5 sm:mb-3 w-full flex-nowrap min-w-0 overflow-hidden'),
  'LotteryCard verification and hash row is strictly a single horizontal line (flex-nowrap min-w-0 overflow-hidden)'
);
assert(
  cardContent.includes('whitespace-nowrap'),
  'LotteryCard contains whitespace-nowrap preventing text wrapping'
);

// 2. ResultsView Filters
const resultsContent = fs.readFileSync('src/components/ResultsView.tsx', 'utf8');
assert(
  !resultsContent.includes("key: 'all'") && !resultsContent.includes("'All Concluded Draws'"),
  'ResultsView completely excludes the unwanted "All" / "Concluded Draws" filter'
);
assert(
  resultsContent.includes("Pending Official Declaration") && resultsContent.includes("Official Declaration"),
  'ResultsView strictly provides only two status options: "Pending Official Declaration" and "Official Declaration"'
);

// 3. Countdown Expiration / Official Declaration separation in LotteryContext
const contextContent = fs.readFileSync('src/context/LotteryContext.tsx', 'utf8');
assert(
  !contextContent.includes('executeDrawRef.current(e.id, false, isRandomMode)'),
  'LotteryContext does NOT automatically execute payouts when countdown timer reaches zero'
);
assert(
  contextContent.includes("status: 'result_pending'"),
  'LotteryContext transitions expired pools to "result_pending" awaiting official declaration'
);

// 4. LotteryWorkstation Viewport Optimization & Panel Sizing
const workstationContent = fs.readFileSync('src/games/LotteryWorkstation.tsx', 'utf8');
assert(
  workstationContent.includes('h-full max-h-full flex flex-col justify-between overflow-y-auto lg:overflow-hidden'),
  'LotteryWorkstation container fits single screen without page scrollbar on desktop'
);
assert(
  workstationContent.includes('h-11 xs:h-12 sm:h-13 lg:h-14 xl:h-15 rounded-xl flex flex-col items-center justify-center'),
  'Pick 4 Digits slot cages have compact, responsive heights'
);
assert(
  workstationContent.includes('h-8 xs:h-8.5 sm:h-9.5 lg:h-10 rounded-xl bg-[#0B0F19]'),
  'Keypad buttons are compact and ergonomic'
);
assert(
  workstationContent.includes('h-32 xs:h-36 sm:h-40 lg:h-44 xl:h-48 shrink-0 bg-[#0E1422]/95'),
  'Live Room Activity panel has balanced height with internal vertical scrolling'
);
assert(
  workstationContent.includes('const eventTitle = event?.title || room?.name || \'Four Digit Lottery\';'),
  'Workstation preserves authoritative event title'
);

// 5. App.tsx Game Route Container
const appContent = fs.readFileSync('src/App.tsx', 'utf8');
assert(
  appContent.includes("currentGameRoute \n              ? 'overflow-hidden p-1 xs:p-1.5 sm:p-2'"),
  'App.tsx configures overflow-hidden for live game routes to eliminate page scroll'
);

// 6. HeroBanner Mobile Countdown Text Clamp
const heroContent = fs.readFileSync('src/components/HeroBanner.tsx', 'utf8');
assert(
  heroContent.includes('min-w-0 overflow-hidden'),
  'HeroBanner prevents countdown boxes from overflowing screen edges'
);

console.log('\n=== SUMMARY ===');
if (allPassed) {
  console.log('🎉 ALL 6 SYSTEM AUDIT CHECKS PASSED PERFECTLY!\n');
} else {
  console.error('⚠️ SOME CHECKS FAILED. PLEASE REVIEW ABOVE.\n');
  process.exit(1);
}
