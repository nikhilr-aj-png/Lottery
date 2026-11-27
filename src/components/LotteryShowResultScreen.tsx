import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { 
  Trophy, 
  Clock, 
  AlertCircle,
  RefreshCw,
  Sparkles
} from 'lucide-react';

export interface LotteryShowResultScreenProps {
  event: any;
  room?: any;
  onBackToLobby?: () => void;
  myTickets?: any[];
}

/**
 * Four Digit Lottery - Full-Screen Show Result (Winning Digits Only)
 * Designed strictly in Google Stitch (Obsidian Sovereign Design System: #0B0F19, #111728, #7C3AED, #F59E0B, #10B981)
 * Stitch Screen ID: projects/9963092336677896554/screens/4c5b70e62bf649789f75d4a28456b2b0
 * 
 * Strict Redesign Mandates:
 * 1. REMOVE BACK TO LOBBY: No Back to Lobby button, text, or navigation bar on Show Result.
 * 2. REMOVE SMALL ROOM HEADER: Content directly occupies full width and viewport height.
 * 3. WINNING DIGITS ONLY: Displays only winning position and 4 equal-sized digit boxes.
 *    No player names, no usernames, no wallet addresses, no payouts, no winner breakdown.
 * 4. COMPACT EQUAL-SIZED GRID: Equal width, equal height cards in a responsive grid
 *    (Desktop 3-4, Tablet 2-3, Mobile 2-3 per row) with internal scrolling.
 * 5. REMOVE TECHNICAL VERIFICATION UI: No SHA-256, no Verify on Chain, no Provably Fair labels.
 * 6. ZERO DUMMY DATA: Real backend draw records from Supabase (lottery_events).
 */
