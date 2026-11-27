import React, { useState, useEffect, useMemo } from 'react';
import {
  getGameById,
  gameRoomManager,
  ROOM_TYPES,
  ROOM_STATUSES
} from '../engine';
import { useLottery } from '../context/LotteryContext';
import { Info, Layers, Clock, Lock } from 'lucide-react';
import { LotteryWorkstation } from '../games';
import { getEventStatusInfo } from '../utils/eventStatus';

export interface GamePageProps {
  gameSlug: string;
  roomId?: string | null;
  onNavigate?: (path: string) => void;
  onBackToHome?: () => void;
}

export default function GamePage({
  gameSlug,
  roomId = null,
  onNavigate,
  onBackToHome
}: GamePageProps) {
  const { events, loadingEvents, getServerNowMs, verifyRoomEntry } = useLottery();
  const [serverTickNow, setServerTickNow] = useState<number>(() =>
    getServerNowMs ? getServerNowMs() : Date.now()
  );
  const [roomAccessState, setRoomAccessState] = useState<{
    checking: boolean;
    allowed: boolean;
    reason?: string;
    message?: string;
  }>({ checking: gameSlug === 'four-digit-lottery' || gameSlug === 'lottery', allowed: true });

  // Update server-aligned clock once per second so expired rooms lock out immediately
  useEffect(() => {
    const tick = setInterval(() => {
      setServerTickNow(getServerNowMs ? getServerNowMs() : Date.now());
    }, 1000);
    return () => clearInterval(tick);
  }, [getServerNowMs]);

  // Resolve game metadata
  const game = useMemo(() => getGameById(gameSlug), [gameSlug]);

  // Rooms for non-lottery fallback compatibility
  const [rooms, setRooms] = useState(() => gameRoomManager.getRoomsForGame(game?.id));

  useEffect(() => {
    if (game?.id) {
      setRooms(gameRoomManager.getRoomsForGame(game.id));
      const unsubscribe = gameRoomManager.subscribe(() => {
        setRooms(gameRoomManager.getRoomsForGame(game.id));
      });
      return () => unsubscribe();
    }
  }, [game?.id]);

  // For Four-Digit Lottery: rooms are 100% database-driven from lottery_events
  const lotteryRooms = useMemo(() => {
    if (game?.id !== 'lottery') return [];
    return (events || []).map((evt, idx) => {
      const st = getEventStatusInfo(evt, undefined, serverTickNow);
      return {
        id: evt.id,
        roomId: evt.roomId || `room-${evt.id}`,
        gameId: 'lottery',
        drawId: evt.id,
        name: evt.roomName || evt.title || `Room ${idx + 1}`,
        type: evt.badge?.toLowerCase().includes('vip')
          ? ROOM_TYPES.VIP
          : (evt.badge?.toLowerCase().includes('high') ? ROOM_TYPES.HIGH_ROLLER : ROOM_TYPES.STANDARD),
        status: st.isEnd || evt.status === 'completed' ? ROOM_STATUSES.COMPLETED : ROOM_STATUSES.ACTIVE,
        isEnterable: !st.isEnd && !st.isUpcoming,
        isUpcoming: st.isUpcoming,
        description: evt.description || `Pick 4 lucky digits from 0000 to 9999. Payouts distributed in ${evt.currency || 'USDT'}.`,
        minStakeUSDT: evt.ticketPrice || 10,
        maxStakeUSDT: evt.ticketPrice || 10,
        minStakeFC: evt.ticketPrice || 10,
        maxStakeFC: evt.ticketPrice || 10,
        currency: evt.currency || 'USDT',
        playerCapacity: evt.maxTotalTickets || 1000,
        currentPlayers: evt.participantsCount || 0,
        ticketsSold: evt.ticketsSold || 0,
        drawDurationHours: evt.durationValue || 1,
        poolPrize: evt.poolPrize,
        minPrize: evt.minPrize,
        maxPrize: evt.maxPrize,
        jackpotMode: evt.jackpotMode,
        startTime: evt.startTime,
        drawTime: evt.drawTime,
        winningDigits: evt.winningDigits,
        sortOrder: idx + 1,
        event: evt
      };
    });
  }, [game?.id, events, serverTickNow]);

  const activeRooms = useMemo(() => {
    if (game?.id === 'lottery') return lotteryRooms;
    return rooms;
  }, [game?.id, lotteryRooms, rooms]);

  // STRICT Room-to-Event Mapping: Never substitute another unrelated or legacy room when roomId is given
  const selectedRoom = useMemo(() => {
    if (roomId) {
      return activeRooms.find((r: any) => r.id === roomId || r.roomId === roomId || r.drawId === roomId) || null;
    }
    if (game?.id === 'lottery' && activeRooms.length > 0) {
      return activeRooms.find((r: any) => r.isEnterable) || null;
    }
    return null;
  }, [activeRooms, roomId, game?.id]);

  // Verify room access directly against authoritative PostgreSQL server clock & event state
  const targetVerificationKey = roomId || selectedRoom?.id || null;
  useEffect(() => {
    if (game?.id !== 'lottery') {
      setRoomAccessState({ checking: false, allowed: true });
      return;
    }
    if (!targetVerificationKey) {
      if (!loadingEvents) {
        setRoomAccessState({
          checking: false,
          allowed: false,
          reason: 'expired',
          message: 'This event has expired. Room entry is no longer available.'
        });
      }
      return;
    }

    let cancelled = false;
    setRoomAccessState(prev => ({ ...prev, checking: true }));
    verifyRoomEntry(targetVerificationKey).then((res: any) => {
      if (cancelled) return;
      setRoomAccessState({
        checking: false,
        allowed: Boolean(res?.allowed),
        reason: res?.reason,
        message: res?.message
      });
    });

    return () => {
      cancelled = true;
    };
  }, [game?.id, targetVerificationKey, loadingEvents]);

  if (!game) {
    return (
      <div className="w-full h-full flex items-center justify-center p-4 overflow-hidden">
        <div className="max-w-md w-full bg-[#111728] border border-amber-500/30 rounded-2xl p-6 text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mx-auto text-amber-400">
            <Info className="w-6 h-6" />
          </div>
          <h2 className="font-display font-extrabold text-lg text-white">
            Game Not Found
          </h2>
          <p className="text-xs text-[#94A3B8]">
            The game route <span className="font-mono text-amber-300">"{gameSlug}"</span> does not exist.
          </p>
        </div>
      </div>
    );
  }

  // While events or server room verification are loading (skip waiting on events if server already rejected roomId)
  if ((roomAccessState.checking || (loadingEvents && roomAccessState.allowed)) && !selectedRoom?.isEnterable) {
    return (
      <div className="w-full h-full flex flex-col p-3 lg:p-4 gap-3 overflow-hidden bg-[#080C16]">
        <div className="h-12 lg:h-14 rounded-2xl bg-[#111728] border border-[#1B2238] animate-pulse shrink-0" />
        <div className="flex-1 min-h-0 grid grid-cols-3 gap-3 lg:gap-4 max-h-[660px]">
          <div className="rounded-2xl bg-[#111728] border border-[#1B2238] animate-pulse" />
          <div className="rounded-2xl bg-[#111728] border border-[#1B2238] animate-pulse" />
          <div className="rounded-2xl bg-[#111728] border border-[#1B2238] animate-pulse" />
        </div>
      </div>
    );
  }

  // Strict Client + Server Expiration / Upcoming / Archived Room Block
  const selectedStatus = selectedRoom?.event
    ? getEventStatusInfo(selectedRoom.event, undefined, serverTickNow)
    : null;
  const isBlocked =
    game.id === 'lottery' &&
    (!selectedRoom ||
      !roomAccessState.allowed ||
      Boolean(selectedStatus && (selectedStatus.isEnd || selectedStatus.isUpcoming)));

  if (isBlocked) {
    const isUpcoming = roomAccessState.reason === 'upcoming' || Boolean(selectedStatus?.isUpcoming);
    const isVipBlocked = roomAccessState.reason === 'vip_required';
    const blockMsg =
      roomAccessState.message ||
      (isUpcoming
        ? 'This event has not started yet. Room entry opens at the scheduled start time.'
        : 'This event has expired. Room entry is no longer available.');

    return (
      <div
        data-testid="room-access-blocked"
        className="w-full h-full flex items-center justify-center p-4 overflow-y-auto bg-[#080C16]"
      >
        <div className={`max-w-md w-full bg-[#111728] rounded-2xl p-6 sm:p-7 text-center space-y-4 shadow-2xl border ${
          isVipBlocked ? 'border-amber-500/45' : 'border-rose-500/35'
        }`}>
          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mx-auto border ${
            isVipBlocked
              ? 'bg-amber-500/15 border-amber-500/35 text-amber-400'
              : 'bg-rose-500/15 border-rose-500/35 text-rose-400'
          }`}>
            {isUpcoming ? <Clock className="w-6 h-6" /> : <Lock className="w-6 h-6" />}
          </div>
          <div className="space-y-1.5">
            <h2 className="font-display font-extrabold text-lg sm:text-xl text-white">
              {isVipBlocked ? 'VIP Membership Required' : isUpcoming ? 'Event Not Started Yet' : 'Room Entry Closed'}
            </h2>
            <p className="text-xs sm:text-sm text-[#CBD5E1] leading-relaxed">
              {blockMsg}
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2.5 pt-2">
            {isVipBlocked && onNavigate && (
              <button
                type="button"
                onClick={() => onNavigate('/profile')}
                className="btn-gold px-5 py-2.5 rounded-xl text-xs font-bold text-black cursor-pointer"
              >
                Upgrade to VIP Player
              </button>
            )}
            {onBackToHome && (
              <button
                type="button"
                onClick={onBackToHome}
                className={isVipBlocked ? 'px-5 py-2.5 rounded-xl bg-[#0B0F19] hover:bg-[#171E2E] border border-[#2A354A] text-xs font-bold text-white cursor-pointer' : 'btn-gold px-5 py-2.5 rounded-xl text-xs font-bold text-black cursor-pointer'}
              >
                Explore Active Events
              </button>
            )}
            {!isVipBlocked && onNavigate && (
              <button
                type="button"
                onClick={() => onNavigate('/results')}
                className="px-5 py-2.5 rounded-xl bg-[#0B0F19] hover:bg-[#171E2E] border border-[#2A354A] text-xs font-bold text-white cursor-pointer"
              >
                View Results
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Active Dedicated Game Room Interface (Single-Screen Zero-Scroll)
  if (selectedRoom) {
    return (
      <div className="w-full h-full flex flex-col min-h-0 overflow-hidden">
        <LotteryWorkstation room={selectedRoom} />
      </div>
    );
  }

  // Empty state if database has zero active lottery rooms published
  return (
    <div className="w-full h-full flex items-center justify-center p-4 overflow-hidden">
      <div className="max-w-md w-full bg-[#111728] border border-[#1F2737] rounded-2xl p-6 text-center space-y-3 shadow-xl">
        <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mx-auto text-amber-400">
          <Layers className="w-6 h-6" />
        </div>
        <h3 className="font-display font-bold text-base text-white">
          No Active Lottery Rooms
        </h3>
        <p className="text-xs text-[#94A3B8]">
          There are currently no active Four-Digit Lottery draws published. Please check back shortly.
        </p>
        {onBackToHome && (
          <button
            type="button"
            onClick={onBackToHome}
            className="btn-gold px-5 py-2 rounded-xl text-xs font-bold cursor-pointer"
          >
            Return to Home
          </button>
        )}
      </div>
    </div>
  );
}
