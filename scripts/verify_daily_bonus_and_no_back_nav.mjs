import fs from 'fs';
import path from 'path';

const rootDir = process.cwd();

console.log('--- RUNNING AUDIT & VERIFICATION ---');

let failed = false;
function assert(condition, message) {
  if (!condition) {
    console.error(`❌ FAIL: ${message}`);
    failed = true;
  } else {
    console.log(`✅ PASS: ${message}`);
  }
}

// 1. Verify Daily Bonus Route in App.tsx
const appTsx = fs.readFileSync(path.join(rootDir, 'src', 'App.tsx'), 'utf-8');
assert(
  appTsx.includes("clean === '/daily-bonus' || clean === '/rewards'"),
  "App.tsx navigate() handles clean === '/daily-bonus'"
);
assert(
  appTsx.includes("'rewards': '/daily-bonus'") && appTsx.includes("'daily-bonus': '/daily-bonus'"),
  "App.tsx tabRouteMap maps 'rewards' and 'daily-bonus' to '/daily-bonus'"
);
assert(
  appTsx.includes("(activeTab === 'rewards' || activeTab === 'daily-bonus') && ("),
  "App.tsx renders RewardsView for 'rewards' and 'daily-bonus' activeTabs"
);
assert(
  !appTsx.includes("Back to Lobby"),
  "App.tsx AuthRequiredPrompt no longer has 'Back to Lobby' button"
);

// 2. Verify Sidebar.tsx
const sidebarTsx = fs.readFileSync(path.join(rootDir, 'src', 'components', 'Sidebar.tsx'), 'utf-8');
assert(
  !sidebarTsx.includes("Four-Digit Lottery") && !sidebarTsx.includes("lottery-game"),
  "Sidebar.tsx does not contain Four-Digit Lottery or lottery-game nav item"
);
assert(
  sidebarTsx.includes("id: 'lotteries', label: 'Home'") && sidebarTsx.includes("id: 'results', label: 'Results'"),
  "Sidebar.tsx retains 'Home' and 'Results' under Lottery section"
);
assert(
  sidebarTsx.includes("id: 'rewards', label: 'Daily Bonus'"),
  "Sidebar.tsx retains 'Daily Bonus' under Account & Hub section"
);

// 3. Verify Navbar.tsx
const navbarTsx = fs.readFileSync(path.join(rootDir, 'src', 'components', 'Navbar.tsx'), 'utf-8');
assert(
  !navbarTsx.includes("handleInstallClick") && !navbarTsx.includes("usePwa") && !navbarTsx.includes("Install EarnFlow App"),
  "Navbar.tsx does not contain Install App / Download button or usePwa hook"
);
assert(
  navbarTsx.includes("toggleSound"),
  "Navbar.tsx retains audio FX toggle and volume controls"
);

// 4. Verify MyTicketsView.tsx
const myTicketsTsx = fs.readFileSync(path.join(rootDir, 'src', 'components', 'MyTicketsView.tsx'), 'utf-8');
assert(
  !myTicketsTsx.includes("Back to Lottery") && !myTicketsTsx.includes("ArrowLeft"),
  "MyTicketsView.tsx has no 'Back to Lottery' button or ArrowLeft"
);

// 5. Verify PromotionPage.tsx
const promotionTsx = fs.readFileSync(path.join(rootDir, 'src', 'pages', 'PromotionPage.tsx'), 'utf-8');
assert(
  !promotionTsx.includes("Return to Home") && !promotionTsx.includes("ArrowLeft"),
  "PromotionPage.tsx has no 'Return to Home' button or ArrowLeft"
);

// 6. Verify TransactionHistoryPage.tsx
const txTsx = fs.readFileSync(path.join(rootDir, 'src', 'pages', 'TransactionHistoryPage.tsx'), 'utf-8');
assert(
  !txTsx.includes("Back to Wallet") && !txTsx.includes("Return to Casino Lobby") && !txTsx.includes("ArrowLeft"),
  "TransactionHistoryPage.tsx has no 'Back to Wallet', 'Return to Casino Lobby', or ArrowLeft"
);

// 7. Verify ContactPage.tsx
const contactTsx = fs.readFileSync(path.join(rootDir, 'src', 'pages', 'ContactPage.tsx'), 'utf-8');
assert(
  !contactTsx.includes("Back to Lottery Lobby") && !contactTsx.includes("ArrowLeft"),
  "ContactPage.tsx has no 'Back to Lottery Lobby' or ArrowLeft"
);

// 8. Verify GamePage.tsx
const gameTsx = fs.readFileSync(path.join(rootDir, 'src', 'pages', 'GamePage.tsx'), 'utf-8');
assert(
  !gameTsx.includes("Back to All Games") && !gameTsx.includes("ArrowLeft"),
  "GamePage.tsx has no 'Back to All Games' or ArrowLeft"
);

// 9. Verify NotificationsModal.tsx
const notifTsx = fs.readFileSync(path.join(rootDir, 'src', 'components', 'NotificationsModal.tsx'), 'utf-8');
assert(
  !notifTsx.includes("Back to Platform") && !notifTsx.includes("Return to lobby") && !notifTsx.includes("ArrowLeft"),
  "NotificationsModal.tsx has no 'Back to Platform' or ArrowLeft"
);

// 10. Verify TicketModal.tsx
const ticketTsx = fs.readFileSync(path.join(rootDir, 'src', 'components', 'TicketModal.tsx'), 'utf-8');
assert(
  !ticketTsx.includes("Return to Lobby") && !ticketTsx.includes("ArrowLeft"),
  "TicketModal.tsx has no 'Return to Lobby' or ArrowLeft"
);

if (failed) {
  console.error('\n❌ AUDIT FAILED - check output above.');
  process.exit(1);
} else {
  console.log('\n🎉 ALL 14 AUDIT CHECKS PASSED PERFECTLY!');
}
