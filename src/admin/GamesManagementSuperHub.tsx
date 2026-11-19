import React, { useState, useEffect, useMemo } from 'react';
import { 
  Gamepad2, 
  Dices, 
  Sliders, 
  Settings, 
  Layers, 
  History, 
  ShieldCheck, 
  PlusCircle, 
  RefreshCw, 
  Search, 
  CheckCircle2, 
  XCircle, 
  Pause, 
  Play, 
  Edit3, 
  Trash2, 
  ExternalLink, 
  Copy, 
  Check, 
  Coins, 
  Trophy, 
  Flame, 
  Users, 
  Image, 
  Upload, 
  Clock, 
  Hash, 
  AlertTriangle,
  Lock,
  Unlock,
  ChevronRight,
  ArrowLeft,
  ArrowRight,
  Filter,
  Flag,
  Percent,
  Calendar,
  Sparkles,
  Zap,
  TrendingUp,
  Eye,
  X
} from 'lucide-react';
import { useLottery } from '../context/LotteryContext';
import { GAMES, gameRoomManager, ROOM_TYPES, ROOM_STATUSES, getGameIconUrl } from '../engine';
import { supabase } from '../lib/supabase';
import ProvablyFairModal from '../components/ProvablyFairModal';

export default function GamesManagementSuperHub({
  initialSubTab = 'all-games',
  // Lottery Props (100% preservation)
  events = [] as any[],
  activeEvents = [] as any[],
  eventTitle,
  setEventTitle,
  ticketPrice,
  setTicketPrice,
  durationValue,
  setDurationValue,
  durationUnit,
  setDurationUnit,
  prizeType,
  setPrizeType,
  minPrize,
  setMinPrize,
  maxPrize,
  setMaxPrize,
  initialJackpot,
  setInitialJackpot,
  eventWinningDigits,
  setEventWinningDigits,
  eventBadge,
  setEventBadge,
  eventBannerImage,
  setEventBannerImage,
  handleBannerFileUpload,
  eventWinnerSharePercent,
  setEventWinnerSharePercent,
  eventWinnerCount,
  setEventWinnerCount,
  handleCreateSubmit,
  selectedEventId,
  setSelectedEventId,
  drawWinnerCount,
  setDrawWinnerCount,
  customDigits,
  setCustomDigits,
  handleTriggerDraw,
  adminDeleteEvent,
  showToast
}: any) {
  // Selected Game for Dedicated Management (null = Main 4-column card view)
  const [selectedGameId, setSelectedGameId] = useState<string | null>(null);

  // Search & Category Filters for Main Game Management View
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');

  // Dedicated Game Management Sub-tab
  const [gameSubTab, setGameSubTab] = useState('overview');

  // Database Data States
  const [gameConfigs, setGameConfigs] = useState<any[]>([]);
  const [rooms, setRooms] = useState<any[]>([]);
  const [gameRounds, setGameRounds] = useState<any[]>([]);
  const [loadingData, setLoadingData] = useState(false);

  // Selected Room Edit Modal
  const [selectedRoomToEdit, setSelectedRoomToEdit] = useState<any>(null);
  const [isCreateRoomOpen, setIsCreateRoomOpen] = useState(false);

  // Active Game Config Form state
  const [activeConfigForm, setActiveConfigForm] = useState<any>({});
  const [savingConfig, setSavingConfig] = useState(false);

  // Fairness Audit Calculator state
  const [verifyServerSeed, setVerifyServerSeed] = useState('');
  const [verifyClientSeed, setVerifyClientSeed] = useState('client_seed_audit_01');
  const [verifyNonce, setVerifyNonce] = useState('1');
  const [verifyCalcResult, setVerifyCalcResult] = useState<any>(null);
  const [copiedText, setCopiedText] = useState<any>(null);

  // Context hooks (Preserved & Enhanced)
  const lotteryCtx = useLottery();
  const directCreateEvent = lotteryCtx?.adminCreateEvent;
  const directDeleteEvent = lotteryCtx?.adminDeleteEvent || adminDeleteEvent;
  const directExecuteDraw = lotteryCtx?.executeDraw || handleTriggerDraw;
  const directUpdateWinnerConfig = lotteryCtx?.adminUpdateEventWinnerConfig;
  const directPauseEvent = lotteryCtx?.adminPauseEvent;
  const directUpdateEvent = lotteryCtx?.adminUpdateEvent;
  const liveEvents = lotteryCtx?.events || events || [];
  const allTickets = lotteryCtx?.tickets || [];
  const allAudits = lotteryCtx?.drawAudits || [];
  const allPayouts = lotteryCtx?.winnerPayouts || [];

  // Central Event Table Filters (Part 7.2 & 8)
  const [lotteryRoomFilter, setLotteryRoomFilter] = useState('all');
  const [lotteryStatusFilter, setLotteryStatusFilter] = useState('all');
  const [lotterySearchQuery, setLotterySearchQuery] = useState('');

  // Real-time authoritative clock for live countdowns across all cards
  const [currentTime, setCurrentTime] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const formatCountdown = (drawTime?: number) => {
    if (!drawTime) return '00:00:00';
    const diff = drawTime - currentTime;
    if (diff <= 0) return '00:00:00';
    const totalSeconds = Math.floor(diff / 1000);
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const generateAutoDescription = (data: { eventName: string; durationHours: number; durationMinutes: number; ticketAvailability: string; maxTotalTickets: number; ticketPrice: number; jackpotMode: string; fixedJackpot: number; minJackpot: number; maxJackpot: number }) => {
    const name = data.eventName.trim() || 'Four Digit Lottery Pot';
    const pot = data.jackpotMode === 'fixed' ? `${data.fixedJackpot} USDT guaranteed prize pool` : `${data.minJackpot} to ${data.maxJackpot} USDT dynamic jackpot range`;
    const durParts: string[] = [];
    if (data.durationHours > 0) durParts.push(`${data.durationHours} hr${data.durationHours > 1 ? 's' : ''}`);
    if (data.durationMinutes > 0) durParts.push(`${data.durationMinutes} min${data.durationMinutes > 1 ? 's' : ''}`);
    const durStr = durParts.join(' ') || '30 mins';
    const tktStr = data.ticketAvailability === 'limited' ? `Limited to ${data.maxTotalTickets} tickets` : 'Unlimited tickets';
    return `Autonomous 4-digit draw for ${name}. Featuring ${pot} with ${data.ticketPrice} USDT ticket price. ${tktStr}. Active duration: ${durStr}.`;
  };

  // 4-Step Event Creation Wizard Modal State (Parts 1 - 4)
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [wizardStep, setWizardStep] = useState(1);
  const [wizardData, setWizardData] = useState({
    eventId: 'evt-' + Date.now().toString(36) + '-' + Math.floor(100 + Math.random() * 900),
    eventName: '',
    eventTag: 'BATCH-' + Math.floor(1000 + Math.random() * 9000),
    roomName: 'Room 1: Grand Pot Arena',
    roomDescription: '',
    ticketAvailability: 'unlimited' as 'unlimited' | 'limited',
    maxTotalTickets: 500,
    durationHours: 2,
    durationMinutes: 30,
    ticketPrice: 10,
    currency: 'USDT',
    jackpotMode: 'fixed' as 'fixed' | 'range',
    fixedJackpot: 5000,
    minJackpot: 1000,
    maxJackpot: 10000,
    jackpotSelectionMethod: 'manual' as 'manual' | 'random',
    selectedJackpotAmount: 5000,
    winnerMode: 'single' as 'single' | 'multiple',
    winnerCount: 1,
    winningCodesOption: 'preset' as 'preset' | 'later',
    winningCodes: ['2538'] as string[],
    winnerPayoutSharePercent: 90,
    distributionRule: 'tiered' as 'equal' | 'tiered',
    winnerDistribution: [{ position: 1, percent: 100 }] as Array<{ position: number; percent: number }>,
    badge: 'VIP LOTTERY',
    bannerImage: ''
  });
  const [isSubmittingWizard, setIsSubmittingWizard] = useState(false);

  // Modals for Contextual Actions on Events
  const [viewDetailsEvent, setViewDetailsEvent] = useState<any | null>(null);
  const [winnerConfigEvent, setWinnerConfigEvent] = useState<any | null>(null);

  // Winning Digits Management Modal Inner State
  const [wcWinnerMode, setWcWinnerMode] = useState<'single' | 'multiple'>('single');
  const [wcWinnerCount, setWcWinnerCount] = useState(1);
  const [wcDrawMode, setWcDrawMode] = useState<'random' | 'preset'>('preset');
  const [wcWinningCodes, setWcWinningCodes] = useState<string[]>(['2538']);
  const [wcDistribution, setWcDistribution] = useState<Array<{ position: number; percent: number }>>([{ position: 1, percent: 100 }]);
  const [wcPayoutSharePercent, setWcPayoutSharePercent] = useState(90);
  const [wcSaving, setWcSaving] = useState(false);

  // Helper: Generate distinct 4-digit codes
  const generateDistinctCodes = (count: number): string[] => {
    const list: string[] = [];
    while (list.length < count) {
      const c = String(Math.floor(Math.random() * 10000)).padStart(4, '0');
      if (!list.includes(c)) list.push(c);
    }
    return list;
  };

  // Helper: Duplicate detection
  const hasDuplicateCodes = (codes: string[]): boolean => {
    const valid = codes.filter(c => /^\d{4}$/.test(c));
    return new Set(valid).size !== valid.length;
  };

  // Helper: Open Winning Digits Management Modal for specific event
  const openWinnerConfig = (evt: any) => {
    setWinnerConfigEvent(evt);
    const mode = evt.winnerMode === 'multiple' ? 'multiple' : 'single';
    setWcWinnerMode(mode);
    const count = evt.winningCodeCount || evt.winnerCount || (mode === 'multiple' ? 3 : 1);
    setWcWinnerCount(count);
    setWcDrawMode(evt.drawMode === 'preset' ? 'preset' : 'random');

    let codes: string[] = [];
    if (Array.isArray(evt.winningCodes) && evt.winningCodes.length > 0) {
      codes = evt.winningCodes
        .map((c: any) => String(c).replace(/\D/g, '').padStart(4, '0'))
        .filter((c: string) => c.length === 4);
    } else if (evt.presetWinningDigits) {
      codes = [String(evt.presetWinningDigits).replace(/\D/g, '').padStart(4, '0')];
    } else if (evt.winningDigits) {
      codes = [String(evt.winningDigits).replace(/\D/g, '').padStart(4, '0')];
    } else if (mode === 'single') {
      codes = ['2538'];
    } else {
      codes = ['2538', '7412', '9065'];
    }
    setWcWinningCodes(codes);
    setWcPayoutSharePercent(evt.winnerPayoutSharePercent || evt.winnerSharePercent || 90);

    if (Array.isArray(evt.winnerDistribution) && evt.winnerDistribution.length > 0) {
      setWcDistribution(evt.winnerDistribution);
    } else if (mode === 'single') {
      setWcDistribution([{ position: 1, percent: 100 }]);
    } else {
      const eq = parseFloat((100 / count).toFixed(2));
      const dist = Array.from({ length: count }, (_, i) => ({
        position: i + 1,
        percent: i === count - 1 ? parseFloat((100 - eq * (count - 1)).toFixed(2)) : eq
      }));
      setWcDistribution(dist);
    }
  };

  // Fetch all configurations, rooms, and rounds from Supabase
  const fetchAllSuperHubData = async () => {
    setLoadingData(true);
    try {
      const { data: configsData } = await supabase.from('game_configurations').select('*');
      if (configsData && configsData.length > 0) {
        setGameConfigs(configsData);
      }

      const { data: roomsData } = await supabase
        .from('game_rooms')
        .select('*')
        .order('sort_order', { ascending: true });
      if (roomsData && roomsData.length > 0) {
        setRooms(roomsData);
      } else {
        setRooms(gameRoomManager.getAllRooms());
      }

      const { data: roundsData } = await supabase
        .from('game_rounds')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200);
      if (roundsData) {
        setGameRounds(roundsData);
      }
    } catch (err: any) {
      console.warn('SuperHub data sync fallback:', err?.message);
      setRooms(gameRoomManager.getAllRooms());
    } finally {
      setLoadingData(false);
    }
  };

  useEffect(() => {
    fetchAllSuperHubData();
  }, []);

  // Filtered games list for the main centralized view
  const filteredGames = useMemo(() => {
    return GAMES.filter(g => {
      const matchesSearch = 
        g.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        g.shortName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        g.description.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = selectedCategory === 'all' || g.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [searchQuery, selectedCategory]);

  // Selected game object
  const activeGame = useMemo(() => {
    if (!selectedGameId) return null;
    return GAMES.find(g => g.id === selectedGameId) || null;
  }, [selectedGameId]);

  // Dynamic active game count calculated from database configurations
  const activeGamesCount = useMemo(() => {
    if (gameConfigs && gameConfigs.length > 0) {
      const active = gameConfigs.filter(c => (c.status === 'active' || !c.status) && c.is_enabled !== false);
      if (active.length > 0) return active.length;
    }
    return GAMES.length;
  }, [gameConfigs]);

  // When a game is selected, populate active config form and set default subTab
  useEffect(() => {
    if (activeGame) {
      const config = gameConfigs.find(c => c.game_id === activeGame.id);
      if (config) {
        setActiveConfigForm({
          house_edge: config.house_edge || activeGame.houseEdge,
          rtp: config.rtp || activeGame.rtp,
          min_stake_fc: config.min_stake_fc || activeGame.minStakeFC,
          max_stake_fc: config.max_stake_fc || activeGame.maxStakeFC,
          is_enabled: config.is_enabled !== false,
          rules_config: config.rules_config || {}
        });
      } else {
        setActiveConfigForm({
          house_edge: activeGame.houseEdge,
          rtp: activeGame.rtp,
          min_stake_fc: activeGame.minStakeFC,
          max_stake_fc: activeGame.maxStakeFC,
          is_enabled: true,
          rules_config: {}
        });
      }
      setGameSubTab('overview');
    }
  }, [activeGame, gameConfigs]);

  // Handle Master Game Toggle (Enable/Disable)
  const handleToggleGame = async (gameId: string, currentEnabled: boolean) => {
    const nextVal = !currentEnabled;
    try {
      const { error } = await supabase
        .from('game_configurations')
        .upsert({ 
          game_id: gameId, 
          is_enabled: nextVal, 
          updated_at: new Date().toISOString() 
        }, { onConflict: 'game_id' });

      if (error) throw error;

      setGameConfigs(prev => {
        const exists = prev.some(c => c.game_id === gameId);
        if (exists) {
          return prev.map(c => c.game_id === gameId ? { ...c, is_enabled: nextVal } : c);
        }
        return [...prev, { game_id: gameId, is_enabled: nextVal }];
      });

      if (showToast) {
        showToast(nextVal ? `${gameId.toUpperCase()} enabled successfully.` : `${gameId.toUpperCase()} set to maintenance.`, 'success');
      }
    } catch (err) {
      console.error('Error toggling game:', err);
      if (showToast) showToast('Failed to update game status in database', 'error');
    }
  };

  // Handle saving game configuration to Supabase
  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeGame) return;
    setSavingConfig(true);
    try {
      const payload = {
        game_id: activeGame.id,
        game_name: activeGame.name,
        category: activeGame.category,
        house_edge: parseFloat(activeConfigForm.house_edge) || activeGame.houseEdge,
        rtp: parseFloat(activeConfigForm.rtp) || activeGame.rtp,
        min_stake_fc: parseFloat(activeConfigForm.min_stake_fc) || activeGame.minStakeFC,
        max_stake_fc: parseFloat(activeConfigForm.max_stake_fc) || activeGame.maxStakeFC,
        is_enabled: activeConfigForm.is_enabled !== false,
        rules_config: activeConfigForm.rules_config || {},
        updated_at: new Date().toISOString()
      };

      const { error } = await supabase
        .from('game_configurations')
        .upsert(payload, { onConflict: 'game_id' });

      if (error) throw error;

      setGameConfigs(prev => prev.map(c => c.game_id === activeGame.id ? { ...c, ...payload } : c));
      if (showToast) showToast(`${activeGame.name} settings updated and persisted!`, 'success');
    } catch (err: any) {
      console.error('Failed to save config:', err);
      if (showToast) showToast(err?.message || 'Error saving game settings', 'error');
    } finally {
      setSavingConfig(false);
    }
  };

  // Copy to clipboard helper
  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(id);
    if (showToast) showToast('Copied to clipboard!', 'info');
    setTimeout(() => setCopiedText(null), 2000);
  };

  // --------------------------------------------------------------------------
  // VIEW 1: CENTRALIZED GAME CARDS GRID (4 CARDS PER ROW ON DESKTOP)
  // --------------------------------------------------------------------------
  if (!activeGame) {
    return (
      <div className="space-y-6 text-left animate-in fade-in duration-150">
        {/* Header Banner & Live Stats */}
        <div className="bg-gradient-to-r from-[#151C2B] via-[#0F1420] to-[#0B0F19] border border-amber-500/30 p-4 sm:p-6 rounded-2xl sm:rounded-3xl shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/40 text-amber-400 flex items-center justify-center">
                <Gamepad2 className="w-5 h-5" />
              </div>
              <h2 className="font-display font-black text-lg sm:text-xl text-white">
                Game Management System
              </h2>
            </div>
            <p className="text-xs text-[#94A3B8] max-w-2xl">
              Centralized administrative hub for all {activeGamesCount} active games. Select any game card to configure its events, mathematical models, room limits, and Provably Fair seeds.
            </p>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
            <div className="px-3 py-1.5 rounded-xl bg-[#07090d] border border-[#272a31] text-xs font-mono-numbers">
              <span className="text-[#94A3B8] block text-[10px]">Active Games:</span>
              <strong className="text-amber-400 text-sm">{activeGamesCount} Active Games</strong>
            </div>
            <div className="px-3 py-1.5 rounded-xl bg-[#07090d] border border-[#272a31] text-xs font-mono-numbers">
              <span className="text-[#94A3B8] block text-[10px]">Total Rooms:</span>
              <strong className="text-emerald-400 text-sm">{rooms.length} Active</strong>
            </div>
          </div>
        </div>

        {/* Filter & Search Bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-[#0d1117] p-2.5 rounded-2xl border border-[#272a31]">
          {/* Category Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
            {[
              { id: 'all', label: 'All Games' },
              { id: 'lottery', label: 'Lottery' },
              { id: 'instant', label: 'Instant' },
              { id: 'arcade', label: 'Arcade' },
              { id: 'table', label: 'Table' }
            ].map(cat => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                  selectedCategory === cat.id
                    ? 'bg-amber-500 text-black shadow-sm font-black'
                    : 'bg-[#141924] hover:bg-[#1a2130] text-[#94A3B8] hover:text-white border border-[#272a31]'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* Search Input */}
          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 text-[#94A3B8] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search active games..."
              className="w-full bg-[#07090d] border border-[#272a31] rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-[#64748b] outline-none focus:border-amber-400/50"
            />
          </div>
        </div>

        {/* 2 CARDS PER ROW DESKTOP GRID (Responsive 1 Column Mobile -> 2 Columns Desktop) */}
        {loadingData ? (
          <div className="p-12 text-center bg-[#07090d] border border-[#272a31] rounded-2xl">
            <RefreshCw className="w-6 h-6 animate-spin text-amber-400 mx-auto mb-2" />
            <p className="text-xs text-[#94A3B8]">Loading active games from database...</p>
          </div>
        ) : filteredGames.length === 0 ? (
          <div className="p-12 text-center bg-[#07090d] border border-[#272a31] rounded-2xl">
            <Gamepad2 className="w-8 h-8 text-[#64748b] mx-auto mb-2" />
            <p className="text-sm font-bold text-white">No active games match your filter</p>
            <p className="text-xs text-[#94A3B8] mt-1">Try resetting the category filter or search query</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 2xl:grid-cols-4 gap-4 sm:gap-5 lg:gap-6">
            {filteredGames.map((game) => {
              const config = gameConfigs.find(c => c.game_id === game.id) || {};
              const isEnabled = config.is_enabled !== false;
              const gameRooms = rooms.filter(r => r.game_id === game.id || r.gameId === game.id);
              const gameRoundCount = game.id === 'lottery' ? events.length : gameRounds.filter(r => r.game_id === game.id).length;

              return (
                <div
                  key={game.id}
                  className={`glass-panel rounded-2xl p-4 sm:p-5 flex flex-col justify-between transition-all duration-200 hover:-translate-y-1 border min-h-[320px] h-full ${
                    isEnabled ? 'border-[#272a31] hover:border-amber-500/40' : 'border-red-500/30 opacity-75'
                  }`}
                >
                  <div className="space-y-3">
                  {/* Top Row: Thumbnail + Category & Status Toggle */}
                  <div className="flex items-start justify-between gap-2.5">
                    <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl bg-[#141924] border border-amber-500/40 overflow-hidden shrink-0 shadow-inner flex items-center justify-center">
                      <img
                        src={getGameIconUrl(game.id) || game.icon || game.image}
                        alt={game.name}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                    </div>

                    <div className="flex flex-col items-end gap-1.5">
                      <span className="text-[10px] font-mono-numbers px-2 py-0.5 rounded-md bg-[#141924] text-amber-300 border border-amber-500/30 font-bold uppercase tracking-wider">
                        {game.badge || 'PROVABLY FAIR'}
                      </span>

                      <button
                        type="button"
                        onClick={() => handleToggleGame(game.id, isEnabled)}
                        className={`px-2 py-0.5 rounded-full text-[9px] font-bold flex items-center gap-1 transition-all cursor-pointer ${
                          isEnabled
                            ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                            : 'bg-red-500/15 text-red-400 border border-red-500/30'
                        }`}
                        title="Click to toggle game status"
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${isEnabled ? 'bg-emerald-400 animate-pulse' : 'bg-red-400'}`} />
                        <span>{isEnabled ? 'ACTIVE' : 'MAINTENANCE'}</span>
                      </button>
                    </div>
                  </div>

                  {/* Title & Description */}
                  <div>
                    <h3 className="font-display font-extrabold text-base text-white truncate">
                      {game.name}
                    </h3>
                    <p className="text-[11px] text-[#94A3B8] line-clamp-2 mt-1 leading-relaxed">
                      {game.description}
                    </p>
                  </div>

                  {/* Core Metrics Grid */}
                  <div className="grid grid-cols-2 gap-2 p-2.5 rounded-xl bg-[#0b0e14] border border-[#1f2737] text-[11px] font-mono-numbers">
                    <div>
                      <span className="text-[9px] text-[#8b92a2] block uppercase">Math Model</span>
                      <strong className="text-emerald-400 font-bold">
                        {config.rtp || game.rtp}% RTP
                      </strong>
                    </div>
                    <div>
                      <span className="text-[9px] text-[#8b92a2] block uppercase">House Edge</span>
                      <strong className="text-amber-400 font-bold">
                        {config.house_edge || game.houseEdge}% Edge
                      </strong>
                    </div>
                    <div>
                      <span className="text-[9px] text-[#8b92a2] block uppercase">Stake Bounds</span>
                      <strong className="text-white">
                        {(config.min_stake_fc || game.minStakeUSDT || game.minStakeFC || 1)}-{(config.max_stake_fc || game.maxStakeUSDT || game.maxStakeFC || 1000)} USDT
                      </strong>
                    </div>
                    <div>
                      <span className="text-[9px] text-[#8b92a2] block uppercase">Live Activity</span>
                      <strong className="text-purple-300">
                        {gameRooms.length} Tables · {gameRoundCount} Rounds
                      </strong>
                    </div>
                  </div>
                </div>

                {/* Card Actions: Primary Manage Button */}
                <div className="pt-4 mt-2 border-t border-[#1f2737]">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedGameId(game.id);
                      setGameSubTab('overview');
                    }}
                    className="w-full py-2.5 rounded-xl btn-gold text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5 cursor-pointer shadow-md hover:scale-[1.01] transition-transform"
                  >
                    <Settings className="w-3.5 h-3.5" />
                    <span>Manage Game</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

  // --------------------------------------------------------------------------
  // VIEW 2: DEDICATED INDIVIDUAL GAME MANAGEMENT PAGE
  // --------------------------------------------------------------------------
  const gameRooms = rooms.filter(r => r.game_id === activeGame.id || r.gameId === activeGame.id);

  return (
    <div className="space-y-6 text-left animate-in fade-in duration-150">
      {/* Top Header: Back button + Game Branding + Status */}
      <div className="p-4 sm:p-5 rounded-2xl sm:rounded-3xl bg-gradient-to-r from-[#151C2B] via-[#0F1420] to-[#0B0F19] border border-amber-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xl">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setSelectedGameId(null)}
            className="px-3 py-2 rounded-xl bg-[#141924] hover:bg-[#1f2737] text-xs font-bold text-[#94A3B8] hover:text-white border border-[#272a31] flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
            title="Return to Centralized Game Cards"
          >
            <ArrowLeft className="w-4 h-4 text-amber-400" />
            <span>All Games</span>
          </button>

          <div className="w-12 h-12 rounded-xl bg-[#141924] border border-amber-500/40 overflow-hidden shrink-0 flex items-center justify-center shadow-inner">
            <img
              src={getGameIconUrl(activeGame.id) || activeGame.icon || activeGame.image}
              alt={activeGame.name}
              className="w-full h-full object-cover"
            />
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-display font-black text-lg sm:text-xl text-white">
                {activeGame.name}
              </h2>
              <span className="text-[9px] font-mono-numbers px-2 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30 uppercase font-bold">
                {activeGame.badge || 'PROVABLY FAIR'}
              </span>
            </div>
            <p className="text-xs text-[#94A3B8] mt-0.5">
              Dedicated Management Console · Category: <span className="text-amber-300 uppercase font-bold">{activeGame.category}</span>
            </p>
          </div>
        </div>

        {/* Master status switch */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => handleToggleGame(activeGame.id, activeConfigForm.is_enabled !== false)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
              activeConfigForm.is_enabled !== false
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-xs'
                : 'bg-red-500/20 text-red-300 border border-red-500/40'
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${activeConfigForm.is_enabled !== false ? 'bg-emerald-400 animate-pulse' : 'bg-red-400'}`} />
            <span>{activeConfigForm.is_enabled !== false ? 'MODULE ACTIVE' : 'UNDER MAINTENANCE'}</span>
          </button>
        </div>
      </div>

            {/* SUB-NAVIGATION TABS FOR NON-LOTTERY GAMES ONLY (Part 7.1) */}
      {activeGame.id !== 'lottery' && (
        <div className="flex items-center gap-1.5 p-1.5 bg-[#0d1117] border border-[#272a31] rounded-2xl overflow-x-auto no-scrollbar shadow-inner text-xs">
          <button
            type="button"
            onClick={() => setGameSubTab('overview')}
            className={`px-3.5 py-2 rounded-xl font-bold flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
              gameSubTab === 'overview' ? 'bg-amber-500 text-black shadow font-black' : 'text-[#8b92a2] hover:text-white'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Settings &amp; RTP</span>
          </button>

          <button
            type="button"
            onClick={() => setGameSubTab('rooms')}
            className={`px-3.5 py-2 rounded-xl font-bold flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
              gameSubTab === 'rooms' ? 'bg-amber-500 text-black shadow font-black' : 'text-[#8b92a2] hover:text-white'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Rooms &amp; Tables ({gameRooms.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setGameSubTab('fairness')}
            className={`px-3.5 py-2 rounded-xl font-bold flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
              gameSubTab === 'fairness' ? 'bg-amber-500 text-black shadow font-black' : 'text-[#8b92a2] hover:text-white'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Provably Fair Seeds</span>
          </button>

          <button
            type="button"
            onClick={() => setGameSubTab('history')}
            className={`px-3.5 py-2 rounded-xl font-bold flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
              gameSubTab === 'history' ? 'bg-amber-500 text-black shadow font-black' : 'text-[#8b92a2] hover:text-white'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span>Game Rounds History</span>
          </button>
        </div>
      )}

      {/* ==================================================================== */}
      {/* SECTION A: FOUR-DIGIT LOTTERY SPECIFIC MANAGEMENT (UNIFIED REDESIGN)  */}
      {/* ==================================================================== */}
      {activeGame.id === 'lottery' && (() => {
        // Unique rooms derived from database events and predefined game rooms
        const uniqueRooms = Array.from(new Set(liveEvents.map((e: any) => e.roomName).filter(Boolean))) as string[];

        // Central Table Filter calculation
        const filteredLotteryEvents = liveEvents
          .filter((e: any) => e.status !== 'deleted')
          .filter((e: any) => {
            if (lotteryRoomFilter !== 'all' && e.roomName !== lotteryRoomFilter) return false;
            
            const isConcluded = e.status === 'completed';
            const isDrawProcessing = e.status === 'result_pending' || (e.status === 'active' && e.drawTime && e.drawTime <= currentTime);
            const hasWinningDigits = (Array.isArray(e.winningCodes) && e.winningCodes.length > 0) || Boolean(e.presetWinningDigits) || Boolean(e.winningDigits);
            const isWaitingForDigits = isDrawProcessing && !hasWinningDigits && e.drawMode !== 'random';
            const diff = e.drawTime ? e.drawTime - currentTime : 0;
            const isExpiringSoon = !isConcluded && !isDrawProcessing && diff > 0 && diff <= 15 * 60 * 1000;
            const isActive = !isConcluded && !isDrawProcessing;

            if (lotteryStatusFilter === 'active') {
              if (!isActive) return false;
            } else if (lotteryStatusFilter === 'expiring_soon') {
              if (!isExpiringSoon) return false;
            } else if (lotteryStatusFilter === 'action_required') {
              if (!isWaitingForDigits) return false;
            } else if (lotteryStatusFilter === 'result_pending') {
              if (!isDrawProcessing) return false;
            } else if (lotteryStatusFilter === 'completed') {
              if (!isConcluded) return false;
            }

            if (lotterySearchQuery.trim()) {
              const q = lotterySearchQuery.toLowerCase();
              const mId = e.id?.toLowerCase().includes(q);
              const mTitle = e.title?.toLowerCase().includes(q);
              const mRoom = e.roomName?.toLowerCase().includes(q);
              const mTag = e.batchTag?.toLowerCase().includes(q) || e.badge?.toLowerCase().includes(q);
              if (!mId && !mTitle && !mRoom && !mTag) return false;
            }
            return true;
          });

        return (
          <div className="space-y-6">

            {/* PART 7.2: EVENT ROOM SELECTOR & CENTRAL FILTERS BAR */}
            <div className="p-4 sm:p-5 rounded-2xl bg-[#0d1117] border border-[#272a31] shadow-lg space-y-4">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                
                {/* Filters Group */}
                <div className="flex flex-wrap items-center gap-3">
                  
                  {/* Event Room Selector (Primary Filter) */}
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-[#94A3B8] flex items-center gap-1">
                      <Layers className="w-3.5 h-3.5 text-amber-400" />
                      <span>Event Room:</span>
                    </label>
                    <select
                      value={lotteryRoomFilter}
                      onChange={(e) => setLotteryRoomFilter(e.target.value)}
                      className="bg-[#07090d] border border-amber-500/40 rounded-xl px-3 py-2 text-xs font-bold text-white outline-none cursor-pointer focus:border-amber-400 min-w-[200px]"
                    >
                      <option value="all">All Rooms ({liveEvents.filter((e: any) => e.status !== 'deleted').length} Events)</option>
                      {uniqueRooms.map((rm) => {
                        const count = liveEvents.filter((e: any) => e.status !== 'deleted' && e.roomName === rm).length;
                        return (
                          <option key={rm} value={rm}>
                            {rm} ({count})
                          </option>
                        );
                      })}
                    </select>
                  </div>

                  {/* Status Filter */}
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-[#94A3B8] flex items-center gap-1">
                      <Filter className="w-3.5 h-3.5 text-purple-400" />
                      <span>Event Status:</span>
                    </label>
                    <select
                      value={lotteryStatusFilter}
                      onChange={(e) => setLotteryStatusFilter(e.target.value)}
                      className="bg-[#07090d] border border-[#272a31] rounded-xl px-3 py-2 text-xs font-bold text-white outline-none cursor-pointer focus:border-purple-400 min-w-[150px]"
                    >
                      <option value="all">All Statuses</option>
                      <option value="active">● Active</option>
                      <option value="expiring_soon">⏳ Expiring Soon (&lt;15m)</option>
                      <option value="action_required">⚠️ Action Required (Set Digits)</option>
                      <option value="result_pending">⏳ Expired / Draw Processing</option>
                      <option value="completed">✓ Settled &amp; Paid</option>
                    </select>
                  </div>

                  {/* Search Query */}
                  <div className="space-y-1 flex-1 min-w-[200px]">
                    <label className="text-[11px] font-bold text-[#94A3B8] flex items-center gap-1">
                      <Search className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Search Events:</span>
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        value={lotterySearchQuery}
                        onChange={(e) => setLotterySearchQuery(e.target.value)}
                        placeholder="Search by Event Name, Tag or ID..."
                        className="w-full bg-[#07090d] border border-[#272a31] rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-emerald-400"
                      />
                      {lotterySearchQuery && (
                        <button
                          type="button"
                          onClick={() => setLotterySearchQuery('')}
                          className="absolute right-2.5 top-2 text-[#64748B] hover:text-white text-xs cursor-pointer"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  </div>

                </div>

                {/* Primary Action Button: + Create New Event */}
                <button
                  type="button"
                  onClick={() => {
                    const initialTag = 'BATCH-' + Math.floor(1000 + Math.random() * 9000);
                    const initialData = {
                      eventId: 'evt-' + Date.now().toString(36) + '-' + Math.floor(100 + Math.random() * 900),
                      eventName: '',
                      eventTag: initialTag,
                      roomName: uniqueRooms[0] || 'Room 1: Grand Pot Arena',
                      roomDescription: '',
                      ticketAvailability: 'unlimited' as const,
                      maxTotalTickets: 500,
                      durationHours: 2,
                      durationMinutes: 30,
                      ticketPrice: 10,
                      currency: 'USDT',
                      jackpotMode: 'fixed' as const,
                      fixedJackpot: 5000,
                      minJackpot: 1000,
                      maxJackpot: 10000,
                      jackpotSelectionMethod: 'manual' as const,
                      selectedJackpotAmount: 5000,
                      winnerMode: 'single' as const,
                      winnerCount: 1,
                      winningCodesOption: 'preset' as const,
                      winningCodes: ['2538'],
                      winnerPayoutSharePercent: 90,
                      distributionRule: 'tiered' as const,
                      winnerDistribution: [{ position: 1, percent: 100 }],
                      badge: 'VIP LOTTERY',
                      bannerImage: ''
                    };
                    initialData.roomDescription = generateAutoDescription(initialData);
                    setWizardData(initialData);
                    setWizardStep(1);
                    setIsWizardOpen(true);
                  }}
                  className="px-4 py-2.5 rounded-xl btn-gold text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer shadow-lg shrink-0 self-stretch sm:self-auto"
                >
                  <PlusCircle className="w-4 h-4" />
                  <span>+ Create New Event</span>
                </button>

              </div>
            </div>

            {/* PART 8: CENTRAL EVENT MANAGEMENT TABLE */}
            <div className="bg-[#0d1117] border border-[#272a31] rounded-2xl shadow-xl overflow-hidden">
              <div className="p-4 sm:p-5 border-b border-[#1f2737] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="font-display font-extrabold text-base text-white flex items-center gap-2">
                    <Layers className="w-4 h-4 text-amber-400" />
                    <span>Four-Digit Lottery Events Management Center</span>
                  </h3>
                  <p className="text-xs text-[#94A3B8]">
                    Every event is an independent room instance with isolated winning codes, jackpot policies, and settlements.
                  </p>
                </div>
                <div className="text-xs text-[#94A3B8] font-mono-numbers">
                  Showing <strong className="text-white">{filteredLotteryEvents.length}</strong> of <strong className="text-amber-400">{liveEvents.filter((e: any) => e.status !== 'deleted').length}</strong> events
                </div>
              </div>

              {filteredLotteryEvents.length === 0 ? (
                <div className="p-12 text-center space-y-4">
                  <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mx-auto text-amber-400">
                    <Layers className="w-7 h-7" />
                  </div>
                  <h4 className="font-display font-bold text-base text-white">
                    No Matching Lottery Events Found
                  </h4>
                  <p className="text-xs text-[#94A3B8] max-w-md mx-auto">
                    {liveEvents.filter((e: any) => e.status !== 'deleted').length === 0
                      ? 'There are currently zero lottery events in the database. Click below to launch the 8-Step Event Creation Wizard and deploy your first event.'
                      : 'No events matched your current room, status, or search filters. Clear your filters or deploy a new event.'}
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setLotteryRoomFilter('all');
                      setLotteryStatusFilter('all');
                      setLotterySearchQuery('');
                      setIsWizardOpen(true);
                    }}
                    className="px-4 py-2.5 rounded-xl btn-gold text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer shadow-md"
                  >
                    <PlusCircle className="w-4 h-4" />
                    <span>Deploy New Event</span>
                  </button>
                </div>
              ) : (
                <div className="p-4 sm:p-5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-5">
                    {filteredLotteryEvents.map((evt: any) => {
                      const isConcluded = evt.status === 'completed';
                      const isDrawProcessing = evt.status === 'result_pending' || (evt.status === 'active' && evt.drawTime && evt.drawTime <= currentTime);
                      const hasWinningDigits = (Array.isArray(evt.winningCodes) && evt.winningCodes.length > 0) || Boolean(evt.presetWinningDigits) || Boolean(evt.winningDigits);
                      const isWaitingForDigits = isDrawProcessing && !hasWinningDigits && evt.drawMode !== 'random';
                      const diff = evt.drawTime ? evt.drawTime - currentTime : 0;
                      const isExpiringSoon = !isConcluded && !isDrawProcessing && diff > 0 && diff <= 15 * 60 * 1000;
                      const isActive = !isConcluded && !isDrawProcessing;
                      const currency = evt.currency || 'USDT';

                      // Winning codes display
                      const codesList: string[] = Array.isArray(evt.winningCodes) && evt.winningCodes.length > 0
                        ? evt.winningCodes
                        : evt.presetWinningDigits
                          ? [evt.presetWinningDigits]
                          : [];

                      return (
                        <div
                          key={evt.id}
                          className="glass-panel rounded-2xl p-4 sm:p-5 flex flex-col justify-between border border-[#272a31] hover:border-amber-500/40 transition-all duration-200 shadow-md hover:shadow-xl group"
                        >
                          {/* Card Top: Batch Tag & Status Pill */}
                          <div>
                            <div className="flex items-center justify-between gap-2 mb-2">
                              <div className="flex items-center gap-1.5 min-w-0">
                                <span className="text-[9px] px-2 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30 uppercase font-black truncate max-w-[130px]" title={evt.batchTag || evt.badge || 'VIP LOTTERY'}>
                                  {evt.batchTag || evt.badge || 'VIP DRAW'}
                                </span>
                                <span className="text-[9px] text-[#64748B] font-mono-numbers truncate">
                                  {evt.roomName || 'Arena 1'}
                                </span>
                              </div>

                              {/* Dynamic Single-Source Status Pill */}
                              {isConcluded ? (
                                <span className="px-2 py-0.5 rounded border bg-purple-500/15 text-purple-300 border-purple-500/30 text-[10px] font-black inline-flex items-center gap-1">
                                  <CheckCircle2 className="w-3 h-3 text-purple-400" />
                                  <span>SETTLED &amp; PAID</span>
                                </span>
                              ) : isWaitingForDigits ? (
                                <span className="px-2 py-0.5 rounded border bg-amber-500/20 text-amber-300 border-amber-500/40 text-[10px] font-black inline-flex items-center gap-1 animate-pulse">
                                  <AlertTriangle className="w-3 h-3 text-amber-400" />
                                  <span>ACTION REQUIRED</span>
                                </span>
                              ) : isDrawProcessing ? (
                                <span className="px-2 py-0.5 rounded border bg-indigo-500/20 text-indigo-300 border-indigo-500/40 text-[10px] font-black inline-flex items-center gap-1 animate-pulse">
                                  <Clock className="w-3 h-3 text-indigo-400" />
                                  <span>DRAW PROCESSING</span>
                                </span>
                              ) : isExpiringSoon ? (
                                <span className="px-2 py-0.5 rounded border bg-amber-500/15 text-amber-300 border-amber-500/40 text-[10px] font-black inline-flex items-center gap-1 animate-pulse">
                                  <Clock className="w-3 h-3 text-amber-400" />
                                  <span>EXPIRING SOON</span>
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded border bg-emerald-500/15 text-emerald-300 border-emerald-500/40 text-[10px] font-black inline-flex items-center gap-1">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping inline-block" />
                                  <span>ACTIVE</span>
                                </span>
                              )}
                            </div>

                            {/* Event Title */}
                            <div>
                              <h4 className="font-display font-extrabold text-white text-sm sm:text-base line-clamp-1 group-hover:text-amber-400 transition-colors" title={evt.title}>
                                {evt.title}
                              </h4>
                              <p className="font-sans text-[11px] text-[#94A3B8] line-clamp-1 mt-0.5" title={evt.description || evt.roomDescription}>
                                {evt.description || evt.roomDescription || 'Autonomous 4-digit lottery draw'}
                              </p>
                            </div>

                            {/* Event ID with copy button */}
                            <div className="flex items-center gap-1.5 text-xs text-[#94A3B8] font-mono-numbers mt-2 pt-2 border-t border-[#1f2737]/60">
                              <span className="text-[10px] uppercase text-[#64748B]">ID:</span>
                              <span className="text-amber-400 font-bold">{evt.id}</span>
                              <button
                                type="button"
                                onClick={() => copyToClipboard(evt.id, evt.id)}
                                className="text-[#64748B] hover:text-white cursor-pointer ml-auto"
                                title="Copy Event ID"
                              >
                                {copiedText === evt.id ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-[#64748B]" />}
                              </button>
                            </div>

                            {/* Core Metrics 2x2 Grid */}
                            <div className="grid grid-cols-2 gap-2 p-2.5 rounded-xl bg-[#07090d] border border-[#1f2737] text-xs font-mono-numbers my-3">
                              <div>
                                <span className="text-[9px] text-[#8b92a2] block uppercase">Ticket Price</span>
                                <strong className="text-white text-xs">{evt.ticketPrice || 10} {currency}</strong>
                              </div>
                              <div>
                                <span className="text-[9px] text-[#8b92a2] block uppercase">Tickets Sold / Limit</span>
                                <div>
                                  <span className="text-emerald-400 font-bold">{evt.ticketsSold || 0}</span>
                                  <span className="text-[#64748B]"> / {evt.ticketLimitMode === 'limited' ? (evt.maxTotalTickets || evt.maxTickets || 500) : '∞'}</span>
                                </div>
                              </div>
                              <div>
                                <span className="text-[9px] text-[#8b92a2] block uppercase">Jackpot Pool</span>
                                <div className="text-amber-400 font-bold text-xs truncate">
                                  {evt.lockedJackpot ? (
                                    <span>{Number(evt.lockedJackpot).toLocaleString()} {currency}</span>
                                  ) : evt.jackpotMode === 'fixed' ? (
                                    <span>{(evt.fixedJackpot || evt.poolPrize || 5000).toLocaleString()} {currency}</span>
                                  ) : (
                                    <span>{(evt.minPrize || 1000).toLocaleString()}-{(evt.maxPrize || 10000).toLocaleString()} {currency}</span>
                                  )}
                                </div>
                                <span className="text-[8px] text-[#94A3B8] block uppercase">
                                  {evt.jackpotMode === 'fixed'
                                    ? 'Fixed Pot'
                                    : evt.jackpotSelectionMethod === 'manual'
                                      ? 'Manual Exact'
                                      : 'Random RNG'}
                                </span>
                              </div>
                              <div>
                                <span className="text-[9px] text-[#8b92a2] block uppercase">Winner Mode</span>
                                <div className="text-xs truncate">
                                  {evt.winnerMode === 'single' ? (
                                    <span className="inline-flex items-center gap-1 text-amber-300 font-bold text-[11px]">
                                      <Trophy className="w-3 h-3 text-amber-400" />
                                      <span>Single Winner</span>
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 text-purple-300 font-bold text-[11px]">
                                      <Users className="w-3 h-3 text-purple-400" />
                                      <span>{evt.winningCodeCount || evt.winnerCount || 3} Winners</span>
                                    </span>
                                  )}
                                </div>
                                <span className="text-[8px] text-[#94A3B8] block">
                                  {evt.winnerPayoutSharePercent ? `${evt.winnerPayoutSharePercent}% Pool Share` : '100% Pool Share'}
                                </span>
                              </div>
                            </div>

                            {/* Real-Time Countdown / Final Result Banner */}
                            <div className="p-2.5 rounded-xl bg-[#141924]/60 border border-[#272a31]/60 space-y-1.5 mb-3">
                              {isActive ? (
                                <div className="flex items-center justify-between">
                                  <span className="text-[10px] text-[#94A3B8] font-bold uppercase flex items-center gap-1">
                                    <Clock className="w-3.5 h-3.5 text-amber-400 animate-spin" />
                                    <span>Live Countdown:</span>
                                  </span>
                                  <span className="font-mono-numbers font-black text-sm text-amber-400 tracking-wider">
                                    {formatCountdown(evt.drawTime)}
                                  </span>
                                </div>
                              ) : isConcluded ? (
                                <div className="space-y-1">
                                  <div className="flex items-center justify-between text-xs">
                                    <span className="text-[10px] text-[#94A3B8] uppercase font-bold">Drawn Digits:</span>
                                    <span className="px-2 py-0.5 rounded bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-mono-numbers font-black text-xs">
                                      [{evt.winningDigits || (codesList.length > 0 ? codesList.join(', ') : 'N/A')}]
                                    </span>
                                  </div>
                                  <div className="flex items-center justify-between text-[11px] text-[#94A3B8]">
                                    <span>Settlement Status:</span>
                                    <strong className="text-emerald-400 font-bold">✓ Settled &amp; Paid</strong>
                                  </div>
                                </div>
                              ) : isWaitingForDigits ? (
                                <div className="space-y-1">
                                  <div className="text-amber-400 font-bold text-xs flex items-center gap-1">
                                    <AlertTriangle className="w-3.5 h-3.5" />
                                    <span>Duration Expired · Digits Required</span>
                                  </div>
                                  <p className="text-[10px] text-[#94A3B8]">
                                    Configure winning digits below to automatically finalize the draw and disburse payouts.
                                  </p>
                                </div>
                              ) : (
                                <div className="flex items-center justify-between text-xs">
                                  <span className="text-[#94A3B8] flex items-center gap-1">
                                    <RefreshCw className="w-3 h-3 text-indigo-400 animate-spin" />
                                    <span>Draw Processing...</span>
                                  </span>
                                  <span className="font-mono-numbers text-indigo-300 font-bold">Matching Tickets</span>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Card Actions: Primary Button + Strictly 3 Contextual Actions */}
                          <div className="space-y-2 pt-2 border-t border-[#1f2737]">
                            {/* Prominent Action Button for Waiting Digits */}
                            {isWaitingForDigits && (
                              <button
                                type="button"
                                onClick={() => openWinnerConfig(evt)}
                                className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-extrabold text-xs flex items-center justify-center gap-2 cursor-pointer shadow-lg animate-pulse"
                              >
                                <AlertTriangle className="w-4 h-4" />
                                <span>Configure Winning Digits to Finalize Draw</span>
                              </button>
                            )}

                            {isConcluded && (
                              <button
                                type="button"
                                onClick={() => setViewDetailsEvent(evt)}
                                className="w-full py-2 rounded-xl bg-purple-500/15 hover:bg-purple-500/25 text-purple-300 border border-purple-500/30 text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition-all"
                              >
                                <Coins className="w-3.5 h-3.5" />
                                <span>View Settled Winners &amp; Disbursed USDT</span>
                              </button>
                            )}

                            {/* STRICTLY 3 ACTIONS TOOLBAR: A. View Details | B. Winning Digits | C. Delete Event */}
                            <div className="flex items-center gap-2 pt-1">
                              {/* Action A: View Details */}
                              <button
                                type="button"
                                onClick={() => setViewDetailsEvent(evt)}
                                className="flex-1 py-2 px-3 rounded-xl bg-[#141924] hover:bg-[#1a2130] text-[#94A3B8] hover:text-white border border-[#272a31] transition-all cursor-pointer flex items-center justify-center gap-1.5"
                                title="View Full Event Details & Payouts"
                              >
                                <Eye className="w-3.5 h-3.5 text-amber-400" />
                                <span className="text-xs font-bold">Details</span>
                              </button>

                              {/* Action B: Winning Digits Management */}
                              <button
                                type="button"
                                onClick={() => openWinnerConfig(evt)}
                                className="flex-1 py-2 px-3 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 transition-all cursor-pointer flex items-center justify-center gap-1.5"
                                title={isConcluded ? 'View Winning Digits (Locked)' : 'Manage Winning Digits'}
                              >
                                <Trophy className="w-3.5 h-3.5 text-amber-400" />
                                <span className="text-xs font-bold">Winning Digits</span>
                              </button>

                              {/* Action C: Delete Event (Financial Safety Guaranteed) */}
                              <button
                                type="button"
                                onClick={() => {
                                  if (confirm(`Are you sure you want to delete event "${evt.title}" (${evt.id})?\n\nCRITICAL FINANCIAL INTEGRITY GUARANTEE:\n• All user wallet balances remain 100% permanently intact.\n• Past credited winnings will NEVER be reversed or deducted.\n• Event is safely archived from the active management view.`)) {
                                    directDeleteEvent(evt.id);
                                  }
                                }}
                                className="p-2 rounded-xl bg-red-950/20 hover:bg-red-900/40 text-red-400 border border-red-500/30 transition-all cursor-pointer flex items-center justify-center"
                                title="Delete Event"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* ================================================================ */}
            {/* MODAL 1: 4-STEP EVENT CREATION WIZARD                             */}
            {/* ================================================================ */}
            {isWizardOpen && (
              <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-150">
                <div className="max-w-2xl w-full bg-[#0d1117] border border-[#272a31] rounded-3xl p-5 sm:p-7 space-y-6 shadow-2xl max-h-[90vh] overflow-y-auto no-scrollbar my-auto">
                  
                  {/* Wizard Header & Stepper */}
                  <div className="space-y-3 pb-4 border-b border-[#1f2737]">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 font-black text-sm">
                          {wizardStep}
                        </div>
                        <div>
                          <h3 className="font-display font-extrabold text-base text-white">
                            Create New Four-Digit Lottery Event
                          </h3>
                          <p className="text-xs text-[#94A3B8]">
                            Step {wizardStep} of 4: {
                              wizardStep === 1 ? 'Basic Event Information' :
                              wizardStep === 2 ? 'Ticket & Jackpot Configuration' :
                              wizardStep === 3 ? 'Winning Digits Configuration' :
                              'Review & Deploy Event'
                            }
                          </p>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => setIsWizardOpen(false)}
                        className="p-1.5 rounded-lg text-[#94A3B8] hover:text-white bg-[#141924] border border-[#272a31] cursor-pointer"
                        title="Close Wizard"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Step progress pills */}
                    <div className="grid grid-cols-4 gap-2 pt-1">
                      {[1, 2, 3, 4].map(s => (
                        <div
                          key={s}
                          className={`h-1.5 rounded-full transition-all ${
                            s === wizardStep
                              ? 'bg-amber-400 shadow-[0_0_8px_rgba(245,196,81,0.5)]'
                              : s < wizardStep
                                ? 'bg-emerald-400'
                                : 'bg-[#1f2737]'
                          }`}
                        />
                      ))}
                    </div>
                  </div>

                  {/* STEP 1: BASIC EVENT INFORMATION */}
                  {wizardStep === 1 && (
                    <div className="space-y-4 animate-in fade-in duration-200 text-xs">
                      <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300">
                        ℹ️ Step 1 establishes permanent event name, ticket availability, batch tag, and countdown duration.
                      </div>

                      {/* 1. Event Name */}
                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-[#8b92a2] flex items-center justify-between">
                          <span>1. Event Name *</span>
                          <span className="text-[10px] text-amber-400 font-semibold">🔒 Permanent &amp; Immutable After Creation</span>
                        </label>
                        <input
                          type="text"
                          value={wizardData.eventName}
                          onChange={(e) => {
                            const val = e.target.value;
                            setWizardData(prev => {
                              const updated = { ...prev, eventName: val };
                              updated.roomDescription = generateAutoDescription(updated);
                              return updated;
                            });
                          }}
                          placeholder="e.g. Grand Pot VIP Draw #108"
                          className="w-full bg-[#07090d] border border-[#272a31] rounded-xl px-3 py-2.5 text-xs text-white outline-none focus:border-amber-400"
                        />
                        <p className="text-[10px] text-[#64748B]">
                          This name is permanently saved to the event ledger and cannot be edited after event creation.
                        </p>
                      </div>

                      {/* 2. Ticket Availability */}
                      <div className="space-y-2 pt-1">
                        <label className="text-[11px] font-bold text-[#8b92a2] block">
                          2. Ticket Availability Type
                        </label>
                        <div className="grid grid-cols-2 gap-3">
                          <button
                            type="button"
                            onClick={() => {
                              setWizardData(prev => {
                                const updated = { ...prev, ticketAvailability: 'unlimited' as const };
                                updated.roomDescription = generateAutoDescription(updated);
                                return updated;
                              });
                            }}
                            className={`p-3 rounded-xl border text-left cursor-pointer transition-all ${
                              wizardData.ticketAvailability === 'unlimited'
                                ? 'bg-amber-500/15 border-amber-500/40 text-amber-300'
                                : 'bg-[#07090d] border-[#272a31] text-[#94A3B8] hover:text-white'
                            }`}
                          >
                            <span className="font-bold text-xs block">Unlimited Tickets</span>
                            <span className="text-[10px] opacity-75">No ceiling on ticket sales</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setWizardData(prev => {
                                const updated = { ...prev, ticketAvailability: 'limited' as const };
                                updated.roomDescription = generateAutoDescription(updated);
                                return updated;
                              });
                            }}
                            className={`p-3 rounded-xl border text-left cursor-pointer transition-all ${
                              wizardData.ticketAvailability === 'limited'
                                ? 'bg-amber-500/15 border-amber-500/40 text-amber-300'
                                : 'bg-[#07090d] border-[#272a31] text-[#94A3B8] hover:text-white'
                            }`}
                          >
                            <span className="font-bold text-xs block">Limited Tickets</span>
                            <span className="text-[10px] opacity-75">Cap maximum tickets available</span>
                          </button>
                        </div>

                        {wizardData.ticketAvailability === 'limited' && (
                          <div className="pt-2 animate-in fade-in duration-150">
                            <label className="text-[10px] text-[#8b92a2] block mb-1">Maximum Ticket Quantity *</label>
                            <input
                              type="number"
                              min={10}
                              max={100000}
                              value={wizardData.maxTotalTickets}
                              onChange={(e) => {
                                const val = Math.max(1, parseInt(e.target.value) || 1);
                                setWizardData(prev => {
                                  const updated = { ...prev, maxTotalTickets: val };
                                  updated.roomDescription = generateAutoDescription(updated);
                                  return updated;
                                });
                              }}
                              className="w-full bg-[#07090d] border border-[#272a31] rounded-xl px-3 py-2 text-xs text-white font-mono-numbers outline-none focus:border-amber-400"
                            />
                          </div>
                        )}
                      </div>

                      {/* 3. Event Duration (Hours & Minutes) */}
                      <div className="space-y-2 pt-1">
                        <label className="text-[11px] font-bold text-[#8b92a2] flex items-center justify-between">
                          <span>3. Event Duration</span>
                          <span className="text-[10px] text-emerald-400 font-mono-numbers">Authoritative Expiration</span>
                        </label>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <span className="text-[10px] text-[#64748B] block mb-1">Hours</span>
                            <input
                              type="number"
                              min={0}
                              max={720}
                              value={wizardData.durationHours}
                              onChange={(e) => {
                                const val = Math.max(0, parseInt(e.target.value) || 0);
                                setWizardData(prev => {
                                  const updated = { ...prev, durationHours: val };
                                  updated.roomDescription = generateAutoDescription(updated);
                                  return updated;
                                });
                              }}
                              className="w-full bg-[#07090d] border border-[#272a31] rounded-xl px-3 py-2 text-xs text-white font-mono-numbers outline-none focus:border-amber-400"
                            />
                          </div>
                          <div>
                            <span className="text-[10px] text-[#64748B] block mb-1">Minutes</span>
                            <input
                              type="number"
                              min={0}
                              max={59}
                              value={wizardData.durationMinutes}
                              onChange={(e) => {
                                const val = Math.max(0, Math.min(59, parseInt(e.target.value) || 0));
                                setWizardData(prev => {
                                  const updated = { ...prev, durationMinutes: val };
                                  updated.roomDescription = generateAutoDescription(updated);
                                  return updated;
                                });
                              }}
                              className="w-full bg-[#07090d] border border-[#272a31] rounded-xl px-3 py-2 text-xs text-white font-mono-numbers outline-none focus:border-amber-400"
                            />
                          </div>
                        </div>

                        {/* Live countdown preview */}
                        <div className="p-2.5 rounded-xl bg-[#07090d] border border-[#1f2737] flex items-center justify-between text-xs">
                          <span className="text-[#94A3B8] flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5 text-amber-400" />
                            <span>Total Duration:</span>
                            <strong className="text-white">
                              {wizardData.durationHours}h {wizardData.durationMinutes}m
                            </strong>
                          </span>
                          <span className="text-[11px] text-amber-400 font-mono-numbers">
                            Countdown: {String(wizardData.durationHours).padStart(2, '0')}:{String(wizardData.durationMinutes).padStart(2, '0')}:00
                          </span>
                        </div>
                      </div>

                      {/* 4. Event Tag / Batch Tag */}
                      <div className="space-y-1 pt-1">
                        <label className="text-[11px] font-bold text-[#8b92a2] flex items-center justify-between">
                          <span>4. Event Tag / Batch Tag</span>
                          <span className="text-[10px] text-[#94A3B8]">Auto-Generated Unique Identifier</span>
                        </label>
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={wizardData.eventTag}
                            onChange={(e) => setWizardData(prev => ({ ...prev, eventTag: e.target.value.toUpperCase() }))}
                            className="flex-1 bg-[#07090d] border border-[#272a31] rounded-xl px-3 py-2 text-xs text-white font-mono-numbers font-bold outline-none focus:border-amber-400 uppercase tracking-wider"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              const newTag = 'BATCH-' + Math.floor(1000 + Math.random() * 9000);
                              setWizardData(prev => ({ ...prev, eventTag: newTag }));
                            }}
                            className="px-3 py-2 rounded-xl bg-[#141924] hover:bg-[#1a2130] text-[#94A3B8] hover:text-white border border-[#272a31] text-xs font-bold cursor-pointer"
                          >
                            Regenerate
                          </button>
                        </div>
                      </div>

                      {/* 5. Event Description */}
                      <div className="space-y-1 pt-1">
                        <label className="text-[11px] font-bold text-[#8b92a2] flex items-center justify-between">
                          <span>5. Event Description</span>
                          <span className="text-[10px] text-[#94A3B8]">Review &amp; Edit Before Deployment</span>
                        </label>
                        <textarea
                          rows={2}
                          value={wizardData.roomDescription}
                          onChange={(e) => setWizardData(prev => ({ ...prev, roomDescription: e.target.value }))}
                          placeholder="Auto-generated description..."
                          className="w-full bg-[#07090d] border border-[#272a31] rounded-xl p-2.5 text-xs text-white outline-none focus:border-amber-400"
                        />
                      </div>

                      <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#1f2737]">
                        <button
                          type="button"
                          disabled={!wizardData.eventName.trim() || (wizardData.durationHours === 0 && wizardData.durationMinutes === 0)}
                          onClick={() => setWizardStep(2)}
                          className="px-5 py-2.5 rounded-xl btn-gold text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-md disabled:opacity-50"
                        >
                          <span>Proceed to Step 2: Jackpot &amp; Tickets</span>
                          <ArrowRight className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  )}

                  {/* STEP 2: TICKET AND JACKPOT CONFIGURATION */}
                  {wizardStep === 2 && (
                    <div className="space-y-4 animate-in fade-in duration-200 text-xs">
                      <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300">
                        ℹ️ Step 2 configures ticket price, guaranteed pot mode, and winner distribution policy in USDT.
                      </div>

                      {/* Ticket Price */}
                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-[#8b92a2] block">
                          Ticket Price (USDT) *
                        </label>
                        <div className="relative">
                          <input
                            type="number"
                            min={0.1}
                            step={0.1}
                            value={wizardData.ticketPrice}
                            onChange={(e) => {
                              const val = Math.max(0.1, parseFloat(e.target.value) || 1);
                              setWizardData(prev => {
                                const updated = { ...prev, ticketPrice: val };
                                updated.roomDescription = generateAutoDescription(updated);
                                return updated;
                              });
                            }}
                            className="w-full bg-[#07090d] border border-[#272a31] rounded-xl px-3 py-2 text-xs text-white font-mono-numbers outline-none focus:border-amber-400 pr-16"
                          />
                          <span className="absolute right-3 top-2 text-[10px] font-bold text-amber-400">
                            USDT
                          </span>
                        </div>
                      </div>

                      {/* Jackpot Configuration */}
                      <div className="space-y-2 pt-1">
                        <label className="text-[11px] font-bold text-[#8b92a2] block">
                          Jackpot Determination Mode
                        </label>
                        <div className="grid grid-cols-2 gap-3">
                          <button
                            type="button"
                            onClick={() => {
                              setWizardData(prev => {
                                const updated = { ...prev, jackpotMode: 'fixed' as const };
                                updated.roomDescription = generateAutoDescription(updated);
                                return updated;
                              });
                            }}
                            className={`p-3 rounded-xl border text-left cursor-pointer transition-all ${
                              wizardData.jackpotMode === 'fixed'
                                ? 'bg-amber-500/15 border-amber-500/40 text-amber-300'
                                : 'bg-[#07090d] border-[#272a31] text-[#94A3B8] hover:text-white'
                            }`}
                          >
                            <span className="font-bold text-xs block">Fixed Jackpot</span>
                            <span className="text-[10px] opacity-75">Guaranteed static pot</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setWizardData(prev => {
                                const updated = { ...prev, jackpotMode: 'range' as const };
                                updated.roomDescription = generateAutoDescription(updated);
                                return updated;
                              });
                            }}
                            className={`p-3 rounded-xl border text-left cursor-pointer transition-all ${
                              wizardData.jackpotMode === 'range'
                                ? 'bg-amber-500/15 border-amber-500/40 text-amber-300'
                                : 'bg-[#07090d] border-[#272a31] text-[#94A3B8] hover:text-white'
                            }`}
                          >
                            <span className="font-bold text-xs block">Jackpot Range</span>
                            <span className="text-[10px] opacity-75">Dynamic [Min - Max] bounds</span>
                          </button>
                        </div>

                        {wizardData.jackpotMode === 'fixed' ? (
                          <div className="pt-2">
                            <label className="text-[10px] text-[#8b92a2] block mb-1">Fixed Jackpot Amount (USDT) *</label>
                            <input
                              type="number"
                              min={10}
                              value={wizardData.fixedJackpot}
                              onChange={(e) => {
                                const val = Math.max(1, parseFloat(e.target.value) || 1);
                                setWizardData(prev => {
                                  const updated = { ...prev, fixedJackpot: val, selectedJackpotAmount: val };
                                  updated.roomDescription = generateAutoDescription(updated);
                                  return updated;
                                });
                              }}
                              className="w-full bg-[#07090d] border border-[#272a31] rounded-xl px-3 py-2 text-xs text-white font-mono-numbers outline-none focus:border-amber-400"
                            />
                          </div>
                        ) : (
                          <div className="pt-2 space-y-2">
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <label className="text-[10px] text-[#8b92a2] block mb-1">Minimum Jackpot (USDT)</label>
                                <input
                                  type="number"
                                  min={1}
                                  value={wizardData.minJackpot}
                                  onChange={(e) => {
                                    const val = Math.max(1, parseFloat(e.target.value) || 1);
                                    setWizardData(prev => {
                                      const updated = { ...prev, minJackpot: val };
                                      updated.roomDescription = generateAutoDescription(updated);
                                      return updated;
                                    });
                                  }}
                                  className="w-full bg-[#07090d] border border-[#272a31] rounded-xl px-3 py-2 text-xs text-white font-mono-numbers outline-none focus:border-amber-400"
                                />
                              </div>
                              <div>
                                <label className="text-[10px] text-[#8b92a2] block mb-1">Maximum Jackpot (USDT)</label>
                                <input
                                  type="number"
                                  min={1}
                                  value={wizardData.maxJackpot}
                                  onChange={(e) => {
                                    const val = Math.max(1, parseFloat(e.target.value) || 1);
                                    setWizardData(prev => {
                                      const updated = { ...prev, maxJackpot: val };
                                      updated.roomDescription = generateAutoDescription(updated);
                                      return updated;
                                    });
                                  }}
                                  className="w-full bg-[#07090d] border border-[#272a31] rounded-xl px-3 py-2 text-xs text-white font-mono-numbers outline-none focus:border-amber-400"
                                />
                              </div>
                            </div>

                            <div>
                              <label className="text-[10px] text-[#8b92a2] block mb-1">Determination Method</label>
                              <div className="grid grid-cols-2 gap-2">
                                <button
                                  type="button"
                                  onClick={() => setWizardData(prev => ({ ...prev, jackpotSelectionMethod: 'manual' }))}
                                  className={`p-2 rounded-lg border text-left cursor-pointer text-xs ${
                                    wizardData.jackpotSelectionMethod === 'manual'
                                      ? 'bg-amber-500/15 border-amber-500/40 text-amber-300'
                                      : 'bg-[#07090d] border-[#272a31] text-[#94A3B8]'
                                  }`}
                                >
                                  <strong>Manual Exact Pot</strong>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setWizardData(prev => ({ ...prev, jackpotSelectionMethod: 'random' }))}
                                  className={`p-2 rounded-lg border text-left cursor-pointer text-xs ${
                                    wizardData.jackpotSelectionMethod === 'random'
                                      ? 'bg-amber-500/15 border-amber-500/40 text-amber-300'
                                      : 'bg-[#07090d] border-[#272a31] text-[#94A3B8]'
                                  }`}
                                >
                                  <strong>Random RNG Determination</strong>
                                </button>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Winner Mode */}
                      <div className="space-y-2 pt-1">
                        <label className="text-[11px] font-bold text-[#8b92a2] block">
                          Winner Mode &amp; Payout Distribution
                        </label>
                        <div className="grid grid-cols-2 gap-3">
                          <button
                            type="button"
                            onClick={() => setWizardData(prev => ({ ...prev, winnerMode: 'single', winnerCount: 1 }))}
                            className={`p-3 rounded-xl border text-left cursor-pointer transition-all ${
                              wizardData.winnerMode === 'single'
                                ? 'bg-amber-500/15 border-amber-500/40 text-amber-300'
                                : 'bg-[#07090d] border-[#272a31] text-[#94A3B8] hover:text-white'
                            }`}
                          >
                            <span className="font-bold text-xs block">Single Winner</span>
                            <span className="text-[10px] opacity-75">100% pot to 1 winning code</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => setWizardData(prev => ({ ...prev, winnerMode: 'multiple', winnerCount: 3 }))}
                            className={`p-3 rounded-xl border text-left cursor-pointer transition-all ${
                              wizardData.winnerMode === 'multiple'
                                ? 'bg-amber-500/15 border-amber-500/40 text-amber-300'
                                : 'bg-[#07090d] border-[#272a31] text-[#94A3B8] hover:text-white'
                            }`}
                          >
                            <span className="font-bold text-xs block">Multiple Winners</span>
                            <span className="text-[10px] opacity-75">Split across multiple winning codes</span>
                          </button>
                        </div>

                        {wizardData.winnerMode === 'multiple' && (
                          <div className="pt-2 grid grid-cols-2 gap-3">
                            <div>
                              <label className="text-[10px] text-[#8b92a2] block mb-1">Number of Winners</label>
                              <input
                                type="number"
                                min={2}
                                max={10}
                                value={wizardData.winnerCount}
                                onChange={(e) => {
                                  const c = Math.max(2, Math.min(10, parseInt(e.target.value) || 2));
                                  setWizardData(prev => ({
                                    ...prev,
                                    winnerCount: c,
                                    winningCodes: generateDistinctCodes(c)
                                  }));
                                }}
                                className="w-full bg-[#07090d] border border-[#272a31] rounded-xl px-3 py-2 text-xs text-white font-mono-numbers outline-none focus:border-amber-400"
                              />
                            </div>
                            <div>
                              <label className="text-[10px] text-[#8b92a2] block mb-1">Payout Share (%)</label>
                              <input
                                type="number"
                                min={50}
                                max={100}
                                value={wizardData.winnerPayoutSharePercent}
                                onChange={(e) => setWizardData(prev => ({ ...prev, winnerPayoutSharePercent: parseFloat(e.target.value) || 90 }))}
                                className="w-full bg-[#07090d] border border-[#272a31] rounded-xl px-3 py-2 text-xs text-white font-mono-numbers outline-none focus:border-amber-400"
                              />
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center justify-between pt-3 border-t border-[#1f2737]">
                        <button
                          type="button"
                          onClick={() => setWizardStep(1)}
                          className="px-4 py-2 rounded-xl bg-[#141924] hover:bg-[#1a2130] text-xs font-bold text-[#94A3B8] hover:text-white border border-[#272a31] flex items-center gap-1 cursor-pointer"
                        >
                          <ArrowLeft className="w-3.5 h-3.5" />
                          <span>Back to Step 1</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setWizardStep(3)}
                          className="px-5 py-2.5 rounded-xl btn-gold text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-md"
                        >
                          <span>Proceed to Step 3: Winning Digits</span>
                          <ArrowRight className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  )}

                  {/* STEP 3: WINNING DIGITS CONFIGURATION */}
                  {wizardStep === 3 && (
                    <div className="space-y-4 animate-in fade-in duration-200 text-xs">
                      <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300">
                        ℹ️ Step 3 is flexible: preset your winning digits now or leave blank to configure later before expiration.
                      </div>

                      {/* Option Choice */}
                      <div className="grid grid-cols-2 gap-3">
                        <button
                          type="button"
                          onClick={() => setWizardData(prev => ({ ...prev, winningCodesOption: 'preset' }))}
                          className={`p-3.5 rounded-xl border text-left cursor-pointer transition-all ${
                            wizardData.winningCodesOption === 'preset'
                              ? 'bg-amber-500/15 border-amber-500/40 text-amber-300'
                              : 'bg-[#07090d] border-[#272a31] text-[#94A3B8] hover:text-white'
                          }`}
                        >
                          <span className="font-bold text-xs block mb-1">Option A: Preset Winning Digits</span>
                          <span className="text-[10px] opacity-75">Enter valid 4-digit combination(s) right now</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setWizardData(prev => ({ ...prev, winningCodesOption: 'later' }))}
                          className={`p-3.5 rounded-xl border text-left cursor-pointer transition-all ${
                            wizardData.winningCodesOption === 'later'
                              ? 'bg-purple-500/15 border-purple-500/40 text-purple-300'
                              : 'bg-[#07090d] border-[#272a31] text-[#94A3B8] hover:text-white'
                          }`}
                        >
                          <span className="font-bold text-xs block mb-1">Option B: Configure Later</span>
                          <span className="text-[10px] opacity-75">Leave blank &amp; configure before expiration</span>
                        </button>
                      </div>

                      {wizardData.winningCodesOption === 'preset' ? (
                        <div className="space-y-3 pt-1">
                          <div className="flex items-center justify-between">
                            <label className="text-[11px] font-bold text-[#8b92a2]">
                              Preset Winning 4-Digit Combination(s):
                            </label>
                            <button
                              type="button"
                              onClick={() => {
                                const count = wizardData.winnerMode === 'single' ? 1 : wizardData.winnerCount;
                                setWizardData(prev => ({ ...prev, winningCodes: generateDistinctCodes(count) }));
                              }}
                              className="text-[11px] text-amber-400 hover:text-amber-300 font-bold cursor-pointer"
                            >
                              ⚡ Randomize Codes
                            </button>
                          </div>

                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                            {(wizardData.winnerMode === 'single' ? [wizardData.winningCodes[0] || '2538'] : wizardData.winningCodes).map((code, idx) => (
                              <div key={idx} className="p-2.5 rounded-xl bg-[#07090d] border border-[#272a31] space-y-1">
                                <span className="text-[10px] text-[#94A3B8] block font-bold">
                                  Position #{idx + 1}:
                                </span>
                                <input
                                  type="text"
                                  maxLength={4}
                                  value={code}
                                  onChange={(e) => {
                                    const val = e.target.value.replace(/\D/g, '').slice(0, 4);
                                    const codes = [...wizardData.winningCodes];
                                    codes[idx] = val;
                                    setWizardData(prev => ({ ...prev, winningCodes: codes }));
                                  }}
                                  className="w-full bg-[#141924] border border-[#272a31] rounded-lg px-2 py-1.5 text-center font-mono-numbers text-white font-bold text-sm tracking-[4px] outline-none focus:border-amber-400"
                                />
                              </div>
                            ))}
                          </div>

                          {hasDuplicateCodes(wizardData.winningCodes) && (
                            <div className="p-2.5 rounded-lg bg-red-500/10 border border-red-500/30 text-red-300 text-xs font-bold">
                              ⚠️ All winning codes must be unique! Duplicate combination detected.
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="p-4 rounded-xl bg-purple-500/10 border border-purple-500/20 text-[#CBD5E1] space-y-1.5">
                          <strong className="text-purple-300 block text-xs">Winning Digits Will Be Configured Later:</strong>
                          <p className="text-[11px] leading-relaxed">
                            The event will launch and allow users to purchase tickets normally. You can configure the winning digits anytime before the countdown expires using the event&apos;s dedicated <strong>Winning Digits</strong> management action.
                          </p>
                          <p className="text-[10px] text-amber-400 font-bold">
                            ⚠️ If duration expires while digits are blank, the draw will pause safely with status &quot;Action Required&quot; until you enter the winning digits. No fake results will ever be generated.
                          </p>
                        </div>
                      )}

                      {/* Strict Rule Callout */}
                      <div className="p-3.5 rounded-xl bg-[#07090d] border border-amber-500/30 text-[#94A3B8] space-y-1">
                        <span className="text-[10px] uppercase font-black text-amber-400 block tracking-wider">
                          📌 Strict Editing Permissions Rule
                        </span>
                        <p className="text-[11px] leading-relaxed">
                          Only winning digit combinations can be edited after event creation. Once the final result is declared, winning digits become permanently locked. Event Name, Description, Ticket Price, Ticket Limit, and Duration cannot be modified after creation.
                        </p>
                      </div>

                      <div className="flex items-center justify-between pt-3 border-t border-[#1f2737]">
                        <button
                          type="button"
                          onClick={() => setWizardStep(2)}
                          className="px-4 py-2 rounded-xl bg-[#141924] hover:bg-[#1a2130] text-xs font-bold text-[#94A3B8] hover:text-white border border-[#272a31] flex items-center gap-1 cursor-pointer"
                        >
                          <ArrowLeft className="w-3.5 h-3.5" />
                          <span>Back to Step 2</span>
                        </button>
                        <button
                          type="button"
                          disabled={
                            wizardData.winningCodesOption === 'preset' && (
                              wizardData.winningCodes.some(c => c.length !== 4) ||
                              hasDuplicateCodes(wizardData.winningCodes)
                            )
                          }
                          onClick={() => setWizardStep(4)}
                          className="px-5 py-2.5 rounded-xl btn-gold text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-md disabled:opacity-50"
                        >
                          <span>Proceed to Step 4: Review</span>
                          <ArrowRight className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  )}

                  {/* STEP 4: REVIEW AND CREATE EVENT */}
                  {wizardStep === 4 && (
                    <div className="space-y-4 animate-in fade-in duration-200 text-xs">
                      <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-300">
                        ✓ Step 4: Complete Event Summary. Confirm all parameters and publish to the live database.
                      </div>

                      {/* Parameter summary grid */}
                      <div className="p-4 rounded-2xl bg-[#07090d] border border-[#272a31] space-y-2.5 font-mono-numbers">
                        <div className="flex justify-between items-center text-xs pb-2 border-b border-[#1f2737]">
                          <span className="text-[#94A3B8]">Event Name:</span>
                          <strong className="text-white font-bold">{wizardData.eventName}</strong>
                        </div>
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-[#94A3B8]">Batch Tag:</span>
                          <strong className="text-amber-400 font-bold">{wizardData.eventTag}</strong>
                        </div>
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-[#94A3B8]">Ticket Availability:</span>
                          <strong className="text-white">
                            {wizardData.ticketAvailability === 'limited' ? `Limited (${wizardData.maxTotalTickets} Max)` : 'Unlimited'}
                          </strong>
                        </div>
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-[#94A3B8]">Duration:</span>
                          <strong className="text-emerald-400">
                            {wizardData.durationHours}h {wizardData.durationMinutes}m
                          </strong>
                        </div>
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-[#94A3B8]">Ticket Price:</span>
                          <strong className="text-white">{wizardData.ticketPrice} USDT</strong>
                        </div>
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-[#94A3B8]">Jackpot Pot:</span>
                          <strong className="text-amber-400">
                            {wizardData.jackpotMode === 'fixed'
                              ? `${wizardData.fixedJackpot} USDT (Fixed)`
                              : `${wizardData.minJackpot} - ${wizardData.maxJackpot} USDT (${wizardData.jackpotSelectionMethod.toUpperCase()})`}
                          </strong>
                        </div>
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-[#94A3B8]">Winner Mode:</span>
                          <strong className="text-white">
                            {wizardData.winnerMode === 'single' ? 'Single Winner (100%)' : `Multiple Winners (${wizardData.winnerCount} Codes · ${wizardData.winnerPayoutSharePercent}%)`}
                          </strong>
                        </div>
                        <div className="flex justify-between items-center text-xs pt-2 border-t border-[#1f2737]">
                          <span className="text-[#94A3B8]">Winning Digits:</span>
                          {wizardData.winningCodesOption === 'preset' ? (
                            <div className="flex gap-1.5">
                              {wizardData.winningCodes.map((c, i) => (
                                <span key={i} className="px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 font-bold">
                                  [{c}]
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-amber-400 font-bold">⚠️ To Be Configured Later</span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-3 border-t border-[#1f2737]">
                        <button
                          type="button"
                          onClick={() => setWizardStep(3)}
                          className="px-4 py-2 rounded-xl bg-[#141924] hover:bg-[#1a2130] text-xs font-bold text-[#94A3B8] hover:text-white border border-[#272a31] flex items-center gap-1 cursor-pointer"
                        >
                          <ArrowLeft className="w-3.5 h-3.5" />
                          <span>Back to Step 3</span>
                        </button>
                        <button
                          type="button"
                          disabled={isSubmittingWizard}
                          onClick={async () => {
                            setIsSubmittingWizard(true);
                            try {
                              const res = await directCreateEvent({
                                ...wizardData,
                                title: wizardData.eventName,
                                durationHours: wizardData.durationHours,
                                durationMinutes: wizardData.durationMinutes,
                                batchTag: wizardData.eventTag,
                                drawMode: wizardData.winningCodesOption === 'preset' ? 'preset' : 'random',
                                presetWinningDigits: wizardData.winningCodesOption === 'preset' && wizardData.winningCodes.length > 0 ? wizardData.winningCodes[0] : null,
                                winningCodes: wizardData.winningCodesOption === 'preset' ? wizardData.winningCodes : []
                              });
                              if (res?.success) {
                                setIsWizardOpen(false);
                                setWizardStep(1);
                                if (lotteryCtx?.refreshEvents) await lotteryCtx.refreshEvents();
                                if (showToast) showToast('🎉 Lottery event published successfully to database!', 'success');
                              }
                            } catch (err: any) {
                              if (showToast) showToast('Failed to deploy event: ' + err.message, 'error');
                            } finally {
                              setIsSubmittingWizard(false);
                            }
                          }}
                          className="px-6 py-2.5 rounded-xl btn-gold text-xs font-black uppercase tracking-wider flex items-center gap-2 cursor-pointer shadow-lg disabled:opacity-50"
                        >
                          {isSubmittingWizard ? (
                            <>
                              <RefreshCw className="w-4 h-4 animate-spin" />
                              <span>Publishing Event...</span>
                            </>
                          ) : (
                            <>
                              <PlusCircle className="w-4 h-4" />
                              <span>Publish Event to Database</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  )}

                </div>
              </div>
            )}

            {/* ================================================================ */}
            {/* MODAL 2: WINNING DIGITS MANAGEMENT MODAL (DEDICATED ACTION)       */}
            {/* ================================================================ */}
            {winnerConfigEvent && (() => {
              const isConcluded = winnerConfigEvent.status === 'completed';
              const isDrawProcessing = winnerConfigEvent.status === 'result_pending' || (winnerConfigEvent.drawTime && winnerConfigEvent.drawTime <= currentTime);

              return (
                <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-150">
                  <div className="max-w-xl w-full bg-[#0d1117] border border-[#272a31] rounded-3xl p-5 sm:p-6 space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto no-scrollbar my-auto text-xs">
                    
                    {/* Header */}
                    <div className="flex items-center justify-between pb-3 border-b border-[#1f2737]">
                      <div className="flex items-center gap-2">
                        <Trophy className="w-5 h-5 text-amber-400" />
                        <div>
                          <h3 className="font-display font-extrabold text-sm text-white">
                            Winning Digits Management
                          </h3>
                          <p className="text-[11px] text-[#94A3B8]">
                            Event: <strong className="text-white">{winnerConfigEvent.title}</strong> · [{winnerConfigEvent.id}]
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setWinnerConfigEvent(null)}
                        className="p-1.5 rounded-lg text-[#94A3B8] hover:text-white bg-[#141924] border border-[#272a31] cursor-pointer"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Concluded vs Active State View */}
                    {isConcluded ? (
                      <div className="space-y-4 py-2">
                        <div className="p-3.5 rounded-2xl bg-purple-500/10 border border-purple-500/30 text-purple-300 space-y-1">
                          <span className="font-bold text-xs flex items-center gap-1.5">
                            <Lock className="w-4 h-4 text-purple-400" />
                            <span>Result Declared &amp; Settled</span>
                          </span>
                          <p className="text-[11px] text-[#94A3B8]">
                            Winning digits are permanently locked and cannot be edited after final result declaration and USDT disbursement.
                          </p>
                        </div>

                        <div className="p-4 rounded-2xl bg-[#07090d] border border-[#272a31] space-y-2">
                          <span className="text-[10px] text-[#8b92a2] uppercase font-bold block">Final Drawn Winning Digits:</span>
                          <div className="flex flex-wrap gap-2">
                            {wcWinningCodes.map((code, idx) => (
                              <span key={idx} className="px-3 py-1.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-mono-numbers font-black text-sm tracking-[3px]">
                                [{code}]
                              </span>
                            ))}
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => setWinnerConfigEvent(null)}
                          className="w-full py-2.5 rounded-xl bg-[#141924] hover:bg-[#1a2130] text-xs font-bold text-white border border-[#272a31] cursor-pointer"
                        >
                          Close
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-4 py-1">
                        <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-[#CBD5E1] space-y-1">
                          <span className="text-amber-300 font-bold block text-xs">Configure Winning Digit Combinations:</span>
                          <p className="text-[11px] leading-relaxed">
                            Winning digits can be added, edited, or removed before final draw settlement. All modifications are logged in the Admin Audit Log with administrator identity and timestamp.
                          </p>
                        </div>

                        {/* Mode Selector */}
                        <div className="space-y-2">
                          <label className="text-[11px] font-bold text-[#8b92a2] block">Winner Mode</label>
                          <div className="grid grid-cols-2 gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setWcWinnerMode('single');
                                setWcWinningCodes(prev => [prev[0] || '2538']);
                                setWcWinnerCount(1);
                              }}
                              className={`p-2.5 rounded-xl border text-left cursor-pointer ${
                                wcWinnerMode === 'single'
                                  ? 'bg-amber-500/15 border-amber-500/40 text-amber-300 font-bold'
                                  : 'bg-[#07090d] border-[#272a31] text-[#94A3B8]'
                              }`}
                            >
                              Single Winner (1 Code)
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setWcWinnerMode('multiple');
                                if (wcWinningCodes.length < 2) {
                                  setWcWinningCodes(['2538', '7412', '9065']);
                                  setWcWinnerCount(3);
                                }
                              }}
                              className={`p-2.5 rounded-xl border text-left cursor-pointer ${
                                wcWinnerMode === 'multiple'
                                  ? 'bg-amber-500/15 border-amber-500/40 text-amber-300 font-bold'
                                  : 'bg-[#07090d] border-[#272a31] text-[#94A3B8]'
                              }`}
                            >
                              Multiple Winners
                            </button>
                          </div>
                        </div>

                        {/* Codes Inputs */}
                        <div className="space-y-2 pt-1">
                          <div className="flex items-center justify-between">
                            <label className="text-[11px] font-bold text-[#8b92a2]">
                              Winning 4-Digit Combinations:
                            </label>
                            <button
                              type="button"
                              onClick={() => setWcWinningCodes(generateDistinctCodes(wcWinningCodes.length))}
                              className="text-[11px] text-amber-400 hover:text-amber-300 font-bold cursor-pointer"
                            >
                              ⚡ Randomize Codes
                            </button>
                          </div>

                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                            {wcWinningCodes.map((code, idx) => (
                              <div key={idx} className="p-2.5 rounded-xl bg-[#07090d] border border-[#272a31] space-y-1">
                                <div className="flex items-center justify-between text-[10px] text-[#94A3B8]">
                                  <span>Position #{idx + 1}</span>
                                  {wcWinningCodes.length > 1 && (
                                    <button
                                      type="button"
                                      onClick={() => setWcWinningCodes(prev => prev.filter((_, i) => i !== idx))}
                                      className="text-red-400 hover:text-red-300 cursor-pointer"
                                    >
                                      ✕
                                    </button>
                                  )}
                                </div>
                                <input
                                  type="text"
                                  maxLength={4}
                                  value={code}
                                  onChange={(e) => {
                                    const val = e.target.value.replace(/\D/g, '').slice(0, 4);
                                    const c = [...wcWinningCodes];
                                    c[idx] = val;
                                    setWcWinningCodes(c);
                                  }}
                                  className="w-full bg-[#141924] border border-[#272a31] rounded-lg px-2 py-1 text-center font-mono-numbers text-white font-bold text-sm tracking-[3px] outline-none focus:border-amber-400"
                                />
                              </div>
                            ))}
                          </div>

                          {wcWinnerMode === 'multiple' && wcWinningCodes.length < 10 && (
                            <button
                              type="button"
                              onClick={() => {
                                const newCode = String(Math.floor(Math.random() * 10000)).padStart(4, '0');
                                setWcWinningCodes(prev => [...prev, newCode]);
                              }}
                              className="w-full py-2 rounded-xl bg-[#141924] hover:bg-[#1a2130] text-[#94A3B8] hover:text-white border border-[#272a31] text-xs font-bold cursor-pointer flex items-center justify-center gap-1.5"
                            >
                              <PlusCircle className="w-3.5 h-3.5" />
                              <span>Add Winning Code Position</span>
                            </button>
                          )}

                          {hasDuplicateCodes(wcWinningCodes) && (
                            <div className="p-2.5 rounded-lg bg-red-500/10 border border-red-500/30 text-red-300 text-xs font-bold">
                              ⚠️ All winning codes must be unique! Duplicate combination detected.
                            </div>
                          )}
                        </div>

                        {/* Actions */}
                        <div className="pt-2 flex flex-col sm:flex-row gap-2">
                          <button
                            type="button"
                            disabled={
                              wcSaving ||
                              wcWinningCodes.some(c => c.length !== 4) ||
                              hasDuplicateCodes(wcWinningCodes)
                            }
                            onClick={async () => {
                              setWcSaving(true);
                              try {
                                const res = await directUpdateWinnerConfig(winnerConfigEvent.id, {
                                  winnerMode: wcWinnerMode,
                                  drawMode: 'preset',
                                  winningCodes: wcWinningCodes,
                                  winningCodeCount: wcWinningCodes.length,
                                  winnerCount: wcWinningCodes.length,
                                  winnerPayoutSharePercent: wcPayoutSharePercent,
                                  winnerDistribution: wcDistribution,
                                  codesTiming: 'configured'
                                });
                                if (res?.success) {
                                  setWinnerConfigEvent(null);
                                  if (lotteryCtx?.refreshEvents) await lotteryCtx.refreshEvents();
                                  if (showToast) showToast('Winner configuration updated and saved to database!', 'success');
                                }
                              } catch (err: any) {
                                if (showToast) showToast('Failed to save config: ' + err.message, 'error');
                              } finally {
                                setWcSaving(false);
                              }
                            }}
                            className="flex-1 py-2.5 rounded-xl bg-[#141924] hover:bg-[#1a2130] text-xs font-bold text-white border border-[#272a31] cursor-pointer disabled:opacity-50"
                          >
                            {wcSaving ? 'Saving...' : 'Save Digits to Database'}
                          </button>

                          {/* If event is draw processing or duration expired, allow instant finalize */}
                          {isDrawProcessing && (
                            <button
                              type="button"
                              disabled={
                                wcSaving ||
                                wcWinningCodes.some(c => c.length !== 4) ||
                                hasDuplicateCodes(wcWinningCodes)
                              }
                              onClick={async () => {
                                setWcSaving(true);
                                try {
                                  await directUpdateWinnerConfig(winnerConfigEvent.id, {
                                    winnerMode: wcWinnerMode,
                                    drawMode: 'preset',
                                    winningCodes: wcWinningCodes,
                                    winningCodeCount: wcWinningCodes.length,
                                    winnerCount: wcWinningCodes.length,
                                    winnerPayoutSharePercent: wcPayoutSharePercent,
                                    winnerDistribution: wcDistribution,
                                    codesTiming: 'configured'
                                  });
                                  // Directly execute draw and disburse payouts
                                  await directExecuteDraw(winnerConfigEvent.id, wcWinningCodes);
                                  setWinnerConfigEvent(null);
                                  if (lotteryCtx?.refreshEvents) await lotteryCtx.refreshEvents();
                                  if (showToast) showToast('🏆 Draw settled and winner payouts disbursed!', 'success');
                                } catch (err: any) {
                                  if (showToast) showToast('Settlement error: ' + err.message, 'error');
                                } finally {
                                  setWcSaving(false);
                                }
                              }}
                              className="flex-1 py-2.5 rounded-xl btn-gold text-xs font-black uppercase tracking-wider cursor-pointer shadow-md disabled:opacity-50"
                            >
                              {wcSaving ? 'Settling Draw...' : 'Save & Finalize Draw Now'}
                            </button>
                          )}
                        </div>

                      </div>
                    )}

                  </div>
                </div>
              );
            })()}

            {/* ================================================================ */}
            {/* MODAL 4: CONSOLIDATED EVENT DETAILS & DISBURSED PAYOUTS MODAL     */}
            {/* ================================================================ */}
            {viewDetailsEvent && (() => {
              const eventPayouts = allPayouts.filter((p: any) => p.eventId === viewDetailsEvent.id);
              const isConcluded = viewDetailsEvent.status === 'completed';
              const codesList: string[] = Array.isArray(viewDetailsEvent.winningCodes) && viewDetailsEvent.winningCodes.length > 0
                ? viewDetailsEvent.winningCodes
                : viewDetailsEvent.presetWinningDigits
                  ? [viewDetailsEvent.presetWinningDigits]
                  : [];
              const auditHistory = viewDetailsEvent.metadata?.audit_log || [];

              return (
                <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-150">
                  <div className="max-w-2xl w-full bg-[#0d1117] border border-[#272a31] rounded-3xl p-5 sm:p-6 space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto no-scrollbar my-auto text-xs">
                    
                    {/* Header */}
                    <div className="flex items-center justify-between pb-3 border-b border-[#1f2737]">
                      <div className="flex items-center gap-2">
                        <Eye className="w-4 h-4 text-amber-400" />
                        <div>
                          <h3 className="font-display font-extrabold text-sm text-white">
                            Event Details &amp; Disbursed Payouts
                          </h3>
                          <p className="text-[11px] text-[#94A3B8]">
                            [{viewDetailsEvent.id}] · {viewDetailsEvent.title}
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setViewDetailsEvent(null)}
                        className="p-1.5 rounded-lg text-[#94A3B8] hover:text-white bg-[#141924] border border-[#272a31] cursor-pointer"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Core Specifications */}
                    <div className="p-3.5 rounded-2xl bg-[#07090d] border border-[#272a31] grid grid-cols-2 sm:grid-cols-3 gap-3 font-mono-numbers">
                      <div>
                        <span className="text-[10px] text-[#64748B] block uppercase">Batch Tag</span>
                        <strong className="text-amber-400 font-bold">{viewDetailsEvent.batchTag || viewDetailsEvent.badge || 'VIP'}</strong>
                      </div>
                      <div>
                        <span className="text-[10px] text-[#64748B] block uppercase">Status</span>
                        <strong className={`font-bold uppercase ${isConcluded ? 'text-purple-400' : 'text-emerald-400'}`}>
                          {isConcluded ? 'Settled & Paid' : viewDetailsEvent.status}
                        </strong>
                      </div>
                      <div>
                        <span className="text-[10px] text-[#64748B] block uppercase">Ticket Price</span>
                        <strong className="text-white">{viewDetailsEvent.ticketPrice || 10} USDT</strong>
                      </div>
                      <div>
                        <span className="text-[10px] text-[#64748B] block uppercase">Sold / Limit</span>
                        <strong className="text-white">
                          {viewDetailsEvent.ticketsSold || 0} / {viewDetailsEvent.ticketLimitMode === 'limited' ? (viewDetailsEvent.maxTotalTickets || 500) : '∞'}
                        </strong>
                      </div>
                      <div>
                        <span className="text-[10px] text-[#64748B] block uppercase">Jackpot Pool</span>
                        <strong className="text-amber-400">
                          {Number(viewDetailsEvent.lockedJackpot || viewDetailsEvent.fixedJackpot || viewDetailsEvent.poolPrize || 5000).toLocaleString()} USDT
                        </strong>
                      </div>
                      <div>
                        <span className="text-[10px] text-[#64748B] block uppercase">Winner Mode</span>
                        <strong className="text-white">
                          {viewDetailsEvent.winnerMode === 'single' ? 'Single Winner' : `${viewDetailsEvent.winningCodeCount || 3} Codes`}
                        </strong>
                      </div>
                    </div>

                    {/* Winning Digits Section */}
                    <div className="p-3.5 rounded-2xl bg-[#07090d] border border-[#272a31] space-y-1.5">
                      <span className="text-[10px] text-[#64748B] block uppercase font-bold">
                        {isConcluded ? 'Drawn Winning Digits:' : 'Configured Winning Digits:'}
                      </span>
                      {isConcluded && viewDetailsEvent.winningDigits ? (
                        <span className="px-3 py-1 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-mono-numbers font-black text-sm inline-block tracking-[3px]">
                          [{viewDetailsEvent.winningDigits}]
                        </span>
                      ) : codesList.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {codesList.map((c: string, idx: number) => (
                            <span key={idx} className="px-2.5 py-1 rounded-lg bg-purple-500/15 border border-purple-500/30 text-purple-300 font-mono-numbers font-bold text-xs tracking-[2px]">
                              [{c}]
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-amber-400 text-xs font-bold">
                          ⚠️ Winning digits not yet configured (Will be requested before draw settlement)
                        </span>
                      )}
                    </div>

                    {/* Provably Fair Cryptographic Commit */}
                    <div className="p-3 rounded-xl bg-[#07090d] border border-[#272a31] space-y-1">
                      <span className="text-[10px] text-[#64748B] block uppercase font-bold">Provably Fair SHA-256 Commit:</span>
                      <span className="text-[10px] font-mono-numbers text-amber-300 break-all block bg-[#141924] p-2 rounded-lg border border-[#272a31]">
                        {viewDetailsEvent.sha256Seed || 'Cryptographically committed at genesis'}
                      </span>
                    </div>

                    {/* Disbursed Payouts Table */}
                    <div className="space-y-2 pt-1">
                      <span className="text-xs font-bold text-white flex items-center gap-1.5">
                        <Coins className="w-3.5 h-3.5 text-purple-400" />
                        <span>Disbursed Winner Payouts ({eventPayouts.length})</span>
                      </span>

                      {eventPayouts.length === 0 ? (
                        <div className="p-4 rounded-xl bg-[#07090d] border border-[#272a31] text-center text-[#94A3B8] text-xs">
                          {isConcluded
                            ? 'No winning tickets matched the drawn digits for this event.'
                            : 'Draw has not yet concluded. Payouts will appear here after automated settlement.'}
                        </div>
                      ) : (
                        <div className="space-y-2 max-h-[30vh] overflow-y-auto no-scrollbar">
                          {eventPayouts.map((p: any) => (
                            <div
                              key={p.id}
                              className="p-3 rounded-xl bg-[#07090d] border border-[#272a31] flex items-center justify-between text-xs"
                            >
                              <div>
                                <span className="font-mono-numbers text-amber-400 font-bold block">
                                  #{p.ticketId || p.id}
                                </span>
                                <span className="text-[#94A3B8] text-[10px]">
                                  Winner: <strong className="text-white">{p.winnerUsername || p.winnerAddress || 'Winner'}</strong>
                                </span>
                              </div>
                              <div className="text-right">
                                <span className="font-mono-numbers text-emerald-400 font-black text-sm block">
                                  +{p.payoutAmount} USDT
                                </span>
                                <span className="text-[9px] uppercase px-1.5 py-0.5 rounded bg-purple-500/15 text-purple-300 font-bold">
                                  {p.status || 'PAID'}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Audit Log History (if any) */}
                    {auditHistory.length > 0 && (
                      <div className="space-y-1.5 pt-1">
                        <span className="text-[11px] font-bold text-[#8b92a2]">
                          Winning Digits Audit History ({auditHistory.length})
                        </span>
                        <div className="space-y-1 max-h-[20vh] overflow-y-auto no-scrollbar">
                          {auditHistory.map((item: any, idx: number) => (
                            <div key={idx} className="p-2 rounded-lg bg-[#07090d] border border-[#1f2737] text-[10px] space-y-0.5">
                              <div className="flex justify-between text-[#94A3B8]">
                                <span>{new Date(item.timestamp).toLocaleString()}</span>
                                <span className="text-amber-400 font-bold">{item.adminIdentity}</span>
                              </div>
                              <div className="text-white">
                                Digits changed from [{Array.isArray(item.previousCodes) ? item.previousCodes.join(', ') : item.previousCodes}] to [{Array.isArray(item.newCodes) ? item.newCodes.join(', ') : item.newCodes}]
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={() => setViewDetailsEvent(null)}
                      className="w-full py-2.5 rounded-xl bg-[#141924] hover:bg-[#1a2130] text-xs font-bold text-white border border-[#272a31] cursor-pointer"
                    >
                      Close Details
                    </button>
                  </div>
                </div>
              );
            })()}

          </div>
        );
      })()}


      {/* ==================================================================== */}
      {/* SECTION B: MODULAR GAMES (CRASH, DICE, BINGO, HORSE RACING, ETC.)     */}
      {/* ==================================================================== */}
      {activeGame.id !== 'lottery' && (
        <div className="space-y-6">
          {/* TAB 1: SETTINGS & MATH MODEL */}
          {gameSubTab === 'overview' && (
            <div className="bg-[#0d1117] border border-[#272a31] rounded-2xl p-5 sm:p-6 space-y-5 shadow-lg max-w-3xl mx-auto">
              <div className="flex items-center justify-between pb-3 border-b border-[#1f2737]">
                <div>
                  <h3 className="font-display font-bold text-base text-white">
                    {activeGame.name} Mathematical Model &amp; Stake Boundaries
                  </h3>
                  <p className="text-xs text-[#94A3B8]">
                    Configure return-to-player, house volatility margin, and table ceilings
                  </p>
                </div>
              </div>

              <form onSubmit={handleSaveConfig} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-[#8b92a2] font-semibold mb-1">
                      Return to Player (RTP %)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      min="80"
                      max="99.9"
                      value={activeConfigForm.rtp || activeGame.rtp}
                      onChange={(e) => setActiveConfigForm({ ...activeConfigForm, rtp: e.target.value })}
                      className="w-full bg-[#07090d] border border-[#272a31] rounded-xl px-3 py-2 text-xs text-white font-mono-numbers outline-none focus:border-amber-400"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs text-[#8b92a2] font-semibold mb-1">
                      House Volatility Edge (%)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      min="0.1"
                      max="20"
                      value={activeConfigForm.house_edge || activeGame.houseEdge}
                      onChange={(e) => setActiveConfigForm({ ...activeConfigForm, house_edge: e.target.value })}
                      className="w-full bg-[#07090d] border border-[#272a31] rounded-xl px-3 py-2 text-xs text-white font-mono-numbers outline-none focus:border-amber-400"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-[#8b92a2] font-semibold mb-1">
                      Minimum Permitted Stake (USDT)
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={activeConfigForm.min_stake_fc || activeGame.minStakeFC}
                      onChange={(e) => setActiveConfigForm({ ...activeConfigForm, min_stake_fc: e.target.value })}
                      className="w-full bg-[#07090d] border border-[#272a31] rounded-xl px-3 py-2 text-xs text-white font-mono-numbers outline-none focus:border-amber-400"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs text-[#8b92a2] font-semibold mb-1">
                      Maximum Bet Ceiling (USDT)
                    </label>
                    <input
                      type="number"
                      min="10"
                      max="10000"
                      value={activeConfigForm.max_stake_fc || activeGame.maxStakeFC}
                      onChange={(e) => setActiveConfigForm({ ...activeConfigForm, max_stake_fc: e.target.value })}
                      className="w-full bg-[#07090d] border border-[#272a31] rounded-xl px-3 py-2 text-xs text-white font-mono-numbers outline-none focus:border-amber-400"
                      required
                    />
                  </div>
                </div>

                {/* Game specific rules notes */}
                {activeGame.id === 'bingo' && (
                  <div className="p-3.5 rounded-xl bg-[#07090d] border border-[#272a31] space-y-2 text-xs">
                    <span className="font-bold text-amber-300 block">Bingo – Color Trading Multiplier Scheme:</span>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 font-mono-numbers text-[11px]">
                      <div className="p-2 rounded bg-[#141924] border border-[#272a31]">
                        <span className="text-[#94A3B8] block">Red / Green:</span>
                        <strong className="text-emerald-400">2.0x Payout</strong>
                      </div>
                      <div className="p-2 rounded bg-[#141924] border border-[#272a31]">
                        <span className="text-[#94A3B8] block">Violet:</span>
                        <strong className="text-purple-400">4.5x Payout</strong>
                      </div>
                      <div className="p-2 rounded bg-[#141924] border border-[#272a31]">
                        <span className="text-[#94A3B8] block">Numbers 0–9:</span>
                        <strong className="text-amber-400">9.0x Payout</strong>
                      </div>
                      <div className="p-2 rounded bg-[#141924] border border-[#272a31]">
                        <span className="text-[#94A3B8] block">Big / Small:</span>
                        <strong className="text-blue-400">1.98x Payout</strong>
                      </div>
                    </div>
                  </div>
                )}

                {activeGame.id === 'horse-racing' && (
                  <div className="p-3.5 rounded-xl bg-[#07090d] border border-[#272a31] space-y-2 text-xs">
                    <span className="font-bold text-emerald-300 block">Horse Racing 6-Runner Roster &amp; Fixed Odds:</span>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 font-mono-numbers text-[11px]">
                      {[
                        { num: 1, name: 'Golden Thunder', odds: '2.4x' },
                        { num: 2, name: 'Silver Streak', odds: '3.8x' },
                        { num: 3, name: 'Crimson Comet', odds: '5.2x' },
                        { num: 4, name: 'Midnight Stallion', odds: '8.0x' },
                        { num: 5, name: 'Royal Pegasus', odds: '15.0x' },
                        { num: 6, name: 'Wild Valkyrie', odds: '35.0x' }
                      ].map(h => (
                        <div key={h.num} className="p-2 rounded bg-[#141924] border border-[#272a31]">
                          <span className="text-[#94A3B8] block">#{h.num} {h.name}:</span>
                          <strong className="text-amber-300 font-bold">{h.odds}</strong>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={savingConfig}
                  className="w-full py-2.5 rounded-xl btn-gold text-xs font-bold flex items-center justify-center gap-2 cursor-pointer shadow-md"
                >
                  <Settings className="w-4 h-4" />
                  <span>{savingConfig ? 'Saving Settings...' : 'Save Configuration to Supabase'}</span>
                </button>
              </form>
            </div>
          )}

          {/* TAB 2: ROOMS & TABLES */}
          {gameSubTab === 'rooms' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-display font-bold text-base text-white">
                    {activeGame.name} Dedicated Rooms &amp; Tables
                  </h3>
                  <p className="text-xs text-[#94A3B8]">
                    Configure table ceilings, player capacity, and room volatility
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
                {gameRooms.map((room) => (
                  <div
                    key={room.id}
                    className="p-4 sm:p-5 rounded-2xl bg-[#0d1117] border border-[#272a31] hover:border-amber-500/40 space-y-3 shadow-md flex flex-col justify-between transition-all group"
                  >
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-mono-numbers px-2 py-0.5 rounded bg-[#141924] text-amber-300 border border-[#272a31] font-bold uppercase">
                          {room.room_type || room.type || 'STANDARD'} ROOM
                        </span>
                        <span className="text-[10px] font-mono-numbers text-emerald-400 font-bold">
                          ● ACTIVE
                        </span>
                      </div>

                      <div>
                        <h4 className="font-bold text-sm sm:text-base text-white group-hover:text-amber-400 transition-colors">
                          {room.room_name || room.name}
                        </h4>
                        <p className="text-xs text-[#94A3B8] mt-1 leading-relaxed">
                          {room.description}
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 p-2.5 rounded-xl bg-[#07090d] border border-[#1f2737] text-xs font-mono-numbers mt-2">
                      <div>
                        <span className="text-[9px] text-[#8b92a2] block uppercase font-bold">Limits:</span>
                        <strong className="text-white">{room.min_stake_fc || room.minStakeFC}-{room.max_stake_fc || room.maxStakeFC} USDT</strong>
                      </div>
                      <div>
                        <span className="text-[9px] text-[#8b92a2] block uppercase font-bold">Capacity:</span>
                        <strong className="text-emerald-400">{room.player_capacity || room.playerCapacity || 1000} Players</strong>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 3: PROVABLY FAIR SEEDS */}
          {gameSubTab === 'fairness' && (
            <div className="bg-[#0d1117] border border-[#272a31] rounded-2xl p-5 sm:p-6 space-y-4 shadow-lg max-w-2xl mx-auto">
              <div className="flex items-center gap-2 pb-3 border-b border-[#1f2737]">
                <ShieldCheck className="w-5 h-5 text-emerald-400" />
                <div>
                  <h3 className="font-display font-bold text-base text-white">
                    Cryptographic Seed Verification
                  </h3>
                  <p className="text-xs text-[#94A3B8]">
                    Verify that game round outcomes are deterministically computed using SHA-256
                  </p>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-[#07090d] border border-[#272a31] space-y-2 text-xs">
                <span className="text-[11px] text-[#94A3B8] block">Current Active Server Seed Hash:</span>
                <span className="font-mono-numbers text-amber-300 text-[11px] break-all block bg-[#141924] p-2 rounded-lg border border-[#272a31]">
                  0x9f83c12d4a5b6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f
                </span>
                <div className="flex items-center justify-between text-[10px] text-[#94A3B8] pt-1">
                  <span>Client Seed: <strong className="text-white">client_master_seed_active</strong></span>
                  <span>Nonce: <strong className="text-emerald-400">#42</strong></span>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: BET HISTORY */}
          {gameSubTab === 'history' && (
            <div className="bg-[#0d1117] border border-[#272a31] rounded-2xl p-5 space-y-4 shadow-lg">
              <div className="flex items-center justify-between pb-3 border-b border-[#1f2737]">
                <h3 className="font-display font-bold text-base text-white">
                  Recent Bet Rounds on {activeGame.name}
                </h3>
                <span className="text-xs text-[#94A3B8] font-mono-numbers">
                  {gameRounds.filter(r => r.game_id === activeGame.id).length} Rounds Recorded
                </span>
              </div>

              {gameRounds.filter(r => r.game_id === activeGame.id).length === 0 ? (
                <div className="p-8 text-center text-xs text-[#64748b] bg-[#07090d] border border-[#272a31] rounded-xl">
                  No recent rounds recorded for {activeGame.name} yet.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 gap-3 sm:gap-4">
                  {gameRounds.filter(r => r.game_id === activeGame.id).slice(0, 12).map((r: any) => (
                    <div
                      key={r.id}
                      className="p-3.5 rounded-xl bg-[#07090d] border border-[#272a31] hover:border-amber-500/40 space-y-2.5 transition-colors shadow-sm"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono-numbers text-xs text-amber-300 font-bold">
                          #{r.id.slice(-6)}
                        </span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                          SETTLED
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-xs pt-1 border-t border-[#1f2737]/60">
                        <span className="text-[#94A3B8]">Player:</span>
                        <span className="font-semibold text-white truncate max-w-[130px]">
                          {r.username || `@${r.wallet_address?.slice(-4)}`}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 p-2 rounded-lg bg-[#141924]/60 border border-[#272a31]/60 text-xs font-mono-numbers">
                        <div>
                          <span className="text-[9px] text-[#8b92a2] block uppercase">Stake</span>
                          <strong className="text-white">{r.bet_amount} USDT</strong>
                        </div>
                        <div>
                          <span className="text-[9px] text-[#8b92a2] block uppercase">Multiplier</span>
                          <strong className="text-blue-300">{r.multiplier}x</strong>
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-xs pt-1 border-t border-[#1f2737]/60">
                        <span className="text-[#94A3B8] font-bold">Payout:</span>
                        <span className="font-mono-numbers font-black text-emerald-400 text-sm">
                          +{r.payout} USDT
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
