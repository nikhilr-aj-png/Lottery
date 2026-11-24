import React from 'react';
import { 
  ArrowLeft, 
  ShieldCheck, 
  Lock, 
  Mail,
  Printer
} from 'lucide-react';
import { useLottery } from '../context/LotteryContext';

export interface PrivacyPolicyPageProps {
  onBackToHome?: () => void;
}

export default function PrivacyPolicyPage({ onBackToHome }: PrivacyPolicyPageProps) {
  const { platformSettings } = useLottery();
  const supportEmail = platformSettings?.supportEmail?.trim() || 'earnflow.user@gmail.com';

  // Ensure Privacy Policy page opens from the very top on all devices
  React.useEffect(() => {
    const mainEl = document.getElementById('main-content');
    if (mainEl) {
      mainEl.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    }
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, []);

  const handlePrint = () => {
    if (typeof window !== 'undefined') {
      window.print();
    }
  };

  return (
    <div className="max-w-4xl 2xl:max-w-5xl mx-auto px-3 xs:px-4 sm:px-6 lg:px-8 py-6 sm:py-10 animate-in fade-in duration-200 text-left">
      
      {/* Top Header & Navigation Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[#1F2737]">
        <div>
          {onBackToHome && (
            <button
              onClick={onBackToHome}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#94A3B8] hover:text-emerald-400 transition-colors cursor-pointer mb-2.5"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Home</span>
            </button>
          )}
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-mono-numbers text-[10px] sm:text-xs font-bold inline-flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>Official Privacy Governance</span>
            </span>
            <span className="text-[11px] font-mono-numbers text-[#94A3B8]">
              Effective: November 2026
            </span>
          </div>
          <h1 className="font-display font-black text-2xl sm:text-3xl text-white mt-1.5">
            Privacy Policy
          </h1>
          <p className="text-xs sm:text-sm text-[#94A3B8] mt-1">
            Data Governance, Protection Protocols, and Privacy Standards of EarnFlow.in
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handlePrint}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#141924] hover:bg-[#1C2333] border border-[#273145] text-xs font-semibold text-[#CBD5E1] hover:text-white transition-colors cursor-pointer"
            title="Print or Save PDF"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print / PDF</span>
          </button>
        </div>
      </div>

      {/* Main Privacy Document Sheet */}
      <article className="mt-8 bg-[#0D121D] border border-[#1F2737] rounded-2xl p-5 sm:p-8 lg:p-10 space-y-8 text-xs sm:text-sm text-[#CBD5E1] leading-relaxed shadow-xl">
        
        {/* Document Preamble */}
        <section className="space-y-3 pb-6 border-b border-[#1F2737]/70">
          <p className="font-medium text-white">
            EarnFlow.in (&quot;we&quot;, &quot;us&quot;, &quot;our&quot;, or the &quot;Platform&quot;) respects your personal privacy and is committed to protecting your personal data through robust encryption, minimal data collection, and strict data governance protocols.
          </p>
          <p className="text-[#94A3B8]">
            This Privacy Policy explains how we collect, process, maintain, and safeguard your information when you visit, create an account, or participate in online Four-Digit Lottery events on EarnFlow.in. By accessing the Platform, you consent to the practices described in this document.
          </p>
        </section>

        {/* 1. Introduction & Core Principles */}
        <section className="space-y-3">
          <h2 className="font-display font-bold text-base sm:text-lg text-white flex items-center gap-2">
            <span className="text-emerald-400 font-mono-numbers">1.</span>
            Introduction &amp; Core Principles
          </h2>
          <p>
            We adhere to the principle of data minimization: we collect only the information strictly necessary to provide, secure, and operate the Four-Digit Lottery platform and its associated USDT wallet operations.
          </p>
          <p>
            We do not sell, rent, monetize, or lease your personal data to marketing organizations or third-party advertisers. All data handling is governed by strict technical access controls and cryptographic standards.
          </p>
        </section>

        {/* 2. Information We Collect */}
        <section className="space-y-3">
          <h2 className="font-display font-bold text-base sm:text-lg text-white flex items-center gap-2">
            <span className="text-emerald-400 font-mono-numbers">2.</span>
            Information We Collect
          </h2>
          <p>We collect the following categories of information when you interact with our Platform:</p>
          <ul className="list-disc pl-5 space-y-1.5 text-[#94A3B8]">
            <li><strong className="text-white">Account Information:</strong> Selected username, email address, and authentication identifiers (such as Google OAuth user ID or Web3 public wallet address). We never request or store your private cryptographic keys.</li>
            <li><strong className="text-white">Lottery &amp; Transaction Activity:</strong> Ticket purchases, chosen 4-digit numbers, draw participation timestamps, winning records, and USDT prize distribution entries recorded in our immutable ledger.</li>
            <li><strong className="text-white">Financial &amp; Wallet Data:</strong> Public TRC-20 wallet deposit addresses, transaction hashes, withdrawal destinations, and confirmed ledger balances. We do not store or process credit card numbers or banking passwords.</li>
            <li><strong className="text-white">Technical &amp; Device Information:</strong> Device category, browser family, operating system, display viewport size, and network connection metadata necessary to deliver responsive lottery graphics and detect automated scraping or bot interference.</li>
          </ul>
        </section>

        {/* 3. How We Use Information */}
        <section className="space-y-3">
          <h2 className="font-display font-bold text-base sm:text-lg text-white flex items-center gap-2">
            <span className="text-emerald-400 font-mono-numbers">3.</span>
            How We Use Collected Information
          </h2>
          <p>The information we collect is utilized strictly for legitimate operational purposes:</p>
          <ul className="list-disc pl-5 space-y-1.5 text-[#94A3B8]">
            <li>Authenticating your player session and maintaining account security.</li>
            <li>Registering your valid 4-digit ticket selections and associating them with specific draw rooms.</li>
            <li>Executing cryptographic draw results and automatically distributing jackpot prize allocations.</li>
            <li>Processing TRC-20 deposit validations and 24-hour withdrawal requests.</li>
            <li>Detecting and mitigating multi-accounting, automated scalping bots, and malicious exploits.</li>
            <li>Providing technical customer support and responding to player inquiries.</li>
          </ul>
        </section>

        {/* 4. Blockchain & Financial Ledger Transparency */}
        <section className="space-y-3">
          <h2 className="font-display font-bold text-base sm:text-lg text-white flex items-center gap-2">
            <span className="text-emerald-400 font-mono-numbers">4.</span>
            Blockchain &amp; Financial Ledger Transparency
          </h2>
          <p>
            Lottery ticket purchases and payouts are denominated in USDT on the Tron (TRC-20) blockchain. Due to the inherent architecture of decentralized distributed ledgers, public blockchain transactions (including wallet addresses, transaction hashes, and transfer amounts) are permanently visible on public block explorers.
          </p>
          <p>
            Users acknowledge that blockchain records are public, decentralized, and immutable, and cannot be modified or erased once broadcasted to the network.
          </p>
        </section>

        {/* 5. Data Security & Technical Safeguards */}
        <section className="space-y-3">
          <h2 className="font-display font-bold text-base sm:text-lg text-white flex items-center gap-2">
            <span className="text-emerald-400 font-mono-numbers">5.</span>
            Data Security &amp; Technical Safeguards
          </h2>
          <p>
            We implement comprehensive technical and organizational safeguards to protect your personal data from unauthorized access, alteration, disclosure, or destruction. All data transmissions between your browser and our servers are encrypted via Transport Layer Security (TLS 1.3 / HTTPS).
          </p>
          <p>
            Database access is protected by Row-Level Security (RLS) policies, ensuring that users can only access their own private transaction records and profile settings. Administrative access requires multi-factor cryptographic authentication.
          </p>
        </section>

        {/* 6. Cookies & Local Storage Practices */}
        <section className="space-y-3">
          <h2 className="font-display font-bold text-base sm:text-lg text-white flex items-center gap-2">
            <span className="text-emerald-400 font-mono-numbers">6.</span>
            Cookies &amp; Local Storage Practices
          </h2>
          <p>
            EarnFlow.in uses strictly necessary session cookies and browser LocalStorage items to preserve your authenticated session, remember sound preferences, and store UI sidebar states.
          </p>
          <p>
            We do not use invasive third-party cross-site advertising trackers or analytics beacons that monitor your web browsing activity across external sites.
          </p>
        </section>

        {/* 7. Data Sharing & Third-Party Disclosure */}
        <section className="space-y-3">
          <h2 className="font-display font-bold text-base sm:text-lg text-white flex items-center gap-2">
            <span className="text-emerald-400 font-mono-numbers">7.</span>
            Data Sharing &amp; Third-Party Disclosure
          </h2>
          <p>
            We do not sell, rent, or trade your personal information. Information is shared only with verified technical infrastructure providers strictly necessary to deliver the Platform&apos;s functionality:
          </p>
          <ul className="list-disc pl-5 space-y-1.5 text-[#94A3B8]">
            <li>Cloud hosting, content delivery network (CDN), and distributed denial-of-service (DDoS) mitigation partners.</li>
            <li>Enterprise cloud database infrastructure (Supabase) protected by strict privacy agreements.</li>
            <li>Identity authentication providers (such as Google OAuth) solely to verify your login credentials.</li>
          </ul>
        </section>

        {/* 8. Data Retention Policies */}
        <section className="space-y-3">
          <h2 className="font-display font-bold text-base sm:text-lg text-white flex items-center gap-2">
            <span className="text-emerald-400 font-mono-numbers">8.</span>
            Data Retention Policies
          </h2>
          <p>
            Active account data is retained for the lifespan of your account. Financial transaction records, lottery entries, and winning payouts are retained in our financial audit ledger for regulatory, accounting, and anti-fraud verification purposes.
          </p>
        </section>

        {/* 9. User Privacy Rights */}
        <section className="space-y-3">
          <h2 className="font-display font-bold text-base sm:text-lg text-white flex items-center gap-2">
            <span className="text-emerald-400 font-mono-numbers">9.</span>
            User Privacy Rights
          </h2>
          <p>
            Depending on your jurisdiction, you may have specific statutory privacy rights, including:
          </p>
          <ul className="list-disc pl-5 space-y-1.5 text-[#94A3B8]">
            <li>The right to access the personal information we hold concerning your account.</li>
            <li>The right to request rectification of inaccurate profile information.</li>
            <li>The right to request account closure and deletion of non-essential personal identifiers.</li>
            <li>The right to request an export of your ticket purchase history and balance logs.</li>
          </ul>
        </section>

        {/* 10. Children's Privacy (Strictly 18+) */}
        <section className="space-y-3">
          <h2 className="font-display font-bold text-base sm:text-lg text-white flex items-center gap-2">
            <span className="text-emerald-400 font-mono-numbers">10.</span>
            Underage Gaming &amp; Minors (Strict 18+ Policy)
          </h2>
          <p>
            EarnFlow.in is exclusively intended for adults aged eighteen (18) or older. We do not knowingly collect or solicit personal information from children or minors. If we discover that an account has been registered by a minor, the account and all associated records will be deleted immediately.
          </p>
        </section>

        {/* 11. Policy Modifications & Amendments */}
        <section className="space-y-3">
          <h2 className="font-display font-bold text-base sm:text-lg text-white flex items-center gap-2">
            <span className="text-emerald-400 font-mono-numbers">11.</span>
            Policy Modifications &amp; Amendments
          </h2>
          <p>
            We may update this Privacy Policy from time to time to reflect operational, legal, or regulatory modifications. Any revisions will be published on this page with an updated &quot;Last Updated&quot; date. We encourage players to review this page periodically.
          </p>
        </section>

        {/* 12. Contact Governance Desk & Support */}
        <section className="space-y-3">
          <h2 className="font-display font-bold text-base sm:text-lg text-white flex items-center gap-2">
            <span className="text-emerald-400 font-mono-numbers">12.</span>
            Contact Governance Desk &amp; Support
          </h2>
          <p>
            For questions, data subject requests, or privacy compliance inquiries, please contact our Data Governance desk:
          </p>
          <div className="p-4 rounded-xl bg-[#090D16] border border-[#1F2737] flex items-center gap-3 mt-3">
            <Mail className="w-5 h-5 text-emerald-400 shrink-0" />
            <div>
              <span className="text-[10px] text-[#94A3B8] uppercase font-bold block">Privacy &amp; Data Desk</span>
              <a href={`mailto:${supportEmail}`} className="text-sm font-bold text-emerald-400 hover:underline">
                {supportEmail}
              </a>
            </div>
          </div>
        </section>

      </article>

      {/* Footer Support Banner */}
      <div className="mt-8 p-5 rounded-2xl bg-[#0D121D] border border-emerald-500/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h3 className="font-bold text-sm text-white">Have questions about your privacy or data?</h3>
          <p className="text-xs text-[#94A3B8] mt-0.5">
            Our data protection team is available to assist you with any questions or requests.
          </p>
        </div>
        <a
          href={`mailto:${supportEmail}`}
          className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold text-xs transition-colors shrink-0 flex items-center gap-1.5"
        >
          <Mail className="w-3.5 h-3.5" />
          <span>Contact Support</span>
        </a>
      </div>

    </div>
  );
}
