import React, { useState, useEffect } from 'react';
import { useLottery } from '../context/LotteryContext';
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
  CheckCircle2
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

export default function WalletView() {
  const { 
    wallet, 
    withdrawals, 
    depositUSDT, 
    requestWithdrawal, 
    showToast,
    createNowPaymentsInvoice,
    checkDepositStatus,
    platformSettings
  } = useLottery();

  const minWithdrawalLimit = typeof platformSettings?.minWithdrawal === 'number' ? platformSettings.minWithdrawal : 5;
  const maxWithdrawalLimit = typeof platformSettings?.maxWithdrawal === 'number' ? platformSettings.maxWithdrawal : 10000;
  const treasuryAddress = platformSettings?.treasuryTrc20 || wallet.depositAddress;

  // Tabs for Deposit vs Withdraw
  const [activeTab, setActiveTab] = useState('withdraw'); // 'deposit' | 'withdraw'
  const [selectedNetwork, setSelectedNetwork] = useState('TRC-20');

  // Deposit method: 'nowpayments' | 'direct'
  const [depositMethod, setDepositMethod] = useState('nowpayments');
  const [payCurrency, setPayCurrency] = useState('usdttrc20');
  const [isGeneratingInvoice, setIsGeneratingInvoice] = useState(false);
  const [activeInvoice, setActiveInvoice] = useState(null);
  const [isCheckingStatus, setIsCheckingStatus] = useState(false);
  const [invoiceStatusText, setInvoiceStatusText] = useState('waiting');

  // Deposit amount
  const [depositAmount, setDepositAmount] = useState('50');

  // Withdrawal form
  const [withdrawAmount, setWithdrawAmount] = useState('500');
  const [destinationAddress, setDestinationAddress] = useState('TYv889XaKLQpNm4xW9jRtZbCuYxK9m');
  const [copied, setCopied] = useState(false);

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

  // NOWPayments invoice generation handler
  const handleNowPaymentsSubmit = async (e) => {
    e.preventDefault();
    const amt = parseFloat(depositAmount);
    if (isNaN(amt) || amt <= 0) {
      showToast('Please enter a valid deposit amount', 'error');
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
      if (res && res.status) {
        setInvoiceStatusText(res.status);
        showToast(`Invoice status: ${res.status.toUpperCase()}`, 'info');
      } else {
        showToast('Status check: Waiting for on-chain broadcast', 'info');
      }
    } finally {
      setIsCheckingStatus(false);
    }
  };

  // Calculate live SLA remaining for processing withdrawals
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

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
    <div className="max-w-7xl mx-auto px-2.5 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6 sm:space-y-8">
      
      {/* Portfolio Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        
        {/* Card 1: Available Balance */}
        <div className="glass-panel p-4 sm:p-6 rounded-2xl border-l-4 border-l-[#ffd700] relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-[#9b8f7c] font-bold uppercase tracking-wider">
              Available USDT Balance
            </span>
            <div className="w-8 h-8 rounded-lg bg-[rgba(245,196,81,0.15)] flex items-center justify-center text-[#ffd700]">
              <Wallet className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="font-display font-black text-3xl sm:text-4xl text-gold-gradient">
              {wallet.balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            <span className="text-xs text-[#05d5aa] font-bold font-mono-numbers">USDT</span>
          </div>
          <span className="text-[11px] text-[#9b8f7c] mt-1 block">
            ≈ ${wallet.balance.toFixed(2)} USD • Ready for Instant Draw Entry
          </span>
        </div>

        {/* Card 2: Total Won Prizes */}
        <div className="glass-panel p-6 rounded-2xl border-l-4 border-l-[#05d5aa] relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-[#9b8f7c] font-bold uppercase tracking-wider">
              Total Won Prizes
            </span>
            <div className="w-8 h-8 rounded-lg bg-[rgba(5,213,170,0.15)] flex items-center justify-center text-[#05d5aa]">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="font-display font-black text-3xl sm:text-4xl text-white">
              {wallet.lifetimeWon.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            <span className="text-xs text-[#05d5aa] font-bold font-mono-numbers">USDT</span>
          </div>
          <span className="text-[11px] text-[#05d5aa] mt-1 block font-semibold">
            Auto-credited directly to balance ✅
          </span>
        </div>

        {/* Card 3: Pending 24h Withdrawals */}
        <div className="glass-panel p-6 rounded-2xl border-l-4 border-l-amber-500 relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-[#9b8f7c] font-bold uppercase tracking-wider">
              Pending 24h Withdrawals
            </span>
            <div className="w-8 h-8 rounded-lg bg-amber-500/15 flex items-center justify-center text-amber-400">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="font-display font-black text-3xl sm:text-4xl text-amber-400">
              {pendingWithdrawalsSum.toFixed(2)}
            </span>
            <span className="text-xs text-amber-400 font-bold font-mono-numbers">USDT</span>
          </div>
          <span className="text-[11px] text-amber-400/80 mt-1 block font-mono-numbers">
            SLA Guaranteed: Disbursed &lt; 24h
          </span>
        </div>

        {/* Card 4: Connected Wallet Status */}
        <div className="glass-panel p-6 rounded-2xl border-l-4 border-l-[#00f2fe] relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-[#9b8f7c] font-bold uppercase tracking-wider">
              Settlement Protocol
            </span>
            <div className="w-8 h-8 rounded-lg bg-[#00f2fe]/15 flex items-center justify-center text-[#00f2fe]">
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="font-mono-numbers font-bold text-lg text-white truncate">
            {wallet.address.slice(0, 8)}...{wallet.address.slice(-6)}
          </div>
          <span className="text-[11px] text-[#05d5aa] mt-1 block font-mono-numbers flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-[#05d5aa] animate-ping" />
            Active Non-Custodial Vault
          </span>
        </div>

      </div>

      {/* Main Two-Column Workstation: Deposit & Withdrawal */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* LEFT COLUMN: Deposit USDT / Multi-Crypto (6 Cols) */}
        <div className="lg:col-span-6 glass-panel rounded-2xl p-4 sm:p-8 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[rgba(5,213,170,0.15)] flex items-center justify-center text-[#05d5aa] border border-[#05d5aa]/30">
                  <ArrowDownLeft className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-display font-extrabold text-xl text-white">
                    Deposit Funds
                  </h3>
                  <p className="text-xs text-[#9b8f7c]">
                    Multi-crypto gateway & automated settlement
                  </p>
                </div>
              </div>

              <span className="text-[11px] font-mono-numbers font-bold px-2.5 py-1 rounded bg-[#10131a] text-[#05d5aa] border border-[#05d5aa]/30">
                0% Fee
              </span>
            </div>

            {/* Deposit Method Selector */}
            <div className="grid grid-cols-2 gap-2 p-1 bg-[#0b0e14] rounded-xl border border-[#272a31] mb-6">
              <button
                type="button"
                onClick={() => setDepositMethod('nowpayments')}
                className={`py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                  depositMethod === 'nowpayments'
                    ? 'bg-[#1e2638] text-[#ffd700] border border-[#f5c451]/50 shadow-md'
                    : 'text-[#9b8f7c] hover:text-white'
                }`}
              >
                <CreditCard className="w-3.5 h-3.5 text-[#ffd700]" />
                <span>NOWPayments Gateway</span>
              </button>
              <button
                type="button"
                onClick={() => setDepositMethod('direct')}
                className={`py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                  depositMethod === 'direct'
                    ? 'bg-[#1e2638] text-[#ffd700] border border-[#f5c451]/50 shadow-md'
                    : 'text-[#9b8f7c] hover:text-white'
                }`}
              >
                <Coins className="w-3.5 h-3.5 text-[#05d5aa]" />
                <span>Direct TRC-20 Address</span>
              </button>
            </div>

            {/* METHOD 1: NOWPAYMENTS GATEWAY */}
            {depositMethod === 'nowpayments' && (
              <div className="space-y-5">
                {/* Active Invoice Card if one exists */}
                {activeInvoice ? (
                  <div className="bg-[#0b0e14] rounded-2xl p-5 border border-[#f5c451]/40 space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-[#9b8f7c] font-semibold">
                        Active Deposit Invoice
                      </span>
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
                      <span>Webhook updates balance automatically upon confirmation</span>
                      <button
                        type="button"
                        onClick={() => setActiveInvoice(null)}
                        className="text-[#f5c451] hover:underline cursor-pointer"
                      >
                        New Deposit
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
                        <span className="font-mono-numbers text-[11px] text-[#05d5aa]">Min: 5 USDT</span>
                      </div>
                      <div className="relative">
                        <input
                          type="number"
                          step="1"
                          min="5"
                          value={depositAmount}
                          onChange={(e) => setDepositAmount(e.target.value)}
                          className="w-full bg-[#0b0e14] border border-[#32353c] focus:border-[#ffd700] rounded-xl px-4 py-3.5 text-white font-mono-numbers font-bold text-lg outline-none"
                          placeholder="e.g. 50"
                          required
                        />
                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-[#ffd700]">
                          USDT
                        </span>
                      </div>

                      {/* Quick Chips */}
                      <div className="flex gap-2 mt-2">
                        {[10, 25, 50, 100, 250, 500].map((amt) => (
                          <button
                            key={amt}
                            type="button"
                            onClick={() => setDepositAmount(String(amt))}
                            className={`flex-1 py-1.5 rounded-lg text-[11px] font-mono-numbers font-bold border transition-colors cursor-pointer ${
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
                      className="btn-gold w-full py-4 rounded-xl font-display font-extrabold text-sm flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-[#f5c451]/25 disabled:opacity-50 mt-2"
                    >
                      {isGeneratingInvoice ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          <span>Generating NOWPayments Invoice...</span>
                        </>
                      ) : (
                        <>
                          <CreditCard className="w-4 h-4" />
                          <span>Deposit via NOWPayments Gateway</span>
                        </>
                      )}
                    </button>

                    <div className="p-3 rounded-xl bg-[#0b0e14] border border-[#272a31] flex items-start gap-2.5 text-xs text-[#9b8f7c]">
                      <ShieldCheck className="w-4 h-4 text-[#05d5aa] shrink-0 mt-0.5" />
                      <p className="text-[11px] leading-relaxed">
                        Hosted on NOWPayments official infrastructure. Supports auto-detection of network deposits with real-time webhook confirmation.
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
                    <span>Minimum Deposit: <strong>5.00 USDT</strong></span>
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
            <div className="flex gap-2">
              {[50, 100, 500].map((amt) => (
                <button
                  key={amt}
                  type="button"
                  onClick={() => depositUSDT(amt)}
                  className="flex-1 py-2 rounded-xl bg-[rgba(5,213,170,0.12)] hover:bg-[#05d5aa] text-[#05d5aa] hover:text-[#0b0e14] border border-[#05d5aa]/30 text-xs font-bold font-mono-numbers transition-all cursor-pointer"
                >
                  +{amt} USDT
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Withdraw USDT (24-Hour SLA) (6 Cols) */}
        <div className="lg:col-span-6 glass-panel rounded-2xl p-4 sm:p-8 flex flex-col justify-between border border-[rgba(245,196,81,0.35)]">
          <div>
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[rgba(245,196,81,0.15)] flex items-center justify-center text-[#ffd700] border border-[#f5c451]/30">
                  <ArrowUpRight className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-display font-extrabold text-xl text-white">
                    Withdraw USDT
                  </h3>
                  <p className="text-xs text-[#9b8f7c]">
                    Cold-storage multi-sig verified disbursal
                  </p>
                </div>
              </div>

              <div className="badge-gold px-3 py-1 rounded-full text-xs font-bold font-mono-numbers flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-amber-400" />
                24-Hour SLA Guarantee
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
                    className="w-full bg-[#0b0e14] border border-[#32353c] focus:border-[#ffd700] rounded-xl px-4 py-3.5 text-white font-mono-numbers font-bold text-lg outline-none"
                    placeholder={`e.g. ${minWithdrawalLimit}`}
                    required
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-[#ffd700]">
                    USDT
                  </span>
                </div>

                {/* Percentage Presets */}
                <div className="flex gap-2 mt-2">
                  {[25, 50, 75, 100].map((pct) => (
                    <button
                      key={pct}
                      type="button"
                      onClick={() => handlePreset(pct)}
                      className="px-2.5 py-1 rounded-lg bg-[#121721] hover:bg-[#1a2232] text-[11px] font-mono-numbers text-[#9b8f7c] hover:text-white border border-[#272a31]"
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
                  <span className="font-mono-numbers text-white font-bold">{parseFloat(withdrawAmount || 0).toFixed(2)} USDT</span>
                </div>
                <div className="flex justify-between text-[#9b8f7c]">
                  <span>Network Protocol Fee:</span>
                  <span className="font-mono-numbers text-white font-bold">1.00 USDT ({selectedNetwork})</span>
                </div>
                <div className="flex justify-between text-sm pt-2 border-t border-[#1f2737]">
                  <span className="font-bold text-white">Net Disbursal Amount:</span>
                  <span className="font-display font-black text-[#ffd700] text-base font-mono-numbers">
                    {Math.max(0, (parseFloat(withdrawAmount || 0) - 1.0)).toFixed(2)} USDT
                  </span>
                </div>
              </div>

              {/* SLA Guarantee Notice */}
              <div className="p-3.5 rounded-xl bg-amber-950/20 border border-amber-500/30 flex items-start gap-3">
                <Clock className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                <p className="text-[11px] text-amber-200/90 leading-relaxed">
                  <strong>24-Hour SLA Guarantee:</strong> All withdrawal requests are processed within 24 hours via multi-sig protocol security. Average disbursement takes 2–4 hours.
                </p>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                className="btn-gold w-full py-4 rounded-xl font-display font-extrabold text-base flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-[#f5c451]/25"
              >
                <ArrowUpRight className="w-5 h-5" />
                Request Withdrawal (24h SLA)
              </button>
            </form>
          </div>
        </div>

      </div>

      {/* 24-Hour Withdrawal Orders & SLA Tracking Table */}
      <div className="glass-panel rounded-2xl p-6 sm:p-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="font-display font-extrabold text-xl text-white">
              Withdrawal Orders & 24h SLA Ledger
            </h3>
            <p className="text-xs text-[#9b8f7c]">
              Real-time audit trail and transaction proof
            </p>
          </div>
          <span className="badge-provably-fair px-3 py-1 rounded-full text-xs font-bold">
            Live SLA Monitor
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-[#272a31] text-[#9b8f7c] font-mono-numbers uppercase tracking-wider">
                <th className="pb-3 px-3">Order ID</th>
                <th className="pb-3 px-3">Amount (USDT)</th>
                <th className="pb-3 px-3">Network</th>
                <th className="pb-3 px-3">Destination Address</th>
                <th className="pb-3 px-3">Status / SLA Timer</th>
                <th className="pb-3 px-3 text-right">Proof / TxHash</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1f2737]">
              {withdrawals.length === 0 ? (
                <tr>
                  <td colSpan="6" className="py-6 text-center text-[#9b8f7c]">
                    No withdrawals yet.
                  </td>
                </tr>
              ) : (
                withdrawals.map((order) => {
                  const isProcessing = order.status === 'processing';
                  const isCompleted = order.status === 'completed';

                  return (
                    <tr key={order.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="py-4 px-3 font-mono-numbers font-bold text-white">
                        #{order.id}
                      </td>
                      <td className="py-4 px-3 font-mono-numbers font-black text-sm text-[#ffd700]">
                        {order.amount.toFixed(2)} USDT
                        <span className="block text-[10px] text-[#9b8f7c] font-normal">
                          Net: {order.netDisbursal.toFixed(2)} USDT
                        </span>
                      </td>
                      <td className="py-4 px-3">
                        <span className="px-2 py-0.5 rounded bg-[#10131a] text-[#05d5aa] border border-[#05d5aa]/30 font-mono-numbers font-bold text-[10px]">
                          {order.network}
                        </span>
                      </td>
                      <td className="py-4 px-3 font-mono-numbers text-white/80">
                        {order.address.slice(0, 6)}...{order.address.slice(-6)}
                      </td>
                      <td className="py-4 px-3">
                        {isProcessing ? (
                          <div className="flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping" />
                            <div>
                              <span className="text-amber-400 font-bold block">
                                In Progress (24h SLA)
                              </span>
                              <span className="text-[10px] font-mono-numbers text-amber-200/80">
                                {formatSLATime(order.slaTargetMs)}
                              </span>
                            </div>
                          </div>
                        ) : isCompleted ? (
                          <span className="px-2.5 py-1 rounded-md bg-[rgba(5,213,170,0.15)] text-[#05d5aa] border border-[#05d5aa]/40 font-bold flex items-center gap-1.5 w-max">
                            <Check className="w-3.5 h-3.5" />
                            Completed (Disbursed)
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 rounded-md bg-red-950/40 text-red-400 border border-red-500/30 font-bold">
                            Flagged / Refunded
                          </span>
                        )}
                      </td>
                      <td className="py-4 px-3 text-right">
                        {order.txHash ? (
                          <a
                            href={`https://tronscan.org/#/transaction/${order.txHash}`}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-[#00f2fe] hover:underline font-mono-numbers"
                          >
                            <span>{order.txHash.slice(0, 8)}...</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        ) : (
                          <span className="text-[#9b8f7c] font-mono-numbers">Pending Broadcast</span>
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

    </div>
  );
}
