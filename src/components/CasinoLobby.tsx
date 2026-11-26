import React, { useState, useMemo } from 'react';
import { useLottery } from '../context/LotteryContext';
import { 
  Sparkles, 
  Trophy, 
  ShieldCheck, 
  Coins, 
  ArrowRight,
  Ticket,
  Play,
  Lock,
  Clock,
  CheckCircle2,
  HelpCircle,
  ChevronDown,
  Layers,
  Award,
  Wallet,
  Zap,
  Users,
  Flame,
  Check
} from 'lucide-react';
import LotteryCard from './LotteryCard';

interface CasinoLobbyProps {
  onLaunchGame?: (gameIdOrEventId: string) => void;
  onOpenLotteryRules?: () => void;
  onShowResult?: (event: any) => void;
}

export default function CasinoLobby({ onLaunchGame, onOpenLotteryRules, onShowResult }: CasinoLobbyProps) {
  const { events, setSelectedEventForModal, setActiveTab, platformSettings, requireAuth } = useLottery();

  // Results Retention Setting from Admin Panel (Default: 1 hour)
  const retentionHours = useMemo(() => {
    const raw =
      platformSettings?.resultsRetentionHours ??
      platformSettings?.resultsRetention?.duration_hours ??
      platformSettings?.resultsRetention?.retention_duration_hours ??
      1.0;
    const parsed = Number(raw);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 1.0;
  }, [platformSettings?.resultsRetentionHours, platformSettings?.resultsRetention]);

  // 1. Available Pool: Active and scheduled events (LIVE event first)
  const availableEvents = useMemo(() => {
    const list = (events || []).filter(e => {
      if (e.status === 'deleted' || e.is_deleted) return false;
      if (e.status === 'completed' || Boolean(e.winningDigits)) return false;
      return true;
    });

    // Sort so currently active/LIVE event appears first
    return list.sort((a, b) => {
      if (a.status === 'active' && b.status !== 'active') return -1;
      if (b.status === 'active' && a.status !== 'active') return 1;
      return (a.drawTime || 0) - (b.drawTime || 0);
    });
  }, [events]);

  // Primary Live Event for Hero CTA
  const primaryLiveEvent = useMemo(() => {
    return availableEvents.find(e => e.status === 'active') || availableEvents[0] || (events || [])[0] || null;
  }, [availableEvents, events]);

  // 2. Results: Ended events within retention window
  const resultsEvents = useMemo(() => {
    const now = Date.now();
    const retentionMs = retentionHours * 3600 * 1000;

    return (events || []).filter(e => {
      if (e.status === 'deleted' || e.is_deleted) return false;
      const isConcluded = e.status === 'completed' || Boolean(e.winningDigits) || (e.drawTime && e.drawTime <= now);
      if (!isConcluded) return false;

      // Filter by retention duration (default 1 hour)
      if (e.drawTime && (now - e.drawTime) > retentionMs) {
        return false;
      }
      return true;
    }).sort((a, b) => (b.drawTime || 0) - (a.drawTime || 0));
  }, [events, retentionHours]);

  // Single-action Direct Room Entry (Protected: Login required)
  const handleDirectEnterRoom = (eventOrId?: any) => {
    const targetId = typeof eventOrId === 'string' 
      ? eventOrId 
      : (eventOrId?.id || primaryLiveEvent?.id || 'lottery');

    const roomId = targetId && targetId !== 'lottery' && targetId !== 'four-digit-lottery' ? targetId : null;
    if (!requireAuth({ type: 'game', gameSlug: 'four-digit-lottery', roomId }, 'Please log in to enter the Live Draw Room.')) {
      return;
    }

    if (onLaunchGame) {
      onLaunchGame(targetId);
    }
  };

  const handleShowResultAction = (evt: any) => {
    if (onShowResult) {
      onShowResult(evt);
    } else {
      setSelectedEventForModal(evt);
    }
  };

  return (
    <div className="space-y-7 sm:space-y-9 pb-6 text-left">
      
      {/* ------------------------------------------------------------------ */}
      {/* 1. REFINED COMPACT HERO BANNER: FOUR DIGIT LOTTERY IDENTITY        */}
      {/* ------------------------------------------------------------------ */}
      <section className="ef-hero-320 relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#121624] via-[#0E131F] to-[#1A132F] border border-amber-500/30 p-4 max-[359px]:p-3 sm:p-5 lg:p-6 shadow-xl">
        <div className="absolute top-0 right-0 w-72 h-72 bg-gradient-to-b from-amber-500/10 via-purple-600/5 to-transparent rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-emerald-500/5 rounded-full blur-2xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-4 max-[359px]:gap-3 sm:gap-6">
          
          {/* Left: Official Logo + Title + Badges */}
          <div className="flex items-center max-[359px]:items-start gap-3.5 max-[359px]:gap-2.5 sm:gap-4 min-w-0 flex-1 w-full">
            {/* Four Digit Lottery Logo Asset */}
            <div className="relative group shrink-0">
              <div className="w-16 h-16 max-[359px]:w-13 max-[359px]:h-13 xs:w-18 xs:h-18 sm:w-20 sm:h-20 rounded-2xl max-[359px]:rounded-xl bg-[#090D16] border-2 border-amber-400/75 shadow-[0_0_20px_rgba(245,196,81,0.25)] overflow-hidden flex items-center justify-center transition-transform group-hover:scale-105 duration-200">
                <img 
                  src="/items/Four Digit Lottery.jpg" 
                  alt="Four Digit Lucky Lottery" 
                  className="w-full h-full object-cover rounded-xl"
                />
              </div>
              <span className="absolute -bottom-1.5 -right-1 px-1.5 max-[359px]:px-1 py-0.2 rounded bg-amber-500 text-black font-mono-numbers text-[8px] max-[359px]:text-[7px] font-black uppercase tracking-wider shadow">
                OFFICIAL
              </span>
            </div>

            {/* Typography & Subtle Badges */}
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex flex-wrap items-center gap-1.5 max-[359px]:gap-1">
                <div className="inline-flex items-center gap-1 px-2 max-[359px]:px-1.5 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 font-mono-numbers text-[9px] max-[359px]:text-[8.5px] xs:text-[10px] font-bold max-[359px]:whitespace-nowrap">
                  <Sparkles className="w-3 h-3 max-[359px]:w-2.5 max-[359px]:h-2.5 text-amber-400 shrink-0" />
                  <span>EarnFlow.in · Official Lucky Draw</span>
                </div>
                <span className="inline-flex items-center gap-1 px-2 max-[359px]:px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-[9px] max-[359px]:text-[8px] font-bold font-mono-numbers whitespace-nowrap">
                  USDT TRC-20
                </span>
                <span className="inline-flex items-center px-1.5 max-[359px]:px-1 py-0.5 rounded-full bg-white/5 text-[#94A3B8] text-[9px] max-[359px]:text-[8px] font-bold whitespace-nowrap">
                  18+ Players
                </span>
                <span className="inline-flex items-center px-1.5 max-[359px]:px-1 py-0.5 rounded-full bg-purple-500/15 text-purple-400 border border-purple-500/30 text-[9px] max-[359px]:text-[8px] font-bold font-mono-numbers whitespace-nowrap">
                  95.0% RTP
                </span>
              </div>

              <h1 className="font-display font-black text-white text-lg max-[359px]:text-[15px] xs:text-xl sm:text-2xl tracking-tight leading-tight">
                Four Digit <span className="text-amber-400">Lucky Lottery</span>
              </h1>

              <p className="max-[359px]:hidden text-xs text-[#CBD5E1] line-clamp-2 max-w-xl leading-relaxed">
                Pick your lucky 4-digit number between <strong>0000 and 9999</strong> to enter transparent jackpot pools. Instant 24-hour USDT payouts.
              </p>
            </div>
          </div>

          {/* Full-width unwrapped description strictly for 320px screens so zero text is truncated */}
          <p className="hidden max-[359px]:block w-full text-[11px] text-[#CBD5E1] leading-relaxed text-left">
            Pick your lucky 4-digit number between <strong>0000 and 9999</strong> to enter transparent jackpot pools. Instant 24-hour USDT payouts.
          </p>

          {/* Right: Primary 1-Click Action Button */}
          <div className="shrink-0 w-full md:w-auto flex flex-col sm:flex-row items-center gap-2.5">
            <button
              type="button"
              onClick={() => handleDirectEnterRoom(primaryLiveEvent?.id)}
              className="w-full sm:w-auto px-6 max-[359px]:px-4 py-3 max-[359px]:py-2.5 rounded-xl bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 hover:brightness-110 text-black font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg shadow-amber-500/25 transition-all cursor-pointer active:scale-95 whitespace-nowrap"
            >
              <Play className="w-3.5 h-3.5 fill-current shrink-0" />
              <span>Enter Live Draw Room</span>
              <ArrowRight className="w-3.5 h-3.5 ml-0.5" />
            </button>
          </div>

        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* 2. AVAILABLE POOL: ACTIVE & UPCOMING EVENTS (LIVE EVENT FIRST)     */}
      {/* ------------------------------------------------------------------ */}
      <section className="space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pb-2 border-b border-[#1F2737]">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
              <h2 className="font-display font-extrabold text-lg sm:text-xl text-white">
                Available Pool
              </h2>
            </div>
            <p className="text-xs text-[#94A3B8] mt-0.5">
              Eligible active and upcoming Four Digit Lottery rooms. Select any pool to enter the live workstation.
            </p>
          </div>

          <span className="text-[11px] font-mono-numbers px-3 py-1 rounded-lg bg-[#141924] text-amber-300 border border-amber-500/30 font-bold shrink-0">
            {availableEvents.length} Active {availableEvents.length === 1 ? 'Pool' : 'Pools'}
          </span>
        </div>

        {availableEvents.length === 0 ? (
          <div className="p-8 rounded-2xl bg-[#111827] border border-[#1F2737] text-center space-y-3">
            <Ticket className="w-10 h-10 text-amber-400/60 mx-auto" />
            <h3 className="font-display font-bold text-white text-base">New Draws Coming Soon</h3>
            <p className="text-xs text-[#94A3B8] max-w-md mx-auto">
              Our automated lottery engine publishes new pools regularly. Check back shortly or view past winning numbers in Results.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
            {availableEvents.map((evt, idx) => (
              <LotteryCard
                key={evt.id}
                event={evt}
                mode="available"
                isLive={idx === 0 && evt.status === 'active'}
                onEnterRoom={() => handleDirectEnterRoom(evt.id)}
                onSelect={() => handleDirectEnterRoom(evt.id)}
              />
            ))}
          </div>
        )}
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* 3. RESULTS: CONCLUDED DRAWS WITHIN CONFIGURABLE RETENTION PERIOD   */}
      {/* ------------------------------------------------------------------ */}
      {resultsEvents.length > 0 && (
        <section className="space-y-4 pt-2">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pb-2 border-b border-[#1F2737]">
            <div>
              <div className="flex items-center gap-2">
                <Trophy className="w-5 h-5 text-amber-400 shrink-0" />
                <h2 className="font-display font-extrabold text-lg sm:text-xl text-white">
                  Recent Results &amp; Concluded Pools
                </h2>
              </div>
              <p className="text-xs text-[#94A3B8] mt-0.5">
                Official winning 4-digit combinations from recent draws (Retained for {retentionHours >= 1 ? `${retentionHours} hour${retentionHours > 1 ? 's' : ''}` : `${Math.round(retentionHours * 60)} minutes`}).
              </p>
            </div>

            <button
              onClick={() => setActiveTab('results')}
              className="text-xs text-amber-400 hover:text-amber-300 font-bold flex items-center gap-1 cursor-pointer transition-colors"
            >
              <span>View All Results</span>
              <ChevronDown className="w-3.5 h-3.5 -rotate-90" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
            {resultsEvents.map((evt) => (
              <LotteryCard
                key={evt.id}
                event={evt}
                mode="result"
                onShowResult={() => handleShowResultAction(evt)}
                onSelect={() => handleShowResultAction(evt)}
              />
            ))}
          </div>
        </section>
      )}

    </div>
  );
}
