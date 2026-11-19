import React from 'react';
import { ArrowLeft, Scale, ShieldCheck, CheckCircle2 } from 'lucide-react';
import { useLottery } from '../context/LotteryContext';

export interface TermsPageProps {
  onBackToHome?: () => void;
}

export default function TermsPage({ onBackToHome }: TermsPageProps) {
  const { platformSettings } = useLottery();
  const supportEmail = platformSettings?.supportEmail || 'support@earnflow.in';

  return (
    <div className="max-w-4xl 2xl:max-w-5xl mx-auto px-2.5 xs:px-4 sm:px-6 lg:px-8 py-6 sm:py-10 animate-in fade-in duration-200">
      {/* Top Breadcrumb / Back button */}
      <button
        onClick={onBackToHome}
        className="mb-6 sm:mb-8 px-4 py-2.5 rounded-xl bg-[#10131a] hover:bg-[#151c2b] text-xs font-bold text-amber-400 border border-amber-500/30 flex items-center gap-2 transition-all cursor-pointer shadow-sm"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Return to EarnFlow.in Lobby</span>
      </button>

      {/* Header Banner */}
      <div className="glass-panel rounded-2xl p-5 xs:p-7 sm:p-9 mb-8 border border-amber-500/30 bg-gradient-to-br from-[#121624] via-[#0e121c] to-[#18112e] shadow-2xl">
        <div className="flex items-center gap-3.5 mb-3.5">
          <div className="w-12 h-12 rounded-xl bg-amber-500/15 flex items-center justify-center text-amber-400 border border-amber-500/30 shadow-[0_0_20px_rgba(245,196,81,0.2)]">
            <Scale className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[11px] font-mono-numbers text-amber-400 uppercase font-bold tracking-wider block">
              Legal Governance &amp; Platform Rules
            </span>
            <h1 className="font-display font-black text-2xl sm:text-3xl lg:text-4xl text-white">
              Terms &amp; Conditions
            </h1>
          </div>
        </div>
        <p className="text-xs sm:text-sm text-[#94a3b8] leading-relaxed max-w-3xl">
          Effective Date: November 19, 2026 · Official Terms of Service for <strong className="text-white">EarnFlow.in</strong>
        </p>
      </div>

      {/* Terms Content Sections */}
      <div className="space-y-6 text-xs sm:text-sm text-[#cbd5e1] leading-relaxed">
        
        {/* Section 1 */}
        <div className="glass-panel p-6 sm:p-7 rounded-2xl border border-[#1f2737] space-y-3">
          <div className="flex items-center gap-2.5 text-white font-bold font-display text-base sm:text-lg">
            <span className="w-7 h-7 rounded-lg bg-amber-500/15 text-amber-400 flex items-center justify-center text-xs font-mono-numbers">01</span>
            <span>Acceptance of Agreement &amp; Eligibility</span>
          </div>
          <p>
            By accessing or playing on <strong className="text-white">EarnFlow.in</strong>, purchasing tickets, or participating in gaming events, you explicitly represent and warrant that:
          </p>
          <ul className="list-disc pl-5 space-y-1.5 text-[#94a3b8]">
            <li>You are at least 18 years of age or the legal age of majority in your jurisdiction.</li>
            <li>You possess full legal capacity to enter into and be bound by this Agreement.</li>
            <li>Participation in online provably fair games is lawful under your local legislation.</li>
          </ul>
        </div>

        {/* Section 2 */}
        <div className="glass-panel p-6 sm:p-7 rounded-2xl border border-[#1f2737] space-y-3">
          <div className="flex items-center gap-2.5 text-white font-bold font-display text-base sm:text-lg">
            <span className="w-7 h-7 rounded-lg bg-amber-500/15 text-amber-400 flex items-center justify-center text-xs font-mono-numbers">02</span>
            <span>USDT-Only Platform Currency</span>
          </div>
          <p>
            <strong className="text-white">EarnFlow.in exclusively uses USDT (Tether TRC-20) as its platform currency.</strong> All game stakes, lottery tickets, jackpot prizes, and wallet balances are denominated strictly in USDT. No proprietary virtual tokens are supported for active transactions.
          </p>
        </div>

        {/* Section 3 */}
        <div className="glass-panel p-6 sm:p-7 rounded-2xl border border-[#1f2737] space-y-3">
          <div className="flex items-center gap-2.5 text-white font-bold font-display text-base sm:text-lg">
            <span className="w-7 h-7 rounded-lg bg-amber-500/15 text-amber-400 flex items-center justify-center text-xs font-mono-numbers">03</span>
            <span>Cryptographic Provably Fair Architecture</span>
          </div>
          <p>
            All game rounds on EarnFlow.in utilize SHA-256 cryptographic algorithms. Server seed commitments and client seeds are publicly visible, guaranteeing that outcome determinations are mathematically tamper-proof and verifiable by any participant.
          </p>
        </div>

        {/* Section 4 */}
        <div className="glass-panel p-6 sm:p-7 rounded-2xl border border-[#1f2737] space-y-3">
          <div className="flex items-center gap-2.5 text-white font-bold font-display text-base sm:text-lg">
            <span className="w-7 h-7 rounded-lg bg-amber-500/15 text-amber-400 flex items-center justify-center text-xs font-mono-numbers">04</span>
            <span>Deposits &amp; Payout Settlements</span>
          </div>
          <p>
            USDT deposits are processed via TRON blockchain (TRC-20) addresses. Prize withdrawals are disbursed directly to the player&apos;s verified destination address. Players are responsible for ensuring accurate address configuration.
          </p>
        </div>

        {/* Section 5 */}
        <div className="glass-panel p-6 sm:p-7 rounded-2xl border border-[#1f2737] space-y-3">
          <div className="flex items-center gap-2.5 text-white font-bold font-display text-base sm:text-lg">
            <span className="w-7 h-7 rounded-lg bg-amber-500/15 text-amber-400 flex items-center justify-center text-xs font-mono-numbers">05</span>
            <span>Responsible Gaming &amp; Support</span>
          </div>
          <p>
            EarnFlow.in is designed strictly for interactive social entertainment. For support or dispute inquiries, contact our team at <a href={`mailto:${supportEmail}`} className="text-amber-400 hover:underline">{supportEmail}</a>.
          </p>
        </div>

      </div>

      {/* Bottom Back Button */}
      <div className="mt-8 text-center">
        <button
          onClick={onBackToHome}
          className="px-6 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black font-extrabold text-xs cursor-pointer shadow-lg shadow-amber-500/20 transition-all"
        >
          Return to EarnFlow.in Lobby
        </button>
      </div>
    </div>
  );
}
