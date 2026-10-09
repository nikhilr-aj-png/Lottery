import React from 'react';
import { useLottery } from '../context/LotteryContext';
import { Trophy, ShieldCheck, ExternalLink, Calendar, Users, DollarSign } from 'lucide-react';

export default function ResultsView() {
  const { events } = useLottery();

  const completedEvents = events.filter(e => e.status === 'completed');

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      
      {/* Header */}
      <div>
        <h2 className="font-display font-extrabold text-2xl sm:text-3xl text-white">
          Cryptographic <span className="text-[#ffd700]">Draw Results</span>
        </h2>
        <p className="text-xs sm:text-sm text-[#9b8f7c]">
          Provably Fair historical draws verified with SHA-256 seed commitments
        </p>
      </div>

      {completedEvents.length === 0 ? (
        <div className="glass-panel rounded-2xl p-8 text-center text-sm text-[#9b8f7c]">
          No past draws recorded yet. Active lotteries are in progress.
        </div>
      ) : (
        <div className="space-y-6">
          {completedEvents.map((event) => (
            <div
              key={event.id}
              className="glass-panel rounded-2xl p-6 sm:p-8 border border-[rgba(245,196,81,0.25)] space-y-6"
            >
              {/* Top Banner */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-4 border-b border-[#1f2737]">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="badge-gold px-2.5 py-0.5 rounded text-[10px] font-bold font-mono-numbers">
                      {event.badge || 'OFFICIAL DRAW'}
                    </span>
                    <span className="text-xs text-[#9b8f7c] flex items-center gap-1 font-mono-numbers">
                      <Calendar className="w-3.5 h-3.5" />
                      Executed: {new Date(event.drawTime).toLocaleDateString()}
                    </span>
                  </div>
                  <h3 className="font-display font-black text-xl sm:text-2xl text-white">
                    {event.title}
                  </h3>
                </div>

                <div className="flex items-center gap-2 bg-[#0b0e14] px-4 py-2 rounded-xl border border-[#272a31]">
                  <span className="text-xs text-[#9b8f7c] font-medium">Jackpot (Win Up To):</span>
                  <span className="font-display font-black text-lg text-[#ffd700]">
                    {event.poolPrize.toLocaleString()} USDT
                  </span>
                </div>
              </div>

              {/* 4-Digit Winning Spheres Showcase */}
              <div className="bg-[#0b0e14] rounded-2xl p-6 border border-[#272a31] text-center">
                <span className="text-xs font-mono-numbers uppercase tracking-widest text-[#05d5aa] font-bold block mb-3">
                  🏆 OFFICIAL WINNING 4-DIGIT COMBINATION
                </span>
                
                <div className="flex items-center justify-center gap-3 sm:gap-4 my-2">
                  {event.winningDigits ? event.winningDigits.split('').map((char, idx) => (
                    <div
                      key={idx}
                      className="w-14 h-14 sm:w-20 sm:h-20 rounded-2xl bg-gradient-to-b from-[#192233] to-[#0c0f17] border-2 border-[#05d5aa] flex items-center justify-center font-display font-black text-3xl sm:text-4xl text-[#05d5aa] shadow-[0_0_25px_rgba(5,213,170,0.3)]"
                    >
                      {char}
                    </div>
                  )) : (
                    <span className="text-white text-lg font-mono-numbers">Pending Draw</span>
                  )}
                </div>

                <div className="mt-4 pt-3 border-t border-[#272a31] text-xs text-[#9b8f7c] flex flex-col sm:flex-row items-center justify-center gap-2">
                  <span className="text-[#ffd700] font-bold">🎯 Lucky Winners Draw:</span>
                  <span>{event.winnerCount > 1 ? `${event.winnerCount} lucky winners share the jackpot pot equally!` : `Lucky 4-digit combination wins up to ${event.poolPrize.toLocaleString()} USDT!`} Winnings credited directly to wallet.</span>
                </div>
              </div>

              {/* Verification & Block Details */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono-numbers">
                <div className="bg-[#10131a] p-3.5 rounded-xl border border-[#272a31]">
                  <span className="text-[#9b8f7c] block mb-1">Target Blockchain Block:</span>
                  <span className="text-white font-bold">{event.blockTarget || '#19,402,118'}</span>
                </div>
                <div className="bg-[#10131a] p-3.5 rounded-xl border border-[#272a31]">
                  <span className="text-[#9b8f7c] block mb-1">SHA-256 Pre-Seed Hash:</span>
                  <span className="text-[#ffd700] truncate block">{event.sha256Seed}</span>
                </div>
              </div>

            </div>
          ))}
        </div>
      )}

    </div>
  );
}
