import React from 'react';
import { ArrowLeft, Scale } from 'lucide-react';
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
        className="mb-6 sm:mb-8 px-3.5 xs:px-4 py-2 rounded-xl bg-[#141924] hover:bg-[#1f2738] text-xs font-bold text-[#f5c451] border border-[rgba(245,196,81,0.25)] flex items-center gap-2 transition-all cursor-pointer shadow-sm"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Return to Lottery Lobby</span>
      </button>

      {/* Header Banner */}
      <div className="glass-panel rounded-2xl p-4 xs:p-6 sm:p-8 mb-6 sm:mb-8 border border-[rgba(245,196,81,0.3)] bg-gradient-to-br from-[#10141e] via-[#0b0e14] to-[#121826]">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-xl bg-[rgba(245,196,81,0.15)] flex items-center justify-center text-[#ffd700] border border-[#f5c451]/30">
            <Scale className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] font-mono-numbers text-[#f5c451] uppercase font-bold tracking-wider">
              Legal & Platform Governance
            </span>
            <h1 className="font-display font-extrabold text-2xl sm:text-3xl text-white">
              Terms & Conditions
            </h1>
          </div>
        </div>
        <p className="text-xs sm:text-sm text-[#9b8f7c] leading-relaxed">
          Effective Date: October 2026 · EarnFlow.In Crypto Lottery Platform
        </p>
      </div>

      {/* Terms Content Sections */}
      <div className="space-y-6 text-xs sm:text-sm text-[#d2c5b0] leading-relaxed">
        
        {/* Section 1 */}
        <div className="glass-panel p-6 rounded-2xl border border-[#232938] space-y-3">
          <div className="flex items-center gap-2 text-white font-bold font-display text-base">
            <span className="text-[#ffd700]">1.</span> Acceptance of Agreement & Eligibility
          </div>
          <p>
            By accessing or participating in the EarnFlow.In decentralized lottery platform, purchasing lottery tickets, or interacting with our smart contracts, you explicitly represent and warrant that:
          </p>
          <ul className="list-disc pl-5 space-y-1.5 text-[#9b8f7c]">
            <li>You are at least 18 years of age or the legal age of majority in your jurisdiction.</li>
            <li>You possess full legal authority to enter into and be bound by this Agreement.</li>
            <li>Participation in crypto-denominated prize drawings and random number lotteries is lawful under your local legislation.</li>
          </ul>
        </div>

        {/* Section 2 */}
        <div className="glass-panel p-6 rounded-2xl border border-[#232938] space-y-3">
          <div className="flex items-center gap-2 text-white font-bold font-display text-base">
            <span className="text-[#ffd700]">2.</span> Decentralized Operation & Provably Fair Draws
          </div>
          <p>
            EarnFlow.In operates using cryptographic provably fair algorithms and deterministic SHA-256 / HMAC commitments. Every ticket purchase and lottery draw outcome is anchored on verifiable seeds:
          </p>
          <ul className="list-disc pl-5 space-y-1.5 text-[#9b8f7c]">
            <li>Winning numbers are generated using immutable server seed commitments and client seeds.</li>
            <li>Players can independently audit and verify draw outcomes through our Provably Fair Auditor.</li>
            <li>No lottery draw outcome can be manipulated or altered retroactively by platform operators.</li>
          </ul>
        </div>

        {/* Section 3 */}
        <div className="glass-panel p-6 rounded-2xl border border-[#232938] space-y-3">
          <div className="flex items-center gap-2 text-white font-bold font-display text-base">
            <span className="text-[#ffd700]">3.</span> Ticket Purchases & Finality
          </div>
          <p>
            All ticket purchases are final, irreversible, and non-refundable once confirmed on the ledger. Selected numbers cannot be altered or exchanged after transaction completion.
          </p>
        </div>

        {/* Section 4 */}
        <div className="glass-panel p-6 rounded-2xl border border-[#232938] space-y-3">
          <div className="flex items-center gap-2 text-white font-bold font-display text-base">
            <span className="text-[#ffd700]">4.</span> Payouts & Settlement SLA
          </div>
          <p>
            Prize distributions are processed directly to winners' registered TRC-20 USDT wallets within our guaranteed 24-hour SLA window. Users are solely responsible for ensuring the accuracy of their destination withdrawal addresses.
          </p>
        </div>

        {/* Section 5 */}
        <div className="glass-panel p-6 rounded-2xl border border-[#232938] space-y-3">
          <div className="flex items-center gap-2 text-white font-bold font-display text-base">
            <span className="text-[#ffd700]">5.</span> Support & Inquiries
          </div>
          <p>
            For compliance inquiries, technical assistance, or dispute resolutions, contact our 24/7 support desk at <strong className="text-amber-400">{supportEmail}</strong>.
          </p>
        </div>

      </div>
    </div>
  );
}

