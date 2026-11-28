/**
 * ============================================================================
 * REWARDS, VIP LOYALTY & DAILY LUCKY WHEEL — EARNFLOW.IN
 * ============================================================================
 * Integrates:
 * 1. Compact VIP Loyalty Progression Card (Bronze -> Obsidian) with XP tracking
 * 2. Interactive 8-Segment SVG Daily Lucky Wheel with physical spin physics & audio
 * 3. Seven-Day Consecutive Login Streak Check-In Faucet (Cards above Claim button)
 * 4. Milestone Achievements tracking
 */

import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { useLottery } from '../context/LotteryContext';
import { useSoundFX } from '../hooks/useSoundFX';
import {
  Gift,
  Sparkles,
  Calendar,
  Coins,
  CheckCircle2,
  Clock,
  Flame,
  RotateCcw,
  Lock,
  Gem,
  Award,
  ShieldCheck
} from 'lucide-react';
import confetti from 'canvas-confetti';

const WHEEL_SLICES = [
  { index: 0, amount: 0.10, label: '0.10 USDT', color: '#B45309', textColor: '#FEF3C7', border: '#D97706' },
  { index: 1, amount: 0.20, label: '0.20 USDT', color: '#475569', textColor: '#F1F5F9', border: '#64748B' },
  { index: 2, amount: 0.25, label: '0.25 USDT', color: '#854D0E', textColor: '#FEF9C3', border: '#CA8A04' },
  { index: 3, amount: 0.50, label: '0.50 USDT', color: '#065F46', textColor: '#D1FAE5', border: '#059669' },
  { index: 4, amount: 0.75, label: '0.75 USDT', color: '#1E40AF', textColor: '#DBEAFE', border: '#2563EB' },
  { index: 5, amount: 1.00, label: '1.00 USDT', color: '#991B1B', textColor: '#FEE2E2', border: '#DC2626' },
  { index: 6, amount: 2.00, label: '2.00 USDT', color: '#581C87', textColor: '#F3E8FF', border: '#7C3AED' },
  { index: 7, amount: 5.00, label: '5.00 USDT', color: '#B45309', textColor: '#FFFBEB', border: '#F59E0B', isJackpot: true }
];

const DEFAULT_STREAK_REWARDS = [0.10, 0.15, 0.20, 0.25, 0.30, 0.40, 1.00];

const ACHIEVEMENTS = [
  {
    id: 'first_bet',
    title: 'First Roll',
    description: 'Place your first bet on any gaming event or lottery',
    reward: 0.5,
    progress: 0,
    unlocked: false,
    icon: 'dice'
  },
  {
    id: 'high_roller',
    title: 'High Roller',
    description: 'Place a single wager of 10 USDT or higher',
    reward: 1.0,
    progress: 0,
    unlocked: false,
    icon: 'crown'
  },
  {
    id: 'lucky_streak',
    title: 'Lucky Multiplier',
    description: 'Hit any outcome with multiplier >= 5.0x',
    reward: 1.5,
    progress: 0,
    unlocked: false,
    icon: 'zap'
  },
  {
    id: 'games_veteran',
    title: 'Game Explorer',
    description: 'Participate across available games on EarnFlow.in',
    reward: 2.0,
    progress: 0,
    unlocked: false,
    icon: 'compass'
  },
  {
    id: 'century_club',
    title: 'USDT High Roller',
    description: 'Accumulate a balance of 100 USDT or more',
    reward: 5.0,
    progress: 0,
    unlocked: false,
    icon: 'gem'
  }
];

