import { runSql } from './supabase_admin.mjs';

async function migrate() {
  console.log('Running Dynamic Platform Database Schema Enhancements...');

  // 1. Enhance lottery_events with complete lifecycle, currency, limits & winner config columns
  await runSql(`
    ALTER TABLE public.lottery_events
      ADD COLUMN IF NOT EXISTS game_id text DEFAULT 'lottery',
      ADD COLUMN IF NOT EXISTS room_id text DEFAULT 'lottery-room-1',
      ADD COLUMN IF NOT EXISTS room_name text DEFAULT 'Lottery Room 1: Daily Jackpot Pot',
      ADD COLUMN IF NOT EXISTS description text DEFAULT '',
      ADD COLUMN IF NOT EXISTS currency text DEFAULT 'FC',
      ADD COLUMN IF NOT EXISTS start_time bigint DEFAULT 0,
      ADD COLUMN IF NOT EXISTS duration_value numeric DEFAULT 24,
      ADD COLUMN IF NOT EXISTS duration_unit text DEFAULT 'hours',
      ADD COLUMN IF NOT EXISTS cooldown_value numeric DEFAULT 2,
      ADD COLUMN IF NOT EXISTS cooldown_unit text DEFAULT 'hours',
      ADD COLUMN IF NOT EXISTS cooldown_until bigint DEFAULT 0,
      ADD COLUMN IF NOT EXISTS jackpot_mode text DEFAULT 'fixed',
      ADD COLUMN IF NOT EXISTS min_jackpot numeric DEFAULT 1000,
      ADD COLUMN IF NOT EXISTS max_jackpot numeric DEFAULT 5000,
      ADD COLUMN IF NOT EXISTS jackpot_selection_method text DEFAULT 'manual',
      ADD COLUMN IF NOT EXISTS ticket_limit_mode text DEFAULT 'unlimited',
      ADD COLUMN IF NOT EXISTS max_total_tickets integer DEFAULT 1000,
      ADD COLUMN IF NOT EXISTS max_tickets_per_user integer DEFAULT 50,
      ADD COLUMN IF NOT EXISTS draw_mode text DEFAULT 'random',
      ADD COLUMN IF NOT EXISTS preset_winning_digits text DEFAULT NULL,
      ADD COLUMN IF NOT EXISTS winner_mode text DEFAULT 'single',
      ADD COLUMN IF NOT EXISTS winner_count integer DEFAULT 1,
      ADD COLUMN IF NOT EXISTS winner_payout_share_percent numeric DEFAULT 90,
      ADD COLUMN IF NOT EXISTS winner_distribution jsonb DEFAULT '[{"position": 1, "percent": 100}]'::jsonb,
      ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true,
      ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb;
  `);
  console.log('✓ lottery_events enhanced');

  // 2. Enhance game_configurations with status & soft-deletion
  await runSql(`
    ALTER TABLE public.game_configurations
      ADD COLUMN IF NOT EXISTS status text DEFAULT 'active',
      ADD COLUMN IF NOT EXISTS icon text DEFAULT '',
      ADD COLUMN IF NOT EXISTS description text DEFAULT '',
      ADD COLUMN IF NOT EXISTS badge text DEFAULT '';
  `);
  console.log('✓ game_configurations enhanced');

  // 3. Enhance lottery_tickets with currency
  await runSql(`
    ALTER TABLE public.lottery_tickets
      ADD COLUMN IF NOT EXISTS currency text DEFAULT 'FC';
  `);
  console.log('✓ lottery_tickets enhanced');

  // 4. Enhance winner_payouts with position & currency
  await runSql(`
    ALTER TABLE public.winner_payouts
      ADD COLUMN IF NOT EXISTS position integer DEFAULT 1,
      ADD COLUMN IF NOT EXISTS currency text DEFAULT 'FC';
  `);
  console.log('✓ winner_payouts enhanced');

  // 5. Verify columns
  const cols = await runSql(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'lottery_events' 
    ORDER BY ordinal_position;
  `);
  console.log('Updated lottery_events columns count:', cols.length);
}

migrate().catch(err => {
  console.error('Migration error:', err);
  process.exit(1);
});
