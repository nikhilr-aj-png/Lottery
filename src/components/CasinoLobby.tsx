import React, { useState, useMemo } from 'react';
import { GAMES, GAME_CATEGORIES } from '../engine';
import GameCard from './GameCard';
import { useLottery } from '../context/LotteryContext';
import { 
  Flame, 
  Search, 
  Filter, 
  Sparkles, 
  Trophy, 
  ShieldCheck, 
  Coins, 
  ArrowRight,
  TrendingUp,
  Ticket,
  Rocket,
  Dices,
  Play
} from 'lucide-react';

interface CasinoLobbyProps {
  onLaunchGame: (gameId: string) => void;
  onOpenLotteryRules?: () => void;
}

export default function CasinoLobby({ onLaunchGame, onOpenLotteryRules }: CasinoLobbyProps) {
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('popular'); // 'popular' | 'rtp' | 'multiplier'

  // Filter & Sort Games
  const filteredGames = useMemo(() => {
    let list = [...GAMES];

    // Filter by Category
    if (selectedCategory !== 'all') {
      list = list.filter(g => {
        if (selectedCategory === 'instant') return g.category === 'instant';
        if (selectedCategory === 'arcade') return g.category === 'arcade';
        if (selectedCategory === 'table') return g.category === 'table' || g.category === 'card';
        if (selectedCategory === 'slots') return g.category === 'slots';
        if (selectedCategory === 'lottery') return g.category === 'lottery';
        return true;
      });
    }

    // Filter by Search Query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(g => 
        g.name.toLowerCase().includes(q) || 
        g.description.toLowerCase().includes(q) || 
        g.category.toLowerCase().includes(q)
      );
    }

    // Sort
    if (sortBy === 'rtp') {
      list.sort((a, b) => b.rtp - a.rtp);
    } else if (sortBy === 'multiplier') {
      list.sort((a, b) => b.maxMultiplier - a.maxMultiplier);
    }

    return list;
  }, [selectedCategory, searchQuery, sortBy]);

  const categories = [
    { id: 'all', label: 'All Games', count: GAMES.length },
    { id: 'lottery', label: 'Four-Digit Lottery', count: 1 },
    { id: 'instant', label: 'Instant Originals', count: 4 },
    { id: 'arcade', label: 'Arcade & Plinko', count: 3 },
    { id: 'table', label: 'Table & Cards', count: 3 },
    { id: 'slots', label: 'Slots', count: 1 }
  ];

  const handleGameSelect = (game) => {
    if (onLaunchGame) {
      onLaunchGame(game.slug || game.id);
    }
  };

  return (
    <div className="space-y-6 sm:space-y-8 pb-2 sm:pb-3">
      
      {/* 1. HERO FEATURE CAROUSEL & BALANCED SHOWCASE */}
      <section className="relative overflow-hidden rounded-2xl sm:rounded-3xl bg-gradient-to-br from-[#151C2B] via-[#0F1420] to-[#0B0F19] border border-amber-500/30 p-4 xs:p-5 sm:p-7 lg:p-9 shadow-2xl">
        <div className="absolute top-0 right-0 w-80 sm:w-96 h-80 sm:h-96 bg-gradient-to-b from-[#F5C451]/15 via-[#8B5CF6]/10 to-transparent rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-60 sm:w-72 h-60 sm:h-72 bg-[#22C55E]/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-6 lg:gap-8">
          
          {/* LEFT COLUMN: Hero Copy & Actions */}
          <div className="flex-1 space-y-3.5 sm:space-y-4 max-w-2xl min-w-0">
            <div className="inline-flex items-start xs:items-center gap-1.5 xs:gap-2 px-2.5 xs:px-3 py-1 sm:py-1.5 rounded-2xl xs:rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 font-mono-numbers text-[10px] xs:text-xs font-bold max-w-full leading-tight">
              <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5 xs:mt-0" />
              <span className="whitespace-normal break-words sm:whitespace-nowrap">
                VIP Casino & Lottery Platform <span className="opacity-60 hidden xs:inline">·</span> <span className="block xs:inline text-amber-200/90">100% Social Entertainment</span>
              </span>
            </div>

            <h1 
              className="font-display font-black text-white tracking-tight leading-[1.15]"
              style={{ fontSize: 'clamp(1.4rem, 3.2vw + 0.5rem, 2.75rem)' }}
            >
              Play 12 Modular Games with <span className="text-[#F5C451]">Flow Coins</span>
            </h1>

            <p className="text-xs sm:text-sm text-[#94A3B8] leading-relaxed max-w-xl">
              Experience the Four-Digit Lottery, Crash, Dice, Mines, Plinko, Roulette, Blackjack, and Slots with cryptographic Provably Fair outcomes and free daily faucets.
            </p>

            {/* CTA Buttons: Stack vertically on mobile (< 640px), side-by-side on tablet/desktop */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 sm:gap-3 pt-1.5 w-full sm:w-auto">
              <button
                onClick={() => {
                  const el = document.getElementById('casino-games-grid');
                  if (el) el.scrollIntoView({ behavior: 'smooth' });
                }}
                className="w-full sm:w-auto px-5 sm:px-6 py-2.5 sm:py-3 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black font-extrabold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg shadow-amber-500/25 transition-all cursor-pointer"
              >
                <Play className="w-3.5 h-3.5 sm:w-4 sm:h-4 fill-current shrink-0" />
                <span>Explore All 12 Games</span>
              </button>

              <button
                onClick={() => {
                  handleGameSelect({ id: 'lottery', slug: 'four-digit-lottery' });
                }}
                className="w-full sm:w-auto px-5 sm:px-6 py-2.5 sm:py-3 rounded-xl bg-[#111827] hover:bg-[#151C2B] text-white border border-[#272A31] hover:border-amber-500/40 font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                <Ticket className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-400 shrink-0" />
                <span>Enter 4-Digit Lottery</span>
              </button>
            </div>
          </div>

          {/* RIGHT COLUMN: Balanced VIP Showcase Panel (Visible on lg: 1024px+, fills unused space) */}
          <div className="hidden lg:flex flex-col gap-3 w-72 xl:w-80 shrink-0 bg-[#0B0F19]/80 border border-amber-500/20 rounded-2xl p-4 shadow-xl backdrop-blur-md">
            
            {/* Platform Parity Status Card */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-[#111827] border border-[#1F2737]">
              <div>
                <span className="text-[10px] font-mono-numbers uppercase text-[#94A3B8] font-bold block">
                  Platform Parity
                </span>
                <span className="font-display font-black text-amber-300 text-sm">
                  1 FLO = 1 USDT
                </span>
              </div>
              <div className="px-2.5 py-1 rounded-lg bg-amber-500/15 text-amber-400 border border-amber-500/30 text-xs font-bold font-mono-numbers flex items-center gap-1">
                <Coins className="w-3.5 h-3.5" />
                <span>FLO</span>
              </div>
            </div>

            {/* Cryptographic Provably Fair Trust Banner */}
            <div className="p-3 rounded-xl bg-[#111827] border border-[#1F2737] space-y-1">
              <div className="flex items-center gap-1.5 text-emerald-400 text-xs font-bold">
                <ShieldCheck className="w-4 h-4 shrink-0" />
                <span>100% Provably Fair</span>
              </div>
              <p className="text-[10px] text-[#94A3B8] leading-tight">
                SHA-256 pre-commit seeds & client seed rotations. Every round independently verifiable.
              </p>
            </div>

            {/* Featured Four-Digit Lottery Card */}
            <div className="p-3 rounded-xl bg-gradient-to-r from-amber-500/10 to-purple-500/10 border border-amber-500/30 flex items-center justify-between">
              <div>
                <span className="text-[9px] font-mono-numbers text-amber-400 font-bold block">
                  FEATURED LOTTERY
                </span>
                <span className="font-mono-numbers text-xs font-extrabold text-white">
                  0000–9999
                </span>
              </div>
              <button
                onClick={() => {
                  handleGameSelect({ id: 'lottery', slug: 'four-digit-lottery' });
                }}
                className="px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-black font-extrabold text-[10px] cursor-pointer transition-all"
              >
                Play Now
              </button>
            </div>

          </div>

        </div>
      </section>

      {/* 2. CATEGORY TABS & SEARCH CONTROLS */}
      <section id="casino-games-grid" className="space-y-4 sm:space-y-5">
        
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 sm:gap-4">
          
          {/* Category Pills: Horizontally scrollable on mobile/tablet, smooth touch dragging, zero page blowout */}
          <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto no-scrollbar py-1 -my-1">
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`min-h-[40px] px-3 xs:px-3.5 py-1.5 sm:py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 shrink-0 select-none ${
                  selectedCategory === cat.id
                    ? 'bg-amber-500 text-black font-extrabold shadow-md shadow-amber-500/20'
                    : 'bg-[#111827] hover:bg-[#151C2B] text-[#94A3B8] hover:text-white border border-[#1F2737]'
                }`}
              >
                <span>{cat.label}</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono-numbers ${
                  selectedCategory === cat.id ? 'bg-black/40 text-amber-300' : 'bg-black/30 text-[#64748B]'
                }`}>
                  {cat.count}
                </span>
              </button>
            ))}
          </div>

          {/* Search & Sort Controls */}
          <div className="flex items-center gap-2 sm:gap-2.5 shrink-0 w-full md:w-auto">
            <div className="relative flex-1 md:w-56 lg:w-64">
              <Search className="w-4 h-4 text-[#94A3B8] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search games..."
                className="w-full min-h-[40px] bg-[#111827] border border-[#1F2737] focus:border-amber-500/50 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-[#64748B] outline-none"
              />
            </div>

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="min-h-[40px] bg-[#111827] border border-[#1F2737] focus:border-amber-500/50 rounded-xl px-3 py-2 text-xs text-[#94A3B8] outline-none cursor-pointer shrink-0"
            >
              <option value="popular">Popular</option>
              <option value="rtp">Highest RTP</option>
              <option value="multiplier">Max Multiplier</option>
            </select>
          </div>

        </div>

        {/* 3. GAME CARDS GRID (12 MODULAR GAMES - RESPONSIVE 1-TO-6 COLUMNS) */}
        {filteredGames.length === 0 ? (
          <div className="bg-[#111827] rounded-3xl border border-[#1F2737] p-12 text-center space-y-3">
            <Search className="w-10 h-10 text-[#64748B] mx-auto" />
            <h3 className="font-display font-bold text-lg text-white">No games found</h3>
            <p className="text-xs text-[#94A3B8]">Try adjusting your search query or selected category.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 xs:grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 2xl:grid-cols-4 3xl:grid-cols-5 4k:grid-cols-6 gap-3.5 xs:gap-4 sm:gap-5">
            {filteredGames.map((game) => (
              <GameCard
                key={game.id}
                game={game}
                onPlay={() => handleGameSelect(game)}
              />
            ))}
          </div>
        )}

      </section>

      {/* 4. PROVABLY FAIR & RESPONSIBLE GAMING SHOWCASE */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-6 border-t border-[#1F2737]">
        <div className="bg-[#111827] p-5 rounded-2xl border border-[#1F2737] space-y-2">
          <div className="w-9 h-9 rounded-xl bg-amber-500/15 text-amber-400 flex items-center justify-center">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <h3 className="font-display font-bold text-sm text-white">Provably Fair SHA-256</h3>
          <p className="text-xs text-[#94A3B8] leading-relaxed">
            Every game round utilizes pre-committed server seeds and active client seeds to guarantee immutable fairness.
          </p>
        </div>

        <div className="bg-[#111827] p-5 rounded-2xl border border-[#1F2737] space-y-2">
          <div className="w-9 h-9 rounded-xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center">
            <Coins className="w-5 h-5" />
          </div>
          <h3 className="font-display font-bold text-sm text-white">Flow Coin Virtual Currency</h3>
          <p className="text-xs text-[#94A3B8] leading-relaxed">
            Free-to-play social entertainment using non-transferable credits. No real-money gambling or deposits.
          </p>
        </div>

        <div className="bg-[#111827] p-5 rounded-2xl border border-[#1F2737] space-y-2">
          <div className="w-9 h-9 rounded-xl bg-purple-500/15 text-purple-400 flex items-center justify-center">
            <TrendingUp className="w-5 h-5" />
          </div>
          <h3 className="font-display font-bold text-sm text-white">Daily FLO Coin Rewards</h3>
          <p className="text-xs text-[#94A3B8] leading-relaxed">
            Claim random daily FLO Coin rewards inside your Wallet (up to 1 FLO = 1 USDT) to enjoy games with zero risk.
          </p>
        </div>
      </section>

    </div>
  );
}

