import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://pkloymdzdjykpsutpyqk.supabase.co';
const supabaseAnonKey = 'sb_publishable_x7puqG5DzU9YkvDsV10HyQ_144KlMqt';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function inspectDeposits() {
  const { data, error } = await supabase.from('lottery_deposits').select('*').limit(5);
  console.log('Error:', error);
  console.log('Rows:', data);
}

inspectDeposits();
