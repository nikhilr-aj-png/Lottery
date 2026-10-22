import { runSql } from './supabase_admin.mjs';

async function main() {
  const constraints = await runSql(`
    SELECT conname, contype, conrelid::regclass, confrelid::regclass
    FROM pg_constraint
    WHERE connamespace = 'public'::regnamespace;
  `);
  console.log('Constraints:', constraints);
}

main().catch(console.error);
