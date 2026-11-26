import React, { useState, useEffect, useMemo } from 'react';
import { useLottery } from '../context/LotteryContext';
import { supabase } from '../lib/supabase';
import { 
  Users, 
  Share2, 
  Copy, 
  Check, 
  Trophy, 
  Coins, 
  Flame, 
  CheckCircle2,
  TrendingUp,
  MessageCircle,
  Gift
} from 'lucide-react';
import { useSoundFX } from '../hooks/useSoundFX';

interface PromotionPageProps {
  onBackToHome?: () => void;
}

/**
 * Promotion & Referral Hub — EarnFlow.in
 * Exclusively dedicated to the Referral Program:
 * - Unique referral code & link with copy & social share
 * - Real user referral statistics from Supabase
 * - Registration, deposit, and lifetime ticket commission breakdown
 * - Verified referral reward transaction ledger
 */
export default function PromotionPage({ onBackToHome }: PromotionPageProps) {
  const { user, profile, wallet, showToast, setIsAuthModalOpen, platformSettings, requireAuth } = useLottery();
  const { playClick } = useSoundFX();

  // Copy state
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  // Unique referral code derived from profile, username or user ID
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

  // Fetch real user referral data from Supabase
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

  if (!user) {
    return (
      <div className="max-w-lg mx-auto my-12 bg-[#111728] border border-amber-500/30 rounded-3xl p-6 sm:p-8 text-center space-y-4 shadow-2xl">
        <h2 className="font-display font-black text-xl text-white">Login Required</h2>
        <p className="text-xs sm:text-sm text-[#94A3B8]">
          Please sign in or create an account to access your referral link, invite tracking, and USDT referral commissions.
        </p>
        <div className="flex flex-col sm:flex-row gap-2.5 justify-center pt-1">
          <button
            type="button"
            onClick={() => requireAuth ? requireAuth({ type: 'tab', tab: 'promotion' }) : setIsAuthModalOpen(true)}
            className="btn-gold px-6 py-2.5 rounded-xl text-xs font-black cursor-pointer"
          >
            Login / Sign Up
          </button>
          {onBackToHome && (
            <button
              type="button"
              onClick={onBackToHome}
              className="px-5 py-2.5 rounded-xl bg-[#151C2B] text-[#E1E2EB] border border-[#2D3545] text-xs font-bold cursor-pointer"
            >
              Return Home
            </button>
          )}
        </div>
      </div>
    );
  }

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

  // Telegram Share Handler
  const handleShareTelegram = () => {
    playClick();
    const text = `Join EarnFlow.in Four Digit Lottery and win live USDT jackpot pools! Sign up using my referral link: ${referralLink}`;
    window.open(`https://t.me/share/url?url=${encodeURIComponent(referralLink)}&text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer');
  };

  // Referral program settings from platform_settings
  const referralSettings = platformSettings?.referralSettings || {
    registrationReward: { enabled: true, amount: 0.25 },
    firstDepositReward: { enabled: true, amount: 5, mode: 'percentage' },
    lifetimeCommission: { enabled: true, percent: 1 }
  };

  return (
    <div className="w-full max-w-7xl 2xl:max-w-[1600px] mx-auto px-3 xs:px-4 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-6 text-left select-none animate-in fade-in duration-200">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-[#1F2737]">
        <div className="flex items-center gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-xl bg-amber-500/15 text-amber-400 border border-amber-500/30">
                <Share2 className="w-4 h-4" />
              </span>
              <h1 className="font-display font-black text-xl sm:text-2xl text-white">
                Promotions &amp; Referral Program
              </h1>
            </div>
            <p className="text-xs text-[#94A3B8] mt-1">
              Invite friends, share your exclusive referral code, and earn instant USDT commissions.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs font-mono-numbers">
          <span className="px-3 py-1 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-bold inline-flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Instant USDT TRC-20 Payouts</span>
          </span>
        </div>
      </div>

      {/* Hero Banner: Invite Friends & Earn USDT */}
      <section className="relative overflow-hidden rounded-2xl sm:rounded-3xl bg-gradient-to-br from-[#121624] via-[#0E131F] to-[#1C1335] border border-amber-500/30 p-5 sm:p-7 shadow-2xl">
        <div className="absolute top-0 right-0 w-80 h-80 bg-gradient-to-b from-amber-500/15 via-purple-600/10 to-transparent rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-6">
          <div className="space-y-3 max-w-xl">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 font-mono-numbers text-[11px] font-bold">
              <Flame className="w-3.5 h-3.5 text-amber-400" />
              <span>EarnFlow Partner Program · USDT TRC-20</span>
            </span>
            
            <h2 className="font-display font-black text-xl sm:text-3xl text-white tracking-tight leading-tight">
              Invite Friends &amp; Earn <span className="text-amber-400">USDT Rewards</span>
            </h2>

            <p className="text-xs sm:text-sm text-[#CBD5E1] leading-relaxed">
              Share your personal referral link. Earn direct USDT bonuses when friends register, top up their wallets, and participate in Four Digit Lottery draws.
            </p>

            <div className="grid grid-cols-3 gap-2.5 pt-2 text-[11px]">
              <div className="p-3 rounded-xl bg-[#0B0F19]/90 border border-[#1F2737]">
                <span className="text-[10px] text-[#94A3B8] block uppercase font-bold">Registration</span>
                <strong className="text-emerald-400 font-mono-numbers text-xs sm:text-sm">
                  {referralSettings.registrationReward?.amount || 0.25} USDT
                </strong>
              </div>
              <div className="p-3 rounded-xl bg-[#0B0F19]/90 border border-[#1F2737]">
                <span className="text-[10px] text-[#94A3B8] block uppercase font-bold">First Deposit</span>
                <strong className="text-amber-400 font-mono-numbers text-xs sm:text-sm">
                  {referralSettings.firstDepositReward?.amount || 5}% Bonus
                </strong>
              </div>
              <div className="p-3 rounded-xl bg-[#0B0F19]/90 border border-[#1F2737]">
                <span className="text-[10px] text-[#94A3B8] block uppercase font-bold">Commissions</span>
                <strong className="text-purple-400 font-mono-numbers text-xs sm:text-sm">
                  {referralSettings.lifetimeCommission?.percent || 1}% Lifetime
                </strong>
              </div>
            </div>
          </div>

          {/* Share Card */}
          <div className="w-full lg:w-96 p-4 sm:p-5 rounded-2xl bg-[#0B0F19]/95 border border-amber-500/25 space-y-3.5 shadow-xl backdrop-blur-md">
            <span className="text-xs font-bold text-white uppercase tracking-wider block">
              Your Referral Link &amp; Code
            </span>

            {/* Referral Code Box */}
            <div className="space-y-1">
              <label className="text-[10px] text-[#94A3B8] uppercase font-bold">Referral Code</label>
              <div className="flex items-center gap-2">
                <div className="flex-1 px-3 py-2 rounded-xl bg-[#141A28] border border-[#273145] font-mono-numbers font-black text-amber-300 text-sm tracking-wider select-all">
                  {referralCode}
                </div>
                <button
                  type="button"
                  onClick={handleCopyCode}
                  className="px-3 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
                  title="Copy Code"
                >
                  {copiedCode ? <Check className="w-3.5 h-3.5 text-black" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedCode ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
            </div>

            {/* Referral Link Box */}
            <div className="space-y-1">
              <label className="text-[10px] text-[#94A3B8] uppercase font-bold">Direct Link</label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={referralLink}
                  className="flex-1 px-3 py-2 rounded-xl bg-[#141A28] border border-[#273145] text-xs text-[#CBD5E1] truncate font-mono select-all outline-none"
                />
                <button
                  type="button"
                  onClick={handleCopyLink}
                  className="px-3 py-2 rounded-xl bg-[#1C2333] hover:bg-[#273145] text-white border border-[#273145] font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
                  title="Copy Link"
                >
                  {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedLink ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
            </div>

            {/* Social Share Buttons */}
            <div className="pt-1 flex items-center gap-2">
              <button
                type="button"
                onClick={handleShareWhatsApp}
                className="flex-1 py-2 px-3 rounded-xl bg-[#25D366]/15 hover:bg-[#25D366]/25 border border-[#25D366]/30 text-[#25D366] font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <MessageCircle className="w-3.5 h-3.5" />
                <span>WhatsApp</span>
              </button>
              <button
                type="button"
                onClick={handleShareTelegram}
                className="flex-1 py-2 px-3 rounded-xl bg-[#0088cc]/15 hover:bg-[#0088cc]/25 border border-[#0088cc]/30 text-[#0088cc] font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <Share2 className="w-3.5 h-3.5" />
                <span>Telegram</span>
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Referral Statistics 4-Card Grid */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        <div className="p-4 sm:p-5 rounded-2xl bg-[#0D121D] border border-[#1F2737] space-y-1">
          <span className="text-[11px] text-[#94A3B8] uppercase font-bold flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5 text-amber-400" />
            <span>Total Referred</span>
          </span>
          <div className="font-display font-black text-xl sm:text-2xl text-white font-mono-numbers">
            {totalReferredCount}
          </div>
          <span className="text-[10px] text-[#94A3B8] block">Registered accounts</span>
        </div>

        <div className="p-4 sm:p-5 rounded-2xl bg-[#0D121D] border border-[#1F2737] space-y-1">
          <span className="text-[11px] text-[#94A3B8] uppercase font-bold flex items-center gap-1.5">
            <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
            <span>Active Players</span>
          </span>
          <div className="font-display font-black text-xl sm:text-2xl text-emerald-400 font-mono-numbers">
            {activeReferralsCount}
          </div>
          <span className="text-[10px] text-[#94A3B8] block">Purchased lottery entries</span>
        </div>

        <div className="p-4 sm:p-5 rounded-2xl bg-[#0D121D] border border-[#1F2737] space-y-1">
          <span className="text-[11px] text-[#94A3B8] uppercase font-bold flex items-center gap-1.5">
            <Trophy className="w-3.5 h-3.5 text-amber-400" />
            <span>Total Earned</span>
          </span>
          <div className="font-display font-black text-xl sm:text-2xl text-amber-400 font-mono-numbers">
            {totalEarnedUsdt.toFixed(2)} USDT
          </div>
          <span className="text-[10px] text-emerald-400 block font-semibold">Credited to wallet</span>
        </div>

        <div className="p-4 sm:p-5 rounded-2xl bg-[#0D121D] border border-[#1F2737] space-y-1">
          <span className="text-[11px] text-[#94A3B8] uppercase font-bold flex items-center gap-1.5">
            <Coins className="w-3.5 h-3.5 text-purple-400" />
            <span>Commission Rate</span>
          </span>
          <div className="font-display font-black text-xl sm:text-2xl text-purple-400 font-mono-numbers">
            {referralSettings.lifetimeCommission?.percent || 1.0}%
          </div>
          <span className="text-[10px] text-[#94A3B8] block">On ticket purchases</span>
        </div>
      </section>

      {/* How the Referral Program Works */}
      <section className="rounded-2xl bg-[#0D121D] border border-[#1F2737] p-5 sm:p-7 space-y-4">
        <h3 className="font-display font-bold text-base sm:text-lg text-white">
          How the Referral Program Works
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 rounded-xl bg-[#111728] border border-[#1F2737] space-y-2">
            <div className="w-8 h-8 rounded-lg bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 font-bold font-mono-numbers text-sm">
              1
            </div>
            <h4 className="font-bold text-sm text-white">Share Your Link</h4>
            <p className="text-xs text-[#94A3B8] leading-relaxed">
              Send your referral link or code to friends via social media, messaging apps, or gaming forums.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-[#111728] border border-[#1F2737] space-y-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 font-bold font-mono-numbers text-sm">
              2
            </div>
            <h4 className="font-bold text-sm text-white">Friend Registers &amp; Plays</h4>
            <p className="text-xs text-[#94A3B8] leading-relaxed">
              When your referral signs up with your code and participates in 4-digit lottery draws, entries are tracked automatically.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-[#111728] border border-[#1F2737] space-y-2">
            <div className="w-8 h-8 rounded-lg bg-purple-500/15 border border-purple-500/30 flex items-center justify-center text-purple-400 font-bold font-mono-numbers text-sm">
              3
            </div>
            <h4 className="font-bold text-sm text-white">Earn Direct USDT</h4>
            <p className="text-xs text-[#94A3B8] leading-relaxed">
              Receive instant USDT bonuses directly into your EarnFlow wallet with complete ledger auditability and 24h withdrawal eligibility.
            </p>
          </div>
        </div>
      </section>

      {/* Referred Friends & Network Table from Supabase */}
      <section className="rounded-2xl bg-[#0D121D] border border-[#1F2737] p-4 sm:p-7 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-[#1F2737]">
          <h3 className="font-display font-bold text-base text-white">
            Referred Friends &amp; Network
          </h3>
          <span className="text-xs font-mono-numbers text-[#94A3B8]">
            {referrals.length} {referrals.length === 1 ? 'Referral' : 'Referrals'}
          </span>
        </div>

        {referrals.length === 0 ? (
          <div className="py-10 text-center space-y-2">
            <Users className="w-8 h-8 text-[#475569] mx-auto" />
            <p className="text-xs text-[#64748B]">
              No referred friends joined yet. Share your link to track every invite and commission here!
            </p>
          </div>
        ) : (
          <div className="max-h-[480px] sm:max-h-[520px] overflow-y-auto overflow-x-auto ef-subtle-scroll overscroll-contain rounded-xl border border-[#1F2737]">
            <table className="w-full min-w-[540px] text-left text-xs">
              <thead className="sticky top-0 z-10 bg-[#0D121D]/95 backdrop-blur-md shadow-[0_1px_0_0_#1F2737]">
                <tr className="text-[#94A3B8] text-[10px] uppercase font-mono-numbers">
                  <th className="py-2.5 px-3">Date</th>
                  <th className="py-2.5 px-3">Referred User</th>
                  <th className="py-2.5 px-3">Code Used</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3 text-right">Commission</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1F2737]">
                {referrals.map((ref, idx) => (
                  <tr key={ref.id || idx} className="hover:bg-[#141B29] transition-colors">
                    <td className="py-3 px-3 text-[#94A3B8] font-mono-numbers whitespace-nowrap">
                      {new Date(ref.created_at).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric'
                      })}
                    </td>
                    <td className="py-3 px-3 font-mono-numbers text-white">
                      {ref.referred_username ||
                        (ref.referred_user_id
                          ? `${String(ref.referred_user_id).slice(0, 8)}...`
                          : 'Invited Player')}
                    </td>
                    <td className="py-3 px-3 font-mono-numbers text-amber-300 font-bold whitespace-nowrap">
                      {ref.referral_code || referralCode || '—'}
                    </td>
                    <td className="py-3 px-3">
                      <span className="px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-bold text-[10px] uppercase">
                        {ref.status || 'Active'}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right font-mono-numbers font-bold text-[#05d5aa] whitespace-nowrap">
                      +${Number(ref.total_commission_earned ?? ref.total_commission_usdt ?? 0).toFixed(2)} USDT
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Referral History Table from Supabase */}
      <section className="rounded-2xl bg-[#0D121D] border border-[#1F2737] p-4 sm:p-7 space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-[#1F2737]">
          <h3 className="font-display font-bold text-base text-white">
            Referral Reward History
          </h3>
          <span className="text-xs font-mono-numbers text-[#94A3B8]">
            {rewardsHistory.length} Rewards Recorded
          </span>
        </div>

        {loadingReferrals ? (
          <div className="py-8 text-center text-xs text-[#94A3B8]">
            Loading referral records from database...
          </div>
        ) : rewardsHistory.length === 0 ? (
          <div className="py-8 text-center space-y-2">
            <Users className="w-10 h-10 text-[#94A3B8]/30 mx-auto" />
            <p className="font-bold text-sm text-white">No Referral Rewards Yet</p>
            <p className="text-xs text-[#94A3B8] max-w-sm mx-auto">
              Share your referral link with friends to begin earning registration rewards and lifetime lottery commissions!
            </p>
          </div>
        ) : (
          <div className="max-h-[480px] sm:max-h-[520px] overflow-y-auto overflow-x-auto ef-subtle-scroll overscroll-contain rounded-xl border border-[#1F2737]">
            <table className="w-full min-w-[540px] text-left text-xs">
              <thead className="sticky top-0 z-10 bg-[#0D121D]/95 backdrop-blur-md shadow-[0_1px_0_0_#1F2737]">
                <tr className="text-[#94A3B8] text-[10px] uppercase font-mono-numbers">
                  <th className="py-2.5 px-3">Date</th>
                  <th className="py-2.5 px-3">Type</th>
                  <th className="py-2.5 px-3">Reward</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3">Description</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1F2737] font-mono-numbers">
                {rewardsHistory.map((item, idx) => (
                  <tr key={item.id || idx} className="hover:bg-[#111728]/60 transition-colors">
                    <td className="py-2.5 px-3 text-[#CBD5E1]">
                      {new Date(item.created_at).toLocaleDateString()}
                    </td>
                    <td className="py-2.5 px-3 font-sans capitalize text-white">
                      {item.reward_type || 'Commission'}
                    </td>
                    <td className="py-2.5 px-3 font-bold text-emerald-400">
                      +{Number(item.amount || 0).toFixed(2)} USDT
                    </td>
                    <td className="py-2.5 px-3">
                      <span className="px-2 py-0.5 rounded text-[10px] bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 uppercase font-bold">
                        {item.status || 'Paid'}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-[#94A3B8] font-sans text-xs truncate max-w-xs">
                      {item.details?.description || item.description || 'Referral reward'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

    </div>
  );
}
