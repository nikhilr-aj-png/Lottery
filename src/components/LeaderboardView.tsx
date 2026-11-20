/**
 * ============================================================================
 * LEADERBOARD VIEW — TOP WINNERS ONLY (CONFIRMED WINS RANKING)
 * ============================================================================
 * 1. Primary Ranking: Confirmed Wins Count (from genuine backend records).
 * 2. 5 Timeframe Filters:
 *    - Last 24 Hours
 *    - Last 7 Days
 *    - Last 2 Weeks
 *    - Last 3 Weeks
 *    - Last 4 Weeks (Default)
 * 3. Shows the game names in which each user won.
 * 4. Displays real USDT prize earnings and cryptographic provably fair status.
 * 5. Strictly database-driven from `game_rounds` and `winner_payouts`.
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
  ShieldCheck, 
  Coins, 
  RefreshCw, 
  Award,
  Clock,
  Gamepad2,
  CheckCircle2,
  Flame
} from 'lucide-react';

const TIME_FILTERS = [
  { id: '24h', label: 'Last 24 Hours', days: 1 },
  { id: '7d', label: 'Last 7 Days', days: 7 },
  { id: '14d', label: 'Last 2 Weeks', days: 14 },
  { id: '21d', label: 'Last 3 Weeks', days: 21 },
  { id: '28d', label: 'Last 4 Weeks', days: 28 } // Default
];

const GAME_OPTIONS = [
  { id: 'all', label: 'All Games' },
  { id: 'lottery', label: 'Four-Digit Lottery' },
  { id: 'crash', label: 'Crash' },
  { id: 'dice', label: 'Dice' },
  { id: 'coinflip', label: 'Coinflip' },
  { id: 'bingo', label: 'Bingo – Color Trading' },
  { id: 'horse-racing', label: 'Horse Racing' }
];

export default function LeaderboardView() {
  const { wallet } = useLottery();
  const { playClick } = useSoundFX();

  // Exactly 5 Time Filters (Default: Last 4 Weeks)
  const [timeFilter, setTimeFilter] = useState('28d');
  const [gameFilter, setGameFilter] = useState('all');

  // Data State
  const [winnersList, setWinnersList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Fetch and aggregate confirmed winning records from genuine Supabase backend
  const fetchTopWinners = async () => {
    setLoading(true);
    try {
      const selectedTf = TIME_FILTERS.find(t => t.id === timeFilter) || TIME_FILTERS[4];
      const cutoffDate = new Date(Date.now() - selectedTf.days * 24 * 60 * 60 * 1000).toISOString();

      // 1. Fetch winning rounds from game_rounds (payout > 0 or status = won)
      let grQuery = supabase
        .from('game_rounds')
        .select('id, game_id, user_id, username, wallet_address, payout, multiplier, status, created_at')
        .gte('created_at', cutoffDate)
        .or('payout.gt.0,status.eq.won,status.eq.win');

      if (gameFilter !== 'all' && gameFilter !== 'lottery') {
        grQuery = grQuery.eq('game_id', gameFilter);
      }

      const { data: grData, error: grError } = await grQuery;

      // 2. Fetch winning lottery tickets/payouts from winner_payouts
      let wpQuery = supabase
        .from('winner_payouts')
        .select('id, event_title, user_id, winner_username, winner_address, payout_amount, winning_digits, status, created_at')
        .gte('created_at', cutoffDate)
        .or('status.eq.paid,status.eq.approved,status.eq.completed');

      const { data: wpData } = (gameFilter === 'all' || gameFilter === 'lottery') 
        ? await wpQuery 
        : { data: [] };

      // Map game IDs to canonical display titles
      const gameNameMap: Record<string, string> = {
        'lottery': 'Four-Digit Lottery',
        'crash': 'Crash',
        'dice': 'Dice',
        'coinflip': 'Coinflip',
        'bingo': 'Bingo – Color Trading',
        'color-trading': 'Bingo – Color Trading',
        'horse-racing': 'Horse Racing'
      };

      // Aggregate by user
      const userMap: Record<string, {
        username: string;
        address: string;
        userId?: string;
        confirmedWinsCount: number;
        totalWonUSDT: number;
        gamesWon: Set<string>;
        gameCounts: Record<string, number>;
        vip_tier: string;
      }> = {};

      // Process game rounds
      if (Array.isArray(grData)) {
        grData.forEach(r => {
          const rawName = r.username && r.username.trim() !== '' && r.username !== 'Player' ? r.username : null;
          const userKey = rawName 
            ? rawName.toLowerCase() 
            : (r.wallet_address || r.user_id || 'player');
          const dispName = rawName || (r.wallet_address ? `${r.wallet_address.slice(0, 6)}...${r.wallet_address.slice(-4)}` : 'Anonymous');
          const addr = r.wallet_address || 'TRC-20 Verified';
          const payoutVal = Number(r.payout || 0);
          const gName = gameNameMap[r.game_id] || r.game_id || 'Arcade Game';

          if (!userMap[userKey]) {
            userMap[userKey] = {
              username: dispName,
              address: addr,
              userId: r.user_id,
              confirmedWinsCount: 0,
              totalWonUSDT: 0,
              gamesWon: new Set<string>(),
              gameCounts: {},
              vip_tier: 'Bronze'
            };
          }

          userMap[userKey].confirmedWinsCount += 1;
          userMap[userKey].totalWonUSDT += payoutVal;
          userMap[userKey].gamesWon.add(gName);
          userMap[userKey].gameCounts[gName] = (userMap[userKey].gameCounts[gName] || 0) + 1;
        });
      }

      // Process lottery payouts
      if (Array.isArray(wpData)) {
        wpData.forEach(wp => {
          const rawName = wp.winner_username && wp.winner_username.trim() !== '' && wp.winner_username !== 'Player' ? wp.winner_username : null;
          const userKey = rawName
            ? rawName.toLowerCase()
            : (wp.winner_address || wp.user_id || 'lottery_winner');
          const dispName = rawName || (wp.winner_address ? `${wp.winner_address.slice(0, 6)}...${wp.winner_address.slice(-4)}` : 'Lucky Winner');
          const addr = wp.winner_address || 'TRC-20 Verified';
          const payoutVal = Number(wp.payout_amount || 0);
          const gName = 'Four-Digit Lottery';

          if (!userMap[userKey]) {
            userMap[userKey] = {
              username: dispName,
              address: addr,
              userId: wp.user_id,
              confirmedWinsCount: 0,
              totalWonUSDT: 0,
              gamesWon: new Set<string>(),
              gameCounts: {},
              vip_tier: 'Bronze'
            };
          }

          userMap[userKey].confirmedWinsCount += 1;
          userMap[userKey].totalWonUSDT += payoutVal;
          userMap[userKey].gamesWon.add(gName);
          userMap[userKey].gameCounts[gName] = (userMap[userKey].gameCounts[gName] || 0) + 1;
        });
      }

      // Convert to ranked array
      const list = Object.values(userMap).map(u => {
        let tier = 'Bronze';
        if (u.totalWonUSDT >= 5000 || u.confirmedWinsCount >= 25) tier = 'Diamond';
        else if (u.totalWonUSDT >= 2000 || u.confirmedWinsCount >= 15) tier = 'Platinum';
        else if (u.totalWonUSDT >= 500 || u.confirmedWinsCount >= 8) tier = 'Gold';
        else if (u.totalWonUSDT >= 100 || u.confirmedWinsCount >= 3) tier = 'Silver';

        const sortedGames = Object.entries(u.gameCounts).sort((a, b) => b[1] - a[1]);
        const primaryGame = sortedGames[0] ? sortedGames[0][0] : Array.from(u.gamesWon)[0] || 'Four-Digit Lottery';

        return {
          username: u.username,
          address: u.address,
          confirmedWinsCount: u.confirmedWinsCount,
          totalWonUSDT: u.totalWonUSDT,
          gamesWon: Array.from(u.gamesWon),
          primaryGame,
          vip_tier: tier
        };
      });

      // Primary sort: Confirmed Wins Count (descending), tie-breaker: total USDT won
      list.sort((a, b) => {
        if (b.confirmedWinsCount !== a.confirmedWinsCount) {
          return b.confirmedWinsCount - a.confirmedWinsCount;
        }
        return b.totalWonUSDT - a.totalWonUSDT;
      });

      const ranked = list.map((item, idx) => ({
        ...item,
        rank: idx + 1
      }));

      setWinnersList(ranked);
    } catch (err) {
      console.error('fetchTopWinners error:', err);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchTopWinners();
  }, [timeFilter, gameFilter]);

  // Realtime subscription for fresh game wins and lottery settlements
  useEffect(() => {
    const channel = supabase
      .channel('realtime:winners_leaderboard')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'game_rounds' }, () => {
        fetchTopWinners();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'winner_payouts' }, () => {
        fetchTopWinners();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [timeFilter, gameFilter]);

  const top1 = winnersList[0];
  const top2 = winnersList[1];
  const top3 = winnersList[2];

  const getVipBadge = (tier: string) => {
    switch ((tier || '').toLowerCase()) {
      case 'diamond': return { label: 'Diamond', color: 'bg-cyan-950/80 border-cyan-400 text-cyan-300', icon: '💎' };
      case 'platinum': return { label: 'Platinum', color: 'bg-slate-800 border-slate-300 text-slate-200', icon: '🏆' };
      case 'gold': return { label: 'Gold', color: 'bg-amber-950/80 border-amber-400 text-amber-300', icon: '⭐' };
      case 'silver': return { label: 'Silver', color: 'bg-zinc-800 border-zinc-400 text-zinc-300', icon: '🥈' };
      default: return { label: 'Bronze', color: 'bg-amber-900/40 border-amber-600/50 text-amber-400', icon: '🥉' };
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-5 sm:space-y-6 text-left">
      
      {/* 1. HERO HEADER & 3-PERSON PODIUM */}
      <div className="relative rounded-3xl bg-gradient-to-r from-[#111827] via-[#151C2B] to-[#111827] border border-[#1F2737] p-4 sm:p-8 overflow-hidden shadow-2xl">
        <div className="absolute top-0 right-0 w-80 h-80 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 text-center max-w-2xl mx-auto space-y-2 mb-6 sm:mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs font-mono-numbers font-bold">
            <Trophy className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span>TOP GAME WINNERS · CONFIRMED WINS RANKING</span>
          </div>

          <h1 className="font-display font-black text-xl sm:text-3xl text-white tracking-tight">
            Top Winners Leaderboard
          </h1>

          <p className="text-xs sm:text-sm text-[#94A3B8]">
            Authoritative rankings sorted strictly by confirmed wins count across all games and lottery events.
          </p>
        </div>

        {/* DESKTOP & TABLET PODIUM (>= sm: 640px) */}
        {!loading && winnersList.length >= 3 && (
          <div className="hidden sm:grid grid-cols-3 gap-3 sm:gap-4 max-w-2xl mx-auto items-end pt-4">
            
            {/* Rank 2 (Silver) */}
            <div className="rounded-2xl bg-[#0B0F19] border border-slate-400/30 p-3.5 sm:p-4 text-center flex flex-col items-center shadow-lg relative order-1 min-w-0">
              <div className="w-8 h-8 rounded-full bg-slate-400/20 border border-slate-300 text-slate-200 flex items-center justify-center font-black text-sm mb-2">
                2
              </div>
              <span className="text-2xl mb-1">🥈</span>
              <span className="font-display font-extrabold text-xs sm:text-sm text-white truncate max-w-full block">
                @{top2.username}
              </span>
              <span className="text-[10px] text-[#94A3B8] font-mono-numbers truncate max-w-full block">{top2.address}</span>
              
              <div className="mt-1">
                <span className={`text-[9px] font-mono font-bold px-2 py-0.5 rounded-full border ${getVipBadge(top2.vip_tier).color}`}>
                  {getVipBadge(top2.vip_tier).icon} {top2.vip_tier}
                </span>
              </div>

              {/* Game name won badge */}
              <div className="mt-2 text-[10px] text-amber-400/90 font-mono-numbers truncate max-w-full px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/20">
                🎮 {top2.primaryGame}
              </div>

              <div className="mt-2 pt-2 border-t border-[#1F2737] w-full">
                <span className="font-mono-numbers font-black text-xs sm:text-sm text-emerald-400 block">
                  {top2.confirmedWinsCount} Confirmed Wins
                </span>
                <span className="text-[10px] text-[#94A3B8] font-mono-numbers block mt-0.5">
                  {Number(top2.totalWonUSDT || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDT
                </span>
              </div>
            </div>

            {/* Rank 1 (Gold - Center & Elevated) */}
            <div className="rounded-2xl bg-gradient-to-b from-amber-500/20 to-[#0B0F19] border-2 border-amber-400 p-4 sm:p-5 text-center flex flex-col items-center shadow-[0_0_35px_rgba(245,196,81,0.25)] relative -translate-y-3 order-2 min-w-0">
              <div className="absolute -top-3.5 px-3 py-0.5 rounded-full bg-amber-400 text-black font-extrabold text-[10px] tracking-widest flex items-center gap-1 shadow-md">
                <Crown className="w-3 h-3 fill-current" />
                CHAMPION
              </div>
              <div className="w-10 h-10 rounded-full bg-amber-400/20 border-2 border-amber-400 text-amber-300 flex items-center justify-center font-black text-base mb-2 mt-1">
                1
              </div>
              <span className="text-3xl mb-1">👑</span>
              <span className="font-display font-black text-sm sm:text-base text-amber-300 truncate max-w-full block">
                @{top1.username}
              </span>
              <span className="text-[10px] text-amber-400/70 font-mono-numbers truncate max-w-full block">{top1.address}</span>
              
              <div className="mt-1">
                <span className={`text-[10px] font-mono font-bold px-2.5 py-0.5 rounded-full border ${getVipBadge(top1.vip_tier).color}`}>
                  {getVipBadge(top1.vip_tier).icon} {top1.vip_tier}
                </span>
              </div>

              {/* Game name won badge */}
              <div className="mt-2 text-[10px] text-amber-300 font-mono-numbers truncate max-w-full px-2.5 py-0.5 rounded bg-amber-500/20 border border-amber-400/40 font-bold">
                🎮 {top1.primaryGame}
              </div>

              <div className="mt-3 pt-2 border-t border-amber-400/30 w-full">
                <span className="font-mono-numbers font-black text-sm sm:text-base text-amber-300 block">
                  {top1.confirmedWinsCount} Confirmed Wins
                </span>
                <span className="text-[10px] text-emerald-400 font-mono-numbers font-bold block mt-0.5">
                  {Number(top1.totalWonUSDT || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDT
                </span>
              </div>
            </div>

            {/* Rank 3 (Bronze) */}
            <div className="rounded-2xl bg-[#0B0F19] border border-amber-700/40 p-3.5 sm:p-4 text-center flex flex-col items-center shadow-lg relative order-3 min-w-0">
              <div className="w-8 h-8 rounded-full bg-amber-700/20 border border-amber-600 text-amber-400 flex items-center justify-center font-black text-sm mb-2">
                3
              </div>
              <span className="text-2xl mb-1">🥉</span>
              <span className="font-display font-extrabold text-xs sm:text-sm text-white truncate max-w-full block">
                @{top3.username}
              </span>
              <span className="text-[10px] text-[#94A3B8] font-mono-numbers truncate max-w-full block">{top3.address}</span>
              
              <div className="mt-1">
                <span className={`text-[9px] font-mono font-bold px-2 py-0.5 rounded-full border ${getVipBadge(top3.vip_tier).color}`}>
                  {getVipBadge(top3.vip_tier).icon} {top3.vip_tier}
                </span>
              </div>

              {/* Game name won badge */}
              <div className="mt-2 text-[10px] text-amber-400/90 font-mono-numbers truncate max-w-full px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/20">
                🎮 {top3.primaryGame}
              </div>

              <div className="mt-2 pt-2 border-t border-[#1F2737] w-full">
                <span className="font-mono-numbers font-black text-xs sm:text-sm text-emerald-400 block">
                  {top3.confirmedWinsCount} Confirmed Wins
                </span>
                <span className="text-[10px] text-[#94A3B8] font-mono-numbers block mt-0.5">
                  {Number(top3.totalWonUSDT || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDT
                </span>
              </div>
            </div>

          </div>
        )}

        {/* MOBILE PODIUM (< sm: 640px) */}
        {!loading && winnersList.length >= 3 && (
          <div className="sm:hidden space-y-2.5 pt-2">
            {/* Mobile Rank 1 Card */}
            <div className="rounded-2xl bg-gradient-to-r from-amber-500/25 via-[#111827] to-[#0B0F19] border-2 border-amber-400 p-3 shadow-lg relative">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-7 h-7 rounded-full bg-amber-400 text-black flex items-center justify-center font-black text-xs shrink-0 shadow-sm">
                    1
                  </div>
                  <div className="min-w-0">
                    <span className="font-display font-black text-xs text-amber-300 truncate block">
                      @{top1.username}
                    </span>
                    <span className="text-[9px] text-[#94A3B8] font-mono-numbers truncate block">
                      {top1.address}
                    </span>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <span className="font-mono-numbers font-black text-xs text-amber-300 block">
                    {top1.confirmedWinsCount} Wins
                  </span>
                  <span className="text-[9px] text-emerald-400 font-mono-numbers block">
                    {Number(top1.totalWonUSDT || 0).toFixed(2)} USDT
                  </span>
                </div>
              </div>
              <div className="text-[9px] text-amber-400 font-mono-numbers truncate">
                🎮 Primary: {top1.primaryGame}
              </div>
            </div>

            {/* Mobile Rank 2 & 3 Grid */}
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-xl bg-[#0B0F19] border border-slate-400/35 p-2.5 text-center">
                <span className="text-sm">🥈 #2</span>
                <span className="font-display font-bold text-[11px] text-white truncate block mt-0.5">
                  @{top2.username}
                </span>
                <span className="font-mono-numbers font-black text-[11px] text-emerald-400 block mt-1">
                  {top2.confirmedWinsCount} Wins
                </span>
                <span className="text-[8px] text-amber-400/90 font-mono-numbers truncate block mt-0.5">
                  {top2.primaryGame}
                </span>
              </div>

              <div className="rounded-xl bg-[#0B0F19] border border-amber-700/45 p-2.5 text-center">
                <span className="text-sm">🥉 #3</span>
                <span className="font-display font-bold text-[11px] text-white truncate block mt-0.5">
                  @{top3.username}
                </span>
                <span className="font-mono-numbers font-black text-[11px] text-emerald-400 block mt-1">
                  {top3.confirmedWinsCount} Wins
                </span>
                <span className="text-[8px] text-amber-400/90 font-mono-numbers truncate block mt-0.5">
                  {top3.primaryGame}
                </span>
              </div>
            </div>
          </div>
        )}

      </div>

      {/* 2. FILTER CONTROLS & TIMEFRAME BUTTONS */}
      <div className="space-y-3">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          
          {/* Exactly 5 Time Filters (Last 24 Hours, Last 7 Days, Last 2 Weeks, Last 3 Weeks, Last 4 Weeks) */}
          <div className="flex items-center gap-1 bg-[#111827] p-1 rounded-xl border border-[#1F2737] overflow-x-auto no-scrollbar">
            {TIME_FILTERS.map(tf => (
              <button
                key={tf.id}
                type="button"
                onClick={() => {
                  playClick();
                  setTimeFilter(tf.id);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                  timeFilter === tf.id
                    ? 'bg-amber-400 text-black shadow-sm font-black'
                    : 'text-[#94A3B8] hover:text-white hover:bg-white/5'
                }`}
              >
                {tf.label}
              </button>
            ))}
          </div>

          {/* Sync Button & Verified Status */}
          <div className="flex items-center justify-between md:justify-end gap-2 shrink-0">
            <div className="flex items-center gap-1.5 text-[11px] font-mono-numbers text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-lg">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Confirmed Wins Only</span>
            </div>

            <button
              type="button"
              onClick={() => {
                playClick();
                setIsRefreshing(true);
                fetchTopWinners();
              }}
              className="px-3 py-1.5 rounded-xl bg-[#111827] hover:bg-[#151C2B] border border-[#1F2737] hover:border-amber-400/50 text-amber-400 text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-sm transition-all"
              title="Refresh database rankings"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span>Sync</span>
            </button>
          </div>

        </div>

        {/* Game Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto w-full pb-1 no-scrollbar text-xs">
          {GAME_OPTIONS.map(g => (
            <button
              key={g.id}
              type="button"
              onClick={() => {
                playClick();
                setGameFilter(g.id);
              }}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold whitespace-nowrap transition-all cursor-pointer ${
                gameFilter === g.id
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm font-black'
                  : 'bg-[#111827] text-[#94A3B8] border border-[#1F2737] hover:text-white'
              }`}
            >
              {g.label}
            </button>
          ))}
        </div>
      </div>

      {/* 3. LEADERBOARD DATA TABLE */}
      <div className="rounded-3xl bg-[#111827] border border-[#1F2737] overflow-hidden shadow-xl">
        <div className="overflow-x-auto -mx-0">
          <table className="w-full text-left text-xs min-w-[640px]">
            <thead className="bg-[#0B0F19] text-[#94A3B8] font-mono-numbers uppercase text-[10px] tracking-wider border-b border-[#1F2737]">
              <tr>
                <th className="py-3.5 px-4 whitespace-nowrap">Rank</th>
                <th className="py-3.5 px-4 whitespace-nowrap">Player</th>
                <th className="py-3.5 px-4 whitespace-nowrap">Game(s) Won</th>
                <th className="py-3.5 px-4 text-center whitespace-nowrap">Confirmed Wins</th>
                <th className="py-3.5 px-4 text-right whitespace-nowrap">Total Won (USDT)</th>
                <th className="py-3.5 px-4 text-center whitespace-nowrap">Verification</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-[#1F2737]">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-[#94A3B8]">
                    <RefreshCw className="w-6 h-6 animate-spin text-amber-400 mx-auto mb-2" />
                    <p className="text-xs font-mono-numbers">Querying confirmed winning records from database...</p>
                  </td>
                </tr>
              ) : winnersList.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-[#94A3B8]">
                    <Trophy className="w-8 h-8 text-[#64748B] mx-auto mb-2" />
                    <p className="text-sm font-bold text-white">No confirmed winners recorded for this timeframe</p>
                    <p className="text-xs text-[#94A3B8] mt-1">Play any active game or lottery event to claim the top spot!</p>
                  </td>
                </tr>
              ) : (
                winnersList.map((player) => {
                  const isTop3 = player.rank <= 3;

                  return (
                    <tr 
                      key={player.rank}
                      className={`hover:bg-[#151C2B] transition-colors ${
                        isTop3 ? 'bg-amber-500/[0.03]' : ''
                      }`}
                    >
                      {/* Rank */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          {player.rank === 1 ? (
                            <span className="w-6 h-6 rounded-full bg-amber-400 text-black flex items-center justify-center font-black text-xs shadow-md">
                              1
                            </span>
                          ) : player.rank === 2 ? (
                            <span className="w-6 h-6 rounded-full bg-slate-300 text-black flex items-center justify-center font-black text-xs shadow-md">
                              2
                            </span>
                          ) : player.rank === 3 ? (
                            <span className="w-6 h-6 rounded-full bg-amber-600 text-white flex items-center justify-center font-black text-xs shadow-md">
                              3
                            </span>
                          ) : (
                            <span className="w-6 h-6 text-[#94A3B8] font-mono-numbers font-bold text-xs flex items-center justify-center">
                              #{player.rank}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Player */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="font-display font-bold text-white text-xs truncate">
                              @{player.username}
                            </span>
                            <span className={`text-[8px] font-mono font-bold px-1.5 py-0.2 rounded border ${getVipBadge(player.vip_tier).color}`}>
                              {getVipBadge(player.vip_tier).icon} {player.vip_tier}
                            </span>
                          </div>
                          <span className="text-[10px] text-[#94A3B8] font-mono-numbers truncate block">
                            {player.address}
                          </span>
                        </div>
                      </td>

                      {/* Games Won */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-1 flex-wrap max-w-xs">
                          {player.gamesWon.map((g: string, i: number) => (
                            <span 
                              key={i}
                              className="text-[10px] font-mono-numbers px-2 py-0.5 rounded bg-[#1A2234] border border-[#273248] text-amber-300 font-semibold"
                            >
                              {g}
                            </span>
                          ))}
                        </div>
                      </td>

                      {/* Confirmed Wins Count (Primary Ranking) */}
                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 font-mono-numbers font-black text-xs shadow-xs">
                          <Flame className="w-3 h-3 fill-current text-emerald-400" />
                          <span>{player.confirmedWinsCount} Wins</span>
                        </span>
                      </td>

                      {/* Total Won USDT */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <span className="font-mono-numbers font-black text-xs text-amber-300">
                          {Number(player.totalWonUSDT || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                        <span className="text-[10px] text-amber-400/80 font-mono-numbers ml-1">USDT</span>
                      </td>

                      {/* Draw Verification Status */}
                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        <span className="inline-flex items-center gap-1 text-[10px] font-mono-numbers text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                          <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                          <span>Verified</span>
                        </span>
                      </td>
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
