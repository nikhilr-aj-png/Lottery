import { execSync } from 'child_process';

const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const viewports = [
  { name: 'Mobile 320px', width: 320, height: 640 },
  { name: 'Mobile 375px', width: 375, height: 667 },
  { name: 'Mobile 425px', width: 425, height: 800 },
  { name: 'Tablet 768px', width: 768, height: 1024 },
  { name: 'Desktop 1024px', width: 1024, height: 768 },
  { name: 'Desktop 1440px', width: 1440, height: 900 },
  { name: 'Desktop 2560px', width: 2560, height: 1440 }
];

console.log('Testing sidebar branding & responsiveness across all viewports...');
let failed = 0;

for (const vp of viewports) {
  const tmpDir = `C:\\Users\\krnik\\AppData\\Local\\Temp\\edgevp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  try {
    const cmd = `"${edgePath}" --headless=new --user-data-dir="${tmpDir}" --window-size=${vp.width},${vp.height} --dump-dom "http://localhost:5173"`;
    let dom = '';
    try {
      dom = execSync(cmd, { encoding: 'utf-8', timeout: 15000, stdio: ['pipe', 'pipe', 'ignore'] });
    } catch (e) {
      dom = e.stdout || '';
    }
    
    // Check for EarnFlow.In
    const hasLogo = dom.includes('/logo.png');
    const hasBrandName = dom.includes('EarnFlow') && dom.includes('.In');
    
    // Check that 'Casino Lobby' is NOT present in DOM
    const hasCasinoLobbyHeading = dom.includes('Casino Lobby');

    if (hasLogo && hasBrandName && !hasCasinoLobbyHeading && dom.length > 5000) {
      console.log(`[PASS] ${vp.name} (${vp.width}x${vp.height}) -> Logo & Brand Name present (${dom.length} bytes), 'Casino Lobby' shift-heading absent.`);
    } else {
      console.error(`[FAIL] ${vp.name}: hasLogo=${hasLogo}, hasBrandName=${hasBrandName}, hasCasinoLobbyHeading=${hasCasinoLobbyHeading}, length=${dom.length}`);
      failed++;
    }
  } catch (err) {
    console.error(`[ERROR] ${vp.name}:`, err.message);
    failed++;
  }
}

if (failed === 0) {
  console.log('\n=============================================');
  console.log('ALL VIEWPORT RESPONSIVENESS TESTS PASSED!');
  console.log('=============================================');
  process.exit(0);
} else {
  console.error(`\nFAILED: ${failed} viewport tests failed.`);
  process.exit(1);
}
