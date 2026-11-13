import React, { useState, useEffect } from 'react';
import { 
  History, 
  ArrowLeft, 
  ArrowDownLeft, 
  ArrowUpRight, 
  Coins, 
  RefreshCw, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  ExternalLink, 
  Check, 
  FileCheck,
  Search,
  Wallet,
  ShieldCheck,
  Sparkles,
  Lock,
  LogIn
} from 'lucide-react';
import { useLottery } from '../context/LotteryContext';
import WithdrawalProofModal from '../components/WithdrawalProofModal';

export interface TransactionHistoryPageProps {
  onBackToWallet?: () => void;
  onBackToHome?: () => void;
}

export default function TransactionHistoryPage({ onBackToWallet, onBackToHome }: TransactionHistoryPageProps) {
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
    setActiveTab
  } = useLottery();

  const [activeHistoryTab, setActiveHistoryTab] = useState('all'); // 'all' | 'deposits' | 'withdrawals'
  const [depositFilter, setDepositFilter] = useState('all'); // 'all' | 'completed' | 'waiting' | 'expired'
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProofOrder, setSelectedProofOrder] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [now, setNow] = useState(Date.now());

  // Page title sync
  useEffect(() => {
    document.title = 'Transaction History · EarnFlow.In';
  }, []);

  // 1-second interval to update live countdown timers
  useEffect(() => {
    const interval = setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Fetch latest ledger, deposits, and withdrawals on mount
  useEffect(() => {
    if (user) {
      if (fetchWalletLedger) fetchWalletLedger();
      if (fetchDeposits) fetchDeposits();
      if (fetchWithdrawals) fetchWithdrawals();
    }
  }, [user]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await Promise.allSettled([
        fetchWalletLedger ? fetchWalletLedger() : Promise.resolve(),
        fetchDeposits ? fetchDeposits() : Promise.resolve(),
        fetchWithdrawals ? fetchWithdrawals() : Promise.resolve()
      ]);
    } finally {
      setIsRefreshing(false);
    }
  };

  const formatSLATime = (targetMs) => {
    if (!targetMs) return '24h window';
    const diff = Math.max(0, targetMs - now);
    const h = Math.floor(diff / (1000 * 60 * 60));
    const m = Math.floor((diff / (1000 * 60)) % 60);
    const s = Math.floor((diff / 1000) % 60);
    return `${h}h ${m}m ${s}s remaining`;
  };

  // Filtered ledger records for 'All' tab
  const filteredLedger = walletLedger.filter(tx => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      (tx.id && String(tx.id).toLowerCase().includes(q)) ||
      (tx.transaction_type && tx.transaction_type.toLowerCase().includes(q)) ||
      (tx.description && tx.description.toLowerCase().includes(q)) ||
      (tx.reference_id && tx.reference_id.toLowerCase().includes(q))
    );
  });

  // Filtered deposits for 'Deposit Orders' tab
  const filteredDeposits = deposits.filter(d => {
    const matchesSearch = !searchQuery.trim() || (
      (d.id && String(d.id).toLowerCase().includes(searchQuery.toLowerCase())) ||
      (d.invoice_id && String(d.invoice_id).toLowerCase().includes(searchQuery.toLowerCase())) ||
      (d.pay_currency && d.pay_currency.toLowerCase().includes(searchQuery.toLowerCase()))
    );
    if (!matchesSearch) return false;

    if (depositFilter === 'all') return true;
    const isFin = d.status === 'finished' || d.status === 'confirmed';
    if (depositFilter === 'completed') return isFin;
    const createdAt = d.created_at ? new Date(d.created_at).getTime() : now;
    const isWait = d.status === 'waiting' && (now - createdAt <= 15 * 60 * 1000);
    if (depositFilter === 'waiting') return isWait;
    if (depositFilter === 'expired') return !isFin && !isWait;
    return true;
  });

  // Filtered withdrawals for 'Withdrawal Orders' tab
  const filteredWithdrawals = withdrawals.filter(w => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      (w.id && String(w.id).toLowerCase().includes(q)) ||
      (w.address && w.address.toLowerCase().includes(q)) ||
      (w.network && w.network.toLowerCase().includes(q))
    );
  });

  // Unauthenticated visitors prompt
  if (!user) {
    return (
      <div className="w-full max-w-4xl 2xl:max-w-5xl mx-auto px-2.5 xs:px-4 sm:px-6 lg:px-8 py-8 sm:py-16 text-center animate-in fade-in duration-200">
        <div className="glass-panel p-6 sm:p-12 rounded-3xl border border-amber-500/30 bg-gradient-to-br from-[#151C2B] via-[#0F1420] to-[#0B0F19] space-y-6">
          <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center mx-auto text-amber-400 shadow-lg shadow-amber-500/20">
            <Lock className="w-8 h-8 sm:w-10 sm:h-10" />
          </div>

          <div className="space-y-2 max-w-md mx-auto">
            <h1 className="font-display font-black text-2xl sm:text-3xl text-white">
              Transaction History
            </h1>
            <p className="text-xs sm:text-sm text-[#9b8f7c] leading-relaxed">
              Please sign in to view your complete cryptocurrency deposit orders, withdrawal disbursements, and FLO Coin transaction ledger.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <button
              onClick={() => setIsAuthModalOpen && setIsAuthModalOpen(true)}
              className="w-full sm:w-auto px-6 py-3 rounded-xl btn-gold text-[#0B0F19] font-display font-extrabold text-xs sm:text-sm shadow-xl shadow-amber-500/20 flex items-center justify-center gap-2 cursor-pointer transition-transform active:scale-95"
            >
              <LogIn className="w-4 h-4 text-black" />
              <span>Sign In to Your Account</span>
            </button>

            <button
              onClick={() => {
                if (onBackToHome) onBackToHome();
                else if (setActiveTab) setActiveTab('lotteries');
              }}
              className="w-full sm:w-auto px-6 py-3 rounded-xl bg-[#111827] hover:bg-[#151C2B] text-[#9b8f7c] hover:text-white border border-[#1F2737] font-semibold text-xs sm:text-sm transition-colors cursor-pointer"
            >
              Return to Casino Lobby
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-7xl 2xl:max-w-[1600px] 3xl:max-w-[1800px] 4k:max-w-[2000px] mx-auto px-2.5 xs:px-4 sm:px-6 lg:px-8 py-4 sm:py-8 space-y-5 sm:space-y-6 text-left animate-in fade-in duration-200">
      
      {/* 1. TOP HEADER & BREADCRUMB / BACK NAVIGATION */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#1F2737]">
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              if (onBackToWallet) {
                onBackToWallet();
              } else if (onBackToHome) {
                onBackToHome();
              } else if (setActiveTab) {
                setActiveTab('wallet');
              }
              const mainEl = document.getElementById('main-content');
              if (mainEl) mainEl.scrollTo({ top: 0, behavior: 'smooth' });
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-[#111827] hover:bg-[#151C2B] text-amber-400 hover:text-white border border-[#1F2737] hover:border-amber-400/40 flex items-center justify-center transition-all cursor-pointer shrink-0 shadow-sm"
            title="Back to Wallet"
            aria-label="Back to Wallet"
          >
            <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <History className="w-5 h-5 sm:w-6 sm:h-6 text-amber-400" />
              <h1 className="font-display font-extrabold text-xl sm:text-2xl lg:text-3xl text-white tracking-tight">
                Transaction History
              </h1>
            </div>
            <p className="text-xs sm:text-sm text-[#9b8f7c] mt-0.5">
              Verified record of all wallet ledger activity, deposit orders, and withdrawal disbursements.
            </p>
          </div>
        </div>

        {/* Quick Refresh & Balance Indicator */}
        <div className="flex items-center gap-2.5 self-start sm:self-auto shrink-0">
          <div className="hidden xs:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#111827] border border-[#1F2737] text-xs font-mono-numbers">
            <span className="text-[#9b8f7c]">Balance:</span>
            <span className="text-amber-400 font-black">{Number(wallet?.balance || 0).toFixed(2)} FLO</span>
          </div>

          <button
            onClick={handleRefresh}
            disabled={isRefreshing || loadingLedger || loadingDeposits}
            className="px-3.5 py-2 rounded-xl bg-[#111827] hover:bg-[#151C2B] text-[#9b8f7c] hover:text-amber-300 border border-[#1F2737] hover:border-amber-400/40 text-xs font-bold flex items-center gap-2 transition-all cursor-pointer shrink-0 disabled:opacity-50"
            title="Refresh All Records"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-amber-400' : ''}`} />
            <span className="hidden xs:inline">Refresh</span>
          </button>
        </div>
      </div>

      {/* 2. THREE SECTION OPTIONS (All, Deposit Orders, Withdrawal Orders) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 bg-[#0b0e14] p-1 rounded-2xl border border-[#272a31] w-full sm:w-auto">
          {/* Option 1: All */}
          <button
            type="button"
            onClick={() => setActiveHistoryTab('all')}
            className={`flex-1 sm:flex-initial px-4 sm:px-5 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
              activeHistoryTab === 'all'
                ? 'bg-gradient-to-r from-[#ffd700] to-[#f5c451] text-[#0b0e14] shadow-md font-extrabold'
                : 'text-[#9b8f7c] hover:text-white hover:bg-white/5'
            }`}
          >
            <Coins className="w-4 h-4" />
            <span>All ({walletLedger.length})</span>
          </button>

          {/* Option 2: Deposit Orders */}
          <button
            type="button"
            onClick={() => setActiveHistoryTab('deposits')}
            className={`flex-1 sm:flex-initial px-4 sm:px-5 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
              activeHistoryTab === 'deposits'
                ? 'bg-gradient-to-r from-[#ffd700] to-[#f5c451] text-[#0b0e14] shadow-md font-extrabold'
                : 'text-[#9b8f7c] hover:text-white hover:bg-white/5'
            }`}
          >
            <ArrowDownLeft className="w-4 h-4" />
            <span>Deposit Orders ({deposits.length})</span>
          </button>

          {/* Option 3: Withdrawal Orders */}
          <button
            type="button"
            onClick={() => setActiveHistoryTab('withdrawals')}
            className={`flex-1 sm:flex-initial px-4 sm:px-5 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
              activeHistoryTab === 'withdrawals'
                ? 'bg-gradient-to-r from-[#ffd700] to-[#f5c451] text-[#0b0e14] shadow-md font-extrabold'
                : 'text-[#9b8f7c] hover:text-white hover:bg-white/5'
            }`}
          >
            <ArrowUpRight className="w-4 h-4" />
            <span>Withdrawal Orders ({withdrawals.length})</span>
          </button>
        </div>

        {/* Search Filter */}
        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 text-[#9b8f7c] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by ID, type..."
            className="w-full pl-9 pr-3 py-2 rounded-xl bg-[#111827] border border-[#272a31] text-xs text-white placeholder-[#64748B] focus:outline-none focus:border-amber-400/60"
          />
        </div>
      </div>

      {/* 3. OPTION 1: ALL TRANSACTIONS (FLO COIN & VIRTUAL LEDGER) */}
      {activeHistoryTab === 'all' && (
        <div className="glass-panel rounded-2xl p-3.5 xs:p-5 sm:p-6 space-y-4">
          <div className="flex items-center justify-between text-xs text-[#9b8f7c] pb-2 border-b border-[#272a31]">
            <span className="font-semibold text-white/90">
              All Transaction Records ({filteredLedger.length})
            </span>
            <span className="text-[11px] font-mono-numbers">1 FLO W = 1 USDT</span>
          </div>

          <div className="overflow-x-auto -mx-3.5 xs:-mx-5 sm:mx-0 px-3.5 xs:px-5 sm:px-0">
            <table className="w-full min-w-[760px] text-left text-xs">
              <thead>
                <tr className="border-b border-[#272a31] text-[#9b8f7c] font-mono-numbers uppercase tracking-wider text-[10px] xs:text-xs">
                  <th className="pb-3 px-2 xs:px-3 whitespace-nowrap">Tx ID</th>
                  <th className="pb-3 px-2 xs:px-3 whitespace-nowrap">Transaction Type</th>
                  <th className="pb-3 px-2 xs:px-3 whitespace-nowrap">Amount (FLO W)</th>
                  <th className="pb-3 px-2 xs:px-3 whitespace-nowrap">USDT Value (1:1)</th>
                  <th className="pb-3 px-2 xs:px-3 whitespace-nowrap">Balance After</th>
                  <th className="pb-3 px-2 xs:px-3 whitespace-nowrap">Status</th>
                  <th className="pb-3 px-2 xs:px-3 whitespace-nowrap">Description / Reference</th>
                  <th className="pb-3 px-2 xs:px-3 text-right whitespace-nowrap">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1f2737]">
                {filteredLedger.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-10 text-center text-[#9b8f7c] font-mono-numbers">
                      {searchQuery ? 'No transactions matching your search query.' : 'No transactions recorded in ledger yet.'}
                    </td>
                  </tr>
                ) : (
                  filteredLedger.map((tx) => {
                    const isCredit = Number(tx.amount) > 0;
                    const typeConfig = {
                      welcome_grant: { label: 'WELCOME BONUS', bg: 'bg-purple-500/15 text-purple-300 border-purple-500/30' },
                      daily_reward: { label: 'DAILY FLO W REWARD', bg: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' },
                      daily_bonus: { label: 'DAILY FLO W REWARD', bg: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' },
                      ticket_purchase: { label: 'TICKET PURCHASE', bg: 'bg-rose-500/15 text-rose-300 border-rose-500/30' },
                      lottery_win: { label: 'LOTTERY WIN', bg: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' },
                      game_bet: { label: 'GAME WAGER', bg: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
                      game_win: { label: 'GAME WIN', bg: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' },
                      admin_adjustment: { label: 'ADMIN GRANT', bg: 'bg-blue-500/15 text-blue-300 border-blue-500/30' }
                    }[tx.transaction_type] || { 
                      label: (tx.transaction_type || 'TRANSACTION').toUpperCase(), 
                      bg: 'bg-white/10 text-white/80 border-white/20' 
                    };

                    return (
                      <tr key={tx.id} className="hover:bg-white/[0.02] transition-colors">
                        <td className="py-3.5 px-2 xs:px-3 font-mono-numbers text-[11px] text-white/70 whitespace-nowrap">
                          <span className="bg-[#10141f] px-2 py-0.5 rounded border border-[#272a31] text-amber-400/90 font-mono">
                            #{tx.id ? String(tx.id).slice(0, 14) : '—'}
                          </span>
                        </td>
                        <td className="py-3.5 px-2 xs:px-3 whitespace-nowrap">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold border ${typeConfig.bg}`}>
                            {typeConfig.label}
                          </span>
                        </td>
                        <td className="py-3.5 px-2 xs:px-3 font-mono-numbers font-black text-sm whitespace-nowrap">
                          <span className={isCredit ? 'text-emerald-400' : 'text-rose-400'}>
                            {isCredit ? '+' : ''}{Number(tx.amount).toFixed(2)} FLO W
                          </span>
                        </td>
                        <td className="py-3.5 px-2 xs:px-3 font-mono-numbers font-bold text-xs whitespace-nowrap">
                          <span className={isCredit ? 'text-emerald-300' : 'text-rose-300'}>
                            {isCredit ? '+' : '-'}${Math.abs(Number(tx.amount || 0)).toFixed(2)} USDT
                          </span>
                        </td>
                        <td className="py-3.5 px-2 xs:px-3 font-mono-numbers text-xs text-white/90 whitespace-nowrap">
                          <span className="text-[#ffd700] font-bold">{Number(tx.balance_after || 0).toFixed(2)} FLO</span>
                        </td>
                        <td className="py-3.5 px-2 xs:px-3 whitespace-nowrap">
                          <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400 font-mono font-bold bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                            <span>Completed</span>
                          </span>
                        </td>
                        <td className="py-3.5 px-2 xs:px-3 text-xs text-white/80 max-w-[260px] truncate">
                          <span title={tx.description || tx.reference_id}>
                            {tx.description || tx.reference_id || 'Virtual Credit Adjustment'}
                          </span>
                          {tx.reference_id && (
                            <span className="block text-[10px] text-[#9b8f7c] font-mono truncate">
                              Ref: {tx.reference_id}
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-2 xs:px-3 text-right text-[11px] font-mono-numbers text-[#9b8f7c] whitespace-nowrap">
                          {tx.created_at ? new Date(tx.created_at).toLocaleString() : 'Recent'}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 4. OPTION 2: DEPOSIT ORDERS */}
      {activeHistoryTab === 'deposits' && (
        <div className="glass-panel rounded-2xl p-3.5 xs:p-5 sm:p-6 space-y-4">
          {/* Sub-Filter Pills */}
          <div className="flex flex-wrap items-center gap-2 pb-2 border-b border-[#272a31]">
            {[
              { id: 'all', label: `All (${deposits.length})` },
              { id: 'completed', label: `Successful (${deposits.filter(d => d.status === 'finished' || d.status === 'confirmed').length})` },
              { id: 'waiting', label: `Awaiting (${deposits.filter(d => d.status === 'waiting' && (now - new Date(d.created_at || now).getTime() <= 15 * 60 * 1000)).length})` },
              { id: 'expired', label: `Unpaid/Expired (${deposits.filter(d => d.status === 'expired' || d.status === 'cancelled' || d.status === 'failed' || (d.status === 'waiting' && now - new Date(d.created_at || now).getTime() > 15 * 60 * 1000)).length})` }
            ].map(f => (
              <button
                key={f.id}
                type="button"
                onClick={() => setDepositFilter(f.id)}
                className={`px-3 py-1 rounded-lg text-xs font-mono-numbers font-bold transition-all cursor-pointer ${
                  depositFilter === f.id
                    ? 'bg-amber-500 text-black shadow-sm font-extrabold'
                    : 'bg-[#10141f] text-[#9b8f7c] hover:text-white border border-[#272a31]'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          <div className="overflow-x-auto -mx-3.5 xs:-mx-5 sm:mx-0 px-3.5 xs:px-5 sm:px-0">
            <table className="w-full min-w-[640px] text-left text-xs">
              <thead>
                <tr className="border-b border-[#272a31] text-[#9b8f7c] font-mono-numbers uppercase tracking-wider text-[10px] xs:text-xs">
                  <th className="pb-3 px-2 xs:px-3 whitespace-nowrap">Invoice / Order ID</th>
                  <th className="pb-3 px-2 xs:px-3 whitespace-nowrap">Amount (USDT)</th>
                  <th className="pb-3 px-2 xs:px-3 whitespace-nowrap">Payment Asset</th>
                  <th className="pb-3 px-2 xs:px-3 whitespace-nowrap">Initiated At</th>
                  <th className="pb-3 px-2 xs:px-3 whitespace-nowrap">Status</th>
                  <th className="pb-3 px-2 xs:px-3 text-right whitespace-nowrap">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1f2737]">
                {filteredDeposits.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-10 text-center text-[#9b8f7c]">
                      No deposit orders matching filter.
                    </td>
                  </tr>
                ) : (
                  filteredDeposits.map((order) => {
                    const isFinished = order.status === 'finished' || order.status === 'confirmed';
                    const isCancelled = order.status === 'cancelled';
                    const isExplicitExpired = order.status === 'expired' || order.status === 'failed';
                    const isWaiting = order.status === 'waiting';

                    const createdAtMs = order.created_at ? new Date(order.created_at).getTime() : now;
                    const ageMs = now - createdAtMs;
                    const timeoutMs = 15 * 60 * 1000;
                    const isTimedOut = isWaiting && ageMs > timeoutMs;
                    const remainingMs = Math.max(0, timeoutMs - ageMs);
                    const remMin = Math.floor(remainingMs / 60000);
                    const remSec = Math.floor((remainingMs % 60000) / 1000);

                    return (
                      <tr key={order.id} className="hover:bg-white/[0.02] transition-colors">
                        <td className="py-4 px-2 xs:px-3 font-mono-numbers font-bold text-white whitespace-nowrap">
                          <span title={order.id}>
                            #{order.invoice_id || (order.id ? String(order.id).slice(0, 14) : 'DEP')}
                          </span>
                        </td>
                        <td className="py-4 px-2 xs:px-3 font-mono-numbers font-black text-sm text-[#05d5aa] whitespace-nowrap">
                          +{Number(order.amount || 0).toFixed(2)} USDT
                        </td>
                        <td className="py-4 px-2 xs:px-3 whitespace-nowrap">
                          <span className="px-2.5 py-0.5 rounded bg-[#10131a] text-[#ffd700] border border-[#f5c451]/30 font-mono-numbers font-bold text-[10px] whitespace-nowrap inline-flex items-center">
                            {(order.pay_currency || 'usdttrc20').toUpperCase()}
                          </span>
                        </td>
                        <td className="py-4 px-2 xs:px-3 font-mono-numbers text-white/80 whitespace-nowrap text-[11px]">
                          {order.created_at ? new Date(order.created_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) : 'Just now'}
                        </td>
                        <td className="py-4 px-2 xs:px-3 whitespace-nowrap">
                          {isFinished ? (
                            <span className="px-2.5 py-1 rounded-md bg-[rgba(5,213,170,0.15)] text-[#05d5aa] border border-[#05d5aa]/40 font-bold flex items-center gap-1.5 w-max whitespace-nowrap">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              Success (+{order.amount} USDT)
                            </span>
                          ) : isCancelled ? (
                            <span className="px-2.5 py-1 rounded-md bg-slate-800 text-slate-400 border border-slate-700 font-bold flex items-center gap-1 w-max whitespace-nowrap text-[11px]">
                              <XCircle className="w-3.5 h-3.5 text-slate-400" />
                              Cancelled
                            </span>
                          ) : (isExplicitExpired || isTimedOut) ? (
                            <span className="px-2.5 py-1 rounded-md bg-[#161a23] text-[#9b8f7c] border border-[#272a31] font-bold flex items-center gap-1.5 w-max whitespace-nowrap text-[11px]">
                              <Clock className="w-3.5 h-3.5 text-[#9b8f7c]" />
                              Unpaid (Expired 15m)
                            </span>
                          ) : (
                            <div className="flex items-center gap-2">
                              <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping shrink-0" />
                              <div>
                                <span className="text-amber-400 font-bold block whitespace-nowrap text-xs">
                                  Awaiting Payment
                                </span>
                                <span className="text-[10px] font-mono-numbers text-amber-200/80 whitespace-nowrap">
                                  Expires in {remMin}m {remSec < 10 ? '0' : ''}{remSec}s
                                </span>
                              </div>
                            </div>
                          )}
                        </td>
                        <td className="py-4 px-2 xs:px-3 text-right whitespace-nowrap">
                          {isWaiting && !isTimedOut ? (
                            <div className="flex items-center justify-end gap-2">
                              {order.invoice_url && (
                                <a
                                  href={order.invoice_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="px-2.5 py-1 rounded-lg bg-[rgba(245,196,81,0.15)] hover:bg-[#f5c451] text-[#ffd700] hover:text-[#0b0e14] text-[11px] font-bold border border-[#f5c451]/30 transition-all inline-flex items-center gap-1 cursor-pointer"
                                >
                                  <span>Pay Now</span>
                                  <ExternalLink className="w-3 h-3" />
                                </a>
                              )}
                              <button
                                type="button"
                                onClick={() => cancelDeposit(order.id)}
                                className="px-2.5 py-1 rounded-lg bg-rose-950/40 hover:bg-rose-600 text-rose-300 hover:text-white text-[11px] font-bold border border-rose-500/30 transition-all cursor-pointer"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : isFinished ? (
                            <span className="text-[11px] text-[#05d5aa] font-mono-numbers font-bold flex items-center justify-end gap-1">
                              <Check className="w-3.5 h-3.5" />
                              Credited
                            </span>
                          ) : (
                            <span className="text-[11px] text-[#6b7280] font-mono-numbers">
                              Closed
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 5. OPTION 3: WITHDRAWAL ORDERS */}
      {activeHistoryTab === 'withdrawals' && (
        <div className="glass-panel rounded-2xl p-3.5 xs:p-5 sm:p-6 space-y-4">
          <div className="flex items-center justify-between text-xs text-[#9b8f7c] pb-2 border-b border-[#272a31]">
            <span className="font-semibold text-white/90">
              Withdrawal Disbursement Orders ({filteredWithdrawals.length})
            </span>
            <span className="text-[11px] font-mono-numbers">Automated 24h Payouts</span>
          </div>

          <div className="overflow-x-auto -mx-3.5 xs:-mx-5 sm:mx-0 px-3.5 xs:px-5 sm:px-0">
            <table className="w-full min-w-[640px] text-left text-xs">
              <thead>
                <tr className="border-b border-[#272a31] text-[#9b8f7c] font-mono-numbers uppercase tracking-wider text-[10px] xs:text-xs">
                  <th className="pb-3 px-2 xs:px-3 whitespace-nowrap">Order ID</th>
                  <th className="pb-3 px-2 xs:px-3 whitespace-nowrap">Amount (USDT)</th>
                  <th className="pb-3 px-2 xs:px-3 whitespace-nowrap">Network</th>
                  <th className="pb-3 px-2 xs:px-3 whitespace-nowrap">Destination Address</th>
                  <th className="pb-3 px-2 xs:px-3 whitespace-nowrap">Status / Timer</th>
                  <th className="pb-3 px-2 xs:px-3 text-right whitespace-nowrap">Receipt / Tracking</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1f2737]">
                {filteredWithdrawals.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-10 text-center text-[#9b8f7c]">
                      {searchQuery ? 'No withdrawals matching your search query.' : 'No withdrawals yet.'}
                    </td>
                  </tr>
                ) : (
                  filteredWithdrawals.map((order) => {
                    const isProcessing = order.status === 'processing';
                    const isCompleted = order.status === 'completed';

                    return (
                      <tr key={order.id} className="hover:bg-white/[0.02] transition-colors">
                        <td className="py-4 px-2 xs:px-3 font-mono-numbers font-bold text-white whitespace-nowrap">
                          #{order.id}
                        </td>
                        <td className="py-4 px-2 xs:px-3 font-mono-numbers font-black text-sm text-[#ffd700] whitespace-nowrap">
                          {Number(order.amount || 0).toFixed(2)} USDT
                          <span className="block text-[10px] text-[#9b8f7c] font-normal">
                            Net: {Number(order.netDisbursal || order.amount || 0).toFixed(2)} USDT
                          </span>
                        </td>
                        <td className="py-4 px-2 xs:px-3 whitespace-nowrap">
                          <span className="px-2.5 py-0.5 rounded bg-[#10131a] text-[#05d5aa] border border-[#05d5aa]/30 font-mono-numbers font-bold text-[10px] whitespace-nowrap inline-flex items-center">
                            {order.network || 'TRC20'}
                          </span>
                        </td>
                        <td className="py-4 px-2 xs:px-3 font-mono-numbers text-white/80 whitespace-nowrap">
                          {order.address ? `${order.address.slice(0, 6)}...${order.address.slice(-6)}` : 'TRC-20 Address'}
                        </td>
                        <td className="py-4 px-2 xs:px-3 whitespace-nowrap">
                          {isProcessing ? (
                            <div className="flex items-center gap-2">
                              <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping shrink-0" />
                              <div>
                                <span className="text-amber-400 font-bold block whitespace-nowrap">
                                  In Progress (24 Hours)
                                </span>
                                <span className="text-[10px] font-mono-numbers text-amber-200/80 whitespace-nowrap">
                                  {formatSLATime(order.slaTargetMs)}
                                </span>
                              </div>
                            </div>
                          ) : isCompleted ? (
                            <span className="px-2.5 py-1 rounded-md bg-[rgba(5,213,170,0.15)] text-[#05d5aa] border border-[#05d5aa]/40 font-bold flex items-center gap-1.5 w-max whitespace-nowrap">
                              <Check className="w-3.5 h-3.5" />
                              Completed (Disbursed)
                            </span>
                          ) : (
                            <span className="px-2.5 py-1 rounded-md bg-red-950/40 text-red-400 border border-red-500/30 font-bold whitespace-nowrap">
                              Flagged / Refunded
                            </span>
                          )}
                        </td>
                        <td className="py-4 px-2 xs:px-3 text-right whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => setSelectedProofOrder(order)}
                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold font-mono-numbers transition-all cursor-pointer whitespace-nowrap ${
                              isCompleted 
                                ? 'bg-emerald-500/15 hover:bg-emerald-500/25 text-[#05d5aa] border border-[#05d5aa]/30 shadow-[0_0_15px_rgba(5,213,170,0.15)]'
                                : 'bg-amber-500/15 hover:bg-amber-500/25 text-amber-400 border border-amber-500/30'
                            }`}
                          >
                            <FileCheck className="w-3.5 h-3.5" />
                            <span>{isCompleted ? 'View Receipt' : 'Track Order'}</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Cryptographic Withdrawal Proof Modal */}
      {selectedProofOrder && (
        <WithdrawalProofModal 
          order={selectedProofOrder} 
          onClose={() => setSelectedProofOrder(null)} 
        />
      )}

    </div>
  );
}
