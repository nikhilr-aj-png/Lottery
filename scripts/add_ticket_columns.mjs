import { runSql } from './supabase_admin.mjs';

async function main() {
  await runSql(`
    ALTER TABLE public.lottery_tickets ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;
    ALTER TABLE public.lottery_tickets ADD COLUMN IF NOT EXISTS username text;
    CREATE INDEX IF NOT EXISTS idx_lottery_tickets_user_id ON public.lottery_tickets(user_id);

    ALTER TABLE public.lottery_withdrawals ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;
    ALTER TABLE public.lottery_withdrawals ADD COLUMN IF NOT EXISTS admin_notes text;
    CREATE INDEX IF NOT EXISTS idx_lottery_withdrawals_user_id ON public.lottery_withdrawals(user_id);
  `);
  console.log('✓ Added user_id and username columns to lottery_tickets and lottery_withdrawals');
}

main().catch(console.error);
