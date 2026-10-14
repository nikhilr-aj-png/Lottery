import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://pkloymdzdjykpsutpyqk.supabase.co';
const supabaseAnonKey = 'sb_publishable_x7puqG5DzU9YkvDsV10HyQ_144KlMqt';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkEvents() {
  const { data, error } = await supabase.from('lottery_events').select('*');
  console.log('Error:', error);
  console.log('Total events in DB:', data?.length);
  if (data) {
    data.forEach(e => {
      console.log(`- [${e.status}] ${e.id}: "${e.title}" | Ticket: ${e.ticket_price} USDT | Winning: ${e.winning_digits}`);
    });
  }
}

checkEvents();
