import React from 'react';
import { 
  ArrowLeft, 
  ShieldCheck, 
  FileText, 
  Mail,
  Printer
} from 'lucide-react';
import { useLottery } from '../context/LotteryContext';

export interface TermsPageProps {
  onBackToHome?: () => void;
}

export default function TermsPage({ onBackToHome }: TermsPageProps) {
  const { platformSettings } = useLottery();
  const supportEmail = platformSettings?.supportEmail?.trim() || 'earnflow.user@gmail.com';

  // Ensure Terms & Conditions page opens from the very top on all devices
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
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#94A3B8] hover:text-amber-400 transition-colors cursor-pointer mb-2.5"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Home</span>
            </button>
          )}
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 font-mono-numbers text-[10px] sm:text-xs font-bold inline-flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-amber-400" />
              <span>Legal Document</span>
            </span>
            <span className="text-[11px] font-mono-numbers text-[#94A3B8]">
              Effective: November 2026
            </span>
          </div>
          <h1 className="font-display font-black text-2xl sm:text-3xl text-white mt-1.5">
            Terms &amp; Conditions
          </h1>
          <p className="text-xs sm:text-sm text-[#94A3B8] mt-1">
            Standard Operating Terms, Rules, and Player Agreements for EarnFlow.in
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

      {/* Main Legal Document Sheet */}
      <article className="mt-8 bg-[#0D121D] border border-[#1F2737] rounded-2xl p-5 sm:p-8 lg:p-10 space-y-8 text-xs sm:text-sm text-[#CBD5E1] leading-relaxed shadow-xl">
        
        {/* Document Preamble */}
        <section className="space-y-3 pb-6 border-b border-[#1F2737]/70">
          <p className="font-medium text-white">
            Please read these Terms and Conditions (&quot;Terms&quot;, &quot;Agreement&quot;) carefully before accessing or participating in any online Four-Digit Lottery event on EarnFlow.in.
          </p>
          <p className="text-[#94A3B8]">
            This Agreement constitutes a binding contract between EarnFlow.in (&quot;Platform&quot;, &quot;we&quot;, &quot;us&quot;, or &quot;our&quot;) and you (&quot;User&quot;, &quot;Player&quot;, or &quot;Participant&quot;). By creating an account, depositing cryptocurrency, or purchasing any lottery ticket on the Platform, you acknowledge that you have read, understood, and agree to be fully bound by these Terms, as well as our Privacy Policy and Responsible Gaming guidelines.
          </p>
        </section>

        {/* 1. Introduction & Agreement to Terms */}
        <section className="space-y-3">
          <h2 className="font-display font-bold text-base sm:text-lg text-white flex items-center gap-2">
            <span className="text-amber-400 font-mono-numbers">1.</span>
            Introduction &amp; Acceptance of Terms
          </h2>
          <p>
            Welcome to EarnFlow.in. These Terms govern your access to and use of the EarnFlow website, applications, APIs, smart contract interfaces, and digital services (collectively, the &quot;Platform&quot; or &quot;Services&quot;).
          </p>
          <p>
            If you do not agree with any provision of these Terms, you must discontinue your use of the Platform immediately. Continued use of the Platform constitutes ongoing acceptance of all published terms and conditions.
          </p>
        </section>

        {/* 2. Platform Description & Single-Game Specialization */}
        <section className="space-y-3">
          <h2 className="font-display font-bold text-base sm:text-lg text-white flex items-center gap-2">
            <span className="text-amber-400 font-mono-numbers">2.</span>
            Platform Description &amp; Single-Game Specialization
          </h2>
          <p>
            <strong className="text-white">EarnFlow.in operates exclusively as an online Four-Digit Lottery gaming platform.</strong>
          </p>
          <p>
            The Platform provides users with access to live Four-Digit Lottery events, number selection workstations, transparent countdown timers, automated draw results, balance management, and USDT (TRC-20) payment processing. No other casino games, arcade games, or slot machines operate on EarnFlow.in.
          </p>
        </section>

        {/* 3. Eligibility & Age Restriction (18+ Only) */}
        <section className="space-y-3">
          <h2 className="font-display font-bold text-base sm:text-lg text-white flex items-center gap-2">
            <span className="text-amber-400 font-mono-numbers">3.</span>
            Eligibility &amp; Age Restriction (Strictly 18+)
          </h2>
          <p>
            Participation on EarnFlow.in is strictly limited to individuals who are at least eighteen (18) years of age, or the legal age of majority in their jurisdiction, whichever is higher.
          </p>
          <p>
            You are strictly responsible for verifying that your participation in online lucky draw games is lawful under the statutes, rules, and regulatory frameworks of your geographical location. The Platform reserves the right to request proof of age and identity at any time. Any account identified as belonging to an individual under the age of 18 will be terminated immediately, and all associated tickets voided.
          </p>
        </section>

        {/* 4. Account Registration & Security */}
        <section className="space-y-3">
          <h2 className="font-display font-bold text-base sm:text-lg text-white flex items-center gap-2">
            <span className="text-amber-400 font-mono-numbers">4.</span>
            Account Registration &amp; Credential Protection
          </h2>
          <p>
            Users may register through email verification, Web3 wallet connection, or authorized OAuth identity providers. You agree to provide true, accurate, current, and complete information during registration.
          </p>
          <p>
            Each individual user is permitted to maintain only one (1) active account on EarnFlow.in. The creation of duplicate, automated, or puppet accounts to circumvent limits or manipulate draws is strictly prohibited and grounds for immediate termination.
          </p>
          <p>
            You are solely responsible for maintaining the confidentiality of your login credentials, passwords, recovery tokens, and linked private keys. All actions conducted through your authenticated account are deemed authorized by you.
          </p>
        </section>

        {/* 5. Four-Digit Lottery Rules & Mechanics */}
        <section className="space-y-3">
          <h2 className="font-display font-bold text-base sm:text-lg text-white flex items-center gap-2">
            <span className="text-amber-400 font-mono-numbers">5.</span>
            Four-Digit Lottery Rules &amp; Game Mechanics
          </h2>
          <p>
            In Four-Digit Lottery events, players choose a 4-digit sequence between <strong className="text-amber-300 font-mono">0000 and 9999</strong> (10,000 possible distinct permutations).
          </p>
          <p>
            The game operates with an industry-standard mathematical return-to-player (RTP) model of <strong className="text-white">95.0%</strong> with a transparent platform operating margin (house edge) of <strong className="text-white">5.0%</strong>. Every permutation has an equal, unbiased 1-in-10,000 probability of being selected.
          </p>
          <p>
            Tickets may be chosen manually via the four interactive numerical dial rollers or generated automatically through the randomized Quick Pick mechanism. Once submitted, ticket numbers are immutably tied to the event and cannot be swapped or transferred.
          </p>
        </section>

        {/* 6. Single-Ticket Entry Policy & Pricing */}
        <section className="space-y-3">
          <h2 className="font-display font-bold text-base sm:text-lg text-white flex items-center gap-2">
            <span className="text-amber-400 font-mono-numbers">6.</span>
            Single-Ticket Entry Policy &amp; Pricing
          </h2>
          <p>
            <strong className="text-white">Strict Single-Ticket Entry:</strong> Each ticket purchase action corresponds to exactly one (1) lottery ticket holding one 4-digit combination. The total cost for each entry action equals the exact unit price of that room (Total Cost = Unit Price).
          </p>
          <p>
            Bulk automated entry scripts, automated batch scalping, and multi-quantity multipliers are strictly disallowed to maintain a balanced, fair community playing field. Ticket prices are denominated in USDT and clearly displayed on each live room card (e.g., 10 USDT per ticket).
          </p>
        </section>

        {/* 7. Wallet Terms & USDT TRC-20 Settlements */}
        <section className="space-y-3">
          <h2 className="font-display font-bold text-base sm:text-lg text-white flex items-center gap-2">
            <span className="text-amber-400 font-mono-numbers">7.</span>
            Wallet Operations &amp; USDT (TRC-20) Settlements
          </h2>
          <p>
            Your EarnFlow wallet balance reflects your confirmed USDT holdings on the Platform. Before any ticket is issued, our backend ledger validates that your balance equals or exceeds the ticket price. Entries cannot be placed on credit or negative balance.
          </p>
          <p>
            Wallet balances can be funded via TRC-20 USDT deposits. Withdrawals are processed back to your specified TRC-20 address within our standard 24-hour verification window. You are responsible for ensuring that withdrawal recipient addresses support TRC-20 USDT tokens. Transfers sent to incompatible networks or incorrect addresses cannot be recovered.
          </p>
        </section>

        {/* 8. Event Timers, Sales Closing & Result Declarations */}
        <section className="space-y-3">
          <h2 className="font-display font-bold text-base sm:text-lg text-white flex items-center gap-2">
            <span className="text-amber-400 font-mono-numbers">8.</span>
            Event Timers, Sales Closing &amp; Result Declarations
          </h2>
          <p>
            Each Four-Digit Lottery event features a designated draw time and a ticking countdown. To ensure provable fairness and prevent front-running or timing exploits, ticket sales close prior to draw execution.
          </p>
          <p>
            When the countdown reaches zero, the event transitions to the draw execution phase. The official winning four-digit sequence is published publicly to the Result Screen and Results view. Until the winning combination is cryptographically verified and recorded, the event is marked as &quot;Draw Pending Official Declaration&quot;.
          </p>
        </section>

        {/* 9. Winning Criteria & Prize Distribution */}
        <section className="space-y-3">
          <h2 className="font-display font-bold text-base sm:text-lg text-white flex items-center gap-2">
            <span className="text-amber-400 font-mono-numbers">9.</span>
            Winning Criteria &amp; Prize Distribution
          </h2>
          <p>
            A ticket is classified as an exact grand winner if and only if its 4-digit sequence matches the published winning 4-digit sequence in exact order (position 1, position 2, position 3, position 4).
          </p>
          <p>
            If two or more tickets hold the exact matching winning four-digit sequence in the same event, the total winning prize pool is divided equally among all eligible winning tickets. Payout processing is atomic and idempotent: winning user wallets are credited automatically upon draw resolution, and payout records are permanently logged in the financial ledger.
          </p>
        </section>

        {/* 10. Refund & Cancellation Policy */}
        <section className="space-y-3">
          <h2 className="font-display font-bold text-base sm:text-lg text-white flex items-center gap-2">
            <span className="text-amber-400 font-mono-numbers">10.</span>
            Refund &amp; Cancellation Policy
          </h2>
          <p>
            Once purchased and confirmed in the database, lottery tickets are non-cancellable and non-refundable by the player.
          </p>
          <p>
            In the rare event that a scheduled draw is permanently canceled due to an unrecoverable technical disruption or administrative cancellation, 100% of the ticket purchase amount is refunded automatically to the originating user&apos;s wallet.
          </p>
        </section>

        {/* 11. Prohibited Conduct & Integrity Safeguards */}
        <section className="space-y-3">
          <h2 className="font-display font-bold text-base sm:text-lg text-white flex items-center gap-2">
            <span className="text-amber-400 font-mono-numbers">11.</span>
            Prohibited Conduct &amp; Integrity Safeguards
          </h2>
          <p>Users are strictly prohibited from engaging in any of the following activities:</p>
          <ul className="list-disc pl-5 space-y-1.5 text-[#94A3B8]">
            <li>Deploying automated bots, scraping scripts, or unauthorized programmatic entry tools.</li>
            <li>Exploiting platform glitches, software vulnerabilities, or network latency differences.</li>
            <li>Colluding or attempting to manipulate or reverse-engineer cryptographic random outcomes.</li>
            <li>Conducting denial-of-service (DoS) attacks or interfering with system infrastructure.</li>
            <li>Engaging in money laundering, unauthorized payment usage, or fraudulent financial actions.</li>
          </ul>
        </section>

        {/* 12. Limitation of Liability */}
        <section className="space-y-3">
          <h2 className="font-display font-bold text-base sm:text-lg text-white flex items-center gap-2">
            <span className="text-amber-400 font-mono-numbers">12.</span>
            Limitation of Liability &amp; Disclaimers
          </h2>
          <p>
            To the maximum extent permitted by applicable law, EarnFlow.in and its operators, affiliates, agents, and licensors shall not be liable for any indirect, incidental, special, consequential, or punitive damages arising from your use of or inability to use the Platform.
          </p>
          <p>
            We are not liable for losses resulting from user-side internet connectivity disruptions, browser crashes, hardware failures, or blockchain network congestion. In no event shall our total aggregate liability for all claims related to the Services exceed the total amount paid by you in ticket entries during the thirty (30) days preceding the claim.
          </p>
        </section>

        {/* 13. Dispute Resolution & Contact Information */}
        <section className="space-y-3">
          <h2 className="font-display font-bold text-base sm:text-lg text-white flex items-center gap-2">
            <span className="text-amber-400 font-mono-numbers">13.</span>
            Dispute Resolution &amp; Contact Information
          </h2>
          <p>
            In the event of any controversy, claim, or dispute arising out of or relating to these Terms or your use of the Platform, the parties agree to first attempt informal resolution by submitting a detailed complaint to our Customer Support desk.
          </p>
          <div className="p-4 rounded-xl bg-[#090D16] border border-[#1F2737] flex items-center gap-3 mt-3">
            <Mail className="w-5 h-5 text-amber-400 shrink-0" />
            <div>
              <span className="text-[10px] text-[#94A3B8] uppercase font-bold block">Customer Support Desk</span>
              <a href={`mailto:${supportEmail}`} className="text-sm font-bold text-amber-400 hover:underline">
                {supportEmail}
              </a>
            </div>
          </div>
        </section>

      </article>

      {/* Footer Support Banner */}
      <div className="mt-8 p-5 rounded-2xl bg-[#0D121D] border border-amber-500/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h3 className="font-bold text-sm text-white">Have questions about these terms?</h3>
          <p className="text-xs text-[#94A3B8] mt-0.5">
            Our support team is available to assist you with any questions regarding lottery rules or policies.
          </p>
        </div>
        <a
          href={`mailto:${supportEmail}`}
          className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-extrabold text-xs transition-colors shrink-0 flex items-center gap-1.5"
        >
          <Mail className="w-3.5 h-3.5" />
          <span>Contact Support</span>
        </a>
      </div>

    </div>
  );
}
