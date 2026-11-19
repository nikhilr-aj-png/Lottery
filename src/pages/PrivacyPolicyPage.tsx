import React from 'react';
import { ArrowLeft, ShieldCheck, Lock } from 'lucide-react';
import { useLottery } from '../context/LotteryContext';

export interface PrivacyPolicyPageProps {
  onBackToHome?: () => void;
}

export default function PrivacyPolicyPage({ onBackToHome }: PrivacyPolicyPageProps) {
  const { platformSettings } = useLottery();
  const supportEmail = platformSettings?.supportEmail ? platformSettings.supportEmail.trim() : '';

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
            <Lock className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[11px] font-mono-numbers text-amber-400 uppercase font-bold tracking-wider block">
              Official Privacy Practices &amp; Data Governance
            </span>
            <h1 className="font-display font-black text-2xl sm:text-3xl lg:text-4xl text-white">
              Privacy Policy
            </h1>
          </div>
        </div>
        <p className="text-xs sm:text-sm text-[#94a3b8] leading-relaxed max-w-3xl">
          Effective Date: November 19, 2026 · Official Data Protection Statement of <strong className="text-white">EarnFlow.in</strong>
        </p>
      </div>

      {/* Structured Policy Sections */}
      <div className="space-y-6 text-xs sm:text-sm text-[#cbd5e1] leading-relaxed">

        {/* Section 1: Platform Overview & Purpose */}
        <div className="glass-panel p-6 sm:p-7 rounded-2xl border border-[#1f2737] space-y-3">
          <div className="flex items-center gap-2.5 text-white font-bold font-display text-base sm:text-lg">
            <span className="w-7 h-7 rounded-lg bg-amber-500/15 text-amber-400 flex items-center justify-center text-xs font-mono-numbers">01</span>
            <span>Platform Overview &amp; Commitment to Privacy</span>
          </div>
          <p>
            Welcome to <strong className="text-white">EarnFlow.in</strong> (<a href="https://earnflow.in" className="text-amber-400 hover:underline">https://earnflow.in</a>), an online gaming platform providing users with access to interactive games, gaming events, account management, and USDT-based payment features.
          </p>
          <p>
            At EarnFlow.in, we respect your privacy and are committed to protecting the personal information you share with us. This Privacy Policy details our transparent policies regarding the collection, usage, storage, protection, and disclosure of information when you interact with our website, gaming applications, and related services.
          </p>
          <p className="text-[#94a3b8]">
            By creating an account, authenticating via Google Sign-In, or participating in games on EarnFlow.in, you acknowledge that you have read and understood the practices described in this Privacy Policy.
          </p>
        </div>

        {/* Section 2: Personal Information Collected */}
        <div className="glass-panel p-6 sm:p-7 rounded-2xl border border-[#1f2737] space-y-3.5">
          <div className="flex items-center gap-2.5 text-white font-bold font-display text-base sm:text-lg">
            <span className="w-7 h-7 rounded-lg bg-amber-500/15 text-amber-400 flex items-center justify-center text-xs font-mono-numbers">02</span>
            <span>Information We Collect</span>
          </div>
          <p>
            We collect only the information necessary to provide you with secure access, transparent gaming events, account management, and reliable USDT transactions:
          </p>
          <ul className="list-disc pl-5 space-y-2 text-[#94a3b8]">
            <li>
              <strong className="text-white">Account Registration &amp; Profile Information:</strong> When you register an account, we collect your email address, chosen player handle/username, and optional avatar image.
            </li>
            <li>
              <strong className="text-white">Google OAuth Authentication Data:</strong> When choosing Google Sign-In, we receive verified authentication credentials from Google Identity Services as detailed in Section 3.
            </li>
            <li>
              <strong className="text-white">Public TRC-20 Wallet Address:</strong> Your public TRON blockchain address (starting with &quot;T&quot;), which you connect to deposit USDT, purchase event tickets, or receive prize disbursals. <span className="text-amber-300">We never request, store, or have access to your private keys or recovery seed phrases.</span>
            </li>
            <li>
              <strong className="text-white">Gaming Activity &amp; Provably Fair Records:</strong> Game round participation records, lottery ticket numbers, bet amounts, multiplier selections, client and server cryptographic seeds, and prize payouts.
            </li>
            <li>
              <strong className="text-white">Financial &amp; Ledger Transactions:</strong> Internal wallet transaction ledger records, deposit invoice identifiers, blockchain transaction hashes (TxHash), and payout timestamps.
            </li>
            <li>
              <strong className="text-white">Technical &amp; Diagnostic Metadata:</strong> IP address, device type, browser user-agent, operating system version, and session timestamps, collected automatically to safeguard against fraud, multi-accounting, and malicious denial-of-service attempts.
            </li>
          </ul>
        </div>

        {/* Section 3: Google Sign-In and OAuth Usage */}
        <div className="glass-panel p-6 sm:p-7 rounded-2xl border border-[#1f2737] space-y-3.5 bg-gradient-to-br from-[#10131a] via-[#0b0e14] to-[#1a1230]">
          <div className="flex items-center gap-2.5 text-white font-bold font-display text-base sm:text-lg">
            <span className="w-7 h-7 rounded-lg bg-amber-500/15 text-amber-400 flex items-center justify-center text-xs font-mono-numbers">03</span>
            <span>Google Sign-In &amp; OAuth 2.0 Integration</span>
          </div>
          <p>
            EarnFlow.in offers Google Sign-In to allow users to authenticate easily and securely without creating and maintaining a separate password on our servers.
          </p>
          <div className="bg-[#0b0e14] p-4 rounded-xl border border-[#272a31] space-y-2">
            <h4 className="text-white font-bold text-xs uppercase tracking-wider text-amber-400">
              Information Obtained Through Google Authentication:
            </h4>
            <p className="text-xs text-[#94a3b8]">
              When you click &quot;Sign in with Google&quot;, Google presents an authorization consent screen requesting permission for basic identity scopes (<code className="text-amber-300">openid</code>, <code className="text-amber-300">email</code>, <code className="text-amber-300">profile</code>). We strictly receive:
            </p>
            <ul className="list-disc pl-5 space-y-1 text-xs text-[#94a3b8]">
              <li><strong className="text-white">Google Profile ID:</strong> A unique numeric identifier assigned by Google to identify your account.</li>
              <li><strong className="text-white">Primary Email Address:</strong> Used to create your EarnFlow.in player account, link your gaming wallet, and transmit critical security notifications.</li>
              <li><strong className="text-white">Verified Email Status:</strong> Confirmation from Google that your email address is verified.</li>
              <li><strong className="text-white">Display Name &amp; Avatar:</strong> Your Google public profile name and avatar URL, used to populate your initial player profile.</li>
            </ul>
          </div>
          <p>
            <strong className="text-white">Limited Access Guarantee:</strong> We do <span className="text-red-400 font-bold">NOT</span> request, access, read, or store any sensitive Google account data, including your Google Drive files, Gmail messages, contact lists, browsing history, calendar entries, or Google password.
          </p>
          <p className="text-[#94a3b8]">
            Our use and transfer of information received from Google APIs adheres strictly to the <a href="https://developers.google.com/terms/api-services-user-data-policy" target="_blank" rel="noopener noreferrer" className="text-amber-400 hover:underline">Google API Services User Data Policy</a>, including the Limited Use requirements.
          </p>
        </div>

        {/* Section 4: How We Use Personal Information */}
        <div className="glass-panel p-6 sm:p-7 rounded-2xl border border-[#1f2737] space-y-3">
          <div className="flex items-center gap-2.5 text-white font-bold font-display text-base sm:text-lg">
            <span className="w-7 h-7 rounded-lg bg-amber-500/15 text-amber-400 flex items-center justify-center text-xs font-mono-numbers">04</span>
            <span>How We Use Your Information</span>
          </div>
          <p>
            We process the personal information we collect solely for the following explicit and lawful business purposes:
          </p>
          <ul className="list-disc pl-5 space-y-1.5 text-[#94a3b8]">
            <li><strong className="text-white">Account Management:</strong> Authenticating your identity, managing player credentials, and maintaining your session state.</li>
            <li><strong className="text-white">Gaming Operations:</strong> Providing access to games (Four-Digit Lottery, Crash, Dice, Coinflip, Bingo – Color Trading, and Horse Racing), issuing lottery tickets, and calculating multipliers.</li>
            <li><strong className="text-white">USDT Financial Processing:</strong> Crediting USDT deposits to your balance, deducting entry stakes, processing winnings, and disbursing withdrawals to your TRC-20 destination address.</li>
            <li><strong className="text-white">Provably Fair Verification:</strong> Recording SHA-256 seed commits and outcome hashes so that any player can independently verify that rounds were not manipulated.</li>
            <li><strong className="text-white">Security &amp; Fraud Prevention:</strong> Detecting and mitigating malicious activity, bot abuse, unauthorized multi-accounting, and platform vulnerabilities.</li>
            <li><strong className="text-white">Customer Support:</strong> Responding to inquiries, diagnosing technical issues, and resolving payout or ticket questions submitted to <code className="text-amber-400">{supportEmail}</code>.</li>
            <li><strong className="text-white">Legal &amp; Compliance Obligations:</strong> Enforcing our Terms &amp; Conditions and complying with applicable statutory, tax, or regulatory requirements.</li>
          </ul>
        </div>

        {/* Section 5: Third-Party Service Providers */}
        <div className="glass-panel p-6 sm:p-7 rounded-2xl border border-[#1f2737] space-y-3.5">
          <div className="flex items-center gap-2.5 text-white font-bold font-display text-base sm:text-lg">
            <span className="w-7 h-7 rounded-lg bg-amber-500/15 text-amber-400 flex items-center justify-center text-xs font-mono-numbers">05</span>
            <span>Third-Party Service Providers &amp; Data Sharing</span>
          </div>
          <p>
            <strong className="text-white">We do not sell, rent, lease, or monetize your personal information to advertisers or data brokers under any circumstances.</strong>
          </p>
          <p>
            To deliver enterprise-grade availability and security, we integrate with select trusted third-party technical infrastructure providers who process data strictly under confidentiality agreements:
          </p>
          <ul className="list-disc pl-5 space-y-2 text-[#94a3b8]">
            <li>
              <strong className="text-white">Google LLC (Google Identity Services):</strong> Used for OAuth 2.0 single sign-on authentication and identity verification.
            </li>
            <li>
              <strong className="text-white">Supabase Inc. (Database &amp; Backend Infrastructure):</strong> Cloud-hosted PostgreSQL database providing encrypted data storage, user authentication services, and Row-Level Security (RLS) enforcement.
            </li>
            <li>
              <strong className="text-white">NOWPayments &amp; TRON Blockchain Network:</strong> Non-custodial crypto payment gateway for generating USDT TRC-20 deposit invoices. Transactions broadcast to the TRON blockchain are permanently recorded on public distributed ledgers and visible on public blockchain explorers (e.g. Tronscan).
            </li>
            <li>
              <strong className="text-white">Legal Authorities:</strong> We may disclose information if required to do so by a valid, legally binding court order, subpoena, or government regulation, or when necessary to protect the life, safety, or legal rights of our users or the platform.
            </li>
          </ul>
        </div>

        {/* Section 6: Data Storage, Protection and Security */}
        <div className="glass-panel p-6 sm:p-7 rounded-2xl border border-[#1f2737] space-y-3">
          <div className="flex items-center gap-2.5 text-white font-bold font-display text-base sm:text-lg">
            <span className="w-7 h-7 rounded-lg bg-amber-500/15 text-amber-400 flex items-center justify-center text-xs font-mono-numbers">06</span>
            <span>Data Storage, Protection &amp; Security Practices</span>
          </div>
          <p>
            We implement comprehensive technical, administrative, and physical security measures designed to protect your personal data from unauthorized access, alteration, disclosure, or destruction:
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            <div className="bg-[#10131a] p-3.5 rounded-xl border border-[#1f2737]">
              <div className="text-amber-400 font-bold text-xs mb-1 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4" />
                <span>Encryption in Transit &amp; at Rest</span>
              </div>
              <p className="text-[11px] text-[#94a3b8]">
                All data transmitted between your browser and our servers is encrypted using modern Transport Layer Security (TLS 1.3). Database volumes and backups are encrypted at rest using industry-standard AES-256 encryption.
              </p>
            </div>
            <div className="bg-[#10131a] p-3.5 rounded-xl border border-[#1f2737]">
              <div className="text-emerald-400 font-bold text-xs mb-1 flex items-center gap-1.5">
                <Lock className="w-4 h-4" />
                <span>Row-Level Security (RLS)</span>
              </div>
              <p className="text-[11px] text-[#94a3b8]">
                Our database architecture enforces database-level Row-Level Security policies. Users can only query and modify their own wallet balances, tickets, and profile records.
              </p>
            </div>
          </div>
          <p className="text-[11px] text-[#94a3b8] pt-1">
            While we implement state-of-the-art security practices, no method of transmission over the Internet or electronic storage is 100% immune from risk. We maintain continuous monitoring to detect and remediate potential security threats promptly.
          </p>
        </div>

        {/* Section 7: Cookies and Local Storage */}
        <div className="glass-panel p-6 sm:p-7 rounded-2xl border border-[#1f2737] space-y-3">
          <div className="flex items-center gap-2.5 text-white font-bold font-display text-base sm:text-lg">
            <span className="w-7 h-7 rounded-lg bg-amber-500/15 text-amber-400 flex items-center justify-center text-xs font-mono-numbers">07</span>
            <span>Cookies and Local Storage Technologies</span>
          </div>
          <p>
            EarnFlow.in uses browser <strong className="text-white">LocalStorage</strong> and <strong className="text-white">SessionStorage</strong> strictly for functional and operational necessities:
          </p>
          <ul className="list-disc pl-5 space-y-1 text-[#94a3b8]">
            <li><strong className="text-white">Authentication Session Tokens:</strong> Securely persisting your login token (JSON Web Token) so you remain authenticated across page reloads.</li>
            <li><strong className="text-white">Interface Preferences:</strong> Storing sound effect volume, audio mute states, and collapsed sidebar preferences.</li>
          </ul>
          <p>
            <strong className="text-white">No Tracking Cookies:</strong> We do not deploy third-party advertising cookies, behavioural retargeting trackers, or cross-site tracking beacons.
          </p>
        </div>

        {/* Section 8: User Data Rights and Choices */}
        <div className="glass-panel p-6 sm:p-7 rounded-2xl border border-[#1f2737] space-y-3.5">
          <div className="flex items-center gap-2.5 text-white font-bold font-display text-base sm:text-lg">
            <span className="w-7 h-7 rounded-lg bg-amber-500/15 text-amber-400 flex items-center justify-center text-xs font-mono-numbers">08</span>
            <span>Your Data Rights: Access, Correction &amp; Deletion</span>
          </div>
          <p>
            Depending on your jurisdiction, you have specific legal rights regarding your personal information, which EarnFlow.in fully respects:
          </p>
          <ul className="list-disc pl-5 space-y-2 text-[#94a3b8]">
            <li>
              <strong className="text-white">Right of Access:</strong> You have the right to request a complete copy of the personal information we hold about you, including profile details and transaction ledger history.
            </li>
            <li>
              <strong className="text-white">Right to Rectification:</strong> You can update your player username and connected TRC-20 wallet address at any time through your Profile settings.
            </li>
            <li>
              <strong className="text-white">Right to Erasure (Account Deletion):</strong> You may request the permanent deletion of your account and personal data by emailing us at <a href={`mailto:${supportEmail}`} className="text-amber-400 hover:underline">{supportEmail}</a> with the subject &quot;Account Deletion Request&quot;. Upon verification of identity, we will delete your account and personal identifiers within 30 days, retaining only anonymized blockchain records and audit logs required by law.
            </li>
            <li>
              <strong className="text-white">Right to Revoke Google Access:</strong> You can revoke EarnFlow.in&apos;s access to your Google account at any time via your <a href="https://myaccount.google.com/permissions" target="_blank" rel="noopener noreferrer" className="text-amber-400 hover:underline">Google Account Permissions Manager</a>.
            </li>
          </ul>
        </div>

        {/* Section 9: Data Retention */}
        <div className="glass-panel p-6 sm:p-7 rounded-2xl border border-[#1f2737] space-y-3">
          <div className="flex items-center gap-2.5 text-white font-bold font-display text-base sm:text-lg">
            <span className="w-7 h-7 rounded-lg bg-amber-500/15 text-amber-400 flex items-center justify-center text-xs font-mono-numbers">09</span>
            <span>Data Retention Policy</span>
          </div>
          <p>
            We retain personal information for as long as your account remains active and as needed to provide you with gaming services. We retain and use financial ledger records and dispute histories as required by law, to resolve disputes, and to enforce our legal agreements.
          </p>
          <p className="text-[#94a3b8]">
            When an account is deleted or personal data is no longer necessary, it is permanently purged or irrecoverably anonymized in accordance with our scheduled data retention workflows.
          </p>
        </div>

        {/* Section 10: Age Restrictions / Minors */}
        <div className="glass-panel p-6 sm:p-7 rounded-2xl border border-[#1f2737] space-y-3">
          <div className="flex items-center gap-2.5 text-white font-bold font-display text-base sm:text-lg">
            <span className="w-7 h-7 rounded-lg bg-amber-500/15 text-amber-400 flex items-center justify-center text-xs font-mono-numbers">10</span>
            <span>Age Restrictions &amp; Protection of Minors</span>
          </div>
          <p>
            EarnFlow.in is strictly intended for individuals who are at least <strong className="text-white">18 years of age</strong> (or the legal age of majority in their jurisdiction). We do not knowingly solicit, collect, or process personal information from children or minors. If we discover that an individual under the legal age has provided personal information, we will immediately terminate the account and delete all associated personal data.
          </p>
        </div>

        {/* Section 11: Contact Information & Grievance Officer */}
        <div className="glass-panel p-6 sm:p-7 rounded-2xl border border-[#1f2737] space-y-3.5 bg-gradient-to-br from-[#10131a] via-[#0b0e14] to-[#151a24]">
          <div className="flex items-center gap-2.5 text-white font-bold font-display text-base sm:text-lg">
            <span className="w-7 h-7 rounded-lg bg-amber-500/15 text-amber-400 flex items-center justify-center text-xs font-mono-numbers">11</span>
            <span>Contact Information &amp; Privacy Officer</span>
          </div>
          <p>
            If you have questions, comments, or requests regarding this Privacy Policy or our data protection practices, please contact our designated Privacy Support Team:
          </p>
          <div className="bg-[#0b0e14] p-4 rounded-xl border border-[#272a31] space-y-1.5 font-mono text-xs">
            <p><strong className="text-white">Platform:</strong> EarnFlow.in</p>
            <p><strong className="text-white">Official URL:</strong> <a href="https://earnflow.in" className="text-amber-400 hover:underline">https://earnflow.in</a></p>
            <p><strong className="text-white">Privacy Inquiries &amp; Account Deletion:</strong> <a href={`mailto:${supportEmail}`} className="text-amber-400 hover:underline">{supportEmail}</a></p>
            <p><strong className="text-white">Legal &amp; Compliance:</strong> <a href={`mailto:${supportEmail}`} className="text-amber-400 hover:underline">{supportEmail}</a></p>
          </div>
          <p className="text-[11px] text-[#94a3b8]">
            We aim to acknowledge and resolve all privacy-related requests within 48 to 72 business hours.
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
