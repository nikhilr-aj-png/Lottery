import { runSql } from './supabase_admin.mjs';

async function main() {
  try {
    const cols = await runSql(`
      SELECT table_name, column_name, data_type, numeric_precision, numeric_scale
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name IN ('lottery_wallets', 'wallet_ledger', 'user_daily_streaks', 'referral_rewards')
      ORDER BY table_name, ordinal_position;
    `);
    console.table(cols);
  } catch (err) {
    console.error('Error:', err);
  }
}

main();
