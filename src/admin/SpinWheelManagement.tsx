import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useLottery } from '../context/LotteryContext';
import { 
  Dices, 
  Sparkles, 
  ShieldAlert, 
  Save, 
  RefreshCw, 
  CheckCircle2, 
  AlertTriangle,
  Clock,
  Coins,
  Award,
  Layers,
  Lock,
  Check
} from 'lucide-react';

interface SegmentConfig {
  id: number;
  label: string;
  usdt_amount: number;
  probability_percent: number;
  color: string;
}

export default function SpinWheelManagement() {
  const { showToast, platformSettings, adminUpdatePlatformSettings } = useLottery();

  // Spin Wheel Configuration
  const [isActive, setIsActive] = useState(true);
  const [dailySpinsLimit, setDailySpinsLimit] = useState(1);
  const [minDepositRequired, setMinDepositRequired] = useState(0);
  const [requireKyc, setRequireKyc] = useState(false);

  const [segments, setSegments] = useState<SegmentConfig[]>([
    { id: 1, label: '0.10 USDT', usdt_amount: 0.10, probability_percent: 25.0, color: '#3b82f6' },
    { id: 2, label: '0.20 USDT', usdt_amount: 0.20, probability_percent: 20.0, color: '#10b981' },
    { id: 3, label: '0.25 USDT', usdt_amount: 0.25, probability_percent: 18.0, color: '#f59e0b' },
    { id: 4, label: '0.50 USDT', usdt_amount: 0.50, probability_percent: 15.0, color: '#8b5cf6' },
    { id: 5, label: '0.75 USDT', usdt_amount: 0.75, probability_percent: 10.0, color: '#ec4899' },
    { id: 6, label: '1.00 USDT', usdt_amount: 1.00, probability_percent: 7.0, color: '#06b6d4' },
    { id: 7, label: '2.50 USDT', usdt_amount: 2.50, probability_percent: 3.5, color: '#f97316' },
    { id: 8, label: '5.00 USDT', usdt_amount: 5.00, probability_percent: 1.5, color: '#eab308' }
  ]);

  const [savingSettings, setSavingSettings] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [recentSpins, setRecentSpins] = useState<any[]>([]);

  // Historical Suspicious Credits from Phase 7 Audit
  const historicalSuspiciousCredits = [
    {
      tx_id: 'tx_20261124020608_507547d0',
      wallet: '0x71A9f24E68B8910d54F30C8B38194aE02919B42',
      user_id: '673caf5b-5cd8-4d10-a50e-c74f9580f3c0',
      credited_usdt: 250.00,
      intended_usdt: 0.25,
      date: '2026-11-24 02:06:08',
      reason: 'Legacy Flow Coin slice multiplier applied to USDT'
    },
    {
      tx_id: 'tx_20261112155747_147f8674',
      wallet: '0x71A9f24E68B8910d54F30C8B38194aE02919B42',
      user_id: '673caf5b-5cd8-4d10-a50e-c74f9580f3c0',
      credited_usdt: 150.00,
      intended_usdt: 0.15,
      date: '2026-11-12 15:57:47',
      reason: 'Legacy Flow Coin slice multiplier applied to USDT'
    },
    {
      tx_id: 'tx_20261112155031_1ab971bc',
      wallet: '0x77bb14ac461025008f4e8a9168ce2db36de1ddfe',
      user_id: 'ba2e7ee1-ffc4-4325-bda3-a8a756c02f0c',
      credited_usdt: 110.00,
      intended_usdt: 0.10,
      date: '2026-11-12 15:50:31',
      reason: 'Legacy Flow Coin slice multiplier applied to USDT'
    },
    {
      tx_id: 'tx_20261107163535_4b7c0cca',
      wallet: '0x8888888888888888888888888888888888888888',
      user_id: 'Legacy System Account',
      credited_usdt: 250.00,
      intended_usdt: 0.25,
      date: '2026-11-07 16:35:35',
      reason: 'Legacy Flow Coin slice multiplier applied to USDT'
    },
    {
      tx_id: 'tx_20261107161923_907ecdf7',
      wallet: '0x1111111111111111111111111111111111111111',
      user_id: 'Legacy System Account',
      credited_usdt: 50.00,
      intended_usdt: 0.50,
      date: '2026-11-07 16:19:23',
      reason: 'Legacy Flow Coin slice multiplier applied to USDT'
    }
  ];

  const totalProbability = segments.reduce((acc, s) => acc + (parseFloat(String(s.probability_percent)) || 0), 0);
  const isProbabilityValid = Math.abs(totalProbability - 100) < 0.01;

  const loadSpinWheelData = async () => {
    setLoadingData(true);
    try {
      // 1. Fetch spin wheel settings from platform_settings
      const { data: setRow } = await supabase
        .from('platform_settings')
        .select('value')
        .eq('key', 'spin_wheel_settings')
        .maybeSingle();

      if (setRow && setRow.value) {
        setIsActive(setRow.value.is_active !== false);
        setDailySpinsLimit(Number(setRow.value.daily_spins_limit || 1));
        setMinDepositRequired(Number(setRow.value.min_deposit_required || 0));
        setRequireKyc(Boolean(setRow.value.require_kyc));
        if (Array.isArray(setRow.value.segments) && setRow.value.segments.length > 0) {
          setSegments(setRow.value.segments);
        }
      }

      // 2. Fetch recent lucky spin wheel transactions from virtual_credits_ledger
      const { data: spinLedger, error: spinErr } = await supabase
        .from('virtual_credits_ledger')
        .select('*')
        .eq('action', 'lucky_spin_wheel')
        .order('created_at', { ascending: false })
        .limit(25);

      if (!spinErr && spinLedger) {
        setRecentSpins(spinLedger);
      }
    } catch (err) {
      console.error('loadSpinWheelData error:', err);
    } finally {
      setLoadingData(false);
    }
  };

  useEffect(() => {
    loadSpinWheelData();
  }, []);

  const handleSegmentChange = (index: number, field: keyof SegmentConfig, value: any) => {
    setSegments(prev => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      if (field === 'usdt_amount') {
        copy[index].label = `${Number(value).toFixed(2)} USDT`;
      }
      return copy;
    });
  };

  const handleNormalizeProbabilities = () => {
    if (totalProbability <= 0) return;
    setSegments(prev => {
      return prev.map(s => ({
        ...s,
        probability_percent: parseFloat(((s.probability_percent / totalProbability) * 100).toFixed(1))
      }));
    });
    showToast('Probabilities normalized to 100%!', 'info');
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isProbabilityValid) {
      showToast(`Total probability must sum to exactly 100.0% (Currently ${totalProbability.toFixed(1)}%)`, 'error');
      return;
    }

    setSavingSettings(true);
    try {
      const updated = {
        is_active: isActive,
        daily_spins_limit: Math.max(1, dailySpinsLimit),
        min_deposit_required: Math.max(0, minDepositRequired),
        require_kyc: requireKyc,
        segments: segments.map(s => ({
          ...s,
          usdt_amount: Math.max(0.01, parseFloat(String(s.usdt_amount)) || 0.10),
          probability_percent: Math.max(0.1, parseFloat(String(s.probability_percent)) || 1.0)
        }))
      };

      await adminUpdatePlatformSettings({
        spinWheelSettings: updated
      });

      showToast('Lucky Spin Wheel configuration updated and synced with database!', 'success');
    } catch (err: any) {
      showToast('Failed to save spin wheel settings: ' + err.message, 'error');
    } finally {
      setSavingSettings(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-150">
      {/* Header */}
      <div className="bg-[#0d1117] border border-[#272a31] rounded-2xl p-5 sm:p-6 shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-black font-black shadow-md">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-display font-black text-lg sm:text-xl text-white">
              Daily Bonus Lucky Spin Wheel Governance
            </h2>
            <p className="text-xs text-[#8b92a2]">
              Control daily wheel activations, payout segments (USDT TRC-20), probability distributions, and security audits
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={loadSpinWheelData}
          disabled={loadingData}
          className="px-4 py-2 rounded-xl bg-[#141924] hover:bg-[#1a2130] text-xs font-bold text-white border border-[#272a31] flex items-center gap-2 self-start md:self-auto cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loadingData ? 'animate-spin text-amber-400' : ''}`} />
          <span>Refresh Data</span>
        </button>
      </div>

      {/* CRITICAL AUDIT NOTICE & SUSPICIOUS CREDITS REPORT */}
      <div className="bg-[#120e09] border border-amber-500/40 rounded-2xl p-5 sm:p-6 space-y-4 shadow-xl relative overflow-hidden">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/40 flex items-center justify-center shrink-0">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-amber-400 uppercase tracking-wider">
                Audited & Resolved: Historical Spin Wheel USDT Crediting Discrepancy
              </h3>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
                FIXED IN STORED PROCEDURE
              </span>
            </div>
            <p className="text-xs text-[#d1d5db] leading-relaxed">
              <strong>Root Cause:</strong> Legacy Flow Coin slice values had a <code>v_base_prize := 250.0</code> multiplier. 
              During currency migration, <code>credit_virtual_credits</code> credited 250.00 USDT instead of 0.25 USDT for slice 4.
            </p>
            <p className="text-xs text-amber-300/90 leading-relaxed">
              <strong>Governance Policy:</strong> Stored procedure <code>public.spin_lucky_wheel</code> has been replaced with server-side exact decimal USDT crediting (0.10 to 5.00 USDT). Per platform governance rules, user balances have <strong>NOT</strong> been clawed back automatically. The 5 affected historical transactions are audited below for ledger transparency:
            </p>
          </div>
        </div>

        {/* Audit Table */}
        <div className="overflow-x-auto rounded-xl border border-amber-500/20">
          <table className="w-full text-left text-xs bg-black/40">
            <thead>
              <tr className="border-b border-amber-500/20 text-[#9ca3af] uppercase tracking-wider text-[10px]">
                <th className="py-2.5 px-3">Transaction ID</th>
                <th className="py-2.5 px-3">Wallet Address</th>
                <th className="py-2.5 px-3">Credited Amount</th>
                <th className="py-2.5 px-3">Intended Amount</th>
                <th className="py-2.5 px-3">Date</th>
                <th className="py-2.5 px-3">Resolution Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-amber-500/10 font-mono-numbers">
              {historicalSuspiciousCredits.map((item) => (
                <tr key={item.tx_id} className="hover:bg-amber-500/5 transition-colors">
                  <td className="py-2.5 px-3 text-amber-400 font-bold truncate max-w-[150px]">
                    {item.tx_id}
                  </td>
                  <td className="py-2.5 px-3 text-white truncate max-w-[150px]">
                    {item.wallet}
                  </td>
                  <td className="py-2.5 px-3 text-red-400 font-bold">
                    ${item.credited_usdt.toFixed(2)} USDT
                  </td>
                  <td className="py-2.5 px-3 text-emerald-400 font-bold">
                    ${item.intended_usdt.toFixed(2)} USDT
                  </td>
                  <td className="py-2.5 px-3 text-[#9ca3af]">
                    {item.date}
                  </td>
                  <td className="py-2.5 px-3">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                      Preserved / Audited
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Main Settings Form */}
      <form onSubmit={handleSaveSettings} className="space-y-6">
        {/* Global Controls Card */}
        <div className="bg-[#0d1117] border border-[#272a31] rounded-2xl p-5 sm:p-6 space-y-4 shadow-lg">
          <h3 className="font-display font-black text-sm sm:text-base text-white">
            Wheel Eligibility & Frequency Rules
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-[#141924] border border-[#272a31] rounded-xl p-4 flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-white block">Wheel Status</span>
                <span className="text-[11px] text-[#8b92a2]">Allow spins platform-wide</span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-[#272a31] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
              </label>
            </div>

            <div className="bg-[#141924] border border-[#272a31] rounded-xl p-4 space-y-1">
              <label className="text-xs font-bold text-white block">
                Daily Free Spins Limit
              </label>
              <input
                type="number"
                min="1"
                max="10"
                value={dailySpinsLimit}
                onChange={(e) => setDailySpinsLimit(parseInt(e.target.value, 10) || 1)}
                className="w-full bg-[#0b0e14] border border-[#272a31] rounded-lg px-3 py-1.5 text-xs font-bold font-mono-numbers text-white outline-none focus:border-amber-400"
              />
              <span className="text-[10px] text-[#8b92a2] block">Default: 1 spin every 24h</span>
            </div>

            <div className="bg-[#141924] border border-[#272a31] rounded-xl p-4 space-y-1">
              <label className="text-xs font-bold text-white block">
                Min. Deposit Required (USDT)
              </label>
              <input
                type="number"
                step="1"
                min="0"
                value={minDepositRequired}
                onChange={(e) => setMinDepositRequired(parseFloat(e.target.value) || 0)}
                className="w-full bg-[#0b0e14] border border-[#272a31] rounded-lg px-3 py-1.5 text-xs font-bold font-mono-numbers text-white outline-none focus:border-amber-400"
              />
              <span className="text-[10px] text-[#8b92a2] block">0 = 100% Free for all registered users</span>
            </div>

            <div className="bg-[#141924] border border-[#272a31] rounded-xl p-4 flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-white block">KYC Verification</span>
                <span className="text-[11px] text-[#8b92a2]">Require verified ID</span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={requireKyc}
                  onChange={(e) => setRequireKyc(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-[#272a31] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-cyan-500"></div>
              </label>
            </div>
          </div>
        </div>

        {/* 8 Segments & Probabilities Card */}
        <div className="bg-[#0d1117] border border-[#272a31] rounded-2xl p-5 sm:p-6 space-y-4 shadow-lg">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#272a31] pb-3">
            <div>
              <h3 className="font-display font-black text-sm sm:text-base text-white">
                Wheel Segments & Probability Distribution (8 Slices)
              </h3>
              <p className="text-xs text-[#8b92a2]">
                Configure prizes in exact USDT (TRC-20). Total probability must sum to exactly 100.0%.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <span className={`px-3 py-1 rounded-lg text-xs font-bold font-mono-numbers ${
                isProbabilityValid ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40' : 'bg-red-500/20 text-red-400 border border-red-500/40'
              }`}>
                Total: {totalProbability.toFixed(1)}% / 100.0%
              </span>

              {!isProbabilityValid && (
                <button
                  type="button"
                  onClick={handleNormalizeProbabilities}
                  className="px-3 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 border border-amber-500/40 text-xs font-bold cursor-pointer"
                >
                  Auto-Normalize
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {segments.map((seg, idx) => (
              <div 
                key={seg.id}
                className="bg-[#141924] border border-[#272a31] rounded-xl p-3.5 space-y-2 relative"
                style={{ borderTop: `3px solid ${seg.color}` }}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#8b92a2]">
                    Segment #{seg.id}
                  </span>
                  <div className="w-3.5 h-3.5 rounded-full" style={{ backgroundColor: seg.color }} />
                </div>

                <div>
                  <label className="text-[10px] text-[#8b92a2] block mb-0.5">Prize Amount (USDT)</label>
                  <input
                    type="number"
                    step="0.05"
                    min="0.01"
                    value={seg.usdt_amount}
                    onChange={(e) => handleSegmentChange(idx, 'usdt_amount', parseFloat(e.target.value) || 0.05)}
                    className="w-full bg-[#0b0e14] border border-[#272a31] rounded px-2.5 py-1.5 text-xs font-bold font-mono-numbers text-white outline-none focus:border-amber-400"
                  />
                </div>

                <div>
                  <label className="text-[10px] text-[#8b92a2] block mb-0.5">Win Probability (%)</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0.1"
                    max="100"
                    value={seg.probability_percent}
                    onChange={(e) => handleSegmentChange(idx, 'probability_percent', parseFloat(e.target.value) || 0.1)}
                    className="w-full bg-[#0b0e14] border border-[#272a31] rounded px-2.5 py-1.5 text-xs font-bold font-mono-numbers text-white outline-none focus:border-amber-400"
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={savingSettings || !isProbabilityValid}
              className="px-6 py-2.5 rounded-xl btn-gold text-xs font-bold flex items-center gap-2 cursor-pointer shadow-md disabled:opacity-50"
            >
              {savingSettings ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              <span>Save Wheel Configuration</span>
            </button>
          </div>
        </div>
      </form>

      {/* Recent Wheel Spins Ledger */}
      <div className="bg-[#0d1117] border border-[#272a31] rounded-2xl p-5 sm:p-6 space-y-4 shadow-lg">
        <div className="flex items-center justify-between border-b border-[#272a31] pb-3">
          <div>
            <h3 className="font-display font-black text-sm sm:text-base text-white">
              Recent Player Wheel Claims (Database Ledger)
            </h3>
            <p className="text-xs text-[#8b92a2]">
              Live atomic transactions recorded in <code>virtual_credits_ledger</code>
            </p>
          </div>
          <span className="px-2.5 py-1 rounded bg-white/5 text-xs font-mono-numbers font-bold text-[#8b92a2]">
            {recentSpins.length} Recent Records
          </span>
        </div>

        {recentSpins.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-[#272a31] text-[#8b92a2] uppercase tracking-wider text-[10px]">
                  <th className="py-2.5 px-3">Transaction ID</th>
                  <th className="py-2.5 px-3">User ID</th>
                  <th className="py-2.5 px-3">Prize Credited</th>
                  <th className="py-2.5 px-3">Description</th>
                  <th className="py-2.5 px-3">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#272a31]/50 font-mono-numbers">
                {recentSpins.map((spin) => (
                  <tr key={spin.id} className="hover:bg-white/2 transition-colors">
                    <td className="py-3 px-3 text-amber-400 font-bold truncate max-w-[150px]">
                      {spin.id}
                    </td>
                    <td className="py-3 px-3 text-white truncate max-w-[150px]">
                      {spin.user_id}
                    </td>
                    <td className="py-3 px-3 text-emerald-400 font-bold">
                      +${parseFloat(spin.amount || 0).toFixed(2)} USDT
                    </td>
                    <td className="py-3 px-3 text-[#8b92a2] font-sans truncate max-w-xs">
                      {spin.notes || 'Daily Bonus Wheel Spin'}
                    </td>
                    <td className="py-3 px-3 text-[#8b92a2]">
                      {new Date(spin.created_at).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="py-8 text-center text-xs text-[#8b92a2] italic">
            No recent wheel spins recorded yet. As users spin the wheel, records will appear here in real-time.
          </div>
        )}
      </div>
    </div>
  );
}