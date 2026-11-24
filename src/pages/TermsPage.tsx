import React, { useState } from 'react';
import { 
  ArrowLeft, 
  ShieldCheck, 
  Clock, 
  HelpCircle, 
  FileText, 
  CheckCircle2, 
  AlertTriangle, 
  Coins, 
  Lock,
  ChevronDown,
  Search,
  ExternalLink,
  Mail,
  Ticket
} from 'lucide-react';
import { useLottery } from '../context/LotteryContext';

export interface TermsPageProps {
  onBackToHome?: () => void;
}

export default function TermsPage({ onBackToHome }: TermsPageProps) {
  const { platformSettings } = useLottery();
  const supportEmail = platformSettings?.supportEmail?.trim() || 'earnflow.user@gmail.com';
  const [searchTerm, setSearchTerm] = useState('');
  const [activeSection, setActiveSection] = useState<string | null>(null);

  // Unconditionally ensure Terms & Rules opens from the very top on all devices
  React.useEffect(() => {
    const mainEl = document.getElementById('main-content');
    if (mainEl) {
      mainEl.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    }
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, []);

  const sections = [
    {
      num: '01',
      title: 'Introduction & Agreement to Terms',
      content: (
        <div className="space-y-3">
          <p>
            Welcome to EarnFlow.in. These Terms and Conditions (&quot;Terms&quot;, &quot;Agreement&quot;) govern your access to and use of the EarnFlow website, applications, APIs, smart contract interfaces, and digital services (collectively, the &quot;Platform&quot; or &quot;Services&quot;).
          </p>
          <p>
            By accessing, creating an account, or participating in any Four-Digit Lottery draw on EarnFlow.in, you acknowledge that you have read, understood, and agreed to be legally bound by these Terms and our Privacy Policy. If you do not agree with any provision of these Terms, you must discontinue your use of the Platform immediately.
          </p>
        </div>
      )
    },
    {
      num: '02',
      title: 'Definitions & Interpretation',
      content: (
        <div className="space-y-3">
          <p>In these Terms, the following terms have specific meanings:</p>
          <ul className="list-disc pl-5 space-y-1.5">
            <li><strong className="text-white">&quot;Platform&quot;:</strong> EarnFlow.in and its web interfaces, client applications, and backend systems.</li>
            <li><strong className="text-white">&quot;User&quot;, &quot;Player&quot;, &quot;You&quot;:</strong> Any individual who accesses or registers on the Platform.</li>
            <li><strong className="text-white">&quot;Four-Digit Lottery&quot;:</strong> The online lucky draw game hosted on the Platform involving numbers 0000 through 9999.</li>
            <li><strong className="text-white">&quot;Ticket&quot;:</strong> A validly recorded entry holding a 4-digit sequence purchased with USDT.</li>
            <li><strong className="text-white">&quot;USDT&quot;:</strong> Tether USD tokens operating on the TRC-20 (Tron) blockchain network.</li>
            <li><strong className="text-white">&quot;Jackpot Pool&quot;:</strong> The total or allocated USDT prize amount awarded to exact matching winning tickets.</li>
            <li><strong className="text-white">&quot;Draw Oracle&quot;:</strong> The automated cryptographic random outcome generation system.</li>
          </ul>
        </div>
      )
    },
    {
      num: '03',
      title: 'Platform Description & Single-Game Focus',
      content: (
        <div className="space-y-3">
          <p>
            <strong className="text-white">EarnFlow.in operates exclusively as an online Four-Digit Lottery gaming platform.</strong>
          </p>
          <p>
            The Platform provides users with access to live Four-Digit Lottery events, number selection workstations, countdown timers, automated draw results, balance management, and USDT (TRC-20) payment processing. No other casino games, arcade games, or slot machines operate on EarnFlow.in.
          </p>
        </div>
      )
    },
    {
      num: '04',
      title: 'Eligibility Requirements (18+ Only)',
      content: (
        <div className="space-y-3">
          <p>
            Participation on EarnFlow.in is strictly limited to individuals who are at least eighteen (18) years of age, or the legal age of majority in their jurisdiction, whichever is higher.
          </p>
          <p>
            You are strictly responsible for verifying that your participation in online lucky draw games is lawful under the statutes, rules, and regulatory frameworks of your geographical location. The Platform reserves the right to request proof of age and identity at any time.
          </p>
        </div>
      )
    },
    {
      num: '05',
      title: 'Account Registration & Verification',
      content: (
        <div className="space-y-3">
          <p>
            Users may register through email verification, Web3 wallet connection, or authorized OAuth identity providers (such as Google). You agree to provide true, accurate, current, and complete information during registration.
          </p>
          <p>
            Each individual user is permitted to maintain only one (1) active account on EarnFlow.in. The creation of duplicate, automated, or puppet accounts to circumvent limits or manipulate draws is strictly prohibited and grounds for immediate termination.
          </p>
        </div>
      )
    },
    {
      num: '06',
      title: 'Account Security & Credential Protection',
      content: (
        <div className="space-y-3">
          <p>
            You are solely responsible for maintaining the confidentiality of your login credentials, passwords, recovery tokens, and linked private keys.
          </p>
          <p>
            All actions conducted through your authenticated account are deemed authorized by you. You agree to notify our Customer Support desk immediately upon becoming aware of any unauthorized access or breach of security.
          </p>
        </div>
      )
    },
    {
      num: '07',
      title: 'Four-Digit Lottery Overview & Game Math',
      content: (
        <div className="space-y-3">
          <p>
            In Four-Digit Lottery events, players choose a 4-digit sequence between <strong className="text-amber-300 font-mono">0000 and 9999</strong> (10,000 possible distinct permutations).
          </p>
          <p>
            The game operates with an industry-standard mathematical return-to-player (RTP) model of <strong className="text-white">95.0%</strong> with a transparent platform operating margin (house edge) of <strong className="text-white">5.0%</strong>. Every permutation has an equal, unbiased 1-in-10,000 probability of being selected.
          </p>
        </div>
      )
    },
    {
      num: '08',
      title: 'Lottery Participation Rules & Integrity',
      content: (
        <div className="space-y-3">
          <p>
            Players participate by selecting four digits and submitting their purchase before ticket sales close for that event.
          </p>
          <p>
            Tickets may be chosen manually via the four interactive numerical dial rollers or generated automatically through the randomized Quick Pick mechanism. Once submitted, ticket numbers are immutably tied to the event and cannot be swapped or transferred.
          </p>
        </div>
      )
    },
    {
      num: '09',
      title: 'Ticket Purchase Conditions (Single-Ticket Rule)',
      content: (
        <div className="space-y-3">
          <p>
            <strong className="text-white">Strict Single-Ticket Entry:</strong> Each ticket purchase action corresponds to exactly one (1) lottery ticket holding one 4-digit combination.
          </p>
          <p>
            The total cost for each entry action equals the exact unit price of that room (Total Cost = Unit Price). Bulk automated entry scripts, automated batch scalping, and multi-quantity multipliers are strictly disallowed to maintain a balanced, fair community playing field.
          </p>
        </div>
      )
    },
    {
      num: '10',
      title: 'Ticket Price & Currency (USDT TRC-20)',
      content: (
        <div className="space-y-3">
          <p>
            Ticket prices are denominated in USDT and clearly displayed on each live room card (e.g., 10 USDT per ticket).
          </p>
          <p>
            The ticket fee is debited immediately from the player&apos;s available USDT balance upon purchase confirmation. Entries cannot be placed on credit, deferred payment, or negative balance.
          </p>
        </div>
      )
    },
    {
      num: '11',
      title: 'Wallet Terms & Balance Validation',
      content: (
        <div className="space-y-3">
          <p>
            Your EarnFlow wallet balance reflects your confirmed USDT holdings on the Platform. Before any ticket is issued, our backend ledger validates that your balance equals or exceeds the ticket price.
          </p>
          <p>
            Wallet balances can be topped up via TRC-20 deposits. Withdrawals are processed back to your specified TRC-20 address within our standard 24-hour verification window.
          </p>
        </div>
      )
    },
    {
      num: '12',
      title: 'Ticket Confirmation & Ownership Records',
      content: (
        <div className="space-y-3">
          <p>
            A ticket is officially issued and valid only after our database records the transaction with a unique Ticket ID, timestamps, user ID, event ID, and the selected four digits.
          </p>
          <p>
            Players can verify all active and past ticket records at any time under the &quot;My Tickets&quot; section of the Platform.
          </p>
        </div>
      )
    },
    {
      num: '13',
      title: 'Event Duration & Countdown Timers',
      content: (
        <div className="space-y-3">
          <p>
            Each Four-Digit Lottery event has a pre-determined duration (e.g., 1 hour, 6 hours, 24 hours, or special event schedules).
          </p>
          <p>
            A live ticking countdown is displayed prominently across the workstation and room cards. When the countdown reaches zero, the event transitions from open sales to result determination.
          </p>
        </div>
      )
    },
    {
      num: '14',
      title: 'Ticket Sales Closing & Freeze Period',
      content: (
        <div className="space-y-3">
          <p>
            To prevent front-running, latency manipulation, or timing exploits, ticket sales close prior to draw execution.
          </p>
          <p>
            During this freeze window, no new tickets can be purchased or registered for that draw. Any purchase attempt received after sales close is automatically rejected and not debited.
          </p>
        </div>
      )
    },
    {
      num: '15',
      title: 'Result Publication & Winning Number Announcement',
      content: (
        <div className="space-y-3">
          <p>
            Following the sales freeze, the draw is executed using our automated cryptographic Oracle. The official winning four-digit sequence is published publicly to the Result Screen and Results History view.
          </p>
          <p>
            Published winning combinations are final, immutable, and permanently archived in public draw audit logs.
          </p>
        </div>
      )
    },
    {
      num: '16',
      title: 'Winning Conditions (Exact 4-Digit Match)',
      content: (
        <div className="space-y-3">
          <p>
            A ticket is classified as a winning ticket if and only if its 4-digit sequence matches the published winning 4-digit sequence in exact order (position 1, position 2, position 3, position 4).
          </p>
          <p>
            Partial matches, reverse permutations, or transposition of digits do not qualify for jackpot share unless explicitly defined under a secondary prize room rule.
          </p>
        </div>
      )
    },
    {
      num: '17',
      title: 'Prize Allocation & Idempotent Payouts',
      content: (
        <div className="space-y-3">
          <p>
            Jackpot prizes are allocated in USDT and calculated according to room configuration (fixed pool, progressive pool, or guaranteed minimum).
          </p>
          <p>
            Payout processing is atomic and idempotent: winning user wallets are credited automatically upon draw resolution. Payout records are permanently logged in the financial ledger and winner payouts table.
          </p>
        </div>
      )
    },
    {
      num: '18',
      title: 'Multiple Winners & Equal Sharing Rule',
      content: (
        <div className="space-y-3">
          <p>
            If two or more tickets hold the exact matching winning four-digit sequence in the same event, the total winning prize pool is divided equally among all eligible winning tickets.
          </p>
          <p>
            Each winning ticket receives an equal fractional share of the jackpot prize pool, credited directly to its owner&apos;s wallet.
          </p>
        </div>
      )
    },
    {
      num: '19',
      title: 'Refund & Cancellation Policy',
      content: (
        <div className="space-y-3">
          <p>
            Once purchased and confirmed in the database, lottery tickets are non-cancellable and non-refundable by the player.
          </p>
          <p>
            In the event that a scheduled draw is permanently canceled due to unforeseen technical disruption or administrative cancellation, 100% of the ticket purchase amount is refunded automatically to the originating user&apos;s wallet.
          </p>
        </div>
      )
    },
    {
      num: '20',
      title: 'Failed or Pending Transactions',
      content: (
        <div className="space-y-3">
          <p>
            If a wallet deduction occurs but network connectivity fails before ticket generation is acknowledged by the client, our backend transactional engine will reconcile the ledger: either issuing the confirmed ticket or restoring the deducted USDT balance.
          </p>
          <p>
            Users can contact Customer Support with their transaction timestamp and wallet address for immediate manual reconciliation if needed.
          </p>
        </div>
      )
    },
    {
      num: '21',
      title: 'Technical Issues & Service Interruptions',
      content: (
        <div className="space-y-3">
          <p>
            While EarnFlow strives for continuous 99.9% availability, the Platform is provided on an &quot;as is&quot; and &quot;as available&quot; basis.
          </p>
          <p>
            We are not liable for losses resulting from user-side internet connectivity disruptions, browser crashes, hardware failures, or blockchain network congestion. If an active draw countdown is interrupted server-side, the draw is safely held or rescheduled with full participant data preserved.
          </p>
        </div>
      )
    },
    {
      num: '22',
      title: 'Prohibited Activities & System Integrity',
      content: (
        <div className="space-y-3">
          <p>You agree not to engage in any of the following prohibited behaviors:</p>
          <ul className="list-disc pl-5 space-y-1.5">
            <li>Using automated bots, scraping tools, or unauthorized APIs to purchase tickets.</li>
            <li>Exploiting software vulnerabilities, race conditions, or timing delays.</li>
            <li>Colluding or attempting to reverse-engineer server-side random seeds.</li>
            <li>Attempting denial-of-service (DoS) attacks or interfering with system infrastructure.</li>
            <li>Using proceeds of unlawful activity or unauthorized payment accounts.</li>
          </ul>
        </div>
      )
    },
    {
      num: '23',
      title: 'Fraud Prevention & Anti-Money Laundering (AML)',
      content: (
        <div className="space-y-3">
          <p>
            EarnFlow maintains proactive fraud detection and anti-money laundering controls. We monitor transaction velocity, withdrawal destinations, and account clustering.
          </p>
          <p>
            Accounts flagged for suspicious patterns, tumbling, or fraudulent transactions may be subjected to compliance review and temporary withdrawal holds pending investigation.
          </p>
        </div>
      )
    },
    {
      num: '24',
      title: 'Account Suspension & Termination',
      content: (
        <div className="space-y-3">
          <p>
            We reserve the right to suspend, restrict, or terminate any account that violates these Terms, engages in fraudulent conduct, or poses a threat to Platform security.
          </p>
          <p>
            Upon legitimate termination for material breach, unearned bonus rewards are forfeited. Legitimate, verified user balances will be returned subject to compliance clearance.
          </p>
        </div>
      )
    },
    {
      num: '25',
      title: 'Responsible Gaming & Self-Exclusion',
      content: (
        <div className="space-y-3">
          <p>
            EarnFlow is committed to responsible gaming practices. Lottery participation must be viewed strictly as a form of entertainment and not as a method of generating income or financial return.
          </p>
          <p>
            Players who wish to set deposit limits, take a cooling-off break, or request permanent self-exclusion can do so via Profile settings or by contacting Customer Support.
          </p>
        </div>
      )
    },
    {
      num: '26',
      title: 'Third-Party Blockchain Networks & Providers',
      content: (
        <div className="space-y-3">
          <p>
            USDT transfers operate on decentralized blockchain infrastructure (TRC-20). We do not control blockchain network fees, block confirmation times, or node propagation delays.
          </p>
          <p>
            You are responsible for ensuring that withdrawal recipient addresses support TRC-20 USDT tokens. Transfers sent to incompatible networks or incorrect addresses cannot be recovered.
          </p>
        </div>
      )
    },
    {
      num: '27',
      title: 'Intellectual Property Rights',
      content: (
        <div className="space-y-3">
          <p>
            All copyrights, trademarks, brand names, visual interfaces, UI components, code, graphics, and documentation on EarnFlow.in are the exclusive property of EarnFlow or its licensors.
          </p>
          <p>
            Users are granted a limited, personal, non-exclusive, non-transferable license to access the Platform solely for lawful personal gaming entertainment.
          </p>
        </div>
      )
    },
    {
      num: '28',
      title: 'Limitation of Liability',
      content: (
        <div className="space-y-3">
          <p>
            To the maximum extent permitted by applicable law, EarnFlow and its operators, affiliates, agents, and licensors shall not be liable for any indirect, incidental, special, consequential, or punitive damages arising from your use of or inability to use the Platform.
          </p>
          <p>
            In no event shall our total aggregate liability for all claims related to the Services exceed the total amount paid by you in ticket entries during the thirty (30) days preceding the claim.
          </p>
        </div>
      )
    },
    {
      num: '29',
      title: 'Dispute Resolution & Binding Arbitration',
      content: (
        <div className="space-y-3">
          <p>
            In the event of any controversy, claim, or dispute arising out of or relating to these Terms or your use of the Platform, the parties agree to first attempt informal resolution by submitting a detailed complaint to our Customer Support desk.
          </p>
          <p>
            If the dispute cannot be resolved informally within thirty (30) days, it shall be resolved by binding arbitration in accordance with standard international commercial arbitration rules.
          </p>
        </div>
      )
    },
    {
      num: '30',
      title: 'Governing Law & Legal Jurisdiction',
      content: (
        <div className="space-y-3">
          <p>
            These Terms and any non-contractual obligations arising out of or in connection with them shall be governed by and construed in accordance with generally recognized commercial principles of private international law.
          </p>
          <p>
            Users access the Platform on their own initiative and are solely responsible for compliance with local legal requirements where applicable.
          </p>
        </div>
      )
    },
    {
      num: '31',
      title: 'Policy Updates & Amendments',
      content: (
        <div className="space-y-3">
          <p>
            We may update these Terms periodically to reflect changes in Platform features, security enhancements, regulatory guidelines, or operational requirements.
          </p>
          <p>
            When changes are made, the &quot;Last Updated&quot; date at the top of this document will be revised. Continued participation on the Platform after changes are posted constitutes acceptance of the amended Terms.
          </p>
        </div>
      )
    },
    {
      num: '32',
      title: 'Contact Information & Customer Support',
      content: (
        <div className="space-y-3">
          <p>
            For questions, legal notices, dispute inquiries, or assistance regarding these Terms and Conditions, please contact our Customer Support desk:
          </p>
          <div className="p-3.5 rounded-xl bg-[#0B0F19] border border-[#1F2737] flex items-center gap-3">
            <Mail className="w-5 h-5 text-amber-400 shrink-0" />
            <div>
              <span className="text-[10px] text-[#94A3B8] uppercase font-bold block">Support Desk</span>
              <a href={`mailto:${supportEmail}`} className="text-sm font-bold text-amber-400 hover:underline">
                {supportEmail}
              </a>
            </div>
          </div>
        </div>
      )
    }
  ];

  const filteredSections = sections.filter(sec => 
    sec.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    sec.num.includes(searchTerm)
  );

  return (
    <div className="max-w-5xl 2xl:max-w-6xl mx-auto px-2.5 xs:px-4 sm:px-6 lg:px-8 py-6 sm:py-10 animate-in fade-in duration-200 text-left">
      
      {/* Top Header */}
      <div className="space-y-3 pb-6 border-b border-[#1F2737]">
        {onBackToHome && (
          <button
            onClick={onBackToHome}
            className="inline-flex items-center gap-1.5 text-xs text-[#94A3B8] hover:text-white transition-colors cursor-pointer mb-2"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Home</span>
          </button>
        )}

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 font-mono-numbers text-[11px] font-bold mb-2">
              <FileText className="w-3.5 h-3.5 text-amber-400" />
              <span>Official Platform Documentation</span>
            </div>
            <h1 className="font-display font-black text-2xl sm:text-3xl text-white">
              Terms &amp; Conditions
            </h1>
            <p className="text-xs sm:text-sm text-[#94A3B8] mt-1">
              Official operating terms, rules, and conditions for the EarnFlow Four-Digit Lottery platform.
            </p>
          </div>

          <div className="text-xs font-mono-numbers text-[#94A3B8] self-start sm:self-auto bg-[#111827] px-3 py-1.5 rounded-lg border border-[#1F2737]">
            Last Updated: November 2026
          </div>
        </div>

        {/* Search Filter */}
        <div className="relative pt-2 max-w-md">
          <Search className="w-4 h-4 text-[#94A3B8] absolute left-3 top-5 pointer-events-none" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search within Terms (e.g., ticket, refund, payout, rules)..."
            className="w-full bg-[#111827] border border-[#1F2737] focus:border-amber-500/50 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-[#64748B] outline-none"
          />
        </div>
      </div>

      {/* Sections Accordion List */}
      <div className="space-y-3 pt-6">
        {filteredSections.map((sec) => {
          const isOpen = activeSection === sec.num || searchTerm.length > 0;
          return (
            <div
              key={sec.num}
              className="bg-[#111827] border border-[#1F2737] rounded-xl overflow-hidden transition-all"
            >
              <button
                type="button"
                onClick={() => setActiveSection(activeSection === sec.num ? null : sec.num)}
                className="w-full p-4 sm:p-5 text-left flex items-center justify-between gap-3 text-xs sm:text-sm font-bold text-white hover:text-amber-400 transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="font-mono-numbers text-xs text-amber-400/80 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20 shrink-0">
                    {sec.num}
                  </span>
                  <span className="truncate">{sec.title}</span>
                </div>
                <ChevronDown className={`w-4 h-4 text-[#94A3B8] shrink-0 transition-transform ${isOpen ? 'rotate-180 text-amber-400' : ''}`} />
              </button>

              {isOpen && (
                <div className="px-4 sm:px-6 pb-5 text-xs text-[#94A3B8] leading-relaxed border-t border-[#1F2737]/60 pt-4">
                  {sec.content}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer Support Banner */}
      <div className="mt-8 p-5 rounded-2xl bg-[#111827] border border-amber-500/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h3 className="font-bold text-sm text-white">Have questions about these terms?</h3>
          <p className="text-xs text-[#94A3B8] mt-0.5">
            Our support team is available to help clarify any aspect of our lottery rules or policies.
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
