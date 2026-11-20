import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useLottery } from '../context/LotteryContext';
import { 
  ShieldCheck, 
  Sparkles, 
  AlertCircle, 
  Clock, 
  Ticket, 
  ArrowLeft, 
  RotateCcw, 
  Activity, 
  CheckCircle2, 
  Wallet, 
  Check, 
  Trophy, 
  Zap, 
  Copy, 
  Plus, 
  Minus,
  Dices,
  Radio
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
 * Stitch Screen ID (Desktop): projects/9963092336677896554/screens/0fe3ce9de3b64ea79f9d3ef27bf5c934
 * Stitch Screen ID (Mobile): projects/9963092336677896554/screens/a922fdfb6e714d1eb567b8efe7060910
 * 
 * Strict Redesign Mandates Implemented:
 * 1. Desktop Top Section: Exactly TWO balanced columns:
 *    - Left Column: Pick 4 Digits (header, 4 digit slots, availability, keypad, controls)
 *    - Right Column: Direct Purchase Panel (quantity, unit price, total cost, wallet balance, buy button)
 * 2. Bottom Section: ONE FULL-WIDTH Section spanning 100% of the combined width beneath BOTH columns:
 *    - Live Room Activity with real-time on-chain ticket records and internal vertical scrolling.
 * 3. Mobile Low-Scroll Ergonomics: Compact digit selection with purchase summary & Buy button immediately
 *    visible without scrolling away from selected digits.
 * 4. Multi-row non-overlapping Room Header with responsive timer and stats pills.
 */
export default function LotteryWorkstation({ room, onBackToLobby }: LotteryWorkstationProps) {
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
  // 6. Manual Keypad Actions (1-9, Clear, 0)
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

  const handleRandomize = useCallback(() => {
    soundFX.playClick();
    if (getUnsoldRandomNumber) {
      const rnd = getUnsoldRandomNumber(event.id);
      if (rnd) {
        setDigits(rnd.split(''));
        return;
      }
    }
    const rndStr = String(Math.floor(1000 + Math.random() * 9000)).padStart(4, '0');
    setDigits(rndStr.split(''));
  }, [event.id, getUnsoldRandomNumber]);

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
  // 7. Direct Ticket Purchase Action (STRICT 1 TICKET PER PURCHASE)
  // ---------------------------------------------------------------------------
  const ticketPrice = Number(event.ticketPrice || 10);
  const totalPurchaseCost = ticketPrice;

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
      showToast(`You already own ticket #${currentNumberStr} in this round. Please pick another number!`, 'info');
      return;
    }

    setIsSubmitting(true);
    soundFX.playChipBet();

    try {
      const numbersToBuy = [currentNumberStr];
      const success = await buyTickets(event.id, numbersToBuy);
      if (success) {
        soundFX.playWinFanfare();
        confetti({
          particleCount: 50,
          spread: 60,
          origin: { y: 0.6 }
        });
        showToast(`🎉 Successfully purchased ticket #${currentNumberStr}!`, 'success');
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
    const ordinals = ['1ST', '2ND', '3RD', '4TH'];

    return (
      <div className="w-full space-y-2">
        <div className="grid grid-cols-4 gap-2 xs:gap-2.5 sm:gap-3">
          {digits.map((digit, idx) => {
            const isSelected = activeSlot === idx;

            return (
              <button
                key={idx}
                type="button"
                onClick={() => setActiveSlot(idx)}
                className={`h-14 xs:h-16 sm:h-20 rounded-2xl flex flex-col items-center justify-center cursor-pointer transition-all duration-150 select-none border-2 shadow-inner group relative ${
                  isSelected
                    ? 'bg-gradient-to-b from-[#1C1836] to-[#120F24] border-[#7C3AED] shadow-[0_0_20px_rgba(124,58,237,0.4)] scale-[1.02]'
                    : 'bg-[#0B0F19] border-[#1F2737] hover:border-[#2D374D] hover:bg-[#101522]'
                }`}
                title={`Edit ${ordinals[idx]} digit`}
              >
                {/* Ordinal Pill Tag */}
                <span className={`text-[9px] xs:text-[10px] font-mono-numbers font-black tracking-wider uppercase mb-0.5 transition-colors ${
                  isSelected ? 'text-[#D2BBFF]' : 'text-[#64748B] group-hover:text-[#94A3B8]'
                }`}>
                  {ordinals[idx]}{isSelected ? ' ACTIVE' : ''}
                </span>

                {/* Dialed Digit */}
                <span className={`font-mono-numbers font-black text-2xl xs:text-3xl sm:text-4xl transition-colors ${
                  isSelected ? 'text-[#F59E0B]' : 'text-white'
                }`}>
                  {digit}
                </span>

                {/* Active Indicator Bar */}
                {isSelected && (
                  <div className="absolute -bottom-1 w-6 h-1 rounded-full bg-[#7C3AED] shadow-[0_0_8px_#7C3AED]" />
                )}
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  // 3x4 Numeric Keypad
  const renderNumericKeypad = () => {
    const keypadKeys = [1, 2, 3, 4, 5, 6, 7, 8, 9];

    return (
      <div className="w-full space-y-2 pt-1">
        <div className="grid grid-cols-3 gap-1.5 xs:gap-2 sm:gap-2.5">
          {keypadKeys.map((num) => (
            <button
              key={num}
              type="button"
              onClick={() => handleKeypadPress(num)}
              className="h-11 xs:h-12 sm:h-14 rounded-xl bg-[#0B0F19] hover:bg-[#141A29] active:bg-[#1D253A] border border-[#1F2737] hover:border-[#7C3AED]/40 text-white font-mono-numbers font-extrabold text-base xs:text-lg sm:text-xl flex items-center justify-center cursor-pointer transition-all active:scale-95 shadow-sm"
            >
              {num}
            </button>
          ))}

          {/* Bottom Row: Clear, 0, Reset/Backspace */}
          <button
            type="button"
            onClick={handleClearSlot}
            className="h-11 xs:h-12 sm:h-14 rounded-xl bg-[#181119] hover:bg-[#251525] active:bg-[#301A30] border border-rose-900/30 text-rose-400 font-mono-numbers text-xs xs:text-sm font-bold flex items-center justify-center cursor-pointer transition-all active:scale-95 shadow-sm"
            title="Clear current slot"
          >
            Clear
          </button>

          <button
            type="button"
            onClick={() => handleKeypadPress(0)}
            className="h-11 xs:h-12 sm:h-14 rounded-xl bg-[#0B0F19] hover:bg-[#141A29] active:bg-[#1D253A] border border-[#1F2737] hover:border-[#7C3AED]/40 text-white font-mono-numbers font-extrabold text-base xs:text-lg sm:text-xl flex items-center justify-center cursor-pointer transition-all active:scale-95 shadow-sm"
          >
            0
          </button>

          <button
            type="button"
            onClick={handleResetAll}
            className="h-11 xs:h-12 sm:h-14 rounded-xl bg-[#141924] hover:bg-[#1C2333] active:bg-[#242D40] border border-[#222B40] text-[#94A3B8] hover:text-white font-mono-numbers text-xs xs:text-sm font-bold flex items-center justify-center cursor-pointer transition-all active:scale-95 shadow-sm"
            title="Reset all slots to 0000"
          >
            Reset
          </button>
        </div>

        {/* Quick Helper Sub-row */}
        <div className="flex items-center justify-between text-[11px] text-[#64748B] pt-1 px-1">
          <button
            type="button"
            onClick={handleRandomize}
            className="text-[#94A3B8] hover:text-amber-400 transition-colors flex items-center gap-1 cursor-pointer font-bold"
          >
            <Dices className="w-3.5 h-3.5 text-amber-400" />
            <span>Lucky Pick</span>
          </button>

          <span className="font-mono-numbers text-[10px] hidden xs:inline">
            Manual 4-Digit Entry
          </span>

          <button
            type="button"
            onClick={handleResetAll}
            className="text-[#94A3B8] hover:text-rose-400 transition-colors flex items-center gap-1 cursor-pointer"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Reset 0000</span>
          </button>
        </div>
      </div>
    );
  };

  // Full-Width Live Room Activity Records Table
  const renderActivityFeed = () => {
    if (roomActivityTickets.length === 0) {
      return (
        <div className="py-6 text-center text-xs text-[#94A3B8] space-y-1">
          <Activity className="w-5 h-5 mx-auto text-[#64748B] opacity-50" />
          <p className="font-bold text-white">No tickets minted yet</p>
          <p className="text-[11px] text-[#64748B]">Be the first to secure a 4-digit number in this draw!</p>
        </div>
      );
    }

    return (
      <div className="space-y-1.5 max-h-56 overflow-y-auto no-scrollbar pr-1">
        {roomActivityTickets.map((tkt: any, idx: number) => {
          const isMine = (user && tkt.userId === user.id) || (wallet?.address && tkt.userAddress === wallet.address);
          const rawName = tkt.username || (tkt.userAddress ? `${tkt.userAddress.slice(0, 6)}...${tkt.userAddress.slice(-4)}` : `@p_${tkt.id ? String(tkt.id).slice(-4) : idx}`);
          const displayUsername = isMine ? '★ You' : (rawName.startsWith('@') ? rawName : `@${rawName}`);
          const ticketNumberFormatted = `#${String(tkt.ticketNumber).padStart(4, '0')}`;

          return (
            <div
              key={tkt.id || idx}
              className={`p-2.5 rounded-xl border flex items-center justify-between text-xs font-mono-numbers transition-colors ${
                isMine
                  ? 'bg-[#7C3AED]/15 border-[#7C3AED]/40 text-[#D2BBFF]'
                  : 'bg-[#0B0F19] border-[#1F2737] hover:border-[#2A354D] text-white'
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <span className={`w-2 h-2 rounded-full shrink-0 ${isMine ? 'bg-[#F59E0B]' : 'bg-[#10B981]'}`} />
                <span className="font-bold truncate text-xs text-[#E2E8F0] max-w-[110px] xs:max-w-[150px] sm:max-w-xs">
                  {displayUsername}
                </span>
                <span className="text-[10px] text-[#64748B] hidden xs:inline">
                  {formatTimeAgo(Number(tkt.purchaseTime || Date.now()))}
                </span>
              </div>

              <div className="flex items-center gap-3 shrink-0">
                <span className="font-black text-xs text-[#10B981] bg-[#10B981]/10 px-2 py-0.5 rounded-md border border-[#10B981]/20">
                  {ticketNumberFormatted}
                </span>
                <span className="text-[11px] font-bold text-amber-400">
                  {tkt.price || ticketPrice} USDT
                </span>
                <span className="text-[9px] uppercase font-bold text-emerald-400 hidden sm:inline">
                  ✓ Confirmed
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
      {/* 1. COMPACT IN-GAME TELEMETRY STRIP (NO EXTRA NAVIGATION STRIP)        */}
      {/* ===================================================================== */}
      <div className="w-full max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2 px-3 py-2 rounded-xl bg-[#111728]/95 border border-[#1B2238] shadow-md shrink-0 text-xs">
        {/* Game Title, Status & Draw ID */}
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-display font-black text-white text-xs sm:text-sm truncate">
            {room?.name || event.title}
          </span>
          <span className="px-2 py-0.5 rounded-full bg-[#10B981]/15 text-[#10B981] border border-[#10B981]/30 text-[10px] font-mono-numbers font-extrabold uppercase flex items-center gap-1 shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-[#10B981] animate-ping" />
            <span>LIVE</span>
          </span>
          <span className="text-[10px] font-mono-numbers text-slate-400 hidden sm:inline">
            #DRAW-{event.id ? String(event.id).slice(-6).toUpperCase() : '884'}
          </span>
        </div>

        {/* Compact Telemetry Metrics */}
        <div className="flex items-center gap-2 sm:gap-3 text-xs font-mono-numbers shrink-0">
          <div className="flex items-center gap-1 text-[11px]">
            <span className="text-[#94A3B8]">Entry:</span>
            <strong className="text-white font-bold">{ticketPrice} USDT</strong>
          </div>

          <div className="flex items-center gap-1 text-[11px]">
            <Trophy className="w-3 h-3 text-[#F59E0B]" />
            <span className="text-[#94A3B8]">Jackpot:</span>
            <strong className="text-[#F59E0B] font-bold">{Number(event.poolPrize || 5000).toLocaleString()} USDT</strong>
          </div>

          <div className="flex items-center gap-1 text-[11px] bg-[#0B0F19] px-2 py-0.5 rounded-md border border-[#1F2737]">
            <Clock className="w-3 h-3 text-[#7C3AED]" />
            <span className="text-[#D2BBFF] font-bold">
              {String(timeLeft.hours).padStart(2, '0')}:{String(timeLeft.minutes).padStart(2, '0')}:{String(timeLeft.seconds).padStart(2, '0')}
            </span>
          </div>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* 2. TOP SECTION: TWO BALANCED COLUMNS (PICK 4 DIGITS + PURCHASE PANEL) */}
      {/* ===================================================================== */}
      <main className="w-full max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-3.5 sm:gap-4 lg:gap-5 items-stretch">
        
        {/* ------------------------------------------------------------------- */}
        {/* LEFT COLUMN: PICK 4 DIGITS & NUMERIC KEYPAD (~60% ON DESKTOP)       */}
        {/* ------------------------------------------------------------------- */}
        <section className="lg:col-span-7 bg-[#111728]/95 border border-[#1B2238] rounded-2xl p-3.5 sm:p-5 flex flex-col justify-between shadow-xl space-y-3.5 backdrop-blur-md">
          
          {/* Header & Availability */}
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
                  Select slot and enter chosen digits
                </p>
              </div>
            </div>

            {/* Combination Availability Pill */}
            <span className={`text-[10px] font-mono-numbers px-2.5 py-0.5 rounded-full font-bold uppercase flex items-center gap-1.5 border ${
              isAlreadyPurchasedByMe
                ? 'bg-rose-500/15 text-rose-300 border-rose-500/30'
                : 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${isAlreadyPurchasedByMe ? 'bg-rose-500' : 'bg-emerald-400 animate-ping'}`} />
              <span>{isAlreadyPurchasedByMe ? 'ALREADY PURCHASED' : 'AVAILABLE TO PURCHASE'}</span>
            </span>
          </div>

          {/* 4 Selected Digit Slots */}
          {renderDigitSlots()}

          {/* Interactive Numeric Keypad */}
          {renderNumericKeypad()}

          {/* Mobile-Only Integrated Quick Buy Strip (Zero Scroll to Purchase) */}
          <div className="block lg:hidden pt-2 border-t border-[#1F2737] space-y-2.5">
            <div className="flex items-center justify-between text-xs font-mono-numbers bg-[#0B0F19] p-2.5 rounded-xl border border-[#1F2737]">
              <div>
                <span className="text-[#94A3B8] text-[10px] uppercase block">Selected:</span>
                <span className="font-black text-[#F59E0B] text-sm">#{currentNumberStr}</span>
              </div>
              <div>
                <span className="text-[#94A3B8] text-[10px] uppercase block">Total Cost:</span>
                <span className="font-black text-white text-sm">{totalPurchaseCost.toFixed(2)} USDT</span>
              </div>
              <div>
                <span className="text-[#94A3B8] text-[10px] uppercase block">Balance:</span>
                <span className="font-bold text-[#10B981] text-xs">{Number(wallet.balance || 0).toFixed(2)} USDT</span>
              </div>
            </div>

            <button
              type="button"
              onClick={handlePurchaseAction}
              disabled={
                isSubmitting || 
                isTimedOut || 
                isAlreadyPurchasedByMe || 
                Number(wallet.balance || 0) < totalPurchaseCost
              }
              className={`w-full py-3 rounded-xl font-display font-black text-sm uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer shadow-lg transition-all ${
                isAlreadyPurchasedByMe
                  ? 'bg-[#181D29] text-rose-300 border border-rose-500/40 cursor-not-allowed opacity-80'
                  : Number(wallet.balance || 0) < totalPurchaseCost
                  ? 'bg-[#181D29] text-[#8B92A2] border border-[#242D40] cursor-not-allowed opacity-75'
                  : 'btn-gold shadow-[#F59E0B]/25 active:scale-98'
              }`}
            >
              {isSubmitting ? (
                <span>Processing Transaction...</span>
              ) : isAlreadyPurchasedByMe ? (
                <span>Ticket Already Owned</span>
              ) : Number(wallet.balance || 0) < totalPurchaseCost ? (
                <span>Insufficient USDT Balance</span>
              ) : (
                <>
                  <Zap className="w-4 h-4 fill-current" />
                  <span>Buy Ticket ({totalPurchaseCost.toFixed(2)} USDT)</span>
                </>
              )}
            </button>
          </div>

        </section>

        {/* ------------------------------------------------------------------- */}
        {/* RIGHT COLUMN: PURCHASE PANEL (~40% ON DESKTOP)                      */}
        {/* ------------------------------------------------------------------- */}
        <section className="lg:col-span-5 bg-[#111728]/95 border border-[#1B2238] rounded-2xl p-3.5 sm:p-5 flex flex-col justify-between shadow-xl space-y-4 backdrop-blur-md">
          
          <div className="space-y-3.5">
            
            {/* Box Header */}
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
                    Instant settlement order summary
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
                <span className="text-[#94A3B8]">Chosen Combination:</span>
                <strong className="text-white font-black text-sm bg-[#161F30] px-2.5 py-0.5 rounded-lg border border-[#27354F]">
                  #{currentNumberStr}
                </strong>
              </div>

              {/* Unit Price Row */}
              <div className="flex items-center justify-between text-[#94A3B8]">
                <span>Unit Ticket Price:</span>
                <strong className="text-white">{ticketPrice.toFixed(2)} USDT</strong>
              </div>

              {/* Platform Fee / Escrow */}
              <div className="flex items-center justify-between text-[#94A3B8]">
                <span>Gas / Escrow:</span>
                <span className="text-emerald-400 font-bold">0.00 USDT (0% subsidised)</span>
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

          </div>

          {/* Desktop Buy Button */}
          <div className="space-y-2 pt-1 hidden lg:block">
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
                  <span>Buy Ticket ({totalPurchaseCost.toFixed(2)} USDT)</span>
                </>
              )}
            </button>

            <p className="text-[10px] text-[#64748B] text-center font-mono-numbers">
              Instant smart contract escrow • Non-custodial settlement
            </p>
          </div>

        </section>

      </main>

      {/* ===================================================================== */}
      {/* 3. BOTTOM SECTION: FULL-WIDTH LIVE ROOM ACTIVITY (SPANS BOTH COLUMNS) */}
      {/* ===================================================================== */}
      <section className="w-full max-w-7xl mx-auto bg-[#111728]/95 border border-[#1B2238] rounded-2xl p-3.5 sm:p-5 shadow-xl space-y-3 backdrop-blur-md">
        
        {/* Full-Width Section Header */}
        <div className="flex items-center justify-between pb-2.5 border-b border-[#1F2737]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#10B981]/15 border border-[#10B981]/30 flex items-center justify-center text-[#10B981]">
              <Activity className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-display font-extrabold text-sm sm:text-base text-white">
                  Live Room Activity
                </h3>
                <span className="text-[9px] uppercase font-mono-numbers font-black px-2 py-0.5 rounded-full bg-[#10B981]/15 text-[#10B981] border border-[#10B981]/30">
                  {roomActivityTickets.length} TICKETS MINTED
                </span>
              </div>
              <p className="text-[11px] text-[#94A3B8]">
                Real-time on-chain ticket purchases in this active draw pool
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs font-mono-numbers">
            <span className="flex items-center gap-1.5 text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-lg border border-emerald-500/20 text-[11px] font-bold">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>Live Sync</span>
            </span>
          </div>
        </div>

        {/* Real-time Records Stream with Smooth Internal Vertical Scroll */}
        {renderActivityFeed()}

      </section>

    </div>
  );
}
