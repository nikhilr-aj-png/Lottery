import React, { useState } from 'react';
import { 
  ArrowLeft, 
  ShieldCheck, 
  Lock, 
  FileText, 
  Search, 
  ChevronDown, 
  Mail,
  CheckCircle2
} from 'lucide-react';
import { useLottery } from '../context/LotteryContext';

export interface PrivacyPolicyPageProps {
  onBackToHome?: () => void;
}

export default function PrivacyPolicyPage({ onBackToHome }: PrivacyPolicyPageProps) {
  const { platformSettings } = useLottery();
  const supportEmail = platformSettings?.supportEmail?.trim() || 'earnflow.user@gmail.com';
  const [searchTerm, setSearchTerm] = useState('');
  const [activeSection, setActiveSection] = useState<string | null>(null);

  const sections = [
    {
      num: '01',
      title: 'Introduction',
      content: (
        <p>
          EarnFlow.in (&quot;we&quot;, &quot;us&quot;, &quot;our&quot;, or the &quot;Platform&quot;) respects your privacy and is committed to protecting your personal data. This Privacy Policy explains how we collect, use, process, and safeguard your information when you visit or participate in Four-Digit Lottery draws on EarnFlow.in.
        </p>
      )
    },
    {
      num: '02',
      title: 'Information We Collect',
      content: (
        <p>
          We collect only the minimum information necessary to provide, secure, and maintain the Four-Digit Lottery services. This includes information provided directly by you during account registration and technical information generated automatically through your interaction with the Platform.
        </p>
      )
    },
    {
      num: '03',
      title: 'Account Information',
      content: (
        <p>
          When you create an account, we collect your selected username, email address, and authentication identifiers (such as Google OAuth user ID or Web3 public wallet address). We never request or store your private cryptographic keys.
        </p>
      )
    },
    {
      num: '04',
      title: 'Contact Information',
      content: (
        <p>
          If you contact our Customer Support desk or submit support inquiries, we collect your name, email address, message contents, and relevant ticket identifiers to investigate and respond to your inquiry.
        </p>
      )
    },
    {
      num: '05',
      title: 'Transaction Information',
      content: (
        <p>
          We record lottery ticket purchases, drawn numbers, winning results, and prize payouts associated with your account in our immutable financial ledger to guarantee auditability and transparent contest resolution.
        </p>
      )
    },
    {
      num: '06',
      title: 'Wallet and Payment Information',
      content: (
        <p>
          We record public USDT (TRC-20) deposit transaction hashes, recipient wallet addresses, withdrawal destinations, and confirmed amounts. We do not process or store credit card details or bank account credentials.
        </p>
      )
    },
    {
      num: '07',
      title: 'Device and Browser Information',
      content: (
        <p>
          When accessing the Platform, we may collect device type, operating system version, browser family, viewport dimensions, and preferred language to render our responsive lottery interface effectively.
        </p>
      )
    },
    {
      num: '08',
      title: 'IP Address and Log Data',
      content: (
        <p>
          Our web servers log IP addresses, connection timestamps, referring URLs, and request error codes to detect denial-of-service attempts, prevent automated bot attacks, and protect system integrity.
        </p>
      )
    },
    {
      num: '09',
      title: 'Cookies and Similar Technologies',
      content: (
        <p>
          We use strictly necessary session cookies and browser LocalStorage to store authentication tokens, UI sound preferences, and sidebar state. We do not use third-party behavioral advertising tracking cookies.
        </p>
      )
    },
    {
      num: '10',
      title: 'How We Use Information',
      content: (
        <ul className="list-disc pl-5 space-y-1.5">
          <li>To register, authenticate, and administer your player account.</li>
          <li>To process single-ticket Four-Digit Lottery entries and calculate prize pool allocations.</li>
          <li>To credit winning payouts and process USDT withdrawals.</li>
          <li>To monitor for multi-accounting, bots, and fraudulent activity.</li>
          <li>To provide customer support and service notifications.</li>
        </ul>
      )
    },
    {
      num: '11',
      title: 'Account and Transaction Security',
      content: (
        <p>
          All data transmitted between your browser and our servers is encrypted using industry-standard Transport Layer Security (TLS 1.3 / HTTPS). Database access is restricted behind Row-Level Security (RLS) policies.
        </p>
      )
    },
    {
      num: '12',
      title: 'Payment Processing Providers',
      content: (
        <p>
          Deposits and withdrawals are processed via decentralized TRC-20 blockchain smart contracts and wallet nodes. Public blockchain transactions are recorded permanently on the Tron public ledger.
        </p>
      )
    },
    {
      num: '13',
      title: 'Data Sharing',
      content: (
        <p>
          We do not sell, rent, or trade your personal information to marketing agencies or third parties. Information is shared only with verified technical infrastructure providers (such as hosting and database services) necessary to operate the Platform.
        </p>
      )
    },
    {
      num: '14',
      title: 'Third-Party Services',
      content: (
        <p>
          The Platform integrates authentication services (Google OAuth) and cloud database infrastructure (Supabase). These third-party services maintain their own independent privacy governance policies.
        </p>
      )
    },
    {
      num: '15',
      title: 'Data Retention',
      content: (
        <p>
          We retain account information for as long as your account remains active. Financial ledger records and lottery draw audit histories are retained permanently for legal, financial, and regulatory verification.
        </p>
      )
    },
    {
      num: '16',
      title: 'Data Protection & Access Control',
      content: (
        <p>
          Administrative access to platform databases is restricted by role-based access control, cryptographic tokens, and multi-factor authentication. Only authorized administrative accounts can inspect user tickets.
        </p>
      )
    },
    {
      num: '17',
      title: 'User Rights',
      content: (
        <p>
          Subject to applicable data protection laws, you have the right to inspect the personal data we hold about you, request corrections to inaccurate records, and request an export of your ticket history.
        </p>
      )
    },
    {
      num: '18',
      title: 'Account Deletion Requests',
      content: (
        <p>
          You may request account closure and deletion of your profile data by submitting an email to our Support Desk. Historical financial ledger entries may be retained in anonymized format to satisfy legal accounting requirements.
        </p>
      )
    },
    {
      num: '19',
      title: 'Children\'s Privacy (18+ Only)',
      content: (
        <p>
          EarnFlow.in is strictly intended for individuals aged eighteen (18) and older. We do not knowingly collect personal information from minors. Any account identified as belonging to a minor will be terminated immediately.
        </p>
      )
    },
    {
      num: '20',
      title: 'International Data Transfers',
      content: (
        <p>
          Our cloud servers and infrastructure are located in secure data centers worldwide. By using the Platform, you consent to the processing of your information across international technical infrastructure.
        </p>
      )
    },
    {
      num: '21',
      title: 'Changes to This Privacy Policy',
      content: (
        <p>
          We may update this Privacy Policy periodically. Significant changes will be announced on the Platform with an updated effective date. Continued participation represents acceptance of the updated policy.
        </p>
      )
    },
    {
      num: '22',
      title: 'Contact Information',
      content: (
        <div>
          <p className="mb-2">
            For questions, requests, or concerns regarding your privacy or this policy, please contact our Data Governance desk:
          </p>
          <div className="p-3.5 rounded-xl bg-[#0B0F19] border border-[#1F2737] flex items-center gap-3">
            <Mail className="w-5 h-5 text-amber-400 shrink-0" />
            <div>
              <span className="text-[10px] text-[#94A3B8] uppercase font-bold block">Support Email</span>
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
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-mono-numbers text-[11px] font-bold mb-2">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>Official Privacy Governance</span>
            </div>
            <h1 className="font-display font-black text-2xl sm:text-3xl text-white">
              Privacy Policy
            </h1>
            <p className="text-xs sm:text-sm text-[#94A3B8] mt-1">
              Data governance, protection protocols, and privacy standards of EarnFlow.in.
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
            placeholder="Search within Privacy Policy..."
            className="w-full bg-[#111827] border border-[#1F2737] focus:border-amber-500/50 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-[#64748B] outline-none"
          />
        </div>
      </div>

      {/* Sections List */}
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
                  <span className="font-mono-numbers text-xs text-emerald-400/80 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 shrink-0">
                    {sec.num}
                  </span>
                  <span className="truncate">{sec.title}</span>
                </div>
                <ChevronDown className={`w-4 h-4 text-[#94A3B8] shrink-0 transition-transform ${isOpen ? 'rotate-180 text-emerald-400' : ''}`} />
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

    </div>
  );
}
