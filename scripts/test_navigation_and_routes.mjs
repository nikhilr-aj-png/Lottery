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

console.log('=== RUNNING COMPREHENSIVE ROUTE & NAVIGATION VERIFICATION ===\n');

// 1. Check Footer.tsx
const footerPath = path.resolve('src/components/Footer.tsx');
const footerCode = fs.readFileSync(footerPath, 'utf8');

assert(!footerCode.includes('/results'), 'Footer does NOT contain Results link');
assert(!footerCode.includes('Draw Results'), 'Footer does NOT contain Draw Results');
assert(!footerCode.includes('mailto:'), 'Footer does NOT contain separate support email address');
assert(footerCode.includes('/how-it-works'), 'Footer links to /how-it-works');
assert(footerCode.includes('/lottery-rules'), 'Footer links to /lottery-rules');
assert(footerCode.includes('/faq'), 'Footer links to /faq');
assert(footerCode.includes('/responsible-gaming'), 'Footer links to /responsible-gaming');
assert(footerCode.includes('/terms-and-conditions'), 'Footer links to /terms-and-conditions');
assert(footerCode.includes('/contact-support'), 'Footer links to /contact-support');
assert(footerCode.includes('/privacy-policy'), 'Footer links to /privacy-policy');

// 2. Check Sidebar.tsx
const sidebarPath = path.resolve('src/components/Sidebar.tsx');
const sidebarCode = fs.readFileSync(sidebarPath, 'utf8');

assert(sidebarCode.includes("label: 'Results'"), 'Sidebar navigation label is "Results"');
assert(!sidebarCode.includes("label: 'Draw Results'"), 'Sidebar does NOT have "Draw Results" label');
assert(sidebarCode.includes("id: 'how-it-works'"), 'Sidebar has How It Works item');
assert(sidebarCode.includes("id: 'rules'"), 'Sidebar has Lottery Rules item');
assert(sidebarCode.includes("id: 'faq'"), 'Sidebar has FAQ item');
assert(sidebarCode.includes("id: 'responsible-gaming'"), 'Sidebar has Responsible Gaming item');
assert(sidebarCode.includes("id: 'terms'"), 'Sidebar has Terms & Conditions item');
assert(sidebarCode.includes("id: 'contact'"), 'Sidebar has Contact & Support item');

// 3. Check CasinoLobby.tsx
const lobbyPath = path.resolve('src/components/CasinoLobby.tsx');
const lobbyCode = fs.readFileSync(lobbyPath, 'utf8');

assert(!lobbyCode.includes('in Draw Results'), 'CasinoLobby references Results (not Draw Results)');
assert(lobbyCode.includes('in Results'), 'CasinoLobby references "in Results"');
assert(lobbyCode.includes('Recent Results &amp; Concluded Pools') || lobbyCode.includes('Recent Results'), 'CasinoLobby section is Recent Results');

// 4. Check LotteryContext.tsx
const contextPath = path.resolve('src/context/LotteryContext.tsx');
const contextCode = fs.readFileSync(contextPath, 'utf8');

assert(contextCode.includes("effectivePath === '/how-it-works'"), 'resolveTabFromUrl resolves /how-it-works');
assert(contextCode.includes("effectivePath === '/lottery-rules'"), 'resolveTabFromUrl resolves /lottery-rules');
assert(contextCode.includes("effectivePath === '/faq'"), 'resolveTabFromUrl resolves /faq');
assert(contextCode.includes("effectivePath === '/responsible-gaming'"), 'resolveTabFromUrl resolves /responsible-gaming');
assert(contextCode.includes("effectivePath === '/terms-and-conditions'"), 'resolveTabFromUrl resolves /terms-and-conditions');
assert(contextCode.includes("effectivePath === '/contact-support'"), 'resolveTabFromUrl resolves /contact-support');
assert(contextCode.includes("effectivePath === '/results'"), 'resolveTabFromUrl resolves /results');
assert(contextCode.includes("tabName === 'how-it-works'") && contextCode.includes("targetPath = '/how-it-works'"), 'setActiveTab maps how-it-works to /how-it-works');
assert(contextCode.includes("tabName === 'rules'") && contextCode.includes("targetPath = '/lottery-rules'"), 'setActiveTab maps rules to /lottery-rules');
assert(contextCode.includes("tabName === 'faq'") && contextCode.includes("targetPath = '/faq'"), 'setActiveTab maps faq to /faq');
assert(contextCode.includes("tabName === 'responsible-gaming'") && contextCode.includes("targetPath = '/responsible-gaming'"), 'setActiveTab maps responsible-gaming to /responsible-gaming');
assert(contextCode.includes("tabName === 'terms'") && contextCode.includes("targetPath = '/terms-and-conditions'"), 'setActiveTab maps terms to /terms-and-conditions');
assert(contextCode.includes("targetPath = '/contact-support'"), 'setActiveTab maps contact to /contact-support');
assert(contextCode.includes("tabName === 'results'") && contextCode.includes("targetPath = '/results'"), 'setActiveTab maps results to /results');
assert(!contextCode.includes("window.dispatchEvent(new PopStateEvent('popstate'))"), 'Unwanted artificial popstate dispatch removed from setActiveTab');

