import React, { useState } from 'react';
import { useLottery } from '../context/LotteryContext';
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
  Award
} from 'lucide-react';
import confetti from 'canvas-confetti';

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
    progress: 100,
    unlocked: true,
    icon: '🎲'
  },
  {
    id: 'high_roller',
    title: 'High Roller',
    description: 'Place a single wager of 50 FC or higher',
    reward: 100,
    progress: 100,
    unlocked: true,
    icon: '👑'
  },
  {
    id: 'lucky_streak',
    title: 'Lucky Multiplier',
    description: 'Hit any outcome with multiplier >= 5.0x',
    reward: 150,
    progress: 100,
    unlocked: true,
    icon: '⚡'
  },
  {
    id: 'games_veteran',
    title: 'Casino Explorer',
    description: 'Play 5 or more different games from the 12-game catalog',
    reward: 200,
    progress: 80,
    unlocked: false,
    icon: '🌟'
  },
  {
    id: 'century_club',
    title: 'Flow Coin Whale',
    description: 'Accumulate a balance of 1,000 Flow Coins or more',
    reward: 500,
    progress: 60,
    unlocked: false,
    icon: '💎'
  }
];

export default function RewardsView() {
  const { wallet, claimDailyBonus, showToast } = useLottery();
  const [claimedAchievements, setClaimedAchievements] = useState([]);
  const [isClaiming, setIsClaiming] = useState(false);

  // Active streak mock (Current day 3)
  const currentStreakDay = 3;

  const handleClaimDaily = async () => {
    if (isClaiming) return;
    setIsClaiming(true);

    try {
      await claimDailyBonus();
      confetti({
        particleCount: 90,
        spread: 80,
        origin: { y: 0.5 },
        colors: ['#F5C451', '#22C55E', '#A855F7']
      });
    } catch (_) {}
    setIsClaiming(false);
  };

  const handleClaimAchievement = (ach) => {
    if (claimedAchievements.includes(ach.id) || !ach.unlocked) return;
    setClaimedAchievements(prev => [...prev, ach.id]);
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

  return (
    <div className="max-w-6xl mx-auto space-y-6 text-left">
      
      {/* 1. HERO HEADER */}
      <div className="relative rounded-3xl bg-gradient-to-r from-[#111827] via-[#151C2B] to-[#111827] border border-[#1F2737] p-6 sm:p-8 overflow-hidden shadow-2xl">
        <div className="absolute top-0 right-0 w-80 h-80 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs font-mono-numbers font-bold">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>FREE SOCIAL GAMING FAUCET</span>
            </div>
            <h1 className="font-display font-black text-2xl sm:text-3xl text-white tracking-tight">
              Rewards, Faucets & Achievements
            </h1>
            <p className="text-xs sm:text-sm text-[#94A3B8] leading-relaxed">
              Earn free Flow Coins daily! Claim your 24-hour streak bonus, complete milestone achievements across the 12 games, and level up your status with zero financial risk.
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
                {wallet.balance.toLocaleString('en-US', { minimumFractionDigits: 2 })} FC
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. 7-DAY STREAK CALENDAR */}
      <div className="rounded-3xl bg-[#111827] border border-[#1F2737] p-6 space-y-4 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-[#1F2737]">
          <div>
            <h2 className="font-display font-extrabold text-lg text-white flex items-center gap-2">
              <Calendar className="w-5 h-5 text-amber-400" />
              <span>7-Day Daily Claim Streak</span>
            </h2>
            <p className="text-xs text-[#94A3B8]">
              Log in every 24 hours to increase your daily reward. Reach Day 7 to unlock the 500 FC Jackpot!
            </p>
          </div>

          <button
            onClick={handleClaimDaily}
            disabled={isClaiming}
            className="px-5 py-2.5 rounded-xl btn-gold text-xs font-black flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-amber-500/20 shrink-0 hover:scale-105 transition-all"
          >
            <Gift className="w-4 h-4 text-black animate-bounce" />
            <span>Claim Daily 100 FC</span>
          </button>
        </div>

        {/* 7 Day Blocks Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 pt-2">
          {STREAK_DAYS.map((s) => {
            const isCompleted = s.day < currentStreakDay;
            const isCurrent = s.day === currentStreakDay;

            return (
              <div
                key={s.day}
                className={`rounded-2xl p-4 flex flex-col items-center text-center justify-between border transition-all ${
                  isCurrent
                    ? 'bg-gradient-to-b from-amber-500/20 to-amber-950/40 border-amber-400 shadow-[0_0_20px_rgba(245,196,81,0.25)] scale-105'
                    : isCompleted
                    ? 'bg-[#0B0F19]/90 border-emerald-500/40 text-emerald-300'
                    : s.isJackpot
                    ? 'bg-purple-950/30 border-purple-500/30 text-purple-300'
                    : 'bg-[#0B0F19] border-[#1F2737] text-[#94A3B8] opacity-75'
                }`}
              >
                <div className="w-full flex items-center justify-between text-[10px] font-mono-numbers font-bold mb-2">
                  <span>Day {s.day}</span>
                  {isCompleted ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  ) : isCurrent ? (
                    <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                  ) : (
                    <Clock className="w-3 h-3 text-[#64748B]" />
                  )}
                </div>

                <div className="text-3xl my-2">
                  {s.isJackpot ? '💎' : '🪙'}
                </div>

                <div className="w-full pt-1">
                  <span className={`font-mono-numbers font-black text-sm block ${
                    isCurrent ? 'text-amber-300' : isCompleted ? 'text-emerald-400' : 'text-white'
                  }`}>
                    +{s.amount} FC
                  </span>
                  <span className="text-[9px] uppercase tracking-wider block opacity-70 mt-0.5">
                    {isCompleted ? 'Claimed' : isCurrent ? 'Available' : 'Locked'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 3. ACHIEVEMENTS & MILESTONES */}
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

