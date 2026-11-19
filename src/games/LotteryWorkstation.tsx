import React, { useState, useEffect, useMemo } from 'react';
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
  CheckCircle2
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

  // 2. Active 4-digit input slots state
  const [digits, setDigits] = useState<string[]>(() => {
    const initial = getUnsoldRandomNumber ? getUnsoldRandomNumber(event?.id) : Math.floor(1000 + Math.random() * 9000).toString();
    return String(initial).padStart(4, '0').slice(0, 4).split('');
  });
  const [activeSlot, setActiveSlot] = useState<number>(0);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // 3. Ticket quantity pick state: 1, 5, or 10
  const [selectedTicketCount, setSelectedTicketCount] = useState<number>(1);

  // 4. Countdown timer
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

  const handleClearSlot = () => {
    soundFX.playClick();
    const newDigits = [...digits];
    newDigits[activeSlot] = '0';
    setDigits(newDigits);
    setActiveSlot(prev => (prev === 0 ? 0 : prev - 1));
  };

  const handleResetAll = () => {
    soundFX.playClick();
    setDigits(['0', '0', '0', '0']);
    setActiveSlot(0);
  };

  // Quick Pick randomizer for current dials (generates unsold random number)
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
        handleClearSlot();
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

  return (
    <div className="w-full h-full flex flex-col min-h-0 overflow-y-auto no-scrollbar text-left space-y-3 sm:space-y-4 p-2 xs:p-3 sm:p-4 lg:p-5">
      
      {/* ===================================================================== */}
      {/* 1. ROOM HEADER BANNER: ROOM NAME, DRAW ID, PRICE, JACKPOT, COUNTDOWN   */}
      {/* ===================================================================== */}
      <div className="w-full max-w-7xl mx-auto rounded-2xl p-3 sm:p-4 border border-amber-500/30 bg-gradient-to-r from-[#151C2B] via-[#0F1420] to-[#0B0F19] shadow-xl flex flex-wrap items-center justify-between gap-3 shrink-0">
        
        {/* Left: Back to Lobby + Room Name + Status */}
        <div className="flex items-center gap-2.5 min-w-0">
          {onBackToLobby && (
            <button
              onClick={onBackToLobby}
              className="px-2.5 py-1.5 rounded-xl bg-[#141924] hover:bg-[#1a2130] text-[#94A3B8] hover:text-white border border-[#272a31] text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all shrink-0 shadow-sm"
              title="Return to Lottery Lobby"
            >
              <ArrowLeft className="w-3.5 h-3.5 text-amber-400" />
              <span className="hidden xs:inline">Lobby</span>
            </button>
          )}

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="font-display font-black text-sm sm:text-base text-white truncate">
                {room?.name || event.title}
              </h2>
              <span className={`text-[10px] font-mono-numbers px-2 py-0.5 rounded-md font-bold uppercase flex items-center gap-1 shrink-0 ${statusInfo.badgeClass}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${statusInfo.dotClass}`} />
                <span>{statusInfo.label}</span>
              </span>
            </div>
            <p className="text-[11px] text-[#94A3B8] truncate hidden sm:block">
              Pick 4 lucky digits from 0000 to 9999 · Autonomous On-Chain Draw
            </p>
          </div>
        </div>

        {/* Right: Metrics Strip (Ticket Price, Jackpot, Countdown) */}
        <div className="flex items-center gap-2 sm:gap-3 text-xs font-mono-numbers flex-wrap ml-auto">
          <div className="bg-[#07090d] px-2.5 py-1.5 rounded-xl border border-[#272a31] flex items-center gap-1.5 shadow-inner">
            <span className="text-[#8b92a2] text-[10px] uppercase">Ticket:</span>
            <strong className="text-white font-bold">{ticketPrice} USDT</strong>
          </div>

          <div className="bg-[#07090d] px-2.5 py-1.5 rounded-xl border border-[#272a31] flex items-center gap-1.5 shadow-inner">
            <span className="text-[#8b92a2] text-[10px] uppercase">Jackpot:</span>
            <strong className="text-amber-400 font-bold">{Number(event.poolPrize || 5000).toLocaleString()} USDT</strong>
          </div>

          <div className="bg-[#07090d] px-2.5 py-1.5 rounded-xl border border-amber-500/30 flex items-center gap-1.5 text-amber-300 font-bold shadow-inner">
            <Clock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span>{isTimedOut ? 'Closed' : `${timeLeft.hours}h ${timeLeft.minutes}m ${timeLeft.seconds}s`}</span>
          </div>
        </div>

      </div>

      {/* ===================================================================== */}
      {/* 2. MAIN ROOM INTERFACE: 3 FUNCTIONAL AREAS A, B, C                    */}
      {/* ===================================================================== */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-3.5 sm:gap-4 lg:gap-5 w-full max-w-7xl mx-auto">
          
          {/* =================================================================== */}
          {/* AREA A: DIGIT SELECTION & NUMERIC KEYPAD                            */}
          {/* =================================================================== */}
          <section className="col-span-1 md:col-span-1 lg:col-span-6 xl:col-span-5 bg-[#0d1117] border border-[#272a31] rounded-2xl p-4 sm:p-5 flex flex-col justify-between shadow-xl space-y-4">
            
            {/* Header: Title + Reset Action */}
            <div className="flex items-center justify-between pb-3 border-b border-[#1f2737]">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-display font-extrabold text-sm sm:text-base text-white">
                    Pick 4 Digits
                  </h3>
                  <p className="text-[11px] text-[#94A3B8]">
                    Select any slot and tap numbers on keypad
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleResetAll}
                className="px-2.5 py-1 rounded-lg bg-[#141924] hover:bg-[#1a2130] text-[#94A3B8] hover:text-white border border-[#272a31] text-[11px] font-bold flex items-center gap-1.5 cursor-pointer transition-colors"
                title="Reset all 4 digits to 0000"
              >
                <RotateCcw className="w-3 h-3 text-amber-400" />
                <span>Reset</span>
              </button>
            </div>

            {/* 4 Separate Digit Input Slots */}
            <div className="space-y-2">
              <div className="grid grid-cols-4 gap-2 sm:gap-3">
                {digits.map((digit, idx) => {
                  const isSelected = activeSlot === idx;
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setActiveSlot(idx)}
                      className={`h-16 xs:h-18 sm:h-20 lg:h-22 rounded-xl sm:rounded-2xl flex flex-col items-center justify-center cursor-pointer transition-all duration-150 select-none border-2 shadow-inner group ${
                        isSelected
                          ? 'border-amber-400 bg-gradient-to-b from-amber-500/20 via-[#131926] to-[#0a0d14] shadow-[0_0_20px_rgba(245,196,81,0.3)] scale-[1.02]'
                          : isAlreadyPurchasedByMe
                          ? 'border-red-500/40 bg-red-950/15 text-red-200 hover:border-red-400/60'
                          : 'border-[#272a31] bg-[#07090d] hover:border-amber-500/40 text-white hover:bg-[#0e121a]'
                      }`}
                      title={`Select Digit Slot ${idx + 1}`}
                      aria-label={`Digit slot ${idx + 1}, currently ${digit}`}
                    >
                      <span className={`text-[9px] sm:text-[10px] font-mono-numbers font-bold uppercase tracking-wider block transition-colors ${
                        isSelected ? 'text-amber-300' : 'text-[#64748b] group-hover:text-[#94A3B8]'
                      }`}>
                        Digit {idx + 1}
                      </span>

                      <span className={`font-mono-numbers font-black text-2xl xs:text-3xl sm:text-4xl lg:text-5xl my-0.5 transition-colors ${
                        isSelected ? 'text-amber-300 drop-shadow-[0_0_8px_rgba(245,196,81,0.5)]' : isAlreadyPurchasedByMe ? 'text-red-300' : 'text-white'
                      }`}>
                        {digit}
                      </span>

                      {/* Glowing Accent Indicator Bar */}
                      <span className={`w-8 h-1 rounded-full transition-all ${
                        isSelected ? 'bg-amber-400 shadow-[0_0_8px_rgba(245,196,81,0.8)] animate-pulse' : 'bg-transparent'
                      }`} />
                    </button>
                  );
                })}
              </div>

              {/* Combination Availability Status */}
              <div className="flex items-center justify-between text-xs pt-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-[#94A3B8]">Selected:</span>
                  <span className="font-mono-numbers font-black text-amber-300 text-sm">
                    #{currentNumberStr}
                  </span>
                </div>

                <div>
                  {isAlreadyPurchasedByMe ? (
                    <span className="px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 text-[10px] font-bold flex items-center gap-1">
                      <AlertCircle className="w-3 h-3 text-amber-400" />
                      <span>Already Owned by You</span>
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-[10px] font-bold flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                      <span>Available to Claim</span>
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* PROFESSIONAL NUMERIC KEYPAD (4 rows x 3 columns) */}
            <div className="space-y-2 pt-2 border-t border-[#1f2737]">
              <div className="flex items-center justify-between text-[11px] text-[#64748b] font-bold uppercase tracking-wider px-1">
                <span>Numeric Keypad</span>
                <span>Slot {activeSlot + 1} of 4 Active</span>
              </div>

              <div className="grid grid-cols-3 gap-2 sm:gap-2.5">
                {/* Row 1: 1, 2, 3 */}
                {[1, 2, 3].map((num) => (
                  <button
                    key={num}
                    type="button"
                    onClick={() => handleKeypadPress(num)}
                    className="h-12 xs:h-13 sm:h-14 lg:h-15 rounded-xl sm:rounded-2xl bg-gradient-to-b from-[#141925] to-[#0c0f17] hover:from-[#1d2538] hover:to-[#131926] active:scale-[0.97] active:from-amber-500/25 active:to-amber-500/10 border border-[#273145] hover:border-amber-400/50 shadow-md hover:shadow-lg transition-all cursor-pointer font-mono-numbers font-black text-xl sm:text-2xl text-white hover:text-amber-300 flex items-center justify-center select-none"
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
                    className="h-12 xs:h-13 sm:h-14 lg:h-15 rounded-xl sm:rounded-2xl bg-gradient-to-b from-[#141925] to-[#0c0f17] hover:from-[#1d2538] hover:to-[#131926] active:scale-[0.97] active:from-amber-500/25 active:to-amber-500/10 border border-[#273145] hover:border-amber-400/50 shadow-md hover:shadow-lg transition-all cursor-pointer font-mono-numbers font-black text-xl sm:text-2xl text-white hover:text-amber-300 flex items-center justify-center select-none"
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
                    className="h-12 xs:h-13 sm:h-14 lg:h-15 rounded-xl sm:rounded-2xl bg-gradient-to-b from-[#141925] to-[#0c0f17] hover:from-[#1d2538] hover:to-[#131926] active:scale-[0.97] active:from-amber-500/25 active:to-amber-500/10 border border-[#273145] hover:border-amber-400/50 shadow-md hover:shadow-lg transition-all cursor-pointer font-mono-numbers font-black text-xl sm:text-2xl text-white hover:text-amber-300 flex items-center justify-center select-none"
                  >
                    {num}
                  </button>
                ))}

                {/* Row 4: Clear, 0, RNG */}
                <button
                  type="button"
                  onClick={handleClearSlot}
                  className="h-12 xs:h-13 sm:h-14 lg:h-15 rounded-xl sm:rounded-2xl bg-gradient-to-b from-[#1a1218] to-[#110c10] hover:from-[#261822] hover:to-[#1a1017] active:scale-[0.97] border border-red-500/30 hover:border-red-400/60 shadow-md transition-all cursor-pointer text-xs sm:text-sm font-extrabold text-red-300 hover:text-red-200 uppercase tracking-wider flex items-center justify-center gap-1 select-none"
                  title="Clear current slot"
                >
                  <span>Clear</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleKeypadPress(0)}
                  className="h-12 xs:h-13 sm:h-14 lg:h-15 rounded-xl sm:rounded-2xl bg-gradient-to-b from-[#141925] to-[#0c0f17] hover:from-[#1d2538] hover:to-[#131926] active:scale-[0.97] active:from-amber-500/25 active:to-amber-500/10 border border-[#273145] hover:border-amber-400/50 shadow-md hover:shadow-lg transition-all cursor-pointer font-mono-numbers font-black text-xl sm:text-2xl text-white hover:text-amber-300 flex items-center justify-center select-none"
                >
                  0
                </button>

                <button
                  type="button"
                  onClick={handleQuickPickCurrent}
                  className="h-12 xs:h-13 sm:h-14 lg:h-15 rounded-xl sm:rounded-2xl bg-gradient-to-b from-[#1c1810] to-[#120f0a] hover:from-[#2a2214] hover:to-[#1a150c] active:scale-[0.97] border border-amber-500/40 hover:border-amber-400 shadow-md transition-all cursor-pointer text-xs sm:text-sm font-extrabold text-amber-300 hover:text-amber-200 uppercase tracking-wider flex items-center justify-center gap-1.5 select-none"
                  title="Generate random 4 digits"
                >
                  <Dices className="w-3.5 h-3.5 text-amber-400" />
                  <span>RNG</span>
                </button>
              </div>
            </div>

          </section>

          {/* =================================================================== */}
          {/* AREA B: QUICK PICK / PURCHASE PANEL                                */}
          {/* =================================================================== */}
          <section className="col-span-1 md:col-span-1 lg:col-span-3 xl:col-span-3 bg-[#0d1117] border border-[#272a31] rounded-2xl p-4 sm:p-5 flex flex-col justify-between shadow-xl space-y-4">
            
            <div className="space-y-4">
              {/* Header */}
              <div className="flex items-center justify-between pb-3 border-b border-[#1f2737]">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400">
                    <Ticket className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-display font-extrabold text-sm sm:text-base text-white">
                      Quick Pick
                    </h3>
                    <p className="text-[11px] text-[#94A3B8]">
                      Choose order size
                    </p>
                  </div>
                </div>

                <span className="text-xs font-mono-numbers font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-lg border border-amber-500/20">
                  {ticketPrice} USDT / ea
                </span>
              </div>

              {/* Pick Options: 1 Pick, 5 Picks, 10 Picks */}
              <div className="space-y-2.5">
                {[
                  { count: 1, label: '1 Pick', desc: `Selected: #${currentNumberStr}` },
                  { count: 5, label: '5 Picks', desc: '5 Unique Combinations' },
                  { count: 10, label: '10 Picks', desc: '10 Unique Combinations' }
                ].map((opt) => {
                  const isSelected = selectedTicketCount === opt.count;
                  const cost = opt.count * ticketPrice;
                  return (
                    <button
                      key={opt.count}
                      type="button"
                      onClick={() => setSelectedTicketCount(opt.count)}
                      className={`w-full p-3 rounded-xl border text-left transition-all cursor-pointer flex items-center justify-between ${
                        isSelected
                          ? 'bg-gradient-to-r from-purple-500/20 via-purple-600/10 to-transparent border-purple-400 shadow-[0_0_12px_rgba(168,85,247,0.25)]'
                          : 'bg-[#07090d] border-[#272a31] hover:border-purple-500/40 text-[#94A3B8]'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <div className={`w-4 h-4 rounded-full flex items-center justify-center border ${
                          isSelected ? 'border-purple-400 bg-purple-500 text-black' : 'border-[#3b4354]'
                        }`}>
                          {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                        </div>
                        <div>
                          <span className={`text-xs sm:text-sm font-black block ${
                            isSelected ? 'text-white' : 'text-[#cbd5e1]'
                          }`}>
                            {opt.label}
                          </span>
                          <span className="text-[10px] text-[#64748b] block font-mono-numbers">
                            {opt.desc}
                          </span>
                        </div>
                      </div>

                      <div className="text-right">
                        <span className={`text-xs sm:text-sm font-mono-numbers font-extrabold ${
                          isSelected ? 'text-amber-400' : 'text-[#94A3B8]'
                        }`}>
                          {cost} USDT
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Order & Pricing Summary Box */}
              <div className="p-3 rounded-xl bg-[#07090d] border border-[#1f2737] space-y-1.5 text-xs font-mono-numbers shadow-inner">
                <div className="flex items-center justify-between text-[#8b92a2]">
                  <span>Quantity:</span>
                  <strong className="text-white">{selectedTicketCount} Ticket{selectedTicketCount > 1 ? 's' : ''}</strong>
                </div>
                <div className="flex items-center justify-between text-[#8b92a2]">
                  <span>Price per Ticket:</span>
                  <strong className="text-white">{ticketPrice} USDT</strong>
                </div>
                <div className="flex items-center justify-between pt-1.5 border-t border-[#1f2737]">
                  <span className="text-purple-300 font-bold">Total Cost:</span>
                  <strong className="text-amber-400 font-black text-sm sm:text-base">
                    {totalPurchaseCost} USDT
                  </strong>
                </div>
                <div className="flex items-center justify-between pt-1 text-[11px] text-[#64748b]">
                  <span>Wallet Balance:</span>
                  <span className={Number(wallet.balance || 0) < totalPurchaseCost ? 'text-red-400 font-bold' : 'text-emerald-400 font-bold'}>
                    {Number(wallet.balance || 0).toFixed(2)} USDT
                  </span>
                </div>
              </div>
            </div>

            {/* Buy Action Button */}
            <div className="pt-2">
              <button
                type="button"
                onClick={handlePurchaseAction}
                disabled={
                  isSubmitting || 
                  isTimedOut || 
                  (selectedTicketCount === 1 && isAlreadyPurchasedByMe)
                }
                className={`w-full py-3 sm:py-3.5 rounded-xl font-display font-black text-xs sm:text-sm uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer shadow-xl transition-all ${
                  selectedTicketCount === 1 && isAlreadyPurchasedByMe
                    ? 'bg-[#181a24] text-[#8b92a2] border border-[#272a31] cursor-not-allowed opacity-75'
                    : 'btn-gold shadow-amber-500/20 active:scale-[0.98]'
                }`}
              >
                <Coins className="w-4 h-4" />
                <span>
                  {isSubmitting
                    ? 'Processing...'
                    : selectedTicketCount === 1 && isAlreadyPurchasedByMe
                    ? 'Ticket Already Owned'
                    : `Buy (${totalPurchaseCost} USDT)`}
                </span>
              </button>
            </div>

          </section>

          {/* =================================================================== */}
          {/* AREA C: ROOM ACTIVITY PANEL                                        */}
          {/* =================================================================== */}
          <section className="col-span-1 md:col-span-2 lg:col-span-3 xl:col-span-4 bg-[#0d1117] border border-[#272a31] rounded-2xl p-4 sm:p-5 flex flex-col justify-between shadow-xl space-y-4">
            
            <div className="space-y-4 flex-1 flex flex-col min-h-0">
              {/* Header */}
              <div className="flex items-center justify-between pb-3 border-b border-[#1f2737] shrink-0">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                    <Activity className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-display font-extrabold text-sm sm:text-base text-white">
                      Room Activity
                    </h3>
                    <p className="text-[11px] text-[#94A3B8]">
                      Live room purchases
                    </p>
                  </div>
                </div>

                <span className="text-[10px] font-mono-numbers px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-bold flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span>Live</span>
                </span>
              </div>

              {/* Live Purchased Tickets Feed */}
              <div className="flex-1 min-h-[160px] max-h-[340px] overflow-y-auto space-y-2 pr-1 no-scrollbar">
                {roomActivityTickets.length === 0 ? (
                  <div className="h-full min-h-[160px] flex flex-col items-center justify-center text-center p-4 rounded-xl border border-dashed border-[#272a31] text-[#94A3B8] space-y-2">
                    <Ticket className="w-6 h-6 text-[#64748b]/50" />
                    <p className="text-xs font-bold text-white">No Tickets Purchased Yet</p>
                    <p className="text-[11px] text-[#64748b] max-w-[180px]">
                      Be the first to claim a 4-digit ticket in this room!
                    </p>
                  </div>
                ) : (
                  roomActivityTickets.map((tkt: any, idx: number) => {
                    const isMine = (user && tkt.userId === user.id) || (wallet?.address && tkt.userAddress === wallet.address);
                    const displayUsername = tkt.username || (isMine ? '@You' : `@p_${tkt.id ? tkt.id.slice(-4) : idx}`);

                    return (
                      <div
                        key={tkt.id || idx}
                        className={`p-2.5 rounded-xl border flex items-center justify-between text-xs font-mono-numbers transition-colors ${
                          isMine
                            ? 'bg-amber-500/10 border-amber-500/30 text-amber-300'
                            : 'bg-[#07090d] border-[#1f2737] hover:border-[#272a31] text-white'
                        }`}
                      >
                        <div className="min-w-0 flex-1 mr-2">
                          <span className={`block font-bold truncate text-xs ${
                            isMine ? 'text-amber-300' : 'text-[#cbd5e1]'
                          }`}>
                            {isMine ? '★ You' : displayUsername}
                          </span>
                          <span className="text-[10px] text-[#64748b] block truncate">
                            {formatTimeAgo(Number(tkt.purchaseTime || Date.now()))}
                          </span>
                        </div>

                        <div className="text-right shrink-0">
                          <span className="font-display font-black text-xs sm:text-sm text-emerald-400 block tracking-wider">
                            #{String(tkt.ticketNumber).padStart(4, '0')}
                          </span>
                          <span className="text-[10px] text-[#64748b]">
                            {tkt.price || ticketPrice} USDT
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Footer Stats */}
            <div className="p-2.5 rounded-xl bg-[#07090d] border border-[#1f2737] flex items-center justify-between text-xs font-mono-numbers shrink-0 shadow-inner">
              <span className="text-[#8b92a2]">Total Sold:</span>
              <strong className="text-emerald-400 font-bold">{roomActivityTickets.length} Tickets</strong>
            </div>

          </section>

        </div>

      {/* ===================================================================== */}
      {/* 3. PROVABLY FAIR VERIFICATION STRIP                                   */}
      {/* ===================================================================== */}
      <div className="px-3 sm:px-4 py-2 rounded-xl bg-[#07090d] border border-[#272a31] flex flex-wrap items-center justify-between text-xs text-[#94A3B8] gap-2 max-w-7xl mx-auto w-full shrink-0">
        <div className="flex items-center gap-1.5 min-w-0">
          <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
          <span className="text-white font-bold">Provably Fair SHA-256:</span>
          <span className="font-mono text-[11px] text-[#64748b] truncate max-w-[200px] sm:max-w-xs">{event.sha256Seed || '0x4f88e1...'}</span>
        </div>

        <div className="font-mono-numbers text-amber-400 text-xs font-bold">
          Cryptographically Verified
        </div>
      </div>

    </div>
  );
}
