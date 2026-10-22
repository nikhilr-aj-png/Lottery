import { runSql } from './supabase_admin.mjs';

async function main() {
  const f = await runSql(`
    SELECT proname, prosrc
    FROM pg_proc
    WHERE proname = 'protect_profile_columns';
  `);
  console.log('protect_profile_columns:\n', f[0]?.prosrc);
}

main().catch(console.error);
