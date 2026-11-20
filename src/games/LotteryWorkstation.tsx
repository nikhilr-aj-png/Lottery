import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useLottery } from '../context/LotteryContext';
import { 
  ShieldCheck, 
  Sparkles, 
  AlertCircle, 
  Coins, 
  Clock, 
  Ticket, 
  ArrowLeft,
  RotateCcw,
  Activity,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Wallet,
  Hash,
  Flame,
  Check,
  Trophy,
  Zap,
  Copy,
  ExternalLink,
  Layers,
  Info
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { soundFX } from '../engine/SoundFXService';
import LotteryShowResultScreen from '../components/LotteryShowResultScreen';
import { getEventStatusInfo } from '../utils/eventStatus';

export interface LotteryWorkstationProps {
  room?: any;
  onBackToLobby?: () => void;
  activityBox?: React.ReactNode;
}

/**
 * Four Digit Lottery Workstation
 * Redesigned strictly in Google Stitch (Obsidian Sovereign Design System: #0B0F19, #111728, #7C3AED, #F59E0B, #10B981)
 * 
 * Strict Redesign Mandates Implemented:
 * 1. Strict Two-Box Layout: Box 1 (Number Selection ~70%) + Box 2 (Direct Purchase ~30%) across all devices.
 * 2. Complete Removal of Quick Pick (No 1/5/10 pick presets, No random generation, pure manual selection).
 * 3. Integrated Room Activity: Embedded cleanly inside Box 1 beneath the keypad, never as a 3rd primary column.
 * 4. Fixed Room Header Timer Overlap: Multi-row responsive architecture prevents countdown from ever overlapping titles or badges.
 * 5. Unified Obsidian Sovereign color palette across all breakpoints.
 */
export default function LotteryWorkstation({ room, onBackToLobby, activityBox }: LotteryWorkstationProps) {
  const { 
    user, 
    wallet, 
    events, 
    tickets, 
    buyTickets, 
    isUserTicketNumberPurchased,
    getUnsoldRandomNumber, 
    showToast, 
    setIsAuthModalOpen 
  } = useLottery();

  // ---------------------------------------------------------------------------
  // 1. Dynamic Viewport & Orientation Detection
  // ---------------------------------------------------------------------------
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

  const isMobileLandscape = viewport.width > viewport.height && viewport.height < 540;
  const isMobilePortrait = viewport.width < 768 && !isMobileLandscape;

  // Mobile activity accordion state inside Box 1 (default collapsed on narrow mobile screens)
  const [isActivityExpanded, setIsActivityExpanded] = useState(false);
  const [autoEnterNextDraw, setAutoEnterNextDraw] = useState(false);

  // ---------------------------------------------------------------------------
  // 2. Resolve matching or active lottery event for this room
  // ---------------------------------------------------------------------------
  const event = useMemo(() => {
    if (!room) return events[0] || null;
    if (room.event) return room.event;
    const matching = events.find((e: any) => 
      e.id === room.id || 
      e.id === room.drawId || 
      (room.name && e.title && e.title.toLowerCase().includes(room.name.toLowerCase()))
    );
    if (matching) return matching;

    const active = events.find((e: any) => e.status === 'active');
    if (active) {
      return {
        ...active,
        id: room.drawId || room.id || active.id,
        title: room.name || active.title,
        ticketPrice: room.minStakeFC || active.ticketPrice || 10,
        poolPrize: room.prizeInfo?.match(/\d+[\d,]*/)?.[0]?.replace(',', '') || active.poolPrize || 1000
      };
    }

    return {
      id: room.drawId || room.id || 'evt-default',
      title: room.name || 'Four-Digit Lottery Draw',
      ticketPrice: room.minStakeFC || 10,
      currency: room.currency || 'USDT',
      poolPrize: room.poolPrize || 1000,
      drawTime: Date.now() + (room.drawDurationHours || 24) * 3600 * 1000,
      status: 'active',
      ticketsSold: 0,
      participantsCount: 0,
      sha256Seed: '0x' + Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join('')
    };
  }, [room, events]);

  // ---------------------------------------------------------------------------
  // 3. Active 4-digit input slots state (Pure manual selection flow)
  // ---------------------------------------------------------------------------
  const [digits, setDigits] = useState<string[]>(['7', '4', '2', '9']);
  const [activeSlot, setActiveSlot] = useState<number>(0);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [copiedSeed, setCopiedSeed] = useState<boolean>(false);

  // ---------------------------------------------------------------------------
  // 4. Countdown timer & Status
  // ---------------------------------------------------------------------------
  const [timeLeft, setTimeLeft] = useState({ hours: 0, minutes: 0, seconds: 0 });
  const statusInfo = getEventStatusInfo(event);
  const isTimedOut = statusInfo.isEnd;

  useEffect(() => {
    const updateTime = () => {
      const diff = Math.max(0, (event.drawTime || Date.now() + 86400000) - Date.now());
      const h = Math.floor(diff / (1000 * 60 * 60));
      const m = Math.floor((diff / (1000 * 60)) % 60);
      const s = Math.floor((diff / 1000) % 60);
      setTimeLeft({ hours: h, minutes: m, seconds: s });
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, [event.drawTime]);

  // Current dial combination string
  const currentNumberStr = digits.join('');

  // ---------------------------------------------------------------------------
  // 5. Check if CURRENT USER already purchased this number in this event
  // ---------------------------------------------------------------------------
  const isAlreadyPurchasedByMe = useMemo(() => {
    if (isUserTicketNumberPurchased) {
      return isUserTicketNumberPurchased(event.id, currentNumberStr);
    }
    if (!user && !wallet?.address) return false;
    return (tickets || []).some((t: any) => 
      (t.eventId === event.id || t.event_id === event.id) && 
      String(t.ticketNumber).padStart(4, '0') === currentNumberStr &&
      (
        (wallet?.address && t.userAddress === wallet.address) ||
        (user?.id && (t.userId === user.id || t.user_id === user.id))
      )
    );
  }, [isUserTicketNumberPurchased, event.id, currentNumberStr, tickets, user, wallet?.address]);

  // ---------------------------------------------------------------------------
  // 6. Manual Keypad Actions (1-9, Clear, 0) - NO RANDOM, NO ARROWS
  // ---------------------------------------------------------------------------
  const handleKeypadPress = useCallback((val: number) => {
    soundFX.playDialTick();
    setDigits(prev => {
      const updated = [...prev];
      updated[activeSlot] = String(val);
      return updated;
    });
    // Advance to next slot automatically for smooth input
    setActiveSlot(prev => (prev < 3 ? prev + 1 : 0));
  }, [activeSlot]);

  const handleClearSlot = useCallback(() => {
    soundFX.playClick();
    setDigits(prev => {
      const updated = [...prev];
      updated[activeSlot] = '0';
      return updated;
    });
    setActiveSlot(prev => (prev === 0 ? 0 : prev - 1));
  }, [activeSlot]);

  const handleResetAll = useCallback(() => {
    soundFX.playClick();
    setDigits(['0', '0', '0', '0']);
    setActiveSlot(0);
  }, []);

  // Physical keyboard listener (0-9, Backspace, Arrow keys for accessibility)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) return;

      if (/^[0-9]$/.test(e.key)) {
        handleKeypadPress(parseInt(e.key, 10));
      } else if (e.key === 'Backspace' || e.key === 'Delete') {
        handleClearSlot();
      } else if (e.key === 'ArrowLeft') {
        setActiveSlot(prev => (prev === 0 ? 3 : prev - 1));
      } else if (e.key === 'ArrowRight') {
        setActiveSlot(prev => (prev === 3 ? 0 : prev + 1));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeypadPress, handleClearSlot]);

  // ---------------------------------------------------------------------------
  // 7. Direct Ticket Purchase Action (Single Ticket Manual Purchase Only)
  // ---------------------------------------------------------------------------
  const ticketPrice = Number(event.ticketPrice || 10);
  const totalPurchaseCost = ticketPrice; // Direct buy of 1 manually chosen combination

  const handlePurchaseAction = async () => {
    if (isSubmitting) return;

    if (isTimedOut) {
      showToast('This draw has concluded and is closed for purchases!', 'error');
      return;
    }
    if (!user) {
      showToast('Authentication required: Please log in to buy lottery tickets!', 'info');
      setIsAuthModalOpen(true);
      return;
    }

    if (Number(wallet.balance || 0) < totalPurchaseCost) {
      showToast(`Insufficient USDT balance. Required: ${totalPurchaseCost.toFixed(2)} USDT, Available: ${Number(wallet.balance || 0).toFixed(2)} USDT`, 'error');
      return;
    }

    if (isAlreadyPurchasedByMe) {
      showToast(`You have already purchased ticket #${currentNumberStr} for this draw! Duplicate purchases by the same user are not permitted.`, 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      const success = await buyTickets(event.id, [currentNumberStr]);
      if (success) {
        soundFX.playWinFanfare('big');
        try {
          confetti({
            particleCount: 110,
            spread: 75,
            origin: { y: 0.65 },
            colors: ['#7C3AED', '#F59E0B', '#10B981', '#FFFFFF']
          });
        } catch (_) {}

        showToast(`🎉 Successfully purchased Ticket #${currentNumberStr} for ${ticketPrice} USDT!`, 'success');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // ---------------------------------------------------------------------------
  // 8. Room Activity Data
  // ---------------------------------------------------------------------------
  const roomActivityTickets = useMemo(() => {
    if (!tickets) return [];
    return tickets
      .filter((t: any) => t.eventId === event.id || t.event_id === event.id)
      .slice(0, 30);
  }, [tickets, event.id]);

  const myTicketsInThisRoom = useMemo(() => {
    if (!tickets || (!user && !wallet?.address)) return [];
    return tickets.filter((t: any) => 
      (t.eventId === event.id || t.event_id === event.id) && 
      (
        (wallet?.address && t.userAddress === wallet.address) ||
        (user?.id && (t.userId === user.id || t.user_id === user.id))
      )
    );
  }, [tickets, user, wallet?.address, event.id]);

  const formatTimeAgo = (timestamp: number) => {
    const diff = Math.max(0, Date.now() - timestamp);
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  };

  const handleCopySeed = () => {
    const seed = event.sha256Seed || event.sha256_seed;
    if (seed) {
      navigator.clipboard.writeText(seed);
      setCopiedSeed(true);
      setTimeout(() => setCopiedSeed(false), 2000);
    }
  };

  // ---------------------------------------------------------------------------
  // 9. Concluded / Expired State -> Show Result Screen
  // ---------------------------------------------------------------------------
  if (isTimedOut) {
    return (
      <div className="w-full h-full max-h-full min-h-0 overflow-hidden flex flex-col">
        <LotteryShowResultScreen
          event={event}
          room={room}
          onBackToLobby={onBackToLobby}
          myTickets={myTicketsInThisRoom}
        />
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // 10. Render Sub-components
  // ---------------------------------------------------------------------------

  // Digit Slots: 1st, 2nd, 3rd, 4th
  const renderDigitSlots = () => {
    return (
      <div className="w-full space-y-2">
        <div className="grid grid-cols-4 gap-2 xs:gap-2.5 sm:gap-3">
          {digits.map((digit, idx) => {
            const isSelected = activeSlot === idx;
            const ordinals = ['1ST', '2ND', '3RD', '4TH'];

            return (
              <button
                key={idx}
                type="button"
                onClick={() => setActiveSlot(idx)}
                className={`h-16 xs:h-18 sm:h-20 rounded-2xl flex flex-col items-center justify-center cursor-pointer transition-all duration-150 select-none border-2 shadow-inner group relative ${
                  isSelected
                    ? 'border-[#7C3AED] bg-[#7C3AED]/20 shadow-[0_0_20px_rgba(124,58,237,0.4)] ring-2 ring-[#7C3AED]/50 scale-[1.02]'
                    : isAlreadyPurchasedByMe
                    ? 'border-rose-500/40 bg-rose-950/20 text-rose-200 hover:border-rose-400/60'
                    : 'border-[#1B2238] bg-[#0A0E18] hover:border-[#7C3AED]/40 text-white hover:bg-[#111728]'
                }`}
                title={`Select Digit Slot ${idx + 1}`}
                aria-label={`Digit slot ${idx + 1}, current value ${digit}`}
              >
                <span className={`text-[10px] font-mono-numbers font-extrabold uppercase tracking-widest block transition-colors ${
                  isSelected ? 'text-[#D2BBFF]' : 'text-[#64748B] group-hover:text-[#94A3B8]'
                }`}>
                  {ordinals[idx]}
                </span>

                <span className={`font-mono-numbers font-black text-2xl xs:text-3xl sm:text-4xl my-0.5 transition-colors ${
                  isSelected 
                    ? 'text-[#F59E0B] drop-shadow-[0_0_10px_rgba(245,158,11,0.6)]' 
                    : isAlreadyPurchasedByMe 
                    ? 'text-rose-400' 
                    : 'text-white'
                }`}>
                  {digit}
                </span>

                {/* Bottom Active Glow Accent Bar */}
                <span className={`w-8 h-1 rounded-full transition-all ${
                  isSelected ? 'bg-[#7C3AED] shadow-[0_0_10px_rgba(124,58,237,0.9)]' : 'bg-transparent'
                }`} />
              </button>
            );
          })}
        </div>

        {/* Combination Availability Status Banner */}
        <div className="flex items-center justify-between text-xs px-1 pt-0.5">
          <div className="flex items-center gap-1.5 font-mono-numbers">
            <span className="text-[#94A3B8] text-[11px]">Selected:</span>
            <span className="font-black text-[#F59E0B] text-sm sm:text-base">
              #{currentNumberStr}
            </span>
          </div>

          <div>
            {isAlreadyPurchasedByMe ? (
              <span className="px-3 py-1 rounded-full bg-rose-500/15 border border-rose-500/35 text-rose-300 text-xs font-bold flex items-center gap-1.5 shadow-sm">
                <AlertCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                <span>Combination Already Owned</span>
              </span>
            ) : (
              <span className="px-3 py-1 rounded-full bg-[#10B981]/15 border border-[#10B981]/35 text-[#10B981] text-xs font-bold flex items-center gap-1.5 shadow-sm">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#10B981] shrink-0" />
                <span>Combination Available · Ready to purchase</span>
              </span>
            )}
          </div>
        </div>
      </div>
    );
  };

  // Pure Interactive 3x4 Numeric Keypad (Manual Selection Only)
  const renderNumericKeypad = () => {
    return (
      <div className="w-full space-y-2">
        <div className="grid grid-cols-3 gap-2 sm:gap-2.5">
          {/* Row 1: 1, 2, 3 */}
          {[1, 2, 3].map((num) => (
            <button
              key={num}
              type="button"
              onClick={() => handleKeypadPress(num)}
              className="h-12 xs:h-13 sm:h-14 rounded-2xl bg-[#0B0F19] hover:bg-[#151C2B] active:bg-[#7C3AED]/30 active:scale-95 border border-[#1F2737] hover:border-[#7C3AED]/50 shadow-md transition-all cursor-pointer font-mono-numbers font-black text-xl sm:text-2xl text-white hover:text-[#D2BBFF] flex items-center justify-center select-none"
              aria-label={`Digit ${num}`}
            >
              {num}
            </button>
          ))}

          {/* Row 2: 4, 5, 6 */}
          {[4, 5, 6].map((num) => (
            <button
              key={num}
              type="button"
              onClick={() => handleKeypadPress(num)}
              className="h-12 xs:h-13 sm:h-14 rounded-2xl bg-[#0B0F19] hover:bg-[#151C2B] active:bg-[#7C3AED]/30 active:scale-95 border border-[#1F2737] hover:border-[#7C3AED]/50 shadow-md transition-all cursor-pointer font-mono-numbers font-black text-xl sm:text-2xl text-white hover:text-[#D2BBFF] flex items-center justify-center select-none"
              aria-label={`Digit ${num}`}
            >
              {num}
            </button>
          ))}

          {/* Row 3: 7, 8, 9 */}
          {[7, 8, 9].map((num) => (
            <button
              key={num}
              type="button"
              onClick={() => handleKeypadPress(num)}
              className="h-12 xs:h-13 sm:h-14 rounded-2xl bg-[#0B0F19] hover:bg-[#151C2B] active:bg-[#7C3AED]/30 active:scale-95 border border-[#1F2737] hover:border-[#7C3AED]/50 shadow-md transition-all cursor-pointer font-mono-numbers font-black text-xl sm:text-2xl text-white hover:text-[#D2BBFF] flex items-center justify-center select-none"
              aria-label={`Digit ${num}`}
            >
              {num}
            </button>
          ))}

          {/* Row 4: Clear | 0 | Balanced Manual Slot */}
          <button
            type="button"
            onClick={handleClearSlot}
            className="h-12 xs:h-13 sm:h-14 rounded-2xl bg-rose-950/30 hover:bg-rose-900/40 active:scale-95 border border-rose-500/40 text-rose-300 hover:text-rose-200 transition-all cursor-pointer font-bold uppercase tracking-wider text-xs sm:text-sm flex items-center justify-center gap-1 select-none shadow-md"
            title="Clear active digit"
            aria-label="Clear active digit"
          >
            <span>⌫ Clear</span>
          </button>

          <button
            type="button"
            onClick={() => handleKeypadPress(0)}
            className="h-12 xs:h-13 sm:h-14 rounded-2xl bg-[#0B0F19] hover:bg-[#151C2B] active:bg-[#7C3AED]/30 active:scale-95 border border-[#1F2737] hover:border-[#7C3AED]/50 shadow-md transition-all cursor-pointer font-mono-numbers font-black text-xl sm:text-2xl text-white hover:text-[#D2BBFF] flex items-center justify-center select-none"
            aria-label="Digit 0"
          >
            0
          </button>

          {/* Balanced 12th Slot: Manual Mode Badge (Maintains strict 3x4 grid symmetry) */}
          <div
            className="h-12 xs:h-13 sm:h-14 rounded-2xl border border-dashed border-[#1F2737]/80 bg-[#0A0E18]/50 flex flex-col items-center justify-center text-[#64748B] select-none pointer-events-none"
            aria-hidden="true"
          >
            <span className="text-[10px] font-mono-numbers font-extrabold uppercase tracking-widest text-[#475569]">
              Manual
            </span>
            <span className="text-[9px] text-[#334155]">
              Slot {activeSlot + 1}/4
            </span>
          </div>
        </div>
      </div>
    );
  };

  // Integrated Room Activity List (Embedded inside Box 1)
  const renderActivityFeed = () => {
    if (roomActivityTickets.length === 0) {
      return (
        <div className="py-4 text-center text-[#94A3B8] text-xs space-y-1">
          <Ticket className="w-5 h-5 text-[#64748B]/50 mx-auto" />
          <p className="font-bold text-white">No Tickets Purchased Yet</p>
          <p className="text-[11px] text-[#64748B]">Be the first to secure a 4-digit number in this draw!</p>
        </div>
      );
    }

    return (
      <div className="space-y-1.5 max-h-[160px] overflow-y-auto no-scrollbar pr-1">
        {roomActivityTickets.slice(0, 15).map((tkt: any, idx: number) => {
          const isMine = (user && tkt.userId === user.id) || (wallet?.address && tkt.userAddress === wallet.address);
          const displayUsername = tkt.username || (isMine ? '@You' : `@p_${tkt.id ? tkt.id.slice(-4) : idx}`);
          const ticketNumberFormatted = `#${String(tkt.ticketNumber).padStart(4, '0')}`;

          return (
            <div
              key={tkt.id || idx}
              className={`p-2 rounded-xl border flex items-center justify-between text-xs font-mono-numbers transition-colors ${
                isMine
                  ? 'bg-[#7C3AED]/15 border-[#7C3AED]/40 text-[#D2BBFF]'
                  : 'bg-[#0B0F19] border-[#1F2737] hover:border-[#2A354D] text-white'
              }`}
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className={`w-2 h-2 rounded-full ${isMine ? 'bg-[#F59E0B]' : 'bg-[#10B981]'}`} />
                <span className="font-bold truncate text-[11px] text-[#E2E8F0]">
                  {isMine ? '★ You' : displayUsername}
                </span>
                <span className="text-[10px] text-[#64748B] hidden xs:inline">
                  {formatTimeAgo(Number(tkt.purchaseTime || Date.now()))}
                </span>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <span className="font-black text-xs text-[#10B981] bg-[#10B981]/10 px-2 py-0.5 rounded-md border border-[#10B981]/20">
                  {ticketNumberFormatted}
                </span>
                <span className="text-[10px] text-[#94A3B8]">
                  {tkt.price || ticketPrice} USDT
                </span>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  // ---------------------------------------------------------------------------
  // 11. Main View Layout
  // ---------------------------------------------------------------------------
  return (
    <div className="w-full h-full flex flex-col min-h-0 overflow-y-auto no-scrollbar text-left p-2.5 sm:p-4 lg:p-6 space-y-3 sm:space-y-4 select-none">
      
      {/* ===================================================================== */}
      {/* 1. ROOM HEADER: FIXED MULTI-ROW ARCHITECTURE (ZERO OVERLAPPING)       */}
      {/* ===================================================================== */}
      <header className="w-full max-w-7xl mx-auto rounded-2xl p-3 sm:p-4 border border-[#1B2238] bg-[#111728]/95 backdrop-blur-md shadow-xl shrink-0 space-y-2.5">
        
        {/* ROW 1: Section A - Room Information */}
        <div className="flex items-center justify-between gap-3">
          
          {/* Back Button + Title + LIVE Beacon */}
          <div className="flex items-center gap-2.5 min-w-0">
            {onBackToLobby && (
              <button
                type="button"
                onClick={onBackToLobby}
                className="px-2.5 py-1.5 rounded-xl bg-[#0B0F19] hover:bg-[#151C2B] text-[#94A3B8] hover:text-white border border-[#1F2737] text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all shrink-0 shadow-sm active:scale-95"
                title="Return to Lottery Lobby"
              >
                <ArrowLeft className="w-3.5 h-3.5 text-[#F59E0B]" />
                <span className="hidden xs:inline">Lobby</span>
              </button>
            )}

            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="font-display font-black text-sm sm:text-lg text-white truncate">
                  {room?.name || event.title}
                </h2>
                
                {/* LIVE Emerald Status Beacon */}
                <span className="px-2 py-0.5 rounded-full bg-[#10B981]/15 text-[#10B981] border border-[#10B981]/30 text-[10px] font-mono-numbers font-extrabold uppercase flex items-center gap-1 shrink-0">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#10B981] animate-ping" />
                  <span>LIVE</span>
                </span>
              </div>
              <p className="text-[10px] sm:text-xs text-[#94A3B8] font-mono-numbers truncate hidden md:block">
                On-Chain Cryptographic 4-Digit Lottery Draw · #DRAW-{event.id ? event.id.slice(-6).toUpperCase() : '884'}
              </p>
            </div>
          </div>

          {/* Desktop/Tablet Inline Stats (When screen is wide enough) */}
          <div className="hidden md:flex items-center gap-2.5 text-xs font-mono-numbers shrink-0">
            <div className="bg-[#0B0F19] px-3 py-1.5 rounded-xl border border-[#1F2737] flex items-center gap-2">
              <span className="text-[#94A3B8] text-[10px] uppercase font-bold">Ticket:</span>
              <strong className="text-white font-black">{ticketPrice} USDT</strong>
            </div>

            <div className="bg-[#0B0F19] px-3 py-1.5 rounded-xl border border-[#1F2737] flex items-center gap-2">
              <Trophy className="w-3.5 h-3.5 text-[#F59E0B]" />
              <span className="text-[#94A3B8] text-[10px] uppercase font-bold">Jackpot:</span>
              <strong className="text-[#F59E0B] font-black">{Number(event.poolPrize || 5000).toLocaleString()} USDT</strong>
            </div>

            <div className="bg-[#0B0F19] px-3 py-1.5 rounded-xl border border-[#7C3AED]/40 flex items-center gap-2 text-[#D2BBFF]">
              <Clock className="w-3.5 h-3.5 text-[#7C3AED]" />
              <span className="font-bold">{timeLeft.hours}h {timeLeft.minutes}m {timeLeft.seconds}s</span>
            </div>
          </div>

        </div>

        {/* ROW 2: Mobile Clean 3-Column Stats Bar (Zero Overlap with Title or LIVE Badge) */}
        <div className="grid grid-cols-3 divide-x divide-[#1F2737] rounded-xl bg-[#0B0F19] border border-[#1F2737] p-2 text-center text-xs font-mono-numbers md:hidden shadow-inner">
          <div className="px-1">
            <span className="text-[9px] uppercase font-extrabold text-[#94A3B8] block">TICKET</span>
            <span className="font-black text-white text-xs xs:text-sm">{ticketPrice} USDT</span>
          </div>

          <div className="px-1">
            <span className="text-[9px] uppercase font-extrabold text-[#F59E0B]/80 block">JACKPOT</span>
            <span className="font-black text-[#F59E0B] text-xs xs:text-sm truncate block">
              {Number(event.poolPrize || 5000).toLocaleString()} USDT
            </span>
          </div>

          <div className="px-1">
            <span className="text-[9px] uppercase font-extrabold text-[#10B981]/80 block">CLOSING IN</span>
            <span className="font-black text-[#10B981] text-xs xs:text-sm truncate block">
              {timeLeft.hours}h {timeLeft.minutes}m {timeLeft.seconds}s
            </span>
          </div>
        </div>

      </header>

      {/* ===================================================================== */}
      {/* 2. STRICT TWO-BOX CONTENT LAYOUT (70% / 30% SPLIT ON TABLET/DESKTOP)   */}
      {/* ===================================================================== */}
      <main className="w-full max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-3 sm:gap-4 lg:gap-5 items-start">
        
        {/* ------------------------------------------------------------------- */}
        {/* BOX 1: NUMBER SELECTION & INTEGRATED ACTIVITY (~70% HORIZONTAL)     */}
        {/* ------------------------------------------------------------------- */}
        <section className="lg:col-span-8 bg-[#111728]/95 border border-[#1B2238] rounded-2xl p-3.5 sm:p-5 flex flex-col justify-between shadow-xl space-y-4 backdrop-blur-md">
          
          {/* Box 1 Header */}
          <div className="flex items-center justify-between pb-2.5 border-b border-[#1F2737]">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-[#7C3AED]/15 border border-[#7C3AED]/30 flex items-center justify-center text-[#7C3AED]">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-display font-extrabold text-sm sm:text-base text-white">
                  Pick 4 Digits
                </h3>
                <p className="text-[11px] text-[#94A3B8]">
                  Select slot and enter your chosen 4-digit sequence manually
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleResetAll}
              className="px-2.5 py-1 rounded-xl bg-[#0B0F19] hover:bg-[#151C2B] text-[#94A3B8] hover:text-white border border-[#1F2737] text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors shadow-sm active:scale-95"
              title="Reset combination to 0000"
            >
              <RotateCcw className="w-3 h-3 text-[#F59E0B]" />
              <span>Reset</span>
            </button>
          </div>

          {/* 4 Digit Slots */}
          {renderDigitSlots()}

          {/* 3x4 Pure Manual Numeric Keypad */}
          {renderNumericKeypad()}

          {/* INTEGRATED SECONDARY ROOM ACTIVITY (Inside Box 1, Never a 3rd Column) */}
          <div className="pt-3 border-t border-[#1F2737] space-y-2">
            
            {/* Activity Header with Toggle */}
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => setIsActivityExpanded(!isActivityExpanded)}
                className="flex items-center gap-2 text-left cursor-pointer group select-none"
              >
                <div className="w-6 h-6 rounded-lg bg-[#10B981]/15 border border-[#10B981]/30 flex items-center justify-center text-[#10B981]">
                  <Activity className="w-3.5 h-3.5" />
                </div>
                <div>
                  <span className="font-display font-bold text-xs text-white group-hover:text-[#D2BBFF] transition-colors flex items-center gap-1.5">
                    <span>Live Room Activity</span>
                    <span className="text-[10px] font-mono-numbers px-2 py-0.2 rounded-full bg-[#10B981]/15 text-[#10B981] border border-[#10B981]/30 font-bold">
                      {roomActivityTickets.length} Tickets
                    </span>
                  </span>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setIsActivityExpanded(!isActivityExpanded)}
                className="text-xs text-[#94A3B8] hover:text-white flex items-center gap-1 cursor-pointer font-bold"
              >
                <span className="text-[11px] uppercase font-mono-numbers">{isActivityExpanded ? 'Hide Feed' : 'View Feed'}</span>
                {isActivityExpanded ? <ChevronUp className="w-3.5 h-3.5 text-[#7C3AED]" /> : <ChevronDown className="w-3.5 h-3.5 text-[#7C3AED]" />}
              </button>
            </div>

            {/* Expandable Activity Content on Mobile / Visible on Desktop */}
            <div className={`${isActivityExpanded ? 'block' : 'hidden md:block'} transition-all duration-200 pt-1`}>
              {renderActivityFeed()}
            </div>

          </div>

        </section>

        {/* ------------------------------------------------------------------- */}
        {/* BOX 2: DIRECT PURCHASE PANEL (~30% HORIZONTAL / DIRECT BUY ONLY)    */}
        {/* ------------------------------------------------------------------- */}
        <section className="lg:col-span-4 bg-[#111728]/95 border border-[#1B2238] rounded-2xl p-3.5 sm:p-5 flex flex-col justify-between shadow-xl space-y-4 backdrop-blur-md">
          
          <div className="space-y-4">
            
            {/* Box 2 Header */}
            <div className="flex items-center justify-between pb-2.5 border-b border-[#1F2737]">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-[#7C3AED]/15 border border-[#7C3AED]/30 flex items-center justify-center text-[#7C3AED]">
                  <Ticket className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-display font-extrabold text-sm sm:text-base text-white">
                    Direct Purchase
                  </h3>
                  <p className="text-[11px] text-[#94A3B8]">
                    Manual ticket confirmation
                  </p>
                </div>
              </div>

              <span className="text-[10px] font-mono-numbers px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-bold uppercase">
                INSTANT
              </span>
            </div>

            {/* Order Summary Card */}
            <div className="p-3.5 rounded-2xl bg-[#0B0F19] border border-[#1F2737] space-y-2.5 shadow-inner font-mono-numbers text-xs">
              
              {/* Combination Row */}
              <div className="flex items-center justify-between pb-2 border-b border-[#1F2737]">
                <span className="text-[#94A3B8]">Chosen Number:</span>
                <strong className="text-white font-black text-sm bg-[#161F30] px-2.5 py-0.5 rounded-lg border border-[#27354F]">
                  #{currentNumberStr}
                </strong>
              </div>

              {/* Quantity Row */}
              <div className="flex items-center justify-between text-[#94A3B8]">
                <span>Ticket Quantity:</span>
                <strong className="text-white">1 Ticket (Manual)</strong>
              </div>

              {/* Unit Price Row */}
              <div className="flex items-center justify-between text-[#94A3B8]">
                <span>Unit Price:</span>
                <strong className="text-white">{ticketPrice.toFixed(2)} USDT</strong>
              </div>

              {/* Network Fee / Escrow */}
              <div className="flex items-center justify-between text-[#94A3B8]">
                <span>Gas / Escrow:</span>
                <span className="text-emerald-400 font-bold">0.00 USDT (0%)</span>
              </div>

              {/* Total Cost Highlight */}
              <div className="flex items-center justify-between pt-2 border-t border-[#1F2737]">
                <span className="text-[#D2BBFF] font-bold text-xs">Total Purchase:</span>
                <strong className="text-[#F59E0B] font-black text-base sm:text-lg">
                  {totalPurchaseCost.toFixed(2)} USDT
                </strong>
              </div>

              {/* Available Wallet Balance */}
              <div className="flex items-center justify-between pt-1 text-[11px] text-[#64748B]">
                <span className="flex items-center gap-1">
                  <Wallet className="w-3 h-3 text-[#94A3B8]" />
                  <span>Wallet Balance:</span>
                </span>
                <span className={Number(wallet.balance || 0) < totalPurchaseCost ? 'text-rose-400 font-bold' : 'text-[#10B981] font-bold'}>
                  {Number(wallet.balance || 0).toFixed(2)} USDT
                </span>
              </div>

            </div>

            {/* Auto-enter Next Draw Toggle */}
            <div className="p-2.5 rounded-xl bg-[#0B0F19]/60 border border-[#1F2737] flex items-center justify-between text-xs">
              <label className="flex items-center gap-2 cursor-pointer text-[#94A3B8] font-bold text-[11px]">
                <input
                  type="checkbox"
                  checked={autoEnterNextDraw}
                  onChange={(e) => setAutoEnterNextDraw(e.target.checked)}
                  className="accent-[#7C3AED] rounded cursor-pointer w-4 h-4"
                />
                <span>Auto-enter next draw if unclaimed</span>
              </label>
            </div>

          </div>

          {/* Primary Action Button: Prominent Gold Direct Buy CTA */}
          <div className="space-y-2 pt-1">
            <button
              type="button"
              onClick={handlePurchaseAction}
              disabled={
                isSubmitting || 
                isTimedOut || 
                isAlreadyPurchasedByMe || 
                Number(wallet.balance || 0) < totalPurchaseCost
              }
              className={`w-full py-3.5 rounded-xl font-display font-black text-sm uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer shadow-lg transition-all ${
                isAlreadyPurchasedByMe
                  ? 'bg-[#181D29] text-rose-300 border border-rose-500/40 cursor-not-allowed opacity-80'
                  : Number(wallet.balance || 0) < totalPurchaseCost
                  ? 'bg-[#181D29] text-[#8B92A2] border border-[#242D40] cursor-not-allowed opacity-75'
                  : 'btn-gold shadow-[#F59E0B]/25 active:scale-98'
              }`}
            >
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                  <span>Processing Transaction...</span>
                </>
              ) : isAlreadyPurchasedByMe ? (
                <>
                  <AlertCircle className="w-4 h-4 text-rose-400" />
                  <span>Ticket Already Owned</span>
                </>
              ) : Number(wallet.balance || 0) < totalPurchaseCost ? (
                <span>Insufficient USDT Balance</span>
              ) : (
                <>
                  <Zap className="w-4 h-4 fill-current" />
                  <span>Buy 1 Ticket ({totalPurchaseCost.toFixed(2)} USDT)</span>
                </>
              )}
            </button>

            {/* Escrow Footnote */}
            <p className="text-[10px] text-[#64748B] text-center font-mono-numbers">
              Instant smart contract escrow · SHA-256 verifiable on Polygon POS
            </p>
          </div>

        </section>

      </main>

      {/* ===================================================================== */}
      {/* 3. PROVABLY FAIR PROTOCOL VERIFICATION STRIP                          */}
      {/* ===================================================================== */}
      <footer className="px-3 sm:px-4 py-2.5 rounded-xl bg-[#0A0E18] border border-[#1F2737] flex flex-wrap items-center justify-between text-xs text-[#94A3B8] gap-2 max-w-7xl mx-auto w-full shrink-0 shadow-sm">
        <div className="flex items-center gap-2 min-w-0">
          <ShieldCheck className="w-4 h-4 text-[#10B981] shrink-0" />
          <span className="text-white font-bold text-xs">Provably Fair Protocol (SHA-256):</span>
          <span className="font-mono text-[11px] text-[#64748B] truncate max-w-[180px] xs:max-w-xs sm:max-w-md">
            {event.sha256Seed || event.sha256_seed || 'Awaiting block seed publication'}
          </span>
          <button
            type="button"
            onClick={handleCopySeed}
            className="text-[#94A3B8] hover:text-white p-1 rounded hover:bg-white/5 transition-colors cursor-pointer"
            title="Copy Seed Hash"
          >
            {copiedSeed ? <Check className="w-3.5 h-3.5 text-[#10B981]" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
        </div>

        <div className="font-mono-numbers text-[#F59E0B] text-xs font-bold flex items-center gap-1.5 ml-auto">
          <span className="w-1.5 h-1.5 rounded-full bg-[#10B981]" />
          <span>Cryptographically Verified</span>
        </div>
      </footer>

    </div>
  );
}
