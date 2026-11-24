import React from 'react';
import { ArrowLeft, AlertCircle, ShieldAlert, CheckCircle2 } from 'lucide-react';
import { useLottery } from '../context/LotteryContext';

export interface DisclaimerPageProps {
  onBackToHome?: () => void;
}

export default function DisclaimerPage({ onBackToHome }: DisclaimerPageProps) {
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
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 font-mono-numbers text-[11px] font-bold">
          <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
          <span>Legal &amp; Risk Disclosure</span>
        </div>
        <h1 className="font-display font-black text-2xl sm:text-3xl text-white">
          Platform Disclaimer
        </h1>
        <p className="text-xs sm:text-sm text-[#94A3B8]">
          Important operational, mathematical, and regulatory disclosures regarding EarnFlow.in.
        </p>
      </div>

      <div className="bg-[#111827] border border-[#1F2737] rounded-2xl p-5 sm:p-7 space-y-4 text-xs sm:text-sm text-[#CBD5E1] leading-relaxed">
        <h2 className="font-display font-bold text-base text-white">1. No Guaranteed Returns or Earnings</h2>
        <p>
          EarnFlow.in is strictly an online entertainment gaming platform operating a Four-Digit Lottery draw. Participation involves mathematical chance and risk of capital loss. We make no representations, promises, or guarantees of winning outcomes, predictable financial returns, or profits.
        </p>

        <h2 className="font-display font-bold text-base text-white pt-2">2. Mathematical Probabilities &amp; Operating Margin</h2>
        <p>
          Each individual Four-Digit sequence (0000 through 9999) has an identical, unbiased probability of 1 in 10,000 (0.01%) of being drawn. The platform math model incorporates an overall 95.0% Return-to-Player (RTP) and a 5.0% operational house margin to fund system infrastructure, security operations, and platform maintenance.
        </p>

        <h2 className="font-display font-bold text-base text-white pt-2">3. Jurisdictional Compliance Responsibility</h2>
        <p>
          The laws governing online lotteries, prize contests, and digital token gaming vary substantially by country, state, and territory. You access the Platform on your own initiative and are solely responsible for ensuring your participation is compliant with the laws of your jurisdiction.
        </p>

        <h2 className="font-display font-bold text-base text-white pt-2">4. Cryptocurrency Volatility &amp; Network Risks</h2>
        <p>
          EarnFlow.in utilizes USDT tokens on the TRC-20 network. While Tether is designed to maintain parity with the US Dollar, cryptocurrency holdings and decentralized blockchain networks carry inherent technical, market, and protocol risks.
        </p>

        <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs text-[#94A3B8]">
          <strong className="text-white block mb-1">Notice on Regulatory Status:</strong>
          EarnFlow.in operates as an independent decentralized gaming interface. Any required regulatory disclosures should be reviewed with qualified legal counsel in your respective jurisdiction.
        </div>
      </div>
    </div>
  );
}
