import React, { useState, useEffect, useMemo } from 'react';
import { GAMES, GAME_CATEGORIES } from '../engine';
import GameCard from './GameCard';
import { useLottery } from '../context/LotteryContext';
import { supabase } from '../lib/supabase';
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
  Play,
  Lock,
  FileText,
  Mail,
  Zap,
  CheckCircle2
} from 'lucide-react';

interface CasinoLobbyProps {
  onLaunchGame: (gameId: string) => void;
  onOpenLotteryRules?: () => void;
}

export default function CasinoLobby({ onLaunchGame, onOpenLotteryRules }: CasinoLobbyProps) {
  const { games: dynamicGames, events, setActiveTab } = useLottery();
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('popular'); // 'popular' | 'rtp' | 'multiplier'

  // Dynamic database-driven games list (strictly excludes deleted/disabled items)
  const availableGames = useMemo(() => {
    if (Array.isArray(dynamicGames) && dynamicGames.length > 0) {
      return dynamicGames.filter(g => g.isEnabled && g.status !== 'deleted');
    }
    return GAMES;
  }, [dynamicGames]);

  // Real backend usage stats for dynamic popularity ranking
  const [popularityScores, setPopularityScores] = useState<Record<string, number>>({});

  useEffect(() => {
    let isMounted = true;
    const fetchPopularity = async () => {
      try {
        const scores: Record<string, number> = {};

        // 1. Fetch round counts & unique players from game_rounds
        const { data: roundData } = await supabase
          .from('game_rounds')
          .select('game_id, user_id');

        if (Array.isArray(roundData)) {
          const playersPerGame: Record<string, Set<string>> = {};
          roundData.forEach(r => {
            const gid = r.game_id;
            scores[gid] = (scores[gid] || 0) + 1;
            if (r.user_id) {
              if (!playersPerGame[gid]) playersPerGame[gid] = new Set();
              playersPerGame[gid].add(r.user_id);
            }
          });
          Object.keys(playersPerGame).forEach(gid => {
            scores[gid] = (scores[gid] || 0) + (playersPerGame[gid].size * 5);
          });
        }

        // 2. Fetch lottery ticket counts & unique players
        const { data: ticketData } = await supabase
          .from('lottery_tickets')
          .select('user_id');

        if (Array.isArray(ticketData)) {
          const uniquePlayers = new Set(ticketData.map(t => t.user_id).filter(Boolean));
          scores['lottery'] = (scores['lottery'] || 0) + ticketData.length + (uniquePlayers.size * 5);
        }

        if (isMounted) {
          setPopularityScores(scores);
        }
      } catch (err) {
        console.warn('fetchPopularity error:', err);
      }
    };

    fetchPopularity();
    return () => { isMounted = false; };
  }, []);

  // Top popular active game derived dynamically from backend activity
  const topPopularGame = useMemo(() => {
    if (!availableGames || availableGames.length === 0) return null;
    const sorted = [...availableGames].sort((a, b) => {
      const scoreA = popularityScores[a.id] || 0;
      const scoreB = popularityScores[b.id] || 0;
      if (scoreB !== scoreA) return scoreB - scoreA;
      return (b.rtp || 0) - (a.rtp || 0);
    });
    return sorted[0];
  }, [availableGames, popularityScores]);

  // Filter & Sort Games
  const filteredGames = useMemo(() => {
    let list = [...availableGames];

    // Filter by Category
    if (selectedCategory !== 'all') {
      list = list.filter(g => {
        if (selectedCategory === 'instant') return g.category === 'instant';
        if (selectedCategory === 'arcade') return g.category === 'arcade';
        if (selectedCategory === 'table') return g.category === 'table';
        if (selectedCategory === 'lottery') return g.category === 'lottery' || g.id === 'lottery';
        return true;
      });
    }

    // Filter by Search Query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(g => 
        Boolean(
          (g.name && g.name.toLowerCase().includes(q)) || 
          (g.description && g.description.toLowerCase().includes(q)) || 
          (g.category && g.category.toLowerCase().includes(q))
        )
      );
    }

    // Genuine popularity & metric sorting
    if (sortBy === 'popular') {
      list.sort((a, b) => {
        const scoreA = popularityScores[a.id] || 0;
        const scoreB = popularityScores[b.id] || 0;
        if (scoreB !== scoreA) return scoreB - scoreA;
        return (b.rtp || 0) - (a.rtp || 0);
      });
    } else if (sortBy === 'rtp') {
      list.sort((a, b) => b.rtp - a.rtp);
    } else if (sortBy === 'multiplier') {
      list.sort((a, b) => (b.maxMultiplier || 0) - (a.maxMultiplier || 0));
    }

    return list;
  }, [availableGames, selectedCategory, searchQuery, sortBy, popularityScores]);

  const categories = useMemo(() => [
    { id: 'all', label: 'All Games', count: availableGames.length },
    { id: 'lottery', label: 'Four-Digit Lottery', count: availableGames.filter(g => g.category === 'lottery' || g.id === 'lottery').length },
    { id: 'instant', label: 'Instant Originals', count: availableGames.filter(g => g.category === 'instant').length },
    { id: 'arcade', label: 'Arcade & Color', count: availableGames.filter(g => g.category === 'arcade').length },
    { id: 'table', label: 'Table & Derby', count: availableGames.filter(g => g.category === 'table').length }
  ], [availableGames]);

  const handleGameSelect = (game: { id: string; slug?: string }) => {
    if (onLaunchGame) {
      onLaunchGame(game.slug || game.id);
    }
  };

  return (
    <div className="space-y-5 sm:space-y-7 pb-2 text-left">
      
      {/* 1. HERO BANNER — INTRODUCES EARNFLOW.IN PURPOSE & PLATFORM CAPABILITIES */}
      <section className="relative overflow-hidden rounded-2xl sm:rounded-3xl bg-gradient-to-br from-[#121624] via-[#0e121c] to-[#18112e] border border-amber-500/30 p-4 xs:p-5 sm:p-7 lg:p-9 shadow-2xl">
        <div className="absolute top-0 right-0 w-80 sm:w-96 h-80 sm:h-96 bg-gradient-to-b from-amber-500/15 via-purple-600/10 to-transparent rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-60 sm:w-72 h-60 sm:h-72 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-6 lg:gap-8">
          
          {/* LEFT COLUMN: Hero Copy & Actions */}
          <div className="flex-1 space-y-3.5 sm:space-y-4 max-w-2xl min-w-0">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 font-mono-numbers text-[11px] font-bold">
              <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span>EarnFlow.in · Official Online Gaming Platform</span>
            </div>

            <h1 
              className="font-display font-black text-white tracking-tight leading-[1.15]"
              style={{ fontSize: 'clamp(1.4rem, 3.2vw + 0.5rem, 2.75rem)' }}
            >
              Interactive Online Gaming &amp; <span className="text-[#F5C451]">USDT Platform</span>
            </h1>

            {/* Clear, explicit positioning statement for Google verification and first-time visitors */}
            <p className="text-xs sm:text-sm text-[#cbd5e1] leading-relaxed max-w-xl">
              <strong>EarnFlow.in is an online gaming platform that provides users with access to interactive games, gaming events, account management, and USDT-based payment features.</strong>
            </p>

            <p className="text-xs sm:text-[13px] text-[#94A3B8] leading-relaxed max-w-xl">
              Play Four-Digit Lottery, Crash, Dice, Coinflip, Bingo – Color Trading, and Horse Racing with cryptographic Provably Fair SHA-256 outcomes and direct USDT (TRC-20) wallet settlements.
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 sm:gap-3 pt-1.5 w-full sm:w-auto">
              <button
                onClick={() => {
                  const el = document.getElementById('casino-games-grid');
                  if (el) el.scrollIntoView({ behavior: 'smooth' });
                }}
                className="w-full sm:w-auto px-5 sm:px-6 py-2.5 sm:py-3 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black font-extrabold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg shadow-amber-500/25 transition-all cursor-pointer"
              >
                <Play className="w-3.5 h-3.5 sm:w-4 sm:h-4 fill-current shrink-0" />
                <span>Explore All {availableGames.length} Games</span>
              </button>

              {topPopularGame && (
                <button
                  onClick={() => {
                    handleGameSelect(topPopularGame);
                  }}
                  className="w-full sm:w-auto px-5 sm:px-6 py-2.5 sm:py-3 rounded-xl bg-[#111827] hover:bg-[#151C2B] text-white border border-[#272A31] hover:border-amber-500/40 font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  <Flame className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-400 shrink-0" />
                  <span>Play {topPopularGame.name}</span>
                </button>
              )}
            </div>
          </div>

          {/* RIGHT COLUMN: Trust & Currency Cards */}
          <div className="hidden lg:flex flex-col gap-3 w-72 xl:w-80 shrink-0 bg-[#0B0F19]/80 border border-amber-500/20 rounded-2xl p-4 shadow-xl backdrop-blur-md">
            
            {/* Platform Currency Status Card */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-[#111827] border border-[#1F2737]">
              <div>
                <span className="text-[10px] font-mono-numbers uppercase text-[#94A3B8] font-bold block">
                  Platform Currency
                </span>
                <span className="font-display font-black text-emerald-400 text-sm">
                  USDT (TRC-20)
                </span>
              </div>
              <div className="px-2.5 py-1 rounded-lg bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-xs font-bold font-mono-numbers flex items-center gap-1">
                <span>₮</span>
                <span>USDT</span>
              </div>
            </div>

            {/* Cryptographic Provably Fair Trust Banner */}
            <div className="p-3 rounded-xl bg-[#111827] border border-[#1F2737] space-y-1">
              <div className="flex items-center gap-1.5 text-amber-400 text-xs font-bold">
                <ShieldCheck className="w-4 h-4 shrink-0" />
                <span>100% Provably Fair</span>
              </div>
              <p className="text-[10px] text-[#94A3B8] leading-tight">
                SHA-256 pre-committed server seeds and verifiable client seeds. Every round is independently auditable.
              </p>
            </div>

            {/* Quick Policy & Support Access */}
            <div className="p-3 rounded-xl bg-gradient-to-r from-amber-500/10 to-purple-500/10 border border-amber-500/30 flex items-center justify-between">
              <div>
                <span className="text-[9px] font-mono-numbers text-amber-400 font-bold block uppercase">
                  Compliance &amp; Safety
                </span>
                <span className="font-mono-numbers text-xs font-extrabold text-white">
                  18+ · Audited Rules
                </span>
              </div>
              <button
                onClick={() => {
                  if (setActiveTab) setActiveTab('privacy');
                }}
                className="px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-black font-extrabold text-[10px] cursor-pointer transition-all"
              >
                Privacy Policy
              </button>
            </div>

          </div>

        </div>
      </section>

      {/* 2. PLATFORM OVERVIEW & HOW IT WORKS (Google Reviewer Clarity Section) */}
      <section className="glass-panel rounded-2xl p-4 xs:p-5 sm:p-6 border border-[#1F2737] bg-[#0E131F]/90">
        <div className="flex items-center gap-2 mb-3 pb-2 border-b border-[#1F2737]">
          <Zap className="w-4 h-4 text-amber-400" />
          <h2 className="font-display font-bold text-sm sm:text-base text-white">
            About EarnFlow.in &amp; How The Platform Works
          </h2>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 sm:gap-4 text-xs text-[#94A3B8] leading-relaxed">
          <div className="p-3 rounded-xl bg-[#111827]/80 border border-[#1F2737] space-y-1.5">
            <div className="flex items-center gap-1.5 text-white font-bold text-xs">
              <span className="w-5 h-5 rounded-md bg-amber-500/20 text-amber-400 flex items-center justify-center font-mono-numbers text-[10px]">1</span>
              <span>Account &amp; Google Sign-In</span>
            </div>
            <p className="text-[11px]">
              Explore active game rooms as a guest, or sign in in 1-click using Google OAuth or email. We only request basic profile info to manage your wallet and game access securely.
            </p>
          </div>

          <div className="p-3 rounded-xl bg-[#111827]/80 border border-[#1F2737] space-y-1.5">
            <div className="flex items-center gap-1.5 text-white font-bold text-xs">
              <span className="w-5 h-5 rounded-md bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-mono-numbers text-[10px]">2</span>
              <span>USDT Currency &amp; Payments</span>
            </div>
            <p className="text-[11px]">
              EarnFlow.in operates strictly using USDT (Tether TRC-20). Deposits credit automatically to your platform wallet balance, and withdrawals disburse to your verified address.
            </p>
          </div>

          <div className="p-3 rounded-xl bg-[#111827]/80 border border-[#1F2737] space-y-1.5">
            <div className="flex items-center gap-1.5 text-white font-bold text-xs">
              <span className="w-5 h-5 rounded-md bg-purple-500/20 text-purple-400 flex items-center justify-center font-mono-numbers text-[10px]">3</span>
              <span>Fair Play &amp; Support</span>
            </div>
            <p className="text-[11px]">
              Every draw outcome uses cryptographic SHA-256 commits. Review our public <a href="/legal/privacy" onClick={(e) => { e.preventDefault(); if (setActiveTab) setActiveTab('privacy'); }} className="text-amber-400 hover:underline">Privacy Policy</a> and <a href="/legal/terms" onClick={(e) => { e.preventDefault(); if (setActiveTab) setActiveTab('terms'); }} className="text-amber-400 hover:underline">Terms</a>, or contact <a href="mailto:support@earnflow.in" className="text-amber-400 hover:underline">support@earnflow.in</a>.
            </p>
          </div>
        </div>
      </section>

      {/* 3. CATEGORY TABS & SEARCH CONTROLS */}
      <section id="casino-games-grid" className="space-y-4 sm:space-y-5">
        
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 sm:gap-4">
          
          {/* Category Pills */}
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

        {/* 4. GAME CARDS GRID (6 ACTIVE GAMES) */}
        {filteredGames.length === 0 ? (
          <div className="bg-[#111827] rounded-3xl border border-[#1F2737] p-12 text-center space-y-3">
            <Search className="w-10 h-10 text-[#64748B] mx-auto" />
            <h3 className="font-display font-bold text-lg text-white">No games found</h3>
            <p className="text-xs text-[#94A3B8]">Try adjusting your search query or selected category.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 xs:grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 2xl:grid-cols-3 3xl:grid-cols-6 gap-3.5 xs:gap-4 sm:gap-5">
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

      {/* 5. PROVABLY FAIR & RESPONSIBLE GAMING SHOWCASE (USDT ONLY) */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-6 border-t border-[#1F2737]">
        <div className="bg-[#111827] p-5 rounded-2xl border border-[#1F2737] space-y-2">
          <div className="w-9 h-9 rounded-xl bg-amber-500/15 text-amber-400 flex items-center justify-center">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <h3 className="font-display font-bold text-sm text-white">Provably Fair SHA-256</h3>
          <p className="text-xs text-[#94A3B8] leading-relaxed">
            Every game round utilizes pre-committed server seeds and active client seeds to guarantee mathematically immutable fairness.
          </p>
        </div>

        <div className="bg-[#111827] p-5 rounded-2xl border border-[#1F2737] space-y-2">
          <div className="w-9 h-9 rounded-xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center">
            <Coins className="w-5 h-5" />
          </div>
          <h3 className="font-display font-bold text-sm text-white">USDT Stablecoin Payments</h3>
          <p className="text-xs text-[#94A3B8] leading-relaxed">
            All ticket buy-ins, game stakes, and jackpot pool disbursals are denominated exclusively in USDT (TRC-20) for transparent accounting.
          </p>
        </div>

        <div className="bg-[#111827] p-5 rounded-2xl border border-[#1F2737] space-y-2">
          <div className="w-9 h-9 rounded-xl bg-purple-500/15 text-purple-400 flex items-center justify-center">
            <Mail className="w-5 h-5" />
          </div>
          <h3 className="font-display font-bold text-sm text-white">Dedicated Support Desk</h3>
          <p className="text-xs text-[#94A3B8] leading-relaxed">
            Have questions regarding payouts, game rules, or your account? Our team is available 24/7 at <a href="mailto:support@earnflow.in" className="text-amber-400 hover:underline">support@earnflow.in</a>.
          </p>
        </div>
      </section>

    </div>
  );
}
