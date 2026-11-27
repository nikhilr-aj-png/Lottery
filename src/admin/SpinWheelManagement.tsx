import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { useLottery } from '../context/LotteryContext';
import {
  Sparkles,
  Save,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Sliders,
  Coins,
  Percent,
  Trophy,
  Clock
} from 'lucide-react';

interface SegmentConfig {
  id: number;
  index?: number;
  label: string;
  usdt_amount: number;
  amount?: number;
  probability_percent: number;
  probability?: number;
  color: string;
  textColor?: string;
}

const DEFAULT_SEGMENTS: SegmentConfig[] = [
  { id: 1, index: 0, label: '0.10 USDT', usdt_amount: 0.10, probability_percent: 25.0, color: '#3b82f6' },
  { id: 2, index: 1, label: '0.20 USDT', usdt_amount: 0.20, probability_percent: 20.0, color: '#10b981' },
  { id: 3, index: 2, label: '0.25 USDT', usdt_amount: 0.25, probability_percent: 18.0, color: '#f59e0b' },
  { id: 4, index: 3, label: '0.50 USDT', usdt_amount: 0.50, probability_percent: 15.0, color: '#8b5cf6' },
  { id: 5, index: 4, label: '0.75 USDT', usdt_amount: 0.75, probability_percent: 10.0, color: '#ec4899' },
  { id: 6, index: 5, label: '1.00 USDT', usdt_amount: 1.00, probability_percent: 7.0, color: '#06b6d4' },
  { id: 7, index: 6, label: '2.50 USDT', usdt_amount: 2.50, probability_percent: 3.5, color: '#f97316' },
  { id: 8, index: 7, label: '5.00 USDT', usdt_amount: 5.00, probability_percent: 1.5, color: '#eab308' }
];

