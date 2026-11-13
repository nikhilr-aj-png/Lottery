import { execSync } from 'child_process';

const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

// Routes to test
const gameRoutes = [
  { path: '/games/four-digit-lottery', type: 'lobby', game: 'lottery' },
  { path: '/games/crash', type: 'lobby', game: 'crash' },
  { path: '/games/dice', type: 'lobby', game: 'dice' },
  { path: '/games/four-digit-lottery/room-lottery-daily-1', type: 'room', game: 'lottery' },
  { path: '/games/crash/room-crash-standard', type: 'room', game: 'crash' },
  { path: '/games/dice/room-dice-classic', type: 'room', game: 'dice' },
  { path: '/games/mines/room-mines-starter', type: 'room', game: 'mines' }
];

const viewports = [
  { name: 'Mobile 320px (Portrait)', width: 320, height: 640 },
  { name: 'Mobile 375px (Portrait)', width: 375, height: 667 },
  { name: 'Mobile 425px (Portrait)', width: 425, height: 800 },
  { name: 'Mobile 640px (Landscape)', width: 640, height: 360 },
  { name: 'Tablet 768px (Portrait)', width: 768, height: 1024 },
  { name: 'Tablet 1024px (Landscape)', width: 1024, height: 768 },
  { name: 'Desktop 1440px (Standard)', width: 1440, height: 900 },
  { name: 'Desktop 2560px (Ultra-wide)', width: 2560, height: 1440 }
];

console.log('Running Comprehensive Game UI Optimization Verification...');
let failed = 0;

for (const target of gameRoutes) {
  const url = `http://localhost:5173${target.path}`;
  const tmpDir = `C:\\Users\\krnik\\AppData\\Local\\Temp\\gametest_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  try {
    const cmd = `"${edgePath}" --headless=new --user-data-dir="${tmpDir}" --window-size=1280,800 --dump-dom "${url}"`;
    let dom = '';
    try {
      dom = execSync(cmd, { encoding: 'utf-8', timeout: 15000, stdio: ['pipe', 'pipe', 'ignore'] });
    } catch (e) {
      dom = e.stdout || '';
    }

    if (!dom || dom.length < 5000) {
      console.error(`[FAIL] ${target.path} -> DOM too short or empty! Length: ${dom.length}`);
      failed++;
      continue;
    }

    // 1. Check Room Chat is completely removed
    const hasRoomChatDrawer = dom.includes('RoomChatDrawer') || dom.includes('Open Live Table Chat');
    const hasFloatingChat = dom.includes('Room Chat') && dom.includes('fixed bottom-6 right-6');

    if (hasRoomChatDrawer || hasFloatingChat) {
      console.error(`[FAIL] ${target.path} -> Room Chat still present in DOM!`);
      failed++;
    } else {
      console.log(`[PASS] ${target.path} -> Room Chat verified completely removed.`);
    }

    // 2. Check duplicate balance inside game room
    if (target.type === 'room') {
      const hasDuplicateBetBalance = dom.includes('Balance:') && dom.includes('Bet Amount:');
      if (hasDuplicateBetBalance) {
        console.error(`[FAIL] ${target.path} -> Duplicate 'Balance:' in Bet Amount still present!`);
        failed++;
      } else {
        console.log(`[PASS] ${target.path} -> Duplicate room balance verified removed.`);
      }

      // Check fixed-height activity container
      const hasScrollableActivity = dom.includes('max-h-48') || dom.includes('max-h-56') || dom.includes('max-h-36') || dom.includes('max-h-40');
      if (hasScrollableActivity) {
        console.log(`[PASS] ${target.path} -> Fixed-height scrollable activity container present.`);
      } else {
        console.error(`[FAIL] ${target.path} -> Missing fixed-height scroll container!`);
        failed++;
      }
    }

    // 3. Check Lobby Compact Banner
    if (target.type === 'lobby') {
      const hasCompactLobbyBanner = dom.includes('COMPACT SINGLE-ROW GAME LOBBY BANNER') || (dom.includes('All Games') && dom.includes('RTP:'));
      if (hasCompactLobbyBanner) {
        console.log(`[PASS] ${target.path} -> Compact single-row lobby banner present.`);
      } else {
        console.error(`[FAIL] ${target.path} -> Missing compact lobby banner!`);
        failed++;
      }
    }

  } catch (err) {
    console.error(`[ERROR] ${target.path}:`, err.message);
    failed++;
  }
}

// Test Viewports for Four-Digit Lottery Room and Crash Room
console.log('\nTesting Responsive Viewports and Orientations...');
for (const vp of viewports) {
  const tmpDir = `C:\\Users\\krnik\\AppData\\Local\\Temp\\vp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  try {
    const cmd = `"${edgePath}" --headless=new --user-data-dir="${tmpDir}" --window-size=${vp.width},${vp.height} --dump-dom "http://localhost:5173/games/four-digit-lottery/room-lottery-daily-1"`;
    let dom = '';
    try {
      dom = execSync(cmd, { encoding: 'utf-8', timeout: 15000, stdio: ['pipe', 'pipe', 'ignore'] });
    } catch (e) {
      dom = e.stdout || '';
    }

    const hasLogo = dom.includes('EarnFlow') && dom.includes('.In');
    const hasRoomName = dom.includes('Daily Jackpot') || dom.includes('Lottery Room 1');
    const hasDials = dom.includes('Select Your 4-Digit Combination');

    if (hasLogo && hasRoomName && hasDials && dom.length > 5000) {
      console.log(`[PASS] ${vp.name} (${vp.width}x${vp.height}) -> Header, Compact Room Info & Dials fully populated.`);
    } else {
      console.error(`[FAIL] ${vp.name}: hasLogo=${hasLogo}, hasRoomName=${hasRoomName}, hasDials=${hasDials}`);
      failed++;
    }
  } catch (err) {
    console.error(`[ERROR] ${vp.name}:`, err.message);
    failed++;
  }
}

if (failed === 0) {
  console.log('\n======================================================');
  console.log('ALL GAME UI OPTIMIZATION AND VIEWPORT TESTS PASSED!');
  console.log('======================================================');
  process.exit(0);
} else {
  console.error(`\nFAILED: ${failed} tests failed.`);
  process.exit(1);
}
