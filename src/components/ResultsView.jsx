import React, { useState, useMemo } from 'react';
import { useLottery } from '../context/LotteryContext';
import { 
  Trophy, 
  Calendar, 
  Users, 
  CheckCircle2, 
  Award,
  Layers,
  LayoutGrid,
  List,
  Sparkles,
  ExternalLink,
  X
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
    winnerSummary: '1 Lucky Winner matched 4 lucky digits #8492',
    winners: [
      { rank: 1, user: '@VIP_Player', ticket: '#8492', prize: '50.00 USDT', status: 'Disbursed' }
    ]
  },
  {
    id: 'evt-past-2840',
    title: 'Weekly High Roller Pot 50 USDT',
    badge: 'HIGH ROLLER POT',
    ticketPrice: 50,
    poolPrize: 58000,
    winnerCount: 5,
    winningDigits: '1429, 1578, 6320, 8194, 3042',
    drawTime: Date.now() - 28 * 3600 * 1000,
    status: 'completed',
    ticketsSold: 1160,
    winnerSummary: '5 Lucky Winners each held a different drawn ticket (11,600 USDT each)',
    winners: [
      { rank: 1, user: '@LuckyWinner77', ticket: '#1429', prize: '11,600.00 USDT', status: 'Disbursed' },
      { rank: 2, user: '@crypto_king', ticket: '#1578', prize: '11,600.00 USDT', status: 'Disbursed' },
      { rank: 3, user: '@satoshi_vip', ticket: '#6320', prize: '11,600.00 USDT', status: 'Disbursed' },
      { rank: 4, user: '@priya_invest', ticket: '#8194', prize: '11,600.00 USDT', status: 'Disbursed' },
      { rank: 5, user: '@web3_whale', ticket: '#3042', prize: '11,600.00 USDT', status: 'Disbursed' }
    ]
  },
  {
    id: 'evt-daily-10',
    title: 'Daily Mega 10 USDT Pool',
    badge: 'DAILY JACKPOT',
    ticketPrice: 10,
    poolPrize: 1000,
    minPrize: 500,
    maxPrize: 1000,
    winnerCount: 1,
    winningDigits: '5521',
    drawTime: Date.now() - 52 * 3600 * 1000,
    status: 'completed',
    ticketsSold: 890,
    winnerSummary: '1 Lucky Winner matched lucky ticket #5521',
    winners: [
      { rank: 1, user: '@alpha_trader', ticket: '#5521', prize: '900.00 USDT', status: 'Disbursed' }
    ]
  }
];

