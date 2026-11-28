import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useLottery } from '../context/LotteryContext';
import {
  Trophy,
  Calendar,
  Save,
  Send,
  EyeOff,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Copy,
  ShieldCheck,
  Coins
} from 'lucide-react';

interface PrizeTier {
  rank: number;
  reward_usdt: string;
}

interface MonthAnnouncementRecord {
  month_key: string;
  month_label?: string;
  title?: string;
  description?: string;
  prizes?: Array<{ rank: number; reward_usdt: number }>;
  is_published?: boolean;
  finalized?: boolean;
  finalized_at?: string;
  finalized_winners_count?: number;
  updated_at?: string;
  published_at?: string;
}

const getCurrentMonthKey = (): string => {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
};

const formatMonthLabel = (monthKey: string): string => {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(monthKey)) return monthKey;
  const [y, m] = monthKey.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric'
  });
};

const createEmptyTiers = (): PrizeTier[] =>
  Array.from({ length: 10 }, (_, idx) => ({
    rank: idx + 1,
    reward_usdt: '0.00'
  }));

export default function MonthlyLeaderboardManagement() {
  const { showToast, adminFinalizeMonthlyLeaderboard } = useLottery() as any;

  const [selectedMonth, setSelectedMonth] = useState<string>(getCurrentMonthKey);
  const [savedMonths, setSavedMonths] = useState<Record<string, MonthAnnouncementRecord>>({});
  const [publishedRecord, setPublishedRecord] = useState<MonthAnnouncementRecord | null>(null);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [tiers, setTiers] = useState<PrizeTier[]>(createEmptyTiers);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [finalizing, setFinalizing] = useState(false);
  const [showFinalizeConfirm, setShowFinalizeConfirm] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const populateMonthForm = (
    monthKey: string,
    monthsMap: Record<string, MonthAnnouncementRecord>
  ) => {
    const existing = monthsMap[monthKey];
    const monthLabel = formatMonthLabel(monthKey);
    if (existing) {
      setTitle(existing.title || `${monthLabel} Top 10 Prize Pool`);
      setDescription(
        existing.description ||
          'Top 10 ranked players by win rate share this month’s official USDT prize pool.'
      );
      const nextTiers = Array.from({ length: 10 }, (_, idx) => {
        const rank = idx + 1;
        const found = Array.isArray(existing.prizes)
          ? existing.prizes.find((p) => Number(p.rank) === rank)
          : null;
        return {
          rank,
          reward_usdt: found ? Number(found.reward_usdt || 0).toFixed(2) : '0.00'
        };
      });
      setTiers(nextTiers);
    } else {
      setTitle(`${monthLabel} Top 10 Prize Pool`);
      setDescription(
        'Top 10 ranked players by win rate share this month’s official USDT prize pool.'
      );
      setTiers(createEmptyTiers());
    }
  };

  const loadConfig = async (focusMonth?: string) => {
    setLoading(true);
    setAuthError(null);
    try {
      const { data, error } = await supabase.rpc('admin_manage_monthly_leaderboard_announcement', {
        p_action: 'get_all'
      });

      if (error) {
        setAuthError(error.message);
        return;
      }

      if (!data?.success) {
        setAuthError(data?.error || 'Unable to load Super Admin leaderboard settings.');
        return;
      }

      const monthsMap: Record<string, MonthAnnouncementRecord> = data.config?.months || {};
      setSavedMonths(monthsMap);
      setPublishedRecord(data.published?.is_published ? data.published : null);

      const targetMonth = focusMonth || selectedMonth || data.config?.active_month || getCurrentMonthKey();
      setSelectedMonth(targetMonth);
      populateMonthForm(targetMonth, monthsMap);
    } catch (err: any) {
      setAuthError(err?.message || 'Unexpected error loading monthly leaderboard configuration.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadConfig();
  }, []);

  const handleSelectMonth = (nextMonth: string) => {
    if (!nextMonth) return;
    setSelectedMonth(nextMonth);
    populateMonthForm(nextMonth, savedMonths);
  };

  const handleTierChange = (rank: number, rawValue: string) => {
    setTiers((prev) =>
      prev.map((tier) => (tier.rank === rank ? { ...tier, reward_usdt: rawValue } : tier))
    );
  };

  const normalizedPrizes = useMemo(
    () =>
      tiers.map((t) => {
        const parsed = parseFloat(t.reward_usdt);
        return {
          rank: t.rank,
          reward_usdt: Number.isFinite(parsed) && parsed >= 0 ? Math.round(parsed * 100) / 100 : 0
        };
      }),
    [tiers]
  );

  const totalPoolUsdt = useMemo(
    () => normalizedPrizes.reduce((sum, item) => sum + item.reward_usdt, 0),
    [normalizedPrizes]
  );

  const hasInvalidAmount = useMemo(
    () =>
      tiers.some((t) => {
        const val = parseFloat(t.reward_usdt);
        return !Number.isFinite(val) || val < 0;
      }),
    [tiers]
  );

  const savedOtherMonths = useMemo(
    () => Object.keys(savedMonths).filter((m) => m !== selectedMonth).sort().reverse(),
    [savedMonths, selectedMonth]
  );

  const handleCopyPreviousMonth = () => {
    if (savedOtherMonths.length === 0) return;
    const latestOther = savedMonths[savedOtherMonths[0]];
    if (!latestOther) return;
    if (Array.isArray(latestOther.prizes)) {
      setTiers(
        Array.from({ length: 10 }, (_, idx) => {
          const rank = idx + 1;
          const found = latestOther.prizes?.find((p) => Number(p.rank) === rank);
          return {
            rank,
            reward_usdt: found ? Number(found.reward_usdt || 0).toFixed(2) : '0.00'
          };
        })
      );
      showToast(`Copied Rank 1–10 prizes from ${formatMonthLabel(savedOtherMonths[0])}`, 'info');
    }
  };

  const handleSave = async (publish: boolean) => {
    if (hasInvalidAmount) {
      showToast('All Rank 1–10 USDT rewards must be valid non-negative numbers.', 'error');
      return;
    }

    if (publish && totalPoolUsdt <= 0) {
      showToast('Enter at least one non-zero USDT prize before publishing.', 'error');
      return;
    }

    setSubmitting(true);
    try {
      const { data, error } = await supabase.rpc('admin_manage_monthly_leaderboard_announcement', {
        p_action: 'save',
        p_month_key: selectedMonth,
        p_title: title.trim(),
        p_description: description.trim(),
        p_prizes: normalizedPrizes,
        p_publish: publish
      });

      if (error) throw error;
      if (!data?.success) {
        showToast(data?.error || 'Failed to save announcement.', 'error');
        return;
      }

      const nextMonths = data.config?.months || {};
      setSavedMonths(nextMonths);
      setPublishedRecord(data.published?.is_published ? data.published : null);
      populateMonthForm(selectedMonth, nextMonths);

      showToast(
        publish
          ? `${formatMonthLabel(selectedMonth)} announcement published live to User Panel!`
          : `${formatMonthLabel(selectedMonth)} announcement saved as draft.`,
        'success'
      );
    } catch (err: any) {
      showToast(err?.message || 'Error saving monthly leaderboard announcement.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUnpublish = async () => {
    setSubmitting(true);
    try {
      const { data, error } = await supabase.rpc('admin_manage_monthly_leaderboard_announcement', {
        p_action: 'unpublish',
        p_month_key: selectedMonth
      });

      if (error) throw error;
      if (!data?.success) {
        showToast(data?.error || 'Failed to unpublish announcement.', 'error');
        return;
      }

      const nextMonths = data.config?.months || {};
      setSavedMonths(nextMonths);
      setPublishedRecord(data.published?.is_published ? data.published : null);
      populateMonthForm(selectedMonth, nextMonths);
      showToast(`${formatMonthLabel(selectedMonth)} announcement unpublished from User Panel.`, 'info');
    } catch (err: any) {
      showToast(err?.message || 'Error unpublishing announcement.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const isSelectedCurrentlyPublished = Boolean(
    publishedRecord?.is_published && publishedRecord.month_key === selectedMonth
  );
  const selectedSaved = savedMonths[selectedMonth];
  const isSelectedFinalized = Boolean(selectedSaved?.finalized);
  const isMonthElapsed = selectedMonth < getCurrentMonthKey();

  const handleFinalizeCompetition = async () => {
    if (finalizing) return;
    setFinalizing(true);
    try {
      const res = await adminFinalizeMonthlyLeaderboard(selectedMonth, !isMonthElapsed);
      if (res?.success) {
        setShowFinalizeConfirm(false);
        await loadConfig(selectedMonth);
      }
    } finally {
      setFinalizing(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-150">
      {/* Header Banner */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 bg-[#0d1117] border border-[#272a31] p-5 rounded-2xl">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <Trophy className="w-5 h-5 text-amber-400 shrink-0" />
            <h2 className="font-display font-extrabold text-lg text-white">
              Monthly Leaderboard Rewards &amp; Distribution
            </h2>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-400 text-[10px] font-mono-numbers font-bold uppercase">
              <ShieldCheck className="w-3 h-3" /> Super Admin Only
            </span>
          </div>
          <p className="text-xs text-[#8b92a2]">
            Configure independent Rank 1–10 USDT rewards per competition month. Published values appear inline directly between Username and Total Won in the User Leaderboard.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto">
          <div className="flex items-center gap-2 bg-[#111827] border border-[#272a31] rounded-xl px-3 py-1.5">
            <Calendar className="w-4 h-4 text-amber-400 shrink-0" />
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => handleSelectMonth(e.target.value)}
              aria-label="Competition Month"
              className="bg-transparent text-xs font-mono-numbers font-bold text-white focus:outline-none [color-scheme:dark]"
            />
          </div>
          <button
            type="button"
            onClick={() => loadConfig(selectedMonth)}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#111827] border border-[#272a31] hover:border-amber-500/40 text-xs font-bold text-[#c7cdd8] hover:text-white transition-all cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Super Admin Auth Error Banner */}
      {authError && (
        <div className="flex items-start gap-3 p-4 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs">
          <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
          <div>
            <p className="font-bold text-red-200">Super Admin Authorization Required</p>
            <p className="mt-0.5 text-red-300/90">{authError}</p>
          </div>
        </div>
      )}

      {/* Live Published Status KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-2xl bg-[#0d1117] border border-[#272a31] space-y-1">
          <span className="text-[10px] font-mono-numbers uppercase tracking-wider text-[#8b92a2]">
            Live Published Month
          </span>
          <div className="flex items-center gap-2 pt-0.5">
            {publishedRecord?.is_published ? (
              <>
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span className="text-sm font-bold text-emerald-400">
                  {publishedRecord.month_label || formatMonthLabel(publishedRecord.month_key)}
                </span>
              </>
            ) : (
              <>
                <EyeOff className="w-4 h-4 text-slate-400 shrink-0" />
                <span className="text-sm font-bold text-slate-400">
                  Not Published (Hidden from Users)
                </span>
              </>
            )}
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-[#0d1117] border border-[#272a31] space-y-1">
          <span className="text-[10px] font-mono-numbers uppercase tracking-wider text-[#8b92a2]">
            Editing Competition
          </span>
          <div className="flex items-center justify-between gap-2 pt-0.5">
            <span className="text-sm font-bold text-white">{formatMonthLabel(selectedMonth)}</span>
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-mono-numbers font-bold uppercase border ${
                isSelectedCurrentlyPublished
                  ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                  : 'bg-amber-500/15 text-amber-400 border-amber-500/30'
              }`}
            >
              {isSelectedCurrentlyPublished ? 'Published' : savedMonths[selectedMonth] ? 'Draft' : 'New'}
            </span>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-[#0d1117] border border-[#272a31] space-y-1">
          <span className="text-[10px] font-mono-numbers uppercase tracking-wider text-[#8b92a2]">
            Total Top-10 Prize Pool
          </span>
          <div className="flex items-center gap-2 pt-0.5">
            <Coins className="w-4 h-4 text-amber-400 shrink-0" />
            <span className="text-base font-mono-numbers font-extrabold text-amber-400">
              {totalPoolUsdt.toLocaleString('en-US', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
              })}{' '}
              USDT
            </span>
          </div>
        </div>
      </div>

      {/* Main Editor Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        {/* Left: Form & Rank 1-10 Reward Inputs */}
        <div className="xl:col-span-7 bg-[#0d1117] border border-[#272a31] rounded-2xl p-5 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#272a31] pb-3">
            <div className="flex items-center gap-2">
              <Trophy className="w-4 h-4 text-amber-400" />
              <h3 className="font-display font-bold text-sm sm:text-base text-white">
                {formatMonthLabel(selectedMonth)} — Rank 1–10 USDT Allocation
              </h3>
            </div>
            {savedOtherMonths.length > 0 && (
              <button
                type="button"
                onClick={handleCopyPreviousMonth}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#111827] border border-[#272a31] hover:border-amber-500/40 text-[11px] font-bold text-amber-400 transition-colors cursor-pointer"
              >
                <Copy className="w-3 h-3" />
                Copy {formatMonthLabel(savedOtherMonths[0])}
              </button>
            )}
          </div>

          {/* Announcement Metadata */}
          <div className="grid grid-cols-1 gap-3.5">
            <div>
              <label className="block text-[11px] font-mono-numbers uppercase tracking-wider text-[#8b92a2] mb-1.5">
                Announcement Title
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={`${formatMonthLabel(selectedMonth)} Top 10 Prize Pool`}
                maxLength={100}
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#0B0F19] border border-[#272a31] focus:border-amber-500/60 focus:outline-none text-xs sm:text-sm text-white placeholder-[#525866]"
              />
            </div>

            <div>
              <label className="block text-[11px] font-mono-numbers uppercase tracking-wider text-[#8b92a2] mb-1.5">
                Rules / Announcement Note
              </label>
              <textarea
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Top 10 ranked players by win rate share this month’s official USDT prize pool."
                maxLength={240}
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#0B0F19] border border-[#272a31] focus:border-amber-500/60 focus:outline-none text-xs sm:text-sm text-white placeholder-[#525866] resize-none"
              />
            </div>
          </div>

          {/* Rank 1-10 Reward Matrix */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {tiers.map((tier) => {
              const badgeStyle =
                tier.rank === 1
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                  : tier.rank === 2
                  ? 'bg-slate-400/20 text-slate-200 border-slate-400/40'
                  : tier.rank === 3
                  ? 'bg-orange-500/20 text-orange-300 border-orange-500/40'
                  : 'bg-[#1a2232] text-[#94A3B8] border-[#272a31]';

              return (
                <div
                  key={tier.rank}
                  className="flex items-center justify-between gap-3 p-3 rounded-xl bg-[#0B0F19] border border-[#272a31] focus-within:border-amber-500/50 transition-colors"
                >
                  <div className="flex items-center gap-2.5 shrink-0">
                    <span
                      className={`inline-flex items-center justify-center w-8 h-8 rounded-lg border font-mono-numbers font-extrabold text-xs ${badgeStyle}`}
                    >
                      #{tier.rank}
                    </span>
                    <span className="text-xs font-bold text-white">Rank {tier.rank}</span>
                  </div>

                  <div className="relative flex-1 max-w-[140px]">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={tier.reward_usdt}
                      onChange={(e) => handleTierChange(tier.rank, e.target.value)}
                      aria-label={`Rank ${tier.rank} USDT reward`}
                      className="w-full pl-3 pr-12 py-1.5 rounded-lg bg-[#111827] border border-[#272a31] focus:border-amber-500/60 focus:outline-none text-right text-xs sm:text-sm font-mono-numbers font-bold text-emerald-400"
                    />
                    <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-mono-numbers text-[#8b92a2] pointer-events-none">
                      USDT
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-[#272a31]">
            <button
              type="button"
              onClick={() => handleSave(false)}
              disabled={submitting || loading || Boolean(authError)}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#111827] border border-[#272a31] hover:border-amber-500/40 text-xs font-bold text-white transition-all cursor-pointer disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5 text-amber-400" />
              Save Draft
            </button>

            <button
              type="button"
              onClick={() => handleSave(true)}
              disabled={submitting || loading || Boolean(authError)}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#f5c451] to-[#e0a629] hover:brightness-105 text-xs font-extrabold text-[#0b0f17] shadow-lg shadow-amber-500/15 transition-all cursor-pointer disabled:opacity-50"
            >
              <Send className="w-3.5 h-3.5" />
              Save &amp; Publish to Users
            </button>

            {isSelectedCurrentlyPublished && (
              <button
                type="button"
                onClick={handleUnpublish}
                disabled={submitting || loading || Boolean(authError)}
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-red-500/10 border border-red-500/30 hover:bg-red-500/20 text-xs font-bold text-red-400 transition-all cursor-pointer disabled:opacity-50 ml-auto"
              >
                <EyeOff className="w-3.5 h-3.5" />
                Unpublish
              </button>
            )}
          </div>

          {/* Competition Finalization & Payout Generation Bar */}
          <div className="mt-2 p-4 rounded-2xl bg-[#07090d] border border-purple-500/30 space-y-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="space-y-1 min-w-0">
                <div className="flex items-center gap-2">
                  <Trophy className="w-4 h-4 text-purple-300 shrink-0" />
                  <span className="text-xs font-bold text-white">
                    Monthly Competition Finalization &amp; Payout Generation
                  </span>
                </div>
                <p className="text-[11px] text-[#94A3B8] leading-relaxed">
                  {isSelectedFinalized
                    ? `Finalized cleanly (${selectedSaved?.finalized_winners_count ?? 0} payout record(s) queued). Scheduled pg_cron automatically settles completed months at month-end.`
                    : isMonthElapsed
                    ? `${formatMonthLabel(selectedMonth)} has ended. pg_cron runs hourly auto-finalization, or you can finalize and queue Top-10 payouts immediately.`
                    : `${formatMonthLabel(selectedMonth)} is active. Auto-finalization triggers automatically at UTC month-end via pg_cron once the competition closes.`}
                </p>
              </div>

              {isSelectedFinalized ? (
                <span className="px-2.5 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-[10px] font-mono-numbers font-bold text-emerald-300 uppercase shrink-0">
                  Finalized
                </span>
              ) : (
                <span className="px-2.5 py-1 rounded-full bg-purple-500/15 border border-purple-500/30 text-[10px] font-mono-numbers font-bold text-purple-300 uppercase shrink-0">
                  {isMonthElapsed ? 'Ready to Finalize' : 'Auto at Month-End'}
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              {!isSelectedFinalized && (
                <button
                  type="button"
                  onClick={() => setShowFinalizeConfirm(true)}
                  disabled={finalizing || loading || Boolean(authError) || !selectedSaved}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-purple-600/25 hover:bg-purple-600/40 border border-purple-500/40 text-xs font-bold text-purple-200 transition-colors cursor-pointer disabled:opacity-45"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Finalize {formatMonthLabel(selectedMonth)} &amp; Credit Winners
                </button>
              )}
            </div>
          </div>

          {showFinalizeConfirm && (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4"
              role="dialog"
              aria-modal="true"
            >
              <div className="w-full max-w-md rounded-2xl bg-[#0d1117] border border-purple-500/40 p-5 space-y-4 shadow-2xl">
                <div className="space-y-1">
                  <h4 className="font-display font-bold text-base text-white">
                    Finalize {formatMonthLabel(selectedMonth)} Leaderboard?
                  </h4>
                  <p className="text-xs text-[#94A3B8] leading-relaxed">
                    {isMonthElapsed
                      ? 'This will rank Top 10 eligible winners using win-rate rules and automatically credit USDT rewards directly to their wallets.'
                      : 'Warning: This competition month has not closed yet. Finalizing early will immediately lock and automatically credit Top-10 USDT rewards directly to winner wallets.'}
                  </p>
                </div>
                <div className="flex items-center justify-end gap-2.5">
                  <button
                    type="button"
                    onClick={() => setShowFinalizeConfirm(false)}
                    disabled={finalizing}
                    className="px-4 py-2 rounded-xl bg-[#111827] border border-[#272a31] text-xs font-bold text-white cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleFinalizeCompetition}
                    disabled={finalizing}
                    className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-xs font-bold text-white cursor-pointer disabled:opacity-50"
                  >
                    {finalizing ? 'Finalizing...' : 'Confirm Finalization'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right: Inline Leaderboard Row Preview & Saved Months */}
        <div className="xl:col-span-5 space-y-5">
          <div className="bg-[#0d1117] border border-[#272a31] rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-mono-numbers uppercase tracking-wider text-amber-400 font-bold">
                User Panel Inline Row Preview
              </span>
              <span className="text-[10px] font-mono-numbers text-[#8b92a2]">
                {isSelectedCurrentlyPublished ? 'Live on Leaderboard' : 'Hidden Until Published'}
              </span>
            </div>

            <div className="rounded-xl bg-[#0B0F19] border border-[#1F2737] overflow-hidden">
              <div className="grid grid-cols-[44px_minmax(0,1fr)_auto_auto] items-center gap-2 px-3 py-2 bg-[#07090d] border-b border-[#1F2737] text-[9.5px] font-mono-numbers uppercase tracking-wider text-[#94A3B8]">
                <span>Rank</span>
                <span>Username</span>
                <span className="text-right">Reward</span>
                <span className="text-right">Total Won</span>
              </div>
              <div className="divide-y divide-[#1F2737]/70">
                {normalizedPrizes.map((prize) => (
                  <div
                    key={prize.rank}
                    className="grid grid-cols-[44px_minmax(0,1fr)_auto_auto] items-center gap-2 px-3 py-2 text-[11px]"
                  >
                    <span
                      className={`font-mono-numbers font-extrabold ${
                        prize.rank === 1
                          ? 'text-amber-300'
                          : prize.rank === 2
                          ? 'text-slate-200'
                          : prize.rank === 3
                          ? 'text-orange-300'
                          : 'text-[#94A3B8]'
                      }`}
                    >
                      #{prize.rank}
                    </span>
                    <span className="text-white/75 truncate">
                      Player_{prize.rank}
                    </span>
                    <span className="font-mono-numbers font-bold text-amber-300 text-right whitespace-nowrap">
                      {prize.reward_usdt > 0
                        ? `${prize.reward_usdt.toLocaleString('en-US', {
                            minimumFractionDigits: prize.reward_usdt % 1 === 0 ? 0 : 2,
                            maximumFractionDigits: 2
                          })} USDT`
                        : '—'}
                    </span>
                    <span className="font-mono-numbers font-bold text-emerald-400 text-right whitespace-nowrap">
                      {((11 - prize.rank) * 85).toFixed(2)} USDT
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Saved Months Quick Switcher */}
          {Object.keys(savedMonths).length > 0 && (
            <div className="bg-[#0d1117] border border-[#272a31] rounded-2xl p-5 space-y-3">
              <h4 className="text-xs font-mono-numbers uppercase tracking-wider text-[#8b92a2] font-bold">
                Configured Months ({Object.keys(savedMonths).length})
              </h4>
              <div className="max-h-[240px] overflow-y-auto ef-subtle-scroll space-y-2 pr-1">
                {Object.keys(savedMonths)
                  .sort()
                  .reverse()
                  .map((monthKey) => {
                    const rec = savedMonths[monthKey];
                    const isPub = publishedRecord?.is_published && publishedRecord.month_key === monthKey;
                    const monthPool = Array.isArray(rec.prizes)
                      ? rec.prizes.reduce((s, p) => s + Number(p.reward_usdt || 0), 0)
                      : 0;
                    return (
                      <button
                        key={monthKey}
                        type="button"
                        onClick={() => handleSelectMonth(monthKey)}
                        className={`w-full flex items-center justify-between gap-2 p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                          selectedMonth === monthKey
                            ? 'bg-amber-500/10 border-amber-500/40'
                            : 'bg-[#0B0F19] border-[#272a31] hover:border-[#3b4252]'
                        }`}
                      >
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-white truncate">
                            {rec.month_label || formatMonthLabel(monthKey)}
                          </p>
                          <p className="text-[10px] font-mono-numbers text-[#8b92a2]">
                            Pool: ${monthPool.toFixed(2)} USDT
                          </p>
                        </div>
                        <span
                          className={`shrink-0 px-2 py-0.5 rounded-full text-[10px] font-mono-numbers font-bold uppercase ${
                            isPub
                              ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                              : 'bg-slate-500/15 text-slate-400 border border-slate-500/30'
                          }`}
                        >
                          {isPub ? 'Live' : 'Draft'}
                        </span>
                      </button>
                    );
                  })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
