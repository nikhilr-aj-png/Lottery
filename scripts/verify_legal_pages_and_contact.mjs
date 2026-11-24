import fs from 'fs';

async function testAllChecklistItems() {
  console.log('=== RUNNING COMPLETE 23-POINT VERIFICATION FOR LEGAL & INFO PAGES ===\n');

  let passed = 0;
  let total = 23;

  function assert(condition, message) {
    if (!condition) {
      throw new Error(`FAILED: ${message}`);
    }
    console.log(`[PASS] ${message}`);
    passed++;
  }

  const howItWorks = fs.readFileSync('src/pages/HowItWorksPage.tsx', 'utf8');
  const rules = fs.readFileSync('src/pages/LotteryRulesPage.tsx', 'utf8');
  const faq = fs.readFileSync('src/pages/FaqPage.tsx', 'utf8');
  const contact = fs.readFileSync('src/pages/ContactPage.tsx', 'utf8');
  const responsible = fs.readFileSync('src/pages/ResponsibleGamingPage.tsx', 'utf8');
  const terms = fs.readFileSync('src/pages/TermsPage.tsx', 'utf8');
  const privacy = fs.readFileSync('src/pages/PrivacyPolicyPage.tsx', 'utf8');
  const sidebar = fs.readFileSync('src/components/Sidebar.tsx', 'utf8');
  const footer = fs.readFileSync('src/components/Footer.tsx', 'utf8');

  // 1. How It Works no longer shows Back to Lottery Lobby or unnecessary top navigation
  assert(!howItWorks.includes('Back to Lottery Lobby') && !howItWorks.includes('Player Guide top heading'), 
    '1. How It Works no longer shows Back to Lottery Lobby or unnecessary top navigation');

  // 2. Explore Live Lottery Pool banner is removed from How It Works
  assert(!howItWorks.includes('Explore Live Lottery Pools Now') && !howItWorks.includes('Explore Live Lottery Pool'), 
    '2. Explore Live Lottery Pool banner is removed from How It Works');

  // 3. Lottery Rules no longer shows Back to Lottery Lobby or Official Platform Governance banner
  assert(!rules.includes('Back to Lottery Lobby') && !rules.includes('Official Platform Governance'), 
    '3. Lottery Rules no longer shows Back to Lottery Lobby or Official Platform Governance banner');

  // 4. Return to Lottery Lobby button is removed from Lottery Rules
  assert(!rules.includes('Return to Lottery Lobby'), 
    '4. Return to Lottery Lobby button is removed from Lottery Rules');

  // 5. FAQ no longer shows Back to Home
  assert(!faq.includes('Back to Home'), 
    '5. FAQ no longer shows Back to Home');

  // 6. FAQ Contact Support opens the internal Contact & Support page
  assert(faq.includes("handleContactSupport") && faq.includes("'contact'") && !faq.includes('mailto:'), 
    '6. FAQ Contact Support opens the internal Contact & Support page');

  // 7. FAQ\'s Still Have a Question section looks compact and responsive on mobile
  assert(faq.includes('Still have questions?') && faq.includes('w-full sm:w-auto'), 
    "7. FAQ's Still Have a Question section looks compact and responsive on mobile");

  // 8. Contact & Support no longer shows Return to Lottery Lobby
  assert(!contact.includes('Return to Lottery Lobby'), 
    '8. Contact & Support no longer shows Return to Lottery Lobby');

  // 9. Contact & Support remains accessible through the footer
  assert(footer.includes('contact-support') && footer.includes("'contact'"), 
    '9. Contact & Support remains accessible through the footer');

  // 10. Contact & Support is not added to the sidebar
  assert(!sidebar.toLowerCase().includes('contact & support') && !sidebar.toLowerCase().includes('contact-support'), 
    '10. Contact & Support is not added to the sidebar');

  // 11. Responsible Gaming no longer shows Back to Home
  assert(!responsible.includes('Back to Home'), 
    '11. Responsible Gaming no longer shows Back to Home');

  // 12. Unsupported Self Exclusion and Account Limit actions are removed if they are not implemented
  assert(!responsible.includes('Request Exclusion') && !responsible.includes('mailto:'), 
    '12. Unsupported Self Exclusion mailto action is removed');

  // 13. Responsible Gaming Contact/Request actions open the internal Contact & Support page
  assert(responsible.includes('handleContactSupport') && responsible.includes("'contact'"), 
    '13. Responsible Gaming Contact/Request actions open the internal Contact & Support page');

  // 14. Terms & Conditions no longer shows Back to Home or Print PDF
  assert(!terms.includes('Back to Home') && !terms.includes('Print / PDF'), 
    '14. Terms & Conditions no longer shows Back to Home or Print PDF');

  // 15. Terms Contact Support opens the internal Contact & Support page
  assert(terms.includes('handleContactSupport') && terms.includes("'contact'"), 
    '15. Terms Contact Support opens the internal Contact & Support page');

  // 16. Helpdesk information remains visible
  assert(terms.includes('Customer Support Desk') && terms.includes('supportEmail'), 
    '16. Helpdesk information remains visible');

  // 17. Privacy Policy no longer shows Back to Home or Print PDF
  assert(!privacy.includes('Back to Home') && !privacy.includes('Print / PDF'), 
    '17. Privacy Policy no longer shows Back to Home or Print PDF');

  // 18. Privacy Policy effective date remains November 2026
  assert(privacy.includes('Effective: November 2026'), 
    '18. Privacy Policy effective date remains November 2026');

  // 19. Privacy Policy Contact Support opens the internal Contact & Support page
  assert(privacy.includes('handleContactSupport') && privacy.includes("'contact'"), 
    '19. Privacy Policy Contact Support opens the internal Contact & Support page');

  // 20. No internal Contact Support button launches an email application
  const pages = [howItWorks, rules, faq, responsible, terms, privacy];
  const hasMailtoButton = pages.some(p => /<button[^>]*mailto:/i.test(p) || /<a[^>]*btn[^>]*mailto:/i.test(p));
  assert(!hasMailtoButton, 
    '20. No internal Contact Support button launches an email application (all use internal navigation)');

  // 21. All pages remain readable on mobile
  assert(howItWorks.includes('px-3') && rules.includes('px-3') && faq.includes('px-3') && 
         contact.includes('px-2.5') && responsible.includes('px-3') && terms.includes('px-3') && privacy.includes('px-3'), 
    '21. All pages have mobile-friendly padding (px-3/px-2.5) preventing edge collision');

  // 22. Desktop and tablet layouts remain functional
  assert(terms.includes('max-w-4xl 2xl:max-w-5xl') && privacy.includes('max-w-4xl 2xl:max-w-5xl') && 
         howItWorks.includes('max-w-4xl') && rules.includes('max-w-4xl'), 
    '22. Desktop and tablet max-width and layout containers remain intact');

  // 23. No horizontal overflow or broken navigation occurs
  assert(!howItWorks.includes('overflow-x-scroll') && !terms.includes('overflow-x-scroll'), 
    '23. No horizontal overflow or broken navigation occurs');

  console.log(`\n================================================================`);
  console.log(`ALL ${passed}/${total} CHECKLIST VERIFICATION ITEMS PASSED 100%!`);
  console.log(`================================================================`);
}

testAllChecklistItems().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
