import React, { useMemo, useState } from 'react';
import { useLottery } from '../context/LotteryContext';
import {
  Trophy,
  Award,
  Clock,
  Coins,
  PlusCircle,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Copy,
  Check,
  Trash2,
  ShieldCheck,
  RefreshCw,
  Loader2,
  Megaphone,
  Ticket,
  Lock,
  ChevronDown,
  ChevronUp,
  RotateCcw,
  Ban
} from 'lucide-react';

type PayoutCategoryFilter = 'all' | 'lottery_win' | 'monthly_leaderboard' | 'manual_grant';
type PayoutStatusFilter = 'all' | 'pending_approval' | 'processing' | 'completed' | 'failed' | 'cancelled';

const formatMonthLabel = (monthKey?: string | null): string => {
  if (!monthKey || !/^\d{4}-(0[1-9]|1[0-2])$/.test(monthKey)) return monthKey || 'Monthly Competition';
  const [y, m] = monthKey.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
};

const shortHash = (val?: string | null, start = 6, end = 4): string => {
  if (!val) return '—';
  if (val.length <= start + end + 3) return val;
  return `${val.slice(0, start)}...${val.slice(-end)}`;
};

interface WinnerPayoutsManagementProps {
  usersList?: any[];
}

export default function WinnerPayoutsManagement({ usersList = [] }: WinnerPayoutsManagementProps) {
  const {
    winnerPayouts = [],
    fetchWinnerPayouts,
    adminApproveWinnerPayout,
    adminCancelOrDeleteWinnerPayout,
    adminAddManualWinnerCredit,
    showToast
  } = useLottery() as any;

  const [categoryFilter, setCategoryFilter] = useState<PayoutCategoryFilter>('all');
  const [statusFilter, setStatusFilter] = useState<PayoutStatusFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const [editedPayoutAmounts, setEditedPayoutAmounts] = useState<Record<string, string>>({});
  const [adjustmentReasons, setAdjustmentReasons] = useState<Record<string, string>>({});
  const [processingPayoutId, setProcessingPayoutId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Manual credit form state
  const [manualWinnerUser, setManualWinnerUser] = useState('');
  const [manualWinnerAmount, setManualWinnerAmount] = useState('');
  const [manualWinnerNote, setManualWinnerNote] = useState('');
  const [submittingManual, setSubmittingManual] = useState(false);

  // Safe Delete / Cancel Confirmation Modal
  const [cancelTarget, setCancelTarget] = useState<{
    payout: any;
    mode: 'cancel' | 'delete';
  } | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [confirmingCancel, setConfirmingCancel] = useState(false);

  const handleCopy = (text: string, key: string) => {
    if (!text) return;
    navigator.clipboard?.writeText(text).catch(() => {});
    setCopiedKey(key);
    setTimeout(() => setCopiedKey((prev) => (prev === key ? null : prev)), 1800);
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await fetchWinnerPayouts?.();
    } finally {
      setRefreshing(false);
    }
  };

  const categoryCounts = useMemo(() => {
    const counts = { all: winnerPayouts.length, lottery_win: 0, monthly_leaderboard: 0, manual_grant: 0 };
    for (const p of winnerPayouts) {
      if (p.payoutType === 'monthly_leaderboard') counts.monthly_leaderboard += 1;
      else if (p.payoutType === 'manual_grant') counts.manual_grant += 1;
      else counts.lottery_win += 1;
    }
    return counts;
  }, [winnerPayouts]);

  const filteredPayouts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return winnerPayouts.filter((p: any) => {
      if (categoryFilter !== 'all' && p.payoutType !== categoryFilter) return false;
      if (statusFilter !== 'all' && p.status !== statusFilter) return false;
      if (!q) return true;
      return (
        String(p.id || '').toLowerCase().includes(q) ||
        String(p.payoutReference || '').toLowerCase().includes(q) ||
        String(p.eventTitle || '').toLowerCase().includes(q) ||
        String(p.winnerUsername || '').toLowerCase().includes(q) ||
        String(p.winnerAddress || '').toLowerCase().includes(q) ||
        String(p.userId || '').toLowerCase().includes(q) ||
        String(p.competitionMonth || '').toLowerCase().includes(q) ||
        String(p.winningDigits || '').toLowerCase().includes(q)
      );
    });
  }, [winnerPayouts, categoryFilter, statusFilter, searchQuery]);

  const metrics = useMemo(() => {
    let completedUsdt = 0;
    let completedCount = 0;
    let pendingUsdt = 0;
    let pendingCount = 0;
    let failedCount = 0;
    let monthlyPendingUsdt = 0;
    let monthlyPendingCount = 0;

    for (const p of winnerPayouts) {
      if (p.status === 'completed') {
        completedCount += 1;
        completedUsdt += Number(p.payoutAmount || 0);
      } else if (p.status === 'pending_approval' || p.status === 'processing' || p.status === 'failed') {
        if (p.status === 'failed') failedCount += 1;
        else pendingCount += 1;
        const editedRaw = editedPayoutAmounts[p.id];
        const amt =
          editedRaw !== undefined && editedRaw.trim() !== ''
            ? parseFloat(editedRaw) || 0
            : Number(p.payoutAmount || 0);
        pendingUsdt += amt;
        if (p.payoutType === 'monthly_leaderboard') {
          monthlyPendingCount += 1;
          monthlyPendingUsdt += amt;
        }
      }
    }

    return {
      completedUsdt,
      completedCount,
      pendingUsdt,
      pendingCount,
      failedCount,
      monthlyPendingUsdt,
      monthlyPendingCount
    };
  }, [winnerPayouts, editedPayoutAmounts]);

  const getEditedValidation = (p: any) => {
    const rawVal = editedPayoutAmounts[p.id] !== undefined ? editedPayoutAmounts[p.id] : String(p.payoutAmount ?? 0);
    const parsed = parseFloat(rawVal);
    const isZeroSalesLottery =
      p.payoutType === 'lottery_win' &&
      p.eventId &&
      p.eventId !== 'manual-reward' &&
      Number(p.ticketsSold || 0) <= 0 &&
      Number(p.totalPoolCollected || 0) <= 0;

    let error: string | null = null;
    if (isZeroSalesLottery) {
      error = '0 eligible ticket sales recorded — cannot approve.';
    } else if (!Number.isFinite(parsed) || parsed <= 0) {
      error = 'Disbursal must be > 0.00 USDT.';
    } else if (p.maxAllowedAmount != null && p.maxAllowedAmount > 0 && parsed > Number(p.maxAllowedAmount)) {
      error = `Exceeds authorized pool cap (${Number(p.maxAllowedAmount).toFixed(2)} USDT).`;
    }

    const isManuallyChanged =
      Number.isFinite(parsed) && Math.abs(parsed - Number(p.calculatedAmount || 0)) >= 0.01;

    return { rawVal, parsed, error, isZeroSalesLottery, isManuallyChanged };
  };

  const handleApproveClick = async (p: any) => {
    if (processingPayoutId) return;
    const { parsed, error } = getEditedValidation(p);
    if (error) {
      showToast(error, 'error');
      return;
    }

    setProcessingPayoutId(p.id);
    try {
      const reason = adjustmentReasons[p.id]?.trim() || null;
      await adminApproveWinnerPayout(p.id, parsed, reason);
    } finally {
      setProcessingPayoutId(null);
    }
  };

  const handleConfirmCancelOrDelete = async () => {
    if (!cancelTarget || confirmingCancel) return;
    setConfirmingCancel(true);
    try {
      const res = await adminCancelOrDeleteWinnerPayout(
        cancelTarget.payout.id,
        cancelTarget.mode,
        cancelReason.trim()
      );
      if (res?.success) {
        setCancelTarget(null);
        setCancelReason('');
      }
    } finally {
      setConfirmingCancel(false);
    }
  };

  const handleManualCreditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submittingManual) return;
    const amt = parseFloat(manualWinnerAmount);
    if (!manualWinnerUser.trim()) {
      showToast('Enter recipient @username or TRC-20 wallet address.', 'error');
      return;
    }
    if (!Number.isFinite(amt) || amt <= 0) {
      showToast('Enter a valid USDT amount greater than zero.', 'error');
      return;
    }
    setSubmittingManual(true);
    try {
      const res = await adminAddManualWinnerCredit(manualWinnerUser.trim(), amt, manualWinnerNote.trim());
      if (res?.success) {
        setManualWinnerAmount('');
        setManualWinnerNote('');
      }
    } finally {
      setSubmittingManual(false);
    }
  };

  const renderStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
      case 'paid':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9.5px] font-mono-numbers font-bold uppercase tracking-wide bg-emerald-500/15 text-[#05d5aa] border border-[#05d5aa]/30 whitespace-nowrap">
            <CheckCircle className="w-3 h-3 shrink-0" />
            Completed
          </span>
        );
      case 'processing':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9.5px] font-mono-numbers font-bold uppercase tracking-wide bg-blue-500/15 text-blue-300 border border-blue-500/30 whitespace-nowrap">
            <Loader2 className="w-3 h-3 shrink-0 animate-spin" />
            Processing
          </span>
        );
      case 'failed':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9.5px] font-mono-numbers font-bold uppercase tracking-wide bg-red-500/15 text-red-400 border border-red-500/35 whitespace-nowrap">
            <AlertTriangle className="w-3 h-3 shrink-0" />
            Failed
          </span>
        );
      case 'cancelled':
      case 'rejected':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9.5px] font-mono-numbers font-bold uppercase tracking-wide bg-slate-500/15 text-slate-400 border border-slate-500/30 whitespace-nowrap">
            <Ban className="w-3 h-3 shrink-0" />
            Cancelled
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9.5px] font-mono-numbers font-bold uppercase tracking-wide bg-amber-500/15 text-amber-400 border border-amber-500/30 whitespace-nowrap">
            <Clock className="w-3 h-3 shrink-0" />
            Pending Approval
          </span>
        );
    }
  };

  const renderTypeBadge = (p: any) => {
    if (p.payoutType === 'monthly_leaderboard') {
      return (
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-purple-500/15 text-purple-300 border border-purple-500/30 text-[9.5px] font-mono-numbers font-bold uppercase whitespace-nowrap">
          <Megaphone className="w-2.5 h-2.5 shrink-0" />
          Leaderboard
        </span>
      );
    }
    if (p.payoutType === 'manual_grant') {
      return (
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 text-[9.5px] font-mono-numbers font-bold uppercase whitespace-nowrap">
          <PlusCircle className="w-2.5 h-2.5 shrink-0" />
          Manual Grant
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-amber-500/15 text-amber-300 border border-amber-500/30 text-[9.5px] font-mono-numbers font-bold uppercase whitespace-nowrap">
        <Ticket className="w-2.5 h-2.5 shrink-0" />
        4D Lottery
      </span>
    );
  };

  return (
    <div className="space-y-5 animate-in fade-in duration-150">
      {/* Header Banner */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 bg-[#0d1117] p-4 sm:p-5 rounded-2xl border border-[#272a31]">
        <div className="space-y-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Trophy className="w-5 h-5 text-amber-400 shrink-0" />
            <h3 className="font-display font-extrabold text-base sm:text-lg text-white">
              Winner Payouts &amp; Monthly Leaderboard Settlement (Add USDT)
            </h3>
          </div>
          <p className="text-xs text-[#9b8f7c] leading-relaxed">
            Inspect verified ticket pools, review Monthly Leaderboard Top-10 rewards, validate amounts, and execute atomic wallet credits with audit logging.
          </p>
        </div>

        <button
          type="button"
          onClick={handleRefresh}
          disabled={refreshing}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#111827] border border-[#272a31] hover:border-amber-500/40 text-xs font-bold text-amber-300 transition-colors cursor-pointer disabled:opacity-50 shrink-0"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          Sync Queue
        </button>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 sm:gap-4">
        <div className="bg-[#0d1117] border border-[#272a31] rounded-2xl p-4 flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-emerald-950/40 border border-[#05d5aa]/30 flex items-center justify-center shrink-0">
            <Award className="w-5 h-5 text-[#05d5aa]" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] text-[#8b92a2] font-semibold">Total Disbursed &amp; Settled</p>
            <p className="text-lg sm:text-xl font-mono-numbers font-black text-white truncate">
              +{metrics.completedUsdt.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}{' '}
              <span className="text-xs text-[#05d5aa]">USDT</span>
            </p>
            <p className="text-[10px] text-[#05d5aa] font-mono-numbers">
              {metrics.completedCount} Completed Payouts
            </p>
          </div>
        </div>

        <div className="bg-gradient-to-br from-[#0d1117] to-amber-950/20 border border-amber-500/30 rounded-2xl p-4 flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center shrink-0">
            <Clock className="w-5 h-5 text-amber-400" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] text-amber-300 font-semibold">Awaiting Admin Approval</p>
            <p className="text-lg sm:text-xl font-mono-numbers font-black text-amber-400 truncate">
              {metrics.pendingUsdt.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}{' '}
              <span className="text-xs text-amber-300">USDT</span>
            </p>
            <p className="text-[10px] text-amber-400 font-bold font-mono-numbers">
              {metrics.pendingCount} Pending{metrics.failedCount > 0 ? ` · ${metrics.failedCount} Failed` : ''}
            </p>
          </div>
        </div>

        <div className="bg-[#0d1117] border border-purple-500/30 rounded-2xl p-4 flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-purple-950/40 border border-purple-500/30 flex items-center justify-center shrink-0">
            <Megaphone className="w-5 h-5 text-purple-300" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] text-purple-200 font-semibold">Monthly Leaderboard Queue</p>
            <p className="text-lg sm:text-xl font-mono-numbers font-black text-white truncate">
              {metrics.monthlyPendingUsdt.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}{' '}
              <span className="text-xs text-purple-300">USDT</span>
            </p>
            <p className="text-[10px] text-purple-300 font-mono-numbers">
              {metrics.monthlyPendingCount} Leaderboard Rewards Pending (Super Admin)
            </p>
          </div>
        </div>
      </div>

      {/* Direct Winner Add USDT Form */}
      <div className="bg-[#0d1117] border border-amber-500/20 rounded-2xl p-4 sm:p-5 shadow-lg space-y-4">
        <div className="flex items-center gap-2.5 pb-3 border-b border-[#1f2737]">
          <PlusCircle className="w-5 h-5 text-amber-400 shrink-0" />
          <div className="min-w-0">
            <h4 className="font-display font-bold text-sm text-white">
              Winner Add USDT (Direct Manual Grant)
            </h4>
            <p className="text-[11px] text-[#9b8f7c]">
              Credit verified bonus USDT to an existing player via atomic ledger RPC.
            </p>
          </div>
        </div>

        <form onSubmit={handleManualCreditSubmit} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 items-end">
          <div>
            <label className="block text-xs text-[#8b92a2] font-semibold mb-1">
              Recipient @Username / Address
            </label>
            <input
              type="text"
              list="winner-users-datalist"
              value={manualWinnerUser}
              onChange={(e) => setManualWinnerUser(e.target.value)}
              placeholder="e.g. @Nikhil or TRC-20 address"
              className="w-full bg-[#07090d] border border-[#272a31] focus:border-amber-400 rounded-xl px-3 py-2 text-xs text-white outline-none"
              required
            />
            <datalist id="winner-users-datalist">
              {usersList.map((u: any) => (
                <option key={u.id} value={`@${u.username || u.email?.split('@')[0]}`}>
                  {u.email}
                </option>
              ))}
            </datalist>
          </div>

          <div>
            <label className="block text-xs text-[#8b92a2] font-semibold mb-1">
              USDT Amount
            </label>
            <div className="relative">
              <input
                type="number"
                step="0.01"
                min="0.01"
                value={manualWinnerAmount}
                onChange={(e) => setManualWinnerAmount(e.target.value)}
                placeholder="e.g. 50.00"
                className="w-full bg-[#07090d] border border-[#272a31] focus:border-amber-400 rounded-xl pl-3 pr-14 py-2 text-xs text-white font-mono-numbers font-bold outline-none"
                required
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-amber-400 font-bold">
                USDT
              </span>
            </div>
          </div>

          <div>
            <label className="block text-xs text-[#8b92a2] font-semibold mb-1">
              Reason / Audit Note
            </label>
            <input
              type="text"
              value={manualWinnerNote}
              onChange={(e) => setManualWinnerNote(e.target.value)}
              placeholder="e.g. Special Tournament Bonus"
              className="w-full bg-[#07090d] border border-[#272a31] focus:border-amber-400 rounded-xl px-3 py-2 text-xs text-white outline-none"
            />
          </div>

          <button
            type="submit"
            disabled={submittingManual}
            className="w-full py-2.5 px-4 rounded-xl btn-gold text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer shadow-md disabled:opacity-50"
          >
            {submittingManual ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
            <span>{submittingManual ? 'Crediting...' : '+ Disburse USDT to Wallet'}</span>
          </button>
        </form>
      </div>

      {/* Category & Status Filters + Search */}
      <div className="bg-[#0d1117] border border-[#272a31] rounded-2xl p-4 space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Separate Category Tabs */}
          <div className="flex flex-wrap items-center gap-1.5 bg-[#07090d] p-1 rounded-xl border border-[#1f2737]">
            {(
              [
                ['all', `All (${categoryCounts.all})`],
                ['lottery_win', `4-Digit Lottery (${categoryCounts.lottery_win})`],
                ['monthly_leaderboard', `Monthly Leaderboard (${categoryCounts.monthly_leaderboard})`],
                ['manual_grant', `Manual Grants (${categoryCounts.manual_grant})`]
              ] as Array<[PayoutCategoryFilter, string]>
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setCategoryFilter(id)}
                className={`px-2.5 sm:px-3 py-1.5 rounded-lg text-[11px] font-bold transition-colors cursor-pointer whitespace-nowrap ${
                  categoryFilter === id
                    ? 'bg-amber-500 text-black'
                    : 'text-[#8b92a2] hover:text-white'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Search Box */}
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search ID, @username, wallet, month..."
            className="w-full lg:w-64 bg-[#07090d] border border-[#272a31] focus:border-amber-400 rounded-xl px-3 py-2 text-xs text-white placeholder-[#64748b] outline-none"
          />
        </div>

        {/* Status Filter Bar */}
        <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-[#1f2737]">
          <span className="text-[10px] font-mono-numbers uppercase tracking-wider text-[#64748b] mr-1">
            Status:
          </span>
          {(
            [
              ['all', 'All'],
              ['pending_approval', 'Pending Approval'],
              ['processing', 'Processing'],
              ['completed', 'Completed'],
              ['failed', 'Failed'],
              ['cancelled', 'Cancelled']
            ] as Array<[PayoutStatusFilter, string]>
          ).map(([st, label]) => (
            <button
              key={st}
              type="button"
              onClick={() => setStatusFilter(st)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer whitespace-nowrap border ${
                statusFilter === st
                  ? 'bg-[#1f2737] text-amber-300 border-amber-500/40'
                  : 'bg-transparent text-[#8b92a2] border-transparent hover:text-white'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Payout Queue — Empty State */}
      {filteredPayouts.length === 0 ? (
        <div className="bg-[#0d1117] border border-[#272a31] rounded-2xl py-12 px-4 text-center text-[#64748b]">
          <Trophy className="w-8 h-8 text-[#272a31] mx-auto mb-2" />
          <p className="text-xs font-semibold text-[#94A3B8]">
            No payout records match the current filter criteria.
          </p>
        </div>
      ) : (
        <>
          {/* MOBILE PAYOUT CARDS (< 768px — tested cleanly at 320px/375px/425px/568px) */}
          <div className="md:hidden space-y-3" data-testid="winner-payouts-mobile-list">
            {filteredPayouts.map((p: any) => {
              const canAct = p.status === 'pending_approval' || p.status === 'failed';
              const isCompleted = p.status === 'completed' || p.status === 'paid';
              const isBusy = processingPayoutId === p.id;
              const { rawVal, error: valError, isZeroSalesLottery, isManuallyChanged } = getEditedValidation(p);

              return (
                <div
                  key={p.id}
                  data-testid={`payout-card-${p.id}`}
                  className="bg-[#0d1117] border border-[#272a31] rounded-2xl p-3.5 space-y-3 shadow-md"
                >
                  {/* Card Top Header */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        {renderTypeBadge(p)}
                        {p.payoutType === 'monthly_leaderboard' && p.leaderboardRank && (
                          <span className="px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30 font-mono-numbers font-bold text-[10px]">
                            Rank #{p.leaderboardRank}
                          </span>
                        )}
                      </div>
                      <p className="text-xs font-bold text-white truncate">
                        {p.payoutType === 'monthly_leaderboard'
                          ? `${formatMonthLabel(p.competitionMonth)}`
                          : p.eventTitle || 'Lottery Payout'}
                      </p>
                      <div className="flex items-center gap-1.5 text-[10px] font-mono-numbers text-[#8b92a2]">
                        <span className="truncate" title={p.id}>
                          ID: {shortHash(p.id, 10, 6)}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleCopy(p.id, `m-id-${p.id}`)}
                          className="p-0.5 text-[#8b92a2] hover:text-white cursor-pointer shrink-0"
                          title="Copy Payout ID"
                        >
                          {copiedKey === `m-id-${p.id}` ? <Check className="w-3 h-3 text-[#05d5aa]" /> : <Copy className="w-3 h-3" />}
                        </button>
                      </div>
                    </div>

                    <div className="shrink-0">{renderStatusBadge(p.status)}</div>
                  </div>

                  {/* Recipient & Pool Grid */}
                  <div className="grid grid-cols-1 gap-2 p-2.5 rounded-xl bg-[#07090d] border border-[#1f2737] text-[11px]">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[#64748b] shrink-0">Recipient</span>
                      <span className="font-bold text-white truncate">
                        @{String(p.winnerUsername || 'Player').replace(/^@+/, '')}
                      </span>
                    </div>

                    {p.userId && (
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[#64748b] shrink-0">User ID</span>
                        <button
                          type="button"
                          onClick={() => handleCopy(p.userId, `m-uid-${p.id}`)}
                          className="inline-flex items-center gap-1 font-mono-numbers text-[#94A3B8] hover:text-white cursor-pointer"
                        >
                          <span>{shortHash(p.userId, 6, 4)}</span>
                          {copiedKey === `m-uid-${p.id}` ? <Check className="w-3 h-3 text-[#05d5aa]" /> : <Copy className="w-3 h-3" />}
                        </button>
                      </div>
                    )}

                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[#64748b] shrink-0">Wallet</span>
                      <button
                        type="button"
                        onClick={() => handleCopy(p.winnerAddress, `m-addr-${p.id}`)}
                        className="inline-flex items-center gap-1 font-mono-numbers text-amber-300/90 hover:text-white cursor-pointer"
                      >
                        <span>{shortHash(p.winnerAddress, 6, 4)}</span>
                        {copiedKey === `m-addr-${p.id}` ? <Check className="w-3 h-3 text-[#05d5aa]" /> : <Copy className="w-3 h-3" />}
                      </button>
                    </div>

                    {p.payoutType === 'lottery_win' && (
                      <div className="flex items-center justify-between gap-2 pt-1 border-t border-[#1f2737]">
                        <span className="text-[#64748b]">Pool Audit</span>
                        <span className="font-mono-numbers text-white text-right">
                          {p.ticketsSold} tkts · Pool {Number(p.totalPoolCollected || 0).toFixed(2)} USDT ({p.winnerSharePercent}%)
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Failure / Cancel Notice */}
                  {p.status === 'failed' && p.failureReason && (
                    <div className="p-2.5 rounded-xl bg-red-500/10 border border-red-500/30 text-[11px] text-red-300 break-words">
                      <span className="font-bold">Failure Reason:</span> {p.failureReason}
                    </div>
                  )}
                  {p.status === 'cancelled' && p.cancellationReason && (
                    <div className="p-2.5 rounded-xl bg-slate-500/10 border border-slate-500/30 text-[11px] text-slate-300 break-words">
                      <span className="font-bold">Cancellation Note:</span> {p.cancellationReason}
                    </div>
                  )}

                  {/* Disbursal Amount & Controls */}
                  <div className="space-y-2">
                    {canAct ? (
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-[10px] text-[#8b92a2] font-mono-numbers">
                          <span>Disbursal Amount (USDT)</span>
                          <span>
                            Calc: {Number(p.calculatedAmount || 0).toFixed(2)}
                            {p.maxAllowedAmount ? ` · Cap: ${Number(p.maxAllowedAmount).toFixed(2)}` : ''}
                          </span>
                        </div>
                        <div className="relative">
                          <input
                            type="number"
                            step="0.01"
                            min="0.01"
                            disabled={isBusy || isZeroSalesLottery}
                            value={rawVal}
                            onChange={(e) =>
                              setEditedPayoutAmounts((prev) => ({ ...prev, [p.id]: e.target.value }))
                            }
                            aria-label={`Disbursal USDT for ${p.id}`}
                            className={`w-full bg-[#07090d] border rounded-xl pl-3 pr-14 py-2 text-xs font-mono-numbers font-bold text-white outline-none ${
                              valError ? 'border-red-500/70' : 'border-amber-500/50 focus:border-amber-400'
                            }`}
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-amber-400">
                            USDT
                          </span>
                        </div>
                        {isManuallyChanged && !valError && (
                          <input
                            type="text"
                            value={adjustmentReasons[p.id] || ''}
                            onChange={(e) =>
                              setAdjustmentReasons((prev) => ({ ...prev, [p.id]: e.target.value }))
                            }
                            placeholder="Optional manual adjustment reason (audited)"
                            className="w-full bg-[#07090d] border border-[#272a31] rounded-lg px-2.5 py-1.5 text-[11px] text-white outline-none"
                          />
                        )}
                        {valError && <p className="text-[10px] text-red-400 font-semibold">{valError}</p>}
                      </div>
                    ) : (
                      <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-[#07090d] border border-[#1f2737]">
                        <span className="text-[11px] text-[#8b92a2]">Final Reward</span>
                        <span className="font-mono-numbers font-black text-sm text-[#05d5aa]">
                          +{Number(p.payoutAmount || 0).toFixed(2)} USDT
                        </span>
                      </div>
                    )}

                    {/* Dedicated Non-Overlapping Action Bar */}
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      {canAct ? (
                        <>
                          <button
                            type="button"
                            onClick={() => handleApproveClick(p)}
                            disabled={isBusy || Boolean(valError)}
                            className="flex-1 min-w-[140px] py-2 px-3 rounded-xl btn-gold text-xs font-extrabold flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed"
                          >
                            {isBusy ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : p.status === 'failed' ? (
                              <RotateCcw className="w-3.5 h-3.5" />
                            ) : (
                              <CheckCircle className="w-3.5 h-3.5" />
                            )}
                            <span>
                              {isBusy
                                ? 'Crediting...'
                                : p.status === 'failed'
                                ? 'Retry Credit'
                                : 'Approve & Add (Done)'}
                            </span>
                          </button>

                          <button
                            type="button"
                            onClick={() => setCancelTarget({ payout: p, mode: 'cancel' })}
                            disabled={isBusy}
                            className="p-2 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-300 cursor-pointer disabled:opacity-40"
                            title="Cancel Payout"
                          >
                            <XCircle className="w-4 h-4" />
                          </button>

                          <button
                            type="button"
                            onClick={() => setCancelTarget({ payout: p, mode: 'delete' })}
                            disabled={isBusy}
                            className="p-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 cursor-pointer disabled:opacity-40"
                            title="Archive / Soft-Delete Payout"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </>
                      ) : isCompleted ? (
                        <div className="w-full flex items-center justify-between text-[10px] font-mono-numbers text-emerald-300/90 px-2 py-1">
                          <span className="inline-flex items-center gap-1">
                            <Lock className="w-3 h-3" /> Settled &amp; Audit Locked
                          </span>
                          {p.txHash && (
                            <button
                              type="button"
                              onClick={() => handleCopy(p.txHash, `m-tx-${p.id}`)}
                              className="inline-flex items-center gap-1 text-[#8b92a2] hover:text-white cursor-pointer"
                            >
                              Tx: {shortHash(p.txHash, 6, 4)}
                              {copiedKey === `m-tx-${p.id}` ? <Check className="w-3 h-3 text-[#05d5aa]" /> : <Copy className="w-3 h-3" />}
                            </button>
                          )}
                        </div>
                      ) : (
                        <span className="text-[11px] text-[#64748b] font-mono-numbers">
                          Archived / Cancelled
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* DESKTOP & TABLET ALIGNED TABLE (>= 768px) */}
          <div className="hidden md:block bg-[#0d1117] border border-[#272a31] rounded-2xl overflow-hidden shadow-lg">
            <div
              data-testid="winner-payouts-table-scroll"
              className="max-h-[600px] overflow-y-auto overflow-x-auto ef-subtle-scroll overscroll-contain"
            >
              <table className="w-full min-w-[720px] text-left text-xs">
                <thead className="sticky top-0 z-10 bg-[#07090d]/95 backdrop-blur-md text-[#8b92a2] uppercase text-[9.5px] font-mono-numbers tracking-wider shadow-[0_1px_0_0_#1f2737]">
                  <tr>
                    <th className="py-3 px-2 xl:px-3">Type · Source</th>
                    <th className="py-3 px-2 xl:px-3">Winner &amp; Wallet</th>
                    <th className="py-3 px-2 xl:px-3">Pool / Rank</th>
                    <th className="py-3 px-2 xl:px-3">Disbursal</th>
                    <th className="py-3 px-2 xl:px-3">Status</th>
                    <th className="py-3 px-2 xl:px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1f2737]">
                  {filteredPayouts.map((p: any) => {
                    const canAct = p.status === 'pending_approval' || p.status === 'failed';
                    const isCompleted = p.status === 'completed' || p.status === 'paid';
                    const isBusy = processingPayoutId === p.id;
                    const isExpanded = expandedId === p.id;
                    const { rawVal, error: valError, isZeroSalesLottery, isManuallyChanged } =
                      getEditedValidation(p);

                    return (
                      <React.Fragment key={p.id}>
                        <tr className="hover:bg-white/[0.02] transition-colors align-top">
                          {/* Type & Source */}
                          <td className="py-3 px-2 xl:px-3 space-y-1 max-w-[140px]">
                            {renderTypeBadge(p)}
                            <div className="font-semibold text-[11px] text-white truncate" title={p.eventTitle}>
                              {p.payoutType === 'monthly_leaderboard'
                                ? formatMonthLabel(p.competitionMonth)
                                : p.eventTitle || 'Lottery Draw'}
                            </div>
                            <div className="flex items-center gap-1 text-[10px] font-mono-numbers text-[#8b92a2] whitespace-nowrap">
                              <span title={p.id}>{shortHash(p.id, 6, 4)}</span>
                              <button
                                type="button"
                                onClick={() => handleCopy(p.id, `d-id-${p.id}`)}
                                className="p-0.5 hover:text-white cursor-pointer shrink-0"
                                title="Copy Payout ID"
                              >
                                {copiedKey === `d-id-${p.id}` ? <Check className="w-3 h-3 text-[#05d5aa]" /> : <Copy className="w-3 h-3" />}
                              </button>
                            </div>
                          </td>

                          {/* Winner Details */}
                          <td className="py-3 px-2 xl:px-3 space-y-1 max-w-[135px]">
                            <div
                              className="font-bold text-[11px] text-white truncate"
                              title={p.winnerUsername}
                            >
                              @{String(p.winnerUsername || 'Player').replace(/^@+/, '')}
                            </div>
                            {p.userId && (
                              <div className="flex items-center gap-1 text-[10px] font-mono-numbers text-[#8b92a2] whitespace-nowrap">
                                <span title={p.userId}>UID: {shortHash(p.userId, 4, 3)}</span>
                                <button
                                  type="button"
                                  onClick={() => handleCopy(p.userId, `d-uid-${p.id}`)}
                                  className="p-0.5 hover:text-white cursor-pointer shrink-0"
                                  title="Copy User ID"
                                >
                                  {copiedKey === `d-uid-${p.id}` ? <Check className="w-3 h-3 text-[#05d5aa]" /> : <Copy className="w-3 h-3" />}
                                </button>
                              </div>
                            )}
                            <div className="flex items-center gap-1 text-[10px] font-mono-numbers text-amber-300/90 whitespace-nowrap">
                              <span title={p.winnerAddress}>{shortHash(p.winnerAddress, 5, 4)}</span>
                              {p.winnerAddress && (
                                <button
                                  type="button"
                                  onClick={() => handleCopy(p.winnerAddress, `d-addr-${p.id}`)}
                                  className="p-0.5 hover:text-white cursor-pointer shrink-0"
                                  title="Copy Wallet Address"
                                >
                                  {copiedKey === `d-addr-${p.id}` ? <Check className="w-3 h-3 text-[#05d5aa]" /> : <Copy className="w-3 h-3" />}
                                </button>
                              )}
                            </div>
                          </td>

                          {/* Pool / Competition */}
                          <td className="py-3 px-2 xl:px-3 space-y-1 max-w-[135px]">
                            {p.payoutType === 'monthly_leaderboard' ? (
                              <>
                                <div className="inline-flex items-center px-1.5 py-0.5 rounded bg-amber-500/15 border border-amber-500/35 text-amber-300 font-mono-numbers font-black text-[11px] whitespace-nowrap">
                                  Rank #{p.leaderboardRank || p.position || 1}
                                </div>
                                <div className="text-[10px] text-[#94A3B8] whitespace-nowrap">
                                  {p.competitionMonth || '—'}
                                </div>
                              </>
                            ) : p.payoutType === 'manual_grant' ? (
                              <div className="text-[10px] text-cyan-300 font-semibold whitespace-nowrap">Direct Award</div>
                            ) : (
                              <>
                                <div className="flex items-center gap-1 whitespace-nowrap">
                                  <span className="px-1.5 py-0.5 rounded bg-[#07090d] border border-amber-500/40 text-amber-400 font-mono-numbers font-black text-[10px] tracking-wider">
                                    {p.winningDigits || '—'}
                                  </span>
                                  <span className="text-[10px] text-white font-mono-numbers">
                                    {p.ticketsSold || 0} tkts
                                  </span>
                                </div>
                                <div className="text-[10px] text-[#8b92a2] font-mono-numbers leading-tight">
                                  Pool ${Number(p.totalPoolCollected || 0).toFixed(0)} · {p.winnerSharePercent}%
                                </div>
                              </>
                            )}
                            <button
                              type="button"
                              onClick={() => setExpandedId(isExpanded ? null : p.id)}
                              className="inline-flex items-center gap-0.5 text-[10px] text-[#8b92a2] hover:text-amber-300 cursor-pointer whitespace-nowrap"
                            >
                              {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                              Details
                            </button>
                          </td>

                          {/* Disbursal Amount */}
                          <td className="py-3 px-2 xl:px-3">
                            {canAct ? (
                              <div className="space-y-1">
                                <div className="flex items-center gap-1">
                                  <input
                                    type="number"
                                    step="0.01"
                                    min="0.01"
                                    disabled={isBusy || isZeroSalesLottery}
                                    value={rawVal}
                                    onChange={(e) =>
                                      setEditedPayoutAmounts((prev) => ({
                                        ...prev,
                                        [p.id]: e.target.value
                                      }))
                                    }
                                    aria-label={`Disbursal USDT for ${p.id}`}
                                    className={`w-20 bg-[#07090d] border rounded-lg px-1.5 py-1 text-xs text-white font-mono-numbers font-bold outline-none ${
                                      valError ? 'border-red-500/70' : 'border-amber-500/50 focus:border-[#ffd700]'
                                    }`}
                                  />
                                  <span className="text-[9.5px] font-bold text-amber-400 whitespace-nowrap">USDT</span>
                                </div>
                                <div className="text-[9.5px] font-mono-numbers text-[#8b92a2] leading-tight">
                                  Calc: {Number(p.calculatedAmount || 0).toFixed(2)}
                                  {p.maxAllowedAmount ? ` / Max: ${Number(p.maxAllowedAmount).toFixed(2)}` : ''}
                                </div>
                                {isManuallyChanged && !valError && (
                                  <input
                                    type="text"
                                    value={adjustmentReasons[p.id] || ''}
                                    onChange={(e) =>
                                      setAdjustmentReasons((prev) => ({ ...prev, [p.id]: e.target.value }))
                                    }
                                    placeholder="Adjustment note"
                                    className="w-full max-w-[125px] bg-[#07090d] border border-[#272a31] rounded px-1.5 py-0.5 text-[10px] text-white outline-none"
                                  />
                                )}
                                {valError && (
                                  <div className="text-[9.5px] text-red-400 font-semibold leading-tight max-w-[130px]">
                                    {valError}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <div className="space-y-0.5">
                                <div className="font-mono-numbers font-black text-xs text-[#05d5aa] whitespace-nowrap">
                                  +{Number(p.payoutAmount || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDT
                                </div>
                                {p.txHash && (
                                  <button
                                    type="button"
                                    onClick={() => handleCopy(p.txHash, `d-tx-${p.id}`)}
                                    className="inline-flex items-center gap-1 text-[9.5px] font-mono-numbers text-[#64748b] hover:text-white cursor-pointer whitespace-nowrap"
                                    title={p.txHash}
                                  >
                                    <span>Tx: {shortHash(p.txHash, 4, 4)}</span>
                                    {copiedKey === `d-tx-${p.id}` ? <Check className="w-3 h-3 text-[#05d5aa]" /> : <Copy className="w-3 h-3" />}
                                  </button>
                                )}
                              </div>
                            )}
                          </td>

                          {/* Status */}
                          <td className="py-3 px-2 xl:px-3 space-y-1">
                            {renderStatusBadge(p.status)}
                            {p.status === 'failed' && p.failureReason && (
                              <div className="text-[9.5px] text-red-300/90 max-w-[110px] truncate" title={p.failureReason}>
                                {p.failureReason}
                              </div>
                            )}
                          </td>

                          {/* Non-Overlapping Row Actions */}
                          <td className="py-3 px-2 xl:px-3 text-right">
                            {canAct ? (
                              <div className="inline-flex items-center justify-end gap-1">
                                <button
                                  type="button"
                                  onClick={() => handleApproveClick(p)}
                                  disabled={isBusy || Boolean(valError)}
                                  className="px-2 py-1.5 rounded-lg btn-gold text-[10px] font-extrabold inline-flex items-center gap-1 cursor-pointer shadow-md whitespace-nowrap disabled:opacity-45 disabled:cursor-not-allowed"
                                  title="Validate & atomically credit USDT to winner wallet"
                                >
                                  {isBusy ? (
                                    <Loader2 className="w-3 h-3 animate-spin" />
                                  ) : p.status === 'failed' ? (
                                    <RotateCcw className="w-3 h-3" />
                                  ) : (
                                    <CheckCircle className="w-3 h-3" />
                                  )}
                                  <span>
                                    {isBusy
                                      ? 'Crediting...'
                                      : p.status === 'failed'
                                      ? 'Retry'
                                      : 'Approve & Add (Done)'}
                                  </span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => setCancelTarget({ payout: p, mode: 'cancel' })}
                                  disabled={isBusy}
                                  className="p-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-300 cursor-pointer shrink-0 disabled:opacity-40"
                                  title="Cancel Payout"
                                >
                                  <XCircle className="w-3.5 h-3.5" />
                                </button>

                                <button
                                  type="button"
                                  onClick={() => setCancelTarget({ payout: p, mode: 'delete' })}
                                  disabled={isBusy}
                                  className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 cursor-pointer shrink-0 disabled:opacity-40"
                                  title="Soft-Delete / Archive Payout"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ) : isCompleted ? (
                              <span
                                className="inline-flex items-center gap-1 text-[9.5px] font-mono-numbers text-emerald-300/80 px-2 py-1 rounded-lg bg-emerald-950/30 border border-emerald-500/20 whitespace-nowrap"
                                title="Completed payouts are immutable financial audit records"
                              >
                                <Lock className="w-3 h-3" /> Audit Protected
                              </span>
                            ) : (
                              <span className="text-[10px] font-mono-numbers text-[#64748b] whitespace-nowrap">
                                Cancelled
                              </span>
                            )}
                          </td>
                        </tr>

                        {/* Expandable Audit Detail Drawer */}
                        {isExpanded && (
                          <tr className="bg-[#07090d]/70">
                            <td colSpan={6} className="px-4 py-3 text-[11px] font-mono-numbers text-[#94A3B8]">
                              <div className="flex flex-wrap gap-x-6 gap-y-1.5">
                                <span>
                                  <strong className="text-white">Reference:</strong> {p.payoutReference || p.id}
                                </span>
                                {p.ticketId && (
                                  <span>
                                    <strong className="text-white">Ticket / Slot:</strong> {p.ticketId}
                                  </span>
                                )}
                                {p.approvedAt && (
                                  <span>
                                    <strong className="text-white">Settled At:</strong>{' '}
                                    {new Date(p.approvedAt).toLocaleString()}
                                  </span>
                                )}
                                {p.manualAdjustmentReason && (
                                  <span className="text-amber-300">
                                    <strong>Adjustment Audit:</strong> {p.manualAdjustmentReason}
                                  </span>
                                )}
                                {p.failureReason && (
                                  <span className="text-red-400">
                                    <strong>Failure Reason:</strong> {p.failureReason}
                                  </span>
                                )}
                                {p.cancellationReason && (
                                  <span className="text-slate-300">
                                    <strong>Cancellation Note:</strong> {p.cancellationReason}
                                  </span>
                                )}
                                {p.notes && (
                                  <span>
                                    <strong className="text-white">Notes:</strong> {p.notes}
                                  </span>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Confirmation Dialog for Soft-Delete / Cancel */}
      {cancelTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md rounded-2xl bg-[#0d1117] border border-red-500/35 p-5 space-y-4 shadow-2xl">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-500/15 border border-red-500/30 flex items-center justify-center shrink-0">
                <ShieldCheck className="w-5 h-5 text-red-400" />
              </div>
              <div className="min-w-0">
                <h4 className="font-display font-bold text-base text-white">
                  {cancelTarget.mode === 'delete' ? 'Archive & Remove Payout?' : 'Cancel Pending Payout?'}
                </h4>
                <p className="text-xs text-[#94A3B8] mt-1 leading-relaxed">
                  {cancelTarget.mode === 'delete'
                    ? 'This will mark the pending payout as cancelled and archive it from the active queue while preserving the immutable financial audit trail.'
                    : 'This will cancel the payout so it cannot be credited. Financial audit history will remain preserved.'}
                </p>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-[#07090d] border border-[#1f2737] text-xs space-y-1 font-mono-numbers">
              <div className="flex justify-between gap-2">
                <span className="text-[#64748b]">Payout ID</span>
                <span className="text-white truncate">{cancelTarget.payout.id}</span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-[#64748b]">Recipient</span>
                <span className="text-amber-300">@{String(cancelTarget.payout.winnerUsername || 'Player').replace(/^@+/, '')}</span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-[#64748b]">Amount</span>
                <span className="text-white font-bold">{Number(cancelTarget.payout.payoutAmount || 0).toFixed(2)} USDT</span>
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-mono-numbers uppercase tracking-wider text-[#8b92a2] mb-1.5">
                Audit Reason (Optional)
              </label>
              <input
                type="text"
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="e.g. Duplicate entry or ineligible account"
                className="w-full px-3 py-2 rounded-xl bg-[#07090d] border border-[#272a31] focus:border-red-500/60 text-xs text-white outline-none"
              />
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => {
                  setCancelTarget(null);
                  setCancelReason('');
                }}
                disabled={confirmingCancel}
                className="px-4 py-2 rounded-xl bg-[#111827] border border-[#272a31] text-xs font-bold text-white hover:border-[#3b4252] cursor-pointer"
              >
                Keep Payout
              </button>
              <button
                type="button"
                onClick={handleConfirmCancelOrDelete}
                disabled={confirmingCancel}
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-xs font-bold text-white inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {confirmingCancel && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                {cancelTarget.mode === 'delete' ? 'Confirm Archive & Remove' : 'Confirm Cancel'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
