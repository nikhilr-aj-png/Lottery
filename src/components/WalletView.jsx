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
  DollarSign
} from 'lucide-react';

export default function WalletView() {
  const { wallet, withdrawals, depositUSDT, requestWithdrawal, showToast } = useLottery();

  // Tabs for Deposit vs Withdraw
  const [activeTab, setActiveTab] = useState('withdraw'); // 'deposit' | 'withdraw'
  const [selectedNetwork, setSelectedNetwork] = useState('TRC-20');

  // Deposit amount
  const [depositAmount, setDepositAmount] = useState('100');

  // Withdrawal form
  const [withdrawAmount, setWithdrawAmount] = useState('500');
  const [destinationAddress, setDestinationAddress] = useState('TYv889XaKLQpNm4xW9jRtZbCuYxK9m');
  const [copied, setCopied] = useState(false);

  // Copy address to clipboard
  const handleCopy = () => {
    navigator.clipboard.writeText(wallet.depositAddress);
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
        
        {/* LEFT COLUMN: Deposit USDT (6 Cols) */}
        <div className="lg:col-span-6 glass-panel rounded-2xl p-4 sm:p-8 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[rgba(5,213,170,0.15)] flex items-center justify-center text-[#05d5aa] border border-[#05d5aa]/30">
                  <ArrowDownLeft className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-display font-extrabold text-xl text-white">
                    Deposit Tether (USDT)
                  </h3>
                  <p className="text-xs text-[#9b8f7c]">
                    Fast multi-chain liquidity ingress
                  </p>
                </div>
              </div>

              <span className="text-[11px] font-mono-numbers font-bold px-2.5 py-1 rounded bg-[#10131a] text-[#05d5aa] border border-[#05d5aa]/30">
                0% Fee
              </span>
            </div>

            {/* Network Display (TRC-20 ONLY) */}
            <div className="p-1.5 rounded-xl bg-[#0b0e14] border border-[#272a31] mb-6">
              <div className="py-2 px-3 text-center text-xs font-mono-numbers font-bold rounded-lg bg-[#1e2638] text-[#ffd700] border border-[#f5c451]/50 shadow-md flex items-center justify-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#05d5aa] animate-pulse"></span>
                <span>Network: TRON (TRC-20 USDT) · Instant Settlement</span>
              </div>
            </div>

            {/* QR Code & Address Display */}
            <div className="bg-[#0b0e14] rounded-2xl p-6 border border-[#272a31] text-center mb-6">
              <div className="w-36 h-36 mx-auto bg-white p-2 rounded-xl shadow-lg flex items-center justify-center mb-4">
                {/* Visual stylized QR code */}
                <div className="w-full h-full bg-[#0b0e14] rounded flex flex-col items-center justify-center border-2 border-[#f5c451] p-2 text-center">
                  <QrCode className="w-16 h-16 text-[#ffd700]" />
                  <span className="text-[9px] font-mono-numbers text-[#f5c451] font-bold mt-1">
                    USDT {selectedNetwork}
                  </span>
                </div>
              </div>

              <div className="text-xs text-[#9b8f7c] mb-2 font-medium">
                Your Personal Deposit Address ({selectedNetwork}):
              </div>

              <div className="flex items-center gap-2 bg-[#121721] p-3 rounded-xl border border-[#272a31]">
                <code className="flex-1 font-mono-numbers text-xs sm:text-sm text-white truncate text-left">
                  {wallet.depositAddress}
                </code>
                <button
                  onClick={handleCopy}
                  className="px-3 py-1.5 rounded-lg bg-[rgba(245,196,81,0.15)] hover:bg-[#f5c451] text-[#ffd700] hover:text-[#0b0e14] text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
                >
                  {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  {copied ? 'Copied' : 'Copy'}
                </button>
              </div>
            </div>

            <div className="space-y-2 text-xs text-[#9b8f7c] mb-6">
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

          {/* Quick Simulation Button for Testing */}
          <div className="pt-4 border-t border-[#272a31]">
            <span className="text-[11px] text-[#9b8f7c] block mb-2 font-semibold">
              QUICK TEST DEPOSIT (INSTANT ON-CHAIN SIMULATION):
            </span>
            <div className="flex gap-2">
              {[50, 100, 500].map((amt) => (
                <button
                  key={amt}
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
                  <span className="font-mono-numbers text-xs text-[#05d5aa]">
                    Available: {wallet.balance.toFixed(2)} USDT
                  </span>
                </div>
                <div className="relative">
                  <input
                    type="number"
                    step="0.01"
                    min="10"
                    max={wallet.balance}
                    value={withdrawAmount}
                    onChange={(e) => setWithdrawAmount(e.target.value)}
                    className="w-full bg-[#0b0e14] border border-[#32353c] focus:border-[#ffd700] rounded-xl px-4 py-3.5 text-white font-mono-numbers font-bold text-lg outline-none"
                    placeholder="e.g. 500.00"
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
