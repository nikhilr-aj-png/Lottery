import { runSql } from './supabase_admin.mjs';

async function main() {
  const triggers = await runSql(`
    SELECT trigger_name, event_manipulation, event_object_table, action_statement
    FROM information_schema.triggers
    WHERE trigger_schema = 'public';
  `);
  console.log('Triggers:', triggers);

  const functions = await runSql(`
    SELECT routine_name, routine_type
    FROM information_schema.routines
    WHERE routine_schema = 'public';
  `);
  console.log('Functions:', functions);
}

main().catch(console.error);
