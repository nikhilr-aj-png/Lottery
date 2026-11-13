import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useLottery } from '../context/LotteryContext';
import { 
  getGameById, 
  gameSessionManager, 
  gameHistoryStore, 
  validateBet,
  verifyGameRoundOutcome,
  generateRandomClientSeed,
  GameDefinition,
  GameSessionState,
  StartRoundResult,
  SettleRoundResult,
  FormattedBet
} from '../engine';
import { supabase } from '../lib/supabase';
import confetti from 'canvas-confetti';

export interface SeedsState {
  serverHash: string;
  clientSeed: string;
  nonce: number;
  previousServerSeed?: string;
  previousServerHash?: string;
}

export interface UseGameEngineReturn {
  game: GameDefinition | null;
  session: GameSessionState;
  isPlaying: boolean;
  betAmount: number;
  setBetAmount: React.Dispatch<React.SetStateAction<number>>;
  doubleBet: () => void;
  halveBet: () => void;
  setMinBet: () => void;
  setMaxBet: () => void;
  seeds: SeedsState;
  rotateSeeds: (customClientSeed?: string | null) => Promise<unknown>;
  startRound: (customBet?: number | null) => Promise<StartRoundResult>;
  settleRound: (params: { multiplier?: number; payout?: number; outcomeData?: Record<string, unknown>; metadata?: Record<string, unknown> }) => Promise<SettleRoundResult>;
  resetRound: () => GameSessionState;
  verifyRound: (roundRecord: Record<string, unknown>) => Promise<unknown>;
  myBets: FormattedBet[];
  walletBalance: number;
  loading: boolean;
}

