import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useLottery } from '../context/LotteryContext';
import ProvablyFairModal from '../components/ProvablyFairModal';
import GamesManagementSuperHub from './GamesManagementSuperHub';
import { GAMES } from '../engine';
import { supabase } from '../lib/supabase';
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
  User,
  Download,
  Gamepad2,
  Binary,
  ShieldCheck,
  Gift,
  Share2,
  Menu,
  X,
  Megaphone
} from 'lucide-react';
import ReferralsManagement from './ReferralsManagement';
import SpinWheelManagement from './SpinWheelManagement';
import MonthlyLeaderboardManagement from './MonthlyLeaderboardManagement';
import WinnerPayoutsManagement from './WinnerPayoutsManagement';

interface AdminConsoleProps {
  onLogout?: () => void;
  onSwitchToUserLobby?: () => void;
}

export default function AdminConsole({ onLogout, onSwitchToUserLobby }: AdminConsoleProps) {
  const { 
    user,
    profile,
    events, 
    withdrawals, 
    winnerPayouts = [],
    games = [],
    loadingGames = false,
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
    adminUpdateRewardSettings,
    adminGetRewardsAnalytics,
    showToast,
    getDirectDownloadUrl
  } = useLottery();

  // Navigation tab: 'overview' | 'games-management' | 'pools' | 'games' | 'game-rounds' | 'withdrawals' | 'users' | 'winner-payouts' | 'support' | 'rewards-control' | 'referrals' | 'spin-wheel' | 'monthly-leaderboard' | 'settings'
  const [activeAdminTab, setActiveAdminTab] = useState(() => {
    if (typeof window !== 'undefined') {
      const p = window.location.pathname.toLowerCase();
      if (p.includes('/referrals') || window.location.search.includes('tab=referrals')) return 'referrals';
      if (p.includes('/spin-wheel') || window.location.search.includes('tab=spin-wheel')) return 'spin-wheel';
      if (p.includes('/monthly-leaderboard') || window.location.search.includes('tab=monthly-leaderboard')) return 'monthly-leaderboard';
      if (p.includes('/winner-payouts') || window.location.search.includes('tab=winner-payouts')) return 'winner-payouts';
      if (p.includes('/settings') || window.location.search.includes('tab=settings')) return 'settings';
    }
    return 'overview';
  });
  const [gamesManagementSubTab, setGamesManagementSubTab] = useState('all-games');
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth >= 768 && window.innerWidth < 1024 : false
  );

  const mainScrollRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const prevBodyOverflow = document.body.style.overflow;
    const prevHtmlOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevBodyOverflow;
      document.documentElement.style.overflow = prevHtmlOverflow;
    };
  }, []);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 768) {
        setIsMobileSidebarOpen(false);
        if (window.innerWidth < 1024) {
          setIsSidebarCollapsed(true);
        } else {
          setIsSidebarCollapsed(false);
        }
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const switchAdminTab = (tab: string) => {
    setActiveAdminTab(tab);
    setIsMobileSidebarOpen(false);
    if (mainScrollRef.current) {
      mainScrollRef.current.scrollTop = 0;
    }
    try {
      let targetPath = '/admin';
      if (tab === 'referrals') targetPath = '/admin/referrals';
      else if (tab === 'spin-wheel') targetPath = '/admin/spin-wheel';
      else if (tab === 'monthly-leaderboard') targetPath = '/admin/monthly-leaderboard';
      else if (tab === 'winner-payouts') targetPath = '/admin/winner-payouts';
      else if (tab === 'settings') targetPath = '/admin/settings';
      window.history.replaceState(null, '', targetPath);
    } catch (e) {}
  };

  // Dynamic active games count: Four-Digit Lottery is the exclusive platform game
  const activeGamesCount = useMemo(() => {
    if (Array.isArray(games) && games.length > 0) {
      return games.filter(g => (g.isEnabled !== false && g.status !== 'deleted' && g.status !== 'disabled')).length || 1;
    }
    return 1;
  }, [games]);

  const [auditVerifyModalData, setAuditVerifyModalData] = useState<any>(null);

  // Support Inquiries state
  const [supportFilter, setSupportFilter] = useState('all'); // 'all' | 'pending' | 'replied' | 'resolved'
  const [supportSearchQuery, setSupportSearchQuery] = useState('');

  // User management state
  const [usersList, setUsersList] = useState<any[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState('all');

  // Withdrawals filter state
  const [withdrawalFilter, setWithdrawalFilter] = useState('all');

  // Winner Payouts state
  const [payoutFilter, setPayoutFilter] = useState('all');
  const [editedPayoutAmounts, setEditedPayoutAmounts] = useState<any>({});
  const [manualWinnerUser, setManualWinnerUser] = useState('');
  const [manualWinnerAmount, setManualWinnerAmount] = useState('');
  const [manualWinnerNote, setManualWinnerNote] = useState('Special Seasonal Reward');

  // Bonus & Daily Reward Controls State
  const [bonusRewardSettings, setBonusRewardSettings] = useState({
    enabled: true,
    reward_mode: 'streak', // 'streak' | 'random' | 'fixed'
    fixed_amount: 0.50,
    min_amount: 0.05,
    max_amount: 1.00,
    cooldown_hours: 24,
    eligibility: 'all'
  });

  const [dailyCheckinSettings, setDailyCheckinSettings] = useState({
    enabled: true,
    streak_rewards: {
      day1: 0.10,
      day2: 0.15,
      day3: 0.20,
      day4: 0.25,
      day5: 0.30,
      day6: 0.40,
      day7: 1.00
    },
    full_streak_bonus: 1.00,
    missed_day_policy: 'reset'
  });

  const [rewardsAnalytics, setRewardsAnalytics] = useState<any>({
    total_claims: 0,
    total_distributed_flo: 0,
    active_streaks_count: 0,
    recent_claims: []
  });
  const [loadingRewardsAnalytics, setLoadingRewardsAnalytics] = useState(false);
  const [savingRewardSettings, setSavingRewardSettings] = useState(false);

  const loadRewardsAnalytics = async () => {
    if (!adminGetRewardsAnalytics) return;
    setLoadingRewardsAnalytics(true);
    try {
      const data = await adminGetRewardsAnalytics();
      if (data) {
        setRewardsAnalytics(data);
        if (data.bonus_settings) {
          setBonusRewardSettings(prev => ({ ...prev, ...data.bonus_settings }));
        }
        if (data.checkin_settings) {
          setDailyCheckinSettings(prev => ({ ...prev, ...data.checkin_settings }));
        }
      }
    } catch (e) {
      console.warn('loadRewardsAnalytics error:', e);
    } finally {
      setLoadingRewardsAnalytics(false);
    }
  };

  const handleSaveRewardSettings = async () => {
    if (!adminUpdateRewardSettings) return;
    setSavingRewardSettings(true);
    try {
      await adminUpdateRewardSettings(bonusRewardSettings, dailyCheckinSettings);
      await loadRewardsAnalytics();
    } finally {
      setSavingRewardSettings(false);
    }
  };

  // Create event form state - 100% dynamic, empty by default
  const [eventTitle, setEventTitle] = useState('');
  const [ticketPrice, setTicketPrice] = useState('10');
  const [durationValue, setDurationValue] = useState('60');
  const [durationUnit, setDurationUnit] = useState('minutes'); // 'minutes' | 'hours' | 'days'
  const [prizeType, setPrizeType] = useState('range'); // 'range' | 'fixed'
  const [minPrize, setMinPrize] = useState('10');
  const [maxPrize, setMaxPrize] = useState('50');
  const [initialJackpot, setInitialJackpot] = useState('25000');
  const [eventWinningDigits, setEventWinningDigits] = useState('7429');
  const [eventBadge, setEventBadge] = useState('VIP DRAW');
  const [eventBannerImage, setEventBannerImage] = useState(''); // Empty by default
  const [eventWinnerCount, setEventWinnerCount] = useState('1');

  // Handle local banner file upload from device
  const handleBannerFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      showToast('Image file size must be under 5MB', 'error');
      return;
    }

    const reader = new FileReader();
    reader.onload = (uploadEvt) => {
      setEventBannerImage((uploadEvt.target?.result as string) || '');
      showToast('Event banner photo uploaded from device!', 'success');
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
  const [supportEmail, setSupportEmail] = useState(() => platformSettings?.supportEmail || 'earnflow.user@gmail.com');
  const [usernameChangeFee, setUsernameChangeFee] = useState(() => String(platformSettings?.usernameChangeFee ?? '5.00'));
  const [apkDownloadUrl, setApkDownloadUrl] = useState(() => platformSettings?.apkDownloadUrl || '/download/earnflow.apk');
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [lastSavedTime, setLastSavedTime] = useState<string | null>(null);

  // Sync inputs whenever platformSettings updates from database or another session
  useEffect(() => {
    if (platformSettings) {
      setMinWithdrawal(String(platformSettings.minWithdrawal ?? '5.00'));
      setMaxWithdrawal(String(platformSettings.maxWithdrawal ?? '10000.00'));
      setHouseFeePercent(String(platformSettings.houseFeePercent ?? '5'));
      setSupportEmail(platformSettings.supportEmail || 'earnflow.user@gmail.com');
      setUsernameChangeFee(String(platformSettings.usernameChangeFee ?? '5.00'));
      setApkDownloadUrl(platformSettings.apkDownloadUrl || '/download/earnflow.apk');
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
    if (!eventTitle.trim()) {
      showToast('Please enter an event title', 'error');
      return;
    }
    adminCreateEvent({
      title: eventTitle.trim(),
      ticketPrice,
      durationValue,
      durationUnit,
      minPrize: prizeType === 'range' ? minPrize : null,
      maxPrize: prizeType === 'range' ? maxPrize : null,
      initialSeedJackpot: prizeType === 'fixed' ? initialJackpot : maxPrize,
      targetWinningDigits: eventWinningDigits,
      theme: 'custom',
      badge: eventBadge?.trim() || 'VIP DRAW',
      bannerImage: eventBannerImage ? eventBannerImage.trim() : '',
      winnerCount: parseInt(eventWinnerCount || '1', 10)
    });
    setEventTitle('');
    setEventBannerImage('');
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
    executeDraw(selectedEventId, customDigits, parseInt(drawWinnerCount || '1', 10));
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
        supportEmail,
        usernameChangeFee,
        apkDownloadUrl
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

  const pendingWinnerApprovalCount = winnerPayouts.filter(
    p => p.status === 'pending_approval' || p.status === 'failed'
  ).length;

  const adminNavItems = [
    {
      id: 'overview',
      label: 'Overview',
      icon: LayoutDashboard,
      isActive: activeAdminTab === 'overview',
      onClick: () => switchAdminTab('overview')
    },
    {
      id: 'games-management',
      label: 'Four-Digit Lottery',
      icon: Sparkles,
      isActive:
        activeAdminTab === 'games-management' ||
        activeAdminTab === 'lottery-management' ||
        activeAdminTab === 'pools' ||
        activeAdminTab === 'games',
      badge: activeEvents.length > 0 ? `${activeEvents.length} Live` : 'Live',
      badgeTone: 'amber',
      compactCount: activeEvents.length > 0 ? activeEvents.length : null,
      onClick: () => {
        setGamesManagementSubTab('all-games');
        switchAdminTab('games-management');
      }
    },
    {
      id: 'withdrawals',
      label: '24h Withdrawals',
      icon: Wallet,
      isActive: activeAdminTab === 'withdrawals',
      badge: pendingWithdrawals.length > 0 ? String(pendingWithdrawals.length) : undefined,
      badgeTone: 'amber-solid',
      compactCount: pendingWithdrawals.length > 0 ? pendingWithdrawals.length : null,
      onClick: () => switchAdminTab('withdrawals')
    },
    {
      id: 'users',
      label: 'User Management',
      icon: Users,
      isActive: activeAdminTab === 'users',
      badge: usersList.length > 0 ? String(usersList.length) : undefined,
      badgeTone: 'muted',
      compactCount: null,
      onClick: () => {
        switchAdminTab('users');
        loadUsers();
      }
    },
    {
      id: 'winner-payouts',
      label: 'Winner Payouts (Add USDT)',
      icon: Trophy,
      isActive: activeAdminTab === 'winner-payouts',
      badge: pendingWinnerApprovalCount > 0 ? String(pendingWinnerApprovalCount) : undefined,
      badgeTone: 'emerald-solid',
      compactCount: pendingWinnerApprovalCount > 0 ? pendingWinnerApprovalCount : null,
      onClick: () => {
        switchAdminTab('winner-payouts');
        if (usersList.length === 0) loadUsers();
      }
    },
    {
      id: 'support',
      label: 'Support & Inquiries',
      icon: MessageSquare,
      isActive: activeAdminTab === 'support',
      badge: pendingSupportCount > 0 ? String(pendingSupportCount) : undefined,
      badgeTone: 'red-solid',
      compactCount: pendingSupportCount > 0 ? pendingSupportCount : null,
      onClick: () => {
        switchAdminTab('support');
        fetchSupportTickets();
      }
    },
    {
      id: 'referrals',
      label: 'Referrals & Affiliates',
      icon: Share2,
      isActive: activeAdminTab === 'referrals',
      onClick: () => switchAdminTab('referrals')
    },
    {
      id: 'spin-wheel',
      label: 'Spin Wheel Control',
      icon: Dices,
      isActive: activeAdminTab === 'spin-wheel',
      onClick: () => switchAdminTab('spin-wheel')
    },
    {
      id: 'monthly-leaderboard',
      label: 'Monthly Leaderboard',
      icon: Megaphone,
      isActive: activeAdminTab === 'monthly-leaderboard',
      onClick: () => switchAdminTab('monthly-leaderboard')
    },
    {
      id: 'rewards-control',
      label: 'Bonus & Daily Rewards',
      icon: Gift,
      isActive: activeAdminTab === 'rewards-control',
      onClick: () => {
        switchAdminTab('rewards-control');
        loadRewardsAnalytics();
      }
    },
    {
      id: 'settings',
      label: 'Platform Settings',
      icon: Settings,
      isActive: activeAdminTab === 'settings',
      onClick: () => switchAdminTab('settings')
    }
  ];

  const activeNavMeta = adminNavItems.find((item) => item.isActive) || adminNavItems[0];

  const handleOpenUserLobby = () => {
    if (onSwitchToUserLobby) {
      onSwitchToUserLobby();
    } else {
      sessionStorage.setItem('earnflow_view_mode_user', 'true');
      window.location.hash = '';
      window.location.href = '/';
    }
  };

  return (
    <div className="fixed inset-0 h-dvh w-full bg-[#07090d] text-[#e1e2eb] flex flex-col font-sans overflow-hidden">
      {/* Top Navbar */}
      <header className="shrink-0 relative z-40 h-14 md:h-16 bg-[#0d1117]/95 backdrop-blur-xl border-b border-amber-500/25 px-2.5 sm:px-4 md:px-6 flex items-center justify-between gap-2 min-w-0">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          {/* Mobile Drawer Hamburger (< md: 320px, 375px, 425px) */}
          <button
            type="button"
            onClick={() => setIsMobileSidebarOpen((prev) => !prev)}
            aria-label={isMobileSidebarOpen ? 'Close admin navigation' : 'Open admin navigation'}
            aria-expanded={isMobileSidebarOpen}
            className="md:hidden w-9 h-9 rounded-xl bg-[#141924] hover:bg-[#1b2232] border border-[#272a31] hover:border-amber-500/40 text-amber-400 flex items-center justify-center transition-colors cursor-pointer shrink-0"
          >
            {isMobileSidebarOpen ? <X className="w-4.5 h-4.5" /> : <Menu className="w-4.5 h-4.5" />}
          </button>

          {/* Desktop/Tablet Sidebar Collapse Toggle (md+: 768px, 1024px) */}
          <button
            type="button"
            data-testid="admin-desktop-sidebar-toggle"
            onClick={() => setIsSidebarCollapsed((prev) => !prev)}
            aria-label={isSidebarCollapsed ? 'Expand admin sidebar' : 'Collapse admin sidebar'}
            aria-expanded={!isSidebarCollapsed}
            title={isSidebarCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
            className="hidden md:flex w-9 h-9 rounded-xl bg-[#141924] hover:bg-[#1b2232] border border-[#272a31] hover:border-amber-500/40 text-amber-400 items-center justify-center transition-colors cursor-pointer shrink-0"
          >
            <Menu className="w-4.5 h-4.5" />
          </button>

          <div className="w-8 h-8 md:w-9 md:h-9 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 p-0.5 shadow-[0_0_15px_rgba(245,196,81,0.3)] shrink-0">
            <img src="/logo.png" alt="EarnFlow Admin" className="w-full h-full rounded-full object-cover" />
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
              <span className="font-display font-extrabold text-sm sm:text-base text-white truncate">
                EarnFlow<span className="text-amber-400">.In</span>
              </span>
              <span className="hidden md:inline-block text-[10px] font-mono-numbers px-2 py-0.5 rounded bg-amber-500/15 text-amber-400 border border-amber-500/30 font-bold uppercase tracking-wider whitespace-nowrap shrink-0">
                SUPER ADMIN
              </span>
            </div>
            <p className="text-[10px] text-[#9b8f7c] hidden lg:block truncate">
              Sovereign Decentralized Cryptographic Governance
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {user && (
            <div className="hidden lg:flex items-center gap-2 bg-[#141924] px-3 py-1.5 rounded-xl border border-[#272a31]">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
              <span className="text-xs font-mono-numbers text-white font-bold max-w-[130px] truncate">
                @{profile?.username || user?.email?.split('@')[0]}
              </span>
            </div>
          )}

          <button
            type="button"
            onClick={handleOpenUserLobby}
            className="px-2.5 sm:px-3 py-1.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-xs font-bold text-amber-300 border border-amber-500/30 flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
            title="Open Live Public User Platform"
            aria-label="Open User Lobby"
          >
            <ExternalLink className="w-3.5 h-3.5 shrink-0" />
            <span className="hidden md:inline whitespace-nowrap">User Lobby</span>
          </button>

          <button
            type="button"
            onClick={onLogout}
            className="px-2.5 sm:px-3 py-1.5 rounded-xl bg-red-950/30 hover:bg-red-950/60 text-xs font-bold text-red-400 border border-red-500/30 flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
            title="Lock & Sign Out"
            aria-label="Lock and Sign Out"
          >
            <LogOut className="w-3.5 h-3.5 shrink-0" />
            <span className="hidden md:inline whitespace-nowrap">Lock &amp; Sign Out</span>
          </button>
        </div>
      </header>

      {/* Mobile Navigation Drawer (< md: 320px, 375px, 425px) */}
      {isMobileSidebarOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          <div
            className="fixed inset-0 bg-black/75 backdrop-blur-xs"
            onClick={() => setIsMobileSidebarOpen(false)}
          />
          <aside className="relative z-10 w-[272px] max-w-[85vw] h-full bg-[#0b0e14] border-r border-amber-500/25 flex flex-col shadow-2xl animate-in slide-in-from-left duration-200">
            <div className="px-4 py-3.5 border-b border-[#1f2737] flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 p-0.5 shrink-0">
                  <img src="/logo.png" alt="EarnFlow Admin" className="w-full h-full rounded-full object-cover" />
                </div>
                <div className="min-w-0">
                  <div className="font-display font-extrabold text-xs text-white truncate">Admin Console</div>
                  <div className="text-[9px] font-mono-numbers text-amber-400 uppercase font-bold">Super Admin</div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsMobileSidebarOpen(false)}
                aria-label="Close admin sidebar drawer"
                className="w-8 h-8 rounded-lg bg-[#141924] text-[#9b8f7c] hover:text-white border border-[#272a31] flex items-center justify-center cursor-pointer shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <nav className="flex-1 min-h-0 overflow-y-auto overscroll-contain no-scrollbar p-2.5 space-y-1">
              {adminNavItems.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={item.onClick}
                    className={`w-full px-3 py-2.5 rounded-xl text-xs font-bold flex items-center justify-between gap-2 transition-all cursor-pointer text-left ${
                      item.isActive
                        ? 'bg-gradient-to-r from-amber-400 to-amber-500 text-black shadow-md font-black'
                        : 'text-[#9ba3b4] hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <span className="flex items-center gap-2.5 min-w-0">
                      <Icon className="w-4 h-4 shrink-0" />
                      <span className="truncate">{item.label}</span>
                    </span>
                    {item.badge && (
                      <span
                        className={`px-1.5 py-0.5 rounded-full text-[9px] font-mono-numbers font-bold shrink-0 ${
                          item.isActive
                            ? 'bg-black/25 text-black'
                            : item.badgeTone === 'amber'
                              ? 'bg-black/40 text-amber-300'
                              : item.badgeTone === 'amber-solid'
                                ? 'bg-amber-500 text-black'
                                : item.badgeTone === 'emerald-solid'
                                  ? 'bg-emerald-500 text-black'
                                  : item.badgeTone === 'red-solid'
                                    ? 'bg-red-500 text-white'
                                    : 'bg-black/40 text-[#9ba3b4]'
                        }`}
                      >
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>

            <div className="p-3 border-t border-[#1f2737] space-y-2 bg-[#07090d]">
              <button
                type="button"
                onClick={handleOpenUserLobby}
                className="w-full px-3 py-2 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-xs font-bold text-amber-300 border border-amber-500/30 flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Open User Lobby</span>
              </button>
              <button
                type="button"
                onClick={onLogout}
                className="w-full px-3 py-2 rounded-xl bg-red-950/30 hover:bg-red-950/60 text-xs font-bold text-red-400 border border-red-500/30 flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Lock &amp; Sign Out</span>
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* Workspace Body: Fixed Tablet/Laptop Sidebar + Independently Scrollable Main Content */}
      <div className="flex-1 min-h-0 flex min-w-0 overflow-hidden relative">
        {/* Permanently Fixed Left Sidebar (md: 768px & lg: 1024px) */}
        <aside
          data-testid="admin-desktop-sidebar"
          className={`hidden md:flex flex-col fixed top-14 md:top-16 bottom-0 left-0 z-30 bg-[#0a0d13] border-r border-[#1f2737] transition-all duration-200 overflow-hidden ${
            isSidebarCollapsed ? 'w-[72px]' : 'w-60 lg:w-64'
          }`}
        >
          <div className={`shrink-0 px-3 py-2.5 border-b border-[#1f2737]/80 flex items-center ${isSidebarCollapsed ? 'justify-center' : 'justify-between'}`}>
            {!isSidebarCollapsed && (
              <span className="text-[10px] font-mono-numbers font-bold uppercase tracking-wider text-[#64748b]">
                Admin Modules
              </span>
            )}
            <span className="text-[10px] font-mono-numbers px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 font-bold">
              {adminNavItems.length}
            </span>
          </div>

          <nav className="flex-1 min-h-0 overflow-y-auto overscroll-contain no-scrollbar p-2 space-y-1">
            {adminNavItems.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={item.onClick}
                  title={item.label}
                  className={`relative w-full rounded-xl text-xs font-bold flex items-center transition-all cursor-pointer ${
                    isSidebarCollapsed
                      ? 'justify-center h-11 px-0'
                      : 'justify-between px-3 py-2.5 gap-2 text-left'
                  } ${
                    item.isActive
                      ? 'bg-gradient-to-r from-amber-400 to-amber-500 text-black shadow-md font-black'
                      : 'text-[#8b92a2] hover:text-white hover:bg-white/5'
                  }`}
                >
                  <span className={`flex items-center ${isSidebarCollapsed ? 'justify-center' : 'gap-2.5 min-w-0'}`}>
                    <Icon className="w-4 h-4 shrink-0" />
                    {!isSidebarCollapsed && (
                      <span className="leading-snug text-left">{item.label}</span>
                    )}
                  </span>

                  {!isSidebarCollapsed && item.badge && (
                    <span
                      className={`px-1.5 py-0.5 rounded-full text-[9px] font-mono-numbers font-bold shrink-0 ${
                        item.isActive
                          ? 'bg-black/25 text-black'
                          : item.badgeTone === 'amber'
                            ? 'bg-black/40 text-amber-300'
                            : item.badgeTone === 'amber-solid'
                              ? 'bg-amber-500 text-black'
                              : item.badgeTone === 'emerald-solid'
                                ? 'bg-emerald-500 text-black'
                                : item.badgeTone === 'red-solid'
                                  ? 'bg-red-500 text-white'
                                  : 'bg-black/40 text-[#9ba3b4]'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}

                  {isSidebarCollapsed && item.compactCount !== null && item.compactCount !== undefined && (
                    <span className="absolute top-1 right-1 min-w-[16px] h-4 px-1 rounded-full bg-amber-400 text-black text-[9px] font-mono-numbers font-black flex items-center justify-center shadow">
                      {item.compactCount}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </aside>

        {/* Independent Scrollable Main Admin Content Container */}
        <main
          ref={mainScrollRef}
          data-testid="admin-main-scroll"
          aria-hidden={isMobileSidebarOpen || undefined}
          className={`flex-1 min-w-0 w-full h-full overflow-x-hidden overscroll-contain transition-[padding] duration-200 ${
            isMobileSidebarOpen ? 'overflow-hidden pointer-events-none select-none' : 'overflow-y-auto'
          } ${isSidebarCollapsed ? 'md:pl-[72px]' : 'md:pl-60 lg:pl-64'}`}
        >
          <div className="w-full max-w-7xl mx-auto px-2.5 xs:px-3.5 sm:px-5 md:px-6 lg:px-7 py-3.5 sm:py-5 space-y-4 sm:space-y-6">
          {/* Mobile Active Section Context Pill (< md) */}
          <div className="md:hidden flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-[#0d1117] border border-[#272a31]">
            <div className="flex items-center gap-2 min-w-0">
              {(() => {
                const ActiveIcon = activeNavMeta.icon;
                return <ActiveIcon className="w-4 h-4 text-amber-400 shrink-0" />;
              })()}
              <span className="font-display font-bold text-xs text-white truncate">
                {activeNavMeta.label}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setIsMobileSidebarOpen(true)}
              className="text-[11px] font-bold text-amber-400 hover:text-amber-300 cursor-pointer shrink-0"
            >
              Switch Section
            </button>
          </div>

        {/* ============================================================== */}
        {/* TAB 1: OVERVIEW DASHBOARD                                      */}
        {/* ============================================================== */}
        {activeAdminTab === 'overview' && (
          <div className="space-y-4 sm:space-y-6 animate-in fade-in duration-150">
            {/* KPI Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              <div className="bg-[#0d1117] border border-[#272a31] p-4 rounded-2xl relative overflow-hidden shadow-lg">
                <div className="flex items-center justify-between text-[#8b92a2] mb-2 gap-2">
                  <span className="text-[11px] font-semibold uppercase tracking-wider">Active Jackpot Pots</span>
                  <DollarSign className="w-4 h-4 text-amber-400 shrink-0" />
                </div>
                <div className="text-xl font-mono-numbers font-black text-amber-400">
                  {totalPoolPrize.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  <span className="text-xs text-amber-400/80 font-normal ml-1">USDT</span>
                </div>
                <div className="text-[11px] text-[#9b8f7c] mt-1 flex items-center gap-1">
                  <span>Across {activeEvents.length} active live pools</span>
                </div>
              </div>

              <div className="bg-[#0d1117] border border-[#272a31] p-4 rounded-2xl relative overflow-hidden shadow-lg">
                <div className="flex items-center justify-between text-[#8b92a2] mb-2 gap-2">
                  <span className="text-[11px] font-semibold uppercase tracking-wider">Total Tickets Sold</span>
                  <Flame className="w-4 h-4 text-[#05d5aa] shrink-0" />
                </div>
                <div className="text-xl font-mono-numbers font-black text-white">
                  {totalTicketsSold.toLocaleString()}
                </div>
                <div className="text-[11px] text-[#05d5aa] mt-1 flex items-center gap-1 font-medium">
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                  <span>Provably fair hashed entries</span>
                </div>
              </div>

              <div className="bg-[#0d1117] border border-[#272a31] p-4 rounded-2xl relative overflow-hidden shadow-lg">
                <div className="flex items-center justify-between text-[#8b92a2] mb-2 gap-2">
                  <span className="text-[11px] font-semibold uppercase tracking-wider">Pending 24h Payouts</span>
                  <Clock className="w-4 h-4 text-orange-400 shrink-0" />
                </div>
                <div className="text-xl font-mono-numbers font-black text-orange-400">
                  {pendingWithdrawals.length}
                  <span className="text-xs text-[#9b8f7c] font-normal ml-1.5 font-mono">
                    ({totalPendingAmount.toFixed(2)} USDT)
                  </span>
                </div>
                <div className="text-[11px] text-[#9b8f7c] mt-1">
                  Guaranteed 24-hour settlement
                </div>
              </div>

              <div className="bg-[#0d1117] border border-[#272a31] p-4 rounded-2xl relative overflow-hidden shadow-lg">
                <div className="flex items-center justify-between text-[#8b92a2] mb-2 gap-2">
                  <span className="text-[11px] font-semibold uppercase tracking-wider">Registered Players</span>
                  <Users className="w-4 h-4 text-sky-400 shrink-0" />
                </div>
                <div className="text-xl font-mono-numbers font-black text-white">
                  {usersList.length}
                </div>
                <div className="text-[11px] text-sky-400 mt-1 flex items-center gap-1 font-medium">
                  <Shield className="w-3.5 h-3.5 shrink-0" />
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
                    Deploy new USDT pools, run 4-digit provably fair draw settling, and fulfill 24-hour withdrawals.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => switchAdminTab('games-management')}
                  className="px-3.5 py-2 rounded-xl btn-gold text-xs font-bold cursor-pointer"
                >
                  Deploy Pool
                </button>
                <button
                  type="button"
                  onClick={() => switchAdminTab('withdrawals')}
                  className="px-3.5 py-2 rounded-xl bg-[#141924] hover:bg-[#1a2130] text-xs font-bold text-white border border-[#272a31] cursor-pointer"
                >
                  Review Withdrawals ({pendingWithdrawals.length})
                </button>
              </div>
            </div>

            {/* Live Pool Summary Table */}
            <div className="bg-[#0d1117] border border-[#272a31] rounded-2xl p-4 sm:p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Layers className="w-4 h-4 text-amber-400 shrink-0" />
                  <h3 className="font-display font-bold text-sm text-white">
                    Active Lottery Pools Snapshot
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => switchAdminTab('games-management')}
                  className="text-xs text-amber-400 hover:underline font-semibold cursor-pointer"
                >
                  Manage All Pools →
                </button>
              </div>

              <div className="overflow-x-auto no-scrollbar">
                <table className="w-full min-w-[580px] text-left text-xs">
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
        {/* UNIFIED GAMES MANAGEMENT SUPER-HUB (7 DEDICATED SECTIONS)     */}
        {/* ============================================================== */}
        {(activeAdminTab === 'games-management' || activeAdminTab === 'pools' || activeAdminTab === 'games' || activeAdminTab === 'game-rounds') && (
          <GamesManagementSuperHub
            initialSubTab={gamesManagementSubTab}
            events={events}
            activeEvents={activeEvents}
            eventTitle={eventTitle}
            setEventTitle={setEventTitle}
            ticketPrice={ticketPrice}
            setTicketPrice={setTicketPrice}
            durationValue={durationValue}
            setDurationValue={setDurationValue}
            durationUnit={durationUnit}
            setDurationUnit={setDurationUnit}
            prizeType={prizeType}
            setPrizeType={setPrizeType}
            minPrize={minPrize}
            setMinPrize={setMinPrize}
            maxPrize={maxPrize}
            setMaxPrize={setMaxPrize}
            initialJackpot={initialJackpot}
            setInitialJackpot={setInitialJackpot}
            eventWinningDigits={eventWinningDigits}
            setEventWinningDigits={setEventWinningDigits}
            eventBadge={eventBadge}
            setEventBadge={setEventBadge}
            eventBannerImage={eventBannerImage}
            setEventBannerImage={setEventBannerImage}
            handleBannerFileUpload={handleBannerFileUpload}
            eventWinnerCount={eventWinnerCount}
            setEventWinnerCount={setEventWinnerCount}
            handleCreateSubmit={handleCreateSubmit}
            selectedEventId={selectedEventId}
            setSelectedEventId={setSelectedEventId}
            drawWinnerCount={drawWinnerCount}
            setDrawWinnerCount={setDrawWinnerCount}
            customDigits={customDigits}
            setCustomDigits={setCustomDigits}
            handleTriggerDraw={handleTriggerDraw}
            adminDeleteEvent={adminDeleteEvent}
            showToast={showToast}
          />
        )}

        {/* ============================================================== */}
        {/* TAB 3: 24-HOUR SLA WITHDRAWALS MANAGER                         */}
        {/* ============================================================== */}
        {activeAdminTab === 'withdrawals' && (
          <div className="space-y-6 animate-in fade-in duration-150">
            {/* Header info & filters */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3.5 bg-[#0d1117] p-4 sm:p-5 rounded-2xl border border-[#272a31]">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <Clock className="w-5 h-5 text-amber-400 shrink-0" />
                  <h3 className="font-display font-bold text-sm sm:text-base text-white">
                    24-Hour Withdrawal Disbursal Manager
                  </h3>
                </div>
                <p className="text-xs text-[#9b8f7c] mt-0.5 leading-relaxed">
                  Approve and broadcast TRC-20 USDT withdrawals to user addresses within the 24-hour guarantee
                </p>
              </div>

              {/* Status Filter buttons */}
              <div className="flex flex-wrap items-center gap-1.5 bg-[#07090d] p-1 rounded-xl border border-[#1f2737] w-full sm:w-auto">
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
                <table className="w-full min-w-[720px] text-left text-xs">
                  <thead className="bg-[#07090d] text-[#8b92a2] uppercase text-[10px] tracking-wider border-b border-[#1f2737]">
                    <tr>
                      <th className="py-3.5 px-4">Order ID</th>
                      <th className="py-3.5 px-4">Destination Address (TRC-20)</th>
                      <th className="py-3.5 px-4">Net Disbursal</th>
                      <th className="py-3.5 px-4">Status / Window</th>
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
                                  {order.address || order.destination_address || '—'}
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
                                Within 24 Hours
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
                <table className="w-full min-w-[720px] text-left text-xs">
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
          <WinnerPayoutsManagement usersList={usersList} />
        )}

        {/* ============================================================== */}
        {/* TAB 5: PLATFORM SETTINGS & GOVERNANCE                         */}
        {/* ============================================================== */}
        {activeAdminTab === 'settings' && (
          <div className="space-y-4 sm:space-y-6 animate-in fade-in duration-150">
            <div className="bg-[#0d1117] border border-[#272a31] rounded-2xl p-4 sm:p-6 space-y-5 shadow-lg">
              <div className="flex items-start sm:items-center gap-3 pb-3 border-b border-[#1f2737]">
                <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center shrink-0">
                  <Settings className="w-4.5 h-4.5 text-amber-400" />
                </div>
                <div className="min-w-0">
                  <h3 className="font-display font-bold text-sm sm:text-base text-white">
                    Platform Governance &amp; Financial Settings
                  </h3>
                  <p className="text-xs text-[#9b8f7c] mt-0.5 leading-relaxed">
                    Configure global withdrawal limits, server-side Platform House Charge percentage, and user portal settings.
                  </p>
                </div>
              </div>

              <form onSubmit={handleSaveSettings} className="space-y-4 sm:space-y-5 w-full">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 sm:gap-4">
                  <div className="bg-[#07090d] p-3.5 sm:p-4 rounded-xl border border-[#1f2737] flex flex-col justify-between gap-2 min-w-0">
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center justify-between gap-1.5">
                        <label className="text-xs text-[#e1e2eb] font-semibold">
                          Minimum Withdrawal (USDT)
                        </label>
                        <span className="text-[10px] px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 font-bold shrink-0">
                          Min Limit
                        </span>
                      </div>
                      <input
                        type="number"
                        step="0.01"
                        value={minWithdrawal}
                        onChange={(e) => setMinWithdrawal(e.target.value)}
                        className="w-full min-w-0 bg-[#0b0e14] border border-[#272a31] focus:border-[#ffd700] rounded-lg px-3 py-2 text-xs text-white font-mono-numbers outline-none font-bold"
                        required
                      />
                    </div>
                    <p className="text-[11px] text-[#9b8f7c] leading-relaxed">
                      Users must maintain at least this balance to initiate an on-chain withdrawal.
                    </p>
                  </div>

                  <div className="bg-[#07090d] p-3.5 sm:p-4 rounded-xl border border-[#1f2737] flex flex-col justify-between gap-2 min-w-0">
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center justify-between gap-1.5">
                        <label className="text-xs text-[#e1e2eb] font-semibold">
                          Maximum Single Withdrawal (USDT)
                        </label>
                        <span className="text-[10px] px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 font-bold shrink-0">
                          Max Cap
                        </span>
                      </div>
                      <input
                        type="number"
                        step="0.01"
                        value={maxWithdrawal}
                        onChange={(e) => setMaxWithdrawal(e.target.value)}
                        className="w-full min-w-0 bg-[#0b0e14] border border-[#272a31] focus:border-[#ffd700] rounded-lg px-3 py-2 text-xs text-white font-mono-numbers outline-none font-bold"
                        required
                      />
                    </div>
                    <p className="text-[11px] text-[#9b8f7c] leading-relaxed">
                      Security limit: Maximum allowable USDT disbursed per single withdrawal transaction.
                    </p>
                  </div>

                  <div className="bg-[#07090d] p-3.5 sm:p-4 rounded-xl border border-[#1f2737] flex flex-col justify-between gap-2 min-w-0">
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center justify-between gap-1.5">
                        <label className="text-xs text-[#e1e2eb] font-semibold">
                          Platform House Charge (%)
                        </label>
                        <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold shrink-0">
                          House Fee
                        </span>
                      </div>
                      <input
                        type="number"
                        min="0"
                        max="30"
                        step="0.1"
                        data-testid="platform-house-charge-input"
                        value={houseFeePercent}
                        onChange={(e) => setHouseFeePercent(e.target.value)}
                        className="w-full min-w-0 bg-[#0b0e14] border border-[#272a31] focus:border-[#ffd700] rounded-lg px-3 py-2 text-xs text-white font-mono-numbers outline-none font-bold"
                        required
                      />
                    </div>
                    <p className="text-[11px] text-[#05d5aa]/90 leading-relaxed">
                      Server-side commission percentage deducted from gross ticket sales on every new ticket purchase (0%–30%).
                    </p>
                  </div>

                  <div className="bg-[#07090d] p-3.5 sm:p-4 rounded-xl border border-[#1f2737] flex flex-col justify-between gap-2 min-w-0">
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center justify-between gap-1.5">
                        <label className="text-xs text-[#e1e2eb] font-semibold">
                          Username Change Fee (USDT)
                        </label>
                        <span className="text-[10px] px-2 py-0.5 rounded bg-purple-500/10 text-purple-300 border border-purple-500/20 font-bold shrink-0">
                          1st Edit Free
                        </span>
                      </div>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={usernameChangeFee}
                        onChange={(e) => setUsernameChangeFee(e.target.value)}
                        className="w-full min-w-0 bg-[#0b0e14] border border-[#272a31] focus:border-[#ffd700] rounded-lg px-3 py-2 text-xs text-white font-mono-numbers outline-none font-bold"
                        required
                      />
                    </div>
                    <p className="text-[11px] text-[#a78bfa] leading-relaxed">
                      1st edit is 100% Free Lifetime. Subsequent modifications deduct this USDT fee from wallet balance.
                    </p>
                  </div>

                  <div className="bg-[#07090d] p-3.5 sm:p-4 rounded-xl border border-[#1f2737] flex flex-col justify-between gap-2 min-w-0">
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center justify-between gap-1.5">
                        <label className="text-xs text-[#e1e2eb] font-semibold">
                          Official Support Email
                        </label>
                        <span className="text-[10px] px-2 py-0.5 rounded bg-white/5 text-[#9b8f7c] border border-[#272a31] font-bold shrink-0">
                          User Portals
                        </span>
                      </div>
                      <input
                        type="email"
                        value={supportEmail}
                        onChange={(e) => setSupportEmail(e.target.value)}
                        className="w-full min-w-0 bg-[#0b0e14] border border-[#272a31] focus:border-[#ffd700] rounded-lg px-3 py-2 text-xs text-white outline-none"
                        required
                      />
                    </div>
                    <p className="text-[11px] text-[#8b92a2] leading-relaxed">
                      Displayed across Contact Us, Terms &amp; Conditions, and Privacy Policy pages.
                    </p>
                  </div>
                </div>

                {/* Android APK Download URL Settings */}
                <div className="bg-[#07090d] p-3.5 sm:p-4 rounded-xl border border-[#1f2737] space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <label className="text-xs text-white font-bold flex items-center gap-2 min-w-0">
                      <Download className="w-4 h-4 text-[#ffd700] shrink-0" />
                      <span>Official Android App (APK) Download Source</span>
                    </label>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-bold shrink-0">
                      Google Drive Auto Direct-Download
                    </span>
                  </div>

                  <input
                    type="text"
                    value={apkDownloadUrl}
                    onChange={(e) => setApkDownloadUrl(e.target.value)}
                    placeholder="https://drive.google.com/file/d/.../view?usp=sharing or /download/earnflow.apk"
                    className="w-full min-w-0 bg-[#0b0e14] border border-[#272a31] focus:border-[#ffd700] rounded-lg px-3 py-2.5 text-xs text-white font-mono-numbers outline-none"
                    required
                  />

                  <div className="space-y-2 text-[11px]">
                    {apkDownloadUrl?.includes('drive.google.com') ? (
                      <div className="p-2.5 rounded-lg bg-emerald-950/20 border border-emerald-500/30 text-emerald-300 space-y-1">
                        <div className="flex items-center gap-1.5 font-bold text-xs text-emerald-400">
                          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                          <span>Google Drive Link Detected &amp; Handled</span>
                        </div>
                        <p className="text-[10px] text-emerald-200/80 leading-relaxed">
                          Users clicking &quot;Download APK&quot; directly download the APK without Google Drive web preview.
                        </p>
                        {getDirectDownloadUrl && (
                          <div className="text-[10px] font-mono-numbers text-emerald-400/90 break-all bg-black/40 p-1.5 rounded mt-1">
                            Direct Link: {getDirectDownloadUrl(apkDownloadUrl)}
                          </div>
                        )}
                      </div>
                    ) : (
                      <p className="text-[10px] text-[#9b8f7c] leading-relaxed">
                        <strong>How to use Google Drive:</strong> Upload your compiled APK &rarr; Share &rarr; Anyone with the link &rarr; paste here for automatic direct APK download.
                      </p>
                    )}

                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      <a
                        href={getDirectDownloadUrl ? getDirectDownloadUrl(apkDownloadUrl) : apkDownloadUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#141924] hover:bg-[#1f2738] border border-[#ffd700]/30 text-[#ffd700] text-xs font-bold transition-colors cursor-pointer"
                        title="Test whether the direct download link triggers properly"
                      >
                        <Download className="w-3.5 h-3.5 shrink-0" />
                        <span>Test Direct Download Link</span>
                      </a>
                      <span className="text-[10px] text-[#8b92a2] leading-relaxed">
                        (App download buttons are hidden when browsing inside the Android App)
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center gap-3 pt-2">
                  <button
                    type="submit"
                    disabled={isSavingSettings}
                    className="w-full sm:w-auto justify-center py-3 px-6 sm:px-8 rounded-xl btn-gold text-xs font-bold flex items-center gap-2 cursor-pointer shadow-lg shadow-[#f5c451]/20 disabled:opacity-50"
                  >
                    {isSavingSettings ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin text-black shrink-0" />
                        <span>Syncing Across All User Panels...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle className="w-4 h-4 text-black shrink-0" />
                        <span>Save Platform Configuration</span>
                      </>
                    )}
                  </button>

                  {lastSavedTime && (
                    <span className="text-[11px] font-mono-numbers text-emerald-400 font-semibold flex items-center gap-1.5 bg-emerald-500/10 px-3 py-2 rounded-xl border border-emerald-500/30 animate-in fade-in">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span>Live Synced Across User Portals at {lastSavedTime}</span>
                    </span>
                  )}
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* TAB: REFERRALS & AFFILIATE MANAGEMENT                           */}
        {/* ============================================================== */}
        {activeAdminTab === 'referrals' && <ReferralsManagement />}

        {/* ============================================================== */}
        {/* TAB: DAILY BONUS SPIN WHEEL MANAGEMENT                         */}
        {/* ============================================================== */}
        {activeAdminTab === 'spin-wheel' && <SpinWheelManagement />}

        {/* ============================================================== */}
        {/* TAB: MONTHLY LEADERBOARD ANNOUNCEMENT & PRIZES                 */}
        {/* ============================================================== */}
        {activeAdminTab === 'monthly-leaderboard' && (
          <MonthlyLeaderboardManagement
            onGoToWinnerPayouts={() => {
              switchAdminTab('winner-payouts');
              if (usersList.length === 0) loadUsers();
            }}
          />
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
                  Incoming questions, deposit issues, and withdrawal tickets submitted by users.
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

              <div className="relative w-full sm:w-64 min-w-0">
                <Search className="w-3.5 h-3.5 text-[#8b92a2] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={supportSearchQuery}
                  onChange={(e) => setSupportSearchQuery(e.target.value)}
                  placeholder="Search user, email, problem..."
                  className="w-full min-w-0 bg-[#07090d] border border-[#272a31] focus:border-[#ffd700] rounded-xl pl-8 pr-3 py-1.5 text-xs text-white outline-none"
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
                  const emailBody = `Hello ${ticket.name},\n\nThank you for reaching out to EarnFlow.in Support regarding Ticket #${ticket.id}.\n\nYour Inquiry:\n"${ticket.message}"\n\nResponse:\n\n\n--\nEarnFlow.in Administrative Support Desk\nsupport@earnflow.in`;

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

        {/* ============================================================== */}
        {/* TAB: BONUS & DAILY REWARDS MANAGEMENT                           */}
        {/* ============================================================== */}
        {activeAdminTab === 'rewards-control' && (
          <div className="space-y-6 animate-in fade-in duration-150">
            
            {/* Header, Status & Save Actions */}
            <div className="bg-[#0d1117] border border-[#272a31] rounded-2xl p-5 sm:p-6 shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-black font-black shadow-md">
                    <Gift className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="font-display font-black text-lg sm:text-xl text-white">
                      Bonus & Daily Check-In Reward Controls
                    </h2>
                    <p className="text-xs text-[#8b92a2]">
                      Server-authoritative bonus distribution, 7-day streak ladder, and ledger analytics
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2.5 self-stretch md:self-auto shrink-0">
                <button
                  type="button"
                  onClick={loadRewardsAnalytics}
                  disabled={loadingRewardsAnalytics}
                  className="px-3.5 py-2.5 rounded-xl bg-[#141924] hover:bg-[#1a2130] text-xs font-bold text-white border border-[#272a31] flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  title="Refresh analytics and settings"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loadingRewardsAnalytics ? 'animate-spin text-amber-400' : ''}`} />
                  <span>Refresh</span>
                </button>

                <button
                  type="button"
                  onClick={handleSaveRewardSettings}
                  disabled={savingRewardSettings}
                  className="flex-1 sm:flex-initial px-4 sm:px-5 py-2.5 rounded-xl btn-gold text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-lg shadow-amber-500/20"
                >
                  {savingRewardSettings ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Saving to DB...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>Save All Reward Settings</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Quick KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-[#0d1117] border border-[#272a31] rounded-2xl p-5 space-y-1">
                <div className="flex items-center justify-between text-xs text-[#8b92a2]">
                  <span className="font-bold uppercase tracking-wider">Total Claims Processed</span>
                  <Award className="w-4 h-4 text-amber-400" />
                </div>
                <div className="text-2xl font-black font-mono-numbers text-white">
                  {rewardsAnalytics?.total_claims || 0}
                </div>
                <div className="text-[11px] text-[#8b92a2]">
                  Atomic database transactions
                </div>
              </div>

              <div className="bg-[#0d1117] border border-[#272a31] rounded-2xl p-5 space-y-1">
                <div className="flex items-center justify-between text-xs text-[#8b92a2]">
                  <span className="font-bold uppercase tracking-wider">Total USDT Rewards Awarded</span>
                  <Coins className="w-4 h-4 text-emerald-400" />
                </div>
                <div className="text-2xl font-black font-mono-numbers text-emerald-400">
                  {Number(rewardsAnalytics?.total_distributed_flo || 0).toFixed(2)} USDT
                </div>
                <div className="text-[11px] text-white/60 font-mono-numbers">
                  TRC-20 Promotional Ledger
                </div>
              </div>

              <div className="bg-[#0d1117] border border-[#272a31] rounded-2xl p-5 space-y-1">
                <div className="flex items-center justify-between text-xs text-[#8b92a2]">
                  <span className="font-bold uppercase tracking-wider">Active Streak Users</span>
                  <Flame className="w-4 h-4 text-orange-400" />
                </div>
                <div className="text-2xl font-black font-mono-numbers text-amber-400">
                  {rewardsAnalytics?.active_streaks_count || 0}
                </div>
                <div className="text-[11px] text-[#8b92a2]">
                  Users currently tracking 7-day ladder
                </div>
              </div>
            </div>

            {/* Grid of Section A & Section B */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              
              {/* SECTION A: MASTER BONUS REWARD CONTROLS */}
              <div className="bg-[#0d1117] border border-[#272a31] rounded-2xl p-5 sm:p-6 space-y-5 shadow-lg">
                <div className="flex items-center justify-between border-b border-[#272a31] pb-3">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-amber-400" />
                    <h3 className="font-display font-black text-sm sm:text-base text-white">
                      Bonus Rewards Configuration
                    </h3>
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={bonusRewardSettings.enabled}
                      onChange={(e) => setBonusRewardSettings(prev => ({ ...prev, enabled: e.target.checked }))}
                      className="sr-only"
                    />
                    <div className={`w-11 h-6 rounded-full transition-colors relative ${bonusRewardSettings.enabled ? 'bg-amber-400' : 'bg-gray-700'}`}>
                      <div className={`w-4 h-4 rounded-full bg-black absolute top-1 transition-transform ${bonusRewardSettings.enabled ? 'left-6' : 'left-1'}`} />
                    </div>
                    <span className="text-xs font-bold text-white">
                      {bonusRewardSettings.enabled ? 'Enabled' : 'Paused'}
                    </span>
                  </label>
                </div>

                <div className="space-y-4">
                  {/* Reward Mode */}
                  <div>
                    <label className="block text-xs font-bold text-[#8b92a2] uppercase tracking-wider mb-1.5">
                      Reward Distribution Mode
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      {[
                        { id: 'streak', label: '7-Day Streak', desc: 'Progression ladder' },
                        { id: 'random', label: 'Random Range', desc: 'Min to Max USDT' },
                        { id: 'fixed', label: 'Flat Fixed', desc: 'Static amount' }
                      ].map((mode) => (
                        <button
                          key={mode.id}
                          type="button"
                          onClick={() => setBonusRewardSettings(prev => ({ ...prev, reward_mode: mode.id }))}
                          className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                            bonusRewardSettings.reward_mode === mode.id
                              ? 'bg-amber-500/15 border-amber-400 text-amber-300'
                              : 'bg-[#141924] border-[#272a31] text-[#8b92a2] hover:text-white'
                          }`}
                        >
                          <div className="text-xs font-bold">{mode.label}</div>
                          <div className="text-[10px] text-[#8b92a2]">{mode.desc}</div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Mode Specific Inputs */}
                  {bonusRewardSettings.reward_mode === 'fixed' && (
                    <div>
                      <label className="block text-xs font-bold text-[#8b92a2] uppercase tracking-wider mb-1.5">
                        Fixed Bonus Amount (USDT)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0.01"
                        max="1.00"
                        value={bonusRewardSettings.fixed_amount}
                        onChange={(e) => setBonusRewardSettings(prev => ({ ...prev, fixed_amount: parseFloat(e.target.value) || 0.10 }))}
                        className="w-full px-3.5 py-2.5 bg-[#141924] border border-[#272a31] rounded-xl text-white text-xs font-mono-numbers focus:border-amber-400 outline-none"
                      />
                      <span className="text-[10px] text-[#8b92a2] mt-1 block">
                        Maximum allowable single bonus is 1.00 USDT.
                      </span>
                    </div>
                  )}

                  {bonusRewardSettings.reward_mode === 'random' && (
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-bold text-[#8b92a2] uppercase tracking-wider mb-1.5">
                          Min Amount (USDT)
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          min="0.01"
                          max="1.00"
                          value={bonusRewardSettings.min_amount}
                          onChange={(e) => setBonusRewardSettings(prev => ({ ...prev, min_amount: parseFloat(e.target.value) || 0.05 }))}
                          className="w-full px-3.5 py-2.5 bg-[#141924] border border-[#272a31] rounded-xl text-white text-xs font-mono-numbers focus:border-amber-400 outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-[#8b92a2] uppercase tracking-wider mb-1.5">
                          Max Amount (USDT)
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          min="0.01"
                          max="1.00"
                          value={bonusRewardSettings.max_amount}
                          onChange={(e) => setBonusRewardSettings(prev => ({ ...prev, max_amount: parseFloat(e.target.value) || 1.00 }))}
                          className="w-full px-3.5 py-2.5 bg-[#141924] border border-[#272a31] rounded-xl text-white text-xs font-mono-numbers focus:border-amber-400 outline-none"
                        />
                      </div>
                    </div>
                  )}

                  {/* Cooldown Hours */}
                  <div>
                    <label className="block text-xs font-bold text-[#8b92a2] uppercase tracking-wider mb-1.5">
                      Claim Interval / Cooldown Period (Hours)
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="168"
                      value={bonusRewardSettings.cooldown_hours}
                      onChange={(e) => setBonusRewardSettings(prev => ({ ...prev, cooldown_hours: parseInt(e.target.value, 10) || 24 }))}
                      className="w-full px-3.5 py-2.5 bg-[#141924] border border-[#272a31] rounded-xl text-white text-xs font-mono-numbers focus:border-amber-400 outline-none"
                    />
                    <span className="text-[10px] text-[#8b92a2] mt-1 block">
                      Default: 24 hours (enforces once-daily claim).
                    </span>
                  </div>

                  {/* Eligibility */}
                  <div>
                    <label className="block text-xs font-bold text-[#8b92a2] uppercase tracking-wider mb-1.5">
                      User Eligibility Criteria
                    </label>
                    <select
                      value={bonusRewardSettings.eligibility}
                      onChange={(e) => setBonusRewardSettings(prev => ({ ...prev, eligibility: e.target.value }))}
                      className="w-full px-3.5 py-2.5 bg-[#141924] border border-[#272a31] rounded-xl text-white text-xs focus:border-amber-400 outline-none"
                    >
                      <option value="all">All Registered Users & Guests</option>
                      <option value="verified">Verified Email / Auth Only</option>
                      <option value="vip">VIP Tier 1+ Only</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* SECTION B: 7-DAY DAILY CHECK-IN STREAK SYSTEM */}
              <div className="bg-[#0d1117] border border-[#272a31] rounded-2xl p-5 sm:p-6 space-y-5 shadow-lg">
                <div className="flex items-center justify-between border-b border-[#272a31] pb-3">
                  <div className="flex items-center gap-2">
                    <Flame className="w-4 h-4 text-orange-400" />
                    <h3 className="font-display font-black text-sm sm:text-base text-white">
                      7-Day Daily Check-In Management
                    </h3>
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={dailyCheckinSettings.enabled}
                      onChange={(e) => setDailyCheckinSettings(prev => ({ ...prev, enabled: e.target.checked }))}
                      className="sr-only"
                    />
                    <div className={`w-11 h-6 rounded-full transition-colors relative ${dailyCheckinSettings.enabled ? 'bg-amber-400' : 'bg-gray-700'}`}>
                      <div className={`w-4 h-4 rounded-full bg-black absolute top-1 transition-transform ${dailyCheckinSettings.enabled ? 'left-6' : 'left-1'}`} />
                    </div>
                    <span className="text-xs font-bold text-white">
                      {dailyCheckinSettings.enabled ? 'Active' : 'Disabled'}
                    </span>
                  </label>
                </div>

                <div className="space-y-4">
                  {/* Missed Day Policy */}
                  <div>
                    <label className="block text-xs font-bold text-[#8b92a2] uppercase tracking-wider mb-1.5">
                      Missed-Day Streak Policy
                    </label>
                    <div className="grid grid-cols-1 xs:grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setDailyCheckinSettings(prev => ({ ...prev, missed_day_policy: 'reset' }))}
                        className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                          dailyCheckinSettings.missed_day_policy === 'reset'
                            ? 'bg-amber-500/15 border-amber-400 text-amber-300'
                            : 'bg-[#141924] border-[#272a31] text-[#8b92a2] hover:text-white'
                        }`}
                      >
                        <div className="text-xs font-bold">Reset to Day 1</div>
                        <div className="text-[10px] text-[#8b92a2]">Daily commitment incentive</div>
                      </button>

                      <button
                        type="button"
                        onClick={() => setDailyCheckinSettings(prev => ({ ...prev, missed_day_policy: 'continue' }))}
                        className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                          dailyCheckinSettings.missed_day_policy === 'continue'
                            ? 'bg-amber-500/15 border-amber-400 text-amber-300'
                            : 'bg-[#141924] border-[#272a31] text-[#8b92a2] hover:text-white'
                        }`}
                      >
                        <div className="text-xs font-bold">Keep Progress</div>
                        <div className="text-[10px] text-[#8b92a2]">Lenient check-in retention</div>
                      </button>
                    </div>
                  </div>

                  {/* 7 Days Reward Inputs */}
                  <div>
                    <label className="block text-xs font-bold text-[#8b92a2] uppercase tracking-wider mb-2">
                      Daily Streak Reward Ladder (USDT TRC-20)
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                      {[1, 2, 3, 4, 5, 6, 7].map((day) => {
                        const dayKey = `day${day}`;
                        const currentVal = dailyCheckinSettings.streak_rewards?.[dayKey] ?? (day === 7 ? 1.00 : 0.10 * day);
                        return (
                          <div key={day} className="p-2.5 rounded-xl bg-[#141924] border border-[#272a31] space-y-1">
                            <span className="text-[10px] font-mono-numbers font-bold text-[#8b92a2] block">
                              Day {day} {day === 7 ? '★ Jackpot' : ''}
                            </span>
                            <div className="relative">
                              <input
                                type="number"
                                step="0.01"
                                min="0.01"
                                max="1.00"
                                value={currentVal}
                                onChange={(e) => {
                                  const val = Math.min(1.00, Math.max(0.01, parseFloat(e.target.value) || 0.05));
                                  setDailyCheckinSettings(prev => ({
                                    ...prev,
                                    streak_rewards: {
                                      ...(prev.streak_rewards || {}),
                                      [dayKey]: val
                                    }
                                  }));
                                }}
                                className="w-full px-2 py-1.5 bg-[#0b0e14] border border-[#272a31] rounded-lg text-white text-xs font-mono-numbers font-bold focus:border-amber-400 outline-none"
                              />
                            </div>
                            <span className="text-[9px] text-amber-400/80 font-mono-numbers block">
                              = ${Number(currentVal).toFixed(2)} USDT
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* USDT Rewards Notice */}
                  <div className="p-3 rounded-xl bg-purple-500/10 border border-purple-500/20 text-xs text-purple-300 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 shrink-0 text-purple-400" />
                    <span>Exclusive currency policy: All rewards, bonuses, and faucet credits are disbursed in USDT (TRC-20).</span>
                  </div>
                </div>
              </div>

            </div>

            {/* SECTION C: RECENT BONUS CLAIMS & AUDIT LOG */}
            <div className="bg-[#0d1117] border border-[#272a31] rounded-2xl p-5 sm:p-6 space-y-4 shadow-lg">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-display font-black text-sm sm:text-base text-white">
                    Recent Daily Bonus Claims
                  </h3>
                  <p className="text-xs text-[#8b92a2]">
                    Server ledger records of recently claimed daily rewards
                  </p>
                </div>
                <span className="px-2.5 py-1 rounded-lg bg-white/5 text-[11px] font-mono-numbers font-bold text-[#8b92a2]">
                  {rewardsAnalytics?.recent_claims?.length || 0} Recent Records
                </span>
              </div>

              {rewardsAnalytics?.recent_claims && rewardsAnalytics.recent_claims.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-[#272a31] text-[#8b92a2] uppercase tracking-wider text-[10px]">
                        <th className="py-2.5 px-3">Wallet / User</th>
                        <th className="py-2.5 px-3">Amount</th>
                        <th className="py-2.5 px-3">USDT Value</th>
                        <th className="py-2.5 px-3">Description</th>
                        <th className="py-2.5 px-3">Date & Time</th>
                        <th className="py-2.5 px-3">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#272a31]/50 font-mono-numbers">
                      {rewardsAnalytics.recent_claims.map((claim, idx) => (
                        <tr key={claim.id || idx} className="hover:bg-white/2 transition-colors">
                          <td className="py-3 px-3 text-white font-medium">
                            {claim.wallet_address ? `${claim.wallet_address.slice(0, 6)}...${claim.wallet_address.slice(-4)}` : 'System'}
                          </td>
                          <td className="py-3 px-3 text-emerald-400 font-bold">
                            +{parseFloat(claim.amount || 0).toFixed(2)} USDT
                          </td>
                          <td className="py-3 px-3 text-purple-300 font-mono text-xs">
                            TRC-20
                          </td>
                          <td className="py-3 px-3 text-[#8b92a2] font-sans truncate max-w-xs">
                            {claim.description || 'Daily USDT Reward'}
                          </td>
                          <td className="py-3 px-3 text-[#8b92a2]">
                            {new Date(claim.created_at).toLocaleString()}
                          </td>
                          <td className="py-3 px-3">
                            <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 text-[10px] font-bold border border-emerald-500/30">
                              Completed
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="py-8 text-center text-xs text-[#8b92a2] italic">
                  No daily reward claims recorded yet. Claims will appear here in real-time as users claim rewards.
                </div>
              )}
            </div>

          </div>
        )}

        {/* Universal Provably Fair Audit Modal */}
        {auditVerifyModalData && (
          <ProvablyFairModal
            isOpen={!!auditVerifyModalData}
            onClose={() => setAuditVerifyModalData(null)}
            auditData={auditVerifyModalData}
          />
        )}
          </div>
        </main>
      </div>
    </div>
  );
}
