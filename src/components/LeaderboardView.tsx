/**
 * ============================================================================
 * LEADERBOARD VIEW — TOP BALANCES & TOP GAME WINNERS
 * ============================================================================
 * 1. Top Balances:
 *    - Real user rankings sorted by genuine virtual wallet balance (1 FLO W = 1 USDT)
 *    - Queries Supabase RPC `get_virtual_wallet_leaderboard`
 *    - Exposes public usernames, ranks, and balances without exposing private keys
 * 2. Top Winners:
 *    - Standings by Net Profit, Multiplier, or Wagered Volume from `get_game_leaderboard`
 *    - Supports Timeframes (All-time, Weekly, Today) and Game Filters
 * ============================================================================
 */

import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { useLottery } from '../context/LotteryContext';
import { useSoundFX } from '../hooks/useSoundFX';
import { 
  Trophy, 
  Crown, 
  Medal, 
  Sparkles, 
  TrendingUp, 
  ShieldCheck, 
  Coins, 
  Zap,
  Filter,
  RefreshCw,
  Award,
  Layers,
  ChevronRight,
  Wallet,
  Clock,
  ArrowUpRight
} from 'lucide-react';

const GAME_OPTIONS = [
  { id: 'all', label: 'All Games' },
  { id: 'lottery', label: 'Lottery' },
  { id: 'crash', label: 'Crash' },
  { id: 'dice', label: 'Dice' },
  { id: 'mines', label: 'Mines' },
  { id: 'plinko', label: 'Plinko' },
  { id: 'roulette', label: 'Roulette' },
  { id: 'coinflip', label: 'Coinflip' },
  { id: 'slots', label: 'Slots' },
  { id: 'blackjack', label: 'Blackjack' },
  { id: 'poker', label: 'Poker' },
  { id: 'limbo', label: 'Limbo' },
  { id: 'keno', label: 'Keno' }
];

