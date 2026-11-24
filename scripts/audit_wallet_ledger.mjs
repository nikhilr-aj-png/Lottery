import { runSql } from './supabase_admin.mjs';

async function main() {
  try {
    console.log('=== PLATFORM SETTINGS AUDIT ===\n');
    const settings = await runSql(`
      SELECT key, value 
      FROM public.platform_settings 
      WHERE key IN ('bonus_rewards', 'daily_checkin', 'spin_wheel_settings', 'faucet_settings', 'referral_settings');
    `);
    console.log(JSON.stringify(settings, null, 2));

    console.log('\n=== ROUTINE DEFINITION FOR claim_daily_bonus ===');
    const funcDef = await runSql(`
      SELECT pg_get_functiondef(p.oid) as def
      FROM pg_proc p
      JOIN pg_namespace n ON p.pronamespace = n.oid
      WHERE n.nspname = 'public' AND p.proname = 'claim_daily_bonus';
    `);
    console.log(funcDef[0]?.def || 'claim_daily_bonus not found');

    console.log('\n=== ROUTINE DEFINITION FOR spin_lucky_wheel ===');
    const spinDef = await runSql(`
      SELECT pg_get_functiondef(p.oid) as def
      FROM pg_proc p
      JOIN pg_namespace n ON p.pronamespace = n.oid
      WHERE n.nspname = 'public' AND p.proname = 'spin_lucky_wheel';
    `);
    console.log(spinDef[0]?.def || 'spin_lucky_wheel not found');

    console.log('\n=== ROUTINE DEFINITION FOR credit_virtual_credits ===');
    const creditDef = await runSql(`
      SELECT pg_get_functiondef(p.oid) as def
      FROM pg_proc p
      JOIN pg_namespace n ON p.pronamespace = n.oid
      WHERE n.nspname = 'public' AND p.proname = 'credit_virtual_credits';
    `);
    console.log(creditDef[0]?.def || 'credit_virtual_credits not found');

  } catch (err) {
    console.error('Audit failed:', err);
  }
}

main();