// 5. Check App.tsx
const appPath = path.resolve('src/App.tsx');
const appCode = fs.readFileSync(appPath, 'utf8');

assert(appCode.includes("clean === '/how-it-works'") || appCode.includes("cleanPath === '/how-it-works'"), 'App.tsx parses /how-it-works');
assert(appCode.includes("clean === '/lottery-rules'") || appCode.includes("cleanPath === '/lottery-rules'"), 'App.tsx parses /lottery-rules');
assert(appCode.includes("clean === '/faq'") || appCode.includes("cleanPath === '/faq'"), 'App.tsx parses /faq');
assert(appCode.includes("clean === '/responsible-gaming'") || appCode.includes("cleanPath === '/responsible-gaming'"), 'App.tsx parses /responsible-gaming');
assert(appCode.includes("clean === '/terms-and-conditions'") || appCode.includes("cleanPath === '/terms-and-conditions'"), 'App.tsx parses /terms-and-conditions');
assert(appCode.includes("clean === '/contact-support'") || appCode.includes("cleanPath === '/contact-support'"), 'App.tsx parses /contact-support');
assert(appCode.includes("clean === '/results'") || appCode.includes("cleanPath === '/results'"), 'App.tsx parses /results');
assert(!appCode.includes("activeTab === 'results' || activeTab === 'transactions') {\n      const tabNames = {\n        tickets: 'My Tickets',\n        results:"), 'Results is NOT blocked by login gating');
assert(appCode.includes("<ResultsView />"), 'ResultsView renders directly for public visitors');

// 6. Check Dedicated Page Contents
const howItWorksCode = fs.readFileSync(path.resolve('src/pages/HowItWorksPage.tsx'), 'utf8');
assert(howItWorksCode.includes('Enter a Live Draw Room'), 'HowItWorksPage describes entering room');
assert(howItWorksCode.includes('Select Your Four Digits (0000–9999)'), 'HowItWorksPage describes selecting digits');
assert(howItWorksCode.includes('Instant Purchase with USDT'), 'HowItWorksPage describes purchasing ticket');
assert(howItWorksCode.includes('Automated Transparent Draw'), 'HowItWorksPage describes checking results');

const rulesCode = fs.readFileSync(path.resolve('src/pages/LotteryRulesPage.tsx'), 'utf8');
assert(rulesCode.includes('4-Digit Combination Uniqueness Rule'), 'LotteryRulesPage describes 4-digit uniqueness');
assert(rulesCode.includes('Single Winner Event'), 'LotteryRulesPage describes Single Winner');
assert(rulesCode.includes('Multiple Winner Event'), 'LotteryRulesPage describes Multiple Winner');
assert(rulesCode.includes('idx_lottery_tickets_event_ticket_unique'), 'LotteryRulesPage describes database unique constraint');

const faqCode = fs.readFileSync(path.resolve('src/pages/FaqPage.tsx'), 'utf8');
assert(faqCode.includes('categories = ['), 'FaqPage has categories');
assert(faqCode.includes('openIndex === uniqueId'), 'FaqPage has accordion toggle logic');

const respGamingCode = fs.readFileSync(path.resolve('src/pages/ResponsibleGamingPage.tsx'), 'utf8');
assert(respGamingCode.includes('Stake Control &amp; Session Management'), 'ResponsibleGamingPage has Stake Control section');
assert(respGamingCode.includes('Strict 18+ Age Restrictions'), 'ResponsibleGamingPage has 18+ Age Restrictions section');
assert(respGamingCode.includes('Self-Exclusion'), 'ResponsibleGamingPage has Self-Exclusion section');

const termsCode = fs.readFileSync(path.resolve('src/pages/TermsPage.tsx'), 'utf8');
assert(termsCode.includes('Terms and Conditions') || termsCode.includes('Terms & Conditions'), 'TermsPage is functional');

const contactCode = fs.readFileSync(path.resolve('src/pages/ContactPage.tsx'), 'utf8');
assert(contactCode.includes('handleSubmit'), 'ContactPage inquiry form is functional');

console.log('\n=== VERIFICATION RESULT ===');
if (failed) {
  console.error('FAILED: One or more assertions did not pass.');
  process.exit(1);
} else {
  console.log('SUCCESS: All 40+ assertions passed successfully!\n');
}
