import { runSql } from './supabase_admin.mjs';

async function main() {
  console.log('--- Checking indexes on public.lottery_tickets ---');
  const indexes = await runSql(`
    SELECT indexname, indexdef 
    FROM pg_indexes 
    WHERE tablename = 'lottery_tickets';
  `);
  console.log('Current indexes:', indexes);

  console.log('\n--- Checking buy_lottery_tickets_secure definition ---');
  const fnDef = await runSql(`
    SELECT pg_get_functiondef(oid) as def
    FROM pg_proc 
    WHERE proname = 'buy_lottery_tickets_secure';
  `);
  console.log('Function definition length:', fnDef?.[0]?.def?.length);
  console.log(fnDef?.[0]?.def);

  console.log('\n--- Ensuring UNIQUE constraint on (event_id, ticket_number) ---');
  // First, check if there are any duplicate tickets currently in the database
  const duplicates = await runSql(`
    SELECT event_id, lpad(ticket_number::text, 4, '0') as num, count(*) 
    FROM public.lottery_tickets 
    GROUP BY event_id, lpad(ticket_number::text, 4, '0') 
    HAVING count(*) > 1;
  `);
  console.log('Duplicates found:', duplicates);

  // Create unique index to guarantee database-level atomic rejection of any duplicate combination within the same event
  await runSql(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_lottery_tickets_event_ticket_unique 
    ON public.lottery_tickets (event_id, lpad(ticket_number::text, 4, '0'));
  `);
  console.log('✅ Unique index idx_lottery_tickets_event_ticket_unique ensured on public.lottery_tickets(event_id, lpad(ticket_number, 4, "0"))');
}

main().catch(console.error);
