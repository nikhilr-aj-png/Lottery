/**
 * ============================================================================
 * GAME ROOM & TABLE MANAGER — SHARED ROOM ARCHITECTURE (USDT ONLY)
 * ============================================================================
 * Coordinates multi-table, multi-room, and multi-session state across active games on EarnFlow.in.
 * Active games: Crash, Dice, Bingo – Color Trading, Horse Racing, Coinflip.
 * (Four-Digit Lottery rooms are dynamic and driven by Supabase public.lottery_events)
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

export type RoomStatus = typeof ROOM_STATUSES[keyof typeof ROOM_STATUSES];
export type RoomType = typeof ROOM_TYPES[keyof typeof ROOM_TYPES];

export interface RoomConfig {
  id: string;
  gameId: string;
  drawId?: string;
  name: string;
  type: string;
  status: string;
  description: string;
  minStakeUSDT?: number;
  maxStakeUSDT?: number;
  minStakeFC?: number; // backwards compatibility alias
  maxStakeFC?: number;
  currency?: string;
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

// Default rooms for active modular games (USDT Only, Zero fake players)
export const DEFAULT_ROOMS: RoomConfig[] = [
  // 1. Crash
  {
    id: 'crash-room-1',
    gameId: 'crash',
    name: 'Casual Flight Lounge',
    type: ROOM_TYPES.CASUAL,
    status: ROOM_STATUSES.ACTIVE,
    description: 'Low-limit launch pad with 1.01x auto-cashout controls. Ideal for casual runs in USDT.',
    minStakeUSDT: 1,
    maxStakeUSDT: 50,
    minStakeFC: 1,
    maxStakeFC: 50,
    currency: 'USDT',
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
    minStakeUSDT: 5,
    maxStakeUSDT: 250,
    minStakeFC: 5,
    maxStakeFC: 250,
    currency: 'USDT',
    playerCapacity: 2000,
    currentPlayers: 0,
    rulesSummary: 'Standard volatility launch pad with 1% house edge in USDT',
    sortOrder: 2
  },
  {
    id: 'crash-room-3',
    gameId: 'crash',
    name: 'High Rollers Orbit',
    type: ROOM_TYPES.HIGH_ROLLER,
    status: ROOM_STATUSES.ACTIVE,
    description: 'High stake flight chamber targeting extreme multipliers and high-roller payouts in USDT.',
    minStakeUSDT: 50,
    maxStakeUSDT: 1000,
    minStakeFC: 50,
    maxStakeFC: 1000,
    currency: 'USDT',
    playerCapacity: 500,
    currentPlayers: 0,
    rulesSummary: 'High roller limits up to 1,000 USDT with auto-cashout',
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
    minStakeUSDT: 1,
    maxStakeUSDT: 100,
    minStakeFC: 1,
    maxStakeFC: 100,
    currency: 'USDT',
    playerCapacity: 1000,
    currentPlayers: 0,
    rulesSummary: 'Target slider from 1.00 to 98.00 with dynamic USDT odds',
    sortOrder: 1
  },
  {
    id: 'dice-room-2',
    gameId: 'dice',
    name: 'High Stakes Dice Arena',
    type: ROOM_TYPES.HIGH_ROLLER,
    status: ROOM_STATUSES.ACTIVE,
    description: 'High roller table with elevated bet ceilings and customizable client seeds in USDT.',
    minStakeUSDT: 20,
    maxStakeUSDT: 2000,
    minStakeFC: 20,
    maxStakeFC: 2000,
    currency: 'USDT',
    playerCapacity: 500,
    currentPlayers: 0,
    rulesSummary: 'High stakes up to 2,000 USDT with HMAC-SHA256 seed commit',
    sortOrder: 2
  },

  // 3. Bingo – Color Trading
  {
    id: 'bingo-room-1',
    gameId: 'bingo',
    name: 'Fast 1-Min Color Arena',
    type: ROOM_TYPES.STANDARD,
    status: ROOM_STATUSES.ACTIVE,
    description: 'Rapid 60-second color trading draws for Red, Green, Violet and Numbers 0-9 in USDT.',
    minStakeUSDT: 1,
    maxStakeUSDT: 100,
    minStakeFC: 1,
    maxStakeFC: 100,
    currency: 'USDT',
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
    description: 'High ceiling color prediction with elevated limits up to 1,000 USDT.',
    minStakeUSDT: 20,
    maxStakeUSDT: 1000,
    minStakeFC: 20,
    maxStakeFC: 1000,
    currency: 'USDT',
    playerCapacity: 500,
    currentPlayers: 0,
    rulesSummary: 'Elevated bounds up to 1,000 USDT with HMAC-SHA256 seed commit',
    sortOrder: 2
  },

  // 4. Horse Racing
  {
    id: 'horse-racing-room-1',
    gameId: 'horse-racing',
    name: 'Derby Club Track',
    type: ROOM_TYPES.STANDARD,
    status: ROOM_STATUSES.ACTIVE,
    description: 'Standard 6-horse sprint with Win & Place bets on live virtual turf in USDT.',
    minStakeUSDT: 1,
    maxStakeUSDT: 100,
    minStakeFC: 1,
    maxStakeFC: 100,
    currency: 'USDT',
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
    description: 'High roller championship turf with bets up to 1,000 USDT.',
    minStakeUSDT: 25,
    maxStakeUSDT: 1000,
    minStakeFC: 25,
    maxStakeFC: 1000,
    currency: 'USDT',
    playerCapacity: 500,
    currentPlayers: 0,
    rulesSummary: 'Championship turf with elevated limits and Provably Fair audit in USDT',
    sortOrder: 2
  },

  // 5. Coinflip
  {
    id: 'coinflip-room-1',
    gameId: 'coinflip',
    name: 'Instant Flip 50/50',
    type: ROOM_TYPES.STANDARD,
    status: ROOM_STATUSES.ACTIVE,
    description: 'Rapid heads or tails duel with 3D coin physics and 1.98x instant USDT payouts.',
    minStakeUSDT: 1,
    maxStakeUSDT: 100,
    minStakeFC: 1,
    maxStakeFC: 100,
    currency: 'USDT',
    playerCapacity: 1000,
    currentPlayers: 0,
    rulesSummary: '1.98x payout on Heads or Tails with 3D coin physics and HMAC-SHA256',
    sortOrder: 1
  },
  {
    id: 'coinflip-room-2',
    gameId: 'coinflip',
    name: 'Streak Challenge Arena',
    type: ROOM_TYPES.HIGH_ROLLER,
    status: ROOM_STATUSES.ACTIVE,
    description: 'Elevated wager bounds for players chasing multi-flip win streaks in USDT.',
    minStakeUSDT: 20,
    maxStakeUSDT: 2500,
    minStakeFC: 20,
    maxStakeFC: 2500,
    currency: 'USDT',
    playerCapacity: 500,
    currentPlayers: 0,
    rulesSummary: 'High stakes up to 2,500 USDT for streak hunters',
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

  subscribe(callback: (rooms: RoomConfig[]) => void): () => void {
    this.listeners.add(callback);
    return () => {
      this.listeners.delete(callback);
    };
  }

  notify(): void {
    this.listeners.forEach(fn => fn(this.rooms));
  }

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
          name: String(r.room_name || r.name || ''),
          type: (r.room_type as RoomType) || (r.type as RoomType) || ROOM_TYPES.STANDARD,
          status: (r.status as RoomStatus) || ROOM_STATUSES.ACTIVE,
          description: String(r.description || ''),
          minStakeUSDT: Number(r.min_stake_fc || 1),
          maxStakeUSDT: Number(r.max_stake_fc || 1000),
          minStakeFC: Number(r.min_stake_fc || 1),
          maxStakeFC: Number(r.max_stake_fc || 1000),
          currency: 'USDT',
          playerCapacity: Number(r.player_capacity || 100),
          currentPlayers: Number(r.current_players || 0),
          sortOrder: Number(r.sort_order || 0),
          rulesSummary: (r.rules_summary as string) || '',
          metadata: (r.metadata as Record<string, unknown>) || {}
        }));

        const merged = DEFAULT_ROOMS.map(def => {
          const remote = dbRooms.find(r => r.id === def.id);
          if (!remote) return def;
          return {
            ...def,
            name: remote.name || def.name,
            minStakeUSDT: remote.minStakeUSDT || def.minStakeUSDT,
            maxStakeUSDT: remote.maxStakeUSDT || def.maxStakeUSDT,
            minStakeFC: remote.minStakeFC || def.minStakeFC,
            maxStakeFC: remote.maxStakeFC || def.maxStakeFC,
            playerCapacity: remote.playerCapacity || def.playerCapacity,
            currentPlayers: remote.currentPlayers !== undefined ? remote.currentPlayers : 0,
            status: remote.status || def.status,
            rulesSummary: remote.rulesSummary || def.rulesSummary
          };
        });

        const newDbRooms = dbRooms.filter(r => !DEFAULT_ROOMS.some(def => def.id === r.id));
        this.rooms = [...merged, ...newDbRooms];
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

  getAllRooms(): RoomConfig[] {
    return [...this.rooms];
  }

  getRoomsForGame(gameId?: string | null): RoomConfig[] {
    if (!gameId) return [];
    const normalized = gameId.toLowerCase();
    return this.rooms.filter(r => 
      r.gameId.toLowerCase() === normalized || 
      (normalized === 'four-digit-lottery' && r.gameId === 'lottery')
    );
  }

  getRoom(gameId?: string | null, roomId?: string | null): RoomConfig | null {
    if (!roomId) {
      const rooms = this.getRoomsForGame(gameId);
      return rooms[0] || null;
    }
    return this.rooms.find(r => r.id === roomId) || null;
  }
}

export const gameRoomManager = new GameRoomManager();
