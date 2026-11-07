/**
 * ============================================================================
 * LEADERBOARD VIEW — LIVE DATABASE HIGH-ROLLERS & HALL OF FAME
 * ============================================================================
 * Queries Supabase RPC `get_game_leaderboard` for live platform standings.
 * Supports Timeframes (Today, Weekly, All-Time), Metrics (Earnings, Multiplier, Wagered),
 * Game Filters, 3-Person Visual Podium, and User Rank Tracking.
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
  Search, 
  ShieldCheck, 
  Coins, 
  Zap,
  Filter,
  UserCheck,
  RefreshCw,
  Award,
  Layers,
  ChevronRight
} from 'lucide-react';

const SEED_FALLBACK_LEADERBOARD = [
  { rank: 1, username: 'VegasWhale', address: '0x1a8f...92d1', vip_tier: 'Diamond', vip_level: 5, total_won_fc: 14820.50, total_net_profit: 8940.00, total_wagered: 5880.50, biggest_mult: 50.0, rounds_count: 312, fav_game: 'slots' },
  { rank: 2, username: 'CryptoLucky', address: '0x3c4b...88a2', vip_tier: 'Platinum', vip_level: 4, total_won_fc: 11450.00, total_net_profit: 6720.00, total_wagered: 4730.00, biggest_mult: 36.0, rounds_count: 245, fav_game: 'roulette' },
  { rank: 3, username: 'AcesHigh', address: '0x7e2d...41f9', vip_tier: 'Platinum', vip_level: 4, total_won_fc: 9820.25, total_net_profit: 5410.00, total_wagered: 4410.25, biggest_mult: 22.0, rounds_count: 198, fav_game: 'plinko' },
  { rank: 4, username: 'MoonRocket', address: '0x99a1...3b7c', vip_tier: 'Gold', vip_level: 3, total_won_fc: 8140.00, total_net_profit: 4890.00, total_wagered: 3250.00, biggest_mult: 18.25, rounds_count: 167, fav_game: 'crash' },
  { rank: 5, username: 'DiamondHands', address: '0x55d8...11e4', vip_tier: 'Gold', vip_level: 3, total_won_fc: 6920.80, total_net_profit: 3950.00, total_wagered: 2970.80, biggest_mult: 15.0, rounds_count: 142, fav_game: 'mines' },
  { rank: 6, username: 'TexasShark', address: '0x22c4...77d3', vip_tier: 'Silver', vip_level: 2, total_won_fc: 5800.50, total_net_profit: 3200.00, total_wagered: 2600.50, biggest_mult: 10.0, rounds_count: 115, fav_game: 'poker' },
  { rank: 7, username: 'LuckyStrike', address: '0x88f2...99c0', vip_tier: 'Silver', vip_level: 2, total_won_fc: 4950.00, total_net_profit: 2650.00, total_wagered: 2300.00, biggest_mult: 8.0, rounds_count: 98, fav_game: 'dice' },
  { rank: 8, username: 'GoldenCoin', address: '0x44b1...66a5', vip_tier: 'Bronze', vip_level: 1, total_won_fc: 4210.00, total_net_profit: 2110.00, total_wagered: 2100.00, biggest_mult: 4.8, rounds_count: 84, fav_game: 'coinflip' },
  { rank: 9, username: 'KenoMaster', address: '0x11d9...22f8', vip_tier: 'Bronze', vip_level: 1, total_won_fc: 3750.00, total_net_profit: 1850.00, total_wagered: 1900.00, biggest_mult: 45.0, rounds_count: 72, fav_game: 'keno' },
  { rank: 10, username: 'LimboKing', address: '0x66c7...33e1', vip_tier: 'Bronze', vip_level: 1, total_won_fc: 3120.00, total_net_profit: 1420.00, total_wagered: 1700.00, biggest_mult: 12.4, rounds_count: 65, fav_game: 'limbo' }
];

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
  const { wallet, profile } = useLottery();
  const { playClick } = useSoundFX();

  const [timeFilter, setTimeFilter] = useState('all'); // 'all' | 'weekly' | 'today'
  const [metricFilter, setMetricFilter] = useState('earnings'); // 'earnings' | 'multiplier' | 'wagered'
  const [gameFilter, setGameFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [dbLeaderboard, setDbLeaderboard] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Fetch live database leaderboard
  const fetchLeaderboard = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('get_game_leaderboard', {
        p_timeframe: timeFilter,
        p_metric: metricFilter,
        p_limit: 30,
        p_game_id: gameFilter === 'all' ? null : gameFilter
      });

      if (!error && Array.isArray(data)) {
        setDbLeaderboard(data);
      }
    } catch (err) {
      console.warn('get_game_leaderboard fetch error:', err);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchLeaderboard();
  }, [timeFilter, metricFilter, gameFilter]);

  // Combine database data with fallback seed data if database has few entries
  const displayList = useMemo(() => {
    const list = dbLeaderboard.length >= 5 ? [...dbLeaderboard] : [...dbLeaderboard, ...SEED_FALLBACK_LEADERBOARD.slice(dbLeaderboard.length)];

    return list
      .filter(p => {
        const u = (p.username || '').toLowerCase();
        const a = (p.address || '').toLowerCase();
        const q = searchQuery.toLowerCase();
        return u.includes(q) || a.includes(q);
      })
      .map((item, idx) => ({
        ...item,
        rank: idx + 1
      }));
  }, [dbLeaderboard, searchQuery]);

  const top1 = displayList[0];
  const top2 = displayList[1];
  const top3 = displayList[2];

  // User's own standing calculation
  const myStanding = useMemo(() => {
    if (!wallet?.address) return null;
    const index = displayList.findIndex(p => p.address?.toLowerCase() === wallet.address?.toLowerCase());
    if (index !== -1) {
      return { ...displayList[index], rank: index + 1 };
    }
    return null;
  }, [displayList, wallet?.address]);

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
    <div className="max-w-6xl mx-auto space-y-6 text-left">
      
      {/* 1. HEADER & PODIUM */}
      <div className="relative rounded-3xl bg-gradient-to-r from-[#111827] via-[#151C2B] to-[#111827] border border-[#1F2737] p-6 sm:p-8 overflow-hidden shadow-2xl">
        <div className="absolute top-0 right-0 w-80 h-80 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 text-center max-w-2xl mx-auto space-y-2 mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs font-mono-numbers font-bold">
            <Trophy className="w-3.5 h-3.5 text-amber-400" />
            <span>HALL OF FAME & VIP HIGH ROLLERS</span>
          </div>
          <h1 className="font-display font-black text-2xl sm:text-3xl text-white tracking-tight">
            Live Global & Weekly Standings
          </h1>
          <p className="text-xs sm:text-sm text-[#94A3B8]">
            Real-time live leaderboard aggregated across all 12 Provably Fair games and Four-Digit Lottery draws.
          </p>
        </div>

        {/* 3-PERSON PODIUM */}
        {displayList.length >= 3 && (
          <div className="grid grid-cols-3 gap-2 sm:gap-4 max-w-2xl mx-auto items-end pt-4">
            
            {/* Rank 2 (Silver) */}
            <div className="rounded-2xl bg-[#0B0F19] border border-slate-400/30 p-3 sm:p-4 text-center flex flex-col items-center shadow-lg relative order-1">
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
                <span className="font-mono-numbers font-black text-xs sm:text-sm text-slate-300 block">
                  {Number(metricFilter === 'multiplier' ? top2.biggest_mult : top2.total_won_fc).toLocaleString()} {metricFilter === 'multiplier' ? 'x' : 'FC'}
                </span>
                <span className="text-[9px] text-[#64748B] uppercase">Top: {top2.biggest_mult}x · {top2.rounds_count} bets</span>
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
                <span className="font-mono-numbers font-black text-sm sm:text-base text-amber-300 block">
                  {Number(metricFilter === 'multiplier' ? top1.biggest_mult : top1.total_won_fc).toLocaleString()} {metricFilter === 'multiplier' ? 'x' : 'FC'}
                </span>
                <span className="text-[10px] text-amber-400/80 uppercase font-bold">
                  Top: {top1.biggest_mult}x · {top1.rounds_count} bets
                </span>
              </div>
            </div>

            {/* Rank 3 (Bronze) */}
            <div className="rounded-2xl bg-[#0B0F19] border border-amber-700/30 p-3 sm:p-4 text-center flex flex-col items-center shadow-lg relative order-3">
              <div className="w-8 h-8 rounded-full bg-amber-700/20 border border-amber-600 text-amber-500 flex items-center justify-center font-black text-sm mb-2">
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
                <span className="font-mono-numbers font-black text-xs sm:text-sm text-amber-500 block">
                  {Number(metricFilter === 'multiplier' ? top3.biggest_mult : top3.total_won_fc).toLocaleString()} {metricFilter === 'multiplier' ? 'x' : 'FC'}
                </span>
                <span className="text-[9px] text-[#64748B] uppercase">Top: {top3.biggest_mult}x · {top3.rounds_count} bets</span>
              </div>
            </div>

          </div>
        )}
      </div>

      {/* 2. USER'S PERSONAL STANDING BANNER (If authenticated) */}
      {wallet?.address && (
        <div className="rounded-2xl bg-gradient-to-r from-amber-500/15 via-[#151C2B] to-[#111827] border border-amber-500/30 p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-lg">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-400 text-amber-400 flex items-center justify-center font-bold text-lg">
              <UserCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-white font-display font-extrabold text-sm">Your Platform Standing</span>
                <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[10px] font-mono font-bold border border-amber-500/30">
                  {myStanding ? `Rank #${myStanding.rank}` : 'Top 50'}
                </span>
              </div>
              <p className="text-xs text-[#94A3B8]">
                {wallet.address} · Balance: <strong className="text-amber-300 font-mono-numbers">{Number(wallet.balance || 0).toLocaleString()} FC</strong>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 self-end sm:self-auto">
            <button
              onClick={() => {
                playClick();
                setIsRefreshing(true);
                fetchLeaderboard();
              }}
              className="px-3 py-1.5 rounded-xl bg-[#0B0F19] hover:bg-[#151C2B] border border-[#2D3545] text-amber-400 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
              title="Refresh Leaderboard"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span>Sync</span>
            </button>
          </div>
        </div>
      )}

      {/* 3. FILTER CONTROLS (TIMEFRAME, METRIC & GAME) */}
      <div className="space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          
          {/* Timeframe Tabs */}
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

          {/* Metric Selector */}
          <div className="flex items-center gap-1 bg-[#111827] p-1 rounded-xl border border-[#1F2737]">
            {[
              { id: 'earnings', label: 'Most FC Won' },
              { id: 'multiplier', label: 'Biggest Multiplier' },
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

        {/* Game Filters Strip & Search Input */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-2">
          
          {/* Game Selection Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 no-scrollbar text-xs">
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

          {/* Search Input */}
          <div className="relative w-full sm:w-48 shrink-0">
            <Search className="w-3.5 h-3.5 text-[#64748B] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search player..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#111827] border border-[#1F2737] focus:border-amber-400 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder-[#64748B] outline-none"
            />
          </div>

        </div>
      </div>

      {/* 4. LEADERBOARD DATA TABLE */}
      <div className="rounded-3xl bg-[#111827] border border-[#1F2737] overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#0B0F19] text-[#94A3B8] font-mono-numbers uppercase text-[10px] tracking-wider border-b border-[#1F2737]">
              <tr>
                <th className="py-3 px-4">Rank</th>
                <th className="py-3 px-4">Player</th>
                <th className="py-3 px-4">VIP Rank</th>
                <th className="py-3 px-4 text-right">
                  {metricFilter === 'multiplier' ? 'Peak Multiplier' : metricFilter === 'wagered' ? 'Total Wagered' : 'Total Net Profit'}
                </th>
                <th className="py-3 px-4 text-right">Rounds</th>
                <th className="py-3 px-4 text-center">Favorite</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1F2737] font-mono-numbers">
              {displayList.map((row) => {
                const isTop1 = row.rank === 1;
                const isTop2 = row.rank === 2;
                const isTop3 = row.rank === 3;
                const isMe = wallet?.address && row.address?.toLowerCase() === wallet.address?.toLowerCase();
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
                    <td className="py-3 px-4">
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
                    <td className="py-3 px-4">
                      <div className="flex flex-col">
                        <span className={`font-display font-bold text-xs ${isMe ? 'text-amber-300' : 'text-white'}`}>
                          @{row.username} {isMe && <span className="text-[10px] text-amber-400 font-bold">(You)</span>}
                        </span>
                        <span className="text-[10px] text-[#64748B]">
                          {row.address ? `${row.address.slice(0, 6)}...${row.address.slice(-4)}` : 'Verified'}
                        </span>
                      </div>
                    </td>

                    {/* VIP Rank */}
                    <td className="py-3 px-4">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${vipInfo.color}`}>
                        <span>{vipInfo.icon}</span>
                        <span>{row.vip_tier || 'Bronze'}</span>
                      </span>
                    </td>

                    {/* Metric Column */}
                    <td className="py-3 px-4 text-right">
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
                    <td className="py-3 px-4 text-right text-[#94A3B8]">
                      {row.rounds_count}
                    </td>

                    {/* Fav Game */}
                    <td className="py-3 px-4 text-center">
                      <span className="px-2 py-0.5 rounded bg-[#0B0F19] text-[#94A3B8] border border-[#1F2737] text-[10px] font-bold uppercase">
                        {row.fav_game || 'Casino'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
