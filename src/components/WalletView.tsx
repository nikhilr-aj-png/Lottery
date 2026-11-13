import React, { useState, useEffect } from 'react';
import { useLottery } from '../context/LotteryContext';
import WithdrawalProofModal from './WithdrawalProofModal';
import { 
  Wallet, 
  ArrowDownLeft, 
  ArrowUpRight, 
  Clock, 
  Copy, 
  Check, 
  ShieldCheck, 
  ExternalLink, 
  AlertCircle,
  QrCode,
  DollarSign,
  CreditCard,
  RefreshCw,
  Coins,
  CheckCircle2,
  FileCheck,
  XCircle,
  X,
  Gift,
  Sparkles,
  History
} from 'lucide-react';

const PAYMENT_CURRENCIES = [
  { id: 'usdttrc20', name: 'USDT (TRON TRC-20)', symbol: 'USDT', network: 'TRC-20' },
  { id: 'usdtbep20', name: 'USDT (BNB Chain BEP-20)', symbol: 'USDT', network: 'BEP-20' },
  { id: 'trx', name: 'TRON (TRX)', symbol: 'TRX', network: 'TRON' },
  { id: 'btc', name: 'Bitcoin (BTC)', symbol: 'BTC', network: 'Bitcoin' },
  { id: 'eth', name: 'Ethereum (ETH)', symbol: 'ETH', network: 'ERC-20' },
  { id: 'sol', name: 'Solana (SOL)', symbol: 'SOL', network: 'Solana' },
  { id: 'ltc', name: 'Litecoin (LTC)', symbol: 'LTC', network: 'Litecoin' }
];

interface WalletViewProps {
  onOpenDeposit?: () => void;
  onOpenWithdraw?: () => void;
  onOpenTransactionHistory?: () => void;
}