export function useGameEngine(gameId: string): UseGameEngineReturn {
  const { wallet, user, profile, showToast, fetchWalletLedger } = useLottery();
  
  const game = useMemo(() => getGameById(gameId), [gameId]);
  
  const [session, setSession] = useState<GameSessionState>(() => gameSessionManager.getSession(gameId));
  const [betAmount, setBetAmount] = useState<number>(() => game?.defaultStakeFC || 10);
  const [seeds, setSeeds] = useState<SeedsState>({
    serverHash: '0x' + Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join(''),
    clientSeed: generateRandomClientSeed(),
    nonce: 1
  });
  const [myBets, setMyBets] = useState<FormattedBet[]>([]);
  const [loading, setLoading] = useState<boolean>(false);

  // Sync session state from GameSessionManager
  useEffect(() => {
    const unsubscribe = gameSessionManager.subscribe((targetId, updatedState) => {
      if (targetId === gameId) {
        setSession(updatedState);
      }
    });
    return () => unsubscribe();
  }, [gameId]);

  // Load user active seeds from Supabase
  const loadUserSeeds = useCallback(async () => {
    if (!wallet.address) return;
    try {
      const { data, error } = await supabase.rpc('get_or_create_user_game_seed', {
        p_wallet_address: wallet.address,
        p_user_id: user?.id || null
      });
      if (!error && data?.success) {
        setSeeds({
          serverHash: data.server_hash,
          clientSeed: data.client_seed,
          nonce: data.nonce || 1,
          previousServerSeed: data.previous_server_seed,
          previousServerHash: data.previous_server_hash
        });
      }
    } catch (err) {
      console.warn('loadUserSeeds error:', err);
    }
  }, [wallet.address, user?.id]);

  useEffect(() => {
    loadUserSeeds();
  }, [loadUserSeeds]);

  // Rotate user seed pair (Stake-style manual rotation)
  const rotateSeeds = useCallback(async (customClientSeed: string | null = null) => {
    if (!wallet.address) return;
    try {
      const { data, error } = await supabase.rpc('rotate_user_game_seed', {
        p_wallet_address: wallet.address,
        p_new_client_seed: customClientSeed
      });
      if (!error && data?.success) {
        setSeeds(prev => ({
          ...prev,
          serverHash: data.new_server_hash,
          clientSeed: data.new_client_seed,
          nonce: 0,
          previousServerSeed: data.revealed_previous_seed,
          previousServerHash: data.previous_commit_hash
        }));
        showToast('Provably Fair seeds rotated! Previous server seed revealed.', 'info');
        return data;
      }
    } catch (err) {
      console.error('rotateSeeds error:', err);
    }
  }, [wallet.address, showToast]);

  // Refresh recent personal bets
  const refreshBets = useCallback(async () => {
    if (wallet.address) {
      const bets = await gameHistoryStore.fetchMyBets(wallet.address);
      setMyBets(bets.filter(b => b.gameId === gameId));
    }
  }, [wallet.address, gameId]);

  useEffect(() => {
    refreshBets();
  }, [refreshBets]);

  // Quick Bet Adjusters
  const doubleBet = () => {
    setBetAmount(prev => Math.min(game?.maxStakeFC || 1000, parseFloat((prev * 2).toFixed(2))));
  };

  const halveBet = () => {
    setBetAmount(prev => Math.max(game?.minStakeFC || 1, parseFloat((prev / 2).toFixed(2))));
  };

  const setMinBet = () => {
    setBetAmount(game?.minStakeFC || 1);
  };

  const setMaxBet = () => {
    const maxAffordable = Math.min(game?.maxStakeFC || 1000, Number(wallet.balance || 0));
    setBetAmount(Math.max(game?.minStakeFC || 1, parseFloat(maxAffordable.toFixed(2))));
  };

  // Start Round Action
  const startRound = useCallback(async (customBet: number | null = null): Promise<StartRoundResult> => {
    const stake = customBet !== null ? customBet : betAmount;
    setLoading(true);

    const check = validateBet(gameId, stake, wallet.balance);
    if (!check.valid) {
      if (check.error) showToast(check.error, 'error');
      setLoading(false);
      return { success: false, error: check.error };
    }

    const res = await gameSessionManager.startRound({
      gameId,
      walletAddress: wallet.address,
      userId: user?.id || null,
      username: profile?.username || user?.email?.split('@')[0] || 'Player',
      betAmountFC: stake,
      userBalanceFC: wallet.balance
    });

    setLoading(false);
    return res;
  }, [gameId, betAmount, wallet.balance, wallet.address, user?.id, user?.email, profile?.username, showToast]);

  // Settle Round Action (Authoritative Server RPC)
  const settleRound = useCallback(async ({
    multiplier = 0,
    payout = 0,
    outcomeData = {},
    metadata = {}
  }: {
    multiplier?: number;
    payout?: number;
    outcomeData?: Record<string, unknown>;
    metadata?: Record<string, unknown>;
  }): Promise<SettleRoundResult> => {
    setLoading(true);

    const res = await gameSessionManager.settleRound({
      gameId,
      walletAddress: wallet.address,
      userId: user?.id || null,
      username: profile?.username || user?.email?.split('@')[0] || 'Player',
      betAmountFC: session.betAmount || betAmount,
      multiplier,
      payoutFC: payout,
      outcomeData,
      clientSeed: seeds.clientSeed,
      nonce: seeds.nonce + 1,
      metadata
    });

    setLoading(false);

    // Update local seeds nonce
    setSeeds(prev => ({ ...prev, nonce: prev.nonce + 1 }));

    // Trigger celebration if player won big!
    if (payout > 0) {
      if (multiplier >= 2.0) {
        confetti({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#ffd700', '#22c55e', '#8b5cf6', '#ffffff']
        });
      }
      showToast(`🎉 Won +${payout.toLocaleString()} Flow Coins (${multiplier}x)!`, 'success');
    }

    // Refresh wallet ledger & bets
    if (fetchWalletLedger) fetchWalletLedger();
    refreshBets();

    return res;
  }, [gameId, session.betAmount, betAmount, wallet.address, user?.id, user?.email, profile?.username, seeds, showToast, fetchWalletLedger, refreshBets]);

  // Reset Session
  const resetRound = useCallback((): GameSessionState => {
    return gameSessionManager.resetSession(gameId);
  }, [gameId]);

  // Verify Round Outcome
  const verifyRound = useCallback(async (roundRecord: Record<string, unknown>) => {
    if (!roundRecord) return null;
    return await verifyGameRoundOutcome(
      String(roundRecord.gameId || gameId),
      String(roundRecord.serverSeed || ''),
      String(roundRecord.serverSeedHash || ''),
      String(roundRecord.clientSeed || ''),
      Number(roundRecord.nonce || 1)
    );
  }, [gameId]);

  return {
    game,
    session,
    isPlaying: session.status === 'playing',
    betAmount,
    setBetAmount,
    doubleBet,
    halveBet,
    setMinBet,
    setMaxBet,
    seeds,
    rotateSeeds,
    startRound,
    settleRound,
    resetRound,
    verifyRound,
    myBets,
    walletBalance: Number(wallet.balance || 0),
    loading
  };
}

export default useGameEngine;

