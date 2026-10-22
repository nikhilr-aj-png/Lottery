import { runSql } from './supabase_admin.mjs';

async function main() {
  await runSql(`
    UPDATE public.lottery_wallets 
    SET user_id = '673caf5b-5cd8-4d10-a50e-c74f9580f3c0' 
    WHERE address = '0x71A9f24E68B8910d54F30C8B38194aE02919B42';
  `);
  const wallets = await runSql(`SELECT * FROM public.lottery_wallets;`);
  console.log('Wallets:', wallets);
}

main().catch(console.error);
