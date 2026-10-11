import React from 'react';
import { useLottery } from '../context/LotteryContext';
import { Ticket, Trophy, Clock, CheckCircle2, Sparkles, AlertCircle } from 'lucide-react';

export default function MyTicketsView({ onOpenPicker }) {
  const { tickets, events } = useLottery();

  const activeTickets = tickets.filter(t => t.status === 'active');
  const pastTickets = tickets.filter(t => t.status !== 'active');

  return (
    <div className="max-w-7xl 2xl:max-w-[1600px] 3xl:max-w-[1920px] 4k:max-w-[2400px] mx-auto px-2.5 xs:px-4 sm:px-6 lg:px-8 py-4 sm:py-8 space-y-5 sm:space-y-8">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
        <div>
          <h2 className="font-display font-extrabold text-xl xs:text-2xl sm:text-3xl text-white">
            My <span className="text-[#ffd700]">Lottery Tickets</span>
          </h2>
          <p className="text-[11px] xs:text-xs sm:text-sm text-[#9b8f7c]">
            Track your 4-digit lucky combinations and automated prize payouts
          </p>
        </div>

        <button
          onClick={() => onOpenPicker()}
          className="btn-gold px-4 xs:px-5 py-2 xs:py-2.5 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-1.5 xs:gap-2 cursor-pointer shadow-lg shadow-[#f5c451]/20"
        >
          <Sparkles className="w-3.5 xs:w-4 h-3.5 xs:h-4" />
          <span>+ Buy New 4-Digit Ticket</span>
        </button>
      </div>

      {/* Active Tickets Section */}
      <div>
        <div className="flex items-center gap-2 mb-3 sm:mb-4">
          <Clock className="w-3.5 xs:w-4 h-3.5 xs:h-4 text-[#ffd700]" />
          <h3 className="font-display font-bold text-base xs:text-lg text-white">
            Active Tickets ({activeTickets.length})
          </h3>
        </div>

        {activeTickets.length === 0 ? (
          <div className="glass-panel rounded-2xl p-6 sm:p-8 text-center space-y-3">
            <Ticket className="w-10 xs:w-12 h-10 xs:h-12 text-[#9b8f7c]/50 mx-auto" />
            <p className="text-xs sm:text-sm text-[#9b8f7c]">You do not have any active tickets in upcoming draws.</p>
            <button
              onClick={() => onOpenPicker()}
              className="btn-ghost-gold px-3.5 xs:px-4 py-2 rounded-xl text-xs font-bold inline-flex items-center gap-1.5"
            >
              Pick 4 Lucky Numbers Now
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-3 4k:grid-cols-4 gap-3 sm:gap-4">
            {activeTickets.map((ticket) => (
              <div
                key={ticket.id}
                className="glass-panel rounded-2xl p-3.5 xs:p-4.5 sm:p-5 border border-[#ffd700]/30 hover:border-[#ffd700] transition-all relative overflow-hidden group"
              >
                <div className="flex items-center justify-between text-xs mb-2.5 xs:mb-3">
                  <span className="font-mono-numbers text-[10px] text-[#9b8f7c] font-bold">
                    #{ticket.id}
                  </span>
                  <span className="px-2 xs:px-2.5 py-0.5 rounded-full bg-cyan-950/40 text-[#00f2fe] border border-[#00f2fe]/30 text-[9px] xs:text-[10px] font-bold font-mono-numbers flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#00f2fe] animate-ping" />
                    LIVE IN POOL
                  </span>
                </div>

                <h4 className="font-display font-bold text-xs xs:text-sm text-white mb-2.5 xs:mb-3 truncate">
                  {ticket.eventTitle}
                </h4>

                {/* 4 Large Digits */}
                <div className="flex items-center justify-center gap-1.5 xs:gap-2 my-3 xs:my-4">
                  {ticket.ticketNumber.split('').map((digit, dIdx) => (
                    <div
                      key={dIdx}
                      className="w-10 xs:w-11 sm:w-12 h-10 xs:h-11 sm:h-12 rounded-xl bg-gradient-to-b from-[#1c2434] to-[#0c0f17] border-2 border-[#f5c451]/60 flex items-center justify-center font-display font-black text-lg xs:text-xl text-[#ffd700] shadow-[0_0_12px_rgba(245,196,81,0.2)]"
                    >
                      {digit}
                    </div>
                  ))}
                </div>

                <div className="pt-2.5 xs:pt-3 border-t border-[#1f2737] flex items-center justify-between text-[11px] xs:text-xs">
                  <span className="text-[#9b8f7c]">Ticket Cost:</span>
                  <span className="font-mono-numbers font-bold text-white">
                    {ticket.price} USDT
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Past Tickets & Winning Results Section */}
      <div>
        <div className="flex items-center gap-2 mb-3 sm:mb-4">
          <Trophy className="w-3.5 xs:w-4 h-3.5 xs:h-4 text-[#05d5aa]" />
          <h3 className="font-display font-bold text-base xs:text-lg text-white">
            Draw History & Winning Claims ({pastTickets.length})
          </h3>
        </div>

        {pastTickets.length === 0 ? (
          <div className="glass-panel rounded-2xl p-5 sm:p-6 text-center text-xs text-[#9b8f7c]">
            No completed draws recorded yet.
          </div>
        ) : (
          <div className="space-y-2.5 sm:space-y-3">
            {pastTickets.map((ticket) => {
              const isWon = ticket.status === 'won';

              return (
                <div
                  key={ticket.id}
                  className={`p-3 xs:p-4 sm:p-5 rounded-2xl border transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4 ${
                    isWon
                      ? 'bg-[rgba(5,213,170,0.06)] border-[#05d5aa]/50 shadow-[0_0_25px_rgba(5,213,170,0.12)]'
                      : 'bg-[#10131a]/80 border-[#272a31]'
                  }`}
                >
                  <div className="flex items-center gap-3 xs:gap-4 min-w-0">
                    {/* Ticket 4 Digits */}
                    <div className="flex gap-1 xs:gap-1.5 shrink-0">
                      {ticket.ticketNumber.split('').map((char, cIdx) => (
                        <span
                          key={cIdx}
                          className={`w-7 xs:w-8 sm:w-9 h-7 xs:h-8 sm:h-9 rounded-lg flex items-center justify-center font-display font-black text-sm xs:text-base ${
                            isWon
                              ? 'bg-[#0b0e14] border-2 border-[#05d5aa] text-[#05d5aa]'
                              : 'bg-[#0b0e14] border border-[#32353c] text-white/70'
                          }`}
                        >
                          {char}
                        </span>
                      ))}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 xs:gap-2">
                        <span className="font-display font-bold text-xs xs:text-sm text-white truncate">
                          {ticket.eventTitle}
                        </span>
                        <span className="font-mono-numbers text-[9px] xs:text-[10px] text-[#9b8f7c] shrink-0">
                          #{ticket.id}
                        </span>
                      </div>
                      <span className="text-[11px] xs:text-xs text-[#9b8f7c]">
                        Entry Stake: {ticket.price} USDT
                      </span>
                    </div>
                  </div>

                  {/* Status & Prize */}
                  <div className="flex items-center gap-3 xs:gap-4 self-end sm:self-center">
                    {isWon ? (
                      <div className="text-right">
                        <span className="text-[10px] font-mono-numbers uppercase tracking-wider text-[#05d5aa] font-bold block">
                          {ticket.matchTier}
                        </span>
                        <span className="font-display font-black text-lg sm:text-xl text-[#ffd700] block">
                          +{ticket.wonAmount.toLocaleString()} USDT
                        </span>
                        <span className="text-[10px] text-[#05d5aa] font-bold flex items-center justify-end gap-1">
                          <CheckCircle2 className="w-3 h-3" />
                          Auto-Credited to Wallet ✅
                        </span>
                      </div>
                    ) : (
                      <div className="text-right">
                        <span className="text-xs font-mono-numbers text-[#9b8f7c] font-semibold block">
                          No Winning Match
                        </span>
                        <span className="text-[11px] text-[#9b8f7c]">
                          Better luck next round!
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

    </div>
  );
}
