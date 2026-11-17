/**
 * ============================================================================
 * GAME ROOM & TABLE MANAGER — SHARED ROOM ARCHITECTURE
 * ============================================================================
 * Coordinates multi-table, multi-room, and multi-session state across all modular games.
 * Supports:
 *   - Clean default rooms without simulated/dummy winners or fake player counts
 *   - Supabase live synchronization (`public.game_rooms`)
 *   - Four-Digit Lottery dynamic room mapping from `public.lottery_events`
 */

import { supabase } from '../lib/supabase';

export const ROOM_STATUSES = {
  ACTIVE: 'active',
  WAITING: 'waiting',
  RUNNING: 'running',
  PAUSED: 'paused',
  COMPLETED: 'completed',
  DISABLED: 'disabled'
} as const;

export const ROOM_TYPES = {
  CASUAL: 'casual',
  STANDARD: 'standard',
  HIGH_ROLLER: 'high_roller',
  VIP: 'vip',
  TURBO: 'turbo'
} as const;

export interface RoomConfig {
  id: string;
  gameId: string;
  drawId?: string;
  name: string;
  type: string;
  status: string;
  description: string;
  minStakeFC: number;
  maxStakeFC: number;
  playerCapacity: number;
  currentPlayers: number;
  drawDurationHours?: number;
  recentWinners?: string[];
  prizeInfo?: string;
  sortOrder?: number;
  targetRange?: string;
  recentMultipliers?: string[];
  rulesSummary?: string;
  metadata?: Record<string, unknown>;
  [key: string]: unknown;
}

// Default rooms for modular casino games (Zero fake players or simulated rolls)
export const DEFAULT_ROOMS: RoomConfig[] = [
  // 1. Crash
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
    currentPlayers: 0,
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
    currentPlayers: 0,
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
    currentPlayers: 0,
    rulesSummary: 'High roller limits up to 1,000 FC with auto-cashout',
    sortOrder: 3
  },

  // 2. Dice
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
    currentPlayers: 0,
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
    currentPlayers: 0,
    rulesSummary: 'High stakes up to 2,000 FC with HMAC-SHA256 seed commit',
    sortOrder: 2
  },

  // 3. Bingo – Color Trading
  {
    id: 'bingo-room-1',
    gameId: 'bingo',
    name: 'Fast 1-Min Color Arena',
    type: ROOM_TYPES.STANDARD,
    status: ROOM_STATUSES.ACTIVE,
    description: 'Rapid 60-second color trading draws for Red, Green, Violet and Numbers 0-9.',
    minStakeFC: 1,
    maxStakeFC: 100,
    playerCapacity: 1000,
    currentPlayers: 0,
    rulesSummary: 'Red/Green 2x, Violet 4.5x, Single Number 9x, Big/Small 1.98x',
    sortOrder: 1
  },
  {
    id: 'bingo-room-2',
    gameId: 'bingo',
    name: 'VIP High Stakes Color Arena',
    type: ROOM_TYPES.VIP,
    status: ROOM_STATUSES.ACTIVE,
    description: 'High ceiling color prediction with elevated limits up to 1,000 Flow Coins.',
    minStakeFC: 20,
    maxStakeFC: 1000,
    playerCapacity: 500,
    currentPlayers: 0,
    rulesSummary: 'Elevated bounds up to 1,000 FC with HMAC-SHA256 seed commit',
    sortOrder: 2
  },

  // 4. Horse Racing
  {
    id: 'horse-racing-room-1',
    gameId: 'horse-racing',
    name: 'Derby Club Track',
    type: ROOM_TYPES.STANDARD,
    status: ROOM_STATUSES.ACTIVE,
    description: 'Standard 6-horse sprint with Win & Place bets on live virtual turf.',
    minStakeFC: 1,
    maxStakeFC: 100,
    playerCapacity: 1000,
    currentPlayers: 0,
    rulesSummary: '6-runner sprint with fixed odds from 2.4x to 35.0x',
    sortOrder: 1
  },
  {
    id: 'horse-racing-room-2',
    gameId: 'horse-racing',
    name: 'Royal Ascot Grandstand',
    type: ROOM_TYPES.HIGH_ROLLER,
    status: ROOM_STATUSES.ACTIVE,
    description: 'High roller championship turf with bets up to 1,000 Flow Coins.',
    minStakeFC: 25,
    maxStakeFC: 1000,
    playerCapacity: 500,
    currentPlayers: 0,
    rulesSummary: 'Championship turf with elevated limits and Provably Fair audit',
    sortOrder: 2
  },

  // 5. European Roulette
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
    currentPlayers: 0,
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
    currentPlayers: 0,
    wheelConfig: 'VIP French Layout (0 - 36)',
    rulesSummary: 'High-limit inside/outside betting with smooth wheel physics.',
    sortOrder: 2
  },

  // 6. Coinflip
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
    currentPlayers: 0,
    flipConfig: '50/50 Dual Face (1.98x Payout)',
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
    currentPlayers: 0,
    flipConfig: 'High Roller Streak Arena',
    rulesSummary: 'High stakes up to 2,500 FC for streak hunters',
    sortOrder: 2
  },

  // 7. Blackjack 21
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
    currentPlayers: 0,
    deckConfig: '6-Deck Shoe (Dealer stands on 17)',
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
    currentPlayers: 0,
    deckConfig: 'VIP Single Deck (Soft 17 Stand)',
    rulesSummary: 'High roller limits up to 1,000 FC with natural 3:2 payout',
    sortOrder: 2
  },

  // 8. Golden Reels Slot
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
    currentPlayers: 0,
    reelsConfig: '3 Reels · 5 Paylines · 250x Top Jackpot',
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
    currentPlayers: 0,
    reelsConfig: 'High Roller 3-Reel (500 FC Max Stake)',
    rulesSummary: 'Enhanced stakes up to 500 FC per spin with 250x jackpot',
    sortOrder: 2
  },

  // 9. Texas Hold'em Poker
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
    currentPlayers: 0,
    tableConfig: '6-Max Table · Blinds 5/10 FC · Solo Demo',
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
    currentPlayers: 0,
    tableConfig: 'High Roller 6-Max · Blinds 25/50 FC',
    rulesSummary: 'High stakes deep-stack Hold’em against aggressive AI positioning',
    sortOrder: 2
  },

  // 10. Classic Keno
  {
    id: 'keno-room-1',
    gameId: 'keno',
    name: 'Quick Draw 40-Ball Room',
    type: ROOM_TYPES.STANDARD,
    status: ROOM_STATUSES.ACTIVE,
    description: 'Select up to 10 numbers from 1 to 40. Rapid drawing with dynamic payouts.',
    minStakeFC: 1,
    maxStakeFC: 50,
    playerCapacity: 1000,
    currentPlayers: 0,
    kenoConfig: '40-Ball Grid · 10 Picks Max · Up to 100x',
    rulesSummary: 'Pick 1-10 numbers on a 40-ball card. Up to 100x for 10/10 matches.',
    sortOrder: 1
  },
  {
    id: 'keno-room-2',
    gameId: 'keno',
    name: 'Golden Keno Jackpot Hall',
    type: ROOM_TYPES.VIP,
    status: ROOM_STATUSES.ACTIVE,
    description: 'Elevated wager bounds with up to 500x jackpot payout for perfect matches.',
    minStakeFC: 10,
    maxStakeFC: 500,
    playerCapacity: 500,
    currentPlayers: 0,
    kenoConfig: 'VIP 40-Ball Grid · 500x Top Jackpot',
    rulesSummary: 'Enhanced payout tables with top multipliers up to 500x on 10/10 hits.',
    sortOrder: 2
  },

  // 11. Limbo
  {
    id: 'limbo-room-1',
    gameId: 'limbo',
    name: 'Standard Multiplier Lab',
    type: ROOM_TYPES.STANDARD,
    status: ROOM_STATUSES.ACTIVE,
    description: 'Dynamic target slider from 1.01x to 100x with real-time win probability calculations.',
    minStakeFC: 1,
    maxStakeFC: 100,
    playerCapacity: 1000,
    currentPlayers: 0,
    targetRange: '1.01x to 100x Target Multiplier',
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
    currentPlayers: 0,
    targetRange: '1.01x to 10,000x Astronomical Target',
    rulesSummary: 'Astronomical targets up to 10,000x with real-time win probability.',
    sortOrder: 2
  }
];

