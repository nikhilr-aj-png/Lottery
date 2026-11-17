import React, { useMemo, useState } from 'react';
import { useLottery } from '../context/LotteryContext';
import { Ticket, Trophy, Clock, CheckCircle2, Sparkles, Layers, Lock, LogIn } from 'lucide-react';

interface MyTicketsViewProps {
  onOpenPicker?: () => void;
}

export default function MyTicketsView({ onOpenPicker }: MyTicketsViewProps) {
  const { tickets, events, user, wallet, setIsAuthModalOpen } = useLottery();
  const [selectedRoomFilter, setSelectedRoomFilter] = useState<string>('all');

  // Filter strictly to only the currently logged-in user's actual purchased tickets
  const myPurchasedTickets = useMemo(() => {
    if (!user && !wallet?.address) return [];
    return (tickets || []).filter((t: any) => 
      (user?.id && (t.userId === user.id || t.user_id === user.id)) ||
      (wallet?.address && t.userAddress === wallet.address)
    );
  }, [tickets, user, wallet?.address]);

  // Group tickets by room / event
  const ticketsByRoom = useMemo(() => {
    const map = new Map<string, { event: any; tickets: any[] }>();

    myPurchasedTickets.forEach((tkt: any) => {
      const eventId = tkt.eventId || tkt.event_id || 'unknown';
      if (!map.has(eventId)) {
        const matchingEvent = events.find((e: any) => e.id === eventId) || {
          id: eventId,
          title: tkt.eventTitle || 'Lottery Draw Pool',
          ticketPrice: tkt.price || 10,
          status: tkt.status === 'won' || tkt.status === 'lost' ? 'completed' : 'active'
        };
        map.set(eventId, { event: matchingEvent, tickets: [] });
      }
      map.get(eventId)!.tickets.push(tkt);
    });

    return Array.from(map.entries()).map(([eventId, data]) => ({
      eventId,
      event: data.event,
      tickets: data.tickets
    }));
  }, [myPurchasedTickets, events]);

  const filteredGroups = useMemo(() => {
    if (selectedRoomFilter === 'all') return ticketsByRoom;
    return ticketsByRoom.filter(g => g.eventId === selectedRoomFilter);
  }, [ticketsByRoom, selectedRoomFilter]);

  // If user is not logged in, prompt for login
  if (!user) {
    return (
      <div className="w-full max-w-4xl mx-auto px-4 py-12 text-center">
        <div className="glass-panel rounded-3xl p-8 border border-amber-500/30 max-w-md mx-auto space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-amber-500/15 border border-amber-500/40 flex items-center justify-center text-amber-400 mx-auto">
            <Lock className="w-7 h-7" />
          </div>
          <h3 className="font-display font-extrabold text-xl text-white">Login to View Your Tickets</h3>
          <p className="text-xs text-[#9b8f7c] leading-relaxed">
            Please log in with your account to view your purchased 4-digit lottery tickets, active draw entries, and prize payouts.
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
    <div className="w-full max-w-7xl 2xl:max-w-[1600px] 3xl:max-w-[1800px] 4k:max-w-[2000px] mx-auto px-2.5 xs:px-4 sm:px-6 lg:px-8 py-3 sm:py-6 space-y-4 sm:space-y-6 text-left">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4 pb-2 border-b border-[#1f2737]">
        <div>
          <h2 className="font-display font-extrabold text-lg xs:text-xl sm:text-2xl text-white flex items-center gap-2">
            <Ticket className="w-5 h-5 text-amber-400" />
            <span>My Lottery Tickets</span>
            <span className="text-xs font-mono-numbers px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold">
              {myPurchasedTickets.length} Total
            </span>
          </h2>
          <p className="text-[11px] xs:text-xs text-[#9b8f7c] mt-0.5">
            Your personal purchased 4-digit lucky tickets, organized by room and event
          </p>
        </div>

        {onOpenPicker && (
          <button
            onClick={() => onOpenPicker()}
            className="btn-gold px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-md shrink-0"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Enter Lottery Rooms</span>
          </button>
        )}
      </div>

      {/* Room Filter Pills (if multiple rooms exist) */}
      {ticketsByRoom.length > 1 && (
        <div className="flex flex-wrap items-center gap-1.5 p-1 bg-[#0b0e14] rounded-xl border border-[#272a31] text-xs">
          <button
            onClick={() => setSelectedRoomFilter('all')}
            className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer ${
              selectedRoomFilter === 'all'
                ? 'bg-amber-500 text-black shadow-sm'
                : 'text-[#9b8f7c] hover:text-white'
            }`}
          >
            All Rooms ({myPurchasedTickets.length})
          </button>
          {ticketsByRoom.map(group => (
            <button
              key={group.eventId}
              onClick={() => setSelectedRoomFilter(group.eventId)}
              className={`px-3 py-1 rounded-lg font-bold font-mono-numbers transition-all cursor-pointer ${
                selectedRoomFilter === group.eventId
                  ? 'bg-amber-500 text-black shadow-sm'
                  : 'text-[#9b8f7c] hover:text-white'
              }`}
            >
              {(group.event?.title || 'Lottery Room').split(':')[0]} ({group.tickets.length})
            </button>
          ))}
        </div>
      )}

      {/* Empty State */}
      {myPurchasedTickets.length === 0 ? (
        <div className="glass-panel rounded-2xl p-8 sm:p-12 text-center space-y-3 border border-[#272a31]">
          <Ticket className="w-12 h-12 text-[#9b8f7c]/40 mx-auto" />
          <h3 className="font-display font-bold text-base text-white">No Tickets Purchased Yet</h3>
          <p className="text-xs text-[#9b8f7c] max-w-sm mx-auto">
            You haven't entered any lottery draws yet. Choose an available room, pick your 4-digit combinations, and enter the jackpot!
          </p>
          {onOpenPicker && (
            <button
              onClick={() => onOpenPicker()}
              className="btn-gold px-4 py-2 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer shadow-md mt-2"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Browse Available Rooms</span>
            </button>
          )}
        </div>
      ) : (
        /* Grouped Tickets by Room & Event */
        <div className="space-y-6">
          {filteredGroups.map(group => {
            const isCompleted = group.event.status === 'completed' || (group.event.drawTime && group.event.drawTime <= Date.now());
            const winDigits = group.event.winningDigits || group.event.targetWinningDigits;

            return (
              <div key={group.eventId} className="space-y-3">
                {/* Room Section Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 pb-2 border-b border-[#1f2737]">
                  <div className="flex items-center gap-2">
                    <Layers className="w-4 h-4 text-amber-400" />
                    <h3 className="font-display font-extrabold text-sm sm:text-base text-white">
                      {group.event?.title || 'Lottery Draw'}
                    </h3>
                    <span className={`text-[10px] font-mono-numbers px-2 py-0.2 rounded font-bold uppercase ${
                      isCompleted 
                        ? 'bg-[#141924] text-amber-300 border border-amber-500/30'
                        : 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                    }`}>
                      {isCompleted ? 'Concluded' : 'Active Draw'}
                    </span>
                  </div>

                  <div className="flex items-center gap-3 text-xs text-[#9b8f7c] font-mono-numbers">
                    <span>Tickets: <strong className="text-white">{group.tickets.length}</strong></span>
                    {isCompleted && winDigits && (
                      <span className="text-emerald-400 font-bold">Winning Number: #{winDigits}</span>
                    )}
                  </div>
                </div>

                {/* Tickets Grid for this Room */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                  {group.tickets.map((tkt: any) => {
                    const isWin = tkt.status === 'won' || (winDigits && tkt.ticketNumber === winDigits);

                    return (
                      <div
                        key={tkt.id}
                        className={`p-3.5 rounded-xl border flex flex-col justify-between transition-all ${
                          isWin
                            ? 'bg-emerald-950/20 border-emerald-500/50 shadow-md shadow-emerald-500/10'
                            : isCompleted
                            ? 'bg-[#0b0e14] border-[#272a31]'
                            : 'bg-[#10131a] border-amber-500/30 hover:border-amber-400/50 shadow-sm'
                        }`}
                      >
                        <div className="flex items-center justify-between text-[10px] text-[#9b8f7c] mb-2 font-mono-numbers">
                          <span className="font-bold">#{String(tkt.id || '').slice(-6)}</span>
                          <span className={`px-2 py-0.5 rounded-full font-bold uppercase text-[9px] ${
                            isWin
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                              : isCompleted
                              ? 'bg-[#141924] text-[#8b92a2] border border-[#272a31]'
                              : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                          }`}>
                            {isWin ? '🏆 WINNER' : isCompleted ? 'Draw Closed' : 'In Draw'}
                          </span>
                        </div>

                        {/* 4 Digits Display */}
                        <div className="flex items-center justify-center gap-1.5 my-2.5">
                          {String(tkt.ticketNumber || '0000').split('').map((char: string, dIdx: number) => (
                            <div
                              key={dIdx}
                              className={`w-9 h-10 rounded-lg flex items-center justify-center font-display font-black text-lg shadow-inner border ${
                                isWin
                                  ? 'bg-emerald-950/40 border-emerald-400 text-emerald-300'
                                  : 'bg-[#07090e] border-[#272a31] text-amber-400'
                              }`}
                            >
                              {char}
                            </div>
                          ))}
                        </div>

                        <div className="pt-2 border-t border-[#1f2737] flex items-center justify-between text-[11px] font-mono-numbers">
                          <span className="text-[#8b92a2]">Stake: {tkt.price || group.event?.ticketPrice || 10} {tkt.currency || group.event?.currency || 'FLO'}</span>
                          {isWin ? (
                            <strong className="text-emerald-400 font-bold">+{tkt.wonAmount || 'Won'} FC</strong>
                          ) : isCompleted ? (
                            <span className="text-[#64748b]">Unmatched</span>
                          ) : (
                            <span className="text-amber-400 flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              <span>Awaiting Draw</span>
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

    </div>
  );
}
