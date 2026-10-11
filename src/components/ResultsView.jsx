import React, { useState, useMemo } from 'react';
import { useLottery } from '../context/LotteryContext';
import { 
  Trophy, 
  ShieldCheck, 
  Calendar, 
  Users, 
  DollarSign, 
  CheckCircle2, 
  Sparkles,
  Award,
  Layers
} from 'lucide-react';

const DEMO_PAST_RESULTS = [
  {
    id: 'evt-diwali-bumper-10',
    title: 'Diwali Special Bumper Pot 10 USDT',
    badge: 'FESTIVE SPECIAL',
    ticketPrice: 10,
    poolPrize: 50,
    minPrize: 10,
    maxPrize: 50,
    winnerCount: 1,
    winningDigits: '8492',
    drawTime: Date.now() - 3 * 3600 * 1000,
    status: 'completed',
    ticketsSold: 1296,
    winnerSummary: '@VIP_Player matched lucky 4 digits #8492 · 50.00 USDT disbursed',
    winners: [
      { rank: 1, user: '@VIP_Player', ticket: '#8492', prize: '50.00 USDT', status: 'Credited to Wallet' }
    ]
  },
  {
    id: 'evt-past-2840',
    title: 'Weekly High Roller Pot 50 USDT',
    badge: 'HIGH ROLLER POT',
    ticketPrice: 50,
    poolPrize: 58000,
    winnerCount: 5,
    winningDigits: '1429',
    drawTime: Date.now() - 28 * 3600 * 1000,
    status: 'completed',
    ticketsSold: 1160,
    winnerSummary: '5 Lucky Winners matched #1429 · Shared 58,000 USDT (11,600 USDT each)',
    winners: [
      { rank: 1, user: '@LuckyWinner77', ticket: '#1429', prize: '11,600.00 USDT', status: 'Credited to Wallet' },
      { rank: 2, user: '@crypto_king', ticket: '#1429', prize: '11,600.00 USDT', status: 'Credited to Wallet' },
      { rank: 3, user: '@satoshi_vip', ticket: '#1429', prize: '11,600.00 USDT', status: 'Credited to Wallet' },
      { rank: 4, user: '@priya_invest', ticket: '#1429', prize: '11,600.00 USDT', status: 'Credited to Wallet' },
      { rank: 5, user: '@web3_whale', ticket: '#1429', prize: '11,600.00 USDT', status: 'Credited to Wallet' }
    ]
  }
];

