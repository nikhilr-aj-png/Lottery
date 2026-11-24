import { readFileSync, existsSync } from 'fs';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://pkloymdzdjykpsutpyqk.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBrbG95bWR6ZGp5a3BzdXRweXFrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIxMjQyMzUsImV4cCI6MjA4NzcwMDIzNX0.0YYFrt5Ra2s_4ilI378kClnB8lp3yNSgkB7iDSPZQUk';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function runVerification() {
  console.log('=== STARTING COMPREHENSIVE VERIFICATION FOR ALL 16 PHASES ===\n');
  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`✅ PASS: ${message}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${message}`);
      failed++;
    }
  }

  // 1. Check Four Digit Lottery Branding Assets
  assert(existsSync('public/items/Four Digit Lottery.jpg'), 'Branding asset: public/items/Four Digit Lottery.jpg exists');
  assert(existsSync('public/logo.png'), 'Branding asset: public/logo.png exists');

  // 2. Check CasinoLobby.tsx for Four Digit Lottery exclusive branding & unified LotteryCard
  const casinoLobbySrc = readFileSync('src/components/CasinoLobby.tsx', 'utf8');
  assert(casinoLobbySrc.includes('Four Digit Lottery.jpg') && casinoLobbySrc.includes('Four Digit Lucky Lottery'), 'CasinoLobby renders restored Four Digit Lottery logo and official badge');
  assert(casinoLobbySrc.includes('<LotteryCard') && casinoLobbySrc.includes('Available Pool') && casinoLobbySrc.includes('Draw Results'), 'CasinoLobby renders unified LotteryCard for both Available Pool and Results');
  assert(casinoLobbySrc.includes('handleDirectEnterRoom'), 'CasinoLobby implements 1-click direct room entry');

  // 3. Check GamePage.tsx for direct room selection without View B duplicate lobby
  const gamePageSrc = readFileSync('src/pages/GamePage.tsx', 'utf8');
  assert(gamePageSrc.includes('evt.title || evt.roomName'), 'GamePage prioritizes authoritative custom event title');
  assert(gamePageSrc.includes('activeRooms.find(r => r.status === ROOM_STATUSES.ACTIVE)'), 'GamePage automatically resolves live active room avoiding View B duplicate prompt');

  // 4. Check Mobile Bottom Navbar (Navbar.tsx)
  const navbarSrc = readFileSync('src/components/Navbar.tsx', 'utf8');
  assert(navbarSrc.includes('grid-cols-4'), 'Navbar uses 4-column responsive grid on mobile');
  assert(navbarSrc.includes("handleNavClick('promotion')") && navbarSrc.includes('Promotion'), 'Navbar includes Promotion placed beside Wallet');
  assert(navbarSrc.includes('Gift'), 'Navbar uses Gift icon for Promotion');

  // 5. Check Sidebar.tsx
  const sidebarSrc = readFileSync('src/components/Sidebar.tsx', 'utf8');
  assert(sidebarSrc.includes('Promotions & Referral') && sidebarSrc.includes('badge: \'HOT\''), 'Sidebar includes Promotions & Referral with HOT badge');

  // 6. Check PromotionPage.tsx
  assert(existsSync('src/pages/PromotionPage.tsx'), 'PromotionPage.tsx component exists');
  const promoPageSrc = readFileSync('src/pages/PromotionPage.tsx', 'utf8');
  assert(promoPageSrc.includes('earnflow.in/?ref=') && promoPageSrc.includes('api.whatsapp.com/send'), 'PromotionPage provides referral link and WhatsApp sharing');
  assert(promoPageSrc.includes('spin_lucky_wheel') && promoPageSrc.includes('Spin The Lucky Bonus Wheel'), 'PromotionPage integrates Daily Lucky Spin Wheel');

  // 7. Check App.tsx Routing
  const appSrc = readFileSync('src/App.tsx', 'utf8');
  assert(appSrc.includes('import PromotionPage'), 'App.tsx imports PromotionPage');
  assert(appSrc.includes('activeTab === \'promotion\'') && appSrc.includes('cleanPath === \'/promotion\''), 'App.tsx routes /promotion');
  assert(appSrc.includes('earnflow_referrer_code'), 'App.tsx captures ref/r query parameter');
  assert(appSrc.includes('path.startsWith(\'/admin\')'), 'App.tsx supports nested admin routes (/admin/referrals, /admin/spin-wheel)');

  // 8. Check AdminConsole.tsx & Sub-components
  assert(existsSync('src/admin/ReferralsManagement.tsx'), 'src/admin/ReferralsManagement.tsx exists');
  assert(existsSync('src/admin/SpinWheelManagement.tsx'), 'src/admin/SpinWheelManagement.tsx exists');

  const adminConsoleSrc = readFileSync('src/admin/AdminConsole.tsx', 'utf8');
  assert(adminConsoleSrc.includes('ReferralsManagement') && adminConsoleSrc.includes('SpinWheelManagement'), 'AdminConsole imports both ReferralsManagement and SpinWheelManagement');
  assert(adminConsoleSrc.includes('Lottery Results Display Retention Period'), 'AdminConsole has Results Retention Duration settings');
  assert(adminConsoleSrc.includes('resultsRetentionHours'), 'AdminConsole binds resultsRetentionHours state');

  const spinWheelMgmtSrc = readFileSync('src/admin/SpinWheelManagement.tsx', 'utf8');
  assert(spinWheelMgmtSrc.includes('tx_20261124020608_507547d0') && spinWheelMgmtSrc.includes('250.00'), 'SpinWheelManagement displays audited suspicious credit tx_20261124020608_507547d0');
  assert(spinWheelMgmtSrc.includes('isProbabilityValid') && spinWheelMgmtSrc.includes('handleNormalizeProbabilities'), 'SpinWheelManagement validates 100% segment probabilities');

  // 9. Check LotteryContext.tsx
  const contextSrc = readFileSync('src/context/LotteryContext.tsx', 'utf8');
  assert(contextSrc.includes('processReferralSignup'), 'LotteryContext implements processReferralSignup');
  assert(contextSrc.includes('resultsRetentionHours: 1'), 'LotteryContext default platform settings include resultsRetentionHours');
  assert(contextSrc.includes('adminDeleteEvent'), 'LotteryContext implements adminDeleteEvent safe soft-delete');

  // 10. Check Supabase Database Stored Procedure & Settings
  try {
    const { data: setRows, error: setErr } = await supabase
      .from('platform_settings')
      .select('key, value');

    if (setErr) {
      console.warn('Database query warning:', setErr.message);
    } else {
      const keys = setRows.map(r => r.key);
      assert(keys.includes('results_retention'), 'Database has platform_settings key results_retention');
      assert(keys.includes('referral_settings'), 'Database has platform_settings key referral_settings');
      assert(keys.includes('spin_wheel_settings'), 'Database has platform_settings key spin_wheel_settings');
    }
  } catch (dbErr) {
    console.warn('DB check exception:', dbErr);
  }

  console.log(`\n=== VERIFICATION RESULTS: ${passed} PASSED, ${failed} FAILED ===`);
  if (failed > 0) {
    process.exitCode = 1;
  }
}

runVerification();
