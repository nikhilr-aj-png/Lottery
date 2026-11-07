/**
 * ============================================================================
 * GAME ROOM & TABLE MANAGER — SHARED ROOM ARCHITECTURE
 * ============================================================================
 * Coordinates multi-table, multi-room, and multi-session state across all 12 games.
 * Supports:
 *   - Offline/SSR instant default rooms
 *   - Supabase live synchronization (`public.game_rooms`)
 *   - Four-Digit Lottery dynamic room mapping from `public.lottery_events`
 */

import { supabase } from '../lib/supabase.js';

export const ROOM_STATUSES = {
  ACTIVE: 'active',
  WAITING: 'waiting',
  RUNNING: 'running',
  PAUSED: 'paused',
  COMPLETED: 'completed',
  DISABLED: 'disabled'
};

export const ROOM_TYPES = {
  CASUAL: 'casual',
  STANDARD: 'standard',
  HIGH_ROLLER: 'high_roller',
  VIP: 'vip',
  TURBO: 'turbo'
};

// Default static fallback rooms for all 12 games
export const DEFAULT_ROOMS = [
  // 1. Four-Digit Lottery (5 Independently Configured Lottery Rooms)
  {
    id: 'lottery-room-1',
    gameId: 'lottery',
    drawId: 'DRW-1001',
    name: 'Lottery Room 1: Daily Jackpot Pot',
    type: ROOM_TYPES.STANDARD,
    status: ROOM_STATUSES.ACTIVE,
    description: 'Autonomous 4-digit draw with guaranteed jackpot pot. Pick lucky digits from 0000 to 9999.',
    minStakeFC: 1,
    maxStakeFC: 50,
    playerCapacity: 500,
    currentPlayers: 24,
    drawDurationHours: 24,
    recentWinners: ['7429', '1802', '9941'],
    prizeInfo: '5,000 FC Jackpot Pool',
    sortOrder: 1
  },
  {
    id: 'lottery-room-2',
    gameId: 'lottery',
    drawId: 'DRW-1002',
    name: 'Lottery Room 2: VIP Mega Pot',
    type: ROOM_TYPES.VIP,
    status: ROOM_STATUSES.ACTIVE,
    description: 'High-stakes 4-digit draw pool with amplified Flow Coin reward allocation.',
    minStakeFC: 10,
    maxStakeFC: 500,
    playerCapacity: 200,
    currentPlayers: 12,
    drawDurationHours: 48,
    recentWinners: ['5521', '0344', '8812'],
    prizeInfo: '25,000 FC Mega Jackpot',
    sortOrder: 2
  },
  {
    id: 'lottery-room-3',
    gameId: 'lottery',
    drawId: 'DRW-1003',
    name: 'Lottery Room 3: Festive Fast-Draw',
    type: ROOM_TYPES.TURBO,
    status: ROOM_STATUSES.ACTIVE,
    description: 'Rapid cycle draw with dynamic festive prize structures and provably fair Oracle.',
    minStakeFC: 5,
    maxStakeFC: 100,
    playerCapacity: 300,
    currentPlayers: 18,
    drawDurationHours: 6,
    recentWinners: ['3391', '7209', '4410'],
    prizeInfo: '10,000 FC Dynamic Pot',
    sortOrder: 3
  },
  {
    id: 'lottery-room-4',
    gameId: 'lottery',
    drawId: 'DRW-1004',
    name: 'Lottery Room 4: High Stakes Grand Draw',
    type: ROOM_TYPES.HIGH_ROLLER,
    status: ROOM_STATUSES.ACTIVE,
    description: 'Grand jackpot pool with multi-tiered lucky winner distributions and high stake limits.',
    minStakeFC: 25,
    maxStakeFC: 1000,
    playerCapacity: 150,
    currentPlayers: 8,
    drawDurationHours: 72,
    recentWinners: ['2048', '6190', '0077'],
    prizeInfo: '50,000 FC Grand Jackpot',
    sortOrder: 4
  },
  {
    id: 'lottery-room-5',
    gameId: 'lottery',
    drawId: 'DRW-1005',
    name: 'Lottery Room 5: Midnight Lightning Draw',
    type: ROOM_TYPES.TURBO,
    status: ROOM_STATUSES.ACTIVE,
    description: 'Rapid-closing 4-digit draw with instant cryptographic Provably Fair finalization.',
    minStakeFC: 2,
    maxStakeFC: 200,
    playerCapacity: 400,
    currentPlayers: 15,
    drawDurationHours: 3,
    recentWinners: ['8192', '4096', '1337'],
    prizeInfo: '15,000 FC Lightning Pot',
    sortOrder: 5
  },

  // 2. Crash
  {
    id: 'crash-room-1',
    gameId: 'crash',
    name: 'Casual Flight Lounge',
    type: ROOM_TYPES.CASUAL,
    status: ROOM_STATUSES.ACTIVE,
    description: 'Low-limit launch pad with 1.01x auto-cashout controls. Ideal for casual runs.',
    minStakeFC: 1,
    maxStakeFC: 50,
    playerCapacity: 1000,
    currentPlayers: 42,
    recentMultipliers: ['1.45x', '2.80x', '1.12x', '3.15x'],
    rulesSummary: 'Exponential curve with 1.01x minimum cashout',
    sortOrder: 1
  },
  {
    id: 'crash-room-2',
    gameId: 'crash',
    name: 'Main Rocket Arena',
    type: ROOM_TYPES.STANDARD,
    status: ROOM_STATUSES.ACTIVE,
    description: 'Primary flight arena featuring real-time rocket curves and live multiplayer feed.',
    minStakeFC: 5,
    maxStakeFC: 250,
    playerCapacity: 2000,
    currentPlayers: 87,
    recentMultipliers: ['2.40x', '5.80x', '1.05x', '14.20x'],
    rulesSummary: 'Standard volatility launch pad with 1% house edge',
    sortOrder: 2
  },
  {
    id: 'crash-room-3',
    gameId: 'crash',
    name: 'High Rollers Orbit',
    type: ROOM_TYPES.HIGH_ROLLER,
    status: ROOM_STATUSES.ACTIVE,
    description: 'High stake flight chamber targeting extreme multipliers and high-roller payouts.',
    minStakeFC: 50,
    maxStakeFC: 1000,
    playerCapacity: 500,
    currentPlayers: 19,
    recentMultipliers: ['18.25x', '42.10x', '1.02x', '9.50x'],
    rulesSummary: 'High roller limits up to 1,000 FC with auto-cashout',
    sortOrder: 3
  },

  // 3. Dice
  {
    id: 'dice-room-1',
    gameId: 'dice',
    name: 'Classic Roller Table',
    type: ROOM_TYPES.STANDARD,
    status: ROOM_STATUSES.ACTIVE,
    description: 'Standard 100-sided die with dynamic Roll Over/Under sliders and 1% house edge.',
    minStakeFC: 1,
    maxStakeFC: 100,
    playerCapacity: 1000,
    currentPlayers: 31,
    recentRolls: ['68.42', '12.05', '91.30', '73.18'],
    rulesSummary: 'Target slider from 1.00 to 98.00 with dynamic odds',
    sortOrder: 1
  },
  {
    id: 'dice-room-2',
    gameId: 'dice',
    name: 'High Stakes Dice Arena',
    type: ROOM_TYPES.HIGH_ROLLER,
    status: ROOM_STATUSES.ACTIVE,
    description: 'High roller table with elevated bet ceilings and customizable client seeds.',
    minStakeFC: 20,
    maxStakeFC: 2000,
    playerCapacity: 500,
    currentPlayers: 14,
    recentRolls: ['84.10', '52.70', '19.95', '95.40'],
    rulesSummary: 'High stakes up to 2,000 FC with HMAC-SHA256 seed commit',
    sortOrder: 2
  },

  // 4. Mines
  {
    id: 'mines-room-1',
    gameId: 'mines',
    name: 'Standard 5x5 Minefield',
    type: ROOM_TYPES.STANDARD,
    status: ROOM_STATUSES.ACTIVE,
    description: '25-tile field with 1 to 24 configurable mines. Step-by-step gem revealing.',
    minStakeFC: 1,
    maxStakeFC: 100,
    playerCapacity: 1000,
    currentPlayers: 53,
    recentMultipliers: ['2.14x', '4.88x', '1.48x', '8.50x'],
    gridConfig: '5x5 Grid (1 to 24 Mines)',
    rulesSummary: 'Uncover gems & avoid mines. End round to lock in FC multiplier.',
    sortOrder: 1
  },
  {
    id: 'mines-room-2',
    gameId: 'mines',
    name: 'VIP Diamond Vault',
    type: ROOM_TYPES.VIP,
    status: ROOM_STATUSES.ACTIVE,
    description: 'High stakes diamond excavation with rapid cashout controls and higher limits.',
    minStakeFC: 25,
    maxStakeFC: 1000,
    playerCapacity: 500,
    currentPlayers: 22,
    recentMultipliers: ['12.40x', '28.00x', '3.80x', '100x'],
    gridConfig: '5x5 High Roller Grid',
    rulesSummary: 'Elevated FC bounds for extreme multiplier gem excavators.',
    sortOrder: 2
  },

  // 5. Plinko
  {
    id: 'plinko-room-1',
    gameId: 'plinko',
    name: 'Arcade Pegboard Hall',
    type: ROOM_TYPES.STANDARD,
    status: ROOM_STATUSES.ACTIVE,
    description: 'Configurable 8 to 16 rows pyramid with Low, Medium & High risk bounce profiles.',
    minStakeFC: 1,
    maxStakeFC: 100,
    playerCapacity: 1000,
    currentPlayers: 68,
    recentMultipliers: ['2.0x', '5.0x', '22.0x', '0.6x'],
    rowsConfig: '8, 10, 12, 14, 16 Rows',
    rulesSummary: 'Drop cascading balls through pegboard into multiplier slots.',
    sortOrder: 1
  },
  {
    id: 'plinko-room-2',
    gameId: 'plinko',
    name: 'High Multiplier Drop Zone',
    type: ROOM_TYPES.HIGH_ROLLER,
    status: ROOM_STATUSES.ACTIVE,
    description: '16-row high-volatility drop arena targeting 1000x edges on multi-ball cascades.',
    minStakeFC: 10,
    maxStakeFC: 1000,
    playerCapacity: 500,
    currentPlayers: 35,
    recentMultipliers: ['130x', '1000x', '43x', '26x'],
    rowsConfig: '16 Rows (High Volatility)',
    rulesSummary: '16 rows pyramid targeting 1,000x outer edge buckets.',
    sortOrder: 2
  },

  // 6. European Roulette
  {
    id: 'roulette-room-1',
    gameId: 'roulette',
    name: 'Monte Carlo Table',
    type: ROOM_TYPES.STANDARD,
    status: ROOM_STATUSES.ACTIVE,
    description: 'Single-zero European wheel with complete inside, outside, dozen, and column betting.',
    minStakeFC: 1,
    maxStakeFC: 200,
    playerCapacity: 100,
    currentPlayers: 27,
    recentSpins: ['17', '32', '0', '7', '24'],
    wheelConfig: 'Single Zero (0 - 36)',
    rulesSummary: 'Straight 36x, Red/Black & Even/Odd 2x, Columns/Dozens 3x.',
    sortOrder: 1
  },
  {
    id: 'roulette-room-2',
    gameId: 'roulette',
    name: 'VIP Salon Privé',
    type: ROOM_TYPES.VIP,
    status: ROOM_STATUSES.ACTIVE,
    description: 'High-limit table with exclusive French layout and private spin animation.',
    minStakeFC: 25,
    maxStakeFC: 1000,
    playerCapacity: 50,
    currentPlayers: 9,
    recentSpins: ['29', '14', '2', '36', '0'],
    wheelConfig: 'VIP French Layout (0 - 36)',
    rulesSummary: 'High-limit inside/outside betting with smooth wheel physics.',
    sortOrder: 2
  },

  // 7. Coinflip
  {
    id: 'coinflip-room-1',
    gameId: 'coinflip',
    name: 'Instant Flip 50/50',
    type: ROOM_TYPES.STANDARD,
    status: ROOM_STATUSES.ACTIVE,
    description: 'Rapid heads or tails duel with 3D coin physics and 1.98x instant payouts.',
    minStakeFC: 1,
    maxStakeFC: 100,
    playerCapacity: 1000,
    currentPlayers: 44,
    flipConfig: '50/50 Dual Face (1.98x Payout)',
    recentFlips: ['heads', 'tails', 'heads', 'heads'],
    rulesSummary: '1.98x payout on Heads or Tails with 3D coin physics and HMAC-SHA256',
    sortOrder: 1
  },
  {
    id: 'coinflip-room-2',
    gameId: 'coinflip',
    name: 'Streak Challenge Arena',
    type: ROOM_TYPES.HIGH_ROLLER,
    status: ROOM_STATUSES.ACTIVE,
    description: 'Elevated wager bounds for players chasing multi-flip win streaks.',
    minStakeFC: 20,
    maxStakeFC: 2500,
    playerCapacity: 500,
    currentPlayers: 18,
    flipConfig: 'High Roller Streak Arena',
    recentFlips: ['tails', 'heads', 'tails', 'tails'],
    rulesSummary: 'High stakes up to 2,500 FC for streak hunters',
    sortOrder: 2
  },

  // 8. Blackjack 21
  {
    id: 'blackjack-room-1',
    gameId: 'blackjack',
    name: 'Emerald 6-Deck Table',
    type: ROOM_TYPES.STANDARD,
    status: ROOM_STATUSES.ACTIVE,
    description: 'Dealer stands on soft 17, natural 3:2 blackjack payout, Hit, Stand & Double Down.',
    minStakeFC: 1,
    maxStakeFC: 100,
    playerCapacity: 7,
    currentPlayers: 5,
    deckConfig: '6-Deck Shoe (Dealer stands on 17)',
    recentOutcomes: ['Win 2.0x', 'BJ 2.5x', 'Push 1.0x', 'Win 2.0x'],
    rulesSummary: 'Blackjack pays 3:2, Double Down allowed, Dealer stands on 17',
    sortOrder: 1
  },
  {
    id: 'blackjack-room-2',
    gameId: 'blackjack',
    name: 'Diamond High Roller Table',
    type: ROOM_TYPES.VIP,
    status: ROOM_STATUSES.ACTIVE,
    description: 'VIP single-deck strategy table with premium limits and fast card deals.',
    minStakeFC: 25,
    maxStakeFC: 1000,
    playerCapacity: 7,
    currentPlayers: 3,
    deckConfig: 'VIP Single Deck (Soft 17 Stand)',
    recentOutcomes: ['BJ 2.5x', 'Win 2.0x', 'Push 1.0x', 'Win 2.0x'],
    rulesSummary: 'High roller limits up to 1,000 FC with natural 3:2 payout',
    sortOrder: 2
  },

  // 9. Golden Reels Slot
  {
    id: 'slots-room-1',
    gameId: 'slots',
    name: 'Vegas Classic 3-Reel',
    type: ROOM_TYPES.STANDARD,
    status: ROOM_STATUSES.ACTIVE,
    description: '5 active paylines, wild diamonds, and 250x triple sevens jackpot.',
    minStakeFC: 1,
    maxStakeFC: 50,
    playerCapacity: 1000,
    currentPlayers: 61,
    reelsConfig: '3 Reels · 5 Paylines · 250x Top Jackpot',
    recentPayouts: ['Diamonds 50x', 'Cherries 4x', 'Slots 15x', 'Sevens 250x'],
    rulesSummary: 'Match 3 on 5 paylines. Wild Diamonds substitute any symbol.',
    sortOrder: 1
  },
  {
    id: 'slots-room-2',
    gameId: 'slots',
    name: 'High Roller Gold Spinner',
    type: ROOM_TYPES.HIGH_ROLLER,
    status: ROOM_STATUSES.ACTIVE,
    description: 'Enhanced coin denomination reels for high volatility jackpot hunters.',
    minStakeFC: 10,
    maxStakeFC: 500,
    playerCapacity: 500,
    currentPlayers: 29,
    reelsConfig: 'High Roller 3-Reel (500 FC Max Stake)',
    recentPayouts: ['Sevens 250x', 'Diamonds 50x', 'Bells 8x', 'Slots 15x'],
    rulesSummary: 'Enhanced stakes up to 500 FC per spin with 250x jackpot',
    sortOrder: 2
  },

  // 10. Texas Hold'em Poker
  {
    id: 'poker-room-1',
    gameId: 'poker',
    name: 'Novice Table (5/10 Blinds)',
    type: ROOM_TYPES.CASUAL,
    status: ROOM_STATUSES.ACTIVE,
    description: '6-seat Hold’em simulation table. Flop, turn, and river action against AI dealers.',
    minStakeFC: 5,
    maxStakeFC: 100,
    playerCapacity: 6,
    currentPlayers: 4,
    tableConfig: '6-Max Table · Blinds 5/10 FC · Solo Demo',
    seatsAvailable: 2,
    recentHands: ['Two Pair 2.0x', 'Flush 3.5x', 'Trips 2.5x', 'Straight 2.5x'],
    rulesSummary: 'Texas Hold’em heads-up demo against dealer with Flop, Turn, River & Showdown',
    sortOrder: 1
  },
  {
    id: 'poker-room-2',
    gameId: 'poker',
    name: 'Champions Table (25/50 Blinds)',
    type: ROOM_TYPES.HIGH_ROLLER,
    status: ROOM_STATUSES.ACTIVE,
    description: 'Competitive Hold’em showdown with aggressive AI table positioning and deep stacks.',
    minStakeFC: 25,
    maxStakeFC: 1000,
    playerCapacity: 6,
    currentPlayers: 5,
    tableConfig: '6-Max VIP Table · Blinds 25/50 FC · Solo Demo',
    seatsAvailable: 1,
    recentHands: ['Full House 4.0x', 'Flush 3.5x', 'Two Pair 2.0x', 'Quads 10.0x'],
    rulesSummary: 'High stakes Hold’em table with elevated blinds and deep stack play',
    sortOrder: 2
  },

  // 11. Classic Keno
  {
    id: 'keno-room-1',
    gameId: 'keno',
    name: 'Quick Draw 40-Ball Room',
    type: ROOM_TYPES.STANDARD,
    status: ROOM_STATUSES.ACTIVE,
    description: 'Pick 1 to 10 numbers from a 40-ball board. 10 rapid balls drawn each round.',
    minStakeFC: 1,
    maxStakeFC: 100,
    playerCapacity: 1000,
    currentPlayers: 39,
    gridConfig: '40-Ball Board · Pick 1 to 10 Numbers',
    recentDraws: ['4/5 Hits 18x', '3/4 Hits 8x', '5/6 Hits 45x', '2/3 Hits 3x'],
    rulesSummary: 'Pick up to 10 balls. 10 balls drawn. Match numbers to climb paytable.',
    sortOrder: 1
  },
  {
    id: 'keno-room-2',
    gameId: 'keno',
    name: 'Golden Keno Jackpot Hall',
    type: ROOM_TYPES.VIP,
    status: ROOM_STATUSES.ACTIVE,
    description: 'Enhanced payout ladder for master pickers targeting 500x multi-hit jackpots.',
    minStakeFC: 10,
    maxStakeFC: 500,
    playerCapacity: 500,
    currentPlayers: 16,
    gridConfig: 'High Roller 40-Ball · 500x Max Multiplier',
    recentDraws: ['6/8 Hits 85x', '5/7 Hits 40x', '7/10 Hits 180x', '4/4 Hits 35x'],
    rulesSummary: 'Enhanced payout ladder for master pickers targeting 500x multi-hit jackpots.',
    sortOrder: 2
  },

  // 12. Limbo
  {
    id: 'limbo-room-1',
    gameId: 'limbo',
    name: 'Standard Multiplier Lab',
    type: ROOM_TYPES.STANDARD,
    status: ROOM_STATUSES.ACTIVE,
    description: 'Target multipliers from 1.01x up to 100x with dynamic probability display.',
    minStakeFC: 1,
    maxStakeFC: 100,
    playerCapacity: 1000,
    currentPlayers: 47,
    targetRange: '1.01x to 100x Target Multiplier',
    recentMultipliers: ['4.82x', '12.40x', '2.10x', '67.50x'],
    rulesSummary: 'Predict if rocket reaches or exceeds target multiplier.',
    sortOrder: 1
  },
  {
    id: 'limbo-room-2',
    gameId: 'limbo',
    name: '10,000x Astronomical Arena',
    type: ROOM_TYPES.HIGH_ROLLER,
    status: ROOM_STATUSES.ACTIVE,
    description: 'High roller stage designed for astronomical multiplier hunting up to 10,000x.',
    minStakeFC: 10,
    maxStakeFC: 1000,
    playerCapacity: 500,
    currentPlayers: 23,
    targetRange: '1.01x to 10,000x Astronomical Target',
    recentMultipliers: ['342x', '1250x', '1.05x', '88.40x'],
    rulesSummary: 'Astronomical targets up to 10,000x with real-time win probability.',
    sortOrder: 2
  }
];

