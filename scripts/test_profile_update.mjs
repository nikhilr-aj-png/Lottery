import { runSql } from './supabase_admin.mjs';

async function testProfileUpdate() {
  // Test updating updated_at on test user
  const res = await runSql(`
    UPDATE public.profiles
    SET updated_at = now()
    WHERE id = '673caf5b-5cd8-4d10-a50e-c74f9580f3c0'
    RETURNING id, username, updated_at;
  `);
  console.log('Update result:', res);
}

testProfileUpdate().catch(console.error);
