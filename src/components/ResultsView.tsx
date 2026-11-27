import React, { useState, useMemo } from 'react';
import { useLottery } from '../context/LotteryContext';
import LotteryCard from './LotteryCard';
import LotteryShowResultScreen from './LotteryShowResultScreen';
import { 
  Trophy, 
  CheckCircle2, 
  Clock,
  Layers,
  X
} from 'lucide-react';

/**
 * Four Digit Lottery - Results View
 * Standardized to display ended lottery events using the official LotteryCard design.
 * 
 * Strict Features:
 * 1. Uses the standard LotteryCard from the Available Pool in mode="result".
 * 2. Deduplicates events strictly by event.id (no duplicate cards).
 * 3. Shows ONLY ended events (within retention period) — no active/upcoming pools.
 * 4. Differentiates declared results vs ended events pending official declaration.
 * 5. Clicking "Show Result" or clicking the card opens that exact event in LotteryShowResultScreen.
 */
export default function ResultsView() {
  const { events, tickets, platformSettings, getServerNowMs } = useLottery();
  const [statusFilter, setStatusFilter] = useState<'pending' | 'declared'>('pending');
  const [selectedShowResultEvent, setSelectedShowResultEvent] = useState<any>(null);

  const retentionHours = useMemo(() => {
    const raw =
      platformSettings?.resultsRetentionHours ??
      platformSettings?.resultsRetention?.duration_hours ??
      platformSettings?.resultsRetention?.retention_duration_hours ??
      1.0;
    const parsed = Number(raw);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 1.0;
  }, [platformSettings?.resultsRetentionHours, platformSettings?.resultsRetention]);

  // Filter and deduplicate strictly to ended events; 1-hour countdown begins ONLY from finalizedAtMs
  const endedEvents = useMemo(() => {
    const seenIds = new Set<string>();
    const list: any[] = [];
    const now = getServerNowMs ? getServerNowMs() : Date.now();
    const retentionMs = retentionHours * 3600 * 1000;

    (events || []).forEach((e: any) => {
      if (!e || !e.id || seenIds.has(e.id) || e.isDeleted || e.status === 'deleted') return;

      const isFinalizedCompleted =
        e.status === 'completed' && Boolean(e.finalizedAtMs || e.drawExecutedAt || e.winningDigits);
      const isPendingOrExpired = Boolean(
        e.status === 'result_pending' ||
          e.status === 'expired' ||
          (!isFinalizedCompleted && e.drawTime && new Date(e.drawTime).getTime() <= now)
      );

      if (isFinalizedCompleted || isPendingOrExpired) {
        if (isFinalizedCompleted) {
          const visDeadlineMs =
            e.ticketVisibilityUntilMs ||
            (e.finalizedAtMs
              ? e.finalizedAtMs + retentionMs
              : e.drawExecutedAt
                ? new Date(e.drawExecutedAt).getTime() + retentionMs
                : 0);
          if (visDeadlineMs > 0 && now > visDeadlineMs) {
            return;
          }
        }
        seenIds.add(e.id);
        list.push(e);
      }
    });

    // Sort by finalization time or draw time descending (most recent first)
    return list.sort((a, b) => {
      const timeA = a.finalizedAtMs || (a.drawTime ? new Date(a.drawTime).getTime() : 0);
      const timeB = b.finalizedAtMs || (b.drawTime ? new Date(b.drawTime).getTime() : 0);
      return timeB - timeA;
    });
  }, [events, retentionHours, getServerNowMs]);

  // Declared vs Pending strictly driven by official finalization state in backend
  const declaredEvents = useMemo(() => {
    return endedEvents.filter(
      (e) =>
        e.status === 'completed' &&
        Boolean(e.finalizedAtMs || e.drawExecutedAt) &&
        Boolean(e.winningDigits)
    );
  }, [endedEvents]);

  const pendingEvents = useMemo(() => {
    return endedEvents.filter(
      (e) =>
        e.status !== 'completed' ||
        !Boolean(e.finalizedAtMs || e.drawExecutedAt) ||
        !Boolean(e.winningDigits)
    );
  }, [endedEvents]);

  // Filtered list based on active tab: ONLY 'pending' and 'declared'
  const displayEvents = useMemo(() => {
    return statusFilter === 'declared' ? declaredEvents : pendingEvents;
  }, [statusFilter, declaredEvents, pendingEvents]);

  return (
    <div className="w-full max-w-7xl 2xl:max-w-[1600px] 3xl:max-w-[1800px] mx-auto px-3 xs:px-4 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-5 text-left select-none">
      
      {/* 1. Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-[#1F2737]">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Trophy className="w-4.5 h-4.5" />
            </div>
            <h1 className="font-display font-black text-xl sm:text-2xl text-white">
              Four Digit Lottery <span className="text-amber-400">Results</span>
            </h1>
          </div>
          <p className="text-xs text-[#94A3B8] mt-1">
            Official winning numbers, prize distributions, and declared results for ended lucky draws
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs font-mono-numbers">
          <span className="px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-bold inline-flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Official Records</span>
          </span>
        </div>
      </div>

      {/* 2. Filter Pills — Strictly 2 Status Options (No "All" or "Concluded Draw") */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
        {[
          { key: 'pending', label: `Pending Official Declaration (${pendingEvents.length})` },
          { key: 'declared', label: `Official Declaration (${declaredEvents.length})` }
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setStatusFilter(tab.key as any)}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
              statusFilter === tab.key
                ? 'bg-amber-500 text-black font-extrabold shadow-md shadow-amber-500/20'
                : 'bg-[#111728] text-[#94A3B8] hover:text-white hover:bg-[#161D30] border border-[#1F2737]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* 3. Results Grid — Standard LotteryCard Design */}
      {displayEvents.length === 0 ? (
        <div className="bg-[#111728] rounded-2xl p-10 border border-[#1F2737] text-center max-w-md mx-auto space-y-3 mt-8">
          <div className="w-12 h-12 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 mx-auto">
            <Trophy className="w-6 h-6" />
          </div>
          <h3 className="font-display font-bold text-base text-white">
            {statusFilter === 'pending' ? 'No Draws Pending Official Declaration' : 'No Official Declarations Yet'}
          </h3>
          <p className="text-xs text-[#94A3B8] leading-relaxed">
            {statusFilter === 'pending'
              ? 'There are currently no concluded lottery events awaiting official result finalization by the admin.'
              : 'Once winning digits are officially declared and verified in the Admin Panel, finalized results will appear here.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6">
          {displayEvents.map((event: any) => (
            <LotteryCard
              key={event.id}
              event={event}
              mode="result"
              onShowResult={(ev) => setSelectedShowResultEvent(ev)}
              onSelect={(ev) => setSelectedShowResultEvent(ev)}
            />
          ))}
        </div>
      )}

      {/* 4. Full-Screen Responsive Show Result Screen Overlay */}
      {selectedShowResultEvent && (
        <div className="fixed inset-0 z-50 bg-[#07090E]/95 backdrop-blur-md flex flex-col overflow-hidden">
          {/* Header Close Bar */}
          <div className="flex items-center justify-between px-4 sm:px-6 py-2.5 bg-[#0B0F19] border-b border-[#1F2737] shrink-0">
            <span className="text-xs font-mono-numbers font-bold text-amber-400">
              #{selectedShowResultEvent.id}
            </span>
            <button
              onClick={() => setSelectedShowResultEvent(null)}
              className="px-3 py-1.5 rounded-xl bg-[#141924] hover:bg-[#1E2536] text-white border border-[#273145] text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer transition-colors"
              title="Close Result Screen"
            >
              <X className="w-4 h-4 text-amber-400" />
              <span>Close</span>
            </button>
          </div>

          <div className="flex-1 min-h-0 overflow-hidden">
            <LotteryShowResultScreen
              event={selectedShowResultEvent}
              room={{
                name: selectedShowResultEvent.roomName || selectedShowResultEvent.title?.split(':')[0] || 'Lottery Room',
                drawId: selectedShowResultEvent.id
              }}
              onBackToLobby={() => setSelectedShowResultEvent(null)}
              myTickets={(tickets || []).filter((t: any) => t.eventId === selectedShowResultEvent.id || t.event_id === selectedShowResultEvent.id)}
            />
          </div>
        </div>
      )}

    </div>
  );
}
