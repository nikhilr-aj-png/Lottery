import React, { useState } from 'react';
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
  UserCheck
} from 'lucide-react';

const MOCK_LEADERBOARD = [
  { rank: 1, username: 'VegasWhale', address: '0x1a8f...92d1', totalWonFC: 14820.50, biggestMult: 50.0, rounds: 312, favGame: 'Slots' },
  { rank: 2, username: 'CryptoLucky', address: '0x3c4b...88a2', totalWonFC: 11450.00, biggestMult: 36.0, rounds: 245, favGame: 'Roulette' },
  { rank: 3, username: 'AcesHigh', address: '0x7e2d...41f9', totalWonFC: 9820.25, biggestMult: 22.0, rounds: 198, favGame: 'Plinko' },
  { rank: 4, username: 'MoonRocket', address: '0x99a1...3b7c', totalWonFC: 8140.00, biggestMult: 18.25, rounds: 167, favGame: 'Crash' },
  { rank: 5, username: 'DiamondHands', address: '0x55d8...11e4', totalWonFC: 6920.80, biggestMult: 15.0, rounds: 142, favGame: 'Mines' },
  { rank: 6, username: 'TexasShark', address: '0x22c4...77d3', totalWonFC: 5800.50, biggestMult: 10.0, rounds: 115, favGame: 'Poker' },
  { rank: 7, username: 'LuckyStrike', address: '0x88f2...99c0', totalWonFC: 4950.00, biggestMult: 8.0, rounds: 98, favGame: 'Dice' },
  { rank: 8, username: 'GoldenCoin', address: '0x44b1...66a5', totalWonFC: 4210.00, biggestMult: 4.8, rounds: 84, favGame: 'Coinflip' },
  { rank: 9, username: 'KenoMaster', address: '0x11d9...22f8', totalWonFC: 3750.00, biggestMult: 45.0, rounds: 72, favGame: 'Keno' },
  { rank: 10, username: 'LimboKing', address: '0x66c7...33e1', totalWonFC: 3120.00, biggestMult: 12.4, rounds: 65, favGame: 'Limbo' }
];

