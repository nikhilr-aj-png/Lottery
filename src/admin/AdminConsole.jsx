import React, { useState, useEffect } from 'react';
import { useLottery } from '../context/LotteryContext';
import { 
  ShieldAlert, 
  PlusCircle, 
  Dices, 
  CheckCircle, 
  XCircle, 
  Clock, 
  DollarSign, 
  Layers, 
  Sparkles, 
  LogOut, 
  RefreshCw,
  LayoutDashboard,
  Users,
  Wallet,
  Settings,
  Search,
  UserCheck,
  UserX,
  Trash2,
  Shield,
  ExternalLink,
  Copy,
  Check,
  AlertTriangle,
  ArrowDownLeft,
  ArrowUpRight,
  Flame,
  CheckCircle2,
  Trophy,
  Image,
  Upload,
  Coins,
  Award,
  Edit3,
  MessageSquare,
  Mail,
  Send,
  Inbox,
  AtSign,
  User
} from 'lucide-react';

const SEASONAL_PRESETS = {
  cyberpunk: {
    id: 'cyberpunk',
    name: '⚡ Cyberpunk VIP Draw',
    badge: 'VIP DRAW',
    banner: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=1200&q=80'
  },
  diwali: {
    id: 'diwali',
    name: '🪔 Diwali Bumper Pot',
    badge: '🪔 DIWALI BUMPER',
    banner: 'https://images.unsplash.com/photo-1605371924599-2d0365da1ae0?w=1200&q=80'
  },
  eid: {
    id: 'eid',
    name: '🌙 Eid Mubarak Super Pot',
    badge: '🌙 EID MUBARAK',
    banner: 'https://images.unsplash.com/photo-1564769625905-50e93615e769?w=1200&q=80'
  },
  holi: {
    id: 'holi',
    name: '🎨 Holi Color Splash',
    badge: '🎨 HOLI SPLASH',
    banner: 'https://images.unsplash.com/photo-1576495199011-eb94736d05d6?w=1200&q=80'
  },
  durga_puja: {
    id: 'durga_puja',
    name: '🌺 Durga Puja Utsav',
    badge: '🌺 DURGA UTSAV',
    banner: 'https://images.unsplash.com/photo-1603555501671-8f96b3fce8b5?w=1200&q=80'
  },
  new_year: {
    id: 'new_year',
    name: '🎆 New Year Grand Gala',
    badge: '🎆 NEW YEAR GALA',
    banner: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=1200&q=80'
  },
  custom: {
    id: 'custom',
    name: '🖼️ Custom Upload / External URL',
    badge: 'SPECIAL EVENT',
    banner: ''
  }
};

