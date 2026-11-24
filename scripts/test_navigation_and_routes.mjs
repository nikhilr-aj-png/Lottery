import fs from 'fs';
import path from 'path';

let failed = false;

function assert(condition, message) {
  if (condition) {
    console.log(`[PASS] ${message}`);
  } else {
    console.error(`[FAIL] ${message}`);
    failed = true;
  }
}

console.log('=== RUNNING COMPREHENSIVE ROUTE, NAVIGATION & REDESIGN VERIFICATION ===\n');

// 1. Check Footer.tsx
const footerPath = path.resolve('src/components/Footer.tsx');
const footerCode = fs.readFileSync(footerPath, 'utf8');

assert(!footerCode.includes('/results'), 'Footer does NOT contain Results link');
assert(!footerCode.includes('Draw Results'), 'Footer does NOT contain Draw Results');
assert(footerCode.includes('/how-it-works'), 'Footer links to /how-it-works');
assert(footerCode.includes('/lottery-rules'), 'Footer links to /lottery-rules');
assert(footerCode.includes('/faq'), 'Footer links to /faq');
assert(footerCode.includes('/responsible-gaming'), 'Footer links to /responsible-gaming');
assert(footerCode.includes('/terms-and-conditions'), 'Footer links to /terms-and-conditions');
assert(footerCode.includes('/contact-support'), 'Footer links to /contact-support');
assert(footerCode.includes('/privacy-policy'), 'Footer links to /privacy-policy');
assert(footerCode.includes('apkDirectDownloadUrl'), 'Footer incorporates admin-configured APK direct download');
assert(footerCode.includes('triggerInstall'), 'Footer incorporates PWA installation trigger');

// 2. Check Sidebar.tsx
const sidebarPath = path.resolve('src/components/Sidebar.tsx');
const sidebarCode = fs.readFileSync(sidebarPath, 'utf8');

assert(sidebarCode.includes("label: 'Results'"), 'Sidebar navigation label is "Results"');
assert(!sidebarCode.includes("label: 'Draw Results'"), 'Sidebar does NOT have "Draw Results" label');
assert(sidebarCode.includes("id: 'lotteries'"), 'Sidebar has Home (lotteries) item');
assert(sidebarCode.includes("id: 'lottery-game'"), 'Sidebar has Four-Digit Lottery item');
assert(sidebarCode.includes("id: 'results'"), 'Sidebar has Results item');
assert(sidebarCode.includes("id: 'wallet'"), 'Sidebar has USDT Wallet item');
assert(sidebarCode.includes("id: 'promotion'"), 'Sidebar has Promotions & Referral item');
assert(sidebarCode.includes("id: 'transactions'"), 'Sidebar has Transaction History item');

// Assert items removed from Sidebar
assert(!sidebarCode.includes("id: 'profile'"), 'Sidebar does NOT have Player Profile item');
assert(!sidebarCode.includes("id: 'tickets'"), 'Sidebar does NOT have My Tickets item');
assert(!sidebarCode.includes("id: 'how-it-works'"), 'Sidebar does NOT have How It Works item');
assert(!sidebarCode.includes("id: 'rules'"), 'Sidebar does NOT have Lottery Rules item');
assert(!sidebarCode.includes("id: 'faq'"), 'Sidebar does NOT have FAQ item');
assert(!sidebarCode.includes("id: 'contact'"), 'Sidebar does NOT have Contact item');
assert(!sidebarCode.includes("id: 'responsible-gaming'"), 'Sidebar does NOT have Responsible Gaming item');
assert(!sidebarCode.includes("id: 'terms'"), 'Sidebar does NOT have Terms item');
assert(!sidebarCode.includes("id: 'privacy'"), 'Sidebar does NOT have Privacy item');

