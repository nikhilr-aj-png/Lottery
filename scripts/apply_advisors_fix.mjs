import { runSql } from './supabase_admin.mjs';
import fs from 'fs';

async function applyMigration() {
  console.log('Reading migration file...');
  const sql = fs.readFileSync('supabase/migrations/20261113_fix_security_and_performance_advisors.sql', 'utf8');

  console.log('Applying migration to Supabase live database...');
  await runSql(sql);
  console.log('✓ Migration executed successfully!');
}

applyMigration().catch(console.error);

