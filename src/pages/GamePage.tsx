import React, { useState, useEffect, useMemo } from 'react';
import {
  getGameById,
  gameRoomManager,
  ROOM_TYPES,
  ROOM_STATUSES
} from '../engine';
import { useLottery } from '../context/LotteryContext';
import { Info, Layers } from 'lucide-react';
import { LotteryWorkstation } from '../games';

export interface GamePageProps {
  gameSlug: string;
  roomId?: string | null;
  onNavigate?: (path: string) => void;
  onBackToHome?: () => void;
}

export default function GamePage({
  gameSlug,
  roomId = null,
  onBackToHome
}: GamePageProps) {
  const { events, loadingEvents } = useLottery();

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

  // For Four-Digit Lottery: rooms are 100% database-driven from active lottery_events
  const lotteryRooms = useMemo(() => {
    if (game?.id !== 'lottery') return [];
    return (events || []).map((evt, idx) => ({
      id: evt.id,
      gameId: 'lottery',
      drawId: evt.id,
      name: evt.title || evt.roomName || `Room ${idx + 1}`,
      type: evt.badge?.toLowerCase().includes('vip')
        ? ROOM_TYPES.VIP
        : (evt.badge?.toLowerCase().includes('high') ? ROOM_TYPES.HIGH_ROLLER : ROOM_TYPES.STANDARD),
      status: evt.status === 'completed' ? ROOM_STATUSES.COMPLETED : ROOM_STATUSES.ACTIVE,
      description: evt.description || `Pick 4 lucky digits from 0000 to 9999. Payouts distributed in ${evt.currency || 'USDT'}.`,
      minStakeUSDT: evt.ticketPrice || 10,
      maxStakeUSDT: evt.ticketPrice || 10,
      minStakeFC: evt.ticketPrice || 10,
      maxStakeFC: evt.ticketPrice || 10,
      currency: evt.currency || 'USDT',
      playerCapacity: evt.maxTotalTickets || 1000,
      currentPlayers: evt.participantsCount || 0,
      ticketsSold: evt.ticketsSold || 0,
      drawDurationHours: evt.durationValue || 24,
      poolPrize: evt.poolPrize,
      minPrize: evt.minPrize,
      maxPrize: evt.maxPrize,
      jackpotMode: evt.jackpotMode,
      drawTime: evt.drawTime,
      winningDigits: evt.winningDigits,
      sortOrder: idx + 1,
      event: evt
    }));
  }, [game?.id, events]);

  const activeRooms = useMemo(() => {
    if (game?.id === 'lottery') return lotteryRooms;
    return rooms;
  }, [game?.id, lotteryRooms, rooms]);

  // Directly resolve requested or primary active lottery room without intermediate Lobby hops
  const selectedRoom = useMemo(() => {
    if (roomId) {
      return activeRooms.find(r => r.id === roomId) || activeRooms.find(r => r.status === ROOM_STATUSES.ACTIVE) || activeRooms[0] || null;
    }
    if (game?.id === 'lottery' && activeRooms.length > 0) {
      return activeRooms.find(r => r.status === ROOM_STATUSES.ACTIVE) || activeRooms[0];
    }
    return null;
  }, [activeRooms, roomId, game?.id]);

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

  // While events are loading on direct navigation, show a single-screen 3-column skeleton (prevents layout flash)
  if (loadingEvents && !selectedRoom) {
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

  // Active Dedicated Game Room Interface (Single-Screen Zero-Scroll)
  if (selectedRoom) {
    return (
      <div className="w-full h-full flex flex-col min-h-0 overflow-hidden">
        <LotteryWorkstation room={selectedRoom} />
      </div>
    );
  }

  // Empty state if database has zero lottery rooms published
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
