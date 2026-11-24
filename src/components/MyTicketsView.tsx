import React, { useMemo, useState } from 'react';
import { useLottery } from '../context/LotteryContext';
import { 
  Ticket, 
  Trophy, 
  Clock, 
  CheckCircle2, 
  Sparkles, 
  Lock, 
  LogIn, 
  ArrowRight,
  Plus
} from 'lucide-react';
import { getEventStatusInfo } from '../utils/eventStatus';

interface MyTicketsViewProps {
  onOpenPicker?: () => void;
  onNavigateToRoom?: (roomId: string) => void;
}

/**
 * Minimal My Tickets - Room-Based Cards Display
 * Designed in Google Stitch (Obsidian Sovereign Design System: #0B0F19, #111728, #F59E0B, #10B981)
 * Screen ID: projects/9963092336677896554/screens/de70b2c87fb847f5a0577164d5de8373
 * 
 * Core Features:
 * 1. Minimal summary header with ticket counts, filter pills, and back to lottery trigger.
 * 2. Responsive grid of Room Cards (single-column on mobile, 2-3 columns on laptop/desktop).
 * 3. Inside each room card: room title, round ID, live status, and internal vertically scrollable list of user tickets (max-h-52).
 * 4. Distinct 4-digit boxes [ 4 ] [ 7 ] [ 1 ] [ 9 ] with high-contrast monospace typography.
 * 5. Connected strictly to real user tickets from Supabase.
 */
