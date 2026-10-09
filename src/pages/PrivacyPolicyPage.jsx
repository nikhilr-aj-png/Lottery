import React from 'react';
import { ArrowLeft, ShieldCheck, Lock, Eye, Database, Globe, Server, CheckCircle } from 'lucide-react';
import { useLottery } from '../context/LotteryContext';

export default function PrivacyPolicyPage({ onBackToHome }) {
  const { platformSettings } = useLottery();
  const supportEmail = platformSettings?.supportEmail || 'support@earnflow.in';
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 animate-in fade-in duration-200">
      {/* Top Breadcrumb / Back button */}
      <button
        onClick={onBackToHome}
        className="mb-8 px-4 py-2 rounded-xl bg-[#141924] hover:bg-[#1f2738] text-xs font-bold text-[#05d5aa] border border-[#05d5aa]/30 flex items-center gap-2 transition-all cursor-pointer shadow-sm"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Return to Lottery Lobby</span>
      </button>

      {/* Header Banner */}
      <div className="glass-panel rounded-2xl p-6 sm:p-8 mb-8 border border-[rgba(5,213,170,0.3)] bg-gradient-to-br from-[#10141e] via-[#0b0e14] to-[#121c22]">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-xl bg-[rgba(5,213,170,0.15)] flex items-center justify-center text-[#05d5aa] border border-[#05d5aa]/30">
            <Lock className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] font-mono-numbers text-[#05d5aa] uppercase font-bold tracking-wider">
              Data Protection & Privacy Architecture
            </span>
            <h1 className="font-display font-extrabold text-2xl sm:text-3xl text-white">
              Privacy Policy
            </h1>
          </div>
        </div>
        <p className="text-xs sm:text-sm text-[#9b8f7c] leading-relaxed">
          Effective Date: October 2026 · EarnFlow.In Sovereign Crypto Lottery Platform
        </p>
      </div>

      {/* Privacy Sections */}
      <div className="space-y-6 text-xs sm:text-sm text-[#d2c5b0] leading-relaxed">
        
        {/* Section 1 */}
        <div className="glass-panel p-6 rounded-2xl border border-[#232938] space-y-3">
          <div className="flex items-center gap-2 text-white font-bold font-display text-base">
            <span className="text-[#05d5aa]">1.</span> Our Privacy-First Commitment
          </div>
          <p>
            EarnFlow.In is engineered upon Web3 decentralized principles. We believe privacy is a fundamental sovereign right. We minimize data harvesting and do not sell, rent, or monetize your personal information under any circumstances.
          </p>
        </div>

        {/* Section 2 */}
        <div className="glass-panel p-6 rounded-2xl border border-[#232938] space-y-3">
          <div className="flex items-center gap-2 text-white font-bold font-display text-base">
            <span className="text-[#05d5aa]">2.</span> Information We Collect
          </div>
          <p>
            To provide safe lottery participation, automated prize disbursals, and guaranteed 24-hour payouts, we collect only essential technical metadata:
          </p>
          <ul className="list-disc pl-5 space-y-1.5 text-[#9b8f7c]">
            <li><strong>Public TRC-20 Wallet Address:</strong> Your public TRON blockchain address used for ticket purchases and receiving prize withdrawals.</li>
            <li><strong>Authentication Identity:</strong> Your email address or Google OAuth identifier used strictly for account authentication and security alerts.</li>
            <li><strong>Transaction Records:</strong> Public blockchain transaction hashes (TxHash), deposit invoice references, and ticket participation records.</li>
          </ul>
        </div>

        {/* Section 3 */}
        <div className="glass-panel p-6 rounded-2xl border border-[#232938] space-y-3">
          <div className="flex items-center gap-2 text-white font-bold font-display text-base">
            <span className="text-[#05d5aa]">3.</span> Public Blockchain Transparency
          </div>
          <p>
            Please note that by nature of blockchain technology, transactions executed on the TRON network (such as ticket buy-ins or withdrawal payouts) are recorded on a publicly accessible distributed ledger. Anyone can inspect block confirmations and transaction hashes on public explorers like Tronscan.
          </p>
        </div>

        {/* Section 4 */}
        <div className="glass-panel p-6 rounded-2xl border border-[#232938] space-y-3">
          <div className="flex items-center gap-2 text-white font-bold font-display text-base">
            <span className="text-[#05d5aa]">4.</span> Infrastructure & Third-Party Service Providers
          </div>
          <p>
            We interface with enterprise-grade infrastructure to deliver secure and seamless operations:
          </p>
          <ul className="list-disc pl-5 space-y-1.5 text-[#9b8f7c]">
            <li><strong>Supabase Cloud Database & Auth:</strong> Row-Level Security (RLS) encrypted authentication and session management.</li>
            <li><strong>NOWPayments Crypto Ingress:</strong> Instant non-custodial crypto invoice generation and IPN webhook processing.</li>
            <li><strong>Chainlink Oracle & SHA-256 VRF:</strong> Provably fair cryptographic random seed verification.</li>
          </ul>
        </div>

        {/* Section 5 */}
        <div className="glass-panel p-6 rounded-2xl border border-[#232938] space-y-3">
          <div className="flex items-center gap-2 text-white font-bold font-display text-base">
            <span className="text-[#05d5aa]">5.</span> Security Safeguards & Encryption
          </div>
          <p>
            All network traffic is encrypted via TLS 1.3. API requests between edge functions and settlement infrastructure utilize HMAC-SHA512 cryptographic signature verification to safeguard against replay attacks or tampering.
          </p>
        </div>

        {/* Section 6 */}
        <div className="glass-panel p-6 rounded-2xl border border-[#232938] space-y-3">
          <div className="flex items-center gap-2 text-white font-bold font-display text-base">
            <span className="text-[#05d5aa]">6.</span> Contact & Inquiries
          </div>
          <p>
            If you have questions regarding our privacy practices or wish to review your account data, you can reach out via our support channel: <a href={`mailto:${supportEmail}`} className="text-[#05d5aa] hover:underline font-mono-numbers">{supportEmail}</a>.
          </p>
        </div>

      </div>

      {/* Bottom Back Button */}
      <div className="mt-8 text-center">
        <button
          onClick={onBackToHome}
          className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-[#05d5aa] to-[#00f2fe] text-[#0b0e14] font-bold text-xs cursor-pointer shadow-md hover:brightness-105"
        >
          Return to Lottery Lobby
        </button>
      </div>
    </div>
  );
}
