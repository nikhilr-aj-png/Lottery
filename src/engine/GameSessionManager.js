/**
 * ============================================================================
 * GAME SESSION MANAGER — ATOMIC BET SETTLEMENT & LIFECYCLE
 * ============================================================================
 * Coordinates client-side round flow with server-side RPC settlement:
 *   1. Pre-round seed validation
 *   2. Atomic debit & credit via Supabase stored procedure `settle_game_round_secure`
 *   3. Immutable game round record creation in `public.game_rounds`
 *   4. State machine: 'idle' -> 'betting' -> 'playing' -> 'resolved'
 */

import { supabase } from '../lib/supabase.js';
import { validateBet } from './GameRulesEngine.js';
import { getGameById } from './GameRegistry.js';

export class GameSessionManager {
  constructor() {
    this.activeSessions = new Map(); // gameId -> sessionState
    this.listeners = new Set();
  }

  // Subscribe to session state changes
  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  notify(gameId, state) {
    this.listeners.forEach(fn => fn(gameId, state));
  }

  // Get current session for a game
  getSession(gameId) {
    return this.activeSessions.get(gameId) || {
      gameId,
      status: 'idle', // 'idle' | 'playing' | 'cashout' | 'resolved'
      roundId: null,
      betAmount: 0,
      multiplier: 0,
      payout: 0,
      outcomeData: null,
      error: null
    };
  }

  // Start a game round
  async startRound({ gameId, walletAddress, userId, username, betAmountFC, userBalanceFC }) {
    const game = getGameById(gameId);
    if (!game) {
      return { success: false, error: `Invalid game identifier: ${gameId}` };
    }

    // 1. Validate Bet parameters
    const check = validateBet(gameId, betAmountFC, userBalanceFC);
    if (!check.valid) {
      return { success: false, error: check.error };
    }

    const roundId = `rnd_${gameId}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const sessionState = {
      gameId,
      status: 'playing',
      roundId,
      betAmount: check.amount,
      multiplier: 0,
      payout: 0,
      outcomeData: null,
      startTime: Date.now(),
      error: null
    };

    this.activeSessions.set(gameId, sessionState);
    this.notify(gameId, sessionState);

    return {
      success: true,
      roundId,
      betAmount: check.amount,
      status: 'playing'
    };
  }

  // Settle a game round (Won, Lost, or Cashed Out)
  async settleRound({
    gameId,
    walletAddress,
    userId = null,
    username = null,
    betAmountFC,
    multiplier = 0,
    payoutFC = 0,
    outcomeData = {},
    serverSeed = null,
    serverSeedHash = null,
    clientSeed = null,
    nonce = 1,
    metadata = {}
  }) {
    const bet = Number(betAmountFC || 0);
    const mult = Number(multiplier || 0);
    const payout = Number(payoutFC || 0);

    // Call server-authoritative Supabase RPC to settle round in ledger and write game_rounds record
    try {
      const { data, error } = await supabase.rpc('settle_game_round_secure', {
        p_game_id: gameId,
        p_wallet_address: walletAddress,
        p_user_id: userId,
        p_username: username,
        p_bet_amount: bet,
        p_multiplier: mult,
        p_payout: payout,
        p_outcome_data: outcomeData,
        p_server_seed: serverSeed,
        p_server_seed_hash: serverSeedHash,
        p_client_seed: clientSeed,
        p_nonce: nonce,
        p_metadata: metadata
      });

      if (error) throw error;

      const finalState = {
        gameId,
        status: data?.status || (payout > 0 ? 'won' : 'lost'),
        roundId: data?.round_id,
        betAmount: bet,
        multiplier: mult,
        payout,
        outcomeData,
        newBalance: data?.new_balance,
        serverSeed: data?.server_seed,
        serverSeedHash: data?.server_seed_hash,
        clientSeed: data?.client_seed,
        nonce: data?.nonce,
        resolvedAt: Date.now()
      };

      this.activeSessions.set(gameId, finalState);
      this.notify(gameId, finalState);

      return {
        success: true,
        ...data,
        finalState
      };
    } catch (err) {
      console.error('settleRound RPC error:', err);

      // Fallback state in case of connection failure
      const fallbackState = {
        gameId,
        status: payout > 0 ? 'won' : 'lost',
        roundId: `rnd_offline_${Date.now()}`,
        betAmount: bet,
        multiplier: mult,
        payout,
        outcomeData,
        error: err.message
      };
      this.activeSessions.set(gameId, fallbackState);
      this.notify(gameId, fallbackState);

      return {
        success: false,
        error: err.message,
        fallbackState
      };
    }
  }

  // Reset session to idle
  resetSession(gameId) {
    const idleState = {
      gameId,
      status: 'idle',
      roundId: null,
      betAmount: 0,
      multiplier: 0,
      payout: 0,
      outcomeData: null,
      error: null
    };
    this.activeSessions.set(gameId, idleState);
    this.notify(gameId, idleState);
    return idleState;
  }
}

// Global Singleton Instance
export const gameSessionManager = new GameSessionManager();
