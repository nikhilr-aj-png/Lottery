import { runSql } from './supabase_admin.mjs';

async function summarizeSplinter() {
  const res = await fetch('https://raw.githubusercontent.com/supabase/splinter/main/splinter.sql');
  const splinterSql = await res.text();
  const results = await runSql(splinterSql);

  const sec = results.filter(r => r.categories && r.categories.includes('SECURITY'));
  const perf = results.filter(r => r.categories && r.categories.includes('PERFORMANCE'));

  console.log(`\n========================================`);
  console.log(`TOTAL SECURITY WARNINGS: ${sec.length}`);
  console.log(`TOTAL PERFORMANCE WARNINGS: ${perf.length}`);
  console.log(`========================================\n`);

  const secGroups = {};
  for (const s of sec) {
    secGroups[s.name] = (secGroups[s.name] || 0) + 1;
  }
  console.log('--- SECURITY ADVISOR BREAKDOWN ---');
  for (const [k, v] of Object.entries(secGroups)) {
    console.log(`  ${k}: ${v} warnings`);
  }

  const perfGroups = {};
  for (const p of perf) {
    perfGroups[p.name] = (perfGroups[p.name] || 0) + 1;
  }
  console.log('\n--- PERFORMANCE ADVISOR BREAKDOWN ---');
  for (const [k, v] of Object.entries(perfGroups)) {
    console.log(`  ${k}: ${v} warnings`);
  }

  console.log('\n--- ALL DETAILS OF SECURITY LINTS ---');
  for (const s of sec) {
    console.log(`[${s.name}] ${s.detail}`);
  }

  console.log('\n--- ALL DETAILS OF PERFORMANCE LINTS ---');
  for (const p of perf) {
    console.log(`[${p.name}] ${p.detail}`);
  }
}

summarizeSplinter().catch(console.error);
