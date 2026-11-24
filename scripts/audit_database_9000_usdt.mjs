import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://pkloymdzdjykpsutpyqk.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBrbG95bWR6ZGp5a3BzdXRweXFrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIxMjQyMzUsImV4cCI6MjA4NzcwMDIzNX0.0YYFrt5Ra2s_4ilI378kClnB8lp3yNSgkB7iDSPZQUk';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function runAudit() {
  console.log('=== STARTING SUPABASE FINANCIAL AUDIT ===\n');

  // 1. Check wallet_transactions
  console.log('--- 1. wallet_transactions ---');
  const { data: transactions, error: txError } = await supabase
    .from('wallet_transactions')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50);
  
  if (txError) {
    console.error('wallet_transactions error:', txError.message);
  } else {
    console.log(`Found ${transactions?.length || 0} transactions:`);
    transactions?.forEach(tx => {
      console.log(`- ID: ${tx.id} | User: ${tx.user_id} | Type: ${tx.type} | Amount: ${tx.amount} | Status: ${tx.status} | Desc: ${tx.description} | Meta: ${JSON.stringify(tx.metadata)} | Created: ${tx.created_at}`);
    });
  }

  // 2. Check notifications
  console.log('\n--- 2. notifications ---');
  const { data: notifications, error: notifError } = await supabase
    .from('notifications')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50);

  if (notifError) {
    console.error('notifications error:', notifError.message);
  } else {
    console.log(`Found ${notifications?.length || 0} notifications:`);
    notifications?.forEach(n => {
      console.log(`- ID: ${n.id} | User: ${n.user_id} | Title: ${n.title} | Message: ${n.message} | Type: ${n.type} | Created: ${n.created_at}`);
    });
  }

  // 3. Check lottery_events
  console.log('\n--- 3. lottery_events ---');
  const { data: events, error: evError } = await supabase
    .from('lottery_events')
    .select('*')
    .order('created_at', { ascending: false });

  if (evError) {
    console.error('lottery_events error:', evError.message);
  } else {
    console.log(`Found ${events?.length || 0} events:`);
    events?.forEach(e => {
      console.log(`- ID: ${e.id} | Title: ${e.title} | Status: ${e.status} | WinningDigits: ${e.winning_digits} | PrizePool: ${e.prize_pool || e.jackpot_amount} | TicketPrice: ${e.ticket_price} | DrawTime: ${e.draw_time} | Created: ${e.created_at}`);
    });
  }

  // 4. Check lottery_tickets
  console.log('\n--- 4. lottery_tickets ---');
  const { data: tickets, error: tktError } = await supabase
    .from('lottery_tickets')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50);

  if (tktError) {
    console.error('lottery_tickets error:', tktError.message);
  } else {
    console.log(`Found ${tickets?.length || 0} tickets:`);
    tickets?.forEach(t => {
      console.log(`- ID: ${t.id} | EventID: ${t.event_id} | UserID: ${t.user_id} | Number: ${t.ticket_number || t.chosen_digits} | Price: ${t.ticket_price} | Status: ${t.status} | Created: ${t.created_at}`);
    });
  }

  // 5. Check winner_payouts table if exists
  console.log('\n--- 5. winner_payouts table (if exists) ---');
  const { data: payouts, error: pError } = await supabase
    .from('winner_payouts')
    .select('*')
    .limit(50);

  if (pError) {
    console.log('winner_payouts error/not found:', pError.message);
  } else {
    console.log(`Found ${payouts?.length || 0} payouts:`, payouts);
  }

  // 6. Check user_wallets / profiles
  console.log('\n--- 6. profiles / wallets ---');
  const { data: profiles, error: profError } = await supabase
    .from('profiles')
    .select('id, username, email, role, balance, created_at')
    .limit(20);

  if (profError) {
    console.error('profiles error:', profError.message);
  } else {
    console.log(`Found ${profiles?.length || 0} profiles:`, profiles);
  }

  console.log('\n=== AUDIT COMPLETE ===');
}

runAudit().catch(console.error);
