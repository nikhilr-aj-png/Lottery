import { runSql } from './supabase_admin.mjs';

async function clearSeededEvents() {
  console.log('Clearing seeded lottery events and payouts...');
  await runSql(`
    DELETE FROM public.winner_payouts WHERE event_id LIKE 'evt-%';
    DELETE FROM public.lottery_tickets WHERE event_id LIKE 'evt-%';
    DELETE FROM public.lottery_events;
  `);
  console.log('✓ Cleared all seeded lottery_events and dummy payouts');
}

clearSeededEvents().catch(console.error);