export default function LotteryShowResultScreen({
  event,
  room
}: LotteryShowResultScreenProps) {
  // Real Database States
  const [freshEvent, setFreshEvent] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [nowTick, setNowTick] = useState<number>(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const activeEvent = freshEvent || event;
  const eventId = activeEvent?.id;
  const visibleUntilMs = useMemo(() => {
    const raw =
      activeEvent?.resultVisibleUntilMs ||
      activeEvent?.ticketVisibilityUntilMs ||
      (activeEvent?.result_visible_until ? new Date(activeEvent.result_visible_until).getTime() : 0) ||
      (activeEvent?.ticket_visibility_until ? new Date(activeEvent.ticket_visibility_until).getTime() : 0);
    return Number.isFinite(Number(raw)) ? Number(raw) : 0;
  }, [activeEvent]);
  const remainingMs = visibleUntilMs > 0 ? Math.max(0, visibleUntilMs - nowTick) : 0;
  const formatClock = (ms: number) => {
    const s = Math.max(0, Math.floor(ms / 1000));
    return `${String(Math.floor(s / 3600)).padStart(2, '0')}:${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  };

  // Authoritative Database Fetch (with error boundary and zero fake fallback)
  const fetchVerifiedData = useCallback(async () => {
    if (!eventId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setFetchError(null);

    try {
      const { data: eventData, error: eventErr } = await supabase
        .from('lottery_events')
        .select('*')
        .eq('id', eventId)
        .maybeSingle();

      if (eventErr) {
        console.warn('Notice: event query warning:', eventErr);
      } else if (eventData) {
        setFreshEvent(eventData);
      }
    } catch (err: any) {
      console.error('Error fetching verified lottery event data:', err);
      setFetchError(err.message || 'Unable to connect to the verified draw ledger.');
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    fetchVerifiedData();
  }, [fetchVerifiedData]);

  // Real Winning 4-Digit Codes List (STRICT ZERO DUMMY: empty array if not yet drawn)
  const winningCodesList: string[] = useMemo(() => {
    if (!activeEvent) return [];

    const rawCodes = 
      activeEvent.drawResultCodes ||
      activeEvent.draw_result_codes ||
      activeEvent.winningCodes ||
      activeEvent.winning_codes ||
      activeEvent.winningDigits ||
      activeEvent.winning_digits ||
      activeEvent.presetWinningDigits ||
      activeEvent.preset_winning_digits;

    let codes: string[] = [];

    if (Array.isArray(rawCodes) && rawCodes.length > 0) {
      codes = rawCodes
        .map((c: any) => String(c).replace(/\D/g, '').padStart(4, '0'))
        .filter((c: string) => c.length === 4);
    } else if (typeof rawCodes === 'string' && rawCodes.trim().length > 0) {
      codes = rawCodes
        .split(',')
        .map((s: string) => s.replace(/\D/g, '').padStart(4, '0'))
        .filter((c: string) => c.length === 4);
    }

    // Deduplicate while preserving draw order
    return Array.from(new Set(codes));
  }, [activeEvent]);

  // Helper for rank badge title & style
  const getPositionMeta = (rank: number) => {
    if (rank === 1) {
      return {
        title: '#1 Grand Winner',
        badgeClass: 'bg-gradient-to-r from-amber-500/25 to-yellow-500/15 text-amber-300 border-amber-500/40',
        cardBorder: 'border-amber-500/40 hover:border-amber-400 shadow-[0_0_24px_-4px_rgba(245,158,11,0.25)]',
        digitBorder: 'border-amber-400 text-amber-300 shadow-[0_0_18px_rgba(245,158,11,0.3)]'
      };
    }
    if (rank === 2) {
      return {
        title: '#2 Second Tier',
        badgeClass: 'bg-purple-500/20 text-purple-300 border-purple-500/40',
        cardBorder: 'border-purple-500/35 hover:border-purple-400 shadow-[0_0_24px_-4px_rgba(124,58,237,0.2)]',
        digitBorder: 'border-purple-400/90 text-purple-200 shadow-[0_0_16px_rgba(124,58,237,0.3)]'
      };
    }
    if (rank === 3) {
      return {
        title: '#3 Third Tier',
        badgeClass: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40',
        cardBorder: 'border-cyan-500/35 hover:border-cyan-400 shadow-[0_0_24px_-4px_rgba(6,182,212,0.2)]',
        digitBorder: 'border-cyan-400/90 text-cyan-200 shadow-[0_0_16px_rgba(6,182,212,0.25)]'
      };
    }
    return {
      title: `#${rank} Runner-Up`,
      badgeClass: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/35',
      cardBorder: 'border-emerald-500/30 hover:border-emerald-400 shadow-[0_0_20px_-4px_rgba(16,185,129,0.18)]',
      digitBorder: 'border-emerald-400/80 text-emerald-200 shadow-[0_0_14px_rgba(16,185,129,0.22)]'
    };
  };

  // Empty State: No event found
  if (!activeEvent) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center select-none space-y-4 bg-[#0B0F19]">
        <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shadow-xl">
          <AlertCircle className="w-7 h-7" />
        </div>
        <div className="space-y-1">
          <h3 className="font-display font-black text-lg text-white">
            Lottery Event Unavailable
          </h3>
          <p className="text-xs text-[#94A3B8] max-w-sm">
            The requested draw record could not be found or has not yet been initialized.
          </p>
        </div>
      </div>
    );
  }

  const drawLabel = `#DRAW-${String(eventId).replace(/^evt-/, '').slice(-6).toUpperCase()}`;

  return (
    <div className="w-full h-full max-h-full min-h-0 flex flex-col overflow-hidden text-left bg-[#0B0F19] text-[#F8FAFC] select-none">
      
      {/* ===================================================================== */}
      {/* 1. TOP TITLE BANNER (NO BACK TO LOBBY, NO SMALL ROOM HEADER)          */}
      {/* ===================================================================== */}
      <header className="flex-none h-14 sm:h-16 border-b border-[#1F2737] bg-[#0B0F19]/95 backdrop-blur-md px-4 sm:px-8 flex items-center justify-between z-30">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-amber-500/15 border border-amber-500/35 flex items-center justify-center text-amber-400 shrink-0 shadow-[0_0_12px_rgba(245,158,11,0.25)]">
            <Trophy className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
          </div>
          <div className="min-w-0">
            <h1 className="text-sm sm:text-lg font-display font-black tracking-tight text-white flex items-center gap-2 truncate">
              <span>Official Winning Combinations</span>
              <span className="text-xs sm:text-sm font-mono text-slate-400 font-normal">{drawLabel}</span>
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs font-mono text-slate-400 shrink-0">
          {visibleUntilMs > 0 && remainingMs > 0 && (
            <span
              data-testid="show-result-countdown-badge"
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-amber-500/10 border border-amber-500/35 text-amber-300 font-bold"
            >
              <Clock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span>Result Available For: {formatClock(remainingMs)}</span>
            </span>
          )}
          <span className="px-3 py-1 rounded-lg bg-[#111728] border border-[#1F2737] text-amber-300 font-bold">
            {winningCodesList.length > 0 ? `${winningCodesList.length} Winning Tier${winningCodesList.length > 1 ? 's' : ''}` : 'Pending Draw'}
          </span>
        </div>
      </header>

      {/* ===================================================================== */}
      {/* 2. FULL-SCREEN VIEWPORT-CONSTRAINED WINNING DIGITS GRID                */}
      {/* ===================================================================== */}
      <main className="flex-1 min-h-0 overflow-y-auto no-scrollbar p-4 sm:p-6 lg:p-8 flex flex-col justify-start">
        <div className="max-w-7xl 2xl:max-w-[1600px] mx-auto w-full flex flex-col gap-5">

          {/* Subtitle + Mobile Countdown */}
          <div className="pb-2 border-b border-white/5 flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs sm:text-sm text-slate-300">
              Official winning 4-digit combinations settled for this draw round.
            </p>
            {visibleUntilMs > 0 && remainingMs > 0 && (
              <span className="sm:hidden inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-500/35 text-amber-300 text-[11px] font-mono font-bold">
                <Clock className="w-3 h-3 text-amber-400 shrink-0" />
                <span>Result Available For: {formatClock(remainingMs)}</span>
              </span>
            )}
          </div>

          {/* Content States */}
          {loading ? (
            /* Loading Shimmer Skeleton */
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-5">
              {[0, 1, 2, 3].map(i => (
                <div key={i} className="bg-[#111728] rounded-2xl border border-[#1F2737] p-5 space-y-4 animate-pulse">
                  <div className="h-4 w-28 bg-[#1B2238] rounded" />
                  <div className="grid grid-cols-4 gap-2 my-2">
                    {[0, 1, 2, 3].map(d => (
                      <div key={d} className="h-16 rounded-xl bg-[#0B0F19] border border-[#1F2737]" />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : fetchError ? (
            /* Error State with Working Retry */
            <div className="p-6 sm:p-8 rounded-2xl bg-rose-950/20 border border-rose-500/40 text-center space-y-3 max-w-md mx-auto my-auto">
              <div className="w-12 h-12 rounded-full bg-rose-500/15 border border-rose-500/30 flex items-center justify-center mx-auto text-rose-400">
                <AlertCircle className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h4 className="font-bold text-sm text-white">
                  Draw Ledger Sync Error
                </h4>
                <p className="text-xs text-[#94A3B8]">
                  {fetchError}
                </p>
              </div>
              <button
                type="button"
                onClick={fetchVerifiedData}
                className="px-4 py-2 rounded-xl bg-[#141924] hover:bg-[#1A2336] text-white border border-[#222B40] text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5 text-amber-400" />
                <span>Retry Connection</span>
              </button>
            </div>
          ) : winningCodesList.length > 0 && visibleUntilMs > 0 && remainingMs <= 0 ? (
            <div className="p-8 sm:p-12 rounded-2xl bg-[#111728] border border-[#1F2737] flex flex-col items-center justify-center text-center space-y-3 shadow-xl max-w-lg mx-auto my-auto">
              <div className="w-12 h-12 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300">
                <Clock className="w-6 h-6" />
              </div>
              <h4 className="font-display font-bold text-base text-white">
                Result Display Window Ended
              </h4>
              <p className="text-xs text-[#94A3B8] max-w-md leading-relaxed">
                This result&apos;s public display countdown has reached 00:00:00. All official ticket, payout, and audit records remain safely preserved in the backend ledger.
              </p>
            </div>
          ) : winningCodesList.length === 0 ? (
            /* Draw Pending State (Zero Dummy Numbers) */
            <div className="p-8 sm:p-12 rounded-2xl bg-[#111728] border border-[#1F2737] flex flex-col items-center justify-center text-center space-y-4 shadow-xl max-w-lg mx-auto my-auto">
              <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shadow-inner">
                <Clock className="w-7 h-7 animate-pulse" />
              </div>
              <div className="space-y-1.5">
                <h4 className="font-display font-bold text-base sm:text-lg text-white">
                  Draw Pending Official Declaration
                </h4>
                <p className="text-xs text-[#94A3B8] max-w-md leading-relaxed">
                  Ticket sales for this round have closed. The draw results are currently being processed.
                </p>
              </div>
              <button
                type="button"
                onClick={fetchVerifiedData}
                className="px-4 py-2 rounded-xl bg-[#141924] hover:bg-[#1A2336] text-amber-400 border border-amber-500/30 text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors shadow-sm"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Check Draw Status</span>
              </button>
            </div>
          ) : (
            /* COMPACT EQUAL-SIZED GRID OF WINNING COMBINATIONS */
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-5">
              {winningCodesList.map((code, idx) => {
                const rank = idx + 1;
                const meta = getPositionMeta(rank);

                return (
                  <div
                    key={idx}
                    className={`relative bg-[#111728] rounded-2xl border p-5 sm:p-6 flex flex-col justify-between transition-all duration-200 hover:-translate-y-0.5 ${meta.cardBorder}`}
                  >
                    {/* Position / Sequence Badge */}
                    <div className="flex items-center justify-between gap-2 mb-4">
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-extrabold uppercase font-mono border ${meta.badgeClass}`}>
                        {rank === 1 && <Sparkles className="w-3.5 h-3.5 text-amber-400" />}
                        {meta.title}
                      </span>
                      <span className="text-[10px] font-mono font-semibold text-slate-400 uppercase tracking-wider">
                        Exact 4/4
                      </span>
                    </div>

                    {/* 4 Equal-Sized Digit Boxes with Vibrant Neon Glow */}
                    <div className="grid grid-cols-4 gap-2 sm:gap-2.5 my-2">
                      {code.split('').map((char, dIdx) => (
                        <div
                          key={dIdx}
                          className={`h-16 sm:h-18 rounded-xl bg-[#0B0F19] border-2 flex items-center justify-center text-3xl sm:text-4xl font-mono font-black select-text ${meta.digitBorder}`}
                        >
                          {char}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

        </div>
      </main>

    </div>
  );
}
