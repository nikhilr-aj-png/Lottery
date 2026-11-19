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

  // 8-Step Event Creation Wizard Modal State (Parts 1 - 6)
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [wizardStep, setWizardStep] = useState(1);
  const [wizardData, setWizardData] = useState({
    eventId: 'evt-' + Date.now().toString(36) + '-' + Math.floor(100 + Math.random() * 900),
    eventName: '',
    roomName: 'Room 1: Grand Pot Arena',
    roomDescription: 'Autonomous 4-digit draw with guaranteed jackpot pot. Pick lucky digits from 0000 to 9999.',
    durationValue: 24,
    durationUnit: 'hours',
    cooldownValue: 0,
    cooldownUnit: 'minutes',
    ticketPrice: 10,
    currency: 'USDT',
    jackpotMode: 'fixed' as 'fixed' | 'range',
    fixedJackpot: 5000,
    minJackpot: 1000,
    maxJackpot: 10000,
    jackpotSelectionMethod: 'manual' as 'manual' | 'random',
    selectedJackpotAmount: 5000,
    ticketLimitMode: 'unlimited' as 'unlimited' | 'limited',
    maxTotalTickets: 500,
    maxTicketsPerUser: 10,
    winnerMode: 'single' as 'single' | 'multiple',
    codesTiming: 'create' as 'create' | 'later',
    drawMode: 'random' as 'random' | 'preset',
    presetWinningDigits: '',
    winningCodes: ['2538'] as string[],
    winningCodeCount: 1,
    winnerPayoutSharePercent: 90,
    winnerCount: 1,
    distributionRule: 'tiered' as 'equal' | 'tiered',
    winnerDistribution: [{ position: 1, percent: 100 }] as Array<{ position: number; percent: number }>,
    badge: 'VIP LOTTERY',
    bannerImage: ''
  });
  const [isSubmittingWizard, setIsSubmittingWizard] = useState(false);

  // Modals for Contextual Actions on Events
  const [viewDetailsEvent, setViewDetailsEvent] = useState<any | null>(null);
  const [editEventTarget, setEditEventTarget] = useState<any | null>(null);
  const [winnerConfigEvent, setWinnerConfigEvent] = useState<any | null>(null);
  const [drawOracleEvent, setDrawOracleEvent] = useState<any | null>(null);
  const [viewPayoutsEvent, setViewPayoutsEvent] = useState<any | null>(null);
  const [pauseReasonModal, setPauseReasonModal] = useState<{ event: any; isPausing: boolean; reason: string } | null>(null);

  // Winner Configuration Modal Inner State (Part 9)
  const [wcWinnerMode, setWcWinnerMode] = useState<'single' | 'multiple'>('single');
  const [wcWinnerCount, setWcWinnerCount] = useState(3);
  const [wcDrawMode, setWcDrawMode] = useState<'random' | 'preset'>('preset');
  const [wcWinningCodes, setWcWinningCodes] = useState<string[]>(['2538']);
  const [wcDistribution, setWcDistribution] = useState<Array<{ position: number; percent: number }>>([{ position: 1, percent: 100 }]);
  const [wcPayoutSharePercent, setWcPayoutSharePercent] = useState(90);
  const [wcSaving, setWcSaving] = useState(false);
  const [wcEmergencyPauseReason, setWcEmergencyPauseReason] = useState('');
  const [wcShowPauseInput, setWcShowPauseInput] = useState(false);

  // Draw Oracle Modal Inner State (Part 10)
  const [doWinningCodes, setDoWinningCodes] = useState<string[]>([]);
  const [doIsExecuting, setDoIsExecuting] = useState(false);
  const [doShowConfirm, setDoShowConfirm] = useState(false);

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

  // Helper: Open Winner Config Modal for specific event
  const openWinnerConfig = (evt: any) => {
    setWinnerConfigEvent(evt);
    setWcShowPauseInput(false);
    setWcEmergencyPauseReason('');
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

  // Helper: Open Draw Oracle Modal for specific event
  const openDrawOracle = (evt: any) => {
    setDrawOracleEvent(evt);
    setDoShowConfirm(false);
    let codes: string[] = [];
    if (Array.isArray(evt.winningCodes) && evt.winningCodes.length > 0) {
      codes = evt.winningCodes.map((c: any) => String(c).replace(/\D/g, '').padStart(4, '0'));
    } else if (evt.presetWinningDigits) {
      codes = [String(evt.presetWinningDigits).replace(/\D/g, '').padStart(4, '0')];
    } else if (evt.winningDigits) {
      codes = [String(evt.winningDigits).replace(/\D/g, '').padStart(4, '0')];
    } else {
      const count = evt.winningCodeCount || evt.winnerCount || (evt.winnerMode === 'multiple' ? 3 : 1);
      codes = generateDistinctCodes(count);
    }
    setDoWinningCodes(codes);
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
            {filteredGames.map((game) => {
              const config = gameConfigs.find(c => c.game_id === game.id) || {};
              const isEnabled = config.is_enabled !== false;
              const gameRooms = rooms.filter(r => r.game_id === game.id || r.gameId === game.id);
              const gameRoundCount = game.id === 'lottery' ? events.length : gameRounds.filter(r => r.game_id === game.id).length;

              return (
                <div
                  key={game.id}
                  className={`glass-panel rounded-2xl p-4 sm:p-5 flex flex-col justify-between transition-all duration-200 hover:-translate-y-1 border ${
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
            if (lotteryStatusFilter === 'active') {
              if (e.isPaused || e.status !== 'active') return false;
            } else if (lotteryStatusFilter === 'paused') {
              if (!e.isPaused && e.status !== 'paused') return false;
            } else if (lotteryStatusFilter === 'result_pending') {
              const isPending = e.status === 'result_pending' || (e.status === 'active' && e.drawTime && e.drawTime <= Date.now());
              if (!isPending) return false;
            } else if (lotteryStatusFilter === 'completed') {
              if (e.status !== 'completed') return false;
            }
            if (lotterySearchQuery.trim()) {
              const q = lotterySearchQuery.toLowerCase();
              const mId = e.id?.toLowerCase().includes(q);
              const mTitle = e.title?.toLowerCase().includes(q);
              const mRoom = e.roomName?.toLowerCase().includes(q);
              if (!mId && !mTitle && !mRoom) return false;
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
                      className="bg-[#07090d] border border-[#272a31] rounded-xl px-3 py-2 text-xs font-bold text-white outline-none cursor-pointer focus:border-purple-400 min-w-[140px]"
                    >
                      <option value="all">All Statuses</option>
                      <option value="active">● Active</option>
                      <option value="paused">⏸ Paused</option>
                      <option value="result_pending">⏳ Pending Draw</option>
                      <option value="completed">✓ Concluded</option>
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
                        placeholder="Search by Event Name or ID..."
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
                    setWizardStep(1);
                    setWizardData({
                      eventId: 'evt-' + Date.now().toString(36) + '-' + Math.floor(100 + Math.random() * 900),
                      eventName: '',
                      roomName: uniqueRooms[0] || 'Room 1: Grand Pot Arena',
                      roomDescription: 'Autonomous 4-digit draw with guaranteed jackpot pot. Pick lucky digits from 0000 to 9999.',
                      durationValue: 24,
                      durationUnit: 'hours',
                      cooldownValue: 0,
                      cooldownUnit: 'minutes',
                      ticketPrice: 10,
                      currency: 'USDT',
                      jackpotMode: 'fixed',
                      fixedJackpot: 5000,
                      minJackpot: 1000,
                      maxJackpot: 10000,
                      jackpotSelectionMethod: 'manual',
                      selectedJackpotAmount: 5000,
                      ticketLimitMode: 'unlimited',
                      maxTotalTickets: 500,
                      maxTicketsPerUser: 10,
                      winnerMode: 'single',
                      codesTiming: 'create',
                      drawMode: 'random',
                      presetWinningDigits: '',
                      winningCodes: ['2538'],
                      winningCodeCount: 1,
                      winnerPayoutSharePercent: 90,
                      winnerCount: 1,
                      distributionRule: 'tiered',
                      winnerDistribution: [{ position: 1, percent: 100 }],
                      badge: 'VIP LOTTERY',
                      bannerImage: ''
                    });
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
                <div className="overflow-x-auto no-scrollbar">
                  <table className="w-full text-left text-xs font-mono-numbers">
                    <thead className="bg-[#07090d] text-[10px] text-[#64748B] uppercase tracking-wider border-b border-[#1f2737]">
                      <tr>
                        <th className="py-3 px-3.5 font-bold">Event &amp; Room</th>
                        <th className="py-3 px-3 font-bold">Event ID</th>
                        <th className="py-3 px-3 font-bold">Status</th>
                        <th className="py-3 px-3 font-bold">Ticket Price</th>
                        <th className="py-3 px-3 font-bold">Sold / Limit</th>
                        <th className="py-3 px-3 font-bold">Jackpot Pool</th>
                        <th className="py-3 px-3 font-bold">Winning Mode</th>
                        <th className="py-3 px-3 font-bold">Winning Codes</th>
                        <th className="py-3 px-3 font-bold">Result Status</th>
                        <th className="py-3 px-3.5 font-bold text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#1f2737]/60">
                      {filteredLotteryEvents.map((evt: any) => {
                        const isActive = evt.status === 'active' && !evt.isPaused && (!evt.drawTime || evt.drawTime > Date.now());
                        const isPaused = evt.isPaused || evt.status === 'paused';
                        const isPending = evt.status === 'result_pending' || (evt.status === 'active' && evt.drawTime && evt.drawTime <= Date.now());
                        const isConcluded = evt.status === 'completed';
                        const currency = evt.currency || 'USDT';

                        // Winning codes display
                        const codesList: string[] = Array.isArray(evt.winningCodes) && evt.winningCodes.length > 0
                          ? evt.winningCodes
                          : evt.presetWinningDigits
                            ? [evt.presetWinningDigits]
                            : [];

                        return (
                          <tr key={evt.id} className="hover:bg-[#141924]/60 transition-colors">
                            
                            {/* 1. Event Name & Room */}
                            <td className="py-3 px-3.5 max-w-[200px]">
                              <div className="flex items-center gap-1.5 mb-0.5">
                                <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30 uppercase font-bold truncate">
                                  {evt.badge || 'VIP DRAW'}
                                </span>
                              </div>
                              <h4 className="font-sans font-bold text-white text-xs truncate" title={evt.title}>
                                {evt.title}
                              </h4>
                              <p className="font-sans text-[11px] text-[#94A3B8] truncate" title={evt.roomName}>
                                {evt.roomName || 'Room 1: Grand Pot Arena'}
                              </p>
                            </td>

                            {/* 2. Event ID */}
                            <td className="py-3 px-3">
                              <div className="flex items-center gap-1 text-amber-400 font-bold">
                                <span>{evt.id}</span>
                                <button
                                  type="button"
                                  onClick={() => copyToClipboard(evt.id, evt.id)}
                                  className="text-[#64748B] hover:text-white cursor-pointer"
                                  title="Copy Event ID"
                                >
                                  {copiedText === evt.id ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                                </button>
                              </div>
                            </td>

                            {/* 3. Status Badge */}
                            <td className="py-3 px-3">
                              {isActive ? (
                                <span className="px-2 py-0.5 rounded border bg-emerald-500/10 text-emerald-400 border-emerald-500/30 text-[10px] font-bold">
                                  ● ACTIVE
                                </span>
                              ) : isPaused ? (
                                <span
                                  className="px-2 py-0.5 rounded border bg-amber-500/15 text-amber-300 border-amber-500/40 text-[10px] font-bold"
                                  title={evt.pauseReason ? `Paused: ${evt.pauseReason}` : 'Event Paused'}
                                >
                                  ⏸ PAUSED
                                </span>
                              ) : isPending ? (
                                <span className="px-2 py-0.5 rounded border bg-amber-500/10 text-amber-400 border-amber-500/30 text-[10px] font-bold animate-pulse">
                                  ⏳ PENDING DRAW
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded border bg-purple-500/10 text-purple-400 border-purple-500/30 text-[10px] font-bold">
                                  ✓ CONCLUDED
                                </span>
                              )}
                            </td>

                            {/* 4. Ticket Price */}
                            <td className="py-3 px-3 text-white font-bold">
                              {evt.ticketPrice || 10} {currency}
                            </td>

                            {/* 5. Sold / Limit */}
                            <td className="py-3 px-3">
                              <span className="text-emerald-400 font-bold">{evt.ticketsSold || 0}</span>
                              <span className="text-[#64748B]"> / {evt.ticketLimitMode === 'limited' ? (evt.maxTotalTickets || evt.maxTickets || 500) : '∞'}</span>
                            </td>

                            {/* 6. Jackpot Pool & Determination Method */}
                            <td className="py-3 px-3">
                              <div className="font-bold text-amber-400">
                                {evt.lockedJackpot ? (
                                  <span>{Number(evt.lockedJackpot).toLocaleString()} {currency}</span>
                                ) : evt.jackpotMode === 'fixed' ? (
                                  <span>{(evt.fixedJackpot || evt.poolPrize || 5000).toLocaleString()} {currency}</span>
                                ) : (
                                  <span>{(evt.minPrize || 1000).toLocaleString()} - {(evt.maxPrize || 10000).toLocaleString()} {currency}</span>
                                )}
                              </div>
                              <span className="text-[10px] text-[#94A3B8] block uppercase">
                                {evt.jackpotMode === 'fixed'
                                  ? 'Fixed Pot'
                                  : evt.jackpotSelectionMethod === 'manual'
                                    ? 'Manual Exact'
                                    : 'Random RNG'}
                              </span>
                            </td>

                            {/* 7. Winning Mode */}
                            <td className="py-3 px-3">
                              {evt.winnerMode === 'single' ? (
                                <span className="inline-flex items-center gap-1 text-amber-300 font-bold text-[11px]">
                                  <Trophy className="w-3 h-3 text-amber-400" />
                                  <span>Single Winner</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-purple-300 font-bold text-[11px]">
                                  <Users className="w-3 h-3 text-purple-400" />
                                  <span>Multiple ({evt.winningCodeCount || evt.winnerCount || 3} Codes)</span>
                                </span>
                              )}
                            </td>

                            {/* 8. Winning Codes Preview */}
                            <td className="py-3 px-3">
                              {isConcluded && evt.winningDigits ? (
                                <span className="px-2 py-0.5 rounded bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-black text-[11px]">
                                  Drawn: [{evt.winningDigits}]
                                </span>
                              ) : codesList.length > 0 ? (
                                <div className="flex flex-wrap gap-1 max-w-[140px]">
                                  {codesList.slice(0, 2).map((c: string, idx: number) => (
                                    <span key={idx} className="px-1.5 py-0.2 rounded bg-purple-500/15 border border-purple-500/30 text-purple-300 font-black text-[10px]">
                                      [{c}]
                                    </span>
                                  ))}
                                  {codesList.length > 2 && (
                                    <span className="px-1.5 py-0.2 rounded bg-[#141924] border border-[#272a31] text-[#94A3B8] text-[9px] font-bold" title={codesList.join(', ')}>
                                      +{codesList.length - 2} more
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <span className="px-1.5 py-0.5 rounded bg-amber-500/10 border border-amber-500/30 text-amber-400 text-[10px] font-bold flex items-center gap-1">
                                  <AlertTriangle className="w-3 h-3" />
                                  <span>To Be Configured</span>
                                </span>
                              )}
                            </td>

                            {/* 9. Result Status */}
                            <td className="py-3 px-3 text-[11px]">
                              {isConcluded ? (
                                <span className="text-emerald-400 font-bold flex items-center gap-1">
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  <span>Settled &amp; Paid</span>
                                </span>
                              ) : isPending ? (
                                <span className="text-amber-400 font-bold">
                                  Draw Ready
                                </span>
                              ) : (
                                <span className="text-[#94A3B8]">
                                  Ticket Sales Open
                                </span>
                              )}
                            </td>

                            {/* 10. Contextual Action Buttons */}
                            <td className="py-3 px-3.5 text-right whitespace-nowrap">
                              <div className="flex items-center justify-end gap-1.5">
                                
                                {/* View Details */}
                                <button
                                  type="button"
                                  onClick={() => setViewDetailsEvent(evt)}
                                  className="p-1.5 rounded-lg bg-[#141924] hover:bg-[#1a2130] text-[#94A3B8] hover:text-white border border-[#272a31] transition-colors cursor-pointer"
                                  title="View Full Event Details"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                </button>

                                {/* Edit Event */}
                                <button
                                  type="button"
                                  onClick={() => setEditEventTarget(evt)}
                                  className="p-1.5 rounded-lg bg-[#141924] hover:bg-[#1a2130] text-[#94A3B8] hover:text-white border border-[#272a31] transition-colors cursor-pointer"
                                  title="Edit Event Parameters"
                                >
                                  <Edit3 className="w-3.5 h-3.5" />
                                </button>

                                {/* Configure Winners / Winning Codes */}
                                <button
                                  type="button"
                                  onClick={() => openWinnerConfig(evt)}
                                  className="p-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 transition-colors cursor-pointer"
                                  title="Configure Winners &amp; Winning Codes"
                                >
                                  <Trophy className="w-3.5 h-3.5" />
                                </button>

                                {/* Draw Oracle / Manage Draw Results */}
                                <button
                                  type="button"
                                  onClick={() => openDrawOracle(evt)}
                                  className="p-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 transition-colors cursor-pointer"
                                  title="Draw Oracle &amp; Finalize Settlement"
                                >
                                  <Dices className="w-3.5 h-3.5" />
                                </button>

                                {/* View Payouts */}
                                <button
                                  type="button"
                                  onClick={() => setViewPayoutsEvent(evt)}
                                  className="p-1.5 rounded-lg bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 border border-purple-500/30 transition-colors cursor-pointer"
                                  title="View Disbursed Payouts"
                                >
                                  <Coins className="w-3.5 h-3.5" />
                                </button>

                                {/* Emergency Pause / Resume */}
                                <button
                                  type="button"
                                  disabled={isConcluded}
                                  onClick={() => {
                                    if (isPaused) {
                                      directPauseEvent(evt.id, false, '');
                                    } else {
                                      setPauseReasonModal({ event: evt, isPausing: true, reason: '' });
                                    }
                                  }}
                                  className={`p-1.5 rounded-lg border transition-colors cursor-pointer disabled:opacity-30 ${
                                    isPaused
                                      ? 'bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border-emerald-500/30'
                                      : 'bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border-amber-500/30'
                                  }`}
                                  title={isPaused ? 'Resume Event' : 'Emergency Pause Event'}
                                >
                                  {isPaused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
                                </button>

                                {/* Delete Event */}
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (confirm(`Are you sure you want to delete event "${evt.title}" (${evt.id})? This will immediately remove it from the User Panel.`)) {
                                      directDeleteEvent(evt.id);
                                    }
                                  }}
                                  className="p-1.5 rounded-lg bg-red-950/30 hover:bg-red-900/50 text-red-400 border border-red-500/30 transition-colors cursor-pointer"
                                  title="Delete Event"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>

                              </div>
                            </td>

                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* ================================================================ */}
            {/* MODAL 1: 8-STEP EVENT CREATION WIZARD (PARTS 1 - 6)              */}
            {/* ================================================================ */}
            {isWizardOpen && (
              <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-150">
                <div className="max-w-3xl w-full bg-[#0d1117] border border-[#272a31] rounded-3xl p-5 sm:p-7 space-y-6 shadow-2xl max-h-[90vh] overflow-y-auto no-scrollbar my-auto">
                  
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
                            Step {wizardStep} of 8: {
                              wizardStep === 1 ? 'Basic Information & Room Setup' :
                              wizardStep === 2 ? 'Ticket Price & Currency (USDT)' :
                              wizardStep === 3 ? 'Jackpot Configuration & Determination' :
                              wizardStep === 4 ? 'Ticket Purchase Boundaries' :
                              wizardStep === 5 ? 'Winning Rules & Combination Codes' :
                              wizardStep === 6 ? 'Payout Distribution & Winner Split' :
                              wizardStep === 7 ? 'Review Configuration & Summary' :
                              'Deploy & Publish Event'
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
                    <div className="grid grid-cols-8 gap-1.5 pt-1">
                      {[1, 2, 3, 4, 5, 6, 7, 8].map(s => (
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

                  {/* STEP 1: BASIC INFORMATION & ROOM */}
                  {wizardStep === 1 && (
                    <div className="space-y-4 animate-in fade-in duration-200">
                      <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300">
                        ℹ️ Step 1 establishes the unique identity, room classification, and countdown schedule for this lottery draw.
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs text-[#8b92a2] font-semibold mb-1">
                            Event ID (Auto-Generated Unique Identifier)
                          </label>
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              value={wizardData.eventId}
                              onChange={(e) => setWizardData({ ...wizardData, eventId: e.target.value })}
                              className="flex-1 bg-[#07090d] border border-[#272a31] rounded-xl px-3 py-2 text-xs text-amber-300 font-mono-numbers outline-none focus:border-amber-400"
                              required
                            />
                            <button
                              type="button"
                              onClick={() => setWizardData({ ...wizardData, eventId: 'evt-' + Date.now().toString(36) + '-' + Math.floor(100 + Math.random() * 900) })}
                              className="px-2.5 py-2 rounded-xl bg-[#141924] hover:bg-[#1a2130] border border-[#272a31] text-xs text-amber-400 cursor-pointer"
                              title="Generate New ID"
                            >
                              <RefreshCw className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        <div>
                          <label className="block text-xs text-[#8b92a2] font-semibold mb-1">
                            Event Name / Title *
                          </label>
                          <input
                            type="text"
                            value={wizardData.eventName}
                            onChange={(e) => setWizardData({ ...wizardData, eventName: e.target.value })}
                            placeholder="e.g. Diwali Mega Bumper 50,000 USDT"
                            className="w-full bg-[#07090d] border border-[#272a31] rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-amber-400"
                            required
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs text-[#8b92a2] font-semibold mb-1">
                            Designated Room *
                          </label>
                          <input
                            type="text"
                            value={wizardData.roomName}
                            onChange={(e) => setWizardData({ ...wizardData, roomName: e.target.value })}
                            placeholder="e.g. Room 1: Grand Pot Arena"
                            className="w-full bg-[#07090d] border border-[#272a31] rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-amber-400"
                            required
                          />
                        </div>

                        <div>
                          <label className="block text-xs text-[#8b92a2] font-semibold mb-1">
                            Badge Tag
                          </label>
                          <input
                            type="text"
                            value={wizardData.badge}
                            onChange={(e) => setWizardData({ ...wizardData, badge: e.target.value })}
                            placeholder="e.g. VIP DRAW"
                            className="w-full bg-[#07090d] border border-[#272a31] rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-amber-400"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs text-[#8b92a2] font-semibold mb-1">
                          Room Description
                        </label>
                        <textarea
                          rows={2}
                          value={wizardData.roomDescription}
                          onChange={(e) => setWizardData({ ...wizardData, roomDescription: e.target.value })}
                          placeholder="Describe the rules, pool distribution, or special perks..."
                          className="w-full bg-[#07090d] border border-[#272a31] rounded-xl p-3 text-xs text-white outline-none focus:border-amber-400"
                        />
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                        <div>
                          <label className="block text-xs text-[#8b92a2] font-semibold mb-1">
                            Event Duration (Countdown)
                          </label>
                          <div className="grid grid-cols-2 gap-2">
                            <input
                              type="number"
                              min="1"
                              value={wizardData.durationValue}
                              onChange={(e) => setWizardData({ ...wizardData, durationValue: Math.max(1, parseFloat(e.target.value) || 1) })}
                              className="bg-[#07090d] border border-[#272a31] rounded-xl px-3 py-2 text-xs text-white font-mono-numbers outline-none focus:border-amber-400"
                              required
                            />
                            <select
                              value={wizardData.durationUnit}
                              onChange={(e) => setWizardData({ ...wizardData, durationUnit: e.target.value })}
                              className="bg-[#07090d] border border-[#272a31] rounded-xl px-2 py-2 text-xs text-white outline-none cursor-pointer"
                            >
                              <option value="minutes">Minutes</option>
                              <option value="hours">Hours</option>
                              <option value="days">Days</option>
                            </select>
                          </div>
                        </div>

                        <div>
                          <label className="block text-xs text-[#8b92a2] font-semibold mb-1">
                            Cooldown Before Start
                          </label>
                          <div className="grid grid-cols-2 gap-2">
                            <input
                              type="number"
                              min="0"
                              value={wizardData.cooldownValue}
                              onChange={(e) => setWizardData({ ...wizardData, cooldownValue: Math.max(0, parseFloat(e.target.value) || 0) })}
                              className="bg-[#07090d] border border-[#272a31] rounded-xl px-3 py-2 text-xs text-white font-mono-numbers outline-none focus:border-amber-400"
                            />
                            <select
                              value={wizardData.cooldownUnit}
                              onChange={(e) => setWizardData({ ...wizardData, cooldownUnit: e.target.value })}
                              className="bg-[#07090d] border border-[#272a31] rounded-xl px-2 py-2 text-xs text-white outline-none cursor-pointer"
                            >
                              <option value="minutes">Minutes</option>
                              <option value="hours">Hours</option>
                            </select>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-4 border-t border-[#1f2737]">
                        <button
                          type="button"
                          onClick={() => setIsWizardOpen(false)}
                          className="px-4 py-2 rounded-xl bg-[#141924] hover:bg-[#1a2130] text-xs font-bold text-[#94A3B8] hover:text-white border border-[#272a31] cursor-pointer"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          disabled={!wizardData.eventName.trim() || !wizardData.roomName.trim()}
                          onClick={() => setWizardStep(2)}
                          className="px-5 py-2.5 rounded-xl btn-gold text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-md disabled:opacity-50"
                        >
                          <span>Next: Ticket Price &amp; Currency</span>
                          <ArrowRight className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  )}

                  {/* STEP 2: TICKET PRICE & CURRENCY */}
                  {wizardStep === 2 && (
                    <div className="space-y-4 animate-in fade-in duration-200">
                      <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300">
                        ℹ️ Step 2 configures the purchase cost per ticket. Platform economy is strictly USDT.
                      </div>

                      <div>
                        <label className="block text-xs text-[#8b92a2] font-semibold mb-2">
                          Platform Currency
                        </label>
                        <div className="p-3.5 rounded-xl bg-[#07090d] border border-emerald-500/30 flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center text-emerald-400 font-black text-lg">
                              ₮
                            </div>
                            <div>
                              <strong className="text-white block text-sm">Currency: USDT</strong>
                              <span className="text-[10px] text-emerald-400 font-semibold">Tether TRC-20 · Exclusive Platform Currency</span>
                            </div>
                          </div>
                          <span className="px-2.5 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-[10px] font-mono-numbers font-bold uppercase">
                            USDT Only
                          </span>
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs text-[#8b92a2] font-semibold mb-1">
                          Ticket Price (USDT) *
                        </label>
                        <div className="relative">
                          <input
                            type="number"
                            min="1"
                            value={wizardData.ticketPrice}
                            onChange={(e) => setWizardData({ ...wizardData, ticketPrice: Math.max(1, parseFloat(e.target.value) || 1) })}
                            className="w-full bg-[#07090d] border border-[#272a31] rounded-xl px-3 py-2.5 text-sm text-white font-mono-numbers outline-none focus:border-amber-400"
                            required
                          />
                          <span className="absolute right-3 top-2.5 text-xs text-[#64748B] font-bold">
                            USDT / Ticket
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-4 border-t border-[#1f2737]">
                        <button
                          type="button"
                          onClick={() => setWizardStep(1)}
                          className="px-4 py-2 rounded-xl bg-[#141924] hover:bg-[#1a2130] text-xs font-bold text-[#94A3B8] hover:text-white border border-[#272a31] flex items-center gap-1 cursor-pointer"
                        >
                          <ArrowLeft className="w-3.5 h-3.5" />
                          <span>Back</span>
                        </button>
                        <button
                          type="button"
                          disabled={wizardData.ticketPrice <= 0}
                          onClick={() => setWizardStep(3)}
                          className="px-5 py-2.5 rounded-xl btn-gold text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-md"
                        >
                          <span>Next: Jackpot Configuration</span>
                          <ArrowRight className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  )}

                  {/* STEP 3: JACKPOT AMOUNT & DETERMINATION (PART 1) */}
                  {wizardStep === 3 && (
                    <div className="space-y-4 animate-in fade-in duration-200">
                      <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300">
                        ℹ️ Step 3 configures the jackpot determination method. You can choose a guaranteed Fixed Jackpot or a bounded Range (Manual vs Random).
                      </div>

                      <div>
                        <label className="block text-xs text-[#8b92a2] font-semibold mb-2">
                          Jackpot Structure
                        </label>
                        <div className="grid grid-cols-2 gap-3">
                          <div
                            onClick={() => setWizardData({ ...wizardData, jackpotMode: 'fixed' })}
                            className={`p-4 rounded-xl border flex flex-col items-center justify-center text-center cursor-pointer transition-all ${
                              wizardData.jackpotMode === 'fixed'
                                ? 'bg-amber-500/20 border-amber-400 ring-1 ring-amber-400 text-white'
                                : 'bg-[#07090d] border-[#272a31] text-[#94A3B8]'
                            }`}
                          >
                            <Coins className="w-5 h-5 text-amber-400 mb-1" />
                            <strong className="text-white text-sm">Fixed Jackpot</strong>
                            <span className="text-[10px] text-[#94A3B8]">Guaranteed exact prize pool</span>
                          </div>

                          <div
                            onClick={() => setWizardData({ ...wizardData, jackpotMode: 'range' })}
                            className={`p-4 rounded-xl border flex flex-col items-center justify-center text-center cursor-pointer transition-all ${
                              wizardData.jackpotMode === 'range'
                                ? 'bg-amber-500/20 border-amber-400 ring-1 ring-amber-400 text-white'
                                : 'bg-[#07090d] border-[#272a31] text-[#94A3B8]'
                            }`}
                          >
                            <TrendingUp className="w-5 h-5 text-emerald-400 mb-1" />
                            <strong className="text-white text-sm">Jackpot Range</strong>
                            <span className="text-[10px] text-[#94A3B8]">Minimum &amp; Maximum Boundaries</span>
                          </div>
                        </div>
                      </div>

                      {wizardData.jackpotMode === 'fixed' ? (
                        <div>
                          <label className="block text-xs text-[#8b92a2] font-semibold mb-1">
                            Fixed Guaranteed Jackpot Amount (USDT) *
                          </label>
                          <input
                            type="number"
                            min="10"
                            value={wizardData.fixedJackpot}
                            onChange={(e) => setWizardData({ ...wizardData, fixedJackpot: Math.max(1, parseFloat(e.target.value) || 1) })}
                            className="w-full bg-[#07090d] border border-[#272a31] rounded-xl px-3 py-2.5 text-sm text-white font-mono-numbers outline-none focus:border-amber-400"
                            required
                          />
                        </div>
                      ) : (
                        <div className="space-y-4 p-4 rounded-xl bg-[#07090d] border border-[#272a31]">
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="block text-xs text-[#8b92a2] font-semibold mb-1">
                                Minimum Jackpot (Floor) *
                              </label>
                              <input
                                type="number"
                                min="1"
                                value={wizardData.minJackpot}
                                onChange={(e) => {
                                  const minVal = Math.max(1, parseFloat(e.target.value) || 1);
                                  setWizardData({
                                    ...wizardData,
                                    minJackpot: minVal,
                                    selectedJackpotAmount: Math.max(minVal, wizardData.selectedJackpotAmount)
                                  });
                                }}
                                className="w-full bg-[#0b0e14] border border-[#1f2737] rounded-xl px-3 py-2 text-xs text-white font-mono-numbers outline-none focus:border-amber-400"
                                required
                              />
                            </div>

                            <div>
                              <label className="block text-xs text-[#8b92a2] font-semibold mb-1">
                                Maximum Jackpot (Ceiling) *
                              </label>
                              <input
                                type="number"
                                min="1"
                                value={wizardData.maxJackpot}
                                onChange={(e) => {
                                  const maxVal = Math.max(1, parseFloat(e.target.value) || 1);
                                  setWizardData({
                                    ...wizardData,
                                    maxJackpot: maxVal,
                                    selectedJackpotAmount: Math.min(maxVal, wizardData.selectedJackpotAmount)
                                  });
                                }}
                                className="w-full bg-[#0b0e14] border border-[#1f2737] rounded-xl px-3 py-2 text-xs text-white font-mono-numbers outline-none focus:border-amber-400"
                                required
                              />
                            </div>
                          </div>

                          {/* Determination Method Choice */}
                          <div className="space-y-2">
                            <label className="block text-xs text-white font-bold">
                              Jackpot Determination Method (Part 1)
                            </label>
                            <div className="grid grid-cols-2 gap-3">
                              <div
                                onClick={() => setWizardData({ ...wizardData, jackpotSelectionMethod: 'manual' })}
                                className={`p-3 rounded-xl border cursor-pointer transition-all ${
                                  wizardData.jackpotSelectionMethod === 'manual'
                                    ? 'bg-amber-500/20 border-amber-400 text-white'
                                    : 'bg-[#0b0e14] border-[#1f2737] text-[#94A3B8]'
                                }`}
                              >
                                <strong className="text-xs block text-white">1. Manual Selection</strong>
                                <span className="text-[10px] text-[#94A3B8]">Administrator specifies exact amount in range</span>
                              </div>

                              <div
                                onClick={() => setWizardData({ ...wizardData, jackpotSelectionMethod: 'random' })}
                                className={`p-3 rounded-xl border cursor-pointer transition-all ${
                                  wizardData.jackpotSelectionMethod === 'random'
                                    ? 'bg-amber-500/20 border-amber-400 text-white'
                                    : 'bg-[#0b0e14] border-[#1f2737] text-[#94A3B8]'
                                }`}
                              >
                                <strong className="text-xs block text-white">2. Random Determination</strong>
                                <span className="text-[10px] text-[#94A3B8]">Backend deterministically locks RNG jackpot</span>
                              </div>
                            </div>
                          </div>

                          {/* Manual Selection Input with Validation */}
                          {wizardData.jackpotSelectionMethod === 'manual' ? (
                            <div className="space-y-2 pt-2 border-t border-[#1f2737]">
                              <div className="flex items-center justify-between">
                                <label className="text-xs text-amber-300 font-bold">
                                  Exact Jackpot Amount to Use (USDT) *
                                </label>
                                <span className="text-[10px] text-[#94A3B8]">
                                  Allowed Range: {wizardData.minJackpot} - {wizardData.maxJackpot} USDT
                                </span>
                              </div>
                              <input
                                type="number"
                                min={wizardData.minJackpot}
                                max={wizardData.maxJackpot}
                                value={wizardData.selectedJackpotAmount}
                                onChange={(e) => setWizardData({ ...wizardData, selectedJackpotAmount: parseFloat(e.target.value) || wizardData.minJackpot })}
                                className={`w-full bg-[#0b0e14] border rounded-xl px-3 py-2 text-xs text-white font-mono-numbers outline-none ${
                                  wizardData.selectedJackpotAmount < wizardData.minJackpot || wizardData.selectedJackpotAmount > wizardData.maxJackpot
                                    ? 'border-red-500 text-red-300'
                                    : 'border-amber-500/50'
                                }`}
                                required
                              />

                              {/* Validation message */}
                              {wizardData.selectedJackpotAmount < wizardData.minJackpot || wizardData.selectedJackpotAmount > wizardData.maxJackpot ? (
                                <p className="text-[11px] text-red-400 font-bold flex items-center gap-1">
                                  ⚠️ Amount must be between {wizardData.minJackpot} USDT and {wizardData.maxJackpot} USDT.
                                </p>
                              ) : (
                                <p className="text-[11px] text-emerald-400 font-bold flex items-center gap-1">
                                  ✓ Selected Jackpot: {wizardData.selectedJackpotAmount.toLocaleString()} USDT (Valid)
                                </p>
                              )}
                            </div>
                          ) : (
                            <div className="p-3.5 rounded-xl bg-[#0b0e14] border border-emerald-500/30 space-y-2 text-xs">
                              <span className="font-bold text-emerald-300 block">Random Determination Specification:</span>
                              <p className="text-[#94A3B8] text-[11px]">
                                Upon event publishing, the Supabase backend will calculate and permanently lock a Provably Fair random jackpot within the range:
                              </p>
                              <div className="flex items-center justify-between p-2 rounded-lg bg-[#07090d] border border-[#1f2737]">
                                <span className="text-white font-bold">{wizardData.minJackpot} USDT — {wizardData.maxJackpot} USDT</span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const sample = Math.round(wizardData.minJackpot + Math.random() * (wizardData.maxJackpot - wizardData.minJackpot));
                                    if (showToast) showToast(`Simulated RNG Result: ${sample} USDT`, 'info');
                                  }}
                                  className="px-2.5 py-1 rounded bg-[#141924] hover:bg-[#1a2130] text-[10px] text-amber-400 font-bold border border-[#272a31] cursor-pointer"
                                >
                                  Test RNG Formula
                                </button>
                              </div>
                            </div>
                          )}

                        </div>
                      )}

                      <div className="flex items-center justify-between pt-4 border-t border-[#1f2737]">
                        <button
                          type="button"
                          onClick={() => setWizardStep(2)}
                          className="px-4 py-2 rounded-xl bg-[#141924] hover:bg-[#1a2130] text-xs font-bold text-[#94A3B8] hover:text-white border border-[#272a31] flex items-center gap-1 cursor-pointer"
                        >
                          <ArrowLeft className="w-3.5 h-3.5" />
                          <span>Back</span>
                        </button>
                        <button
                          type="button"
                          disabled={
                            wizardData.jackpotMode === 'range' &&
                            wizardData.jackpotSelectionMethod === 'manual' &&
                            (wizardData.selectedJackpotAmount < wizardData.minJackpot || wizardData.selectedJackpotAmount > wizardData.maxJackpot)
                          }
                          onClick={() => setWizardStep(4)}
                          className="px-5 py-2.5 rounded-xl btn-gold text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-md disabled:opacity-50"
                        >
                          <span>Next: Ticket Limits</span>
                          <ArrowRight className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  )}

                  {/* STEP 4: TICKET LIMITS */}
                  {wizardStep === 4 && (
                    <div className="space-y-4 animate-in fade-in duration-200">
                      <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300">
                        ℹ️ Step 4 controls pool scarcity: select whether ticket purchases are unlimited or bounded by limits.
                      </div>

                      <div>
                        <label className="block text-xs text-[#8b92a2] font-semibold mb-2">
                          Ticket Purchase Boundary Mode
                        </label>
                        <div className="grid grid-cols-2 gap-3">
                          <div
                            onClick={() => setWizardData({ ...wizardData, ticketLimitMode: 'unlimited' })}
                            className={`p-4 rounded-xl border flex flex-col items-center justify-center text-center cursor-pointer transition-all ${
                              wizardData.ticketLimitMode === 'unlimited'
                                ? 'bg-amber-500/20 border-amber-400 ring-1 ring-amber-400 text-white'
                                : 'bg-[#07090d] border-[#272a31] text-[#94A3B8]'
                            }`}
                          >
                            <Unlock className="w-5 h-5 text-amber-400 mb-1" />
                            <strong className="text-white text-sm">Unlimited Tickets</strong>
                            <span className="text-[10px] text-[#94A3B8]">No ceiling on total ticket volume</span>
                          </div>

                          <div
                            onClick={() => setWizardData({ ...wizardData, ticketLimitMode: 'limited' })}
                            className={`p-4 rounded-xl border flex flex-col items-center justify-center text-center cursor-pointer transition-all ${
                              wizardData.ticketLimitMode === 'limited'
                                ? 'bg-amber-500/20 border-amber-400 ring-1 ring-amber-400 text-white'
                                : 'bg-[#07090d] border-[#272a31] text-[#94A3B8]'
                            }`}
                          >
                            <Lock className="w-5 h-5 text-purple-400 mb-1" />
                            <strong className="text-white text-sm">Limited Tickets</strong>
                            <span className="text-[10px] text-[#94A3B8]">Hard total &amp; per-user caps</span>
                          </div>
                        </div>
                      </div>

                      {wizardData.ticketLimitMode === 'limited' && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 rounded-xl bg-[#07090d] border border-[#272a31]">
                          <div>
                            <label className="block text-xs text-[#8b92a2] font-semibold mb-1">
                              Maximum Total Tickets Allowed
                            </label>
                            <input
                              type="number"
                              min="1"
                              value={wizardData.maxTotalTickets}
                              onChange={(e) => setWizardData({ ...wizardData, maxTotalTickets: Math.max(1, parseInt(e.target.value) || 1) })}
                              className="w-full bg-[#0b0e14] border border-[#1f2737] rounded-xl px-3 py-2 text-xs text-white font-mono-numbers outline-none focus:border-amber-400"
                              required
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-[#8b92a2] font-semibold mb-1">
                              Maximum Tickets Per User
                            </label>
                            <input
                              type="number"
                              min="1"
                              value={wizardData.maxTicketsPerUser}
                              onChange={(e) => setWizardData({ ...wizardData, maxTicketsPerUser: Math.max(1, parseInt(e.target.value) || 1) })}
                              className="w-full bg-[#0b0e14] border border-[#1f2737] rounded-xl px-3 py-2 text-xs text-white font-mono-numbers outline-none focus:border-amber-400"
                              required
                            />
                          </div>
                        </div>
                      )}

                      <div className="flex items-center justify-between pt-4 border-t border-[#1f2737]">
                        <button
                          type="button"
                          onClick={() => setWizardStep(3)}
                          className="px-4 py-2 rounded-xl bg-[#141924] hover:bg-[#1a2130] text-xs font-bold text-[#94A3B8] hover:text-white border border-[#272a31] flex items-center gap-1 cursor-pointer"
                        >
                          <ArrowLeft className="w-3.5 h-3.5" />
                          <span>Back</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setWizardStep(5)}
                          className="px-5 py-2.5 rounded-xl btn-gold text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-md"
                        >
                          <span>Next: Winning Rules &amp; Codes</span>
                          <ArrowRight className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  )}

                  {/* STEP 5: WINNING RULES, CODES & TIMING (PARTS 2, 3, 4) */}
                  {wizardStep === 5 && (
                    <div className="space-y-4 animate-in fade-in duration-200">
                      <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300">
                        ℹ️ Step 5 configures single vs multi-winning codes, timing (Now vs Later), and Draw Mode (Preset vs Random RNG).
                      </div>

                      {/* Part 2: Winner Mode Toggle */}
                      <div>
                        <label className="block text-xs text-[#8b92a2] font-semibold mb-2">
                          Winner Mode (Part 2)
                        </label>
                        <div className="grid grid-cols-2 gap-3">
                          <div
                            onClick={() => {
                              setWizardData({
                                ...wizardData,
                                winnerMode: 'single',
                                winnerCount: 1,
                                winningCodeCount: 1,
                                winningCodes: [wizardData.winningCodes[0] || '2538'],
                                winnerDistribution: [{ position: 1, percent: 100 }]
                              });
                            }}
                            className={`p-4 rounded-xl border flex flex-col items-center justify-center text-center cursor-pointer transition-all ${
                              wizardData.winnerMode === 'single'
                                ? 'bg-amber-500/20 border-amber-400 ring-1 ring-amber-400 text-white'
                                : 'bg-[#07090d] border-[#272a31] text-[#94A3B8]'
                            }`}
                          >
                            <Trophy className="w-5 h-5 text-amber-400 mb-1" />
                            <strong className="text-white text-sm">Single Winner</strong>
                            <span className="text-[10px] text-[#94A3B8]">1 exact four-digit winning code</span>
                          </div>

                          <div
                            onClick={() => {
                              const count = 3;
                              const codes = ['2538', '7412', '9065'];
                              setWizardData({
                                ...wizardData,
                                winnerMode: 'multiple',
                                winnerCount: count,
                                winningCodeCount: count,
                                winningCodes: codes,
                                winnerDistribution: [
                                  { position: 1, percent: 50 },
                                  { position: 2, percent: 30 },
                                  { position: 3, percent: 20 }
                                ]
                              });
                            }}
                            className={`p-4 rounded-xl border flex flex-col items-center justify-center text-center cursor-pointer transition-all ${
                              wizardData.winnerMode === 'multiple'
                                ? 'bg-amber-500/20 border-amber-400 ring-1 ring-amber-400 text-white'
                                : 'bg-[#07090d] border-[#272a31] text-[#94A3B8]'
                            }`}
                          >
                            <Users className="w-5 h-5 text-purple-400 mb-1" />
                            <strong className="text-white text-sm">Multiple Winners</strong>
                            <span className="text-[10px] text-[#94A3B8]">Configurable N distinct winning codes</span>
                          </div>
                        </div>
                      </div>

                      {/* Part 3: Configuration Timing */}
                      <div>
                        <label className="block text-xs text-[#8b92a2] font-semibold mb-2">
                          Winning Code Configuration Timing (Part 3)
                        </label>
                        <div className="grid grid-cols-2 gap-3">
                          <div
                            onClick={() => setWizardData({ ...wizardData, codesTiming: 'create' })}
                            className={`p-3 rounded-xl border cursor-pointer transition-all ${
                              wizardData.codesTiming === 'create'
                                ? 'bg-emerald-500/20 border-emerald-400 text-white'
                                : 'bg-[#07090d] border-[#272a31] text-[#94A3B8]'
                            }`}
                          >
                            <strong className="text-xs block text-white">Option A: Configure Now</strong>
                            <span className="text-[10px] text-[#94A3B8]">Lock codes before publishing</span>
                          </div>

                          <div
                            onClick={() => setWizardData({ ...wizardData, codesTiming: 'later' })}
                            className={`p-3 rounded-xl border cursor-pointer transition-all ${
                              wizardData.codesTiming === 'later'
                                ? 'bg-amber-500/20 border-amber-400 text-white'
                                : 'bg-[#07090d] border-[#272a31] text-[#94A3B8]'
                            }`}
                          >
                            <strong className="text-xs block text-white">Option B: Configure Later</strong>
                            <span className="text-[10px] text-[#94A3B8]">Publish with status "To Be Configured"</span>
                          </div>
                        </div>
                      </div>

                      {/* If Configure Now: Draw Mode Selection (Part 4) */}
                      {wizardData.codesTiming === 'create' ? (
                        <div className="space-y-4 p-4 rounded-xl bg-[#07090d] border border-[#272a31]">
                          
                          <div>
                            <label className="block text-xs text-white font-bold mb-2">
                              Draw Mode (Part 4)
                            </label>
                            <div className="grid grid-cols-2 gap-3">
                              <div
                                onClick={() => setWizardData({ ...wizardData, drawMode: 'random' })}
                                className={`p-3 rounded-xl border cursor-pointer transition-all ${
                                  wizardData.drawMode === 'random'
                                    ? 'bg-emerald-500/20 border-emerald-400 text-white'
                                    : 'bg-[#0b0e14] border-[#1f2737] text-[#94A3B8]'
                                }`}
                              >
                                <strong className="text-xs block text-white">Random Draw Mode</strong>
                                <span className="text-[10px] text-[#94A3B8]">Provably Fair cryptographic RNG at draw</span>
                              </div>

                              <div
                                onClick={() => setWizardData({ ...wizardData, drawMode: 'preset' })}
                                className={`p-3 rounded-xl border cursor-pointer transition-all ${
                                  wizardData.drawMode === 'preset'
                                    ? 'bg-purple-500/20 border-purple-400 text-white'
                                    : 'bg-[#0b0e14] border-[#1f2737] text-[#94A3B8]'
                                }`}
                              >
                                <strong className="text-xs block text-white">Preset Mode</strong>
                                <span className="text-[10px] text-[#94A3B8]">Admin manually configures winning digits</span>
                              </div>
                            </div>
                          </div>

                          {/* PART 4 REQUIREMENT: Preset Mode Warning Notice */}
                          {wizardData.drawMode === 'preset' && (
                            <div className="p-3 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-start gap-2 text-xs text-purple-300">
                              <AlertTriangle className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
                              <div>
                                <strong className="block text-white">Admin-Configured Winning Codes (Not Randomly Drawn)</strong>
                                <span className="text-[11px] text-[#94A3B8]">
                                  These codes will be explicitly tracked as administrator-preset and will not be claimed as random RNG outcomes in player audits.
                                </span>
                              </div>
                            </div>
                          )}

                          {/* Single Winner Code Input */}
                          {wizardData.winnerMode === 'single' && wizardData.drawMode === 'preset' && (
                            <div className="space-y-2">
                              <div className="flex items-center justify-between">
                                <label className="text-xs text-amber-300 font-bold">
                                  Winning 4-Digit Combination (0000 - 9999) *
                                </label>
                                <span className="text-[10px] text-[#94A3B8]">Leading zeros supported (e.g. 0047)</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <input
                                  type="text"
                                  maxLength={4}
                                  value={wizardData.winningCodes[0] || ''}
                                  onChange={(e) => {
                                    const val = e.target.value.replace(/\D/g, '').slice(0, 4);
                                    setWizardData({ ...wizardData, winningCodes: [val], presetWinningDigits: val });
                                  }}
                                  placeholder="e.g. 2538"
                                  className="flex-1 bg-[#0b0e14] border border-amber-500/50 rounded-xl px-4 py-2.5 text-center text-white font-mono-numbers font-black text-lg tracking-[8px] outline-none"
                                />
                                <button
                                  type="button"
                                  onClick={() => {
                                    const c = String(Math.floor(Math.random() * 10000)).padStart(4, '0');
                                    setWizardData({ ...wizardData, winningCodes: [c], presetWinningDigits: c });
                                  }}
                                  className="px-3 py-2.5 rounded-xl bg-[#141924] hover:bg-[#1a2130] border border-[#272a31] text-xs font-bold text-amber-400 flex items-center gap-1 cursor-pointer"
                                >
                                  <RefreshCw className="w-3.5 h-3.5" />
                                  <span>RNG</span>
                                </button>
                              </div>
                            </div>
                          )}

                          {/* Multiple Winners Codes Configuration (Part 2.2) */}
                          {wizardData.winnerMode === 'multiple' && (
                            <div className="space-y-3">
                              <div className="flex items-center justify-between">
                                <label className="text-xs text-white font-bold">
                                  Number of Winning Codes (N):
                                </label>
                                <select
                                  value={wizardData.winningCodeCount}
                                  onChange={(e) => {
                                    const count = Math.max(2, parseInt(e.target.value) || 2);
                                    const newCodes = [...wizardData.winningCodes];
                                    while (newCodes.length < count) {
                                      const r = String(Math.floor(Math.random() * 10000)).padStart(4, '0');
                                      if (!newCodes.includes(r)) newCodes.push(r);
                                    }
                                    const trimmedCodes = newCodes.slice(0, count);
                                    const equalShare = parseFloat((100 / count).toFixed(2));
                                    const newDist = Array.from({ length: count }, (_, i) => ({
                                      position: i + 1,
                                      percent: i === count - 1 ? parseFloat((100 - equalShare * (count - 1)).toFixed(2)) : equalShare
                                    }));
                                    setWizardData({
                                      ...wizardData,
                                      winnerCount: count,
                                      winningCodeCount: count,
                                      winningCodes: trimmedCodes,
                                      winnerDistribution: newDist
                                    });
                                  }}
                                  className="bg-[#0b0e14] border border-[#1f2737] rounded-lg px-2.5 py-1 text-xs text-amber-300 font-bold outline-none cursor-pointer"
                                >
                                  {[2, 3, 4, 5, 6, 8, 10].map(n => (
                                    <option key={n} value={n}>{n} Winning Codes</option>
                                  ))}
                                </select>
                              </div>

                              {wizardData.drawMode === 'preset' ? (
                                <div className="space-y-2">
                                  <div className="flex items-center justify-between">
                                    <span className="text-[11px] text-[#94A3B8]">Configure each distinct 4-digit combination:</span>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const randCodes = generateDistinctCodes(wizardData.winningCodeCount);
                                        setWizardData({ ...wizardData, winningCodes: randCodes });
                                      }}
                                      className="text-[10px] text-amber-400 hover:text-amber-300 font-bold cursor-pointer"
                                    >
                                      Generate Random Distinct Codes
                                    </button>
                                  </div>

                                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                    {wizardData.winningCodes.map((code, idx) => (
                                      <div key={idx} className="p-2 rounded-xl bg-[#0b0e14] border border-[#1f2737] space-y-1">
                                        <div className="flex justify-between text-[10px] text-[#94A3B8]">
                                          <span>Winning Code #{idx + 1}</span>
                                          {code.length === 4 && <span className="text-emerald-400 font-bold">✓ 4 digits</span>}
                                        </div>
                                        <input
                                          type="text"
                                          maxLength={4}
                                          value={code}
                                          onChange={(e) => {
                                            const val = e.target.value.replace(/\D/g, '').slice(0, 4);
                                            const updated = [...wizardData.winningCodes];
                                            updated[idx] = val;
                                            setWizardData({ ...wizardData, winningCodes: updated });
                                          }}
                                          placeholder={`e.g. 741${idx}`}
                                          className="w-full bg-[#07090d] border border-[#272a31] rounded-lg px-2.5 py-1.5 text-center font-mono-numbers text-white font-bold text-sm tracking-[4px] outline-none focus:border-amber-400"
                                        />
                                      </div>
                                    ))}
                                  </div>

                                  {/* Duplicate code check error */}
                                  {hasDuplicateCodes(wizardData.winningCodes) && (
                                    <div className="p-2.5 rounded-lg bg-red-500/10 border border-red-500/30 text-red-300 text-xs font-bold flex items-center gap-1.5">
                                      <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                                      <span>All winning codes must be unique! Duplicate combination detected.</span>
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <div className="p-3 rounded-lg bg-[#0b0e14] border border-[#1f2737] text-xs text-[#94A3B8]">
                                  At settlement time, the draw oracle will generate <strong className="text-white">{wizardData.winningCodeCount} distinct 4-digit winning combinations</strong> using Provably Fair cryptographic RNG.
                                </div>
                              )}
                            </div>
                          )}

                        </div>
                      ) : (
                        <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 space-y-2 text-xs text-amber-300">
                          <strong className="block text-white">Winning Codes Status: "To Be Configured"</strong>
                          <p className="text-[#94A3B8]">
                            The event will be published with winning codes unassigned. You can configure winning combinations anytime before ticket sales commence or prior to draw execution via the <strong>Configure Winners</strong> action in the Event Table.
                          </p>
                        </div>
                      )}

                      <div className="flex items-center justify-between pt-4 border-t border-[#1f2737]">
                        <button
                          type="button"
                          onClick={() => setWizardStep(4)}
                          className="px-4 py-2 rounded-xl bg-[#141924] hover:bg-[#1a2130] text-xs font-bold text-[#94A3B8] hover:text-white border border-[#272a31] flex items-center gap-1 cursor-pointer"
                        >
                          <ArrowLeft className="w-3.5 h-3.5" />
                          <span>Back</span>
                        </button>
                        <button
                          type="button"
                          disabled={
                            wizardData.codesTiming === 'create' &&
                            wizardData.drawMode === 'preset' &&
                            (
                              (wizardData.winnerMode === 'single' && (wizardData.winningCodes[0] || '').length !== 4) ||
                              (wizardData.winnerMode === 'multiple' && (
                                wizardData.winningCodes.some(c => c.length !== 4) ||
                                hasDuplicateCodes(wizardData.winningCodes)
                              ))
                            )
                          }
                          onClick={() => setWizardStep(6)}
                          className="px-5 py-2.5 rounded-xl btn-gold text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-md disabled:opacity-50"
                        >
                          <span>Next: Payout Distribution</span>
                          <ArrowRight className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  )}

                  {/* STEP 6: PAYOUT DISTRIBUTION & WINNER SPLIT (PART 5) */}
                  {wizardStep === 6 && (
                    <div className="space-y-4 animate-in fade-in duration-200">
                      <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300">
                        ℹ️ Step 5 configures payout percentage allocation across winning positions. Percentages must sum to exactly 100%.
                      </div>

                      {/* Distributable Pool Percentage */}
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-xs text-[#8b92a2] font-semibold">
                            Winner Payout Pool Share (% of Gross Pool)
                          </label>
                          <strong className="text-amber-400 font-mono-numbers text-sm">
                            {wizardData.winnerPayoutSharePercent}% (Platform Fee: {100 - wizardData.winnerPayoutSharePercent}%)
                          </strong>
                        </div>
                        <input
                          type="range"
                          min="50"
                          max="100"
                          step="1"
                          value={wizardData.winnerPayoutSharePercent}
                          onChange={(e) => setWizardData({ ...wizardData, winnerPayoutSharePercent: parseInt(e.target.value) || 90 })}
                          className="w-full accent-amber-400 cursor-pointer"
                        />
                      </div>

                      {/* Position Rows & Percentage Inputs */}
                      {wizardData.winnerMode === 'multiple' ? (
                        <div className="space-y-4 p-4 rounded-xl bg-[#07090d] border border-[#272a31]">
                          <div className="flex items-center justify-between pb-2 border-b border-[#1f2737]">
                            <span className="text-xs font-bold text-white">Multi-Winner Position Distribution:</span>
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => {
                                  const count = wizardData.winnerDistribution.length;
                                  const eq = parseFloat((100 / count).toFixed(2));
                                  const newDist = Array.from({ length: count }, (_, i) => ({
                                    position: i + 1,
                                    percent: i === count - 1 ? parseFloat((100 - eq * (count - 1)).toFixed(2)) : eq
                                  }));
                                  setWizardData({ ...wizardData, winnerDistribution: newDist });
                                }}
                                className="px-2 py-1 rounded bg-[#141924] hover:bg-[#1a2130] text-[10px] text-amber-400 font-bold border border-[#272a31] cursor-pointer"
                              >
                                Equal Split
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  const count = wizardData.winnerDistribution.length;
                                  if (count === 3) {
                                    setWizardData({
                                      ...wizardData,
                                      winnerDistribution: [
                                        { position: 1, percent: 50 },
                                        { position: 2, percent: 30 },
                                        { position: 3, percent: 20 }
                                      ]
                                    });
                                  } else {
                                    const weights = Array.from({ length: count }, (_, i) => Math.pow(0.65, i));
                                    const total = weights.reduce((a, b) => a + b, 0);
                                    const newDist = weights.map((w, i) => ({
                                      position: i + 1,
                                      percent: parseFloat(((w / total) * 100).toFixed(1))
                                    }));
                                    const sum = newDist.reduce((a, b) => a + b.percent, 0);
                                    if (newDist.length > 0) newDist[0].percent += parseFloat((100 - sum).toFixed(1));
                                    setWizardData({ ...wizardData, winnerDistribution: newDist });
                                  }
                                }}
                                className="px-2 py-1 rounded bg-[#141924] hover:bg-[#1a2130] text-[10px] text-purple-300 font-bold border border-[#272a31] cursor-pointer"
                              >
                                Tiered Ranking
                              </button>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                            {wizardData.winnerDistribution.map((row, idx) => {
                              const grossAmount = wizardData.jackpotMode === 'fixed'
                                ? wizardData.fixedJackpot
                                : wizardData.jackpotSelectionMethod === 'manual'
                                  ? wizardData.selectedJackpotAmount
                                  : wizardData.maxJackpot;
                              const distributable = (grossAmount * wizardData.winnerPayoutSharePercent) / 100;
                              const estPayout = (distributable * (row.percent || 0)) / 100;

                              return (
                                <div key={idx} className="p-2.5 rounded-xl bg-[#0b0e14] border border-[#1f2737] space-y-1">
                                  <div className="flex items-center justify-between text-[11px]">
                                    <span className="font-bold text-amber-300">Position #{row.position}</span>
                                    <span className="text-emerald-400 font-mono-numbers text-[10px]">
                                      ≈ {estPayout.toLocaleString()} USDT
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-1.5">
                                    <input
                                      type="number"
                                      step="0.1"
                                      min="0.1"
                                      max="100"
                                      value={row.percent}
                                      onChange={(e) => {
                                        const val = parseFloat(e.target.value) || 0;
                                        const updated = [...wizardData.winnerDistribution];
                                        updated[idx] = { ...updated[idx], percent: val };
                                        setWizardData({ ...wizardData, winnerDistribution: updated });
                                      }}
                                      className="w-full bg-[#07090d] border border-[#272a31] rounded-lg px-2.5 py-1 text-xs font-mono-numbers text-white outline-none focus:border-amber-400"
                                    />
                                    <span className="text-xs text-[#94A3B8] font-bold">%</span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>

                          {/* Sum Validation Banner */}
                          {(() => {
                            const totalPct = wizardData.winnerDistribution.reduce((a, b) => a + (parseFloat(String(b.percent)) || 0), 0);
                            const isValid = Math.abs(totalPct - 100) < 0.1;
                            return (
                              <div className={`p-3 rounded-xl border flex items-center justify-between text-xs font-mono-numbers ${
                                isValid
                                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                                  : 'bg-red-500/10 border-red-500/30 text-red-300'
                              }`}>
                                <span>Total Payout Allocation: <strong>{totalPct.toFixed(1)}% / 100%</strong></span>
                                <span>{isValid ? '✓ Distribution Valid' : '⚠️ Must sum to exactly 100%'}</span>
                              </div>
                            );
                          })()}
                        </div>
                      ) : (
                        <div className="p-4 rounded-xl bg-[#07090d] border border-[#272a31] space-y-1 text-xs text-[#94A3B8]">
                          <span className="text-white font-bold block">Single Winner Allocation:</span>
                          <p>
                            100% of the distributable winner pool ({wizardData.winnerPayoutSharePercent}% of gross) is awarded to the matching ticket holder.
                          </p>
                        </div>
                      )}

                      <div className="flex items-center justify-between pt-4 border-t border-[#1f2737]">
                        <button
                          type="button"
                          onClick={() => setWizardStep(5)}
                          className="px-4 py-2 rounded-xl bg-[#141924] hover:bg-[#1a2130] text-xs font-bold text-[#94A3B8] hover:text-white border border-[#272a31] flex items-center gap-1 cursor-pointer"
                        >
                          <ArrowLeft className="w-3.5 h-3.5" />
                          <span>Back</span>
                        </button>
                        <button
                          type="button"
                          disabled={
                            wizardData.winnerMode === 'multiple' &&
                            Math.abs(wizardData.winnerDistribution.reduce((a, b) => a + (parseFloat(String(b.percent)) || 0), 0) - 100) >= 0.1
                          }
                          onClick={() => setWizardStep(7)}
                          className="px-5 py-2.5 rounded-xl btn-gold text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-md disabled:opacity-50"
                        >
                          <span>Next: Review &amp; Summary</span>
                          <ArrowRight className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  )}

                  {/* STEP 7: REVIEW CONFIGURATION & SUMMARY (PART 6) */}
                  {wizardStep === 7 && (
                    <div className="space-y-4 animate-in fade-in duration-200">
                      <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-300 flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                        <span>Please review all configuration parameters before deploying this event to the live platform.</span>
                      </div>

                      <div className="p-4 rounded-xl bg-[#07090d] border border-[#272a31] space-y-3 text-xs">
                        
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pb-3 border-b border-[#1f2737]">
                          <div>
                            <span className="text-[#64748B] block text-[11px]">Event Identifier:</span>
                            <strong className="text-amber-400 font-mono-numbers">{wizardData.eventId}</strong>
                          </div>
                          <div>
                            <span className="text-[#64748B] block text-[11px]">Event Name:</span>
                            <strong className="text-white">{wizardData.eventName}</strong>
                          </div>
                          <div>
                            <span className="text-[#64748B] block text-[11px]">Assigned Room:</span>
                            <strong className="text-white">{wizardData.roomName}</strong>
                          </div>
                          <div>
                            <span className="text-[#64748B] block text-[11px]">Duration / Schedule:</span>
                            <strong className="text-white">{wizardData.durationValue} {wizardData.durationUnit}</strong>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pb-3 border-b border-[#1f2737]">
                          <div>
                            <span className="text-[#64748B] block text-[11px]">Ticket Price:</span>
                            <strong className="text-white font-mono-numbers">{wizardData.ticketPrice} USDT</strong>
                          </div>
                          <div>
                            <span className="text-[#64748B] block text-[11px]">Jackpot Determination:</span>
                            <strong className="text-amber-400 font-mono-numbers">
                              {wizardData.jackpotMode === 'fixed'
                                ? `${wizardData.fixedJackpot.toLocaleString()} USDT (Fixed)`
                                : wizardData.jackpotSelectionMethod === 'manual'
                                  ? `${wizardData.selectedJackpotAmount.toLocaleString()} USDT (Manual in ${wizardData.minJackpot}-${wizardData.maxJackpot})`
                                  : `${wizardData.minJackpot.toLocaleString()} - ${wizardData.maxJackpot.toLocaleString()} USDT (Random)`}
                            </strong>
                          </div>
                          <div>
                            <span className="text-[#64748B] block text-[11px]">Ticket Limits:</span>
                            <strong className="text-white">
                              {wizardData.ticketLimitMode === 'unlimited' ? 'Unlimited' : `Max ${wizardData.maxTotalTickets} (User Cap: ${wizardData.maxTicketsPerUser})`}
                            </strong>
                          </div>
                        </div>

                        {/* Winning codes & distribution preview (Part 6) */}
                        <div className="space-y-2 pt-1">
                          <div className="flex items-center justify-between">
                            <span className="text-[#64748B] text-[11px]">Winning Codes Configuration:</span>
                            <strong className="text-purple-300 uppercase">
                              {wizardData.codesTiming === 'later'
                                ? 'Winning Codes: To Be Configured'
                                : wizardData.drawMode === 'preset'
                                  ? 'Preset Winning Combinations'
                                  : 'Provably Fair RNG at Draw'}
                            </strong>
                          </div>

                          {wizardData.codesTiming === 'create' && wizardData.drawMode === 'preset' && (
                            <div className="flex flex-wrap gap-2">
                              {wizardData.winningCodes.map((code, idx) => (
                                <span key={idx} className="px-2.5 py-1 rounded-lg bg-purple-500/20 border border-purple-500/40 text-purple-300 font-mono-numbers font-black text-xs">
                                  Position #{idx + 1}: [{code}]
                                </span>
                              ))}
                            </div>
                          )}

                          {wizardData.codesTiming === 'later' && (
                            <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-bold">
                              ⚠️ Status on Launch: "Winning Codes: To Be Configured"
                            </div>
                          )}
                        </div>

                      </div>

                      <div className="flex items-center justify-between pt-4 border-t border-[#1f2737]">
                        <button
                          type="button"
                          onClick={() => setWizardStep(6)}
                          className="px-4 py-2 rounded-xl bg-[#141924] hover:bg-[#1a2130] text-xs font-bold text-[#94A3B8] hover:text-white border border-[#272a31] flex items-center gap-1 cursor-pointer"
                        >
                          <ArrowLeft className="w-3.5 h-3.5" />
                          <span>Back</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setWizardStep(8)}
                          className="px-5 py-2.5 rounded-xl btn-gold text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-md"
                        >
                          <span>Proceed to Publish</span>
                          <ArrowRight className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  )}

                  {/* STEP 8: DEPLOY & PUBLISH EVENT */}
                  {wizardStep === 8 && (
                    <div className="space-y-5 animate-in fade-in duration-200 text-center py-4">
                      <div className="w-16 h-16 rounded-3xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mx-auto text-amber-400 shadow-[0_0_25px_rgba(245,196,81,0.25)]">
                        <Sparkles className="w-8 h-8" />
                      </div>

                      <div className="space-y-1">
                        <h3 className="font-display font-extrabold text-xl text-white">
                          Ready to Deploy to Live Platform
                        </h3>
                        <p className="text-xs text-[#94A3B8] max-w-md mx-auto">
                          Publishing this event will commit the cryptographic SHA-256 seed to the database and make the room immediately visible in the Four-Digit Lottery lobby.
                        </p>
                      </div>

                      <div className="flex items-center justify-center gap-3 pt-3">
                        <button
                          type="button"
                          onClick={() => setWizardStep(7)}
                          className="px-4 py-2.5 rounded-xl bg-[#141924] hover:bg-[#1a2130] text-xs font-bold text-[#94A3B8] hover:text-white border border-[#272a31] cursor-pointer"
                        >
                          Back to Review
                        </button>
                        <button
                          type="button"
                          disabled={isSubmittingWizard}
                          onClick={async () => {
                            setIsSubmittingWizard(true);
                            try {
                              const res = await directCreateEvent({
                                ...wizardData,
                                title: wizardData.eventName
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
            {/* MODAL 2: EVENT-SPECIFIC WINNER CONFIGURATION MODAL (PART 9)       */}
            {/* ================================================================ */}
            {winnerConfigEvent && (
              <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-150">
                <div className="max-w-2xl w-full bg-[#0d1117] border border-[#272a31] rounded-3xl p-5 sm:p-7 space-y-5 shadow-2xl max-h-[90vh] overflow-y-auto no-scrollbar my-auto">
                  
                  {/* Header */}
                  <div className="flex items-center justify-between pb-3 border-b border-[#1f2737]">
                    <div className="flex items-center gap-2.5">
                      <Trophy className="w-5 h-5 text-amber-400" />
                      <div>
                        <h3 className="font-display font-extrabold text-base text-white">
                          Winner Configuration &amp; Winning Codes
                        </h3>
                        <p className="text-xs text-[#94A3B8]">
                          Event-Specific Configuration linked to Event ID and Room ID
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

                  {/* Target Event Info Card */}
                  <div className="p-3.5 rounded-xl bg-[#07090d] border border-[#272a31] grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs font-mono-numbers">
                    <div>
                      <span className="text-[#64748B] block text-[10px]">Event ID:</span>
                      <strong className="text-amber-400 font-bold">{winnerConfigEvent.id}</strong>
                    </div>
                    <div>
                      <span className="text-[#64748B] block text-[10px]">Room Name:</span>
                      <strong className="text-white font-sans truncate block">{winnerConfigEvent.roomName || 'Room 1'}</strong>
                    </div>
                    <div>
                      <span className="text-[#64748B] block text-[10px]">Event Status:</span>
                      <strong className="text-emerald-400 uppercase">{winnerConfigEvent.status}</strong>
                    </div>
                    <div>
                      <span className="text-[#64748B] block text-[10px]">Tickets Sold:</span>
                      <strong className="text-white font-bold">{winnerConfigEvent.ticketsSold || 0}</strong>
                    </div>
                  </div>

                  {/* Lifecycle Lock Check */}
                  {winnerConfigEvent.status === 'completed' ? (
                    <div className="p-4 rounded-xl bg-purple-500/10 border border-purple-500/30 text-purple-300 text-xs space-y-1">
                      <strong className="block text-white">Event Concluded &amp; Settled</strong>
                      <span>This event is finalized and payouts have been disbursed. Winning codes and payout distributions are permanently immutable.</span>
                    </div>
                  ) : winnerConfigEvent.ticketsSold > 0 && !winnerConfigEvent.isPaused ? (
                    <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs space-y-3">
                      <div className="flex items-start gap-2.5">
                        <Lock className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                        <div>
                          <strong className="block text-white">Configuration Locked (Ticket Sales Active)</strong>
                          <span>Ticket sales have commenced ({winnerConfigEvent.ticketsSold} tickets sold). Modifications are locked to protect player trust and fairness.</span>
                        </div>
                      </div>

                      {!wcShowPauseInput ? (
                        <button
                          type="button"
                          onClick={() => setWcShowPauseInput(true)}
                          className="px-3.5 py-1.5 rounded-xl bg-amber-500 text-black text-xs font-bold cursor-pointer hover:bg-amber-400 transition-colors"
                        >
                          Emergency Pause Event to Edit
                        </button>
                      ) : (
                        <div className="space-y-2 pt-2 border-t border-amber-500/20">
                          <label className="text-[11px] font-bold text-white block">
                            Documented Emergency Pause Reason * (Required for audit log)
                          </label>
                          <textarea
                            rows={2}
                            value={wcEmergencyPauseReason}
                            onChange={(e) => setWcEmergencyPauseReason(e.target.value)}
                            placeholder="State reason for pause (e.g. Critical misconfiguration fix)..."
                            className="w-full bg-[#07090d] border border-amber-500/50 rounded-xl p-2.5 text-xs text-white outline-none"
                          />
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={async () => {
                                if (!wcEmergencyPauseReason.trim()) {
                                  if (showToast) showToast('Please enter an emergency pause reason.', 'error');
                                  return;
                                }
                                setWcSaving(true);
                                try {
                                  const res = await directPauseEvent(winnerConfigEvent.id, true, wcEmergencyPauseReason.trim());
                                  if (res?.success) {
                                    setWinnerConfigEvent((prev: any) => prev ? { ...prev, isPaused: true, pauseReason: wcEmergencyPauseReason.trim(), status: 'paused' } : null);
                                    setWcShowPauseInput(false);
                                  }
                                } finally {
                                  setWcSaving(false);
                                }
                              }}
                              disabled={wcSaving}
                              className="px-3.5 py-1.5 rounded-xl btn-gold text-xs font-bold cursor-pointer"
                            >
                              {wcSaving ? 'Pausing Event...' : 'Confirm Emergency Pause'}
                            </button>
                            <button
                              type="button"
                              onClick={() => setWcShowPauseInput(false)}
                              className="px-3 py-1.5 rounded-xl bg-[#141924] text-xs text-[#94A3B8] hover:text-white border border-[#272a31] cursor-pointer"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    /* EDITABLE FORM WHEN 0 TICKETS SOLD OR PAUSED */
                    <div className="space-y-4">
                      
                      {winnerConfigEvent.isPaused && (
                        <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center justify-between">
                          <span>Event is currently <strong>PAUSED</strong> ({winnerConfigEvent.pauseReason || 'Admin hold'}). You may edit winning codes and distribution.</span>
                        </div>
                      )}

                      {/* Winner Mode Toggle */}
                      <div>
                        <label className="block text-xs text-[#8b92a2] font-semibold mb-1">
                          Winning Mode
                        </label>
                        <div className="grid grid-cols-2 gap-3">
                          <button
                            type="button"
                            onClick={() => {
                              setWcWinnerMode('single');
                              setWcWinnerCount(1);
                              setWcWinningCodes([wcWinningCodes[0] || '2538']);
                              setWcDistribution([{ position: 1, percent: 100 }]);
                            }}
                            className={`p-3 rounded-xl font-bold flex flex-col items-center justify-center transition-all cursor-pointer border ${
                              wcWinnerMode === 'single'
                                ? 'bg-amber-500/20 text-amber-300 border-amber-400 ring-1 ring-amber-400'
                                : 'bg-[#141924] text-[#94A3B8] border-[#272a31]'
                            }`}
                          >
                            <span className="text-xs font-extrabold">Single Winner</span>
                            <span className="text-[10px] text-[#94A3B8]">1 winning code (100% payout)</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setWcWinnerMode('multiple');
                              const count = 3;
                              setWcWinnerCount(count);
                              const codes = ['2538', '7412', '9065'];
                              setWcWinningCodes(codes);
                              setWcDistribution([
                                { position: 1, percent: 50 },
                                { position: 2, percent: 30 },
                                { position: 3, percent: 20 }
                              ]);
                            }}
                            className={`p-3 rounded-xl font-bold flex flex-col items-center justify-center transition-all cursor-pointer border ${
                              wcWinnerMode === 'multiple'
                                ? 'bg-amber-500/20 text-amber-300 border-amber-400 ring-1 ring-amber-400'
                                : 'bg-[#141924] text-[#94A3B8] border-[#272a31]'
                            }`}
                          >
                            <span className="text-xs font-extrabold">Multiple Winners</span>
                            <span className="text-[10px] text-[#94A3B8]">N distinct winning codes</span>
                          </button>
                        </div>
                      </div>

                      {/* Draw Mode Choice */}
                      <div>
                        <label className="block text-xs text-white font-bold mb-1">
                          Result Determination Mode (Part 4)
                        </label>
                        <div className="grid grid-cols-2 gap-3">
                          <button
                            type="button"
                            onClick={() => setWcDrawMode('preset')}
                            className={`p-2.5 rounded-xl border text-xs font-bold cursor-pointer transition-all ${
                              wcDrawMode === 'preset'
                                ? 'bg-purple-500/20 border-purple-400 text-white'
                                : 'bg-[#141924] border-[#272a31] text-[#94A3B8]'
                            }`}
                          >
                            Preset Codes Mode
                          </button>
                          <button
                            type="button"
                            onClick={() => setWcDrawMode('random')}
                            className={`p-2.5 rounded-xl border text-xs font-bold cursor-pointer transition-all ${
                              wcDrawMode === 'random'
                                ? 'bg-emerald-500/20 border-emerald-400 text-white'
                                : 'bg-[#141924] border-[#272a31] text-[#94A3B8]'
                            }`}
                          >
                            Cryptographic RNG Mode
                          </button>
                        </div>
                      </div>

                      {wcDrawMode === 'preset' && (
                        <div className="p-2.5 rounded-xl bg-purple-500/10 border border-purple-500/30 text-purple-300 text-[11px]">
                          <strong>Admin-Configured Winning Codes - Not Randomly Drawn</strong>
                        </div>
                      )}

                      {/* Codes Editor */}
                      {wcWinnerMode === 'single' ? (
                        <div className="space-y-1.5">
                          <label className="text-xs text-white font-bold block">
                            Winning 4-Digit Combination (0000 - 9999) *
                          </label>
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              maxLength={4}
                              value={wcWinningCodes[0] || ''}
                              onChange={(e) => {
                                const val = e.target.value.replace(/\D/g, '').slice(0, 4);
                                setWcWinningCodes([val]);
                              }}
                              placeholder="e.g. 2538"
                              className="flex-1 bg-[#07090d] border border-amber-500/40 rounded-xl px-4 py-2 text-center text-white font-mono-numbers font-black text-base tracking-[6px] outline-none"
                            />
                            <button
                              type="button"
                              onClick={() => setWcWinningCodes([String(Math.floor(Math.random() * 10000)).padStart(4, '0')])}
                              className="px-3 py-2 rounded-xl bg-[#141924] hover:bg-[#1a2130] border border-[#272a31] text-xs font-bold text-amber-400 flex items-center gap-1 cursor-pointer"
                            >
                              <RefreshCw className="w-3.5 h-3.5" />
                              <span>RNG</span>
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <label className="text-xs text-white font-bold">Number of Winning Codes (N):</label>
                            <select
                              value={wcWinnerCount}
                              onChange={(e) => {
                                const count = Math.max(2, parseInt(e.target.value) || 2);
                                setWcWinnerCount(count);
                                const newCodes = [...wcWinningCodes];
                                while (newCodes.length < count) {
                                  const r = String(Math.floor(Math.random() * 10000)).padStart(4, '0');
                                  if (!newCodes.includes(r)) newCodes.push(r);
                                }
                                setWcWinningCodes(newCodes.slice(0, count));
                                const eq = parseFloat((100 / count).toFixed(2));
                                setWcDistribution(Array.from({ length: count }, (_, i) => ({
                                  position: i + 1,
                                  percent: i === count - 1 ? parseFloat((100 - eq * (count - 1)).toFixed(2)) : eq
                                })));
                              }}
                              className="bg-[#0b0e14] border border-[#1f2737] rounded-lg px-2.5 py-1 text-xs text-amber-300 font-bold outline-none cursor-pointer"
                            >
                              {[2, 3, 4, 5, 6, 8, 10].map(n => (
                                <option key={n} value={n}>{n} Codes</option>
                              ))}
                            </select>
                          </div>

                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                            {wcWinningCodes.map((code, idx) => (
                              <div key={idx} className="p-2 rounded-xl bg-[#0b0e14] border border-[#1f2737] space-y-1">
                                <span className="text-[10px] text-[#94A3B8] block">Code #{idx + 1}:</span>
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
                                  className="w-full bg-[#07090d] border border-[#272a31] rounded-lg px-2 py-1 text-center font-mono-numbers text-white font-bold text-xs tracking-[3px] outline-none focus:border-amber-400"
                                />
                              </div>
                            ))}
                          </div>

                          {hasDuplicateCodes(wcWinningCodes) && (
                            <div className="p-2.5 rounded-lg bg-red-500/10 border border-red-500/30 text-red-300 text-xs font-bold">
                              ⚠️ All winning codes must be unique! Duplicate combination detected.
                            </div>
                          )}
                        </div>
                      )}

                      {/* Save Button */}
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
                                drawMode: wcDrawMode,
                                winningCodes: wcWinningCodes,
                                winningCodeCount: wcWinnerMode === 'single' ? 1 : wcWinnerCount,
                                winnerCount: wcWinnerMode === 'single' ? 1 : wcWinnerCount,
                                winnerPayoutSharePercent: wcPayoutSharePercent,
                                winnerDistribution: wcDistribution,
                                codesTiming: 'configured'
                              });
                              if (res?.success) {
                                setWinnerConfigEvent(null);
                                if (lotteryCtx?.refreshEvents) await lotteryCtx.refreshEvents();
                                if (showToast) showToast('Winner configuration updated successfully!', 'success');
                              }
                            } catch (err: any) {
                              if (showToast) showToast('Failed to save config: ' + err.message, 'error');
                            } finally {
                              setWcSaving(false);
                            }
                          }}
                          className="flex-1 py-2.5 rounded-xl btn-gold text-xs font-bold cursor-pointer shadow-md disabled:opacity-50"
                        >
                          {wcSaving ? 'Saving Configuration...' : 'Save Configuration to Database'}
                        </button>

                        {winnerConfigEvent.isPaused && (
                          <button
                            type="button"
                            onClick={async () => {
                              setWcSaving(true);
                              try {
                                await directUpdateWinnerConfig(winnerConfigEvent.id, {
                                  winnerMode: wcWinnerMode,
                                  drawMode: wcDrawMode,
                                  winningCodes: wcWinningCodes,
                                  winningCodeCount: wcWinnerMode === 'single' ? 1 : wcWinnerCount,
                                  winnerCount: wcWinnerMode === 'single' ? 1 : wcWinnerCount,
                                  winnerPayoutSharePercent: wcPayoutSharePercent,
                                  winnerDistribution: wcDistribution,
                                  codesTiming: 'configured'
                                });
                                await directPauseEvent(winnerConfigEvent.id, false, '');
                                setWinnerConfigEvent(null);
                                if (lotteryCtx?.refreshEvents) await lotteryCtx.refreshEvents();
                                if (showToast) showToast('Saved and event resumed to active status!', 'success');
                              } finally {
                                setWcSaving(false);
                              }
                            }}
                            className="px-4 py-2.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 text-xs font-bold cursor-pointer"
                          >
                            Save &amp; Resume Event
                          </button>
                        )}
                      </div>

                    </div>
                  )}

                </div>
              </div>
            )}

            {/* ================================================================ */}
            {/* MODAL 3: CRYPTOGRAPHIC DRAW ORACLE (PART 10)                      */}
            {/* ================================================================ */}
            {drawOracleEvent && (() => {
              const eligibleTickets = allTickets.filter((t: any) => t.eventId === drawOracleEvent.id && t.status === 'active');
              const isConcluded = drawOracleEvent.status === 'completed';
              const grossPool = drawOracleEvent.ticketsSold > 0
                ? (drawOracleEvent.ticketsSold * drawOracleEvent.ticketPrice)
                : (drawOracleEvent.lockedJackpot || drawOracleEvent.poolPrize || 5000);
              const sharePercent = drawOracleEvent.winnerPayoutSharePercent || drawOracleEvent.winnerSharePercent || 90;
              const distributablePool = (grossPool * sharePercent) / 100;
              const currency = drawOracleEvent.currency || 'USDT';

              return (
                <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-150">
                  <div className="max-w-2xl w-full bg-[#0d1117] border border-[#272a31] rounded-3xl p-5 sm:p-7 space-y-5 shadow-2xl max-h-[90vh] overflow-y-auto no-scrollbar my-auto">
                    
                    {/* Header */}
                    <div className="flex items-center justify-between pb-3 border-b border-[#1f2737]">
                      <div className="flex items-center gap-2.5">
                        <Dices className="w-5 h-5 text-emerald-400" />
                        <div>
                          <h3 className="font-display font-extrabold text-base text-white">
                            Cryptographic Draw Settlement Oracle
                          </h3>
                          <p className="text-xs text-[#94A3B8]">
                            Exact-match verification, tie-sharing calculation, and atomic RPC execution
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setDrawOracleEvent(null)}
                        className="p-1.5 rounded-lg text-[#94A3B8] hover:text-white bg-[#141924] border border-[#272a31] cursor-pointer"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Stats summary */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-3 rounded-xl bg-[#07090d] border border-[#272a31] text-xs font-mono-numbers">
                      <div>
                        <span className="text-[#64748B] block text-[10px]">Eligible Tickets:</span>
                        <strong className="text-emerald-400 font-bold">{eligibleTickets.length}</strong>
                      </div>
                      <div>
                        <span className="text-[#64748B] block text-[10px]">Ticket Price:</span>
                        <strong className="text-white">{drawOracleEvent.ticketPrice} {currency}</strong>
                      </div>
                      <div>
                        <span className="text-[#64748B] block text-[10px]">Distributable Pool:</span>
                        <strong className="text-amber-400 font-bold">{distributablePool.toLocaleString()} {currency}</strong>
                      </div>
                      <div>
                        <span className="text-[#64748B] block text-[10px]">Winning Mode:</span>
                        <strong className="text-purple-300 uppercase">{drawOracleEvent.winnerMode}</strong>
                      </div>
                    </div>

                    {isConcluded ? (
                      <div className="p-4 rounded-xl bg-purple-500/10 border border-purple-500/30 text-xs space-y-2 text-purple-300">
                        <strong className="block text-white">Official Draw Outcome Recorded</strong>
                        <div className="flex items-center gap-2">
                          <span>Winning Combination:</span>
                          <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-mono-numbers font-black text-sm">
                            [{drawOracleEvent.winningDigits || drawOracleEvent.drawResultCodes?.join(', ')}]
                          </span>
                        </div>
                        <p className="text-[11px] text-[#94A3B8]">
                          Payouts were disbursed directly to player wallet balances.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        
                        {/* Live Matching Ticket Analysis & Tie-Sharing Breakdown */}
                        <div className="space-y-2.5">
                          <div className="flex items-center justify-between">
                            <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                              <span>Winning Codes &amp; Tie-Sharing Analysis:</span>
                            </h4>
                            <span className="text-[10px] text-[#94A3B8]">Exact 4-digit matches only</span>
                          </div>

                          <div className="space-y-2">
                            {doWinningCodes.map((code, idx) => {
                              const pos = idx + 1;
                              const matches = eligibleTickets.filter((t: any) => String(t.ticketNumber).replace(/\D/g, '').padStart(4, '0') === code);
                              const posShare = drawOracleEvent.winnerDistribution?.[idx]?.percent || (100 / doWinningCodes.length);
                              const posPool = (distributablePool * posShare) / 100;
                              const payoutPerTicket = matches.length > 0 ? (posPool / matches.length) : 0;

                              return (
                                <div key={idx} className="p-3 rounded-xl bg-[#07090d] border border-[#272a31] space-y-2">
                                  <div className="flex items-center justify-between text-xs">
                                    <div className="flex items-center gap-2">
                                      <span className="text-amber-400 font-bold">Position #{pos}</span>
                                      <span className="px-2 py-0.5 rounded bg-purple-500/20 border border-purple-500/30 text-purple-300 font-mono-numbers font-black text-xs tracking-wider">
                                        [{code}]
                                      </span>
                                    </div>
                                    <div className="text-right">
                                      <span className="text-[#94A3B8] text-[10px] block">Position Pool: {posPool.toLocaleString()} {currency} ({posShare}%)</span>
                                      <strong className="text-emerald-400 text-xs">
                                        {matches.length > 0 ? `${payoutPerTicket.toLocaleString()} ${currency} / ticket` : 'Rollover / House Share'}
                                      </strong>
                                    </div>
                                  </div>

                                  <div className="text-[11px] text-[#94A3B8] flex items-center justify-between pt-1 border-t border-[#1f2737]">
                                    <span>Matching Tickets: <strong className="text-white">{matches.length}</strong></span>
                                    {matches.length > 1 && (
                                      <span className="text-amber-300 font-bold">
                                        Tie-sharing active ({posPool.toLocaleString()} ÷ {matches.length} = {payoutPerTicket.toFixed(2)} {currency})
                                      </span>
                                    )}
                                  </div>

                                  {matches.length > 0 && (
                                    <div className="flex flex-wrap gap-1.5 pt-1">
                                      {matches.slice(0, 5).map((m: any) => (
                                        <span key={m.id} className="text-[10px] px-2 py-0.5 rounded bg-[#141924] border border-[#272a31] text-emerald-300 font-mono-numbers">
                                          Ticket #{m.id.slice(-6)} ({m.username || 'User'})
                                        </span>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        {/* Finalize Execution Button */}
                        <div className="pt-2">
                          {!doShowConfirm ? (
                            <button
                              type="button"
                              onClick={() => setDoShowConfirm(true)}
                              className="w-full py-3 rounded-xl btn-gold text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer shadow-lg"
                            >
                              <Dices className="w-4 h-4" />
                              <span>Proceed to Final Draw Confirmation</span>
                            </button>
                          ) : (
                            <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/40 text-center space-y-3">
                              <h4 className="font-bold text-white text-sm">
                                Confirm Atomic Draw Finalization
                              </h4>
                              <p className="text-xs text-[#94A3B8]">
                                Are you sure you want to finalize event <strong className="text-white">[{drawOracleEvent.id}]</strong> with winning codes <strong className="text-amber-400">[{doWinningCodes.join(', ')}]</strong>?
                              </p>
                              <div className="flex items-center gap-2 pt-1">
                                <button
                                  type="button"
                                  onClick={() => setDoShowConfirm(false)}
                                  className="flex-1 py-2 rounded-xl bg-[#141924] text-xs font-bold text-[#94A3B8] hover:text-white border border-[#272a31] cursor-pointer"
                                >
                                  Cancel
                                </button>
                                <button
                                  type="button"
                                  disabled={doIsExecuting}
                                  onClick={async () => {
                                    setDoIsExecuting(true);
                                    try {
                                      const res = await directExecuteDraw(drawOracleEvent.id, doWinningCodes);
                                      if (res?.success) {
                                        setDoShowConfirm(false);
                                        setDrawOracleEvent(null);
                                        if (lotteryCtx?.refreshEvents) await lotteryCtx.refreshEvents();
                                        if (showToast) showToast('🎉 Draw finalized and payouts disbursed atomically!', 'success');
                                      }
                                    } catch (err: any) {
                                      if (showToast) showToast('Failed to execute draw: ' + err.message, 'error');
                                    } finally {
                                      setDoIsExecuting(false);
                                    }
                                  }}
                                  className="flex-1 py-2 rounded-xl btn-gold text-xs font-black uppercase cursor-pointer shadow-md disabled:opacity-50"
                                >
                                  {doIsExecuting ? 'Executing RPC...' : 'Yes, Disburse Payouts'}
                                </button>
                              </div>
                            </div>
                          )}
                        </div>

                      </div>
                    )}

                  </div>
                </div>
              );
            })()}

            {/* ================================================================ */}
            {/* MODAL 4: EVENT DETAILS MODAL                                      */}
            {/* ================================================================ */}
            {viewDetailsEvent && (
              <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-150">
                <div className="max-w-xl w-full bg-[#0d1117] border border-[#272a31] rounded-3xl p-5 sm:p-6 space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto no-scrollbar my-auto text-xs">
                  <div className="flex items-center justify-between pb-3 border-b border-[#1f2737]">
                    <div className="flex items-center gap-2">
                      <Eye className="w-4 h-4 text-amber-400" />
                      <h3 className="font-display font-extrabold text-sm text-white">
                        Event Specifications &amp; Cryptographic Commits
                      </h3>
                    </div>
                    <button
                      type="button"
                      onClick={() => setViewDetailsEvent(null)}
                      className="p-1 rounded-lg text-[#94A3B8] hover:text-white bg-[#141924] border border-[#272a31] cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="p-3 rounded-xl bg-[#07090d] border border-[#272a31] space-y-2">
                    <div className="flex justify-between"><span className="text-[#64748B]">Event Name:</span><strong className="text-white">{viewDetailsEvent.title}</strong></div>
                    <div className="flex justify-between"><span className="text-[#64748B]">Event ID:</span><strong className="text-amber-400 font-mono-numbers">{viewDetailsEvent.id}</strong></div>
                    <div className="flex justify-between"><span className="text-[#64748B]">Designated Room:</span><strong className="text-white">{viewDetailsEvent.roomName}</strong></div>
                    <div className="flex justify-between"><span className="text-[#64748B]">Status:</span><strong className="text-emerald-400 uppercase">{viewDetailsEvent.status}</strong></div>
                    <div className="flex justify-between"><span className="text-[#64748B]">Ticket Price:</span><strong className="text-white">{viewDetailsEvent.ticketPrice} USDT</strong></div>
                    <div className="flex justify-between"><span className="text-[#64748B]">Tickets Sold:</span><strong className="text-white">{viewDetailsEvent.ticketsSold || 0}</strong></div>
                    <div className="flex justify-between"><span className="text-[#64748B]">Jackpot Mode:</span><strong className="text-amber-300 uppercase">{viewDetailsEvent.jackpotMode}</strong></div>
                  </div>

                  <div className="p-3 rounded-xl bg-[#07090d] border border-[#272a31] space-y-1.5">
                    <span className="text-[10px] text-[#64748B] block uppercase font-bold">Provably Fair SHA-256 Commit:</span>
                    <span className="text-[10px] font-mono-numbers text-amber-300 break-all block bg-[#141924] p-2 rounded-lg border border-[#272a31]">
                      {viewDetailsEvent.sha256Seed || 'Cryptographically committed at genesis'}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => setViewDetailsEvent(null)}
                    className="w-full py-2 rounded-xl bg-[#141924] text-xs font-bold text-white border border-[#272a31] cursor-pointer"
                  >
                    Close Details
                  </button>
                </div>
              </div>
            )}

            {/* ================================================================ */}
            {/* MODAL 5: VIEW PAYOUTS MODAL                                       */}
            {/* ================================================================ */}
            {viewPayoutsEvent && (() => {
              const eventPayouts = allPayouts.filter((p: any) => p.eventId === viewPayoutsEvent.id);
              return (
                <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-150">
                  <div className="max-w-2xl w-full bg-[#0d1117] border border-[#272a31] rounded-3xl p-5 sm:p-6 space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto no-scrollbar my-auto">
                    <div className="flex items-center justify-between pb-3 border-b border-[#1f2737]">
                      <div className="flex items-center gap-2">
                        <Coins className="w-4 h-4 text-purple-400" />
                        <h3 className="font-display font-extrabold text-sm text-white">
                          Disbursed Winner Payouts · [{viewPayoutsEvent.id}]
                        </h3>
                      </div>
                      <button
                        type="button"
                        onClick={() => setViewPayoutsEvent(null)}
                        className="p-1 rounded-lg text-[#94A3B8] hover:text-white bg-[#141924] border border-[#272a31] cursor-pointer"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    {eventPayouts.length === 0 ? (
                      <div className="p-8 text-center text-xs text-[#94A3B8]">
                        No winner payouts recorded for this event yet.
                      </div>
                    ) : (
                      <div className="overflow-x-auto no-scrollbar">
                        <table className="w-full text-left text-xs font-mono-numbers">
                          <thead className="bg-[#07090d] text-[10px] text-[#64748B] uppercase border-b border-[#1f2737]">
                            <tr>
                              <th className="py-2 px-2.5">Ticket ID</th>
                              <th className="py-2 px-2.5">Winner</th>
                              <th className="py-2 px-2.5">Winning Digits</th>
                              <th className="py-2 px-2.5">Amount</th>
                              <th className="py-2 px-2.5">Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[#1f2737]/60">
                            {eventPayouts.map((p: any) => (
                              <tr key={p.id} className="hover:bg-[#141924]">
                                <td className="py-2 px-2.5 text-amber-400 font-bold">{p.ticketId || p.id}</td>
                                <td className="py-2 px-2.5 text-white font-sans">{p.winnerUsername || p.winnerAddress || 'Winner'}</td>
                                <td className="py-2 px-2.5 text-emerald-400 font-bold">[{p.winningDigits}]</td>
                                <td className="py-2 px-2.5 text-emerald-400 font-bold">+{p.payoutAmount} USDT</td>
                                <td className="py-2 px-2.5 uppercase text-[10px] text-purple-300">{p.status}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={() => setViewPayoutsEvent(null)}
                      className="w-full py-2 rounded-xl bg-[#141924] text-xs font-bold text-white border border-[#272a31] cursor-pointer"
                    >
                      Close Payouts
                    </button>
                  </div>
                </div>
              );
            })()}

            {/* ================================================================ */}
            {/* MODAL 6: EDIT EVENT MODAL                                         */}
            {/* ================================================================ */}
            {editEventTarget && (
              <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-150">
                <div className="max-w-md w-full bg-[#0d1117] border border-[#272a31] rounded-3xl p-5 sm:p-6 space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto no-scrollbar my-auto text-xs">
                  <div className="flex items-center justify-between pb-3 border-b border-[#1f2737]">
                    <div className="flex items-center gap-2">
                      <Edit3 className="w-4 h-4 text-amber-400" />
                      <h3 className="font-display font-extrabold text-sm text-white">
                        Edit Event Parameters · [{editEventTarget.id}]
                      </h3>
                    </div>
                    <button
                      type="button"
                      onClick={() => setEditEventTarget(null)}
                      className="p-1 rounded-lg text-[#94A3B8] hover:text-white bg-[#141924] border border-[#272a31] cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <form
                    onSubmit={async (e) => {
                      e.preventDefault();
                      const form = e.target as any;
                      const title = form.eventTitle.value;
                      const roomName = form.roomName.value;
                      const badge = form.eventBadge.value;
                      const desc = form.roomDescription.value;

                      try {
                        const res = await directUpdateEvent(editEventTarget.id, {
                          title,
                          room_name: roomName,
                          badge,
                          room_description: desc
                        });
                        if (res?.success) {
                          setEditEventTarget(null);
                        }
                      } catch (err: any) {
                        if (showToast) showToast('Failed to update: ' + err.message, 'error');
                      }
                    }}
                    className="space-y-3"
                  >
                    <div>
                      <label className="text-[11px] font-bold text-[#8b92a2] block mb-1">Event Title *</label>
                      <input
                        type="text"
                        name="eventTitle"
                        defaultValue={editEventTarget.title}
                        className="w-full bg-[#07090d] border border-[#272a31] rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-amber-400"
                        required
                      />
                    </div>

                    <div>
                      <label className="text-[11px] font-bold text-[#8b92a2] block mb-1">Room Name *</label>
                      <input
                        type="text"
                        name="roomName"
                        defaultValue={editEventTarget.roomName}
                        className="w-full bg-[#07090d] border border-[#272a31] rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-amber-400"
                        required
                      />
                    </div>

                    <div>
                      <label className="text-[11px] font-bold text-[#8b92a2] block mb-1">Badge Tag</label>
                      <input
                        type="text"
                        name="eventBadge"
                        defaultValue={editEventTarget.badge}
                        className="w-full bg-[#07090d] border border-[#272a31] rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-amber-400"
                      />
                    </div>

                    <div>
                      <label className="text-[11px] font-bold text-[#8b92a2] block mb-1">Room Description</label>
                      <textarea
                        name="roomDescription"
                        rows={2}
                        defaultValue={editEventTarget.roomDescription}
                        className="w-full bg-[#07090d] border border-[#272a31] rounded-xl p-2.5 text-xs text-white outline-none focus:border-amber-400"
                      />
                    </div>

                    <div className="flex gap-2 pt-2">
                      <button
                        type="button"
                        onClick={() => setEditEventTarget(null)}
                        className="flex-1 py-2 rounded-xl bg-[#141924] text-xs font-bold text-[#94A3B8] hover:text-white border border-[#272a31] cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="flex-1 py-2 rounded-xl btn-gold text-xs font-bold cursor-pointer shadow-md"
                      >
                        Save Changes
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {/* ================================================================ */}
            {/* MODAL 7: EMERGENCY PAUSE REASON PROMPT MODAL                     */}
            {/* ================================================================ */}
            {pauseReasonModal && (
              <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150">
                <div className="max-w-md w-full bg-[#0d1117] border border-amber-500/40 rounded-3xl p-5 sm:p-6 space-y-4 shadow-2xl text-xs">
                  <div className="flex items-center gap-2">
                    <Pause className="w-5 h-5 text-amber-400" />
                    <h3 className="font-display font-extrabold text-sm text-white">
                      Document Emergency Pause Reason
                    </h3>
                  </div>

                  <p className="text-[#94A3B8]">
                    Pausing event <strong className="text-white">[{pauseReasonModal.event.id}]</strong> will immediately halt ticket sales in the User Panel. A documented reason is required for administrative audit logs.
                  </p>

                  <textarea
                    rows={3}
                    value={pauseReasonModal.reason}
                    onChange={(e) => setPauseReasonModal({ ...pauseReasonModal, reason: e.target.value })}
                    placeholder="Enter reason for emergency hold (e.g. Schedule readjustment, prize tier verification)..."
                    className="w-full bg-[#07090d] border border-amber-500/40 rounded-xl p-2.5 text-xs text-white outline-none"
                  />

                  <div className="flex gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setPauseReasonModal(null)}
                      className="flex-1 py-2 rounded-xl bg-[#141924] text-xs font-bold text-[#94A3B8] hover:text-white border border-[#272a31] cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      disabled={!pauseReasonModal.reason.trim()}
                      onClick={async () => {
                        await directPauseEvent(pauseReasonModal.event.id, true, pauseReasonModal.reason.trim());
                        setPauseReasonModal(null);
                      }}
                      className="flex-1 py-2 rounded-xl btn-gold text-xs font-bold cursor-pointer shadow-md disabled:opacity-50"
                    >
                      Confirm Pause
                    </button>
                  </div>
                </div>
              </div>
            )}

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

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {gameRooms.map((room) => (
                  <div
                    key={room.id}
                    className="p-4 rounded-2xl bg-[#0d1117] border border-[#272a31] space-y-3 shadow-md"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono-numbers px-2 py-0.5 rounded bg-[#141924] text-amber-300 border border-[#272a31] font-bold uppercase">
                        {room.room_type || room.type || 'STANDARD'} ROOM
                      </span>
                      <span className="text-[10px] font-mono-numbers text-emerald-400 font-bold">
                        ● ACTIVE
                      </span>
                    </div>

                    <div>
                      <h4 className="font-bold text-sm text-white">
                        {room.room_name || room.name}
                      </h4>
                      <p className="text-xs text-[#94A3B8] mt-0.5">
                        {room.description}
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-2 p-2 rounded-xl bg-[#07090d] border border-[#1f2737] text-xs font-mono-numbers">
                      <div>
                        <span className="text-[9px] text-[#8b92a2] block">Limits:</span>
                        <strong className="text-white">{room.min_stake_fc || room.minStakeFC}-{room.max_stake_fc || room.maxStakeFC} USDT</strong>
                      </div>
                      <div>
                        <span className="text-[9px] text-[#8b92a2] block">Capacity:</span>
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

              <div className="overflow-x-auto no-scrollbar">
                <table className="w-full min-w-[650px] text-left text-xs">
                  <thead className="bg-[#07090d] text-[#8b92a2] uppercase text-[10px] tracking-wider border-b border-[#1f2737]">
                    <tr>
                      <th className="py-2.5 px-3">Round ID</th>
                      <th className="py-2.5 px-3">User / Player</th>
                      <th className="py-2.5 px-3">Stake (USDT)</th>
                      <th className="py-2.5 px-3">Multiplier</th>
                      <th className="py-2.5 px-3">Payout (USDT)</th>
                      <th className="py-2.5 px-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1f2737]">
                    {gameRounds.filter(r => r.game_id === activeGame.id).slice(0, 10).map((r: any) => (
                      <tr key={r.id} className="hover:bg-white/2">
                        <td className="py-2.5 px-3 font-mono-numbers text-amber-300 font-bold">#{r.id.slice(-6)}</td>
                        <td className="py-2.5 px-3 font-semibold text-white">{r.username || `@${r.wallet_address?.slice(-4)}`}</td>
                        <td className="py-2.5 px-3 font-mono-numbers text-white">{r.bet_amount} USDT</td>
                        <td className="py-2.5 px-3 font-mono-numbers text-blue-300 font-bold">{r.multiplier}x</td>
                        <td className="py-2.5 px-3 font-mono-numbers font-bold text-emerald-400">+{r.payout} USDT</td>
                        <td className="py-2.5 px-3">
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                            SETTLED
                          </span>
                        </td>
                      </tr>
                    ))}
                    {gameRounds.filter(r => r.game_id === activeGame.id).length === 0 && (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-[#64748b]">
                          No recent rounds recorded for {activeGame.name} yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