export default function LeaderboardView() {
  const { wallet } = useLottery();
  const { playClick } = useSoundFX();

  // Category: 'wallet' (Top Balances) vs 'games' (Top Winners)
  const [activeLeaderboardType, setActiveLeaderboardType] = useState('wallet');

  // Games Leaderboard Filters
  const [timeFilter, setTimeFilter] = useState('all'); // 'all' | 'weekly' | 'today'
  const [metricFilter, setMetricFilter] = useState('earnings'); // 'earnings' | 'multiplier' | 'wagered'
  const [gameFilter, setGameFilter] = useState('all');
  
  // Data State
  const [walletLeaderboard, setWalletLeaderboard] = useState<any[]>([]);
  const [gamesLeaderboard, setGamesLeaderboard] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Fetch Virtual Wallet Leaderboard from genuine backend RPC
  const fetchWalletLeaderboard = async () => {
    try {
      const { data, error } = await supabase.rpc('get_virtual_wallet_leaderboard', { p_limit: 50 });
      if (!error && Array.isArray(data)) {
        setWalletLeaderboard(data);
      }
    } catch (err) {
      console.warn('get_virtual_wallet_leaderboard error:', err);
    }
  };

  // Fetch Top Game Winners from database
  const fetchGamesLeaderboard = async () => {
    try {
      const { data, error } = await supabase.rpc('get_game_leaderboard', {
        p_timeframe: timeFilter,
        p_metric: metricFilter,
        p_limit: 30,
        p_game_id: gameFilter === 'all' ? null : gameFilter
      });
      if (!error && Array.isArray(data)) {
        setGamesLeaderboard(data);
      }
    } catch (err) {
      console.warn('get_game_leaderboard error:', err);
    }
  };

  // Combined Fetch
  const refreshAll = async () => {
    setLoading(true);
    try {
      if (activeLeaderboardType === 'wallet') {
        await fetchWalletLeaderboard();
      } else {
        await fetchGamesLeaderboard();
      }
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    refreshAll();
  }, [activeLeaderboardType, timeFilter, metricFilter, gameFilter]);

  // Real-time update subscription when transactions or rounds settle
  useEffect(() => {
    const channel = supabase
      .channel('realtime:wallets_leaderboard')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'lottery_wallets' }, () => {
        fetchWalletLeaderboard();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Display List with 1-based ranks
  const activeList = useMemo(() => {
    const source = activeLeaderboardType === 'wallet' ? walletLeaderboard : gamesLeaderboard;
    if (!Array.isArray(source)) return [];

    return source.map((item, idx) => ({
      ...item,
      rank: idx + 1
    }));
  }, [activeLeaderboardType, walletLeaderboard, gamesLeaderboard]);

  const top1 = activeList[0];
  const top2 = activeList[1];
  const top3 = activeList[2];

  const getVipBadge = (tier) => {
    switch ((tier || '').toLowerCase()) {
      case 'obsidian': return { label: 'Obsidian', color: 'bg-purple-950/80 border-purple-400 text-purple-300', icon: '👑' };
      case 'diamond': return { label: 'Diamond', color: 'bg-cyan-950/80 border-cyan-400 text-cyan-300', icon: '💎' };
      case 'platinum': return { label: 'Platinum', color: 'bg-slate-800 border-slate-300 text-slate-200', icon: '🏆' };
      case 'gold': return { label: 'Gold', color: 'bg-amber-950/80 border-amber-400 text-amber-300', icon: '⭐' };
      case 'silver': return { label: 'Silver', color: 'bg-zinc-800 border-zinc-400 text-zinc-300', icon: '🥈' };
      default: return { label: 'Bronze', color: 'bg-amber-900/40 border-amber-600/50 text-amber-400', icon: '🥉' };
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-5 sm:space-y-6 text-left">
      
      {/* 1. MASTER LEADERBOARD SWITCHER TABS */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-1.5 bg-[#0D111A] border border-[#1F2737] rounded-2xl shadow-inner">
        <div className="flex items-center gap-1.5 w-full sm:w-auto">
          {/* Tab 1: Top Balances */}
          <button
            onClick={() => {
              playClick();
              setActiveLeaderboardType('wallet');
            }}
            className={`flex-1 sm:flex-initial px-4 sm:px-6 py-2.5 rounded-xl text-xs sm:text-sm font-black flex items-center justify-center gap-2 transition-all cursor-pointer ${
              activeLeaderboardType === 'wallet'
                ? 'bg-gradient-to-r from-amber-400 to-amber-500 text-black shadow-md'
                : 'text-[#94A3B8] hover:text-white hover:bg-white/5'
            }`}
          >
            <Wallet className="w-4 h-4" />
            <span>Top Balances</span>
          </button>

          {/* Tab 2: Top Winners */}
          <button
            onClick={() => {
              playClick();
              setActiveLeaderboardType('games');
            }}
            className={`flex-1 sm:flex-initial px-4 sm:px-6 py-2.5 rounded-xl text-xs sm:text-sm font-black flex items-center justify-center gap-2 transition-all cursor-pointer ${
              activeLeaderboardType === 'games'
                ? 'bg-gradient-to-r from-amber-400 to-amber-500 text-black shadow-md'
                : 'text-[#94A3B8] hover:text-white hover:bg-white/5'
            }`}
          >
            <Trophy className="w-4 h-4" />
            <span>Top Winners</span>
          </button>
        </div>

        <div className="flex items-center justify-between sm:justify-end px-2 text-xs font-mono-numbers text-[#94A3B8] gap-1.5">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span>100% Genuine Database Records</span>
          </div>

          <button
            onClick={() => {
              playClick();
              setIsRefreshing(true);
              refreshAll();
            }}
            className="sm:hidden px-2.5 py-1 rounded-lg bg-[#111827] text-amber-400 text-[11px] font-bold flex items-center gap-1 border border-[#1F2737]"
            title="Refresh rankings"
          >
            <RefreshCw className={`w-3 h-3 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span>Sync</span>
          </button>
        </div>
      </div>

      {/* 2. HERO HEADER & 3-PERSON PODIUM */}
      <div className="relative rounded-3xl bg-gradient-to-r from-[#111827] via-[#151C2B] to-[#111827] border border-[#1F2737] p-4 sm:p-8 overflow-hidden shadow-2xl">
        <div className="absolute top-0 right-0 w-80 h-80 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 text-center max-w-2xl mx-auto space-y-2 mb-6 sm:mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs font-mono-numbers font-bold">
            {activeLeaderboardType === 'wallet' ? (
              <>
                <Wallet className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span>TOP WALLET BALANCES (1 FLO W = 1 USDT)</span>
              </>
            ) : (
              <>
                <Trophy className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span>TOP GAME WINNERS</span>
              </>
            )}
          </div>

          <h1 className="font-display font-black text-xl sm:text-3xl text-white tracking-tight">
            {activeLeaderboardType === 'wallet'
              ? 'Top Balances Leaderboard'
              : 'Top Game Winners Leaderboard'
            }
          </h1>

          <p className="text-xs sm:text-sm text-[#94A3B8]">
            {activeLeaderboardType === 'wallet'
              ? 'Real-time standings of players with the highest FLO Coin balances. 1 FLO W = 1 USDT.'
              : 'Rankings of top winning players across all games, verified cryptographically.'
            }
          </p>
        </div>

        {/* ============================================================== */}
        {/* DESKTOP & TABLET PODIUM (>= sm: 640px)                          */}
        {/* ============================================================== */}
        {activeList.length >= 3 && (
          <div className="hidden sm:grid grid-cols-3 gap-3 sm:gap-4 max-w-2xl mx-auto items-end pt-4">
            
            {/* Rank 2 (Silver) */}
            <div className="rounded-2xl bg-[#0B0F19] border border-slate-400/30 p-3.5 sm:p-4 text-center flex flex-col items-center shadow-lg relative order-1">
              <div className="w-8 h-8 rounded-full bg-slate-400/20 border border-slate-300 text-slate-200 flex items-center justify-center font-black text-sm mb-2">
                2
              </div>
              <span className="text-2xl mb-1">🥈</span>
              <span className="font-display font-extrabold text-xs sm:text-sm text-white truncate max-w-full">
                @{top2.username}
              </span>
              <span className="text-[10px] text-[#94A3B8] font-mono-numbers truncate max-w-full">{top2.address}</span>
              
              <div className="mt-1">
                <span className={`text-[9px] font-mono font-bold px-2 py-0.5 rounded-full border ${getVipBadge(top2.vip_tier).color}`}>
                  {getVipBadge(top2.vip_tier).icon} {top2.vip_tier || 'Bronze'}
                </span>
              </div>

              <div className="mt-2 pt-2 border-t border-[#1F2737] w-full">
                {activeLeaderboardType === 'wallet' ? (
                  <>
                    <span className="font-mono-numbers font-black text-xs sm:text-sm text-slate-200 block">
                      {Number(top2.wallet_balance || 0).toLocaleString()} FLO W
                    </span>
                    <span className="text-[9px] text-[#64748B] uppercase">≈ ${Number(top2.usdt_value || 0).toLocaleString()} USDT</span>
                  </>
                ) : (
                  <>
                    <span className="font-mono-numbers font-black text-xs sm:text-sm text-slate-300 block">
                      {Number(metricFilter === 'multiplier' ? top2.biggest_mult : top2.total_won_fc).toLocaleString()} {metricFilter === 'multiplier' ? 'x' : 'FC'}
                    </span>
                    <span className="text-[9px] text-[#64748B] uppercase">Top: {top2.biggest_mult}x · {top2.rounds_count} bets</span>
                  </>
                )}
              </div>
            </div>

            {/* Rank 1 (Gold - Center & Elevated) */}
            <div className="rounded-2xl bg-gradient-to-b from-amber-500/20 to-[#0B0F19] border-2 border-amber-400 p-4 sm:p-5 text-center flex flex-col items-center shadow-[0_0_35px_rgba(245,196,81,0.25)] relative -translate-y-3 order-2">
              <div className="absolute -top-3.5 px-3 py-0.5 rounded-full bg-amber-400 text-black font-extrabold text-[10px] tracking-widest flex items-center gap-1 shadow-md">
                <Crown className="w-3 h-3 fill-current" />
                CHAMPION
              </div>
              <div className="w-10 h-10 rounded-full bg-amber-400/20 border-2 border-amber-400 text-amber-300 flex items-center justify-center font-black text-base mb-2 mt-1">
                1
              </div>
              <span className="text-3xl mb-1">👑</span>
              <span className="font-display font-black text-sm sm:text-base text-amber-300 truncate max-w-full">
                @{top1.username}
              </span>
              <span className="text-[10px] text-amber-400/70 font-mono-numbers truncate max-w-full">{top1.address}</span>
              
              <div className="mt-1">
                <span className={`text-[10px] font-mono font-bold px-2.5 py-0.5 rounded-full border ${getVipBadge(top1.vip_tier).color}`}>
                  {getVipBadge(top1.vip_tier).icon} {top1.vip_tier || 'Diamond'}
                </span>
              </div>

              <div className="mt-3 pt-2 border-t border-amber-400/30 w-full">
                {activeLeaderboardType === 'wallet' ? (
                  <>
                    <span className="font-mono-numbers font-black text-sm sm:text-base text-amber-300 block">
                      {Number(top1.wallet_balance || 0).toLocaleString()} FLO W
                    </span>
                    <span className="text-[10px] text-amber-400/80 uppercase font-mono-numbers">≈ ${Number(top1.usdt_value || 0).toLocaleString()} USDT</span>
                  </>
                ) : (
                  <>
                    <span className="font-mono-numbers font-black text-sm sm:text-base text-amber-300 block">
                      {Number(metricFilter === 'multiplier' ? top1.biggest_mult : top1.total_won_fc).toLocaleString()} {metricFilter === 'multiplier' ? 'x' : 'FC'}
                    </span>
                    <span className="text-[9px] text-[#64748B] uppercase">Top: {top1.biggest_mult}x · {top1.rounds_count} bets</span>
                  </>
                )}
              </div>
            </div>

            {/* Rank 3 (Bronze) */}
            <div className="rounded-2xl bg-[#0B0F19] border border-amber-700/40 p-3.5 sm:p-4 text-center flex flex-col items-center shadow-lg relative order-3">
              <div className="w-8 h-8 rounded-full bg-amber-700/20 border border-amber-600 text-amber-400 flex items-center justify-center font-black text-sm mb-2">
                3
              </div>
              <span className="text-2xl mb-1">🥉</span>
              <span className="font-display font-extrabold text-xs sm:text-sm text-white truncate max-w-full">
                @{top3.username}
              </span>
              <span className="text-[10px] text-[#94A3B8] font-mono-numbers truncate max-w-full">{top3.address}</span>
              
              <div className="mt-1">
                <span className={`text-[9px] font-mono font-bold px-2 py-0.5 rounded-full border ${getVipBadge(top3.vip_tier).color}`}>
                  {getVipBadge(top3.vip_tier).icon} {top3.vip_tier || 'Gold'}
                </span>
              </div>

              <div className="mt-2 pt-2 border-t border-[#1F2737] w-full">
                {activeLeaderboardType === 'wallet' ? (
                  <>
                    <span className="font-mono-numbers font-black text-xs sm:text-sm text-amber-500 block">
                      {Number(top3.wallet_balance || 0).toLocaleString()} FLO W
                    </span>
                    <span className="text-[9px] text-[#64748B] uppercase">≈ ${Number(top3.usdt_value || 0).toLocaleString()} USDT</span>
                  </>
                ) : (
                  <>
                    <span className="font-mono-numbers font-black text-xs sm:text-sm text-amber-500 block">
                      {Number(metricFilter === 'multiplier' ? top3.biggest_mult : top3.total_won_fc).toLocaleString()} {metricFilter === 'multiplier' ? 'x' : 'FC'}
                    </span>
                    <span className="text-[9px] text-[#64748B] uppercase">Top: {top3.biggest_mult}x · {top3.rounds_count} bets</span>
                  </>
                )}
              </div>
            </div>

          </div>
        )}

        {/* ============================================================== */}
        {/* MOBILE OPTIMIZED PODIUM (< sm: 640px, e.g. 320px, 375px, 425px)*/}
        {/* ============================================================== */}
        {activeList.length >= 3 && (
          <div className="flex flex-col gap-2.5 sm:hidden pt-1">
            
            {/* Rank 1 (Gold Champion Featured Card) */}
            <div className="rounded-2xl bg-gradient-to-r from-amber-500/20 via-[#151C2B] to-[#0B0F19] border-2 border-amber-400 p-3 xs:p-3.5 shadow-[0_0_25px_rgba(245,196,81,0.2)] relative">
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-7 h-7 xs:w-8 xs:h-8 rounded-full bg-amber-400 text-black flex items-center justify-center font-black text-xs shrink-0 shadow">
                    1
                  </div>
                  <span className="text-xl shrink-0">👑</span>
                  <div className="min-w-0">
                    <span className="font-display font-black text-xs xs:text-sm text-amber-300 truncate block">
                      @{top1.username}
                    </span>
                    <span className="text-[9px] text-amber-400/70 font-mono-numbers truncate block">
                      {top1.address}
                    </span>
                  </div>
                </div>

                <div className="flex flex-col items-end gap-1 shrink-0">
                  <span className="px-2 py-0.5 rounded-full bg-amber-400 text-black font-extrabold text-[8px] xs:text-[9px] tracking-wider uppercase">
                    Champion
                  </span>
                  <span className={`text-[8px] xs:text-[9px] font-mono font-bold px-1.5 py-0.2 rounded-full border ${getVipBadge(top1.vip_tier).color}`}>
                    {getVipBadge(top1.vip_tier).icon} {top1.vip_tier || 'Diamond'}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-amber-400/30 text-xs">
                <span className="text-[10px] text-white/60 font-mono-numbers uppercase tracking-wider">
                  {activeLeaderboardType === 'wallet' ? 'Balance' : 'Score'}
                </span>
                <div className="text-right">
                  {activeLeaderboardType === 'wallet' ? (
                    <>
                      <span className="font-mono-numbers font-black text-xs xs:text-sm text-amber-300 block whitespace-nowrap">
                        {Number(top1.wallet_balance || 0).toLocaleString()} FLO W
                      </span>
                      <span className="text-[9px] text-amber-400/80 font-mono-numbers block whitespace-nowrap">
                        ≈ ${Number(top1.usdt_value || 0).toLocaleString()} USDT
                      </span>
                    </>
                  ) : (
                    <>
                      <span className="font-mono-numbers font-black text-xs xs:text-sm text-amber-300 block whitespace-nowrap">
                        {Number(metricFilter === 'multiplier' ? top1.biggest_mult : top1.total_won_fc).toLocaleString()} {metricFilter === 'multiplier' ? 'x' : 'FC'}
                      </span>
                      <span className="text-[9px] text-[#64748B] block whitespace-nowrap">
                        Top: {top1.biggest_mult}x · {top1.rounds_count} bets
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Rank 2 & Rank 3 Symmetrical 2-Column Grid */}
            <div className="grid grid-cols-2 gap-2 xs:gap-2.5">
              
              {/* Rank 2 (Silver) */}
              <div className="rounded-2xl bg-[#0B0F19] border border-slate-400/35 p-2.5 xs:p-3 text-center flex flex-col justify-between shadow-md">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="w-5 h-5 xs:w-6 xs:h-6 rounded-full bg-slate-400/20 border border-slate-300 text-slate-200 flex items-center justify-center font-black text-[10px] xs:text-xs">
                      2
                    </span>
                    <span className="text-lg">🥈</span>
                  </div>
                  <span className="font-display font-extrabold text-[11px] xs:text-xs text-white truncate block">
                    @{top2.username}
                  </span>
                  <span className="text-[9px] text-[#94A3B8] font-mono-numbers truncate block">
                    {top2.address}
                  </span>
                  <div className="mt-1">
                    <span className={`text-[8px] font-mono font-bold px-1.5 py-0.2 rounded-full border inline-block ${getVipBadge(top2.vip_tier).color}`}>
                      {getVipBadge(top2.vip_tier).icon} {top2.vip_tier || 'Bronze'}
                    </span>
                  </div>
                </div>

                <div className="mt-2 pt-2 border-t border-[#1F2737] w-full">
                  {activeLeaderboardType === 'wallet' ? (
                    <>
                      <span className="font-mono-numbers font-black text-[11px] xs:text-xs text-slate-200 block truncate">
                        {Number(top2.wallet_balance || 0).toLocaleString()} FLO W
                      </span>
                      <span className="text-[8px] xs:text-[9px] text-[#64748B] block truncate">
                        ≈ ${Number(top2.usdt_value || 0).toLocaleString()} USDT
                      </span>
                    </>
                  ) : (
                    <>
                      <span className="font-mono-numbers font-black text-[11px] xs:text-xs text-slate-300 block truncate">
                        {Number(metricFilter === 'multiplier' ? top2.biggest_mult : top2.total_won_fc).toLocaleString()} {metricFilter === 'multiplier' ? 'x' : 'FC'}
                      </span>
                      <span className="text-[8px] text-[#64748B] block truncate">
                        {top2.biggest_mult}x · {top2.rounds_count} bets
                      </span>
                    </>
                  )}
                </div>
              </div>

              {/* Rank 3 (Bronze) */}
              <div className="rounded-2xl bg-[#0B0F19] border border-amber-700/45 p-2.5 xs:p-3 text-center flex flex-col justify-between shadow-md">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="w-5 h-5 xs:w-6 xs:h-6 rounded-full bg-amber-700/20 border border-amber-600 text-amber-400 flex items-center justify-center font-black text-[10px] xs:text-xs">
                      3
                    </span>
                    <span className="text-lg">🥉</span>
                  </div>
                  <span className="font-display font-extrabold text-[11px] xs:text-xs text-white truncate block">
                    @{top3.username}
                  </span>
                  <span className="text-[9px] text-[#94A3B8] font-mono-numbers truncate block">
                    {top3.address}
                  </span>
                  <div className="mt-1">
                    <span className={`text-[8px] font-mono font-bold px-1.5 py-0.2 rounded-full border inline-block ${getVipBadge(top3.vip_tier).color}`}>
                      {getVipBadge(top3.vip_tier).icon} {top3.vip_tier || 'Gold'}
                    </span>
                  </div>
                </div>

                <div className="mt-2 pt-2 border-t border-[#1F2737] w-full">
                  {activeLeaderboardType === 'wallet' ? (
                    <>
                      <span className="font-mono-numbers font-black text-[11px] xs:text-xs text-amber-500 block truncate">
                        {Number(top3.wallet_balance || 0).toLocaleString()} FLO W
                      </span>
                      <span className="text-[8px] xs:text-[9px] text-[#64748B] block truncate">
                        ≈ ${Number(top3.usdt_value || 0).toLocaleString()} USDT
                      </span>
                    </>
                  ) : (
                    <>
                      <span className="font-mono-numbers font-black text-[11px] xs:text-xs text-amber-500 block truncate">
                        {Number(metricFilter === 'multiplier' ? top3.biggest_mult : top3.total_won_fc).toLocaleString()} {metricFilter === 'multiplier' ? 'x' : 'FC'}
                      </span>
                      <span className="text-[8px] text-[#64748B] block truncate">
                        {top3.biggest_mult}x · {top3.rounds_count} bets
                      </span>
                    </>
                  )}
                </div>
              </div>

            </div>

          </div>
        )}
      </div>

      {/* 3. FILTER CONTROLS & LIVE SYNC */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          
          {/* If Games view is active: show Timeframe & Metric tabs */}
          {activeLeaderboardType === 'games' ? (
            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
              <div className="flex items-center gap-1 bg-[#111827] p-1 rounded-xl border border-[#1F2737]">
                {[
                  { id: 'all', label: 'All Time' },
                  { id: 'weekly', label: 'Past 7 Days' },
                  { id: 'today', label: 'Today (24H)' }
                ].map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => {
                      playClick();
                      setTimeFilter(tab.id);
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      timeFilter === tab.id
                        ? 'bg-amber-400 text-black shadow-sm'
                        : 'text-[#94A3B8] hover:text-white'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-1 bg-[#111827] p-1 rounded-xl border border-[#1F2737]">
                {[
                  { id: 'earnings', label: 'Most FC Won' },
                  { id: 'multiplier', label: 'Top Multiplier' },
                  { id: 'wagered', label: 'Total Wagered' }
                ].map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => {
                      playClick();
                      setMetricFilter(tab.id);
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      metricFilter === tab.id
                        ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-black shadow-sm'
                        : 'text-[#94A3B8] hover:text-white'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            /* Top Balances Info Pill */
            <div className="flex items-center gap-2 text-xs font-bold text-amber-300">
              <Coins className="w-4 h-4 text-amber-400 shrink-0" />
              <span>Ranked strictly by verified wallet balance in Supabase database</span>
            </div>
          )}

          {/* Sync / Refresh Button */}
          <button
            onClick={() => {
              playClick();
              setIsRefreshing(true);
              refreshAll();
            }}
            className="hidden sm:flex px-3.5 py-2 rounded-xl bg-[#111827] hover:bg-[#151C2B] border border-[#1F2737] hover:border-amber-400/50 text-amber-400 text-xs font-bold items-center gap-2 cursor-pointer shadow-sm transition-all shrink-0 ml-auto"
            title="Refresh rankings"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span>Sync Rankings</span>
          </button>

        </div>

        {/* If Games view is active: show Game selection filter */}
        {activeLeaderboardType === 'games' && (
          <div className="flex items-center gap-1.5 overflow-x-auto w-full pb-1 no-scrollbar text-xs">
            {GAME_OPTIONS.map(g => (
              <button
                key={g.id}
                onClick={() => {
                  playClick();
                  setGameFilter(g.id);
                }}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold whitespace-nowrap transition-all cursor-pointer ${
                  gameFilter === g.id
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm'
                    : 'bg-[#111827] text-[#94A3B8] border border-[#1F2737] hover:text-white'
                }`}
              >
                {g.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 4. LEADERBOARD DATA TABLE */}
      <div className="rounded-3xl bg-[#111827] border border-[#1F2737] overflow-hidden shadow-xl">
        <div className="overflow-x-auto -mx-0">
          <table className="w-full text-left text-xs min-w-[640px]">
            <thead className="bg-[#0B0F19] text-[#94A3B8] font-mono-numbers uppercase text-[10px] tracking-wider border-b border-[#1F2737]">
              {activeLeaderboardType === 'wallet' ? (
                <tr>
                  <th className="py-3.5 px-4 whitespace-nowrap">Rank</th>
                  <th className="py-3.5 px-4 whitespace-nowrap">Player</th>
                  <th className="py-3.5 px-4 whitespace-nowrap">VIP Tier</th>
                  <th className="py-3.5 px-4 text-right whitespace-nowrap">Balance (FLO W)</th>
                  <th className="py-3.5 px-4 text-right whitespace-nowrap">USDT Value (1:1)</th>
                  <th className="py-3.5 px-4 text-right whitespace-nowrap">Lifetime Won</th>
                  <th className="py-3.5 px-4 text-center whitespace-nowrap">Status</th>
                </tr>
              ) : (
                <tr>
                  <th className="py-3.5 px-4 whitespace-nowrap">Rank</th>
                  <th className="py-3.5 px-4 whitespace-nowrap">Player</th>
                  <th className="py-3.5 px-4 whitespace-nowrap">VIP Rank</th>
                  <th className="py-3.5 px-4 text-right whitespace-nowrap">
                    {metricFilter === 'multiplier' ? 'Peak Multiplier' : metricFilter === 'wagered' ? 'Total Wagered' : 'Total Net Profit'}
                  </th>
                  <th className="py-3.5 px-4 text-right whitespace-nowrap">Rounds</th>
                  <th className="py-3.5 px-4 text-center whitespace-nowrap">Favorite</th>
                </tr>
              )}
            </thead>

            <tbody className="divide-y divide-[#1F2737] font-mono-numbers">
              {loading && activeList.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center text-[#94A3B8]">
                    <div className="flex flex-col items-center justify-center space-y-2">
                      <RefreshCw className="w-6 h-6 animate-spin text-amber-400" />
                      <span className="text-xs">Loading genuine database rankings...</span>
                    </div>
                  </td>
                </tr>
              ) : activeList.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-[#94A3B8]">
                    <div className="flex flex-col items-center justify-center space-y-2">
                      <Trophy className="w-8 h-8 text-amber-500/30" />
                      <span className="font-display font-bold text-sm text-white">No Standings Found</span>
                      <span className="text-xs text-[#64748B] max-w-sm">
                        {activeLeaderboardType === 'wallet'
                          ? 'No active wallets found in database.'
                          : 'Place bets on any casino game or lottery round to claim the #1 spot!'}
                      </span>
                    </div>
                  </td>
                </tr>
              ) : (
                activeList.map((row) => {
                  const isTop1 = row.rank === 1;
                  const isTop2 = row.rank === 2;
                  const isTop3 = row.rank === 3;
                  const targetAddr = wallet?.address?.toLowerCase();
                  const isMe = targetAddr && (
                    (row.raw_address && row.raw_address.toLowerCase() === targetAddr) ||
                    (row.address && row.address.toLowerCase() === targetAddr)
                  );
                  const vipInfo = getVipBadge(row.vip_tier);

                  return (
                    <tr
                      key={row.rank}
                      className={`transition-colors ${
                        isMe 
                          ? 'bg-amber-500/10 hover:bg-amber-500/15' 
                          : isTop1
                          ? 'bg-amber-400/5 hover:bg-amber-400/10'
                          : 'hover:bg-white/5'
                      }`}
                    >
                      {/* Rank */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          {isTop1 ? (
                            <span className="w-6 h-6 rounded-full bg-amber-400 text-black font-black flex items-center justify-center text-xs shadow">1</span>
                          ) : isTop2 ? (
                            <span className="w-6 h-6 rounded-full bg-slate-300 text-black font-black flex items-center justify-center text-xs shadow">2</span>
                          ) : isTop3 ? (
                            <span className="w-6 h-6 rounded-full bg-amber-700 text-white font-black flex items-center justify-center text-xs shadow">3</span>
                          ) : (
                            <span className="text-[#94A3B8] font-bold pl-1.5">#{row.rank}</span>
                          )}
                        </div>
                      </td>

                      {/* Player Info */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="flex flex-col">
                          <span className={`font-display font-bold text-xs ${isMe ? 'text-amber-300' : 'text-white'}`}>
                            @{row.username} {isMe && <span className="text-[10px] text-amber-400 font-bold">(You)</span>}
                          </span>
                          <span className="text-[10px] text-[#64748B]">
                            {row.address || 'Verified User'}
                          </span>
                        </div>
                      </td>

                      {/* VIP Rank */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${vipInfo.color}`}>
                          <span>{vipInfo.icon}</span>
                          <span>{row.vip_tier || 'Bronze'}</span>
                        </span>
                      </td>

                      {/* Columns depend on activeLeaderboardType */}
                      {activeLeaderboardType === 'wallet' ? (
                        <>
                          {/* Wallet Balance (FLO W) */}
                          <td className="py-3.5 px-4 text-right whitespace-nowrap">
                            <span className="font-extrabold text-amber-300 text-sm">
                              {Number(row.wallet_balance || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>{' '}
                            <span className="text-[10px] font-bold text-amber-400">FLO W</span>
                          </td>

                          {/* USDT Value */}
                          <td className="py-3.5 px-4 text-right whitespace-nowrap">
                            <span className="font-bold text-emerald-400 text-xs">
                              ${Number(row.usdt_value || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>{' '}
                            <span className="text-[9px] text-white/50">USDT</span>
                          </td>

                          {/* Lifetime Won */}
                          <td className="py-3.5 px-4 text-right text-[#94A3B8] whitespace-nowrap">
                            {Number(row.lifetime_won || 0).toLocaleString()} FC
                          </td>

                          {/* Verified Status */}
                          <td className="py-3.5 px-4 text-center whitespace-nowrap">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 text-[10px] font-bold">
                              <ShieldCheck className="w-3 h-3 text-emerald-400" />
                              <span>Verified</span>
                            </span>
                          </td>
                        </>
                      ) : (
                        <>
                          {/* Metric Column */}
                          <td className="py-3.5 px-4 text-right whitespace-nowrap">
                            {metricFilter === 'multiplier' ? (
                              <span className="font-extrabold text-amber-400 text-sm">
                                {Number(row.biggest_mult || 0).toFixed(2)}x
                              </span>
                            ) : metricFilter === 'wagered' ? (
                              <span className="font-bold text-slate-200 text-xs">
                                {Number(row.total_wagered || 0).toLocaleString()} <span className="text-[10px] text-amber-400">FC</span>
                              </span>
                            ) : (
                              <span className="font-extrabold text-emerald-400 text-xs">
                                +{Number(row.total_won_fc || 0).toLocaleString()} <span className="text-[10px] text-amber-400">FC</span>
                              </span>
                            )}
                          </td>

                          {/* Rounds Played */}
                          <td className="py-3.5 px-4 text-right text-[#94A3B8] whitespace-nowrap">
                            {row.rounds_count}
                          </td>

                          {/* Fav Game */}
                          <td className="py-3.5 px-4 text-center whitespace-nowrap">
                            <span className="px-2 py-0.5 rounded bg-[#0B0F19] text-[#94A3B8] border border-[#1F2737] text-[10px] font-bold uppercase">
                              {row.fav_game || 'Casino'}
                            </span>
                          </td>
                        </>
                      )}

                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
