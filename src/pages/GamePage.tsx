import React, { useState, useEffect, useMemo } from 'react';
import {
  getGameById,
  getGameIconUrl,
  GAMES,
  gameRoomManager,
  ROOM_TYPES,
  ROOM_STATUSES,
  gameHistoryStore
} from '../engine';
import { supabase } from '../lib/supabase';
import { useLottery } from '../context/LotteryContext';
import { getEventStatusInfo } from '../utils/eventStatus';
import {
  ArrowLeft,
  ShieldCheck,
  Sparkles,
  Users,
  Coins,
  Play,
  Info,
  Clock,
  Trophy,
  Ticket,
  RotateCcw,
  Flame,
  ChevronRight,
  CheckCircle2,
  Lock,
  Layers,
  Award,
  Hash,
  Percent,
  Key,
  RefreshCw,
  History,
  FileCheck,
  Eye,
  Check,
  Copy,
  MessageSquare,
  Volume2,
  VolumeX,
  Volume1
} from 'lucide-react';
import { useSoundFX } from '../hooks/useSoundFX';
import MyTicketsView from '../components/MyTicketsView';
import ResultsView from '../components/ResultsView';
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
  onNavigate,
  onBackToHome
}: GamePageProps) {
  const { wallet, user, setIsAuthModalOpen, showToast, events, tickets, setSelectedEventForModal } = useLottery();

  // Tab state when browsing Lottery Lobby (Rooms vs My Tickets vs Draw Results)
  const [lotteryLobbyTab, setLotteryLobbyTab] = useState<'rooms' | 'tickets' | 'results'>('rooms');

  // Resolve game metadata
  const game = useMemo(() => getGameById(gameSlug), [gameSlug]);

  // Rooms for this game
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
    return events.map((evt, idx) => ({
      id: evt.id,
      gameId: 'lottery',
      drawId: evt.id,
      name: evt.title || evt.roomName || `Room ${idx + 1}`,
      type: evt.badge?.toLowerCase().includes('vip') ? ROOM_TYPES.VIP : (evt.badge?.toLowerCase().includes('high') ? ROOM_TYPES.HIGH_ROLLER : ROOM_TYPES.STANDARD),
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

  // Active rooms strictly based on real database records
  const activeRooms = useMemo(() => {
    if (game?.id === 'lottery') return lotteryRooms;
    return rooms;
  }, [game?.id, lotteryRooms, rooms]);

  // Selected room: Directly resolve active lottery room to ensure seamless 1-click entry without duplicate screens
  const selectedRoom = useMemo(() => {
    if (roomId) {
      return activeRooms.find(r => r.id === roomId) || activeRooms[0] || null;
    }
    if (game?.id === 'lottery' && activeRooms.length > 0) {
      return activeRooms.find(r => r.status === ROOM_STATUSES.ACTIVE) || activeRooms[0];
    }
    return null;
  }, [activeRooms, roomId, game?.id]);

  // State for active lottery event if game is lottery
  const activeLotteryEvent = useMemo(() => {
    if (game?.id !== 'lottery') return null;
    return events.find(e => e.status === 'active') || events[0] || null;
  }, [game?.id, events]);

  // Provably Fair and Seed Rotation State (Phase 9)
  const [showFairnessDrawer, setShowFairnessDrawer] = useState(false);
  const [seeds, setSeeds] = useState<any>({
    serverHash: '0x' + Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join(''),
    clientSeed: 'client_' + Math.floor(Math.random() * 1000000),
    nonce: 1,
    previousServerSeed: null,
    previousServerHash: null
  });
  const [customClientSeed, setCustomClientSeed] = useState('');
  const [isRotatingSeeds, setIsRotatingSeeds] = useState(false);
  const [copiedKey, setCopiedKey] = useState<any>(null);

  // Sound Engine
  const { enabled: soundEnabled, volume: soundVolume, toggleSound, playClick } = useSoundFX();

  // Universal Bet History and Verification Modal
  const [selectedRoundForProof, setSelectedRoundForProof] = useState<any>(null);
  const [isProofModalOpen, setIsProofModalOpen] = useState(false);

  const [historyTab, setHistoryTab] = useState('room'); // 'room' | 'my' | 'game'
  const [roomRounds, setRoomRounds] = useState<any[]>([]);
  const [gameRounds, setGameRounds] = useState<any[]>([]);
  const [myRounds, setMyRounds] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Load Active Provably Fair Seeds
  useEffect(() => {
    let isMounted = true;
    async function fetchUserSeeds() {
      if (!wallet?.address) return;
      try {
        const { data, error } = await supabase.rpc('get_or_create_user_game_seed', {
          p_wallet_address: wallet.address,
          p_user_id: user?.id || null
        });
        if (isMounted && !error && data?.success) {
          setSeeds({
            serverHash: data.server_hash,
            clientSeed: data.client_seed,
            nonce: data.nonce || 1,
            previousServerSeed: data.previous_server_seed,
            previousServerHash: data.previous_server_hash
          });
          setCustomClientSeed(data.client_seed || '');
        }
      } catch (err) {
        console.warn('fetchUserSeeds error:', err);
      }
    }
    fetchUserSeeds();
    return () => { isMounted = false; };
  }, [wallet?.address, user?.id]);

  // Rotate Seed Pair
  const handleRotateSeeds = async (e) => {
    if (e) e.preventDefault();
    if (!wallet?.address) {
      setIsAuthModalOpen(true);
      showToast('Please connect wallet or log in to rotate seeds', 'info');
      return;
    }
    setIsRotatingSeeds(true);
    try {
      const { data, error } = await supabase.rpc('rotate_user_game_seed', {
        p_wallet_address: wallet.address,
        p_new_client_seed: customClientSeed.trim() || null
      });
      if (!error && data?.success) {
        setSeeds({
          serverHash: data.new_server_hash,
          clientSeed: data.new_client_seed,
          nonce: 0,
          previousServerSeed: data.revealed_previous_seed,
          previousServerHash: data.previous_commit_hash
        });
        setCustomClientSeed(data.new_client_seed);
        showToast('Game seeds rotated successfully.', 'success');
      } else {
        showToast(error?.message || 'Failed to rotate seeds', 'error');
      }
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setIsRotatingSeeds(false);
    }
  };

  const copyToClipboard = (text, key) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  // Fetch History for Room, Game & My Bets
  useEffect(() => {
    let isMounted = true;
    async function fetchHistory() {
      if (!game?.id) return;
      setHistoryLoading(true);
      try {
        if (selectedRoom?.id) {
          const roomBets = await gameHistoryStore.fetchRoomBets(selectedRoom.id, 20);
          if (isMounted) setRoomRounds(roomBets);
        }
        const gBets = await gameHistoryStore.fetchGameBets(game.id, 25);
        if (isMounted) setGameRounds(gBets);

        if (wallet?.address) {
          const myBets = await gameHistoryStore.fetchMyBets(wallet.address, 30);
          if (isMounted) setMyRounds(myBets.filter(b => b.gameId === game.id));
        }
      } catch (err) {
        console.warn('fetchHistory error:', err);
      } finally {
        if (isMounted) setHistoryLoading(false);
      }
    }

    fetchHistory();
    const unsub = gameHistoryStore.subscribe(() => {
      fetchHistory();
    });
    return () => {
      isMounted = false;
      unsub();
    };
  }, [game?.id, selectedRoom?.id, wallet?.address]);

  if (!game) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-20 text-center space-y-4">
        <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mx-auto text-amber-400">
          <Info className="w-8 h-8" />
        </div>
        <h2 className="font-display font-extrabold text-2xl text-white">
          Game Not Found
        </h2>
        <p className="text-xs text-[#9b8f7c]">
          The game route <span className="font-mono text-amber-300">"{gameSlug}"</span> does not exist or has been relocated.
        </p>
        <button
          onClick={onBackToHome}
          className="btn-gold px-6 py-2.5 rounded-xl text-xs font-bold inline-flex items-center gap-2 cursor-pointer shadow-md"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to All Games</span>
        </button>
      </div>
    );
  }

  // Helper to handle room entry
  const handleEnterRoom = (targetRoomId) => {
    if (!user) {
      setIsAuthModalOpen(true);
      showToast('Please log in to enter this room!', 'info');
      return;
    }
    if (onNavigate) {
      onNavigate(`/games/${game.slug}/${targetRoomId}`);
    }
  };

  const handleBackToLobby = () => {
    if (onNavigate) {
      onNavigate(`/games/${game.slug}`);
    }
  };

  // --------------------------------------------------------------------------
  // VIEW A: DEDICATED GAME INTERFACE (WHEN INSIDE A ROOM)
  // --------------------------------------------------------------------------
  if (selectedRoom) {
    // Dedicated in-room compact activity box
    const activityBox = (
      <div className="flex-1 min-h-[120px] max-h-[160px] xs:max-h-[180px] lg:max-h-[220px] flex flex-col rounded-xl bg-[#090D16] border border-[#1F2737] overflow-hidden text-left">
        {/* Box Header */}
        <div className="flex items-center justify-between px-2.5 py-1.5 border-b border-[#1F2737] bg-[#0E1422] shrink-0 text-xs">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
            <span className="font-extrabold text-[11px] text-white truncate">
              Room Activity
            </span>
            <span className="text-[9px] font-mono-numbers px-1.5 py-0.2 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30 uppercase shrink-0">
              {selectedRoom.name}
            </span>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={() => setHistoryTab('room')}
              className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all cursor-pointer ${historyTab === 'room'
                  ? 'bg-amber-500 text-black shadow-xs font-black'
                  : 'text-[#94A3B8] hover:text-white'
                }`}
            >
              Room ({roomRounds.length})
            </button>
            <button
              type="button"
              onClick={() => setHistoryTab('my')}
              className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all cursor-pointer ${historyTab === 'my'
                  ? 'bg-amber-500 text-black shadow-xs font-black'
                  : 'text-[#94A3B8] hover:text-white'
                }`}
            >
              My ({myRounds.length})
            </button>
          </div>
        </div>

        {/* Scrollable list of rounds */}
        <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar divide-y divide-[#1F2737]/50">
          {(() => {
            const activeList = historyTab === 'room' ? roomRounds : myRounds;
            if (activeList.length === 0) {
              return (
                <div className="h-full flex items-center justify-center p-3 text-center text-[#94A3B8] text-[10px] font-mono-numbers">
                  {historyTab === 'my' ? 'No personal bets placed in this game yet' : 'Waiting for round outcomes in this room...'}
                </div>
              );
            }
            return activeList.map((r) => {
              const isWin = r.status === 'won' || r.payout > 0;
              return (
                <div key={r.id} className="flex items-center justify-between px-2.5 py-1 text-[10px] font-mono-numbers hover:bg-white/2 transition-colors">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="text-amber-300 font-bold truncate max-w-[50px]">
                      #{r.id.slice(-4)}
                    </span>
                    <span className="text-white truncate max-w-[65px]">
                      {r.username || `@${r.walletAddress?.slice(-4)}`}
                    </span>
                    <span className="text-[#94A3B8]">
                      {r.betAmount} USDT
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="text-blue-300 font-bold">
                      {r.multiplier > 0 ? `${r.multiplier}x` : '—'}
                    </span>
                    <span className={`font-bold ${isWin ? 'text-emerald-400' : 'text-[#64748B]'}`}>
                      {isWin ? `+${r.payout} USDT` : '0 USDT'}
                    </span>
                  </div>
                </div>
              );
            });
          })()}
        </div>
      </div>
    );

    return (
      <div className="w-full h-full flex flex-col min-h-0 overflow-hidden animate-in fade-in duration-200">
        {/* Dedicated Game Play Stage Area (Starts directly below main navigation) */}
        <div className="flex-1 min-h-0 w-full overflow-hidden flex flex-col">
          <LotteryWorkstation
            room={selectedRoom}
            onBackToLobby={handleBackToLobby}
            activityBox={activityBox}
          />
        </div>
      </div>
    );
  }

  // --------------------------------------------------------------------------
  // VIEW B: DEDICATED GAME LOBBY (ROOM / TABLE SELECTION)
  // --------------------------------------------------------------------------
  return (
    <div className="space-y-3.5 sm:space-y-4 animate-in fade-in duration-200 pb-1">

      {/* LOTTERY SPECIFIC SUB-NAVIGATION TABS (Available Pools & Rooms vs My Tickets vs Results) */}
      {game.id === 'lottery' && (
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-[#0B0F19]/90 border border-[#1F2737] shrink-0 text-xs">
          <button
            type="button"
            onClick={() => setLotteryLobbyTab('rooms')}
            className={`px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 transition-colors cursor-pointer ${
              lotteryLobbyTab === 'rooms'
                ? 'bg-amber-500 text-black shadow-sm'
                : 'text-[#94A3B8] hover:text-white hover:bg-[#141924]'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Available Pools & Rooms</span>
          </button>

          <button
            type="button"
            onClick={() => setLotteryLobbyTab('tickets')}
            className={`px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 transition-colors cursor-pointer ${
              lotteryLobbyTab === 'tickets'
                ? 'bg-amber-500 text-black shadow-sm'
                : 'text-[#94A3B8] hover:text-white hover:bg-[#141924]'
            }`}
          >
            <Ticket className="w-3.5 h-3.5" />
            <span>My Tickets ({user ? (tickets?.filter(t => (user?.id && (t.userId === user.id || t.user_id === user.id)) || (wallet?.address && t.userAddress === wallet.address)).length || 0) : 0})</span>
          </button>

          <button
            type="button"
            onClick={() => setLotteryLobbyTab('results')}
            className={`px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 transition-colors cursor-pointer ${
              lotteryLobbyTab === 'results'
                ? 'bg-amber-500 text-black shadow-sm'
                : 'text-[#94A3B8] hover:text-white hover:bg-[#141924]'
            }`}
          >
            <Trophy className="w-3.5 h-3.5" />
            <span>Results</span>
          </button>
        </div>
      )}

      {/* Conditionally render content based on lotteryLobbyTab if game is lottery */}
      {game.id === 'lottery' && lotteryLobbyTab === 'tickets' ? (
        <div className="space-y-4">
          <MyTicketsView onOpenPicker={() => setLotteryLobbyTab('rooms')} />
        </div>
      ) : game.id === 'lottery' && lotteryLobbyTab === 'results' ? (
        <div className="space-y-4">
          <ResultsView />
        </div>
      ) : (
        <>
          {/* 2. AVAILABLE ROOMS / TABLES / SESSIONS */}
          <section className="space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pb-2 border-b border-[#1f2737]">
              <div>
                <h2 className="font-display font-extrabold text-lg sm:text-xl text-white flex items-center gap-2">
                  <Layers className="w-5 h-5 text-amber-400" />
                  <span>Available Game Rooms & Tables</span>
                </h2>
                <p className="text-xs text-[#9b8f7c]">
                  Select a room matching your desired USDT stake boundaries and table volatility
                </p>
              </div>

              <span className="text-[11px] font-mono-numbers px-2.5 py-1 rounded bg-[#141924] text-[#9b8f7c] border border-[#272a31]">
                {activeRooms.length} Active {activeRooms.length === 1 ? 'Room' : 'Rooms'}
              </span>
            </div>

            {/* Room Cards Grid */}
            {activeRooms.length === 0 ? (
              <div className="glass-panel rounded-2xl p-8 sm:p-12 text-center space-y-3 border border-[#272a31]">
                <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mx-auto text-amber-400">
                  <Layers className="w-7 h-7" />
                </div>
                <h3 className="font-display font-bold text-base text-white">
                  {game.id === 'lottery' ? 'No Active Lottery Rooms' : 'No Active Game Rooms'}
                </h3>
                <p className="text-xs text-[#9b8f7c] max-w-md mx-auto">
                  {game.id === 'lottery' 
                    ? 'There are currently no active lottery events published. Please check back shortly or create one in the Admin Panel.'
                    : 'All game tables are currently undergoing scheduled maintenance. Please check back in a few moments.'}
                </p>
              </div>
            ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {activeRooms.map((room: any) => {
            const isVip = room.type === ROOM_TYPES.VIP || room.type === ROOM_TYPES.HIGH_ROLLER;
            const matchingEvent = game.id === 'lottery' 
              ? (room.event || events.find(e => e.id === room.id || e.id === room.drawId || e.title?.toLowerCase().includes(room.name?.toLowerCase())))
              : null;
            const statusInfo = getEventStatusInfo(matchingEvent || room);
            const isRoomConcluded = statusInfo.isEnd;
            const safeRoomName = room.name || `Room ${room.id || ''}`;
            const roomNumberName = safeRoomName.match(/Room\s*\d+/i)?.[0] || safeRoomName.split(':')[0] || 'Room';
            return (
              <div
                key={room.id}
                className={`glass-panel rounded-2xl p-4 sm:p-5 flex flex-col justify-between transition-all duration-200 hover:-translate-y-1 relative overflow-hidden border ${isVip ? 'border-amber-500/40 shadow-lg shadow-amber-500/10' : 'border-[#272a31] hover:border-amber-500/30'
                  }`}
              >
                {/* Top Badge & Room Type */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <span className={`text-[10px] font-mono-numbers px-2.5 py-0.5 rounded font-bold uppercase tracking-wider ${isVip ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40' : 'bg-[#141924] text-[#9b8f7c] border border-[#272a31]'
                        }`}>
                        {room.type} Room
                      </span>
                    </div>

                    <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-mono-numbers font-bold uppercase ${statusInfo.badgeClass}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${statusInfo.dotClass}`} />
                      <span>{statusInfo.label}</span>
                    </div>
                  </div>

                  <div>
                    <h3 className="font-display font-extrabold text-base text-white">
                      {room.name}
                    </h3>
                    <p className="text-xs text-[#9b8f7c] mt-1 leading-relaxed">
                      {room.description}
                    </p>
                  </div>

                  {/* Lottery Specific Info (Draw ID, closing time, availability, recent winners) */}
                  {game.id === 'lottery' && (
                    <div className="p-3 rounded-xl bg-[#0b0e14] border border-[#272a31] space-y-2 text-xs">
                      <div className="flex items-center justify-between text-[11px] text-[#9b8f7c]">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3 text-amber-400" />
                          <span>Closing In:</span>
                        </span>
                        <strong className="text-amber-300 font-mono-numbers">
                          ~{room.drawDurationHours || 24}h Countdown
                        </strong>
                      </div>

                      <div className="flex items-center justify-between text-[11px] text-[#9b8f7c]">
                        <span className="flex items-center gap-1">
                          <Hash className="w-3 h-3 text-purple-400" />
                          <span>Selection Range:</span>
                        </span>
                        <span className="text-white font-mono-numbers font-bold">
                          0000 - 9999 (Available)
                        </span>
                      </div>

                      {room.recentWinners && (
                        <div className="flex items-center justify-between text-[11px] text-[#9b8f7c] pt-1 border-t border-[#1f2737]">
                          <span>Recent Winners:</span>
                          <div className="flex items-center gap-1">
                            {room.recentWinners.map((w, i) => (
                              <span key={i} className="font-mono-numbers text-amber-300 font-bold bg-[#141924] px-1.5 py-0.2 rounded border border-[#272a31]">
                                #{w}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="text-[11px] text-amber-400 font-medium text-left pt-0.5">
                        ⭐ {room.prizeInfo}
                      </div>
                    </div>
                  )}

                  {/* Room Stats */}
                  <div className="grid grid-cols-2 gap-2 text-xs font-mono-numbers pt-2 border-t border-[#1f2737]">
                    <div className="bg-[#0b0e14] p-2 rounded-lg text-left">
                      <span className="text-[10px] text-[#8b92a2] block">
                        {game.id === 'lottery' ? 'Ticket Price' : 'Stake Limits'}
                      </span>
                      <strong className="text-white">
                        {game.id === 'lottery' ? `${room.minStakeUSDT || room.minStakeFC || 10} ${room.currency || 'USDT'} / Ticket` : `${room.minStakeUSDT || room.minStakeFC || 1} - ${room.maxStakeUSDT || room.maxStakeFC || 1000} USDT`}
                      </strong>
                    </div>

                    <div className="bg-[#0b0e14] p-2 rounded-lg text-left">
                      <span className="text-[10px] text-[#8b92a2] block">Participants</span>
                      <strong className="text-emerald-400 flex items-center gap-1">
                        <Users className="w-3 h-3" />
                        <span>{room.currentPlayers || 0} / {room.playerCapacity || 1000}</span>
                      </strong>
                    </div>
                  </div>
                </div>

                {/* Enter Room CTA */}
                <div className="pt-4 mt-2">
                  <button
                    onClick={() => handleEnterRoom(room.id)}
                    className={`w-full py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 cursor-pointer shadow-md transition-all ${
                      game.id === 'lottery' && isRoomConcluded
                        ? 'bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 hover:border-amber-400'
                        : 'btn-gold'
                    }`}
                  >
                    {game.id === 'lottery' && isRoomConcluded ? (
                      <>
                        <Trophy className="w-3.5 h-3.5 text-amber-400" />
                        <span>Show Result – {roomNumberName}</span>
                      </>
                    ) : (
                      <>
                        <Play className="w-3.5 h-3.5 fill-current" />
                        <span>Enter {(room.name || 'Room').split(':')[0]}</span>
                      </>
                    )}
                  </button>
                </div>

              </div>
            );
          })}
        </div>
        )}
      </section>

      {/* 4. GAME RULES & PAYOUT EXPLANATION */}
      <section className="glass-panel rounded-2xl p-5 sm:p-7 border border-[#272a31] space-y-4 text-left">
        <div className="flex items-center gap-2 pb-2 border-b border-[#1f2737]">
          <Info className="w-5 h-5 text-amber-400" />
          <h3 className="font-display font-extrabold text-base text-white">
            {game.name} Rules & Instructions
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs text-[#9b8f7c]">
          <div className="space-y-2.5">
            <h4 className="font-bold text-white uppercase text-[11px] tracking-wider">
              How to Play:
            </h4>
            <ul className="space-y-2 list-none">
              {game.rules?.map((rule, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                  <span>{rule}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="space-y-2.5">
            <h4 className="font-bold text-white uppercase text-[11px] tracking-wider">
              Control Guide & Fair Odds:
            </h4>
            <p className="leading-relaxed bg-[#0b0e14] p-3.5 rounded-xl border border-[#272a31]">
              {game.instructions}
            </p>
          </div>
        </div>
      </section>
      </>
      )}

    </div>
  );
}

