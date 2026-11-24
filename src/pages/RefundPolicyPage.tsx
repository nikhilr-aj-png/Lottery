import React from 'react';
import { RefreshCcw, ShieldCheck, CheckCircle2, AlertCircle, Mail } from 'lucide-react';
import { useLottery } from '../context/LotteryContext';

export interface RefundPolicyPageProps {
  onBackToHome?: () => void;
  onNavigateToTab?: (tabId: string) => void;
}

export default function RefundPolicyPage({ onBackToHome, onNavigateToTab }: RefundPolicyPageProps) {
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
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/15 border border-blue-500/30 text-blue-300 font-mono-numbers text-[10px] sm:text-[11px] font-bold">
          <RefreshCcw className="w-3.5 h-3.5 text-blue-400" />
          <span>Financial Policies</span>
        </div>
        <h1 className="font-display font-black text-xl xs:text-2xl sm:text-3xl text-white tracking-tight leading-tight">
          Refund &amp; Cancellation Policy
        </h1>
        <p className="text-xs sm:text-sm text-[#94A3B8]">
          Purchase conditions, cancellation rules, and refund mechanisms on EarnFlow.in.
        </p>
      </div>

      <div className="bg-[#111827] border border-[#1F2737] rounded-2xl p-4 xs:p-5 sm:p-7 space-y-3 sm:space-y-4 text-xs sm:text-sm text-[#CBD5E1] leading-relaxed shadow-lg">
        <h2 className="font-display font-bold text-sm sm:text-base text-white">1. Finality of Confirmed Ticket Purchases</h2>
        <p>
          Once a Four-Digit Lottery ticket is confirmed in our database and debited from your USDT wallet, the purchase is final and cannot be voluntarily cancelled, modified, or refunded by the player. This policy protects the integrity of the cumulative prize pool and prevents post-freeze manipulation.
        </p>

        <h2 className="font-display font-bold text-sm sm:text-base text-white pt-2">2. Event Cancellation Refunds</h2>
        <p>
          In the rare circumstance that a scheduled lottery draw is cancelled by Platform administration due to unforeseen technical disruption or service outage:
        </p>
        <ul className="list-disc pl-5 space-y-1.5 text-[#94A3B8] text-xs">
          <li>100% of the ticket purchase price will be automatically refunded to each participating user&apos;s wallet.</li>
          <li>Refund adjustments are logged in the wallet ledger with an explicit audit reference.</li>
          <li>Users receive a system notification confirming the credit of refunded funds.</li>
        </ul>

        <h2 className="font-display font-bold text-sm sm:text-base text-white pt-2">3. Failed or Disrupted Transactions</h2>
        <p>
          If your wallet balance is deducted but technical network latency prevents ticket issuance confirmation, our automated ledger reconciles the state: either validating ticket issuance or immediately crediting back the uncommitted USDT amount.
        </p>

        <div className="p-3.5 sm:p-4 rounded-xl bg-[#0B0F19] border border-[#1F2737] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4 mt-3">
          <div className="space-y-0.5">
            <h3 className="font-bold text-xs sm:text-sm text-white">Encountered an uncredited transaction?</h3>
            <p className="text-[11px] sm:text-xs text-[#94A3B8] leading-normal">
              Submit a support inquiry with your wallet address and transaction time.
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
