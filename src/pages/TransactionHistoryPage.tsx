import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowDownLeft,
  ArrowLeft,
  ArrowUpRight,
  Check,
  Clock,
  Copy,
  ExternalLink,
  Eye,
  EyeOff,
  History,
  Lock,
  RefreshCw,
  Search,
  Sparkles,
  Wallet,
  X,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { useLottery } from '../context/LotteryContext';
import WithdrawalProofModal from '../components/WithdrawalProofModal';
import {
  formatCompactTxId,
  formatTransactionStatusMeta,
  formatTransactionTimestamp,
  formatTransactionTypeLabel,
  getTransactionTypeMeta,
} from '../utils/transactionFormatters';

export { formatTransactionTypeLabel, getTransactionTypeMeta };

interface TransactionHistoryPageProps {
  onBackToWallet?: () => void;
  onBackToHome?: () => void;
}

type HistoryTab = 'all' | 'deposits' | 'withdrawals';
type DepositFilter = 'all' | 'completed' | 'waiting' | 'expired';

const PAGE_SIZE = 12;

interface TxIdBadgeProps {
  txId: string;
  compactChars?: number;
  expanded: boolean;
  onToggleExpand: () => void;
  copied: boolean;
  onCopy: () => void;
}

function TxIdControl({
  txId,
  compactChars = 6,
  expanded,
  onToggleExpand,
  copied,
  onCopy,
}: TxIdBadgeProps) {
  const cleanId = String(txId || '').trim();
  const isTruncated = cleanId.length > compactChars + 7;

  return (
    <div className="inline-flex items-center gap-1.5 min-w-0 max-w-full">
      <span
        className="font-mono text-xs text-slate-200 bg-slate-900/90 border border-white/10 rounded-lg px-2 py-1 tracking-tight truncate max-w-[140px] sm:max-w-[165px]"
        title={cleanId}
      >
        {formatCompactTxId(cleanId, compactChars, 4)}
      </span>
      <button
        type="button"
        onClick={onCopy}
        aria-label={copied ? 'Copied TX ID' : 'Copy full TX ID'}
        title={copied ? 'Copied!' : 'Copy full TX ID'}
        className={`inline-flex items-center justify-center h-7 w-7 rounded-lg border transition-colors shrink-0 ${
          copied
            ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
            : 'bg-slate-900/80 border-white/10 text-slate-400 hover:text-white hover:border-white/25'
        }`}
      >
        {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
      </button>
      {isTruncated && (
        <button
          type="button"
          onClick={onToggleExpand}
          aria-label={expanded ? 'Hide full TX ID' : 'View full TX ID'}
          title={expanded ? 'Hide full TX ID' : 'View full TX ID'}
          className={`inline-flex items-center justify-center h-7 w-7 rounded-lg border transition-colors shrink-0 ${
            expanded
              ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
              : 'bg-slate-900/80 border-white/10 text-slate-400 hover:text-white hover:border-white/25'
          }`}
        >
          {expanded ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
        </button>
      )}
    </div>
  );
}

export default function TransactionHistoryPage({
  onBackToWallet,
  onBackToHome,
}: TransactionHistoryPageProps) {
  const {
    wallet,
    user,
    setIsAuthModalOpen,
    withdrawals = [],
    deposits = [],
    loadingDeposits,
    fetchDeposits,
    cancelDeposit,
    walletLedger = [],
    loadingLedger,
    fetchWalletLedger,
    fetchWithdrawals,
    setActiveTab,
  } = useLottery();

  const [activeSubTab, setActiveSubTab] = useState<HistoryTab>('all');
  const [depositFilter, setDepositFilter] = useState<DepositFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedProofOrder, setSelectedProofOrder] = useState<any | null>(null);
  const [copiedIdKey, setCopiedIdKey] = useState<string | null>(null);
  const [expandedIdKeys, setExpandedIdKeys] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const timer = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const handleRefresh = async () => {
    if (isRefreshing || !user) return;
    setIsRefreshing(true);
    try {
      await Promise.all([
        fetchWalletLedger?.(),
        fetchDeposits?.(),
        fetchWithdrawals?.(),
      ]);
    } finally {
      setTimeout(() => setIsRefreshing(false), 350);
    }
  };

  const handleBack = () => {
    if (onBackToWallet) {
      onBackToWallet();
      return;
    }
    if (onBackToHome) {
      onBackToHome();
      return;
    }
    setActiveTab?.('wallet');
  };

  const handleCopyTxId = async (rowKey: string, txId: string) => {
    const clean = String(txId || '').trim();
    if (!clean) return;
    try {
      await navigator.clipboard.writeText(clean);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = clean;
      textarea.setAttribute('readonly', '');
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      try {
        document.execCommand('copy');
      } finally {
        document.body.removeChild(textarea);
      }
    }
    setCopiedIdKey(rowKey);
    setTimeout(() => {
      setCopiedIdKey((prev) => (prev === rowKey ? null : prev));
    }, 1800);
  };

  const toggleExpandId = (rowKey: string) => {
    setExpandedIdKeys((prev) => ({
      ...prev,
      [rowKey]: !prev[rowKey],
    }));
  };

  const normalizedQuery = searchQuery.trim().toLowerCase();

  // Filter All Ledger transactions using TX ID and both raw + formatted Transaction Type
  const filteredLedger = useMemo(() => {
    if (!normalizedQuery) return walletLedger;
    return walletLedger.filter((tx: any) => {
      const idStr = String(tx.id || '').toLowerCase();
      const rawType = String(tx.transaction_type || '').toLowerCase();
      const formattedType = formatTransactionTypeLabel(tx.transaction_type).toLowerCase();
      return (
        idStr.includes(normalizedQuery) ||
        rawType.includes(normalizedQuery) ||
        formattedType.includes(normalizedQuery)
      );
    });
  }, [walletLedger, normalizedQuery]);

  // Filter Deposits
  const filteredDeposits = useMemo(() => {
    return deposits.filter((dep: any) => {
      const createdAtMs = dep.created_at ? new Date(dep.created_at).getTime() : 0;
      const isTimedOut =
        dep.status === 'waiting' && createdAtMs > 0 && nowMs - createdAtMs >= 15 * 60 * 1000;
      const effectiveStatus = isTimedOut ? 'expired' : String(dep.status || '').toLowerCase();

      if (depositFilter === 'completed') {
        if (!['finished', 'confirmed', 'completed'].includes(effectiveStatus)) return false;
      } else if (depositFilter === 'waiting') {
        if (!['waiting', 'confirming', 'sending', 'partially_paid'].includes(effectiveStatus)) {
          return false;
        }
      } else if (depositFilter === 'expired') {
        if (!['expired', 'failed', 'refunded'].includes(effectiveStatus)) return false;
      }

      if (!normalizedQuery) return true;
      const txId = String(dep.invoice_id || dep.id || '').toLowerCase();
      const formattedType = formatTransactionTypeLabel('deposit').toLowerCase();
      return (
        txId.includes(normalizedQuery) ||
        formattedType.includes(normalizedQuery) ||
        'deposit'.includes(normalizedQuery)
      );
    });
  }, [deposits, depositFilter, normalizedQuery, nowMs]);

  // Filter Withdrawals
  const filteredWithdrawals = useMemo(() => {
    if (!normalizedQuery) return withdrawals;
    return withdrawals.filter((w: any) => {
      const txId = String(w.txHash || w.id || '').toLowerCase();
      const formattedType = formatTransactionTypeLabel('withdrawal').toLowerCase();
      return (
        txId.includes(normalizedQuery) ||
        formattedType.includes(normalizedQuery) ||
        'withdrawal'.includes(normalizedQuery)
      );
    });
  }, [withdrawals, normalizedQuery]);

  // Real summary stats computed solely from loaded records
  const summaryStats = useMemo(() => {
    const totalInflow = walletLedger.reduce((acc: number, tx: any) => {
      const val = Number(tx.amount || 0);
      return val > 0 ? acc + val : acc;
    }, 0);

    const activePendingDeposits = deposits.filter((dep: any) => {
      const st = String(dep.status || '').toLowerCase();
      if (!['waiting', 'confirming', 'sending'].includes(st)) return false;
      const createdAtMs = dep.created_at ? new Date(dep.created_at).getTime() : 0;
      return createdAtMs === 0 || nowMs - createdAtMs < 15 * 60 * 1000;
    }).length;

    const pendingWithdrawals = withdrawals.filter((w: any) =>
      ['pending', 'processing'].includes(String(w.status || '').toLowerCase())
    ).length;

    return {
      totalRecords: walletLedger.length,
      totalInflow,
      pendingCount: activePendingDeposits + pendingWithdrawals,
    };
  }, [walletLedger, deposits, withdrawals, nowMs]);

  // Active paginated slice for current tab
  const activeRows =
    activeSubTab === 'all'
      ? filteredLedger
      : activeSubTab === 'deposits'
      ? filteredDeposits
      : filteredWithdrawals;

  const totalPages = Math.max(1, Math.ceil(activeRows.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedRows = activeRows.slice(
    (safePage - 1) * PAGE_SIZE,
    safePage * PAGE_SIZE
  );

  if (!user) {
    return (
      <div className="w-full max-w-4xl mx-auto px-3 sm:px-6 py-8 sm:py-12 pb-24 md:pb-12">
        <div className="bg-[#0d1526]/95 border border-white/10 rounded-2xl p-6 sm:p-10 text-center space-y-5 shadow-xl">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
            <Lock className="w-7 h-7" />
          </div>
          <div className="space-y-2 max-w-md mx-auto">
            <h1 className="text-xl sm:text-2xl font-bold text-white">
              Transaction History
            </h1>
            <p className="text-sm text-slate-400 leading-relaxed">
              Sign in to view your deposits, withdrawals, lottery wins, and promotional reward history.
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3 pt-1">
            <button
              type="button"
              onClick={() => setIsAuthModalOpen(true)}
              className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm transition-colors shadow-lg shadow-amber-500/20"
            >
              Sign In to Continue
            </button>
            <button
              type="button"
              onClick={handleBack}
              className="px-5 py-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 text-slate-200 font-semibold text-sm border border-white/10 transition-colors"
            >
              Back
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      data-testid="transaction-history-page"
      className="w-full max-w-6xl mx-auto px-3 sm:px-4 xl:px-8 py-4 sm:py-6 pb-24 md:pb-10 space-y-4 sm:space-y-6"
    >
      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-start sm:items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={handleBack}
            aria-label="Back to Wallet"
            className="mt-0.5 sm:mt-0 inline-flex items-center justify-center h-9 w-9 sm:h-10 sm:w-10 rounded-xl bg-[#10192b] border border-white/10 text-slate-300 hover:text-white hover:border-amber-500/40 transition-colors shrink-0"
          >
            <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
          <div className="min-w-0">
            <h1 className="text-lg sm:text-2xl lg:text-3xl font-extrabold text-white tracking-tight truncate">
              Transaction History
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 truncate">
              Your complete record of deposits, withdrawals, game wins, and rewards
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleRefresh}
          disabled={isRefreshing || loadingLedger || loadingDeposits}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#10192b] border border-white/10 text-xs sm:text-sm font-semibold text-slate-200 hover:text-white hover:border-amber-500/40 transition-colors disabled:opacity-60 shrink-0"
        >
          <RefreshCw
            className={`w-3.5 h-3.5 text-amber-400 ${
              isRefreshing || loadingLedger || loadingDeposits ? 'animate-spin' : ''
            }`}
          />
          <span>Refresh</span>
        </button>
      </div>

      {/* Summary Strip */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-2.5 sm:gap-4">
        <div className="bg-[#0e172a] border border-white/10 rounded-xl p-3 sm:p-4 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-1">
            <span className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-slate-400 truncate">
              Available Balance
            </span>
            <Wallet className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          </div>
          <p className="text-base sm:text-xl font-extrabold text-white tabular-nums truncate">
            {Number(wallet?.balance || 0).toFixed(2)}{' '}
            <span className="text-[11px] sm:text-xs font-bold text-amber-400">USDT</span>
          </p>
        </div>

        <div className="bg-[#0e172a] border border-white/10 rounded-xl p-3 sm:p-4 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-1">
            <span className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-slate-400 truncate">
              Total Credited
            </span>
            <ArrowDownLeft className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          </div>
          <p className="text-base sm:text-xl font-extrabold text-emerald-400 tabular-nums truncate">
            +{summaryStats.totalInflow.toFixed(2)}{' '}
            <span className="text-[11px] sm:text-xs font-bold text-emerald-300/80">USDT</span>
          </p>
        </div>

        <div className="col-span-2 md:col-span-1 bg-[#0e172a] border border-white/10 rounded-xl p-3 sm:p-4 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-1">
            <span className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-slate-400 truncate">
              Records &amp; Pending
            </span>
            <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          </div>
          <div className="flex items-baseline gap-2.5 flex-wrap">
            <p className="text-base sm:text-xl font-extrabold text-white tabular-nums">
              {summaryStats.totalRecords}{' '}
              <span className="text-[11px] sm:text-xs font-medium text-slate-400">Entries</span>
            </p>
            <span className="text-xs font-semibold text-amber-400 tabular-nums">
              {summaryStats.pendingCount} Pending
            </span>
          </div>
        </div>
      </div>

      {/* Main Ledger Card */}
      <div
        data-testid="tx-ledger-card"
        className="bg-[#0c1424] border border-white/10 rounded-2xl shadow-2xl overflow-hidden"
      >
        {/* Controls Bar: Filter Tabs + Search */}
        <div className="p-3 sm:p-4 lg:p-5 border-b border-white/10 space-y-3 bg-[#0e172a]/70">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
            {/* Primary Tabs */}
            <div
              role="tablist"
              data-testid="tx-filter-tabs"
              aria-label="Transaction Categories"
              className="flex flex-wrap items-center gap-1.5 sm:gap-2"
            >
              {(
                [
                  { id: 'all', label: 'All', count: walletLedger.length },
                  { id: 'deposits', label: 'Deposit Orders', count: deposits.length },
                  { id: 'withdrawals', label: 'Withdrawal Orders', count: withdrawals.length },
                ] as const
              ).map((tab) => {
                const isActive = activeSubTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    onClick={() => {
                      setActiveSubTab(tab.id);
                      setCurrentPage(1);
                    }}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl text-xs sm:text-sm font-bold transition-all ${
                      isActive
                        ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                        : 'bg-slate-900/90 text-slate-300 border border-white/10 hover:text-white hover:border-white/25'
                    }`}
                  >
                    <span>{tab.label}</span>
                    <span
                      className={`px-1.5 py-0.5 rounded-md text-[10px] font-extrabold tabular-nums ${
                        isActive
                          ? 'bg-slate-950/20 text-slate-950'
                          : 'bg-slate-800 text-slate-300'
                      }`}
                    >
                      {tab.count}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Search Input */}
            <div className="relative w-full lg:w-80 xl:w-96 min-w-0">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                data-testid="tx-search-input"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                placeholder="Search TX ID or type..."
                aria-label="Search transactions by TX ID or transaction type"
                className="w-full pl-9 pr-8 py-2 rounded-xl bg-slate-950/90 border border-white/10 text-xs sm:text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-500/60"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setCurrentPage(1);
                  }}
                  aria-label="Clear search"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* Deposit Sub-Filters */}
          {activeSubTab === 'deposits' && (
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              {(
                [
                  { id: 'all', label: 'All Orders' },
                  { id: 'completed', label: 'Completed' },
                  { id: 'waiting', label: 'Waiting' },
                  { id: 'expired', label: 'Expired / Failed' },
                ] as const
              ).map((sub) => (
                <button
                  key={sub.id}
                  type="button"
                  onClick={() => {
                    setDepositFilter(sub.id);
                    setCurrentPage(1);
                  }}
                  className={`px-2.5 py-1 rounded-lg text-[11px] sm:text-xs font-semibold border transition-colors ${
                    depositFilter === sub.id
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                      : 'bg-slate-900/70 text-slate-400 border-white/10 hover:text-slate-200'
                  }`}
                >
                  {sub.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Empty / Loading States */}
        {(activeSubTab === 'all' && loadingLedger && walletLedger.length === 0) ||
        (activeSubTab === 'deposits' && loadingDeposits && deposits.length === 0) ? (
          <div className="py-16 px-4 text-center space-y-3">
            <RefreshCw className="w-7 h-7 text-amber-400 animate-spin mx-auto" />
            <p className="text-sm font-medium text-slate-400">Loading transaction history...</p>
          </div>
        ) : paginatedRows.length === 0 ? (
          <div className="py-14 px-4 text-center space-y-3">
            <div className="w-12 h-12 mx-auto rounded-2xl bg-slate-900 border border-white/10 flex items-center justify-center text-slate-500">
              <History className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <p className="text-sm sm:text-base font-bold text-slate-200">
                No matching transactions found
              </p>
              <p className="text-xs sm:text-sm text-slate-400 max-w-sm mx-auto">
                {searchQuery
                  ? 'Try searching a different TX ID or transaction type.'
                  : 'Your completed deposits, withdrawals, and reward entries will appear here.'}
              </p>
            </div>
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-white border border-white/10"
              >
                Reset Search
              </button>
            )}
          </div>
        ) : (
          <>
            {/* ===================================================================== */}
            {/* MOBILE VIEW (< 768px): Clean Stacked Cards with 5 Required Fields     */}
            {/* ===================================================================== */}
            <div className="md:hidden p-3 space-y-2.5">
              {activeSubTab === 'all' &&
                paginatedRows.map((tx: any, idx: number) => {
                  const rowKey = `ledger-${tx.id || idx}`;
                  const txId = String(tx.id || '—');
                  const typeMeta = getTransactionTypeMeta(tx.transaction_type);
                  const amountVal = Number(tx.amount || 0);
                  const isPositive = amountVal >= 0;
                  const statusMeta = formatTransactionStatusMeta(tx.status || 'completed');
                  const formattedTs = formatTransactionTimestamp(tx.created_at);
                  const isExpanded = Boolean(expandedIdKeys[rowKey]);

                  return (
                    <article
                      key={rowKey}
                      data-tx-card="all"
                      className="bg-[#111b2e] border border-white/10 rounded-xl p-3.5 space-y-2.5 shadow-sm overflow-hidden"
                    >
                      {/* Row 1: Transaction Type Badge + Status */}
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <span
                          className={`inline-flex items-center px-2.5 py-1 rounded-lg border text-[11px] font-bold leading-tight max-w-full break-words ${typeMeta.bg}`}
                        >
                          {typeMeta.label}
                        </span>
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[10px] font-bold uppercase tracking-wide shrink-0 ${statusMeta.pillClass}`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${statusMeta.dotClass}`} />
                          {statusMeta.label}
                        </span>
                      </div>

                      {/* Row 2: Amount + TX ID */}
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <span
                          className={`text-base font-extrabold tabular-nums ${
                            isPositive ? 'text-emerald-400' : 'text-white'
                          }`}
                        >
                          {isPositive ? '+' : ''}
                          {amountVal.toFixed(2)}{' '}
                          <span className="text-[11px] font-bold opacity-80">USDT</span>
                        </span>

                        <TxIdControl
                          txId={txId}
                          compactChars={5}
                          expanded={isExpanded}
                          onToggleExpand={() => toggleExpandId(rowKey)}
                          copied={copiedIdKey === rowKey}
                          onCopy={() => handleCopyTxId(rowKey, txId)}
                        />
                      </div>

                      {isExpanded && (
                        <div className="bg-slate-950/90 border border-white/10 rounded-lg px-2.5 py-2">
                          <p className="text-[10px] uppercase tracking-wider text-slate-400 mb-0.5">
                            Complete TX ID
                          </p>
                          <p className="font-mono text-[11px] text-slate-200 break-all select-all">
                            {txId}
                          </p>
                        </div>
                      )}

                      {/* Row 3: Timestamp */}
                      <div className="pt-2 border-t border-white/5 flex items-center justify-between gap-2 text-[11px] text-slate-400">
                        <span className="inline-flex items-center gap-1.5 min-w-0 truncate">
                          <Clock className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                          <span className="tabular-nums truncate">
                            {formattedTs ? formattedTs.full : '—'}
                          </span>
                        </span>
                      </div>
                    </article>
                  );
                })}

              {activeSubTab === 'deposits' &&
                paginatedRows.map((dep: any, idx: number) => {
                  const rowKey = `dep-${dep.id || idx}`;
                  const txId = String(dep.invoice_id || dep.id || '—');
                  const createdAtMs = dep.created_at ? new Date(dep.created_at).getTime() : 0;
                  const elapsedMs = createdAtMs > 0 ? nowMs - createdAtMs : 0;
                  const remainingMs = Math.max(0, 15 * 60 * 1000 - elapsedMs);
                  const isTimedOut =
                    dep.status === 'waiting' && createdAtMs > 0 && remainingMs === 0;
                  const effectiveStatus = isTimedOut ? 'expired' : dep.status;
                  const typeMeta = getTransactionTypeMeta('deposit');
                  const statusMeta = formatTransactionStatusMeta(effectiveStatus);
                  const amountVal = Number(dep.amount ?? dep.price_amount ?? 0);
                  const formattedTs = formatTransactionTimestamp(dep.created_at);
                  const isExpanded = Boolean(expandedIdKeys[rowKey]);
                  const canActOnWaiting =
                    String(effectiveStatus || '').toLowerCase() === 'waiting' && !isTimedOut;
                  const mins = Math.floor(remainingMs / 60000);
                  const secs = Math.floor((remainingMs % 60000) / 1000);

                  return (
                    <article
                      key={rowKey}
                      data-tx-card="deposit"
                      className="bg-[#111b2e] border border-white/10 rounded-xl p-3.5 space-y-2.5 shadow-sm overflow-hidden"
                    >
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <span
                          className={`inline-flex items-center px-2.5 py-1 rounded-lg border text-[11px] font-bold leading-tight ${typeMeta.bg}`}
                        >
                          {typeMeta.label}
                        </span>
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[10px] font-bold uppercase tracking-wide shrink-0 ${statusMeta.pillClass}`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${statusMeta.dotClass}`} />
                          {canActOnWaiting
                            ? `Awaiting (${mins}m ${String(secs).padStart(2, '0')}s)`
                            : statusMeta.label}
                        </span>
                      </div>

                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <span className="text-base font-extrabold text-emerald-400 tabular-nums">
                          +{amountVal.toFixed(2)}{' '}
                          <span className="text-[11px] font-bold opacity-80">USDT</span>
                        </span>
                        <TxIdControl
                          txId={txId}
                          compactChars={5}
                          expanded={isExpanded}
                          onToggleExpand={() => toggleExpandId(rowKey)}
                          copied={copiedIdKey === rowKey}
                          onCopy={() => handleCopyTxId(rowKey, txId)}
                        />
                      </div>

                      {isExpanded && (
                        <div className="bg-slate-950/90 border border-white/10 rounded-lg px-2.5 py-2">
                          <p className="text-[10px] uppercase tracking-wider text-slate-400 mb-0.5">
                            Complete TX ID
                          </p>
                          <p className="font-mono text-[11px] text-slate-200 break-all select-all">
                            {txId}
                          </p>
                        </div>
                      )}

                      <div className="pt-2 border-t border-white/5 flex items-center justify-between gap-2 flex-wrap text-[11px] text-slate-400">
                        <span className="inline-flex items-center gap-1.5 min-w-0 truncate">
                          <Clock className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                          <span className="tabular-nums truncate">
                            {formattedTs ? formattedTs.full : '—'}
                          </span>
                        </span>

                        {canActOnWaiting && (
                          <div className="flex items-center gap-1.5">
                            {dep.invoice_url && (
                              <a
                                href={dep.invoice_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-500 text-slate-950 font-bold text-[11px]"
                              >
                                <span>Pay Now</span>
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            )}
                            <button
                              type="button"
                              onClick={() => cancelDeposit?.(dep.id)}
                              className="px-2.5 py-1 rounded-lg bg-slate-800 text-slate-300 border border-white/10 font-semibold text-[11px] hover:text-white"
                            >
                              Cancel
                            </button>
                          </div>
                        )}
                      </div>
                    </article>
                  );
                })}

              {activeSubTab === 'withdrawals' &&
                paginatedRows.map((w: any, idx: number) => {
                  const rowKey = `wd-${w.id || idx}`;
                  const txId = String(w.txHash || w.id || '—');
                  const typeMeta = getTransactionTypeMeta('withdrawal');
                  const statusMeta = formatTransactionStatusMeta(w.status);
                  const amountVal = Number(w.amount || 0);
                  const formattedTs = formatTransactionTimestamp(w.requestedAt);
                  const isExpanded = Boolean(expandedIdKeys[rowKey]);

                  return (
                    <article
                      key={rowKey}
                      data-tx-card="withdrawal"
                      className="bg-[#111b2e] border border-white/10 rounded-xl p-3.5 space-y-2.5 shadow-sm overflow-hidden"
                    >
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <span
                          className={`inline-flex items-center px-2.5 py-1 rounded-lg border text-[11px] font-bold leading-tight ${typeMeta.bg}`}
                        >
                          {typeMeta.label}
                        </span>
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[10px] font-bold uppercase tracking-wide shrink-0 ${statusMeta.pillClass}`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${statusMeta.dotClass}`} />
                          {statusMeta.label}
                        </span>
                      </div>

                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <span className="text-base font-extrabold text-white tabular-nums">
                          -{Math.abs(amountVal).toFixed(2)}{' '}
                          <span className="text-[11px] font-bold text-slate-400">USDT</span>
                        </span>
                        <TxIdControl
                          txId={txId}
                          compactChars={5}
                          expanded={isExpanded}
                          onToggleExpand={() => toggleExpandId(rowKey)}
                          copied={copiedIdKey === rowKey}
                          onCopy={() => handleCopyTxId(rowKey, txId)}
                        />
                      </div>

                      {isExpanded && (
                        <div className="bg-slate-950/90 border border-white/10 rounded-lg px-2.5 py-2">
                          <p className="text-[10px] uppercase tracking-wider text-slate-400 mb-0.5">
                            Complete TX ID
                          </p>
                          <p className="font-mono text-[11px] text-slate-200 break-all select-all">
                            {txId}
                          </p>
                        </div>
                      )}

                      <div className="pt-2 border-t border-white/5 flex items-center justify-between gap-2 flex-wrap text-[11px] text-slate-400">
                        <span className="inline-flex items-center gap-1.5 min-w-0 truncate">
                          <Clock className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                          <span className="tabular-nums truncate">
                            {formattedTs ? formattedTs.full : '—'}
                          </span>
                        </span>
                        <button
                          type="button"
                          onClick={() => setSelectedProofOrder(w)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-500/30 font-semibold text-[11px] transition-colors"
                        >
                          <span>{w.status === 'completed' ? 'Receipt' : 'Track'}</span>
                          <ArrowUpRight className="w-3 h-3" />
                        </button>
                      </div>
                    </article>
                  );
                })}
            </div>

            {/* ===================================================================== */}
            {/* TABLET & DESKTOP VIEW (>= 768px): Strict 5-Column Clean Table         */}
            {/* ===================================================================== */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-white/10 bg-slate-950/60 text-[10px] xl:text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    <th className="py-3 pl-3 pr-2 xl:pl-5 xl:pr-3">TX ID</th>
                    <th className="py-3 px-2 xl:px-3">Transaction Type</th>
                    <th className="py-3 px-2 xl:px-3 text-right">Amount (USDT)</th>
                    <th className="py-3 px-2 xl:px-3 text-center">Status</th>
                    <th className="py-3 pl-2 pr-3 xl:pl-3 xl:pr-5 text-right">Timestamp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-xs xl:text-sm">
                  {activeSubTab === 'all' &&
                    paginatedRows.map((tx: any, idx: number) => {
                      const rowKey = `d-ledger-${tx.id || idx}`;
                      const txId = String(tx.id || '—');
                      const typeMeta = getTransactionTypeMeta(tx.transaction_type);
                      const amountVal = Number(tx.amount || 0);
                      const isPositive = amountVal >= 0;
                      const statusMeta = formatTransactionStatusMeta(tx.status || 'completed');
                      const formattedTs = formatTransactionTimestamp(tx.created_at);
                      const isExpanded = Boolean(expandedIdKeys[rowKey]);

                      return (
                        <React.Fragment key={rowKey}>
                          <tr className="hover:bg-white/[0.025] transition-colors">
                            <td className="py-3 pl-3 pr-2 xl:pl-5 xl:pr-3 whitespace-nowrap">
                              <TxIdControl
                                txId={txId}
                                compactChars={5}
                                expanded={isExpanded}
                                onToggleExpand={() => toggleExpandId(rowKey)}
                                copied={copiedIdKey === rowKey}
                                onCopy={() => handleCopyTxId(rowKey, txId)}
                              />
                            </td>
                            <td className="py-3 px-2 xl:px-3">
                              <span
                                className={`inline-flex items-center px-2 xl:px-2.5 py-1 rounded-lg border text-[11px] xl:text-xs font-bold whitespace-nowrap ${typeMeta.bg}`}
                              >
                                {typeMeta.label}
                              </span>
                            </td>
                            <td
                              className={`py-3 px-2 xl:px-3 text-right font-extrabold tabular-nums whitespace-nowrap ${
                                isPositive ? 'text-emerald-400' : 'text-white'
                              }`}
                            >
                              {isPositive ? '+' : ''}
                              {amountVal.toFixed(2)}{' '}
                              <span className="text-[10px] xl:text-[11px] font-bold opacity-75">USDT</span>
                            </td>
                            <td className="py-3 px-2 xl:px-3 text-center whitespace-nowrap">
                              <span
                                className={`inline-flex items-center gap-1.5 px-2 xl:px-2.5 py-1 rounded-full border text-[10px] xl:text-[11px] font-bold uppercase tracking-wide ${statusMeta.pillClass}`}
                              >
                                <span className={`w-1.5 h-1.5 rounded-full ${statusMeta.dotClass}`} />
                                {statusMeta.label}
                              </span>
                            </td>
                            <td className="py-3 pl-2 pr-3 xl:pl-3 xl:pr-5 text-right text-[11px] xl:text-xs text-slate-300 tabular-nums whitespace-nowrap">
                              {formattedTs ? formattedTs.full : '—'}
                            </td>
                          </tr>
                          {isExpanded && (
                            <tr className="bg-slate-950/60">
                              <td colSpan={5} className="px-4 xl:px-5 py-2.5 text-xs">
                                <span className="text-slate-400 mr-2 font-semibold">
                                  Complete TX ID:
                                </span>
                                <span className="font-mono text-slate-200 select-all break-all">
                                  {txId}
                                </span>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}

                  {activeSubTab === 'deposits' &&
                    paginatedRows.map((dep: any, idx: number) => {
                      const rowKey = `d-dep-${dep.id || idx}`;
                      const txId = String(dep.invoice_id || dep.id || '—');
                      const createdAtMs = dep.created_at ? new Date(dep.created_at).getTime() : 0;
                      const elapsedMs = createdAtMs > 0 ? nowMs - createdAtMs : 0;
                      const remainingMs = Math.max(0, 15 * 60 * 1000 - elapsedMs);
                      const isTimedOut =
                        dep.status === 'waiting' && createdAtMs > 0 && remainingMs === 0;
                      const effectiveStatus = isTimedOut ? 'expired' : dep.status;
                      const typeMeta = getTransactionTypeMeta('deposit');
                      const statusMeta = formatTransactionStatusMeta(effectiveStatus);
                      const amountVal = Number(dep.amount ?? dep.price_amount ?? 0);
                      const formattedTs = formatTransactionTimestamp(dep.created_at);
                      const isExpanded = Boolean(expandedIdKeys[rowKey]);
                      const canActOnWaiting =
                        String(effectiveStatus || '').toLowerCase() === 'waiting' && !isTimedOut;
                      const mins = Math.floor(remainingMs / 60000);
                      const secs = Math.floor((remainingMs % 60000) / 1000);

                      return (
                        <React.Fragment key={rowKey}>
                          <tr className="hover:bg-white/[0.025] transition-colors">
                            <td className="py-3 pl-3 pr-2 xl:pl-5 xl:pr-3 whitespace-nowrap">
                              <TxIdControl
                                txId={txId}
                                compactChars={5}
                                expanded={isExpanded}
                                onToggleExpand={() => toggleExpandId(rowKey)}
                                copied={copiedIdKey === rowKey}
                                onCopy={() => handleCopyTxId(rowKey, txId)}
                              />
                            </td>
                            <td className="py-3 px-2 xl:px-3">
                              <span
                                className={`inline-flex items-center px-2 xl:px-2.5 py-1 rounded-lg border text-[11px] xl:text-xs font-bold whitespace-nowrap ${typeMeta.bg}`}
                              >
                                {typeMeta.label}
                              </span>
                            </td>
                            <td className="py-3 px-2 xl:px-3 text-right font-extrabold text-emerald-400 tabular-nums whitespace-nowrap">
                              +{amountVal.toFixed(2)}{' '}
                              <span className="text-[10px] xl:text-[11px] font-bold opacity-75">USDT</span>
                            </td>
                            <td className="py-3 px-2 xl:px-3 text-center whitespace-nowrap">
                              <div className="inline-flex flex-col items-center gap-1.5">
                                <span
                                  className={`inline-flex items-center gap-1.5 px-2 xl:px-2.5 py-1 rounded-full border text-[10px] xl:text-[11px] font-bold uppercase tracking-wide ${statusMeta.pillClass}`}
                                >
                                  <span className={`w-1.5 h-1.5 rounded-full ${statusMeta.dotClass}`} />
                                  {canActOnWaiting
                                    ? `Awaiting (${mins}m ${String(secs).padStart(2, '0')}s)`
                                    : statusMeta.label}
                                </span>
                                {canActOnWaiting && (
                                  <div className="flex items-center gap-1.5">
                                    {dep.invoice_url && (
                                      <a
                                        href={dep.invoice_url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-500 text-slate-950 font-bold text-[10px]"
                                      >
                                        Pay Now <ExternalLink className="w-2.5 h-2.5" />
                                      </a>
                                    )}
                                    <button
                                      type="button"
                                      onClick={() => cancelDeposit?.(dep.id)}
                                      className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-white/10 text-[10px] font-semibold hover:text-white"
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                )}
                              </div>
                            </td>
                            <td className="py-3 pl-2 pr-3 xl:pl-3 xl:pr-5 text-right text-[11px] xl:text-xs text-slate-300 tabular-nums whitespace-nowrap">
                              {formattedTs ? formattedTs.full : '—'}
                            </td>
                          </tr>
                          {isExpanded && (
                            <tr className="bg-slate-950/60">
                              <td colSpan={5} className="px-4 xl:px-5 py-2.5 text-xs">
                                <span className="text-slate-400 mr-2 font-semibold">
                                  Complete TX ID:
                                </span>
                                <span className="font-mono text-slate-200 select-all break-all">
                                  {txId}
                                </span>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}

                  {activeSubTab === 'withdrawals' &&
                    paginatedRows.map((w: any, idx: number) => {
                      const rowKey = `d-wd-${w.id || idx}`;
                      const txId = String(w.txHash || w.id || '—');
                      const typeMeta = getTransactionTypeMeta('withdrawal');
                      const statusMeta = formatTransactionStatusMeta(w.status);
                      const amountVal = Number(w.amount || 0);
                      const formattedTs = formatTransactionTimestamp(w.requestedAt);
                      const isExpanded = Boolean(expandedIdKeys[rowKey]);

                      return (
                        <React.Fragment key={rowKey}>
                          <tr className="hover:bg-white/[0.025] transition-colors">
                            <td className="py-3 pl-3 pr-2 xl:pl-5 xl:pr-3 whitespace-nowrap">
                              <TxIdControl
                                txId={txId}
                                compactChars={5}
                                expanded={isExpanded}
                                onToggleExpand={() => toggleExpandId(rowKey)}
                                copied={copiedIdKey === rowKey}
                                onCopy={() => handleCopyTxId(rowKey, txId)}
                              />
                            </td>
                            <td className="py-3 px-2 xl:px-3">
                              <span
                                className={`inline-flex items-center px-2 xl:px-2.5 py-1 rounded-lg border text-[11px] xl:text-xs font-bold whitespace-nowrap ${typeMeta.bg}`}
                              >
                                {typeMeta.label}
                              </span>
                            </td>
                            <td className="py-3 px-2 xl:px-3 text-right font-extrabold text-white tabular-nums whitespace-nowrap">
                              -{Math.abs(amountVal).toFixed(2)}{' '}
                              <span className="text-[10px] xl:text-[11px] font-bold text-slate-400">USDT</span>
                            </td>
                            <td className="py-3 px-2 xl:px-3 text-center whitespace-nowrap">
                              <div className="inline-flex items-center gap-1.5">
                                <span
                                  className={`inline-flex items-center gap-1.5 px-2 xl:px-2.5 py-1 rounded-full border text-[10px] xl:text-[11px] font-bold uppercase tracking-wide ${statusMeta.pillClass}`}
                                >
                                  <span className={`w-1.5 h-1.5 rounded-full ${statusMeta.dotClass}`} />
                                  {statusMeta.label}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => setSelectedProofOrder(w)}
                                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-500/30 text-[10px] xl:text-[11px] font-semibold transition-colors"
                                >
                                  <span>{w.status === 'completed' ? 'Receipt' : 'Track'}</span>
                                  <ArrowUpRight className="w-3 h-3" />
                                </button>
                              </div>
                            </td>
                            <td className="py-3 pl-2 pr-3 xl:pl-3 xl:pr-5 text-right text-[11px] xl:text-xs text-slate-300 tabular-nums whitespace-nowrap">
                              {formattedTs ? formattedTs.full : '—'}
                            </td>
                          </tr>
                          {isExpanded && (
                            <tr className="bg-slate-950/60">
                              <td colSpan={5} className="px-4 xl:px-5 py-2.5 text-xs">
                                <span className="text-slate-400 mr-2 font-semibold">
                                  Complete TX ID:
                                </span>
                                <span className="font-mono text-slate-200 select-all break-all">
                                  {txId}
                                </span>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                </tbody>
              </table>
            </div>

            {/* Pagination Footer */}
            <div className="px-3.5 sm:px-5 py-3 border-t border-white/10 bg-[#0e172a]/60 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
              <span className="tabular-nums">
                Showing {(safePage - 1) * PAGE_SIZE + 1}–
                {Math.min(safePage * PAGE_SIZE, activeRows.length)} of {activeRows.length}
              </span>

              {totalPages > 1 && (
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    disabled={safePage <= 1}
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-900 border border-white/10 text-slate-200 hover:border-white/25 disabled:opacity-40 transition-colors"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                    <span>Prev</span>
                  </button>
                  <span className="px-2 font-bold text-slate-200 tabular-nums">
                    {safePage} / {totalPages}
                  </span>
                  <button
                    type="button"
                    disabled={safePage >= totalPages}
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-900 border border-white/10 text-slate-200 hover:border-white/25 disabled:opacity-40 transition-colors"
                  >
                    <span>Next</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Info Footnote */}
      <div className="flex items-start gap-2.5 bg-[#0d1526]/80 border border-white/10 rounded-xl px-3.5 py-3 text-xs text-slate-400">
        <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
        <p className="leading-relaxed">
          All timestamps reflect recorded ledger and order events. Tap the copy or view icon beside any compact TX ID to inspect or copy the complete transaction identifier.
        </p>
      </div>

      <WithdrawalProofModal
        order={selectedProofOrder}
        onClose={() => setSelectedProofOrder(null)}
      />
    </div>
  );
}
