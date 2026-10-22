import { runSql } from './supabase_admin.mjs';

async function main() {
  const w = await runSql(`SELECT * FROM lottery_wallets;`);
  console.log('lottery_wallets:', w);
  const wd = await runSql(`SELECT * FROM lottery_withdrawals;`);
  console.log('lottery_withdrawals:', wd);
  const dep = await runSql(`SELECT id, user_address, amount, currency, status FROM lottery_deposits;`);
  console.log('lottery_deposits:', dep);
}

main().catch(console.error);
