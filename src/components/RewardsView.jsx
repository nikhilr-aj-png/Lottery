/**
 * ============================================================================
 * REWARDS, VIP LOYALTY & DAILY LUCKY WHEEL — EARNFLOW.IN
 * ============================================================================
 * Integrates:
 * 1. Interactive 8-Segment SVG Daily Lucky Wheel with physical spin physics & audio
 * 2. Real-time VIP Loyalty Progression Card (Bronze -> Obsidian) with XP tracking
 * 3. 7-Day Consecutive Login Streak Faucet
 * 4. Milestone Achievements tracking
 */

import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useLottery } from '../context/LotteryContext';
import { useSoundFX } from '../hooks/useSoundFX';
import { 
  Gift, 
  Sparkles, 
  Calendar, 
  Trophy, 
  Coins, 
  CheckCircle2, 
  Clock, 
  Star, 
  Flame, 
  ShieldCheck,
  ChevronRight,
  Zap,
  Award,
  Crown,
  Play,
  RotateCcw,
  Percent,
  Layers,
  ArrowUpRight
} from 'lucide-react';
import confetti from 'canvas-confetti';

const WHEEL_SLICES = [
  { index: 0, amount: 50, label: '50 FC', color: '#B45309', textColor: '#FEF3C7', border: '#D97706' },
  { index: 1, amount: 100, label: '100 FC', color: '#475569', textColor: '#F1F5F9', border: '#64748B' },
  { index: 2, amount: 150, label: '150 FC', color: '#854D0E', textColor: '#FEF9C3', border: '#CA8A04' },
  { index: 3, amount: 200, label: '200 FC', color: '#065F46', textColor: '#D1FAE5', border: '#059669' },
  { index: 4, amount: 250, label: '250 FC', color: '#1E40AF', textColor: '#DBEAFE', border: '#2563EB' },
  { index: 5, amount: 300, label: '300 FC', color: '#991B1B', textColor: '#FEE2E2', border: '#DC2626' },
  { index: 6, amount: 500, label: '500 FC', color: '#581C87', textColor: '#F3E8FF', border: '#7C3AED' },
  { index: 7, amount: 1000, label: '1,000 FC', color: '#B45309', textColor: '#FFFBEB', border: '#F59E0B', isJackpot: true }
];

const STREAK_DAYS = [
  { day: 1, amount: 100, label: 'Day 1' },
  { day: 2, amount: 125, label: 'Day 2' },
  { day: 3, amount: 150, label: 'Day 3' },
  { day: 4, amount: 175, label: 'Day 4' },
  { day: 5, amount: 200, label: 'Day 5' },
  { day: 6, amount: 250, label: 'Day 6' },
  { day: 7, amount: 500, label: 'Day 7 Jackpot', isJackpot: true }
];

const ACHIEVEMENTS = [
  {
    id: 'first_bet',
    title: 'First Roll',
    description: 'Place your first bet on any casino game or lottery',
    reward: 50,
    progress: 0,
    unlocked: false,
    icon: '🎲'
  },
  {
    id: 'high_roller',
    title: 'High Roller',
    description: 'Place a single wager of 50 FC or higher',
    reward: 100,
    progress: 0,
    unlocked: false,
    icon: '👑'
  },
  {
    id: 'lucky_streak',
    title: 'Lucky Multiplier',
    description: 'Hit any outcome with multiplier >= 5.0x',
    reward: 150,
    progress: 0,
    unlocked: false,
    icon: '⚡'
  },
  {
    id: 'games_veteran',
    title: 'Casino Explorer',
    description: 'Play 5 or more different games from the 12-game catalog',
    reward: 200,
    progress: 0,
    unlocked: false,
    icon: '🌟'
  },
  {
    id: 'century_club',
    title: 'Flow Coin Whale',
    description: 'Accumulate a balance of 1,000 Flow Coins or more',
    reward: 500,
    progress: 0,
    unlocked: false,
    icon: '💎'
  }
];

