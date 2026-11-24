import React from 'react';
import { Coins, ShieldCheck, Clock, CheckCircle2, AlertCircle, Mail } from 'lucide-react';
import { useLottery } from '../context/LotteryContext';

export interface PaymentPolicyPageProps {
  onBackToHome?: () => void;
  onNavigateToTab?: (tabId: string) => void;
}

export default function PaymentPolicyPage({ onBackToHome, onNavigateToTab }: PaymentPolicyPageProps) {
  const { setActiveTab } = useLottery();

  const handleContactSupport = () => {
    if (onNavigateToTab) {
      onNavigateToTab('contact');
    } else {
      setActiveTab('contact');
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto px-3 xs:px-4 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-8 text-left space-y-4 sm:space-y-6 animate-in fade-in duration-200">
      <div className="pb-3 sm:pb-4 border-b border-[#1F2737] space-y-1.5 sm:space-y-2">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-mono-numbers text-[10px] sm:text-[11px] font-bold">
          <Coins className="w-3.5 h-3.5 text-emerald-400" />
          <span>USDT Payments</span>
        </div>
        <h1 className="font-display font-black text-xl xs:text-2xl sm:text-3xl text-white tracking-tight leading-tight">
          Payment Policy
        </h1>
        <p className="text-xs sm:text-sm text-[#94A3B8]">
          Deposit instructions, withdrawal processing, and USDT network standards on EarnFlow.in.
        </p>
      </div>

      <div className="bg-[#111827] border border-[#1F2737] rounded-2xl p-4 xs:p-5 sm:p-7 space-y-3 sm:space-y-4 text-xs sm:text-sm text-[#CBD5E1] leading-relaxed shadow-lg">
        <h2 className="font-display font-bold text-sm sm:text-base text-white">1. Supported Currency: USDT (TRC-20)</h2>
        <p>
          EarnFlow.in operates exclusively with Tether USD (USDT) on the Tron blockchain network (TRC-20). We do not accept fiat currencies, bank wires, credit cards, or unrelated token assets.
        </p>

        <h2 className="font-display font-bold text-sm sm:text-base text-white pt-2">2. Deposit Processing</h2>
        <ul className="list-disc pl-5 space-y-1.5 text-[#94A3B8] text-xs">
          <li>Deposits are credited automatically upon blockchain confirmation (typically 1–3 network block confirmations).</li>
          <li>Users must only transfer TRC-20 USDT to their unique deposit address. Assets sent on other networks (ERC-20, BEP-20) cannot be recovered.</li>
          <li>There are zero deposit processing fees charged by EarnFlow.</li>
        </ul>

        <h2 className="font-display font-bold text-sm sm:text-base text-white pt-2">3. Withdrawal Timeline &amp; Limits</h2>
        <ul className="list-disc pl-5 space-y-1.5 text-[#94A3B8] text-xs">
          <li><strong>Processing Window:</strong> Standard withdrawals are reviewed, authorized, and broadcasted within 24 hours.</li>
          <li><strong>Minimum Withdrawal:</strong> 5 USDT.</li>
          <li><strong>Destination Address:</strong> Withdrawals must be sent to a valid TRC-20 compatible wallet address.</li>
        </ul>

        <h2 className="font-display font-bold text-sm sm:text-base text-white pt-2">4. Payout Idempotency &amp; Ledger Auditing</h2>
        <p>
          Every draw winning disbursement is atomic and recorded in our double-entry financial ledger (<code>wallet_ledger</code>). Winnings are credited immediately to user wallets upon draw conclusion, available for subsequent draw participation or withdrawal.
        </p>

        <div className="p-3.5 sm:p-4 rounded-xl bg-[#0B0F19] border border-[#1F2737] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4 mt-3">
          <div className="space-y-0.5">
            <h3 className="font-bold text-xs sm:text-sm text-white">Payment Inquiries?</h3>
            <p className="text-[11px] sm:text-xs text-[#94A3B8] leading-normal">
              Our payments team is available 24/7 to resolve transfer and balance queries.
            </p>
          </div>
          <button
            type="button"
            onClick={handleContactSupport}
            className="w-full sm:w-auto px-4 py-2 sm:py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-extrabold text-xs transition-colors shrink-0 flex items-center justify-center gap-1.5 cursor-pointer shadow-md shadow-amber-500/20 active:scale-95"
          >
            <Mail className="w-3.5 h-3.5" />
            <span>Contact Support</span>
          </button>
        </div>
      </div>
    </div>
  );
}