export default function SpinWheelManagement() {
  const { showToast, adminUpdatePlatformSettings } = useLottery();

  // Spin Wheel Configuration
  const [isActive, setIsActive] = useState(true);
  const [dailySpinsLimit, setDailySpinsLimit] = useState(1);
  const [minDepositRequired, setMinDepositRequired] = useState(0);

  const [segments, setSegments] = useState<SegmentConfig[]>(DEFAULT_SEGMENTS);
  const [savingSettings, setSavingSettings] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [recentSpins, setRecentSpins] = useState<any[]>([]);

  const totalProbability = useMemo(
    () =>
      segments.reduce((acc, s) => {
        const val = parseFloat(String(s.probability_percent));
        return acc + (Number.isFinite(val) && val > 0 ? val : 0);
      }, 0),
    [segments]
  );

  const remainingProbability = useMemo(() => 100 - totalProbability, [totalProbability]);

  const hasInvalidSegment = useMemo(
    () =>
      segments.some((s) => {
        const amt = Number(s.usdt_amount);
        const prob = Number(s.probability_percent);
        return !Number.isFinite(amt) || amt < 0.01 || !Number.isFinite(prob) || prob <= 0 || prob > 100;
      }),
    [segments]
  );

  const isProbabilityValid = Math.abs(totalProbability - 100) < 0.01 && !hasInvalidSegment;

  const totalDisbursedUsdt = useMemo(
    () =>
      recentSpins.reduce((sum, spin) => {
        const amt = parseFloat(spin.amount || 0);
        return sum + (Number.isFinite(amt) ? amt : 0);
      }, 0),
    [recentSpins]
  );

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
        setIsActive(setRow.value.is_active !== false && setRow.value.enabled !== false);
        setDailySpinsLimit(Number(setRow.value.daily_spins_limit ?? setRow.value.daily_spin_limit ?? 1));
        setMinDepositRequired(Number(setRow.value.min_deposit_required ?? 0));
        if (Array.isArray(setRow.value.segments) && setRow.value.segments.length > 0) {
          const normalized = setRow.value.segments.map((s: any, idx: number) => {
            const rawAmt = Number(s.usdt_amount ?? s.amount ?? DEFAULT_SEGMENTS[idx]?.usdt_amount ?? 0.1);
            const rawProb = Number(s.probability_percent ?? s.probability ?? DEFAULT_SEGMENTS[idx]?.probability_percent ?? 0);
            const idNum = Number(s.id ?? (s.index !== undefined ? Number(s.index) + 1 : idx + 1));
            return {
              ...s,
              id: idNum,
              index: s.index ?? idx,
              usdt_amount: rawAmt,
              probability_percent: rawProb,
              label: s.label || `${rawAmt.toFixed(2)} USDT`,
              color: s.color || DEFAULT_SEGMENTS[idx % DEFAULT_SEGMENTS.length].color
            };
          });
          setSegments(normalized);
        }
      }

      // 2. Fetch player lucky spin wheel claims from wallet_ledger (all records sorted newest first)
      const { data: spinLedger, error: spinErr } = await supabase
        .from('wallet_ledger')
        .select('*')
        .eq('transaction_type', 'lucky_wheel_spin')
        .order('created_at', { ascending: false });

      if (!spinErr && Array.isArray(spinLedger)) {
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

  const handleSegmentChange = (index: number, field: keyof SegmentConfig, rawValue: string) => {
    const parsed = rawValue === '' ? 0 : parseFloat(rawValue);
    setSegments((prev) => {
      const copy = [...prev];
      const nextVal = Number.isFinite(parsed) ? parsed : 0;
      copy[index] = {
        ...copy[index],
        [field]: nextVal
      };
      if (field === 'usdt_amount') {
        copy[index].amount = nextVal;
        copy[index].label = `${nextVal.toFixed(2)} USDT`;
      } else if (field === 'probability_percent') {
        copy[index].probability = nextVal;
      }
      return copy;
    });
  };

  const handleNormalizeProbabilities = () => {
    if (totalProbability <= 0) {
      showToast('Enter positive probabilities on slices before auto-normalizing.', 'error');
      return;
    }
    setSegments((prev) => {
      const normalized = prev.map((s) => {
        const current = Math.max(0, parseFloat(String(s.probability_percent)) || 0);
        const scaled = parseFloat(((current / totalProbability) * 100).toFixed(1));
        return {
          ...s,
          probability_percent: scaled,
          probability: scaled
        };
      });

      const roundedSum = normalized.reduce((acc, s) => acc + s.probability_percent, 0);
      const delta = parseFloat((100 - roundedSum).toFixed(1));
      if (Math.abs(delta) > 0) {
        let maxIdx = 0;
        normalized.forEach((s, i) => {
          if (s.probability_percent > normalized[maxIdx].probability_percent) maxIdx = i;
        });
        const adjusted = parseFloat((normalized[maxIdx].probability_percent + delta).toFixed(1));
        normalized[maxIdx] = {
          ...normalized[maxIdx],
          probability_percent: adjusted,
          probability: adjusted
        };
      }
      return normalized;
    });
    showToast('Probabilities normalized to 100.0%!', 'info');
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isProbabilityValid) {
      showToast(
        `Total probability must sum to exactly 100.0% with valid inputs (Currently ${totalProbability.toFixed(1)}%)`,
        'error'
      );
      return;
    }

    setSavingSettings(true);
    try {
      const updated = {
        is_active: isActive,
        enabled: isActive,
        daily_spins_limit: Math.max(1, dailySpinsLimit),
        daily_spin_limit: Math.max(1, dailySpinsLimit),
        min_deposit_required: Math.max(0, minDepositRequired),
        segments: segments.map((s, idx) => {
          const amt = Math.max(0.01, parseFloat(String(s.usdt_amount)) || 0.10);
          const prob = Math.max(0.1, parseFloat(String(s.probability_percent)) || 1.0);
          return {
            ...s,
            id: s.id ?? idx + 1,
            index: s.index ?? idx,
            label: `${amt.toFixed(2)} USDT`,
            usdt_amount: amt,
            amount: amt,
            probability_percent: prob,
            probability: prob
          };
        })
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
    <div className="space-y-4 sm:space-y-6 animate-in fade-in duration-150 min-w-0">
      {/* Header */}
      <div className="bg-[#0d1117] border border-[#272a31] rounded-2xl p-4 sm:p-5 shadow-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3.5">
        <div className="flex items-start sm:items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-black font-black shadow-md shrink-0">
            <Sparkles className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h2 className="font-display font-black text-base sm:text-xl text-white leading-tight">
              Daily Bonus Spin Wheel Governance
            </h2>
            <p className="text-xs text-[#8b92a2] mt-0.5 leading-relaxed">
              Manage wheel eligibility rules, 8-slice USDT prize weights, and live player wheel claim records.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={loadSpinWheelData}
          disabled={loadingData}
          className="px-4 py-2 rounded-xl bg-[#141924] hover:bg-[#1a2130] text-xs font-bold text-white border border-[#272a31] hover:border-amber-500/40 flex items-center justify-center gap-2 self-stretch sm:self-auto cursor-pointer shrink-0 transition-colors"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loadingData ? 'animate-spin text-amber-400' : 'text-amber-400'}`} />
          <span>Refresh Data</span>
        </button>
      </div>

      {/* Main Settings Form */}
      <form onSubmit={handleSaveSettings} className="space-y-4 sm:space-y-6">
        {/* Global Controls Card */}
        <div className="bg-[#0d1117] border border-[#272a31] rounded-2xl p-4 sm:p-5 space-y-3.5 shadow-lg">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-[#1f2737]">
            <h3 className="font-display font-bold text-sm sm:text-base text-white flex items-center gap-2">
              <Sliders className="w-4 h-4 text-amber-400 shrink-0" />
              <span>Wheel Eligibility &amp; Frequency Rules</span>
            </h3>
            <span
              className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                isActive
                  ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                  : 'bg-red-500/15 text-red-400 border-red-500/30'
              }`}
            >
              {isActive ? 'Wheel Active' : 'Wheel Paused'}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            <div className="bg-[#111622] border border-[#272a31] rounded-xl p-3.5 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <span className="text-xs font-bold text-white block">Wheel Status</span>
                <span className="text-[11px] text-[#8b92a2] block">Allow spins platform-wide</span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer shrink-0">
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-[#272a31] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500" />
              </label>
            </div>

            <div className="bg-[#111622] border border-[#272a31] rounded-xl p-3.5 space-y-1.5">
              <label className="text-xs font-bold text-white block">
                Daily Free Spins Limit
              </label>
              <input
                type="number"
                min="1"
                max="10"
                value={dailySpinsLimit}
                onChange={(e) => setDailySpinsLimit(parseInt(e.target.value, 10) || 1)}
                className="w-full bg-[#07090d] border border-[#272a31] rounded-lg px-3 py-1.5 text-xs font-bold font-mono-numbers text-white outline-none focus:border-amber-400"
              />
              <span className="text-[10px] text-[#8b92a2] block">Default: 1 spin every 24h</span>
            </div>

            <div className="bg-[#111622] border border-[#272a31] rounded-xl p-3.5 space-y-1.5">
              <label className="text-xs font-bold text-white block">
                Min. Deposit Required (USDT)
              </label>
              <input
                type="number"
                step="1"
                min="0"
                value={minDepositRequired}
                onChange={(e) => setMinDepositRequired(parseFloat(e.target.value) || 0)}
                className="w-full bg-[#07090d] border border-[#272a31] rounded-lg px-3 py-1.5 text-xs font-bold font-mono-numbers text-white outline-none focus:border-amber-400"
              />
              <span className="text-[10px] text-[#8b92a2] block">0 = 100% Free for all users</span>
            </div>
          </div>
        </div>

        {/* 8 Segments & Probabilities Card */}
        <div className="bg-[#0d1117] border border-[#272a31] rounded-2xl p-4 sm:p-5 space-y-4 shadow-lg">
          {/* Header & Probability Summary Area */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3.5 border-b border-[#1f2737]">
            <div className="min-w-0">
              <h3 className="font-display font-black text-sm sm:text-base text-white flex items-center gap-2">
                <Percent className="w-4 h-4 text-amber-400 shrink-0" />
                <span>Wheel Segments &amp; Probability Distribution (8 Slices)</span>
              </h3>
              <p className="text-xs text-[#8b92a2] mt-0.5 leading-relaxed">
                Configure exact USDT payouts and hit probabilities. Slice weights must sum to exactly 100.0%.
              </p>
            </div>

            {/* Probability Summary Bar */}
            <div
              data-testid="spin-probability-summary"
              className="flex flex-wrap items-center gap-2 shrink-0"
            >
              <div className="px-2.5 py-1.5 rounded-xl bg-[#07090d] border border-[#272a31] text-[11px] font-mono-numbers">
                <span className="text-[#8b92a2]">Target: </span>
                <strong className="text-white">100.0%</strong>
              </div>

              <div
                className={`px-2.5 py-1.5 rounded-xl border text-[11px] font-mono-numbers font-bold flex items-center gap-1.5 ${
                  isProbabilityValid
                    ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/40'
                    : 'bg-red-500/15 text-red-400 border-red-500/40'
                }`}
              >
                {isProbabilityValid ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                ) : (
                  <AlertTriangle className="w-3.5 h-3.5 text-red-400 shrink-0" />
                )}
                <span>Configured: {totalProbability.toFixed(1)}%</span>
              </div>

              {!isProbabilityValid && (
                <div className="px-2.5 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-[11px] font-mono-numbers font-bold text-amber-300">
                  {remainingProbability > 0
                    ? `Remaining: +${remainingProbability.toFixed(1)}%`
                    : `Excess: ${Math.abs(remainingProbability).toFixed(1)}%`}
                </div>
              )}

              {!isProbabilityValid && (
                <button
                  type="button"
                  data-testid="spin-auto-normalize"
                  onClick={handleNormalizeProbabilities}
                  className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black text-xs font-black cursor-pointer transition-colors shadow-sm"
                >
                  Auto-Normalize
                </button>
              )}
            </div>
          </div>

          {/* 8 Segment Cards Responsive Grid (Desktop: 4/row | Tablet: 2/row | Mobile: 1 or 2/row) */}
          <div
            data-testid="spin-segments-grid"
            className="grid grid-cols-1 xs:grid-cols-2 lg:grid-cols-4 gap-3"
          >
            {segments.map((seg, idx) => {
              const amountInvalid = !Number.isFinite(Number(seg.usdt_amount)) || Number(seg.usdt_amount) < 0.01;
              const probInvalid =
                !Number.isFinite(Number(seg.probability_percent)) ||
                Number(seg.probability_percent) <= 0 ||
                Number(seg.probability_percent) > 100;
              const cardHasError = amountInvalid || probInvalid;

              return (
                <div
                  key={seg.id ?? idx}
                  data-testid="spin-segment-card"
                  className={`bg-[#111622] rounded-xl p-2.5 sm:p-3 xl:p-3.5 flex flex-col justify-between gap-2.5 border transition-colors min-w-0 ${
                    cardHasError
                      ? 'border-red-500/60 shadow-[0_0_0_1px_rgba(239,68,68,0.2)]'
                      : 'border-[#272a31] hover:border-amber-500/35'
                  }`}
                  style={{ borderTop: `3px solid ${seg.color}` }}
                >
                  <div className="flex items-center justify-between gap-1.5 min-w-0">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0 ring-1 ring-white/20"
                        style={{ backgroundColor: seg.color }}
                      />
                      <span className="text-[10.5px] font-bold uppercase tracking-wider text-white font-mono-numbers whitespace-nowrap">
                        Slice {seg.id ?? idx + 1}
                      </span>
                    </div>
                    <span className="text-[9.5px] xl:text-[10px] font-mono-numbers font-bold px-1.5 py-0.5 rounded bg-[#07090d] text-amber-300 border border-[#272a31] whitespace-nowrap shrink-0">
                      {Number(seg.usdt_amount || 0).toFixed(2)} USDT
                    </span>
                  </div>

                  <div className="space-y-2">
                    <div>
                      <label className="text-[10px] font-semibold text-[#94A3B8] block mb-1">
                        Prize Amount (USDT)
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          aria-label={`Slice ${seg.id ?? idx + 1} Prize Amount USDT`}
                          step="0.05"
                          min="0.01"
                          value={seg.usdt_amount}
                          onChange={(e) => handleSegmentChange(idx, 'usdt_amount', e.target.value)}
                          className={`w-full bg-[#07090d] border rounded-lg pl-2.5 pr-11 py-1.5 text-xs font-bold font-mono-numbers text-white outline-none transition-colors ${
                            amountInvalid
                              ? 'border-red-500 text-red-300 focus:border-red-400'
                              : 'border-[#272a31] focus:border-amber-400'
                          }`}
                        />
                        <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[9px] font-bold text-amber-400 pointer-events-none">
                          USDT
                        </span>
                      </div>
                    </div>

                    <div>
                      <label className="text-[10px] font-semibold text-[#94A3B8] block mb-1">
                        Win Probability (%)
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          aria-label={`Slice ${seg.id ?? idx + 1} Win Probability Percent`}
                          step="0.1"
                          min="0.1"
                          max="100"
                          value={seg.probability_percent}
                          onChange={(e) => handleSegmentChange(idx, 'probability_percent', e.target.value)}
                          className={`w-full bg-[#07090d] border rounded-lg pl-2.5 pr-7 py-1.5 text-xs font-bold font-mono-numbers text-white outline-none transition-colors ${
                            probInvalid || !isProbabilityValid
                              ? probInvalid
                                ? 'border-red-500 text-red-300 focus:border-red-400'
                                : 'border-amber-500/40 focus:border-amber-400'
                              : 'border-[#272a31] focus:border-emerald-400'
                          }`}
                        />
                        <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-bold text-[#8b92a2] pointer-events-none">
                          %
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Save & Validation Action Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-[#1f2737]">
            <div className="text-xs flex items-center gap-2 min-w-0">
              {isProbabilityValid ? (
                <span className="text-emerald-400 font-semibold flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>Valid 100.0% probability distribution across all 8 slices.</span>
                </span>
              ) : (
                <span className="text-red-400 font-semibold flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>
                    {hasInvalidSegment
                      ? 'Ensure every slice has prize >= 0.01 USDT and probability > 0%.'
                      : `Total probability must equal 100.0% (currently ${totalProbability.toFixed(1)}%).`}
                  </span>
                </span>
              )}
            </div>

            <button
              type="submit"
              disabled={savingSettings || !isProbabilityValid}
              className="w-full sm:w-auto justify-center px-6 py-2.5 rounded-xl btn-gold text-xs font-black flex items-center gap-2 cursor-pointer shadow-md disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
            >
              {savingSettings ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-black shrink-0" />
              ) : (
                <Save className="w-3.5 h-3.5 text-black shrink-0" />
              )}
              <span>{savingSettings ? 'Saving Configuration...' : 'Save Wheel Configuration'}</span>
            </button>
          </div>
        </div>
      </form>

      {/* Player Recent Wheel Claims Ledger (Fixed Max Height + Independent Internal Scroll) */}
      <div className="bg-[#0d1117] border border-[#272a31] rounded-2xl p-4 sm:p-5 space-y-3.5 shadow-lg">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-3 border-b border-[#1f2737]">
          <div className="min-w-0">
            <h3 className="font-display font-black text-sm sm:text-base text-white flex items-center gap-2">
              <Trophy className="w-4 h-4 text-amber-400 shrink-0" />
              <span>Player Recent Wheel Claims &amp; Leaderboard Ledger</span>
            </h3>
            <p className="text-xs text-[#8b92a2] mt-0.5 leading-relaxed">
              Live atomic wheel claims recorded in <code>wallet_ledger</code> (ordered most recent first).
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <span className="px-2.5 py-1 rounded-lg bg-[#07090d] border border-[#272a31] text-[11px] font-mono-numbers font-bold text-amber-300 flex items-center gap-1">
              <Coins className="w-3 h-3 text-amber-400 shrink-0" />
              <span>Total: {totalDisbursedUsdt.toFixed(2)}</span>
            </span>
            <span className="px-2.5 py-1 rounded-lg bg-white/5 border border-[#272a31] text-[11px] font-mono-numbers font-bold text-[#94A3B8]">
              {recentSpins.length} Records
            </span>
          </div>
        </div>

        {recentSpins.length > 0 ? (
          <div
            data-testid="spin-claims-scroll-box"
            className="max-h-[340px] sm:max-h-[380px] overflow-y-auto overflow-x-auto ef-subtle-scroll overscroll-contain rounded-xl border border-[#1f2737] bg-[#07090d]"
          >
            <table className="w-full min-w-[620px] text-left text-xs border-collapse">
              <thead className="sticky top-0 z-10 bg-[#0b1019] text-[#8b92a2] uppercase tracking-wider text-[10px] border-b border-[#1f2737] shadow-xs">
                <tr>
                  <th className="py-2.5 px-3 font-bold">#</th>
                  <th className="py-2.5 px-3 font-bold">Player / Wallet</th>
                  <th className="py-2.5 px-3 font-bold">Prize Credited</th>
                  <th className="py-2.5 px-3 font-bold">Description</th>
                  <th className="py-2.5 px-3 font-bold">Transaction ID</th>
                  <th className="py-2.5 px-3 font-bold text-right">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1f2737]/70 font-mono-numbers">
                {recentSpins.map((spin, rowIdx) => {
                  const addr = spin.wallet_address || spin.user_id || 'Unknown Player';
                  const shortPlayer =
                    addr.length > 16 ? `${addr.slice(0, 8)}...${addr.slice(-6)}` : addr;
                  const unitLabel = spin.currency || 'USDT';

                  return (
                    <tr
                      key={spin.id || rowIdx}
                      className="hover:bg-[#141a27] transition-colors"
                    >
                      <td className="py-2.5 px-3 text-[#64748b] font-bold">
                        {rowIdx + 1}
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="text-white font-semibold" title={addr}>
                          {shortPlayer}
                        </div>
                        {spin.user_id && spin.wallet_address && (
                          <div className="text-[10px] text-[#64748b] truncate max-w-[140px]" title={spin.user_id}>
                            ID: {String(spin.user_id).slice(0, 8)}...
                          </div>
                        )}
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 font-bold whitespace-nowrap">
                          +{parseFloat(spin.amount || 0).toFixed(2)} {unitLabel}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-[#94A3B8] font-sans max-w-[230px] truncate" title={spin.description || spin.notes}>
                        {spin.description || spin.notes || 'Daily Bonus Wheel Spin'}
                      </td>
                      <td className="py-2.5 px-3 text-amber-400/90 font-medium max-w-[170px] truncate" title={spin.id}>
                        {spin.id}
                      </td>
                      <td className="py-2.5 px-3 text-[#8b92a2] text-right whitespace-nowrap">
                        <span className="inline-flex items-center gap-1">
                          <Clock className="w-3 h-3 text-[#64748b] hidden sm:inline" />
                          <span>{spin.created_at ? new Date(spin.created_at).toLocaleString() : '—'}</span>
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="py-8 text-center text-xs text-[#8b92a2] italic bg-[#07090d] rounded-xl border border-[#1f2737]">
            No wheel claim records found yet. Player claims appear here automatically in chronological order.
          </div>
        )}
      </div>
    </div>
  );
}