// 3. Check TermsPage.tsx (Document Format)
const termsPath = path.resolve('src/pages/TermsPage.tsx');
const termsCode = fs.readFileSync(termsPath, 'utf8');
assert(!termsCode.includes('setActiveSection'), 'TermsPage does NOT use interactive click-to-expand section toggles');
assert(!termsCode.includes('ChevronDown'), 'TermsPage does NOT use chevron accordion dropdowns');
assert(termsCode.includes('Terms &amp; Conditions') || termsCode.includes('Terms & Conditions'), 'TermsPage has official title');
assert(termsCode.includes('Single-Ticket Entry Policy'), 'TermsPage details single-ticket entry policy');
assert(termsCode.includes('USDT (TRC-20) Settlements'), 'TermsPage details USDT settlements');
assert(termsCode.includes('Effective: November 2026'), 'TermsPage has effective date');

// 4. Check PrivacyPolicyPage.tsx (Document Format)
const privacyPath = path.resolve('src/pages/PrivacyPolicyPage.tsx');
const privacyCode = fs.readFileSync(privacyPath, 'utf8');
assert(!privacyCode.includes('setActiveSection'), 'PrivacyPolicyPage does NOT use interactive click-to-expand section toggles');
assert(!privacyCode.includes('ChevronDown'), 'PrivacyPolicyPage does NOT use chevron accordion dropdowns');
assert(privacyCode.includes('Privacy Policy'), 'PrivacyPolicyPage has official title');
assert(privacyCode.includes('Information We Collect'), 'PrivacyPolicyPage details information collection');
assert(privacyCode.includes('Data Security &amp; Technical Safeguards'), 'PrivacyPolicyPage details data safeguards');
assert(privacyCode.includes('Effective: November 2026'), 'PrivacyPolicyPage has effective date');

// 5. Check MyTicketsView.tsx (Minimal Room Card Layout)
const myTicketsPath = path.resolve('src/components/MyTicketsView.tsx');
const myTicketsCode = fs.readFileSync(myTicketsPath, 'utf8');
assert(myTicketsCode.includes('roomGroups'), 'MyTicketsView groups tickets by Room/Event');
assert(myTicketsCode.includes('max-h-52 overflow-y-auto') || myTicketsCode.includes('overflow-y-auto'), 'MyTicketsView has scrollable tickets container inside room card');
assert(myTicketsCode.includes('tkt.tktNumber.split'), 'MyTicketsView renders individual high-contrast 4-digit boxes');
assert(myTicketsCode.includes('statusFilter'), 'MyTicketsView has clean status filter pills');

// 6. Check ResultsView.tsx (Standard LotteryCard Design)
const resultsViewPath = path.resolve('src/components/ResultsView.tsx');
const resultsViewCode = fs.readFileSync(resultsViewPath, 'utf8');
assert(resultsViewCode.includes("import LotteryCard from './LotteryCard'"), 'ResultsView imports official LotteryCard');
assert(resultsViewCode.includes('mode="result"'), 'ResultsView renders LotteryCard in mode="result"');
assert(resultsViewCode.includes('seenIds'), 'ResultsView deduplicates events by ID');
assert(resultsViewCode.includes('LotteryShowResultScreen'), 'ResultsView renders full-screen LotteryShowResultScreen overlay');

// 7. Check LotteryCard.tsx (Declared vs Pending Distinction)
const lotteryCardPath = path.resolve('src/components/LotteryCard.tsx');
const lotteryCardCode = fs.readFileSync(lotteryCardPath, 'utf8');
assert(lotteryCardCode.includes('OFFICIALLY DECLARED'), 'LotteryCard distinguishes officially declared results');
assert(lotteryCardCode.includes('PENDING DECLARATION') || lotteryCardCode.includes('Draw Pending Official Declaration'), 'LotteryCard distinguishes pending declaration');

// 8. Check LotteryContext.tsx
const contextPath = path.resolve('src/context/LotteryContext.tsx');
const contextCode = fs.readFileSync(contextPath, 'utf8');
assert(contextCode.includes("effectivePath === '/promotion'"), 'resolveTabFromUrl resolves /promotion');
assert(contextCode.includes("targetPath = '/promotion'"), 'setActiveTab maps promotion to /promotion');

console.log('\n=== VERIFICATION RESULT ===');
if (failed) {
  console.error('FAILED: One or more assertions did not pass.');
  process.exit(1);
} else {
  console.log('SUCCESS: All 40+ assertions passed successfully!\n');
}
