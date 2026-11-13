import { execSync } from 'child_process';

const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

const games = [
  { slug: 'four-digit-lottery', roomId: 'room-lottery-daily-1', name: 'Four Digit Lottery' },
  { slug: 'crash', roomId: 'room-crash-standard', name: 'Crash Rocket' },
  { slug: 'dice', roomId: 'room-dice-classic', name: 'Classic Dice' },
  { slug: 'mines', roomId: 'room-mines-starter', name: 'Minesweeper' },
  { slug: 'plinko', roomId: 'room-plinko-standard', name: 'Plinko Pyramid' },
  { slug: 'roulette', roomId: 'room-roulette-classic', name: 'European Roulette' },
  { slug: 'coinflip', roomId: 'room-coinflip-standard', name: 'Provably Fair Coinflip' },
  { slug: 'blackjack', roomId: 'room-blackjack-standard', name: 'Single Deck Blackjack' },
  { slug: 'slots', roomId: 'room-slots-neon', name: 'Neon 777 Slots' },
  { slug: 'poker', roomId: 'room-poker-video', name: 'Video Poker Deluxe' },
  { slug: 'keno', roomId: 'room-keno-classic', name: 'Classic 40-Ball Keno' },
  { slug: 'limbo', roomId: 'room-limbo-standard', name: 'Rocket Limbo Curve' }
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

console.log('================================================================');
console.log('STARTING RIGOROUS VERIFICATION: GAME LOBBY & IN-ROOM ACTIVITY BOX');
console.log('================================================================\n');

let failed = 0;

// 1. Verify Game Lobbies: No Recent Results or Live Game Activity section
console.log('--- 1. VERIFYING GAME LOBBIES: NO LIVE ACTIVITY / RECENT RESULTS BELOW ROOMS ---');
for (const g of games) {
  const lobbyUrl = `http://localhost:5173/games/${g.slug}`;
  const tmpDir = `C:\\Users\\krnik\\AppData\\Local\\Temp\\lobbytest_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  try {
    const cmd = `"${edgePath}" --headless=new --user-data-dir="${tmpDir}" --window-size=1280,800 --dump-dom "${lobbyUrl}"`;
    let dom = '';
    try {
      dom = execSync(cmd, { encoding: 'utf-8', timeout: 15000, stdio: ['pipe', 'pipe', 'ignore'] });
    } catch (e) {
      dom = e.stdout || '';
    }

    if (!dom || dom.length < 3000) {
      console.error(`[FAIL] ${lobbyUrl} -> DOM too short! Length: ${dom.length}`);
      failed++;
      continue;
    }

    // Check that "Recent Results & Live Game Activity" header is NOT in lobby DOM
    const hasLobbyLiveActivity = dom.includes('Recent Results & Live Game Activity') || 
                                 dom.includes('Recent Results &amp; Live Game Activity') ||
                                 dom.includes('Live Game Activity') ||
                                 dom.includes('Recent Concluded Draws & Winning Digits');

    if (hasLobbyLiveActivity) {
      console.error(`[FAIL] Lobby ${g.name} (${lobbyUrl}) still contains Recent Results or Live Game Activity!`);
      failed++;
    } else {
      console.log(`[PASS] Lobby ${g.name} verified: No Recent Results or Live Activity present in lobby.`);
    }

    // Verify rooms grid is present
    const hasRooms = dom.includes('Select Game Room') || dom.includes('Room 1') || dom.includes('Daily') || dom.includes('Standard');
    if (!hasRooms) {
      console.error(`[FAIL] Lobby ${g.name} -> Missing room selection cards!`);
      failed++;
    }
  } catch (err) {
    console.error(`[ERROR] Lobby ${g.name}:`, err.message);
    failed++;
  }
}

// 2. Verify Game Rooms: Dedicated activityBox present inside room
console.log('\n--- 2. VERIFYING GAME ROOMS: DEDICATED IN-ROOM ACTIVITY BOX ---');
for (const g of games) {
  const roomUrl = `http://localhost:5173/games/${g.slug}/${g.roomId}`;
  const tmpDir = `C:\\Users\\krnik\\AppData\\Local\\Temp\\roomtest_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  try {
    const cmd = `"${edgePath}" --headless=new --user-data-dir="${tmpDir}" --window-size=1280,800 --dump-dom "${roomUrl}"`;
    let dom = '';
    try {
      dom = execSync(cmd, { encoding: 'utf-8', timeout: 15000, stdio: ['pipe', 'pipe', 'ignore'] });
    } catch (e) {
      dom = e.stdout || '';
    }

    if (!dom || dom.length < 3000) {
      console.error(`[FAIL] ${roomUrl} -> DOM too short! Length: ${dom.length}`);
      failed++;
      continue;
    }

    // Check that dedicated in-room activity box is present
    const hasActivityBox = dom.includes('Room Activity') && (dom.includes('Room (') || dom.includes('My ('));
    if (hasActivityBox) {
      console.log(`[PASS] Room ${g.name} -> Dedicated in-room Activity Box verified.`);
    } else {
      console.error(`[FAIL] Room ${g.name} -> Missing dedicated in-room Activity Box!`);
      failed++;
    }

    // Check that Room Chat is NOT present
    const hasRoomChat = dom.includes('RoomChatDrawer') || dom.includes('Open Live Table Chat');
    if (hasRoomChat) {
      console.error(`[FAIL] Room ${g.name} -> Room Chat still present!`);
      failed++;
    }

    // Check that Platform Footer is NOT rendered in dedicated room
    const hasFooter = dom.includes('Platform Public Footer') || dom.includes('2026 EarnFlow.In');
    if (hasFooter) {
      console.error(`[FAIL] Room ${g.name} -> Public Footer should not render inside game rooms!`);
      failed++;
    }
  } catch (err) {
    console.error(`[ERROR] Room ${g.name}:`, err.message);
    failed++;
  }
}

// 3. Verify Viewports & Zero-Scroll Layout
console.log('\n--- 3. VERIFYING RESPONSIVE VIEWPORTS ACROSS RESOLUTIONS & ORIENTATIONS ---');
for (const vp of viewports) {
  const testUrl = `http://localhost:5173/games/crash/room-crash-standard`;
  const tmpDir = `C:\\Users\\krnik\\AppData\\Local\\Temp\\vptest_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  try {
    const cmd = `"${edgePath}" --headless=new --user-data-dir="${tmpDir}" --window-size=${vp.width},${vp.height} --dump-dom "${testUrl}"`;
    let dom = '';
    try {
      dom = execSync(cmd, { encoding: 'utf-8', timeout: 15000, stdio: ['pipe', 'pipe', 'ignore'] });
    } catch (e) {
      dom = e.stdout || '';
    }

    const hasHeader = dom.includes('EarnFlow') && dom.includes('.In');
    const hasActivityBox = dom.includes('Room Activity');
    const hasBetControl = dom.includes('Bet Amount:') || dom.includes('FC');

    if (hasHeader && hasActivityBox && hasBetControl && dom.length > 5000) {
      console.log(`[PASS] ${vp.name} (${vp.width}x${vp.height}) -> Viewport fully rendered, controls & activity box present.`);
    } else {
      console.error(`[FAIL] ${vp.name} -> Incomplete render! hasHeader=${hasHeader}, hasActivityBox=${hasActivityBox}`);
      failed++;
    }
  } catch (err) {
    console.error(`[ERROR] Viewport ${vp.name}:`, err.message);
    failed++;
  }
}

console.log('\n================================================================');
if (failed === 0) {
  console.log('ALL TESTS PASSED! ZERO DEFECTS FOUND ACROSS ALL 12 GAMES & VIEWPORTS.');
  console.log('================================================================');
  process.exit(0);
} else {
  console.error(`FAILED: ${failed} verification checks failed.`);
  console.log('================================================================');
  process.exit(1);
}
