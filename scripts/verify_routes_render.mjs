import { execSync } from 'child_process';

const routes = [
  '/',
  '/?tab=wallet',
  '/transaction-history',
  '/transactions',
  '/games/crash',
  '/games/dice',
  '/?tab=rewards',
  '/?tab=results',
  '/?tab=leaderboard',
  '/terms-and-conditions',
  '/privacy-policy',
  '/contact'
];

const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
let failures = 0;

for (const route of routes) {
  const url = `http://localhost:5173${route}`;
  const tmpDir = `C:\\Users\\krnik\\AppData\\Local\\Temp\\edgetest_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  try {
    const cmd = `"${edgePath}" --headless=new --user-data-dir="${tmpDir}" --dump-dom "${url}"`;
    const dom = execSync(cmd, { encoding: 'utf-8', timeout: 15000 });
    
    // Check if #root has content
    const hasRootContent = dom.includes('EarnFlow') && !dom.includes('<div id="root"></div>');
    if (hasRootContent && dom.length > 5000) {
      console.log(`[PASS] ${route} -> Rendered successfully (${dom.length} bytes, #root populated)`);
    } else {
      console.error(`[FAIL] ${route} -> Empty DOM or missing root content! Length: ${dom.length}`);
      failures++;
    }
  } catch (err) {
    // If output is in stdout
    if (err.stdout && err.stdout.includes('EarnFlow') && !err.stdout.includes('<div id="root"></div>')) {
      console.log(`[PASS] ${route} -> Rendered successfully (${err.stdout.length} bytes, #root populated)`);
    } else {
      console.error(`[FAIL] ${route} -> Error executing dump-dom:`, err.message);
      failures++;
    }
  }
}

if (failures === 0) {
  console.log('\n=============================================');
  console.log('ALL ROUTES RENDERED CLEANLY AFTER REFRESH!');
  console.log('=============================================');
  process.exit(0);
} else {
  console.error(`\nFAILED: ${failures} routes failed to render.`);
  process.exit(1);
}
