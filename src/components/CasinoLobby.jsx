import React, { useState, useMemo } from 'react';
import { GAMES, GAME_CATEGORIES } from '../engine';
import GameCard from './GameCard';
import LotteryCard from './LotteryCard';
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

export default function CasinoLobby({ onLaunchGame, onOpenLotteryRules }) {
  const { events, loadingEvents, setSelectedEventForModal, setActiveTab, user, setIsAuthModalOpen, showToast } = useLottery();

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

  // Active Lottery events
  const activeLotteryEvents = useMemo(() => {
    const now = Date.now();
    return events.filter(e => e.status === 'active' && (!e.drawTime || e.drawTime > now));
  }, [events]);

  const categories = [
    { id: 'all', label: 'All Games', count: GAMES.length },
    { id: 'lottery', label: 'Four-Digit Lottery', count: 1 },
    { id: 'instant', label: 'Instant Originals', count: 4 },
    { id: 'arcade', label: 'Arcade & Plinko', count: 3 },
    { id: 'table', label: 'Table & Cards', count: 3 },
    { id: 'slots', label: 'Slots', count: 1 }
  ];

  const handleGameSelect = (game) => {
    if (game.id === 'lottery') {
      // If lottery, open active round or scroll to pools
      if (activeLotteryEvents.length > 0) {
        if (!user) {
          setIsAuthModalOpen(true);
          showToast('Please log in to purchase lottery tickets!', 'info');
          return;
        }
        setSelectedEventForModal(activeLotteryEvents[0]);
      } else {
        const el = document.getElementById('lottery-pools-section');
        if (el) el.scrollIntoView({ behavior: 'smooth' });
      }
      return;
    }

    if (onLaunchGame) {
      onLaunchGame(game.id);
    }
  };

  return (
    <div className="space-y-8 sm:space-y-12 pb-12">
      
      {/* 1. HERO FEATURE CAROUSEL */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#151C2B] via-[#0B0F19] to-[#0B0F19] border border-amber-500/30 p-5 xs:p-7 sm:p-10 shadow-2xl">
        <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-b from-[#F5C451]/15 via-[#8B5CF6]/10 to-transparent rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-72 h-72 bg-[#22C55E]/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 max-w-3xl space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 font-mono-numbers text-xs font-bold">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>VIP Casino & Lottery Platform · 100% Social Entertainment</span>
          </div>

          <h1 className="font-display font-black text-2xl xs:text-3xl sm:text-5xl text-white tracking-tight leading-tight">
            Play 12 Modular Games with <span className="text-[#F5C451]">Flow Coins</span>
          </h1>

          <p className="text-xs sm:text-sm text-[#94A3B8] leading-relaxed max-w-2xl">
            Experience the Four-Digit Lottery, Crash, Dice, Mines, Plinko, Roulette, Blackjack, and Slots with cryptographic Provably Fair outcomes and free daily faucets.
          </p>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <button
              onClick={() => {
                const el = document.getElementById('casino-games-grid');
                if (el) el.scrollIntoView({ behavior: 'smooth' });
              }}
              className="px-6 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black font-extrabold text-xs sm:text-sm flex items-center gap-2 shadow-lg shadow-amber-500/25 transition-all cursor-pointer"
            >
              <Play className="w-4 h-4 fill-current" />
              <span>Explore All 12 Games</span>
            </button>

            <button
              onClick={() => {
                if (activeLotteryEvents.length > 0) {
                  if (!user) {
                    setIsAuthModalOpen(true);
                    return;
                  }
                  setSelectedEventForModal(activeLotteryEvents[0]);
                }
              }}
              className="px-5 py-3 rounded-xl bg-[#111827] hover:bg-[#151C2B] text-white border border-[#272A31] hover:border-amber-500/40 font-bold text-xs sm:text-sm flex items-center gap-2 transition-all cursor-pointer"
            >
              <Ticket className="w-4 h-4 text-amber-400" />
              <span>Enter 4-Digit Lottery</span>
            </button>
          </div>
        </div>
      </section>

      {/* 2. CATEGORY TABS & SEARCH CONTROLS */}
      <section id="casino-games-grid" className="space-y-5">
        
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
          
          {/* Category Pills */}
          <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto no-scrollbar pb-1">
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
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
          <div className="flex items-center gap-2.5">
            <div className="relative flex-1 sm:w-64">
              <Search className="w-4 h-4 text-[#94A3B8] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search games..."
                className="w-full bg-[#111827] border border-[#1F2737] focus:border-amber-500/50 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-[#64748B] outline-none"
              />
            </div>

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="bg-[#111827] border border-[#1F2737] focus:border-amber-500/50 rounded-xl px-3 py-2 text-xs text-[#94A3B8] outline-none cursor-pointer"
            >
              <option value="popular">Popular</option>
              <option value="rtp">Highest RTP</option>
              <option value="multiplier">Max Multiplier</option>
            </select>
          </div>

        </div>

        {/* 3. GAME CARDS GRID (12 MODULAR GAMES) */}
        {filteredGames.length === 0 ? (
          <div className="bg-[#111827] rounded-3xl border border-[#1F2737] p-12 text-center space-y-3">
            <Search className="w-10 h-10 text-[#64748B] mx-auto" />
            <h3 className="font-display font-bold text-lg text-white">No games found</h3>
            <p className="text-xs text-[#94A3B8]">Try adjusting your search query or selected category.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-5">
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

      {/* 4. PRESERVED FOUR-DIGIT LOTTERY ACTIVE ROUNDS SECTION */}
      <section id="lottery-pools-section" className="space-y-6 pt-6 border-t border-[#1F2737]">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-1.5 mb-1">
              <Ticket className="w-4 h-4 text-amber-400" />
              <span className="text-[10px] font-mono-numbers text-amber-400 uppercase font-bold tracking-wider">
                FEATURED GAME 01 · AUTHORITATIVE 0000–9999
              </span>
            </div>
            <h2 className="font-display font-black text-xl xs:text-2xl sm:text-3xl text-white">
              Active Four-Digit <span className="text-[#F5C451]">Lottery Rounds</span>
            </h2>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => onOpenLotteryRules && onOpenLotteryRules()}
              className="px-3 py-1.5 rounded-xl bg-[#111827] hover:bg-[#151C2B] text-xs font-bold text-amber-300 border border-amber-500/30 transition-colors cursor-pointer"
            >
              Lottery Rules
            </button>
            <button
              onClick={() => {
                if (!user) {
                  setIsAuthModalOpen(true);
                  showToast('Please log in to view lottery results!', 'info');
                  return;
                }
                setActiveTab('results');
              }}
              className="px-3 py-1.5 rounded-xl bg-[#111827] hover:bg-[#151C2B] text-xs font-bold text-white border border-[#272A31] transition-colors cursor-pointer"
            >
              Concluded Draws
            </button>
          </div>
        </div>

        {/* Lottery Cards Grid */}
        {loadingEvents ? (
          <div className="bg-[#111827] rounded-3xl border border-[#1F2737] p-8 text-center text-amber-400 text-xs font-mono-numbers">
            Loading active lottery pools...
          </div>
        ) : activeLotteryEvents.length === 0 ? (
          <div className="bg-[#111827] rounded-3xl border border-[#1F2737] p-8 text-center space-y-2">
            <Sparkles className="w-8 h-8 text-amber-400 mx-auto" />
            <h3 className="font-display font-bold text-base text-white">All Previous Rounds Concluded</h3>
            <p className="text-xs text-[#94A3B8]">Check Results tab to inspect past winners or await new rounds.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {activeLotteryEvents.map((evt) => (
              <LotteryCard
                key={evt.id}
                event={evt}
                onSelect={(selected) => {
                  if (!user) {
                    setIsAuthModalOpen(true);
                    showToast('Please log in to purchase lottery tickets!', 'info');
                    return;
                  }
                  setSelectedEventForModal(selected);
                }}
              />
            ))}
          </div>
        )}
      </section>

      {/* 5. PROVABLY FAIR & RESPONSIBLE GAMING SHOWCASE */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-6">
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
          <h3 className="font-display font-bold text-sm text-white">Daily Rewards & Faucets</h3>
          <p className="text-xs text-[#94A3B8] leading-relaxed">
            Claim 100 Flow Coins every 24 hours plus starter welcome grants to keep enjoying games with zero risk.
          </p>
        </div>
      </section>

    </div>
  );
}

