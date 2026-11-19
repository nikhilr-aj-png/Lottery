import React, { useState, useEffect, useMemo } from 'react';
import { useLottery } from '../context/LotteryContext';
import { 
  Dices, 
  ChevronUp, 
  ChevronDown, 
  ShieldCheck, 
  Sparkles, 
  AlertCircle, 
  Coins, 
  Clock, 
  Trophy, 
  Users, 
  CheckCircle2, 
  Ticket, 
  ArrowLeft,
  RotateCcw,
  Activity
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { soundFX } from '../engine/SoundFXService';

export interface LotteryWorkstationProps {
  room?: any;
  onBackToLobby?: () => void;
  activityBox?: React.ReactNode;
}

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

  // 1. Resolve matching or active lottery event for this room
  const event = useMemo(() => {
    if (!room) return events[0] || null;
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

  // 2. Active 4-digit dials state
  const [digits, setDigits] = useState<string[]>(() => {
    const initial = getUnsoldRandomNumber ? getUnsoldRandomNumber(event?.id) : Math.floor(1000 + Math.random() * 9000).toString();
    return String(initial).padStart(4, '0').slice(0, 4).split('');
  });
  const [activeSlot, setActiveSlot] = useState<number>(0);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // 3. Ticket quantity pick state: 1, 5, or 10
  const [selectedTicketCount, setSelectedTicketCount] = useState<number>(1);

  // 4. Orientation & Mobile Landscape Optimization
  const [showRotatePrompt, setShowRotatePrompt] = useState<boolean>(false);

  useEffect(() => {
    const checkOrientation = () => {
      if (typeof window === 'undefined') return;
      const isLandscape = window.innerWidth > window.innerHeight;
      const isMobile = window.innerWidth < 768 || window.innerHeight < 550;
      setShowRotatePrompt(isMobile && !isLandscape);
    };

    // Attempt automatic orientation lock if permitted and supported
    const tryLockOrientation = async () => {
      try {
        if (typeof screen !== 'undefined' && screen.orientation && typeof (screen.orientation as any).lock === 'function') {
          await (screen.orientation as any).lock('landscape');
        }
      } catch (_) {
        // Fallback gracefully on devices that disallow programmatic locking
      }
    };

    tryLockOrientation();
    checkOrientation();

    window.addEventListener('resize', checkOrientation);
    window.addEventListener('orientationchange', checkOrientation);
    if (typeof screen !== 'undefined' && screen.orientation) {
      screen.orientation.addEventListener('change', checkOrientation);
    }

    return () => {
      window.removeEventListener('resize', checkOrientation);
      window.removeEventListener('orientationchange', checkOrientation);
      if (typeof screen !== 'undefined' && screen.orientation) {
        screen.orientation.removeEventListener('change', checkOrientation);
      }
    };
  }, []);

  // 5. Countdown timer
  const [timeLeft, setTimeLeft] = useState({ hours: 0, minutes: 0, seconds: 0 });
  const isTimedOut = event.status === 'completed' || (event.drawTime && event.drawTime <= Date.now());

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

  // Current dial combination
  const currentNumberStr = digits.join('');

  // Check if CURRENT USER already purchased this number in this event
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

  // Keypad presses
  const handleKeypadPress = (val: number) => {
    soundFX.playDialTick();
    const newDigits = [...digits];
    newDigits[activeSlot] = String(val);
    setDigits(newDigits);
    setActiveSlot((activeSlot + 1) % 4);
  };

  const handleBackspace = () => {
    soundFX.playClick();
    const newDigits = [...digits];
    newDigits[activeSlot] = '0';
    setDigits(newDigits);
    setActiveSlot(activeSlot === 0 ? 3 : activeSlot - 1);
  };

  // Dial increment / decrement
  const incrementDigit = (slotIdx: number) => {
    soundFX.playDialTick();
    const newDigits = [...digits];
    newDigits[slotIdx] = String((parseInt(newDigits[slotIdx], 10) + 1) % 10);
    setDigits(newDigits);
    setActiveSlot(slotIdx);
  };

  const decrementDigit = (slotIdx: number) => {
    soundFX.playDialTick();
    const newDigits = [...digits];
    newDigits[slotIdx] = String((parseInt(newDigits[slotIdx], 10) + 9) % 10);
    setDigits(newDigits);
    setActiveSlot(slotIdx);
  };

  // Quick Pick randomizer for current dials
  const handleQuickPickCurrent = () => {
    soundFX.playDialTick();
    if (getUnsoldRandomNumber) {
      const unsold = getUnsoldRandomNumber(event.id);
      setDigits(String(unsold).padStart(4, '0').slice(0, 4).split(''));
    } else {
      const rand = String(Math.floor(Math.random() * 10000)).padStart(4, '0');
      setDigits(rand.split(''));
    }
  };

  // Physical keyboard listener (0-9, Backspace, Arrow keys)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) return;

      if (/^[0-9]$/.test(e.key)) {
        handleKeypadPress(parseInt(e.key, 10));
      } else if (e.key === 'Backspace' || e.key === 'Delete') {
        handleBackspace();
      } else if (e.key === 'ArrowUp') {
        incrementDigit(activeSlot);
      } else if (e.key === 'ArrowDown') {
        decrementDigit(activeSlot);
      } else if (e.key === 'ArrowLeft') {
        setActiveSlot(prev => (prev === 0 ? 3 : prev - 1));
      } else if (e.key === 'ArrowRight') {
        setActiveSlot(prev => (prev + 1) % 4);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeSlot, digits]);

  // Main purchase action depending on selectedTicketCount (1, 5, or 10)
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

    const ticketPrice = Number(event.ticketPrice || 10);
    const totalCost = ticketPrice * selectedTicketCount;

    if (Number(wallet.balance || 0) < totalCost) {
      showToast(`Insufficient USDT balance. Required: ${totalCost.toFixed(2)} USDT, Available: ${Number(wallet.balance || 0).toFixed(2)} USDT`, 'error');
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
            colors: ['#ffd700', '#f5c451', '#22c55e', '#ffffff']
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
          colors: ['#ffd700', '#f5c451', '#22c55e', '#ffffff']
        });
        showToast(`🎉 Successfully purchased ${generatedTickets.length} unique tickets for ${totalCost} USDT!`, 'success');

        if (getUnsoldRandomNumber) {
          const next = getUnsoldRandomNumber(event.id);
          setDigits(String(next).padStart(4, '0').slice(0, 4).split(''));
        }
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Room Activity: All ticket purchases made by users in THIS room/event
  const roomActivityTickets = useMemo(() => {
    if (!tickets) return [];
    return tickets
      .filter((t: any) => t.eventId === event.id || t.event_id === event.id)
      .slice(0, 40);
  }, [tickets, event.id]);

  // Current user's tickets in this room
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

  const winDigits = String(event.winningDigits || event.targetWinningDigits || '7429');

  const formatTimeAgo = (timestamp: number) => {
    const diff = Math.max(0, Date.now() - timestamp);
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  };

  const ticketPrice = Number(event.ticketPrice || 10);
  const totalPurchaseCost = ticketPrice * selectedTicketCount;

  return (
    <div className="w-full h-full flex flex-col min-h-0 overflow-hidden text-left space-y-1 sm:space-y-1.5">
      
      {/* 1. COMPACT IN-ROOM HEADER BANNER */}
      <div className="rounded-xl px-2.5 py-1.5 border border-amber-500/30 bg-gradient-to-r from-[#151C2B] via-[#0F1420] to-[#0B0F19] shadow-md flex items-center justify-between gap-2 shrink-0">
        
        {/* Left: Back to Lobby + Room Name + Status Badge */}
        <div className="flex items-center gap-1.5 xs:gap-2 min-w-0">
          {onBackToLobby && (
            <button
              onClick={onBackToLobby}
              className="px-2 py-0.5 rounded-lg bg-[#141924] hover:bg-[#1a2130] text-[#9b8f7c] hover:text-white border border-[#272a31] text-[10px] xs:text-[11px] font-bold flex items-center gap-1 cursor-pointer transition-colors shrink-0"
              title="Return to Lottery Lobby"
            >
              <ArrowLeft className="w-3 h-3 text-amber-400" />
              <span className="hidden xs:inline">Lobby</span>
            </button>
          )}

          <div className="flex items-center gap-1.5 min-w-0">
            <h2 className="font-display font-extrabold text-xs sm:text-sm text-white truncate">
              {room?.name || event.title}
            </h2>
            <span className="text-[9px] font-mono-numbers px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold uppercase shrink-0">
              {room?.drawId || 'DRAW #' + event.id}
            </span>
            <span className={`text-[9px] font-mono-numbers px-1.5 py-0.2 rounded font-bold uppercase flex items-center gap-1 shrink-0 ${
              isTimedOut 
                ? 'bg-[#141924] text-amber-300 border border-amber-500/30' 
                : 'bg-[#141924] text-emerald-400 border border-[#272a31]'
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${isTimedOut ? 'bg-amber-400' : 'bg-emerald-400 animate-pulse'}`} />
              <span className="hidden xs:inline">{isTimedOut ? 'CONCLUDED' : 'ACTIVE'}</span>
            </span>
          </div>
        </div>

        {/* Right: Metrics Strip (Ticket Price, Jackpot, Countdown) */}
        <div className="flex items-center gap-1.5 text-[10px] sm:text-[11px] font-mono-numbers shrink-0">
          <div className="bg-[#0b0e14] px-1.5 xs:px-2 py-0.5 rounded border border-[#272a31] flex items-center gap-1 shrink-0">
            <span className="text-[#8b92a2] hidden xs:inline">Ticket:</span>
            <strong className="text-purple-400 font-bold">{ticketPrice} USDT</strong>
          </div>

          <div className="bg-[#0b0e14] px-1.5 xs:px-2 py-0.5 rounded border border-[#272a31] flex items-center gap-1 shrink-0">
            <span className="text-[#8b92a2] hidden sm:inline">Jackpot:</span>
            <strong className="text-emerald-400 font-bold">{Number(event.poolPrize || 5000).toLocaleString()} USDT</strong>
          </div>

          <div className="bg-[#0b0e14] px-1.5 xs:px-2 py-0.5 rounded border border-[#272a31] flex items-center gap-1 text-amber-300 font-bold shrink-0">
            <Clock className="w-3 h-3 text-amber-400 shrink-0" />
            <span className="truncate">{isTimedOut ? 'Closed' : `${timeLeft.hours}h ${timeLeft.minutes}m ${timeLeft.seconds}s`}</span>
          </div>
        </div>

      </div>

      {/* Non-blocking Portrait Rotation Tip on Mobile */}
      {showRotatePrompt && (
        <div className="px-2.5 py-1 rounded-lg bg-amber-500/15 border border-amber-500/30 flex items-center justify-between text-[10px] text-amber-300 shrink-0">
          <div className="flex items-center gap-1.5">
            <RotateCcw className="w-3 h-3 text-amber-400 animate-spin" />
            <span>Rotate to landscape for optimal widescreen view</span>
          </div>
          <button
            onClick={() => setShowRotatePrompt(false)}
            className="text-amber-400/80 hover:text-white px-1 font-bold text-xs cursor-pointer"
            title="Dismiss rotation tip"
          >
            ✕
          </button>
        </div>
      )}

      {/* 2. MAIN WORKSTATION: CONCLUDED RESULT OR STRICT 50:25:25 3-SECTION HORIZONTAL LAYOUT */}
      {isTimedOut ? (
        /* CONCLUDED EVENT RESULT VIEW */
        <div className="flex-1 min-h-0 bg-[#111827] border border-[#1F2737] rounded-xl p-3 sm:p-5 flex flex-col justify-between overflow-y-auto no-scrollbar">
          <div className="space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-[#1f2737]">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400 shadow-[0_0_8px_rgba(245,196,81,0.6)]" />
                <span className="font-display font-extrabold text-sm sm:text-base text-white">
                  Official Concluded Result – {room?.name || event.title}
                </span>
              </div>
              <span className="text-[10px] font-mono-numbers px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold uppercase">
                Draw Concluded
              </span>
            </div>

            <div className="text-center py-2 sm:py-4">
              <span className="text-[11px] text-[#8b92a2] uppercase font-bold tracking-wider block mb-2">
                Official Winning 4-Digit Number
              </span>
              <div className="flex items-center justify-center gap-2 sm:gap-3">
                {winDigits.split('').map((digit: string, idx: number) => (
                  <div
                    key={idx}
                    className="w-12 h-14 sm:w-16 sm:h-18 rounded-2xl bg-gradient-to-b from-[#192233] to-[#0c0f17] border-2 border-emerald-400 flex items-center justify-center font-display font-black text-2xl sm:text-3xl text-emerald-300 shadow-[0_0_20px_rgba(5,213,170,0.35)]"
                  >
                    {digit}
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs font-mono-numbers">
              <div className="bg-[#0b0e14] p-2.5 rounded-xl border border-[#272a31]">
                <span className="text-[#8b92a2] text-[10px] block">Prize Pool</span>
                <strong className="text-purple-400 text-sm font-black">{Number(event.poolPrize || 5000).toLocaleString()} USDT</strong>
              </div>
              <div className="bg-[#0b0e14] p-2.5 rounded-xl border border-[#272a31]">
                <span className="text-[#8b92a2] text-[10px] block">Winning Digits</span>
                <strong className="text-emerald-400 text-sm font-black">#{winDigits}</strong>
              </div>
              <div className="bg-[#0b0e14] p-2.5 rounded-xl border border-[#272a31] col-span-2 sm:col-span-1">
                <span className="text-[#8b92a2] text-[10px] block">Winner Payouts</span>
                <strong className="text-purple-300 text-sm font-bold">{event.winners?.length || 1} Winner(s) Settled</strong>
              </div>
            </div>

            <div className="pt-2 border-t border-[#1f2737] space-y-1.5">
              <span className="font-bold text-xs text-white flex items-center gap-1.5">
                <Ticket className="w-3.5 h-3.5 text-amber-400" />
                <span>Your Tickets in this Round ({myTicketsInThisRoom.length})</span>
              </span>

              {myTicketsInThisRoom.length === 0 ? (
                <div className="p-3 rounded-lg bg-[#0b0e14] border border-[#272a31] text-center text-xs text-[#9b8f7c]">
                  You did not participate in this concluded round.
                </div>
              ) : (
                <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1 no-scrollbar">
                  {myTicketsInThisRoom.map((t: any, idx: number) => {
                    const isWin = t.ticketNumber === winDigits || t.status === 'won';
                    return (
                      <div
                        key={idx}
                        className={`p-2 rounded-xl flex items-center justify-between text-xs font-mono-numbers border ${
                          isWin
                            ? 'bg-emerald-950/20 border-emerald-500/40 text-emerald-300'
                            : 'bg-[#0b0e14] border-[#272a31] text-[#9b8f7c]'
                        }`}
                      >
                        <span className="font-bold text-white">#{t.ticketNumber}</span>
                        {isWin ? (
                          <span className="text-emerald-400 font-extrabold flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>WINNER ({t.wonAmount || event.poolPrize} USDT)</span>
                          </span>
                        ) : (
                          <span className="text-[#64748b]">Unmatched</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <div className="pt-3 border-t border-[#1f2737] flex flex-col xs:flex-row gap-2 shrink-0">
            {onBackToLobby && (
              <button
                type="button"
                onClick={onBackToLobby}
                className="btn-gold flex-1 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer shadow-md"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Return to Available Lottery Pools</span>
              </button>
            )}
          </div>
        </div>
      ) : (
        /* ========================================================================= */
        /* MANDATORY 50 : 25 : 25 HORIZONTAL LAYOUT ON ALL SCREENS & MOBILE DEVICES */
        /* ========================================================================= */
        <div className="flex-1 min-h-0 w-full grid grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)] gap-1 xs:gap-1.5 sm:gap-2 overflow-hidden">
          
          {/* ======================================================================= */}
          {/* SECTION 1: DIGIT SELECTION — STRICTLY 50% (2fr of 4fr) & ZERO SCROLL    */}
          {/* ======================================================================= */}
          <section className="col-span-1 min-w-0 bg-[#111827] border border-[#1F2737] rounded-xl p-1 xs:p-1.5 sm:p-2.5 flex flex-col justify-between overflow-hidden h-full min-h-0 gap-1">
            
            {/* Header: Title + Quick RNG */}
            <div className="flex items-center justify-between pb-0.5 xs:pb-1 border-b border-[#1f2737] shrink-0 min-w-0">
              <div className="flex items-center gap-1 min-w-0">
                <Sparkles className="w-3 h-3 text-amber-400 shrink-0" />
                <h3 className="font-display font-extrabold text-[10px] xs:text-xs text-white truncate">
                  Pick 4 Digits
                </h3>
              </div>
              
              <button
                type="button"
                onClick={handleQuickPickCurrent}
                className="px-1.5 py-0.5 rounded bg-[#141924] hover:bg-[#1a2130] text-amber-300 hover:text-white border border-[#272a31] text-[9px] xs:text-[10px] font-bold flex items-center gap-1 cursor-pointer transition-colors shrink-0"
                title="Randomize Digits"
              >
                <Dices className="w-3 h-3 shrink-0" />
                <span className="hidden xs:inline">Quick RNG</span>
                <span className="xs:hidden">RNG</span>
              </button>
            </div>

            {/* 4 DIGIT SELECTOR BOXES WITH UP/DOWN ARROWS (ZERO SCROLL, NEVER CLIPPED) */}
            <div className="w-full shrink-0 min-w-0">
              <div className="grid grid-cols-4 gap-0.5 xs:gap-1 sm:gap-1.5 w-full">
                {digits.map((digit, idx) => {
                  const isSelected = activeSlot === idx;
                  return (
                    <div key={idx} className="flex flex-col items-center gap-0.5 min-w-0">
                      {/* Up Arrow Button */}
                      <button
                        type="button"
                        onClick={() => incrementDigit(idx)}
                        className="w-full h-4 md:h-5 rounded bg-[#141924] hover:bg-[#1f2737] text-[#9b8f7c] hover:text-white border border-[#272a31] flex items-center justify-center cursor-pointer transition-colors shrink-0"
                        title="Increment (+1)"
                        aria-label={`Increment digit ${idx + 1}`}
                      >
                        <ChevronUp className="w-2.5 h-2.5 md:w-3 md:h-3" />
                      </button>

                      {/* Tactile Digit Box */}
                      <div
                        onClick={() => setActiveSlot(idx)}
                        className={`w-full h-6 xs:h-6.5 md:h-10 lg:h-12 rounded-md sm:rounded-lg flex items-center justify-center font-mono-numbers font-black text-xs xs:text-sm md:text-xl lg:text-2xl cursor-pointer select-none transition-all shadow-inner border-2 ${
                          isAlreadyPurchasedByMe
                            ? 'bg-[#181216] text-amber-300 border-amber-500/80 shadow-[0_0_10px_rgba(245,196,81,0.25)]'
                            : isSelected 
                            ? 'bg-[#1e2638] text-[#ffd700] border-[#ffd700] shadow-[0_0_12px_rgba(255,215,0,0.35)] scale-102' 
                            : 'bg-[#0b0e14] text-white border-[#272a31] hover:border-amber-500/50'
                        }`}
                        title={`Select slot ${idx + 1}`}
                      >
                        {digit}
                      </div>

                      {/* Down Arrow Button */}
                      <button
                        type="button"
                        onClick={() => decrementDigit(idx)}
                        className="w-full h-4 md:h-5 rounded bg-[#141924] hover:bg-[#1f2737] text-[#9b8f7c] hover:text-white border border-[#272a31] flex items-center justify-center cursor-pointer transition-colors shrink-0"
                        title="Decrement (-1)"
                        aria-label={`Decrement digit ${idx + 1}`}
                      >
                        <ChevronDown className="w-2.5 h-2.5 md:w-3 md:h-3" />
                      </button>
                    </div>
                  );
                })}
              </div>

              {/* Combination Availability Status */}
              <div className="text-center shrink-0 min-w-0">
                {isAlreadyPurchasedByMe ? (
                  <div className="inline-flex items-center gap-1 px-1.5 py-0 rounded-full bg-amber-500/15 border border-amber-500/40 text-amber-300 text-[7px] sm:text-[9px] font-bold max-w-full truncate leading-none">
                    <AlertCircle className="w-2 h-2 sm:w-2.5 sm:h-2.5 text-amber-400 shrink-0" />
                    <span className="truncate">Owned (#{currentNumberStr})</span>
                  </div>
                ) : (
                  <div className="inline-flex items-center gap-1 px-1.5 py-0 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-[7px] sm:text-[9px] font-bold max-w-full truncate leading-none">
                    <CheckCircle2 className="w-2 h-2 sm:w-2.5 sm:h-2.5 text-emerald-400 shrink-0" />
                    <span className="truncate">#{currentNumberStr} Available</span>
                  </div>
                )}
              </div>
            </div>

            {/* VIRTUAL NUMERIC KEYBOARD (0–9) — ZERO SCROLL & FULLY ACCESSIBLE */}
            <div className="w-full grid grid-cols-3 grid-rows-4 gap-0.5 xs:gap-1 flex-1 min-h-0">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((val) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => handleKeypadPress(val)}
                  className="h-full min-h-0 max-h-[34px] rounded bg-[#0b0e14] hover:bg-[#151c2b] text-white hover:text-amber-300 font-mono-numbers font-extrabold text-[10px] xs:text-xs sm:text-sm border border-[#272a31] active:scale-95 transition-all cursor-pointer shadow-sm flex items-center justify-center p-0"
                >
                  {val}
                </button>
              ))}
              <button
                type="button"
                onClick={handleBackspace}
                className="h-full min-h-0 max-h-[34px] rounded bg-[#141924] hover:bg-[#1a2130] text-[#9b8f7c] hover:text-white font-bold text-[8px] xs:text-[9px] sm:text-[10px] border border-[#272a31] transition-colors cursor-pointer flex items-center justify-center p-0"
              >
                Clear
              </button>
              <button
                type="button"
                onClick={() => handleKeypadPress(0)}
                className="h-full min-h-0 max-h-[34px] rounded bg-[#0b0e14] hover:bg-[#151c2b] text-white hover:text-amber-300 font-mono-numbers font-extrabold text-[10px] xs:text-xs sm:text-sm border border-[#272a31] active:scale-95 transition-all cursor-pointer shadow-sm flex items-center justify-center p-0"
              >
                0
              </button>
              <button
                type="button"
                onClick={handleQuickPickCurrent}
                className="h-full min-h-0 max-h-[34px] rounded bg-[#141924] hover:bg-[#1a2130] text-amber-400 font-bold text-[8px] xs:text-[9px] sm:text-[10px] border border-amber-500/30 transition-colors cursor-pointer flex items-center justify-center gap-0.5 p-0"
              >
                <Dices className="w-2.5 h-2.5 xs:w-3 xs:h-3" />
                <span>RNG</span>
              </button>
            </div>

          </section>

          {/* ======================================================================= */}
          {/* SECTION 2: TICKET SELECTION & PURCHASE — STRICTLY 25% (1fr of 4fr)      */}
          {/* ======================================================================= */}
          <section className="col-span-1 min-w-0 bg-[#111827] border border-[#1F2737] rounded-xl p-1 xs:p-1.5 sm:p-2.5 flex flex-col justify-between overflow-hidden h-full min-h-0 gap-1">
            
            {/* Header */}
            <div className="flex items-center justify-between pb-0.5 xs:pb-1 border-b border-[#1f2737] shrink-0 min-w-0">
              <div className="flex items-center gap-1 min-w-0">
                <Ticket className="w-3 h-3 text-amber-400 shrink-0" />
                <h3 className="font-display font-extrabold text-[10px] xs:text-xs text-white truncate">
                  Picks
                </h3>
              </div>
              <span className="text-[8px] xs:text-[9px] sm:text-[10px] font-mono-numbers text-[#8b92a2] shrink-0">
                {ticketPrice} USDT
              </span>
            </div>

            {/* Ticket Pick Options: 1 Pick, 5 Pick, 10 Pick */}
            <div className="space-y-0.5 xs:space-y-1 sm:space-y-1.5 flex-1 flex flex-col justify-center min-h-0">
              {[
                { count: 1, label: '1 Pick', desc: `#${currentNumberStr}` },
                { count: 5, label: '5 Pick', desc: '5 Unique' },
                { count: 10, label: '10 Pick', desc: '10 Unique' },
              ].map((opt) => {
                const isSelected = selectedTicketCount === opt.count;
                const cost = opt.count * ticketPrice;
                return (
                  <button
                    key={opt.count}
                    type="button"
                    onClick={() => setSelectedTicketCount(opt.count)}
                    className={`w-full py-0.5 xs:py-1 px-1 xs:px-1.5 rounded-md border text-left transition-all cursor-pointer flex items-center justify-between min-w-0 ${
                      isSelected
                        ? 'bg-gradient-to-r from-purple-500/20 to-purple-600/10 border-purple-400 shadow-[0_0_8px_rgba(168,85,247,0.2)]'
                        : 'bg-[#0b0e14] border-[#272a31] hover:border-purple-500/40 text-[#9b8f7c] hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-1 min-w-0">
                      <span className={`text-[8px] xs:text-[9px] sm:text-[10px] font-black truncate ${isSelected ? 'text-purple-300' : 'text-white'}`}>
                        {opt.label}
                      </span>
                    </div>
                    <span className={`text-[8px] xs:text-[9px] sm:text-[10px] font-mono-numbers font-bold shrink-0 ${isSelected ? 'text-white' : 'text-[#8b92a2]'}`}>
                      {cost} USDT
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Total Cost Calculation Summary */}
            <div className="p-1 rounded bg-[#0b0e14] border border-[#272a31] text-[8px] xs:text-[9px] font-mono-numbers shrink-0 space-y-0.5 min-w-0">
              <div className="flex items-center justify-between text-[#8b92a2]">
                <span>Qty:</span>
                <span className="text-white font-bold">{selectedTicketCount}</span>
              </div>
              <div className="flex items-center justify-between pt-0.5 border-t border-[#1f2737]">
                <span className="text-purple-400 font-bold">Total:</span>
                <span className="text-purple-300 font-black text-[9px] xs:text-[10px] sm:text-xs">
                  {totalPurchaseCost} USDT
                </span>
              </div>
            </div>

            {/* Buy Button */}
            <button
              type="button"
              onClick={handlePurchaseAction}
              disabled={
                isSubmitting || 
                isTimedOut || 
                (selectedTicketCount === 1 && isAlreadyPurchasedByMe)
              }
              className={`w-full py-1 xs:py-1.5 sm:py-2 rounded-md xs:rounded-lg font-display font-extrabold text-[9px] xs:text-[10px] sm:text-[11px] flex items-center justify-center gap-1 cursor-pointer shadow-lg transition-all shrink-0 min-w-0 ${
                selectedTicketCount === 1 && isAlreadyPurchasedByMe
                  ? 'bg-[#181a24] text-[#8b92a2] border border-[#272a31] cursor-not-allowed opacity-75'
                  : 'btn-gold shadow-amber-500/20 active:scale-[0.98]'
              }`}
            >
              <Coins className="w-3 h-3 shrink-0" />
              <span className="truncate">
                {selectedTicketCount === 1 && isAlreadyPurchasedByMe
                  ? 'Owned'
                  : `Buy (${totalPurchaseCost} USDT)`}
              </span>
            </button>

          </section>

          {/* ======================================================================= */}
          {/* SECTION 3: ROOM ACTIVITY — STRICTLY 25% (1fr of 4fr)                    */}
          {/* ======================================================================= */}
          <section className="col-span-1 min-w-0 bg-[#111827] border border-[#1F2737] rounded-xl p-1 xs:p-1.5 sm:p-2.5 flex flex-col justify-between overflow-hidden h-full min-h-0 gap-1">
            
            {/* Header */}
            <div className="flex items-center justify-between pb-0.5 xs:pb-1 border-b border-[#1f2737] shrink-0 min-w-0">
              <div className="flex items-center gap-1 min-w-0">
                <Activity className="w-3 h-3 text-emerald-400 shrink-0" />
                <h3 className="font-display font-extrabold text-[10px] xs:text-xs text-white truncate">
                  Activity
                </h3>
              </div>
              <span className="text-[7px] xs:text-[8px] font-mono-numbers px-1 py-0.2 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-bold flex items-center gap-0.5 shrink-0">
                <span className="w-1 h-1 rounded-full bg-emerald-400 animate-pulse" />
                <span>Live</span>
              </span>
            </div>

            {/* Room Ticket Purchases List (Vertical Scroll Contained Strictly Inside Section 3) */}
            <div className="flex-1 min-h-0 overflow-y-auto space-y-0.5 xs:space-y-1 pr-0.5 no-scrollbar min-w-0">
              {roomActivityTickets.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-1 rounded-lg border border-dashed border-[#272a31] text-[#9b8f7c] space-y-0.5">
                  <Ticket className="w-3.5 h-3.5 text-[#9b8f7c]/40" />
                  <p className="text-[9px] font-bold text-white">No Tickets</p>
                  <p className="text-[7px] xs:text-[8px] text-[#64748b]">Be first!</p>
                </div>
              ) : (
                roomActivityTickets.map((tkt: any, idx: number) => {
                  const isMine = (user && tkt.userId === user.id) || (wallet?.address && tkt.userAddress === wallet.address);
                  const displayUsername = tkt.username || (isMine ? '@You' : `@p_${tkt.id ? tkt.id.slice(-4) : idx}`);

                  return (
                    <div
                      key={tkt.id || idx}
                      className={`p-1 rounded border flex items-center justify-between text-[8px] xs:text-[9px] font-mono-numbers transition-all min-w-0 ${
                        isMine
                          ? 'bg-[#151d2c] border-amber-500/40 text-amber-300'
                          : 'bg-[#0b0e14] border-[#1f2737] text-white'
                      }`}
                    >
                      <div className="min-w-0 flex-1 mr-0.5">
                        <span className={`block font-bold truncate ${isMine ? 'text-amber-300' : 'text-[#cbd5e1]'}`}>
                          {isMine ? '@You' : displayUsername}
                        </span>
                        <span className="text-[7px] text-[#8b92a2] block truncate">
                          {formatTimeAgo(Number(tkt.purchaseTime || Date.now()))}
                        </span>
                      </div>

                      <div className="text-right shrink-0">
                        <span className="font-display font-black text-[9px] xs:text-[10px] text-emerald-400 block tracking-wider">
                          #{String(tkt.ticketNumber).padStart(4, '0')}
                        </span>
                        <span className="text-[7px] text-[#8b92a2]">
                          {tkt.price || ticketPrice} USDT
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Room Total Sold Summary Footer */}
            <div className="p-0.5 xs:p-1 rounded bg-[#0b0e14] border border-[#272a31] flex items-center justify-between text-[8px] xs:text-[9px] font-mono-numbers shrink-0 min-w-0">
              <span className="text-[#8b92a2]">Sold:</span>
              <strong className="text-white font-bold">{roomActivityTickets.length}</strong>
            </div>

          </section>

        </div>
      )}

      {/* 3. PROVABLY FAIR VERIFICATION STRIP */}
      <div className="px-2 py-0.5 rounded-md bg-[#0b0e14] border border-[#272a31] flex items-center justify-between text-[9px] xs:text-[10px] text-[#9b8f7c] shrink-0">
        <div className="flex items-center gap-1 min-w-0">
          <ShieldCheck className="w-3 h-3 text-emerald-400 shrink-0" />
          <span className="text-white font-bold truncate">Provably Fair:</span>
          <span className="font-mono text-[#8b92a2] truncate">{event.sha256Seed || '0x4f88e1...'}</span>
        </div>

        <div className="font-mono-numbers text-amber-400 font-bold shrink-0">
          SHA-256 Verified
        </div>
      </div>

    </div>
  );
}