export default function RewardsView() {
  const { 
    wallet, 
    setWallet, 
    user, 
    claimDailyBonus, 
    claimDailyFloReward,
    getDailyFloRewardStatus,
    showToast, 
    setIsAuthModalOpen, 
    fetchWalletLedger, 
    setActiveTab 
  } = useLottery();
  const { soundFX, playClick, playRouletteSpin, playDialTick, playWinFanfare } = useSoundFX();

  // VIP State
  const [vipData, setVipData] = useState(null);
  const [vipLoading, setVipLoading] = useState(false);

  // Wheel State
  const [wheelRotation, setWheelRotation] = useState(0);
  const [isSpinningWheel, setIsSpinningWheel] = useState(false);
  const [wheelCooldownSeconds, setWheelCooldownSeconds] = useState(0);
  const [recentPrize, setRecentPrize] = useState(null);

  // Unified 7-Day Daily Streak State
  const [dailyRewardStatus, setDailyRewardStatus] = useState({
    canClaim: true,
    secondsRemaining: 0,
    availableReward: 0.10,
    currentStreak: 1,
    nextStreak: 2,
    nextRewardAmount: 0.15,
    checkinSettings: null
  });
  const [isClaimingStreak, setIsClaimingStreak] = useState(false);

  // Achievements
  const [claimedAchievements, setClaimedAchievements] = useState([]);

  // Fetch Unified Daily Streak Status from Database
  const refreshDailyRewardStatus = async () => {
    if (getDailyFloRewardStatus) {
      const status = await getDailyFloRewardStatus();
      setDailyRewardStatus(status);
    }
  };

  useEffect(() => {
    refreshDailyRewardStatus();
  }, [wallet?.address, user?.id]);

  // Tick countdown timer for streak cooldown
  useEffect(() => {
    if (dailyRewardStatus.secondsRemaining <= 0) return;
    const interval = setInterval(() => {
      setDailyRewardStatus(prev => {
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
      showToast('Please log in with Flow Coins to claim your daily reward!', 'info');
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

  // Load VIP Status and Cooldowns
  const fetchVipStatus = async () => {
    if (!wallet?.address) return;
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
  const formatCooldown = (secs) => {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // Spin the Lucky Wheel
  const handleSpinWheel = async () => {
    if (isSpinningWheel) return;

    if (!user || !wallet?.address) {
      showToast('Please log in with Flow Coins to spin the Lucky Wheel!', 'info');
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

        // Win Audio & Celebration
        if (data.final_prize >= 500) {
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

        showToast(`🎉 You won ${data.final_prize} Flow Coins on the Lucky Wheel!`, 'success');

        if (data.new_balance !== undefined) {
          setWallet(prev => ({ ...prev, balance: parseFloat(data.new_balance) }));
        }
        if (fetchWalletLedger) fetchWalletLedger();
        fetchVipStatus();
      }, 3800);

    } catch (err) {
      console.error('handleSpinWheel error:', err);
      showToast(err.message || 'Error spinning wheel', 'error');
      setIsSpinningWheel(false);
    }
  };

  // Claim 24h Daily Bonus
  const handleClaimDaily = async () => {
    if (isClaimingDaily) return;
    setIsClaimingDaily(true);
    playClick();

    try {
      const res = await claimDailyBonus();
      if (res?.success) {
        playWinFanfare('standard');
      }
    } catch (_) {}
    setIsClaimingDaily(false);
  };

  // Claim Achievement
  const handleClaimAchievement = (ach) => {
    if (claimedAchievements.includes(ach.id) || !ach.unlocked) return;
    playClick();
    setClaimedAchievements(prev => [...prev, ach.id]);
    playWinFanfare('standard');
    showToast(`Achievement Unlocked: +${ach.reward} Flow Coins added!`, 'success');

    try {
      confetti({
        particleCount: 60,
        spread: 60,
        origin: { y: 0.6 },
        colors: ['#F5C451', '#22C55E']
      });
    } catch (_) {}
  };

  const getVipBadge = (tier) => {
    switch ((tier || '').toLowerCase()) {
      case 'obsidian': return { label: 'Obsidian VIP', color: 'from-purple-900 via-indigo-950 to-purple-900 border-purple-400 text-purple-200', icon: '👑', shadow: 'shadow-purple-500/30' };
      case 'diamond': return { label: 'Diamond VIP', color: 'from-cyan-950 via-blue-950 to-cyan-950 border-cyan-400 text-cyan-200', icon: '💎', shadow: 'shadow-cyan-500/30' };
      case 'platinum': return { label: 'Platinum VIP', color: 'from-slate-800 via-zinc-900 to-slate-800 border-slate-300 text-slate-100', icon: '🏆', shadow: 'shadow-slate-400/20' };
      case 'gold': return { label: 'Gold VIP', color: 'from-amber-950 via-yellow-950 to-amber-950 border-amber-400 text-amber-200', icon: '⭐', shadow: 'shadow-amber-500/30' };
      case 'silver': return { label: 'Silver VIP', color: 'from-zinc-800 via-slate-900 to-zinc-800 border-zinc-400 text-zinc-200', icon: '🥈', shadow: 'shadow-zinc-400/20' };
      default: return { label: 'Bronze VIP', color: 'from-[#111827] via-[#151C2B] to-[#111827] border-amber-600/40 text-amber-300', icon: '🥉', shadow: 'shadow-amber-700/20' };
    }
  };

  const vipTheme = getVipBadge(vipData?.current_tier);

  return (
    <div className="max-w-6xl mx-auto space-y-6 text-left">
      
      {/* 1. HERO HEADER */}
      <div className="relative rounded-3xl bg-gradient-to-r from-[#111827] via-[#151C2B] to-[#111827] border border-[#1F2737] p-6 sm:p-8 overflow-hidden shadow-2xl">
        <div className="absolute top-0 right-0 w-80 h-80 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs font-mono-numbers font-bold">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>FREE SOCIAL GAMING FAUCET & VIP CLUB</span>
            </div>
            <h1 className="font-display font-black text-2xl sm:text-3xl text-white tracking-tight">
              Rewards, Lucky Wheel & VIP Club
            </h1>
            <p className="text-xs sm:text-sm text-[#94A3B8] leading-relaxed">
              Earn free Flow Coins daily! Spin the 24-hour Lucky Wheel for up to 1,000 FC, progress through VIP tiers for massive faucet multipliers, and unlock milestone rewards with zero financial risk.
            </p>
          </div>

          {/* Quick Balance Card */}
          <div className="bg-[#0B0F19] border border-[#1F2737] rounded-2xl p-4 sm:p-5 flex items-center gap-4 shrink-0 shadow-inner">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 text-2xl shadow-md">
              🪙
            </div>
            <div>
              <span className="text-[10px] text-[#94A3B8] uppercase font-mono-numbers font-bold block">
                Available Flow Coins
              </span>
              <span className="font-mono-numbers font-black text-xl text-amber-300">
                {Number(wallet.balance || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })} FC
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. VIP LOYALTY PROGRESSION CARD */}
      <div className={`rounded-3xl bg-gradient-to-r ${vipTheme.color} border p-6 sm:p-7 shadow-xl ${vipTheme.shadow} transition-all`}>
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
          
          <div className="space-y-3 max-w-xl">
            <div className="flex items-center gap-2.5">
              <span className="text-3xl">{vipTheme.icon}</span>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="font-display font-black text-lg sm:text-xl text-white tracking-tight">
                    {vipTheme.label}
                  </h2>
                  <span className="px-2 py-0.5 rounded-full bg-white/10 text-white font-mono text-[10px] font-bold uppercase tracking-wider">
                    Level {vipData?.tier_level || 1}
                  </span>
                </div>
                <p className="text-xs text-[#CBD5E1]">
                  Every 1 FC wagered earns 10 XP points. Higher tiers unlock higher faucet multipliers!
                </p>
              </div>
            </div>

            {/* XP Progress Bar */}
            <div className="space-y-1.5 pt-1">
              <div className="flex items-center justify-between text-[11px] font-mono-numbers font-bold">
                <span className="text-amber-300">{Number(vipData?.xp_points || 0).toLocaleString()} XP</span>
                <span className="text-white/70">
                  Target: {Number(vipData?.target_xp || 1000).toLocaleString()} XP ({vipData?.next_tier || 'Silver'})
                </span>
              </div>
              <div className="w-full h-3 bg-[#0B0F19]/80 rounded-full overflow-hidden p-0.5 border border-white/10 shadow-inner">
                <div 
                  className="h-full rounded-full bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-300 transition-all duration-500 shadow-sm"
                  style={{ width: `${Math.max(4, Math.min(100, vipData?.progress_pct || 10))}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-[10px] text-[#94A3B8]">
                <span>Progress: {vipData?.progress_pct || 0}%</span>
                <span>Wagered: {Number(vipData?.total_wagered || 0).toLocaleString()} FC</span>
              </div>
            </div>
          </div>

          {/* VIP Perks Summary Pill Box */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 w-full lg:w-auto">
            <div className="p-3 rounded-2xl bg-[#0B0F19]/90 border border-white/10 text-center">
              <span className="text-[10px] text-[#94A3B8] uppercase block font-bold">Faucet Multiplier</span>
              <span className="text-base font-black font-mono-numbers text-amber-300">
                {vipData?.faucet_multiplier || 1.0}x
              </span>
            </div>

            <div className="p-3 rounded-2xl bg-[#0B0F19]/90 border border-white/10 text-center">
              <span className="text-[10px] text-[#94A3B8] uppercase block font-bold">Wheel Bonus</span>
              <span className="text-base font-black font-mono-numbers text-emerald-400">
                +{Math.round(((vipData?.faucet_multiplier || 1.0) - 1.0) * 100)}%
              </span>
            </div>

            <div className="p-3 rounded-2xl bg-[#0B0F19]/90 border border-white/10 text-center col-span-2 sm:col-span-1">
              <span className="text-[10px] text-[#94A3B8] uppercase block font-bold">Chat Badge</span>
              <span className="text-xs font-black text-purple-300 flex items-center justify-center gap-1 mt-0.5">
                {vipTheme.icon} {vipData?.current_tier || 'Bronze'}
              </span>
            </div>
          </div>

        </div>
      </div>

      {/* 3. INTERACTIVE DAILY LUCKY WHEEL MINI-GAME */}
      <div className="rounded-3xl bg-[#111827] border border-[#1F2737] p-6 sm:p-8 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col lg:flex-row items-center justify-between gap-8">
          
          {/* Wheel Graphic */}
          <div className="relative flex flex-col items-center shrink-0">
            {/* Top Indicator Arrow */}
            <div className="absolute -top-3 z-30 drop-shadow-[0_4px_8px_rgba(0,0,0,0.8)]">
              <div className="w-0 h-0 border-l-[14px] border-l-transparent border-r-[14px] border-r-transparent border-t-[22px] border-t-amber-400 filter drop-shadow" />
            </div>

            {/* Rotating SVG Wheel */}
            <div 
              className="w-72 h-72 sm:w-80 sm:h-80 rounded-full border-4 border-amber-400/80 shadow-[0_0_35px_rgba(245,196,81,0.25)] p-1 bg-[#0B0F19]"
            >
              <svg 
                viewBox="0 0 300 300" 
                className="w-full h-full transform transition-transform duration-[3800ms] ease-[cubic-bezier(0.15,0.85,0.25,1)]"
                style={{ transform: `rotate(${wheelRotation}deg)` }}
              >
                {/* 8 Slices */}
                {WHEEL_SLICES.map((s, idx) => {
                  const angle = 360 / 8; // 45 deg
                  const startAngle = idx * angle;
                  const endAngle = startAngle + angle;
                  
                  // Convert polar to cartesian
                  const radStart = (startAngle - 90) * (Math.PI / 180);
                  const radEnd = (endAngle - 90) * (Math.PI / 180);
                  const x1 = 150 + 140 * Math.cos(radStart);
                  const y1 = 150 + 140 * Math.sin(radStart);
                  const x2 = 150 + 140 * Math.cos(radEnd);
                  const y2 = 150 + 140 * Math.sin(radEnd);

                  // Text rotation angle
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
                <circle cx="150" cy="150" r="32" fill="#0B0F19" stroke="#F5C451" strokeWidth="4" />
                <circle cx="150" cy="150" r="22" fill="#F5C451" />
                <text x="150" y="150" fill="#0B0F19" fontSize="14" fontWeight="900" textAnchor="middle" dominantBaseline="central">
                  FC
                </text>
              </svg>
            </div>
          </div>

          {/* Wheel Action & Information */}
          <div className="space-y-4 max-w-lg text-center lg:text-left">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs font-mono font-bold">
              <Gift className="w-3.5 h-3.5 text-amber-400" />
              <span>FREE 24-HOUR DAILY FAUCET SPIN</span>
            </div>

            <h2 className="font-display font-black text-2xl text-white">
              Spin & Win Up to 1,000 FC Every Day
            </h2>

            <p className="text-xs sm:text-sm text-[#94A3B8] leading-relaxed">
              Every registered player gets 1 guaranteed free spin every 24 hours. Your VIP status multiplies your win by up to <strong className="text-amber-300">{vipData?.faucet_multiplier || 1.0}x</strong>!
            </p>

            {recentPrize && (
              <div className="p-3.5 rounded-2xl bg-amber-500/15 border border-amber-400/50 text-xs font-mono animate-in zoom-in-95 duration-200">
                <span className="text-amber-300 font-bold block text-sm">
                  🎉 You won {recentPrize.final_prize} Flow Coins!
                </span>
                <span className="text-[11px] text-[#94A3B8]">
                  Base Prize: {recentPrize.base_prize} FC · VIP Multiplier: {recentPrize.vip_multiplier}x
                </span>
              </div>
            )}

            <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
              <button
                onClick={handleSpinWheel}
                disabled={isSpinningWheel || wheelCooldownSeconds > 0}
                className={`w-full sm:w-auto px-8 py-3.5 rounded-2xl font-black text-sm flex items-center justify-center gap-2.5 shadow-xl transition-all cursor-pointer ${
                  isSpinningWheel
                    ? 'bg-amber-500/30 text-amber-200 cursor-not-allowed'
                    : wheelCooldownSeconds > 0
                    ? 'bg-[#151C2B] text-[#94A3B8] border border-[#2D3545] cursor-not-allowed'
                    : 'btn-gold text-black shadow-amber-500/30 hover:scale-105'
                }`}
              >
                <Sparkles className={`w-4 h-4 ${isSpinningWheel ? 'animate-spin' : ''}`} />
                <span>{isSpinningWheel ? 'Spinning Wheel...' : wheelCooldownSeconds > 0 ? `Next Spin in ${formatCooldown(wheelCooldownSeconds)}` : 'SPIN WHEEL NOW'}</span>
              </button>

              {wheelCooldownSeconds > 0 && (
                <div className="text-xs font-mono-numbers text-[#94A3B8] flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-amber-400" />
                  <span>Resets in {formatCooldown(wheelCooldownSeconds)}</span>
                </div>
              )}
            </div>
          </div>

        </div>
      </div>

      {/* 4. UNIFIED 7-DAY STREAK & DAILY BONUS CLAIM */}
      <div className="rounded-3xl bg-[#111827] border border-[#1F2737] p-6 sm:p-7 space-y-5 shadow-2xl relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-[#1F2737]">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h2 className="font-display font-extrabold text-lg sm:text-xl text-white flex items-center gap-2">
                <Calendar className="w-5 h-5 text-amber-400" />
                <span>7-Day Daily Check-In & Bonus Faucet</span>
              </h2>
              <span className="text-[10px] font-mono-numbers px-2 py-0.5 rounded bg-amber-500/20 text-[#ffd700] border border-amber-500/40 uppercase font-bold tracking-wider">
                1 FLO = 1 USDT
              </span>
              <span className="text-[10px] font-mono-numbers px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 uppercase font-bold tracking-wider">
                Day {dailyRewardStatus.currentStreak || 1} of 7
              </span>
            </div>
            <p className="text-xs text-[#94A3B8]">
              {dailyRewardStatus.canClaim
                ? `Ready to claim! Available today: +${(dailyRewardStatus.availableReward || 0.10).toFixed(2)} FLO (≈ $${(dailyRewardStatus.availableReward || 0.10).toFixed(2)} USDT).`
                : `Reward claimed for today! Day ${dailyRewardStatus.nextStreak || 2} reward (+${(dailyRewardStatus.nextRewardAmount || 0.15).toFixed(2)} FLO) unlocks in ${formatCooldown(dailyRewardStatus.secondsRemaining)}.`
              }
            </p>
          </div>

          {/* Unified Authoritative Claim Button */}
          <button
            onClick={handleClaimDailyStreak}
            disabled={!dailyRewardStatus.canClaim || isClaimingStreak}
            className={`px-6 py-3.5 rounded-2xl text-xs sm:text-sm font-black flex items-center justify-center gap-2.5 shadow-xl transition-all cursor-pointer whitespace-nowrap shrink-0 ${
              dailyRewardStatus.canClaim
                ? 'btn-gold shadow-amber-500/30 hover:scale-105'
                : 'bg-[#151C2B] text-[#94A3B8] border border-[#2D3545] cursor-not-allowed shadow-none'
            }`}
          >
            {isClaimingStreak ? (
              <>
                <RotateCcw className="w-4 h-4 animate-spin text-amber-300" />
                <span>Crediting Wallet...</span>
              </>
            ) : dailyRewardStatus.canClaim ? (
              <>
                <Gift className="w-4 h-4 text-black animate-bounce" />
                <span>Claim Day {dailyRewardStatus.currentStreak || 1} (+{(dailyRewardStatus.availableReward || 0.10).toFixed(2)} FLO)</span>
              </>
            ) : (
              <>
                <Clock className="w-4 h-4 text-amber-400" />
                <span>Claimed (Unlocks in {formatCooldown(dailyRewardStatus.secondsRemaining)})</span>
              </>
            )}
          </button>
        </div>

        {/* 7 Day Blocks Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 pt-1">
          {[1, 2, 3, 4, 5, 6, 7].map((day) => {
            const currentDayNum = dailyRewardStatus.currentStreak || 1;
            const isCompleted = day < currentDayNum || (!dailyRewardStatus.canClaim && day === currentDayNum);
            const isCurrent = day === currentDayNum && dailyRewardStatus.canClaim;
            const defaultRewards = [0.10, 0.15, 0.20, 0.25, 0.30, 0.40, 1.00];
            const rewardVal = dailyRewardStatus.checkinSettings?.streak_rewards?.[`day${day}`] !== undefined 
              ? Number(dailyRewardStatus.checkinSettings.streak_rewards[`day${day}`]) 
              : defaultRewards[day - 1];
            const isJackpot = day === 7;

            return (
              <div
                key={day}
                className={`rounded-2xl p-4 flex flex-col items-center text-center justify-between border transition-all ${
                  isCurrent
                    ? 'bg-gradient-to-b from-amber-500/20 to-amber-950/40 border-amber-400 shadow-[0_0_20px_rgba(245,196,81,0.25)] scale-105'
                    : isCompleted
                    ? 'bg-[#0B0F19]/90 border-emerald-500/40 text-emerald-300'
                    : isJackpot
                    ? 'bg-purple-950/30 border-purple-500/30 text-purple-300'
                    : 'bg-[#0B0F19] border-[#1F2737] text-[#94A3B8] opacity-75'
                }`}
              >
                <div className="w-full flex items-center justify-between text-[10px] font-mono-numbers font-bold mb-2">
                  <span>Day {day}</span>
                  {isCompleted ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  ) : isCurrent ? (
                    <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                  ) : (
                    <Clock className="w-3 h-3 text-[#64748B]" />
                  )}
                </div>

                <div className="text-3xl my-2">
                  {isJackpot ? '💎' : '🪙'}
                </div>

                <div className="w-full pt-1">
                  <span className={`font-mono-numbers font-black text-sm block ${
                    isCurrent ? 'text-amber-300' : isCompleted ? 'text-emerald-400' : 'text-white'
                  }`}>
                    +{rewardVal.toFixed(2)} FLO
                  </span>
                  <span className="text-[10px] text-white/50 font-mono-numbers block mt-0.5">
                    ≈ ${rewardVal.toFixed(2)} USDT
                  </span>
                  <span className="text-[9px] uppercase tracking-wider block opacity-80 mt-1 font-bold">
                    {isCompleted ? 'Claimed' : isCurrent ? 'Available' : isJackpot ? 'Jackpot' : 'Locked'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 5. ACHIEVEMENTS & MILESTONES */}
      <div className="rounded-3xl bg-[#111827] border border-[#1F2737] p-6 space-y-4 shadow-xl">
        <div className="pb-3 border-b border-[#1F2737]">
          <h2 className="font-display font-extrabold text-lg text-white flex items-center gap-2">
            <Trophy className="w-5 h-5 text-amber-400" />
            <span>Milestone Achievements</span>
          </h2>
          <p className="text-xs text-[#94A3B8]">
            Complete casino goals to unlock one-time Flow Coin grants.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
          {ACHIEVEMENTS.map((ach) => {
            const isClaimed = claimedAchievements.includes(ach.id);

            return (
              <div
                key={ach.id}
                className="rounded-2xl bg-[#0B0F19] border border-[#1F2737] p-4 flex items-center justify-between gap-4 hover:border-amber-500/30 transition-all shadow-md"
              >
                <div className="flex items-center gap-3.5">
                  <div className="w-12 h-12 rounded-2xl bg-[#151C2B] border border-[#2A374A] flex items-center justify-center text-2xl shadow-inner shrink-0">
                    {ach.icon}
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-display font-bold text-sm text-white">
                        {ach.title}
                      </h3>
                      <span className="text-[10px] font-mono-numbers px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/20 text-amber-300 font-bold">
                        +{ach.reward} FC
                      </span>
                    </div>
                    <p className="text-xs text-[#94A3B8] leading-snug">
                      {ach.description}
                    </p>

                    {/* Progress Bar */}
                    <div className="w-36 h-1.5 bg-[#1F2737] rounded-full overflow-hidden mt-1">
                      <div 
                        className={`h-full rounded-full transition-all ${ach.unlocked ? 'bg-emerald-400' : 'bg-amber-400'}`}
                        style={{ width: `${ach.progress}%` }}
                      />
                    </div>
                  </div>
                </div>

                <div>
                  {isClaimed ? (
                    <span className="text-xs font-mono-numbers text-emerald-400 font-bold flex items-center gap-1">
                      <CheckCircle2 className="w-4 h-4" />
                      Claimed
                    </span>
                  ) : ach.unlocked ? (
                    <button
                      onClick={() => handleClaimAchievement(ach)}
                      className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-black font-extrabold text-xs shadow-md shadow-emerald-500/20 cursor-pointer"
                    >
                      Claim
                    </button>
                  ) : (
                    <span className="text-xs font-mono-numbers text-[#64748B]">
                      {ach.progress}%
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

    </div>
  );
}
