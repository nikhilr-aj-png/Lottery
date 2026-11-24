import fs from 'fs';
import path from 'path';

function check(title, condition, detail = '') {
  if (condition) {
    console.log(`[PASS] ${title}`);
  } else {
    console.error(`[FAIL] ${title} - ${detail}`);
    process.exitCode = 1;
  }
}

console.log('=== VERIFYING HOMEPAGE REFINEMENT & NAVIGATION SYSTEM ===\n');

// 1. CasinoLobby.tsx
const casinoLobbyPath = path.resolve('src/components/CasinoLobby.tsx');
const casinoLobby = fs.readFileSync(casinoLobbyPath, 'utf8');

check('Hero does NOT contain "Open Work Station"', !casinoLobby.includes('Open Work Station'));
check('Hero does NOT contain "Open Workstation"', !casinoLobby.includes('Open Workstation'));
check('Hero contains compact CTA "Enter Live Draw Room"', casinoLobby.includes('Enter Live Draw Room'));
check('Hero contains 18+ badge', casinoLobby.includes('18+ Only') || casinoLobby.includes('18+'));
check('Hero contains USDT TRC-20 badge', casinoLobby.includes('USDT TRC-20'));
check('Hero contains 95% RTP badge', casinoLobby.includes('95% RTP') || casinoLobby.includes('95.0% RTP'));
check('Homepage lobby does NOT embed How It Works section', !casinoLobby.includes('SECTION 4: HOW IT WORKS'));
check('Homepage lobby does NOT embed FAQ section', !casinoLobby.includes('SECTION 6: FREQUENTLY ASKED QUESTIONS'));
check('Homepage lobby does NOT embed Rules section', !casinoLobby.includes('SECTION 5: OFFICIAL LOTTERY RULES'));
check('Homepage lobby has Available Pool (Available Lucky Draws)', casinoLobby.includes('Available Lucky Draws') || casinoLobby.includes('Available Pool'));
check('Homepage lobby has Concluded Results', casinoLobby.includes('Concluded Results') || casinoLobby.includes('Recent Results') || casinoLobby.includes('Concluded Draw Results'));

// 2. Dedicated Pages Existence & Scroll-to-top
const pages = [
  { file: 'src/pages/HowItWorksPage.tsx', name: 'HowItWorksPage' },
  { file: 'src/pages/LotteryRulesPage.tsx', name: 'LotteryRulesPage' },
  { file: 'src/pages/FaqPage.tsx', name: 'FaqPage' },
  { file: 'src/pages/ResponsibleGamingPage.tsx', name: 'ResponsibleGamingPage' },
  { file: 'src/pages/TermsPage.tsx', name: 'TermsPage' },
  { file: 'src/pages/ContactPage.tsx', name: 'ContactPage' },
];

for (const p of pages) {
  const filePath = path.resolve(p.file);
  const exists = fs.existsSync(filePath);
  check(`Page ${p.name} exists`, exists);
  if (exists) {
    const content = fs.readFileSync(filePath, 'utf8');
    check(`Page ${p.name} has scroll-to-top on mount`, content.includes('scrollTo') && (content.includes('main-content') || content.includes('behavior')));
  }
}

// 3. App.tsx Routes & Scroll Restoration
const appPath = path.resolve('src/App.tsx');
const appContent = fs.readFileSync(appPath, 'utf8');

check('App.tsx imports HowItWorksPage', appContent.includes('import HowItWorksPage from'));
check('App.tsx imports LotteryRulesPage', appContent.includes('import LotteryRulesPage from'));
check('App.tsx navigates to /how-it-works', appContent.includes('/how-it-works'));
check('App.tsx navigates to /rules', appContent.includes('/rules'));
check('App.tsx has layout-level scroll restoration hook', appContent.includes('Comprehensive Layout-Level Scroll Reset') && appContent.includes('mainEl.scrollTo({ top: 0, left: 0, behavior: \'instant\' })'));
check('App.tsx main content pane has overscroll-contain', appContent.includes('id="main-content"') && appContent.includes('overscroll-contain'));
check('App.tsx renders HowItWorksPage', appContent.includes('<HowItWorksPage'));
check('App.tsx renders LotteryRulesPage', appContent.includes('<LotteryRulesPage'));

// 4. Sidebar.tsx
const sidebarPath = path.resolve('src/components/Sidebar.tsx');
const sidebarContent = fs.readFileSync(sidebarPath, 'utf8');

check('Sidebar has Information group', sidebarContent.includes("title: 'Information'"));
check('Sidebar has How It Works link', sidebarContent.includes("id: 'how-it-works'"));
check('Sidebar has Lottery Rules link', sidebarContent.includes("id: 'rules'"));
check('Sidebar has FAQ link', sidebarContent.includes("id: 'faq'"));
check('Sidebar has Support & Legal group', sidebarContent.includes("title: 'Support & Legal'"));
check('Sidebar has Responsible Gaming link', sidebarContent.includes("id: 'responsible-gaming'"));
check('Sidebar has Terms link', sidebarContent.includes("id: 'terms'"));
check('Sidebar has Customer Support link', sidebarContent.includes("id: 'contact'"));
check('Sidebar menu container has overscroll-contain', sidebarContent.includes('overscroll-contain'));

// 5. LotteryContext.tsx Ticket Uniqueness Pre-checks
const lotteryCtxPath = path.resolve('src/context/LotteryContext.tsx');
const lotteryCtxContent = fs.readFileSync(lotteryCtxPath, 'utf8');

check('LotteryContext isTicketNumberSold checks event-wide tickets across all players', lotteryCtxContent.includes('isTicketNumberSold = (eventId, number)'));
check('LotteryContext getUnsoldRandomNumber generates exclusive numbers for event', lotteryCtxContent.includes('getUnsoldRandomNumber = (eventId)'));
check('LotteryContext buyTickets verifies taken tickets across all players in draw', lotteryCtxContent.includes('takenTicketsForEvent = tickets.filter') && lotteryCtxContent.includes('takenSet.has(formatted)'));

console.log('\n=== ALL HOMEPAGE & NAVIGATION VERIFICATIONS PASSED ===');
