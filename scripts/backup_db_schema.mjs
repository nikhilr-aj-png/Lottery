import { runSql } from './supabase_admin.mjs';
import fs from 'fs';

async function backup() {
  console.log('Backing up database schema definitions...');

  const policies = await runSql(`
    SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check 
    FROM pg_policies 
    WHERE schemaname = 'public'
    ORDER BY tablename, policyname;
  `);

  const functions = await runSql(`
    SELECT 
      n.nspname as schema,
      p.proname as name,
      pg_get_function_identity_arguments(p.oid) as args,
      p.prosecdef as is_secdef,
      pg_get_functiondef(p.oid) as def
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
    ORDER BY p.proname;
  `);

  const indexes = await runSql(`
    SELECT schemaname, tablename, indexname, indexdef 
    FROM pg_indexes 
    WHERE schemaname = 'public'
    ORDER BY tablename, indexname;
  `);

  const triggers = await runSql(`
    SELECT 
      event_object_schema as schema,
      event_object_table as table,
      trigger_name,
      action_timing,
      event_manipulation,
      action_statement
    FROM information_schema.triggers
    WHERE event_object_schema = 'public';
  `);

  const backupData = {
    timestamp: new Date().toISOString(),
    policies,
    functions,
    indexes,
    triggers
  };

  fs.writeFileSync('supabase/backup_pre_advisors_fix.json', JSON.stringify(backupData, null, 2));
  console.log('✓ Successfully saved backup to supabase/backup_pre_advisors_fix.json');
  console.log(`  Policies: ${policies.length}`);
  console.log(`  Functions: ${functions.length}`);
  console.log(`  Indexes: ${indexes.length}`);
  console.log(`  Triggers: ${triggers.length}`);
}

backup().catch(console.error);
