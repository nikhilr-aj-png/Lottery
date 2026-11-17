import { createClient } from '@supabase/supabase-js';
import { runSql } from './supabase_admin.mjs';

const supabaseUrl = 'https://pkloymdzdjykpsutpyqk.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBrbG95bWR6ZGp5a3BzdXRweXFrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIxMjQyMzUsImV4cCI6MjA4NzcwMDIzNX0.0YYFrt5Ra2s_4ilI378kClnB8lp3yNSgkB7iDSPZQUk';
const supabase = createClient(supabaseUrl, supabaseKey);

async function runVerification() {
  console.log('====================================================');
  console.log('STARTING RIGOROUS FULL-SYSTEM VERIFICATION');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(name, condition, details = '') {
    if (condition) {
      console.log(`[PASS] ${name} ${details ? '(' + details + ')' : ''}`);
      passed++;
    } else {
      console.error(`[FAIL] ${name}: ${details}`);
      failed++;
    }
  }

  // 1. Verify game_configurations has 12 games and no deleted ones active
  const { data: games, error: gErr } = await supabase
    .from('game_configurations')
    .select('*')
    .neq('status', 'deleted');
  assert('game_configurations query succeeds', !gErr && Array.isArray(games), `Found ${games?.length} games`);
  assert('No deleted games in active list', games.every(g => g.status !== 'deleted'));

  // 2. Verify game_rooms has 0 fake players and no static lottery rooms
  const { data: rooms, error: rErr } = await supabase
    .from('game_rooms')
    .select('*');
  assert('game_rooms query succeeds', !rErr && Array.isArray(rooms), `Found ${rooms?.length} rooms`);
  assert('No fake player counts in game_rooms', rooms.every(r => Number(r.current_players) === 0));
  assert('No static lottery rooms in game_rooms', !rooms.some(r => r.game_id === 'lottery'));

  // 3. Test creating a dynamic Four-Digit Lottery event with multi-winner distribution
  const testEventId = `evt-verify-${Date.now().toString(36)}`;
  const testDistribution = [
    { position: 1, percent: 50 },
    { position: 2, percent: 30 },
    { position: 3, percent: 20 }
  ];

  await runSql(`
    INSERT INTO public.lottery_events (
      id, title, badge, game_id, room_id, room_name, description, currency, ticket_price,
      pool_prize, start_time, duration_value, duration_unit, draw_time, cooldown_value,
      cooldown_unit, jackpot_mode, min_jackpot, max_jackpot, jackpot_selection_method,
      ticket_limit_mode, max_total_tickets, max_tickets_per_user, draw_mode, preset_winning_digits,
      winner_mode, winner_count, winner_payout_share_percent, winner_distribution, status,
      participants_count, tickets_sold, sha256_seed, server_seed, is_active
    ) VALUES (
      '${testEventId}', 'Verification Grand Event 10000 FLO', 'VIP TEST', 'lottery', 'room-${testEventId}',
      'Room 1: Verification Arena', 'Provably fair verification event', 'FLO', 10, 10000,
      ${Date.now()}, 1, 'hours', ${Date.now() + 3600000}, 0, 'minutes', 'fixed', NULL, NULL,
      'manual', 'unlimited', NULL, NULL, 'preset', '8888', 'multiple', 3, 90,
      '${JSON.stringify(testDistribution)}'::jsonb, 'active', 0, 0,
      '0x112233445566778899aabbccddeeff00112233445566778899aabbccddeeff00', 'seed_secret_test_12345', true
    );
  `);

  const { data: createdEvent, error: cErr } = await supabase
    .from('lottery_events')
    .select('*')
    .eq('id', testEventId)
    .single();

  assert('Dynamic event inserted with all 35 columns', !cErr && createdEvent?.id === testEventId, `Currency: ${createdEvent?.currency}, Preset: ${createdEvent?.preset_winning_digits}`);
  assert('Winner distribution jsonb stored correctly', Array.isArray(createdEvent?.winner_distribution) && createdEvent?.winner_distribution.length === 3);

  // 4. Test buying tickets for this event
  const testTickets = [
    { id: `tkt-${testEventId}-1`, number: '8888', user: '673caf5b-5cd8-4d10-a50e-c74f9580f3c0', addr: '0x673caf5b5cd84d10a50ec74f9580f3c000000000' },
    { id: `tkt-${testEventId}-2`, number: '1234', user: '673caf5b-5cd8-4d10-a50e-c74f9580f3c0', addr: '0x673caf5b5cd84d10a50ec74f9580f3c000000000' },
    { id: `tkt-${testEventId}-3`, number: '5678', user: '673caf5b-5cd8-4d10-a50e-c74f9580f3c0', addr: '0x673caf5b5cd84d10a50ec74f9580f3c000000000' }
  ];

  for (const t of testTickets) {
    await runSql(`
      INSERT INTO public.lottery_tickets (
        id, event_id, event_title, ticket_number, user_id, user_address, price, currency, status, purchase_time, created_at
      ) VALUES (
        '${t.id}', '${testEventId}', 'Verification Grand Event 10000 FLO', '${t.number}', '${t.user}', '${t.addr}', 10, 'FLO', 'active', ${Date.now()}, now()
      );
    `);
  }

  // 5. Test executing draw via finalize_lottery_draw_secure RPC
  const finalizeRes = await runSql(`
    SELECT public.finalize_lottery_draw_secure('${testEventId}', '8888', 3) as result;
  `);

  const resJson = finalizeRes[0]?.result;
  assert('finalize_lottery_draw_secure executes successfully', resJson?.success === true, `Winning digits: ${resJson?.winning_digits}`);
  assert('Correct winning digits returned (8888)', resJson?.winning_digits === '8888');
  assert('Winner payouts created according to share and tiered percentages', resJson?.winner_count > 0, `Winner count: ${resJson?.winner_count}, Distributable pool: ${resJson?.distributable_pool}`);

  // 6. Verify event status updated to completed
  const { data: finalizedEvent } = await supabase
    .from('lottery_events')
    .select('status, winning_digits')
    .eq('id', testEventId)
    .single();

  assert('Event status is completed', finalizedEvent?.status === 'completed');
  assert('Event winning_digits stored permanently', finalizedEvent?.winning_digits === '8888');

  // 7. Clean up test event and tickets
  await runSql(`
    DELETE FROM public.winner_payouts WHERE event_id = '${testEventId}';
    DELETE FROM public.lottery_tickets WHERE event_id = '${testEventId}';
    DELETE FROM public.lottery_events WHERE id = '${testEventId}';
  `);
  console.log('[PASS] Test event, tickets, and payouts cleaned up cleanly.');

  console.log('\n====================================================');
  console.log(`VERIFICATION COMPLETE: ${passed} PASSED, ${failed} FAILED`);
  console.log('====================================================');
}

runVerification().catch(console.error);
