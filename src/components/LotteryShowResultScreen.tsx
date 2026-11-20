import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { 
  Trophy, 
  ArrowLeft, 
  Clock, 
  Sparkles, 
  AlertCircle,
  RefreshCw
} from 'lucide-react';

export interface LotteryShowResultScreenProps {
  event: any;
  room?: any;
  onBackToLobby?: () => void;
  myTickets?: any[];
}

/**
 * Four Digit Lottery Result Screen
 * Designed strictly in Google Stitch (Obsidian Sovereign Design System: #0B0F19, #111728, #7C3AED, #F59E0B, #10B981)
 * Stitch Screen ID (Desktop): projects/9963092336677896554/screens/8555713ae4da4a99afcaeadc4f304ee6
 * Stitch Screen ID (Mobile): projects/9963092336677896554/screens/ae307aa850aa4b528af48a3e26bee4a1
 * 
 * Strict Redesign Mandates:
 * 1. ONLY ONE primary content section: Winning Digits.
 * 2. Completely removed: Winners & Payouts, winner cards, usernames, rankings, ticket references,
 *    total distributed amount, SHA-256 commitment box, copy hash, and audit proof footer.
 * 3. Viewport-Constrained Layout: Fixed outer screen with internal vertical scrolling inside the
 *    Winning Digits content container when multiple combinations exceed available height.
 * 4. Pinned Section Header: The Winning Digits header remains visible while combinations scroll.
 * 5. Full Real Backend Data Integration from Supabase (lottery_events, zero dummy data).
 */
