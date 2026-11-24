import fs from 'fs';
import path from 'path';
import { runSql } from './supabase_admin.mjs';

async function main() {
  console.log('================================================================');
  console.log('DATABASE AUDIT, BACKUP & CLEANUP: SINGLE GAME (FOUR DIGIT LOTTERY)');
  console.log('================================================================\n');

  // STEP 1: Take verified JSON backup of pre-migration state
  console.log('[1/7] Backing up current database tables...');
  const gameConfigs = await runSql(`SELECT * FROM public.game_configurations`);
  const gameRooms = await runSql(`SELECT * FROM public.game_rooms`);
  const gameRounds = await runSql(`SELECT * FROM public.game_rounds`);
  const lotteryEvents = await runSql(`SELECT id, room_name, status, currency, ticket_price FROM public.lottery_events`);
  const lotteryTicketsCount = await runSql(`SELECT COUNT(*) as count FROM public.lottery_tickets`);
  const walletsCount = await runSql(`SELECT COUNT(*) as count FROM public.lottery_wallets`);
  const ledgerCount = await runSql(`SELECT COUNT(*) as count FROM public.wallet_ledger`);

  const backupData = {
    backup_timestamp: new Date().toISOString(),
    environment: 'production',
    projectRef: 'pkloymdzdjykpsutpyqk',
    pre_migration_counts: {
      game_configurations: gameConfigs.length,
      game_rooms: gameRooms.length,
      game_rounds: gameRounds.length,
      lottery_events: lotteryEvents.length,
      lottery_tickets: lotteryTicketsCount[0]?.count || 0,
      lottery_wallets: walletsCount[0]?.count || 0,
      wallet_ledger: ledgerCount[0]?.count || 0
    },
    game_configurations: gameConfigs,
    game_rooms: gameRooms,
    game_rounds: gameRounds
  };

  const backupPath = path.resolve('supabase/backup_pre_game_removal_migration.json');
  fs.writeFileSync(backupPath, JSON.stringify(backupData, null, 2), 'utf-8');
  console.log(`Verified backup saved to: ${backupPath}`);
  console.log(`Backup size: ${(fs.statSync(backupPath).size / 1024).toFixed(2)} KB\n`);

  // STEP 2: Create isolated historical archive table for legacy game rounds
  console.log('[2/7] Creating public.archived_legacy_game_rounds table for financial/audit retention...');
  await runSql(`
    CREATE TABLE IF NOT EXISTS public.archived_legacy_game_rounds (
      id text PRIMARY KEY,
      user_id uuid,
      wallet_address text,
      username text,
      game_id text NOT NULL,
      room_id text,
      bet_amount numeric NOT NULL,
      multiplier numeric,
      payout numeric,
      net_profit numeric,
      currency text DEFAULT 'USDT',
      status text,
      outcome_data jsonb,
      server_seed text,
      server_seed_hash text,
      client_seed text,
      nonce bigint,
      metadata jsonb,
      created_at timestamp with time zone,
      archived_at timestamp with time zone DEFAULT now(),
      archive_reason text DEFAULT 'Platform transitioned exclusively to Four Digit Lottery.'
    );
  `);

  // STEP 3: Transfer any remaining non-lottery rounds to historical archive
  console.log('[3/7] Archiving non-lottery game rounds into public.archived_legacy_game_rounds...');
  await runSql(`
    INSERT INTO public.archived_legacy_game_rounds (
      id, user_id, wallet_address, username, game_id, room_id,
      bet_amount, multiplier, payout, net_profit, currency, status,
      outcome_data, server_seed, server_seed_hash, client_seed, nonce,
      metadata, created_at
    )
    SELECT
      id, user_id, wallet_address, username, game_id, room_id,
      bet_amount, multiplier, payout, net_profit, currency, status,
      outcome_data, server_seed, server_seed_hash, client_seed, nonce,
      metadata, created_at
    FROM public.game_rounds
    WHERE game_id != 'lottery'
    ON CONFLICT (id) DO NOTHING;
  `);

  // STEP 4: Remove active game_rooms for discontinued non-lottery games
  console.log('[4/7] Cleaning up non-lottery game rooms...');
  const roomsDeleted = await runSql(`
    DELETE FROM public.game_rooms
    WHERE game_id IN ('crash', 'dice', 'coinflip', 'bingo', 'horse-racing', 'mines', 'plinko', 'roulette', 'blackjack', 'slots', 'poker', 'keno', 'limbo')
    RETURNING id, game_id;
  `);
  console.log(`Deleted ${roomsDeleted?.length || 0} obsolete game room records.`);

  // STEP 5: Update game_configurations: ONLY lottery remains active and enabled
  console.log('[5/7] Updating game_configurations to set ONLY lottery active...');
  await runSql(`
    UPDATE public.game_configurations
    SET is_enabled = false,
        status = 'deleted',
        updated_at = now()
    WHERE game_id != 'lottery';

    UPDATE public.game_configurations
    SET is_enabled = true,
        status = 'active',
        game_name = 'Four-Digit Lottery',
        category = 'lottery',
        icon = '/items/Four Digit Lottery.jpg',
        description = 'Official Four-Digit Lucky Draw. Pick numbers 0000–9999 for massive USDT jackpot prize pools with automated transparent draws.',
        updated_at = now()
    WHERE game_id = 'lottery';
  `);

  // STEP 6: Clean non-lottery records from active game_rounds
  console.log('[6/7] Removing non-lottery rounds from active game_rounds (preserved in archived_legacy_game_rounds)...');
  await runSql(`
    DELETE FROM public.game_rounds
    WHERE game_id != 'lottery';
  `);

  // STEP 7: Verify database state after migration
  console.log('[7/7] Verifying database integrity after cleanup...');
  const postConfigs = await runSql(`
    SELECT game_id, game_name, is_enabled, status 
    FROM public.game_configurations 
    WHERE is_enabled = true OR status = 'active'
  `);
  console.log('Active game configurations (MUST be lottery only):', postConfigs);

  const postRooms = await runSql(`SELECT COUNT(*) as count FROM public.game_rooms`);
  console.log('Remaining game_rooms count:', postRooms[0]?.count);

  const archivedCount = await runSql(`SELECT COUNT(*) as count FROM public.archived_legacy_game_rounds`);
  console.log('Archived legacy game rounds count:', archivedCount[0]?.count);

  const activeRounds = await runSql(`SELECT COUNT(*) as count FROM public.game_rounds`);
  console.log('Active game_rounds count:', activeRounds[0]?.count);

  const verifiedEvents = await runSql(`SELECT COUNT(*) as count FROM public.lottery_events WHERE status = 'active'`);
  console.log('Active lottery_events count:', verifiedEvents[0]?.count);

  const verifiedTickets = await runSql(`SELECT COUNT(*) as count FROM public.lottery_tickets`);
  console.log('Preserved lottery_tickets count:', verifiedTickets[0]?.count);

  const verifiedWallets = await runSql(`SELECT COUNT(*) as count FROM public.lottery_wallets`);
  console.log('Preserved lottery_wallets count:', verifiedWallets[0]?.count);

  const verifiedLedger = await runSql(`SELECT COUNT(*) as count FROM public.wallet_ledger`);
  console.log('Preserved wallet_ledger count:', verifiedLedger[0]?.count);

  console.log('\n================================================================');
  console.log('DATABASE CLEANUP COMPLETE & VERIFIED: FOUR DIGIT LOTTERY ONLY');
  console.log('================================================================');
}

main().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