function AchievementHeadingEmblem() {
  return (
    <div
      data-testid="achievements-emblem"
      aria-hidden="true"
      className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-gradient-to-br from-[#1C160A] via-[#131926] to-[#0B0F19] border border-amber-400/50 shadow-[0_0_18px_rgba(245,196,81,0.24)] flex items-center justify-center shrink-0"
    >
      <svg viewBox="0 0 40 40" className="w-6 h-6 sm:w-7 sm:h-7" fill="none">
        <defs>
          <linearGradient id="efGoldTrophy" x1="6" y1="4" x2="34" y2="36" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#FFF4B8" />
            <stop offset="45%" stopColor="#F5C451" />
            <stop offset="100%" stopColor="#D97706" />
          </linearGradient>
          <linearGradient id="efGoldBase" x1="12" y1="27" x2="28" y2="36" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#FBBF24" />
            <stop offset="100%" stopColor="#92400E" />
          </linearGradient>
        </defs>
        {/* Left & right laurel handles */}
        <path
          d="M11 10H7.5C6.4 10 5.5 10.9 5.5 12V13.8C5.5 17 7.8 19.6 10.9 20.1"
          stroke="url(#efGoldTrophy)"
          strokeWidth="2.2"
          strokeLinecap="round"
        />
        <path
          d="M29 10H32.5C33.6 10 34.5 10.9 34.5 12V13.8C34.5 17 32.2 19.6 29.1 20.1"
          stroke="url(#efGoldTrophy)"
          strokeWidth="2.2"
          strokeLinecap="round"
        />
        {/* Trophy cup silhouette */}
        <path
          d="M11 7.5C11 6.7 11.7 6 12.5 6H27.5C28.3 6 29 6.7 29 7.5V15.5C29 20.4 25.1 24.4 20 24.4C14.9 24.4 11 20.4 11 15.5V7.5Z"
          fill="url(#efGoldTrophy)"
        />
        {/* Inner crest star */}
        <path
          d="M20 10L21.45 12.95L24.7 13.42L22.35 15.7L22.9 18.93L20 17.4L17.1 18.93L17.65 15.7L15.3 13.42L18.55 12.95L20 10Z"
          fill="#0B0F19"
          fillOpacity="0.85"
        />
        {/* Stem & pedestal */}
        <path d="M18 24.2H22V28.5H18V24.2Z" fill="url(#efGoldBase)" />
        <rect x="13" y="28.5" width="14" height="3.2" rx="1.2" fill="url(#efGoldTrophy)" />
        <rect x="10.5" y="32" width="19" height="3" rx="1.4" fill="url(#efGoldBase)" />
      </svg>
    </div>
  );
}

function renderAchievementIcon(
  iconKey: string,
  state: 'claimed' | 'completed' | 'in_progress' | 'locked'
) {
  const palette =
    state === 'claimed'
      ? { primary: '#34D399', secondary: '#059669', highlight: '#A7F3D0', ring: '#10B981' }
      : state === 'completed'
        ? { primary: '#FCD34D', secondary: '#D97706', highlight: '#FEF3C7', ring: '#F59E0B' }
        : state === 'in_progress'
          ? { primary: '#F5C451', secondary: '#B45309', highlight: '#FDE68A', ring: '#D97706' }
          : { primary: '#94A3B8', secondary: '#475569', highlight: '#CBD5E1', ring: '#334155' };

  switch (iconKey) {
    case 'dice':
      // First Roll — Gaming Die & Fortune Sparkle SVG
      return (
        <svg viewBox="0 0 36 36" className="w-6 h-6" fill="none" aria-hidden="true">
          <rect
            x="6.5"
            y="8.5"
            width="19"
            height="19"
            rx="4.5"
            fill={palette.secondary}
            fillOpacity="0.28"
            stroke={palette.primary}
            strokeWidth="2"
          />
          <circle cx="12" cy="14" r="1.7" fill={palette.highlight} />
          <circle cx="20" cy="14" r="1.7" fill={palette.highlight} />
          <circle cx="16" cy="18" r="1.9" fill={palette.primary} />
          <circle cx="12" cy="22" r="1.7" fill={palette.highlight} />
          <circle cx="20" cy="22" r="1.7" fill={palette.highlight} />
          <path
            d="M27.5 5.5L28.6 8.4L31.5 9.5L28.6 10.6L27.5 13.5L26.4 10.6L23.5 9.5L26.4 8.4L27.5 5.5Z"
            fill={palette.primary}
          />
        </svg>
      );
    case 'crown':
      // High Roller — VIP Imperial Crown SVG
      return (
        <svg viewBox="0 0 36 36" className="w-6 h-6" fill="none" aria-hidden="true">
          <path
            d="M6.5 25L4.5 12L12.5 17.5L18 9L23.5 17.5L31.5 12L29.5 25H6.5Z"
            fill={palette.secondary}
            fillOpacity="0.35"
            stroke={palette.primary}
            strokeWidth="2"
            strokeLinejoin="round"
          />
          <rect x="7" y="26.5" width="22" height="3" rx="1.5" fill={palette.primary} />
          <circle cx="18" cy="19.5" r="2" fill={palette.highlight} />
          <circle cx="11.5" cy="20.5" r="1.3" fill={palette.primary} />
          <circle cx="24.5" cy="20.5" r="1.3" fill={palette.primary} />
        </svg>
      );
    case 'zap':
      // Lucky Multiplier — Winning Medal + Surge Bolt SVG
      return (
        <svg viewBox="0 0 36 36" className="w-6 h-6" fill="none" aria-hidden="true">
          <circle
            cx="18"
            cy="18"
            r="12"
            fill={palette.secondary}
            fillOpacity="0.25"
            stroke={palette.ring}
            strokeWidth="2"
          />
          <circle cx="18" cy="18" r="9.2" stroke={palette.primary} strokeWidth="1.2" strokeDasharray="2.5 2.5" />
          <path
            d="M19.8 8.8L12.6 19.2H17.6L16.2 27.2L23.6 16.5H18.4L19.8 8.8Z"
            fill={palette.primary}
            stroke={palette.highlight}
            strokeWidth="0.9"
            strokeLinejoin="round"
          />
        </svg>
      );
    case 'compass':
      // Game Explorer — Gaming Star Crest SVG
      return (
        <svg viewBox="0 0 36 36" className="w-6 h-6" fill="none" aria-hidden="true">
          <circle
            cx="18"
            cy="18"
            r="12"
            fill={palette.secondary}
            fillOpacity="0.25"
            stroke={palette.primary}
            strokeWidth="2"
          />
          <path
            d="M23.8 12.2L19.9 19.9L12.2 23.8L16.1 16.1L23.8 12.2Z"
            fill={palette.primary}
            stroke={palette.highlight}
            strokeWidth="1"
            strokeLinejoin="round"
          />
          <circle cx="18" cy="18" r="1.8" fill="#0B0F19" />
          <path d="M18 4.2V7M18 29V31.8M4.2 18H7M29 18H31.8" stroke={palette.primary} strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      );
    case 'gem':
      // USDT High Roller — Hexagon Wallet Vault / USDT Emblem SVG
      return (
        <svg viewBox="0 0 36 36" className="w-6 h-6" fill="none" aria-hidden="true">
          <path
            d="M18 4.8L29.5 11.4V24.6L18 31.2L6.5 24.6V11.4L18 4.8Z"
            fill={palette.secondary}
            fillOpacity="0.3"
            stroke={palette.primary}
            strokeWidth="2"
            strokeLinejoin="round"
          />
          <path d="M11.8 12.5H24.2" stroke={palette.highlight} strokeWidth="2.2" strokeLinecap="round" />
          <path d="M18 12.5V24.8" stroke={palette.primary} strokeWidth="2.4" strokeLinecap="round" />
          <ellipse cx="18" cy="18" rx="6.6" ry="2.2" stroke={palette.highlight} strokeWidth="1.5" />
        </svg>
      );
    default:
      return (
        <svg viewBox="0 0 36 36" className="w-6 h-6" fill="none" aria-hidden="true">
          <path
            d="M18 6L21.4 13L29 14.1L23.5 19.4L24.8 27L18 23.4L11.2 27L12.5 19.4L7 14.1L14.6 13L18 6Z"
            fill={palette.primary}
          />
        </svg>
      );
  }
}

export default function RewardsView() {
  const {
    wallet,
    setWallet,
    user,
    isVipMember,
    claimDailyBonus,
    claimDailyFloReward,
    getDailyFloRewardStatus,
    showToast,
    setIsAuthModalOpen,
    fetchWalletLedger,
    platformSettings
  } = useLottery();
  const { playClick, playRouletteSpin, playDialTick, playWinFanfare } = useSoundFX();

  // VIP State
  const [vipData, setVipData] = useState<any>(null);
  const [vipLoading, setVipLoading] = useState(false);

  // Wheel State
  const [wheelRotation, setWheelRotation] = useState(0);
  const [isSpinningWheel, setIsSpinningWheel] = useState(false);
  const [wheelCooldownSeconds, setWheelCooldownSeconds] = useState(0);
  const [recentPrize, setRecentPrize] = useState<any>(null);

  // Unified 7-Day Daily Streak State
  const [dailyRewardStatus, setDailyRewardStatus] = useState<any>({
    canClaim: true,
    secondsRemaining: 0,
    availableReward: 0.10,
    currentStreak: 1,
    highestStreak: 0,
    nextStreak: 2,
    nextRewardAmount: 0.15,
    checkinSettings: null
  });
  const [isClaimingStreak, setIsClaimingStreak] = useState(false);

  // Achievements
  const [claimedAchievements, setClaimedAchievements] = useState<string[]>([]);

  // Fetch Unified Daily Streak Status from Database
  const refreshDailyRewardStatus = async () => {
    if (getDailyFloRewardStatus) {
      const status = await getDailyFloRewardStatus();
      setDailyRewardStatus(status);
    }
  };

  useEffect(() => {
    refreshDailyRewardStatus();
  }, [wallet?.address, user?.id, isVipMember]);

  // Tick countdown timer for streak cooldown
  useEffect(() => {
    if (dailyRewardStatus.secondsRemaining <= 0) return;
    const interval = setInterval(() => {
      setDailyRewardStatus((prev: any) => {
        if (prev.secondsRemaining <= 1) {
          refreshDailyRewardStatus();
          return { ...prev, canClaim: true, secondsRemaining: 0 };
        }
        return { ...prev, secondsRemaining: prev.secondsRemaining - 1 };
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [dailyRewardStatus.secondsRemaining]);

  // Claim Unified Daily Reward
  const handleClaimDailyStreak = async () => {
    if (isClaimingStreak || !dailyRewardStatus.canClaim) return;

    if (!user || !wallet?.address) {
      showToast('Please log in with your account to claim your daily reward!', 'info');
      setIsAuthModalOpen(true);
      return;
    }

    setIsClaimingStreak(true);
    playClick();

    try {
      const fn = claimDailyFloReward || claimDailyBonus;
      const res = await fn();
      if (res?.success) {
        playWinFanfare('big');
        await refreshDailyRewardStatus();
        fetchVipStatus();
      }
    } finally {
      setIsClaimingStreak(false);
    }
  };

  // Load VIP Status and Cooldowns (Authenticated Only)
  const fetchVipStatus = async () => {
    if (!user?.id || !wallet?.address) return;
    setVipLoading(true);
    try {
      const { data, error } = await supabase.rpc('get_or_update_user_vip', {
        p_wallet_address: wallet.address,
        p_user_id: user?.id || null
      });

      if (!error && data?.success) {
        setVipData(data);

        // Check wheel cooldown
        if (data.last_wheel_spin_at) {
          const lastTime = new Date(data.last_wheel_spin_at).getTime();
          const elapsed = (Date.now() - lastTime) / 1000;
          if (elapsed < 86400) {
            setWheelCooldownSeconds(Math.ceil(86400 - elapsed));
          } else {
            setWheelCooldownSeconds(0);
          }
        }
      }
    } catch (err) {
      console.warn('fetchVipStatus error:', err);
    } finally {
      setVipLoading(false);
    }
  };

  useEffect(() => {
    fetchVipStatus();
  }, [wallet?.address, user?.id]);

  // Cooldown countdown interval
  useEffect(() => {
    if (wheelCooldownSeconds <= 0) return;
    const interval = setInterval(() => {
      setWheelCooldownSeconds(prev => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [wheelCooldownSeconds]);

  // Format seconds to HH:MM:SS
  const formatCooldown = (secs: number) => {
    const safeSecs = Math.max(0, Math.floor(Number(secs) || 0));
    const h = Math.floor(safeSecs / 3600);
    const m = Math.floor((safeSecs % 3600) / 60);
    const s = safeSecs % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // Sync wheel segments and eligibility with admin configuration & player category
  const spinConfig = platformSettings?.spinWheelSettings || {};
  const spinVipRewardMode =
    String(spinConfig.vip_reward_mode || '').toLowerCase() === 'custom' ? 'custom' : 'double_normal';
  const spinEnabledForUser =
    spinConfig.is_active !== false &&
    spinConfig.enabled !== false &&
    (isVipMember ? spinConfig.enabled_for_vip !== false : spinConfig.enabled_for_normal !== false);

  const wheelSlices = useMemo(() => {
    const cfgSegments = spinConfig?.segments;
    const baseList = Array.isArray(cfgSegments) && cfgSegments.length === 8 ? cfgSegments : WHEEL_SLICES;
    return WHEEL_SLICES.map((fallback, idx) => {
      const match = baseList.find((s: any) => Number(s.index) === idx) ?? baseList[idx] ?? fallback;
      const normalAmount = Number(match.usdt_amount ?? match.amount ?? fallback.amount);
      const customVipAmount = Number(
        match.vip_usdt_amount ?? match.vip_amount ?? Math.round(normalAmount * 2 * 100) / 100
      );
      const effectiveAmount = isVipMember
        ? spinVipRewardMode === 'custom'
          ? customVipAmount
          : Math.round(normalAmount * 2 * 100) / 100
        : normalAmount;
      return {
        ...fallback,
        index: idx,
        amount: effectiveAmount,
        label: `${effectiveAmount.toFixed(2)} USDT`,
        color: match.color || fallback.color,
        textColor: match.textColor || fallback.textColor,
        isJackpot: idx === WHEEL_SLICES.length - 1 || effectiveAmount >= 5
      };
    });
  }, [spinConfig?.segments, spinVipRewardMode, isVipMember]);

  // Spin the Lucky Wheel
  const handleSpinWheel = async () => {
    if (isSpinningWheel) return;

    if (!spinEnabledForUser) {
      showToast(
        isVipMember
          ? 'Daily Spin Wheel is currently disabled for VIP Players by administrator.'
          : 'Daily Spin Wheel is currently disabled for Normal Players by administrator.',
        'info'
      );
      return;
    }

    if (!user || !wallet?.address) {
      showToast('Please log in with your account to spin the Lucky Wheel!', 'info');
      setIsAuthModalOpen(true);
      return;
    }

    if (wheelCooldownSeconds > 0) {
      showToast(`Lucky Wheel is on 24-hour cooldown! Next free spin in ${formatCooldown(wheelCooldownSeconds)}`, 'info');
      return;
    }

    setIsSpinningWheel(true);
    setRecentPrize(null);
    playClick();

    try {
      // 1. Authoritative Server Prize Determination via RPC
      const { data, error } = await supabase.rpc('spin_lucky_wheel', {
        p_user_address: wallet.address,
        p_user_id: user?.id || null
      });

      if (error || !data || !data.success) {
        showToast(data?.error || error?.message || 'Failed to spin Lucky Wheel', 'error');
        setIsSpinningWheel(false);
        return;
      }

      // Target slice calculation
      const sliceIdx = data.slice_index !== undefined ? data.slice_index : 0;
      const sliceAngle = 360 / 8; // 45 degrees
      const targetAngleWithinSlice = 22.5; // center of slice
      // Arrow is at the top (270 deg / 0 deg in SVG).
      // Angle to rotate so sliceIdx lands under the top marker:
      const sliceCenter = sliceIdx * sliceAngle + targetAngleWithinSlice;
      const extraSpins = 360 * 5; // 5 full revolutions
      const nextRotation = wheelRotation + extraSpins + (360 - (sliceCenter % 360));

      setWheelRotation(nextRotation);
      playRouletteSpin();

      // Periodic ratchet sound ticks during rotation
      const tickInterval = setInterval(() => {
        playDialTick();
      }, 180);

      // Animation duration: 3.8s
      setTimeout(() => {
        clearInterval(tickInterval);
        setIsSpinningWheel(false);
        setRecentPrize(data);
        setWheelCooldownSeconds(86400);

        // Win Audio & Celebration (USDT Currency)
        if (Number(data.final_prize) >= 2.50) {
          playWinFanfare('jackpot');
        } else {
          playWinFanfare('big');
        }

        confetti({
          particleCount: 100,
          spread: 80,
          origin: { y: 0.6 },
          colors: ['#ffd700', '#f5c451', '#22c55e', '#a855f7']
        });

        showToast(`🎉 You won ${Number(data.final_prize).toFixed(2)} USDT on the Lucky Wheel!`, 'success');

        if (data.new_balance !== undefined && typeof setWallet === 'function') {
          setWallet((prev: any) => ({ ...prev, balance: parseFloat(data.new_balance) }));
        }
        if (fetchWalletLedger) fetchWalletLedger();
        fetchVipStatus();
      }, 3800);
    } catch (err: any) {
      console.error('handleSpinWheel error:', err);
      showToast(err.message || 'Error spinning wheel', 'error');
      setIsSpinningWheel(false);
    }
  };

  // Claim Achievement
  const handleClaimAchievement = (ach: (typeof ACHIEVEMENTS)[number]) => {
    if (claimedAchievements.includes(ach.id) || !ach.unlocked) return;
    playClick();
    setClaimedAchievements(prev => [...prev, ach.id]);
    playWinFanfare('standard');
    showToast(`Achievement Unlocked: +${ach.reward} USDT added!`, 'success');

    try {
      confetti({
        particleCount: 60,
        spread: 60,
        origin: { y: 0.6 },
        colors: ['#F5C451', '#22C55E']
      });
    } catch (_) {
      // Ignore confetti environment errors
    }
  };

  const getVipBadge = (tier: string) => {
    switch ((tier || '').toLowerCase()) {
      case 'obsidian':
        return {
          label: 'Obsidian VIP',
          gradient: 'from-[#1a102b] via-[#121626] to-[#111827]',
          border: 'border-purple-400/50',
          badgeBg: 'bg-purple-500/15 border-purple-400/40 text-purple-200',
          accentText: 'text-purple-300',
          icon: '👑'
        };
      case 'diamond':
        return {
          label: 'Diamond VIP',
          gradient: 'from-[#0c2233] via-[#111827] to-[#0f172a]',
          border: 'border-cyan-400/50',
          badgeBg: 'bg-cyan-500/15 border-cyan-400/40 text-cyan-200',
          accentText: 'text-cyan-300',
          icon: '💎'
        };
      case 'platinum':
        return {
          label: 'Platinum VIP',
          gradient: 'from-[#1b2434] via-[#111827] to-[#131a27]',
          border: 'border-slate-300/45',
          badgeBg: 'bg-slate-400/15 border-slate-300/40 text-slate-100',
          accentText: 'text-slate-200',
          icon: '🏆'
        };
      case 'gold':
        return {
          label: 'Gold VIP',
          gradient: 'from-[#281e0a] via-[#141926] to-[#111827]',
          border: 'border-amber-400/55',
          badgeBg: 'bg-amber-500/15 border-amber-400/40 text-amber-200',
          accentText: 'text-amber-300',
          icon: '⭐'
        };
      case 'silver':
        return {
          label: 'Silver VIP',
          gradient: 'from-[#1e2636] via-[#131a29] to-[#0f1623]',
          border: 'border-slate-300/40',
          badgeBg: 'bg-slate-300/15 border-slate-300/35 text-slate-100',
          accentText: 'text-slate-200',
          icon: '🥈'
        };
      default:
        return {
          label: 'Bronze VIP',
          gradient: 'from-[#1c1712] via-[#131926] to-[#111827]',
          border: 'border-amber-500/35',
          badgeBg: 'bg-amber-500/15 border-amber-500/35 text-amber-200',
          accentText: 'text-amber-300',
          icon: '🥉'
        };
    }
  };

  const vipTheme = getVipBadge(vipData?.current_tier);
  const progressPct = Math.max(0, Math.min(100, Number(vipData?.progress_pct ?? 0)));
  const xpPoints = Number(vipData?.xp_points || 0);
  const targetXp = Number(vipData?.target_xp || 1000);
  const totalWagered = Number(vipData?.total_wagered || 0);
  const faucetMultiplier = Number(vipData?.faucet_multiplier || 1.0);
  const wheelBonusPct = Math.round((faucetMultiplier - 1.0) * 100);

  // Seven-Day Check-In derived status values (exact backend values preserved)
  const checkinCfg = dailyRewardStatus.checkinSettings || {};
  const checkinEnabledForUser =
    dailyRewardStatus.enabledForUser !== false &&
    checkinCfg.enabled !== false &&
    (isVipMember ? checkinCfg.enabled_for_vip !== false : checkinCfg.enabled_for_normal !== false);
  const checkinEligibilityError: string | null =
    dailyRewardStatus.eligibilityError ||
    (!checkinEnabledForUser
      ? isVipMember
        ? 'Daily Check-In is currently disabled for VIP Players by administrator.'
        : 'Daily Check-In is currently disabled for Normal Players by administrator.'
      : null);
  const effectiveCheckinMap: Record<string, number> = useMemo(() => {
    const precomputed = dailyRewardStatus.effectiveStreakRewards;
    const mode =
      String(dailyRewardStatus.vipRewardMode || checkinCfg.vip_reward_mode || '').toLowerCase() === 'custom'
        ? 'custom'
        : 'double_normal';
    const result: Record<string, number> = {};
    for (let d = 1; d <= 7; d++) {
      const k = `day${d}`;
      if (precomputed && precomputed[k] !== undefined && dailyRewardStatus.isVip === isVipMember) {
        result[k] = Number(precomputed[k]);
      } else {
        const normalVal = Number(checkinCfg.streak_rewards?.[k] ?? DEFAULT_STREAK_REWARDS[d - 1]);
        const vipCustomVal = Number(checkinCfg.vip_streak_rewards?.[k] ?? Math.round(normalVal * 2 * 100) / 100);
        result[k] = isVipMember
          ? mode === 'custom'
            ? vipCustomVal
            : Math.round(normalVal * 2 * 100) / 100
          : normalVal;
      }
    }
    return result;
  }, [dailyRewardStatus.effectiveStreakRewards, dailyRewardStatus.vipRewardMode, dailyRewardStatus.isVip, checkinCfg, isVipMember]);

  const currentDayNum = Math.max(1, Math.min(7, Number(dailyRewardStatus.currentStreak || 1)));
  const canClaimToday = Boolean(dailyRewardStatus.canClaim) && checkinEnabledForUser;
  const completedDaysCount = canClaimToday ? currentDayNum - 1 : currentDayNum;
  const remainingDaysCount = Math.max(0, 7 - completedDaysCount);
  const nextStreakDay = Number(dailyRewardStatus.nextStreak || ((currentDayNum % 7) + 1));
  const todayRewardAmount = Number(
    (dailyRewardStatus.isVip === isVipMember ? dailyRewardStatus.availableReward : undefined) ??
    effectiveCheckinMap[`day${currentDayNum}`] ??
    DEFAULT_STREAK_REWARDS[currentDayNum - 1]
  );
  const nextRewardAmount = Number(
    (dailyRewardStatus.isVip === isVipMember ? dailyRewardStatus.nextRewardAmount : undefined) ??
    effectiveCheckinMap[`day${nextStreakDay}`] ??
    DEFAULT_STREAK_REWARDS[nextStreakDay - 1]
  );

  // Milestone summary calculations
  const completedMilestonesCount = ACHIEVEMENTS.filter(
    (ach) => ach.unlocked || claimedAchievements.includes(ach.id)
  ).length;
  const totalMilestonesPool = ACHIEVEMENTS.reduce((sum, ach) => sum + ach.reward, 0);
  const minWheelSlice = Math.min(...wheelSlices.map((s) => Number(s.amount)));
  const maxWheelSlice = Math.max(...wheelSlices.map((s) => Number(s.amount)));

  return (
    <div
      data-testid="daily-bonus-view"
      className="w-full max-w-6xl 2xl:max-w-[1440px] mx-auto space-y-3.5 sm:space-y-5 text-left box-border overflow-x-clip pb-3"
    >
      {/* ==================================================================
          1. COMPACT VIP MEMBERSHIP & PROGRESS CARD
      ================================================================== */}
      <section
        data-testid="vip-progress-card"
        aria-label="VIP Membership Status and Progress"
        className={`rounded-2xl sm:rounded-3xl bg-gradient-to-br ${vipTheme.gradient} border ${vipTheme.border} p-3 sm:p-4 lg:p-5 shadow-xl transition-all box-border overflow-hidden`}
      >
        <div className="flex flex-col lg:grid lg:grid-cols-12 lg:items-center gap-2.5 sm:gap-4 lg:gap-5">
          {/* Left: Tier Identity + Progress Bar */}
          <div className="lg:col-span-7 space-y-2 min-w-0">
            <div className="flex items-center justify-between gap-2 min-w-0">
              <div className="flex items-center gap-2 sm:gap-2.5 min-w-0 flex-1">
                <div
                  aria-hidden="true"
                  className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-[#0B0F19]/85 border border-white/15 flex items-center justify-center text-base sm:text-xl shadow-inner shrink-0"
                >
                  {vipTheme.icon}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
                    <h2 className="font-display font-extrabold text-sm sm:text-base lg:text-lg text-white tracking-tight leading-tight whitespace-nowrap">
                      {vipTheme.label}
                    </h2>
                    <span className="px-1.5 sm:px-2 py-0.5 rounded-md bg-white/10 border border-white/10 text-white font-mono-numbers text-[10px] font-bold uppercase tracking-wide whitespace-nowrap shrink-0">
                      Lv.{vipData?.tier_level || 1}
                    </span>
                  </div>
                  <p className="text-[10px] sm:text-xs text-[#CBD5E1] leading-snug truncate mt-0.5">
                    {vipData?.next_tier === 'Max Tier'
                      ? 'Max VIP tier · 1 USDT = 10 XP'
                      : `Next: ${vipData?.next_tier || 'Silver'} · 1 USDT = 10 XP`}
                  </p>
                </div>
              </div>

              <div className="shrink-0 flex flex-col items-end justify-center px-2.5 py-1 rounded-xl bg-[#0B0F19]/85 border border-white/10">
                <span className="text-[8.5px] sm:text-[9px] uppercase tracking-wider font-bold text-[#94A3B8] leading-none whitespace-nowrap">
                  Progress
                </span>
                <span
                  data-testid="vip-progress-pct"
                  className="font-mono-numbers font-black text-xs sm:text-sm text-amber-300 leading-tight mt-0.5 whitespace-nowrap"
                >
                  {vipLoading && !vipData ? '—' : `${progressPct}%`}
                </span>
              </div>
            </div>

            <div className="space-y-1 min-w-0">
              <div
                role="progressbar"
                aria-valuenow={progressPct}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`${vipTheme.label} XP progress`}
                className="w-full h-2 sm:h-2.5 bg-[#0B0F19]/90 rounded-full overflow-hidden border border-white/10"
              >
                <div
                  className="h-full rounded-full bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-300 transition-all duration-500"
                  style={{ width: `${progressPct > 0 ? Math.max(3, progressPct) : 0}%` }}
                />
              </div>

              <div className="flex items-center justify-between gap-2 text-[10px] sm:text-[11px] font-mono-numbers">
                <span className="text-[#CBD5E1] truncate">
                  <strong className="text-amber-300 font-bold">{xpPoints.toLocaleString()}</strong>
                  <span className="text-[#94A3B8]"> / {targetXp.toLocaleString()} XP</span>
                </span>
                <span className="text-[#94A3B8] whitespace-nowrap shrink-0">
                  Wagered: <strong className="text-white">{totalWagered.toLocaleString()} USDT</strong>
                </span>
              </div>
            </div>
          </div>

          {/* Right: Always 3-Column Compact Perks Strip */}
          <div className="lg:col-span-5 grid grid-cols-3 gap-1.5 sm:gap-2.5 min-w-0">
            <div className="px-1.5 py-1.5 sm:p-2.5 rounded-xl bg-[#0B0F19]/85 border border-white/10 text-center min-w-0">
              <span className="text-[8.5px] sm:text-[10px] text-[#94A3B8] uppercase tracking-tight sm:tracking-wider block font-bold whitespace-nowrap">
                Multiplier
              </span>
              <span className="text-xs sm:text-sm font-black font-mono-numbers text-amber-300 block mt-0.5 whitespace-nowrap">
                {faucetMultiplier}x
              </span>
            </div>

            <div className="px-1.5 py-1.5 sm:p-2.5 rounded-xl bg-[#0B0F19]/85 border border-white/10 text-center min-w-0">
              <span className="text-[8.5px] sm:text-[10px] text-[#94A3B8] uppercase tracking-tight sm:tracking-wider block font-bold whitespace-nowrap">
                Spin Bonus
              </span>
              <span className="text-xs sm:text-sm font-black font-mono-numbers text-emerald-400 block mt-0.5 whitespace-nowrap">
                +{wheelBonusPct}%
              </span>
            </div>

            <div className="px-1.5 py-1.5 sm:p-2.5 rounded-xl bg-[#0B0F19]/85 border border-white/10 text-center min-w-0">
              <span className="text-[8.5px] sm:text-[10px] text-[#94A3B8] uppercase tracking-tight sm:tracking-wider block font-bold whitespace-nowrap">
                Chat Badge
              </span>
              <span className={`text-[10.5px] sm:text-xs font-black ${vipTheme.accentText} flex items-center justify-center gap-1 mt-0.5 truncate`}>
                <span aria-hidden="true">{vipTheme.icon}</span>
                <span className="truncate">{vipData?.current_tier || 'Bronze'}</span>
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* ==================================================================
          2. PRIMARY REWARDS GRID:
             - Mobile (<768px): 1. Daily Spin Wheel -> 2. Seven-Day Check-In
             - Tablet & Desktop (768px+): Left = Daily Spin Wheel | Right = Seven-Day Check-In
      ================================================================== */}
      <div
        data-testid="daily-rewards-primary-grid"
        className="grid grid-cols-1 md:grid-cols-12 gap-3.5 sm:gap-5 items-stretch"
      >
        {/* LEFT COLUMN — DAILY SPIN WHEEL */}
        <section
          data-testid="daily-spin-card"
          aria-label="Daily Spin Wheel"
          className="md:col-span-5 rounded-2xl sm:rounded-3xl bg-[#111827] border border-[#1F2737] p-3.5 sm:p-5 shadow-xl relative overflow-hidden box-border flex flex-col justify-between gap-3.5 min-w-0"
        >
          <div className="absolute -top-12 -right-12 w-48 h-48 bg-amber-500/6 rounded-full blur-3xl pointer-events-none" />

          {/* Header */}
          <div
            data-testid="daily-spin-header"
            className="relative z-10 flex items-start justify-between gap-2 pb-3 border-b border-[#1F2737] min-w-0"
          >
            <div className="flex items-start gap-2.5 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center shrink-0">
                <Sparkles className="w-4.5 h-4.5 text-amber-400" />
              </div>
              <div className="min-w-0">
                <h2 className="font-display font-extrabold text-sm sm:text-base lg:text-lg text-white leading-tight">
                  Daily Spin Wheel
                </h2>
                <p className="text-[11px] text-[#94A3B8] leading-snug mt-0.5">
                  Spin &amp; Win up to {maxWheelSlice.toFixed(2)} USDT every 24h
                </p>
              </div>
            </div>

            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-[10px] font-mono-numbers font-bold whitespace-nowrap shrink-0">
              <Coins className="w-3 h-3 text-amber-400 shrink-0" />
              {minWheelSlice.toFixed(2)}–{maxWheelSlice.toFixed(2)}
            </span>
          </div>

          {/* Centered Wheel Stage + Directly Attached Spin Button Below */}
          <div
            data-testid="spin-wheel-group"
            className="relative z-10 flex-1 flex flex-col items-center justify-center w-full"
          >
            <div className="w-full rounded-2xl bg-[#0B0F19]/90 border border-[#1F2737] p-3 sm:p-4 flex flex-col items-center gap-3 shadow-inner">
              {/* Circular SVG Wheel */}
              <div
                data-testid="daily-spin-wheel-wrapper"
                className="relative flex flex-col items-center justify-center pt-2 shrink-0"
              >
                {/* Top Pointer Arrow */}
                <div className="absolute -top-0.5 z-30 drop-shadow-[0_3px_6px_rgba(0,0,0,0.85)]">
                  <div className="w-0 h-0 border-l-[11px] border-l-transparent border-r-[11px] border-r-transparent border-t-[17px] border-t-amber-400" />
                </div>

                {/* Rotating Wheel */}
                <div className="w-48 h-48 xs:w-54 xs:h-54 sm:w-60 sm:h-60 md:w-52 md:h-52 lg:w-60 lg:h-60 xl:w-64 xl:h-64 rounded-full border-4 border-amber-400/80 shadow-[0_0_24px_rgba(245,196,81,0.18)] p-1 bg-[#0B0F19]">
                  <svg
                    viewBox="0 0 300 300"
                    className="w-full h-full transform transition-transform duration-[3800ms] ease-[cubic-bezier(0.15,0.85,0.25,1)]"
                    style={{ transform: `rotate(${wheelRotation}deg)` }}
                  >
                    {wheelSlices.map((s, idx) => {
                      const angle = 360 / 8;
                      const startAngle = idx * angle;
                      const endAngle = startAngle + angle;

                      const radStart = (startAngle - 90) * (Math.PI / 180);
                      const radEnd = (endAngle - 90) * (Math.PI / 180);
                      const x1 = 150 + 140 * Math.cos(radStart);
                      const y1 = 150 + 140 * Math.sin(radStart);
                      const x2 = 150 + 140 * Math.cos(radEnd);
                      const y2 = 150 + 140 * Math.sin(radEnd);

                      const midAngle = startAngle + angle / 2;
                      const textRad = (midAngle - 90) * (Math.PI / 180);
                      const tx = 150 + 95 * Math.cos(textRad);
                      const ty = 150 + 95 * Math.sin(textRad);

                      return (
                        <g key={s.index}>
                          <path
                            d={`M 150 150 L ${x1} ${y1} A 140 140 0 0 1 ${x2} ${y2} Z`}
                            fill={s.color}
                            stroke="#111827"
                            strokeWidth="2.5"
                          />
                          <text
                            x={tx}
                            y={ty}
                            fill={s.textColor}
                            fontSize="12"
                            fontWeight="900"
                            fontFamily="monospace"
                            textAnchor="middle"
                            dominantBaseline="central"
                            transform={`rotate(${midAngle + 90}, ${tx}, ${ty})`}
                          >
                            {s.label}
                          </text>
                        </g>
                      );
                    })}

                    {/* Center Hub */}
                    <circle cx="150" cy="150" r="32" fill="#0B0F19" stroke="#F5C451" strokeWidth="3.5" />
                    <circle cx="150" cy="150" r="22" fill="#F5C451" />
                    <text
                      x="150"
                      y="150"
                      fill="#0B0F19"
                      fontSize="11"
                      fontWeight="900"
                      textAnchor="middle"
                      dominantBaseline="central"
                    >
                      USDT
                    </text>
                  </svg>
                </div>
              </div>

              {/* Recent Spin Result Banner */}
              {recentPrize && (
                <div className="w-full px-3 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/35 text-center animate-in zoom-in-95 duration-200">
                  <span className="text-emerald-300 font-bold font-mono-numbers block text-xs">
                    +{Number(recentPrize.final_prize).toFixed(2)} USDT Credited to Wallet
                  </span>
                  <span className="text-[10px] text-[#94A3B8] font-mono-numbers block mt-0.5">
                    {isVipMember
                      ? spinVipRewardMode === 'custom'
                        ? 'VIP Custom Reward Applied'
                        : 'VIP 2x Normal Reward Applied'
                      : 'Normal Player Reward Applied'}
                  </span>
                </div>
              )}

              {/* Spin Action Button Directly Below Wheel */}
              <div className="w-full space-y-2 pt-0.5">
                <button
                  type="button"
                  data-testid="daily-spin-button"
                  onClick={handleSpinWheel}
                  disabled={isSpinningWheel || wheelCooldownSeconds > 0 || !spinEnabledForUser}
                  className={`w-full min-h-[44px] px-4 py-2.5 rounded-xl font-display font-black text-xs sm:text-sm flex items-center justify-center gap-2 transition-all ${isSpinningWheel
                      ? 'bg-amber-500/25 text-amber-200 border border-amber-400/40 cursor-not-allowed'
                      : !spinEnabledForUser || wheelCooldownSeconds > 0
                        ? 'bg-[#151C2B] text-[#94A3B8] border border-[#2D3545] cursor-not-allowed'
                        : 'btn-gold text-black shadow-lg shadow-amber-500/20 cursor-pointer active:scale-[0.98]'
                    }`}
                >
                  {isSpinningWheel ? (
                    <>
                      <Sparkles className="w-4 h-4 animate-spin shrink-0" />
                      <span>Spinning Wheel...</span>
                    </>
                  ) : !spinEnabledForUser ? (
                    <>
                      <Lock className="w-4 h-4 text-[#94A3B8] shrink-0" />
                      <span className="truncate">
                        {isVipMember ? 'Disabled for VIP Players' : 'Disabled for Normal Players'}
                      </span>
                    </>
                  ) : wheelCooldownSeconds > 0 ? (
                    <>
                      <Clock className="w-4 h-4 text-amber-400 shrink-0" />
                      <span className="font-mono-numbers truncate">Next Spin in {formatCooldown(wheelCooldownSeconds)}</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 shrink-0" />
                      <span>SPIN WHEEL NOW</span>
                    </>
                  )}
                </button>

                <div className="flex items-center justify-between gap-2 text-[10px] sm:text-[10.5px] text-[#94A3B8] px-0.5">
                  <span className="flex items-center gap-1 truncate">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span className="truncate">
                      {isVipMember
                        ? spinVipRewardMode === 'custom'
                          ? 'Instant USDT · VIP Custom Tier'
                          : 'Instant USDT · VIP 2x Tier'
                        : 'Instant USDT · Normal Tier'}
                    </span>
                  </span>
                  <span className="font-mono-numbers text-amber-300 font-semibold whitespace-nowrap shrink-0">
                    {!spinEnabledForUser ? 'Paused' : wheelCooldownSeconds > 0 ? '24h Cooldown' : 'Ready'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* RIGHT COLUMN — SEVEN-DAY CHECK-IN (Replaces removed prize tier box) */}
        <section
          data-testid="daily-checkin-card"
          aria-label="Seven-Day Check-In Rewards"
          className="md:col-span-7 rounded-2xl sm:rounded-3xl bg-[#111827] border border-[#1F2737] p-3.5 sm:p-5 shadow-xl relative overflow-hidden box-border flex flex-col justify-between gap-3.5 min-w-0"
        >
          {/* Header + Current Streak Status (NO Claim Button Here) */}
          <div
            data-testid="checkin-header"
            className="flex flex-col sm:flex-row md:flex-col lg:flex-row lg:items-center justify-between gap-2.5 pb-3 border-b border-[#1F2737]"
          >
            <div className="flex items-start gap-2.5 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center shrink-0">
                <Calendar className="w-4.5 h-4.5 text-amber-400" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="font-display font-extrabold text-sm sm:text-base lg:text-lg text-white leading-tight whitespace-nowrap">
                    7-Day Check-In
                  </h2>
                  <span className="text-[9px] font-mono-numbers px-2 py-0.5 rounded-full bg-purple-500/15 text-purple-300 border border-purple-500/35 uppercase font-bold tracking-wider whitespace-nowrap">
                    USDT TRC-20
                  </span>
                  {isVipMember && (
                    <span
                      data-testid="checkin-vip-badge"
                      className="text-[9px] font-mono-numbers px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 uppercase font-bold tracking-wider whitespace-nowrap"
                    >
                      VIP Tier
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-[#94A3B8] leading-snug mt-0.5">
                  {!checkinEnabledForUser
                    ? checkinEligibilityError
                    : canClaimToday
                      ? `Day ${currentDayNum} ready (+${todayRewardAmount.toFixed(2)} USDT) · Next: Day ${nextStreakDay} (+${nextRewardAmount.toFixed(2)} USDT)`
                      : `Today claimed · Day ${nextStreakDay} (+${nextRewardAmount.toFixed(2)} USDT) in ${formatCooldown(dailyRewardStatus.secondsRemaining)}`}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 flex-wrap shrink-0">
              <span
                data-testid="checkin-streak-badge"
                className={`text-[10px] font-mono-numbers px-2.5 py-0.5 rounded-full border font-bold whitespace-nowrap ${canClaimToday
                    ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/35'
                    : 'bg-[#0B0F19] text-[#CBD5E1] border-[#2D3545]'
                  }`}
              >
                Streak: Day {currentDayNum} / 7
              </span>
              <span className="text-[10px] font-mono-numbers px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/30 font-bold whitespace-nowrap">
                {remainingDaysCount} {remainingDaysCount === 1 ? 'Day' : 'Days'} Left
              </span>
              {(dailyRewardStatus.highestStreak || 0) > 0 && (
                <span className="text-[10px] font-mono-numbers px-2.5 py-0.5 rounded-full bg-[#0B0F19] text-[#94A3B8] border border-[#1F2737] font-bold whitespace-nowrap">
                  Best: {dailyRewardStatus.highestStreak}d
                </span>
              )}
            </div>
          </div>

          {/* Chronological 7-Day Reward Cards Grid (4 + 3 on Desktop & Larger Mobile, 3 + 3 + 1 on 320px/narrow Tablet) */}
          <div
            data-testid="checkin-days-grid"
            className="grid grid-cols-3 min-[400px]:grid-cols-4 md:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-2.5 my-auto"
          >
            {[1, 2, 3, 4, 5, 6, 7].map((day) => {
              const isCompleted = day < currentDayNum || (!canClaimToday && Boolean(dailyRewardStatus.lastCheckinDate) && day === currentDayNum && checkinEnabledForUser);
              const isCurrent = day === currentDayNum && canClaimToday;
              const rewardVal = Number(effectiveCheckinMap[`day${day}`] ?? DEFAULT_STREAK_REWARDS[day - 1]);
              const isJackpot = day === 7;
              const statusText = isCompleted ? 'Claimed' : isCurrent ? 'Available' : 'Locked';

              return (
                <div
                  key={day}
                  data-testid={`checkin-day-${day}`}
                  className={`rounded-2xl border p-2 sm:p-2.5 flex flex-col justify-between gap-1.5 min-w-0 transition-all box-border ${isJackpot ? 'col-span-3 min-[400px]:col-span-2 md:col-span-3 lg:col-span-2' : 'col-span-1'
                    } ${isCurrent
                      ? 'bg-gradient-to-b from-amber-500/20 via-amber-500/10 to-[#0B0F19] border-amber-400 shadow-lg shadow-amber-500/10'
                      : isCompleted
                        ? 'bg-[#0B0F19]/90 border-emerald-500/40'
                        : isJackpot
                          ? 'bg-gradient-to-br from-purple-950/35 via-[#0B0F19] to-[#111827] border-purple-500/35'
                          : 'bg-[#0B0F19] border-[#1F2737] opacity-90'
                    }`}
                >
                  {isJackpot ? (
                    <div className="flex items-center justify-between gap-2 w-full h-full min-w-0">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-purple-500/15 border border-purple-400/35 flex items-center justify-center shrink-0">
                          <Gem className="w-4 h-4 sm:w-4.5 sm:h-4.5 text-purple-300" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-mono-numbers font-bold text-[11px] sm:text-xs text-white whitespace-nowrap">
                              Day 7
                            </span>
                            <span className="text-[8.5px] uppercase px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 font-bold border border-purple-500/30 whitespace-nowrap">
                              Jackpot
                            </span>
                          </div>
                          <span className="text-[9.5px] text-[#94A3B8] font-mono-numbers block truncate mt-0.5">
                            7d Bonus
                          </span>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <span
                          className={`font-mono-numbers font-black text-xs sm:text-sm block whitespace-nowrap ${isCurrent ? 'text-amber-300' : isCompleted ? 'text-emerald-400' : 'text-purple-200'
                            }`}
                        >
                          +{rewardVal.toFixed(2)} USDT
                        </span>
                        <span
                          className={`inline-flex items-center gap-1 mt-0.5 px-1.5 py-0.5 rounded text-[8.5px] font-bold uppercase tracking-wider whitespace-nowrap ${isCompleted
                              ? 'bg-emerald-500/15 text-emerald-300'
                              : isCurrent
                                ? 'bg-amber-400/20 text-amber-300'
                                : 'bg-[#151C2B] text-[#94A3B8]'
                            }`}
                        >
                          {isCompleted ? (
                            <CheckCircle2 className="w-2.5 h-2.5 shrink-0" />
                          ) : isCurrent ? (
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse shrink-0" />
                          ) : (
                            <Lock className="w-2.5 h-2.5 shrink-0" />
                          )}
                          {statusText}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="w-full flex items-center justify-between gap-1 text-[10px] font-mono-numbers font-bold">
                        <span className={isCurrent ? 'text-amber-300' : 'text-white'}>Day {day}</span>
                        {isCompleted ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        ) : isCurrent ? (
                          <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse shrink-0" />
                        ) : (
                          <Lock className="w-3 h-3 text-[#64748B] shrink-0" />
                        )}
                      </div>

                      <div className="flex flex-col items-center text-center gap-1 min-w-0 py-0.5">
                        <div
                          className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center shrink-0 border ${isCurrent
                              ? 'bg-amber-500/20 border-amber-400/40 text-amber-300'
                              : isCompleted
                                ? 'bg-emerald-500/15 border-emerald-500/35 text-emerald-400'
                                : 'bg-[#151C2B] border-[#1F2737] text-[#94A3B8]'
                            }`}
                        >
                          <Coins className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                        </div>
                        <span
                          className={`font-mono-numbers font-black text-[10.5px] sm:text-xs block whitespace-nowrap ${isCurrent ? 'text-amber-300' : isCompleted ? 'text-emerald-400' : 'text-white'
                            }`}
                        >
                          +{rewardVal.toFixed(2)} USDT
                        </span>
                      </div>

                      <span
                        className={`block w-full text-center py-0.5 rounded text-[8.5px] sm:text-[9px] uppercase tracking-wider font-bold whitespace-nowrap ${isCompleted
                            ? 'bg-emerald-500/15 text-emerald-300'
                            : isCurrent
                              ? 'bg-amber-400/20 text-amber-300'
                              : 'bg-[#151C2B] text-[#94A3B8]'
                          }`}
                      >
                        {statusText}
                      </span>
                    </>
                  )}
                </div>
              );
            })}
          </div>

          {/* Bottom Check-In Footer & Claim Button (Always BELOW all 7 check-in cards) */}
          <div
            data-testid="checkin-footer"
            className="pt-3 border-t border-[#1F2737] flex flex-col sm:flex-row md:flex-col lg:flex-row lg:items-center justify-between gap-2.5"
          >
            <div className="space-y-0.5 min-w-0">
              <div className="text-xs font-bold text-white flex items-center gap-1.5 flex-wrap">
                <Flame className={`w-3.5 h-3.5 shrink-0 ${canClaimToday ? 'text-amber-400' : 'text-emerald-400'}`} />
                <span>
                  {!checkinEnabledForUser
                    ? checkinEligibilityError
                    : canClaimToday
                      ? `Available Today: Day ${currentDayNum} (+${todayRewardAmount.toFixed(2)} USDT)`
                      : `Day ${currentDayNum} Claimed · Cooldown ${formatCooldown(dailyRewardStatus.secondsRemaining)}`}
                </span>
              </div>
              <p className="text-[10.5px] text-[#94A3B8] font-mono-numbers">
                Next: Day {nextStreakDay} (+{nextRewardAmount.toFixed(2)} USDT) · {remainingDaysCount}{' '}
                {remainingDaysCount === 1 ? 'day' : 'days'} remaining in 7-day cycle
              </p>
            </div>

            <button
              type="button"
              data-testid="checkin-claim-button"
              onClick={handleClaimDailyStreak}
              disabled={!canClaimToday || isClaimingStreak}
              className={`w-full lg:w-auto min-h-[44px] px-5 rounded-xl text-xs sm:text-sm font-display font-black flex items-center justify-center gap-2 transition-all whitespace-nowrap shrink-0 ${canClaimToday
                  ? 'btn-gold text-black shadow-lg shadow-amber-500/20 cursor-pointer active:scale-[0.98]'
                  : 'bg-[#151C2B] text-[#94A3B8] border border-[#2D3545] cursor-not-allowed shadow-none'
                }`}
            >
              {isClaimingStreak ? (
                <>
                  <RotateCcw className="w-4 h-4 animate-spin text-black shrink-0" />
                  <span>Crediting Wallet...</span>
                </>
              ) : !checkinEnabledForUser ? (
                <>
                  <Lock className="w-4 h-4 text-[#94A3B8] shrink-0" />
                  <span>{isVipMember ? 'Disabled for VIP' : 'Disabled for Normal'}</span>
                </>
              ) : canClaimToday ? (
                <>
                  <Gift className="w-4 h-4 text-black shrink-0" />
                  <span>Claim Day {currentDayNum} (+{todayRewardAmount.toFixed(2)} USDT)</span>
                </>
              ) : (
                <>
                  <Clock className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>Claimed · {formatCooldown(dailyRewardStatus.secondsRemaining)}</span>
                </>
              )}
            </button>
          </div>
        </section>
      </div>

      {/* ==================================================================
          3. MILESTONE ACHIEVEMENTS SECTION (Full Width Below Spin & Check-In)
      ================================================================== */}
      <section
        data-testid="milestones-card"
        aria-label="Milestone Achievements"
        className="rounded-2xl sm:rounded-3xl bg-[#111827] border border-[#1F2737] p-3.5 sm:p-5 lg:p-6 space-y-3.5 sm:space-y-4 shadow-xl box-border"
      >
        <div
          data-testid="milestones-header"
          className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-3 sm:pb-4 border-b border-[#1F2737]"
        >
          <div className="flex items-start sm:items-center gap-2.5 sm:gap-3 min-w-0">
            <AchievementHeadingEmblem />
            <div className="min-w-0">
              <h2 className="font-display font-extrabold text-sm sm:text-base lg:text-lg text-white leading-tight">
                Milestone Achievements
              </h2>
              <p className="text-[11px] sm:text-xs text-[#94A3B8] leading-snug mt-0.5">
                Complete platform milestones to unlock bonus USDT rewards
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap shrink-0">
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-[10px] sm:text-[11px] font-mono-numbers font-bold whitespace-nowrap">
              <Award className="w-3 h-3 shrink-0" />
              {completedMilestonesCount} / {ACHIEVEMENTS.length} Completed
            </span>
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-[10px] sm:text-[11px] font-mono-numbers font-bold whitespace-nowrap">
              +{totalMilestonesPool.toFixed(2)} USDT Total
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2.5 sm:gap-3.5">
          {ACHIEVEMENTS.map((ach) => {
            const isClaimed = claimedAchievements.includes(ach.id);
            const achState: 'claimed' | 'completed' | 'in_progress' | 'locked' = isClaimed
              ? 'claimed'
              : ach.unlocked
                ? 'completed'
                : ach.progress > 0
                  ? 'in_progress'
                  : 'locked';

            const statusBadge =
              achState === 'claimed'
                ? { label: 'Claimed', cls: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/35' }
                : achState === 'completed'
                  ? { label: 'Completed', cls: 'bg-amber-400/20 text-amber-300 border-amber-400/45' }
                  : achState === 'in_progress'
                    ? { label: 'In Progress', cls: 'bg-amber-500/15 text-amber-300 border-amber-500/30' }
                    : { label: 'Locked', cls: 'bg-[#151C2B] text-[#94A3B8] border-[#263145]' };

            const cardFrameClass =
              achState === 'claimed'
                ? 'bg-gradient-to-br from-emerald-950/20 via-[#0B0F19] to-[#0B0F19] border-emerald-500/40'
                : achState === 'completed'
                  ? 'bg-gradient-to-br from-amber-500/15 via-[#0B0F19] to-[#0B0F19] border-amber-400/60'
                  : achState === 'in_progress'
                    ? 'bg-[#0B0F19] border-amber-500/30'
                    : 'bg-[#0B0F19] border-[#1F2737]';

            return (
              <div
                key={ach.id}
                data-testid={`milestone-item-${ach.id}`}
                className={`rounded-2xl border p-3 sm:p-3.5 flex flex-col justify-between gap-2.5 transition-all min-w-0 box-border ${cardFrameClass}`}
              >
                {/* Top Info Row: Category Emblem + Title + Description + USDT Reward */}
                <div className="flex items-start gap-2.5 sm:gap-3 min-w-0">
                  <div
                    data-testid={`milestone-icon-${ach.id}`}
                    className={`w-10 h-10 sm:w-11 sm:h-11 rounded-xl border flex items-center justify-center shrink-0 shadow-inner ${achState === 'claimed'
                        ? 'bg-emerald-500/12 border-emerald-500/35'
                        : achState === 'completed' || achState === 'in_progress'
                          ? 'bg-amber-500/12 border-amber-500/35'
                          : 'bg-[#151C2B] border-[#253045]'
                      }`}
                  >
                    {renderAchievementIcon(ach.icon, achState)}
                  </div>

                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1 min-w-0">
                      <h3 className="font-display font-bold text-xs sm:text-sm text-white leading-snug">
                        {ach.title}
                      </h3>
                      <span className="font-mono-numbers font-black text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5 rounded-md bg-amber-500/10 border border-amber-500/30 text-amber-300 whitespace-nowrap shrink-0">
                        +{ach.reward.toFixed(2)} USDT
                      </span>
                    </div>

                    <p className="text-[11px] sm:text-xs text-[#94A3B8] leading-snug">
                      {ach.description}
                    </p>
                  </div>
                </div>

                {/* Bottom Progress & State Action Bar */}
                <div className="flex items-center justify-between gap-2.5 pt-2 border-t border-[#1F2737]/70 min-w-0">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <div className="flex-1 h-1.5 bg-[#151C2B] rounded-full overflow-hidden border border-[#1F2737]">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${achState === 'claimed'
                            ? 'bg-emerald-400'
                            : achState === 'completed'
                              ? 'bg-amber-400'
                              : 'bg-amber-400/80'
                          }`}
                        style={{ width: `${Math.max(0, Math.min(100, ach.progress))}%` }}
                      />
                    </div>
                    <span className="text-[10px] font-mono-numbers font-bold text-[#94A3B8] whitespace-nowrap shrink-0">
                      {ach.progress}%
                    </span>
                  </div>

                  {isClaimed ? (
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[10px] font-mono-numbers font-bold whitespace-nowrap shrink-0 ${statusBadge.cls}`}
                    >
                      <CheckCircle2 className="w-3 h-3 shrink-0" />
                      Claimed
                    </span>
                  ) : ach.unlocked ? (
                    <button
                      type="button"
                      onClick={() => handleClaimAchievement(ach)}
                      className="px-3 py-1 rounded-lg bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-black font-display font-extrabold text-[11px] shadow-md shadow-emerald-500/20 cursor-pointer whitespace-nowrap active:scale-95 transition-transform shrink-0"
                    >
                      Claim +{ach.reward.toFixed(2)}
                    </button>
                  ) : (
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[10px] font-mono-numbers font-bold whitespace-nowrap shrink-0 ${statusBadge.cls}`}
                    >
                      {achState === 'locked' && <Lock className="w-2.5 h-2.5 shrink-0" />}
                      {statusBadge.label}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
