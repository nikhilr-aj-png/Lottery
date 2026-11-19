/**
 * ============================================================================
 * TERMS & CONDITIONS — EARNFLOW.IN
 * ============================================================================
 * Comprehensive legal document covering 30 exhaustive sections.
 * Matches EarnFlow.in USDT-only currency architecture, 6 active games,
 * Provably Fair cryptographic proofs, 24-hour withdrawal SLA, and Google OAuth.
 * ============================================================================
 */

import React from 'react';
import { 
  ArrowLeft, 
  Scale, 
  ShieldCheck, 
  CheckCircle2, 
  Lock, 
  FileText
} from 'lucide-react';
import { useLottery } from '../context/LotteryContext';

export interface TermsPageProps {
  onBackToHome?: () => void;
}

export default function TermsPage({ onBackToHome }: TermsPageProps) {
  const { platformSettings } = useLottery();
  const supportEmail = platformSettings?.supportEmail ? platformSettings.supportEmail.trim() : '';

  const sections = [
    {
      num: '01',
      title: 'Acceptance of Terms & Legal Age (18+)',
      content: (
        <div className="space-y-3">
          <p>
            By accessing, browsing, registering an account on, or otherwise using <strong className="text-white">EarnFlow.in</strong> (the &quot;Platform&quot;, &quot;Service&quot;, &quot;we&quot;, &quot;our&quot;, or &quot;us&quot;), you acknowledge that you have read, understood, and agreed to be bound by these Terms and Conditions (&quot;Terms&quot;, &quot;Agreement&quot;) and our Privacy Policy.
          </p>
          <p>
            You explicitly represent and warrant that you are at least eighteen (18) years of age or the legal age of majority in your jurisdiction, whichever is higher. Any access to or participation in our games by individuals under 18 is strictly prohibited and constitutes a material breach of this Agreement.
          </p>
        </div>
      )
    },
    {
      num: '02',
      title: 'Definitions & Key Terminology',
      content: (
        <div className="space-y-2">
          <ul className="list-disc pl-5 space-y-1.5 text-[#94a3b8]">
            <li><strong className="text-white">&quot;Platform&quot;</strong>: Refers to the EarnFlow.in web application, Progressive Web Application (PWA), smart contracts, and associated backend infrastructure.</li>
            <li><strong className="text-white">&quot;User&quot; / &quot;Player&quot;</strong>: Any individual who accesses the Platform, creates an account, or participates in gaming rounds.</li>
            <li><strong className="text-white">&quot;USDT&quot;</strong>: Tether USD, specifically deployed on the TRON blockchain network (TRC-20 protocol).</li>
            <li><strong className="text-white">&quot;Provably Fair&quot;</strong>: A cryptographic protocol utilizing SHA-256 and HMAC algorithms enabling players to mathematically audit outcome fairness.</li>
            <li><strong className="text-white">&quot;Wallet&quot;</strong>: A user-connected non-custodial or platform-assigned cryptocurrency ledger balance denominated in USDT.</li>
          </ul>
        </div>
      )
    },
    {
      num: '03',
      title: 'Platform Purpose & Scope of Services',
      content: (
        <div className="space-y-3">
          <p>
            <strong className="text-white">EarnFlow.in is an online gaming platform that provides users with access to interactive games, gaming events, account management, and USDT-based payment features.</strong>
          </p>
          <p>
            The Platform hosts a dedicated suite of six (6) provably fair gaming modules: Four-Digit Lottery, Crash Multiplier, Provably Fair Dice, Coinflip Dual, Bingo – Color Trading, and Horse Racing Turf Derby. All operations are backed by cryptographic commitments and server-side verification.
          </p>
        </div>
      )
    },
    {
      num: '04',
      title: 'USDT-Only Currency Policy (TRC-20)',
      content: (
        <div className="space-y-3">
          <p>
            <strong className="text-white">EarnFlow.in operates strictly and exclusively on USDT (Tether TRC-20).</strong>
          </p>
          <p>
            All game stakes, lottery ticket buy-ins, pool prize determinations, bonus disbursements, and account ledger entries are denominated exclusively in USDT. We do not support fiat currency deposits, credit card charging, or proprietary in-game token speculation.
          </p>
        </div>
      )
    },
    {
      num: '05',
      title: 'Account Registration & User Credentials',
      content: (
        <div className="space-y-3">
          <p>
            Users may register through email verification, Web3 wallet connection, or Google OAuth 2.0 authentication. You agree to provide true, accurate, current, and complete credentials during registration.
          </p>
          <p>
            You are solely responsible for maintaining the confidentiality of your account credentials, login tokens, and passwords. You agree to immediately notify our Support Desk of any unauthorized access or security breach.
          </p>
        </div>
      )
    },
    {
      num: '06',
      title: 'Google OAuth & Third-Party Authentication',
      content: (
        <div className="space-y-3">
          <p>
            When utilizing Google Sign-In, the Platform requests only standard open identity scopes (<code className="text-amber-300">openid</code>, <code className="text-amber-300">email</code>, <code className="text-amber-300">profile</code>).
          </p>
          <p>
            We do not request, access, or store passwords, Google Drive files, contacts, or calendar data. Data retrieved from Google OAuth is strictly utilized to authenticate your identity and populate your public username.
          </p>
        </div>
      )
    },
    {
      num: '07',
      title: 'User Identity Verification (KYC/AML Compliance)',
      content: (
        <div className="space-y-3">
          <p>
            EarnFlow.in maintains strict compliance with international Anti-Money Laundering (AML) and Counter-Terrorist Financing (CTF) regulations.
          </p>
          <p>
            We reserve the right to request Know-Your-Customer (KYC) documentation (government photo ID, proof of address) prior to processing high-value withdrawals or investigating suspicious transactional patterns.
          </p>
        </div>
      )
    },
    {
      num: '08',
      title: 'Security of User Accounts & Wallet Keys',
      content: (
        <div className="space-y-3">
          <p>
            EarnFlow.in utilizes encrypted sessions, TLS 1.3 transport security, and database row-level security (RLS).
          </p>
          <p>
            Players connecting decentralized Web3 wallets maintain full custody of their private keys. The Platform will never request your seed phrase, private keys, or wallet backup credentials under any circumstances.
          </p>
        </div>
      )
    },
    {
      num: '09',
      title: 'USDT Deposits & Confirmation Mechanics',
      content: (
        <div className="space-y-3">
          <p>
            USDT deposits are generated via automated merchant gateway invoices or dedicated TRON network TRC-20 deposit addresses.
          </p>
          <p>
            Deposits require confirmation on the TRON blockchain (typically within 1–3 network blocks). Funds are automatically credited to the player&apos;s available USDT balance immediately upon blockchain confirmation. Minimum deposit limits apply as indicated in the Wallet interface.
          </p>
        </div>
      )
    },
    {
      num: '10',
      title: 'USDT Withdrawals & Processing Timelines (24h SLA)',
      content: (
        <div className="space-y-3">
          <p>
            All legitimate prize winnings and available account balances may be withdrawn to any valid TRC-20 compatible external wallet address.
          </p>
          <p>
            <strong className="text-white">24-Hour Withdrawal SLA:</strong> All withdrawal requests undergo cryptographic verification and risk checks, and are audited, approved, and disbursed within a guaranteed maximum timeframe of twenty-four (24) hours.
          </p>
        </div>
      )
    },
    {
      num: '11',
      title: 'Four-Digit Lottery Rules & Mechanics',
      content: (
        <div className="space-y-3">
          <p>
            In Four-Digit Lottery events, players purchase tickets selecting any 4-digit numeric sequence from <strong className="text-amber-300">0000 through 9999</strong>.
          </p>
          <p>
            Ticket pricing and jackpot pools are denominated in USDT. Upon countdown conclusion, the Provably Fair Oracle determines winning sequence(s). Jackpots are distributed according to event rules (Single Winner 100% or Multiple Winners tier distributions). When multiple tickets hold identical winning numbers, prizes are shared equitably.
          </p>
        </div>
      )
    },
    {
      num: '12',
      title: 'Crash Game Rules & Auto-Cashout Multipliers',
      content: (
        <div className="space-y-3">
          <p>
            In Crash, players stake USDT before launch as the multiplier curve ascends from 1.00x upward.
          </p>
          <p>
            Players must press &quot;Cashout&quot; or configure an automatic cashout multiplier before the unpredictable crash point occurs. If cashout occurs before the crash, the player receives their stake multiplied by the cashout value. If crash occurs first, the round is lost.
          </p>
        </div>
      )
    },
    {
      num: '13',
      title: 'Dice Game Rules & Over/Under Multipliers',
      content: (
        <div className="space-y-3">
          <p>
            Provably Fair Dice allows players to predict whether a random roll outcome (0.00 to 99.99) will settle OVER or UNDER a chosen target.
          </p>
          <p>
            Multiplier odds adjust dynamically based on mathematical win probability, operating with a transparent 1.0% house edge (99.0% RTP). Correct predictions are credited instantly in USDT.
          </p>
        </div>
      )
    },
    {
      num: '14',
      title: 'Coinflip Dual Game Rules & Streak Tracking',
      content: (
        <div className="space-y-3">
          <p>
            Coinflip Dual features a two-sided coin toss (Heads or Tails) with a 50/50 probability model and a fixed 1.98x payout in USDT (1.0% house edge).
          </p>
          <p>
            Results are determined by cryptographic commit-reveal hashing before each flip animation begins. Consecutive winning streaks are recorded for player statistics.
          </p>
        </div>
      )
    },
    {
      num: '15',
      title: 'Bingo – Color Trading Rules & 60-Second Cycles',
      content: (
        <div className="space-y-3">
          <p>
            Bingo – Color Trading operates on rapid 60-second draw rounds where players trade on Color outcomes (Red, Green, Violet), Numbers (0–9), or Size (Big/Small).
          </p>
          <p>
            Payouts: Green (1, 3, 7, 9) pays 2x; Red (2, 4, 6, 8) pays 2x; Violet (0, 5) pays 4.5x; exact Numbers (0–9) pay 9x; Big (5–9) and Small (0–4) pay 1.98x.
          </p>
        </div>
      )
    },
    {
      num: '16',
      title: 'Horse Racing Derby Rules & Fixed Odds',
      content: (
        <div className="space-y-3">
          <p>
            Horse Racing features a 6-runner virtual turf sprint with fixed odds ranging from 2.4x to 35.0x in USDT.
          </p>
          <p>
            Players select their chosen runner to Win. The winning horse is determined by verifiable cryptographic random number generation (RNG) and reflected in real-time visual canvas animations.
          </p>
        </div>
      )
    },
    {
      num: '17',
      title: 'Cryptographic Provably Fair Verification (SHA-256 / HMAC)',
      content: (
        <div className="space-y-3">
          <p>
            Every round across all six active games operates on a cryptographic Commit-Reveal system:
          </p>
          <ol className="list-decimal pl-5 space-y-1.5 text-[#94a3b8]">
            <li><strong className="text-white">Pre-Commitment:</strong> The server generates a random server seed and publishes its SHA-256 hash before bets are accepted.</li>
            <li><strong className="text-white">Client Seed:</strong> A client seed provided by the player or derived from ticket transaction hashes is incorporated.</li>
            <li><strong className="text-white">Nonce:</strong> An incrementing integer counter prevents replay attacks.</li>
            <li><strong className="text-white">Outcome Calculation:</strong> The outcome is computed deterministically via <code className="text-amber-300">HMAC-SHA256(server_seed, client_seed:nonce)</code>.</li>
            <li><strong className="text-white">Seed Reveal:</strong> Following round conclusion, the unhashed server seed is revealed, allowing independent verification.</li>
          </ol>
        </div>
      )
    },
    {
      num: '18',
      title: 'Jackpots, Winner Calculation & Payout Rules',
      content: (
        <div className="space-y-3">
          <p>
            Lottery jackpot amounts are determined either through Manual administrative lock or deterministic Random range generation within configured minimum and maximum limits.
          </p>
          <p>
            Once published and ticket sales begin, jackpot modes, prize tiers, and winning codes are cryptographically locked. Payouts are credited directly to winners&apos; verified balances.
          </p>
        </div>
      )
    },
    {
      num: '19',
      title: 'Anti-Fraud, Multi-Accounting & Bot Restrictions',
      content: (
        <div className="space-y-3">
          <p>
            Players are permitted one (1) account per individual, household, and IP address.
          </p>
          <p>
            The use of automated scripts, scraping bots, network interception, exploiting software glitches, collusion, or creating syndicates to manipulate jackpots is strictly prohibited. Violations will result in immediate account termination and forfeiture of ill-gotten funds.
          </p>
        </div>
      )
    },
    {
      num: '20',
      title: 'Responsible Social Gaming, Limits & Self-Exclusion',
      content: (
        <div className="space-y-3">
          <p>
            EarnFlow.in is committed to promoting responsible entertainment. We provide automated user controls inside the Support &amp; FAQ portal:
          </p>
          <ul className="list-disc pl-5 space-y-1 text-[#94a3b8]">
            <li><strong className="text-white">Daily Wagering Limits:</strong> Cap the total USDT you may stake within 24 hours.</li>
            <li><strong className="text-white">Session Reminders:</strong> Automated pop-up reality checks every 30, 60, or 120 minutes.</li>
            <li><strong className="text-white">Self-Exclusion:</strong> Voluntary account lockouts for 24 hours, 7 days, 30 days, or permanent exclusion.</li>
          </ul>
        </div>
      )
    },
    {
      num: '21',
      title: 'Discontinuation of Legacy Tokens (FLO Coins / Points)',
      content: (
        <div className="space-y-3">
          <p>
            All legacy virtual test tokens, including Flow Coins (FC) and Flow Points, have been permanently retired from active gameplay and platform accounting.
          </p>
          <p>
            The Platform exclusively supports USDT (TRC-20). Any references in legacy third-party documentation to virtual non-redeemable coins are superseded by these Terms.
          </p>
        </div>
      )
    },
    {
      num: '22',
      title: 'Platform Fees, House Edge & RTP Guarantees',
      content: (
        <div className="space-y-3">
          <p>
            Each game features a transparent, audited Return-to-Player (RTP) percentage:
          </p>
          <ul className="list-disc pl-5 space-y-1 text-[#94a3b8]">
            <li>Crash: 99.0% RTP (1.0% House Edge)</li>
            <li>Dice: 99.0% RTP (1.0% House Edge)</li>
            <li>Coinflip: 99.0% RTP (1.0% House Edge)</li>
            <li>Bingo – Color Trading: 98.0% RTP (2.0% House Edge)</li>
            <li>Horse Racing: 97.5% RTP (2.5% House Edge)</li>
            <li>Four-Digit Lottery: 95.0% RTP (5.0% House Edge)</li>
          </ul>
        </div>
      )
    },
    {
      num: '23',
      title: 'Intellectual Property & Brand Assets',
      content: (
        <div className="space-y-3">
          <p>
            All trademarks, logos, graphical interfaces, sound effects, game math models, software code, and documentation displayed on EarnFlow.in are the exclusive intellectual property of EarnFlow.in.
          </p>
          <p>
            Unauthorized reproduction, reverse-engineering, decompilation, framing, or distribution of Platform assets without explicit written consent is strictly prohibited.
          </p>
        </div>
      )
    },
    {
      num: '24',
      title: 'Prohibited Jurisdictions & Regulatory Compliance',
      content: (
        <div className="space-y-3">
          <p>
            It is the sole responsibility of the User to ensure compliance with the laws of their local jurisdiction regarding online entertainment, lottery participation, and cryptocurrency transactions.
          </p>
          <p>
            Users from jurisdictions where online gaming is prohibited by law are not permitted to access or register on the Platform.
          </p>
        </div>
      )
    },
    {
      num: '25',
      title: 'Service Modifications, Downtime & Maintenance',
      content: (
        <div className="space-y-3">
          <p>
            We reserve the right to modify, suspend, update, or discontinue any feature, game module, or event at any time without prior notice.
          </p>
          <p>
            In the event of scheduled maintenance or unexpected technical interruptions, any active round with confirmed seed commitments will settle deterministically once services resume.
          </p>
        </div>
      )
    },
    {
      num: '26',
      title: 'Limitation of Liability & Disclaimers',
      content: (
        <div className="space-y-3">
          <p>
            THE PLATFORM IS PROVIDED ON AN &quot;AS IS&quot; AND &quot;AS AVAILABLE&quot; BASIS WITHOUT WARRANTIES OF ANY KIND, WHETHER EXPRESS OR IMPLIED.
          </p>
          <p>
            IN NO EVENT SHALL EARNFLOW.IN, ITS OPERATORS, DIRECTORS, OR AFFILIATES BE LIABLE FOR INDIRECT, INCIDENTAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING LOSS OF PROFITS, DATA, OR CRYPTOCURRENCY ARISING FROM BLOCKCHAIN CONGESTION OR NETWORK DELAYS.
          </p>
        </div>
      )
    },
    {
      num: '27',
      title: 'Indemnification',
      content: (
        <div className="space-y-3">
          <p>
            You agree to defend, indemnify, and hold harmless EarnFlow.in, its licensors, service providers, and contractors from and against any claims, liabilities, damages, judgments, awards, losses, costs, expenses, or fees arising out of your violation of these Terms or your use of the Platform.
          </p>
        </div>
      )
    },
    {
      num: '28',
      title: 'Dispute Resolution, Governing Law & Jurisdiction',
      content: (
        <div className="space-y-3">
          <p>
            These Terms shall be governed by and construed in accordance with generally accepted principles of international commercial law.
          </p>
          <p>
            In the event of any dispute, the parties agree to first engage in good-faith informal negotiations via our dedicated Support Desk for a minimum period of thirty (30) days prior to initiating formal arbitration.
          </p>
        </div>
      )
    },
    {
      num: '29',
      title: 'Severability & Entire Agreement',
      content: (
        <div className="space-y-3">
          <p>
            If any provision of these Terms is deemed unlawful, void, or unenforceable by an arbitrator or court of competent jurisdiction, that provision shall be severed and shall not affect the validity and enforceability of any remaining provisions.
          </p>
          <p>
            These Terms, along with our Privacy Policy, constitute the sole and entire agreement between you and EarnFlow.in with respect to the Platform.
          </p>
        </div>
      )
    },
    {
      num: '30',
      title: 'Contact Information, Official Desk & Support SLA',
      content: (
        <div className="space-y-3">
          <p>
            For questions, legal inquiries, technical support, or Provably Fair audit assistance, our team is available 24/7 through our official communication channels:
          </p>
          <div className="p-4 rounded-xl bg-[#0B0F19] border border-[#1F2737] space-y-2 text-xs">
            {supportEmail ? (
              <p><strong className="text-white">Official Support Email:</strong> <a href={`mailto:${supportEmail}`} className="text-amber-400 hover:underline">{supportEmail}</a></p>
            ) : (
              <p><strong className="text-white">Official Support:</strong> <span className="text-[#94a3b8] italic">Support tickets available 24/7 via the Support Desk.</span></p>
            )}
            <p><strong className="text-white">Support Desk Portal:</strong> Available directly via <strong className="text-white">/support</strong></p>
            <p><strong className="text-white">Platform Domain:</strong> <a href="https://earnflow.in" className="text-amber-400 hover:underline">https://earnflow.in</a></p>
            <p><strong className="text-white">Support Response SLA:</strong> Initial response within 6 hours; withdrawal disbursements within 24 hours.</p>
          </div>
        </div>
      )
    }
  ];

  return (
    <div className="max-w-4xl 2xl:max-w-5xl mx-auto px-2.5 xs:px-4 sm:px-6 lg:px-8 py-6 sm:py-10 animate-in fade-in duration-200 text-left">
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
          <div className="w-12 h-12 rounded-xl bg-amber-500/15 flex items-center justify-center text-amber-400 border border-amber-500/30 shadow-[0_0_20px_rgba(245,196,81,0.2)] shrink-0">
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
          Effective Date: November 19, 2026 · Comprehensive 30-Section Operating Agreement for <strong className="text-white">EarnFlow.in</strong>
        </p>

        <div className="mt-4 pt-3 border-t border-[#1f2737] flex flex-wrap items-center gap-3 text-xs text-[#94a3b8]">
          <span className="inline-flex items-center gap-1 text-emerald-400 font-mono-numbers font-semibold">
            <CheckCircle2 className="w-3.5 h-3.5" />
            USDT (TRC-20) Architecture
          </span>
          <span>•</span>
          <span className="inline-flex items-center gap-1 text-amber-400 font-mono-numbers font-semibold">
            <ShieldCheck className="w-3.5 h-3.5" />
            100% Provably Fair Cryptography
          </span>
          <span>•</span>
          <span className="inline-flex items-center gap-1 text-purple-400 font-mono-numbers font-semibold">
            <Lock className="w-3.5 h-3.5" />
            24-Hour Withdrawal SLA
          </span>
        </div>
      </div>

      {/* Table of Contents Quick Jump Grid */}
      <div className="mb-8 p-4 sm:p-5 rounded-2xl bg-[#0B0F19] border border-[#1F2737]">
        <h3 className="font-display font-bold text-xs sm:text-sm text-white uppercase tracking-wider mb-3 flex items-center gap-2">
          <FileText className="w-4 h-4 text-amber-400" />
          <span>Quick Directory (30 Governance Sections)</span>
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-1.5 text-[11px]">
          {sections.map((sec, idx) => (
            <a
              key={sec.num}
              href={`#section-${sec.num}`}
              className="text-[#94a3b8] hover:text-amber-300 transition-colors truncate block py-0.5"
            >
              <strong className="text-amber-400 font-mono-numbers mr-1">{sec.num}.</strong>
              {sec.title}
            </a>
          ))}
        </div>
      </div>

      {/* 30 Terms Sections */}
      <div className="space-y-4 text-xs sm:text-sm text-[#cbd5e1] leading-relaxed">
        {sections.map((sec, idx) => (
          <div 
            key={sec.num}
            id={`section-${sec.num}`}
            className="glass-panel p-5 sm:p-6 rounded-2xl border border-[#1f2737] hover:border-amber-500/30 transition-all scroll-mt-20"
          >
            <div className="flex items-center justify-between gap-3 mb-3">
              <div className="flex items-center gap-2.5 text-white font-bold font-display text-sm sm:text-base">
                <span className="w-7 h-7 rounded-lg bg-amber-500/15 text-amber-400 flex items-center justify-center text-xs font-mono-numbers font-black shrink-0">
                  {sec.num}
                </span>
                <span>{sec.title}</span>
              </div>
            </div>
            {sec.content}
          </div>
        ))}
      </div>

      {/* Footer Support Signoff */}
      <div className="mt-8 p-5 sm:p-6 rounded-2xl bg-[#0B0F19] border border-amber-500/30 text-center space-y-2">
        <p className="text-xs text-[#94a3b8]">
          Have questions regarding our Terms &amp; Conditions or cryptographic verification?
        </p>
        <p className="text-xs">
          {supportEmail ? (
            <>Contact our compliance team anytime at <a href={`mailto:${supportEmail}`} className="text-amber-400 font-bold hover:underline">{supportEmail}</a> or open a ticket in <a href="/support" className="text-purple-400 font-bold hover:underline">Customer Support Desk</a>.</>
          ) : (
            <>Contact our compliance team anytime by opening a ticket in the <a href="/support" className="text-purple-400 font-bold hover:underline">Customer Support Desk</a>.</>
          )}
        </p>
      </div>

    </div>
  );
}
