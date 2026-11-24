/**
 * ============================================================================
 * GAME ROOM & TABLE MANAGER — FOUR-DIGIT LOTTERY PLATFORM (USDT ONLY)
 * ============================================================================
 * Coordinates room state for Four-Digit Lottery events.
 * All non-lottery games have been permanently removed.
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
  minStakeFC?: number;
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

export const DEFAULT_ROOMS: RoomConfig[] = [];

export class GameRoomManager {
  private rooms: RoomConfig[] = [...DEFAULT_ROOMS];
  private listeners: Array<() => void> = [];
  private initialized = false;

  constructor() {
    this.fetchRooms();
    this.initRealtime();
  }

  subscribe(listener: () => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  private notify(): void {
    this.listeners.forEach(l => {
      try { l(); } catch (e) { console.error('GameRoomManager listener error:', e); }
    });
  }

  async fetchRooms(): Promise<void> {
    try {
      const { data, error } = await supabase
        .from('game_rooms')
        .select('*')
        .eq('game_id', 'lottery')
        .order('sort_order', { ascending: true });

      if (error) {
        return;
      }

      if (data && data.length > 0) {
        this.rooms = data.map((r: Record<string, unknown>) => ({
          id: (r.id as string) || '',
          gameId: 'lottery',
          name: (r.room_name as string) || 'Lottery Arena',
          type: (r.room_type as string) || ROOM_TYPES.STANDARD,
          status: (r.status as string) || ROOM_STATUSES.ACTIVE,
          description: (r.description as string) || '',
          minStakeUSDT: Number(r.min_stake_fc || 1),
          maxStakeUSDT: Number(r.max_stake_fc || 500),
          currency: 'USDT',
          playerCapacity: Number(r.player_capacity || 1000),
          currentPlayers: Number(r.current_players || 0),
          sortOrder: Number(r.sort_order || 0),
          rulesSummary: (r.rules_summary as string) || 'Four-digit lucky draw (0000–9999)',
          metadata: (r.metadata as Record<string, unknown>) || {}
        }));
        this.initialized = true;
        this.notify();
      }
    } catch (err) {
      console.warn('GameRoomManager fetchRooms error:', err);
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
    return [...this.rooms];
  }

  getRoom(gameId?: string | null, roomId?: string | null): RoomConfig | null {
    if (!roomId) {
      return this.rooms[0] || null;
    }
    return this.rooms.find(r => r.id === roomId) || null;
  }
}

export const gameRoomManager = new GameRoomManager();