function WinnersDetailsModal({ event, onClose }) {
  if (!event) return null;
  const winnerCount = event.winnerCount || 1;
  const winnersList = event.winners || [
    { rank: 1, user: '@LuckyWinner', ticket: `#${event.winningDigits || '7429'}`, prize: `${(event.poolPrize / winnerCount).toFixed(2)} USDT`, status: 'Disbursed' }
  ];

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-xl bg-[#0d1117] border border-amber-500/40 rounded-3xl overflow-hidden shadow-[0_0_60px_rgba(245,196,81,0.2)] flex flex-col relative">
        <div className="h-1.5 bg-gradient-to-r from-amber-500 via-[#ffd700] to-emerald-400" />
        
        {/* Header */}
        <div className="p-6 pb-4 border-b border-[#1f2737] flex items-start justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-1.5">
              <span className="font-mono-numbers font-extrabold text-xs text-amber-300 bg-black/60 px-2.5 py-0.5 rounded-md border border-amber-500/40">
                ROUND #{event.id.replace('evt-', '').toUpperCase()}
              </span>
              <span className="badge-gold px-2.5 py-0.5 rounded text-[10px] font-bold font-mono-numbers">
                {event.badge || 'CONCLUDED'}
              </span>
              <span className="text-xs text-[#9b8f7c] flex items-center gap-1 font-mono-numbers">
                <Calendar className="w-3.5 h-3.5" />
                {new Date(event.drawTime).toLocaleDateString()}
              </span>
            </div>

            <h3 className="font-display font-extrabold text-xl text-white">
              {event.title}
            </h3>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-[#141924] hover:bg-[#1a2130] text-[#9b8f7c] hover:text-white flex items-center justify-center transition-colors cursor-pointer shrink-0 ml-3"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-5 overflow-y-auto max-h-[75vh]">
          {/* Jackpot Highlight */}
          <div className="p-4 rounded-2xl bg-[#07090d] border border-[#272a31] flex items-center justify-between">
            <div>
              <span className="text-[10px] uppercase font-bold text-[#9b8f7c] block">Total Jackpot Distributed</span>
              <span className="font-display font-black text-2xl text-gold-gradient font-mono-numbers">
                {event.poolPrize.toLocaleString()} USDT
              </span>
            </div>
            <div className="text-right">
              <span className="text-[10px] uppercase font-bold text-[#9b8f7c] block">Winners Count</span>
              <span className="font-mono-numbers font-bold text-base text-emerald-400">
                {winnerCount} {winnerCount > 1 ? 'Lucky Winners' : 'Solo Winner'}
              </span>
            </div>
          </div>

          {/* Winning Drawn Numbers Display */}
          <div className="p-4 rounded-2xl bg-[#0b0e14] border border-[#272a31] space-y-2">
            <span className="text-[11px] font-mono-numbers uppercase tracking-wider text-[#05d5aa] font-bold block flex items-center gap-1.5">
              <Trophy className="w-3.5 h-3.5 text-[#05d5aa]" />
              <span>Official Drawn Winning Tickets</span>
            </span>

            <div className="flex flex-wrap items-center gap-2 pt-1">
              {winnersList.map((w, idx) => (
                <div 
                  key={idx}
                  className="bg-[#10141f] border border-amber-500/40 px-3 py-1.5 rounded-xl flex items-center gap-2 shadow-sm"
                >
                  <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-300 font-bold text-[10px] flex items-center justify-center">
                    #{idx + 1}
                  </span>
                  <span className="font-mono-numbers font-black text-base text-[#05d5aa] tracking-wider">
                    {w.ticket}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Full Winners Table Breakdown */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
              <Award className="w-4 h-4 text-amber-400" />
              <span>Individual Winner Payout Ledger</span>
            </h4>

            <div className="rounded-xl border border-[#272a31] overflow-hidden">
              <table className="w-full text-left text-xs font-mono-numbers">
                <thead className="bg-[#07090e] text-[#9b8f7c] uppercase text-[10px]">
                  <tr>
                    <th className="py-2.5 px-3">Winner User</th>
                    <th className="py-2.5 px-3">Winning Ticket</th>
                    <th className="py-2.5 px-3">Prize Share</th>
                    <th className="py-2.5 px-3 text-right">Settlement</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1f2737] bg-[#0d1017]">
                  {winnersList.map((w, idx) => (
                    <tr key={idx} className="hover:bg-white/[0.02]">
                      <td className="py-3 px-3 font-semibold text-white flex items-center gap-2 font-sans">
                        <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-300 text-[10px] flex items-center justify-center font-bold">
                          #{idx + 1}
                        </span>
                        <span>{w.user}</span>
                      </td>
                      <td className="py-3 px-3 font-bold text-amber-300">
                        {w.ticket}
                      </td>
                      <td className="py-3 px-3 font-black text-emerald-400 text-sm">
                        {w.prize}
                      </td>
                      <td className="py-3 px-3 text-right">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          {w.status || 'Disbursed'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Settlement Guarantee Notice */}
          <div className="p-3 rounded-xl bg-[#07090e] border border-[#272a31] flex items-center justify-between text-[11px] text-[#9b8f7c]">
            <span className="flex items-center gap-1 text-emerald-400 font-medium">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              100% USDT Distributed Directly to Winners' Wallets
            </span>
            <span className="font-mono-numbers text-white/80">
              Round #{event.id.replace('evt-', '').toUpperCase()}
            </span>
          </div>

        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-[#07090e] border-t border-[#1f2737] flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl bg-[#141924] hover:bg-[#1f2637] text-white text-xs font-bold transition-colors cursor-pointer"
          >
            Close Details
          </button>
        </div>

      </div>
    </div>
  );
}

export default function ResultsView() {
  const { events } = useLottery();
  const [selectedRoundFilter, setSelectedRoundFilter] = useState('all');
  const [viewMode, setViewMode] = useState('grid'); // 'grid' | 'table'
  const [selectedModalEvent, setSelectedModalEvent] = useState(null);

  const completedEvents = useMemo(() => {
    return events.filter(e => e.status === 'completed');
  }, [events]);

  // Combine real completed events with demo past results
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
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="font-display font-extrabold text-2xl sm:text-3xl text-white">
            Lottery <span className="text-[#ffd700]">Results</span>
          </h2>
          <p className="text-xs sm:text-sm text-[#9b8f7c] mt-0.5">
            Verified winning tickets and prize distributions for concluded rounds
          </p>
        </div>

        {/* View Mode Switcher (Compact Cards vs Compact Table) */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <div className="flex items-center bg-[#0b0e14] border border-[#272a31] rounded-xl p-1">
            <button
              onClick={() => setViewMode('grid')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                viewMode === 'grid'
                  ? 'bg-amber-500 text-black shadow-sm font-extrabold'
                  : 'text-[#9b8f7c] hover:text-white'
              }`}
              title="Compact Cards Grid"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>Compact Cards</span>
            </button>

            <button
              onClick={() => setViewMode('table')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                viewMode === 'table'
                  ? 'bg-amber-500 text-black shadow-sm font-extrabold'
                  : 'text-[#9b8f7c] hover:text-white'
              }`}
              title="Table Ledger View"
            >
              <List className="w-3.5 h-3.5" />
              <span>Compact Ledger</span>
            </button>
          </div>

          <span className="badge-provably-fair px-2.5 py-1.5 rounded-xl text-[11px] font-bold flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5 text-[#05d5aa]" />
            Verified
          </span>
        </div>
      </div>

      {/* Round Filter Tabs */}
      <div className="flex flex-wrap items-center gap-2 p-1.5 bg-[#0b0e14] rounded-xl border border-[#272a31]">
        <button
          onClick={() => setSelectedRoundFilter('all')}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
            selectedRoundFilter === 'all'
              ? 'bg-amber-500 text-black shadow-sm font-extrabold'
              : 'text-[#9b8f7c] hover:text-white hover:bg-[#141924]'
          }`}
        >
          <Layers className="w-3 h-3" />
          <span>All Rounds ({allResults.length})</span>
        </button>

        {allResults.map((evt) => (
          <button
            key={evt.id}
            onClick={() => setSelectedRoundFilter(evt.id)}
            className={`px-3 py-1.5 rounded-lg text-xs font-mono-numbers font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              selectedRoundFilter === evt.id
                ? 'bg-amber-500 text-black shadow-sm font-extrabold'
                : 'text-[#9b8f7c] hover:text-white hover:bg-[#141924]'
            }`}
          >
            <span>ROUND #{evt.id.replace('evt-', '').toUpperCase()}</span>
          </button>
        ))}
      </div>

      {/* RESULTS DISPLAY */}
      {filteredResults.length === 0 ? (
        <div className="glass-panel rounded-2xl p-8 text-center text-sm text-[#9b8f7c]">
          No past draws recorded yet.
        </div>
      ) : viewMode === 'grid' ? (
        
        /* 1. COMPACT 2-COLUMN CARDS GRID (Fixed height, perfectly balanced, zero stretching!) */
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
          {filteredResults.map((event) => {
            const winnerCount = event.winnerCount || 1;
            const winnersList = event.winners || [
              { rank: 1, user: '@LuckyWinner', ticket: `#${event.winningDigits || '7429'}`, prize: `${(event.poolPrize / winnerCount).toFixed(2)} USDT`, status: 'Disbursed' }
            ];

            return (
              <div
                key={event.id}
                className="glass-panel rounded-2xl p-5 border border-amber-500/30 flex flex-col justify-between relative overflow-hidden shadow-md hover:border-amber-400/50 transition-all h-full"
              >
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-[#ffd700] to-transparent" />

                <div>
                  {/* Card Header: Round ID, Badge, Concluded Date, Jackpot */}
                  <div className="flex items-start justify-between gap-3 pb-3 mb-3 border-b border-[#1f2737]">
                    <div>
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <span className="font-mono-numbers font-extrabold text-[11px] text-amber-300 bg-black/60 px-2 py-0.5 rounded border border-amber-500/40">
                          ROUND #{event.id.replace('evt-', '').toUpperCase()}
                        </span>
                        <span className="badge-gold px-2 py-0.2 rounded text-[10px] font-bold font-mono-numbers">
                          {event.badge || 'CONCLUDED'}
                        </span>
                        <span className="text-[11px] text-[#9b8f7c] font-mono-numbers flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {new Date(event.drawTime).toLocaleDateString()}
                        </span>
                      </div>

                      <h3 className="font-display font-black text-lg text-white">
                        {event.title}
                      </h3>
                    </div>

                    <div className="text-right shrink-0 bg-[#07090e] px-3 py-1.5 rounded-xl border border-[#272a31]">
                      <span className="text-[9px] uppercase font-bold text-[#9b8f7c] block">Jackpot</span>
                      <span className="font-display font-black text-base text-[#ffd700] font-mono-numbers">
                        {event.poolPrize.toLocaleString()} USDT
                      </span>
                    </div>
                  </div>

                  {/* Winning Combination / Numbers Section */}
                  <div className="bg-[#07090e] p-3.5 rounded-xl border border-[#272a31] mb-3">
                    <div className="flex items-center justify-between text-[11px] text-[#9b8f7c] mb-2 font-mono-numbers">
                      <span className="text-emerald-400 font-bold uppercase tracking-wider flex items-center gap-1">
                        <Trophy className="w-3.5 h-3.5 text-emerald-400" />
                        {winnerCount > 1 ? `Winning Drawn Tickets (${winnerCount} Lucky Winners)` : 'Official Winning Combination'}
                      </span>
                      <span className="text-[10px] text-amber-400 font-semibold">
                        {winnerCount > 1 ? `${winnerCount} Distinct Winners` : '1 Grand Winner'}
                      </span>
                    </div>

                    {/* Multi-Winner Different Numbers OR Single 4-Digit Balls */}
                    {winnerCount > 1 ? (
                      /* Display multiple different lucky winning tickets */
                      <div className="flex flex-wrap items-center gap-2 py-1">
                        {winnersList.map((w, idx) => (
                          <div 
                            key={idx}
                            className="bg-[#10141f] border border-amber-500/40 px-2.5 py-1 rounded-lg flex items-center gap-1.5 shadow-sm"
                          >
                            <span className="w-4 h-4 rounded-full bg-amber-500/20 text-amber-300 font-bold text-[9px] flex items-center justify-center">
                              #{idx + 1}
                            </span>
                            <span className="font-mono-numbers font-black text-sm text-[#05d5aa] tracking-wider">
                              {w.ticket}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      /* Single Winner: 4-digit Spheres (Compact & Elegant) */
                      <div className="flex items-center gap-2 py-1">
                        {event.winningDigits ? event.winningDigits.split('').map((char, idx) => (
                          <div
                            key={idx}
                            className="w-10 h-10 rounded-xl bg-gradient-to-b from-[#192233] to-[#0c0f17] border border-[#05d5aa] flex items-center justify-center font-display font-black text-xl text-[#05d5aa] shadow-[0_0_12px_rgba(5,213,170,0.2)]"
                          >
                            {char}
                          </div>
                        )) : (
                          <span className="text-white text-xs font-mono-numbers">Pending Draw</span>
                        )}
                        <div className="ml-2 pl-3 border-l border-[#272a31] text-[11px] text-[#9b8f7c]">
                          <span className="text-white font-semibold block">{winnersList[0]?.user || 'Winner'}</span>
                          <span className="text-emerald-400 font-mono-numbers font-bold">{winnersList[0]?.prize || `${event.poolPrize} USDT`} Disbursed</span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Summary Outcome line */}
                  <div className="text-[11px] text-[#9b8f7c] mb-3 flex items-center justify-between">
                    <span>{event.winnerSummary}</span>
                    <span className="font-mono-numbers text-emerald-400 font-bold shrink-0 ml-2">
                      100% USDT Settled
                    </span>
                  </div>
                </div>

                {/* Footer: View Details Pop-up Button (Never stretches neighboring boxes!) */}
                <div className="pt-3 border-t border-[#1f2737] flex items-center justify-between mt-auto">
                  <span className="text-[10px] font-mono-numbers text-[#9b8f7c]">
                    Round #{event.id.replace('evt-', '').toUpperCase()}
                  </span>

                  <button
                    onClick={() => setSelectedModalEvent(event)}
                    className="text-xs text-amber-400 hover:text-black font-bold flex items-center gap-1.5 transition-all cursor-pointer py-1.5 px-3 rounded-lg bg-amber-500/10 hover:bg-amber-400 border border-amber-500/30 shadow-sm"
                  >
                    <span>View Winners Details ({winnerCount})</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </button>
                </div>

              </div>
            );
          })}
        </div>

      ) : (

        /* 2. COMPACT TABLE LEDGER VIEW */
        <div className="glass-panel rounded-2xl overflow-hidden border border-[#272a31]">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono-numbers">
              <thead className="bg-[#0b0e14] text-[#9b8f7c] uppercase text-[10px] border-b border-[#272a31]">
                <tr>
                  <th className="py-3 px-4">Round ID</th>
                  <th className="py-3 px-4">Lottery Event</th>
                  <th className="py-3 px-4">Concluded Date</th>
                  <th className="py-3 px-4">Jackpot Pot</th>
                  <th className="py-3 px-4">Winning Drawn Tickets</th>
                  <th className="py-3 px-4">Winners</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1f2737] bg-[#0d1017]">
                {filteredResults.map((event) => {
                  const winnerCount = event.winnerCount || 1;
                  const winnersList = event.winners || [];

                  return (
                    <tr key={event.id} className="hover:bg-white/[0.03] transition-colors">
                      <td className="py-3.5 px-4 font-bold text-amber-300">
                        #{event.id.replace('evt-', '').toUpperCase()}
                      </td>

                      <td className="py-3.5 px-4 font-sans font-bold text-white">
                        {event.title}
                        <span className="block text-[10px] font-mono-numbers text-[#9b8f7c] font-normal">
                          {event.badge}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-[#9b8f7c]">
                        {new Date(event.drawTime).toLocaleDateString()}
                      </td>

                      <td className="py-3.5 px-4 font-black text-sm text-[#ffd700]">
                        {event.poolPrize.toLocaleString()} USDT
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="flex flex-wrap items-center gap-1.5">
                          {winnerCount > 1 ? (
                            winnersList.map((w, idx) => (
                              <span 
                                key={idx}
                                className="bg-[#10141f] border border-amber-500/30 px-1.5 py-0.5 rounded text-[11px] text-[#05d5aa] font-bold"
                              >
                                {w.ticket}
                              </span>
                            ))
                          ) : (
                            <span className="bg-black/60 border border-[#05d5aa]/40 px-2 py-0.5 rounded text-xs text-[#05d5aa] font-black">
                              #{event.winningDigits}
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#141924] border border-[#272a31] text-white">
                          {winnerCount} {winnerCount > 1 ? 'Lucky Winners' : 'Winner'}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <button
                          onClick={() => setSelectedModalEvent(event)}
                          className="px-2.5 py-1 rounded-md text-[11px] font-bold bg-amber-500/15 hover:bg-amber-400 hover:text-black text-amber-400 border border-amber-500/30 transition-all cursor-pointer"
                        >
                          View Details
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

      )}

      {/* POP-UP WINNERS DETAILS MODAL (Zero grid disturbance!) */}
      {selectedModalEvent && (
        <WinnersDetailsModal 
          event={selectedModalEvent} 
          onClose={() => setSelectedModalEvent(null)} 
        />
      )}

    </div>
  );
}
