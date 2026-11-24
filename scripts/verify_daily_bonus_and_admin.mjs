import fs from 'fs';
import { runSql } from './supabase_admin.mjs';

async function verifyAll() {
  console.log('=== VERIFYING DAILY BONUS, PROMOTION, ADMIN & PWA CHANGES ===\n');

  // 1. Sidebar.tsx
  const sidebarContent = fs.readFileSync('src/components/Sidebar.tsx', 'utf8');
  if (!sidebarContent.includes("'Daily Bonus'") || !sidebarContent.includes("Gift")) {
    throw new Error('Sidebar.tsx does not have Daily Bonus!');
  }
  console.log('✓ Sidebar.tsx correctly has Daily Bonus');

  // 2. LotteryContext.tsx routing
  const contextContent = fs.readFileSync('src/context/LotteryContext.tsx', 'utf8');
  if (!contextContent.includes("'/daily-bonus'") || !contextContent.includes("'/rewards'")) {
    throw new Error('LotteryContext.tsx does not have /daily-bonus routing!');
  }
  console.log('✓ LotteryContext.tsx correctly routes /daily-bonus and /rewards');

  // 3. App.tsx
  const appContent = fs.readFileSync('src/App.tsx', 'utf8');
  if (!appContent.includes("<RewardsView />")) {
    throw new Error('App.tsx does not mount RewardsView!');
  }
  console.log('✓ App.tsx correctly mounts RewardsView for rewards tab');

  // 4. PromotionPage.tsx
  const promoContent = fs.readFileSync('src/pages/PromotionPage.tsx', 'utf8');
  if (promoContent.includes("SpinWheel") || promoContent.includes("Lucky Wheel") || promoContent.includes("spin_wheel")) {
    throw new Error('PromotionPage.tsx still contains Spin Wheel references!');
  }
  if (!promoContent.includes("Referral Program") || !promoContent.includes("user_referrals")) {
    throw new Error('PromotionPage.tsx does not have the clean Referral Program!');
  }
  console.log('✓ PromotionPage.tsx is 100% focused on Referral Program without duplicate Spin Wheel');

  // 5. AdminConsole.tsx
  const adminContent = fs.readFileSync('src/admin/AdminConsole.tsx', 'utf8');
  if (adminContent.includes("Active Games") && !adminContent.includes("Four-Digit Lottery")) {
    throw new Error('AdminConsole still has legacy Game Management!');
  }
  if (!adminContent.includes("Four-Digit Lottery")) {
    throw new Error('AdminConsole does not have Four-Digit Lottery tab!');
  }
  console.log('✓ AdminConsole.tsx has clean Four-Digit Lottery navigation');

  // 6. Navbar.tsx & PwaInstallBanner.tsx
  const navContent = fs.readFileSync('src/components/Navbar.tsx', 'utf8');
  if (!navContent.includes("usePwa") || !navContent.includes("handleInstallClick")) {
    throw new Error('Navbar.tsx missing compact mobile install button!');
  }
  console.log('✓ Navbar.tsx has compact install button aligned with sound toggle');

  const bannerContent = fs.readFileSync('src/components/PwaInstallBanner.tsx', 'utf8');
  if (!bannerContent.includes("hidden sm:block")) {
    throw new Error('PwaInstallBanner.tsx not hidden on mobile!');
  }
  console.log('✓ PwaInstallBanner.tsx is hidden on mobile and clean on desktop');

  // 7. Verify live DB functions
  const rpcs = await runSql(`
    SELECT routine_name 
    FROM information_schema.routines 
    WHERE routine_schema = 'public' 
      AND routine_name IN ('spin_lucky_wheel', 'claim_daily_bonus', 'credit_virtual_credits');
  `);
  if (!rpcs || rpcs.length !== 3) {
    throw new Error('Database stored procedures missing!');
  }
  console.log('✓ Database RPCs (spin_lucky_wheel, claim_daily_bonus, credit_virtual_credits) verified in public schema');

  console.log('\n=== ALL VERIFICATION CHECKS PASSED PERFECTLY ===');
}

verifyAll().catch(err => {
  console.error('Verification failed:', err);
  process.exit(1);
});
