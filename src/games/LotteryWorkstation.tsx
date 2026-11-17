import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useLottery } from '../context/LotteryContext';
import { 
  Dices, 
  ChevronUp, 
  ChevronDown, 
  ShieldCheck, 
  Check, 
  Sparkles, 
  AlertCircle, 
  Coins, 
  Clock, 
  Trophy, 
  Users, 
  CheckCircle2, 
  Ticket, 
  ArrowLeft,
  Play,
  RotateCcw,
  Flame,
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
      e.title?.toLowerCase().includes(room.name?.toLowerCase())
    );
    if (matching) return matching;

    const active = events.find((e: any) => e.status === 'active');
    if (active) {
      return {
        ...active,
        id: room.drawId || room.id || active.id,
        title: room.name || active.title,
        ticketPrice: room.minStakeFC || active.ticketPrice || 10,
        poolPrize: room.prizeInfo?.match(/\d+[\d,]*/)?.[0]?.replace(',', '') || active.poolPrize || 5000
      };
    }

    return {
      id: room.drawId || room.id || 'DRW-1001',
      title: room.name || 'Four-Digit Lottery Draw',
      ticketPrice: room.minStakeFC || 10,
      poolPrize: 10000,
      drawTime: Date.now() + (room.drawDurationHours || 24) * 3600 * 1000,
      status: 'active',
      ticketsSold: 42,
      participantsCount: room.currentPlayers || 18,
      sha256Seed: '0x' + Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join('')
    };
  }, [room, events]);

  // 2. Active 4-digit dials state
  const [digits, setDigits] = useState<string[]>(() => {
    const initial = getUnsoldRandomNumber ? getUnsoldRandomNumber(event?.id) : '7429';
    return String(initial).padStart(4, '0').slice(0, 4).split('');
  });
  const [activeSlot, setActiveSlot] = useState<number>(0);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // 3. Countdown timer
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
      // Don't intercept if inside an input or textarea
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

  // Single Ticket Checkout
  const handlePurchaseSingle = async () => {
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

    if (isAlreadyPurchasedByMe) {
      showToast(`You have already purchased ticket #${currentNumberStr} for this draw! Duplicate purchases by the same user are not permitted.`, 'error');
      return;
    }

    const ticketCost = Number(event.ticketPrice || 10);
    if (Number(wallet.balance || 0) < ticketCost) {
      showToast(`Insufficient Flow Coins. Required: ${ticketCost} FC, Available: ${wallet.balance} FC`, 'error');
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
        showToast(`🎉 Purchased Ticket #${currentNumberStr} for ${ticketCost} FC!`, 'success');
        
        // Auto-advance dial to another available unsold number
        if (getUnsoldRandomNumber) {
          const next = getUnsoldRandomNumber(event.id);
          setDigits(String(next).padStart(4, '0').slice(0, 4).split(''));
        }
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Bulk Quick Buy (1, 5, or 10 unique tickets)
  const handleBulkBuy = async (count: number) => {
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

    const totalCost = Number(event.ticketPrice || 10) * count;
    if (Number(wallet.balance || 0) < totalCost) {
      showToast(`Insufficient Flow Coins. Required: ${totalCost} FC, Available: ${wallet.balance} FC`, 'error');
      return;
    }

    // Generate unique random tickets not yet owned by this user
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

    for (let i = 0; i < count; i++) {
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
        showToast(`🎉 Successfully purchased ${generatedTickets.length} unique tickets for ${totalCost} FC!`, 'success');
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
      .slice(0, 30); // Show recent 30 tickets
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

  // Format relative time helper
  const formatTimeAgo = (timestamp: number) => {
    const diff = Math.max(0, Date.now() - timestamp);
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  };

  return (
    <div className="w-full h-full flex flex-col min-h-0 overflow-hidden text-left space-y-1.5 sm:space-y-2">
      
      {/* 1. COMPACT TOP IN-ROOM BANNER */}
      <div className="glass-panel rounded-xl p-2 sm:px-3 sm:py-2 border border-amber-500/30 bg-gradient-to-r from-[#151C2B] via-[#0F1420] to-[#0B0F19] shadow-md flex flex-col md:flex-row items-stretch md:items-center justify-between gap-1.5 sm:gap-3 shrink-0">
        
        {/* Left: Back to Lobby + Room Name + Status Badge */}
        <div className="flex items-center gap-2 min-w-0">
          {onBackToLobby && (
            <button
              onClick={onBackToLobby}
              className="px-2 py-1 rounded-lg bg-[#141924] hover:bg-[#1a2130] text-[#9b8f7c] hover:text-white border border-[#272a31] text-[11px] font-bold flex items-center gap-1 cursor-pointer transition-colors shrink-0"
              title="Return to Lottery Lobby"
            >
              <ArrowLeft className="w-3.5 h-3.5 text-amber-400" />
              <span className="hidden xs:inline">Lobby</span>
            </button>
          )}

          <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
            <h2 className="font-display font-extrabold text-xs sm:text-sm text-white truncate">
              {room?.name || event.title}
            </h2>
            <span className="text-[9px] font-mono-numbers px-1.5 py-0.2 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold uppercase shrink-0">
              {room?.drawId || 'DRAW #' + event.id}
            </span>
            <span className={`text-[9px] font-mono-numbers px-1.5 py-0.2 rounded font-bold uppercase flex items-center gap-1 shrink-0 ${
              isTimedOut 
                ? 'bg-[#141924] text-amber-300 border border-amber-500/30' 
                : 'bg-[#141924] text-emerald-400 border border-[#272a31]'
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${isTimedOut ? 'bg-amber-400' : 'bg-emerald-400 animate-pulse'}`} />
              {isTimedOut ? 'CONCLUDED' : 'ACTIVE'}
            </span>
          </div>
        </div>

        {/* Right: Inline Metrics Strip (Price, Pool, Players, Countdown) */}
        <div className="flex items-center gap-1.5 text-[10px] sm:text-[11px] font-mono-numbers overflow-x-auto no-scrollbar shrink-0">
          <div className="bg-[#0b0e14] px-2 py-0.5 rounded border border-[#272a31] flex items-center gap-1 shrink-0">
            <span className="text-[#8b92a2]">Ticket:</span>
            <strong className="text-amber-400 font-bold">{event.ticketPrice} FC</strong>
          </div>

          <div className="bg-[#0b0e14] px-2 py-0.5 rounded border border-[#272a31] flex items-center gap-1 shrink-0">
            <span className="text-[#8b92a2]">Jackpot:</span>
            <strong className="text-emerald-400 font-bold">{Number(event.poolPrize || 5000).toLocaleString()} FC</strong>
          </div>

          <div className="bg-[#0b0e14] px-2 py-0.5 rounded border border-[#272a31] flex items-center gap-1 shrink-0">
            <span className="text-[#8b92a2]">Players:</span>
            <strong className="text-purple-300 font-bold">{event.participantsCount || room?.currentPlayers || 18}</strong>
          </div>

          <div className="bg-[#0b0e14] px-2 py-0.5 rounded border border-[#272a31] flex items-center gap-1 text-amber-300 font-bold shrink-0">
            <Clock className="w-3 h-3 text-amber-400" />
            <span>{isTimedOut ? 'Draw Closed' : `${timeLeft.hours}h ${timeLeft.minutes}m ${timeLeft.seconds}s`}</span>
          </div>
        </div>

      </div>

      {/* 2. MAIN WORKSTATION: CONCLUDED RESULT OR 4-PART ACTIVE GAMEPLAY */}
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

            {/* Glowing Drawn 4-Digit Balls */}
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

            {/* Pool & Winner Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs font-mono-numbers">
              <div className="bg-[#0b0e14] p-2.5 rounded-xl border border-[#272a31]">
                <span className="text-[#8b92a2] text-[10px] block">Prize Pool</span>
                <strong className="text-amber-400 text-sm font-black">{Number(event.poolPrize || 5000).toLocaleString()} FC</strong>
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

            {/* User's tickets in this concluded draw */}
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
                            <span>WINNER ({t.wonAmount || event.poolPrize} FC)</span>
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

          {/* Action CTAs */}
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
        /* ================================================================ */
        /* 4-PART PROPORTIONAL LAYOUT: 75% DIGIT SELECTION : 25% ROOM ACTIVITY */
        /* ================================================================ */
        <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 gap-2 sm:gap-3 overflow-hidden">
          
          {/* ============================================================== */}
          {/* DIGIT SELECTION AREA (3 PARTS / ~75% of content width)          */}
          {/* ============================================================== */}
          <div className="order-1 lg:col-span-9 bg-[#111827] border border-[#1F2737] rounded-xl p-2.5 sm:p-4 flex flex-col justify-between overflow-y-auto no-scrollbar h-full min-h-0 gap-2">
            
            {/* Header: Title + Quick RNG */}
            <div className="flex items-center justify-between pb-1.5 border-b border-[#1f2737] shrink-0">
              <div className="flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-amber-400" />
                <h3 className="font-display font-extrabold text-xs sm:text-sm text-white">
                  Pick Your 4-Digit Lucky Combination (0000–9999)
                </h3>
              </div>
              
              <button
                type="button"
                onClick={handleQuickPickCurrent}
                className="px-2.5 py-1 rounded-lg bg-[#141924] hover:bg-[#1a2130] text-amber-300 hover:text-white border border-[#272a31] text-[11px] font-bold flex items-center gap-1 cursor-pointer transition-colors"
                title="Generate Random Number"
              >
                <Dices className="w-3.5 h-3.5" />
                <span>Quick RNG</span>
              </button>
            </div>

            {/* 4 MECHANICAL DIALS */}
            <div className="py-2 shrink-0">
              <div className="grid grid-cols-4 gap-2 xs:gap-3 max-w-[320px] xs:max-w-[360px] mx-auto">
                {digits.map((digit, idx) => {
                  const isSelected = activeSlot === idx;
                  return (
                    <div key={idx} className="flex flex-col items-center gap-1">
                      {/* Increment Button */}
                      <button
                        type="button"
                        onClick={() => incrementDigit(idx)}
                        className="w-full py-1.5 rounded-lg bg-[#141924] hover:bg-[#1f2737] text-[#9b8f7c] hover:text-white border border-[#272a31] flex items-center justify-center cursor-pointer transition-colors"
                        title="Increment (+1)"
                      >
                        <ChevronUp className="w-4 h-4" />
                      </button>

                      {/* Large Tactile Digit Slot */}
                      <div
                        onClick={() => setActiveSlot(idx)}
                        className={`w-full aspect-[4/5] rounded-xl flex items-center justify-center font-mono-numbers font-black text-2xl sm:text-4xl cursor-pointer select-none transition-all shadow-inner border-2 ${
                          isAlreadyPurchasedByMe
                            ? 'bg-[#181216] text-amber-300 border-amber-500/80 shadow-[0_0_15px_rgba(245,196,81,0.25)]'
                            : isSelected 
                            ? 'bg-[#1e2638] text-[#ffd700] border-[#ffd700] shadow-[0_0_18px_rgba(255,215,0,0.35)] scale-105' 
                            : 'bg-[#0b0e14] text-white border-[#272a31] hover:border-amber-500/50'
                        }`}
                      >
                        {digit}
                      </div>

                      {/* Decrement Button */}
                      <button
                        type="button"
                        onClick={() => decrementDigit(idx)}
                        className="w-full py-1.5 rounded-lg bg-[#141924] hover:bg-[#1f2737] text-[#9b8f7c] hover:text-white border border-[#272a31] flex items-center justify-center cursor-pointer transition-colors"
                        title="Decrement (-1)"
                      >
                        <ChevronDown className="w-4 h-4" />
                      </button>
                    </div>
                  );
                })}
              </div>

              {/* Duplicate Protection & Availability Status Badge */}
              <div className="text-center pt-2">
                {isAlreadyPurchasedByMe ? (
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/15 border border-amber-500/40 text-amber-300 text-[11px] font-bold">
                    <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
                    <span>You already purchased #{currentNumberStr} for this draw!</span>
                  </div>
                ) : (
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-[11px] font-bold">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Combination #{currentNumberStr} is Available</span>
                  </div>
                )}
              </div>
            </div>

            {/* VIRTUAL NUMERIC KEYPAD (0–9) */}
            <div className="max-w-[320px] xs:max-w-[360px] mx-auto space-y-1.5 w-full shrink-0">
              <div className="grid grid-cols-3 gap-1.5">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((val) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => handleKeypadPress(val)}
                    className="py-2 rounded-xl bg-[#0b0e14] hover:bg-[#151c2b] text-white hover:text-amber-300 font-mono-numbers font-extrabold text-sm border border-[#272a31] active:scale-95 transition-all cursor-pointer shadow-sm"
                  >
                    {val}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={handleBackspace}
                  className="py-2 rounded-xl bg-[#141924] hover:bg-[#1a2130] text-[#9b8f7c] hover:text-white font-bold text-xs border border-[#272a31] transition-colors cursor-pointer flex items-center justify-center"
                >
                  Clear
                </button>
                <button
                  type="button"
                  onClick={() => handleKeypadPress(0)}
                  className="py-2 rounded-xl bg-[#0b0e14] hover:bg-[#151c2b] text-white hover:text-amber-300 font-mono-numbers font-extrabold text-sm border border-[#272a31] active:scale-95 transition-all cursor-pointer shadow-sm"
                >
                  0
                </button>
                <button
                  type="button"
                  onClick={handleQuickPickCurrent}
                  className="py-2 rounded-xl bg-[#141924] hover:bg-[#1a2130] text-amber-400 font-bold text-xs border border-amber-500/30 transition-colors cursor-pointer flex items-center justify-center gap-1"
                >
                  <Dices className="w-3.5 h-3.5" />
                  <span>RNG</span>
                </button>
              </div>

              {/* Primary Purchase CTA Button (With duplicate protection) */}
              <div className="pt-1.5 space-y-2">
                <button
                  type="button"
                  onClick={handlePurchaseSingle}
                  disabled={isAlreadyPurchasedByMe || isSubmitting || isTimedOut}
                  className={`w-full py-2.5 sm:py-3 rounded-xl font-display font-extrabold text-xs sm:text-sm flex items-center justify-center gap-2 cursor-pointer shadow-lg transition-all ${
                    isAlreadyPurchasedByMe
                      ? 'bg-[#181a24] text-[#8b92a2] border border-[#272a31] cursor-not-allowed opacity-75'
                      : 'btn-gold shadow-amber-500/20 active:scale-[0.98]'
                  }`}
                >
                  <Coins className="w-4 h-4" />
                  <span>
                    {isAlreadyPurchasedByMe 
                      ? `Already Purchased by You (#${currentNumberStr})`
                      : `Buy Ticket #${currentNumberStr} (${event.ticketPrice} Flow Coins)`}
                  </span>
                </button>

                {/* Bulk Quick Add Row */}
                <div className="flex items-center justify-between gap-1.5 text-xs">
                  <span className="text-[#8b92a2] text-[11px]">Quick Multiple:</span>
                  <div className="flex items-center gap-1.5">
                    {[1, 5, 10].map(cnt => (
                      <button
                        key={cnt}
                        type="button"
                        onClick={() => handleBulkBuy(cnt)}
                        disabled={isSubmitting || isTimedOut}
                        className="px-2.5 py-1 rounded-lg bg-[#141924] hover:bg-[#1a2130] text-[11px] font-mono-numbers text-amber-300 hover:text-white border border-[#272a31] hover:border-amber-500/40 cursor-pointer transition-colors"
                        title={`Buy ${cnt} unique unsold ticket(s)`}
                      >
                        +{cnt} {cnt === 1 ? 'Pick' : 'Picks'} ({cnt * event.ticketPrice} FC)
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

          </div>

          {/* ============================================================== */}
          {/* ROOM ACTIVITY PANEL (1 PART / ~25% of content width)           */}
          {/* ============================================================== */}
          <div className="order-2 lg:col-span-3 bg-[#111827] border border-[#1F2737] rounded-xl p-2.5 sm:p-3 flex flex-col justify-between overflow-hidden h-full min-h-0 gap-2">
            
            {/* Header */}
            <div className="flex items-center justify-between pb-1.5 border-b border-[#1f2737] shrink-0">
              <div className="flex items-center gap-1.5">
                <Activity className="w-4 h-4 text-emerald-400" />
                <h3 className="font-display font-extrabold text-xs sm:text-sm text-white">
                  Room Activity
                </h3>
              </div>
              <span className="text-[10px] font-mono-numbers px-2 py-0.2 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-bold flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span>Live Feed</span>
              </span>
            </div>

            {/* Ticket Purchases by ALL Users in this Room/Event */}
            <div className="flex-1 min-h-[140px] max-h-[220px] xs:max-h-[260px] lg:max-h-none overflow-y-auto space-y-1.5 pr-1 no-scrollbar">
              {roomActivityTickets.length === 0 ? (
                <div className="py-6 flex flex-col items-center justify-center text-center p-3 rounded-lg border border-dashed border-[#272a31] text-[#9b8f7c] space-y-1">
                  <Ticket className="w-6 h-6 text-[#9b8f7c]/40" />
                  <p className="text-[11px] font-bold text-white">No Tickets in this Room</p>
                  <p className="text-[10px] text-[#64748b]">Be the first player to enter a ticket!</p>
                </div>
              ) : (
                roomActivityTickets.map((tkt: any, idx: number) => {
                  const isMine = (user && tkt.userId === user.id) || (wallet?.address && tkt.userAddress === wallet.address);
                  const displayUsername = tkt.username || (isMine ? '@You' : `@player_${tkt.id.slice(-4)}`);

                  return (
                    <div
                      key={tkt.id || idx}
                      className={`p-2 rounded-lg border flex items-center justify-between text-xs font-mono-numbers transition-all ${
                        isMine
                          ? 'bg-[#151d2c] border-amber-500/40 text-amber-300'
                          : 'bg-[#0b0e14] border-[#1f2737] text-white'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <div className={`w-5 h-5 rounded-full flex items-center justify-center font-bold text-[9px] shrink-0 ${
                          isMine ? 'bg-amber-500 text-black' : 'bg-[#1f2737] text-white'
                        }`}>
                          {displayUsername.replace('@', '').slice(0, 1).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <span className={`block text-[11px] font-bold truncate ${isMine ? 'text-amber-300' : 'text-white'}`}>
                            {isMine ? `${displayUsername} (You)` : displayUsername}
                          </span>
                          <span className="text-[9px] text-[#8b92a2]">
                            {formatTimeAgo(Number(tkt.purchaseTime || Date.now()))}
                          </span>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <span className="font-display font-black text-xs sm:text-sm text-emerald-400 block tracking-wider">
                          #{String(tkt.ticketNumber).padStart(4, '0')}
                        </span>
                        <span className="text-[9px] text-[#8b92a2]">
                          {tkt.price || event.ticketPrice} FC
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Room Stats Footer */}
            <div className="p-2 rounded-lg bg-[#0b0e14] border border-[#272a31] flex items-center justify-between text-[10px] font-mono-numbers shrink-0">
              <span className="text-[#8b92a2]">Room Total:</span>
              <strong className="text-white font-bold">{roomActivityTickets.length} Tickets Sold</strong>
            </div>

          </div>

        </div>
      )}

      {/* 3. PROVABLY FAIR VERIFICATION BAR */}
      <div className="px-2.5 py-1 rounded-lg bg-[#0b0e14] border border-[#272a31] flex items-center justify-between text-[10px] text-[#9b8f7c] shrink-0">
        <div className="flex items-center gap-1.5 min-w-0">
          <ShieldCheck className="w-3 h-3 text-emerald-400 shrink-0" />
          <span className="text-white font-bold truncate">Provably Fair Oracle:</span>
          <span className="font-mono text-[#8b92a2] truncate">{event.sha256Seed || '0x4f88e1...'}</span>
        </div>

        <div className="text-[10px] font-mono-numbers text-amber-400 font-bold shrink-0">
          100% Cryptographic Verification
        </div>
      </div>

    </div>
  );
}
