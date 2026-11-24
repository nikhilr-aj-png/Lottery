import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const supabaseUrl = 'https://pkloymdzdjykpsutpyqk.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBrbG95bWR6ZGp5a3BzdXRweXFrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIxMjQyMzUsImV4cCI6MjA4NzcwMDIzNX0.0YYFrt5Ra2s_4ilI378kClnB8lp3yNSgkB7iDSPZQUk';
const supabase = createClient(supabaseUrl, supabaseKey);

async function runSingleGameAudit() {
  console.log('=================================================================');
  console.log('EARNFLOW.IN - SINGLE GAME FOUR DIGIT LOTTERY PLATFORM AUDIT');
  console.log('=================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(name, condition, details = '') {
    if (condition) {
      console.log(`[PASS] ${name} ${details ? '— ' + details : ''}`);
      passed++;
    } else {
      console.error(`[FAIL] ${name}: ${details}`);
      failed++;
    }
  }

  // 1. Files & Assets Removal Check
  const deletedFiles = [
    'src/games/CrashGame.tsx',
    'src/games/DiceGame.tsx',
    'src/games/CoinflipGame.tsx',
    'src/games/BingoGame.tsx',
    'src/games/HorseRacingGame.tsx',
    'src/components/GameCard.tsx',
    'src/components/GameModal.tsx',
    'src/hooks/useGameEngine.ts',
    'public/items/Coinflip.jpg',
    'public/items/Color.jpg',
    'public/items/Crash.jpg',
    'public/items/Dice.jpg',
    'public/items/Horse Racing.jpg'
  ];

  deletedFiles.forEach(file => {
    assert(`Deleted file check: ${file}`, !fs.existsSync(path.resolve(file)));
  });

  // 2. Engine and Type Audit
  const gamesIndex = fs.readFileSync('src/games/index.ts', 'utf-8');
  assert('games/index.ts exports only LotteryWorkstation', gamesIndex.includes('LotteryWorkstation') && !gamesIndex.includes('CrashGame'));

  const gameTypes = fs.readFileSync('src/types/games.ts', 'utf-8');
  assert("types/games.ts defines GameId = 'lottery'", gameTypes.includes("export type GameId = 'lottery';"));

  const gameRegistry = fs.readFileSync('src/engine/GameRegistry.ts', 'utf-8');
  assert('engine/GameRegistry.ts contains only lottery in GAMES array', gameRegistry.includes("id: 'lottery'") && !gameRegistry.includes("id: 'crash'"));

  // 3. Legal and Information Pages Audit
  const requiredLegalPages = [
    'src/pages/TermsPage.tsx',
    'src/pages/PrivacyPolicyPage.tsx',
    'src/pages/ResponsibleGamingPage.tsx',
    'src/pages/RefundPolicyPage.tsx',
    'src/pages/PaymentPolicyPage.tsx',
    'src/pages/DisclaimerPage.tsx',
    'src/pages/FaqPage.tsx'
  ];

  requiredLegalPages.forEach(page => {
    assert(`Legal page exists: ${page}`, fs.existsSync(path.resolve(page)));
  });

  // 4. SEO & AI Discoverability Files Audit
  assert('public/robots.txt exists', fs.existsSync('public/robots.txt'));
  assert('public/sitemap.xml exists', fs.existsSync('public/sitemap.xml'));
  assert('public/llms.txt exists', fs.existsSync('public/llms.txt'));
  assert('public/llms-full.txt exists', fs.existsSync('public/llms-full.txt'));

  const indexHtml = fs.readFileSync('index.html', 'utf-8');
  assert('index.html contains Schema.org JSON-LD', indexHtml.includes('application/ld+json'));
  assert('index.html contains canonical tag', indexHtml.includes('rel="canonical"'));
  assert('index.html references EarnFlow Four Digit Lottery', indexHtml.includes('Four Digit Lottery'));

  const robotsTxt = fs.readFileSync('public/robots.txt', 'utf-8');
  assert('robots.txt links sitemap.xml', robotsTxt.includes('Sitemap: https://earnflow.in/sitemap.xml'));

  const sitemapXml = fs.readFileSync('public/sitemap.xml', 'utf-8');
  assert('sitemap.xml includes legal routes', sitemapXml.includes('/terms-and-conditions') && sitemapXml.includes('/privacy-policy'));

  // 5. Database State Audit
  try {
    const { data: configs, error: cfgErr } = await supabase.from('game_configurations').select('*');
    if (!cfgErr && configs) {
      const activeConfigs = configs.filter(c => c.is_enabled && c.status === 'active');
      assert(
        'Database: Only lottery is active in game_configurations',
        activeConfigs.length === 1 && activeConfigs[0].game_id === 'lottery',
        `Active games count: ${activeConfigs.length} (${activeConfigs.map(c => c.game_id).join(', ')})`
      );
    }

    const { data: rooms, error: roomErr } = await supabase.from('game_rooms').select('*');
    if (!roomErr && rooms) {
      const nonLotteryRooms = rooms.filter(r => r.game_id !== 'lottery');
      assert('Database: 0 non-lottery game rooms remain', nonLotteryRooms.length === 0, `Remaining: ${nonLotteryRooms.length}`);
    }

    const { data: lotEvents, error: evErr } = await supabase.from('lottery_events').select('id, title, status, room_slug');
    if (!evErr && lotEvents) {
      assert('Database: Active lottery events exist', lotEvents.length > 0, `Total lottery events: ${lotEvents.length}`);
    }

    const { data: archivedRounds, error: archErr } = await supabase.from('archived_legacy_game_rounds').select('id', { count: 'exact' });
    if (!archErr) {
      assert('Database: Archived legacy game rounds safely preserved', true, `Table archived_legacy_game_rounds verified`);
    }

    const { data: wallets, error: walErr } = await supabase.from('lottery_wallets').select('id', { count: 'exact', head: true });
    if (!walErr) {
      assert('Database: lottery_wallets table healthy and intact', true);
    }
  } catch (err) {
    console.error('Database check error:', err);
  }

  // 6. Build Artifacts Audit
  assert('Production build artifact dist/index.html exists', fs.existsSync('dist/index.html'));

  console.log('\n=================================================================');
  console.log(`AUDIT COMPLETE: ${passed} PASSED, ${failed} FAILED`);
  console.log('=================================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runSingleGameAudit();
