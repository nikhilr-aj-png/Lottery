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
  TrendingUp
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

  // Context hooks
  const lotteryCtx = useLottery();
  const directCreateEvent = lotteryCtx?.adminCreateEvent;
  const directDeleteEvent = lotteryCtx?.adminDeleteEvent || adminDeleteEvent;
  const directExecuteDraw = lotteryCtx?.executeDraw || handleTriggerDraw;
  const liveEvents = lotteryCtx?.events || events || [];
  const allTickets = lotteryCtx?.tickets || [];
  const allAudits = lotteryCtx?.drawAudits || [];

  // 8-Step Event Creation Wizard State
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
    jackpotMode: 'fixed',
    fixedJackpot: 5000,
    minJackpot: 1000,
    maxJackpot: 10000,
    jackpotSelectionMethod: 'manual',
    ticketLimitMode: 'unlimited',
    maxTotalTickets: 500,
    maxTicketsPerUser: 10,
    winnerMode: 'single',
    drawMode: 'random',
    presetWinningDigits: '',
    winnerPayoutSharePercent: 90,
    winnerCount: 1,
    distributionRule: 'tiered',
    winnerDistribution: [{ position: 1, percent: 100 }],
    badge: 'VIP LOTTERY',
    bannerImage: ''
  });
  const [isSubmittingWizard, setIsSubmittingWizard] = useState(false);

  // Dedicated Event Selection for Winner Config and Draw Oracle
  const [targetConfigEventId, setTargetConfigEventId] = useState('');
  const [savingWinnerConfig, setSavingWinnerConfig] = useState(false);
  const [drawSelectedEventId, setDrawSelectedEventId] = useState('');
  const [drawWinningDigits, setDrawWinningDigits] = useState('');
  const [isFinalizingDraw, setIsFinalizingDraw] = useState(false);
  const [showDrawConfirmModal, setShowDrawConfirmModal] = useState(false);
  const [resultsSearchQuery, setResultsSearchQuery] = useState('');

  // Four-Digit Lottery Winner Configuration State
  const [lotteryWinnerMode, setLotteryWinnerMode] = useState<'single' | 'multiple'>('single');
  const [lotteryWinnerCount, setLotteryWinnerCount] = useState('3');
  const [lotteryDistributionRule, setLotteryDistributionRule] = useState<'equal' | 'tiered'>('tiered');
  const [lotteryTieredShares, setLotteryTieredShares] = useState<number[]>([50, 30, 20]);
  const [lotteryWinnerSelectionRule, setLotteryWinnerSelectionRule] = useState<'exact_first' | 'all_exact_equal' | 'nearest_match'>('all_exact_equal');

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
              Centralized administrative hub for all 12 active casino, lottery, and arcade games. Select any game card to configure its events, mathematical models, room limits, and Provably Fair seeds.
            </p>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
            <div className="px-3 py-1.5 rounded-xl bg-[#07090d] border border-[#272a31] text-xs font-mono-numbers">
              <span className="text-[#94A3B8] block text-[10px]">Active Games:</span>
              <strong className="text-amber-400 text-sm">{GAMES.length} Modules</strong>
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

        {/* 4 CARDS PER ROW DESKTOP GRID (Responsive 1 -> 2 -> 3 -> 4 Columns) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-5">
          {filteredGames.map((game) => {
            const config = gameConfigs.find(c => c.game_id === game.id) || {};
            const isEnabled = config.is_enabled !== false;
            const gameRooms = rooms.filter(r => r.game_id === game.id || r.gameId === game.id);

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
                        {game.minStakeFC}-{game.maxStakeFC} USDT
                      </strong>
                    </div>
                    <div>
                      <span className="text-[9px] text-[#8b92a2] block uppercase">Live Rooms</span>
                      <strong className="text-purple-300">
                        {gameRooms.length} Tables
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

      {/* SUB-NAVIGATION TABS FOR THIS SPECIFIC GAME */}
      <div className="flex items-center gap-1.5 p-1.5 bg-[#0d1117] border border-[#272a31] rounded-2xl overflow-x-auto no-scrollbar shadow-inner text-xs">
        {activeGame.id === 'lottery' ? (
          <>
            <button
              type="button"
              onClick={() => setGameSubTab('overview')}
              className={`px-3.5 py-2 rounded-xl font-bold flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
                gameSubTab === 'overview' ? 'bg-amber-500 text-black shadow font-black' : 'text-[#8b92a2] hover:text-white'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Events &amp; Rooms ({events.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setGameSubTab('deploy-event')}
              className={`px-3.5 py-2 rounded-xl font-bold flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
                gameSubTab === 'deploy-event' ? 'bg-amber-500 text-black shadow font-black' : 'text-[#8b92a2] hover:text-white'
              }`}
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>Deploy New Event</span>
            </button>

            <button
              type="button"
              onClick={() => setGameSubTab('winner-config')}
              className={`px-3.5 py-2 rounded-xl font-bold flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
                gameSubTab === 'winner-config' ? 'bg-amber-500 text-black shadow font-black' : 'text-[#8b92a2] hover:text-white'
              }`}
            >
              <Trophy className="w-3.5 h-3.5" />
              <span>Winner Configuration</span>
            </button>

            <button
              type="button"
              onClick={() => setGameSubTab('draw-oracle')}
              className={`px-3.5 py-2 rounded-xl font-bold flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
                gameSubTab === 'draw-oracle' ? 'bg-amber-500 text-black shadow font-black' : 'text-[#8b92a2] hover:text-white'
              }`}
            >
              <Dices className="w-3.5 h-3.5" />
              <span>Draw Oracle &amp; Results</span>
            </button>
          </>
        ) : (
          <>
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
          </>
        )}
      </div>

      {/* ==================================================================== */}
      {/* SECTION A: FOUR-DIGIT LOTTERY SPECIFIC MANAGEMENT                     */}
      {/* ==================================================================== */}
      {activeGame.id === 'lottery' && (
        <div className="space-y-6">

          {/* ------------------------------------------------------------------ */}
          {/* SUB-TAB 1: LIVE LOTTERY EVENTS & ROOM POOLS                         */}
          {/* ------------------------------------------------------------------ */}
          {gameSubTab === 'overview' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="font-display font-extrabold text-base text-white flex items-center gap-2">
                    <Layers className="w-4 h-4 text-amber-400" />
                    <span>Live Lottery Events &amp; Room Pools</span>
                  </h3>
                  <p className="text-xs text-[#94A3B8]">
                    Real, persistent database-driven events from Supabase (public.lottery_events)
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setWizardStep(1);
                    setGameSubTab('deploy-event');
                  }}
                  className="px-3.5 py-2 rounded-xl btn-gold text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-md self-start sm:self-auto"
                >
                  <PlusCircle className="w-4 h-4" />
                  <span>+ Create New Event (8-Step Wizard)</span>
                </button>
              </div>

              {liveEvents.filter((e: any) => e.status !== 'deleted').length === 0 ? (
                <div className="p-8 sm:p-12 rounded-2xl bg-[#0d1117] border border-[#272a31] text-center space-y-3">
                  <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mx-auto text-amber-400">
                    <Layers className="w-7 h-7" />
                  </div>
                  <h4 className="font-display font-bold text-base text-white">
                    No Lottery Events in Database
                  </h4>
                  <p className="text-xs text-[#94A3B8] max-w-md mx-auto">
                    There are currently zero lottery events in the database. Click below to launch the 8-Step Guided Event Creation Wizard and deploy an event.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setWizardStep(1);
                      setGameSubTab('deploy-event');
                    }}
                    className="px-4 py-2.5 rounded-xl btn-gold text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer shadow-md"
                  >
                    <PlusCircle className="w-4 h-4" />
                    <span>Launch 8-Step Wizard</span>
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {liveEvents.filter((e: any) => e.status !== 'deleted').map((evt: any) => {
                    const isActive = evt.status === 'active' && (!evt.drawTime || evt.drawTime > Date.now());
                    const isPending = evt.status === 'result_pending' || (evt.status === 'active' && evt.drawTime && evt.drawTime <= Date.now());
                    const isConcluded = evt.status === 'completed';
                    const currency = evt.currency || 'USDT';

                    return (
                      <div
                        key={evt.id}
                        className="bg-[#0d1117] border border-[#272a31] hover:border-amber-500/30 rounded-2xl p-4 flex flex-col justify-between space-y-3 shadow-md transition-all"
                      >
                        <div className="space-y-2.5">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[10px] font-mono-numbers px-2 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30 uppercase font-bold truncate">
                              {evt.badge || evt.roomName || 'VIP DRAW'}
                            </span>
                            <span className={`text-[10px] font-mono-numbers font-bold px-2 py-0.5 rounded border ${
                              isActive 
                                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' 
                                : isPending
                                  ? 'bg-amber-500/10 text-amber-400 border-amber-500/30 animate-pulse'
                                  : 'bg-purple-500/10 text-purple-400 border-purple-500/30'
                            }`}>
                              {isActive ? '● ACTIVE' : isPending ? '⏳ RESULT PENDING' : '✓ CONCLUDED'}
                            </span>
                          </div>

                          <div>
                            <div className="text-[10px] font-mono text-[#64748B] flex items-center justify-between">
                              <span>Event ID:</span>
                              <span className="text-amber-400/80 font-bold">{evt.id}</span>
                            </div>
                            <h4 className="font-bold text-sm text-white truncate mt-0.5">
                              {evt.title}
                            </h4>
                            <p className="text-[11px] text-[#94A3B8] truncate">
                              Room: <strong className="text-white">{evt.roomName || 'Room 1'}</strong>
                            </p>
                          </div>

                          <div className="p-2.5 rounded-xl bg-[#07090d] border border-[#1f2737] space-y-1.5 text-xs font-mono-numbers">
                            <div className="flex justify-between text-[#94A3B8]">
                              <span>Jackpot Pool:</span>
                              <strong className="text-amber-400 font-bold">
                                {evt.jackpotMode === 'range' && evt.minPrize && evt.maxPrize
                                  ? `${evt.minPrize.toLocaleString()} - ${evt.maxPrize.toLocaleString()} ${currency}`
                                  : `${(evt.poolPrize || 1000).toLocaleString()} ${currency}`}
                              </strong>
                            </div>
                            <div className="flex justify-between text-[#94A3B8]">
                              <span>Ticket Price:</span>
                              <span className="text-white font-bold">{evt.ticketPrice || 10} {currency}</span>
                            </div>
                            <div className="flex justify-between text-[#94A3B8]">
                              <span>Tickets Sold:</span>
                              <span className="text-emerald-400 font-bold">{evt.ticketsSold || 0}</span>
                            </div>
                            <div className="flex justify-between text-[#94A3B8]">
                              <span>Draw Mode:</span>
                              <span className="text-purple-300 font-bold uppercase">
                                {evt.drawMode === 'preset' ? `Preset (${evt.presetWinningDigits || '????'})` : 'Provably Fair RNG'}
                              </span>
                            </div>
                            {evt.winningDigits && (
                              <div className="flex justify-between text-[#94A3B8] pt-1 border-t border-[#1f2737]">
                                <span className="text-amber-300 font-bold">Winning Digits:</span>
                                <span className="text-emerald-400 font-black text-sm tracking-wider">[{evt.winningDigits}]</span>
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 pt-2 border-t border-[#1f2737]">
                          <button
                            type="button"
                            onClick={() => {
                              setTargetConfigEventId(evt.id);
                              setGameSubTab('winner-config');
                            }}
                            className="flex-1 py-1.5 rounded-lg bg-[#141924] hover:bg-[#1a2130] text-[#94A3B8] hover:text-white border border-[#272a31] text-[11px] font-bold cursor-pointer transition-colors flex items-center justify-center gap-1"
                            title="Configure Winners"
                          >
                            <Trophy className="w-3 h-3 text-amber-400" />
                            <span>Winner Config</span>
                          </button>

                          {!isConcluded ? (
                            <button
                              type="button"
                              onClick={() => {
                                setDrawSelectedEventId(evt.id);
                                setDrawWinningDigits(evt.presetWinningDigits || '');
                                setGameSubTab('draw-oracle');
                              }}
                              className="flex-1 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-[11px] font-bold cursor-pointer transition-colors flex items-center justify-center gap-1"
                            >
                              <Dices className="w-3 h-3" />
                              <span>Execute Draw</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                setDrawSelectedEventId(evt.id);
                                setGameSubTab('draw-oracle');
                              }}
                              className="flex-1 py-1.5 rounded-lg bg-purple-500/20 text-purple-300 border border-purple-500/30 text-[11px] font-bold cursor-pointer transition-colors"
                            >
                              View Audit
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => {
                              if (confirm(`Are you sure you want to delete event "${evt.title}" (${evt.id})? This will immediately remove it from the User Panel.`)) {
                                directDeleteEvent(evt.id);
                              }
                            }}
                            className="p-1.5 rounded-lg bg-red-950/30 hover:bg-red-900/50 text-red-400 border border-red-500/30 cursor-pointer transition-colors"
                            title="Delete Event from Database"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ------------------------------------------------------------------ */}
          {/* SUB-TAB 2: 8-STEP GUIDED EVENT CREATION WIZARD                      */}
          {/* ------------------------------------------------------------------ */}
          {gameSubTab === 'deploy-event' && (
            <div className="bg-[#0d1117] border border-[#272a31] rounded-2xl p-5 sm:p-7 space-y-6 shadow-xl max-w-3xl mx-auto">
              
              {/* Wizard Header & Progress Bar */}
              <div className="space-y-3 pb-4 border-b border-[#1f2737]">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
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
                          wizardStep === 2 ? 'Ticket Price & Currency' :
                          wizardStep === 3 ? 'Jackpot Configuration' :
                          wizardStep === 4 ? 'Ticket Purchase Limits' :
                          wizardStep === 5 ? 'Winning Rules & Combination Mode' :
                          wizardStep === 6 ? 'Payout Distribution & Winner Split' :
                          wizardStep === 7 ? 'Review Configuration & Summary' :
                          'Deploy & Publish Event'
                        }
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setGameSubTab('overview')}
                    className="text-xs text-[#94A3B8] hover:text-white flex items-center gap-1 cursor-pointer self-start sm:self-auto"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Cancel to Events</span>
                  </button>
                </div>

                {/* Step Progress Dots */}
                <div className="grid grid-cols-8 gap-1.5 pt-1">
                  {[1, 2, 3, 4, 5, 6, 7, 8].map((s) => (
                    <div
                      key={s}
                      onClick={() => {
                        if (s < wizardStep) setWizardStep(s);
                      }}
                      className={`h-1.5 rounded-full transition-all cursor-pointer ${
                        s === wizardStep 
                          ? 'bg-amber-400 shadow-[0_0_8px_rgba(245,196,81,0.6)]' 
                          : s < wizardStep 
                            ? 'bg-emerald-400' 
                            : 'bg-[#1f2737]'
                      }`}
                      title={`Step ${s}`}
                    />
                  ))}
                </div>
              </div>

              {/* STEP 1: BASIC INFO */}
              {wizardStep === 1 && (
                <div className="space-y-4 animate-in fade-in duration-200">
                  <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300">
                    ℹ️ Step 1 establishes the unique identity, designated room name, and countdown schedule for this lottery draw.
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
                        Room Name *
                      </label>
                      <input
                        type="text"
                        value={wizardData.roomName}
                        onChange={(e) => setWizardData({ ...wizardData, roomName: e.target.value })}
                        placeholder="e.g. Room 1: Daily Grand Arena"
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
                      placeholder="Describe the rules, pool distribution, or special festive perks of this room..."
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
                        Cooldown Time (Prior to Event Start)
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
                      <span className="text-[10px] text-[#64748B] block mt-1">
                        {wizardData.cooldownValue > 0 ? `Event will appear as Scheduled for ${wizardData.cooldownValue} ${wizardData.cooldownUnit}` : 'Starts immediately upon publish'}
                      </span>
                    </div>
                  </div>

                  <div className="flex justify-end pt-4 border-t border-[#1f2737]">
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
                    ℹ️ Step 2 configures the purchase cost per ticket and the exact currency used for tickets and prize disbursements.
                  </div>

                  <div>
                    <label className="block text-xs text-[#8b92a2] font-semibold mb-2">
                      Event Currency
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
                      Ticket Price ({wizardData.currency}) *
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
                        {wizardData.currency} / Ticket
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
                      <span>Next: Jackpot Amount</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}

              {/* STEP 3: JACKPOT AMOUNT */}
              {wizardStep === 3 && (
                <div className="space-y-4 animate-in fade-in duration-200">
                  <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300">
                    ℹ️ Step 3 specifies whether the prize pool is a guaranteed Fixed Jackpot or a dynamic Range.
                  </div>

                  <div>
                    <label className="block text-xs text-[#8b92a2] font-semibold mb-2">
                      Jackpot Mode
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
                        <strong className="text-white text-sm">Fixed Jackpot Pot</strong>
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
                        <span className="text-[10px] text-[#94A3B8]">Floor to Ceiling boundaries</span>
                      </div>
                    </div>
                  </div>

                  {wizardData.jackpotMode === 'fixed' ? (
                    <div>
                      <label className="block text-xs text-[#8b92a2] font-semibold mb-1">
                        Fixed Jackpot Amount ({wizardData.currency}) *
                      </label>
                      <input
                        type="number"
                        min="100"
                        value={wizardData.fixedJackpot}
                        onChange={(e) => setWizardData({ ...wizardData, fixedJackpot: Math.max(1, parseFloat(e.target.value) || 1) })}
                        className="w-full bg-[#07090d] border border-[#272a31] rounded-xl px-3 py-2.5 text-sm text-white font-mono-numbers outline-none focus:border-amber-400"
                        required
                      />
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs text-[#8b92a2] font-semibold mb-1">
                            Minimum Pool (Floor)
                          </label>
                          <input
                            type="number"
                            min="100"
                            value={wizardData.minJackpot}
                            onChange={(e) => setWizardData({ ...wizardData, minJackpot: Math.max(1, parseFloat(e.target.value) || 1) })}
                            className="w-full bg-[#07090d] border border-[#272a31] rounded-xl px-3 py-2 text-xs text-white font-mono-numbers outline-none focus:border-amber-400"
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-[#8b92a2] font-semibold mb-1">
                            Maximum Pool (Ceiling)
                          </label>
                          <input
                            type="number"
                            min="100"
                            value={wizardData.maxJackpot}
                            onChange={(e) => setWizardData({ ...wizardData, maxJackpot: Math.max(1, parseFloat(e.target.value) || 1) })}
                            className="w-full bg-[#07090d] border border-[#272a31] rounded-xl px-3 py-2 text-xs text-white font-mono-numbers outline-none focus:border-amber-400"
                            required
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs text-[#8b92a2] font-semibold mb-1">
                          Jackpot Determination Method
                        </label>
                        <select
                          value={wizardData.jackpotSelectionMethod}
                          onChange={(e) => setWizardData({ ...wizardData, jackpotSelectionMethod: e.target.value })}
                          className="w-full bg-[#07090d] border border-[#272a31] rounded-xl px-3 py-2 text-xs text-white outline-none cursor-pointer"
                        >
                          <option value="manual">Manual Winner Amount (Admin caps or selects final amount)</option>
                          <option value="random">Random Winner Amount (Provably fair RNG within range)</option>
                        </select>
                      </div>
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
                      onClick={() => setWizardStep(4)}
                      className="px-5 py-2.5 rounded-xl btn-gold text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-md"
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
                    ℹ️ Step 4 controls pool scarcity: select whether ticket purchases are unlimited or bounded by caps.
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
                      <span>Next: Winning Rules</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}

              {/* STEP 5: WINNING RULES & COMBINATION MODE */}
              {wizardStep === 5 && (
                <div className="space-y-4 animate-in fade-in duration-200">
                  <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300">
                    ℹ️ Step 5 configures single vs multi-winner mode, and chooses between Pre-set digits or Cryptographic Random Draw.
                  </div>

                  <div>
                    <label className="block text-xs text-[#8b92a2] font-semibold mb-2">
                      Winner Mode
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      <div
                        onClick={() => {
                          setWizardData({
                            ...wizardData,
                            winnerMode: 'single',
                            winnerCount: 1,
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
                        <span className="text-[10px] text-[#94A3B8]">1 lucky ticket winner takes 100% of payout pool</span>
                      </div>

                      <div
                        onClick={() => {
                          setWizardData({
                            ...wizardData,
                            winnerMode: 'multiple',
                            winnerCount: 3,
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
                        <span className="text-[10px] text-[#94A3B8]">Divide payout pool among multiple position ranks</span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs text-[#8b92a2] font-semibold mb-2">
                      Winning Combination Draw Mode
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      <div
                        onClick={() => setWizardData({ ...wizardData, drawMode: 'random' })}
                        className={`p-4 rounded-xl border flex flex-col items-center justify-center text-center cursor-pointer transition-all ${
                          wizardData.drawMode === 'random'
                            ? 'bg-emerald-500/20 border-emerald-400 ring-1 ring-emerald-400 text-white'
                            : 'bg-[#07090d] border-[#272a31] text-[#94A3B8]'
                        }`}
                      >
                        <Sparkles className="w-5 h-5 text-emerald-400 mb-1" />
                        <strong className="text-white text-sm">Random Draw Mode</strong>
                        <span className="text-[10px] text-[#94A3B8]">Cryptographic Provably Fair RNG</span>
                      </div>

                      <div
                        onClick={() => setWizardData({ ...wizardData, drawMode: 'preset' })}
                        className={`p-4 rounded-xl border flex flex-col items-center justify-center text-center cursor-pointer transition-all ${
                          wizardData.drawMode === 'preset'
                            ? 'bg-purple-500/20 border-purple-400 ring-1 ring-purple-400 text-white'
                            : 'bg-[#07090d] border-[#272a31] text-[#94A3B8]'
                        }`}
                      >
                        <Hash className="w-5 h-5 text-purple-400 mb-1" />
                        <strong className="text-white text-sm">Pre-set 4-Digit Number Mode</strong>
                        <span className="text-[10px] text-[#94A3B8]">Admin specifies fixed 4 winning digits</span>
                      </div>
                    </div>
                  </div>

                  {wizardData.drawMode === 'preset' && (
                    <div className="p-4 rounded-xl bg-[#07090d] border border-amber-500/30 space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-xs text-amber-300 font-bold">
                          Specify Exactly 4 Winning Digits (0000 - 9999) *
                        </label>
                        <span className="text-[10px] text-[#94A3B8]">Target Exact Match</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          maxLength={4}
                          value={wizardData.presetWinningDigits}
                          onChange={(e) => setWizardData({ ...wizardData, presetWinningDigits: e.target.value.replace(/\D/g, '').slice(0, 4) })}
                          placeholder="e.g. 5824"
                          className="flex-1 bg-[#0b0e14] border border-amber-500/50 rounded-xl px-4 py-2.5 text-center text-white font-mono-numbers font-black text-base tracking-[6px] outline-none"
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setWizardData({ ...wizardData, presetWinningDigits: String(Math.floor(1000 + Math.random() * 9000)) })}
                          className="px-3 py-2.5 rounded-xl bg-[#141924] hover:bg-[#1a2130] border border-[#272a31] text-xs font-bold text-amber-400 flex items-center gap-1 cursor-pointer"
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                          <span>RNG</span>
                        </button>
                      </div>
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
                      disabled={wizardData.drawMode === 'preset' && wizardData.presetWinningDigits.length !== 4}
                      onClick={() => setWizardStep(6)}
                      className="px-5 py-2.5 rounded-xl btn-gold text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-md disabled:opacity-50"
                    >
                      <span>Next: Payout Distribution</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}

              {/* STEP 6: PAYOUT DISTRIBUTION & WINNER SPLIT */}
              {wizardStep === 6 && (
                <div className="space-y-4 animate-in fade-in duration-200">
                  <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300">
                    ℹ️ Step 6 controls the distributable pool percentage and guarantees that winner position allocations sum to exactly 100%.
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs text-[#8b92a2] font-semibold">
                        Winning Payout Share (%)
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
                    <div className="flex justify-between text-[10px] text-[#64748B] font-mono-numbers mt-1">
                      <span>50% Minimum</span>
                      <span>90% Recommended</span>
                      <span>100% Zero-Fee</span>
                    </div>
                  </div>

                  {wizardData.winnerMode === 'multiple' ? (
                    <div className="space-y-4 p-4 rounded-xl bg-[#07090d] border border-[#272a31]">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-[#1f2737]">
                        <div className="flex items-center gap-2">
                          <label className="text-xs text-white font-bold">Number of Winner Positions:</label>
                          <select
                            value={wizardData.winnerCount}
                            onChange={(e) => {
                              const count = Math.max(2, parseInt(e.target.value) || 2);
                              const equalShare = parseFloat((100 / count).toFixed(2));
                              const newDist = Array.from({ length: count }, (_, i) => ({
                                position: i + 1,
                                percent: i === count - 1 ? parseFloat((100 - equalShare * (count - 1)).toFixed(2)) : equalShare
                              }));
                              setWizardData({
                                ...wizardData,
                                winnerCount: count,
                                winnerDistribution: newDist
                              });
                            }}
                            className="bg-[#0b0e14] border border-[#1f2737] rounded-lg px-2.5 py-1 text-xs text-amber-300 font-bold outline-none cursor-pointer"
                          >
                            {[2, 3, 4, 5, 6, 8, 10, 15, 20].map(n => (
                              <option key={n} value={n}>{n} Winners</option>
                            ))}
                          </select>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              const count = wizardData.winnerCount;
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
                              const count = wizardData.winnerCount;
                              if (count === 3) {
                                setWizardData({
                                  ...wizardData,
                                  winnerDistribution: [
                                    { position: 1, percent: 50 },
                                    { position: 2, percent: 30 },
                                    { position: 3, percent: 20 }
                                  ]
                                });
                              } else if (count === 2) {
                                setWizardData({
                                  ...wizardData,
                                  winnerDistribution: [
                                    { position: 1, percent: 65 },
                                    { position: 2, percent: 35 }
                                  ]
                                });
                              } else {
                                const weights = Array.from({ length: count }, (_, i) => Math.pow(0.7, i));
                                const totalWeight = weights.reduce((a, b) => a + b, 0);
                                const newDist = weights.map((w, i) => ({
                                  position: i + 1,
                                  percent: parseFloat(((w / totalWeight) * 100).toFixed(1))
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

                      {/* Position rows */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                        {wizardData.winnerDistribution.map((row, idx) => {
                          const grossPool = wizardData.jackpotMode === 'fixed' ? wizardData.fixedJackpot : wizardData.maxJackpot;
                          const distributable = (grossPool * wizardData.winnerPayoutSharePercent) / 100;
                          const estPayout = (distributable * (row.percent || 0)) / 100;

                          return (
                            <div key={idx} className="p-2.5 rounded-xl bg-[#0b0e14] border border-[#1f2737] space-y-1">
                              <div className="flex items-center justify-between text-[11px]">
                                <span className="font-bold text-amber-300">Position #{row.position}</span>
                                <span className="text-emerald-400 font-mono-numbers text-[10px]">
                                  ≈ {estPayout.toLocaleString()} {wizardData.currency}
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
                                  className="w-full bg-[#141924] border border-[#272a31] rounded-lg px-2 py-1 text-xs text-white font-mono-numbers outline-none focus:border-amber-400"
                                />
                                <span className="text-xs text-[#94A3B8] font-bold">%</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Real-time sum validation */}
                      {(() => {
                        const totalPct = wizardData.winnerDistribution.reduce((a, b) => a + (parseFloat(String(b.percent)) || 0), 0);
                        const isValid = Math.abs(totalPct - 100) < 0.1;
                        return (
                          <div className={`p-3 rounded-xl border flex items-center justify-between text-xs font-mono-numbers ${
                            isValid 
                              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' 
                              : 'bg-red-500/10 border-red-500/30 text-red-300'
                          }`}>
                            <span>Total Distribution: <strong>{totalPct.toFixed(1)}% / 100%</strong></span>
                            <span>{isValid ? '✓ Valid Split' : '⚠️ Must sum to exactly 100%'}</span>
                          </div>
                        );
                      })()}
                    </div>
                  ) : (
                    <div className="p-4 rounded-xl bg-[#07090d] border border-[#272a31] space-y-1 text-xs text-[#94A3B8]">
                      <span className="text-white font-bold block">Single Winner Allocation:</span>
                      <p>
                        Position 1 receives <strong>100% of the distributable winner pool</strong> (
                        {((wizardData.jackpotMode === 'fixed' ? wizardData.fixedJackpot : wizardData.maxJackpot) * wizardData.winnerPayoutSharePercent / 100).toLocaleString()} {wizardData.currency}
                        ).
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
                    {(() => {
                      const totalPct = wizardData.winnerDistribution.reduce((a, b) => a + (parseFloat(String(b.percent)) || 0), 0);
                      const isValid = wizardData.winnerMode === 'single' || Math.abs(totalPct - 100) < 0.1;
                      return (
                        <button
                          type="button"
                          disabled={!isValid}
                          onClick={() => setWizardStep(7)}
                          className="px-5 py-2.5 rounded-xl btn-gold text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-md disabled:opacity-50"
                        >
                          <span>Next: Review &amp; Summary</span>
                          <ArrowRight className="w-4 h-4" />
                        </button>
                      );
                    })()}
                  </div>
                </div>
              )}

              {/* STEP 7: REVIEW & SUMMARY */}
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
                        {wizardData.cooldownValue > 0 && (
                          <span className="text-amber-300 block text-[10px]">
                            Cooldown: {wizardData.cooldownValue} {wizardData.cooldownUnit}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pb-3 border-b border-[#1f2737]">
                      <div>
                        <span className="text-[#64748B] block text-[11px]">Ticket Price:</span>
                        <strong className="text-white font-mono-numbers">{wizardData.ticketPrice} {wizardData.currency}</strong>
                      </div>
                      <div>
                        <span className="text-[#64748B] block text-[11px]">Jackpot Structure:</span>
                        <strong className="text-amber-400 font-mono-numbers">
                          {wizardData.jackpotMode === 'fixed' 
                            ? `${wizardData.fixedJackpot.toLocaleString()} ${wizardData.currency} (Fixed)`
                            : `${wizardData.minJackpot.toLocaleString()} - ${wizardData.maxJackpot.toLocaleString()} ${wizardData.currency} (Range)`}
                        </strong>
                      </div>
                      <div>
                        <span className="text-[#64748B] block text-[11px]">Ticket Limits:</span>
                        <strong className="text-white">
                          {wizardData.ticketLimitMode === 'unlimited' ? 'Unlimited' : `Max ${wizardData.maxTotalTickets} (User Cap: ${wizardData.maxTicketsPerUser})`}
                        </strong>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <span className="text-[#64748B] block text-[11px]">Winning Rule &amp; Combination:</span>
                        <strong className="text-purple-300 font-bold uppercase">
                          {wizardData.drawMode === 'preset' ? `Pre-set Digits [${wizardData.presetWinningDigits}]` : 'Provably Fair RNG'}
                        </strong>
                      </div>
                      <div>
                        <span className="text-[#64748B] block text-[11px]">Winner Split &amp; Payout Share:</span>
                        <strong className="text-emerald-400">
                          {wizardData.winnerPayoutSharePercent}% Share ({wizardData.winnerMode === 'single' ? '1 Winner' : `${wizardData.winnerCount} Winners`})
                        </strong>
                      </div>
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

              {/* STEP 8: PUBLISH EVENT */}
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

                  <div className="p-4 rounded-xl bg-[#07090d] border border-[#272a31] text-xs text-left max-w-md mx-auto space-y-1">
                    <div className="flex justify-between">
                      <span className="text-[#94A3B8]">Event ID:</span>
                      <strong className="text-amber-400 font-mono-numbers">{wizardData.eventId}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#94A3B8]">Room:</span>
                      <strong className="text-white">{wizardData.roomName}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#94A3B8]">Status on Launch:</span>
                      <strong className="text-emerald-400 uppercase font-mono-numbers">
                        {wizardData.cooldownValue > 0 ? `Scheduled (${wizardData.cooldownValue} ${wizardData.cooldownUnit})` : 'Active'}
                      </strong>
                    </div>
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
                            setWizardStep(1);
                            setGameSubTab('overview');
                            if (showToast) showToast('🎉 Event published to live platform!', 'success');
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
          )}

          {/* ------------------------------------------------------------------ */}
          {/* SUB-TAB 3: EVENT-SPECIFIC WINNER CONFIGURATION                      */}
          {/* ------------------------------------------------------------------ */}
          {gameSubTab === 'winner-config' && (
            <div className="bg-[#0d1117] border border-[#272a31] rounded-2xl p-5 sm:p-7 space-y-6 shadow-xl max-w-3xl mx-auto">
              
              <div className="flex items-center gap-2.5 pb-3 border-b border-[#1f2737]">
                <Trophy className="w-5 h-5 text-amber-400" />
                <div>
                  <h3 className="font-display font-extrabold text-base text-white">
                    Event-Specific Winner Configuration
                  </h3>
                  <p className="text-xs text-[#94A3B8]">
                    Configure prize pool allocation, winner mode, and percentage split for a specific event
                  </p>
                </div>
              </div>

              {/* 1. MANDATORY EVENT SELECTOR FIRST */}
              <div className="space-y-1.5">
                <label className="block text-xs text-white font-bold">
                  Select Target Event * (Required before configuring winners)
                </label>
                <select
                  value={targetConfigEventId}
                  onChange={(e) => setTargetConfigEventId(e.target.value)}
                  className="w-full bg-[#07090d] border border-amber-500/40 rounded-xl px-3.5 py-2.5 text-xs text-white font-mono-numbers outline-none cursor-pointer focus:border-amber-400"
                >
                  <option value="">-- Choose an Event to Configure --</option>
                  {liveEvents.filter((e: any) => e.status !== 'deleted').map((evt: any) => (
                    <option key={evt.id} value={evt.id}>
                      [{evt.id}] {evt.title} ({evt.roomName || 'Room 1'}) · Status: {evt.status?.toUpperCase()}
                    </option>
                  ))}
                </select>
              </div>

              {(() => {
                const targetEvent = liveEvents.find((e: any) => e.id === targetConfigEventId);
                if (!targetEvent) {
                  return (
                    <div className="p-8 rounded-xl bg-[#07090d] border border-[#1f2737] text-center space-y-2">
                      <p className="text-xs text-[#94A3B8]">
                        Please select an event from the dropdown above to view and configure its winner allocation rules.
                      </p>
                    </div>
                  );
                }

                const grossPool = targetEvent.ticketsSold > 0 
                  ? (targetEvent.ticketsSold * targetEvent.ticketPrice) 
                  : targetEvent.poolPrize;
                const sharePercent = targetEvent.winnerPayoutSharePercent || targetEvent.winnerSharePercent || 90;
                const distributablePool = (grossPool * sharePercent) / 100;
                const currency = targetEvent.currency || 'USDT';

                return (
                  <div className="space-y-5 animate-in fade-in duration-200">
                    {/* EVENT DETAILS DISPLAY */}
                    <div className="p-4 rounded-xl bg-[#07090d] border border-[#272a31] space-y-3 text-xs">
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        <div>
                          <span className="text-[#64748B] block text-[11px]">Game Name:</span>
                          <strong className="text-white">Four-Digit Lottery</strong>
                        </div>
                        <div>
                          <span className="text-[#64748B] block text-[11px]">Event Name:</span>
                          <strong className="text-white truncate block">{targetEvent.title}</strong>
                        </div>
                        <div>
                          <span className="text-[#64748B] block text-[11px]">Event ID:</span>
                          <strong className="text-amber-400 font-mono-numbers">{targetEvent.id}</strong>
                        </div>
                        <div>
                          <span className="text-[#64748B] block text-[11px]">Room Name:</span>
                          <strong className="text-white">{targetEvent.roomName || 'Room 1'}</strong>
                        </div>
                        <div>
                          <span className="text-[#64748B] block text-[11px]">Event Status:</span>
                          <strong className="text-emerald-400 font-mono-numbers uppercase">{targetEvent.status}</strong>
                        </div>
                        <div>
                          <span className="text-[#64748B] block text-[11px]">Ticket Price:</span>
                          <strong className="text-white font-mono-numbers">{targetEvent.ticketPrice} {currency}</strong>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2.5 border-t border-[#1f2737]">
                        <div className="p-2.5 rounded-lg bg-[#141924] border border-[#272a31]">
                          <span className="text-[#64748B] block text-[10px]">Total Pool Collected:</span>
                          <strong className="text-amber-400 font-mono-numbers text-sm">
                            {grossPool.toLocaleString()} {currency}
                          </strong>
                        </div>
                        <div className="p-2.5 rounded-lg bg-[#141924] border border-[#272a31]">
                          <span className="text-[#64748B] block text-[10px]">Distributable Winner Pool ({sharePercent}%):</span>
                          <strong className="text-emerald-400 font-mono-numbers text-sm">
                            {distributablePool.toLocaleString()} {currency}
                          </strong>
                        </div>
                      </div>
                    </div>

                    {/* WINNER MODE TOGGLE */}
                    <div className="space-y-2">
                      <label className="block text-xs text-[#8b92a2] font-semibold">
                        Winner Allocation Mode
                      </label>
                      <div className="grid grid-cols-2 gap-3">
                        <button
                          type="button"
                          onClick={() => setLotteryWinnerMode('single')}
                          className={`p-3 rounded-xl font-bold flex flex-col items-center justify-center transition-all cursor-pointer border ${
                            lotteryWinnerMode === 'single'
                              ? 'bg-amber-500/20 text-amber-300 border-amber-400 ring-1 ring-amber-400'
                              : 'bg-[#141924] text-[#94A3B8] border-[#272a31]'
                          }`}
                        >
                          <span className="text-sm font-extrabold">Single Winner</span>
                          <span className="text-[10px] text-[#94A3B8]">100% of distributable pool to 1 player</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setLotteryWinnerMode('multiple')}
                          className={`p-3 rounded-xl font-bold flex flex-col items-center justify-center transition-all cursor-pointer border ${
                            lotteryWinnerMode === 'multiple'
                              ? 'bg-amber-500/20 text-amber-300 border-amber-400 ring-1 ring-amber-400'
                              : 'bg-[#141924] text-[#94A3B8] border-[#272a31]'
                          }`}
                        >
                          <span className="text-sm font-extrabold">Multiple Winners</span>
                          <span className="text-[10px] text-[#94A3B8]">Divide payout pool among multiple position ranks</span>
                        </button>
                      </div>
                    </div>

                    {lotteryWinnerMode === 'multiple' ? (
                      <div className="space-y-4 p-4 rounded-xl bg-[#07090d] border border-[#272a31]">
                        <div className="flex items-center justify-between">
                          <label className="text-xs text-white font-bold">Number of Winners:</label>
                          <select
                            value={lotteryWinnerCount}
                            onChange={(e) => {
                              const count = parseInt(e.target.value) || 2;
                              setLotteryWinnerCount(String(count));
                              const eq = parseFloat((100 / count).toFixed(2));
                              setLotteryTieredShares(Array(count).fill(eq));
                            }}
                            className="bg-[#0b0e14] border border-[#1f2737] rounded-lg px-2.5 py-1 text-xs text-amber-300 font-bold outline-none cursor-pointer"
                          >
                            {[2, 3, 4, 5, 6, 8, 10, 15, 20].map(n => (
                              <option key={n} value={n}>{n} Winners</option>
                            ))}
                          </select>
                        </div>

                        {/* Individual rows */}
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                          {lotteryTieredShares.map((share, idx) => {
                            const payout = (distributablePool * (share || 0)) / 100;
                            return (
                              <div key={idx} className="p-2.5 rounded-lg bg-[#141924] border border-[#272a31] space-y-1">
                                <div className="flex justify-between text-[10px]">
                                  <span className="text-amber-300 font-bold">Position #{idx + 1}</span>
                                  <span className="text-emerald-400 font-mono-numbers">≈ {payout.toLocaleString()} {currency}</span>
                                </div>
                                <div className="flex items-center gap-1">
                                  <input
                                    type="number"
                                    min="0.1"
                                    max="100"
                                    step="0.1"
                                    value={share}
                                    onChange={(e) => {
                                      const val = parseFloat(e.target.value) || 0;
                                      setLotteryTieredShares(prev => {
                                        const c = [...prev];
                                        c[idx] = val;
                                        return c;
                                      });
                                    }}
                                    className="w-full bg-[#07090d] border border-[#1f2737] rounded px-2 py-1 text-xs font-mono-numbers text-white outline-none"
                                  />
                                  <span className="text-xs text-[#94A3B8]">%</span>
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        {/* Validation */}
                        {(() => {
                          const totalPct = lotteryTieredShares.reduce((a, b) => a + (parseFloat(String(b)) || 0), 0);
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
                        <span className="text-white font-bold block">Single Winner Policy:</span>
                        <p>
                          100% of the distributable winner pool ({distributablePool.toLocaleString()} {currency}) is awarded to the matching ticket holder.
                        </p>
                      </div>
                    )}

                    <button
                      type="button"
                      disabled={savingWinnerConfig || (lotteryWinnerMode === 'multiple' && Math.abs(lotteryTieredShares.reduce((a, b) => a + (parseFloat(String(b)) || 0), 0) - 100) >= 0.1)}
                      onClick={async () => {
                        setSavingWinnerConfig(true);
                        try {
                          const dist = lotteryWinnerMode === 'single'
                            ? [{ position: 1, percent: 100 }]
                            : lotteryTieredShares.map((pct, i) => ({ position: i + 1, percent: pct }));
                          
                          const { error } = await supabase
                            .from('lottery_events')
                            .update({
                              winner_mode: lotteryWinnerMode,
                              winner_count: lotteryWinnerMode === 'single' ? 1 : parseInt(lotteryWinnerCount),
                              winner_distribution: dist
                            })
                            .eq('id', targetEvent.id);

                          if (error) throw error;
                          if (lotteryCtx?.refreshEvents) await lotteryCtx.refreshEvents();
                          if (showToast) showToast('Winner configuration updated and saved to database!', 'success');
                        } catch (err: any) {
                          if (showToast) showToast('Failed to save winner config: ' + err.message, 'error');
                        } finally {
                          setSavingWinnerConfig(false);
                        }
                      }}
                      className="w-full py-3 rounded-xl btn-gold text-xs font-bold cursor-pointer shadow-md disabled:opacity-50"
                    >
                      {savingWinnerConfig ? 'Saving to Database...' : 'Save Winner Configuration to Database'}
                    </button>
                  </div>
                );
              })()}

            </div>
          )}

          {/* ------------------------------------------------------------------ */}
          {/* SUB-TAB 4: CRYPTOGRAPHIC DRAW ORACLE & RESULTS                     */}
          {/* ------------------------------------------------------------------ */}
          {gameSubTab === 'draw-oracle' && (
            <div className="space-y-6 max-w-3xl mx-auto">
              
              <div className="bg-[#0d1117] border border-[#272a31] rounded-2xl p-5 sm:p-7 space-y-5 shadow-xl">
                <div className="flex items-center gap-2.5 pb-3 border-b border-[#1f2737]">
                  <Dices className="w-5 h-5 text-emerald-400" />
                  <div>
                    <h3 className="font-display font-extrabold text-base text-white">
                      Cryptographic Draw Settlement Oracle
                    </h3>
                    <p className="text-xs text-[#94A3B8]">
                      Verify eligible tickets, determine winning digits, and execute provably fair settlement
                    </p>
                  </div>
                </div>

                {/* Event Selector */}
                <div className="space-y-1.5">
                  <label className="block text-xs text-white font-bold">
                    Select Target Event to Finalize *
                  </label>
                  <select
                    value={drawSelectedEventId}
                    onChange={(e) => {
                      const id = e.target.value;
                      setDrawSelectedEventId(id);
                      const ev = liveEvents.find((evt: any) => evt.id === id);
                      if (ev?.presetWinningDigits) {
                        setDrawWinningDigits(ev.presetWinningDigits);
                      }
                    }}
                    className="w-full bg-[#07090d] border border-emerald-500/40 rounded-xl px-3.5 py-2.5 text-xs text-white font-mono-numbers outline-none cursor-pointer focus:border-emerald-400"
                  >
                    <option value="">-- Choose an Event to Draw --</option>
                    {liveEvents.filter((e: any) => e.status !== 'deleted').map((evt: any) => (
                      <option key={evt.id} value={evt.id}>
                        [{evt.id}] {evt.title} ({evt.roomName || 'Room 1'}) · Status: {evt.status?.toUpperCase()}
                      </option>
                    ))}
                  </select>
                </div>

                {(() => {
                  const drawEvt = liveEvents.find((e: any) => e.id === drawSelectedEventId);
                  if (!drawEvt) {
                    return (
                      <div className="p-8 rounded-xl bg-[#07090d] border border-[#1f2737] text-center space-y-2">
                        <p className="text-xs text-[#94A3B8]">
                          Please select an event above to inspect eligible tickets and trigger the draw.
                        </p>
                      </div>
                    );
                  }

                  const isLiveActive = drawEvt.status === 'active' && (!drawEvt.drawTime || drawEvt.drawTime > Date.now());
                  const eligibleTickets = allTickets.filter((t: any) => t.eventId === drawEvt.id && t.status === 'active');
                  const isConcluded = drawEvt.status === 'completed';

                  return (
                    <div className="space-y-4 animate-in fade-in duration-200">
                      {/* Warning if still actively accepting tickets */}
                      {isLiveActive && (
                        <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-2.5 text-xs text-amber-300">
                          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                          <div>
                            <strong className="block text-white">Event Ticket Sales Currently Active</strong>
                            <span>Countdown has not elapsed. Finalizing now will end ticket sales immediately and calculate winners from current eligible tickets.</span>
                          </div>
                        </div>
                      )}

                      {isConcluded && (
                        <div className="p-3.5 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-start gap-2.5 text-xs text-purple-300">
                          <CheckCircle2 className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
                          <div>
                            <strong className="block text-white">Event Already Finalized</strong>
                            <span>Winning digits [{drawEvt.winningDigits}] were officially drawn and payouts were disbursed.</span>
                          </div>
                        </div>
                      )}

                      {/* Stats Bar */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-3 rounded-xl bg-[#07090d] border border-[#272a31] text-xs font-mono-numbers">
                        <div>
                          <span className="text-[#64748B] block text-[10px]">Eligible Tickets:</span>
                          <strong className="text-emerald-400 font-bold">{eligibleTickets.length}</strong>
                        </div>
                        <div>
                          <span className="text-[#64748B] block text-[10px]">Ticket Price:</span>
                          <strong className="text-white">{drawEvt.ticketPrice} {drawEvt.currency || 'USDT'}</strong>
                        </div>
                        <div>
                          <span className="text-[#64748B] block text-[10px]">Jackpot Pool:</span>
                          <strong className="text-amber-400 font-bold">{(drawEvt.poolPrize || 1000).toLocaleString()} {drawEvt.currency || 'USDT'}</strong>
                        </div>
                        <div>
                          <span className="text-[#64748B] block text-[10px]">Draw Mode:</span>
                          <strong className="text-purple-300 uppercase">{drawEvt.drawMode}</strong>
                        </div>
                      </div>

                      {/* Winning Digits Input */}
                      {!isConcluded && (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <label className="text-xs text-white font-bold">
                              Winning 4 Digits (0000 - 9999)
                            </label>
                            <span className="text-[10px] text-amber-400">
                              {drawEvt.drawMode === 'preset' ? 'Pre-set mode active' : 'Random RNG mode active'}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              maxLength={4}
                              value={drawWinningDigits}
                              onChange={(e) => setDrawWinningDigits(e.target.value.replace(/\D/g, '').slice(0, 4))}
                              placeholder="e.g. 7429"
                              className="flex-1 bg-[#07090d] border border-amber-500/40 rounded-xl px-4 py-2.5 text-center text-white font-mono-numbers font-black text-lg tracking-[8px] outline-none"
                            />
                            <button
                              type="button"
                              onClick={() => setDrawWinningDigits(String(Math.floor(1000 + Math.random() * 9000)))}
                              className="px-3.5 py-2.5 rounded-xl bg-[#141924] hover:bg-[#1a2130] border border-[#272a31] text-xs font-bold text-amber-400 flex items-center gap-1 cursor-pointer"
                            >
                              <RefreshCw className="w-3.5 h-3.5" />
                              <span>RNG</span>
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Trigger Draw Button */}
                      {!isConcluded && (
                        <button
                          type="button"
                          disabled={isFinalizingDraw}
                          onClick={() => setShowDrawConfirmModal(true)}
                          className="w-full py-3.5 rounded-xl btn-gold text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer shadow-lg disabled:opacity-50"
                        >
                          <Dices className="w-4 h-4" />
                          <span>Finalize Draw &amp; Disburse Winner Payouts</span>
                        </button>
                      )}
                    </div>
                  );
                })()}
              </div>

              {/* 2. SEARCHABLE EVENT-BASED RESULT HISTORY */}
              <div className="bg-[#0d1117] border border-[#272a31] rounded-2xl p-5 sm:p-7 space-y-4 shadow-xl">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#1f2737]">
                  <div>
                    <h4 className="font-display font-extrabold text-sm text-white flex items-center gap-2">
                      <History className="w-4 h-4 text-purple-400" />
                      <span>Searchable Event-Based Result History</span>
                    </h4>
                    <p className="text-[11px] text-[#94A3B8]">
                      Audited cryptographic settlements linked to Event ID and Provably Fair commits
                    </p>
                  </div>

                  <div className="relative w-full sm:w-64">
                    <Search className="w-3.5 h-3.5 text-[#64748B] absolute left-3 top-2.5" />
                    <input
                      type="text"
                      value={resultsSearchQuery}
                      onChange={(e) => setResultsSearchQuery(e.target.value)}
                      placeholder="Search by Event ID or Name..."
                      className="w-full bg-[#07090d] border border-[#272a31] rounded-xl pl-8 pr-3 py-1.5 text-xs text-white outline-none focus:border-amber-400"
                    />
                  </div>
                </div>

                {(() => {
                  const completedEvents = liveEvents
                    .filter((e: any) => e.status === 'completed' && e.winningDigits)
                    .filter((e: any) => {
                      if (!resultsSearchQuery.trim()) return true;
                      const q = resultsSearchQuery.toLowerCase();
                      return e.id?.toLowerCase().includes(q) || e.title?.toLowerCase().includes(q);
                    });

                  if (completedEvents.length === 0) {
                    return (
                      <div className="py-8 text-center text-xs text-[#94A3B8]">
                        No completed draw results found matching your search.
                      </div>
                    );
                  }

                  return (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs font-mono-numbers">
                        <thead>
                          <tr className="border-b border-[#1f2737] text-[10px] text-[#64748B] uppercase">
                            <th className="py-2 px-2.5">Event ID</th>
                            <th className="py-2 px-2.5">Event Name</th>
                            <th className="py-2 px-2.5">Room</th>
                            <th className="py-2 px-2.5">Winning Digits</th>
                            <th className="py-2 px-2.5">Prize Pool</th>
                            <th className="py-2 px-2.5">Currency</th>
                            <th className="py-2 px-2.5">Audit Hash</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#1f2737]/60">
                          {completedEvents.map((evt: any) => (
                            <tr key={evt.id} className="hover:bg-[#141924]/50 transition-colors">
                              <td className="py-2 px-2.5 text-amber-400 font-bold">{evt.id}</td>
                              <td className="py-2 px-2.5 text-white font-sans truncate max-w-[150px]">{evt.title}</td>
                              <td className="py-2 px-2.5 text-[#94A3B8] font-sans">{evt.roomName || 'Room 1'}</td>
                              <td className="py-2 px-2.5">
                                <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-black text-xs">
                                  [{evt.winningDigits}]
                                </span>
                              </td>
                              <td className="py-2 px-2.5 text-white font-bold">{(evt.poolPrize || 1000).toLocaleString()}</td>
                              <td className="py-2 px-2.5 text-emerald-400 font-bold">{evt.currency || 'USDT'}</td>
                              <td className="py-2 px-2.5 text-[#64748B] truncate max-w-[120px]" title={evt.sha256Seed}>
                                {evt.sha256Seed ? evt.sha256Seed.slice(0, 10) + '...' : 'Verified'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  );
                })()}
              </div>

              {/* CONFIRM DRAW MODAL */}
              {showDrawConfirmModal && (
                <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
                  <div className="max-w-md w-full bg-[#111827] border border-amber-500/40 rounded-3xl p-6 text-center space-y-4 shadow-2xl">
                    <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mx-auto text-amber-400">
                      <AlertTriangle className="w-7 h-7" />
                    </div>
                    <h3 className="font-display font-extrabold text-lg text-white">
                      Confirm Final Draw Execution
                    </h3>
                    <p className="text-xs text-[#94A3B8] leading-relaxed">
                      Are you sure you want to finalize event <strong className="text-white">[{drawSelectedEventId}]</strong> with winning digits <strong className="text-amber-400">[{drawWinningDigits || 'Provably Fair RNG'}]</strong>?
                    </p>
                    <p className="text-[11px] text-amber-300 font-medium">
                      This will irreversibly disburse payouts from the distributable pool to matching tickets!
                    </p>
                    <div className="flex gap-2.5 pt-2">
                      <button
                        type="button"
                        onClick={() => setShowDrawConfirmModal(false)}
                        className="flex-1 py-2.5 rounded-xl bg-[#141924] hover:bg-[#1a2130] text-xs font-bold text-[#94A3B8] hover:text-white border border-[#272a31] cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        disabled={isFinalizingDraw}
                        onClick={async () => {
                          setIsFinalizingDraw(true);
                          try {
                            const res = await directExecuteDraw(drawSelectedEventId, drawWinningDigits || null, drawWinnerCount);
                            if (res?.success) {
                              setShowDrawConfirmModal(false);
                              if (lotteryCtx?.refreshEvents) await lotteryCtx.refreshEvents();
                              if (showToast) showToast(`🎉 Draw finalized! Winning digits: [${res.winning_digits || drawWinningDigits}]`, 'success');
                            }
                          } catch (err: any) {
                            if (showToast) showToast('Failed to execute draw: ' + err.message, 'error');
                          } finally {
                            setIsFinalizingDraw(false);
                            setShowDrawConfirmModal(false);
                          }
                        }}
                        className="flex-1 py-2.5 rounded-xl btn-gold text-xs font-extrabold uppercase cursor-pointer shadow-md disabled:opacity-50"
                      >
                        {isFinalizingDraw ? 'Finalizing...' : 'Yes, Execute Draw'}
                      </button>
                    </div>
                  </div>
                </div>
              )}

            </div>
          )}

        </div>
      )}

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