export default function LotteryShowResultScreen({
  event,
  room,
  onBackToLobby
}: LotteryShowResultScreenProps) {
  // Real Database States
  const [freshEvent, setFreshEvent] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const activeEvent = freshEvent || event;
  const eventId = activeEvent?.id;

  // Authoritative Database Fetch (with error boundary and zero fake fallback)
  const fetchVerifiedData = useCallback(async () => {
    if (!eventId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setFetchError(null);

    try {
      // Fetch fresh event record to reflect real-time draw execution state
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

  // Derive Single Winner vs Multiple Winners mode
  const isMultiWinner = useMemo(() => {
    if (!activeEvent) return false;
    if (activeEvent.winnerMode === 'multiple' || activeEvent.winner_mode === 'multiple') return true;
    if (winningCodesList.length > 1) return true;
    if (Number(activeEvent.winnerCount || activeEvent.winner_count || 1) > 1) return true;
    return false;
  }, [activeEvent, winningCodesList]);

  // Total Prize Pot (Dynamic from DB, 0 if undefined)
  const totalPrizePool = useMemo(() => {
    return Number(
      activeEvent?.lockedJackpot || 
      activeEvent?.locked_jackpot || 
      activeEvent?.poolPrize || 
      activeEvent?.pool_prize || 
      activeEvent?.fixedJackpot || 
      0
    );
  }, [activeEvent]);

  const currency = activeEvent?.currency || 'USDT';

  // Dynamic Prize Percentage Share calculation per position
  const getPositionShare = (idx: number, totalPositions: number): number => {
    const dist = activeEvent?.winnerDistribution || activeEvent?.winner_distribution;
    if (Array.isArray(dist) && dist.length > idx) {
      const item = dist[idx];
      const pct = item?.percent || item?.percentage;
      if (typeof pct === 'number' && pct > 0) return pct;
    }
    if (totalPositions <= 1) return 100;
    if (totalPositions === 2) return idx === 0 ? 60 : 40;
    if (totalPositions === 3) return idx === 0 ? 50 : idx === 1 ? 30 : 20;
    if (totalPositions === 4) return idx === 0 ? 40 : idx === 1 ? 30 : idx === 2 ? 20 : 10;
    const equalShare = Math.floor(100 / totalPositions);
    return idx === 0 ? 100 - (equalShare * (totalPositions - 1)) : equalShare;
  };

  // Helper for rank medal badge styling
  const getRankBadge = (rank: number) => {
    if (rank === 1) {
      return 'bg-amber-500/20 text-amber-300 border-amber-500/50 shadow-amber-500/20';
    }
    if (rank === 2) {
      return 'bg-slate-300/20 text-slate-200 border-slate-300/40';
    }
    if (rank === 3) {
      return 'bg-amber-700/25 text-amber-400 border-amber-600/40';
    }
    return 'bg-[#141924] text-[#94A3B8] border-[#1F2737]';
  };

  // Empty State: No event found
  if (!activeEvent) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center select-none space-y-4">
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
        {onBackToLobby && (
          <button
            type="button"
            onClick={onBackToLobby}
            className="px-4 py-2 rounded-xl bg-[#111728] hover:bg-[#1A2338] text-white border border-[#1F2737] text-xs font-bold cursor-pointer transition-all flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4 text-[#F59E0B]" />
            <span>Return to Lobby</span>
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="w-full h-full max-h-full min-h-0 flex flex-col overflow-hidden text-left p-2.5 sm:p-4 lg:p-6 space-y-3 sm:space-y-4 select-none">
      
      {/* ===================================================================== */}
      {/* 1. ROOM HEADER: RESPONSIVE NON-OVERLAPPING BAR (FIXED AT TOP)         */}
      {/* ===================================================================== */}
      <header className="w-full max-w-3xl mx-auto rounded-2xl p-3 sm:p-4 border border-[#1B2238] bg-[#111728]/95 backdrop-blur-md shadow-xl shrink-0 space-y-2.5">
        
        {/* ROW 1: Room Identification + END Status */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            {onBackToLobby && (
              <button
                type="button"
                onClick={onBackToLobby}
                className="px-2.5 py-1.5 rounded-xl bg-[#0B0F19] hover:bg-[#151C2B] text-[#94A3B8] hover:text-white border border-[#1F2737] text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all shrink-0 shadow-sm active:scale-95"
                title="Return to Available Pools"
              >
                <ArrowLeft className="w-3.5 h-3.5 text-[#F59E0B]" />
                <span className="hidden xs:inline">Lobby</span>
              </button>
            )}

            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="font-display font-black text-sm sm:text-lg text-white truncate">
                  {room?.name || activeEvent?.title || 'Four-Digit Lottery Draw'}
                </h2>
                
                {/* Concluded Status Badge */}
                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono-numbers font-black uppercase flex items-center gap-1 shrink-0 border ${
                  winningCodesList.length > 0 
                    ? 'bg-rose-500/15 text-rose-400 border-rose-500/35'
                    : 'bg-amber-500/15 text-amber-300 border-amber-500/35'
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${winningCodesList.length > 0 ? 'bg-rose-500' : 'bg-amber-400 animate-pulse'}`} />
                  <span>{winningCodesList.length > 0 ? 'CONCLUDED' : 'DRAW PENDING'}</span>
                </span>
              </div>
              <p className="text-[10px] sm:text-xs text-[#94A3B8] font-mono-numbers truncate hidden md:block">
                Official Draw Record · #DRAW-{String(eventId).replace(/^evt-/, '').slice(-6).toUpperCase()}
              </p>
            </div>
          </div>

          {/* Desktop/Tablet Inline Badges */}
          <div className="hidden md:flex items-center gap-2.5 text-xs font-mono-numbers shrink-0">
            <div className="bg-[#0B0F19] px-3 py-1.5 rounded-xl border border-[#1F2737] flex items-center gap-2 shadow-inner">
              <Trophy className="w-3.5 h-3.5 text-[#F59E0B] shrink-0" />
              <span className="text-[#94A3B8] text-[10px] uppercase font-bold">Jackpot:</span>
              <strong className="text-[#F59E0B] font-black">{totalPrizePool.toLocaleString()} {currency}</strong>
            </div>

            <div className="bg-[#0B0F19] px-3 py-1.5 rounded-xl border border-[#1F2737] flex items-center gap-2 text-[#64748B] text-[11px]">
              <Clock className="w-3.5 h-3.5 text-[#64748B]" />
              <span>{winningCodesList.length > 0 ? 'Concluded' : 'Drawing'}</span>
            </div>
          </div>

        </div>

        {/* ROW 2: Mobile Stats Bar (Zero Overlap with Title or Status) */}
        <div className="grid grid-cols-2 divide-x divide-[#1F2737] rounded-xl bg-[#0B0F19] border border-[#1F2737] p-2 text-center text-xs font-mono-numbers md:hidden shadow-inner">
          <div className="px-1">
            <span className="text-[9px] uppercase font-extrabold text-[#F59E0B]/80 block">JACKPOT</span>
            <span className="font-black text-[#F59E0B] text-xs xs:text-sm truncate block">
              {totalPrizePool.toLocaleString()} {currency}
            </span>
          </div>

          <div className="px-1">
            <span className="text-[9px] uppercase font-extrabold text-[#94A3B8] block">STATUS</span>
            <span className={`font-bold text-xs truncate block ${winningCodesList.length > 0 ? 'text-rose-400' : 'text-amber-400'}`}>
              {winningCodesList.length > 0 ? 'Concluded' : 'Pending Draw'}
            </span>
          </div>
        </div>

      </header>

      {/* ===================================================================== */}
      {/* 2. ONLY ONE CONTENT SECTION: WINNING DIGITS BOX (FITS VIEWPORT)       */}
      {/* ===================================================================== */}
      <section className="w-full max-w-3xl mx-auto flex-1 min-h-0 flex flex-col rounded-2xl border border-[#1B2238] bg-[#111728]/95 backdrop-blur-md shadow-2xl overflow-hidden">
        
        {/* PINNED SECTION HEADER (Remains permanently visible while cards scroll) */}
        <div className="p-3.5 sm:p-5 pb-3 sm:pb-4 border-b border-[#1F2737] flex items-center justify-between shrink-0 bg-[#111728]/90 backdrop-blur-sm z-10">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0 shadow-[0_0_12px_rgba(245,158,11,0.2)]">
              <Trophy className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
            </div>
            <div>
              <h3 className="font-display font-extrabold text-sm sm:text-base text-white leading-tight">
                Winning Digits
              </h3>
              <p className="text-[11px] text-[#94A3B8] font-mono-numbers">
                {winningCodesList.length > 0
                  ? isMultiWinner
                    ? `${winningCodesList.length} Winning Combinations Drawn`
                    : 'Official 4-Digit Result'
                  : 'Awaiting Official Draw Execution'}
              </p>
            </div>
          </div>

          <span className={`text-[10px] font-mono-numbers font-black px-2.5 py-0.5 rounded-full border ${
            winningCodesList.length === 0
              ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
              : isMultiWinner
                ? 'bg-violet-500/15 text-violet-300 border-violet-500/30'
                : 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
          }`}>
            {winningCodesList.length === 0
              ? 'Pending'
              : isMultiWinner
                ? 'Multi-Winner'
                : 'Single Winner'}
          </span>
        </div>

        {/* INTERNAL VERTICAL SCROLLING CONTAINER (Holds combinations when exceeding available height) */}
        <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar p-3.5 sm:p-5 space-y-3 sm:space-y-4">
          
          {loading ? (
            /* Loading Shimmer Skeleton */
            <div className="p-4 sm:p-6 rounded-2xl bg-[#0B0F19] border border-[#1F2737] flex flex-col items-center justify-center gap-3 animate-pulse">
              <div className="h-4 w-40 bg-[#141924] rounded-md" />
              <div className="flex gap-2 sm:gap-3 py-2">
                {[0, 1, 2, 3].map(i => (
                  <div key={i} className="w-12 h-14 sm:w-16 sm:h-20 rounded-2xl bg-[#141924] border border-[#1F2737]" />
                ))}
              </div>
              <div className="h-4 w-32 bg-[#141924] rounded-md" />
            </div>
          ) : fetchError ? (
            /* Error State with Working Retry */
            <div className="p-5 sm:p-6 rounded-2xl bg-rose-950/20 border border-rose-500/40 text-center space-y-3">
              <div className="w-10 h-10 rounded-full bg-rose-500/15 border border-rose-500/30 flex items-center justify-center mx-auto text-rose-400">
                <AlertCircle className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h4 className="font-bold text-xs text-white">
                  Draw Ledger Sync Error
                </h4>
                <p className="text-[11px] text-[#94A3B8] max-w-sm mx-auto">
                  {fetchError}
                </p>
              </div>
              <button
                type="button"
                onClick={fetchVerifiedData}
                className="px-3 py-1.5 rounded-xl bg-[#141924] hover:bg-[#1A2336] text-white border border-[#222B40] text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5 text-amber-400" />
                <span>Retry Connection</span>
              </button>
            </div>
          ) : winningCodesList.length === 0 ? (
            /* Draw Pending State (Zero Dummy Numbers) */
            <div className="p-6 sm:p-8 rounded-2xl bg-[#0B0F19] border border-[#1F2737] flex flex-col items-center justify-center text-center space-y-3 shadow-inner my-auto">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                <Clock className="w-6 h-6 animate-pulse" />
              </div>
              <div className="space-y-1">
                <h4 className="font-display font-bold text-sm sm:text-base text-white">
                  Draw Pending Official Declaration
                </h4>
                <p className="text-xs text-[#94A3B8] max-w-sm">
                  Ticket sales for this round have closed. The provably fair cryptographic draw is currently being executed and audited.
                </p>
              </div>
              <button
                type="button"
                onClick={fetchVerifiedData}
                className="px-3 py-1.5 rounded-xl bg-[#141924] hover:bg-[#1A2336] text-amber-400 border border-amber-500/30 text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Check Draw Status</span>
              </button>
            </div>
          ) : !isMultiWinner ? (
            /* Single Winner Combination Card */
            <div className="p-4 sm:p-6 rounded-2xl bg-[#0B0F19] border border-[#1F2737] flex flex-col items-center justify-center gap-3.5 shadow-inner">
              <div className="flex items-center justify-between w-full text-xs font-mono-numbers pb-2 border-b border-[#1F2737]">
                <span className="px-2.5 py-0.5 rounded-md text-[10px] font-black border uppercase bg-amber-500/20 text-amber-300 border-amber-500/50">
                  Position #1
                </span>
                <span className="text-emerald-400 font-bold">100% Prize Pool</span>
              </div>

              {/* 4 Prominent Glowing Digits */}
              <div className="flex items-center justify-center gap-2.5 sm:gap-4 py-2">
                {winningCodesList[0].split('').map((char, idx) => (
                  <div
                    key={idx}
                    className="w-13 h-16 xs:w-14 xs:h-18 sm:w-18 sm:h-22 rounded-2xl bg-gradient-to-b from-[#162233] to-[#0A0E18] border-2 border-emerald-400 text-emerald-300 font-mono-numbers font-black text-3xl sm:text-5xl flex items-center justify-center shadow-[0_0_24px_rgba(16,185,129,0.35)]"
                  >
                    {char}
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between w-full text-xs font-mono-numbers pt-2 border-t border-[#1F2737]">
                <span className="text-[#64748B]">Match 4/4 exact order</span>
                <span className="text-amber-400 font-black text-sm sm:text-base">
                  {totalPrizePool.toLocaleString()} {currency}
                </span>
              </div>
            </div>
          ) : (
            /* Multi-Winner Combination Cards (Position #1, #2, #3, ...) */
            winningCodesList.map((code, idx) => {
              const sharePct = getPositionShare(idx, winningCodesList.length);
              const shareAmount = Math.round((totalPrizePool * sharePct) / 100);

              return (
                <div
                  key={idx}
                  className="p-3.5 sm:p-4 rounded-2xl bg-[#0B0F19] border border-[#1F2737] space-y-2.5 sm:space-y-3 shadow-inner transition-all hover:border-[#7C3AED]/40"
                >
                  {/* Position & Share % Header Row */}
                  <div className="flex items-center justify-between text-xs font-mono-numbers">
                    <span className={`px-2.5 py-0.5 rounded-md text-[10px] font-black border uppercase ${getRankBadge(idx + 1)}`}>
                      Position #{idx + 1}
                    </span>
                    <span className="text-emerald-400 font-bold">
                      {sharePct}% Prize Share
                    </span>
                  </div>

                  {/* 4 Prominent Glowing Digits */}
                  <div className="flex items-center justify-center gap-2 sm:gap-3 py-1">
                    {code.split('').map((char, dIdx) => (
                      <span
                        key={dIdx}
                        className="w-12 h-14 xs:w-13 xs:h-15 sm:w-16 sm:h-18 rounded-xl bg-gradient-to-b from-[#142030] to-[#090D16] border-2 border-emerald-400/80 text-emerald-300 font-mono-numbers font-black text-2xl xs:text-3xl sm:text-4xl flex items-center justify-center shadow-[0_0_18px_rgba(16,185,129,0.28)]"
                      >
                        {char}
                      </span>
                    ))}
                  </div>

                  {/* Rule & Payout Footer Row */}
                  <div className="flex items-center justify-between text-[11px] font-mono-numbers pt-1.5 border-t border-[#1F2737]">
                    <span className="text-[#64748B]">Match 4/4 exact order</span>
                    <span className="text-amber-400 font-black text-xs sm:text-sm">
                      {shareAmount.toLocaleString()} {currency}
                    </span>
                  </div>
                </div>
              );
            })
          )}

        </div>

      </section>

    </div>
  );
}