export default function WalletView({ onOpenDeposit, onOpenWithdraw, onOpenTransactionHistory }: WalletViewProps = {}) {
  const { 
    wallet, 
    withdrawals, 
    depositUSDT, 
    requestWithdrawal, 
    showToast,
    createNowPaymentsInvoice,
    checkDepositStatus,
    platformSettings,
    walletModalTab,
    deposits = [],
    loadingDeposits,
    fetchDeposits,
    cancelDeposit,
    walletLedger = [],
    loadingLedger,
    fetchWalletLedger,
    claimDailyBonus,
    claimDailyFloReward,
    getDailyFloRewardStatus,
    calculateDailyFloReward,
    setActiveTab: setGlobalActiveTab
  } = useLottery();

  const minWithdrawalLimit = typeof platformSettings?.minWithdrawal === 'number' ? platformSettings.minWithdrawal : 5;
  const maxWithdrawalLimit = typeof platformSettings?.maxWithdrawal === 'number' ? platformSettings.maxWithdrawal : 10000;
  const treasuryAddress = platformSettings?.treasuryTrc20 || wallet.depositAddress;

  const [activeTab, setActiveTab] = useState(() => walletModalTab || 'deposit');
  const [ledgerTab, setLedgerTab] = useState('ledger');
  const [depositFilter, setDepositFilter] = useState('all');

  // Live timer for countdown updates
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (walletModalTab) {
      setActiveTab(walletModalTab);
      if (walletModalTab === 'deposit') setLedgerTab('deposits');
      if (walletModalTab === 'withdraw') setLedgerTab('withdrawals');
    }
  }, [walletModalTab]);
  const [selectedNetwork, setSelectedNetwork] = useState('TRC-20');

  // Deposit method: 'nowpayments' | 'direct'
  const [depositMethod, setDepositMethod] = useState('nowpayments');
  const [payCurrency, setPayCurrency] = useState('usdttrc20');
  const [isGeneratingInvoice, setIsGeneratingInvoice] = useState(false);
  const [activeInvoice, setActiveInvoice] = useState<any>(null);
  const [isCheckingStatus, setIsCheckingStatus] = useState(false);
  const [invoiceStatusText, setInvoiceStatusText] = useState('waiting');

  // Deposit amount (Min 20 USDT, Max 500 USDT)
  const [depositAmount, setDepositAmount] = useState('50');

  // Withdrawal form
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [destinationAddress, setDestinationAddress] = useState('');
  const [copied, setCopied] = useState(false);
  const [selectedProofOrder, setSelectedProofOrder] = useState<any>(null);

  // Copy address to clipboard
  const handleCopy = () => {
    navigator.clipboard.writeText(treasuryAddress);
    setCopied(true);
    showToast('Deposit address copied to clipboard!');
    setTimeout(() => setCopied(false), 2000);
  };

  // Preset percentage for withdrawal
  const handlePreset = (pct) => {
    const amt = ((wallet.balance * pct) / 100).toFixed(2);
    setWithdrawAmount(amt);
  };

  const handleWithdrawSubmit = (e) => {
    e.preventDefault();
    requestWithdrawal(withdrawAmount, destinationAddress, selectedNetwork);
  };

  const handleDepositSubmit = (e) => {
    e.preventDefault();
    depositUSDT(depositAmount);
  };

  // NOWPayments invoice generation handler (Min: 20 USDT, Max: 500 USDT)
  const handleNowPaymentsSubmit = async (e) => {
    e.preventDefault();
    const amt = parseFloat(depositAmount);
    if (isNaN(amt) || amt < 20 || amt > 500) {
      showToast('Deposit amount must be between 20 USDT and 500 USDT (Min: 20 USDT, Max: 500 USDT)', 'error');
      return;
    }
    setIsGeneratingInvoice(true);
    try {
      const res = await createNowPaymentsInvoice(amt, payCurrency);
      if (res.success) {
        setActiveInvoice({
          depositId: res.depositId,
          invoiceUrl: res.invoiceUrl,
          invoiceId: res.invoiceId,
          amount: amt,
          currency: payCurrency,
          createdAt: Date.now()
        });
        setInvoiceStatusText('waiting');
        setLedgerTab('deposits');
        if (res.invoiceUrl) {
          window.open(res.invoiceUrl, '_blank', 'noopener,noreferrer');
        }
      }
    } finally {
      setIsGeneratingInvoice(false);
    }
  };

  // Check NOWPayments invoice status
  const handleCheckNowPaymentsStatus = async () => {
    if (!activeInvoice?.depositId) return;
    setIsCheckingStatus(true);
    try {
      const res = await checkDepositStatus(activeInvoice.depositId);
      const depStatus = res?.deposit?.status || res?.status;
      if (depStatus) {
        setInvoiceStatusText(depStatus);
        if (depStatus === 'finished' || depStatus === 'confirmed') {
          showToast('Deposit confirmed! USDT credited to your wallet.', 'success');
          setActiveInvoice(null);
        } else if (depStatus === 'expired' || depStatus === 'failed') {
          showToast('Payment invoice has expired or was cancelled.', 'info');
          setActiveInvoice(null);
        } else {
          showToast(`Invoice status: ${depStatus.toUpperCase()}`, 'info');
        }
      } else {
        showToast('Status check: Waiting for on-chain broadcast', 'info');
      }
    } finally {
      setIsCheckingStatus(false);
    }
  };

  // Auto-poll active invoice status every 6 seconds and check 15m timeout
  useEffect(() => {
    if (!activeInvoice?.depositId) return;

    // Strict 15-minute invoice timeout check
    if (activeInvoice.createdAt && Date.now() - activeInvoice.createdAt > 15 * 60 * 1000) {
      setActiveInvoice(null);
      showToast('Payment invoice expired after 15 minutes without payment.', 'info');
      return;
    }

    const interval = setInterval(async () => {
      // Check timeout
      if (activeInvoice.createdAt && Date.now() - activeInvoice.createdAt > 15 * 60 * 1000) {
        setActiveInvoice(null);
        showToast('Payment invoice expired after 15 minutes without payment.', 'info');
        return;
      }

      try {
        const res = await checkDepositStatus(activeInvoice.depositId);
        const depStatus = res?.deposit?.status || res?.status;
        if (depStatus) {
          setInvoiceStatusText(depStatus);
          if (depStatus === 'finished' || depStatus === 'confirmed') {
            showToast('Deposit confirmed! USDT credited to your wallet.', 'success');
            setActiveInvoice(null);
          } else if (depStatus === 'expired' || depStatus === 'failed') {
            setActiveInvoice(null);
          }
        }
      } catch (err) {
        // silent poll catch
      }
    }, 6000);

    return () => clearInterval(interval);
  }, [activeInvoice]);

  const formatSLATime = (targetMs) => {
    const diff = Math.max(0, targetMs - now);
    const h = Math.floor(diff / (1000 * 60 * 60));
    const m = Math.floor((diff / (1000 * 60)) % 60);
    const s = Math.floor((diff / 1000) % 60);
    return `${h}h ${m}m ${s}s remaining`;
  };

  const pendingWithdrawalsSum = withdrawals
    .filter(w => w.status === 'processing')
    .reduce((sum, w) => sum + w.amount, 0);

  return (
    <div className="w-full max-w-7xl 2xl:max-w-[1600px] 3xl:max-w-[1800px] 4k:max-w-[2000px] mx-auto px-2.5 xs:px-4 sm:px-6 lg:px-8 py-4 sm:py-8 space-y-4 sm:space-y-8">
      
      {/* Portfolio Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        
        {/* Card 1: Available Balance */}
        <div className="glass-panel p-3.5 xs:p-4.5 sm:p-6 rounded-2xl border-l-4 border-l-[#ffd700] relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] xs:text-xs text-[#9b8f7c] font-bold uppercase tracking-wider">
              Available FLO Coins
            </span>
            <div className="w-7 xs:w-8 h-7 xs:h-8 rounded-lg bg-[rgba(245,196,81,0.15)] flex items-center justify-center text-[#ffd700]">
              <Coins className="w-3.5 xs:w-4 h-3.5 xs:h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-1.5 xs:gap-2">
            <span className="font-display font-black text-2xl xs:text-3xl sm:text-4xl text-gold-gradient font-mono-numbers">
              {wallet.balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            <span className="text-xs text-amber-400 font-bold font-mono-numbers">FLO</span>
          </div>
          <span className="text-[10px] xs:text-[11px] text-[#9b8f7c] mt-1 block font-mono-numbers">
            ≈ ${wallet.balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDT · 1 FLO = 1 USDT
          </span>
        </div>

        {/* Card 2: Total Won Prizes */}
        <div className="glass-panel p-3.5 xs:p-4.5 sm:p-6 rounded-2xl border-l-4 border-l-[#05d5aa] relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] xs:text-xs text-[#9b8f7c] font-bold uppercase tracking-wider">
              Total Won Prizes
            </span>
            <div className="w-7 xs:w-8 h-7 xs:h-8 rounded-lg bg-[rgba(5,213,170,0.15)] flex items-center justify-center text-[#05d5aa]">
              <DollarSign className="w-3.5 xs:w-4 h-3.5 xs:h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-1.5 xs:gap-2">
            <span className="font-display font-black text-2xl xs:text-3xl sm:text-4xl text-white">
              {wallet.lifetimeWon.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            <span className="text-xs text-[#05d5aa] font-bold font-mono-numbers">USDT</span>
          </div>
          <span className="text-[10px] xs:text-[11px] text-[#05d5aa] mt-1 block font-semibold">
            Auto-credited directly to balance ✅
          </span>
        </div>

        {/* Card 3: Pending 24h Withdrawals */}
        <div className="glass-panel p-3.5 xs:p-4.5 sm:p-6 rounded-2xl border-l-4 border-l-amber-500 relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] xs:text-xs text-[#9b8f7c] font-bold uppercase tracking-wider">
              Pending 24h Withdrawals
            </span>
            <div className="w-7 xs:w-8 h-7 xs:h-8 rounded-lg bg-amber-500/15 flex items-center justify-center text-amber-400">
              <Clock className="w-3.5 xs:w-4 h-3.5 xs:h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-1.5 xs:gap-2">
            <span className="font-display font-black text-2xl xs:text-3xl sm:text-4xl text-amber-400">
              {pendingWithdrawalsSum.toFixed(2)}
            </span>
            <span className="text-xs text-amber-400 font-bold font-mono-numbers">USDT</span>
          </div>
          <span className="text-[10px] xs:text-[11px] text-amber-400/80 mt-1 block font-mono-numbers">
            Disbursed &lt; 24 Hours
          </span>
        </div>

        {/* Card 4: Connected Wallet Status */}
        <div className="glass-panel p-3.5 xs:p-4.5 sm:p-6 rounded-2xl border-l-4 border-l-[#00f2fe] relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] xs:text-xs text-[#9b8f7c] font-bold uppercase tracking-wider">
              Settlement Network
            </span>
            <div className="w-7 xs:w-8 h-7 xs:h-8 rounded-lg bg-[#00f2fe]/15 flex items-center justify-center text-[#00f2fe]">
              <ShieldCheck className="w-3.5 xs:w-4 h-3.5 xs:h-4" />
            </div>
          </div>
          <div className="font-mono-numbers font-bold text-base xs:text-lg text-white truncate">
            {wallet.address.slice(0, 8)}...{wallet.address.slice(-6)}
          </div>
          <span className="text-[10px] xs:text-[11px] text-[#05d5aa] mt-1 block font-mono-numbers flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-[#05d5aa] animate-ping" />
            Active Non-Custodial Vault
          </span>
        </div>

      </div>

      {/* Main Two-Column Workstation: Deposit & Withdrawal */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6 lg:gap-8">
        
        {/* LEFT COLUMN: Deposit USDT / Multi-Crypto (6 Cols) */}
        <div className="lg:col-span-6 glass-panel rounded-2xl p-3.5 xs:p-4.5 sm:p-6 lg:p-8 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-2 mb-4 sm:mb-5">
              <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-[rgba(5,213,170,0.15)] flex items-center justify-center text-[#05d5aa] border border-[#05d5aa]/30 shrink-0">
                  <ArrowDownLeft className="w-4 h-4 sm:w-5 sm:h-5" />
                </div>
                <div className="min-w-0">
                  <h3 className="font-display font-extrabold text-lg sm:text-xl text-white truncate">
                    Deposit Funds
                  </h3>
                  <p className="text-[11px] xs:text-xs text-[#9b8f7c] truncate">
                    Multi-crypto gateway & automated settlement
                  </p>
                </div>
              </div>

              <span className="text-[10px] xs:text-[11px] font-mono-numbers font-bold px-2 xs:px-2.5 py-1 rounded bg-[#10131a] text-[#05d5aa] border border-[#05d5aa]/30 shrink-0">
                0% Fee
              </span>
            </div>

            {/* Deposit Method Selector */}
            <div className="grid grid-cols-2 gap-1.5 sm:gap-2 p-1 bg-[#0b0e14] rounded-xl border border-[#272a31] mb-5">
              <button
                type="button"
                onClick={() => setDepositMethod('nowpayments')}
                className={`py-2 px-2 sm:px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 sm:gap-2 cursor-pointer ${
                  depositMethod === 'nowpayments'
                    ? 'bg-[#1e2638] text-[#ffd700] border border-[#f5c451]/50 shadow-md'
                    : 'text-[#9b8f7c] hover:text-white'
                }`}
              >
                <CreditCard className="w-3.5 h-3.5 text-[#ffd700] shrink-0" />
                <span className="truncate">NOWPayments</span>
              </button>
              <button
                type="button"
                onClick={() => setDepositMethod('direct')}
                className={`py-2 px-2 sm:px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 sm:gap-2 cursor-pointer ${
                  depositMethod === 'direct'
                    ? 'bg-[#1e2638] text-[#ffd700] border border-[#f5c451]/50 shadow-md'
                    : 'text-[#9b8f7c] hover:text-white'
                }`}
              >
                <Coins className="w-3.5 h-3.5 text-[#05d5aa] shrink-0" />
                <span className="truncate">Direct TRC-20</span>
              </button>
            </div>

            {/* METHOD 1: NOWPAYMENTS GATEWAY */}
            {depositMethod === 'nowpayments' && (
              <div className="space-y-5">
                {/* Active Invoice Card if one exists */}
                {activeInvoice ? (
                  <div className="bg-[#0b0e14] rounded-2xl p-5 border border-[#f5c451]/40 space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-[#9b8f7c] font-semibold">
                          Active Deposit Invoice
                        </span>
                        {activeInvoice.createdAt && (
                          <span className="px-2 py-0.5 rounded bg-amber-500/15 text-amber-300 font-mono-numbers text-[10px] font-bold border border-amber-500/30 flex items-center gap-1">
                            <Clock className="w-3 h-3 animate-spin" />
                            {(() => {
                              const rem = Math.max(0, 15 * 60 * 1000 - (now - activeInvoice.createdAt));
                              const m = Math.floor(rem / 60000);
                              const s = Math.floor((rem % 60000) / 1000);
                              return `Expires in ${m}m ${s < 10 ? '0' : ''}${s}s`;
                            })()}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`px-2.5 py-1 rounded-full text-[11px] font-mono-numbers font-bold flex items-center gap-1.5 ${
                          invoiceStatusText === 'finished' || invoiceStatusText === 'confirmed'
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                            : invoiceStatusText === 'confirming'
                            ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                            : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                        }`}>
                          <span className="w-2 h-2 rounded-full bg-current animate-pulse" />
                          {invoiceStatusText.toUpperCase()}
                        </span>
                      </div>
                    </div>

                    <div className="bg-[#121721] p-4 rounded-xl border border-[#272a31] space-y-2">
                      <div className="flex justify-between text-xs">
                        <span className="text-[#9b8f7c]">Amount to Deposit:</span>
                        <span className="font-mono-numbers font-black text-white text-base">
                          {activeInvoice.amount} USDT
                        </span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-[#9b8f7c]">Payment Asset:</span>
                        <span className="font-mono-numbers font-bold text-[#ffd700]">
                          {PAYMENT_CURRENCIES.find(c => c.id === activeInvoice.currency)?.name || activeInvoice.currency.toUpperCase()}
                        </span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-[#9b8f7c]">Invoice ID:</span>
                        <span className="font-mono-numbers text-white/70">
                          #{activeInvoice.invoiceId || activeInvoice.depositId?.slice(0, 8)}
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-2 pt-1">
                      {activeInvoice.invoiceUrl && (
                        <a
                          href={activeInvoice.invoiceUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="btn-gold flex-1 py-3 rounded-xl font-display font-extrabold text-xs flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-[#f5c451]/20"
                        >
                          <span>Open NOWPayments Checkout</span>
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      )}
                      <button
                        type="button"
                        onClick={handleCheckNowPaymentsStatus}
                        disabled={isCheckingStatus}
                        className="px-4 py-3 rounded-xl bg-[#1a2232] hover:bg-[#222c42] text-xs font-bold text-white border border-[#272a31] flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${isCheckingStatus ? 'animate-spin' : ''}`} />
                        <span>Refresh Status</span>
                      </button>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-[#1e2638] text-[11px] text-[#9b8f7c]">
                      <span>Auto-cancelled after 15 mins if unpaid · Instant webhook confirmation</span>
                      <button
                        type="button"
                        onClick={async () => {
                          if (activeInvoice.depositId) {
                            await cancelDeposit(activeInvoice.depositId);
                          }
                          setActiveInvoice(null);
                        }}
                        className="text-rose-400 hover:text-rose-300 hover:underline cursor-pointer flex items-center gap-1 font-semibold"
                      >
                        <X className="w-3 h-3" />
                        Cancel Order
                      </button>
                    </div>
                  </div>
                ) : (
                  <form onSubmit={handleNowPaymentsSubmit} className="space-y-4">
                    {/* Currency Selector */}
                    <div>
                      <label className="block text-xs text-[#9b8f7c] font-semibold mb-1.5">
                        Choose Payment Cryptocurrency:
                      </label>
                      <select
                        value={payCurrency}
                        onChange={(e) => setPayCurrency(e.target.value)}
                        className="w-full bg-[#0b0e14] border border-[#32353c] focus:border-[#ffd700] rounded-xl px-4 py-3 text-white font-mono-numbers text-xs outline-none cursor-pointer"
                      >
                        {PAYMENT_CURRENCIES.map((c) => (
                          <option key={c.id} value={c.id} className="bg-[#0b0e14] text-white">
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Deposit Amount */}
                    <div>
                      <div className="flex items-center justify-between text-xs mb-1.5">
                        <label className="text-[#9b8f7c] font-semibold">Deposit Amount (USDT equivalent):</label>
                        <span className="font-mono-numbers text-[11px] text-[#05d5aa] font-bold">Min: 20 USDT · Max: 500 USDT</span>
                      </div>
                      <div className="relative">
                        <input
                          type="number"
                          step="1"
                          min="20"
                          max="500"
                          value={depositAmount}
                          onChange={(e) => setDepositAmount(e.target.value)}
                          className="w-full bg-[#0b0e14] border border-[#32353c] focus:border-[#ffd700] rounded-xl pl-4 pr-24 py-3.5 text-white font-mono-numbers font-bold text-lg outline-none"
                          placeholder="e.g. 50"
                          required
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 px-2.5 py-1 rounded-lg bg-[#141924] border border-[#272a31] text-xs font-bold text-[#ffd700] select-none pointer-events-none">
                          USDT
                        </span>
                      </div>

                      {/* Quick Chips */}
                      <div className="grid grid-cols-5 gap-1.5 sm:gap-2 mt-2">
                        {[20, 50, 100, 250, 500].map((amt) => (
                          <button
                            key={amt}
                            type="button"
                            onClick={() => setDepositAmount(String(amt))}
                            className={`w-full py-1.5 rounded-lg text-[11px] font-mono-numbers font-bold border transition-colors cursor-pointer text-center ${
                              depositAmount === String(amt)
                                ? 'bg-[rgba(245,196,81,0.2)] text-[#ffd700] border-[#f5c451]'
                                : 'bg-[#121721] hover:bg-[#1a2232] text-[#9b8f7c] hover:text-white border-[#272a31]'
                            }`}
                          >
                            ${amt}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Submit Button */}
                    <button
                      type="submit"
                      disabled={isGeneratingInvoice}
                      className="btn-gold w-full sm:max-w-xs mx-auto py-2.5 sm:py-3 px-6 rounded-xl font-display font-bold text-xs sm:text-sm flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-[#f5c451]/20 disabled:opacity-50 mt-2 transition-all"
                    >
                      {isGeneratingInvoice ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          <span>Generating Invoice...</span>
                        </>
                      ) : (
                        <>
                          <CreditCard className="w-4 h-4" />
                          <span>Deposit</span>
                        </>
                      )}
                    </button>

                    <div className="p-3 rounded-xl bg-[#0b0e14] border border-[#272a31] flex items-start gap-2.5 text-xs text-[#9b8f7c]">
                      <ShieldCheck className="w-4 h-4 text-[#05d5aa] shrink-0 mt-0.5" />
                      <p className="text-[11px] leading-relaxed">
                        Hosted on NOWPayments official infrastructure. Supports auto-detection of network deposits with real-time webhook confirmation. Unpaid deposits auto-cancel after 15 minutes.
                      </p>
                    </div>
                  </form>
                )}
              </div>
            )}

            {/* METHOD 2: DIRECT TRC-20 ADDRESS */}
            {depositMethod === 'direct' && (
              <div>
                {/* Network Display */}
                <div className="p-1.5 rounded-xl bg-[#0b0e14] border border-[#272a31] mb-5">
                  <div className="py-2 px-3 text-center text-xs font-mono-numbers font-bold rounded-lg bg-[#1e2638] text-[#ffd700] border border-[#f5c451]/50 shadow-md flex items-center justify-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-[#05d5aa] animate-pulse" />
                    <span>Network: TRON (TRC-20 USDT) · Direct Ingress</span>
                  </div>
                </div>

                {/* QR Code & Address Display */}
                <div className="bg-[#0b0e14] rounded-2xl p-5 border border-[#272a31] text-center mb-5">
                  <div className="w-32 h-32 mx-auto bg-white p-2 rounded-xl shadow-lg flex items-center justify-center mb-3">
                    <div className="w-full h-full bg-[#0b0e14] rounded flex flex-col items-center justify-center border-2 border-[#f5c451] p-2 text-center">
                      <QrCode className="w-14 h-14 text-[#ffd700]" />
                      <span className="text-[9px] font-mono-numbers text-[#f5c451] font-bold mt-1">
                        USDT {selectedNetwork}
                      </span>
                    </div>
                  </div>

                  <div className="text-xs text-[#9b8f7c] mb-2 font-medium">
                    Your Personal Non-Custodial Vault Address ({selectedNetwork}):
                  </div>

                  <div className="flex items-center gap-2 bg-[#121721] p-3 rounded-xl border border-[#272a31]">
                    <code className="flex-1 font-mono-numbers text-xs text-white truncate text-left">
                      {treasuryAddress}
                    </code>
                    <button
                      type="button"
                      onClick={handleCopy}
                      className="px-3 py-1.5 rounded-lg bg-[rgba(245,196,81,0.15)] hover:bg-[#f5c451] text-[#ffd700] hover:text-[#0b0e14] text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
                    >
                      {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      {copied ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5 text-xs text-[#9b8f7c] mb-5">
                  <div className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#05d5aa]" />
                    <span>Minimum Deposit: <strong>20.00 USDT</strong> | Maximum: <strong>500.00 USDT</strong></span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#05d5aa]" />
                    <span>Confirmation Time: <strong>1 Network Block (~30 seconds)</strong></span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Quick Simulation Button for Testing */}
          <div className="pt-4 border-t border-[#272a31] mt-6">
            <span className="text-[11px] text-[#9b8f7c] block mb-2 font-semibold">
              QUICK TEST DEPOSIT (INSTANT ON-CHAIN SIMULATION):
            </span>
            <div className="grid grid-cols-2 xs:grid-cols-4 gap-1.5 sm:gap-2">
              {[20, 50, 100, 500].map((amt) => (
                <button
                  key={amt}
                  type="button"
                  onClick={() => depositUSDT(amt)}
                  className="w-full py-2 rounded-xl bg-[rgba(5,213,170,0.12)] hover:bg-[#05d5aa] text-[#05d5aa] hover:text-[#0b0e14] border border-[#05d5aa]/30 text-xs font-bold font-mono-numbers transition-all cursor-pointer text-center"
                >
                  +{amt} USDT
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Withdraw USDT (24-Hour SLA) (6 Cols) */}
        <div className="lg:col-span-6 glass-panel rounded-2xl p-3.5 xs:p-4.5 sm:p-6 lg:p-8 flex flex-col justify-between border border-[rgba(245,196,81,0.35)]">
          <div>
            <div className="flex items-center justify-between gap-2 mb-4 sm:mb-5">
              <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-[rgba(245,196,81,0.15)] flex items-center justify-center text-[#ffd700] border border-[#f5c451]/30 shrink-0">
                  <ArrowUpRight className="w-4 h-4 sm:w-5 sm:h-5" />
                </div>
                <div className="min-w-0">
                  <h3 className="font-display font-extrabold text-lg sm:text-xl text-white truncate">
                    Withdraw USDT
                  </h3>
                  <p className="text-[11px] xs:text-xs text-[#9b8f7c] truncate">
                    Cold-storage multi-sig verified disbursal
                  </p>
                </div>
              </div>

              <div className="badge-gold px-2.5 xs:px-3 py-1 rounded-full text-[10px] xs:text-xs font-bold font-mono-numbers flex items-center gap-1.5 shrink-0">
                <Clock className="w-3 xs:w-3.5 h-3 xs:h-3.5 text-amber-400" />
                <span className="hidden xs:inline">24-Hour</span> Guarantee
              </div>
            </div>

            <form onSubmit={handleWithdrawSubmit} className="space-y-4">
              
              {/* Amount input */}
              <div>
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <label className="text-[#9b8f7c] font-semibold">Withdrawal Amount (USDT):</label>
                  <div className="flex items-center gap-2">
                    <span className="font-mono-numbers text-[11px] text-[#f5c451]">
                      Min: {minWithdrawalLimit} USDT
                    </span>
                    <span className="text-[#3b4150]">|</span>
                    <span className="font-mono-numbers text-xs text-[#05d5aa]">
                      Available: {wallet.balance.toFixed(2)} USDT
                    </span>
                  </div>
                </div>
                <div className="relative">
                  <input
                    type="number"
                    step="0.01"
                    min={minWithdrawalLimit}
                    max={Math.min(maxWithdrawalLimit, wallet.balance)}
                    value={withdrawAmount}
                    onChange={(e) => setWithdrawAmount(e.target.value)}
                    className="w-full bg-[#0b0e14] border border-[#32353c] focus:border-[#ffd700] rounded-xl pl-4 pr-24 py-3.5 text-white font-mono-numbers font-bold text-lg outline-none"
                    placeholder={`e.g. ${minWithdrawalLimit}`}
                    required
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 px-2.5 py-1 rounded-lg bg-[#141924] border border-[#272a31] text-xs font-bold text-[#ffd700] select-none pointer-events-none">
                    USDT
                  </span>
                </div>

                {/* Percentage Presets */}
                <div className="grid grid-cols-4 gap-1.5 sm:gap-2 mt-2">
                  {[25, 50, 75, 100].map((pct) => (
                    <button
                      key={pct}
                      type="button"
                      onClick={() => handlePreset(pct)}
                      className="w-full py-1.5 rounded-lg bg-[#121721] hover:bg-[#1a2232] text-[11px] font-mono-numbers text-[#9b8f7c] hover:text-white border border-[#272a31] text-center cursor-pointer transition-colors"
                    >
                      {pct === 100 ? 'MAX' : `${pct}%`}
                    </button>
                  ))}
                </div>
              </div>

              {/* Destination Address */}
              <div>
                <label className="block text-xs text-[#9b8f7c] font-semibold mb-1.5">
                  Recipient Destination USDT Address ({selectedNetwork}):
                </label>
                <input
                  type="text"
                  value={destinationAddress}
                  onChange={(e) => setDestinationAddress(e.target.value)}
                  className="w-full bg-[#0b0e14] border border-[#32353c] focus:border-[#ffd700] rounded-xl px-4 py-3 text-white font-mono-numbers text-xs outline-none"
                  placeholder="Paste TRC-20 Address (starts with T...)"
                  required
                />
              </div>

              {/* Breakdown Box */}
              <div className="bg-[#0b0e14] p-4 rounded-xl border border-[#272a31] space-y-2 text-xs">
                <div className="flex justify-between text-[#9b8f7c]">
                  <span>Requested Amount:</span>
                  <span className="font-mono-numbers text-white font-bold">{parseFloat(withdrawAmount || '0').toFixed(2)} USDT</span>
                </div>
                <div className="flex justify-between text-[#9b8f7c]">
                  <span>Network Fee:</span>
                  <span className="font-mono-numbers text-white font-bold">1.00 USDT ({selectedNetwork})</span>
                </div>
                <div className="flex justify-between text-sm pt-2 border-t border-[#1f2737]">
                  <span className="font-bold text-white">Net Disbursal Amount:</span>
                  <span className="font-display font-black text-[#ffd700] text-base font-mono-numbers">
                    {Math.max(0, (parseFloat(withdrawAmount || '0') - 1.0)).toFixed(2)} USDT
                  </span>
                </div>
              </div>

              {/* SLA Guarantee Notice */}
              <div className="p-3.5 rounded-xl bg-amber-950/20 border border-amber-500/30 flex items-start gap-3">
                <Clock className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                <p className="text-[11px] text-amber-200/90 leading-relaxed">
                  <strong>24-Hour Guarantee:</strong> All withdrawal requests are processed within 24 hours via multi-sig security. Average disbursement takes 2–4 hours.
                </p>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                className="btn-gold w-full sm:max-w-xs mx-auto py-2.5 sm:py-3 px-6 rounded-xl font-display font-bold text-xs sm:text-sm flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-[#f5c451]/20 transition-all whitespace-nowrap"
              >
                <ArrowUpRight className="w-4 h-4" />
                <span>Request Withdrawal</span>
              </button>

              {/* Supporting 24-Hour Notice Label */}
              <div className="flex items-center justify-center gap-1.5 text-[11px] text-[#9b8f7c] text-center pt-1">
                <Clock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span>Disbursement guaranteed within <strong className="text-amber-300">24 Hours</strong></span>
              </div>
            </form>
          </div>
        </div>

      </div>

      {/* Dedicated Transaction History Navigation Button */}
      <div className="pt-2 pb-6">
        <button
          type="button"
          onClick={() => {
            if (onOpenTransactionHistory) {
              onOpenTransactionHistory();
            } else if (setGlobalActiveTab) {
              setGlobalActiveTab('transactions');
            }
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          className="w-full py-4 px-6 rounded-2xl btn-gold text-[#0B0F19] font-display font-extrabold text-sm sm:text-base shadow-xl shadow-amber-500/20 hover:scale-[1.01] active:scale-98 transition-all flex items-center justify-center gap-2.5 cursor-pointer"
        >
          <History className="w-5 h-5 text-black" />
          <span>Transaction History</span>
        </button>
      </div>

    </div>
  );
}
