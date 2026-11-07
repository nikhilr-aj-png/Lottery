import React from 'react';
import { 
  Play, 
  ShieldCheck, 
  Sparkles, 
  Flame, 
  TrendingUp, 
  Trophy,
  Zap,
  Info
} from 'lucide-react';

export default function GameCard({ game, onPlay }) {
  if (!game) return null;

  const getArtwork = (id) => {
    switch (id) {
      case 'lottery':
        return {
          emoji: '🎟️',
          gradient: 'from-amber-500/25 via-yellow-500/10 to-transparent',
          borderHover: 'hover:border-amber-400/60',
          accent: '#F5C451'
        };
      case 'crash':
        return {
          emoji: '🚀',
          gradient: 'from-orange-500/25 via-red-500/10 to-transparent',
          borderHover: 'hover:border-orange-500/60',
          accent: '#F97316'
        };
      case 'dice':
        return {
          emoji: '🎲',
          gradient: 'from-blue-500/25 via-indigo-500/10 to-transparent',
          borderHover: 'hover:border-blue-400/60',
          accent: '#3B82F6'
        };
      case 'mines':
        return {
          emoji: '💣',
          gradient: 'from-red-500/25 via-rose-500/10 to-transparent',
          borderHover: 'hover:border-red-400/60',
          accent: '#EF4444'
        };
      case 'plinko':
        return {
          emoji: '🎯',
          gradient: 'from-pink-500/25 via-purple-500/10 to-transparent',
          borderHover: 'hover:border-pink-400/60',
          accent: '#EC4899'
        };
      case 'roulette':
        return {
          emoji: '🎡',
          gradient: 'from-emerald-500/25 via-teal-500/10 to-transparent',
          borderHover: 'hover:border-emerald-400/60',
          accent: '#10B981'
        };
      case 'coinflip':
        return {
          emoji: '🪙',
          gradient: 'from-yellow-500/25 via-amber-500/10 to-transparent',
          borderHover: 'hover:border-yellow-400/60',
          accent: '#EAB308'
        };
      case 'blackjack':
        return {
          emoji: '🃏',
          gradient: 'from-green-500/25 via-emerald-500/10 to-transparent',
          borderHover: 'hover:border-green-400/60',
          accent: '#22C55E'
        };
      case 'slots':
        return {
          emoji: '🎰',
          gradient: 'from-purple-500/25 via-violet-500/10 to-transparent',
          borderHover: 'hover:border-purple-400/60',
          accent: '#8B5CF6'
        };
      case 'poker':
        return {
          emoji: '♠️',
          gradient: 'from-cyan-500/25 via-sky-500/10 to-transparent',
          borderHover: 'hover:border-cyan-400/60',
          accent: '#06B6D4'
        };
      case 'keno':
        return {
          emoji: '🎱',
          gradient: 'from-teal-500/25 via-emerald-500/10 to-transparent',
          borderHover: 'hover:border-teal-400/60',
          accent: '#14B8A6'
        };
      case 'limbo':
        return {
          emoji: '⚡',
          gradient: 'from-indigo-500/25 via-purple-500/10 to-transparent',
          borderHover: 'hover:border-indigo-400/60',
          accent: '#6366F1'
        };
      default:
        return {
          emoji: '🎮',
          gradient: 'from-amber-500/25 to-transparent',
          borderHover: 'hover:border-amber-400/60',
          accent: '#F5C451'
        };
    }
  };

  const art = getArtwork(game.id);

  return (
    <div 
      onClick={() => onPlay && onPlay(game)}
      className={`group relative bg-[#151C2B] rounded-2xl border border-[#1F2737] ${art.borderHover} overflow-hidden shadow-lg hover:shadow-2xl transition-all duration-300 flex flex-col justify-between cursor-pointer`}
    >
      {/* Top Gradient Banner / Background Glow */}
      <div className={`absolute -top-12 -right-12 w-32 h-32 bg-gradient-to-br ${art.gradient} rounded-full blur-2xl pointer-events-none group-hover:scale-125 transition-transform duration-500`} />

      {/* Card Content Top */}
      <div className="p-4 sm:p-5 relative z-10">
        
        {/* Header: Badge & Provably Fair Indicator */}
        <div className="flex items-center justify-between gap-2 mb-3">
          <span 
            className="text-[10px] font-mono-numbers uppercase tracking-wider font-extrabold px-2 py-0.5 rounded-md border"
            style={{
              backgroundColor: `${art.accent}15`,
              color: art.accent,
              borderColor: `${art.accent}40`
            }}
          >
            {game.badge || game.category.toUpperCase()}
          </span>

          <span 
            className="flex items-center gap-1 text-[10px] font-mono-numbers text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20"
            title="Provably Fair Cryptographic Results"
          >
            <ShieldCheck className="w-3 h-3 text-emerald-400" />
            <span className="hidden xs:inline">Fair</span>
          </span>
        </div>

        {/* Game Visual Icon & Name */}
        <div className="flex items-center gap-3.5 my-2">
          <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-[#0B0F19] border border-[#272A31] flex items-center justify-center text-3xl sm:text-4xl shadow-inner group-hover:scale-110 group-hover:rotate-3 transition-transform duration-300 shrink-0">
            {art.emoji}
          </div>

          <div className="min-w-0">
            <h3 className="font-display font-black text-base sm:text-lg text-[#F8FAFC] group-hover:text-amber-300 transition-colors truncate">
              {game.name}
            </h3>
            <p className="text-[11px] text-[#94A3B8] line-clamp-2 mt-0.5 leading-snug">
              {game.description}
            </p>
          </div>
        </div>

      </div>

      {/* Card Footer: RTP, Max Win & Play CTA */}
      <div className="px-3.5 xs:px-4 py-2.5 sm:py-3 bg-[#0B0F19]/80 border-t border-[#1F2737] flex items-center justify-between gap-1.5 xs:gap-2 relative z-10 flex-wrap sm:flex-nowrap">
        <div className="flex items-center gap-1 xs:gap-1.5 text-[9px] xs:text-[10px] font-mono-numbers">
          <span className="text-[#94A3B8] bg-[#111827] px-1.5 xs:px-2 py-0.5 rounded border border-[#1F2737]">
            RTP <strong className="text-white">{game.rtp}%</strong>
          </span>
          <span className="text-[#94A3B8] bg-[#111827] px-1.5 xs:px-2 py-0.5 rounded border border-[#1F2737]">
            <span className="hidden xs:inline">Up to </span><strong className="text-amber-300">{game.maxMultiplier}x</strong>
          </span>
        </div>

        {/* Play Button Trigger */}
        <button
          className="min-h-[34px] px-3 xs:px-3.5 py-1 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 group-hover:from-amber-400 group-hover:to-amber-500 text-black font-extrabold text-xs flex items-center gap-1.5 transition-all shadow-md shadow-amber-500/20 group-hover:shadow-amber-500/40 cursor-pointer shrink-0"
        >
          <Play className="w-3.5 h-3.5 fill-current" />
          <span>Play</span>
        </button>
      </div>

    </div>
  );
}