class GameRoomManager {
  constructor() {
    this.rooms = [...DEFAULT_ROOMS];
    this.listeners = new Set();
    this.initialized = false;
  }

  // Subscribe to room updates
  subscribe(callback) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  notify() {
    this.listeners.forEach(fn => fn(this.rooms));
  }

  // Fetch rooms from Supabase public.game_rooms
  async fetchRooms() {
    try {
      const { data, error } = await supabase
        .from('game_rooms')
        .select('*')
        .order('sort_order', { ascending: true });

      if (!error && Array.isArray(data) && data.length > 0) {
        // Merge Supabase rooms with local defaults
        const dbRooms = data.map(r => ({
          id: r.id,
          gameId: r.game_id,
          name: r.room_name,
          type: r.room_type || ROOM_TYPES.STANDARD,
          status: r.status || ROOM_STATUSES.ACTIVE,
          description: r.description,
          minStakeFC: Number(r.min_stake_fc || 1),
          maxStakeFC: Number(r.max_stake_fc || 1000),
          playerCapacity: Number(r.player_capacity || 100),
          currentPlayers: Number(r.current_players || 0),
          sortOrder: Number(r.sort_order || 0),
          metadata: r.metadata || {}
        }));

        this.rooms = dbRooms;
        this.initialized = true;
        this.notify();
      }
    } catch (err) {
      console.warn('GameRoomManager fetchRooms fallback to defaults:', err);
    }
  }

  // Get all rooms for a specific game
  getRoomsForGame(gameId) {
    if (!gameId) return [];
    const normalized = gameId.toLowerCase();
    return this.rooms.filter(r => 
      r.gameId.toLowerCase() === normalized || 
      (normalized === 'four-digit-lottery' && r.gameId === 'lottery') ||
      (normalized === 'european-roulette' && r.gameId === 'roulette') ||
      (normalized === 'blackjack-21' && r.gameId === 'blackjack') ||
      (normalized === 'golden-reels-slot' && r.gameId === 'slots') ||
      (normalized === 'texas-holdem-poker' && r.gameId === 'poker') ||
      (normalized === 'classic-keno' && r.gameId === 'keno')
    );
  }

  // Get a specific room by gameId and roomId
  getRoom(gameId, roomId) {
    if (!roomId) {
      const rooms = this.getRoomsForGame(gameId);
      return rooms[0] || null;
    }
    return this.rooms.find(r => r.id === roomId) || null;
  }
}

export const gameRoomManager = new GameRoomManager();

