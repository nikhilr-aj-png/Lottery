import { runSql } from './supabase_admin.mjs';

async function main() {
  const tables = ['lottery_events', 'lottery_tickets', 'lottery_wallets', 'lottery_withdrawals', 'lottery_deposits', 'profiles'];
  for (const t of tables) {
    const rows = await runSql(`SELECT count(*) as count FROM ${t};`);
    console.log(`${t}: ${rows[0].count} rows`);
  }
}

main().catch(console.error);