export default function LeaderboardView() {
  const [timeFilter, setTimeFilter] = useState('all'); // 'all' | 'weekly' | 'today'
  const [metricFilter, setMetricFilter] = useState('earnings'); // 'earnings' | 'multiplier'
  const [searchQuery, setSearchQuery] = useState('');

  // Filtered leaderboard
  const filteredList = MOCK_LEADERBOARD
    .filter(p => 
      p.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.address.toLowerCase().includes(searchQuery.toLowerCase())
    )
    .sort((a, b) => {
      if (metricFilter === 'multiplier') {
        return b.biggestMult - a.biggestMult;
      }
      return b.totalWonFC - a.totalWonFC;
    });

  const top1 = filteredList[0];
  const top2 = filteredList[1];
  const top3 = filteredList[2];

  return (
    <div className="max-w-6xl mx-auto space-y-6 text-left">
      
      {/* 1. HEADER & PODIUM */}
      <div className="relative rounded-3xl bg-gradient-to-r from-[#111827] via-[#151C2B] to-[#111827] border border-[#1F2737] p-6 sm:p-8 overflow-hidden shadow-2xl">
        <div className="absolute top-0 right-0 w-80 h-80 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 text-center max-w-2xl mx-auto space-y-2 mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs font-mono-numbers font-bold">
            <Trophy className="w-3.5 h-3.5 text-amber-400" />
            <span>HALL OF FAME</span>
          </div>
          <h1 className="font-display font-black text-2xl sm:text-3xl text-white tracking-tight">
            Social High Rollers & Top Winners
          </h1>
          <p className="text-xs sm:text-sm text-[#94A3B8]">
            Recognizing the top Flow Coin earners across all 12 Provably Fair games and the Four-Digit Lottery.
          </p>
        </div>

        {/* 3-PERSON PODIUM */}
        {filteredList.length >= 3 && (
          <div className="grid grid-cols-3 gap-2 sm:gap-4 max-w-2xl mx-auto items-end pt-4">
            
            {/* Rank 2 (Silver) */}
            <div className="rounded-2xl bg-[#0B0F19] border border-slate-400/30 p-3 sm:p-4 text-center flex flex-col items-center shadow-lg relative order-1 sm:order-1">
              <div className="w-8 h-8 rounded-full bg-slate-400/20 border border-slate-300 text-slate-200 flex items-center justify-center font-black text-sm mb-2">
                2
              </div>
              <span className="text-2xl mb-1">🥈</span>
              <span className="font-display font-extrabold text-xs sm:text-sm text-white truncate max-w-full">
                @{top2.username}
              </span>
              <span className="text-[10px] text-[#94A3B8] font-mono-numbers">{top2.address}</span>
              <div className="mt-2 pt-2 border-t border-[#1F2737] w-full">
                <span className="font-mono-numbers font-black text-xs sm:text-sm text-slate-300 block">
                  {top2.totalWonFC.toLocaleString()} FC
                </span>
                <span className="text-[9px] text-[#64748B] uppercase">Top: {top2.biggestMult}x</span>
              </div>
            </div>

            {/* Rank 1 (Gold - Center & Elevated) */}
            <div className="rounded-2xl bg-gradient-to-b from-amber-500/20 to-[#0B0F19] border-2 border-amber-400 p-4 sm:p-5 text-center flex flex-col items-center shadow-[0_0_35px_rgba(245,196,81,0.25)] relative -translate-y-3 order-2 sm:order-2">
              <div className="absolute -top-3.5 px-3 py-0.5 rounded-full bg-amber-400 text-black font-extrabold text-[10px] tracking-widest flex items-center gap-1 shadow-md">
                <Crown className="w-3 h-3 fill-current" />
                CHAMPION
              </div>
              <div className="w-10 h-10 rounded-full bg-amber-400/20 border-2 border-amber-400 text-amber-300 flex items-center justify-center font-black text-base mb-2 mt-1">
                1
              </div>
              <span className="text-3xl mb-1">👑</span>
              <span className="font-display font-black text-sm sm:text-base text-white truncate max-w-full">
                @{top1.username}
              </span>
              <span className="text-[10px] text-amber-300/80 font-mono-numbers">{top1.address}</span>
              <div className="mt-2 pt-2 border-t border-amber-500/30 w-full">
                <span className="font-mono-numbers font-black text-sm sm:text-base text-amber-300 block">
                  {top1.totalWonFC.toLocaleString()} FC
                </span>
                <span className="text-[10px] text-amber-400 uppercase font-bold">Top: {top1.biggestMult}x</span>
              </div>
            </div>

            {/* Rank 3 (Bronze) */}
            <div className="rounded-2xl bg-[#0B0F19] border border-amber-800/40 p-3 sm:p-4 text-center flex flex-col items-center shadow-lg relative order-3 sm:order-3">
              <div className="w-8 h-8 rounded-full bg-amber-800/20 border border-amber-700 text-amber-500 flex items-center justify-center font-black text-sm mb-2">
                3
              </div>
              <span className="text-2xl mb-1">🥉</span>
              <span className="font-display font-extrabold text-xs sm:text-sm text-white truncate max-w-full">
                @{top3.username}
              </span>
              <span className="text-[10px] text-[#94A3B8] font-mono-numbers">{top3.address}</span>
              <div className="mt-2 pt-2 border-t border-[#1F2737] w-full">
                <span className="font-mono-numbers font-black text-xs sm:text-sm text-amber-600 block">
                  {top3.totalWonFC.toLocaleString()} FC
                </span>
                <span className="text-[9px] text-[#64748B] uppercase">Top: {top3.biggestMult}x</span>
              </div>
            </div>

          </div>
        )}
      </div>

      {/* 2. FILTERS & SEARCH CONTROLS */}
      <div className="rounded-2xl bg-[#111827] border border-[#1F2737] p-4 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-lg">
        {/* Metric Tabs */}
        <div className="flex items-center gap-1.5 w-full sm:w-auto">
          <button
            onClick={() => setMetricFilter('earnings')}
            className={`flex-1 sm:flex-none px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              metricFilter === 'earnings'
                ? 'bg-amber-500 text-black shadow-md'
                : 'bg-[#0B0F19] text-[#94A3B8] hover:text-white border border-[#1F2737]'
            }`}
          >
            Total Flow Coins Won
          </button>
          <button
            onClick={() => setMetricFilter('multiplier')}
            className={`flex-1 sm:flex-none px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              metricFilter === 'multiplier'
                ? 'bg-amber-500 text-black shadow-md'
                : 'bg-[#0B0F19] text-[#94A3B8] hover:text-white border border-[#1F2737]'
            }`}
          >
            Highest Multipliers
          </button>
        </div>

        {/* Search Input */}
        <div className="flex items-center bg-[#0B0F19] border border-[#1F2737] focus-within:border-amber-500/50 rounded-xl px-3 py-1.5 w-full sm:w-64">
          <Search className="w-3.5 h-3.5 text-[#94A3B8] mr-2 shrink-0" />
          <input
            type="text"
            placeholder="Search player or address..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-transparent text-xs text-white placeholder-[#64748B] outline-none"
          />
        </div>
      </div>

      {/* 3. LEADERBOARD TABLE */}
      <div className="rounded-3xl bg-[#111827] border border-[#1F2737] overflow-hidden shadow-xl">
        <div className="overflow-x-auto no-scrollbar">
          <table className="w-full text-left text-xs font-mono-numbers">
            <thead className="bg-[#0B0F19] text-[#94A3B8] uppercase text-[10px] tracking-wider border-b border-[#1F2737]">
              <tr>
                <th className="py-3 px-4">Rank</th>
                <th className="py-3 px-4">Player</th>
                <th className="py-3 px-4">Favorite Game</th>
                <th className="py-3 px-4">Top Multiplier</th>
                <th className="py-3 px-4 text-right">Total FC Won</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1F2737]/60">
              {filteredList.map((player) => (
                <tr key={player.rank} className="hover:bg-white/2 transition-colors">
                  <td className="py-3 px-4 font-black">
                    {player.rank === 1 ? '🥇 #1' :
                     player.rank === 2 ? '🥈 #2' :
                     player.rank === 3 ? '🥉 #3' : `#${player.rank}`}
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-[#151C2B] border border-amber-500/30 flex items-center justify-center font-bold text-xs text-amber-300 shrink-0">
                        {player.username[0]}
                      </div>
                      <div>
                        <span className="font-display font-bold text-white block">
                          @{player.username}
                        </span>
                        <span className="text-[10px] text-[#64748B]">{player.address}</span>
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-[#94A3B8]">
                    <span className="px-2 py-0.5 rounded bg-[#0B0F19] border border-[#1F2737] text-[11px] font-sans">
                      {player.favGame}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-amber-300 font-bold">
                    {player.biggestMult.toFixed(1)}x
                  </td>
                  <td className="py-3 px-4 text-right font-black text-emerald-400">
                    +{player.totalWonFC.toLocaleString()} FC
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}