export default function AdminConsole({ onLogout }) {
  const { 
    user,
    profile,
    events, 
    withdrawals, 
    winnerPayouts = [],
    executeDraw, 
    adminCreateEvent, 
    adminDeleteEvent,
    adminApproveWithdrawal, 
    adminRejectWithdrawal,
    adminApproveWinnerPayout,
    adminRejectWinnerPayout,
    adminAddManualWinnerCredit,
    adminFetchAllUsers,
    adminToggleUserStatus,
    adminUpdateUserRole,
    adminDeleteUser,
    supportTickets = [],
    fetchSupportTickets,
    adminUpdateTicketStatus,
    adminDeleteTicket,
    platformSettings,
    adminUpdatePlatformSettings,
    showToast
  } = useLottery();

  // Navigation tab: 'overview' | 'pools' | 'withdrawals' | 'users' | 'winner-payouts' | 'support' | 'settings'
  const [activeAdminTab, setActiveAdminTab] = useState('overview');

  // Support Inquiries state
  const [supportFilter, setSupportFilter] = useState('all'); // 'all' | 'pending' | 'replied' | 'resolved'
  const [supportSearchQuery, setSupportSearchQuery] = useState('');

  // User management state
  const [usersList, setUsersList] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState('all');

  // Withdrawals filter state
  const [withdrawalFilter, setWithdrawalFilter] = useState('all');

  // Winner Payouts state
  const [payoutFilter, setPayoutFilter] = useState('all');
  const [editedPayoutAmounts, setEditedPayoutAmounts] = useState({});
  const [manualWinnerUser, setManualWinnerUser] = useState('');
  const [manualWinnerAmount, setManualWinnerAmount] = useState('');
  const [manualWinnerNote, setManualWinnerNote] = useState('Special Seasonal Reward');

  // Create event form state
  const [eventTitle, setEventTitle] = useState('Diwali Special Bumper Pot 10 USDT');
  const [ticketPrice, setTicketPrice] = useState('10');
  const [durationValue, setDurationValue] = useState('60');
  const [durationUnit, setDurationUnit] = useState('minutes'); // 'minutes' | 'hours' | 'days'
  const [prizeType, setPrizeType] = useState('range'); // 'range' | 'fixed'
  const [minPrize, setMinPrize] = useState('10');
  const [maxPrize, setMaxPrize] = useState('50');
  const [initialJackpot, setInitialJackpot] = useState('25000');
  const [eventWinningDigits, setEventWinningDigits] = useState('7429');
  const [eventTheme, setEventTheme] = useState('diwali');
  const [eventBannerImage, setEventBannerImage] = useState(SEASONAL_PRESETS.diwali.banner);
  const [eventWinnerSharePercent, setEventWinnerSharePercent] = useState('90');
  const [eventWinnerCount, setEventWinnerCount] = useState('1');

  // Handle seasonal theme change
  const handleThemeChange = (themeKey) => {
    setEventTheme(themeKey);
    if (SEASONAL_PRESETS[themeKey] && themeKey !== 'custom') {
      setEventBannerImage(SEASONAL_PRESETS[themeKey].banner);
    }
  };

  // Handle local banner file upload
  const handleBannerFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (uploadEvt) => {
      setEventBannerImage(uploadEvt.target.result);
      setEventTheme('custom');
      showToast('Custom banner photo loaded successfully!', 'success');
    };
    reader.readAsDataURL(file);
  };

  // Trigger draw custom digit or auto
  const [selectedEventId, setSelectedEventId] = useState(events.find(e => e.status === 'active')?.id || '');
  const [customDigits, setCustomDigits] = useState('7429');
  const [drawWinnerCount, setDrawWinnerCount] = useState('1');

  // Sync customDigits & drawWinnerCount when selectedEventId changes
  useEffect(() => {
    const target = events.find(e => e.id === selectedEventId);
    if (target?.targetWinningDigits || target?.winningDigits) {
      setCustomDigits(target.targetWinningDigits || target.winningDigits);
    }
    if (target?.winnerCount) {
      setDrawWinnerCount(String(target.winnerCount));
    }
  }, [selectedEventId, events]);

  const selectedEvent = events.find(e => e.id === selectedEventId);

  // Platform Settings state initialized from global platformSettings
  const [minWithdrawal, setMinWithdrawal] = useState(() => String(platformSettings?.minWithdrawal ?? '5.00'));
  const [maxWithdrawal, setMaxWithdrawal] = useState(() => String(platformSettings?.maxWithdrawal ?? '10000.00'));
  const [houseFeePercent, setHouseFeePercent] = useState(() => String(platformSettings?.houseFeePercent ?? '5'));
  const [defaultWinnerSharePercent, setDefaultWinnerSharePercent] = useState(() => String(platformSettings?.defaultWinnerSharePercent ?? '90'));
  const [treasuryTrc20, setTreasuryTrc20] = useState(() => platformSettings?.treasuryTrc20 || 'TYv7s8K3eL2QpNm4xW9jRtZbCuYxK9m');
  const [supportEmail, setSupportEmail] = useState(() => platformSettings?.supportEmail || 'support@earnflow.in');
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [lastSavedTime, setLastSavedTime] = useState(null);

  // Sync inputs whenever platformSettings updates from database or another session
  useEffect(() => {
    if (platformSettings) {
      setMinWithdrawal(String(platformSettings.minWithdrawal ?? '5.00'));
      setMaxWithdrawal(String(platformSettings.maxWithdrawal ?? '10000.00'));
      setHouseFeePercent(String(platformSettings.houseFeePercent ?? '5'));
      setDefaultWinnerSharePercent(String(platformSettings.defaultWinnerSharePercent ?? '90'));
      setTreasuryTrc20(platformSettings.treasuryTrc20 || 'TYv7s8K3eL2QpNm4xW9jRtZbCuYxK9m');
      setSupportEmail(platformSettings.supportEmail || 'support@earnflow.in');
    }
  }, [platformSettings]);

  const [copiedId, setCopiedId] = useState(null);

  // Fetch users when Users or Overview tab is activated
  const loadUsers = async () => {
    setLoadingUsers(true);
    const data = await adminFetchAllUsers();
    setUsersList(data || []);
    setLoadingUsers(false);
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const activeEvents = events.filter(e => e.status === 'active');
  const pendingWithdrawals = withdrawals.filter(w => w.status === 'processing');
  const completedWithdrawals = withdrawals.filter(w => w.status === 'completed');

  const totalPoolPrize = events.reduce((acc, e) => acc + (e.poolPrize || 0), 0);
  const totalTicketsSold = events.reduce((acc, e) => acc + (e.ticketsSold || 0), 0);
  const totalPendingAmount = pendingWithdrawals.reduce((acc, w) => acc + (w.amount || 0), 0);

  const handleCopy = (text, id) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    showToast('Copied to clipboard!', 'info');
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleCreateSubmit = (e) => {
    e.preventDefault();
    adminCreateEvent({
      title: eventTitle,
      ticketPrice,
      durationValue,
      durationUnit,
      minPrize: prizeType === 'range' ? minPrize : null,
      maxPrize: prizeType === 'range' ? maxPrize : null,
      initialSeedJackpot: prizeType === 'fixed' ? initialJackpot : maxPrize,
      targetWinningDigits: eventWinningDigits,
      theme: eventTheme,
      badge: SEASONAL_PRESETS[eventTheme]?.badge || 'SPECIAL EVENT',
      bannerImage: eventBannerImage,
      winnerSharePercent: eventWinnerSharePercent,
      winnerCount: parseInt(eventWinnerCount || 1, 10)
    });
    setEventTitle('');
  };

  const handleApprovePayout = async (payoutId) => {
    const customAmt = editedPayoutAmounts[payoutId];
    await adminApproveWinnerPayout(payoutId, customAmt);
  };

  const handleManualCreditSubmit = async (e) => {
    e.preventDefault();
    if (!manualWinnerAmount || parseFloat(manualWinnerAmount) <= 0) {
      showToast('Please enter a valid USDT amount', 'error');
      return;
    }
    const target = manualWinnerUser || (usersList[0]?.username ? `@${usersList[0]?.username}` : 'VIP Player');
    await adminAddManualWinnerCredit(target, manualWinnerAmount, manualWinnerNote);
    setManualWinnerAmount('');
  };

  const handleTriggerDraw = (e) => {
    e.preventDefault();
    if (!selectedEventId) {
      showToast('Please select an active lottery event to draw', 'error');
      return;
    }
    executeDraw(selectedEventId, customDigits, parseInt(drawWinnerCount || 1, 10));
  };

  const handleToggleStatus = async (targetUser) => {
    const res = await adminToggleUserStatus(targetUser.id, targetUser.status || 'active');
    if (res.success) {
      setUsersList(prev => prev.map(u => u.id === targetUser.id ? { ...u, status: res.nextStatus } : u));
    }
  };

  const handleToggleRole = async (targetUser) => {
    const nextRole = targetUser.role === 'super_admin' ? 'user' : 'super_admin';
    const confirmChange = window.confirm(`Change role of @${targetUser.username || targetUser.email} to '${nextRole}'?`);
    if (!confirmChange) return;

    const res = await adminUpdateUserRole(targetUser.id, nextRole);
    if (res.success) {
      setUsersList(prev => prev.map(u => u.id === targetUser.id ? { ...u, role: nextRole } : u));
    }
  };

  const handleDeleteUser = async (targetUser) => {
    const confirmDelete = window.confirm(`Are you sure you want to permanently delete @${targetUser.username || targetUser.email}? This action cannot be undone.`);
    if (!confirmDelete) return;

    const res = await adminDeleteUser(targetUser.id);
    if (res.success) {
      setUsersList(prev => prev.filter(u => u.id !== targetUser.id));
    }
  };

  const handleSaveSettings = async (e) => {
    e.preventDefault();
    setIsSavingSettings(true);
    try {
      const res = await adminUpdatePlatformSettings({
        minWithdrawal,
        maxWithdrawal,
        houseFeePercent,
        defaultWinnerSharePercent,
        treasuryTrc20,
        supportEmail
      });
      if (res?.success) {
        setLastSavedTime(new Date().toLocaleTimeString());
      }
    } finally {
      setIsSavingSettings(false);
    }
  };

  // Filtered users list
  const filteredUsers = usersList.filter(u => {
    const matchesSearch = 
      (u.username && u.username.toLowerCase().includes(userSearchQuery.toLowerCase())) ||
      (u.email && u.email.toLowerCase().includes(userSearchQuery.toLowerCase())) ||
      (u.trc20_address && u.trc20_address.toLowerCase().includes(userSearchQuery.toLowerCase()));
    
    const matchesRole = 
      userRoleFilter === 'all' || 
      (userRoleFilter === 'super_admin' && u.role === 'super_admin') ||
      (userRoleFilter === 'user' && u.role !== 'super_admin');

    return matchesSearch && matchesRole;
  });

  // Filtered withdrawals list
  const filteredWithdrawals = withdrawals.filter(w => {
    if (withdrawalFilter === 'pending') return w.status === 'processing';
    if (withdrawalFilter === 'completed') return w.status === 'completed';
    if (withdrawalFilter === 'flagged') return w.status === 'flagged';
    return true;
  });

  // Filtered winner payouts list
  const filteredWinnerPayouts = winnerPayouts.filter(p => {
    if (payoutFilter === 'pending') return p.status === 'pending_approval';
    if (payoutFilter === 'completed') return p.status === 'completed';
    if (payoutFilter === 'rejected') return p.status === 'rejected';
    return true;
  });

  // Filtered support tickets list
  const filteredSupportTickets = supportTickets.filter(t => {
    if (supportFilter === 'pending') return t.status === 'pending';
    if (supportFilter === 'replied') return t.status === 'replied';
    if (supportFilter === 'resolved') return t.status === 'resolved';
    return true;
  }).filter(t => {
    if (!supportSearchQuery) return true;
    const q = supportSearchQuery.toLowerCase();
    return (
      (t.id && t.id.toLowerCase().includes(q)) ||
      (t.name && t.name.toLowerCase().includes(q)) ||
      (t.username && t.username.toLowerCase().includes(q)) ||
      (t.email && t.email.toLowerCase().includes(q)) ||
      (t.subject && t.subject.toLowerCase().includes(q)) ||
      (t.message && t.message.toLowerCase().includes(q))
    );
  });

  const pendingSupportCount = supportTickets.filter(t => t.status === 'pending').length;

  return (
    <div className="min-h-screen bg-[#07090d] text-[#e1e2eb] flex flex-col font-sans">
      {/* Top Navbar */}
      <header className="sticky top-0 z-40 bg-[#0d1117]/95 backdrop-blur-xl border-b border-amber-500/25 px-4 sm:px-8 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 p-0.5 shadow-[0_0_15px_rgba(245,196,81,0.3)] shrink-0">
            <img src="/logo.png" alt="EarnFlow Admin" className="w-full h-full rounded-full object-cover" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-display font-extrabold text-base text-white">
                EarnFlow<span className="text-amber-400">.In</span>
              </span>
              <span className="text-[10px] font-mono-numbers px-2 py-0.5 rounded bg-amber-500/15 text-amber-400 border border-amber-500/30 font-bold uppercase tracking-wider">
                SUPER ADMIN SUITE
              </span>
            </div>
            <p className="text-[10px] text-[#9b8f7c]">
              Sovereign Decentralized Cryptographic Governance
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {user && (
            <div className="hidden sm:flex items-center gap-2 bg-[#141924] px-3 py-1.5 rounded-xl border border-[#272a31]">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></span>
              <span className="text-xs font-mono-numbers text-white font-bold">
                @{profile?.username || user?.email?.split('@')[0]}
              </span>
              <span className="text-[9px] font-mono-numbers px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30">
                SUPER ADMIN
              </span>
            </div>
          )}
          <a
            href="/"
            onClick={() => {
              window.location.hash = '';
            }}
            className="px-3 py-1.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-xs font-bold text-amber-300 border border-amber-500/30 flex items-center gap-1.5 transition-colors cursor-pointer"
            title="Open Live Public User Platform"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>User Lobby</span>
          </a>
          <button
            onClick={onLogout}
            className="px-3.5 py-1.5 rounded-xl bg-red-950/30 hover:bg-red-950/60 text-xs font-bold text-red-400 border border-red-500/30 flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Lock & Sign Out</span>
          </button>
        </div>
      </header>

      {/* Main Admin Container with Tabbed Navigation */}
      <div className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 w-full space-y-6">
        
        {/* Navigation Bar Tabs */}
        <div className="flex items-center gap-2 p-1.5 bg-[#0d1117] border border-[#272a31] rounded-2xl overflow-x-auto no-scrollbar shadow-inner">
          <button
            onClick={() => setActiveAdminTab('overview')}
            className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap ${
              activeAdminTab === 'overview'
                ? 'bg-gradient-to-r from-amber-400 to-amber-500 text-black shadow-md'
                : 'text-[#8b92a2] hover:text-white hover:bg-white/5'
            }`}
          >
            <LayoutDashboard className="w-4 h-4" />
            <span>Overview</span>
          </button>

          <button
            onClick={() => setActiveAdminTab('pools')}
            className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap ${
              activeAdminTab === 'pools'
                ? 'bg-gradient-to-r from-amber-400 to-amber-500 text-black shadow-md'
                : 'text-[#8b92a2] hover:text-white hover:bg-white/5'
            }`}
          >
            <Dices className="w-4 h-4" />
            <span>Pools & Draw Oracle</span>
            <span className="px-1.5 py-0.2 rounded-full text-[9px] bg-black/40 font-mono-numbers">
              {activeEvents.length}
            </span>
          </button>

          <button
            onClick={() => setActiveAdminTab('withdrawals')}
            className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap ${
              activeAdminTab === 'withdrawals'
                ? 'bg-gradient-to-r from-amber-400 to-amber-500 text-black shadow-md'
                : 'text-[#8b92a2] hover:text-white hover:bg-white/5'
            }`}
          >
            <Wallet className="w-4 h-4" />
            <span>24h SLA Withdrawals</span>
            {pendingWithdrawals.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[9px] bg-amber-500 text-black font-bold font-mono-numbers">
                {pendingWithdrawals.length}
              </span>
            )}
          </button>

          <button
            onClick={() => { setActiveAdminTab('users'); loadUsers(); }}
            className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap ${
              activeAdminTab === 'users'
                ? 'bg-gradient-to-r from-amber-400 to-amber-500 text-black shadow-md'
                : 'text-[#8b92a2] hover:text-white hover:bg-white/5'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>User Management</span>
            <span className="px-1.5 py-0.2 rounded-full text-[9px] bg-black/40 font-mono-numbers">
              {usersList.length}
            </span>
          </button>

          <button
            onClick={() => setActiveAdminTab('winner-payouts')}
            className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap ${
              activeAdminTab === 'winner-payouts'
                ? 'bg-gradient-to-r from-amber-400 to-amber-500 text-black shadow-md'
                : 'text-[#8b92a2] hover:text-white hover:bg-white/5'
            }`}
          >
            <Trophy className="w-4 h-4" />
            <span>Winner Payouts (Add USDT)</span>
            {winnerPayouts.filter(p => p.status === 'pending_approval').length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[9px] bg-emerald-500 text-black font-bold font-mono-numbers animate-pulse">
                {winnerPayouts.filter(p => p.status === 'pending_approval').length}
              </span>
            )}
          </button>

          <button
            onClick={() => { setActiveAdminTab('support'); fetchSupportTickets(); }}
            className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap ${
              activeAdminTab === 'support'
                ? 'bg-gradient-to-r from-amber-400 to-amber-500 text-black shadow-md'
                : 'text-[#8b92a2] hover:text-white hover:bg-white/5'
            }`}
          >
            <MessageSquare className="w-4 h-4" />
            <span>Support & Inquiries</span>
            {pendingSupportCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[9px] bg-red-500 text-white font-bold font-mono-numbers animate-pulse">
                {pendingSupportCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveAdminTab('settings')}
            className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap ${
              activeAdminTab === 'settings'
                ? 'bg-gradient-to-r from-amber-400 to-amber-500 text-black shadow-md'
                : 'text-[#8b92a2] hover:text-white hover:bg-white/5'
            }`}
          >
            <Settings className="w-4 h-4" />
            <span>Platform Settings</span>
          </button>
        </div>

        {/* ============================================================== */}
        {/* TAB 1: OVERVIEW DASHBOARD                                      */}
        {/* ============================================================== */}
        {activeAdminTab === 'overview' && (
          <div className="space-y-6 animate-in fade-in duration-150">
            {/* KPI Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-[#0d1117] border border-[#272a31] p-5 rounded-2xl relative overflow-hidden shadow-lg">
                <div className="flex items-center justify-between text-[#8b92a2] mb-2">
                  <span className="text-xs font-semibold uppercase tracking-wider">Active Jackpot Pots</span>
                  <DollarSign className="w-4 h-4 text-amber-400" />
                </div>
                <div className="text-2xl font-mono-numbers font-black text-amber-400">
                  {totalPoolPrize.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  <span className="text-xs text-amber-400/80 font-normal ml-1">USDT</span>
                </div>
                <div className="text-[11px] text-[#9b8f7c] mt-1 flex items-center gap-1">
                  <span>Across {activeEvents.length} active live pools</span>
                </div>
              </div>

              <div className="bg-[#0d1117] border border-[#272a31] p-5 rounded-2xl relative overflow-hidden shadow-lg">
                <div className="flex items-center justify-between text-[#8b92a2] mb-2">
                  <span className="text-xs font-semibold uppercase tracking-wider">Total Tickets Sold</span>
                  <Flame className="w-4 h-4 text-[#05d5aa]" />
                </div>
                <div className="text-2xl font-mono-numbers font-black text-white">
                  {totalTicketsSold.toLocaleString()}
                </div>
                <div className="text-[11px] text-[#05d5aa] mt-1 flex items-center gap-1 font-medium">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Provably fair hashed entries</span>
                </div>
              </div>

              <div className="bg-[#0d1117] border border-[#272a31] p-5 rounded-2xl relative overflow-hidden shadow-lg">
                <div className="flex items-center justify-between text-[#8b92a2] mb-2">
                  <span className="text-xs font-semibold uppercase tracking-wider">Pending SLA Payouts</span>
                  <Clock className="w-4 h-4 text-orange-400" />
                </div>
                <div className="text-2xl font-mono-numbers font-black text-orange-400">
                  {pendingWithdrawals.length}
                  <span className="text-xs text-[#9b8f7c] font-normal ml-1.5 font-mono">
                    ({totalPendingAmount.toFixed(2)} USDT)
                  </span>
                </div>
                <div className="text-[11px] text-[#9b8f7c] mt-1">
                  Guaranteed 24-hour settlement
                </div>
              </div>

              <div className="bg-[#0d1117] border border-[#272a31] p-5 rounded-2xl relative overflow-hidden shadow-lg">
                <div className="flex items-center justify-between text-[#8b92a2] mb-2">
                  <span className="text-xs font-semibold uppercase tracking-wider">Registered Players</span>
                  <Users className="w-4 h-4 text-sky-400" />
                </div>
                <div className="text-2xl font-mono-numbers font-black text-white">
                  {usersList.length}
                </div>
                <div className="text-[11px] text-sky-400 mt-1 flex items-center gap-1 font-medium">
                  <Shield className="w-3.5 h-3.5" />
                  <span>TRC-20 enabled profiles</span>
                </div>
              </div>
            </div>

            {/* Oracle & System Status Banner */}
            <div className="p-5 rounded-2xl bg-[#0d1117] border border-amber-500/30 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
                  <ShieldAlert className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-display font-bold text-sm text-white">
                    Cryptographic Oracle & Autonomous Disbursals
                  </h4>
                  <p className="text-xs text-[#9b8f7c] mt-0.5">
                    Deploy new USDT pools, run 4-digit provably fair draw settling, and fulfill 24-hour SLA withdrawals.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setActiveAdminTab('pools')}
                  className="px-3.5 py-2 rounded-xl btn-gold text-xs font-bold cursor-pointer"
                >
                  Deploy Pool
                </button>
                <button
                  onClick={() => setActiveAdminTab('withdrawals')}
                  className="px-3.5 py-2 rounded-xl bg-[#141924] hover:bg-[#1a2130] text-xs font-bold text-white border border-[#272a31] cursor-pointer"
                >
                  Review Withdrawals ({pendingWithdrawals.length})
                </button>
              </div>
            </div>

            {/* Live Pool Summary Table */}
            <div className="bg-[#0d1117] border border-[#272a31] rounded-2xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Layers className="w-4 h-4 text-amber-400" />
                  <h3 className="font-display font-bold text-sm text-white">
                    Active Lottery Pools Snapshot
                  </h3>
                </div>
                <button
                  onClick={() => setActiveAdminTab('pools')}
                  className="text-xs text-amber-400 hover:underline font-semibold"
                >
                  Manage All Pools →
                </button>
              </div>

              <div className="overflow-x-auto no-scrollbar">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#07090d] text-[#8b92a2] uppercase text-[10px] tracking-wider border-b border-[#1f2737]">
                    <tr>
                      <th className="py-2.5 px-3">Event Title</th>
                      <th className="py-2.5 px-3">Ticket Price</th>
                      <th className="py-2.5 px-3">Current Jackpot</th>
                      <th className="py-2.5 px-3">Tickets Sold</th>
                      <th className="py-2.5 px-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1f2737] font-mono-numbers">
                    {events.map((evt) => (
                      <tr key={evt.id} className="hover:bg-white/2">
                        <td className="py-3 px-3 text-white font-medium font-sans">
                          {evt.title}
                        </td>
                        <td className="py-3 px-3 text-amber-400 font-bold">
                          {evt.ticketPrice} USDT
                        </td>
                        <td className="py-3 px-3 text-[#05d5aa] font-bold">
                          {evt.poolPrize.toLocaleString()} USDT
                        </td>
                        <td className="py-3 px-3 text-white">
                          {evt.ticketsSold}
                        </td>
                        <td className="py-3 px-3">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase font-sans ${
                            evt.status === 'active' 
                              ? 'bg-emerald-950/60 text-[#05d5aa] border border-[#05d5aa]/30' 
                              : 'bg-zinc-800 text-zinc-400'
                          }`}>
                            {evt.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* TAB 2: LOTTERY POOLS & DRAW ORACLE                            */}
        {/* ============================================================== */}
        {activeAdminTab === 'pools' && (
          <div className="space-y-8 animate-in fade-in duration-150">
            {/* 2-Column Workstation: Deploy Pool & Draw Oracle */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              
              {/* Deploy New Event Form */}
              <div className="lg:col-span-6 bg-[#0d1117] border border-[#272a31] rounded-2xl p-6 space-y-5 shadow-lg">
                <div className="flex items-center gap-3 pb-3 border-b border-[#1f2737]">
                  <PlusCircle className="w-5 h-5 text-amber-400" />
                  <div>
                    <h3 className="font-display font-bold text-base text-white">
                      Deploy New Lottery Event
                    </h3>
                    <p className="text-xs text-[#9b8f7c]">
                      Launch autonomous USDT pool with target draw duration
                    </p>
                  </div>
                </div>

                <form onSubmit={handleCreateSubmit} className="space-y-4">
                  <div>
                    <label className="block text-xs text-[#8b92a2] font-semibold mb-1">
                      Event Title
                    </label>
                    <input
                      type="text"
                      value={eventTitle}
                      onChange={(e) => setEventTitle(e.target.value)}
                      placeholder="e.g. VIP High Stakes 50 USDT Pot"
                      className="w-full bg-[#07090d] border border-[#272a31] focus:border-[#ffd700] rounded-xl px-3 py-2 text-xs text-white outline-none"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-[#8b92a2] font-semibold mb-1">
                        Ticket Price (USDT)
                      </label>
                      <input
                        type="number"
                        min="1"
                        value={ticketPrice}
                        onChange={(e) => setTicketPrice(e.target.value)}
                        className="w-full bg-[#07090d] border border-[#272a31] focus:border-[#ffd700] rounded-xl px-3 py-2 text-xs text-white font-mono-numbers outline-none"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-xs text-[#8b92a2] font-semibold mb-1">
                        Duration (Minimum 1 min / 60 sec)
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="number"
                          min="1"
                          value={durationValue}
                          onChange={(e) => setDurationValue(e.target.value)}
                          placeholder="e.g. 60"
                          className="bg-[#07090d] border border-[#272a31] focus:border-[#ffd700] rounded-xl px-3 py-2 text-xs text-white font-mono-numbers outline-none"
                          required
                        />
                        <select
                          value={durationUnit}
                          onChange={(e) => setDurationUnit(e.target.value)}
                          className="bg-[#07090d] border border-[#272a31] focus:border-[#ffd700] rounded-xl px-2 py-2 text-xs text-white outline-none cursor-pointer"
                        >
                          <option value="minutes">Minutes</option>
                          <option value="hours">Hours</option>
                          <option value="days">Days</option>
                        </select>
                      </div>
                      <p className="text-[10px] text-[#9b8f7c] mt-1">
                        {durationUnit === 'minutes' ? `Pool will run for ${durationValue || 1} minute(s) (min 60s)` : `Pool will run for ${durationValue || 1} ${durationUnit}`}
                      </p>
                    </div>
                  </div>

                  {/* Prize Distribution Structure */}
                  <div className="p-3 rounded-xl bg-[#07090d] border border-[#272a31] space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="text-xs text-[#8b92a2] font-semibold">
                        Prize Distribution Structure
                      </label>
                      <div className="flex items-center gap-1 bg-[#141924] p-1 rounded-lg border border-[#272a31]">
                        <button
                          type="button"
                          onClick={() => setPrizeType('range')}
                          className={`px-2.5 py-1 rounded-md text-[11px] font-bold cursor-pointer transition-all ${
                            prizeType === 'range' ? 'bg-amber-400 text-black shadow' : 'text-[#8b92a2] hover:text-white'
                          }`}
                        >
                          Range (10 - 50 USDT)
                        </button>
                        <button
                          type="button"
                          onClick={() => setPrizeType('fixed')}
                          className={`px-2.5 py-1 rounded-md text-[11px] font-bold cursor-pointer transition-all ${
                            prizeType === 'fixed' ? 'bg-amber-400 text-black shadow' : 'text-[#8b92a2] hover:text-white'
                          }`}
                        >
                          Fixed Jackpot (25,000)
                        </button>
                      </div>
                    </div>

                    {prizeType === 'range' ? (
                      <div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-[11px] text-[#8b92a2] font-semibold mb-1">
                              Minimum Prize (Floor USDT)
                            </label>
                            <input
                              type="number"
                              min="1"
                              value={minPrize}
                              onChange={(e) => setMinPrize(e.target.value)}
                              placeholder="10"
                              className="w-full bg-[#0b0e14] border border-[#1f2737] focus:border-[#ffd700] rounded-lg px-2.5 py-1.5 text-xs text-white font-mono-numbers outline-none"
                              required
                            />
                          </div>
                          <div>
                            <label className="block text-[11px] text-[#8b92a2] font-semibold mb-1">
                              Maximum Prize (Cap USDT)
                            </label>
                            <input
                              type="number"
                              min="1"
                              value={maxPrize}
                              onChange={(e) => setMaxPrize(e.target.value)}
                              placeholder="50"
                              className="w-full bg-[#0b0e14] border border-[#1f2737] focus:border-[#ffd700] rounded-lg px-2.5 py-1.5 text-xs text-white font-mono-numbers outline-none"
                              required
                            />
                          </div>
                        </div>
                        <p className="text-[10px] text-amber-400 mt-1.5 font-medium">
                          🎯 Lucky winner receives a dynamic prize between <span className="font-bold underline">{minPrize} USDT and {maxPrize} USDT</span>!
                        </p>
                      </div>
                    ) : (
                      <div>
                        <label className="block text-[11px] text-[#8b92a2] font-semibold mb-1">
                          Fixed Win Up To Jackpot Pot (USDT)
                        </label>
                        <input
                          type="number"
                          min="10"
                          value={initialJackpot}
                          onChange={(e) => setInitialJackpot(e.target.value)}
                          placeholder="25000"
                          className="w-full bg-[#0b0e14] border border-[#1f2737] focus:border-[#ffd700] rounded-lg px-2.5 py-1.5 text-xs text-white font-mono-numbers outline-none"
                          required
                        />
                        <p className="text-[10px] text-[#9b8f7c] mt-1">
                          Single exact winner can win up to this jackpot amount.
                        </p>
                      </div>
                    )}
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs text-[#8b92a2] font-semibold">
                        Pre-Set Winning 4-Digit Seed:
                      </label>
                      <span className="text-[10px] text-[#05d5aa] font-bold">
                        Single Winner Combination
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        maxLength={4}
                        value={eventWinningDigits}
                        onChange={(e) => setEventWinningDigits(e.target.value.replace(/\D/g, '').slice(0, 4))}
                        placeholder="7429"
                        className="flex-1 bg-[#07090d] border border-amber-500/40 focus:border-[#ffd700] rounded-xl px-3 py-2 text-center text-white font-mono-numbers font-black text-sm tracking-[4px] outline-none"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setEventWinningDigits(String(Math.floor(1000 + Math.random() * 9000)))}
                        className="px-2.5 py-2 rounded-xl bg-[#141924] hover:bg-[#1a2130] border border-[#272a31] text-[11px] font-bold text-amber-400 flex items-center gap-1 cursor-pointer"
                        title="Randomize Digits"
                      >
                        <RefreshCw className="w-3 h-3" />
                        <span>RNG</span>
                      </button>
                    </div>
                    <p className="text-[10px] text-[#9b8f7c] mt-1">
                      Only this exact 4-digit number will win the full jackpot pot. All other combinations lose.
                    </p>
                  </div>

                  {/* Seasonal Festival Theme Selector */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs text-[#8b92a2] font-semibold">
                        Seasonal Festival Theme
                      </label>
                      <span className="text-[10px] text-amber-400 font-bold">
                        Banner Card Styling
                      </span>
                    </div>
                    <select
                      value={eventTheme}
                      onChange={(e) => handleThemeChange(e.target.value)}
                      className="w-full bg-[#07090d] border border-[#272a31] focus:border-[#ffd700] rounded-xl px-3 py-2 text-xs text-white outline-none cursor-pointer"
                    >
                      {Object.values(SEASONAL_PRESETS).map(thm => (
                        <option key={thm.id} value={thm.id}>{thm.name}</option>
                      ))}
                    </select>
                  </div>

                  {/* Banner Photo Upload or URL */}
                  <div className="space-y-2 p-3 rounded-xl bg-[#07090d] border border-[#272a31]">
                    <div className="flex items-center justify-between">
                      <label className="text-xs text-[#8b92a2] font-semibold flex items-center gap-1.5">
                        <Image className="w-3.5 h-3.5 text-amber-400" />
                        Card Banner Image
                      </label>
                      <label className="cursor-pointer px-2.5 py-1 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-[10px] font-bold text-amber-400 flex items-center gap-1">
                        <Upload className="w-3 h-3" />
                        <span>Upload File</span>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleBannerFileUpload}
                          className="hidden"
                        />
                      </label>
                    </div>

                    <input
                      type="url"
                      value={eventBannerImage}
                      onChange={(e) => setEventBannerImage(e.target.value)}
                      placeholder="Paste image URL or upload above..."
                      className="w-full bg-[#0b0e14] border border-[#1f2737] focus:border-[#ffd700] rounded-lg px-2.5 py-1.5 text-[11px] text-white font-mono outline-none"
                    />

                    {/* Banner & Live Simulation Preview */}
                    {eventBannerImage && (
                      <div className="space-y-2 mt-2">
                        <div className="flex items-center justify-between text-[11px] text-[#8b92a2]">
                          <span className="font-semibold text-amber-400">Live User Card Preview:</span>
                          <span className="text-[10px] text-emerald-400 font-bold">Theme: {SEASONAL_PRESETS[eventTheme]?.name || eventTheme}</span>
                        </div>
                        
                        {/* Simulation Mini Card */}
                        <div className="relative rounded-2xl overflow-hidden border border-amber-500/40 p-4 shadow-xl bg-[#0e121a]">
                          {/* Background Festive Banner */}
                          <div 
                            className="absolute inset-0 bg-cover bg-center opacity-30"
                            style={{ backgroundImage: `url(${eventBannerImage})` }}
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-[#090c13] via-[#090c13]/70 to-transparent" />

                          <div className="relative z-10 space-y-2.5">
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm">
                                {SEASONAL_PRESETS[eventTheme]?.badge || '🪔 DIWALI BUMPER'}
                              </span>
                              <span className="text-[10px] font-mono-numbers text-cyan-400 bg-cyan-950/60 px-2 py-0.5 rounded border border-cyan-500/30">
                                ⏱️ {durationValue || 60} {durationUnit}
                              </span>
                            </div>

                            <div>
                              <h4 className="font-display font-black text-sm text-white line-clamp-1">
                                {eventTitle || 'Diwali Special Bumper Pot 10 USDT'}
                              </h4>
                              <p className="text-[10px] text-amber-400/90 font-medium">
                                Entry: <span className="font-bold text-white">{ticketPrice} USDT</span>
                              </p>
                            </div>

                            {/* Prize display */}
                            <div className="p-2 rounded-xl bg-black/50 border border-amber-500/30 flex items-center justify-between">
                              <span className="text-[10px] text-[#8b92a2] font-semibold">
                                {prizeType === 'range' ? 'PRIZE RANGE:' : 'JACKPOT POT:'}
                              </span>
                              <span className="font-mono-numbers font-black text-xs text-amber-300">
                                {prizeType === 'range' 
                                  ? `${minPrize || 10} – ${maxPrize || 50} USDT` 
                                  : `Up to ${Number(initialJackpot || 25000).toLocaleString()} USDT`}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Winner Payout Share (%) */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs text-[#8b92a2] font-semibold">
                        Winner Payout Share (%)
                      </label>
                      <span className="text-[10px] text-emerald-400 font-bold font-mono-numbers">
                        Hidden from Users
                      </span>
                    </div>
                    <input
                      type="number"
                      min="50"
                      max="100"
                      value={eventWinnerSharePercent}
                      onChange={(e) => setEventWinnerSharePercent(e.target.value)}
                      className="w-full bg-[#07090d] border border-[#272a31] focus:border-[#ffd700] rounded-xl px-3 py-2 text-xs text-white font-mono-numbers outline-none"
                      required
                    />
                    <p className="text-[10px] text-[#9b8f7c] mt-1">
                      Percentage of pool collected to credit to exact winner (e.g. 90%).
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs text-[#8b92a2] font-semibold mb-1">
                      Number of Lucky Winners (Luck-Based):
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="100"
                      value={eventWinnerCount}
                      onChange={(e) => setEventWinnerCount(e.target.value)}
                      className="w-full bg-[#07090d] border border-[#272a31] focus:border-[#ffd700] rounded-xl px-3 py-2 text-xs text-white font-mono-numbers outline-none"
                      required
                    />
                    <p className="text-[10px] text-[#9b8f7c] mt-1">
                      Prize pool will be divided equally among this many lucky winners based on luck (e.g. 1, 5, 10, 12).
                    </p>
                  </div>

                  <button
                    type="submit"
                    className="w-full py-2.5 rounded-xl btn-gold text-xs font-bold flex items-center justify-center gap-2 cursor-pointer shadow-md"
                  >
                    <PlusCircle className="w-4 h-4" />
                    <span>Deploy Contract to Supabase</span>
                  </button>
                </form>
              </div>

              {/* Draw Oracle Settlement Center */}
              <div className="lg:col-span-6 bg-[#0d1117] border border-[#272a31] rounded-2xl p-6 space-y-5 shadow-lg">
                <div className="flex items-center gap-3 pb-3 border-b border-[#1f2737]">
                  <Dices className="w-5 h-5 text-[#05d5aa]" />
                  <div>
                    <h3 className="font-display font-bold text-base text-white">
                      Cryptographic Draw Oracle
                    </h3>
                    <p className="text-xs text-[#9b8f7c]">
                      Provably Fair Lucky Winners Settlement (Equal USDT Share)
                    </p>
                  </div>
                </div>

                <form onSubmit={handleTriggerDraw} className="space-y-4">
                  <div>
                    <label className="block text-xs text-[#8b92a2] font-semibold mb-1">
                      Select Active Event to Draw
                    </label>
                    <select
                      value={selectedEventId}
                      onChange={(e) => setSelectedEventId(e.target.value)}
                      className="w-full bg-[#07090d] border border-[#272a31] focus:border-[#ffd700] rounded-xl px-3 py-2 text-xs text-white outline-none cursor-pointer"
                    >
                      {activeEvents.length === 0 ? (
                        <option value="">No active events</option>
                      ) : (
                        activeEvents.map(e => (
                          <option key={e.id} value={e.id}>
                            {e.title} (Pot: Up to {e.poolPrize.toLocaleString()} USDT · {e.ticketsSold} Sold · {e.winnerCount || 1} Winners)
                          </option>
                        ))
                      )}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs text-[#8b92a2] font-semibold mb-1">
                      Number of Lucky Winners to Draw:
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="100"
                      value={drawWinnerCount}
                      onChange={(e) => setDrawWinnerCount(e.target.value)}
                      className="w-full bg-[#07090d] border border-[#272a31] focus:border-[#ffd700] rounded-xl px-3 py-2 text-xs text-white font-mono-numbers outline-none"
                      required
                    />
                    <p className="text-[10px] text-[#9b8f7c] mt-1">
                      Total pool will be divided equally among all lucky winners based on provably fair luck (not rank-based).
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs text-[#8b92a2] font-semibold mb-1">
                      4-Digit Winning Combination:
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        maxLength={4}
                        value={customDigits}
                        onChange={(e) => setCustomDigits(e.target.value.replace(/\D/g, '').slice(0, 4))}
                        placeholder="7429"
                        className="flex-1 bg-[#07090d] border border-amber-500/40 focus:border-[#ffd700] rounded-xl px-4 py-2 text-center text-white font-mono-numbers font-black text-xl tracking-[6px] outline-none"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setCustomDigits(String(Math.floor(1000 + Math.random() * 9000)))}
                        className="px-3 py-2.5 rounded-xl bg-[#141924] hover:bg-[#1a2130] border border-[#272a31] text-xs font-bold text-amber-400 flex items-center gap-1 cursor-pointer"
                        title="Randomize Digits"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        <span>RNG</span>
                      </button>
                    </div>
                  </div>

                  {/* Lucky Winners Allocation Banner */}
                  <div className="p-3.5 bg-[#07090d] rounded-xl border border-amber-500/40 space-y-2">
                    <div className="flex items-center justify-between text-amber-400 font-bold text-xs">
                      <span className="flex items-center gap-1.5 font-display">
                        <Trophy className="w-4 h-4 text-amber-400" />
                        Lucky Winners Allocation ({drawWinnerCount} {parseInt(drawWinnerCount, 10) > 1 ? 'Winners' : 'Winner'}):
                      </span>
                      <span className="bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded text-[10px] font-mono-numbers border border-amber-500/30 font-bold">
                        EQUAL LUCK-BASED SHARE
                      </span>
                    </div>
                    <p className="text-[11px] text-[#d2c5b0] leading-relaxed">
                      {parseInt(drawWinnerCount, 10) > 1 
                        ? `The total prize pool will be divided equally among ${drawWinnerCount} lucky winning tickets. Each winner gets an equal USDT share credited to their balance and queued for disbursal.`
                        : `Only ticket holders with lucky 4-digit combination (${customDigits || '----'}) win the full jackpot pot (Up to ${selectedEvent ? selectedEvent.poolPrize.toLocaleString() : '---'} USDT).`}
                    </p>
                  </div>

                  <button
                    type="submit"
                    disabled={!selectedEventId || customDigits.length < 4}
                    className="w-full py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-[#05d5aa] text-black font-bold text-xs flex items-center justify-center gap-2 cursor-pointer shadow-lg disabled:opacity-50"
                  >
                    <Dices className="w-4 h-4" />
                    <span>Execute Draw & Distribute Winnings</span>
                  </button>
                </form>
              </div>

            </div>

            {/* Active Pools Management Table */}
            <div className="bg-[#0d1117] border border-[#272a31] rounded-2xl p-6 space-y-4">
              <h3 className="font-display font-bold text-base text-white">
                All Configured Lottery Events
              </h3>
              <div className="overflow-x-auto no-scrollbar">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#07090d] text-[#8b92a2] uppercase text-[10px] tracking-wider border-b border-[#1f2737]">
                    <tr>
                      <th className="py-3 px-3">Title</th>
                      <th className="py-3 px-3">Price</th>
                      <th className="py-3 px-3">Max Jackpot (Up to)</th>
                      <th className="py-3 px-3">Sold</th>
                      <th className="py-3 px-3">Winners</th>
                      <th className="py-3 px-3">Winning Seed</th>
                      <th className="py-3 px-3">Status</th>
                      <th className="py-3 px-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1f2737]">
                    {events.map((evt) => (
                      <tr key={evt.id} className="hover:bg-white/2">
                        <td className="py-3 px-3 text-white font-medium">
                          {evt.title}
                        </td>
                        <td className="py-3 px-3 font-mono-numbers text-amber-400 font-bold">
                          {evt.ticketPrice} USDT
                        </td>
                        <td className="py-3 px-3 font-mono-numbers text-[#05d5aa] font-bold">
                          Up to {evt.poolPrize.toLocaleString()} USDT
                        </td>
                        <td className="py-3 px-3 font-mono-numbers text-white">
                          {evt.ticketsSold}
                        </td>
                        <td className="py-3 px-3 font-mono-numbers text-emerald-400 font-bold">
                          {evt.winnerCount || 1}
                        </td>
                        <td className="py-3 px-3 font-mono-numbers font-bold tracking-widest text-amber-300">
                          {evt.winningDigits || evt.targetWinningDigits || '—'}
                        </td>
                        <td className="py-3 px-3">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            evt.status === 'active' 
                              ? 'bg-emerald-950/60 text-[#05d5aa] border border-[#05d5aa]/30' 
                              : 'bg-zinc-800 text-zinc-400'
                          }`}>
                            {evt.status}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-right">
                          <button
                            onClick={() => adminDeleteEvent(evt.id)}
                            className="p-1.5 rounded-lg bg-red-950/30 hover:bg-red-950 text-red-400 hover:text-red-300 border border-red-500/30 transition-colors cursor-pointer"
                            title="Delete Event"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* TAB 3: 24-HOUR SLA WITHDRAWALS MANAGER                         */}
        {/* ============================================================== */}
        {activeAdminTab === 'withdrawals' && (
          <div className="space-y-6 animate-in fade-in duration-150">
            {/* Header info & filters */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-[#0d1117] p-5 rounded-2xl border border-[#272a31]">
              <div>
                <div className="flex items-center gap-2">
                  <Clock className="w-5 h-5 text-amber-400" />
                  <h3 className="font-display font-bold text-base text-white">
                    24-Hour SLA Withdrawal Disbursal Manager
                  </h3>
                </div>
                <p className="text-xs text-[#9b8f7c] mt-0.5">
                  Approve and broadcast TRC-20 USDT withdrawals to user addresses within the 24-hour guarantee
                </p>
              </div>

              {/* Status Filter buttons */}
              <div className="flex items-center gap-1.5 bg-[#07090d] p-1 rounded-xl border border-[#1f2737]">
                <button
                  onClick={() => setWithdrawalFilter('all')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold cursor-pointer transition-colors ${
                    withdrawalFilter === 'all' ? 'bg-amber-500 text-black' : 'text-[#8b92a2] hover:text-white'
                  }`}
                >
                  All ({withdrawals.length})
                </button>
                <button
                  onClick={() => setWithdrawalFilter('pending')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold cursor-pointer transition-colors ${
                    withdrawalFilter === 'pending' ? 'bg-amber-500 text-black' : 'text-[#8b92a2] hover:text-white'
                  }`}
                >
                  Pending ({pendingWithdrawals.length})
                </button>
                <button
                  onClick={() => setWithdrawalFilter('completed')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold cursor-pointer transition-colors ${
                    withdrawalFilter === 'completed' ? 'bg-amber-500 text-black' : 'text-[#8b92a2] hover:text-white'
                  }`}
                >
                  Completed ({completedWithdrawals.length})
                </button>
              </div>
            </div>

            {/* Withdrawals Table */}
            <div className="bg-[#0d1117] border border-[#272a31] rounded-2xl overflow-hidden shadow-lg">
              <div className="overflow-x-auto no-scrollbar">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#07090d] text-[#8b92a2] uppercase text-[10px] tracking-wider border-b border-[#1f2737]">
                    <tr>
                      <th className="py-3.5 px-4">Order ID</th>
                      <th className="py-3.5 px-4">Destination Address (TRC-20)</th>
                      <th className="py-3.5 px-4">Net Disbursal</th>
                      <th className="py-3.5 px-4">SLA Status</th>
                      <th className="py-3.5 px-4">State</th>
                      <th className="py-3.5 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1f2737]">
                    {filteredWithdrawals.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-[#64748b]">
                          No withdrawal records matching current filter.
                        </td>
                      </tr>
                    ) : (
                      filteredWithdrawals.map((order) => {
                        const isPending = order.status === 'processing';
                        return (
                          <tr key={order.id} className="hover:bg-white/2">
                            <td className="py-3.5 px-4 font-mono-numbers font-bold text-white">
                              #{order.id}
                            </td>
                            <td className="py-3.5 px-4">
                              <div className="flex items-center gap-1.5">
                                <span className="font-mono-numbers text-xs text-[#e1e2eb]">
                                  {order.address || order.destination_address || 'TYv7s8K3eL2QpNm4xW9jRtZbCuYxK9m'}
                                </span>
                                <button
                                  onClick={() => handleCopy(order.address || order.destination_address, order.id)}
                                  className="text-[#9b8f7c] hover:text-amber-400 p-1 cursor-pointer"
                                  title="Copy Address"
                                >
                                  {copiedId === order.id ? <Check className="w-3.5 h-3.5 text-[#05d5aa]" /> : <Copy className="w-3.5 h-3.5" />}
                                </button>
                              </div>
                            </td>
                            <td className="py-3.5 px-4 font-mono-numbers font-bold text-amber-400">
                              {(order.netDisbursal || order.amount || 0).toFixed(2)} USDT
                            </td>
                            <td className="py-3.5 px-4">
                              <span className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/25 text-[10px] font-mono-numbers font-semibold">
                                Within 24h SLA
                              </span>
                            </td>
                            <td className="py-3.5 px-4">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase font-mono-numbers ${
                                order.status === 'completed'
                                  ? 'bg-emerald-950/60 text-[#05d5aa] border border-[#05d5aa]/30'
                                  : order.status === 'flagged'
                                    ? 'bg-red-950/60 text-red-400 border border-red-500/30'
                                    : 'bg-amber-950/60 text-amber-400 border border-amber-500/30 animate-pulse'
                              }`}>
                                {order.status}
                              </span>
                            </td>
                            <td className="py-3.5 px-4 text-right">
                              {isPending ? (
                                <div className="flex items-center justify-end gap-2">
                                  <button
                                    onClick={() => adminApproveWithdrawal(order.id)}
                                    className="px-3 py-1.5 rounded-lg bg-[#05d5aa] hover:bg-[#05d5aa]/80 text-black font-bold text-xs flex items-center gap-1 cursor-pointer shadow-sm"
                                  >
                                    <CheckCircle className="w-3.5 h-3.5" />
                                    <span>Approve</span>
                                  </button>
                                  <button
                                    onClick={() => adminRejectWithdrawal(order.id)}
                                    className="px-2.5 py-1.5 rounded-lg bg-red-950/40 hover:bg-red-950 text-red-400 font-bold text-xs flex items-center gap-1 border border-red-500/30 cursor-pointer"
                                  >
                                    <XCircle className="w-3.5 h-3.5" />
                                    <span>Reject</span>
                                  </button>
                                </div>
                              ) : (
                                <span className="text-[11px] text-[#64748b] font-mono-numbers">
                                  {order.txHash ? `TX: ${order.txHash.slice(0, 10)}...` : 'Settled'}
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* TAB 4: USER MANAGEMENT & GOVERNANCE                           */}
        {/* ============================================================== */}
        {activeAdminTab === 'users' && (
          <div className="space-y-6 animate-in fade-in duration-150">
            {/* Header, Search & Filter Bar */}
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-[#0d1117] p-5 rounded-2xl border border-[#272a31]">
              <div>
                <div className="flex items-center gap-2">
                  <Users className="w-5 h-5 text-amber-400" />
                  <h3 className="font-display font-bold text-base text-white">
                    Platform User Directory & Control
                  </h3>
                </div>
                <p className="text-xs text-[#9b8f7c] mt-0.5">
                  Block/suspend malicious actors, assign super_admin roles, or delete users from database
                </p>
              </div>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full md:w-auto">
                {/* Search Bar */}
                <div className="relative">
                  <Search className="w-4 h-4 text-[#64748b] absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={userSearchQuery}
                    onChange={(e) => setUserSearchQuery(e.target.value)}
                    placeholder="Search by username, email, TRC-20..."
                    className="w-full sm:w-64 bg-[#07090d] border border-[#272a31] focus:border-[#ffd700] rounded-xl pl-9 pr-3 py-1.5 text-xs text-white outline-none"
                  />
                </div>

                {/* Role Filter */}
                <select
                  value={userRoleFilter}
                  onChange={(e) => setUserRoleFilter(e.target.value)}
                  className="bg-[#07090d] border border-[#272a31] rounded-xl px-3 py-1.5 text-xs text-white outline-none cursor-pointer"
                >
                  <option value="all">All Roles</option>
                  <option value="super_admin">Super Admins Only</option>
                  <option value="user">Regular Users Only</option>
                </select>

                <button
                  onClick={loadUsers}
                  disabled={loadingUsers}
                  className="px-3 py-1.5 rounded-xl bg-[#141924] hover:bg-[#1a2130] text-xs font-bold text-white border border-[#272a31] flex items-center justify-center gap-1.5 cursor-pointer"
                  title="Reload Users from Supabase"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loadingUsers ? 'animate-spin' : ''}`} />
                  <span>Refresh</span>
                </button>
              </div>
            </div>

            {/* Users Table */}
            <div className="bg-[#0d1117] border border-[#272a31] rounded-2xl overflow-hidden shadow-lg">
              <div className="overflow-x-auto no-scrollbar">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#07090d] text-[#8b92a2] uppercase text-[10px] tracking-wider border-b border-[#1f2737]">
                    <tr>
                      <th className="py-3.5 px-4">User ID / Username</th>
                      <th className="py-3.5 px-4">Email</th>
                      <th className="py-3.5 px-4">TRC-20 Address</th>
                      <th className="py-3.5 px-4">Role</th>
                      <th className="py-3.5 px-4">Status</th>
                      <th className="py-3.5 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1f2737]">
                    {filteredUsers.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-[#64748b]">
                          {loadingUsers ? 'Loading profiles from database...' : 'No users found.'}
                        </td>
                      </tr>
                    ) : (
                      filteredUsers.map((u) => {
                        const isBlocked = u.status === 'blocked';
                        const isSuper = u.role === 'super_admin';
                        return (
                          <tr key={u.id} className="hover:bg-white/2">
                            <td className="py-3.5 px-4">
                              <div className="flex items-center gap-2">
                                <div className="w-6 h-6 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-[10px] font-bold text-black shrink-0">
                                  {(u.username || u.email || 'U')[0].toUpperCase()}
                                </div>
                                <span className="font-mono-numbers font-bold text-white">
                                  @{u.username || 'user'}
                                </span>
                              </div>
                            </td>
                            <td className="py-3.5 px-4 font-mono-numbers text-[#9b8f7c]">
                              {u.email}
                            </td>
                            <td className="py-3.5 px-4">
                              {u.trc20_address ? (
                                <span className="font-mono-numbers text-[11px] text-[#05d5aa]">
                                  {u.trc20_address.slice(0, 6)}...{u.trc20_address.slice(-4)}
                                </span>
                              ) : (
                                <span className="text-[#64748b] text-[11px]">Not set</span>
                              )}
                            </td>
                            <td className="py-3.5 px-4">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                isSuper
                                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                  : 'bg-zinc-800 text-zinc-300'
                              }`}>
                                {u.role || 'user'}
                              </span>
                            </td>
                            <td className="py-3.5 px-4">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                isBlocked
                                  ? 'bg-red-950/60 text-red-400 border border-red-500/30'
                                  : 'bg-emerald-950/60 text-[#05d5aa] border border-[#05d5aa]/30'
                              }`}>
                                {u.status || 'active'}
                              </span>
                            </td>
                            <td className="py-3.5 px-4 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                {/* Toggle Active / Block */}
                                <button
                                  onClick={() => handleToggleStatus(u)}
                                  className={`p-1.5 rounded-lg border text-xs font-semibold cursor-pointer transition-colors ${
                                    isBlocked
                                      ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-400 hover:bg-emerald-900/50'
                                      : 'bg-amber-950/40 border-amber-500/30 text-amber-400 hover:bg-amber-900/50'
                                  }`}
                                  title={isBlocked ? 'Unblock User' : 'Block User'}
                                >
                                  {isBlocked ? <UserCheck className="w-3.5 h-3.5" /> : <UserX className="w-3.5 h-3.5" />}
                                </button>

                                {/* Toggle Role */}
                                <button
                                  onClick={() => handleToggleRole(u)}
                                  className="p-1.5 rounded-lg bg-[#141924] hover:bg-[#1f2737] border border-[#272a31] text-[#ffd700] cursor-pointer"
                                  title={isSuper ? 'Demote to User' : 'Promote to Super Admin'}
                                >
                                  <Shield className="w-3.5 h-3.5" />
                                </button>

                                {/* Delete User */}
                                <button
                                  onClick={() => handleDeleteUser(u)}
                                  className="p-1.5 rounded-lg bg-red-950/30 hover:bg-red-950/80 border border-red-500/30 text-red-400 cursor-pointer"
                                  title="Delete User"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* TAB: WINNER PAYOUTS (ADD USDT)                                */}
        {/* ============================================================== */}
        {activeAdminTab === 'winner-payouts' && (
          <div className="space-y-6 animate-in fade-in duration-150">
            {/* Header info & filters */}
            <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 bg-[#0d1117] p-5 rounded-2xl border border-[#272a31]">
              <div>
                <div className="flex items-center gap-2">
                  <Trophy className="w-5 h-5 text-amber-400" />
                  <h3 className="font-display font-bold text-base text-white">
                    Winner Payouts & Automated Disbursal Console (Add USDT)
                  </h3>
                </div>
                <p className="text-xs text-[#9b8f7c] mt-0.5">
                  Audit winning pool collections, adjust winner payout shares on the fly, and approve USDT disbursals directly into player wallets.
                </p>
              </div>

              {/* Status Filter buttons */}
              <div className="flex items-center gap-1.5 bg-[#07090d] p-1 rounded-xl border border-[#1f2737]">
                <button
                  onClick={() => setPayoutFilter('all')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold cursor-pointer transition-colors ${
                    payoutFilter === 'all' ? 'bg-amber-500 text-black' : 'text-[#8b92a2] hover:text-white'
                  }`}
                >
                  All ({winnerPayouts.length})
                </button>
                <button
                  onClick={() => setPayoutFilter('pending')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold cursor-pointer transition-colors ${
                    payoutFilter === 'pending' ? 'bg-amber-500 text-black' : 'text-[#8b92a2] hover:text-white'
                  }`}
                >
                  Pending ({winnerPayouts.filter(p => p.status === 'pending_approval').length})
                </button>
                <button
                  onClick={() => setPayoutFilter('completed')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold cursor-pointer transition-colors ${
                    payoutFilter === 'completed' ? 'bg-amber-500 text-black' : 'text-[#8b92a2] hover:text-white'
                  }`}
                >
                  Completed ({winnerPayouts.filter(p => p.status === 'completed').length})
                </button>
              </div>
            </div>

            {/* Quick Metrics Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-[#0d1117] border border-[#272a31] rounded-2xl p-4 flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-emerald-950/40 border border-[#05d5aa]/30 flex items-center justify-center shrink-0">
                  <Award className="w-6 h-6 text-[#05d5aa]" />
                </div>
                <div>
                  <p className="text-[11px] text-[#8b92a2] font-semibold">Total Disbursed to Winners</p>
                  <p className="text-xl font-mono-numbers font-black text-white">
                    +{winnerPayouts.filter(p => p.status === 'completed').reduce((sum, p) => sum + (p.payoutAmount || 0), 0).toLocaleString()} <span className="text-xs text-[#05d5aa]">USDT</span>
                  </p>
                  <p className="text-[10px] text-[#05d5aa]">
                    {winnerPayouts.filter(p => p.status === 'completed').length} Successful Disbursals
                  </p>
                </div>
              </div>

              <div className="bg-[#0d1117] border border-amber-500/30 rounded-2xl p-4 flex items-center gap-4 bg-gradient-to-br from-[#0d1117] to-amber-950/20">
                <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center shrink-0">
                  <Clock className="w-6 h-6 text-amber-400" />
                </div>
                <div>
                  <p className="text-[11px] text-amber-300 font-semibold">Awaiting Approval & Disbursal</p>
                  <p className="text-xl font-mono-numbers font-black text-amber-400">
                    {winnerPayouts.filter(p => p.status === 'pending_approval').reduce((sum, p) => {
                      const amt = editedPayoutAmounts[p.id] !== undefined ? parseFloat(editedPayoutAmounts[p.id]) || 0 : (p.payoutAmount || 0);
                      return sum + amt;
                    }, 0).toLocaleString()} <span className="text-xs text-amber-300">USDT</span>
                  </p>
                  <p className="text-[10px] text-amber-400 font-bold">
                    {winnerPayouts.filter(p => p.status === 'pending_approval').length} Draws in 24h SLA Queue
                  </p>
                </div>
              </div>

              <div className="bg-[#0d1117] border border-[#272a31] rounded-2xl p-4 flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-cyan-950/40 border border-[#00f2fe]/30 flex items-center justify-center shrink-0">
                  <Coins className="w-6 h-6 text-[#00f2fe]" />
                </div>
                <div>
                  <p className="text-[11px] text-[#8b92a2] font-semibold">Disbursal Mode</p>
                  <p className="text-base font-bold text-white">Direct Wallet Settlement</p>
                  <p className="text-[10px] text-[#64748b]">TRC-20 & Platform Balance Instant Credit</p>
                </div>
              </div>
            </div>

            {/* Direct Winner Add USDT Form */}
            <div className="bg-[#0d1117] border border-amber-500/20 rounded-2xl p-5 shadow-lg space-y-4">
              <div className="flex items-center gap-2.5 pb-3 border-b border-[#1f2737]">
                <PlusCircle className="w-5 h-5 text-amber-400" />
                <div>
                  <h4 className="font-display font-bold text-sm text-white">
                    Winner Add USDT (Direct Manual Disbursal)
                  </h4>
                  <p className="text-[11px] text-[#9b8f7c]">
                    Credit custom USDT directly to any player's wallet balance (VIP prizes, promotional rewards, festive giveaways)
                  </p>
                </div>
              </div>

              <form onSubmit={handleManualCreditSubmit} className="grid grid-cols-1 md:grid-cols-4 gap-3.5 items-end">
                <div>
                  <label className="block text-xs text-[#8b92a2] font-semibold mb-1">
                    Select Player / Target Address:
                  </label>
                  <input
                    type="text"
                    list="users-datalist"
                    value={manualWinnerUser}
                    onChange={(e) => setManualWinnerUser(e.target.value)}
                    placeholder="e.g. @LuckyWinner or TRC-20 address"
                    className="w-full bg-[#07090d] border border-[#272a31] focus:border-amber-400 rounded-xl px-3 py-2 text-xs text-white outline-none"
                    required
                  />
                  <datalist id="users-datalist">
                    {usersList.map(u => (
                      <option key={u.id} value={`@${u.username || u.email?.split('@')[0]}`}>
                        {u.email} ({u.trc20_address ? `${u.trc20_address.slice(0, 8)}...` : 'TRC-20'})
                      </option>
                    ))}
                  </datalist>
                </div>

                <div>
                  <label className="block text-xs text-[#8b92a2] font-semibold mb-1">
                    USDT Amount to Disburse:
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      step="0.01"
                      min="0.1"
                      value={manualWinnerAmount}
                      onChange={(e) => setManualWinnerAmount(e.target.value)}
                      placeholder="e.g. 500"
                      className="w-full bg-[#07090d] border border-[#272a31] focus:border-amber-400 rounded-xl pl-3 pr-14 py-2 text-xs text-white font-mono-numbers outline-none font-bold"
                      required
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-amber-400 font-bold">
                      USDT
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block text-xs text-[#8b92a2] font-semibold mb-1">
                    Disbursal Reason / Note:
                  </label>
                  <input
                    type="text"
                    value={manualWinnerNote}
                    onChange={(e) => setManualWinnerNote(e.target.value)}
                    placeholder="e.g. Diwali Bumper Special Draw Reward"
                    className="w-full bg-[#07090d] border border-[#272a31] focus:border-amber-400 rounded-xl px-3 py-2 text-xs text-white outline-none"
                  />
                </div>

                <div>
                  <button
                    type="submit"
                    className="w-full py-2 px-4 rounded-xl btn-gold text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer shadow-md"
                  >
                    <CheckCircle className="w-4 h-4" />
                    <span>+ Disburse USDT to Wallet</span>
                  </button>
                </div>
              </form>
            </div>

            {/* Winner Payouts Queue Table */}
            <div className="bg-[#0d1117] border border-[#272a31] rounded-2xl overflow-hidden shadow-lg">
              <div className="p-4 border-b border-[#1f2737] flex items-center justify-between">
                <div>
                  <h4 className="font-display font-bold text-sm text-white flex items-center gap-2">
                    <span>Draw Payout Queue & SLA Audit</span>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-amber-500/15 text-amber-400 border border-amber-500/30">
                      Editable Disbursals
                    </span>
                  </h4>
                  <p className="text-[11px] text-[#9b8f7c]">
                    Shows calculated winner shares from ticket collections. You can fine-tune the amount before clicking Approve.
                  </p>
                </div>
              </div>

              <div className="overflow-x-auto no-scrollbar">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#07090d] text-[#8b92a2] uppercase text-[10px] tracking-wider border-b border-[#1f2737]">
                    <tr>
                      <th className="py-3.5 px-4">Payout ID & Event</th>
                      <th className="py-3.5 px-4">Winner Details</th>
                      <th className="py-3.5 px-4">Winning Digits</th>
                      <th className="py-3.5 px-4">Pool & Share %</th>
                      <th className="py-3.5 px-4">Disbursal Amount (USDT)</th>
                      <th className="py-3.5 px-4">Status</th>
                      <th className="py-3.5 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1f2737]">
                    {filteredWinnerPayouts.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-12 text-center text-[#64748b]">
                          <Trophy className="w-8 h-8 text-[#272a31] mx-auto mb-2" />
                          <p className="text-xs">No winner payouts found for current filter.</p>
                        </td>
                      </tr>
                    ) : (
                      filteredWinnerPayouts.map((p) => {
                        const isPending = p.status === 'pending_approval';
                        const currentEditVal = editedPayoutAmounts[p.id] !== undefined 
                          ? editedPayoutAmounts[p.id] 
                          : p.payoutAmount;

                        return (
                          <tr key={p.id} className="hover:bg-white/2 transition-colors">
                            <td className="py-3.5 px-4">
                              <div className="font-mono-numbers text-xs font-bold text-white">
                                {p.id}
                              </div>
                              <div className="text-[11px] text-amber-400 font-medium truncate max-w-[180px]">
                                {p.eventTitle}
                              </div>
                              <div className="text-[10px] text-[#64748b]">
                                {new Date(p.createdAt || p.approvedAt || Date.now()).toLocaleDateString()}
                              </div>
                            </td>

                            <td className="py-3.5 px-4">
                              <div className="font-semibold text-white">
                                @{p.winnerUsername || 'LuckyPlayer'}
                              </div>
                              <div className="flex items-center gap-1 text-[11px] font-mono-numbers text-[#8b92a2]">
                                <span>{p.winnerAddress ? `${p.winnerAddress.slice(0, 6)}...${p.winnerAddress.slice(-4)}` : 'TRC-20 Wallet'}</span>
                                {p.winnerAddress && (
                                  <button
                                    onClick={() => handleCopy(p.winnerAddress, `p-addr-${p.id}`)}
                                    className="p-0.5 hover:text-white cursor-pointer"
                                    title="Copy address"
                                  >
                                    {copiedId === `p-addr-${p.id}` ? <Check className="w-3 h-3 text-[#05d5aa]" /> : <Copy className="w-3 h-3" />}
                                  </button>
                                )}
                              </div>
                            </td>

                            <td className="py-3.5 px-4">
                              <div className="inline-block px-2.5 py-1 rounded-lg bg-[#07090d] border border-amber-500/40 text-amber-400 font-mono-numbers font-black text-sm tracking-widest shadow-inner">
                                {p.winningDigits}
                              </div>
                              {p.ticketId && p.ticketId !== 'MANUAL' && (
                                <div className="text-[10px] text-[#64748b] mt-0.5">
                                  Tkt: {p.ticketId}
                                </div>
                              )}
                            </td>

                            <td className="py-3.5 px-4">
                              <div className="text-white font-mono-numbers">
                                {p.ticketsSold || 0} tickets sold
                              </div>
                              <div className="text-[11px] text-[#8b92a2]">
                                Pool: <span className="text-white font-bold">{p.totalPoolCollected?.toLocaleString()} USDT</span>
                              </div>
                              <div className="text-[10px] text-amber-400 font-bold">
                                Winner Share: {p.winnerSharePercent || 90}%
                              </div>
                            </td>

                            <td className="py-3.5 px-4">
                              {isPending ? (
                                <div className="space-y-1">
                                  <div className="flex items-center gap-1.5">
                                    <input
                                      type="number"
                                      step="0.01"
                                      value={currentEditVal}
                                      onChange={(e) => setEditedPayoutAmounts(prev => ({
                                        ...prev,
                                        [p.id]: e.target.value
                                      }))}
                                      className="w-28 bg-[#07090d] border border-amber-500/50 focus:border-[#ffd700] rounded-lg px-2 py-1 text-xs text-white font-mono-numbers font-bold outline-none"
                                    />
                                    <span className="text-xs font-bold text-amber-400">USDT</span>
                                  </div>
                                  <div className="text-[9px] text-[#8b92a2]">
                                    Calc: {p.calculatedAmount?.toLocaleString()} USDT
                                  </div>
                                </div>
                              ) : (
                                <div>
                                  <div className="font-mono-numbers font-black text-sm text-[#05d5aa]">
                                    +{p.payoutAmount?.toLocaleString()} USDT
                                  </div>
                                  {p.txHash && (
                                    <div className="text-[9px] font-mono-numbers text-[#64748b] truncate max-w-[120px]">
                                      Tx: {p.txHash.slice(0, 10)}...
                                    </div>
                                  )}
                                </div>
                              )}
                            </td>

                            <td className="py-3.5 px-4">
                              {isPending ? (
                                <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-500/15 text-amber-400 border border-amber-500/30 flex items-center gap-1 w-fit animate-pulse">
                                  <Clock className="w-3 h-3" />
                                  <span>Pending Approval</span>
                                </span>
                              ) : p.status === 'completed' ? (
                                <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-950/60 text-[#05d5aa] border border-[#05d5aa]/30 flex items-center gap-1 w-fit">
                                  <CheckCircle className="w-3 h-3" />
                                  <span>Added to Wallet</span>
                                </span>
                              ) : (
                                <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-red-950/40 text-red-400 border border-red-500/30 flex items-center gap-1 w-fit">
                                  <XCircle className="w-3 h-3" />
                                  <span>Rejected</span>
                                </span>
                              )}
                            </td>

                            <td className="py-3.5 px-4 text-right">
                              {isPending ? (
                                <div className="flex items-center justify-end gap-1.5">
                                  <button
                                    onClick={() => handleApprovePayout(p.id)}
                                    className="px-3 py-1.5 rounded-xl btn-gold text-xs font-bold flex items-center gap-1 cursor-pointer shadow-md"
                                    title="Disburse and add to winner wallet balance"
                                  >
                                    <CheckCircle className="w-3.5 h-3.5" />
                                    <span>Approve & Add (Done)</span>
                                  </button>

                                  <button
                                    onClick={() => adminRejectWinnerPayout(p.id)}
                                    className="p-1.5 rounded-xl bg-red-950/30 hover:bg-red-950/80 border border-red-500/30 text-red-400 cursor-pointer"
                                    title="Reject or Hold Payout"
                                  >
                                    <XCircle className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              ) : (
                                <span className="text-[10px] text-[#64748b] font-mono-numbers">
                                  Settled
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* TAB 5: PLATFORM SETTINGS & GOVERNANCE                         */}
        {/* ============================================================== */}
        {activeAdminTab === 'settings' && (
          <div className="space-y-6 animate-in fade-in duration-150">
            <div className="bg-[#0d1117] border border-[#272a31] rounded-2xl p-6 space-y-6 shadow-lg">
              <div className="flex items-center gap-3 pb-3 border-b border-[#1f2737]">
                <Settings className="w-5 h-5 text-amber-400" />
                <div>
                  <h3 className="font-display font-bold text-base text-white">
                    Platform Governance & Treasury Settings
                  </h3>
                  <p className="text-xs text-[#9b8f7c]">
                    Configure global withdrawal thresholds, house fees, and official TRC-20 disbursement wallets
                  </p>
                </div>
              </div>

              <form onSubmit={handleSaveSettings} className="space-y-5 max-w-2xl">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="bg-[#07090d] p-3 rounded-xl border border-[#1f2737]">
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs text-[#8b92a2] font-semibold">
                        Minimum Withdrawal (USDT)
                      </label>
                      <span className="text-[10px] text-amber-400 font-bold">Minimum Threshold</span>
                    </div>
                    <input
                      type="number"
                      step="0.01"
                      value={minWithdrawal}
                      onChange={(e) => setMinWithdrawal(e.target.value)}
                      className="w-full bg-[#0b0e14] border border-[#272a31] focus:border-[#ffd700] rounded-lg px-3 py-2 text-xs text-white font-mono-numbers outline-none font-bold"
                      required
                    />
                    <p className="text-[10px] text-[#9b8f7c] mt-1.5 leading-relaxed">
                      💡 Users must maintain at least this balance to initiate an on-chain withdrawal.
                    </p>
                  </div>

                  <div className="bg-[#07090d] p-3 rounded-xl border border-[#1f2737]">
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs text-[#8b92a2] font-semibold">
                        Maximum Single Withdrawal (USDT)
                      </label>
                      <span className="text-[10px] text-cyan-400 font-bold">Maximum Cap</span>
                    </div>
                    <input
                      type="number"
                      step="0.01"
                      value={maxWithdrawal}
                      onChange={(e) => setMaxWithdrawal(e.target.value)}
                      className="w-full bg-[#0b0e14] border border-[#272a31] focus:border-[#ffd700] rounded-lg px-3 py-2 text-xs text-white font-mono-numbers outline-none font-bold"
                      required
                    />
                    <p className="text-[10px] text-[#9b8f7c] mt-1.5 leading-relaxed">
                      🛡️ Security limit: Maximum allowable USDT disbursed per single withdrawal transaction.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="bg-[#07090d] p-3 rounded-xl border border-[#1f2737]">
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs text-[#8b92a2] font-semibold">
                        Platform House Charge / Fee (%)
                      </label>
                      <span className="text-[10px] text-emerald-400 font-bold">Platform Maintenance</span>
                    </div>
                    <input
                      type="number"
                      min="1"
                      max="20"
                      value={houseFeePercent}
                      onChange={(e) => setHouseFeePercent(e.target.value)}
                      className="w-full bg-[#0b0e14] border border-[#272a31] focus:border-[#ffd700] rounded-lg px-3 py-2 text-xs text-white font-mono-numbers outline-none font-bold"
                      required
                    />
                    <p className="text-[10px] text-[#05d5aa] mt-1.5 leading-relaxed">
                      📌 Deducted automatically during settlement to fund oracle and operational infrastructure.
                    </p>
                  </div>

                  <div className="bg-[#07090d] p-3 rounded-xl border border-[#1f2737]">
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs text-[#8b92a2] font-semibold">
                        Default Winner Pool Share (%)
                      </label>
                      <span className="text-[10px] text-amber-400 font-bold">Winner Allocation</span>
                    </div>
                    <input
                      type="number"
                      min="10"
                      max="100"
                      value={defaultWinnerSharePercent}
                      onChange={(e) => setDefaultWinnerSharePercent(e.target.value)}
                      className="w-full bg-[#0b0e14] border border-[#272a31] focus:border-[#ffd700] rounded-lg px-3 py-2 text-xs text-white font-mono-numbers outline-none font-bold"
                      required
                    />
                    <p className="text-[10px] text-[#9b8f7c] mt-1.5 leading-relaxed">
                      🏆 Percentage of total ticket pool disbursed to the verified winning combination.
                    </p>
                  </div>
                </div>

                <div>
                  <label className="block text-xs text-[#8b92a2] font-semibold mb-1">
                    Official Support Email (Displayed across User Portals)
                  </label>
                  <input
                    type="email"
                    value={supportEmail}
                    onChange={(e) => setSupportEmail(e.target.value)}
                    className="w-full bg-[#07090d] border border-[#272a31] focus:border-[#ffd700] rounded-xl px-3 py-2 text-xs text-white outline-none"
                    required
                  />
                  <p className="text-[10px] text-[#64748b] mt-1">
                    This email is dynamically loaded in Contact Us, Terms & Conditions, and Privacy Policy across the user platform.
                  </p>
                </div>

                <div>
                  <label className="block text-xs text-[#8b92a2] font-semibold mb-1">
                    Master Treasury TRC-20 Address (Disbursement Hot Wallet):
                  </label>
                  <input
                    type="text"
                    value={treasuryTrc20}
                    onChange={(e) => setTreasuryTrc20(e.target.value)}
                    className="w-full bg-[#07090d] border border-[#272a31] focus:border-[#ffd700] rounded-xl px-3 py-2 text-xs text-white font-mono-numbers outline-none"
                    required
                  />
                  <p className="text-[10px] text-[#64748b] mt-1">
                    All automated 24h SLA withdrawals are signed and broadcast from this TRON smart contract address.
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 pt-2">
                  <button
                    type="submit"
                    disabled={isSavingSettings}
                    className="py-3 px-8 rounded-xl btn-gold text-xs font-bold flex items-center gap-2 cursor-pointer shadow-lg shadow-[#f5c451]/20 disabled:opacity-50"
                  >
                    {isSavingSettings ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin text-black" />
                        <span>Syncing Across All User Panels...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle className="w-4 h-4 text-black" />
                        <span>Save Platform Configuration</span>
                      </>
                    )}
                  </button>

                  {lastSavedTime && (
                    <span className="text-[11px] font-mono-numbers text-emerald-400 font-semibold flex items-center gap-1.5 bg-emerald-500/10 px-3 py-2 rounded-xl border border-emerald-500/30 animate-in fade-in">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Live Synced Across User Portals at {lastSavedTime}</span>
                    </span>
                  )}
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* TAB 7: SUPPORT & USER INQUIRIES                                */}
        {/* ============================================================== */}
        {activeAdminTab === 'support' && (
          <div className="space-y-6 animate-in fade-in duration-150">
            {/* Header & KPI */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-[#0d1117] border border-[#272a31] p-5 rounded-2xl">
              <div>
                <div className="flex items-center gap-2">
                  <MessageSquare className="w-5 h-5 text-amber-400" />
                  <h2 className="font-display font-extrabold text-lg text-white">
                    Support & User Inquiries Desk
                  </h2>
                  {pendingSupportCount > 0 && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] bg-red-500/20 text-red-400 border border-red-500/30 font-bold font-mono-numbers animate-pulse">
                      {pendingSupportCount} Pending
                    </span>
                  )}
                </div>
                <p className="text-xs text-[#8b92a2] mt-1">
                  Incoming questions, deposit issues, and withdrawal SLA tickets submitted by users.
                </p>
              </div>

              <button
                type="button"
                onClick={fetchSupportTickets}
                className="px-3.5 py-2 rounded-xl bg-[#141924] hover:bg-[#1a2232] text-xs font-bold text-[#ffd700] border border-[#272a31] flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Refresh Inquiries</span>
              </button>
            </div>

            {/* Filter and Search Bar */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-[#0d1117] border border-[#272a31] p-3 rounded-2xl">
              <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
                {[
                  { id: 'all', label: 'All Inquiries', count: supportTickets.length },
                  { id: 'pending', label: 'Pending', count: supportTickets.filter(t => t.status === 'pending').length },
                  { id: 'replied', label: 'Replied', count: supportTickets.filter(t => t.status === 'replied').length },
                  { id: 'resolved', label: 'Resolved', count: supportTickets.filter(t => t.status === 'resolved').length }
                ].map((f) => (
                  <button
                    key={f.id}
                    onClick={() => setSupportFilter(f.id)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                      supportFilter === f.id
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                        : 'text-[#8b92a2] hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <span>{f.label}</span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-black/40 font-mono-numbers">
                      {f.count}
                    </span>
                  </button>
                ))}
              </div>

              <div className="relative min-w-[240px]">
                <Search className="w-3.5 h-3.5 text-[#8b92a2] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={supportSearchQuery}
                  onChange={(e) => setSupportSearchQuery(e.target.value)}
                  placeholder="Search user, email, problem..."
                  className="w-full bg-[#07090d] border border-[#272a31] focus:border-[#ffd700] rounded-xl pl-8 pr-3 py-1.5 text-xs text-white outline-none"
                />
              </div>
            </div>

            {/* Inquiries List */}
            {filteredSupportTickets.length === 0 ? (
              <div className="text-center py-16 bg-[#0d1117] border border-[#272a31] rounded-2xl p-8 space-y-3">
                <div className="w-12 h-12 mx-auto rounded-xl bg-white/5 flex items-center justify-center text-[#8b92a2]">
                  <Inbox className="w-6 h-6" />
                </div>
                <h3 className="font-display font-bold text-white text-base">
                  No Support Inquiries Found
                </h3>
                <p className="text-xs text-[#8b92a2] max-w-sm mx-auto">
                  {supportSearchQuery || supportFilter !== 'all'
                    ? 'No inquiries match your current search or status filter.'
                    : 'All user queries have been addressed or no messages have been submitted yet.'}
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredSupportTickets.map((ticket) => {
                  const isPending = ticket.status === 'pending';
                  const isReplied = ticket.status === 'replied';
                  const isResolved = ticket.status === 'resolved';

                  // Pre-filled email subject and body
                  const emailSubject = `Re: [EarnFlow Support] ${ticket.subject} (Ticket #${ticket.id})`;
                  const emailBody = `Hello ${ticket.name},\n\nThank you for reaching out to EarnFlow.In Support regarding Ticket #${ticket.id}.\n\nYour Inquiry:\n"${ticket.message}"\n\nResponse:\n\n\n--\nEarnFlow.in Administrative Support Desk\nsupport@earnflow.in`;

                  // Direct Gmail Web Compose link
                  const gmailComposeUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(ticket.email)}&su=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(emailBody)}`;
                  
                  // Default system / mobile mailto link
                  const mailtoUrl = `mailto:${ticket.email}?subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(emailBody)}`;

                  const handleReplyGmail = () => {
                    window.open(gmailComposeUrl, '_blank', 'noopener,noreferrer');
                    if (ticket.status === 'pending') {
                      adminUpdateTicketStatus(ticket.id, 'replied');
                    }
                  };

                  const handleReplyDefaultMail = () => {
                    window.location.href = mailtoUrl;
                    if (ticket.status === 'pending') {
                      adminUpdateTicketStatus(ticket.id, 'replied');
                    }
                  };

                  return (
                    <div
                      key={ticket.id}
                      className={`bg-[#0d1117] border rounded-2xl p-5 sm:p-6 transition-all space-y-4 ${
                        isPending
                          ? 'border-amber-500/40 shadow-[0_0_15px_rgba(245,196,81,0.05)]'
                          : isReplied
                          ? 'border-blue-500/30'
                          : 'border-[#272a31] opacity-80'
                      }`}
                    >
                      {/* Ticket Header */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-[#1f2737]">
                        <div className="flex items-center gap-2.5 flex-wrap">
                          <span className="font-mono-numbers font-black text-amber-400 text-sm">
                            #{ticket.id}
                          </span>
                          <span className="text-xs text-[#8b92a2]">·</span>
                          <span className="px-2.5 py-0.5 rounded-lg bg-[#141924] text-[#ffd700] border border-[#272a31] text-[11px] font-semibold">
                            {ticket.subject}
                          </span>
                        </div>

                        <div className="flex items-center gap-3">
                          <span className="text-[11px] font-mono-numbers text-[#8b92a2]">
                            {ticket.createdAt ? new Date(ticket.createdAt).toLocaleString() : 'Just now'}
                          </span>
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono-numbers font-bold uppercase tracking-wider flex items-center gap-1 ${
                              isPending
                                ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                                : isReplied
                                ? 'bg-blue-500/15 text-blue-400 border border-blue-500/30'
                                : 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                            }`}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full bg-current ${isPending ? 'animate-pulse' : ''}`} />
                            {ticket.status}
                          </span>
                        </div>
                      </div>

                      {/* User Info Bar */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-[#07090d] p-3.5 rounded-xl border border-[#1f2737] text-xs">
                        <div className="flex items-center gap-2">
                          <User className="w-4 h-4 text-amber-400 shrink-0" />
                          <div>
                            <span className="text-[10px] text-[#8b92a2] block">Real Name:</span>
                            <span className="text-white font-bold">{ticket.name}</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <AtSign className="w-4 h-4 text-[#05d5aa] shrink-0" />
                          <div>
                            <span className="text-[10px] text-[#8b92a2] block">User ID / Username:</span>
                            <span className="font-mono-numbers text-white">
                              {ticket.username ? `@${ticket.username}` : (ticket.userId || 'Guest User')}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <Mail className="w-4 h-4 text-[#00f2fe] shrink-0" />
                          <div>
                            <span className="text-[10px] text-[#8b92a2] block">Contact Email:</span>
                            <span className="font-mono-numbers text-emerald-400 font-bold truncate block">
                              {ticket.email}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Message Content */}
                      <div>
                        <span className="text-[11px] text-[#8b92a2] font-semibold block mb-1.5">
                          Problem / Inquiry Details:
                        </span>
                        <div className="bg-[#07090d] p-4 rounded-xl border border-[#272a31] text-xs text-white leading-relaxed whitespace-pre-wrap font-sans">
                          {ticket.message}
                        </div>
                      </div>

                      {/* Action Bar */}
                      <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                        {/* Reply Buttons */}
                        <div className="flex flex-wrap items-center gap-2">
                          {/* Gmail Reply Button */}
                          <button
                            type="button"
                            onClick={handleReplyGmail}
                            className="btn-gold px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-md shadow-[#f5c451]/15"
                            title="Open Google Gmail web composer in a new tab"
                          >
                            <Mail className="w-3.5 h-3.5 text-black" />
                            <span>Reply via Gmail Web</span>
                            <ExternalLink className="w-3 h-3 text-black opacity-70" />
                          </button>

                          {/* Default Mail App (Phone/Laptop) Button */}
                          <button
                            type="button"
                            onClick={handleReplyDefaultMail}
                            className="px-3.5 py-2 rounded-xl bg-[#141924] hover:bg-[#1f2738] text-xs font-bold text-amber-300 border border-amber-500/30 flex items-center gap-1.5 transition-colors cursor-pointer"
                            title="Open phone or computer default mail client (Gmail/Outlook/Mail app)"
                          >
                            <Send className="w-3.5 h-3.5 text-amber-400" />
                            <span>Default Mail App</span>
                          </button>
                        </div>

                        {/* Status & Delete Buttons */}
                        <div className="flex items-center gap-2">
                          {!isReplied && (
                            <button
                              type="button"
                              onClick={() => adminUpdateTicketStatus(ticket.id, 'replied')}
                              className="px-3 py-1.5 rounded-lg bg-blue-950/30 hover:bg-blue-950/60 text-blue-400 border border-blue-500/30 text-xs font-bold transition-colors cursor-pointer"
                            >
                              Mark Replied
                            </button>
                          )}
                          {!isResolved && (
                            <button
                              type="button"
                              onClick={() => adminUpdateTicketStatus(ticket.id, 'resolved')}
                              className="px-3 py-1.5 rounded-lg bg-emerald-950/30 hover:bg-emerald-950/60 text-emerald-400 border border-emerald-500/30 text-xs font-bold transition-colors cursor-pointer flex items-center gap-1"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Mark Resolved</span>
                            </button>
                          )}
                          {isResolved && (
                            <button
                              type="button"
                              onClick={() => adminUpdateTicketStatus(ticket.id, 'pending')}
                              className="px-3 py-1.5 rounded-lg bg-amber-950/30 hover:bg-amber-950/60 text-amber-400 border border-amber-500/30 text-xs font-bold transition-colors cursor-pointer"
                            >
                              Reopen
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => {
                              if (window.confirm(`Delete ticket #${ticket.id}?`)) {
                                adminDeleteTicket(ticket.id);
                              }
                            }}
                            className="p-2 rounded-lg bg-red-950/20 hover:bg-red-950/50 text-red-400 border border-red-500/20 hover:border-red-500/40 transition-colors cursor-pointer"
                            title="Delete Ticket"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