export default function MyTicketsView({ onOpenPicker, onNavigateToRoom }: MyTicketsViewProps) {
  const { tickets, events, user, wallet, setIsAuthModalOpen } = useLottery();
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'won' | 'completed'>('all');

  // 1. Filter strictly to currently logged-in user's actual tickets
  const myPurchasedTickets = useMemo(() => {
    if (!user && !wallet?.address) return [];
    return (tickets || []).filter((t: any) => 
      (user?.id && (t.userId === user.id || t.user_id === user.id)) ||
      (wallet?.address && t.userAddress === wallet.address)
    );
  }, [tickets, user, wallet?.address]);

  // 2. Compute Ticket Metadata
  const enrichedTickets = useMemo(() => {
    return myPurchasedTickets.map((tkt: any) => {
      const eventId = tkt.eventId || tkt.event_id || 'unknown';
      const matchingEvent = events.find((e: any) => e.id === eventId) || {
        id: eventId,
        title: tkt.eventTitle || 'Lottery Draw Room',
        ticketPrice: tkt.price || 10,
        currency: tkt.currency || 'USDT',
        status: tkt.status === 'won' || tkt.status === 'lost' ? 'completed' : 'active'
      };

      const statusInfo = getEventStatusInfo(matchingEvent);
      const isEventEnded = statusInfo.isEnd;

      // Extract winning codes
      const rawCodes = 
        matchingEvent.drawResultCodes ||
        matchingEvent.draw_result_codes ||
        matchingEvent.winningCodes ||
        matchingEvent.winning_codes ||
        matchingEvent.winningDigits ||
        matchingEvent.winning_digits ||
        matchingEvent.presetWinningDigits ||
        matchingEvent.preset_winning_digits;

      let winningCodes: string[] = [];
      if (Array.isArray(rawCodes)) {
        winningCodes = rawCodes.map((c: any) => String(c).replace(/\D/g, '').padStart(4, '0'));
      } else if (typeof rawCodes === 'string' && rawCodes.trim().length > 0) {
        winningCodes = rawCodes.split(',').map((s: string) => s.replace(/\D/g, '').padStart(4, '0'));
      }

      const tktNumber = String(tkt.ticketNumber || tkt.digits || '0000').padStart(4, '0');
      const isWon = tkt.status === 'won' || (winningCodes.length > 0 && winningCodes.includes(tktNumber));
      const isPending = matchingEvent.status === 'drawing' || (isEventEnded && winningCodes.length === 0);
      const isCompleted = isEventEnded && !isPending;
      const isActive = !isEventEnded && !isPending;

      const price = Number(tkt.price || matchingEvent.ticketPrice || 10);
      const wonAmount = Number(tkt.wonAmount || tkt.won_amount || (isWon ? price * 10 : 0));
      const currency = tkt.currency || matchingEvent.currency || 'USDT';
      const createdAt = tkt.createdAt || tkt.created_at || tkt.purchaseDate || new Date().toISOString();

      return {
        ...tkt,
        tktNumber,
        eventId,
        event: matchingEvent,
        eventTitle: matchingEvent.title || 'Lottery Draw Room',
        statusInfo,
        isActive,
        isPending,
        isCompleted,
        isWon,
        winningCodes,
        price,
        wonAmount,
        currency,
        createdAt
      };
    });
  }, [myPurchasedTickets, events]);

  // 3. Stats Summary
  const stats = useMemo(() => {
    const total = enrichedTickets.length;
    const active = enrichedTickets.filter(t => t.isActive || t.isPending).length;
    const completed = enrichedTickets.filter(t => t.isCompleted).length;
    const won = enrichedTickets.filter(t => t.isWon).length;
    const totalVolume = enrichedTickets.reduce((acc, t) => acc + (t.price || 0), 0);
    const totalWonAmount = enrichedTickets.reduce((acc, t) => acc + (t.wonAmount || 0), 0);

    return {
      total,
      active,
      completed,
      won,
      totalVolume,
      totalWonAmount
    };
  }, [enrichedTickets]);

  // 4. Filter Tickets by Status
  const filteredTickets = useMemo(() => {
    return enrichedTickets.filter(tkt => {
      if (statusFilter === 'active' && !(tkt.isActive || tkt.isPending)) return false;
      if (statusFilter === 'won' && !tkt.isWon) return false;
      if (statusFilter === 'completed' && !tkt.isCompleted) return false;
      return true;
    }).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [enrichedTickets, statusFilter]);

  // 5. Group Tickets by Room/Event ID
  const roomGroups = useMemo(() => {
    const map = new Map<string, { event: any; eventTitle: string; tickets: any[] }>();

    filteredTickets.forEach((tkt) => {
      const key = tkt.eventId;
      if (!map.has(key)) {
        map.set(key, {
          event: tkt.event,
          eventTitle: tkt.eventTitle,
          tickets: []
        });
      }
      map.get(key)!.tickets.push(tkt);
    });

    return Array.from(map.values());
  }, [filteredTickets]);

  // If user is not logged in
  if (!user && !wallet?.address) {
    return (
      <div className="w-full max-w-lg mx-auto px-4 py-16 text-center">
        <div className="bg-[#111728] rounded-3xl p-8 border border-amber-500/30 space-y-4 shadow-2xl">
          <div className="w-14 h-14 rounded-2xl bg-amber-500/15 border border-amber-500/40 flex items-center justify-center text-amber-400 mx-auto">
            <Lock className="w-7 h-7" />
          </div>
          <h3 className="font-display font-extrabold text-xl text-white">Sign In to View Tickets</h3>
          <p className="text-xs text-[#94A3B8] leading-relaxed">
            Please log in to inspect your active 4-digit lottery rooms, countdowns, and winning results.
          </p>
          <button
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
    <div className="w-full max-w-7xl 2xl:max-w-[1600px] mx-auto px-3 xs:px-4 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-5 text-left select-none">
      
      {/* 1. TOP HEADER & SUMMARY BAR */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3.5 bg-[#111728]/95 backdrop-blur-xl p-4 sm:p-5 rounded-2xl border border-[#1F2737] shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-display font-black text-xl sm:text-2xl text-white">
                My Tickets
              </h1>
              <span className="text-xs font-mono-numbers px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold">
                {stats.active} Active / {stats.total} Total
              </span>
            </div>
            <p className="text-[11px] text-[#94A3B8] mt-0.5">
              Room-grouped view of all your 4-digit lucky draw tickets
            </p>
          </div>
        </div>

        {/* Financial telemetry pills & Buy action */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <div className="px-3 py-1.5 rounded-xl bg-[#0B0F19] border border-[#1F2737] text-xs font-mono-numbers text-[#94A3B8]">
            <span>Total Staked: </span>
            <strong className="text-white">{stats.totalVolume.toLocaleString()} USDT</strong>
          </div>

          {stats.totalWonAmount > 0 && (
            <div className="px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs font-mono-numbers text-emerald-400 font-bold flex items-center gap-1">
              <Trophy className="w-3.5 h-3.5" />
              <span>+{stats.totalWonAmount.toLocaleString()} USDT</span>
            </div>
          )}

          {onOpenPicker && (
            <button
              onClick={onOpenPicker}
              className="btn-gold px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-md shadow-amber-500/20"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Buy Tickets</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. FILTER PILLS */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
        {[
          { key: 'all', label: `All Rooms (${stats.total})` },
          { key: 'active', label: `Active (${stats.active})` },
          { key: 'won', label: `Won (${stats.won})` },
          { key: 'completed', label: `Concluded (${stats.completed})` }
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

      {/* 3. ROOM CARDS GRID */}
      {roomGroups.length === 0 ? (
        <div className="bg-[#111728] rounded-2xl p-10 border border-[#1F2737] text-center max-w-md mx-auto space-y-3 mt-8">
          <div className="w-12 h-12 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 mx-auto">
            <Ticket className="w-6 h-6" />
          </div>
          <h3 className="font-display font-bold text-base text-white">No Tickets Found</h3>
          <p className="text-xs text-[#94A3B8] leading-relaxed">
            {statusFilter === 'all' 
              ? 'You have not purchased any lottery tickets yet. Choose a live room and select your 4 digits!'
              : `You have no tickets matching the "${statusFilter}" filter.`}
          </p>
          {onOpenPicker && (
            <button
              onClick={onOpenPicker}
              className="btn-gold px-4 py-2 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer mt-2"
            >
              <span>Explore Live Rooms</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-5">
          {roomGroups.map(({ event, eventTitle, tickets: roomTickets }) => {
            const statusInfo = getEventStatusInfo(event);
            const isEnded = statusInfo.isEnd;
            const hasWin = roomTickets.some(t => t.isWon);
            const totalRoomStake = roomTickets.reduce((sum, t) => sum + (t.price || 0), 0);
            const currency = event.currency || 'USDT';

            return (
              <div
                key={event.id || eventTitle}
                className={`bg-[#0D121D] rounded-2xl border p-4 sm:p-5 flex flex-col justify-between transition-all duration-200 relative overflow-hidden ${
                  hasWin 
                    ? 'border-emerald-500/50 shadow-lg shadow-emerald-500/10'
                    : 'border-[#1F2737] hover:border-amber-500/40'
                }`}
              >
                {/* Accent top stripe */}
                <div className={`absolute top-0 left-0 right-0 h-1 ${
                  hasWin 
                    ? 'bg-gradient-to-r from-emerald-500 via-amber-400 to-emerald-500' 
                    : isEnded 
                      ? 'bg-slate-700' 
                      : 'bg-gradient-to-r from-amber-500 via-amber-300 to-amber-500'
                }`} />

                <div>
                  {/* Card Header */}
                  <div className="flex items-start justify-between gap-2 pb-3 mb-3 border-b border-[#1F2737]">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                        <span className="font-mono-numbers font-bold text-[10px] text-amber-300 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                          {event.roomName || 'Room'}
                        </span>
                        <span className={`text-[9px] font-mono-numbers font-bold px-1.5 py-0.5 rounded border uppercase ${
                          hasWin
                            ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                            : isEnded
                              ? 'bg-slate-800 text-slate-300 border-slate-700'
                              : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                        }`}>
                          {hasWin ? 'WON • PRIZE READY' : isEnded ? 'CONCLUDED' : 'LIVE ROOM'}
                        </span>
                      </div>
                      <h3 className="font-display font-bold text-sm sm:text-base text-white truncate" title={eventTitle}>
                        {eventTitle}
                      </h3>
                    </div>

                    <div className="text-right shrink-0 bg-[#121724] px-2.5 py-1 rounded-xl border border-[#1F2737]">
                      <span className="text-[9px] uppercase font-bold text-[#94A3B8] block">Held</span>
                      <span className="font-mono-numbers font-bold text-xs text-white">
                        {roomTickets.length} Tkt{roomTickets.length > 1 ? 's' : ''}
                      </span>
                    </div>
                  </div>

                  {/* Room Sub-bar */}
                  <div className="flex items-center justify-between text-[11px] text-[#94A3B8] font-mono-numbers mb-2 px-1">
                    <span>Stake: <strong className="text-white">{totalRoomStake} {currency}</strong></span>
                    <span>Pool: <strong className="text-amber-400">{Number(event.poolPrize || event.totalPool || 0).toLocaleString()} {currency}</strong></span>
                  </div>

                  {/* Vertically Scrollable Tickets Container */}
                  <div className="max-h-52 overflow-y-auto space-y-2 pr-1 overscroll-contain">
                    {roomTickets.map((tkt, idx) => (
                      <div
                        key={tkt.id || idx}
                        className={`p-2.5 rounded-xl border flex items-center justify-between gap-2 transition-colors ${
                          tkt.isWon
                            ? 'bg-emerald-950/20 border-emerald-500/40'
                            : 'bg-[#111728] border-[#1F2737]'
                        }`}
                      >
                        {/* 4 Digit Boxes */}
                        <div className="flex items-center gap-1 font-mono-numbers font-black text-sm">
                          {tkt.tktNumber.split('').map((digit: string, dIdx: number) => (
                            <span
                              key={dIdx}
                              className={`w-7 h-7 rounded-lg flex items-center justify-center border ${
                                tkt.isWon
                                  ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300 shadow-[0_0_8px_rgba(16,185,129,0.3)]'
                                  : 'bg-[#090D16] border-[#2A354A] text-amber-300'
                              }`}
                            >
                              {digit}
                            </span>
                          ))}
                        </div>

                        {/* Status / Won Amount */}
                        <div className="text-right shrink-0">
                          {tkt.isWon ? (
                            <div className="text-emerald-400 font-bold font-mono-numbers text-xs">
                              +{tkt.wonAmount} {currency}
                            </div>
                          ) : tkt.isPending ? (
                            <span className="text-[10px] text-amber-400 font-mono-numbers">
                              Pending Draw
                            </span>
                          ) : tkt.isCompleted ? (
                            <span className="text-[10px] text-[#64748B] font-mono-numbers">
                              Unmatched
                            </span>
                          ) : (
                            <span className="text-[10px] text-emerald-400 font-mono-numbers">
                              Active
                            </span>
                          )}
                          <div className="text-[10px] text-[#94A3B8] font-mono-numbers">
                            {tkt.price} {currency}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Card Footer: Action button */}
                <div className="pt-3 mt-3 border-t border-[#1F2737] flex items-center justify-between">
                  <span className="text-[10px] text-[#94A3B8] font-mono-numbers flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {event.drawTime ? new Date(event.drawTime).toLocaleDateString() : 'Active Round'}
                  </span>

                  {(onNavigateToRoom || onOpenPicker) && (
                    <button
                      onClick={() => onNavigateToRoom ? onNavigateToRoom(event.id) : onOpenPicker?.()}
                      className="text-xs font-bold text-amber-400 hover:text-amber-300 flex items-center gap-1 cursor-pointer transition-colors"
                    >
                      <span>Enter Room</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  )}
                </div>

              </div>
            );
          })}
        </div>
      )}

    </div>
  );
}
