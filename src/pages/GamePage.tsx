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
import ProvablyFairModal from '../components/ProvablyFairModal';
import { useLottery } from '../context/LotteryContext';
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
import {
  LotteryWorkstation,
  CrashGame,
  DiceGame,
  MinesGame,
  PlinkoGame,
  RouletteGame,
  CoinflipGame,
  BlackjackGame,
  SlotsGame,
  PokerGame,
  KenoGame,
  LimboGame
} from '../games';

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
  const { wallet, user, setIsAuthModalOpen, showToast, events, setSelectedEventForModal } = useLottery();

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

  // Selected room
  const selectedRoom = useMemo(() => {
    if (!roomId) return null;
    return rooms.find(r => r.id === roomId) || rooms[0] || null;
  }, [rooms, roomId]);

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
        showToast('Provably Fair seeds rotated! Previous server seed revealed.', 'success');
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
      showToast('Please log in with Flow Coins to enter this room!', 'info');
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
                      {r.betAmount}FC
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="text-blue-300 font-bold">
                      {r.multiplier > 0 ? `${r.multiplier}x` : '—'}
                    </span>
                    <span className={`font-bold ${isWin ? 'text-emerald-400' : 'text-[#64748B]'}`}>
                      {isWin ? `+${r.payout}FC` : '0FC'}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedRoundForProof(r);
                        setIsProofModalOpen(true);
                      }}
                      className="px-1.5 py-0.2 rounded bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[9px] font-bold cursor-pointer transition-colors"
                      title="Verify Provably Fair"
                    >
                      <ShieldCheck className="w-2.5 h-2.5 inline" />
                    </button>
                  </div>
                </div>
              );
            });
          })()}
        </div>
      </div>
    );

    return (
      <div className="w-full h-full flex flex-col min-h-0 overflow-hidden space-y-1.5 sm:space-y-2 animate-in fade-in duration-200">

        {/* Compact In-Room Bar (Modular Games: Quick Return to Lobby & Room Limits) */}
        {game.id !== 'lottery' && (
          <div className="flex items-center justify-between gap-2 px-3 py-1.5 sm:px-4 sm:py-2 rounded-xl bg-[#0B0F19]/90 border border-[#1F2737] shrink-0 text-xs">
            <div className="flex items-center gap-2 min-w-0">
              <button
                onClick={handleBackToLobby}
                className="px-2.5 py-1 rounded-lg bg-[#141924] hover:bg-[#1f2737] text-[#9b8f7c] hover:text-white border border-[#272a31] transition-all cursor-pointer flex items-center gap-1 font-bold text-xs shrink-0"
                title="Return to Game Lobby"
              >
                <ArrowLeft className="w-3.5 h-3.5 text-amber-400" />
                <span className="hidden xs:inline">Lobby</span>
              </button>
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="font-display font-extrabold text-white text-xs sm:text-sm truncate">
                  {game.name}
                </span>
                <span className="text-[10px] font-mono-numbers px-2 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30 font-bold uppercase shrink-0">
                  {selectedRoom.name}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2 text-[11px] font-mono-numbers shrink-0">
              <span className="text-[#94A3B8] hidden sm:inline">Limits:</span>
              <span className="text-amber-400 font-bold">{selectedRoom.minStakeFC} - {selectedRoom.maxStakeFC} FC</span>
            </div>
          </div>
        )}

        {/* Dedicated Game Play Stage Area */}
        <div className="flex-1 min-h-0 w-full overflow-hidden flex flex-col">
          {game.id === 'crash' && <CrashGame room={selectedRoom} activityBox={activityBox} />}
          {game.id === 'dice' && <DiceGame room={selectedRoom} activityBox={activityBox} />}
          {game.id === 'mines' && <MinesGame room={selectedRoom} activityBox={activityBox} />}
          {game.id === 'plinko' && <PlinkoGame room={selectedRoom} activityBox={activityBox} />}
          {game.id === 'roulette' && <RouletteGame room={selectedRoom} activityBox={activityBox} />}
          {game.id === 'coinflip' && <CoinflipGame room={selectedRoom} activityBox={activityBox} />}
          {game.id === 'blackjack' && <BlackjackGame room={selectedRoom} activityBox={activityBox} />}
          {game.id === 'slots' && <SlotsGame room={selectedRoom} activityBox={activityBox} />}
          {game.id === 'poker' && <PokerGame room={selectedRoom} activityBox={activityBox} />}
          {game.id === 'keno' && <KenoGame room={selectedRoom} activityBox={activityBox} />}
          {game.id === 'limbo' && <LimboGame room={selectedRoom} activityBox={activityBox} />}
          {game.id === 'lottery' && (
            <LotteryWorkstation
              room={selectedRoom}
              onBackToLobby={handleBackToLobby}
              activityBox={activityBox}
            />
          )}
        </div>

        {/* Universal Provably Fair Audit Modal */}
        {isProofModalOpen && selectedRoundForProof && (
          <ProvablyFairModal
            isOpen={isProofModalOpen}
            onClose={() => {
              setIsProofModalOpen(false);
              setSelectedRoundForProof(null);
            }}
            auditData={{
              id: selectedRoundForProof.id,
              event_id: selectedRoundForProof.id,
              event_title: `${game.name} — Round #${selectedRoundForProof.id.slice(-8)}`,
              winning_digits: selectedRoundForProof.multiplier ? `${selectedRoundForProof.multiplier}x` : (selectedRoundForProof.payout > 0 ? 'WIN' : '0.00x'),
              commit_hash: selectedRoundForProof.serverSeedHash || selectedRoundForProof.server_seed_hash,
              revealed_seed: selectedRoundForProof.serverSeed || selectedRoundForProof.server_seed || 'Revealed upon seed rotation',
              client_seed: selectedRoundForProof.clientSeed || selectedRoundForProof.client_seed || 'client-seed-active',
              nonce: selectedRoundForProof.nonce || 1,
              payout: selectedRoundForProof.payout,
              status: selectedRoundForProof.status
            }}
          />
        )}
      </div>
    );
  }

  // --------------------------------------------------------------------------
  // VIEW B: DEDICATED GAME LOBBY (ROOM / TABLE SELECTION)
  // --------------------------------------------------------------------------
  return (
    <div className="space-y-4 sm:space-y-6 animate-in fade-in duration-200 pb-12">

      {/* 1. COMPACT SINGLE-ROW GAME LOBBY BANNER */}
      <div className="rounded-xl sm:rounded-2xl bg-gradient-to-r from-[#151C2B] via-[#0F1420] to-[#0B0F19] border border-amber-500/30 p-2.5 sm:px-4 sm:py-2.5 flex items-center justify-between gap-3 shadow-lg shrink-0">
        {/* Left: Back button + Game Logo + Name + Badge */}
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <button
            onClick={onBackToHome}
            className="px-2.5 py-1.5 rounded-xl bg-[#141924] hover:bg-[#1a2130] text-[11px] font-bold text-[#9b8f7c] hover:text-white border border-[#272a31] transition-colors cursor-pointer flex items-center gap-1 shrink-0"
            title="Back to All Games"
          >
            <ArrowLeft className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden xs:inline">All Games</span>
          </button>

          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-[#141924] border border-amber-500/40 flex items-center justify-center overflow-hidden shrink-0 shadow-inner">
            <img
              src={getGameIconUrl(game.id) || game.icon || game.image}
              alt={game.name}
              className="w-full h-full object-cover"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
                const next = e.currentTarget.nextSibling as HTMLElement | null;
                if (next && next.style) {
                  next.style.display = 'inline';
                }
              }}
            />
            <span className="hidden text-xl">
              {game.id === 'crash' ? '🚀' :
                game.id === 'dice' ? '🎲' :
                  game.id === 'mines' ? '💣' :
                    game.id === 'plinko' ? '🎯' :
                      game.id === 'roulette' ? '🎡' :
                        game.id === 'coinflip' ? '🪙' :
                          game.id === 'blackjack' ? '🃏' :
                            game.id === 'slots' ? '🎰' :
                              game.id === 'poker' ? '♠️' :
                                game.id === 'keno' ? '🎱' :
                                  game.id === 'limbo' ? '⚡' : '🎟️'}
            </span>
          </div>

          <div className="flex items-center gap-2 min-w-0">
            <h1 className="font-display font-black text-sm sm:text-base text-white tracking-tight truncate whitespace-nowrap">
              {game.name}
            </h1>
            <span className="text-[9px] font-mono-numbers px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30 font-bold uppercase shrink-0 whitespace-nowrap">
              {game.badge || 'PROVABLY FAIR'}
            </span>
          </div>
        </div>

        {/* Right: Compact inline stats */}
        <div className="flex items-center gap-2 sm:gap-3 text-[10px] sm:text-xs font-mono-numbers shrink-0">
          <span className="bg-[#0b0e14] px-2 py-1 rounded-lg border border-[#272a31] text-[#94A3B8]">
            RTP: <strong className="text-emerald-400 font-bold">{game.rtp}%</strong>
          </span>
          <span className="bg-[#0b0e14] px-2 py-1 rounded-lg border border-[#272a31] text-[#94A3B8] hidden sm:inline">
            Edge: <strong className="text-amber-400 font-bold">{game.houseEdge}%</strong>
          </span>
          <span className="bg-[#0b0e14] px-2 py-1 rounded-lg border border-[#272a31] text-[#94A3B8]">
            Max: <strong className="text-purple-400 font-bold">{game.maxMultiplier}x</strong>
          </span>
        </div>
      </div>

      {/* 2. AVAILABLE ROOMS / TABLES / SESSIONS */}
      <section className="space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pb-2 border-b border-[#1f2737]">
          <div>
            <h2 className="font-display font-extrabold text-lg sm:text-xl text-white flex items-center gap-2">
              <Layers className="w-5 h-5 text-amber-400" />
              <span>Available Game Rooms & Tables</span>
            </h2>
            <p className="text-xs text-[#9b8f7c]">
              Select a room matching your desired Flow Coin stake boundaries and table volatility
            </p>
          </div>

          <span className="text-[11px] font-mono-numbers px-2.5 py-1 rounded bg-[#141924] text-[#9b8f7c] border border-[#272a31]">
            {rooms.length} Active {rooms.length === 1 ? 'Room' : 'Rooms'}
          </span>
        </div>

        {/* Room Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {rooms.map((room: any) => {
            const isVip = room.type === ROOM_TYPES.VIP || room.type === ROOM_TYPES.HIGH_ROLLER;
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
                      {room.drawId && (
                        <span className="text-[9px] font-mono-numbers px-1.5 py-0.5 rounded bg-black/60 text-amber-400 border border-amber-500/30 font-bold">
                          {room.drawId}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 text-[10px] text-emerald-400 font-mono-numbers font-bold">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(34,197,94,0.6)]" />
                      <span>{room.status === 'completed' ? 'CONCLUDED' : 'OPEN'}</span>
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

                  {/* Crash Specific Info (Recent Multipliers & Rules) */}
                  {game.id === 'crash' && (
                    <div className="p-3 rounded-xl bg-[#0b0e14] border border-[#272a31] space-y-2 text-xs">
                      <div className="flex items-center justify-between text-[11px] text-[#9b8f7c]">
                        <span className="flex items-center gap-1">
                          <Flame className="w-3 h-3 text-orange-400" />
                          <span>Flight Engine:</span>
                        </span>
                        <strong className="text-orange-300 font-mono-numbers">
                          Real-time Curve
                        </strong>
                      </div>

                      {room.recentMultipliers && (
                        <div className="flex items-center justify-between text-[11px] text-[#9b8f7c] pt-1 border-t border-[#1f2737]">
                          <span>Recent Flights:</span>
                          <div className="flex items-center gap-1">
                            {room.recentMultipliers.map((m, i) => (
                              <span key={i} className="font-mono-numbers text-emerald-400 font-bold bg-[#141924] px-1.5 py-0.2 rounded border border-[#272a31]">
                                {m}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {room.rulesSummary && (
                        <div className="text-[10px] text-[#8b92a2] text-left pt-0.5">
                          ℹ️ {room.rulesSummary}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Dice Specific Info (Recent Rolls & Range) */}
                  {game.id === 'dice' && (
                    <div className="p-3 rounded-xl bg-[#0b0e14] border border-[#272a31] space-y-2 text-xs">
                      <div className="flex items-center justify-between text-[11px] text-[#9b8f7c]">
                        <span className="flex items-center gap-1">
                          <Percent className="w-3 h-3 text-blue-400" />
                          <span>Roll Target:</span>
                        </span>
                        <strong className="text-blue-300 font-mono-numbers">
                          1.00 – 98.00 (Over / Under)
                        </strong>
                      </div>

                      {room.recentRolls && (
                        <div className="flex items-center justify-between text-[11px] text-[#9b8f7c] pt-1 border-t border-[#1f2737]">
                          <span>Recent Rolls:</span>
                          <div className="flex items-center gap-1">
                            {room.recentRolls.map((r, i) => (
                              <span key={i} className="font-mono-numbers text-amber-300 font-bold bg-[#141924] px-1.5 py-0.2 rounded border border-[#272a31]">
                                {r}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {room.rulesSummary && (
                        <div className="text-[10px] text-[#8b92a2] text-left pt-0.5">
                          ℹ️ {room.rulesSummary}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Mines Specific Info (Grid & Multipliers) */}
                  {game.id === 'mines' && (
                    <div className="p-3 rounded-xl bg-[#0b0e14] border border-[#272a31] space-y-2 text-xs">
                      <div className="flex items-center justify-between text-[11px] text-[#9b8f7c]">
                        <span className="flex items-center gap-1">
                          <Layers className="w-3 h-3 text-red-400" />
                          <span>Board Grid:</span>
                        </span>
                        <strong className="text-red-300 font-mono-numbers">
                          {room.gridConfig || '5x5 Grid (1 - 24 Mines)'}
                        </strong>
                      </div>

                      {room.recentMultipliers && (
                        <div className="flex items-center justify-between text-[11px] text-[#9b8f7c] pt-1 border-t border-[#1f2737]">
                          <span>Recent Uncovers:</span>
                          <div className="flex items-center gap-1">
                            {room.recentMultipliers.map((m, i) => (
                              <span key={i} className="font-mono-numbers text-emerald-400 font-bold bg-[#141924] px-1.5 py-0.2 rounded border border-[#272a31]">
                                {m}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {room.rulesSummary && (
                        <div className="text-[10px] text-[#8b92a2] text-left pt-0.5">
                          ℹ️ {room.rulesSummary}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Plinko Specific Info (Rows & Risk) */}
                  {game.id === 'plinko' && (
                    <div className="p-3 rounded-xl bg-[#0b0e14] border border-[#272a31] space-y-2 text-xs">
                      <div className="flex items-center justify-between text-[11px] text-[#9b8f7c]">
                        <span className="flex items-center gap-1">
                          <Layers className="w-3 h-3 text-pink-400" />
                          <span>Pegboard Setup:</span>
                        </span>
                        <strong className="text-pink-300 font-mono-numbers">
                          {room.rowsConfig || '8 to 16 Rows'}
                        </strong>
                      </div>

                      {room.recentMultipliers && (
                        <div className="flex items-center justify-between text-[11px] text-[#9b8f7c] pt-1 border-t border-[#1f2737]">
                          <span>Recent Buckets:</span>
                          <div className="flex items-center gap-1">
                            {room.recentMultipliers.map((m, i) => (
                              <span key={i} className="font-mono-numbers text-purple-300 font-bold bg-[#141924] px-1.5 py-0.2 rounded border border-[#272a31]">
                                {m}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {room.rulesSummary && (
                        <div className="text-[10px] text-[#8b92a2] text-left pt-0.5">
                          ℹ️ {room.rulesSummary}
                        </div>
                      )}
                    </div>
                  )}

                  {/* European Roulette Specific Info (Wheel & Spins) */}
                  {game.id === 'roulette' && (
                    <div className="p-3 rounded-xl bg-[#0b0e14] border border-[#272a31] space-y-2 text-xs">
                      <div className="flex items-center justify-between text-[11px] text-[#9b8f7c]">
                        <span className="flex items-center gap-1">
                          <RotateCcw className="w-3 h-3 text-emerald-400" />
                          <span>Wheel Layout:</span>
                        </span>
                        <strong className="text-emerald-300 font-mono-numbers">
                          {room.wheelConfig || 'European Single Zero (0 - 36)'}
                        </strong>
                      </div>

                      {room.recentSpins && (
                        <div className="flex items-center justify-between text-[11px] text-[#9b8f7c] pt-1 border-t border-[#1f2737]">
                          <span>Recent Spins:</span>
                          <div className="flex items-center gap-1">
                            {room.recentSpins.map((s, i) => {
                              const num = typeof s === 'object' ? s.number : s;
                              const isGreen = num === 0 || num === '0';
                              return (
                                <span
                                  key={i}
                                  className={`font-mono-numbers font-bold px-1.5 py-0.2 rounded border ${isGreen
                                      ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                                      : 'bg-[#141924] text-amber-300 border-[#272a31]'
                                    }`}
                                >
                                  {num}
                                </span>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {room.rulesSummary && (
                        <div className="text-[10px] text-[#8b92a2] text-left pt-0.5">
                          ℹ️ {room.rulesSummary}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Coinflip Specific Info (Flip Config & Recent) */}
                  {game.id === 'coinflip' && (
                    <div className="p-3 rounded-xl bg-[#0b0e14] border border-[#272a31] space-y-2 text-xs">
                      <div className="flex items-center justify-between text-[11px] text-[#9b8f7c]">
                        <span className="flex items-center gap-1">
                          <Coins className="w-3 h-3 text-amber-400" />
                          <span>Flip Mode:</span>
                        </span>
                        <strong className="text-amber-300 font-mono-numbers">
                          {room.flipConfig || '50/50 Dual Face (1.98x Payout)'}
                        </strong>
                      </div>

                      {room.recentFlips && (
                        <div className="flex items-center justify-between text-[11px] text-[#9b8f7c] pt-1 border-t border-[#1f2737]">
                          <span>Recent Flips:</span>
                          <div className="flex items-center gap-1">
                            {room.recentFlips.map((side, i) => (
                              <span
                                key={i}
                                className="font-mono-numbers font-bold px-1.5 py-0.2 rounded border bg-[#141924] text-amber-300 border-[#272a31] capitalize"
                              >
                                {side === 'heads' ? '👑 H' : '🦅 T'}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {room.rulesSummary && (
                        <div className="text-[10px] text-[#8b92a2] text-left pt-0.5">
                          ℹ️ {room.rulesSummary}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Blackjack Specific Info (Deck & Outcomes) */}
                  {game.id === 'blackjack' && (
                    <div className="p-3 rounded-xl bg-[#0b0e14] border border-[#272a31] space-y-2 text-xs">
                      <div className="flex items-center justify-between text-[11px] text-[#9b8f7c]">
                        <span className="flex items-center gap-1">
                          <Award className="w-3 h-3 text-emerald-400" />
                          <span>Table Rules:</span>
                        </span>
                        <strong className="text-emerald-300 font-mono-numbers">
                          {room.deckConfig || '6-Deck Shoe (Dealer stands on 17)'}
                        </strong>
                      </div>

                      {room.recentOutcomes && (
                        <div className="flex items-center justify-between text-[11px] text-[#9b8f7c] pt-1 border-t border-[#1f2737]">
                          <span>Recent Hands:</span>
                          <div className="flex items-center gap-1">
                            {room.recentOutcomes.map((out, i) => (
                              <span
                                key={i}
                                className="font-mono-numbers font-bold px-1.5 py-0.2 rounded border bg-[#141924] text-emerald-400 border-[#272a31]"
                              >
                                {out}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {room.rulesSummary && (
                        <div className="text-[10px] text-[#8b92a2] text-left pt-0.5">
                          ℹ️ {room.rulesSummary}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Slots Specific Info (Reels & Top Hits) */}
                  {game.id === 'slots' && (
                    <div className="p-3 rounded-xl bg-[#0b0e14] border border-[#272a31] space-y-2 text-xs">
                      <div className="flex items-center justify-between text-[11px] text-[#9b8f7c]">
                        <span className="flex items-center gap-1">
                          <Sparkles className="w-3 h-3 text-amber-400" />
                          <span>Slot Machine:</span>
                        </span>
                        <strong className="text-amber-300 font-mono-numbers">
                          {room.reelsConfig || '3 Reels · 5 Paylines · 250x Top Jackpot'}
                        </strong>
                      </div>

                      {room.recentPayouts && (
                        <div className="flex items-center justify-between text-[11px] text-[#9b8f7c] pt-1 border-t border-[#1f2737]">
                          <span>Recent Wins:</span>
                          <div className="flex items-center gap-1">
                            {room.recentPayouts.map((win, i) => (
                              <span
                                key={i}
                                className="font-mono-numbers font-bold px-1.5 py-0.2 rounded border bg-[#141924] text-purple-300 border-[#272a31]"
                              >
                                {win}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {room.rulesSummary && (
                        <div className="text-[10px] text-[#8b92a2] text-left pt-0.5">
                          ℹ️ {room.rulesSummary}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Texas Hold'em Poker Specific Info (Table & Hand Preview) */}
                  {game.id === 'poker' && (
                    <div className="p-3 rounded-xl bg-[#0b0e14] border border-[#272a31] space-y-2 text-xs">
                      <div className="flex items-center justify-between text-[11px] text-[#9b8f7c]">
                        <span className="flex items-center gap-1">
                          <Users className="w-3 h-3 text-indigo-400" />
                          <span>Table Format:</span>
                        </span>
                        <strong className="text-indigo-300 font-mono-numbers">
                          {room.tableConfig || '6-Max Table · Blinds 5/10 FC'}
                        </strong>
                      </div>

                      {room.recentHands && (
                        <div className="flex items-center justify-between text-[11px] text-[#9b8f7c] pt-1 border-t border-[#1f2737]">
                          <span>Recent Showdowns:</span>
                          <div className="flex items-center gap-1">
                            {room.recentHands.map((hand, i) => (
                              <span
                                key={i}
                                className="font-mono-numbers font-bold px-1.5 py-0.2 rounded border bg-[#141924] text-indigo-300 border-[#272a31]"
                              >
                                {hand}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {room.rulesSummary && (
                        <div className="text-[10px] text-[#8b92a2] text-left pt-0.5">
                          ℹ️ {room.rulesSummary}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Classic Keno Specific Info (Grid & Multipliers) */}
                  {game.id === 'keno' && (
                    <div className="p-3 rounded-xl bg-[#0b0e14] border border-[#272a31] space-y-2 text-xs">
                      <div className="flex items-center justify-between text-[11px] text-[#9b8f7c]">
                        <span className="flex items-center gap-1">
                          <Hash className="w-3 h-3 text-teal-400" />
                          <span>Draw Format:</span>
                        </span>
                        <strong className="text-teal-300 font-mono-numbers">
                          {room.gridConfig || '40-Ball Board · Pick 1 to 10 Numbers'}
                        </strong>
                      </div>

                      {room.recentDraws && (
                        <div className="flex items-center justify-between text-[11px] text-[#9b8f7c] pt-1 border-t border-[#1f2737]">
                          <span>Recent Hits:</span>
                          <div className="flex items-center gap-1">
                            {room.recentDraws.map((draw, i) => (
                              <span
                                key={i}
                                className="font-mono-numbers font-bold px-1.5 py-0.2 rounded border bg-[#141924] text-teal-300 border-[#272a31]"
                              >
                                {draw}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {room.rulesSummary && (
                        <div className="text-[10px] text-[#8b92a2] text-left pt-0.5">
                          ℹ️ {room.rulesSummary}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Limbo Specific Info (Multiplier Range & Odds) */}
                  {game.id === 'limbo' && (
                    <div className="p-3 rounded-xl bg-[#0b0e14] border border-[#272a31] space-y-2 text-xs">
                      <div className="flex items-center justify-between text-[11px] text-[#9b8f7c]">
                        <span className="flex items-center gap-1">
                          <Percent className="w-3 h-3 text-yellow-400" />
                          <span>Target Capacity:</span>
                        </span>
                        <strong className="text-yellow-300 font-mono-numbers">
                          {room.targetRange || '1.01x to 10,000x Multiplier'}
                        </strong>
                      </div>

                      {room.recentMultipliers && (
                        <div className="flex items-center justify-between text-[11px] text-[#9b8f7c] pt-1 border-t border-[#1f2737]">
                          <span>Recent Flights:</span>
                          <div className="flex items-center gap-1">
                            {room.recentMultipliers.map((m, i) => (
                              <span
                                key={i}
                                className="font-mono-numbers font-bold px-1.5 py-0.2 rounded border bg-[#141924] text-yellow-300 border-[#272a31]"
                              >
                                {m}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {room.rulesSummary && (
                        <div className="text-[10px] text-[#8b92a2] text-left pt-0.5">
                          ℹ️ {room.rulesSummary}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Room Stats */}
                  <div className="grid grid-cols-2 gap-2 text-xs font-mono-numbers pt-2 border-t border-[#1f2737]">
                    <div className="bg-[#0b0e14] p-2 rounded-lg text-left">
                      <span className="text-[10px] text-[#8b92a2] block">
                        {game.id === 'lottery' ? 'Ticket Price' : 'Stake Limits'}
                      </span>
                      <strong className="text-white">
                        {game.id === 'lottery' ? `${room.minStakeFC} FC / Ticket` : `${room.minStakeFC} - ${room.maxStakeFC} FC`}
                      </strong>
                    </div>

                    <div className="bg-[#0b0e14] p-2 rounded-lg text-left">
                      <span className="text-[10px] text-[#8b92a2] block">Participants</span>
                      <strong className="text-emerald-400 flex items-center gap-1">
                        <Users className="w-3 h-3" />
                        <span>{room.currentPlayers} / {room.playerCapacity}</span>
                      </strong>
                    </div>
                  </div>
                </div>

                {/* Enter Room CTA */}
                <div className="pt-4 mt-2">
                  <button
                    onClick={() => handleEnterRoom(room.id)}
                    className="w-full py-2.5 rounded-xl btn-gold text-xs font-bold flex items-center justify-center gap-2 cursor-pointer shadow-md transition-all"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>{game.id === 'lottery' ? `Enter ${room.name.split(':')[0]}` : `Enter ${room.name.split(':')[0]}`}</span>
                  </button>
                </div>

              </div>
            );
          })}
        </div>
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
            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center gap-2.5 text-[11px] text-amber-300">
              <ShieldCheck className="w-4 h-4 text-amber-400 shrink-0" />
              <span>All game outcomes are determined server-side before execution using cryptographic seed hashing.</span>
            </div>
          </div>
        </div>
      </section>

      {/* Universal Provably Fair Audit Modal */}
      {isProofModalOpen && selectedRoundForProof && (
        <ProvablyFairModal
          isOpen={isProofModalOpen}
          onClose={() => {
            setIsProofModalOpen(false);
            setSelectedRoundForProof(null);
          }}
          auditData={{
            id: selectedRoundForProof.id,
            event_id: selectedRoundForProof.id,
            event_title: `${game.name} — Round #${selectedRoundForProof.id.slice(-8)}`,
            winning_digits: selectedRoundForProof.multiplier ? `${selectedRoundForProof.multiplier}x` : (selectedRoundForProof.payout > 0 ? 'WIN' : '0.00x'),
            commit_hash: selectedRoundForProof.serverSeedHash || selectedRoundForProof.server_seed_hash,
            revealed_seed: selectedRoundForProof.serverSeed || selectedRoundForProof.server_seed || 'Revealed upon seed rotation',
            client_seed: selectedRoundForProof.clientSeed || selectedRoundForProof.client_seed || 'client-seed-active',
            nonce: selectedRoundForProof.nonce || 1,
            payout: selectedRoundForProof.payout,
            status: selectedRoundForProof.status
          }}
        />
      )}

    </div>
  );
}

