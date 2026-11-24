import React from 'react';
import { ArrowLeft, RefreshCcw, ShieldCheck, CheckCircle2, AlertCircle, Mail } from 'lucide-react';
import { useLottery } from '../context/LotteryContext';

export interface RefundPolicyPageProps {
  onBackToHome?: () => void;
}

export default function RefundPolicyPage({ onBackToHome }: RefundPolicyPageProps) {
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
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/15 border border-blue-500/30 text-blue-300 font-mono-numbers text-[11px] font-bold">
          <RefreshCcw className="w-3.5 h-3.5 text-blue-400" />
          <span>Financial Policies</span>
        </div>
        <h1 className="font-display font-black text-2xl sm:text-3xl text-white">
          Refund &amp; Cancellation Policy
        </h1>
        <p className="text-xs sm:text-sm text-[#94A3B8]">
          Purchase conditions, cancellation rules, and refund mechanisms on EarnFlow.in.
        </p>
      </div>

      <div className="bg-[#111827] border border-[#1F2737] rounded-2xl p-5 sm:p-7 space-y-4 text-xs sm:text-sm text-[#CBD5E1] leading-relaxed">
        <h2 className="font-display font-bold text-base text-white">1. Finality of Confirmed Ticket Purchases</h2>
        <p>
          Once a Four-Digit Lottery ticket is confirmed in our database and debited from your USDT wallet, the purchase is final and cannot be voluntarily cancelled, modified, or refunded by the player. This policy protects the integrity of the cumulative prize pool and prevents post-freeze manipulation.
        </p>

        <h2 className="font-display font-bold text-base text-white pt-2">2. Event Cancellation Refunds</h2>
        <p>
          In the rare circumstance that a scheduled lottery draw is cancelled by Platform administration due to unforeseen technical disruption or service outage:
        </p>
        <ul className="list-disc pl-5 space-y-1.5 text-[#94A3B8] text-xs">
          <li>100% of the ticket purchase price will be automatically refunded to each participating user&apos;s wallet.</li>
          <li>Refund adjustments are logged in the wallet ledger with an explicit audit reference.</li>
          <li>Users receive a system notification confirming the credit of refunded funds.</li>
        </ul>

        <h2 className="font-display font-bold text-base text-white pt-2">3. Failed or Disrupted Transactions</h2>
        <p>
          If your wallet balance is deducted but technical network latency prevents ticket issuance confirmation, our automated ledger reconciles the state: either validating ticket issuance or immediately crediting back the uncommitted USDT amount.
        </p>

        <div className="p-4 rounded-xl bg-[#0B0F19] border border-[#1F2737] flex items-center justify-between gap-4 mt-4">
          <div>
            <h3 className="font-bold text-xs text-white">Encountered an uncredited transaction?</h3>
            <p className="text-[11px] text-[#94A3B8] mt-0.5">
              Contact our support team with your wallet address and transaction time.
            </p>
          </div>
          <a
            href={`mailto:${supportEmail}?subject=Refund%20or%20Transaction%20Inquiry`}
            className="px-4 py-2 rounded-xl bg-amber-500 text-black font-extrabold text-xs shrink-0"
          >
            Contact Support
          </a>
        </div>
      </div>
    </div>
  );
}
