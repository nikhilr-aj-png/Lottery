import React, { useState } from 'react';
import { useLottery } from '../context/LotteryContext';
import { X, ArrowLeft, Dices, RotateCcw, Plus, Trash2, ShieldCheck, Check, Sparkles, AlertCircle, LogIn, Lock, Wallet } from 'lucide-react';

export default function TicketModal({ event, onClose }) {
  const { user, wallet, buyTickets, isTicketNumberSold, getUnsoldRandomNumber, showToast, setIsAuthModalOpen } = useLottery();

  // Active 4-digit selection (start with an unsold number!)
  const [digits, setDigits] = useState(() => {
    return (getUnsoldRandomNumber ? getUnsoldRandomNumber(event?.id) : '7429').split('');
  });
  const [activeSlot, setActiveSlot] = useState(0);

  // Staged tickets in order
  const [stagedTickets, setStagedTickets] = useState([]);

  if (!event) return null;

  const currentNumberStr = digits.join('');
  const isCurrentSold = isTicketNumberSold ? isTicketNumberSold(event.id, currentNumberStr) : false;
  const isAlreadyStaged = stagedTickets.includes(currentNumberStr);

  // Helper to suggest alternative digit
  const suggestAltNumber = (baseNum) => {
    const n = parseInt(baseNum, 10) || 1000;
    for (let offset = 1; offset < 100; offset++) {
      const alt = String((n + offset) % 10000).padStart(4, '0');
      if (!isTicketNumberSold(event.id, alt) && !stagedTickets.includes(alt)) return alt;
    }
    return '1234';
  };

  // Handle number click on keypad
  const handleKeypadPress = (val) => {
    const newDigits = [...digits];
    newDigits[activeSlot] = String(val);
    setDigits(newDigits);
    setActiveSlot((activeSlot + 1) % 4);
  };

  const handleBackspace = () => {
    const newDigits = [...digits];
    newDigits[activeSlot] = '0';
    setDigits(newDigits);
    setActiveSlot(activeSlot === 0 ? 3 : activeSlot - 1);
  };

  // Quick Pick randomizer for current dials (only picks UNSOLD combination!)
  const handleQuickPickCurrent = () => {
    const unsold = getUnsoldRandomNumber(event.id);
    setDigits(unsold.split(''));
  };

  // Add current 4-digit to staged list
  const handleAddCurrentTicket = () => {
    const num = digits.join('');
    if (isTicketNumberSold(event.id, num)) {
      showToast(`Combination #${num} is already SOLD OUT! Please pick an available combination.`, 'error');
      return;
    }
    if (stagedTickets.includes(num)) {
      showToast(`Combination #${num} is already in your selected tickets!`, 'error');
      return;
    }
    setStagedTickets(prev => [...prev, num]);
    
    // Automatically advance dials to next available number
    const nextUnsold = getUnsoldRandomNumber(event.id);
    setDigits(nextUnsold.split(''));
  };

  // Bulk add quick picks (ensuring all are strictly unsold and unique)
  const handleBulkAdd = (count) => {
    const added = [];
    const used = new Set([...stagedTickets]);
    for (let i = 0; i < count; i++) {
      let candidate = getUnsoldRandomNumber(event.id);
      let attempts = 0;
      while (used.has(candidate) && attempts < 100) {
        candidate = getUnsoldRandomNumber(event.id);
        attempts++;
      }
      used.add(candidate);
      added.push(candidate);
    }
    setStagedTickets(prev => [...prev, ...added]);
    showToast(`Added ${added.length} unique unsold ticket(s) to order!`, 'success');
  };

  const handleRemoveStaged = (index) => {
    setStagedTickets(prev => prev.filter((_, idx) => idx !== index));
  };

  // Total cost
  const totalCost = stagedTickets.length * event.ticketPrice;
  const hasEnoughBalance = wallet.balance >= totalCost && totalCost > 0;

  const handleCheckout = () => {
    if (!user) {
      showToast('Authentication required: Please log in to purchase tickets!', 'error');
      setIsAuthModalOpen(true);
      return;
    }
    if (stagedTickets.length === 0) return;
    const success = buyTickets(event.id, stagedTickets);
    if (success) {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#07090e] flex flex-col overflow-y-auto w-full min-h-screen animate-in fade-in duration-200">
      
      {/* Top Full-Screen Navigation Bar */}
      <div className="sticky top-0 z-30 bg-[#0b0e14]/95 backdrop-blur-xl border-b border-[rgba(245,196,81,0.25)] px-4 sm:px-8 py-3.5 flex items-center justify-between shadow-lg">
        <div className="flex items-center gap-3 sm:gap-4">
          <button
            onClick={onClose}
            className="px-3.5 py-2 rounded-xl bg-[#141924] hover:bg-[#1f2738] text-xs font-bold text-[#f5c451] border border-[rgba(245,196,81,0.25)] flex items-center gap-2 transition-all cursor-pointer shadow-sm shrink-0"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Return to Lobby</span>
          </button>
          
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <span className="badge-provably-fair px-2 py-0.5 rounded text-[10px] font-bold flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-[#05d5aa] animate-ping" />
                ROUND #{event.id.replace('evt-', '').toUpperCase()}
              </span>
              <span className="text-xs font-mono-numbers text-[#9b8f7c]">
                Stake: <strong className="text-white">{event.ticketPrice} USDT</strong>
              </span>
            </div>
            <h1 className="font-display font-extrabold text-sm sm:text-lg text-white truncate max-w-[200px] sm:max-w-md">
              {event.title} <span className="text-[#ffd700]">Terminal</span>
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {user && (
            <div className="hidden sm:flex items-center gap-2 bg-[#121721] px-3.5 py-1.5 rounded-xl border border-[#272a31]">
              <span className="text-xs text-[#9b8f7c]">Available:</span>
              <span className="font-mono-numbers font-bold text-xs text-[#ffd700]">
                {wallet.balance.toFixed(2)} USDT
              </span>
            </div>
          )}
          <button
            onClick={onClose}
            title="Close Terminal"
            className="w-9 h-9 rounded-xl bg-[#1a2232] text-[#9b8f7c] hover:text-white hover:bg-[#272a31] flex items-center justify-center transition-colors cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Full-Screen Workspace Body: 2 Columns */}
      <div className="max-w-7xl mx-auto w-full p-4 sm:p-8 flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8">
          
          {/* LEFT COLUMN: 4-Digit Dial & Keypad (7 Cols) */}
          <div className="lg:col-span-7 flex flex-col gap-4 sm:gap-5">
            
            {/* 4 Dials Display */}
            <div className="bg-[#0b0e14] p-3 sm:p-5 rounded-2xl border border-[rgba(245,196,81,0.2)]">
              <div className="flex items-center justify-between mb-2 sm:mb-3 text-[11px] sm:text-xs">
                <span className="text-[#9b8f7c] font-bold uppercase tracking-wider">
                  Pick Your 4 Digits (0000 - 9999)
                </span>
                <span className="text-[#05d5aa] font-mono-numbers text-[10px] sm:text-[11px]">
                  Slot {activeSlot + 1} of 4 Active
                </span>
              </div>

              {/* Dials */}
              <div className="grid grid-cols-4 gap-1.5 sm:gap-3 my-2">
                {digits.map((digit, idx) => (
                  <button
                    key={idx}
                    onClick={() => setActiveSlot(idx)}
                    className={`digit-dial h-16 sm:h-24 rounded-xl sm:rounded-2xl flex flex-col items-center justify-center cursor-pointer transition-all duration-200 ${
                      activeSlot === idx ? 'active scale-105' : 'hover:border-[#f5c451]/50'
                    }`}
                  >
                    <span className="text-[9px] sm:text-[10px] text-[#9b8f7c] font-mono-numbers mb-0.5 sm:mb-1 font-semibold uppercase">
                      Digit {['I', 'II', 'III', 'IV'][idx]}
                    </span>
                    <span className="font-display font-black text-2xl sm:text-4xl text-[#ffd700]">
                      {digit}
                    </span>
                    {activeSlot === idx && (
                      <span className="w-5 sm:w-6 h-1 rounded-full bg-[#05d5aa] mt-0.5 sm:mt-1 animate-pulse" />
                    )}
                  </button>
                ))}
              </div>

              {/* Sold-out Warning Banner */}
              {isCurrentSold && (
                <div className="my-2.5 p-3 rounded-xl bg-red-950/70 border border-red-500/50 text-red-200 text-xs flex items-start gap-2.5 shadow-lg animate-in fade-in duration-200">
                  <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <div className="font-bold text-red-300 flex items-center justify-between">
                      <span>⚠️ #{currentNumberStr} is ALREADY SOLD OUT!</span>
                      <span className="text-[10px] bg-red-900/80 px-2 py-0.5 rounded text-red-100 uppercase font-mono-numbers">Taken</span>
                    </div>
                    <p className="text-[11px] text-red-200/80 mt-1">
                      Another player has already booked this exact combination. Each 4-digit ticket is strictly unique. Please change at least 1 digit (e.g. try #{suggestAltNumber(currentNumberStr)}).
                    </p>
                  </div>
                </div>
              )}

              {isAlreadyStaged && (
                <div className="my-2.5 p-2.5 rounded-xl bg-amber-950/50 border border-amber-500/40 text-amber-200 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>#{currentNumberStr} is already added in your ticket selection list.</span>
                </div>
              )}

              {/* Quick Actions Bar */}
              <div className="flex flex-wrap items-center justify-between gap-2 mt-3 pt-3 sm:mt-4 sm:pt-4 border-t border-[#1f2737]">
                <button
                  onClick={handleQuickPickCurrent}
                  className="btn-ghost-gold px-2.5 sm:px-3.5 py-1.5 sm:py-2 rounded-xl text-[11px] sm:text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  <Dices className="w-3.5 h-3.5 text-[#ffd700]" />
                  ⚡ Quick Pick (Available)
                </button>

                <button
                  onClick={() => setDigits(['0', '0', '0', '0'])}
                  className="text-[11px] sm:text-xs text-[#9b8f7c] hover:text-white px-2 py-1 rounded flex items-center gap-1"
                >
                  <RotateCcw className="w-3 h-3" />
                  Reset
                </button>

                <button
                  onClick={handleAddCurrentTicket}
                  disabled={isCurrentSold || isAlreadyStaged}
                  className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl text-[11px] sm:text-xs font-bold flex items-center gap-1.5 transition-all ${
                    isCurrentSold || isAlreadyStaged
                      ? 'bg-zinc-800 text-zinc-500 border border-zinc-700 cursor-not-allowed opacity-60'
                      : 'btn-gold cursor-pointer'
                  }`}
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>
                    {isCurrentSold ? 'Sold Out' : isAlreadyStaged ? 'Already Added' : `Add [${currentNumberStr}] to Order`}
                  </span>
                </button>
              </div>
            </div>

            {/* Tactile Keypad */}
            <div className="bg-[#10131a] p-4 rounded-2xl border border-[#272a31]">
              <span className="text-[11px] text-[#9b8f7c] block mb-2 font-semibold">
                TACTILE NUMERIC KEYPAD
              </span>
              <div className="grid grid-cols-5 gap-2">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 0].map((num) => (
                  <button
                    key={num}
                    onClick={() => handleKeypadPress(num)}
                    className="h-11 rounded-xl bg-[#191c22] hover:bg-[#272a31] active:bg-[#f5c451] active:text-[#0b0e14] border border-[#32353c] hover:border-[#ffd700]/50 font-display font-bold text-lg text-white transition-all cursor-pointer"
                  >
                    {num}
                  </button>
                ))}
              </div>

              <div className="flex items-center justify-between gap-2 mt-2 pt-2">
                <button
                  onClick={handleBackspace}
                  className="px-3 py-1.5 rounded-lg bg-[#191c22] hover:bg-[#272a31] text-xs font-mono-numbers text-[#9b8f7c] hover:text-white border border-[#32353c]"
                >
                  ← Backspace
                </button>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleBulkAdd(5)}
                    className="px-2.5 py-1.5 rounded-lg bg-[rgba(5,213,170,0.1)] hover:bg-[rgba(5,213,170,0.2)] text-[11px] font-bold text-[#05d5aa] border border-[#05d5aa]/30 cursor-pointer"
                  >
                    +5 Quick Picks
                  </button>
                  <button
                    onClick={() => handleBulkAdd(10)}
                    className="px-2.5 py-1.5 rounded-lg bg-[rgba(245,196,81,0.1)] hover:bg-[rgba(245,196,81,0.2)] text-[11px] font-bold text-[#ffd700] border border-[#f5c451]/30 cursor-pointer"
                  >
                    +10 Quick Picks
                  </button>
                </div>
              </div>
            </div>

            {/* Single Winner & Unique Tickets Protocol */}
            <div className="bg-[#0b0e14]/60 p-3.5 rounded-xl border border-[#272a31] text-xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-[#ffd700] flex items-center gap-1.5 font-display text-xs">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  Single Winner & Unique Combination Protocol:
                </span>
                <span className="text-[10px] font-mono-numbers text-[#05d5aa] font-bold bg-[#05d5aa]/10 px-2 py-0.5 rounded border border-[#05d5aa]/20">
                  Exact Match Only
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                <div className="bg-[#121721] p-2.5 rounded-lg border border-[#272a31]">
                  <strong className="text-white block font-display">🎯 Exact 4-Digit Match</strong>
                  <span className="text-[#05d5aa]">Single exact match takes full jackpot pot!</span>
                </div>
                <div className="bg-[#121721] p-2.5 rounded-lg border border-[#272a31]">
                  <strong className="text-white block font-display">🔒 Unique Tickets (No Duplicates)</strong>
                  <span className="text-[#9b8f7c]">Once a 4-digit number is sold, nobody else can buy it.</span>
                </div>
              </div>
            </div>

          </div>

          {/* RIGHT COLUMN: Order Cart & USDT Checkout (5 Cols) */}
          <div className="lg:col-span-5 flex flex-col justify-between gap-5">
            
            {/* Order Cart */}
            <div className="bg-[#0b0e14] p-4 rounded-2xl border border-[rgba(245,196,81,0.2)] flex-1 flex flex-col">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-[#ffd700]" />
                  Active Ticket Order ({stagedTickets.length})
                </span>
                {stagedTickets.length > 0 && (
                  <button
                    onClick={() => setStagedTickets([])}
                    className="text-[11px] text-red-400 hover:text-red-300 font-semibold"
                  >
                    Clear All
                  </button>
                )}
              </div>

              {/* Ticket List */}
              <div className="flex-1 max-h-48 overflow-y-auto space-y-2 pr-1">
                {stagedTickets.length === 0 ? (
                  <div className="py-8 text-center text-xs text-[#9b8f7c]">
                    No tickets selected yet. Pick 4 digits or click Quick Pick!
                  </div>
                ) : (
                  stagedTickets.map((ticketNum, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-2.5 rounded-xl bg-[#121721] border border-[#272a31] hover:border-[#f5c451]/30 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono-numbers text-[#9b8f7c] font-bold">
                          #{String(idx + 1).padStart(2, '0')}
                        </span>
                        <div className="flex gap-1">
                          {ticketNum.split('').map((char, cIdx) => (
                            <span
                              key={cIdx}
                              className="w-6 h-6 rounded bg-[#0b0e14] border border-[#f5c451]/40 flex items-center justify-center font-display font-extrabold text-xs text-[#ffd700]"
                            >
                              {char}
                            </span>
                          ))}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono-numbers text-white font-bold">
                          {event.ticketPrice} USDT
                        </span>
                        <button
                          onClick={() => handleRemoveStaged(idx)}
                          className="text-[#9b8f7c] hover:text-red-400 p-1 rounded"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* USDT Checkout Breakdown Card */}
            <div className="glass-panel p-5 rounded-2xl border border-[#ffd700]/30 space-y-3">
              <span className="text-xs font-mono-numbers text-[#9b8f7c] font-bold uppercase tracking-wider block">
                USDT Non-Custodial Settlement
              </span>

              <div className="flex items-center justify-between text-xs py-1 border-b border-[#272a31]">
                <span className="text-[#9b8f7c]">Connected USDT Wallet:</span>
                <span className="font-mono-numbers text-white font-semibold">
                  {wallet.address.slice(0, 6)}...{wallet.address.slice(-4)} ({wallet.network})
                </span>
              </div>

              <div className="flex items-center justify-between text-xs py-1 border-b border-[#272a31]">
                <span className="text-[#9b8f7c]">Available Balance:</span>
                <span className="font-mono-numbers text-[#05d5aa] font-bold">
                  {wallet.balance.toFixed(2)} USDT
                </span>
              </div>

              <div className="flex items-center justify-between text-xs py-1 border-b border-[#272a31]">
                <span className="text-[#9b8f7c]">Subtotal ({stagedTickets.length} tickets):</span>
                <span className="font-mono-numbers text-white font-bold">
                  {totalCost.toFixed(2)} USDT
                </span>
              </div>

              <div className="flex items-center justify-between text-xs py-1 border-b border-[#272a31]">
                <span className="text-[#9b8f7c]">Network Fee:</span>
                <span className="font-mono-numbers text-[#05d5aa] font-bold">
                  0.00 USDT (Subsidized)
                </span>
              </div>

              <div className="flex items-center justify-between text-sm pt-1">
                <span className="text-white font-bold">Balance After Order:</span>
                <span className={`font-mono-numbers font-black ${hasEnoughBalance ? 'text-[#ffd700]' : 'text-red-400'}`}>
                  {wallet.balance >= totalCost ? (wallet.balance - totalCost).toFixed(2) : 'Insufficient'} USDT
                </span>
              </div>

              {!user ? (
                <div className="space-y-3 pt-1">
                  <div className="p-3 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 text-amber-400" />
                    <span>Authentication required: Please log in to complete ticket purchase.</span>
                  </div>

                  <button
                    onClick={() => setIsAuthModalOpen(true)}
                    className="btn-gold w-full py-4 rounded-xl font-display font-extrabold text-base flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg shadow-[#f5c451]/30"
                  >
                    <LogIn className="w-5 h-5" />
                    Log In to Buy Tickets {stagedTickets.length > 0 ? `(${totalCost.toFixed(2)} USDT)` : ''}
                  </button>
                </div>
              ) : (
                <>
                  {!hasEnoughBalance && (
                    <div className="p-2.5 rounded-lg bg-red-950/40 border border-red-500/30 text-red-300 text-xs flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
                      <span>Please deposit additional USDT to purchase these tickets.</span>
                    </div>
                  )}

                  {/* Checkout Button */}
                  <button
                    disabled={!hasEnoughBalance || stagedTickets.length === 0}
                    onClick={handleCheckout}
                    className={`w-full py-4 rounded-xl font-display font-extrabold text-base flex items-center justify-center gap-2 transition-all cursor-pointer ${
                      hasEnoughBalance && stagedTickets.length > 0
                        ? 'btn-gold shadow-lg shadow-[#f5c451]/30'
                        : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
                    }`}
                  >
                    <Check className="w-5 h-5" />
                    Confirm & Buy {stagedTickets.length} Tickets ({totalCost.toFixed(2)} USDT)
                  </button>
                </>
              )}

              <div className="flex items-center justify-center gap-1.5 text-[10px] text-[#9b8f7c] text-center pt-1 font-mono-numbers">
                <ShieldCheck className="w-3.5 h-3.5 text-[#05d5aa]" />
                <span>SHA-256 Pre-Seed Committed: {event.sha256Seed.slice(0, 16)}...</span>
              </div>
            </div>

          </div>

        </div>
    </div>
  );
}