export class GameRoomManager {
  rooms: RoomConfig[];
  listeners: Set<(rooms: RoomConfig[]) => void>;
  initialized: boolean;

  constructor() {
    this.rooms = [...DEFAULT_ROOMS];
    this.listeners = new Set();
    this.initialized = false;
    this.fetchRooms();
    this.initRealtime();
  }

  // Subscribe to room updates
  subscribe(callback: (rooms: RoomConfig[]) => void): () => void {
    this.listeners.add(callback);
    return () => {
      this.listeners.delete(callback);
    };
  }

  notify(): void {
    this.listeners.forEach(fn => fn(this.rooms));
  }

  // Fetch rooms from Supabase public.game_rooms
  async fetchRooms(): Promise<void> {
    try {
      const { data, error } = await supabase
        .from('game_rooms')
        .select('*')
        .order('sort_order', { ascending: true });

      if (!error && Array.isArray(data) && data.length > 0) {
        const dbRooms: RoomConfig[] = data.map((r: Record<string, unknown>) => ({
          id: String(r.id || ''),
          gameId: String(r.game_id || ''),
          name: String(r.room_name || ''),
          type: String(r.room_type || ROOM_TYPES.STANDARD),
          status: String(r.status || ROOM_STATUSES.ACTIVE),
          description: String(r.description || ''),
          minStakeFC: Number(r.min_stake_fc || 1),
          maxStakeFC: Number(r.max_stake_fc || 1000),
          playerCapacity: Number(r.player_capacity || 100),
          currentPlayers: Number(r.current_players || 0),
          sortOrder: Number(r.sort_order || 0),
          rulesSummary: (r.rules_summary as string) || '',
          metadata: (r.metadata as Record<string, unknown>) || {}
        }));

        this.rooms = dbRooms;
        this.initialized = true;
        this.notify();
      }
    } catch (err) {
      console.warn('GameRoomManager fetchRooms fallback to defaults:', err);
    }
  }

  initRealtime(): void {
    try {
      supabase
        .channel('realtime:game_rooms')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'game_rooms' }, () => {
          this.fetchRooms();
        })
        .subscribe();
    } catch (e) {}
  }

  // Get all rooms
  getAllRooms(): RoomConfig[] {
    return [...this.rooms];
  }

  // Get all rooms for a specific game
  getRoomsForGame(gameId?: string | null): RoomConfig[] {
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
  getRoom(gameId?: string | null, roomId?: string | null): RoomConfig | null {
    if (!roomId) {
      const rooms = this.getRoomsForGame(gameId);
      return rooms[0] || null;
    }
    return this.rooms.find(r => r.id === roomId) || null;
  }
}

export const gameRoomManager = new GameRoomManager();
