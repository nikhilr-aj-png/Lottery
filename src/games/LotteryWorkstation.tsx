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
  Hash,
  ArrowLeft
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { soundFX } from '../engine/SoundFXService';

export default function LotteryWorkstation({ room, onBackToLobby, activityBox }: { room?: any; onBackToLobby?: () => void; activityBox?: React.ReactNode; }) {
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
    <div className="w-full h-full flex flex-col min-h-0 overflow-hidden text-left space-y-1.5 sm:space-y-2">
      
      {/* 1. COMPACT IN-ROOM BANNER & DRAW METRICS */}
      <div className="glass-panel rounded-xl p-2 sm:px-3 sm:py-2 border border-amber-500/30 bg-gradient-to-r from-[#151C2B] via-[#0F1420] to-[#0B0F19] shadow-md flex flex-col md:flex-row items-stretch md:items-center justify-between gap-1.5 sm:gap-3 shrink-0">
        
        {/* Left: Back to Lobby + Room Name + Draw Badge */}
        <div className="flex items-center gap-2 min-w-0">
          {onBackToLobby && (
            <button
              onClick={onBackToLobby}
              className="px-2 py-0.5 rounded-lg bg-[#141924] hover:bg-[#1a2130] text-[#9b8f7c] hover:text-white border border-[#272a31] text-[11px] font-bold flex items-center gap-1 cursor-pointer transition-colors shrink-0"
              title="Return to Lottery Lobby"
            >
              <ArrowLeft className="w-3 h-3 text-amber-400" />
              <span className="hidden xs:inline">Lobby</span>
            </button>
          )}

          <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
            <h2 className="font-display font-extrabold text-xs sm:text-sm text-white truncate">
              {room.name}
            </h2>
            <span className="text-[9px] font-mono-numbers px-1.5 py-0.2 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold uppercase shrink-0">
              {room.drawId || 'DRAW #' + event.id}
            </span>
            <span className="text-[9px] font-mono-numbers px-1.5 py-0.2 rounded bg-[#141924] text-emerald-400 border border-[#272a31] font-bold uppercase flex items-center gap-1 shrink-0">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              {event.status === 'completed' ? 'CONCLUDED' : 'ACTIVE'}
            </span>
          </div>
        </div>

        {/* Right: Inline Compact Metrics Strip (Price, Pool, Players, Time) */}
        <div className="flex items-center gap-1.5 text-[10px] sm:text-[11px] font-mono-numbers overflow-x-auto no-scrollbar shrink-0">
          <div className="bg-[#0b0e14] px-2 py-0.5 rounded border border-[#272a31] flex items-center gap-1 shrink-0">
            <span className="text-[#8b92a2]">Price:</span>
            <strong className="text-amber-400 font-bold">{event.ticketPrice} FC</strong>
          </div>

          <div className="bg-[#0b0e14] px-2 py-0.5 rounded border border-[#272a31] flex items-center gap-1 shrink-0">
            <span className="text-[#8b92a2]">Pool:</span>
            <strong className="text-emerald-400 font-bold">{Number(event.poolPrize || 5000).toLocaleString()} FC</strong>
          </div>

          <div className="bg-[#0b0e14] px-2 py-0.5 rounded border border-[#272a31] flex items-center gap-1 shrink-0">
            <span className="text-[#8b92a2]">Players:</span>
            <strong className="text-purple-300 font-bold">{event.participantsCount || room.currentPlayers || 18}</strong>
          </div>

          <div className="bg-[#0b0e14] px-2 py-0.5 rounded border border-[#272a31] flex items-center gap-1 text-amber-300 font-bold shrink-0">
            <Clock className="w-3 h-3 text-amber-400" />
            <span>{timeLeft.hours}h {timeLeft.minutes}m</span>
          </div>
        </div>

      </div>

      {/* 2. MAIN 2-COLUMN WORKSTATION: DIALS & ORDER STAGING */}
      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 gap-2 sm:gap-3 overflow-hidden">
        
        {/* LEFT COLUMN: 4-Digit Dials & Keypad (7 Cols) */}
        <div className="order-1 lg:col-span-7 bg-[#111827] border border-[#1F2737] rounded-xl p-2 sm:p-2.5 flex flex-col justify-between overflow-hidden h-full min-h-0 gap-1.5">
          
          <div className="flex items-center justify-between pb-1 border-b border-[#1f2737] shrink-0">
            <div className="flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <h3 className="font-display font-extrabold text-xs sm:text-sm text-white">
                Select Your 4-Digit Combination (0000–9999)
              </h3>
            </div>
            
            <button
              type="button"
              onClick={handleQuickPickCurrent}
              className="px-2 py-0.5 rounded-lg bg-[#141924] hover:bg-[#1a2130] text-amber-300 hover:text-white border border-[#272a31] text-[10px] font-bold flex items-center gap-1 cursor-pointer transition-colors"
            >
              <Dices className="w-3 h-3" />
              <span>Quick RNG</span>
            </button>
          </div>

          {/* 4 Mechanical Dials */}
          <div className="py-1 shrink-0">
            <div className="grid grid-cols-4 gap-1.5 xs:gap-2 max-w-[280px] xs:max-w-[320px] mx-auto">
              {digits.map((digit, idx) => {
                const isSelected = activeSlot === idx;
                return (
                  <div key={idx} className="flex flex-col items-center gap-1">
                    <button
                      type="button"
                      onClick={() => incrementDigit(idx)}
                      className="w-full py-1 rounded bg-[#141924] hover:bg-[#1f2737] text-[#9b8f7c] hover:text-white border border-[#272a31] flex items-center justify-center cursor-pointer transition-colors"
                      title="Increment"
                    >
                      <ChevronUp className="w-3.5 h-3.5" />
                    </button>

                    <div
                      onClick={() => setActiveSlot(idx)}
                      className={`w-full aspect-[4/5] rounded-xl flex items-center justify-center font-mono-numbers font-black text-2xl sm:text-3xl cursor-pointer select-none transition-all shadow-inner border-2 ${
                        isSelected 
                          ? 'bg-[#1e2638] text-amber-400 border-amber-400 shadow-[0_0_15px_rgba(245,196,81,0.3)] scale-105' 
                          : 'bg-[#0b0e14] text-white border-[#272a31] hover:border-amber-500/40'
                      }`}
                    >
                      {digit}
                    </div>

                    <button
                      type="button"
                      onClick={() => decrementDigit(idx)}
                      className="w-full py-1 rounded bg-[#141924] hover:bg-[#1f2737] text-[#9b8f7c] hover:text-white border border-[#272a31] flex items-center justify-center cursor-pointer transition-colors"
                      title="Decrement"
                    >
                      <ChevronDown className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>

            {/* Availability Indicator */}
            <div className="text-center pt-1.5">
              {isCurrentSold ? (
                <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-red-500/15 border border-red-500/30 text-red-400 text-[10px] font-bold">
                  <AlertCircle className="w-3 h-3" />
                  <span>#{currentNumberStr} is SOLD OUT in this round</span>
                </div>
              ) : isAlreadyStaged ? (
                <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-blue-500/15 border border-blue-500/30 text-blue-400 text-[10px] font-bold">
                  <Check className="w-3 h-3" />
                  <span>#{currentNumberStr} is already staged</span>
                </div>
              ) : (
                <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-[10px] font-bold">
                  <CheckCircle2 className="w-3 h-3" />
                  <span>#{currentNumberStr} is Available</span>
                </div>
              )}
            </div>
          </div>

          {/* Virtual Numeric Keypad (0–9) */}
          <div className="max-w-[280px] xs:max-w-[320px] mx-auto space-y-1 w-full shrink-0">
            <div className="grid grid-cols-3 gap-1">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((val) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => handleKeypadPress(val)}
                  className="py-1.5 rounded-lg bg-[#0b0e14] hover:bg-[#151c2b] text-white hover:text-amber-300 font-mono-numbers font-extrabold text-xs border border-[#272a31] active:scale-95 transition-all cursor-pointer"
                >
                  {val}
                </button>
              ))}
              <button
                type="button"
                onClick={handleBackspace}
                className="py-1.5 rounded-lg bg-[#141924] hover:bg-[#1a2130] text-[#9b8f7c] hover:text-white font-bold text-[10px] border border-[#272a31] transition-colors cursor-pointer flex items-center justify-center"
              >
                Clear
              </button>
              <button
                type="button"
                onClick={() => handleKeypadPress(0)}
                className="py-1.5 rounded-lg bg-[#0b0e14] hover:bg-[#151c2b] text-white hover:text-amber-300 font-mono-numbers font-extrabold text-xs border border-[#272a31] active:scale-95 transition-all cursor-pointer"
              >
                0
              </button>
              <button
                type="button"
                onClick={handleQuickPickCurrent}
                className="py-1.5 rounded-lg bg-[#141924] hover:bg-[#1a2130] text-amber-400 font-bold text-[10px] border border-amber-500/30 transition-colors cursor-pointer flex items-center justify-center gap-1"
              >
                <Dices className="w-3 h-3" />
                <span>RNG</span>
              </button>
            </div>

            {/* Action Buttons: Add Current & Quick Bulk Picks */}
            <div className="pt-1 space-y-1">
              <button
                type="button"
                onClick={handleAddCurrentTicket}
                disabled={isCurrentSold || isAlreadyStaged}
                className="w-full py-2 rounded-lg btn-gold font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add #{currentNumberStr} to Order ({event.ticketPrice} FC)</span>
              </button>

              <div className="flex items-center justify-between gap-1 pt-0.5 text-[10px]">
                <span className="text-[#8b92a2]">Quick Add:</span>
                <div className="flex items-center gap-1">
                  {[1, 5, 10].map(cnt => (
                    <button
                      key={cnt}
                      type="button"
                      onClick={() => handleBulkAdd(cnt)}
                      className="px-2 py-0.5 rounded bg-[#141924] hover:bg-[#1a2130] text-[10px] font-mono-numbers text-amber-300 border border-[#272a31] cursor-pointer"
                    >
                      +{cnt}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

        </div>

        {/* RIGHT COLUMN: Staged Tickets & Review Order (5 Cols) */}
        <div className="order-2 lg:col-span-5 bg-[#111827] border border-[#1F2737] rounded-xl p-2 sm:p-2.5 flex flex-col justify-between overflow-hidden h-full min-h-0 gap-1.5">
          
          <div className="flex items-center justify-between pb-1 border-b border-[#1f2737] shrink-0">
            <div className="flex items-center gap-1.5">
              <Ticket className="w-3.5 h-3.5 text-amber-400" />
              <h3 className="font-display font-extrabold text-xs sm:text-sm text-white">
                Selected Tickets ({stagedTickets.length})
              </h3>
            </div>

            {stagedTickets.length > 0 && (
              <button
                type="button"
                onClick={() => setStagedTickets([])}
                className="text-[10px] text-red-400 hover:text-red-300 flex items-center gap-0.5 cursor-pointer"
              >
                <Trash2 className="w-3 h-3" />
                <span>Clear All</span>
              </button>
            )}
          </div>

          {/* Staged Tickets List */}
          <div className="max-h-[90px] xs:max-h-[110px] overflow-y-auto space-y-1 pr-1 no-scrollbar shrink-0">
            {stagedTickets.length === 0 ? (
              <div className="py-2.5 flex flex-col items-center justify-center text-center p-2 rounded-lg border border-dashed border-[#272a31] text-[#9b8f7c]">
                <p className="text-[11px]">No tickets selected yet.</p>
                <p className="text-[10px] text-[#64748b]">Pick digits on keypad or click Quick Add.</p>
              </div>
            ) : (
              stagedTickets.map((tkt, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-1.5 rounded-lg bg-[#0b0e14] border border-[#1f2737] text-xs font-mono-numbers"
                >
                  <div className="flex items-center gap-2">
                    <span className="w-4 h-4 rounded bg-amber-500/15 text-amber-400 text-[10px] font-bold flex items-center justify-center">
                      {idx + 1}
                    </span>
                    <span className="font-black text-xs text-white tracking-widest">
                      #{tkt}
                    </span>
                    <span className="text-[10px] text-[#8b92a2]">
                      ({event.ticketPrice} FC)
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleRemoveStaged(idx)}
                    className="p-0.5 rounded text-[#9b8f7c] hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
                    title="Remove"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))
            )}
          </div>

          {/* Order Summary & Submit Button */}
          <div className="space-y-1.5 shrink-0">
            <div className="p-1.5 rounded-lg bg-[#0b0e14] border border-[#272a31] flex items-center justify-between text-[11px] font-mono-numbers">
              <span className="text-[#8b92a2]">Total ({stagedTickets.length} tkts):</span>
              <strong className="font-black text-amber-400 font-mono-numbers text-xs sm:text-sm">{totalCost} FC</strong>
            </div>

            <button
              type="button"
              onClick={handleCheckout}
              disabled={stagedTickets.length === 0 || !hasEnoughBalance || isTimedOut}
              className="w-full py-2.5 rounded-xl btn-gold font-display font-extrabold text-xs sm:text-sm flex items-center justify-center gap-1.5 cursor-pointer shadow-md shadow-amber-500/20 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              <Coins className="w-3.5 h-3.5" />
              <span>Submit Entry ({totalCost} Flow Coins)</span>
            </button>
          </div>

          {/* Dedicated In-Room Live Activity Box */}
          {activityBox && (
            <div className="flex-1 min-h-[120px] max-h-[160px] xs:max-h-[180px] lg:max-h-[220px] overflow-hidden">
              {activityBox}
            </div>
          )}

        </div>

      </div>

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

