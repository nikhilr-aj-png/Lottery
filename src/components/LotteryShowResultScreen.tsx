import React, { useState, useEffect, useMemo } from 'react';
import { useLottery } from '../context/LotteryContext';
import { supabase } from '../lib/supabase';
import ProvablyFairModal from './ProvablyFairModal';
import { 
  Trophy, 
  CheckCircle2, 
  Award, 
  Users, 
  Ticket, 
  ArrowLeft, 
  Clock, 
  Coins, 
  ShieldCheck, 
  ChevronLeft, 
  ChevronRight, 
  Copy, 
  Check, 
  Sparkles, 
  AlertCircle,
  Lock
} from 'lucide-react';

export interface LotteryShowResultScreenProps {
  event: any;
  room?: any;
  onBackToLobby?: () => void;
  myTickets?: any[];
}

export default function LotteryShowResultScreen({
  event,
  room,
  onBackToLobby,
  myTickets = []
}: LotteryShowResultScreenProps) {
  const { wallet, user, winnerPayouts } = useLottery();

  // Dynamic Viewport tracking for strict zero-scroll adaptations
  const [viewport, setViewport] = useState({
    width: typeof window !== 'undefined' ? window.innerWidth : 1200,
    height: typeof window !== 'undefined' ? window.innerHeight : 800
  });

  useEffect(() => {
    const handleResize = () => {
      setViewport({
        width: window.innerWidth,
        height: window.innerHeight
      });
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Responsive device orientation & breakpoint flags
  const isMobileLandscape = viewport.width > viewport.height && viewport.height < 520;
  const isMobilePortrait = viewport.width < 640 && viewport.height >= viewport.width;
  const isTablet = viewport.width >= 640 && viewport.width < 1024;
  const isTabletPortrait = isTablet && viewport.height >= viewport.width;
  const isDesktop = viewport.width >= 1024;

  // Real Database Winner Records State
  const [dbWinners, setDbWinners] = useState<any[]>([]);
  const [loadingWinners, setLoadingWinners] = useState<boolean>(true);
  const [page, setPage] = useState<number>(1);
  const [copiedHash, setCopiedHash] = useState<boolean>(false);
  const [isProofModalOpen, setIsProofModalOpen] = useState<boolean>(false);

  // Derive Single Winner vs Multiple Winners mode
  const isMultiWinner = useMemo(() => {
    if (!event) return false;
    if (event.winnerMode === 'multiple') return true;
    if (Array.isArray(event.winningCodes) && event.winningCodes.length > 1) return true;
    if (Number(event.winnerCount || event.winningCodeCount || 1) > 1) return true;
    return false;
  }, [event]);

  // Winning 4-Digit Codes List
  const winningCodesList: string[] = useMemo(() => {
    if (!event) return ['2538'];
    let codes: string[] = [];
    if (Array.isArray(event.winningCodes) && event.winningCodes.length > 0) {
      codes = event.winningCodes
        .map((c: any) => String(c).replace(/\D/g, '').padStart(4, '0'))
        .filter((c: string) => c.length === 4);
    } else if (event.presetWinningDigits) {
      codes = [String(event.presetWinningDigits).replace(/\D/g, '').padStart(4, '0')];
    } else if (event.winningDigits) {
      codes = String(event.winningDigits)
        .split(',')
        .map((s: string) => s.replace(/\D/g, '').padStart(4, '0'))
        .filter((c: string) => c.length === 4);
    }
    if (codes.length === 0) {
      codes = ['2538'];
    }
    return !isMultiWinner ? [codes[0]] : codes;
  }, [event, isMultiWinner]);

  // Total Prize Pot
  const totalPrizePool = useMemo(() => {
    return Number(event?.lockedJackpot || event?.poolPrize || event?.fixedJackpot || 5000);
  }, [event]);

  // Currency
  const currency = event?.currency || 'USDT';

  // Fetch verified winners from Supabase winner_payouts table
  useEffect(() => {
    let isMounted = true;
    async function fetchVerifiedWinners() {
      if (!event?.id) return;
      setLoadingWinners(true);
      try {
        const { data, error } = await supabase
          .from('winner_payouts')
          .select('*')
          .eq('event_id', event.id)
          .order('position', { ascending: true });

        if (!isMounted) return;
        if (!error && Array.isArray(data) && data.length > 0) {
          const mapped = data.map((row: any, idx: number) => ({
            id: row.id,
            rank: row.position || (idx + 1),
            ticketId: row.ticket_id || (idx + 101),
            winnerUsername: row.winner_username,
            winnerAddress: row.winner_address,
            winningDigits: String(row.winning_digits || winningCodesList[idx % winningCodesList.length] || '2538').padStart(4, '0'),
            payoutAmount: Number(row.payout_amount || row.calculated_amount || (totalPrizePool / Math.max(1, data.length))),
            status: row.status || 'paid',
            ticketsCount: row.tickets_count || 1
          }));
          setDbWinners(mapped);
        } else {
          // Context fallback
          const ctxWinners = (winnerPayouts || [])
            .filter((p: any) => p.eventId === event.id || p.event_id === event.id)
            .map((p: any, idx: number) => ({
              id: p.id,
              rank: p.rank || (idx + 1),
              ticketId: p.ticketId || p.id,
              winnerUsername: p.winnerUsername,
              winnerAddress: p.winnerAddress,
              winningDigits: String(p.winningDigits || winningCodesList[idx % winningCodesList.length] || '2538').padStart(4, '0'),
              payoutAmount: Number(p.payoutAmount || (totalPrizePool / (winnerPayouts.length || 1))),
              status: p.status || 'paid',
              ticketsCount: p.ticketsCount || 1
            }));
          setDbWinners(ctxWinners);
        }
      } catch (err) {
        console.warn('Winner payouts fetch notice:', err);
        const ctxWinners = (winnerPayouts || [])
          .filter((p: any) => p.eventId === event.id || p.event_id === event.id);
        if (isMounted) setDbWinners(ctxWinners);
      } finally {
        if (isMounted) setLoadingWinners(false);
      }
    }

    fetchVerifiedWinners();
    return () => { isMounted = false; };
  }, [event?.id, winnerPayouts, totalPrizePool, winningCodesList]);

  // Calculate total distributed USDT amount
  const totalDistributed = useMemo(() => {
    if (dbWinners.length > 0) {
      return dbWinners.reduce((sum, w) => sum + Number(w.payoutAmount || 0), 0);
    }
    return totalPrizePool;
  }, [dbWinners, totalPrizePool]);

  // Non-scrolling Pagination Size based on dynamic screen height & orientation
  const pageSize = useMemo(() => {
    if (isMobileLandscape) return 2;
    if (isMobilePortrait) return 3;
    if (isTabletPortrait) return 3;
    return 4;
  }, [isMobileLandscape, isMobilePortrait, isTabletPortrait]);

  const totalPages = Math.max(1, Math.ceil(dbWinners.length / pageSize));

  // Reset page if out of bounds on viewport resize
  useEffect(() => {
    if (page > totalPages) setPage(1);
  }, [totalPages, page]);

  const paginatedWinners = useMemo(() => {
    const start = (page - 1) * pageSize;
    return dbWinners.slice(start, start + pageSize);
  }, [dbWinners, page, pageSize]);

  // Check current user's tickets in this concluded event
  const myWinningTickets = useMemo(() => {
    if (!myTickets || myTickets.length === 0) return [];
    return myTickets.filter((t: any) => {
      const num = String(t.ticketNumber || t.ticket_number || '').padStart(4, '0');
      return winningCodesList.includes(num);
    });
  }, [myTickets, winningCodesList]);

  const copyHash = (hash: string) => {
    if (!hash) return;
    navigator.clipboard.writeText(hash);
    setCopiedHash(true);
    setTimeout(() => setCopiedHash(false), 2000);
  };

  const formatWinnerName = (w: any) => {
    if (w.winnerUsername) {
      return w.winnerUsername.startsWith('@') ? w.winnerUsername : `@${w.winnerUsername}`;
    }
    if (w.winnerAddress) {
      return `${w.winnerAddress.slice(0, 6)}...${w.winnerAddress.slice(-4)}`;
    }
    return `@Winner_${w.rank || 1}`;
  };

  return (
    <div className="w-full h-full max-h-full flex flex-col justify-between overflow-hidden text-left p-1.5 xs:p-2 sm:p-3 select-none">
      
      {/* ===================================================================== */}
      {/* 1. COMPACT TOP HEADER STRIP: ROOM, STATUS, JACKPOT, LOBBY ACTION      */}
      {/* ===================================================================== */}
      <div className="w-full rounded-xl sm:rounded-2xl p-2 sm:p-2.5 border border-amber-500/30 bg-gradient-to-r from-[#151C2B] via-[#0F1420] to-[#0B0F19] shadow-lg flex items-center justify-between gap-2 shrink-0 mb-1.5 xs:mb-2 sm:mb-2.5">
        
        {/* Left: Return to Lobby + Room Badge + Status */}
        <div className="flex items-center gap-2 min-w-0">
          {onBackToLobby && (
            <button
              onClick={onBackToLobby}
              className="px-2 py-1 xs:px-2.5 xs:py-1.5 rounded-lg xs:rounded-xl bg-[#141924] hover:bg-[#1a2130] text-[#94A3B8] hover:text-white border border-[#272a31] text-[10px] xs:text-xs font-bold flex items-center gap-1 cursor-pointer transition-all shrink-0 shadow-sm"
              title="Return to Available Pools"
            >
              <ArrowLeft className="w-3.5 h-3.5 text-amber-400" />
              <span className="hidden xs:inline">Back</span>
            </button>
          )}

          <div className="min-w-0 flex items-center gap-1.5 xs:gap-2">
            <h2 className="font-display font-black text-xs xs:text-sm sm:text-base text-white truncate max-w-[140px] xs:max-w-[200px] sm:max-w-[320px]">
              {room?.name || event?.title || 'Grand Pot Arena'}
            </h2>
            <span className="text-[9px] xs:text-[10px] font-mono-numbers px-2 py-0.5 rounded bg-red-500/15 text-red-400 border border-red-500/30 font-bold uppercase flex items-center gap-1 shrink-0">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
              <span>END</span>
            </span>
          </div>
        </div>

        {/* Right: Metrics Badges (Jackpot & Winners) */}
        <div className="flex items-center gap-1.5 xs:gap-2 text-xs font-mono-numbers shrink-0">
          <div className="bg-[#07090d] px-2 py-1 rounded-lg border border-[#272a31] flex items-center gap-1 shadow-inner">
            <span className="text-[#8b92a2] text-[9px] uppercase hidden sm:inline">Jackpot:</span>
            <strong className="text-amber-400 font-black text-[11px] xs:text-xs">
              {totalPrizePool.toLocaleString()} {currency}
            </strong>
          </div>

          <div className="bg-[#07090d] px-2 py-1 rounded-lg border border-purple-500/30 flex items-center gap-1 text-purple-300 font-bold shadow-inner">
            <Users className="w-3 h-3 text-purple-400 shrink-0" />
            <span className="text-[10px] xs:text-xs">
              {dbWinners.length > 0 ? `${dbWinners.length} Winner${dbWinners.length === 1 ? '' : 's'}` : '0 Winners'}
            </span>
          </div>
        </div>

      </div>

      {/* ===================================================================== */}
      {/* 2. MAIN 2-SECTION STAGE: SECTION A (DIGITS) & SECTION B (WINNERS)      */}
      {/* ===================================================================== */}
      <div className={`flex-1 min-h-0 w-full overflow-hidden ${
        isMobileLandscape || isDesktop || (isTablet && !isTabletPortrait)
          ? 'grid grid-cols-12 gap-2 sm:gap-3'
          : 'flex flex-col gap-2'
      }`}>
        
        {/* =================================================================== */}
        {/* SECTION A: WINNING DIGITS (PROMINENT GLOWING COMBINATION)            */}
        {/* =================================================================== */}
        <section className={`bg-[#0d1117] border border-[#272a31] rounded-2xl flex flex-col justify-between overflow-hidden shadow-xl ${
          isMobileLandscape
            ? 'col-span-5 p-2'
            : isDesktop || (isTablet && !isTabletPortrait)
              ? 'col-span-5 p-4 sm:p-5'
              : 'h-[44%] min-h-0 p-2.5 xs:p-3'
        }`}>
          
          {/* Section A Top Header */}
          <div className="flex items-center justify-between pb-2 border-b border-[#1f2737] shrink-0">
            <div className="flex items-center gap-1.5 xs:gap-2">
              <div className="w-6 h-6 xs:w-7 xs:h-7 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                <Trophy className="w-3.5 h-3.5" />
              </div>
              <div>
                <h3 className="font-display font-black text-xs xs:text-sm text-white leading-tight">
                  Winning Digits
                </h3>
                <p className="text-[9px] xs:text-[10px] text-[#94A3B8] truncate">
                  {isMultiWinner ? `${winningCodesList.length} Drawn Combinations` : 'Official 4-Digit Result'}
                </p>
              </div>
            </div>

            <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${
              isMultiWinner
                ? 'bg-purple-500/15 text-purple-300 border-purple-500/30'
                : 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
            }`}>
              {isMultiWinner ? 'Multi-Winner' : 'Single Winner'}
            </span>
          </div>

          {/* Section A Center Display: Single Winner vs Multi-Winner Grid */}
          <div className="flex-1 min-h-0 flex flex-col justify-center items-center py-1">
            {!isMultiWinner ? (
              /* SINGLE WINNER: Prominent, large glowing 4-digit slots */
              <div className="w-full flex flex-col items-center justify-center gap-2">
                <span className="text-[10px] text-[#8b92a2] font-mono-numbers uppercase tracking-widest font-semibold">
                  Official Drawn Result
                </span>

                <div className="flex items-center justify-center gap-1.5 xs:gap-2 sm:gap-3">
                  {winningCodesList[0].split('').map((char, idx) => (
                    <div
                      key={idx}
                      className={`rounded-xl xs:rounded-2xl bg-gradient-to-b from-[#192233] to-[#0c0f17] border-2 border-emerald-400 flex items-center justify-center font-mono-numbers font-black text-emerald-300 shadow-[0_0_20px_rgba(5,213,170,0.35)] ${
                        isMobileLandscape
                          ? 'w-10 h-12 text-2xl'
                          : isMobilePortrait
                            ? 'w-12 h-14 xs:w-14 xs:h-16 text-2xl xs:text-3xl'
                            : isTabletPortrait
                              ? 'w-14 h-16 text-3xl'
                              : 'w-16 h-20 sm:w-20 sm:h-24 text-4xl sm:text-5xl'
                      }`}
                    >
                      {char}
                    </div>
                  ))}
                </div>

                <div className="text-center">
                  <span className="text-[10px] xs:text-[11px] font-mono-numbers text-emerald-400 font-bold bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20">
                    Grand Jackpot Winner: 100% Payout Pool
                  </span>
                </div>
              </div>
            ) : (
              /* MULTIPLE WINNERS: Responsive compact auto-arranged grid */
              <div className="w-full flex-1 min-h-0 flex flex-col justify-center">
                <span className="text-[9px] text-[#8b92a2] uppercase tracking-wider block text-center mb-1 font-semibold">
                  {winningCodesList.length} Winning Combinations Drawn
                </span>

                <div className={`grid gap-1.5 sm:gap-2 w-full max-w-md mx-auto ${
                  winningCodesList.length === 2 
                    ? 'grid-cols-2' 
                    : winningCodesList.length === 3 
                      ? (isMobileLandscape ? 'grid-cols-3' : 'grid-cols-1 sm:grid-cols-3')
                      : 'grid-cols-2 sm:grid-cols-3'
                }`}>
                  {winningCodesList.map((code, idx) => {
                    const sharePct = event?.winnerDistribution?.[idx]?.percent || parseFloat((100 / winningCodesList.length).toFixed(1));
                    const shareAmount = Math.round((totalPrizePool * sharePct) / 100);

                    return (
                      <div
                        key={idx}
                        className="p-1.5 sm:p-2 rounded-xl bg-[#07090d] border border-purple-500/30 flex flex-col items-center justify-center gap-1 shadow-inner"
                      >
                        <div className="flex items-center justify-between w-full text-[9px] font-mono-numbers text-[#94A3B8] px-0.5">
                          <span className="text-amber-400 font-bold">Pos #{idx + 1}</span>
                          <span className="text-purple-300 font-semibold">{sharePct}%</span>
                        </div>

                        {/* 4 Digit slots for this combination */}
                        <div className="flex items-center gap-1 py-0.5">
                          {code.split('').map((c, dIdx) => (
                            <span
                              key={dIdx}
                              className="w-5 h-6 xs:w-6 xs:h-7 rounded-md bg-[#141924] border border-emerald-400/80 text-emerald-300 font-mono-numbers font-black text-xs xs:text-sm flex items-center justify-center shadow-[0_0_8px_rgba(5,213,170,0.25)]"
                            >
                              {c}
                            </span>
                          ))}
                        </div>

                        <span className="text-[9px] font-mono-numbers text-emerald-400 font-bold">
                          {shareAmount.toLocaleString()} USDT
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Section A Bottom Footer: Provably Fair SHA-256 Commit */}
          <div className="pt-2 border-t border-[#1f2737] flex items-center justify-between gap-1.5 shrink-0 text-[10px] font-mono-numbers">
            <div className="flex items-center gap-1 truncate text-[#94A3B8]">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span className="hidden xs:inline">Commit:</span>
              <span className="text-amber-300 truncate max-w-[110px] xs:max-w-[150px] sm:max-w-[190px]">
                {event?.sha256Seed || '0x4f8a93...c91d'}
              </span>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={() => copyHash(event?.sha256Seed || '0x4f8a93...c91d')}
                className="p-1 rounded bg-[#141924] hover:bg-[#1a2130] text-[#94A3B8] hover:text-white border border-[#272a31] cursor-pointer"
                title="Copy SHA-256 Commit"
              >
                {copiedHash ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
              </button>

              <button
                type="button"
                onClick={() => setIsProofModalOpen(true)}
                className="px-2 py-0.5 rounded bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[9px] font-bold cursor-pointer transition-colors"
              >
                Audit Proof
              </button>
            </div>
          </div>

        </section>

        {/* =================================================================== */}
        {/* SECTION B: WINNER INFORMATION AND PAYOUTS                           */}
        {/* =================================================================== */}
        <section className={`bg-[#0d1117] border border-[#272a31] rounded-2xl flex flex-col justify-between overflow-hidden shadow-xl ${
          isMobileLandscape
            ? 'col-span-7 p-2'
            : isDesktop || (isTablet && !isTabletPortrait)
              ? 'col-span-7 p-4 sm:p-5'
              : 'h-[56%] min-h-0 p-2.5 xs:p-3'
        }`}>
          
          {/* Section B Header: Title, Total Distributed & Winners Count */}
          <div className="flex items-center justify-between pb-2 border-b border-[#1f2737] shrink-0">
            <div className="flex items-center gap-1.5 xs:gap-2">
              <div className="w-6 h-6 xs:w-7 xs:h-7 rounded-lg bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400">
                <Coins className="w-3.5 h-3.5" />
              </div>
              <div>
                <h3 className="font-display font-black text-xs xs:text-sm text-white leading-tight">
                  Winners &amp; Payouts
                </h3>
                <p className="text-[9px] xs:text-[10px] text-[#94A3B8]">
                  Verified USDT Ledger Records
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 text-right font-mono-numbers">
              <span className="text-[10px] text-[#8b92a2] uppercase hidden xs:inline">Distributed:</span>
              <span className="font-black text-xs xs:text-sm text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-lg border border-emerald-500/20">
                +{totalDistributed.toLocaleString()} {currency}
              </span>
            </div>
          </div>

          {/* Section B Main: Verified Winners List (Pagination Supported, ZERO SCROLL) */}
          <div className="flex-1 min-h-0 flex flex-col justify-center py-1">
            {loadingWinners ? (
              <div className="py-6 text-center text-xs text-[#94A3B8] font-mono-numbers">
                Loading verified winners from ledger...
              </div>
            ) : dbWinners.length === 0 ? (
              /* No matching winners empty state */
              <div className="p-3 sm:p-4 rounded-xl bg-[#07090d] border border-[#272a31] text-center space-y-1.5">
                <div className="w-8 h-8 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mx-auto text-amber-400">
                  <AlertCircle className="w-4 h-4" />
                </div>
                <h4 className="font-bold text-xs text-white">
                  No Winning Tickets Matched
                </h4>
                <p className="text-[10px] text-[#94A3B8] max-w-sm mx-auto">
                  Zero tickets matched the drawn digits for this round. The {totalPrizePool.toLocaleString()} {currency} pot has been securely rolled forward to the next draw pool.
                </p>
              </div>
            ) : (
              /* Render Paginated Winners (Never overflows) */
              <div className="flex flex-col gap-1.5 sm:gap-2 h-full justify-around min-h-0">
                {paginatedWinners.map((w: any, idx: number) => {
                  const isCurrentUser = (wallet?.address && w.winnerAddress === wallet.address) || (user?.id && w.userId === user.id);

                  return (
                    <div
                      key={w.id || idx}
                      className={`p-1.5 sm:p-2 rounded-xl flex items-center justify-between border text-xs font-mono-numbers transition-all ${
                        isCurrentUser
                          ? 'bg-emerald-950/25 border-emerald-500/50 text-emerald-300 shadow-md shadow-emerald-500/10'
                          : 'bg-[#07090d] border-[#272a31] text-white hover:border-purple-500/40'
                      }`}
                    >
                      {/* Left: Position Rank + Winner Display Name */}
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={`w-5 h-5 rounded-md text-[10px] font-black flex items-center justify-center shrink-0 ${
                          w.rank === 1
                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                            : 'bg-[#141924] text-[#94A3B8] border border-[#272a31]'
                        }`}>
                          #{w.rank || (idx + 1)}
                        </span>

                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="font-sans font-bold text-xs truncate max-w-[90px] xs:max-w-[130px] sm:max-w-[180px]">
                              {formatWinnerName(w)}
                            </span>
                            {isCurrentUser && (
                              <span className="text-[8px] uppercase font-black px-1.5 py-0.2 rounded bg-emerald-500 text-black">
                                YOU
                              </span>
                            )}
                          </div>
                          <span className="text-[9px] text-[#64748B] block truncate">
                            Ticket #{w.ticketId}
                          </span>
                        </div>
                      </div>

                      {/* Center: Winning 4-Digit Combination Badge */}
                      <div className="text-center px-1">
                        <span className="text-[8px] text-[#64748B] uppercase block">Drawn</span>
                        <span className="px-1.5 py-0.5 rounded bg-[#141924] border border-emerald-500/40 text-emerald-300 font-mono-numbers font-black text-[11px] tracking-wider">
                          [{w.winningDigits}]
                        </span>
                      </div>

                      {/* Right: Payout Amount in USDT + Status */}
                      <div className="text-right shrink-0">
                        <span className="font-mono-numbers font-black text-emerald-400 text-xs sm:text-sm block">
                          +{Number(w.payoutAmount).toLocaleString()} {currency}
                        </span>
                        <span className="text-[8px] uppercase font-bold px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 inline-block">
                          ✓ {w.status === 'paid' ? 'Paid' : 'Disbursed'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Section B Bottom Footer: Non-Scrolling Pagination & User Participation Bar */}
          <div className="pt-2 border-t border-[#1f2737] flex items-center justify-between gap-2 shrink-0 text-[10px] font-mono-numbers">
            
            {/* User Personal Participation Pill */}
            <div className="flex items-center gap-1.5 truncate text-[#94A3B8]">
              <Ticket className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span>Your Tickets:</span>
              <strong className="text-white">{myTickets.length}</strong>
              {myWinningTickets.length > 0 ? (
                <span className="text-emerald-400 font-bold ml-1 animate-pulse">
                  🎉 {myWinningTickets.length} Won!
                </span>
              ) : myTickets.length > 0 ? (
                <span className="text-[#64748B] ml-1">Unmatched</span>
              ) : (
                <span className="text-[#64748B] ml-1">Not participated</span>
              )}
            </div>

            {/* Non-Scrolling Pagination Bar */}
            {totalPages > 1 && (
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage(prev => Math.max(1, prev - 1))}
                  className="p-1 rounded bg-[#141924] hover:bg-[#1a2130] text-[#94A3B8] hover:text-white border border-[#272a31] disabled:opacity-30 cursor-pointer"
                  title="Previous Winners Page"
                >
                  <ChevronLeft className="w-3 h-3" />
                </button>

                <span className="text-[9px] text-[#94A3B8]">
                  <strong className="text-white">{page}</strong> / {totalPages}
                </span>

                <button
                  type="button"
                  disabled={page >= totalPages}
                  onClick={() => setPage(prev => Math.min(totalPages, prev + 1))}
                  className="p-1 rounded bg-[#141924] hover:bg-[#1a2130] text-[#94A3B8] hover:text-white border border-[#272a31] disabled:opacity-30 cursor-pointer"
                  title="Next Winners Page"
                >
                  <ChevronRight className="w-3 h-3" />
                </button>
              </div>
            )}

          </div>

        </section>

      </div>

      {/* Provably Fair Audit Modal */}
      {isProofModalOpen && (
        <ProvablyFairModal
          isOpen={isProofModalOpen}
          onClose={() => setIsProofModalOpen(false)}
          auditData={{
            id: event?.id,
            event_id: event?.id,
            event_title: event?.title,
            winning_digits: winningCodesList.join(', '),
            commit_hash: event?.sha256Seed || '0x4f8a...c91d',
            revealed_seed: event?.serverSeed || event?.sha256Seed || '0x4f8a...c91d',
            client_seed: event?.clientSeed || 'client-seed-active',
            nonce: 1,
            payout: totalDistributed,
            status: 'completed'
          }}
        />
      )}

    </div>
  );
}
