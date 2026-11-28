import React, { useMemo, useState, useEffect } from 'react';
import { useLottery } from '../context/LotteryContext';
import {
  Ticket,
  Clock,
  Lock,
  LogIn,
  ArrowRight,
  Search,
  ChevronDown,
  ChevronUp,
  X,
  AlertCircle,
  Calendar,
  Hash,
  Eye,
  Compass
} from 'lucide-react';
import { getEventStatusInfo } from '../utils/eventStatus';

interface MyTicketsViewProps {
  onExploreEvents?: () => void;
  onNavigateToRoom?: (eventOrRoomId: string) => void;
}

function formatTimestamp(ms?: number | string | null): string {
  if (!ms) return '—';
  const num = typeof ms === 'number' ? ms : new Date(ms).getTime();
  if (!Number.isFinite(num) || num <= 0) return '—';
  return new Date(num).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function formatRemainingCountdown(remainingMs: number): string {
  if (!Number.isFinite(remainingMs) || remainingMs <= 0) return '00:00:00';
  const totalSec = Math.floor(remainingMs / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/**
 * View-Only My Tickets Dashboard (Strictly Active Events Only)
 * - Displays ONLY tickets belonging to currently Active, non-expired events.
 * - As soon as an event reaches its server expiration timestamp or leaves Active status,
 *   all its tickets (winners and losers alike) disappear immediately without refresh.
 * - Expired ticket records remain preserved in Supabase; Official Results appear in ResultsView.
 */
export default function MyTicketsView({ onExploreEvents, onNavigateToRoom }: MyTicketsViewProps) {
  const {
    tickets,
    loadingTickets,
    ticketsError,
    fetchTickets,
    events,
    user,
    wallet,
    setIsAuthModalOpen,
    getServerNowMs,
    verifyRoomEntry,
    showToast
  } = useLottery();

  const [searchQuery, setSearchQuery] = useState('');
  const [expandedRooms, setExpandedRooms] = useState<Record<string, boolean>>({});
  const [selectedTicket, setSelectedTicket] = useState<any>(null);
  const [enteringRoomId, setEnteringRoomId] = useState<string | null>(null);
  const [nowTick, setNowTick] = useState<number>(() => (getServerNowMs ? getServerNowMs() : Date.now()));

  // Server-synchronized 1s tick for accurate countdown & instant removal on expiration
  useEffect(() => {
    const id = setInterval(() => {
      setNowTick(getServerNowMs ? getServerNowMs() : Date.now());
    }, 1000);
    return () => clearInterval(id);
  }, [getServerNowMs]);

  // Re-fetch authoritative Active-Only tickets on mount, window focus/reconnect, or periodic sync
  useEffect(() => {
    if (!user?.id || !fetchTickets) return;
    fetchTickets();
    const pollId = setInterval(() => {
      fetchTickets();
    }, 15000);
    return () => clearInterval(pollId);
  }, [user?.id]);

  // 1. Authenticated user's purchased tickets ONLY
  const myPurchasedTickets = useMemo(() => {
    if (!user && !wallet?.address) return [];
    return (tickets || []).filter(
      (t: any) =>
        (user?.id && (t.userId === user.id || t.user_id === user.id)) ||
        (wallet?.address && t.userAddress === wallet.address)
    );
  }, [tickets, user, wallet?.address]);

  // 2. Strictly retain ONLY tickets belonging to currently Active, non-expired events (NO Winner/Loser/Pending/Expired retention)
  const visibleActiveTickets = useMemo(() => {
    return myPurchasedTickets
      .map((tkt: any) => {
        const eventId = tkt.eventId || tkt.event_id || '';
        const matchedLive = (events || []).find((e: any) => e.id === eventId);

        const hasKnownEvent = Boolean(matchedLive || tkt.eventExists);
        const authoritativeEvent = matchedLive || {
          id: eventId || 'unknown',
          title: tkt.eventTitle || 'Lottery Draw Room',
          roomId: tkt.roomId || (eventId ? `room-${eventId}` : 'unknown-room'),
          roomName: tkt.roomName || tkt.eventTitle || 'Lottery Room',
          gameId: tkt.lotteryType || 'four-digit-lottery',
          startTime: tkt.startTime || 0,
          drawTime: tkt.drawTime || 0,
          durationValue: tkt.durationValue || 1,
          durationUnit: tkt.durationUnit || 'hours',
          status: hasKnownEvent ? tkt.eventStatus || 'expired' : 'expired',
          isActive: Boolean(tkt.eventIsActive),
          isDeleted: Boolean(tkt.eventIsDeleted),
          isPaused: Boolean(tkt.eventIsPaused),
          isFinalized: Boolean(tkt.isFinalized),
          finalizedAt: tkt.finalizedAt || null,
          finalizedAtMs: tkt.finalizedAtMs || 0,
          poolPrize: tkt.poolPrize || 0,
          currency: tkt.currency || 'USDT',
          isSyntheticFallback: !hasKnownEvent
        };

        const statusInfo = getEventStatusInfo(authoritativeEvent, undefined, nowTick);
        const rawStatus = String(authoritativeEvent.status || '').toLowerCase();
        const isStrictlyActiveEvent =
          !authoritativeEvent.isDeleted &&
          !authoritativeEvent.isPaused &&
          authoritativeEvent.isActive !== false &&
          !authoritativeEvent.isFinalized &&
          rawStatus === 'active' &&
          !statusInfo.isEnd &&
          statusInfo.expiresAtMs > 0 &&
          nowTick < statusInfo.expiresAtMs;

        if (!isStrictlyActiveEvent) {
          return null;
        }

        const rawTktNum = String(tkt.ticketNumber ?? tkt.ticket_number ?? tkt.digits ?? '0').replace(/\D/g, '');
        const tktNumber = rawTktNum.padStart(4, '0').slice(-4);
        const isUpcoming = statusInfo.isUpcoming;
        const roomId = authoritativeEvent.roomId || tkt.roomId || `room-${eventId}`;
        const roomName = authoritativeEvent.roomName || tkt.roomName || authoritativeEvent.title || 'Lottery Room';
        const lotteryType =
          authoritativeEvent.gameId === 'lottery' || tkt.lotteryType === 'lottery' || tkt.lotteryType === 'four-digit-lottery'
            ? 'Four-Digit Lottery'
            : String(tkt.lotteryType || 'Four-Digit Lottery');

        return {
          ...tkt,
          tktNumber,
          eventId,
          roomId,
          roomName,
          lotteryType,
          event: authoritativeEvent,
          eventTitle: authoritativeEvent.title || tkt.eventTitle || 'Lottery Draw Room',
          statusInfo,
          isUpcoming,
          isLive: !isUpcoming,
          isWon: false,
          isLost: false,
          isFinalized: false,
          isExpiredOrCompleted: false,
          hasOfficialResult: false,
          winningCodes: [],
          ticketStatusLabel: isUpcoming ? 'Starts Soon' : 'Active',
          price: Number(tkt.price || authoritativeEvent.ticketPrice || 10),
          currency: tkt.currency || authoritativeEvent.currency || 'USDT',
          purchaseTime: tkt.purchaseTime || tkt.createdAt || new Date().toISOString()
        };
      })
      .filter(Boolean);
  }, [myPurchasedTickets, events, nowTick]);

  // 3. Search filter across Active Tickets only
  const filteredTickets = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return visibleActiveTickets
      .filter((t: any) => {
        if (!q) return true;
        const matchesRoom = t.roomName.toLowerCase().includes(q) || String(t.roomId).toLowerCase().includes(q);
        const matchesEvent = String(t.eventTitle).toLowerCase().includes(q) || String(t.eventId).toLowerCase().includes(q);
        const matchesTicketId = String(t.id || '').toLowerCase().includes(q);
        const matchesNumber = t.tktNumber.includes(q.replace(/^#/, ''));
        return matchesRoom || matchesEvent || matchesTicketId || matchesNumber;
      })
      .sort((a: any, b: any) => new Date(b.purchaseTime).getTime() - new Date(a.purchaseTime).getTime());
  }, [visibleActiveTickets, searchQuery]);

  // 5. Group Tickets Strictly by Actual Room & Event Association (never mixing rooms)
  const roomGroups = useMemo(() => {
    const map = new Map<
      string,
      {
        groupKey: string;
        eventId: string;
        roomId: string;
        roomName: string;
        lotteryType: string;
        event: any;
        eventTitle: string;
        statusInfo: ReturnType<typeof getEventStatusInfo>;
        tickets: any[];
      }
    >();

    filteredTickets.forEach((tkt) => {
      const groupKey = `${tkt.roomId}::${tkt.eventId}`;
      if (!map.has(groupKey)) {
        map.set(groupKey, {
          groupKey,
          eventId: tkt.eventId,
          roomId: tkt.roomId,
          roomName: tkt.roomName,
          lotteryType: tkt.lotteryType,
          event: tkt.event,
          eventTitle: tkt.eventTitle,
          statusInfo: tkt.statusInfo,
          tickets: []
        });
      }
      map.get(groupKey)!.tickets.push(tkt);
    });

    return Array.from(map.values());
  }, [filteredTickets]);

  const toggleRoomExpanded = (groupKey: string) => {
    setExpandedRooms((prev) => ({ ...prev, [groupKey]: !(prev[groupKey] ?? true) }));
  };

  // Authoritative Enter Room Handler (Re-verifies server timestamp before opening route)
  const handleEnterActiveRoom = async (eventId: string, statusInfo: ReturnType<typeof getEventStatusInfo>) => {
    if (statusInfo.isEnd || statusInfo.isUpcoming || !eventId) {
      showToast?.('This event has expired. Room entry is no longer available.', 'error');
      return;
    }
    if (!onNavigateToRoom || enteringRoomId) return;

    setEnteringRoomId(eventId);
    try {
      if (verifyRoomEntry) {
        const res = await verifyRoomEntry(eventId);
        if (!res?.allowed) {
          showToast?.(res?.message || 'This event has expired. Room entry is no longer available.', 'error');
          if (fetchTickets) fetchTickets();
          return;
        }
      }
      onNavigateToRoom(eventId);
    } finally {
      setEnteringRoomId(null);
    }
  };

  // Unauthenticated gate
  if (!user && !wallet?.address) {
    return (
      <div className="w-full max-w-lg mx-auto px-4 py-16 text-center">
        <div className="bg-[#111728] rounded-3xl p-8 border border-amber-500/30 space-y-4 shadow-2xl">
          <div className="w-14 h-14 rounded-2xl bg-amber-500/15 border border-amber-500/40 flex items-center justify-center text-amber-400 mx-auto">
            <Lock className="w-7 h-7" />
          </div>
          <h3 className="font-display font-extrabold text-xl text-white">Sign In to View My Tickets</h3>
          <p className="text-xs text-[#94A3B8] leading-relaxed">
            Please log in to inspect your purchased 4-digit lottery tickets, room schedules, and official results.
          </p>
          <button
            type="button"
            onClick={() => setIsAuthModalOpen?.(true)}
            className="w-full py-2.5 rounded-xl btn-gold text-xs font-bold flex items-center justify-center gap-2 cursor-pointer shadow-md"
          >
            <LogIn className="w-4 h-4" />
            <span>Login to EarnFlow</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      data-testid="my-tickets-view"
      className="w-full max-w-[1400px] mx-auto px-2.5 xs:px-4 sm:px-6 lg:px-8 pt-3 pb-8 md:py-5 space-y-3.5 sm:space-y-4 text-left select-none box-border overflow-x-clip"
    >
      {/* ACTIVE TICKETS HEADER & SEARCH BAR */}
      <section className="bg-[#111728] border border-[#1F2737] rounded-2xl p-2.5 sm:p-3.5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-amber-500/15 border border-amber-500/35 flex items-center justify-center text-amber-400 shrink-0">
              <Ticket className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h1 className="font-display font-black text-sm sm:text-base text-white flex items-center gap-2">
                <span>Active My Tickets</span>
                <span
                  data-testid="my-tickets-active-count"
                  className="px-2 py-0.5 rounded-full text-[10px] font-mono-numbers bg-emerald-500/15 text-emerald-300 border border-emerald-500/30"
                >
                  {visibleActiveTickets.length} Active
                </span>
              </h1>
              <p className="text-[11px] text-[#94A3B8] truncate">
                Showing tickets for live ongoing draws only — check Results once draws conclude.
              </p>
            </div>
          </div>

          {/* Search Input */}
          <div className="relative w-full sm:w-72 shrink-0 min-w-0">
            <Search className="w-4 h-4 text-[#64748B] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              data-testid="tickets-search-input"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search Room, Event, Ticket #..."
              className="w-full min-h-[38px] bg-[#0B0F19] border border-[#253045] focus:border-amber-400 rounded-xl pl-9 pr-8 py-1.5 text-xs text-white placeholder:text-[#64748B] outline-none transition-colors"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                aria-label="Clear search"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#94A3B8] hover:text-white cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </section>

      {/* 4. ERROR STATE */}
      {ticketsError && (
        <div
          data-testid="my-tickets-error"
          className="rounded-2xl bg-rose-950/20 border border-rose-500/35 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
        >
          <div className="flex items-start gap-2.5 text-rose-200 text-xs sm:text-sm">
            <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
            <span>{ticketsError}</span>
          </div>
          <button
            type="button"
            onClick={() => fetchTickets?.()}
            className="btn-gold px-4 py-2 rounded-xl text-xs font-bold text-black cursor-pointer self-start sm:self-auto"
          >
            Retry
          </button>
        </div>
      )}

      {/* 5. LOADING SKELETON STATE */}
      {loadingTickets && visibleActiveTickets.length === 0 ? (
        <div
          data-testid="my-tickets-loading"
          className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4"
        >
          {[1, 2, 3].map((n) => (
            <div key={n} className="rounded-2xl bg-[#111728] border border-[#1F2737] p-5 space-y-4 animate-pulse">
              <div className="flex justify-between">
                <div className="h-5 w-32 bg-[#1F2737] rounded" />
                <div className="h-5 w-16 bg-[#1F2737] rounded" />
              </div>
              <div className="h-14 bg-[#0B0F19] rounded-xl border border-[#1F2737]" />
              <div className="h-14 bg-[#0B0F19] rounded-xl border border-[#1F2737]" />
            </div>
          ))}
        </div>
      ) : visibleActiveTickets.length === 0 ? (
        /* 6. EMPTY STATE (No Active-Event Tickets) */
        <div
          data-testid="my-tickets-empty"
          className="bg-[#111728] rounded-2xl p-8 sm:p-10 border border-[#1F2737] text-center max-w-md mx-auto space-y-3"
        >
          <div className="w-12 h-12 rounded-2xl bg-amber-500/15 border border-amber-500/35 flex items-center justify-center text-amber-400 mx-auto">
            <Ticket className="w-6 h-6" />
          </div>
          <h3 className="font-display font-bold text-base sm:text-lg text-white">
            No Active Tickets
          </h3>
          <p className="text-xs text-[#94A3B8] leading-relaxed">
            Only tickets belonging to currently active draws appear here. Once an event expires, view published outcomes on the Results page.
          </p>
          {onExploreEvents && (
            <button
              type="button"
              onClick={onExploreEvents}
              className="btn-gold px-4 py-2 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer mt-1"
            >
              <Compass className="w-3.5 h-3.5" />
              <span>Explore Events</span>
            </button>
          )}
        </div>
      ) : roomGroups.length === 0 ? (
        /* 7. NO SEARCH RESULTS STATE */
        <div
          data-testid="my-tickets-no-results"
          className="bg-[#111728] rounded-2xl p-8 border border-[#1F2737] text-center max-w-md mx-auto space-y-3"
        >
          <div className="w-11 h-11 rounded-xl bg-[#0B0F19] border border-[#253045] flex items-center justify-center text-amber-400 mx-auto">
            <Search className="w-5 h-5" />
          </div>
          <h3 className="font-display font-bold text-base text-white">
            No Matching Tickets
          </h3>
          <p className="text-xs text-[#94A3B8] leading-relaxed">
            No active tickets match your search query.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="px-4 py-2 rounded-xl bg-[#0B0F19] hover:bg-[#171F30] border border-[#253045] text-xs font-bold text-amber-300 cursor-pointer"
              >
                Show All Active Tickets ({visibleActiveTickets.length})
              </button>
            )}
          </div>
        </div>
      ) : (
        /* 8. ROOM-GROUPED TICKET CARDS (Single / Multi-Ticket Expandable / Multi-Room) */
        <div
          data-testid="my-tickets-room-grid"
          className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 lg:gap-5 items-start"
        >
          {roomGroups.map((group) => {
            const { groupKey, event, eventId, roomId, roomName, lotteryType, eventTitle, statusInfo, tickets: roomTickets } = group;
            const isExpanded = expandedRooms[groupKey] ?? true;
            const hasWin = roomTickets.some((t) => t.isWon);
            const totalRoomStake = roomTickets.reduce((sum, t) => sum + (t.price || 0), 0);
            const currency = event?.currency || 'USDT';
            const canEnterRoom = !statusInfo.isEnd && !statusInfo.isUpcoming && Boolean(onNavigateToRoom);

            return (
              <article
                key={groupKey}
                data-testid={`room-group-card-${roomId}`}
                className={`bg-[#0D121D] rounded-2xl border p-4 sm:p-5 flex flex-col justify-between relative overflow-hidden min-w-0 box-border ${hasWin
                  ? 'border-emerald-500/45 shadow-lg shadow-emerald-500/10'
                  : statusInfo.isEnd
                    ? 'border-[#1F2737] opacity-95'
                    : 'border-amber-500/30 shadow-lg'
                  }`}
              >
                {/* Top Status Accent Stripe */}
                <div
                  className={`absolute top-0 left-0 right-0 h-1 ${hasWin
                    ? 'bg-gradient-to-r from-emerald-500 via-amber-400 to-emerald-500'
                    : statusInfo.isEnd
                      ? 'bg-slate-700'
                      : statusInfo.isUpcoming
                        ? 'bg-blue-500'
                        : 'bg-gradient-to-r from-amber-500 via-amber-300 to-emerald-400'
                    }`}
                />

                <div className="space-y-3 min-w-0">
                  {/* Room Metadata Header */}
                  <div className="flex items-start justify-between gap-2 pb-3 border-b border-[#1F2737] min-w-0">
                    <div className="min-w-0 space-y-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="px-2 py-0.5 rounded-md bg-amber-500/10 border border-amber-500/25 text-amber-300 font-mono-numbers font-bold text-[10px] truncate max-w-[160px]">
                          {lotteryType}
                        </span>
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9.5px] font-mono-numbers font-bold uppercase whitespace-nowrap ${statusInfo.isFinalized
                            ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-300'
                            : statusInfo.isEnd
                              ? 'bg-amber-500/15 border border-amber-500/30 text-amber-300'
                              : statusInfo.badgeClass
                            }`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${statusInfo.dotClass}`} />
                          <span>
                            {statusInfo.isFinalized
                              ? 'COMPLETED'
                              : statusInfo.isEnd
                                ? 'EXPIRED · PENDING RESULT'
                                : statusInfo.label}
                          </span>
                        </span>
                      </div>

                      <h3
                        className="font-display font-bold text-sm sm:text-base text-white break-words leading-snug"
                        title={roomName}
                      >
                        {roomName}
                      </h3>

                      <div className="text-[10px] text-[#94A3B8] font-mono-numbers truncate">
                        Room ID: <span className="text-[#CBD5E1]">{roomId}</span>
                      </div>
                    </div>

                    <div className="text-right shrink-0 bg-[#121724] px-2.5 py-1.5 rounded-xl border border-[#1F2737]">
                      <span className="text-[9px] uppercase font-bold text-[#94A3B8] block">Held</span>
                      <span className="font-mono-numbers font-bold text-xs text-white whitespace-nowrap">
                        {roomTickets.length} {roomTickets.length === 1 ? 'Ticket' : 'Tickets'}
                      </span>
                    </div>
                  </div>

                  {/* Authoritative Schedule & Stake Bar */}
                  <div className="grid grid-cols-2 gap-2 p-2.5 rounded-xl bg-[#111728] border border-[#1F2737] text-[10px] font-mono-numbers">
                    <div className="min-w-0">
                      <span className="text-[#64748B] block uppercase">Start Time</span>
                      <span className="text-white truncate block">{formatTimestamp(statusInfo.startTimeMs || event?.createdAt)}</span>
                    </div>
                    <div className="min-w-0 text-right">
                      <span className="text-[#64748B] block uppercase">
                        {statusInfo.isEnd ? 'Expired At' : 'Expires In'}
                      </span>
                      <span className={`${statusInfo.isEnd ? 'text-rose-300' : 'text-emerald-400 font-bold'} truncate block`}>
                        {statusInfo.isEnd
                          ? formatTimestamp(statusInfo.expiresAtMs || event?.drawTime)
                          : formatRemainingCountdown(statusInfo.remainingMs)}
                      </span>
                    </div>
                    <div className="min-w-0 pt-1 border-t border-[#1F2737]/70">
                      <span className="text-[#64748B]">Staked: </span>
                      <strong className="text-white">{totalRoomStake.toFixed(2)} {currency}</strong>
                    </div>
                    <div className="min-w-0 text-right pt-1 border-t border-[#1F2737]/70">
                      <span className="text-[#64748B]">Event: </span>
                      <strong className="text-amber-300 truncate">{eventTitle}</strong>
                    </div>
                  </div>

                  {/* Multi-Ticket Group Toggle when room holds > 1 ticket */}
                  {roomTickets.length > 1 && (
                    <button
                      type="button"
                      onClick={() => toggleRoomExpanded(groupKey)}
                      className="w-full flex items-center justify-between px-3 py-1.5 rounded-xl bg-[#111728] hover:bg-[#171E2E] border border-[#1F2737] text-[11px] font-bold text-[#CBD5E1] cursor-pointer transition-colors"
                    >
                      <span>{roomTickets.length} Purchased Tickets in this Room</span>
                      {isExpanded ? <ChevronUp className="w-4 h-4 text-amber-400" /> : <ChevronDown className="w-4 h-4 text-amber-400" />}
                    </button>
                  )}

                  {/* Ticket List inside Room Card */}
                  {(roomTickets.length === 1 || isExpanded) && (
                    <div className="max-h-60 overflow-y-auto space-y-2 pr-0.5 ef-subtle-scroll overscroll-contain">
                      {roomTickets.map((tkt, idx) => (
                        <button
                          key={tkt.id || idx}
                          type="button"
                          onClick={() => setSelectedTicket(tkt)}
                          data-testid={`ticket-row-${tkt.id}`}
                          className={`w-full text-left p-2.5 rounded-xl border flex items-center justify-between gap-2 transition-colors cursor-pointer group ${tkt.isWon
                            ? 'bg-emerald-950/20 border-emerald-500/40 hover:border-emerald-400'
                            : 'bg-[#111728] border-[#1F2737] hover:border-amber-500/45'
                            }`}
                        >
                          <div className="space-y-1 min-w-0">
                            {/* Preserved Leading-Zero 4-Digit Tiles */}
                            <div className="flex items-center gap-1 font-mono-numbers font-black text-xs sm:text-sm">
                              {tkt.tktNumber.split('').map((digit: string, dIdx: number) => (
                                <span
                                  key={dIdx}
                                  className={`w-6.5 h-6.5 xs:w-7 xs:h-7 rounded-lg flex items-center justify-center border ${tkt.isWon
                                    ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300'
                                    : 'bg-[#090D16] border-[#2A354A] text-amber-300'
                                    }`}
                                >
                                  {digit}
                                </span>
                              ))}
                            </div>
                            <div className="text-[10px] text-[#94A3B8] font-mono-numbers truncate">
                              ID: {String(tkt.id).slice(0, 16)}...
                            </div>
                          </div>

                          <div className="text-right shrink-0 space-y-0.5">
                            <span
                              className={`inline-block px-2 py-0.5 rounded-md text-[9.5px] font-mono-numbers font-bold uppercase ${tkt.isWon
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                                : tkt.isLost
                                  ? 'bg-slate-800 text-slate-300 border border-slate-700'
                                  : tkt.isExpiredOrCompleted
                                    ? 'bg-rose-500/15 text-rose-300 border border-rose-500/30'
                                    : 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                                }`}
                            >
                              {tkt.isWon ? `+${tkt.wonAmount} ${currency}` : tkt.ticketStatusLabel}
                            </span>
                            <div className="text-[10px] text-[#94A3B8] font-mono-numbers flex items-center justify-end gap-1">
                              <span>{tkt.price} {currency}</span>
                              <Eye className="w-3 h-3 text-amber-400 opacity-75 group-hover:opacity-100" />
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Card Footer: Active Purchase Date OR Enter Room */}
                <div className="pt-3 mt-3 border-t border-[#1F2737] flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-col gap-0.5 min-w-0">
                    <span className="text-[10px] text-[#94A3B8] font-mono-numbers">
                      {`Purchased ${formatTimestamp(roomTickets[0]?.purchaseTime)}`}
                    </span>
                  </div>

                  {canEnterRoom ? (
                    <button
                      type="button"
                      data-testid={`enter-room-btn-${eventId}`}
                      disabled={enteringRoomId === eventId}
                      onClick={() => handleEnterActiveRoom(eventId, statusInfo)}
                      className="px-3 py-1.5 rounded-xl btn-gold text-[11px] font-extrabold text-black inline-flex items-center gap-1 cursor-pointer shadow-md whitespace-nowrap disabled:opacity-50"
                    >
                      <span>{enteringRoomId === eventId ? 'Checking...' : 'Enter Room'}</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  ) : (
                    <span className="text-[10px] font-mono-numbers font-bold text-[#64748B] inline-flex items-center gap-1">
                      <Lock className="w-3 h-3" />
                      <span>{statusInfo.isUpcoming ? 'Opens Soon' : 'Room Closed'}</span>
                    </span>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* 9. RESPONSIVE TICKET DETAILS MODAL / MOBILE BOTTOM SHEET */}
      {selectedTicket && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Ticket Details"
          data-testid="ticket-details-modal"
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={() => setSelectedTicket(null)}
        >
          <div
            className="w-full sm:max-w-lg bg-[#111728] border border-amber-500/35 rounded-t-3xl sm:rounded-2xl p-5 sm:p-6 space-y-4 shadow-2xl max-h-[88dvh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 pb-3 border-b border-[#1F2737]">
              <div className="space-y-1 min-w-0">
                <span className="text-[10px] uppercase font-mono-numbers font-bold text-amber-400">
                  {selectedTicket.lotteryType}
                </span>
                <h2 className="font-display font-black text-lg text-white truncate">
                  {selectedTicket.roomName}
                </h2>
                <p className="text-[11px] font-mono-numbers text-[#94A3B8] truncate">
                  Ticket #{selectedTicket.tktNumber} · ID: {selectedTicket.id}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedTicket(null)}
                aria-label="Close ticket details"
                className="w-8 h-8 rounded-lg bg-[#0B0F19] border border-[#253045] text-[#94A3B8] hover:text-white flex items-center justify-center cursor-pointer shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Ticket 4-Digit Showcase */}
            <div className="p-4 rounded-xl bg-[#0B0F19] border border-[#1F2737] flex flex-col items-center gap-2">
              <span className="text-[10px] uppercase font-bold tracking-wider text-[#94A3B8]">
                Selected 4-Digit Ticket Number
              </span>
              <div className="flex items-center gap-2 font-mono-numbers font-black text-2xl">
                {selectedTicket.tktNumber.split('').map((digit: string, i: number) => (
                  <span
                    key={i}
                    className={`w-11 h-12 rounded-xl flex items-center justify-center border ${selectedTicket.isWon
                      ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300'
                      : 'bg-[#141924] border-amber-500/40 text-amber-300'
                      }`}
                  >
                    {digit}
                  </span>
                ))}
              </div>
              <span className="text-xs font-mono-numbers font-bold text-white mt-1">
                Status: {selectedTicket.ticketStatusLabel}
              </span>
            </div>

            {/* Structured Room & Transaction Metadata */}
            <div className="space-y-2 text-xs font-mono-numbers bg-[#0B0F19] p-4 rounded-xl border border-[#1F2737]">
              <div className="flex justify-between gap-2">
                <span className="text-[#94A3B8]">Room ID:</span>
                <span className="text-white truncate">{selectedTicket.roomId}</span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-[#94A3B8]">Event Title:</span>
                <span className="text-white truncate">{selectedTicket.eventTitle}</span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-[#94A3B8] inline-flex items-center gap-1"><Calendar className="w-3 h-3" /> Event Start:</span>
                <span className="text-white">{formatTimestamp(selectedTicket.statusInfo.startTimeMs || selectedTicket.purchaseTime)}</span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-[#94A3B8] inline-flex items-center gap-1"><Clock className="w-3 h-3" /> Expiration:</span>
                <span className="text-white">{formatTimestamp(selectedTicket.statusInfo.expiresAtMs || selectedTicket.event?.drawTime)}</span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-[#94A3B8]">Purchase Date:</span>
                <span className="text-white">{formatTimestamp(selectedTicket.purchaseTime)}</span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-[#94A3B8]">Purchase Amount:</span>
                <span className="text-amber-300 font-bold">{selectedTicket.price} {selectedTicket.currency}</span>
              </div>
              {selectedTicket.ledgerTxRef && (
                <div className="flex justify-between gap-2">
                  <span className="text-[#94A3B8] inline-flex items-center gap-1"><Hash className="w-3 h-3" /> TX Ref:</span>
                  <span className="text-[#CBD5E1] truncate">{selectedTicket.ledgerTxRef}</span>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setSelectedTicket(null)}
                className="px-5 py-2 rounded-xl bg-[#1A2232] hover:bg-[#232D42] border border-[#2D384F] text-xs font-bold text-white cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
