import React, { useState, useEffect } from 'react';
import { useLottery } from '../context/LotteryContext';
import {
  ArrowDownLeft,
  ArrowUpRight,
  Clock,
  Copy,
  Check,
  ShieldCheck,
  ExternalLink,
  AlertCircle,
  DollarSign,
  RefreshCw,
  Coins,
  CheckCircle2,
  X,
  History
} from 'lucide-react';

const SUPPORTED_DEPOSIT_ASSET = {
  id: 'usdttrc20',
  label: 'USDT — TRON (TRC-20)',
  symbol: 'USDT',
  network: 'TRC-20'
} as const;

const QUICK_DEPOSIT_AMOUNTS = [20, 50, 100, 250, 500];
const WITHDRAW_PERCENT_PRESETS = [25, 50, 75, 100];
const TRC20_ADDRESS_REGEX = /^T[1-9A-HJ-NP-Za-km-z]{33}$/;

interface WalletViewProps {
  onOpenDeposit?: () => void;
  onOpenWithdraw?: () => void;
  onOpenTransactionHistory?: () => void;
}

export default function WalletView({ onOpenTransactionHistory }: WalletViewProps = {}) {
  const {
    wallet,
    withdrawals,
    requestWithdrawal,
    showToast,
    createNowPaymentsInvoice,
    checkDepositStatus,
    platformSettings,
    cancelDeposit,
    setActiveTab: setGlobalActiveTab
  } = useLottery();

  const minWithdrawalLimit = typeof platformSettings?.minWithdrawal === 'number' ? platformSettings.minWithdrawal : 5;
  const maxWithdrawalLimit = typeof platformSettings?.maxWithdrawal === 'number' ? platformSettings.maxWithdrawal : 10000;
  const selectedNetwork = 'TRC-20';
  const networkFee = 1.0;

  // Live timer for invoice expiry countdown
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Deposit state (Strictly USDT on TRON TRC-20, backed internally by verified payment processor)
  const [depositAmount, setDepositAmount] = useState('50');
  const [depositError, setDepositError] = useState('');
  const [isGeneratingInvoice, setIsGeneratingInvoice] = useState(false);
  const [activeInvoice, setActiveInvoice] = useState<any>(null);
  const [isCheckingStatus, setIsCheckingStatus] = useState(false);
  const [invoiceStatusText, setInvoiceStatusText] = useState('waiting');

  // Withdrawal state (Preserves TRC-20 disbursal & fee calculations)
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [destinationAddress, setDestinationAddress] = useState('');
  const [withdrawError, setWithdrawError] = useState('');
  const [isSubmittingWithdrawal, setIsSubmittingWithdrawal] = useState(false);
  const [copiedSettlement, setCopiedSettlement] = useState(false);

  const safeBalance = Number(wallet?.balance || 0);
  const safeLifetimeWon = Number(wallet?.lifetimeWon || 0);
  const walletIdentifier = String(wallet?.address || 'TRC-20 Vault');

  const pendingWithdrawalsSum = (withdrawals || [])
    .filter((w: any) => w.status === 'processing')
    .reduce((sum: number, w: any) => sum + Number(w.amount || 0), 0);

  const handleCopySettlement = async () => {
    if (!wallet?.address) return;
    try {
      await navigator.clipboard.writeText(wallet.address);
      setCopiedSettlement(true);
      showToast('Settlement identifier copied to clipboard!', 'success');
      setTimeout(() => setCopiedSettlement(false), 2000);
    } catch {
      showToast('Copy unavailable in this browser context', 'info');
    }
  };

  // Preset percentage for withdrawal (25%, 50%, 75%, MAX)
  const handleWithdrawPreset = (pct: number) => {
    setWithdrawError('');
    const amt = ((safeBalance * pct) / 100).toFixed(2);
    setWithdrawAmount(amt);
  };

  const handleWithdrawSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmittingWithdrawal) return;

    const amt = parseFloat(withdrawAmount);
    const trimmedDest = destinationAddress.trim();

    if (isNaN(amt) || amt <= 0) {
      setWithdrawError('Please enter a valid USDT withdrawal amount.');
      return;
    }
    if (amt < minWithdrawalLimit) {
      setWithdrawError(`Minimum withdrawal amount is ${minWithdrawalLimit} USDT.`);
      return;
    }
    if (amt > maxWithdrawalLimit) {
      setWithdrawError(`Maximum withdrawal amount is ${maxWithdrawalLimit.toLocaleString()} USDT.`);
      return;
    }
    if (amt > safeBalance) {
      setWithdrawError('Withdrawal amount exceeds your available USDT balance.');
      return;
    }
    if (!TRC20_ADDRESS_REGEX.test(trimmedDest)) {
      setWithdrawError('Please enter a valid 34-character TRON (TRC-20) address starting with T.');
      return;
    }
    if (amt <= networkFee) {
      setWithdrawError(`Withdrawal amount must exceed the ${networkFee.toFixed(2)} USDT TRC-20 network fee.`);
      return;
    }

    setWithdrawError('');
    setIsSubmittingWithdrawal(true);
    try {
      const ok = await requestWithdrawal(withdrawAmount, trimmedDest, selectedNetwork);
      if (ok) {
        setWithdrawAmount('');
        setDestinationAddress('');
      }
    } finally {
      setIsSubmittingWithdrawal(false);
    }
  };

  // Unified Deposit Handler (Strictly USDT TRC-20 via backend payment creation API)
  const handleDepositSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isGeneratingInvoice) return;

    const amt = parseFloat(depositAmount);
    if (isNaN(amt) || amt < 20 || amt > 500) {
      const msg = 'Deposit amount must be between 20 USDT and 500 USDT.';
      setDepositError(msg);
      showToast('Deposit amount must be between 20 USDT and 500 USDT (Min: 20 USDT, Max: 500 USDT)', 'error');
      return;
    }

    setDepositError('');
    setIsGeneratingInvoice(true);
    try {
      const res = await createNowPaymentsInvoice(amt, SUPPORTED_DEPOSIT_ASSET.id);
      if (res?.success) {
        setActiveInvoice({
          depositId: res.depositId,
          invoiceUrl: res.invoiceUrl,
          invoiceId: res.invoiceId,
          payAddress: res.payAddress,
          payAmount: res.payAmount || amt,
          amount: amt,
          currency: SUPPORTED_DEPOSIT_ASSET.id,
          createdAt: Date.now()
        });
        setInvoiceStatusText('waiting');
        if (res.invoiceUrl) {
          window.open(res.invoiceUrl, '_blank', 'noopener,noreferrer');
        }
      } else if (res?.error) {
        setDepositError(res.error);
      }
    } finally {
      setIsGeneratingInvoice(false);
    }
  };

  const handleCheckInvoiceStatus = async () => {
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
          showToast('Deposit request expired or was cancelled.', 'info');
          setActiveInvoice(null);
        } else {
          showToast(`Deposit status: ${depStatus.toUpperCase()}`, 'info');
        }
      } else {
        showToast('Status check: Waiting for network confirmation', 'info');
      }
    } finally {
      setIsCheckingStatus(false);
    }
  };

  // Auto-poll active deposit invoice every 6s with 15-minute expiration check
  useEffect(() => {
    if (!activeInvoice?.depositId) return;

    if (activeInvoice.createdAt && Date.now() - activeInvoice.createdAt > 15 * 60 * 1000) {
      setActiveInvoice(null);
      showToast('Deposit request expired after 15 minutes without payment.', 'info');
      return;
    }

    const interval = setInterval(async () => {
      if (activeInvoice.createdAt && Date.now() - activeInvoice.createdAt > 15 * 60 * 1000) {
        setActiveInvoice(null);
        showToast('Deposit request expired after 15 minutes without payment.', 'info');
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
      } catch {
        // Silent background status poll
      }
    }, 6000);

    return () => clearInterval(interval);
  }, [activeInvoice]);

  const parsedWithdrawAmt = parseFloat(withdrawAmount || '0');
  const netWithdrawAmt = parsedWithdrawAmt > 0 ? Math.max(0, parsedWithdrawAmt - networkFee) : 0;

  return (
    <div
      data-testid="wallet-view"
      className="w-full max-w-[1360px] mx-auto px-2.5 xs:px-4 sm:px-6 lg:px-8 py-3.5 sm:py-6 space-y-4 sm:space-y-6 text-left box-border overflow-x-clip"
    >
      {/* ====================================================================
          SECTION A: WALLET SUMMARY (4 Responsive Cards)
      ==================================================================== */}
      <section
        data-testid="wallet-summary-grid"
        aria-label="Wallet Summary"
        className="grid grid-cols-1 min-[360px]:grid-cols-2 xl:grid-cols-4 gap-2.5 sm:gap-4"
      >
        {/* Card 1: Available USDT Balance */}
        <article
          data-testid="wallet-card-balance"
          className="glass-panel rounded-2xl p-3 sm:p-4 lg:p-5 border border-[#1F2737] border-l-4 border-l-purple-500 flex flex-col justify-between gap-2 min-w-0 h-full"
        >
          <div className="flex items-start justify-between gap-2 min-w-0">
            <span className="text-[10.5px] sm:text-xs text-[#94A3B8] font-bold uppercase tracking-wider leading-tight">
              Available USDT Balance
            </span>
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-purple-500/15 border border-purple-500/25 flex items-center justify-center text-purple-400 shrink-0">
              <Coins className="w-3.5 h-3.5 sm:w-4 sm:h-4" aria-hidden="true" />
            </div>
          </div>

          <div className="flex items-baseline gap-1.5 min-w-0">
            <span
              className="font-display font-black text-lg sm:text-2xl lg:text-[26px] text-purple-200 font-mono-numbers tracking-tight truncate"
              title={`${safeBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 6 })} USDT`}
            >
              {safeBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            <span className="text-[10.5px] sm:text-xs text-purple-400 font-bold font-mono-numbers shrink-0">
              USDT
            </span>
          </div>

          <span className="text-[10px] sm:text-[11px] text-[#94A3B8] font-mono-numbers truncate">
            TRC-20 Network Settlement
          </span>
        </article>

        {/* Card 2: Total Won Prizes */}
        <article
          data-testid="wallet-card-winnings"
          className="glass-panel rounded-2xl p-3 sm:p-4 lg:p-5 border border-[#1F2737] border-l-4 border-l-emerald-400 flex flex-col justify-between gap-2 min-w-0 h-full"
        >
          <div className="flex items-start justify-between gap-2 min-w-0">
            <span className="text-[10.5px] sm:text-xs text-[#94A3B8] font-bold uppercase tracking-wider leading-tight">
              Total Won Prizes
            </span>
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center text-emerald-400 shrink-0">
              <DollarSign className="w-3.5 h-3.5 sm:w-4 sm:h-4" aria-hidden="true" />
            </div>
          </div>

          <div className="flex items-baseline gap-1.5 min-w-0">
            <span
              className="font-display font-black text-lg sm:text-2xl lg:text-[26px] text-white font-mono-numbers tracking-tight truncate"
              title={`${safeLifetimeWon.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 6 })} USDT`}
            >
              {safeLifetimeWon.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            <span className="text-[10.5px] sm:text-xs text-emerald-400 font-bold font-mono-numbers shrink-0">
              USDT
            </span>
          </div>

          <span className="text-[10px] sm:text-[11px] text-emerald-400 font-semibold inline-flex items-center gap-1 min-w-0 truncate">
            <CheckCircle2 className="w-3 h-3 shrink-0" aria-hidden="true" />
            <span className="truncate">Auto-credited directly to balance</span>
          </span>
        </article>

        {/* Card 3: Pending 24H Withdrawal */}
        <article
          data-testid="wallet-card-pending"
          className="glass-panel rounded-2xl p-3 sm:p-4 lg:p-5 border border-[#1F2737] border-l-4 border-l-amber-400 flex flex-col justify-between gap-2 min-w-0 h-full"
        >
          <div className="flex items-start justify-between gap-2 min-w-0">
            <span className="text-[10.5px] sm:text-xs text-[#94A3B8] font-bold uppercase tracking-wider leading-tight">
              Pending 24H Withdrawal
            </span>
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-amber-500/15 border border-amber-500/25 flex items-center justify-center text-amber-400 shrink-0">
              <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4" aria-hidden="true" />
            </div>
          </div>

          <div className="flex items-baseline gap-1.5 min-w-0">
            <span
              className="font-display font-black text-lg sm:text-2xl lg:text-[26px] text-amber-300 font-mono-numbers tracking-tight truncate"
              title={`${pendingWithdrawalsSum.toFixed(2)} USDT`}
            >
              {pendingWithdrawalsSum.toFixed(2)}
            </span>
            <span className="text-[10.5px] sm:text-xs text-amber-400 font-bold font-mono-numbers shrink-0">
              USDT
            </span>
          </div>

          <span className="text-[10px] sm:text-[11px] text-amber-300/85 font-mono-numbers truncate">
            Disbursed &lt; 24 Hours
          </span>
        </article>

        {/* Card 4: Settlement Network */}
        <article
          data-testid="wallet-card-network"
          className="glass-panel rounded-2xl p-3 sm:p-4 lg:p-5 border border-[#1F2737] border-l-4 border-l-cyan-400 flex flex-col justify-between gap-2 min-w-0 h-full"
        >
          <div className="flex items-start justify-between gap-2 min-w-0">
            <span className="text-[10.5px] sm:text-xs text-[#94A3B8] font-bold uppercase tracking-wider leading-tight">
              Settlement Network
            </span>
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-cyan-400/15 border border-cyan-400/25 flex items-center justify-center text-cyan-400 shrink-0">
              <ShieldCheck className="w-3.5 h-3.5 sm:w-4 sm:h-4" aria-hidden="true" />
            </div>
          </div>

          <div className="flex items-center justify-between gap-1.5 min-w-0">
            <span
              data-testid="settlement-address-value"
              className="font-mono-numbers font-bold text-sm sm:text-base lg:text-lg text-white tracking-tight truncate min-w-0"
              title={walletIdentifier}
            >
              {walletIdentifier.length > 16
                ? `${walletIdentifier.slice(0, 7)}...${walletIdentifier.slice(-5)}`
                : walletIdentifier}
            </span>

            {wallet?.address && (
              <button
                type="button"
                onClick={handleCopySettlement}
                aria-label="Copy full settlement identifier"
                title={walletIdentifier}
                className="p-1.5 rounded-lg bg-[#0B0F19] hover:bg-[#171F30] border border-[#253045] text-[#CBD5E1] hover:text-amber-300 transition-colors cursor-pointer shrink-0"
              >
                {copiedSettlement ? (
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
              </button>
            )}
          </div>

          <span className="text-[10px] sm:text-[11px] text-emerald-400 font-mono-numbers inline-flex items-center gap-1.5 min-w-0 truncate">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
            <span className="truncate">Active Non-Custodial Vault</span>
          </span>
        </article>
      </section>

      {/* ====================================================================
          SECTIONS B & C: DEPOSIT FUNDS & WITHDRAW USDT
          - Mobile / Tablet (<1024px): Deposit Funds stacked above Withdraw USDT
          - Laptop / Desktop (1024px+): Balanced 2-Column Side-by-Side
      ==================================================================== */}
      <div
        data-testid="wallet-transactions-grid"
        className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-5 lg:gap-6 items-stretch"
      >
        {/* SECTION B — DEPOSIT FUNDS (Completely Neutral UI, NOWPayments Backend Only) */}
        <section
          data-testid="deposit-funds-section"
          aria-label="Deposit Funds"
          className="lg:col-span-6 glass-panel rounded-2xl border border-[#1F2737] p-3.5 xs:p-4 sm:p-6 flex flex-col justify-between min-w-0"
        >
          <div className="space-y-4">
            {/* Heading + Generic Icon + Fee Pill */}
            <div className="flex items-start sm:items-center justify-between gap-2 pb-3 border-b border-[#1F2737]">
              <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-emerald-500/15 flex items-center justify-center text-emerald-400 border border-emerald-500/30 shrink-0">
                  <ArrowDownLeft className="w-4 h-4 sm:w-5 sm:h-5" aria-hidden="true" />
                </div>
                <div className="min-w-0">
                  <h2 className="font-display font-extrabold text-base sm:text-xl text-white leading-tight">
                    Deposit Funds
                  </h2>
                  <p className="text-[11px] sm:text-xs text-[#94A3B8] leading-snug mt-0.5">
                    USDT (TRON TRC-20) automated settlement
                  </p>
                </div>
              </div>

              <span className="text-[10px] sm:text-[11px] font-mono-numbers font-bold px-2.5 py-1 rounded-lg bg-[#0B0F19] text-emerald-400 border border-emerald-500/30 whitespace-nowrap shrink-0">
                0% Fee
              </span>
            </div>

            {activeInvoice ? (
              <div
                data-testid="active-deposit-invoice"
                className="bg-[#0B0F19] rounded-2xl p-4 sm:p-5 border border-amber-400/40 space-y-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs text-[#94A3B8] font-semibold">
                      Active Deposit Invoice
                    </span>
                    {activeInvoice.createdAt && (
                      <span className="px-2 py-0.5 rounded bg-amber-500/15 text-amber-300 font-mono-numbers text-[10px] font-bold border border-amber-500/30 inline-flex items-center gap-1">
                        <Clock className="w-3 h-3 animate-spin" aria-hidden="true" />
                        {(() => {
                          const rem = Math.max(0, 15 * 60 * 1000 - (now - activeInvoice.createdAt));
                          const m = Math.floor(rem / 60000);
                          const s = Math.floor((rem % 60000) / 1000);
                          return `Expires in ${m}m ${s < 10 ? '0' : ''}${s}s`;
                        })()}
                      </span>
                    )}
                  </div>

                  <span
                    className={`px-2.5 py-1 rounded-full text-[11px] font-mono-numbers font-bold inline-flex items-center gap-1.5 ${
                      invoiceStatusText === 'finished' || invoiceStatusText === 'confirmed'
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                        : invoiceStatusText === 'confirming'
                          ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                          : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                    }`}
                  >
                    <span className="w-2 h-2 rounded-full bg-current animate-pulse" />
                    {invoiceStatusText.toUpperCase()}
                  </span>
                </div>

                <div className="bg-[#121721] p-3.5 sm:p-4 rounded-xl border border-[#1F2737] space-y-2">
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="text-[#94A3B8]">Amount to Deposit:</span>
                    <span className="font-mono-numbers font-black text-white text-sm sm:text-base">
                      {activeInvoice.amount} USDT
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="text-[#94A3B8]">Asset &amp; Network:</span>
                    <span className="font-mono-numbers font-bold text-amber-300 text-right truncate">
                      {SUPPORTED_DEPOSIT_ASSET.label}
                    </span>
                  </div>
                  {activeInvoice.payAddress && (
                    <div className="flex flex-col gap-1 text-xs pt-1 border-t border-[#1F2737]">
                      <span className="text-[#94A3B8]">TRC-20 Deposit Address:</span>
                      <div className="flex items-center justify-between gap-2 bg-[#0B0F19] px-2.5 py-2 rounded-lg border border-[#253045]">
                        <span className="font-mono-numbers text-white text-[11px] truncate select-all">
                          {activeInvoice.payAddress}
                        </span>
                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              await navigator.clipboard.writeText(activeInvoice.payAddress);
                              showToast('TRC-20 deposit address copied!', 'success');
                            } catch {
                              showToast('Copy unavailable', 'info');
                            }
                          }}
                          className="p-1 rounded bg-[#141924] text-amber-300 hover:text-amber-200 cursor-pointer shrink-0"
                          aria-label="Copy TRC-20 deposit address"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  )}
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="text-[#94A3B8]">Reference ID:</span>
                    <span className="font-mono-numbers text-white/80">
                      #{activeInvoice.invoiceId || activeInvoice.depositId?.slice(0, 8)}
                    </span>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-2">
                  {activeInvoice.invoiceUrl && (
                    <a
                      href={activeInvoice.invoiceUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="btn-gold flex-1 min-h-[44px] px-4 py-2.5 rounded-xl font-display font-extrabold text-xs sm:text-sm text-black flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-amber-500/20 whitespace-nowrap"
                    >
                      <span>Open Secure Checkout</span>
                      <ExternalLink className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                    </a>
                  )}
                  <button
                    type="button"
                    onClick={handleCheckInvoiceStatus}
                    disabled={isCheckingStatus}
                    className="min-h-[44px] px-4 py-2.5 rounded-xl bg-[#1A2232] hover:bg-[#222C42] text-xs font-bold text-white border border-[#273145] flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 whitespace-nowrap"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 shrink-0 ${isCheckingStatus ? 'animate-spin' : ''}`} />
                    <span>Refresh Status</span>
                  </button>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[#1E2638] text-[11px] text-[#94A3B8]">
                  <span>Unpaid invoices auto-expire after 15 minutes</span>
                  <button
                    type="button"
                    onClick={async () => {
                      if (activeInvoice.depositId) {
                        await cancelDeposit(activeInvoice.depositId);
                      }
                      setActiveInvoice(null);
                    }}
                    className="text-rose-400 hover:text-rose-300 hover:underline cursor-pointer inline-flex items-center gap-1 font-semibold"
                  >
                    <X className="w-3 h-3" aria-hidden="true" />
                    <span>Cancel Order</span>
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleDepositSubmit} className="space-y-4">
                {/* Locked Asset & Network Display (USDT TRC-20 Only) */}
                <div>
                  <span className="block text-xs text-[#CBD5E1] font-semibold mb-1.5">
                    Asset &amp; Network
                  </span>
                  <div
                    data-testid="deposit-network-badge"
                    className="w-full min-h-[44px] bg-[#0B0F19] border border-emerald-500/35 rounded-xl px-3.5 py-2.5 flex items-center justify-between gap-2 min-w-0"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
                      <span className="font-mono-numbers font-bold text-white text-xs sm:text-sm truncate">
                        {SUPPORTED_DEPOSIT_ASSET.label}
                      </span>
                    </div>
                    <span className="px-2 py-0.5 rounded-md bg-emerald-500/15 border border-emerald-500/30 text-[10px] font-mono-numbers font-bold text-emerald-400 uppercase whitespace-nowrap shrink-0">
                      TRC-20 Only
                    </span>
                  </div>
                </div>

                {/* Deposit Amount Input */}
                <div>
                  <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1 text-xs mb-1.5">
                    <label htmlFor="deposit-amount-input" className="text-[#CBD5E1] font-semibold">
                      Deposit Amount (USDT)
                    </label>
                    <span className="font-mono-numbers text-[11px] text-emerald-400 font-bold whitespace-nowrap">
                      Min: 20 USDT · Max: 500 USDT
                    </span>
                  </div>

                  <div className="relative">
                    <input
                      id="deposit-amount-input"
                      data-testid="deposit-amount-input"
                      type="number"
                      step="1"
                      min="20"
                      max="500"
                      value={depositAmount}
                      onChange={(e) => {
                        setDepositAmount(e.target.value);
                        setDepositError('');
                      }}
                      className="w-full bg-[#0B0F19] border border-[#2D3545] focus:border-amber-400 rounded-xl pl-3.5 pr-20 py-3 text-white font-mono-numbers font-bold text-base sm:text-lg outline-none transition-colors"
                      placeholder="e.g. 50"
                      required
                    />
                    <span className="absolute right-2.5 top-1/2 -translate-y-1/2 px-2.5 py-1 rounded-lg bg-[#141924] border border-[#273145] text-[11px] font-bold text-amber-300 font-mono-numbers select-none pointer-events-none">
                      USDT
                    </span>
                  </div>

                  {/* Quick Amount Selection Buttons */}
                  <div
                    data-testid="deposit-quick-amounts"
                    className="grid grid-cols-3 min-[380px]:grid-cols-5 gap-1.5 sm:gap-2 mt-2"
                  >
                    {QUICK_DEPOSIT_AMOUNTS.map((amt) => {
                      const isSelected = depositAmount === String(amt);
                      return (
                        <button
                          key={amt}
                          type="button"
                          onClick={() => {
                            setDepositAmount(String(amt));
                            setDepositError('');
                          }}
                          className={`w-full min-h-[38px] py-1.5 px-2 rounded-lg text-[11px] font-mono-numbers font-bold border transition-colors cursor-pointer text-center whitespace-nowrap ${
                            isSelected
                              ? 'bg-amber-500/20 text-amber-300 border-amber-400'
                              : 'bg-[#121721] hover:bg-[#1A2232] text-[#94A3B8] hover:text-white border-[#253045]'
                          }`}
                        >
                          {amt} USDT
                        </button>
                      );
                    })}
                  </div>
                </div>

                {depositError && (
                  <div
                    role="alert"
                    className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/35 text-rose-300 text-xs flex items-start gap-2"
                  >
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
                    <span>{depositError}</span>
                  </div>
                )}

                {/* Deposit Submission Button */}
                <button
                  type="submit"
                  data-testid="deposit-submit-button"
                  disabled={isGeneratingInvoice}
                  className="btn-gold w-full min-h-[44px] py-3 px-6 rounded-xl font-display font-black text-xs sm:text-sm text-black flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-amber-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-[0.98]"
                >
                  {isGeneratingInvoice ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin shrink-0" aria-hidden="true" />
                      <span>Processing Deposit...</span>
                    </>
                  ) : (
                    <>
                      <ArrowDownLeft className="w-4 h-4 shrink-0" aria-hidden="true" />
                      <span>Proceed to Deposit</span>
                    </>
                  )}
                </button>

                <div className="p-3 rounded-xl bg-[#0B0F19] border border-[#1F2737] flex items-start gap-2.5 text-xs text-[#94A3B8]">
                  <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" aria-hidden="true" />
                  <p className="text-[11px] leading-relaxed">
                    Automated crypto deposit verification with real-time settlement. Unpaid deposit requests expire automatically after 15 minutes.
                  </p>
                </div>
              </form>
            )}
          </div>
        </section>

        {/* SECTION C — WITHDRAW USDT (Preserves TRC-20 Withdrawal Flow 100%) */}
        <section
          data-testid="withdraw-usdt-section"
          aria-label="Withdraw USDT"
          className="lg:col-span-6 glass-panel rounded-2xl border border-amber-500/30 p-3.5 xs:p-4 sm:p-6 flex flex-col justify-between min-w-0"
        >
          <div className="space-y-4">
            {/* Header + 24h Badge */}
            <div className="flex items-start sm:items-center justify-between gap-2 pb-3 border-b border-[#1F2737]">
              <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-amber-500/15 flex items-center justify-center text-amber-300 border border-amber-500/30 shrink-0">
                  <ArrowUpRight className="w-4 h-4 sm:w-5 sm:h-5" aria-hidden="true" />
                </div>
                <div className="min-w-0">
                  <h2 className="font-display font-extrabold text-base sm:text-xl text-white leading-tight">
                    Withdraw USDT
                  </h2>
                  <p className="text-[11px] sm:text-xs text-[#94A3B8] leading-snug mt-0.5">
                    Cold-storage multi-sig verified disbursal
                  </p>
                </div>
              </div>

              <span className="badge-gold px-2.5 py-1 rounded-full text-[10px] sm:text-[11px] font-bold font-mono-numbers inline-flex items-center gap-1.5 whitespace-nowrap shrink-0">
                <Clock className="w-3 h-3 text-amber-400 shrink-0" aria-hidden="true" />
                <span>24-Hour SLA</span>
              </span>
            </div>

            <form onSubmit={handleWithdrawSubmit} className="space-y-4">
              {/* Locked Asset & Network Indicator (USDT TRC-20 Only) */}
              <div>
                <span className="block text-xs text-[#CBD5E1] font-semibold mb-1.5">
                  Asset &amp; Settlement Network
                </span>
                <div
                  data-testid="withdraw-network-badge"
                  className="w-full min-h-[44px] bg-[#0B0F19] border border-amber-500/35 rounded-xl px-3.5 py-2.5 flex items-center justify-between gap-2 min-w-0"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
                    <span className="font-mono-numbers font-bold text-white text-xs sm:text-sm truncate">
                      USDT — TRON (TRC-20)
                    </span>
                  </div>
                  <span className="px-2 py-0.5 rounded-md bg-amber-500/15 border border-amber-500/30 text-[10px] font-mono-numbers font-bold text-amber-300 uppercase whitespace-nowrap shrink-0">
                    TRC-20 Only
                  </span>
                </div>
              </div>

              {/* Withdrawal Amount Input */}
              <div>
                <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1 text-xs mb-1.5">
                  <label htmlFor="withdraw-amount-input" className="text-[#CBD5E1] font-semibold">
                    Withdrawal Amount (USDT)
                  </label>
                  <div className="flex items-center gap-2 font-mono-numbers text-[11px] flex-wrap">
                    <span className="text-amber-300 font-bold">
                      Min: {minWithdrawalLimit} USDT
                    </span>
                    <span className="text-[#3B4150]">|</span>
                    <span className="text-emerald-400 font-bold">
                      Available: {safeBalance.toFixed(2)} USDT
                    </span>
                  </div>
                </div>

                <div className="relative">
                  <input
                    id="withdraw-amount-input"
                    data-testid="withdraw-amount-input"
                    type="number"
                    step="0.01"
                    min={minWithdrawalLimit}
                    max={Math.min(maxWithdrawalLimit, safeBalance)}
                    value={withdrawAmount}
                    onChange={(e) => {
                      setWithdrawAmount(e.target.value);
                      setWithdrawError('');
                    }}
                    className="w-full bg-[#0B0F19] border border-[#2D3545] focus:border-amber-400 rounded-xl pl-3.5 pr-20 py-3 text-white font-mono-numbers font-bold text-base sm:text-lg outline-none transition-colors"
                    placeholder={`Min ${minWithdrawalLimit} USDT`}
                    required
                  />
                  <span className="absolute right-2.5 top-1/2 -translate-y-1/2 px-2.5 py-1 rounded-lg bg-[#141924] border border-[#273145] text-[11px] font-bold text-amber-300 font-mono-numbers select-none pointer-events-none">
                    USDT
                  </span>
                </div>

                {/* Quick Percentage Buttons (25%, 50%, 75%, MAX) */}
                <div
                  data-testid="withdraw-percent-presets"
                  className="grid grid-cols-4 gap-1.5 sm:gap-2 mt-2"
                >
                  {WITHDRAW_PERCENT_PRESETS.map((pct) => (
                    <button
                      key={pct}
                      type="button"
                      onClick={() => handleWithdrawPreset(pct)}
                      className="w-full min-h-[38px] py-1.5 rounded-lg bg-[#121721] hover:bg-[#1A2232] text-[11px] font-mono-numbers font-bold text-[#94A3B8] hover:text-white border border-[#253045] text-center cursor-pointer transition-colors"
                    >
                      {pct === 100 ? 'MAX' : `${pct}%`}
                    </button>
                  ))}
                </div>
              </div>

              {/* Recipient Destination USDT Address */}
              <div>
                <label
                  htmlFor="withdraw-destination-input"
                  className="block text-xs text-[#CBD5E1] font-semibold mb-1.5"
                >
                  Recipient Destination USDT Address ({selectedNetwork})
                </label>
                <input
                  id="withdraw-destination-input"
                  data-testid="withdraw-destination-input"
                  type="text"
                  value={destinationAddress}
                  onChange={(e) => {
                    setDestinationAddress(e.target.value);
                    setWithdrawError('');
                  }}
                  className="w-full min-h-[44px] bg-[#0B0F19] border border-[#2D3545] focus:border-amber-400 rounded-xl px-3.5 py-2.5 text-white font-mono-numbers text-xs sm:text-sm outline-none transition-colors"
                  placeholder="TRC-20 address (starts with T...)"
                  required
                />
              </div>

              {/* Breakdown Summary Box */}
              <div className="bg-[#0B0F19] p-3.5 sm:p-4 rounded-xl border border-[#1F2737] space-y-2 text-xs">
                <div className="flex items-center justify-between gap-2 text-[#94A3B8]">
                  <span>Requested Amount:</span>
                  <span className="font-mono-numbers text-white font-bold whitespace-nowrap shrink-0">
                    {parsedWithdrawAmt.toFixed(2)} USDT
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2 text-[#94A3B8]">
                  <span>Network Fee:</span>
                  <span className="font-mono-numbers text-white font-bold whitespace-nowrap shrink-0">
                    {networkFee.toFixed(2)} USDT ({selectedNetwork})
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2 text-xs sm:text-sm pt-2 border-t border-[#1F2737]">
                  <span className="font-bold text-white">Net Withdrawal Amount:</span>
                  <span className="font-display font-black text-amber-300 text-sm sm:text-base font-mono-numbers whitespace-nowrap shrink-0">
                    {netWithdrawAmt.toFixed(2)} USDT
                  </span>
                </div>
              </div>

              {withdrawError && (
                <div
                  role="alert"
                  className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/35 text-rose-300 text-xs flex items-start gap-2"
                >
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
                  <span>{withdrawError}</span>
                </div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                data-testid="withdraw-submit-button"
                disabled={isSubmittingWithdrawal}
                className="btn-gold w-full min-h-[44px] py-3 px-6 rounded-xl font-display font-black text-xs sm:text-sm text-black flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-amber-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all whitespace-nowrap active:scale-[0.98]"
              >
                {isSubmittingWithdrawal ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin shrink-0" aria-hidden="true" />
                    <span>Submitting Request...</span>
                  </>
                ) : (
                  <>
                    <ArrowUpRight className="w-4 h-4 shrink-0" aria-hidden="true" />
                    <span>Request Withdrawal</span>
                  </>
                )}
              </button>

              {/* SLA Notice */}
              <div className="p-3 rounded-xl bg-amber-950/20 border border-amber-500/30 flex items-start gap-2.5 text-xs text-amber-200/90">
                <Clock className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" aria-hidden="true" />
                <p className="text-[11px] leading-relaxed">
                  <strong>24-Hour Guarantee:</strong> Withdrawals settle via {selectedNetwork} within 24 hours after verification.
                </p>
              </div>
            </form>
          </div>
        </section>
      </div>

      {/* Transaction History Navigation Action */}
      <div className="pt-1 pb-4">
        <button
          type="button"
          data-testid="wallet-history-button"
          onClick={() => {
            if (onOpenTransactionHistory) {
              onOpenTransactionHistory();
            } else if (setGlobalActiveTab) {
              setGlobalActiveTab('transactions');
            }
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          className="w-full min-h-[46px] py-3.5 px-6 rounded-2xl btn-gold text-[#0B0F19] font-display font-extrabold text-sm sm:text-base shadow-xl shadow-amber-500/20 hover:brightness-105 active:scale-[0.99] transition-all flex items-center justify-center gap-2.5 cursor-pointer"
        >
          <History className="w-4.5 h-4.5 sm:w-5 sm:h-5 text-black shrink-0" aria-hidden="true" />
          <span>Transaction History</span>
        </button>
      </div>
    </div>
  );
}
