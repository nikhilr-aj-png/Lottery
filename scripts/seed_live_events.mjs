import { runSql } from './supabase_admin.mjs';

async function seedLiveEvents() {
  const now = Date.now();
  console.log('Seeding real dynamic lottery events into Supabase...');

  const events = [
    {
      id: 'evt-diwali-bumper-10',
      title: 'Diwali Special Bumper Pot 10 USDT',
      badge: '🪔 DIWALI BUMPER',
      ticket_price: 10,
      pool_prize: 2500,
      draw_time: now + 5 * 3600 * 1000, // 5 hours left
      status: 'active',
      winning_digits: null,
      participants_count: 142,
      tickets_sold: 250,
      sha256_seed: '0x3f98a2b91c88e1bc74d021f980145ca7e3b0c44298fc1c149afbf4c8996fb924',
      block_target: JSON.stringify({
        block: '#19,402,118',
        theme: 'diwali',
        banner_image: 'https://images.unsplash.com/photo-1605371924599-2d0365da1ae0?w=1200&q=80',
        min_prize: 500,
        max_prize: 5000,
        winner_share_percent: 90,
        winner_count: 1,
        target_winning_digits: '7429'
      })
    },
    {
      id: 'evt-cyberpunk-vip-50',
      title: '⚡ Cyberpunk High Roller 50 USDT VIP Pool',
      badge: 'VIP HIGH ROLLER',
      ticket_price: 50,
      pool_prize: 25000,
      draw_time: now + 14 * 3600 * 1000, // 14 hours left
      status: 'active',
      winning_digits: null,
      participants_count: 280,
      tickets_sold: 500,
      sha256_seed: '0x88f21cb47ae91b0177dfc021f981145ca7e3b0c44298fc1c149afbf4c8994781',
      block_target: JSON.stringify({
        block: '#19,418,900',
        theme: 'cyberpunk',
        banner_image: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=1200&q=80',
        min_prize: 5000,
        max_prize: 25000,
        winner_share_percent: 90,
        winner_count: 1,
        target_winning_digits: '1578'
      })
    },
    {
      id: 'evt-eid-mubarak-20',
      title: '🌙 Eid Mubarak Grand Jackpot 20 USDT',
      badge: '🌙 EID MUBARAK',
      ticket_price: 20,
      pool_prize: 15000,
      draw_time: now + 8 * 3600 * 1000, // 8 hours left
      status: 'active',
      winning_digits: null,
      participants_count: 420,
      tickets_sold: 750,
      sha256_seed: '0x44cd918aa8fc1c149afbf4c8996fb9247ae3b0c44298fc1c149afbf4c89955bc',
      block_target: JSON.stringify({
        block: '#19,425,500',
        theme: 'eid',
        banner_image: 'https://images.unsplash.com/photo-1564769625905-50e93615e769?w=1200&q=80',
        min_prize: 2000,
        max_prize: 15000,
        winner_share_percent: 90,
        winner_count: 1,
        target_winning_digits: '3042'
      })
    },
    {
      id: 'evt-durga-puja-bumper-25',
      title: '🌺 Durga Utsav Mega Bumper Pot 25 USDT',
      badge: '🌺 DURGA UTSAV',
      ticket_price: 25,
      pool_prize: 50000,
      draw_time: now - 10 * 3600 * 1000, // Concluded 10 hours ago
      status: 'completed',
      winning_digits: '5521',
      participants_count: 1200,
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
    {
      id: 'evt-new-year-gala-100',
      title: '🎆 New Year Gala Grand Draw 100 USDT',
      badge: '🎆 NEW YEAR GALA',
      ticket_price: 100,
      pool_prize: 85000,
      draw_time: now - 32 * 3600 * 1000, // Concluded 32 hours ago
      status: 'completed',
      winning_digits: '9102',
      participants_count: 550,
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

  for (const e of events) {
    await runSql(`
      INSERT INTO public.lottery_events (
        id, title, badge, ticket_price, pool_prize, draw_time, status, winning_digits,
        participants_count, tickets_sold, sha256_seed, block_target, created_at
      ) VALUES (
        '${e.id}', '${e.title}', '${e.badge}', ${e.ticket_price}, ${e.pool_prize}, ${e.draw_time},
        '${e.status}', ${e.winning_digits ? `'${e.winning_digits}'` : 'NULL'},
        ${e.participants_count}, ${e.tickets_sold}, '${e.sha256_seed}', '${e.block_target.replace(/'/g, "''")}',
        now()
      )
      ON CONFLICT (id) DO UPDATE SET
        title = EXCLUDED.title,
        badge = EXCLUDED.badge,
        ticket_price = EXCLUDED.ticket_price,
        pool_prize = EXCLUDED.pool_prize,
        draw_time = EXCLUDED.draw_time,
        status = EXCLUDED.status,
        winning_digits = EXCLUDED.winning_digits,
        participants_count = EXCLUDED.participants_count,
        tickets_sold = EXCLUDED.tickets_sold,
        block_target = EXCLUDED.block_target;
    `);
    console.log(`✓ Seeded ${e.id}: ${e.title}`);
  }

  // Also seed initial winner payouts for the completed events
  await runSql(`
    INSERT INTO public.winner_payouts (
      id, event_id, event_title, ticket_id, winner_address, winner_username, winning_digits,
      tickets_sold, ticket_price, total_pool_collected, winner_share_percent, calculated_amount,
      payout_amount, status, tx_hash, approved_at, created_at
    ) VALUES 
    (
      'WP-durga-1', 'evt-durga-puja-bumper-25', '🌺 Durga Utsav Mega Bumper Pot 25 USDT', 'tkt-durga-1',
      'TYv7s8K3eL2QpNm4xW9jRtZbCuYxK9m', 'LuckyWinner77', '5521', 2000, 25, 50000, 90, 15000, 15000,
      'completed', '0x7b2f4c91a8e235d671c45091bf28490a', now() - interval '9 hours', now() - interval '10 hours'
    ),
    (
      'WP-durga-2', 'evt-durga-puja-bumper-25', '🌺 Durga Utsav Mega Bumper Pot 25 USDT', 'tkt-durga-2',
      'TN9kLm34XyZ89qW1p2RtUvBc7dE4fGh5', 'crypto_king', '5521', 2000, 25, 50000, 90, 15000, 15000,
      'completed', '0x1c88e1bc74d021f980145ca7e3b0c442', now() - interval '9 hours', now() - interval '10 hours'
    ),
    (
      'WP-durga-3', 'evt-durga-puja-bumper-25', '🌺 Durga Utsav Mega Bumper Pot 25 USDT', 'tkt-durga-3',
      'TP8xNm49LtZ12qK7w3RtYvAc5bF6gHi8', 'satoshi_vip', '5521', 2000, 25, 50000, 90, 15000, 15000,
      'completed', '0x44cd918aa8fc1c149afbf4c8996fb924', now() - interval '9 hours', now() - interval '10 hours'
    ),
    (
      'WP-newyear-1', 'evt-new-year-gala-100', '🎆 New Year Gala Grand Draw 100 USDT', 'tkt-newyear-1',
      'TR3vKm91WqZ45pL8y2RtXbDc6eG7fIj9', 'VIP_Player', '9102', 850, 100, 85000, 90, 76500, 76500,
      'completed', '0x9922ffc021f981145ca7e3b0c44298fc', now() - interval '31 hours', now() - interval '32 hours'
    )
    ON CONFLICT (id) DO NOTHING;
  `);
  console.log('✓ Seeded historical verified winner payouts');
}

seedLiveEvents().catch(console.error);