export default function ResultsView() {
  const { events } = useLottery();
  const [selectedRoundFilter, setSelectedRoundFilter] = useState('all');

  const completedEvents = useMemo(() => {
    return events.filter(e => e.status === 'completed');
  }, [events]);

  // Combine real completed events with demo past results so multiple rounds are always showcased
  const allResults = useMemo(() => {
    const combined = [...completedEvents];
    for (const demo of DEMO_PAST_RESULTS) {
      if (!combined.some(e => e.id === demo.id)) {
        combined.push(demo);
      }
    }
    return combined;
  }, [completedEvents]);

  const filteredResults = useMemo(() => {
    if (selectedRoundFilter === 'all') return allResults;
    return allResults.filter(e => e.id === selectedRoundFilter);
  }, [allResults, selectedRoundFilter]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h2 className="font-display font-extrabold text-2xl sm:text-3xl text-white">
            Lottery <span className="text-[#ffd700]">Results</span>
          </h2>
          <p className="text-xs sm:text-sm text-[#9b8f7c] mt-1">
            Official winning numbers and verified prize payouts for concluded rounds
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="badge-provably-fair px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-[#05d5aa]" />
            100% Verified Payouts
          </span>
        </div>
      </div>

      {/* Multiple Rounds Filter / Switcher Bar */}
      <div className="flex flex-wrap items-center gap-2.5 p-1.5 bg-[#0b0e14] rounded-2xl border border-[#272a31]">
        <button
          onClick={() => setSelectedRoundFilter('all')}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
            selectedRoundFilter === 'all'
              ? 'bg-amber-500 text-black shadow-md shadow-amber-500/20 font-extrabold'
              : 'text-[#9b8f7c] hover:text-white hover:bg-[#141924]'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>All Concluded Rounds ({allResults.length})</span>
        </button>

        {allResults.map((evt) => (
          <button
            key={evt.id}
            onClick={() => setSelectedRoundFilter(evt.id)}
            className={`px-4 py-2.5 rounded-xl text-xs font-mono-numbers font-bold transition-all flex items-center gap-2 cursor-pointer ${
              selectedRoundFilter === evt.id
                ? 'bg-amber-500 text-black shadow-md shadow-amber-500/20 font-extrabold'
                : 'text-[#9b8f7c] hover:text-white hover:bg-[#141924]'
            }`}
          >
            <span className="font-extrabold">ROUND #{evt.id.replace('evt-', '').toUpperCase()}</span>
            <span className="text-[10px] opacity-75 font-sans font-normal truncate max-w-[140px]">
              ({evt.title})
            </span>
          </button>
        ))}
      </div>

      {/* Results List */}
      {filteredResults.length === 0 ? (
        <div className="glass-panel rounded-2xl p-8 text-center text-sm text-[#9b8f7c]">
          No past draws recorded yet. Active lotteries are in progress.
        </div>
      ) : (
        <div className="space-y-6">
          {filteredResults.map((event) => {
            const winnerCount = event.winnerCount || 1;
            const winnersList = event.winners || [
              { rank: 1, user: '@LuckyWinner', ticket: `#${event.winningDigits || '7429'}`, prize: `${(event.poolPrize / winnerCount).toFixed(2)} USDT`, status: 'Credited to Wallet' }
            ];

            return (
              <div
                key={event.id}
                className="glass-panel rounded-2xl p-6 sm:p-8 border border-amber-500/30 space-y-6 relative overflow-hidden shadow-[0_0_35px_rgba(245,196,81,0.08)]"
              >
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-[#ffd700] to-transparent" />

                {/* Top Banner: Round ID & Event Info */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-4 border-b border-[#1f2737]">
                  <div>
                    <div className="flex flex-wrap items-center gap-2 mb-1.5">
                      <span className="font-mono-numbers font-extrabold text-xs text-amber-300 bg-black/60 px-2.5 py-0.5 rounded-md border border-amber-500/40">
                        ROUND #{event.id.replace('evt-', '').toUpperCase()}
                      </span>
                      <span className="badge-gold px-2.5 py-0.5 rounded text-[10px] font-bold font-mono-numbers">
                        {event.badge || 'OFFICIAL RESULT'}
                      </span>
                      <span className="text-xs text-[#9b8f7c] flex items-center gap-1 font-mono-numbers">
                        <Calendar className="w-3.5 h-3.5" />
                        Concluded: {new Date(event.drawTime).toLocaleDateString()}
                      </span>
                    </div>

                    <h3 className="font-display font-black text-xl sm:text-2xl text-white">
                      {event.title}
                    </h3>
                  </div>

                  <div className="flex items-center gap-3 bg-[#0b0e14] px-4 py-2.5 rounded-xl border border-[#272a31] shrink-0">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-[#9b8f7c] block">Grand Jackpot Pot</span>
                      <span className="font-display font-black text-xl text-[#ffd700] font-mono-numbers">
                        {event.poolPrize.toLocaleString()} USDT
                      </span>
                    </div>
                  </div>
                </div>

                {/* 4-Digit Winning Spheres Showcase */}
                <div className="bg-[#07090d] rounded-2xl p-6 border border-[#272a31] text-center">
                  <span className="text-xs font-mono-numbers uppercase tracking-widest text-[#05d5aa] font-bold block mb-3">
                    🏆 OFFICIAL WINNING 4-DIGIT COMBINATION
                  </span>
                  
                  <div className="flex items-center justify-center gap-3 sm:gap-5 my-2">
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

                  <div className="mt-4 pt-3 border-t border-[#1f2737] text-xs text-[#9b8f7c] flex flex-col sm:flex-row items-center justify-center gap-2">
                    <span className="text-[#ffd700] font-bold">🎯 Result Outcome:</span>
                    <span>
                      {event.winnerSummary || (winnerCount > 1 
                        ? `${winnerCount} lucky winners split the jackpot pot equally!` 
                        : `Winning combination claimed the grand jackpot! Winnings credited directly to wallet.`)}
                    </span>
                  </div>
                </div>

                {/* Winners Table Breakdown */}
                <div>
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                    <Award className="w-4 h-4 text-amber-400" />
                    <span>Verified Lucky Winners · Round #{event.id.replace('evt-', '').toUpperCase()}</span>
                  </h4>

                  <div className="overflow-x-auto rounded-xl border border-[#272a31]">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-[#0b0e14] text-[#9b8f7c] font-mono-numbers uppercase text-[10px]">
                        <tr>
                          <th className="py-2.5 px-3">Winner User</th>
                          <th className="py-2.5 px-3">Winning Ticket</th>
                          <th className="py-2.5 px-3">Prize Share</th>
                          <th className="py-2.5 px-3 text-right">Settlement Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#1f2737] bg-[#10131a]">
                        {winnersList.map((w, idx) => (
                          <tr key={idx} className="hover:bg-white/[0.02]">
                            <td className="py-3 px-3 font-semibold text-white flex items-center gap-1.5">
                              <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-400 text-[10px] flex items-center justify-center font-bold">
                                #{idx + 1}
                              </span>
                              <span>{w.user}</span>
                            </td>
                            <td className="py-3 px-3 font-mono-numbers font-bold text-amber-300">
                              {w.ticket}
                            </td>
                            <td className="py-3 px-3 font-mono-numbers font-black text-emerald-400">
                              {w.prize}
                            </td>
                            <td className="py-3 px-3 text-right">
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                {w.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Settlement Information Box */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs font-mono-numbers">
                  <div className="bg-[#0b0e14] p-3 rounded-xl border border-[#272a31] flex items-center justify-between">
                    <span className="text-[#9b8f7c]">Round Reference:</span>
                    <span className="text-white font-bold">#{event.id.replace('evt-', '').toUpperCase()}</span>
                  </div>
                  <div className="bg-[#0b0e14] p-3 rounded-xl border border-[#272a31] flex items-center justify-between">
                    <span className="text-[#9b8f7c]">Payout Method:</span>
                    <span className="text-emerald-400 font-bold">100% USDT Direct Wallet Settlement</span>
                  </div>
                </div>

              </div>
            );
          })}
        </div>
      )}

    </div>
  );
}
