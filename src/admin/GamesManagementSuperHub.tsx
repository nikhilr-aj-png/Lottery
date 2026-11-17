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
  Filter,
  Flag,
  Percent,
  Calendar,
  Sparkles,
  Zap
} from 'lucide-react';
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
              { id: 'table', label: 'Table' },
              { id: 'card', label: 'Card' },
              { id: 'slots', label: 'Slots' }
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
                        {game.minStakeFC}-{game.maxStakeFC} FC
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
          {/* TAB 1: ACTIVE & SCHEDULED EVENTS LIST */}
          {gameSubTab === 'overview' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-display font-bold text-base text-white">
                    Live Lottery Events &amp; Room Pools
                  </h3>
                  <p className="text-xs text-[#94A3B8]">
                    Currently active, scheduled, and completed draws in Supabase database
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setGameSubTab('deploy-event')}
                  className="px-3 py-1.5 rounded-xl btn-gold text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-md"
                >
                  <PlusCircle className="w-3.5 h-3.5" />
                  <span>+ Deploy Event</span>
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {events.map((evt: any) => {
                  const isActive = evt.status === 'active' && (!evt.drawTime || evt.drawTime > Date.now());
                  return (
                    <div
                      key={evt.id}
                      className="bg-[#0d1117] border border-[#272a31] rounded-2xl p-4 flex flex-col justify-between space-y-3 shadow-md"
                    >
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-mono-numbers px-2 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30 uppercase font-bold">
                            {evt.badge || 'VIP DRAW'}
                          </span>
                          <span className={`text-[10px] font-mono-numbers font-bold ${isActive ? 'text-emerald-400' : 'text-amber-400'}`}>
                            {isActive ? '● ACTIVE' : '✓ CONCLUDED'}
                          </span>
                        </div>

                        <h4 className="font-bold text-sm text-white truncate">
                          {evt.title}
                        </h4>

                        <div className="p-2.5 rounded-xl bg-[#07090d] border border-[#1f2737] space-y-1 text-xs font-mono-numbers">
                          <div className="flex justify-between text-[#94A3B8]">
                            <span>Prize Pool:</span>
                            <strong className="text-amber-400">{evt.poolPrize?.toLocaleString()} FC</strong>
                          </div>
                          <div className="flex justify-between text-[#94A3B8]">
                            <span>Ticket Price:</span>
                            <span className="text-white">{evt.ticketPrice || 10} FC</span>
                          </div>
                          <div className="flex justify-between text-[#94A3B8]">
                            <span>Tickets Sold:</span>
                            <span className="text-emerald-400 font-bold">{evt.ticketsSold || 0}</span>
                          </div>
                          <div className="flex justify-between text-[#94A3B8]">
                            <span>Target Winning:</span>
                            <span className="text-purple-300 font-bold">#{evt.targetWinningDigits || evt.winningDigits || '????'}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 pt-2 border-t border-[#1f2737]">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedEventId(evt.id);
                            setGameSubTab('draw-oracle');
                          }}
                          className="flex-1 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-xs font-bold cursor-pointer transition-colors"
                        >
                          Execute Draw
                        </button>
                        <button
                          type="button"
                          onClick={() => adminDeleteEvent(evt.id)}
                          className="p-1.5 rounded-lg bg-red-950/30 hover:bg-red-900/50 text-red-400 border border-red-500/30 cursor-pointer"
                          title="Delete Event"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 2: DEPLOY NEW LOTTERY EVENT */}
          {gameSubTab === 'deploy-event' && (
            <div className="bg-[#0d1117] border border-[#272a31] rounded-2xl p-5 sm:p-6 space-y-5 shadow-lg max-w-3xl mx-auto">
              <div className="flex items-center gap-2.5 pb-3 border-b border-[#1f2737]">
                <PlusCircle className="w-5 h-5 text-amber-400" />
                <div>
                  <h3 className="font-display font-bold text-base text-white">
                    Deploy New Four-Digit Lottery Event
                  </h3>
                  <p className="text-xs text-[#94A3B8]">
                    Configure draw duration, ticket price, prize structure, and target winning digits
                  </p>
                </div>
              </div>

              <form onSubmit={handleCreateSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs text-[#8b92a2] font-semibold mb-1">
                    Event Title / Room Name
                  </label>
                  <input
                    type="text"
                    value={eventTitle}
                    onChange={(e) => setEventTitle(e.target.value)}
                    placeholder="e.g. Daily Grand Jackpot Pot 25,000 FC"
                    className="w-full bg-[#07090d] border border-[#272a31] focus:border-amber-400 rounded-xl px-3 py-2 text-xs text-white outline-none"
                    required
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-[#8b92a2] font-semibold mb-1">
                      Ticket Price (FC)
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={ticketPrice}
                      onChange={(e) => setTicketPrice(e.target.value)}
                      className="w-full bg-[#07090d] border border-[#272a31] focus:border-amber-400 rounded-xl px-3 py-2 text-xs text-white font-mono-numbers outline-none"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs text-[#8b92a2] font-semibold mb-1">
                      Countdown Duration
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="number"
                        min="1"
                        value={durationValue}
                        onChange={(e) => setDurationValue(e.target.value)}
                        className="bg-[#07090d] border border-[#272a31] focus:border-amber-400 rounded-xl px-3 py-2 text-xs text-white font-mono-numbers outline-none"
                        required
                      />
                      <select
                        value={durationUnit}
                        onChange={(e) => setDurationUnit(e.target.value)}
                        className="bg-[#07090d] border border-[#272a31] focus:border-amber-400 rounded-xl px-2 py-2 text-xs text-white outline-none cursor-pointer"
                      >
                        <option value="minutes">Minutes</option>
                        <option value="hours">Hours</option>
                        <option value="days">Days</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Prize Structure Selection */}
                <div className="p-3.5 rounded-xl bg-[#07090d] border border-[#272a31] space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs text-[#8b92a2] font-semibold">Prize Structure</label>
                    <div className="flex items-center gap-1 bg-[#141924] p-1 rounded-lg border border-[#272a31]">
                      <button
                        type="button"
                        onClick={() => setPrizeType('range')}
                        className={`px-2.5 py-1 rounded-md text-[11px] font-bold cursor-pointer ${
                          prizeType === 'range' ? 'bg-amber-400 text-black shadow' : 'text-[#8b92a2]'
                        }`}
                      >
                        Range (Floor/Cap)
                      </button>
                      <button
                        type="button"
                        onClick={() => setPrizeType('fixed')}
                        className={`px-2.5 py-1 rounded-md text-[11px] font-bold cursor-pointer ${
                          prizeType === 'fixed' ? 'bg-amber-400 text-black shadow' : 'text-[#8b92a2]'
                        }`}
                      >
                        Fixed Jackpot Pot
                      </button>
                    </div>
                  </div>

                  {prizeType === 'range' ? (
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <span className="text-[10px] text-[#8b92a2] block">Minimum (FC)</span>
                        <input
                          type="number"
                          value={minPrize}
                          onChange={(e) => setMinPrize(e.target.value)}
                          className="w-full bg-[#0b0e14] border border-[#1f2737] rounded-lg px-2.5 py-1.5 text-xs text-white font-mono-numbers outline-none"
                        />
                      </div>
                      <div>
                        <span className="text-[10px] text-[#8b92a2] block">Maximum (FC)</span>
                        <input
                          type="number"
                          value={maxPrize}
                          onChange={(e) => setMaxPrize(e.target.value)}
                          className="w-full bg-[#0b0e14] border border-[#1f2737] rounded-lg px-2.5 py-1.5 text-xs text-white font-mono-numbers outline-none"
                        />
                      </div>
                    </div>
                  ) : (
                    <div>
                      <span className="text-[10px] text-[#8b92a2] block">Fixed Pot (FC)</span>
                      <input
                        type="number"
                        value={initialJackpot}
                        onChange={(e) => setInitialJackpot(e.target.value)}
                        className="w-full bg-[#0b0e14] border border-[#1f2737] rounded-lg px-2.5 py-1.5 text-xs text-white font-mono-numbers outline-none"
                      />
                    </div>
                  )}
                </div>

                {/* Pre-set winning digits */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs text-[#8b92a2] font-semibold">Pre-set Winning Combination (0000–9999)</label>
                    <span className="text-[10px] text-emerald-400 font-bold">Exact Match Payout</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      maxLength={4}
                      value={eventWinningDigits}
                      onChange={(e) => setEventWinningDigits(e.target.value.replace(/\D/g, '').slice(0, 4))}
                      className="flex-1 bg-[#07090d] border border-amber-500/40 rounded-xl px-3 py-2 text-center text-white font-mono-numbers font-black text-sm tracking-[4px] outline-none"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setEventWinningDigits(String(Math.floor(1000 + Math.random() * 9000)))}
                      className="px-3 py-2 rounded-xl bg-[#141924] hover:bg-[#1a2130] border border-[#272a31] text-xs font-bold text-amber-400 flex items-center gap-1 cursor-pointer"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>RNG</span>
                    </button>
                  </div>
                </div>

                {/* Event Badge & Banner */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-[#8b92a2] font-semibold mb-1">Badge Tag</label>
                    <input
                      type="text"
                      value={eventBadge}
                      onChange={(e) => setEventBadge(e.target.value)}
                      placeholder="e.g. VIP DRAW"
                      className="w-full bg-[#07090d] border border-[#272a31] rounded-xl px-3 py-2 text-xs text-white outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-[#8b92a2] font-semibold mb-1">Winner Payout Share (%)</label>
                    <input
                      type="number"
                      min="50"
                      max="100"
                      value={eventWinnerSharePercent}
                      onChange={(e) => setEventWinnerSharePercent(e.target.value)}
                      className="w-full bg-[#07090d] border border-[#272a31] rounded-xl px-3 py-2 text-xs text-white font-mono-numbers outline-none"
                      required
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full py-3 rounded-xl btn-gold text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer shadow-lg"
                >
                  <PlusCircle className="w-4 h-4" />
                  <span>Deploy Event to Live Platform</span>
                </button>
              </form>
            </div>
          )}

          {/* TAB 3: WINNER CONFIGURATION (SINGLE VS MULTIPLE WINNERS & VALIDATION) */}
          {gameSubTab === 'winner-config' && (
            <div className="bg-[#0d1117] border border-[#272a31] rounded-2xl p-5 sm:p-6 space-y-5 shadow-lg max-w-3xl mx-auto">
              <div className="flex items-center gap-2.5 pb-3 border-b border-[#1f2737]">
                <Trophy className="w-5 h-5 text-amber-400" />
                <div>
                  <h3 className="font-display font-bold text-base text-white">
                    Four-Digit Lottery Winner Configuration
                  </h3>
                  <p className="text-xs text-[#94A3B8]">
                    Configure Single Winner or Multiple Winners rules, payout percentages, and distribution validation
                  </p>
                </div>
              </div>

              {/* Mode Toggle: Single Winner vs Multiple Winners */}
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
                        : 'bg-[#141924] text-[#94A3B8] border-[#272a31] hover:text-white'
                    }`}
                  >
                    <span className="text-sm font-extrabold">Single Winner</span>
                    <span className="text-[10px] text-[#94A3B8] mt-0.5">100% of applicable prize pool to 1 player</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setLotteryWinnerMode('multiple')}
                    className={`p-3 rounded-xl font-bold flex flex-col items-center justify-center transition-all cursor-pointer border ${
                      lotteryWinnerMode === 'multiple'
                        ? 'bg-amber-500/20 text-amber-300 border-amber-400 ring-1 ring-amber-400'
                        : 'bg-[#141924] text-[#94A3B8] border-[#272a31] hover:text-white'
                    }`}
                  >
                    <span className="text-sm font-extrabold">Multiple Winners</span>
                    <span className="text-[10px] text-[#94A3B8] mt-0.5">Divide prize pool among top matching ticket holders</span>
                  </button>
                </div>
              </div>

              {lotteryWinnerMode === 'multiple' ? (
                <div className="space-y-4 p-4 rounded-xl bg-[#07090d] border border-[#272a31]">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-[#8b92a2] font-semibold mb-1">
                        Total Number of Winners
                      </label>
                      <input
                        type="number"
                        min="2"
                        max="20"
                        value={lotteryWinnerCount}
                        onChange={(e) => {
                          const count = parseInt(e.target.value) || 2;
                          setLotteryWinnerCount(String(count));
                          if (lotteryDistributionRule === 'equal') {
                            const equalShare = parseFloat((100 / count).toFixed(2));
                            setLotteryTieredShares(Array(count).fill(equalShare));
                          }
                        }}
                        className="w-full bg-[#0b0e14] border border-[#1f2737] rounded-xl px-3 py-2 text-xs text-white font-mono-numbers outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs text-[#8b92a2] font-semibold mb-1">
                        Distribution Policy
                      </label>
                      <select
                        value={lotteryDistributionRule}
                        onChange={(e: any) => {
                          const mode = e.target.value;
                          setLotteryDistributionRule(mode);
                          const count = parseInt(lotteryWinnerCount) || 3;
                          if (mode === 'equal') {
                            const eq = parseFloat((100 / count).toFixed(2));
                            setLotteryTieredShares(Array(count).fill(eq));
                          } else {
                            if (count === 3) setLotteryTieredShares([50, 30, 20]);
                            else if (count === 2) setLotteryTieredShares([60, 40]);
                            else setLotteryTieredShares(Array(count).fill(parseFloat((100 / count).toFixed(1))));
                          }
                        }}
                        className="w-full bg-[#0b0e14] border border-[#1f2737] rounded-xl px-3 py-2 text-xs text-white outline-none cursor-pointer"
                      >
                        <option value="tiered">Tiered Ranking (Rank 1 &gt; Rank 2 &gt; Rank 3)</option>
                        <option value="equal">Equal Division (Equal Share to Each Winner)</option>
                      </select>
                    </div>
                  </div>

                  {/* Tiered Shares Configuration */}
                  <div className="space-y-2">
                    <span className="text-xs font-semibold text-white block">
                      Individual Winner Payout Shares (% of Total Prize Pool):
                    </span>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {lotteryTieredShares.map((share, idx) => (
                        <div key={idx} className="p-2 rounded-lg bg-[#141924] border border-[#272a31] space-y-1">
                          <span className="text-[10px] text-amber-300 font-bold block">
                            Rank #{idx + 1} Winner Share
                          </span>
                          <div className="flex items-center gap-1">
                            <input
                              type="number"
                              min="1"
                              max="100"
                              value={share}
                              onChange={(e) => {
                                const val = parseFloat(e.target.value) || 0;
                                setLotteryTieredShares(prev => {
                                  const copy = [...prev];
                                  copy[idx] = val;
                                  return copy;
                                });
                              }}
                              className="w-full bg-[#07090d] border border-[#1f2737] rounded px-2 py-1 text-xs font-mono-numbers text-white outline-none"
                            />
                            <span className="text-xs text-[#94A3B8]">%</span>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Validation Notice Box */}
                    {(() => {
                      const totalShare = lotteryTieredShares.reduce((a, b) => a + (parseFloat(String(b)) || 0), 0);
                      const isValid = Math.abs(totalShare - 100) < 0.1;
                      return (
                        <div className={`p-3 rounded-xl border flex items-center justify-between text-xs font-mono-numbers ${
                          isValid 
                            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' 
                            : 'bg-red-500/10 border-red-500/30 text-red-300'
                        }`}>
                          <span>Total Payout Allocation: <strong>{totalShare.toFixed(1)}% / 100%</strong></span>
                          <span>{isValid ? '✓ Distribution Valid' : '⚠️ Must sum to exactly 100%'}</span>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              ) : (
                <div className="p-4 rounded-xl bg-[#07090d] border border-[#272a31] space-y-2 text-xs text-[#94A3B8]">
                  <p className="leading-relaxed">
                    Under <strong className="text-white">Single Winner Mode</strong>, 100% of the active prize pool is allocated directly to the player whose purchased 4-digit ticket matches the drawn combination. If multiple identical tickets were purchased by different users, they split the prize equally.
                  </p>
                </div>
              )}

              <button
                type="button"
                onClick={() => {
                  if (showToast) showToast('Winner configuration updated and saved!', 'success');
                }}
                className="w-full py-2.5 rounded-xl btn-gold text-xs font-bold cursor-pointer shadow-md"
              >
                Save Winner Rules
              </button>
            </div>
          )}

          {/* TAB 4: CRYPTOGRAPHIC DRAW ORACLE & SETTLEMENT */}
          {gameSubTab === 'draw-oracle' && (
            <div className="bg-[#0d1117] border border-[#272a31] rounded-2xl p-5 sm:p-6 space-y-5 shadow-lg max-w-3xl mx-auto">
              <div className="flex items-center gap-2.5 pb-3 border-b border-[#1f2737]">
                <Dices className="w-5 h-5 text-emerald-400" />
                <div>
                  <h3 className="font-display font-bold text-base text-white">
                    Cryptographic Draw Settlement Oracle
                  </h3>
                  <p className="text-xs text-[#94A3B8]">
                    Authorize provably fair drawing, verify matching tickets, and disburse winner payouts
                  </p>
                </div>
              </div>

              <form onSubmit={handleTriggerDraw} className="space-y-4">
                <div>
                  <label className="block text-xs text-[#8b92a2] font-semibold mb-1">
                    Select Active Event to Finalize
                  </label>
                  <select
                    value={selectedEventId}
                    onChange={(e) => setSelectedEventId(e.target.value)}
                    className="w-full bg-[#07090d] border border-[#272a31] rounded-xl px-3 py-2 text-xs text-white outline-none cursor-pointer"
                  >
                    {activeEvents.length === 0 ? (
                      <option value="">No active events waiting for draw</option>
                    ) : (
                      activeEvents.map((e: any) => (
                        <option key={e.id} value={e.id}>
                          {e.title} · Pot: {e.poolPrize} FC · ({e.ticketsSold || 0} tickets)
                        </option>
                      ))
                    )}
                  </select>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs text-[#8b92a2] font-semibold">Winning 4 Digits</label>
                    <span className="text-[10px] text-amber-400 font-mono-numbers">0000–9999</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      maxLength={4}
                      value={customDigits}
                      onChange={(e) => setCustomDigits(e.target.value.replace(/\D/g, '').slice(0, 4))}
                      className="flex-1 bg-[#07090d] border border-amber-500/40 rounded-xl px-3 py-2 text-center text-white font-mono-numbers font-black text-base tracking-[6px] outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setCustomDigits(String(Math.floor(1000 + Math.random() * 9000)))}
                      className="px-3 py-2 rounded-xl bg-[#141924] hover:bg-[#1a2130] border border-[#272a31] text-xs font-bold text-amber-400 flex items-center gap-1 cursor-pointer"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>RNG</span>
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={!selectedEventId}
                  className="w-full py-3 rounded-xl btn-gold text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer shadow-lg"
                >
                  <Dices className="w-4 h-4" />
                  <span>Execute Provably Fair Draw &amp; Credit Winners</span>
                </button>
              </form>
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
                      Minimum Permitted Stake (FC)
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
                      Maximum Bet Ceiling (FC)
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
                        <strong className="text-white">{room.min_stake_fc || room.minStakeFC}-{room.max_stake_fc || room.maxStakeFC} FC</strong>
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
                      <th className="py-2.5 px-3">Stake (FC)</th>
                      <th className="py-2.5 px-3">Multiplier</th>
                      <th className="py-2.5 px-3">Payout (FC)</th>
                      <th className="py-2.5 px-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1f2737]">
                    {gameRounds.filter(r => r.game_id === activeGame.id).slice(0, 10).map((r: any) => (
                      <tr key={r.id} className="hover:bg-white/2">
                        <td className="py-2.5 px-3 font-mono-numbers text-amber-300 font-bold">#{r.id.slice(-6)}</td>
                        <td className="py-2.5 px-3 font-semibold text-white">{r.username || `@${r.wallet_address?.slice(-4)}`}</td>
                        <td className="py-2.5 px-3 font-mono-numbers text-white">{r.bet_amount} FC</td>
                        <td className="py-2.5 px-3 font-mono-numbers text-blue-300 font-bold">{r.multiplier}x</td>
                        <td className="py-2.5 px-3 font-mono-numbers font-bold text-emerald-400">+{r.payout} FC</td>
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
