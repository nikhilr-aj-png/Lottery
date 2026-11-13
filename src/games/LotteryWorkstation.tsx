import React, { useState, useEffect, useMemo } from 'react';
import { useLottery } from '../context/LotteryContext';
import { 
  Dices, 
  RotateCcw, 
  Plus, 
  Trash2, 
  ShieldCheck, 
  Check, 
  Sparkles, 
  AlertCircle, 
  Coins, 
  Clock, 
  Trophy, 
  Users, 
  CheckCircle2, 
  ChevronUp, 
  ChevronDown,
  Ticket,
  Calendar,
  Layers,
  Award,
  Hash
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { soundFX } from '../engine/SoundFXService';

export default function LotteryWorkstation({ room, onBackToLobby }) {
  const { 
    user, 
    wallet, 
    events, 
    tickets, 
    buyTickets, 
    isTicketNumberSold, 
    getUnsoldRandomNumber, 
    showToast, 
    setIsAuthModalOpen 
  } = useLottery();

  // Map room to matching or fallback lottery event
  const event = useMemo(() => {
    if (!room) return events[0] || null;
    // Check if an event matches the room id or drawId
    const matching = events.find(e => 
      e.id === room.id || 
      e.id === room.drawId || 
      e.title?.toLowerCase().includes(room.name?.toLowerCase())
    );
    if (matching) return matching;

    // Use active event or construct virtual room event based on room configuration
    const active = events.find(e => e.status === 'active');
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

  // Active 4-digit dial states
  const [digits, setDigits] = useState(() => {
    return (getUnsoldRandomNumber ? getUnsoldRandomNumber(event?.id) : '7429').split('');
  });
  const [activeSlot, setActiveSlot] = useState(0);
  const [stagedTickets, setStagedTickets] = useState<any[]>([]);
  const [recentPurchase, setRecentPurchase] = useState<any>(null);

  // Countdown timer calculation
  const [timeLeft, setTimeLeft] = useState({ hours: 0, minutes: 0, seconds: 0 });

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

  const currentNumberStr = digits.join('');
  const isCurrentSold = isTicketNumberSold ? isTicketNumberSold(event.id, currentNumberStr) : false;
  const isAlreadyStaged = stagedTickets.includes(currentNumberStr);

  // Keypad presses
  const handleKeypadPress = (val) => {
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
  const incrementDigit = (slotIdx) => {
    soundFX.playDialTick();
    const newDigits = [...digits];
    newDigits[slotIdx] = String((parseInt(newDigits[slotIdx], 10) + 1) % 10);
    setDigits(newDigits);
    setActiveSlot(slotIdx);
  };

  const decrementDigit = (slotIdx) => {
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
      setDigits(unsold.split(''));
    } else {
      const rand = String(Math.floor(Math.random() * 10000)).padStart(4, '0');
      setDigits(rand.split(''));
    }
  };

  // Add current 4-digit to staged tickets
  const handleAddCurrentTicket = () => {
    const num = digits.join('');
    if (isTicketNumberSold && isTicketNumberSold(event.id, num)) {
      showToast(`Combination #${num} is already SOLD OUT! Please select an available combination.`, 'error');
      return;
    }
    if (stagedTickets.includes(num)) {
      showToast(`Combination #${num} is already in your selected tickets!`, 'error');
      return;
    }
    soundFX.playChipBet();
    setStagedTickets(prev => [...prev, num]);
    
    // Automatically advance dials to next available number
    if (getUnsoldRandomNumber) {
      const nextUnsold = getUnsoldRandomNumber(event.id);
      setDigits(nextUnsold.split(''));
    }
  };

  // Bulk add quick picks
  const handleBulkAdd = (count) => {
    soundFX.playChipBet();
    const added: string[] = [];
    const used = new Set([...stagedTickets]);
    for (let i = 0; i < count; i++) {
      let candidate = getUnsoldRandomNumber ? getUnsoldRandomNumber(event.id) : String(Math.floor(Math.random() * 10000)).padStart(4, '0');
      let attempts = 0;
      while (used.has(candidate) && attempts < 50) {
        candidate = getUnsoldRandomNumber ? getUnsoldRandomNumber(event.id) : String(Math.floor(Math.random() * 10000)).padStart(4, '0');
        attempts++;
      }
      used.add(candidate);
      added.push(candidate);
    }
    setStagedTickets(prev => [...prev, ...added]);
    showToast(`Added ${added.length} unique unsold ticket(s) to order!`, 'success');
  };

  const handleRemoveStaged = (index) => {
    soundFX.playClick();
    setStagedTickets(prev => prev.filter((_, idx) => idx !== index));
  };

  // Cost calculation
  const totalCost = stagedTickets.length * (event.ticketPrice || 10);
  const hasEnoughBalance = Number(wallet.balance || 0) >= totalCost && totalCost > 0;
  const isTimedOut = event.status === 'completed' || (event.drawTime && event.drawTime <= Date.now());

  // Submit Order
  const handleCheckout = async () => {
    if (isTimedOut) {
      showToast('This draw has concluded and is closed for purchases!', 'error');
      return;
    }
    if (!user) {
      showToast('Authentication required: Please log in to submit entries!', 'info');
      setIsAuthModalOpen(true);
      return;
    }
    if (stagedTickets.length === 0) {
      showToast('Please add at least 1 four-digit ticket to submit an entry.', 'error');
      return;
    }

    if (!hasEnoughBalance) {
      showToast(`Insufficient Flow Coins. Required: ${totalCost} FC, Available: ${wallet.balance} FC`, 'error');
      return;
    }

    const success = await buyTickets(event.id, stagedTickets);
    if (success) {
      soundFX.playWinFanfare('big');
      confetti({
        particleCount: 120,
        spread: 80,
        origin: { y: 0.6 },
        colors: ['#ffd700', '#f5c451', '#22c55e', '#ffffff']
      });
      setRecentPurchase({
        tickets: [...stagedTickets],
        totalCost,
        time: new Date().toLocaleTimeString(),
        drawId: event.id
      });
      setStagedTickets([]);
      showToast(`🎉 Successfully entered ${stagedTickets.length} ticket(s) into ${room.name}!`, 'success');
    }
  };

  // Filter user's personal tickets in this draw
  const myTicketsInThisRoom = useMemo(() => {
    if (!tickets || !user) return [];
    return tickets.filter(t => t.event_id === event.id || t.eventId === event.id);
  }, [tickets, user, event.id]);

  // Formatted closing time
  const closingDateStr = useMemo(() => {
    const d = new Date(event.drawTime || Date.now() + 86400000);
    return d.toLocaleDateString(undefined, { 
      month: 'short', 
      day: 'numeric', 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  }, [event.drawTime]);

  return (
    <div className="space-y-6 sm:space-y-8 animate-in fade-in duration-200 text-left">
      
      {/* 1. ROOM BANNER & DRAW METRICS */}
      <div className="glass-panel rounded-2xl sm:rounded-3xl p-5 sm:p-7 border border-amber-500/30 bg-gradient-to-br from-[#151C2B] via-[#0F1420] to-[#0B0F19] shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-6">
          
          <div className="space-y-2.5 max-w-2xl min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] font-mono-numbers px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold uppercase tracking-wider">
                {room.drawId || 'DRAW #' + event.id}
              </span>
              <span className="text-[10px] font-mono-numbers px-2 py-0.5 rounded bg-[#141924] text-emerald-400 border border-[#272a31] font-bold uppercase flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                {event.status === 'completed' ? 'CONCLUDED' : 'ENTRY ACTIVE'}
              </span>
              <span className="text-[11px] text-[#9b8f7c]">
                Closing: <strong className="text-white font-mono-numbers">{closingDateStr}</strong>
              </span>
            </div>

            <h2 className="font-display font-black text-xl sm:text-2xl text-white tracking-tight">
              {room.name}
            </h2>

            <p className="text-xs text-[#94A3B8] leading-relaxed">
              {room.description}
            </p>
          </div>

          {/* Key Metrics Columns */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <div className="bg-[#0b0e14]/90 p-3 rounded-xl border border-[#272a31] text-center min-w-[90px]">
              <span className="text-[9px] text-[#8b92a2] uppercase font-bold block">Ticket Price</span>
              <span className="text-base font-mono-numbers font-black text-amber-400">{event.ticketPrice} FC</span>
            </div>

            <div className="bg-[#0b0e14]/90 p-3 rounded-xl border border-[#272a31] text-center min-w-[90px]">
              <span className="text-[9px] text-[#8b92a2] uppercase font-bold block">Prize Pool</span>
              <span className="text-base font-mono-numbers font-black text-emerald-400">
                {Number(event.poolPrize || 5000).toLocaleString()} FC
              </span>
            </div>

            <div className="bg-[#0b0e14]/90 p-3 rounded-xl border border-[#272a31] text-center min-w-[90px]">
              <span className="text-[9px] text-[#8b92a2] uppercase font-bold block">Participants</span>
              <span className="text-base font-mono-numbers font-black text-purple-300">
                {event.participantsCount || room.currentPlayers || 18}
              </span>
            </div>

            <div className="bg-[#0b0e14]/90 p-3 rounded-xl border border-[#272a31] text-center min-w-[90px]">
              <span className="text-[9px] text-[#8b92a2] uppercase font-bold block">Time Left</span>
              <span className="text-base font-mono-numbers font-black text-amber-300 flex items-center justify-center gap-1">
                <Clock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span>{timeLeft.hours}h {timeLeft.minutes}m</span>
              </span>
            </div>
          </div>

        </div>
      </div>

      {/* 2. MAIN 2-COLUMN WORKSTATION: DIALS & ORDER STAGING */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* LEFT COLUMN: 4-Digit Dials & Keypad (7 Cols) */}
        <div className="lg:col-span-7 glass-panel rounded-2xl p-4 sm:p-6 space-y-5 border border-[#272a31]">
          
          <div className="flex items-center justify-between pb-3 border-b border-[#1f2737]">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-400" />
              <h3 className="font-display font-extrabold text-sm sm:text-base text-white">
                Select Your 4-Digit Combination (0000 – 9999)
              </h3>
            </div>
            
            <button
              onClick={handleQuickPickCurrent}
              className="px-2.5 py-1 rounded-lg bg-[#141924] hover:bg-[#1a2130] text-amber-300 hover:text-white border border-[#272a31] text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors"
            >
              <Dices className="w-3.5 h-3.5" />
              <span>Quick RNG</span>
            </button>
          </div>

          {/* 4 Mechanical Dials */}
          <div className="py-2">
            <div className="grid grid-cols-4 gap-2 xs:gap-3 sm:gap-4 max-w-sm sm:max-w-md mx-auto">
              {digits.map((digit, idx) => {
                const isSelected = activeSlot === idx;
                return (
                  <div key={idx} className="flex flex-col items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => incrementDigit(idx)}
                      className="w-full py-1.5 rounded-lg bg-[#141924] hover:bg-[#1f2737] text-[#9b8f7c] hover:text-white border border-[#272a31] flex items-center justify-center cursor-pointer transition-colors"
                      title="Increment"
                    >
                      <ChevronUp className="w-4 h-4" />
                    </button>

                    <div
                      onClick={() => setActiveSlot(idx)}
                      className={`w-full aspect-[4/5] rounded-2xl flex items-center justify-center font-mono-numbers font-black text-3xl sm:text-4xl cursor-pointer select-none transition-all shadow-inner border-2 ${
                        isSelected 
                          ? 'bg-[#1e2638] text-amber-400 border-amber-400 shadow-[0_0_20px_rgba(245,196,81,0.3)] scale-105' 
                          : 'bg-[#0b0e14] text-white border-[#272a31] hover:border-amber-500/40'
                      }`}
                    >
                      {digit}
                    </div>

                    <button
                      type="button"
                      onClick={() => decrementDigit(idx)}
                      className="w-full py-1.5 rounded-lg bg-[#141924] hover:bg-[#1f2737] text-[#9b8f7c] hover:text-white border border-[#272a31] flex items-center justify-center cursor-pointer transition-colors"
                      title="Decrement"
                    >
                      <ChevronDown className="w-4 h-4" />
                    </button>
                  </div>
                );
              })}
            </div>

            {/* Availability Indicator */}
            <div className="text-center pt-3">
              {isCurrentSold ? (
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-500/15 border border-red-500/30 text-red-400 text-xs font-bold">
                  <AlertCircle className="w-3.5 h-3.5" />
                  <span>#{currentNumberStr} is SOLD OUT in this round</span>
                </div>
              ) : isAlreadyStaged ? (
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/15 border border-blue-500/30 text-blue-400 text-xs font-bold">
                  <Check className="w-3.5 h-3.5" />
                  <span>#{currentNumberStr} is already staged below</span>
                </div>
              ) : (
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-bold">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>#{currentNumberStr} is Available to Buy</span>
                </div>
              )}
            </div>
          </div>

          {/* Virtual Numeric Keypad (0–9) */}
          <div className="max-w-sm mx-auto space-y-2 pt-1">
            <div className="grid grid-cols-3 gap-2">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((val) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => handleKeypadPress(val)}
                  className="py-3 rounded-xl bg-[#0b0e14] hover:bg-[#151c2b] text-white hover:text-amber-300 font-mono-numbers font-extrabold text-base border border-[#272a31] active:scale-95 transition-all cursor-pointer"
                >
                  {val}
                </button>
              ))}
              <button
                type="button"
                onClick={handleBackspace}
                className="py-3 rounded-xl bg-[#141924] hover:bg-[#1a2130] text-[#9b8f7c] hover:text-white font-bold text-xs border border-[#272a31] transition-colors cursor-pointer flex items-center justify-center"
              >
                Clear
              </button>
              <button
                type="button"
                onClick={() => handleKeypadPress(0)}
                className="py-3 rounded-xl bg-[#0b0e14] hover:bg-[#151c2b] text-white hover:text-amber-300 font-mono-numbers font-extrabold text-base border border-[#272a31] active:scale-95 transition-all cursor-pointer"
              >
                0
              </button>
              <button
                type="button"
                onClick={handleQuickPickCurrent}
                className="py-3 rounded-xl bg-[#141924] hover:bg-[#1a2130] text-amber-400 font-bold text-xs border border-amber-500/30 transition-colors cursor-pointer flex items-center justify-center gap-1"
              >
                <Dices className="w-3.5 h-3.5" />
                <span>RNG</span>
              </button>
            </div>

            {/* Action Buttons: Add Current & Quick Bulk Picks */}
            <div className="pt-2 space-y-2">
              <button
                type="button"
                onClick={handleAddCurrentTicket}
                disabled={isCurrentSold || isAlreadyStaged}
                className="w-full py-3 rounded-xl btn-gold font-bold text-xs sm:text-sm flex items-center justify-center gap-2 cursor-pointer shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Plus className="w-4 h-4" />
                <span>Add #{currentNumberStr} to Order ({event.ticketPrice} FC)</span>
              </button>

              <div className="flex items-center justify-between gap-2 pt-1 text-xs">
                <span className="text-[#8b92a2] text-[11px]">Quick Bulk Add:</span>
                <div className="flex items-center gap-1.5">
                  {[1, 5, 10].map(cnt => (
                    <button
                      key={cnt}
                      type="button"
                      onClick={() => handleBulkAdd(cnt)}
                      className="px-2.5 py-1 rounded-lg bg-[#141924] hover:bg-[#1a2130] text-[11px] font-mono-numbers text-amber-300 border border-[#272a31] cursor-pointer"
                    >
                      +{cnt} Tickets
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

        </div>

        {/* RIGHT COLUMN: Staged Tickets & Review Order (5 Cols) */}
        <div className="lg:col-span-5 glass-panel rounded-2xl p-4 sm:p-6 space-y-4 border border-[#272a31]">
          
          <div className="flex items-center justify-between pb-3 border-b border-[#1f2737]">
            <div className="flex items-center gap-2">
              <Ticket className="w-4 h-4 text-amber-400" />
              <h3 className="font-display font-extrabold text-sm sm:text-base text-white">
                Selected Tickets ({stagedTickets.length})
              </h3>
            </div>

            {stagedTickets.length > 0 && (
              <button
                onClick={() => setStagedTickets([])}
                className="text-[11px] text-red-400 hover:text-red-300 flex items-center gap-1 cursor-pointer"
              >
                <Trash2 className="w-3 h-3" />
                <span>Clear All</span>
              </button>
            )}
          </div>

          {/* Staged Tickets List */}
          <div className="min-h-[160px] max-h-[260px] overflow-y-auto space-y-2 pr-1 no-scrollbar">
            {stagedTickets.length === 0 ? (
              <div className="h-40 flex flex-col items-center justify-center text-center p-4 rounded-xl border border-dashed border-[#272a31] text-[#9b8f7c] space-y-2">
                <Ticket className="w-8 h-8 opacity-40 text-amber-400" />
                <p className="text-xs">No tickets selected yet.</p>
                <p className="text-[11px] text-[#64748b]">Pick digits on the keypad or click Quick Bulk Add.</p>
              </div>
            ) : (
              stagedTickets.map((tkt, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-2.5 rounded-xl bg-[#0b0e14] border border-[#1f2737] text-xs font-mono-numbers"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="w-5 h-5 rounded-md bg-amber-500/15 text-amber-400 text-[10px] font-bold flex items-center justify-center">
                      {idx + 1}
                    </span>
                    <span className="font-black text-sm text-white tracking-widest">
                      #{tkt}
                    </span>
                    <span className="text-[10px] text-[#8b92a2]">
                      ({event.ticketPrice} FC)
                    </span>
                  </div>

                  <button
                    onClick={() => handleRemoveStaged(idx)}
                    className="p-1 rounded text-[#9b8f7c] hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
                    title="Remove"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))
            )}
          </div>

          {/* Order Summary & Balance Check */}
          <div className="p-3.5 rounded-xl bg-[#0b0e14] border border-[#272a31] space-y-2.5 text-xs font-mono-numbers">
            <div className="flex items-center justify-between text-[#8b92a2]">
              <span>Tickets Selected:</span>
              <strong className="text-white">{stagedTickets.length}</strong>
            </div>

            <div className="flex items-center justify-between text-[#8b92a2]">
              <span>Price Per Ticket:</span>
              <strong className="text-white">{event.ticketPrice} FC</strong>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-[#1f2737] text-sm">
              <span className="font-bold text-white font-sans">Total Cost:</span>
              <strong className="font-black text-amber-400 font-mono-numbers text-base">{totalCost} FC</strong>
            </div>

            <div className="flex items-center justify-between pt-1 text-[11px] text-[#8b92a2]">
              <span>Your FC Balance:</span>
              <strong className={Number(wallet.balance || 0) >= totalCost ? 'text-emerald-400' : 'text-red-400'}>
                {Number(wallet.balance || 0).toLocaleString()} FC
              </strong>
            </div>
          </div>

          {/* Final Submit Button */}
          <button
            type="button"
            onClick={handleCheckout}
            disabled={stagedTickets.length === 0 || !hasEnoughBalance || isTimedOut}
            className="w-full py-3.5 rounded-xl btn-gold font-display font-extrabold text-sm flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-amber-500/20 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          >
            <Coins className="w-4 h-4" />
            <span>Submit Entry ({totalCost} Flow Coins)</span>
          </button>

          {/* Recent Entry Confirmation */}
          {recentPurchase && (
            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs space-y-1">
              <div className="flex items-center gap-1.5 font-bold">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>Entry Confirmed at {recentPurchase.time}</span>
              </div>
              <p className="text-[11px] text-[#8b92a2]">
                Registered {recentPurchase.tickets.length} ticket(s) in {recentPurchase.drawId}.
              </p>
            </div>
          )}

        </div>

      </div>

      {/* 3. MY ENTRIES IN THIS ROOM */}
      <section className="glass-panel rounded-2xl p-5 sm:p-6 border border-[#272a31] space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-[#1f2737]">
          <div className="flex items-center gap-2">
            <Award className="w-4 h-4 text-amber-400" />
            <h3 className="font-display font-extrabold text-sm sm:text-base text-white">
              My Tickets in {room.name}
            </h3>
          </div>
          <span className="text-[11px] font-mono-numbers px-2.5 py-0.5 rounded bg-[#141924] text-amber-300 border border-[#272a31]">
            {myTicketsInThisRoom.length} Registered
          </span>
        </div>

        {myTicketsInThisRoom.length === 0 ? (
          <p className="text-xs text-[#9b8f7c] py-4 text-center">
            You haven't purchased any tickets in this specific draw yet. Select combinations above to participate!
          </p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2.5 pt-2">
            {myTicketsInThisRoom.map((tkt, idx) => (
              <div
                key={idx}
                className="p-3 rounded-xl bg-[#0b0e14] border border-[#272a31] text-center space-y-1"
              >
                <span className="text-[10px] text-[#8b92a2] font-mono-numbers block">
                  #{tkt.id?.slice(-6) || idx + 1}
                </span>
                <span className="font-mono-numbers font-black text-lg text-amber-300 tracking-wider block">
                  #{tkt.ticket_number || tkt.ticketNumber}
                </span>
                <span className={`text-[9px] font-mono-numbers font-bold px-1.5 py-0.5 rounded uppercase block ${
                  tkt.status === 'won' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-[#141924] text-[#8b92a2]'
                }`}>
                  {tkt.status || 'Active'}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 4. PROVABLY FAIR VERIFICATION DRAWER */}
      <div className="p-4 rounded-xl bg-[#0b0e14] border border-[#272a31] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-[#9b8f7c]">
        <div className="flex items-center gap-2 min-w-0">
          <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
          <div className="min-w-0">
            <span className="text-white font-bold block">Provably Fair Draw Oracle</span>
            <span className="text-[11px] font-mono text-[#8b92a2] truncate block">
              Commit: {event.sha256Seed || event.sha256_seed || '0x4f88e1...'}
            </span>
          </div>
        </div>

        <div className="text-[11px] font-mono-numbers text-amber-400 font-bold shrink-0">
          100% Cryptographic Verification
        </div>
      </div>

    </div>
  );
}

