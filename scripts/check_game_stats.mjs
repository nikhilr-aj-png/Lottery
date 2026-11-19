import { runSql } from './supabase_admin.mjs';

async function checkGameStats() {
  console.log('Querying real game activity counts...');
  const rounds = await runSql(`
    SELECT game_id, count(*) as count, count(distinct user_id) as unique_players 
    FROM game_rounds 
    GROUP BY game_id;
  `);
  console.log('Game rounds stats:', rounds);

  const lotteryTickets = await runSql(`
    SELECT count(*) as count, count(distinct user_id) as unique_players 
    FROM lottery_tickets;
  `);
  console.log('Lottery tickets stats:', lotteryTickets);
}

checkGameStats();
