/**
 * ============================================================================
 * GAME HISTORY STORE — LIVE BETS FEED, PERSONAL HISTORY & STATISTICS
 * ============================================================================
 * Manages queries, real-time sync, and statistical aggregators for game rounds.
 */

import { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { GameId } from '../types/games';

export interface FormattedBet {
  id: string;
  gameId: GameId | string;
  roomId: string;
  walletAddress: string;
  username: string;
  betAmount: number;
  multiplier: number;
  payout: number;
  netProfit?: number;
  status: string;
  createdAt: number;
  serverSeedHash?: string;
  serverSeed?: string;
  clientSeed?: string;
  nonce?: number;
  outcomeData?: unknown;
}

export interface GameHistoryState {
  allBets: FormattedBet[];
  myBets: FormattedBet[];
  highRollers: FormattedBet[];
}

export interface GameStats {
  totalRounds: number;
  totalWagered: number;
  totalPayout: number;
  wins: number;
  losses: number;
  winRate: number;
}

export class GameHistoryStore {
  allBets: FormattedBet[] = [];
  myBets: FormattedBet[] = [];
  highRollers: FormattedBet[] = [];
  subscribers: Set<(state: GameHistoryState) => void> = new Set();
  realtimeChannel: RealtimeChannel | null = null;

  subscribe(callback: (state: GameHistoryState) => void): () => void {
    this.subscribers.add(callback);
    return () => {
      this.subscribers.delete(callback);
    };
  }

  notify(): void {
    this.subscribers.forEach(fn => fn({
      allBets: this.allBets,
      myBets: this.myBets,
      highRollers: this.highRollers
    }));
  }

  // Initialize Realtime Supabase Channel
  initRealtime(): void {
    if (this.realtimeChannel) return;

    this.realtimeChannel = supabase
      .channel('realtime:game_rounds_feed')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'game_rounds' }, (payload: { new: Record<string, unknown> }) => {
        if (payload.new) {
          this.handleIncomingBet(payload.new);
        }
      })
      .subscribe();
  }

  cleanupRealtime(): void {
    if (this.realtimeChannel) {
      supabase.removeChannel(this.realtimeChannel);
      this.realtimeChannel = null;
    }
  }

  handleIncomingBet(bet: Record<string, unknown>): void {
    const walletAddress = String(bet.wallet_address || '');
    const formatted: FormattedBet = {
      id: String(bet.id || ''),
      gameId: String(bet.game_id || ''),
      roomId: String(bet.room_id || (bet.metadata as Record<string, unknown>)?.roomId || 'standard'),
      walletAddress,
      username: String(bet.username || `@User_${walletAddress.slice(-4)}`),
      betAmount: Number(bet.bet_amount || 0),
      multiplier: Number(bet.multiplier || 0),
      payout: Number(bet.payout || 0),
      netProfit: Number(bet.net_profit ?? (Number(bet.payout || 0) - Number(bet.bet_amount || 0))),
      status: String(bet.status || ''),
      createdAt: bet.created_at ? new Date(String(bet.created_at)).getTime() : Date.now(),
      serverSeedHash: bet.server_seed_hash as string | undefined,
      serverSeed: bet.server_seed as string | undefined,
      clientSeed: bet.client_seed as string | undefined,
      nonce: typeof bet.nonce === 'number' ? bet.nonce : undefined,
      outcomeData: bet.outcome_data
    };

    // Prepend to all bets
    this.allBets = [formatted, ...this.allBets.slice(0, 49)];

    // If high roller (payout >= 50 FC)
    if (formatted.payout >= 50) {
      this.highRollers = [formatted, ...this.highRollers.slice(0, 19)];
    }

    this.notify();
  }

  // Fetch recent platform-wide bets
  async fetchAllBets(limit = 50): Promise<FormattedBet[]> {
    try {
      const { data, error } = await supabase
        .from('game_rounds')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (!error && Array.isArray(data)) {
        this.allBets = data.map((b: Record<string, unknown>) => {
          const walletAddress = String(b.wallet_address || '');
          return {
            id: String(b.id || ''),
            gameId: String(b.game_id || ''),
            roomId: String(b.room_id || (b.metadata as Record<string, unknown>)?.roomId || 'standard'),
            walletAddress,
            username: String(b.username || `@Player_${walletAddress.slice(-4)}`),
            betAmount: Number(b.bet_amount || 0),
            multiplier: Number(b.multiplier || 0),
            payout: Number(b.payout || 0),
            netProfit: Number(b.net_profit ?? (Number(b.payout || 0) - Number(b.bet_amount || 0))),
            status: String(b.status || ''),
            createdAt: b.created_at ? new Date(String(b.created_at)).getTime() : Date.now(),
            serverSeedHash: b.server_seed_hash as string | undefined,
            serverSeed: b.server_seed as string | undefined,
            clientSeed: b.client_seed as string | undefined,
            nonce: typeof b.nonce === 'number' ? b.nonce : undefined,
            outcomeData: b.outcome_data
          };
        });
        this.notify();
      }
      return this.allBets;
    } catch (err) {
      console.error('fetchAllBets error:', err);
      return [];
    }
  }

  // Fetch bets specifically for a game
  async fetchGameBets(gameId: string, limit = 50): Promise<FormattedBet[]> {
    if (!gameId) return [];
    try {
      const { data, error } = await supabase
        .from('game_rounds')
        .select('*')
        .eq('game_id', gameId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (!error && Array.isArray(data)) {
        return data.map((b: Record<string, unknown>) => {
          const walletAddress = String(b.wallet_address || '');
          return {
            id: String(b.id || ''),
            gameId: String(b.game_id || ''),
            roomId: String(b.room_id || (b.metadata as Record<string, unknown>)?.roomId || 'standard'),
            walletAddress,
            username: String(b.username || `@Player_${walletAddress.slice(-4)}`),
            betAmount: Number(b.bet_amount || 0),
            multiplier: Number(b.multiplier || 0),
            payout: Number(b.payout || 0),
            netProfit: Number(b.net_profit ?? (Number(b.payout || 0) - Number(b.bet_amount || 0))),
            status: String(b.status || ''),
            createdAt: b.created_at ? new Date(String(b.created_at)).getTime() : Date.now(),
            serverSeedHash: b.server_seed_hash as string | undefined,
            serverSeed: b.server_seed as string | undefined,
            clientSeed: b.client_seed as string | undefined,
            nonce: typeof b.nonce === 'number' ? b.nonce : undefined,
            outcomeData: b.outcome_data
          };
        });
      }
      return [];
    } catch (err) {
      console.error('fetchGameBets error:', err);
      return [];
    }
  }

  // Fetch bets specifically for a room
  async fetchRoomBets(roomId: string, limit = 50): Promise<FormattedBet[]> {
    if (!roomId) return [];
    try {
      const { data, error } = await supabase
        .from('game_rounds')
        .select('*')
        .eq('room_id', roomId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (!error && Array.isArray(data)) {
        return data.map((b: Record<string, unknown>) => {
          const walletAddress = String(b.wallet_address || '');
          return {
            id: String(b.id || ''),
            gameId: String(b.game_id || ''),
            roomId: String(b.room_id || (b.metadata as Record<string, unknown>)?.roomId || 'standard'),
            walletAddress,
            username: String(b.username || `@Player_${walletAddress.slice(-4)}`),
            betAmount: Number(b.bet_amount || 0),
            multiplier: Number(b.multiplier || 0),
            payout: Number(b.payout || 0),
            netProfit: Number(b.net_profit ?? (Number(b.payout || 0) - Number(b.bet_amount || 0))),
            status: String(b.status || ''),
            createdAt: b.created_at ? new Date(String(b.created_at)).getTime() : Date.now(),
            serverSeedHash: b.server_seed_hash as string | undefined,
            serverSeed: b.server_seed as string | undefined,
            clientSeed: b.client_seed as string | undefined,
            nonce: typeof b.nonce === 'number' ? b.nonce : undefined,
            outcomeData: b.outcome_data
          };
        });
      }
      return [];
    } catch (err) {
      console.error('fetchRoomBets error:', err);
      return [];
    }
  }

  // Fetch bets for active wallet
  async fetchMyBets(walletAddress: string, limit = 50): Promise<FormattedBet[]> {
    if (!walletAddress) return [];
    try {
      const { data, error } = await supabase
        .from('game_rounds')
        .select('*')
        .eq('wallet_address', walletAddress)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (!error && Array.isArray(data)) {
        this.myBets = data.map((b: Record<string, unknown>) => {
          return {
            id: String(b.id || ''),
            gameId: String(b.game_id || ''),
            roomId: String(b.room_id || (b.metadata as Record<string, unknown>)?.roomId || 'standard'),
            walletAddress: String(b.wallet_address || ''),
            username: String(b.username || 'You'),
            betAmount: Number(b.bet_amount || 0),
            multiplier: Number(b.multiplier || 0),
            payout: Number(b.payout || 0),
            netProfit: Number(b.net_profit ?? (Number(b.payout || 0) - Number(b.bet_amount || 0))),
            status: String(b.status || ''),
            createdAt: b.created_at ? new Date(String(b.created_at)).getTime() : Date.now(),
            serverSeedHash: b.server_seed_hash as string | undefined,
            serverSeed: b.server_seed as string | undefined,
            clientSeed: b.client_seed as string | undefined,
            nonce: typeof b.nonce === 'number' ? b.nonce : undefined,
            outcomeData: b.outcome_data
          };
        });
        this.notify();
      }
      return this.myBets;
    } catch (err) {
      console.error('fetchMyBets error:', err);
      return [];
    }
  }

  // Fetch high roller bets (payout >= 50 FC)
  async fetchHighRollers(limit = 20): Promise<FormattedBet[]> {
    try {
      const { data, error } = await supabase
        .from('game_rounds')
        .select('*')
        .gte('payout', 50)
        .order('payout', { ascending: false })
        .limit(limit);

      if (!error && Array.isArray(data)) {
        this.highRollers = data.map((b: Record<string, unknown>) => {
          const walletAddress = String(b.wallet_address || '');
          return {
            id: String(b.id || ''),
            gameId: String(b.game_id || ''),
            roomId: 'high-rollers',
            walletAddress,
            username: String(b.username || `@VIP_${walletAddress.slice(-4)}`),
            betAmount: Number(b.bet_amount || 0),
            multiplier: Number(b.multiplier || 0),
            payout: Number(b.payout || 0),
            status: String(b.status || ''),
            createdAt: b.created_at ? new Date(String(b.created_at)).getTime() : Date.now()
          };
        });
        this.notify();
      }
      return this.highRollers;
    } catch (err) {
      console.error('fetchHighRollers error:', err);
      return [];
    }
  }

  // Aggregated Game Statistics
  async fetchGameStats(gameId: string): Promise<GameStats> {
    try {
      const { data, error } = await supabase
        .from('game_rounds')
        .select('bet_amount, payout, status')
        .eq('game_id', gameId);

      if (error || !Array.isArray(data)) {
        return { totalRounds: 0, totalWagered: 0, totalPayout: 0, wins: 0, losses: 0, winRate: 0 };
      }

      const totalRounds = data.length;
      let totalWagered = 0;
      let totalPayout = 0;
      let wins = 0;

      for (const r of data) {
        totalWagered += Number(r.bet_amount || 0);
        totalPayout += Number(r.payout || 0);
        if (Number(r.payout || 0) > 0) wins++;
      }

      return {
        totalRounds,
        totalWagered: parseFloat(totalWagered.toFixed(2)),
        totalPayout: parseFloat(totalPayout.toFixed(2)),
        wins,
        losses: totalRounds - wins,
        winRate: totalRounds > 0 ? parseFloat(((wins / totalRounds) * 100).toFixed(1)) : 0
      };
    } catch (err) {
      console.error('fetchGameStats error:', err);
      return { totalRounds: 0, totalWagered: 0, totalPayout: 0, wins: 0, losses: 0, winRate: 0 };
    }
  }
}

// Global Singleton Instance
export const gameHistoryStore = new GameHistoryStore();

