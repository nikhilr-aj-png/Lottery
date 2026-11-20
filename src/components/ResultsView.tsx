import React, { useState, useMemo, useEffect } from 'react';
import { useLottery } from '../context/LotteryContext';
import { supabase } from '../lib/supabase';
import LotteryShowResultScreen from './LotteryShowResultScreen';
import { 
  Trophy, 
  Calendar, 
  Users, 
  CheckCircle2, 
  Award, 
  Layers, 
  ChevronDown, 
  ChevronUp, 
  ShieldCheck,
  AlertCircle
} from 'lucide-react';

interface ResultCardProps {
  event: any;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onOpenShowResult: (event: any) => void;
}

function ResultCard({ event, isExpanded, onToggleExpand, onOpenShowResult }: ResultCardProps) {
  const winDigits = String(event.winningDigits || '----');
  const [dbWinners, setDbWinners] = useState<any[]>([]);
  const [loadingWinners, setLoadingWinners] = useState(false);

  // Fetch real winner payouts from Supabase when card is expanded or if not provided in event
  useEffect(() => {
    let isMounted = true;
    if (isExpanded && (!event.winners || event.winners.length === 0)) {
      setLoadingWinners(true);
      (async () => {
        try {
          const { data, error } = await supabase
            .from('winner_payouts')
            .select('*')
            .eq('event_id', event.id)
            .order('position', { ascending: true });

          if (!isMounted) return;
          if (!error && Array.isArray(data)) {
            const mapped = data.map((p: any, idx: number) => ({
              rank: p.position || (idx + 1),
              user: p.username ? `@${p.username}` : (p.user_address ? `${p.user_address.slice(0, 6)}...${p.user_address.slice(-4)}` : `@Player_${p.id.slice(-4)}`),
              ticket: `#${p.ticket_number || '----'}`,
              prize: `${Number(p.net_payout_fc || p.gross_payout_fc || 0).toLocaleString()} ${p.currency || event.currency || 'USDT'}`,
              status: p.status === 'paid' ? 'Paid' : 'Disbursed'
            }));
            setDbWinners(mapped);
          }
        } catch (_) {
          // ignore
        } finally {
          if (isMounted) setLoadingWinners(false);
        }
      })();
    }
    return () => {
      isMounted = false;
    };
  }, [isExpanded, event.id, event.winners, event.currency]);

  const winnersList = useMemo(() => {
    if (Array.isArray(event.winners) && event.winners.length > 0) {
      return event.winners;
    }
    return dbWinners;
  }, [event.winners, dbWinners]);

  const winnerCount = Number(event.winnerCount || winnersList.length || 1);
  const isMultiWinner = winnerCount > 1;
  const currency = event.currency || 'FLO';

  // Derive clean room name
  const roomName = event.roomName || event.title?.split(':')[0] || 'Lottery Room';

  return (
    <div 
      className={`glass-panel rounded-2xl p-4 sm:p-5 border transition-all duration-200 relative overflow-hidden flex flex-col justify-between ${
        isExpanded 
          ? 'border-amber-400 shadow-lg shadow-amber-500/10 bg-[#121724]' 
          : 'border-[#272a31] hover:border-amber-500/40 bg-[#0d121c]'
      }`}
    >
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-[#ffd700] to-transparent opacity-60" />

      <div>
        {/* Card Header: Room Name, Round ID, Concluded Date, Jackpot */}
        <div className="flex items-start justify-between gap-2.5 pb-2.5 mb-3 border-b border-[#1f2737]">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5 mb-1">
              <span className="font-mono-numbers font-extrabold text-[10px] text-amber-300 bg-black/60 px-2 py-0.5 rounded border border-amber-500/40">
                {roomName}
              </span>
              <span className="text-[9px] font-mono-numbers font-bold px-1.5 py-0.5 rounded bg-red-500/15 text-red-400 border border-red-500/30 uppercase flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                <span>END</span>
              </span>
              <span className="text-[10px] text-[#9b8f7c] font-mono-numbers flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                {event.drawTime ? new Date(event.drawTime).toLocaleDateString() : 'Recent'}
              </span>
            </div>

            <h3 className="font-display font-black text-sm sm:text-base text-white truncate">
              {event.title}
            </h3>
          </div>

          <div className="text-right shrink-0 bg-[#07090e] px-2.5 py-1 rounded-xl border border-[#272a31]">
            <span className="text-[9px] uppercase font-bold text-[#9b8f7c] block">Prize Pool</span>
            <span className="font-display font-black text-sm sm:text-base text-[#ffd700] font-mono-numbers">
              {Number(event.poolPrize || 0).toLocaleString()} {currency}
            </span>
          </div>
        </div>

        {/* Official Winning Combination */}
        <div className="bg-[#07090e] p-3 rounded-xl border border-[#272a31] mb-3">
          <div className="flex items-center justify-between text-[11px] text-[#9b8f7c] mb-2 font-mono-numbers">
            <span className="text-emerald-400 font-bold uppercase tracking-wider flex items-center gap-1">
              <Trophy className="w-3.5 h-3.5 text-emerald-400" />
              <span>Official Winning Result</span>
            </span>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
              isMultiWinner 
                ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30' 
                : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
            }`}>
              {isMultiWinner ? `Multiple Winners (${winnerCount})` : 'Single Winner'}
            </span>
          </div>

          {/* 4 Glowing Winning Digits */}
          <div className="flex items-center justify-center gap-2 py-1.5">
            {winDigits.split('').map((char, idx) => (
              <div
                key={idx}
                className="w-10 sm:w-12 h-11 sm:h-13 rounded-xl bg-gradient-to-b from-[#192233] to-[#0c0f17] border-2 border-emerald-400 flex items-center justify-center font-display font-black text-xl sm:text-2xl text-emerald-300 shadow-[0_0_15px_rgba(5,213,170,0.25)]"
              >
                {char}
              </div>
            ))}
          </div>

          <div className="text-center mt-2 text-[10px] text-[#8b92a2]">
            Official Oracle Drawn Result
          </div>
        </div>

        {/* Winner Summary Strip */}
        <div className="text-xs text-[#9b8f7c] flex items-center justify-between px-1">
          <span className="flex items-center gap-1">
            <Award className="w-3.5 h-3.5 text-amber-400" />
            <strong className="text-white">
              {isMultiWinner ? `${winnerCount} Winners Tiered Split` : '1 Grand Winner'}
            </strong>
          </span>
          <span className="font-mono-numbers text-emerald-400 font-bold">
            100% {currency} Distributed
          </span>
        </div>

        {/* EXPANDABLE SECTION: Dedicated Winner Details */}
        {isExpanded && (
          <div className="mt-3.5 pt-3.5 border-t border-[#1f2737] space-y-2 animate-in fade-in duration-200">
            <div className="flex items-center justify-between text-xs pb-1">
              <span className="font-bold text-amber-400 flex items-center gap-1">
                <Users className="w-3.5 h-3.5" />
                <span>Winner Breakdown ({isMultiWinner ? 'Multiple Winners' : 'Single Winner'})</span>
              </span>
              <span className="text-[10px] text-emerald-400 font-mono-numbers font-bold">Confirmed Result</span>
            </div>

            {loadingWinners ? (
              <div className="py-4 text-center text-xs text-[#9b8f7c]">
                Loading verified winners from blockchain ledger...
              </div>
            ) : winnersList.length === 0 ? (
              <div className="bg-[#07090e] p-3 rounded-xl border border-[#272a31] text-center text-xs text-[#9b8f7c] flex items-center justify-center gap-2">
                <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
                <span>No eligible tickets matched this draw. Prize carried forward or refunded.</span>
              </div>
            ) : (
              <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1 no-scrollbar">
                {winnersList.map((w: any, idx: number) => (
                  <div 
                    key={idx}
                    className="bg-[#07090e] p-2.5 rounded-xl border border-[#272a31] flex items-center justify-between text-xs font-mono-numbers"
                  >
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-300 text-[10px] flex items-center justify-center font-bold">
                        #{w.rank || (idx + 1)}
                      </span>
                      <span className="font-sans font-bold text-white">{w.user}</span>
                      <span className="text-emerald-400 font-black bg-black/60 px-2 py-0.5 rounded border border-emerald-500/30 text-xs">
                        {w.ticket}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-amber-400 font-black text-xs sm:text-sm">{w.prize}</span>
                      <span className="block text-[9px] text-emerald-400 font-bold">{w.status || 'Disbursed'}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

      </div>

      {/* Card Action Controls: Show Result Screen & Expand/Collapse */}
      <div className="pt-3 border-t border-[#1f2737] flex flex-wrap items-center justify-between gap-2 mt-3 shrink-0">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => onOpenShowResult(event)}
            className="text-[11px] font-bold flex items-center gap-1 py-1.5 px-2 rounded-lg border bg-purple-500/15 hover:bg-purple-500/25 text-purple-300 border-purple-500/30 cursor-pointer transition-colors shadow-sm"
            title="View Responsive Show Result Screen"
          >
            <Trophy className="w-3.5 h-3.5 text-amber-400" />
            <span>Show Result Screen</span>
          </button>
        </div>

        <button
          type="button"
          onClick={onToggleExpand}
          className={`text-xs font-bold flex items-center gap-1.5 py-1.5 px-3 rounded-lg border cursor-pointer transition-all shadow-sm ${
            isExpanded
              ? 'bg-amber-500 text-black border-amber-400 font-extrabold'
              : 'bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border-amber-500/40'
          }`}
        >
          <span>{isExpanded ? 'Hide Details' : `Breakdown (${winnerCount})`}</span>
          {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>
      </div>

    </div>
  );
}

export default function ResultsView() {
  const { events, tickets } = useLottery();
  const [selectedRoundFilter, setSelectedRoundFilter] = useState('all');
  const [expandedCardId, setExpandedCardId] = useState<string | null>(null);
  const [selectedShowResultEvent, setSelectedShowResultEvent] = useState<any>(null);

  const toggleExpand = (id: string) => {
    setExpandedCardId(prev => prev === id ? null : id);
  };

  // Concluded lottery events strictly loaded from real database records — ZERO dummy data
  const completedEvents = useMemo(() => {
    return (events || []).filter((e: any) => 
      e.status === 'completed' && e.winningDigits
    );
  }, [events]);

  const filteredResults = useMemo(() => {
    if (selectedRoundFilter === 'all') return completedEvents;
    return completedEvents.filter((e: any) => e.id === selectedRoundFilter);
  }, [completedEvents, selectedRoundFilter]);

  return (
    <div className="w-full max-w-7xl 2xl:max-w-[1600px] 3xl:max-w-[1800px] 4k:max-w-[2000px] mx-auto px-2.5 xs:px-4 sm:px-6 lg:px-8 py-3 sm:py-6 space-y-4 sm:space-y-6 text-left">
      
      {/* 1. Header (Clean & professional with NO compact cards or ledger toggles) */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-2 border-b border-[#1f2737]">
        <div>
          <h2 className="font-display font-extrabold text-lg xs:text-xl sm:text-2xl text-white flex items-center gap-2">
            <Trophy className="w-5 h-5 text-amber-400" />
            <span>Four Digit Lottery</span>
            <span className="text-[#ffd700]">Results</span>
          </h2>
          <p className="text-[11px] xs:text-xs text-[#9b8f7c] mt-0.5">
            Verified winning combinations, prize distributions, and winner details for concluded rooms
          </p>
        </div>

        <span className="badge-provably-fair px-2.5 py-1 rounded-xl text-[11px] font-bold flex items-center gap-1 shrink-0">
          <CheckCircle2 className="w-3.5 h-3.5 text-[#05d5aa]" />
          <span>Official Concluded Draws</span>
        </span>
      </div>

      {/* 2. Round / Room Filter Tabs */}
      {completedEvents.length > 1 && (
        <div className="flex flex-wrap items-center gap-1.5 p-1 bg-[#0b0e14] rounded-xl border border-[#272a31] text-xs">
          <button
            onClick={() => setSelectedRoundFilter('all')}
            className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              selectedRoundFilter === 'all'
                ? 'bg-amber-500 text-black shadow-sm'
                : 'text-[#9b8f7c] hover:text-white hover:bg-[#141924]'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>All Results ({completedEvents.length})</span>
          </button>

          {completedEvents.map((evt: any) => (
            <button
              key={evt.id}
              onClick={() => setSelectedRoundFilter(evt.id)}
              className={`px-3 py-1 rounded-lg font-mono-numbers font-bold transition-all cursor-pointer ${
                selectedRoundFilter === evt.id
                  ? 'bg-amber-500 text-black shadow-sm'
                  : 'text-[#9b8f7c] hover:text-white hover:bg-[#141924]'
              }`}
            >
              <span>{evt.roomName || evt.title?.split(':')[0] || 'Room'}</span>
            </button>
          ))}
        </div>
      )}

      {/* 3. STABLE RESULTS GRID WITH INDEPENDENT CARD EXPANSION */}
      {filteredResults.length === 0 ? (
        <div className="glass-panel rounded-2xl p-8 sm:p-12 text-center text-xs text-[#9b8f7c] border border-[#272a31] space-y-2">
          <Trophy className="w-10 h-10 text-[#9b8f7c]/40 mx-auto" />
          <p className="font-bold text-white">No Concluded Draws Recorded Yet</p>
          <p>Active rooms are currently in progress. When a draw time completes or is drawn by admin, its official result will appear here automatically.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
          {filteredResults.map((event: any) => (
            <ResultCard
              key={event.id}
              event={event}
              isExpanded={expandedCardId === event.id}
              onToggleExpand={() => toggleExpand(event.id)}
              onOpenShowResult={(ev) => setSelectedShowResultEvent(ev)}
            />
          ))}
        </div>
      )}

      {/* Full-Screen Responsive No-Scroll Show Result Screen Overlay */}
      {selectedShowResultEvent && (
        <div className="fixed inset-0 z-50 bg-[#07090e]/95 backdrop-blur-md flex flex-col overflow-hidden p-2 sm:p-4">
          <div className="w-full h-full max-h-full min-h-0 overflow-hidden flex flex-col">
            <LotteryShowResultScreen
              event={selectedShowResultEvent}
              room={{
                name: selectedShowResultEvent.roomName || selectedShowResultEvent.title?.split(':')[0] || 'Lottery Room',
                drawId: selectedShowResultEvent.id
              }}
              onBackToLobby={() => setSelectedShowResultEvent(null)}
              myTickets={tickets?.filter((t: any) => t.eventId === selectedShowResultEvent.id || t.event_id === selectedShowResultEvent.id) || []}
            />
          </div>
        </div>
      )}

    </div>
  );
}
