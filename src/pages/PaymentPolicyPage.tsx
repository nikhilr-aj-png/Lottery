import React from 'react';
import { ArrowLeft, Coins, ShieldCheck, Clock, CheckCircle2, AlertCircle, Mail } from 'lucide-react';
import { useLottery } from '../context/LotteryContext';

export interface PaymentPolicyPageProps {
  onBackToHome?: () => void;
}

export default function PaymentPolicyPage({ onBackToHome }: PaymentPolicyPageProps) {
  const { platformSettings } = useLottery();
  const supportEmail = platformSettings?.supportEmail?.trim() || 'earnflow.user@gmail.com';

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-10 text-left space-y-6">
      {onBackToHome && (
        <button
          onClick={onBackToHome}
          className="inline-flex items-center gap-1.5 text-xs text-[#94A3B8] hover:text-white transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Home</span>
        </button>
      )}

      <div className="pb-4 border-b border-[#1F2737] space-y-2">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-mono-numbers text-[11px] font-bold">
          <Coins className="w-3.5 h-3.5 text-emerald-400" />
          <span>USDT Payments</span>
        </div>
        <h1 className="font-display font-black text-2xl sm:text-3xl text-white">
          Payment Policy
        </h1>
        <p className="text-xs sm:text-sm text-[#94A3B8]">
          Deposit instructions, withdrawal processing, and USDT network standards on EarnFlow.in.
        </p>
      </div>

      <div className="bg-[#111827] border border-[#1F2737] rounded-2xl p-5 sm:p-7 space-y-4 text-xs sm:text-sm text-[#CBD5E1] leading-relaxed">
        <h2 className="font-display font-bold text-base text-white">1. Supported Currency: USDT (TRC-20)</h2>
        <p>
          EarnFlow.in operates exclusively with Tether USD (USDT) on the Tron blockchain network (TRC-20). We do not accept fiat currencies, bank wires, credit cards, or unrelated token assets.
        </p>

        <h2 className="font-display font-bold text-base text-white pt-2">2. Deposit Processing</h2>
        <ul className="list-disc pl-5 space-y-1.5 text-[#94A3B8] text-xs">
          <li>Deposits are credited automatically upon blockchain confirmation (typically 1–3 network block confirmations).</li>
          <li>Users must only transfer TRC-20 USDT to their unique deposit address. Assets sent on other networks (ERC-20, BEP-20) cannot be recovered.</li>
          <li>There are zero deposit processing fees charged by EarnFlow.</li>
        </ul>

        <h2 className="font-display font-bold text-base text-white pt-2">3. Withdrawal Timeline &amp; Limits</h2>
        <ul className="list-disc pl-5 space-y-1.5 text-[#94A3B8] text-xs">
          <li><strong>Processing Window:</strong> Standard withdrawals are reviewed, authorized, and broadcasted within 24 hours.</li>
          <li><strong>Minimum Withdrawal:</strong> 5 USDT.</li>
          <li><strong>Destination Address:</strong> Withdrawals must be sent to a valid TRC-20 compatible wallet address.</li>
        </ul>

        <h2 className="font-display font-bold text-base text-white pt-2">4. Payout Idempotency &amp; Ledger Auditing</h2>
        <p>
          Every draw winning disbursement is atomic and recorded in our double-entry financial ledger (`wallet_ledger`). Winnings are credited immediately to user wallets upon draw conclusion, available for subsequent draw participation or withdrawal.
        </p>

        <div className="p-4 rounded-xl bg-[#0B0F19] border border-[#1F2737] flex items-center justify-between gap-4 mt-4">
          <div>
            <h3 className="font-bold text-xs text-white">Payment Inquiries?</h3>
            <p className="text-[11px] text-[#94A3B8] mt-0.5">
              Our payments team is available 24/7 to resolve transfer and balance queries.
            </p>
          </div>
          <a
            href={`mailto:${supportEmail}`}
            className="px-4 py-2 rounded-xl bg-amber-500 text-black font-extrabold text-xs shrink-0"
          >
            {supportEmail}
          </a>
        </div>
      </div>
    </div>
  );
}
