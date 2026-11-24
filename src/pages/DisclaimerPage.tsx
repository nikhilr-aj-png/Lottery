import React from 'react';
import { AlertCircle, ShieldAlert, CheckCircle2, Mail } from 'lucide-react';
import { useLottery } from '../context/LotteryContext';

export interface DisclaimerPageProps {
  onBackToHome?: () => void;
  onNavigateToTab?: (tabId: string) => void;
}

export default function DisclaimerPage({ onBackToHome, onNavigateToTab }: DisclaimerPageProps) {
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
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 font-mono-numbers text-[10px] sm:text-[11px] font-bold">
          <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
          <span>Legal &amp; Risk Disclosure</span>
        </div>
        <h1 className="font-display font-black text-xl xs:text-2xl sm:text-3xl text-white tracking-tight leading-tight">
          Platform Disclaimer
        </h1>
        <p className="text-xs sm:text-sm text-[#94A3B8]">
          Important operational, mathematical, and regulatory disclosures regarding EarnFlow.in.
        </p>
      </div>

      <div className="bg-[#111827] border border-[#1F2737] rounded-2xl p-4 xs:p-5 sm:p-7 space-y-3 sm:space-y-4 text-xs sm:text-sm text-[#CBD5E1] leading-relaxed shadow-lg">
        <h2 className="font-display font-bold text-sm sm:text-base text-white">1. No Guaranteed Returns or Earnings</h2>
        <p>
          EarnFlow.in is strictly an online entertainment gaming platform operating a Four-Digit Lottery draw. Participation involves mathematical chance and risk of capital loss. We make no representations, promises, or guarantees of winning outcomes, predictable financial returns, or profits.
        </p>

        <h2 className="font-display font-bold text-sm sm:text-base text-white pt-2">2. Mathematical Probabilities &amp; Operating Margin</h2>
        <p>
          Each individual Four-Digit sequence (0000 through 9999) has an identical, unbiased probability of 1 in 10,000 (0.01%) of being drawn. The platform math model incorporates an overall 95.0% Return-to-Player (RTP) and a 5.0% operational house margin to fund system infrastructure, security operations, and platform maintenance.
        </p>

        <h2 className="font-display font-bold text-sm sm:text-base text-white pt-2">3. Jurisdictional Compliance Responsibility</h2>
        <p>
          The laws governing online lotteries, prize contests, and digital token gaming vary substantially by country, state, and territory. You access the Platform on your own initiative and are solely responsible for ensuring your participation is compliant with the laws of your jurisdiction.
        </p>

        <h2 className="font-display font-bold text-sm sm:text-base text-white pt-2">4. Cryptocurrency Volatility &amp; Network Risks</h2>
        <p>
          EarnFlow.in utilizes USDT tokens on the TRC-20 network. While Tether is designed to maintain parity with the US Dollar, cryptocurrency holdings and decentralized blockchain networks carry inherent technical, market, and protocol risks.
        </p>

        <div className="p-3.5 sm:p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs text-[#94A3B8] space-y-1">
          <strong className="text-white block">Notice on Regulatory Status:</strong>
          <p>
            EarnFlow.in operates as an independent decentralized gaming interface. Any required regulatory disclosures should be reviewed with qualified legal counsel in your respective jurisdiction.
          </p>
        </div>

        <div className="p-3.5 sm:p-4 rounded-xl bg-[#0B0F19] border border-[#1F2737] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4 mt-3">
          <div className="space-y-0.5">
            <h3 className="font-bold text-xs sm:text-sm text-white">Legal or Compliance Queries?</h3>
            <p className="text-[11px] sm:text-xs text-[#94A3B8] leading-normal">
              Contact our compliance and governance desk for regulatory inquiries.
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
