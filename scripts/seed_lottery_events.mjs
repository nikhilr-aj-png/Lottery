import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://pkloymdzdjykpsutpyqk.supabase.co';
const supabaseAnonKey = 'sb_publishable_x7puqG5DzU9YkvDsV10HyQ_144KlMqt';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

const eventsToSeed = [
  // 1. ACTIVE: Diwali Bumper Pot
  {
    id: 'evt-muxkocrz-436',
    title: 'Diwali Special Bumper Pot 10 USDT',
    badge: '🪔 DIWALI BUMPER',
    ticket_price: 10,
    pool_prize: 59.50,
    draw_time: Date.now() + 4 * 3600 * 1000, // 4 hours left
    status: 'active',
    winning_digits: null,
    participants_count: 1,
    tickets_sold: 1,
    sha256_seed: '0x3f98a2b91c88e1bc74d021f980145ca7e3b0c44298fc1c149afbf4c8996fb924',
    block_target: JSON.stringify({
      block: '#19,402,118',
      theme: 'diwali',
      banner_image: 'https://images.unsplash.com/photo-1605371924599-2d0365da1ae0?w=1200&q=80',
      min_prize: 10,
      max_prize: 50,
      winner_share_percent: 90,
      winner_count: 1,
      target_winning_digits: '7429'
    })
  },
  // 2. ACTIVE: Cyberpunk High Roller VIP 50 USDT
  {
    id: 'evt-cyberpunk-vip-50',
    title: '⚡ Cyberpunk High Roller 50 USDT VIP Pool',
    badge: 'VIP HIGH ROLLER',
    ticket_price: 50,
    pool_prize: 25000,
    draw_time: Date.now() + 14 * 3600 * 1000, // 14 hours left
    status: 'active',
    winning_digits: null,
    participants_count: 500,
    tickets_sold: 500,
    sha256_seed: '0x88f21cb47ae91b0177dfc021f981145ca7e3b0c44298fc1c149afbf4c8994781',
    block_target: JSON.stringify({
      block: '#19,418,900',
      theme: 'cyberpunk',
      banner_image: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=1200&q=80',
      min_prize: 1000,
      max_prize: 50000,
      winner_share_percent: 90,
      winner_count: 1,
      target_winning_digits: '1578'
    })
  },
  // 3. ACTIVE: Eid Mubarak Grand Jackpot 20 USDT
  {
    id: 'evt-eid-mubarak-20',
    title: '🌙 Eid Mubarak Grand Jackpot 20 USDT',
    badge: '🌙 EID MUBARAK',
    ticket_price: 20,
    pool_prize: 15000,
    draw_time: Date.now() + 8 * 3600 * 1000, // 8 hours left
    status: 'active',
    winning_digits: null,
    participants_count: 750,
    tickets_sold: 750,
    sha256_seed: '0x44cd918aa8fc1c149afbf4c8996fb9247ae3b0c44298fc1c149afbf4c89955bc',
    block_target: JSON.stringify({
      block: '#19,425,500',
      theme: 'eid',
      banner_image: 'https://images.unsplash.com/photo-1564769625905-50e93615e769?w=1200&q=80',
      min_prize: 500,
      max_prize: 15000,
      winner_share_percent: 90,
      winner_count: 1,
      target_winning_digits: '3042'
    })
  },
  // 4. CONCLUDED WITH WINNERS: Durga Utsav Mega Bumper 25 USDT (Multi-Winner Draw)
  {
    id: 'evt-durga-puja-bumper-25',
    title: '🌺 Durga Utsav Mega Bumper Pot 25 USDT',
    badge: '🌺 DURGA UTSAV',
    ticket_price: 25,
    pool_prize: 50000,
    draw_time: Date.now() - 10 * 3600 * 1000, // Drawn 10 hours ago
    status: 'completed',
    winning_digits: '5521',
    participants_count: 2000,
    tickets_sold: 2000,
    sha256_seed: '0x77aa12bc98fe31dc90b345ef12a884cd918aa8fc1c149afbf4c8996fb9247ae3',
    block_target: JSON.stringify({
      block: '#19,398,400',
      theme: 'durga_puja',
      banner_image: 'https://images.unsplash.com/photo-1603555501671-8f96b3fce8b5?w=1200&q=80',
      min_prize: 10000,
      max_prize: 50000,
      winner_share_percent: 90,
      winner_count: 3,
      target_winning_digits: '5521',
      winner_summary: '3 Lucky Winners equally shared the 45,000 USDT Prize Pool (15,000 USDT each)',
      winners: [
        { rank: 1, user: '@LuckyWinner77', ticket: '#5521', prize: '15,000.00 USDT', status: 'Disbursed' },
        { rank: 2, user: '@crypto_king', ticket: '#5521', prize: '15,000.00 USDT', status: 'Disbursed' },
        { rank: 3, user: '@satoshi_vip', ticket: '#5521', prize: '15,000.00 USDT', status: 'Disbursed' }
      ]
    })
  },
  // 5. CONCLUDED WITH WINNERS: New Year Gala Grand Draw 100 USDT (1 Grand Jackpot Winner)
  {
    id: 'evt-new-year-gala-100',
    title: '🎆 New Year Gala Grand Draw 100 USDT',
    badge: '🎆 NEW YEAR GALA',
    ticket_price: 100,
    pool_prize: 85000,
    draw_time: Date.now() - 32 * 3600 * 1000, // Drawn 32 hours ago
    status: 'completed',
    winning_digits: '9102',
    participants_count: 850,
    tickets_sold: 850,
    sha256_seed: '0x9922ffc021f981145ca7e3b0c44298fc1c149afbf4c899478188f21cb47ae91b',
    block_target: JSON.stringify({
      block: '#19,380,100',
      theme: 'new_year',
      banner_image: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=1200&q=80',
      min_prize: 20000,
      max_prize: 85000,
      winner_share_percent: 90,
      winner_count: 1,
      target_winning_digits: '9102',
      winner_summary: '1 Grand Jackpot Winner matched exact 4-digit sequence #9102',
      winners: [
        { rank: 1, user: '@VIP_Player', ticket: '#9102', prize: '76,500.00 USDT', status: 'Disbursed' }
      ]
    })
  }
];

async function seed() {
  console.log('Seeding 5 rich lottery events with winners into Supabase...');
  for (const event of eventsToSeed) {
    const { data, error } = await supabase.from('lottery_events').upsert(event).select();
    if (error) {
      console.error('Error seeding event', event.id, error);
    } else {
      console.log(`✓ Seeded [${event.status}] ${event.id}: "${event.title}"`);
    }
  }
  console.log('Done seeding events!');
}

seed();
