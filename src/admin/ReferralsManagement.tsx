import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useLottery } from '../context/LotteryContext';
import { 
  Share2, 
  Users, 
  DollarSign, 
  Award, 
  CheckCircle2, 
  RefreshCw, 
  Save, 
  AlertCircle,
  ExternalLink,
  Gift,
  Coins
} from 'lucide-react';

export default function ReferralsManagement() {
  const { showToast, platformSettings, adminUpdatePlatformSettings } = useLottery();

  // Settings State
  const [settings, setSettings] = useState({
    registration_reward_enabled: true,
    registration_reward_amount: 0.25,
    first_deposit_reward_enabled: true,
    first_deposit_reward_percent: 10,
    lifetime_commission_enabled: true,
    lifetime_commission_percent: 2
  });

  const [savingSettings, setSavingSettings] = useState(false);
  const [loadingStats, setLoadingStats] = useState(true);

  // Analytics & Lists
  const [stats, setStats] = useState({
    totalReferrals: 0,
    totalCommissionUsdt: 0,
    activeAffiliates: 0
  });

  const [referralsList, setReferralsList] = useState<any[]>([]);
  const [rewardsList, setRewardsList] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'network' | 'rewards'>('network');

  // Load Settings from Supabase
  const loadReferralData = async () => {
    setLoadingStats(true);
    try {
      // 1. Load settings
      const { data: setRow } = await supabase
        .from('platform_settings')
        .select('value')
        .eq('key', 'referral_settings')
        .maybeSingle();

      if (setRow && setRow.value) {
        setSettings(prev => ({ ...prev, ...setRow.value }));
      } else if (platformSettings?.referralSettings) {
        setSettings(prev => ({ ...prev, ...platformSettings.referralSettings }));
      }

      // 2. Load referrals network
      const { data: refRows, error: refErr } = await supabase
        .from('user_referrals')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (!refErr && refRows) {
        setReferralsList(refRows);
        const uniqueReferrers = new Set(refRows.map(r => r.referrer_id)).size;
        const totalComm = refRows.reduce((acc, r) => acc + (parseFloat(r.total_commission_earned ?? r.total_commission_usdt ?? 0) || 0), 0);
        setStats({
          totalReferrals: refRows.length,
          totalCommissionUsdt: totalComm,
          activeAffiliates: uniqueReferrers
        });
      }

      // 3. Load referral rewards history
      const { data: rewRows, error: rewErr } = await supabase
        .from('referral_rewards')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (!rewErr && rewRows) {
        setRewardsList(rewRows);
      }
    } catch (err) {
      console.error('Error loading referral data:', err);
    } finally {
      setLoadingStats(false);
    }
  };

  useEffect(() => {
    loadReferralData();
  }, []);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSettings(true);
    try {
      const updated = {
        registration_reward_enabled: Boolean(settings.registration_reward_enabled),
        registration_reward_amount: Math.max(0, parseFloat(String(settings.registration_reward_amount)) || 0.25),
        first_deposit_reward_enabled: Boolean(settings.first_deposit_reward_enabled),
        first_deposit_reward_percent: Math.max(0, parseFloat(String(settings.first_deposit_reward_percent)) || 10),
        lifetime_commission_enabled: Boolean(settings.lifetime_commission_enabled),
        lifetime_commission_percent: Math.max(0, parseFloat(String(settings.lifetime_commission_percent)) || 2)
      };

      await adminUpdatePlatformSettings({
        referralSettings: updated
      });

      showToast('Referral program settings saved successfully!', 'success');
    } catch (err: any) {
      showToast('Failed to save settings: ' + err.message, 'error');
    } finally {
      setSavingSettings(false);
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6 animate-in fade-in duration-150 min-w-0">
      {/* Header */}
      <div className="bg-[#0d1117] border border-[#272a31] rounded-2xl p-4 sm:p-6 shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start sm:items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-black font-black shadow-md shrink-0">
            <Share2 className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h2 className="font-display font-black text-base sm:text-xl text-white">
              Affiliate &amp; Referral Program Governance
            </h2>
            <p className="text-xs text-[#8b92a2] mt-0.5 leading-relaxed">
              Manage invitation incentives, registration bonuses, commission rates, and audit referral payouts
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={loadReferralData}
          disabled={loadingStats}
          className="px-4 py-2 rounded-xl bg-[#141924] hover:bg-[#1a2130] text-xs font-bold text-white border border-[#272a31] flex items-center gap-2 self-start md:self-auto cursor-pointer shrink-0"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loadingStats ? 'animate-spin text-amber-400' : ''}`} />
          <span>Refresh Data</span>
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 sm:gap-4">
        <div className="bg-[#0d1117] border border-[#272a31] rounded-2xl p-5 space-y-1">
          <div className="flex items-center justify-between text-xs text-[#8b92a2]">
            <span className="font-bold uppercase tracking-wider">Total Referred Players</span>
            <Users className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-2xl font-black font-mono-numbers text-white">
            {stats.totalReferrals}
          </div>
          <div className="text-[11px] text-[#8b92a2]">
            Total successful link registrations
          </div>
        </div>

        <div className="bg-[#0d1117] border border-[#272a31] rounded-2xl p-5 space-y-1">
          <div className="flex items-center justify-between text-xs text-[#8b92a2]">
            <span className="font-bold uppercase tracking-wider">Total Referral USDT Paid</span>
            <Coins className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-black font-mono-numbers text-emerald-400">
            ${stats.totalCommissionUsdt.toFixed(2)} USDT
          </div>
          <div className="text-[11px] text-[#8b92a2]">
            Disbursed directly into wallet credits
          </div>
        </div>

        <div className="bg-[#0d1117] border border-[#272a31] rounded-2xl p-5 space-y-1">
          <div className="flex items-center justify-between text-xs text-[#8b92a2]">
            <span className="font-bold uppercase tracking-wider">Active Affiliate Partners</span>
            <Award className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-black font-mono-numbers text-amber-400">
            {stats.activeAffiliates}
          </div>
          <div className="text-[11px] text-[#8b92a2]">
            Users who invited at least 1 player
          </div>
        </div>
      </div>

      {/* Referral Settings Form */}
      <div className="bg-[#0d1117] border border-[#272a31] rounded-2xl p-4 sm:p-6 space-y-5 shadow-lg">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#272a31] pb-3">
          <div className="min-w-0">
            <h3 className="font-display font-black text-sm sm:text-base text-white">
              Referral Reward Rules &amp; Commission Engine
            </h3>
            <p className="text-xs text-[#8b92a2]">
              All rewards are strictly paid in USDT and credited directly to user account balances
            </p>
          </div>
          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30 shrink-0">
            USDT TRC-20
          </span>
        </div>

        <form onSubmit={handleSaveSettings} className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Rule 1: Registration Bonus */}
            <div className="bg-[#141924] border border-[#272a31] rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white flex items-center gap-1.5">
                  <Gift className="w-4 h-4 text-amber-400" />
                  <span>Registration Reward</span>
                </span>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.registration_reward_enabled}
                    onChange={(e) => setSettings(prev => ({ ...prev, registration_reward_enabled: e.target.checked }))}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-[#272a31] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-amber-500"></div>
                </label>
              </div>
              <p className="text-[11px] text-[#8b92a2]">
                Instant USDT bonus credited to the referrer when an invited user registers.
              </p>
              <div>
                <label className="text-[10px] uppercase font-bold text-[#8b92a2] block mb-1">
                  Reward Amount (USDT)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={settings.registration_reward_amount}
                    onChange={(e) => setSettings(prev => ({ ...prev, registration_reward_amount: parseFloat(e.target.value) || 0 }))}
                    className="w-full bg-[#0b0e14] border border-[#272a31] rounded-lg px-3 py-2 text-xs font-bold font-mono-numbers text-white outline-none focus:border-amber-400"
                  />
                  <span className="absolute right-3 top-2.5 text-[10px] text-amber-400 font-bold">USDT</span>
                </div>
              </div>
            </div>

            {/* Rule 2: First Deposit Bonus */}
            <div className="bg-[#141924] border border-[#272a31] rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white flex items-center gap-1.5">
                  <DollarSign className="w-4 h-4 text-emerald-400" />
                  <span>First Deposit Match</span>
                </span>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.first_deposit_reward_enabled}
                    onChange={(e) => setSettings(prev => ({ ...prev, first_deposit_reward_enabled: e.target.checked }))}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-[#272a31] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500"></div>
                </label>
              </div>
              <p className="text-[11px] text-[#8b92a2]">
                Commission percentage credited to referrer on the invited player's 1st deposit.
              </p>
              <div>
                <label className="text-[10px] uppercase font-bold text-[#8b92a2] block mb-1">
                  Reward Percentage (%)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    max="100"
                    value={settings.first_deposit_reward_percent}
                    onChange={(e) => setSettings(prev => ({ ...prev, first_deposit_reward_percent: parseFloat(e.target.value) || 0 }))}
                    className="w-full bg-[#0b0e14] border border-[#272a31] rounded-lg px-3 py-2 text-xs font-bold font-mono-numbers text-white outline-none focus:border-emerald-400"
                  />
                  <span className="absolute right-3 top-2.5 text-[10px] text-emerald-400 font-bold">%</span>
                </div>
              </div>
            </div>

            {/* Rule 3: Lifetime Ticket Commission */}
            <div className="bg-[#141924] border border-[#272a31] rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white flex items-center gap-1.5">
                  <Award className="w-4 h-4 text-purple-400" />
                  <span>Lifetime Ticket Turnover</span>
                </span>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.lifetime_commission_enabled}
                    onChange={(e) => setSettings(prev => ({ ...prev, lifetime_commission_enabled: e.target.checked }))}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-[#272a31] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-purple-500"></div>
                </label>
              </div>
              <p className="text-[11px] text-[#8b92a2]">
                Passive commission percentage on every lottery ticket purchased by referred users.
              </p>
              <div>
                <label className="text-[10px] uppercase font-bold text-[#8b92a2] block mb-1">
                  Commission Percentage (%)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="50"
                    value={settings.lifetime_commission_percent}
                    onChange={(e) => setSettings(prev => ({ ...prev, lifetime_commission_percent: parseFloat(e.target.value) || 0 }))}
                    className="w-full bg-[#0b0e14] border border-[#272a31] rounded-lg px-3 py-2 text-xs font-bold font-mono-numbers text-white outline-none focus:border-purple-400"
                  />
                  <span className="absolute right-3 top-2.5 text-[10px] text-purple-400 font-bold">%</span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={savingSettings}
              className="px-6 py-2.5 rounded-xl btn-gold text-xs font-bold flex items-center gap-2 cursor-pointer shadow-md"
            >
              {savingSettings ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              <span>Save Referral Settings</span>
            </button>
          </div>
        </form>
      </div>

      {/* Tabs: Referral Network vs Rewards Ledger */}
      <div className="bg-[#0d1117] border border-[#272a31] rounded-2xl p-5 sm:p-6 space-y-4 shadow-lg">
        <div className="flex items-center justify-between border-b border-[#272a31] pb-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('network')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'network'
                  ? 'bg-amber-400 text-black'
                  : 'text-[#8b92a2] hover:text-white hover:bg-white/5'
              }`}
            >
              Referral Relationships ({referralsList.length})
            </button>
            <button
              onClick={() => setActiveTab('rewards')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'rewards'
                  ? 'bg-amber-400 text-black'
                  : 'text-[#8b92a2] hover:text-white hover:bg-white/5'
              }`}
            >
              Payout Ledger ({rewardsList.length})
            </button>
          </div>
        </div>

        {activeTab === 'network' ? (
          referralsList.length > 0 ? (
            <div className="max-h-[500px] overflow-y-auto overflow-x-auto ef-subtle-scroll overscroll-contain rounded-xl border border-[#272a31]/80">
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 z-10 bg-[#0d1117] shadow-[0_1px_0_0_#272a31]">
                  <tr className="text-[#8b92a2] uppercase tracking-wider text-[10px]">
                    <th className="py-2.5 px-3">Referrer ID</th>
                    <th className="py-2.5 px-3">Referred User ID</th>
                    <th className="py-2.5 px-3">Referral Code Used</th>
                    <th className="py-2.5 px-3">Total Commission</th>
                    <th className="py-2.5 px-3">Created At</th>
                    <th className="py-2.5 px-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#272a31]/50 font-mono-numbers">
                  {referralsList.map((ref) => (
                    <tr key={ref.id} className="hover:bg-white/2 transition-colors">
                      <td className="py-3 px-3 text-amber-400 font-bold truncate max-w-[140px]">
                        {ref.referrer_id}
                      </td>
                      <td className="py-3 px-3 text-white truncate max-w-[140px]">
                        {ref.referred_user_id}
                      </td>
                      <td className="py-3 px-3 text-purple-300 font-bold">
                        {ref.referral_code}
                      </td>
                      <td className="py-3 px-3 text-emerald-400 font-bold">
                        +${parseFloat(ref.total_commission_earned ?? ref.total_commission_usdt ?? 0).toFixed(2)} USDT
                      </td>
                      <td className="py-3 px-3 text-[#8b92a2]">
                        {new Date(ref.created_at).toLocaleString()}
                      </td>
                      <td className="py-3 px-3">
                        <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 text-[10px] font-bold border border-emerald-500/30">
                          {ref.status || 'Active'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="py-8 text-center text-xs text-[#8b92a2] italic">
              No referral registrations recorded yet. User invitations via referral links will appear here.
            </div>
          )
        ) : (
          rewardsList.length > 0 ? (
            <div className="max-h-[500px] overflow-y-auto overflow-x-auto ef-subtle-scroll overscroll-contain rounded-xl border border-[#272a31]/80">
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 z-10 bg-[#0d1117] shadow-[0_1px_0_0_#272a31]">
                  <tr className="text-[#8b92a2] uppercase tracking-wider text-[10px]">
                    <th className="py-2.5 px-3">Referrer ID</th>
                    <th className="py-2.5 px-3">Referred User ID</th>
                    <th className="py-2.5 px-3">Type</th>
                    <th className="py-2.5 px-3">Amount</th>
                    <th className="py-2.5 px-3">Description</th>
                    <th className="py-2.5 px-3">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#272a31]/50 font-mono-numbers">
                  {rewardsList.map((rew) => (
                    <tr key={rew.id} className="hover:bg-white/2 transition-colors">
                      <td className="py-3 px-3 text-amber-400 font-bold truncate max-w-[140px]">
                        {rew.referrer_id}
                      </td>
                      <td className="py-3 px-3 text-white truncate max-w-[140px]">
                        {rew.referred_user_id}
                      </td>
                      <td className="py-3 px-3">
                        <span className="px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-400 text-[10px] font-bold uppercase">
                          {rew.reward_type}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-emerald-400 font-bold">
                        +${parseFloat(rew.amount ?? rew.reward_amount_usdt ?? 0).toFixed(2)} USDT
                      </td>
                      <td className="py-3 px-3 text-[#8b92a2] font-sans truncate max-w-xs">
                        {rew.details?.description || rew.description || 'Referral Reward'}
                      </td>
                      <td className="py-3 px-3 text-[#8b92a2]">
                        {new Date(rew.created_at).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="py-8 text-center text-xs text-[#8b92a2] italic">
              No referral rewards paid out yet. As referrals register or deposit, payout logs will be recorded here.
            </div>
          )
        )}
      </div>
    </div>
  );
}