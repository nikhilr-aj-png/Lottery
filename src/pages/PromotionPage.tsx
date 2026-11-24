import React, { useState, useEffect, useMemo } from 'react';
import { useLottery } from '../context/LotteryContext';
import { supabase } from '../lib/supabase';
import { 
  Users, 
  Gift, 
  Share2, 
  Copy, 
  Check, 
  Sparkles, 
  Trophy, 
  Coins, 
  ArrowRight, 
  ArrowLeft,
  ShieldCheck, 
  Flame, 
  Clock, 
  RotateCcw,
  Percent,
  CheckCircle2,
  ChevronRight,
  TrendingUp,
  MessageCircle,
  Award
} from 'lucide-react';
import { useSoundFX } from '../hooks/useSoundFX';
import confetti from 'canvas-confetti';

interface PromotionPageProps {
  onBackToHome?: () => void;
}

export default function PromotionPage({ onBackToHome }: PromotionPageProps) {
  const { user, profile, wallet, showToast, setIsAuthModalOpen, platformSettings } = useLottery();
  const { playClick, playRouletteSpin, playDialTick, playWinFanfare } = useSoundFX();

  // Active sub-tab: 'referral' | 'spin-wheel'
  const [activeSubTab, setActiveSubTab] = useState<'referral' | 'spin-wheel'>('referral');

  // Copy state
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  // Unique referral code derived from profile or username or user ID
  const referralCode = useMemo(() => {
    if (profile?.referral_code) {
      return profile.referral_code.toUpperCase();
    }
    if (profile?.username) {
      return profile.username.toUpperCase();
    }
    if (user?.id) {
      return 'EF' + user.id.replace(/-/g, '').slice(0, 6).toUpperCase();
    }
    return 'EARNFLOW';
  }, [profile?.referral_code, profile?.username, user?.id]);

  const referralLink = useMemo(() => {
    if (typeof window !== 'undefined') {
      return `${window.location.origin}/?ref=${referralCode}`;
    }
    return `https://earnflow.in/?ref=${referralCode}`;
  }, [referralCode]);

  // Referral Data
  const [referrals, setReferrals] = useState<any[]>([]);
  const [rewardsHistory, setRewardsHistory] = useState<any[]>([]);
  const [loadingReferrals, setLoadingReferrals] = useState(false);

  // Fetch real user referral data
  useEffect(() => {
    if (!user?.id) return;
    let isMounted = true;
    const fetchReferralData = async () => {
      setLoadingReferrals(true);
      try {
        const { data: refData } = await supabase
          .from('user_referrals')
          .select('*')
          .eq('referrer_id', user.id)
          .order('created_at', { ascending: false });

        if (isMounted && Array.isArray(refData)) {
          setReferrals(refData);
        }

        const { data: rewData } = await supabase
          .from('referral_rewards')
          .select('*')
          .eq('referrer_id', user.id)
          .order('created_at', { ascending: false });

        if (isMounted && Array.isArray(rewData)) {
          setRewardsHistory(rewData);
        }
      } catch (err) {
        console.warn('Error fetching referral data:', err);
      } finally {
        if (isMounted) setLoadingReferrals(false);
      }
    };

    fetchReferralData();
    return () => { isMounted = false; };
  }, [user?.id]);

  // Computed Referral Stats
  const totalReferredCount = referrals.length;
  const activeReferralsCount = referrals.filter(r => r.status === 'active').length;
  const totalEarnedUsdt = useMemo(() => {
    return rewardsHistory.reduce((sum, r) => sum + Number(r.amount || 0), 0);
  }, [rewardsHistory]);

  // Handle Copy Actions
  const handleCopyLink = () => {
    playClick();
    navigator.clipboard.writeText(referralLink);
    setCopiedLink(true);
    showToast('Referral link copied to clipboard!', 'success');
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleCopyCode = () => {
    playClick();
    navigator.clipboard.writeText(referralCode);
    setCopiedCode(true);
    showToast('Referral code copied to clipboard!', 'success');
    setTimeout(() => setCopiedCode(false), 2000);
  };

  // WhatsApp Share Handler
  const handleShareWhatsApp = () => {
    playClick();
    const text = `Join EarnFlow.in Four Digit Lottery and win live USDT jackpot pools! Use my referral code ${referralCode} to sign up: ${referralLink}`;
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer');
  };

  // --------------------------------------------------------------------------
  // SPIN WHEEL MODULE
  // --------------------------------------------------------------------------
  const [wheelRotation, setWheelRotation] = useState(0);
  const [isSpinningWheel, setIsSpinningWheel] = useState(false);
  const [wheelCooldownSeconds, setWheelCooldownSeconds] = useState(0);
  const [recentPrize, setRecentPrize] = useState<any>(null);
  const [spinHistory, setSpinHistory] = useState<any[]>([]);

  // Spin Wheel Slices
  const wheelSlices = useMemo(() => {
    const customSegments = platformSettings?.spinWheelSettings?.segments;
    if (Array.isArray(customSegments) && customSegments.length === 8) {
      return customSegments;
    }
    return [
      { index: 0, amount: 0.10, label: '0.10 USDT', color: '#B45309', textColor: '#FEF3C7', border: '#D97706' },
      { index: 1, amount: 0.20, label: '0.20 USDT', color: '#475569', textColor: '#F1F5F9', border: '#64748B' },
      { index: 2, amount: 0.25, label: '0.25 USDT', color: '#854D0E', textColor: '#FEF9C3', border: '#CA8A04' },
      { index: 3, amount: 0.50, label: '0.50 USDT', color: '#065F46', textColor: '#D1FAE5', border: '#059669' },
      { index: 4, amount: 0.75, label: '0.75 USDT', color: '#1E40AF', textColor: '#DBEAFE', border: '#2563EB' },
      { index: 5, amount: 1.00, label: '1.00 USDT', color: '#7C2D12', textColor: '#FFEDD5', border: '#EA580C' },
      { index: 6, amount: 2.50, label: '2.50 USDT', color: '#581C87', textColor: '#F3E8FF', border: '#9333EA' },
      { index: 7, amount: 5.00, label: '5.00 USDT', color: '#831843', textColor: '#FCE7F3', border: '#DB2777' }
    ];
  }, [platformSettings?.spinWheelSettings]);

  // Load user spin history and cooldown
  useEffect(() => {
    if (!wallet?.address) return;
    let isMounted = true;
    const fetchSpinStatus = async () => {
      try {
        const { data: vipData } = await supabase
          .from('user_vip_progress')
          .select('last_wheel_spin_at')
          .eq('wallet_address', wallet.address)
          .single();

        if (isMounted && vipData?.last_wheel_spin_at) {
          const lastSpin = new Date(vipData.last_wheel_spin_at).getTime();
          const elapsedSecs = Math.floor((Date.now() - lastSpin) / 1000);
          const cooldownTotal = 86400;
          if (elapsedSecs < cooldownTotal) {
            setWheelCooldownSeconds(cooldownTotal - elapsedSecs);
          }
        }

        const { data: ledgerSpins } = await supabase
          .from('wallet_ledger')
          .select('*')
          .eq('wallet_address', wallet.address)
          .eq('transaction_type', 'lucky_wheel_spin')
          .order('created_at', { ascending: false })
          .limit(10);

        if (isMounted && Array.isArray(ledgerSpins)) {
          setSpinHistory(ledgerSpins);
        }
      } catch (e) {
        console.warn('fetchSpinStatus error:', e);
      }
    };

    fetchSpinStatus();
    return () => { isMounted = false; };
  }, [wallet?.address]);

  // Countdown timer for spin wheel
  useEffect(() => {
    if (wheelCooldownSeconds <= 0) return;
    const t = setInterval(() => {
      setWheelCooldownSeconds(prev => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(t);
  }, [wheelCooldownSeconds]);

  const formatCooldown = (secs: number) => {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // Trigger Spin Wheel with authoritative server calculation
  const handleSpinWheel = async () => {
    if (isSpinningWheel) return;

    if (!user || !wallet?.address) {
      showToast('Please sign in to spin the Lucky Wheel!', 'info');
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
      const { data, error } = await supabase.rpc('spin_lucky_wheel', {
        p_user_address: wallet.address,
        p_user_id: user?.id || null
      });

      if (error || !data || !data.success) {
        showToast(data?.error || error?.message || 'Failed to spin Lucky Wheel', 'error');
        setIsSpinningWheel(false);
        return;
      }

      // Calculate exact angle so chosen slice lands under top arrow (270 deg / top)
      const sliceIdx = data.slice_index !== undefined ? data.slice_index : 0;
      const sliceAngle = 360 / 8; // 45 degrees
      const targetAngleWithinSlice = 22.5; // center
      const sliceCenter = sliceIdx * sliceAngle + targetAngleWithinSlice;
      const extraSpins = 360 * 5;
      const nextRotation = wheelRotation + extraSpins + (360 - (sliceCenter % 360));

      setWheelRotation(nextRotation);
      playRouletteSpin();

      const tickInterval = setInterval(() => {
        playDialTick();
      }, 180);

      setTimeout(() => {
        clearInterval(tickInterval);
        setIsSpinningWheel(false);
        setRecentPrize(data);
        setWheelCooldownSeconds(86400);

        if (Number(data.final_prize) >= 2.50) {
          playWinFanfare('jackpot');
        } else {
          playWinFanfare('big');
        }

        confetti({
          particleCount: 100,
          spread: 80,
          origin: { y: 0.6 }
        });

        showToast(`🎉 Congratulations! You won ${data.final_prize} USDT! Credited to your wallet.`, 'success');
      }, 3800);

    } catch (err: any) {
      console.error('handleSpinWheel error:', err);
      showToast('Spin failed: ' + (err.message || err), 'error');
      setIsSpinningWheel(false);
    }
  };

  return (
    <div className="space-y-6 pb-8 text-left animate-in fade-in duration-200">
      
      {/* Header & Back Navigation */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-[#1F2737]">
        <div className="flex items-center gap-3">
          {onBackToHome && (
            <button
              onClick={onBackToHome}
              className="p-2 rounded-xl bg-[#141924] hover:bg-[#1f2738] text-[#f5c451] border border-amber-500/25 transition-all cursor-pointer shrink-0"
              title="Return to Home"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
          )}
          <div>
            <div className="flex items-center gap-2">
              <span className="p-1 rounded-md bg-amber-500/15 text-amber-400 border border-amber-500/30">
                <Gift className="w-4 h-4" />
              </span>
              <h1 className="font-display font-extrabold text-xl sm:text-2xl text-white">
                Promotions &amp; Referral Hub
              </h1>
            </div>
            <p className="text-xs text-[#94A3B8] mt-0.5">
              Invite friends, earn USDT commission rewards, and spin the daily bonus wheel.
            </p>
          </div>
        </div>

        {/* Sub-tab Pill Switcher */}
        <div className="flex items-center gap-1 p-1 rounded-xl bg-[#0B0F19] border border-[#1F2737] shrink-0 text-xs w-full sm:w-auto">
          <button
            onClick={() => { playClick(); setActiveSubTab('referral'); }}
            className={`flex-1 sm:flex-initial px-4 py-2 rounded-lg font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              activeSubTab === 'referral'
                ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-black shadow-md'
                : 'text-[#94A3B8] hover:text-white hover:bg-[#141924]'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Referral Program</span>
          </button>

          <button
            onClick={() => { playClick(); setActiveSubTab('spin-wheel'); }}
            className={`flex-1 sm:flex-initial px-4 py-2 rounded-lg font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              activeSubTab === 'spin-wheel'
                ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-black shadow-md'
                : 'text-[#94A3B8] hover:text-white hover:bg-[#141924]'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Daily Spin Wheel</span>
          </button>
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* TAB 1: REFERRAL PROGRAM                                            */}
      {/* ------------------------------------------------------------------ */}
      {activeSubTab === 'referral' && (
        <div className="space-y-6">
          
          {/* Hero Banner: Invite Friends & Earn USDT */}
          <section className="relative overflow-hidden rounded-2xl sm:rounded-3xl bg-gradient-to-br from-[#121624] via-[#0E131F] to-[#1C1335] border border-amber-500/30 p-5 sm:p-7 shadow-2xl">
            <div className="absolute top-0 right-0 w-80 h-80 bg-gradient-to-b from-amber-500/15 via-purple-600/10 to-transparent rounded-full blur-3xl pointer-events-none" />

            <div className="relative z-10 flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-6">
              <div className="space-y-3 max-w-xl">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 font-mono-numbers text-[11px] font-bold">
                  <Flame className="w-3.5 h-3.5 text-amber-400" />
                  <span>EarnFlow Partner Rewards · USDT TRC-20</span>
                </span>
                
                <h2 className="font-display font-black text-xl sm:text-3xl text-white tracking-tight leading-tight">
                  Invite Friends &amp; Earn <span className="text-amber-400">USDT Rewards</span>
                </h2>

                <p className="text-xs sm:text-sm text-[#CBD5E1] leading-relaxed">
                  Share your unique referral link. Earn direct USDT bonuses when friends register, top up their wallets, and participate in Four Digit Lottery draws.
                </p>

                <div className="grid grid-cols-3 gap-2 pt-2 text-[11px]">
                  <div className="p-2.5 rounded-xl bg-[#0B0F19]/80 border border-[#1F2737]">
                    <span className="text-[10px] text-[#94A3B8] block">Registration</span>
                    <strong className="text-emerald-400 font-bold">0.25 USDT</strong>
                  </div>
                  <div className="p-2.5 rounded-xl bg-[#0B0F19]/80 border border-[#1F2737]">
                    <span className="text-[10px] text-[#94A3B8] block">First Deposit</span>
                    <strong className="text-amber-400 font-bold">5% Bonus</strong>
                  </div>
                  <div className="p-2.5 rounded-xl bg-[#0B0F19]/80 border border-[#1F2737]">
                    <span className="text-[10px] text-[#94A3B8] block">Commissions</span>
                    <strong className="text-purple-400 font-bold">1% Lifetime</strong>
                  </div>
                </div>
              </div>

              {/* Share Card */}
              <div className="w-full lg:w-96 p-4 sm:p-5 rounded-2xl bg-[#0B0F19]/90 border border-amber-500/25 space-y-3.5 shadow-xl backdrop-blur-md">
                <span className="text-xs font-bold text-white uppercase tracking-wider block">
                  Your Referral Link &amp; Code
                </span>

                {user ? (
                  <>
                    <div className="space-y-1.5">
                      <label className="text-[10px] text-[#94A3B8] uppercase font-mono-numbers">Referral Link:</label>
                      <div className="flex items-center gap-2 p-2 rounded-xl bg-[#111827] border border-[#1F2737]">
                        <input
                          type="text"
                          readOnly
                          value={referralLink}
                          className="bg-transparent text-xs text-white flex-1 outline-none font-mono truncate"
                        />
                        <button
                          onClick={handleCopyLink}
                          className="px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-[11px] font-bold flex items-center gap-1 cursor-pointer transition-all"
                        >
                          {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                          <span>{copiedLink ? 'Copied' : 'Copy'}</span>
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="flex-1 p-2 rounded-xl bg-[#111827] border border-[#1F2737] flex items-center justify-between">
                        <div>
                          <span className="text-[9px] text-[#94A3B8] uppercase block">Referral Code</span>
                          <strong className="text-amber-400 font-mono text-sm tracking-wider">{referralCode}</strong>
                        </div>
                        <button
                          onClick={handleCopyCode}
                          className="p-1.5 rounded-lg bg-[#141924] hover:bg-[#1f2738] text-[#94A3B8] hover:text-white border border-[#272A31] cursor-pointer"
                          title="Copy Code"
                        >
                          {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                      </div>

                      <button
                        onClick={handleShareWhatsApp}
                        className="px-4 py-2.5 rounded-xl bg-[#25D366]/20 hover:bg-[#25D366]/30 text-[#25D366] border border-[#25D366]/40 text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all shrink-0 shadow-sm"
                      >
                        <MessageCircle className="w-4 h-4 fill-current" />
                        <span>WhatsApp</span>
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="p-4 rounded-xl bg-[#111827] border border-[#1F2737] text-center space-y-2">
                    <p className="text-xs text-[#94A3B8]">Sign in to get your personalized referral code and start earning USDT.</p>
                    <button
                      onClick={() => setIsAuthModalOpen(true)}
                      className="btn-gold px-4 py-2 rounded-xl text-xs font-bold"
                    >
                      Sign In to Access Referral Link
                    </button>
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* Referral Statistics Row */}
          <section className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 sm:gap-4">
            <div className="p-4 rounded-2xl bg-[#111827] border border-[#1F2737] space-y-1">
              <div className="flex items-center justify-between text-xs text-[#94A3B8]">
                <span>Total Referred Friends</span>
                <Users className="w-4 h-4 text-blue-400" />
              </div>
              <div className="font-mono-numbers font-black text-2xl text-white">
                {totalReferredCount}
              </div>
              <p className="text-[10px] text-[#64748B]">Real registrations attributed to your code</p>
            </div>

            <div className="p-4 rounded-2xl bg-[#111827] border border-[#1F2737] space-y-1">
              <div className="flex items-center justify-between text-xs text-[#94A3B8]">
                <span>Active Referrals</span>
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="font-mono-numbers font-black text-2xl text-emerald-400">
                {activeReferralsCount}
              </div>
              <p className="text-[10px] text-[#64748B]">Participants with confirmed wallet activity</p>
            </div>

            <div className="p-4 rounded-2xl bg-[#111827] border border-[#1F2737] space-y-1">
              <div className="flex items-center justify-between text-xs text-[#94A3B8]">
                <span>Total USDT Earned</span>
                <Coins className="w-4 h-4 text-amber-400" />
              </div>
              <div className="font-mono-numbers font-black text-2xl text-amber-400">
                {totalEarnedUsdt.toFixed(2)} <span className="text-xs font-bold text-white">USDT</span>
              </div>
              <p className="text-[10px] text-[#64748B]">Credited automatically to your live wallet</p>
            </div>
          </section>

          {/* Referral Reward History */}
          <section className="rounded-2xl bg-[#111827] border border-[#1F2737] p-4 sm:p-6 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-[#1F2737]">
              <div>
                <h3 className="font-display font-bold text-sm sm:text-base text-white">
                  Referral Reward History
                </h3>
                <p className="text-[11px] text-[#94A3B8]">
                  Transparent ledger records of all credited referral bonuses and commissions.
                </p>
              </div>
              <span className="text-[10px] font-mono-numbers px-2.5 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30 font-bold uppercase">
                {rewardsHistory.length} Rewards
              </span>
            </div>

            {loadingReferrals ? (
              <div className="py-8 text-center text-xs text-[#94A3B8]">Loading referral records...</div>
            ) : rewardsHistory.length === 0 ? (
              <div className="py-8 text-center space-y-2">
                <Users className="w-8 h-8 text-[#475569] mx-auto" />
                <p className="text-xs text-[#94A3B8]">No referral rewards credited yet.</p>
                <p className="text-[11px] text-[#64748B]">Share your referral link with friends to begin earning registration, deposit, and gameplay commissions!</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="text-[#94A3B8] border-b border-[#1F2737] text-[10px] uppercase font-mono-numbers">
                      <th className="py-2.5 px-3">Date</th>
                      <th className="py-2.5 px-3">Reward Type</th>
                      <th className="py-2.5 px-3">Amount</th>
                      <th className="py-2.5 px-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1F2737]">
                    {rewardsHistory.map((rew, idx) => (
                      <tr key={idx} className="hover:bg-[#151D2F]">
                        <td className="py-2.5 px-3 text-[#CBD5E1] whitespace-nowrap">
                          {new Date(rew.created_at).toLocaleDateString()} {new Date(rew.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td className="py-2.5 px-3 capitalize font-medium text-white">
                          {rew.reward_type?.replace(/_/g, ' ') || 'Referral Commission'}
                        </td>
                        <td className="py-2.5 px-3 font-mono-numbers font-bold text-emerald-400">
                          +{Number(rew.amount || 0).toFixed(2)} USDT
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="px-2 py-0.5 rounded text-[10px] font-mono-numbers bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 uppercase font-bold">
                            {rew.status || 'Completed'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* TAB 2: DAILY BONUS SPIN WHEEL                                      */}
      {/* ------------------------------------------------------------------ */}
      {activeSubTab === 'spin-wheel' && (
        <div className="space-y-6">
          <section className="rounded-2xl sm:rounded-3xl bg-gradient-to-br from-[#121624] via-[#0E131F] to-[#1C1335] border border-amber-500/30 p-5 sm:p-7 shadow-2xl">
            <div className="max-w-2xl mx-auto text-center space-y-2 mb-6">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 font-mono-numbers text-[11px] font-bold">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span>Daily Free Reward Wheel · 100% USDT Credit</span>
              </span>
              <h2 className="font-display font-black text-2xl sm:text-3xl text-white">
                Spin The Lucky Bonus Wheel
              </h2>
              <p className="text-xs sm:text-sm text-[#CBD5E1]">
                Every registered member gets 1 free spin every 24 hours. Winnings credit directly to your USDT wallet balance.
              </p>
            </div>

            {/* Interactive SVG Wheel */}
            <div className="flex flex-col items-center justify-center space-y-6">
              
              <div className="relative">
                {/* Pointer Arrow at top */}
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-20 pointer-events-none drop-shadow-[0_4px_8px_rgba(0,0,0,0.8)]">
                  <div className="w-0 h-0 border-l-[14px] border-l-transparent border-r-[14px] border-r-transparent border-t-[22px] border-t-amber-400 filter drop-shadow" />
                </div>

                <div className="w-64 h-64 xs:w-72 xs:h-72 sm:w-80 sm:h-80 rounded-full border-4 border-amber-400/80 shadow-[0_0_35px_rgba(245,196,81,0.25)] p-1 bg-[#0B0F19]">
                  <svg 
                    viewBox="0 0 300 300" 
                    className="w-full h-full transform transition-transform duration-[3800ms] ease-[cubic-bezier(0.15,0.85,0.25,1)]"
                    style={{ transform: `rotate(${wheelRotation}deg)` }}
                  >
                    {wheelSlices.map((s: any, idx: number) => {
                      const angle = 360 / 8;
                      const startAngle = idx * angle;
                      const endAngle = (idx + 1) * angle;
                      const startRad = (startAngle - 90) * (Math.PI / 180);
                      const endRad = (endAngle - 90) * (Math.PI / 180);
                      const x1 = 150 + 140 * Math.cos(startRad);
                      const y1 = 150 + 140 * Math.sin(startRad);
                      const x2 = 150 + 140 * Math.cos(endRad);
                      const y2 = 150 + 140 * Math.sin(endRad);
                      const d = `M 150 150 L ${x1} ${y1} A 140 140 0 0 1 ${x2} ${y2} Z`;

                      const midRad = ((startAngle + endAngle) / 2 - 90) * (Math.PI / 180);
                      const textX = 150 + 95 * Math.cos(midRad);
                      const textY = 150 + 95 * Math.sin(midRad);
                      const textRot = (startAngle + endAngle) / 2;

                      return (
                        <g key={idx}>
                          <path d={d} fill={s.color || '#334155'} stroke="#0B0F19" strokeWidth="2" />
                          <text 
                            x={textX} 
                            y={textY} 
                            fill={s.textColor || '#FFFFFF'} 
                            fontSize="11" 
                            fontWeight="800"
                            textAnchor="middle" 
                            dominantBaseline="central"
                            transform={`rotate(${textRot}, ${textX}, ${textY})`}
                          >
                            {s.label || `${s.amount} USDT`}
                          </text>
                        </g>
                      );
                    })}

                    {/* Center Hub */}
                    <circle cx="150" cy="150" r="30" fill="#0B0F19" stroke="#F5C451" strokeWidth="3" />
                    <circle cx="150" cy="150" r="16" fill="#F5C451" />
                  </svg>
                </div>
              </div>

              {/* Action Button */}
              <div className="flex flex-col items-center gap-2">
                <button
                  type="button"
                  onClick={handleSpinWheel}
                  disabled={isSpinningWheel || wheelCooldownSeconds > 0}
                  className={`px-8 py-3.5 rounded-2xl font-black text-xs sm:text-sm uppercase tracking-wider flex items-center gap-2.5 transition-all shadow-xl cursor-pointer ${
                    isSpinningWheel
                      ? 'bg-amber-500/50 text-black cursor-not-allowed'
                      : wheelCooldownSeconds > 0
                      ? 'bg-[#1F2737] text-[#94A3B8] border border-[#272A31] cursor-not-allowed'
                      : 'bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 hover:brightness-110 text-black shadow-amber-500/25 active:scale-95'
                  }`}
                >
                  <Sparkles className={`w-4 h-4 ${isSpinningWheel ? 'animate-spin' : ''}`} />
                  <span>
                    {isSpinningWheel
                      ? 'Spinning Wheel...'
                      : wheelCooldownSeconds > 0
                      ? `Next Spin in ${formatCooldown(wheelCooldownSeconds)}`
                      : 'SPIN WHEEL NOW'}
                  </span>
                </button>

                {wheelCooldownSeconds > 0 && (
                  <span className="text-[11px] text-[#94A3B8] flex items-center gap-1 font-mono-numbers">
                    <Clock className="w-3.5 h-3.5 text-amber-400" />
                    <span>Resets in {formatCooldown(wheelCooldownSeconds)}</span>
                  </span>
                )}
              </div>

              {/* Celebration Result Banner */}
              {recentPrize && (
                <div className="p-4 rounded-xl bg-amber-500/15 border border-amber-500/40 text-center animate-in zoom-in-95 duration-200">
                  <span className="text-xs text-amber-300 font-bold block">Prize Awarded!</span>
                  <div className="font-display font-black text-xl text-white">
                    +{recentPrize.final_prize} USDT
                  </div>
                  <span className="text-[11px] text-emerald-400 font-medium">Credited to wallet immediately.</span>
                </div>
              )}

            </div>
          </section>

          {/* Spin Wheel Recent Records */}
          <section className="rounded-2xl bg-[#111827] border border-[#1F2737] p-4 sm:p-6 space-y-3">
            <h3 className="font-display font-bold text-sm text-white">
              Your Recent Wheel Spins
            </h3>
            {spinHistory.length === 0 ? (
              <p className="text-xs text-[#94A3B8]">No spins recorded yet. Spin the wheel to receive your daily free reward!</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="text-[#94A3B8] border-b border-[#1F2737] text-[10px] uppercase font-mono-numbers">
                      <th className="py-2 px-3">Date</th>
                      <th className="py-2 px-3">Reward</th>
                      <th className="py-2 px-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1F2737]">
                    {spinHistory.map((s, idx) => (
                      <tr key={idx} className="hover:bg-[#151D2F]">
                        <td className="py-2 px-3 text-[#CBD5E1]">
                          {new Date(s.created_at).toLocaleDateString()} {new Date(s.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td className="py-2 px-3 font-mono-numbers font-bold text-amber-400">
                          +{Number(s.amount).toFixed(2)} USDT
                        </td>
                        <td className="py-2 px-3">
                          <span className="px-2 py-0.5 rounded text-[10px] bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 uppercase font-bold">
                            Credited
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      )}

    </div>
  );
}
