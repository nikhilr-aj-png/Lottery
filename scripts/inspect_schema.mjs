import { runSql } from './supabase_admin.mjs';

async function inspectSchema() {
  const columns = await runSql(`
    SELECT table_name, column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_schema = 'public'
    ORDER BY table_name, ordinal_position;
  `);
  console.log('--- COLUMNS ---');
  for (const c of columns) {
    console.log(`${c.table_name}.${c.column_name} (${c.data_type})`);
  }

  const rls = await runSql(`
    SELECT relname, relrowsecurity, relforcerowsecurity
    FROM pg_class
    JOIN pg_namespace ON pg_namespace.oid = pg_class.relnamespace
    WHERE pg_namespace.nspname = 'public' AND relkind = 'r';
  `);
  console.log('--- RLS STATUS ---', rls);

  const policies = await runSql(`
    SELECT tablename, policyname, permissive, roles, cmd, qual, with_check
    FROM pg_policies
    WHERE schemaname = 'public';
  `);
  console.log('--- POLICIES ---', policies);
}

inspectSchema().catch(console.error);
