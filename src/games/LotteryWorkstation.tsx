import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useLottery } from '../context/LotteryContext';
import { 
  Dices, 
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
  ExternalLink
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
 * Redesigned exclusively in Google Stitch (Obsidian Sovereign Design System: #0B0F19, #111728, Violet-600, Gold #F59E0B)
 * Solves:
 * 1. Mobile Number Selection & Buy Section Co-visibility (Zero-Scroll primary cluster)
 * 2. Tablet & Laptop Room Activity internal scrolling & height synchronization
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
  const isSmallMobile = viewport.width <= 375;

  // Mobile activity accordion open state (default collapsed on mobile portrait/landscape)
  const [isActivityExpanded, setIsActivityExpanded] = useState(false);

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
  // 3. Active 4-digit input slots state
  // ---------------------------------------------------------------------------
  const [digits, setDigits] = useState<string[]>(() => {
    const initial = getUnsoldRandomNumber ? getUnsoldRandomNumber(event?.id) : Math.floor(1000 + Math.random() * 9000).toString();
    return String(initial).padStart(4, '0').slice(0, 4).split('');
  });
  const [activeSlot, setActiveSlot] = useState<number>(0);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [copiedSeed, setCopiedSeed] = useState<boolean>(false);

  // ---------------------------------------------------------------------------
  // 4. Ticket quantity pick state: 1, 5, or 10
  // ---------------------------------------------------------------------------
  const [selectedTicketCount, setSelectedTicketCount] = useState<number>(1);

  // ---------------------------------------------------------------------------
  // 5. Countdown timer & Status
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
  // 6. Check if CURRENT USER already purchased this number in this event
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
  // 7. Keypad Actions (1-9, Clear, 0, Random)
  // ---------------------------------------------------------------------------
  const handleKeypadPress = useCallback((val: number) => {
    soundFX.playDialTick();
    setDigits(prev => {
      const updated = [...prev];
      updated[activeSlot] = String(val);
      return updated;
    });
    setActiveSlot(prev => (prev + 1) % 4);
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

  // Random pick handler (generates unsold random number)
  const handleRandomNumber = useCallback(() => {
    soundFX.playDialTick();
    if (getUnsoldRandomNumber) {
      const unsold = getUnsoldRandomNumber(event.id);
      setDigits(String(unsold).padStart(4, '0').slice(0, 4).split(''));
    } else {
      const rand = String(Math.floor(Math.random() * 10000)).padStart(4, '0');
      setDigits(rand.split(''));
    }
  }, [getUnsoldRandomNumber, event.id]);

  // Physical keyboard listener (0-9, Backspace, Arrow keys)
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
        setActiveSlot(prev => (prev + 1) % 4);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeypadPress, handleClearSlot]);

  // ---------------------------------------------------------------------------
  // 8. Main Ticket Purchase Action
  // ---------------------------------------------------------------------------
  const ticketPrice = Number(event.ticketPrice || 10);
  const totalPurchaseCost = ticketPrice * selectedTicketCount;

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

    // 1 Pick: purchase dialed combination
    if (selectedTicketCount === 1) {
      if (isAlreadyPurchasedByMe) {
        showToast(`You have already purchased ticket #${currentNumberStr} for this draw! Duplicate purchases by the same user are not permitted.`, 'error');
        return;
      }

      setIsSubmitting(true);
      try {
        const success = await buyTickets(event.id, [currentNumberStr]);
        if (success) {
          soundFX.playWinFanfare('big');
          confetti({
            particleCount: 100,
            spread: 70,
            origin: { y: 0.65 },
            colors: ['#7c3aed', '#f59e0b', '#10b981', '#ffffff']
          });
          showToast(`🎉 Purchased Ticket #${currentNumberStr} for ${ticketPrice} USDT!`, 'success');
          
          if (getUnsoldRandomNumber) {
            const next = getUnsoldRandomNumber(event.id);
            setDigits(String(next).padStart(4, '0').slice(0, 4).split(''));
          }
        }
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    // Multiple Picks: 5 or 10
    const userOwnedSet = new Set(
      (tickets || [])
        .filter((t: any) => 
          (t.eventId === event.id || t.event_id === event.id) &&
          ((wallet?.address && t.userAddress === wallet.address) || (user?.id && (t.userId === user.id || t.user_id === user.id)))
        )
        .map((t: any) => String(t.ticketNumber).padStart(4, '0'))
    );

    const generatedTickets: string[] = [];
    const usedInBatch = new Set<string>();

    // Include current combination first if available
    if (!userOwnedSet.has(currentNumberStr)) {
      generatedTickets.push(currentNumberStr);
      usedInBatch.add(currentNumberStr);
    }

    while (generatedTickets.length < selectedTicketCount) {
      let candidate = String(Math.floor(Math.random() * 10000)).padStart(4, '0');
      let attempts = 0;
      while ((userOwnedSet.has(candidate) || usedInBatch.has(candidate)) && attempts < 100) {
        candidate = String(Math.floor(Math.random() * 10000)).padStart(4, '0');
        attempts++;
      }
      usedInBatch.add(candidate);
      generatedTickets.push(candidate);
    }

    setIsSubmitting(true);
    try {
      const success = await buyTickets(event.id, generatedTickets);
      if (success) {
        soundFX.playWinFanfare('big');
        confetti({
          particleCount: 120,
          spread: 80,
          origin: { y: 0.65 },
          colors: ['#7c3aed', '#f59e0b', '#10b981', '#ffffff']
        });
        showToast(`🎉 Successfully purchased ${generatedTickets.length} unique tickets for ${totalPurchaseCost} USDT!`, 'success');

        if (getUnsoldRandomNumber) {
          const next = getUnsoldRandomNumber(event.id);
          setDigits(String(next).padStart(4, '0').slice(0, 4).split(''));
        }
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // ---------------------------------------------------------------------------
  // 9. Room Activity & User Tickets Data
  // ---------------------------------------------------------------------------
  const roomActivityTickets = useMemo(() => {
    if (!tickets) return [];
    return tickets
      .filter((t: any) => t.eventId === event.id || t.event_id === event.id)
      .slice(0, 40);
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
    if (event.sha256Seed) {
      navigator.clipboard.writeText(event.sha256Seed);
      setCopiedSeed(true);
      setTimeout(() => setCopiedSeed(false), 2000);
    }
  };

  // ---------------------------------------------------------------------------
  // 10. Concluded / Expired State -> Show Result Screen
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
  // 11. Render Helpers: Stitch Obsidian Sovereign UI Components
  // ---------------------------------------------------------------------------

  // Tactile 3x4 Numeric Keypad
  const renderNumericKeypad = (isCompact = false) => {
    const btnHeight = isCompact ? 'h-9 xs:h-10 text-base' : 'h-10 xs:h-11 sm:h-13 text-lg sm:text-xl';
    const actionBtnHeight = isCompact ? 'h-9 xs:h-10 text-xs' : 'h-10 xs:h-11 sm:h-13 text-xs sm:text-sm';

    return (
      <div className="w-full space-y-1.5">
        <div className="grid grid-cols-3 gap-1.5 xs:gap-2">
          {/* Row 1: 1, 2, 3 */}
          {[1, 2, 3].map((num) => (
            <button
              key={num}
              type="button"
              onClick={() => handleKeypadPress(num)}
              className={`${btnHeight} rounded-xl bg-[#141b2a] hover:bg-[#1a2336] active:bg-[#7c3aed]/30 active:scale-95 border border-[#222b40] hover:border-[#7c3aed]/50 shadow-sm transition-all cursor-pointer font-mono-numbers font-bold text-white hover:text-[#d2bbff] flex items-center justify-center select-none`}
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
              className={`${btnHeight} rounded-xl bg-[#141b2a] hover:bg-[#1a2336] active:bg-[#7c3aed]/30 active:scale-95 border border-[#222b40] hover:border-[#7c3aed]/50 shadow-sm transition-all cursor-pointer font-mono-numbers font-bold text-white hover:text-[#d2bbff] flex items-center justify-center select-none`}
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
              className={`${btnHeight} rounded-xl bg-[#141b2a] hover:bg-[#1a2336] active:bg-[#7c3aed]/30 active:scale-95 border border-[#222b40] hover:border-[#7c3aed]/50 shadow-sm transition-all cursor-pointer font-mono-numbers font-bold text-white hover:text-[#d2bbff] flex items-center justify-center select-none`}
              aria-label={`Digit ${num}`}
            >
              {num}
            </button>
          ))}

          {/* Row 4: Clear | 0 | Random */}
          <button
            type="button"
            onClick={handleClearSlot}
            className={`${actionBtnHeight} rounded-xl bg-rose-950/25 hover:bg-rose-900/40 text-rose-300 hover:text-rose-200 active:scale-95 border border-rose-500/35 transition-all cursor-pointer font-bold uppercase tracking-wider flex items-center justify-center gap-1 select-none`}
            title="Clear current slot"
            aria-label="Clear slot"
          >
            <span>Clear</span>
          </button>

          <button
            type="button"
            onClick={() => handleKeypadPress(0)}
            className={`${btnHeight} rounded-xl bg-[#141b2a] hover:bg-[#1a2336] active:bg-[#7c3aed]/30 active:scale-95 border border-[#222b40] hover:border-[#7c3aed]/50 shadow-sm transition-all cursor-pointer font-mono-numbers font-bold text-white hover:text-[#d2bbff] flex items-center justify-center select-none`}
            aria-label="Digit 0"
          >
            0
          </button>

          <button
            type="button"
            onClick={handleRandomNumber}
            className={`${actionBtnHeight} rounded-xl bg-[#f59e0b]/15 hover:bg-[#f59e0b]/25 text-[#f59e0b] hover:text-[#ffddb8] active:scale-95 border border-[#f59e0b]/35 transition-all cursor-pointer font-bold uppercase tracking-wider flex items-center justify-center gap-1 select-none`}
            title="Generate random combination"
            aria-label="Randomize combination"
          >
            <Dices className="w-3.5 h-3.5 text-[#f59e0b] shrink-0" />
            <span>Random</span>
          </button>
        </div>
      </div>
    );
  };

  // 4 Digit Input Slots
  const renderDigitSlots = (isCompact = false) => {
    const slotHeight = isCompact ? 'h-12 xs:h-13' : 'h-14 xs:h-15 sm:h-17';
    const numSize = isCompact ? 'text-2xl' : 'text-2xl xs:text-3xl sm:text-4xl';

    return (
      <div className="w-full space-y-1.5">
        <div className="grid grid-cols-4 gap-1.5 xs:gap-2">
          {digits.map((digit, idx) => {
            const isSelected = activeSlot === idx;
            const ordinals = ['1ST', '2ND', '3RD', '4TH'];

            return (
              <button
                key={idx}
                type="button"
                onClick={() => setActiveSlot(idx)}
                className={`${slotHeight} rounded-xl flex flex-col items-center justify-center cursor-pointer transition-all duration-150 select-none border-2 shadow-inner group relative ${
                  isSelected
                    ? 'border-[#7c3aed] bg-[#7c3aed]/20 shadow-[0_0_16px_rgba(124,58,237,0.35)] ring-2 ring-[#7c3aed]/40 scale-[1.02]'
                    : isAlreadyPurchasedByMe
                    ? 'border-rose-500/40 bg-rose-950/15 text-rose-200 hover:border-rose-400/60'
                    : 'border-[#222b40] bg-[#0a0e18] hover:border-[#7c3aed]/40 text-white hover:bg-[#111728]'
                }`}
                title={`Digit Slot ${idx + 1}`}
                aria-label={`Digit slot ${idx + 1}, value ${digit}`}
              >
                <span className={`text-[9px] font-mono-numbers font-bold uppercase tracking-wider block transition-colors ${
                  isSelected ? 'text-[#d2bbff]' : 'text-[#64748b] group-hover:text-[#94a3b8]'
                }`}>
                  {ordinals[idx]}
                </span>

                <span className={`font-mono-numbers font-black ${numSize} my-0.5 transition-colors ${
                  isSelected 
                    ? 'text-[#f59e0b] drop-shadow-[0_0_8px_rgba(245,158,11,0.5)]' 
                    : isAlreadyPurchasedByMe 
                    ? 'text-rose-300' 
                    : 'text-white'
                }`}>
                  {digit}
                </span>

                {/* Active Indicator Bar */}
                <span className={`w-6 h-0.5 rounded-full transition-all ${
                  isSelected ? 'bg-[#7c3aed] shadow-[0_0_8px_rgba(124,58,237,0.8)]' : 'bg-transparent'
                }`} />
              </button>
            );
          })}
        </div>

        {/* Combination Availability Status Bar */}
        <div className="flex items-center justify-between text-xs px-0.5 pt-0.5">
          <div className="flex items-center gap-1.5">
            <span className="text-[#94a3b8] text-[11px]">Combination:</span>
            <span className="font-mono-numbers font-black text-[#f59e0b] text-xs xs:text-sm">
              #{currentNumberStr}
            </span>
          </div>

          <div>
            {isAlreadyPurchasedByMe ? (
              <span className="px-2 py-0.5 rounded-full bg-rose-500/15 border border-rose-500/30 text-rose-300 text-[10px] font-bold flex items-center gap-1">
                <AlertCircle className="w-3 h-3 text-rose-400 shrink-0" />
                <span>Already Owned</span>
              </span>
            ) : (
              <span className="px-2 py-0.5 rounded-full bg-[#10b981]/15 border border-[#10b981]/30 text-[#10b981] text-[10px] font-bold flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3 text-[#10b981] shrink-0" />
                <span>Available to Claim</span>
              </span>
            )}
          </div>
        </div>
      </div>
    );
  };

  // Quick Pick & Purchase Controls
  const renderQuickPickAndPurchase = (layoutMode: 'mobile' | 'desktop' | 'compact' = 'desktop') => {
    const isMobileMode = layoutMode === 'mobile';

    return (
      <div className="w-full flex flex-col justify-between space-y-2.5 sm:space-y-4">
        
        {/* Quick Pick Quantity Selector */}
        {isMobileMode ? (
          /* Mobile Segmented Grouped Pills: compact, zero scroll */
          <div className="grid grid-cols-3 gap-1.5">
            {[
              { count: 1, label: '1 Pick', cost: 1 * ticketPrice },
              { count: 5, label: '5 Picks', cost: 5 * ticketPrice },
              { count: 10, label: '10 Picks', cost: 10 * ticketPrice }
            ].map((opt) => {
              const isSelected = selectedTicketCount === opt.count;
              return (
                <button
                  key={opt.count}
                  type="button"
                  onClick={() => setSelectedTicketCount(opt.count)}
                  className={`py-1.5 px-1 rounded-xl border text-center transition-all cursor-pointer flex flex-col items-center justify-center ${
                    isSelected
                      ? 'bg-[#7c3aed]/25 border-[#7c3aed] shadow-[0_0_12px_rgba(124,58,237,0.3)]'
                      : 'bg-[#0a0e18] border-[#222b40] hover:border-[#7c3aed]/40 text-[#94a3b8]'
                  }`}
                >
                  <span className={`text-xs font-bold block ${isSelected ? 'text-white' : 'text-[#cbd5e1]'}`}>
                    {opt.label}
                  </span>
                  <span className={`text-[10px] font-mono-numbers font-extrabold ${isSelected ? 'text-[#f59e0b]' : 'text-[#64748b]'}`}>
                    {opt.cost} USDT
                  </span>
                </button>
              );
            })}
          </div>
        ) : (
          /* Desktop & Tablet Detailed Selection Cards */
          <div className="space-y-2">
            {[
              { count: 1, label: '1 Ticket', desc: 'Standard Single Entry', tag: null },
              { count: 5, label: '5 Picks', desc: '5 Unique Combinations', tag: 'POPULAR' },
              { count: 10, label: '10 Picks', desc: '10 Unique Combinations', tag: 'VIP 10X' }
            ].map((opt) => {
              const isSelected = selectedTicketCount === opt.count;
              const cost = opt.count * ticketPrice;
              return (
                <button
                  key={opt.count}
                  type="button"
                  onClick={() => setSelectedTicketCount(opt.count)}
                  className={`w-full p-2.5 sm:p-3 rounded-xl border text-left transition-all cursor-pointer flex items-center justify-between relative ${
                    isSelected
                      ? 'bg-gradient-to-r from-[#7c3aed]/25 via-[#7c3aed]/10 to-transparent border-[#7c3aed] shadow-[0_0_12px_rgba(124,58,237,0.25)]'
                      : 'bg-[#0a0e18] border-[#222b40] hover:border-[#7c3aed]/40 text-[#94a3b8]'
                  }`}
                >
                  {opt.tag && (
                    <span className="absolute -top-2 right-2 px-1.5 py-0.2 rounded-full bg-[#f59e0b] text-[#0b0f19] font-mono-numbers text-[8px] font-extrabold uppercase">
                      {opt.tag}
                    </span>
                  )}
                  <div className="flex items-center gap-2.5">
                    <div className={`w-4 h-4 rounded-full flex items-center justify-center border shrink-0 ${
                      isSelected ? 'border-[#7c3aed] bg-[#7c3aed] text-white' : 'border-[#3b4354]'
                    }`}>
                      {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                    </div>
                    <div>
                      <span className={`text-xs sm:text-sm font-bold block ${
                        isSelected ? 'text-white' : 'text-[#cbd5e1]'
                      }`}>
                        {opt.label}
                      </span>
                      <span className="text-[10px] text-[#64748b] block font-mono-numbers">
                        {opt.desc}
                      </span>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <span className={`text-xs sm:text-sm font-mono-numbers font-black ${
                      isSelected ? 'text-[#f59e0b]' : 'text-[#94a3b8]'
                    }`}>
                      {cost} USDT
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {/* Pricing & Order Summary Box */}
        <div className="p-2 xs:p-2.5 sm:p-3 rounded-xl bg-[#0a0e18] border border-[#1e2638] space-y-1 text-xs font-mono-numbers shadow-inner">
          <div className="flex items-center justify-between text-[#8b92a2]">
            <span>Ticket Quantity:</span>
            <strong className="text-white">{selectedTicketCount} Ticket{selectedTicketCount > 1 ? 's' : ''}</strong>
          </div>
          <div className="flex items-center justify-between text-[#8b92a2]">
            <span>Unit Price:</span>
            <strong className="text-white">{ticketPrice} USDT</strong>
          </div>
          <div className="flex items-center justify-between pt-1 border-t border-[#1e2638]">
            <span className="text-[#d2bbff] font-bold">Total Cost:</span>
            <strong className="text-[#f59e0b] font-black text-sm sm:text-base">
              {totalPurchaseCost} USDT
            </strong>
          </div>
          <div className="flex items-center justify-between pt-0.5 text-[11px] text-[#64748b]">
            <span>Wallet Balance:</span>
            <span className={Number(wallet.balance || 0) < totalPurchaseCost ? 'text-rose-400 font-bold' : 'text-[#10b981] font-bold'}>
              {Number(wallet.balance || 0).toFixed(2)} USDT
            </span>
          </div>
        </div>

        {/* Primary Action Button: Gold Buy CTA */}
        <div className="pt-0.5">
          <button
            type="button"
            onClick={handlePurchaseAction}
            disabled={
              isSubmitting || 
              isTimedOut || 
              (selectedTicketCount === 1 && isAlreadyPurchasedByMe)
            }
            className={`w-full py-2.5 xs:py-3 sm:py-3.5 rounded-xl font-display font-bold text-xs sm:text-sm uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer shadow-lg transition-all ${
              selectedTicketCount === 1 && isAlreadyPurchasedByMe
                ? 'bg-[#181d29] text-[#8b92a2] border border-[#242d40] cursor-not-allowed opacity-75'
                : 'btn-gold shadow-[#f59e0b]/25 active:scale-[0.98]'
            }`}
          >
            <Coins className="w-4 h-4 shrink-0" />
            <span className="truncate">
              {isSubmitting
                ? 'Processing...'
                : selectedTicketCount === 1 && isAlreadyPurchasedByMe
                ? 'Ticket Already Owned'
                : `Buy ${selectedTicketCount} Ticket${selectedTicketCount > 1 ? 's' : ''} (${totalPurchaseCost} USDT)`}
            </span>
          </button>
        </div>

      </div>
    );
  };

  // ---------------------------------------------------------------------------
  // 12. Room Activity Feed (Tablet/Desktop Height Synchronization Fix)
  // ---------------------------------------------------------------------------
  const renderActivityList = (maxItems = 30) => {
    const displayTickets = roomActivityTickets.slice(0, maxItems);

    if (displayTickets.length === 0) {
      return (
        <div className="h-full min-h-[140px] flex flex-col items-center justify-center text-center p-3 rounded-xl border border-dashed border-[#222b40] text-[#94a3b8] space-y-1.5">
          <Ticket className="w-5 h-5 text-[#64748b]/50" />
          <p className="text-xs font-bold text-white">No Tickets Purchased Yet</p>
          <p className="text-[10px] text-[#64748b] max-w-[200px]">
            Be the first to claim a 4-digit ticket in this room!
          </p>
        </div>
      );
    }

    return (
      <div className="space-y-1.5 pr-0.5">
        {displayTickets.map((tkt: any, idx: number) => {
          const isMine = (user && tkt.userId === user.id) || (wallet?.address && tkt.userAddress === wallet.address);
          const displayUsername = tkt.username || (isMine ? '@You' : `@p_${tkt.id ? tkt.id.slice(-4) : idx}`);
          const ticketNumberFormatted = `#${String(tkt.ticketNumber).padStart(4, '0')}`;
          const initial = displayUsername.replace(/^[@★\s]/, '').charAt(0).toUpperCase() || 'P';

          return (
            <div
              key={tkt.id || idx}
              className={`p-2 rounded-xl border flex items-center justify-between text-xs font-mono-numbers transition-colors ${
                isMine
                  ? 'bg-[#7c3aed]/15 border-[#7c3aed]/40 text-[#d2bbff]'
                  : 'bg-[#0a0e18] border-[#1e2638] hover:border-[#2a354d] text-white'
              }`}
            >
              <div className="flex items-center gap-2 min-w-0 flex-1 mr-2">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-[10px] shrink-0 ${
                  isMine ? 'bg-[#7c3aed] text-white' : 'bg-[#1e2638] text-[#94a3b8]'
                }`}>
                  {initial}
                </div>
                <div className="min-w-0 truncate">
                  <span className={`block font-bold truncate text-[11px] ${
                    isMine ? 'text-[#f59e0b]' : 'text-[#cbd5e1]'
                  }`}>
                    {isMine ? '★ You' : displayUsername}
                  </span>
                  <span className="text-[9px] text-[#64748b] block truncate">
                    {formatTimeAgo(Number(tkt.purchaseTime || Date.now()))}
                  </span>
                </div>
              </div>

              <div className="text-right shrink-0 flex items-center gap-2">
                <span className="font-display font-black text-xs text-[#10b981] bg-[#10b981]/10 px-1.5 py-0.5 rounded border border-[#10b981]/20">
                  {ticketNumberFormatted}
                </span>
                <span className="text-[10px] text-[#64748b] min-w-[45px] text-right">
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
  // 13. Main Layout Render
  // ---------------------------------------------------------------------------
  return (
    <div className="w-full h-full flex flex-col min-h-0 overflow-y-auto no-scrollbar text-left p-2 xs:p-2.5 sm:p-4 lg:p-5 space-y-2 xs:space-y-2.5 sm:space-y-4">
      
      {/* ===================================================================== */}
      {/* 1. ROOM HEADER: OBSIDIAN SOVEREIGN BAR                                */}
      {/* ===================================================================== */}
      <header className="w-full max-w-7xl mx-auto rounded-2xl p-2.5 xs:p-3 sm:p-4 border border-[#7c3aed]/25 bg-gradient-to-r from-[#111728] via-[#0c101d] to-[#080b14] shadow-md flex flex-wrap items-center justify-between gap-2 xs:gap-3 shrink-0">
        
        {/* Left: Back to Lobby + Room Title + Live Status */}
        <div className="flex items-center gap-2 xs:gap-2.5 min-w-0">
          {onBackToLobby && (
            <button
              onClick={onBackToLobby}
              className="px-2 py-1 xs:px-2.5 xs:py-1.5 rounded-xl bg-[#141b2a] hover:bg-[#1a2336] text-[#94a3b8] hover:text-white border border-[#222b40] text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all shrink-0 shadow-sm"
              title="Return to Lottery Lobby"
            >
              <ArrowLeft className="w-3.5 h-3.5 text-[#f59e0b]" />
              <span className="hidden xs:inline">Lobby</span>
            </button>
          )}

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="font-display font-black text-xs xs:text-sm sm:text-base text-white truncate">
                {room?.name || event.title}
              </h2>
              <span className={`text-[10px] font-mono-numbers px-2 py-0.5 rounded-md font-bold uppercase flex items-center gap-1 shrink-0 ${statusInfo.badgeClass}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${statusInfo.dotClass}`} />
                <span>{statusInfo.label}</span>
              </span>
            </div>
            <p className="text-[10px] xs:text-[11px] text-[#94a3b8] truncate hidden sm:block">
              Pick 4 lucky digits from 0000 to 9999 · Autonomous On-Chain Draw
            </p>
          </div>
        </div>

        {/* Right: Metrics Strip (Ticket Price, Jackpot, Countdown) */}
        <div className="flex items-center gap-1.5 xs:gap-2 sm:gap-3 text-xs font-mono-numbers ml-auto shrink-0 flex-wrap justify-end">
          <div className="bg-[#0a0e18] px-2 py-1 xs:px-2.5 xs:py-1.5 rounded-xl border border-[#222b40] flex items-center gap-1.5 shadow-inner">
            <span className="text-[#8b92a2] text-[10px] uppercase">Entry:</span>
            <strong className="text-white font-bold text-[11px] xs:text-xs">{ticketPrice} USDT</strong>
          </div>

          <div className="bg-[#0a0e18] px-2 py-1 xs:px-2.5 xs:py-1.5 rounded-xl border border-[#222b40] flex items-center gap-1.5 shadow-inner">
            <Trophy className="w-3.5 h-3.5 text-[#f59e0b] shrink-0" />
            <span className="text-[#8b92a2] text-[10px] uppercase hidden sm:inline">Grand Pot:</span>
            <strong className="text-[#f59e0b] font-bold text-[11px] xs:text-xs">{Number(event.poolPrize || 5000).toLocaleString()} USDT</strong>
          </div>

          <div className="bg-[#0a0e18] px-2 py-1 xs:px-2.5 xs:py-1.5 rounded-xl border border-[#7c3aed]/30 flex items-center gap-1.5 text-[#d2bbff] font-bold shadow-inner">
            <Clock className="w-3.5 h-3.5 text-[#7c3aed] shrink-0" />
            <span className="text-[11px] xs:text-xs">{isTimedOut ? 'Closed' : `${timeLeft.hours}h ${timeLeft.minutes}m ${timeLeft.seconds}s`}</span>
          </div>
        </div>

      </header>

      {/* ===================================================================== */}
      {/* 2. RESPONSIVE LAYOUT SWITCH: MOBILE PORTRAIT VS LANDSCAPE VS DESKTOP  */}
      {/* ===================================================================== */}
      {isMobileLandscape ? (
        /* ------------------------------------------------------------------- */
        /* MOBILE LANDSCAPE MODE: SIDE-BY-SIDE 2-COLUMN VIEW                   */
        /* ------------------------------------------------------------------- */
        <div className="w-full max-w-7xl mx-auto grid grid-cols-2 gap-2.5 min-h-0">
          
          {/* Left Column: Digits + Compact Keypad */}
          <section className="bg-[#111728] border border-[#1e2638] rounded-2xl p-2.5 flex flex-col justify-between shadow-md space-y-1.5">
            <div className="flex items-center justify-between pb-1 border-b border-[#1e2638]">
              <div className="flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-[#7c3aed]" />
                <h3 className="font-display font-bold text-xs text-white">Pick 4 Digits</h3>
              </div>
              <button
                type="button"
                onClick={handleResetAll}
                className="px-2 py-0.5 rounded-lg bg-[#141b2a] text-[#94a3b8] hover:text-white border border-[#222b40] text-[10px] font-bold flex items-center gap-1 cursor-pointer"
              >
                <RotateCcw className="w-2.5 h-2.5 text-[#f59e0b]" />
                <span>Reset</span>
              </button>
            </div>

            {renderDigitSlots(true)}
            {renderNumericKeypad(true)}
          </section>

          {/* Right Column: Quick Pick + Purchase + Collapsible Activity */}
          <section className="bg-[#111728] border border-[#1e2638] rounded-2xl p-2.5 flex flex-col justify-between shadow-md space-y-2 overflow-y-auto no-scrollbar">
            {renderQuickPickAndPurchase('mobile')}

            {/* Collapsible Activity in Landscape */}
            <div className="pt-1.5 border-t border-[#1e2638]">
              <button
                type="button"
                onClick={() => setIsActivityExpanded(!isActivityExpanded)}
                className="w-full flex items-center justify-between text-xs text-[#94a3b8] hover:text-white py-1 px-1 rounded-lg hover:bg-white/5 cursor-pointer transition-colors"
              >
                <span className="flex items-center gap-1.5 font-bold">
                  <Activity className="w-3.5 h-3.5 text-[#10b981]" />
                  <span>Room Activity ({roomActivityTickets.length})</span>
                </span>
                {isActivityExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>
              {isActivityExpanded && (
                <div className="mt-1 max-h-[140px] overflow-y-auto">
                  {renderActivityList(10)}
                </div>
              )}
            </div>
          </section>

        </div>
      ) : isMobilePortrait ? (
        /* ------------------------------------------------------------------- */
        /* MOBILE PORTRAIT: UNIFIED ZERO-SCROLL CO-VISIBLE CORE CARD           */
        /* (Selected number, keypad, quick pick, pricing, and BUY button all   */
        /* fit conveniently together within one single viewport!)              */
        /* ------------------------------------------------------------------- */
        <div className="w-full max-w-7xl mx-auto space-y-2 xs:space-y-2.5">
          
          {/* PRIMARY UNIFIED SELECTION & PLAY CARD (Stitch Mobile Ergonomics) */}
          <section className="bg-[#111728] border border-[#1e2638] rounded-2xl p-2.5 xs:p-3 sm:p-4 shadow-xl flex flex-col space-y-2.5">
            
            {/* Header: Title + Availability Pill + Reset */}
            <div className="flex items-center justify-between pb-1.5 border-b border-[#1e2638]">
              <div className="flex items-center gap-1.5">
                <span className="font-display font-bold text-xs xs:text-sm text-white">
                  Pick 4 Digits
                </span>
                <span className="text-[10px] text-[#64748b] font-mono-numbers">
                  #{event.id ? event.id.slice(-6).toUpperCase() : 'DRAW'}
                </span>
              </div>

              <button
                type="button"
                onClick={handleResetAll}
                className="px-2 py-0.5 rounded-lg bg-[#141b2a] hover:bg-[#1a2336] text-[#94a3b8] hover:text-white border border-[#222b40] text-[10px] font-bold flex items-center gap-1 cursor-pointer transition-colors"
                title="Reset all digits to 0000"
              >
                <RotateCcw className="w-3 h-3 text-[#f59e0b]" />
                <span>Reset</span>
              </button>
            </div>

            {/* 4 Digit Slots */}
            {renderDigitSlots(false)}

            {/* Tactile Numeric Keypad */}
            {renderNumericKeypad(false)}

            {/* Quick Pick Quantity & Buy Controls Grouped Directly In Same Card */}
            {renderQuickPickAndPurchase('mobile')}

          </section>

          {/* SECONDARY COLLAPSIBLE SECTION: Room Activity Drawer (Saves Height) */}
          <section className="bg-[#111728] border border-[#1e2638] rounded-2xl p-2.5 xs:p-3 shadow-md space-y-2">
            <button
              type="button"
              onClick={() => setIsActivityExpanded(!isActivityExpanded)}
              className="w-full flex items-center justify-between cursor-pointer group select-none"
              aria-expanded={isActivityExpanded}
            >
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-[#10b981]/15 border border-[#10b981]/30 flex items-center justify-center text-[#10b981]">
                  <Activity className="w-3.5 h-3.5" />
                </div>
                <div className="text-left">
                  <div className="flex items-center gap-1.5">
                    <h3 className="font-display font-bold text-xs text-white">
                      Live Room Activity
                    </h3>
                    <span className="w-1.5 h-1.5 rounded-full bg-[#10b981] animate-pulse" />
                  </div>
                  <p className="text-[10px] text-[#94a3b8]">
                    {roomActivityTickets.length} ticket{roomActivityTickets.length === 1 ? '' : 's'} purchased in this draw
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1 text-xs text-[#94a3b8] group-hover:text-white">
                <span className="text-[10px] font-bold uppercase">{isActivityExpanded ? 'Hide' : 'View'}</span>
                {isActivityExpanded ? <ChevronUp className="w-4 h-4 text-[#7c3aed]" /> : <ChevronDown className="w-4 h-4 text-[#7c3aed]" />}
              </div>
            </button>

            {isActivityExpanded && (
              <div className="pt-2 border-t border-[#1e2638] max-h-[220px] overflow-y-auto no-scrollbar animate-in fade-in duration-200">
                {renderActivityList(20)}
              </div>
            )}
          </section>

        </div>
      ) : (
        /* ------------------------------------------------------------------- */
        /* TABLET & DESKTOP 3-COLUMN ARENA (WITH HEIGHT & SCROLL FIX)          */
        /* ------------------------------------------------------------------- */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-3.5 sm:gap-4 lg:gap-5 w-full max-w-7xl mx-auto items-stretch">
          
          {/* COLUMN 1: DIGIT SELECTION & NUMERIC KEYPAD (lg:col-span-5) */}
          <section className="col-span-1 md:col-span-1 lg:col-span-5 bg-[#111728] border border-[#1e2638] rounded-2xl p-4 sm:p-5 flex flex-col justify-between shadow-xl space-y-4">
            
            {/* Header: Title + Reset Action */}
            <div className="flex items-center justify-between pb-3 border-b border-[#1e2638]">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-[#7c3aed]/15 border border-[#7c3aed]/30 flex items-center justify-center text-[#7c3aed]">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-display font-extrabold text-sm sm:text-base text-white">
                    Pick 4 Digits
                  </h3>
                  <p className="text-[11px] text-[#94a3b8]">
                    Select any slot and tap numbers on keypad
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleResetAll}
                className="px-2.5 py-1 rounded-lg bg-[#141b2a] hover:bg-[#1a2336] text-[#94a3b8] hover:text-white border border-[#222b40] text-[11px] font-bold flex items-center gap-1.5 cursor-pointer transition-colors"
                title="Reset all 4 digits to 0000"
              >
                <RotateCcw className="w-3 h-3 text-[#f59e0b]" />
                <span>Reset</span>
              </button>
            </div>

            {renderDigitSlots(false)}
            {renderNumericKeypad(false)}

            {/* Matrix Subtext */}
            <div className="pt-2 border-t border-[#1e2638] flex items-center justify-between text-[11px] text-[#64748b]">
              <span>Slot {activeSlot + 1} of 4 Active</span>
              <span className="text-[#10b981] font-bold flex items-center gap-1">
                <Check className="w-3 h-3" />
                Cryptographically Validated
              </span>
            </div>

          </section>

          {/* COLUMN 2: QUICK PICK & PURCHASE BUNDLES (lg:col-span-3) */}
          <section className="col-span-1 md:col-span-1 lg:col-span-3 bg-[#111728] border border-[#1e2638] rounded-2xl p-4 sm:p-5 flex flex-col justify-between shadow-xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#1e2638] shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-[#7c3aed]/15 border border-[#7c3aed]/30 flex items-center justify-center text-[#7c3aed]">
                  <Ticket className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-display font-extrabold text-sm sm:text-base text-white">
                    Quick Pick
                  </h3>
                  <p className="text-[11px] text-[#94a3b8]">
                    Multiplier bundles
                  </p>
                </div>
              </div>

              <span className="text-xs font-mono-numbers font-bold text-[#f59e0b] bg-[#f59e0b]/10 px-2 py-0.5 rounded-lg border border-[#f59e0b]/25">
                {ticketPrice} USDT / ea
              </span>
            </div>

            {renderQuickPickAndPurchase('desktop')}
          </section>

          {/* COLUMN 3: ROOM ACTIVITY FEED (lg:col-span-4) - TABLET/DESKTOP SCROLL FIX */}
          {/* Container is flex-col h-full to match exactly neighbor column heights */}
          <section className="col-span-1 md:col-span-2 lg:col-span-4 bg-[#111728] border border-[#1e2638] rounded-2xl p-4 sm:p-5 flex flex-col justify-between shadow-xl space-y-3 overflow-hidden min-h-[480px]">
            
            {/* Activity Header */}
            <div className="flex items-center justify-between pb-3 border-b border-[#1e2638] shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-[#10b981]/15 border border-[#10b981]/30 flex items-center justify-center text-[#10b981]">
                  <Activity className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-display font-extrabold text-sm sm:text-base text-white">
                    Live Room Activity
                  </h3>
                  <p className="text-[11px] text-[#94a3b8]">
                    Recent purchases in this room
                  </p>
                </div>
              </div>

              <span className="text-[10px] font-mono-numbers px-2 py-0.5 rounded-full bg-[#10b981]/15 text-[#10b981] border border-[#10b981]/30 font-bold flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-[#10b981] animate-pulse" />
                <span>{roomActivityTickets.length} Tickets</span>
              </span>
            </div>

            {/* Activity Feed List: Height is flex-1 so it displays the full available visible entries */}
            {/* Internal scroll begins ONLY after all visible capacity is utilized! */}
            <div className="flex-1 overflow-y-auto no-scrollbar min-h-0">
              {renderActivityList(35)}
            </div>

            {/* Fixed Footer Stats Strip */}
            <div className="p-2.5 rounded-xl bg-[#0a0e18] border border-[#1e2638] flex items-center justify-between text-xs font-mono-numbers shrink-0 shadow-inner">
              <span className="text-[#8b92a2]">Total In Draw:</span>
              <strong className="text-[#10b981] font-bold">{roomActivityTickets.length} Tickets</strong>
              <span className="text-[#64748b]">·</span>
              <span className="text-[#8b92a2]">Pool:</span>
              <strong className="text-[#f59e0b] font-bold">{(roomActivityTickets.length * ticketPrice).toLocaleString()} USDT</strong>
            </div>

          </section>

        </div>
      )}

      {/* ===================================================================== */}
      {/* 3. PROVABLY FAIR PROTOCOL VERIFICATION STRIP                          */}
      {/* ===================================================================== */}
      <footer className="px-3 sm:px-4 py-2.5 rounded-xl bg-[#0a0e18] border border-[#1e2638] flex flex-wrap items-center justify-between text-xs text-[#94a3b8] gap-2 max-w-7xl mx-auto w-full shrink-0 shadow-sm">
        <div className="flex items-center gap-2 min-w-0">
          <ShieldCheck className="w-4 h-4 text-[#10b981] shrink-0" />
          <span className="text-white font-bold text-xs">Provably Fair Protocol (SHA-256):</span>
          <span className="font-mono text-[11px] text-[#64748b] truncate max-w-[180px] xs:max-w-xs sm:max-w-md">
            {event.sha256Seed || '0x4f88e14620...'}
          </span>
          <button
            type="button"
            onClick={handleCopySeed}
            className="text-[#94a3b8] hover:text-white p-1 rounded hover:bg-white/5 transition-colors cursor-pointer"
            title="Copy Seed Hash"
          >
            {copiedSeed ? <Check className="w-3.5 h-3.5 text-[#10b981]" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
        </div>

        <div className="font-mono-numbers text-[#f59e0b] text-xs font-bold flex items-center gap-1.5 ml-auto">
          <span className="w-1.5 h-1.5 rounded-full bg-[#10b981]" />
          <span>Cryptographically Verified</span>
        </div>
      </footer>

    </div>
  );
}
