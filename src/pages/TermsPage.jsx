import React from 'react';
import { ArrowLeft, Shield, FileText, CheckCircle2, AlertTriangle, Scale, Lock, DollarSign } from 'lucide-react';

export default function TermsPage({ onBackToHome }) {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 animate-in fade-in duration-200">
      {/* Top Breadcrumb / Back button */}
      <button
        onClick={onBackToHome}
        className="mb-8 px-4 py-2 rounded-xl bg-[#141924] hover:bg-[#1f2738] text-xs font-bold text-[#f5c451] border border-[rgba(245,196,81,0.25)] flex items-center gap-2 transition-all cursor-pointer shadow-sm"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Return to Lottery Lobby</span>
      </button>

      {/* Header Banner */}
      <div className="glass-panel rounded-2xl p-6 sm:p-8 mb-8 border border-[rgba(245,196,81,0.3)] bg-gradient-to-br from-[#10141e] via-[#0b0e14] to-[#121826]">
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
            <li>You are at least 18 years of age (or the legal age of majority in your jurisdiction).</li>
            <li>Your participation in blockchain-based cryptocurrency lotteries is lawful under the laws applicable in your jurisdiction.</li>
            <li>You possess full capacity to enter into legally binding contracts and acknowledge the inherent volatility of cryptocurrency assets.</li>
          </ul>
        </div>

        {/* Section 2 */}
        <div className="glass-panel p-6 rounded-2xl border border-[#232938] space-y-3">
          <div className="flex items-center gap-2 text-white font-bold font-display text-base">
            <span className="text-[#ffd700]">2.</span> TRC-20 USDT Wagering & Settlement
          </div>
          <p>
            All lottery pools on EarnFlow.In are settled exclusively in <strong>Tether (USDT) on the TRON network (TRC-20)</strong>. 
          </p>
          <ul className="list-disc pl-5 space-y-1.5 text-[#9b8f7c]">
            <li>Ticket prices and prize distributions are denominated strictly in USDT.</li>
            <li>Users are solely responsible for ensuring that deposits and withdrawal addresses correspond to valid TRC-20 addresses starting with the letter <code className="text-[#ffd700]">T</code>.</li>
            <li>Sending assets on unsupported networks (e.g. non-TRC-20 chains) may result in irreversible loss for which the platform bears no liability.</li>
          </ul>
        </div>

        {/* Section 3 */}
        <div className="glass-panel p-6 rounded-2xl border border-[#232938] space-y-3">
          <div className="flex items-center gap-2 text-white font-bold font-display text-base">
            <span className="text-[#ffd700]">3.</span> 4-Digit Number Selection & Game Rules
          </div>
          <p>
            Participants enter draws by selecting 4 digits ranging from <code className="text-[#05d5aa] font-bold">0000</code> to <code className="text-[#05d5aa] font-bold">9999</code> or utilizing the Quick Pick randomizer.
          </p>
          <p>
            Draw outcomes operate under provably fair lucky draw rules:
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            <div className="p-3.5 rounded-xl bg-[#0b0e14] border border-amber-500/30">
              <span className="text-[#ffd700] font-bold block text-xs">Lucky Winners Equal Share</span>
              <span className="text-white text-xs">Configured number of lucky winners share the prize pool equally based on luck</span>
            </div>
            <div className="p-3.5 rounded-xl bg-[#0b0e14] border border-red-500/30">
              <span className="text-red-400 font-bold block text-xs">Non-Winning Combinations</span>
              <span className="text-white text-xs">Direct lose (No payout)</span>
            </div>
          </div>
        </div>

        {/* Section 4 */}
        <div className="glass-panel p-6 rounded-2xl border border-[#232938] space-y-3">
          <div className="flex items-center gap-2 text-white font-bold font-display text-base">
            <span className="text-[#ffd700]">4.</span> Provably Fair SHA-256 Verification
          </div>
          <p>
            EarnFlow.In utilizes pre-committed cryptographic SHA-256 hashes generated prior to ticket sales. Every draw block hash is published publicly, allowing participants to independently verify mathematical fairness and confirm that no manipulation occurred prior to or during the reveal.
          </p>
        </div>

        {/* Section 5 */}
        <div className="glass-panel p-6 rounded-2xl border border-[#232938] space-y-3">
          <div className="flex items-center gap-2 text-white font-bold font-display text-base">
            <span className="text-[#ffd700]">5.</span> 24-Hour SLA Withdrawal Guarantee
          </div>
          <p>
            Winnings are automatically credited to the player's EarnFlow.In balance immediately upon draw completion.
          </p>
          <ul className="list-disc pl-5 space-y-1.5 text-[#9b8f7c]">
            <li>Withdrawal requests are processed and broadcast to the TRON blockchain within a guaranteed <strong>24-Hour Service Level Agreement (SLA)</strong>.</li>
            <li>A flat network disbursal fee of <strong>1.00 USDT</strong> applies per withdrawal to cover on-chain TRON energy and bandwidth costs.</li>
            <li>Every disbursed withdrawal receives a publicly verifiable Transaction Hash (TxHash).</li>
          </ul>
        </div>

        {/* Section 6 */}
        <div className="glass-panel p-6 rounded-2xl border border-[#232938] space-y-3">
          <div className="flex items-center gap-2 text-white font-bold font-display text-base">
            <span className="text-[#ffd700]">6.</span> Disclaimers & Risk Warning
          </div>
          <div className="p-3.5 rounded-xl bg-amber-950/20 border border-amber-500/30 text-amber-200/90 text-xs flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400 mt-0.5" />
            <span>
              Lottery gaming involves financial risk. Do not play with funds you cannot afford to lose. Ticket purchases cannot be revoked or refunded once entered into an active lottery pool.
            </span>
          </div>
        </div>

      </div>

      {/* Bottom Back Button */}
      <div className="mt-8 text-center">
        <button
          onClick={onBackToHome}
          className="btn-gold px-6 py-2.5 rounded-xl text-xs font-bold cursor-pointer"
        >
          I Understand & Return to Lobby
        </button>
      </div>
    </div>
  );
}
