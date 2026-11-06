/**
 * ============================================================================
 * GAME HISTORY STORE — LIVE BETS FEED, PERSONAL HISTORY & STATISTICS
 * ============================================================================
 * Manages queries, real-time sync, and statistical aggregators for game rounds.
 */

import { supabase } from '../lib/supabase.js';

export class GameHistoryStore {
  constructor() {
    this.allBets = [];
    this.myBets = [];
    this.highRollers = [];
    this.subscribers = new Set();
    this.realtimeChannel = null;
  }

  subscribe(callback) {
    this.subscribers.add(callback);
    return () => this.subscribers.delete(callback);
  }

  notify() {
    this.subscribers.forEach(fn => fn({
      allBets: this.allBets,
      myBets: this.myBets,
      highRollers: this.highRollers
    }));
  }

  // Initialize Realtime Supabase Channel
  initRealtime() {
    if (this.realtimeChannel) return;

    this.realtimeChannel = supabase
      .channel('realtime:game_rounds_feed')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'game_rounds' }, (payload) => {
        if (payload.new) {
          this.handleIncomingBet(payload.new);
        }
      })
      .subscribe();
  }

  cleanupRealtime() {
    if (this.realtimeChannel) {
      supabase.removeChannel(this.realtimeChannel);
      this.realtimeChannel = null;
    }
  }

  handleIncomingBet(bet) {
    const formatted = {
      id: bet.id,
      gameId: bet.game_id,
      walletAddress: bet.wallet_address,
      username: bet.username || `@User_${bet.wallet_address.slice(-4)}`,
      betAmount: Number(bet.bet_amount || 0),
      multiplier: Number(bet.multiplier || 0),
      payout: Number(bet.payout || 0),
      status: bet.status,
      createdAt: bet.created_at ? new Date(bet.created_at).getTime() : Date.now()
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
  async fetchAllBets(limit = 50) {
    try {
      const { data, error } = await supabase
        .from('game_rounds')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (!error && Array.isArray(data)) {
        this.allBets = data.map(b => ({
          id: b.id,
          gameId: b.game_id,
          walletAddress: b.wallet_address,
          username: b.username || `@Player_${b.wallet_address.slice(-4)}`,
          betAmount: Number(b.bet_amount || 0),
          multiplier: Number(b.multiplier || 0),
          payout: Number(b.payout || 0),
          status: b.status,
          createdAt: b.created_at ? new Date(b.created_at).getTime() : Date.now()
        }));
        this.notify();
      }
      return this.allBets;
    } catch (err) {
      console.error('fetchAllBets error:', err);
      return [];
    }
  }

  // Fetch bets for active wallet
  async fetchMyBets(walletAddress, limit = 50) {
    if (!walletAddress) return [];
    try {
      const { data, error } = await supabase
        .from('game_rounds')
        .select('*')
        .eq('wallet_address', walletAddress)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (!error && Array.isArray(data)) {
        this.myBets = data.map(b => ({
          id: b.id,
          gameId: b.game_id,
          walletAddress: b.wallet_address,
          username: b.username || 'You',
          betAmount: Number(b.bet_amount || 0),
          multiplier: Number(b.multiplier || 0),
          payout: Number(b.payout || 0),
          status: b.status,
          createdAt: b.created_at ? new Date(b.created_at).getTime() : Date.now(),
          serverSeedHash: b.server_seed_hash,
          serverSeed: b.server_seed,
          clientSeed: b.client_seed,
          nonce: b.nonce
        }));
        this.notify();
      }
      return this.myBets;
    } catch (err) {
      console.error('fetchMyBets error:', err);
      return [];
    }
  }

  // Fetch high roller bets (payout >= 50 FC)
  async fetchHighRollers(limit = 20) {
    try {
      const { data, error } = await supabase
        .from('game_rounds')
        .select('*')
        .gte('payout', 50)
        .order('payout', { ascending: false })
        .limit(limit);

      if (!error && Array.isArray(data)) {
        this.highRollers = data.map(b => ({
          id: b.id,
          gameId: b.game_id,
          walletAddress: b.wallet_address,
          username: b.username || `@VIP_${b.wallet_address.slice(-4)}`,
          betAmount: Number(b.bet_amount || 0),
          multiplier: Number(b.multiplier || 0),
          payout: Number(b.payout || 0),
          status: b.status,
          createdAt: b.created_at ? new Date(b.created_at).getTime() : Date.now()
        }));
        this.notify();
      }
      return this.highRollers;
    } catch (err) {
      console.error('fetchHighRollers error:', err);
      return [];
    }
  }

  // Aggregated Game Statistics
  async fetchGameStats(gameId) {
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
