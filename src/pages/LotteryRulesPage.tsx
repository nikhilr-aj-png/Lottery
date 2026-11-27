import React from 'react';
import { 
  ShieldCheck, 
  Lock, 
  Trophy, 
  Award, 
  AlertTriangle, 
  CheckCircle2, 
  FileText,
  DollarSign,
  Scale,
  Database,
  Clock,
  Mail
} from 'lucide-react';
import { useLottery } from '../context/LotteryContext';

interface LotteryRulesPageProps {
  onBackToHome?: () => void;
  onNavigateToTab?: (tabId: string) => void;
}

export default function LotteryRulesPage({ onBackToHome, onNavigateToTab }: LotteryRulesPageProps) {
  const { setActiveTab } = useLottery();

  React.useEffect(() => {
    const mainEl = document.getElementById('main-content');
    if (mainEl) {
      mainEl.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    }
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, []);

  const handleContactSupport = () => {
    if (onNavigateToTab) {
      onNavigateToTab('contact');
    } else {
      setActiveTab('contact');
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto px-3 xs:px-4 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-8 space-y-4 sm:space-y-6 lg:space-y-8 animate-in fade-in duration-200 text-left">
      {/* Header Banner */}
      <div className="rounded-2xl bg-gradient-to-r from-[#111827] via-[#161F33] to-[#111827] border border-amber-500/30 p-4 xs:p-5 sm:p-7 lg:p-8 space-y-2.5 sm:space-y-3 shadow-xl">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-400 text-[11px] sm:text-xs font-bold">
          <Scale className="w-3.5 h-3.5" />
          <span>Provably Fair Gaming Standards</span>
        </div>
        <h1 className="font-display font-black text-xl xs:text-2xl sm:text-3xl lg:text-4xl text-white tracking-tight leading-tight">
          Lottery Rules &amp; Prize Distribution
        </h1>
        <p className="text-xs sm:text-sm text-[#CBD5E1] leading-relaxed max-w-2xl">
          Authoritative operational specifications for EarnFlow.in Four Digit Lottery events, digit purchase exclusivity, winner determination models, and database-level security constraints.
        </p>
      </div>

      {/* RULE 1: DIGIT PURCHASE EXCLUSIVITY */}
      <div className="bg-[#111827] border border-amber-500/40 rounded-2xl p-4 xs:p-5 sm:p-7 space-y-3 sm:space-y-4 shadow-lg relative overflow-hidden">
        <div className="flex items-center gap-3 pb-3 border-b border-[#1F2737]">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0 border border-amber-500/40">
            <Lock className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
          <div>
            <h2 className="font-display font-black text-sm xs:text-base sm:text-lg text-white">
              1. 4-Digit Combination Uniqueness Rule
            </h2>
            <p className="text-[11px] sm:text-xs text-amber-400 font-mono-numbers">
              Single-Owner Exclusivity per Draw Event
            </p>
          </div>
        </div>

        <div className="space-y-2.5 sm:space-y-3 text-xs sm:text-sm text-[#CBD5E1] leading-relaxed">
          <p>
            On EarnFlow.in, <strong>a particular four-digit combination (e.g. <code>7429</code>) can only be purchased once per lottery event</strong>.
          </p>
          <ul className="space-y-2 list-none pt-1">
            <li className="flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <span><strong>Instant Availability Lock:</strong> Once a combination has been purchased by any player, it immediately becomes unavailable for purchase by anyone else in that event.</span>
            </li>
            <li className="flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <span><strong>Zero Duplicate Ownership:</strong> The same 4-digit code will never be sold repeatedly or shared among multiple players in the same draw.</span>
            </li>
            <li className="flex items-start gap-2.5">
              <Database className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
              <span><strong>Database-Level Atomic Enforcement:</strong> This policy is strictly enforced on the PostgreSQL database level via unique constraints (<code>idx_lottery_tickets_event_ticket_unique</code>) and transactional row-locks. Even simultaneous requests competing for the exact same millisecond will result in one success and atomic rejection of duplicate orders.</span>
            </li>
            <li className="flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <span><strong>Cross-Event Availability:</strong> A 4-digit number that was purchased in Event A remains completely free and available to be purchased in Event B once Event B begins.</span>
            </li>
          </ul>
        </div>
      </div>

      {/* RULE 2 & 3: WINNER DETERMINATION MODELS */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-5">
        {/* Single Winner Event */}
        <div className="bg-[#111827] border border-[#1F2737] rounded-2xl p-4 sm:p-6 space-y-2.5 sm:space-y-3">
          <div className="flex items-center gap-2.5 text-amber-400 font-bold text-xs sm:text-sm uppercase tracking-wider pb-2 border-b border-[#1F2737]">
            <Trophy className="w-4 h-4 sm:w-5 sm:h-5 text-amber-400 shrink-0" />
            <span>Single Winner Event</span>
          </div>
          <div className="space-y-2 text-xs sm:text-sm text-[#CBD5E1] leading-relaxed">
            <p>
              When a lottery event is designated as a <strong>Single Winner</strong> draw:
            </p>
            <ul className="space-y-1.5 list-disc list-inside text-[#94A3B8] text-xs">
              <li>Only <strong>one 4-digit combination</strong> is selected by the provably fair oracle.</li>
              <li>The verified ticket holder matching that combination receives <strong>100% of the event&apos;s configured prize</strong> (Fixed Jackpot or finalized Jackpot Range amount).</li>
              <li>No secondary winners are created for a Single Winner event.</li>
            </ul>
          </div>
        </div>

        {/* Multiple Winner Event */}
        <div className="bg-[#111827] border border-[#1F2737] rounded-2xl p-4 sm:p-6 space-y-2.5 sm:space-y-3">
          <div className="flex items-center gap-2.5 text-cyan-400 font-bold text-xs sm:text-sm uppercase tracking-wider pb-2 border-b border-[#1F2737]">
            <Award className="w-4 h-4 sm:w-5 sm:h-5 text-cyan-400 shrink-0" />
            <span>Multiple Winner Event</span>
          </div>
          <div className="space-y-2 text-xs sm:text-sm text-[#CBD5E1] leading-relaxed">
            <p>
              When an event is designated as a <strong>Multiple Winner</strong> draw:
            </p>
            <ul className="space-y-1.5 list-disc list-inside text-[#94A3B8] text-xs">
              <li>The event specifies an exact configured winner count (e.g. 2, 3, or 5 winners).</li>
              <li>The winner pool share is split across positions according to the configured distribution schedule (e.g. 1st: 60%, 2nd: 25%, 3rd: 15%).</li>
              <li>Prizes are credited to each matching winner&apos;s wallet based on their verified placement.</li>
            </ul>
          </div>
        </div>
      </div>

      {/* RULE 4: JACKPOT MODES (FIXED VS RANGE) */}
      <div className="bg-[#111827] border border-[#1F2737] rounded-2xl p-4 xs:p-5 sm:p-7 space-y-3 sm:space-y-4">
        <h2 className="font-display font-black text-sm xs:text-base sm:text-lg text-white flex items-center gap-2">
          <DollarSign className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-400 shrink-0" />
          <span>Pool Prize Scaling: Fixed vs Dynamic Range</span>
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4 text-xs text-[#CBD5E1] leading-relaxed">
          <div className="bg-[#161F33] p-3.5 sm:p-4 rounded-xl border border-[#273248] space-y-1.5 sm:space-y-2">
            <span className="font-bold text-white block text-xs sm:text-sm">Fixed Jackpot Pools</span>
            <p className="text-[#94A3B8]">
              Guarantees a preset, predetermined jackpot prize in USDT (e.g. 5,000 USDT) regardless of the number of participants. Verified winners receive 100% of the configured prize allocation.
            </p>
          </div>

          <div className="bg-[#161F33] p-3.5 sm:p-4 rounded-xl border border-[#273248] space-y-1.5 sm:space-y-2">
            <span className="font-bold text-white block text-xs sm:text-sm">Jackpot Range Pools</span>
            <p className="text-[#94A3B8]">
              Displays a configured minimum and maximum USDT prize range to players. At draw finalization, the final prize is selected strictly within the configured minimum and maximum bounds.
            </p>
          </div>
        </div>
      </div>

      {/* RULE 5: DRAW TIMING & CUTOFF */}
      <div className="bg-[#111827] border border-[#1F2737] rounded-2xl p-4 xs:p-5 sm:p-7 space-y-2.5 sm:space-y-3">
        <h2 className="font-display font-black text-sm xs:text-base sm:text-lg text-white flex items-center gap-2">
          <Clock className="w-4 h-4 sm:w-5 sm:h-5 text-amber-400 shrink-0" />
          <span>Cutoff Time &amp; Draw Mechanics</span>
        </h2>
        <p className="text-xs sm:text-sm text-[#CBD5E1] leading-relaxed">
          Every draw event features an immutable scheduled <code>draw_time</code>. When the countdown timer reaches zero, ticket purchasing is locked immediately. The backend settlement worker queries all participating tickets, generates the deterministic winning digits, logs the results in the cryptographic ledger, and initiates instant wallet credits.
        </p>
      </div>

      {/* Need Assistance? Internal Support Routing */}
      <div className="p-4 sm:p-5 rounded-2xl bg-[#111827] border border-amber-500/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
        <div>
          <h3 className="font-bold text-xs sm:text-sm text-white">Have questions about the official rules?</h3>
          <p className="text-[11px] sm:text-xs text-[#94A3B8] mt-0.5">
            Our governance team can explain pool distribution, combination locks, and draw verifications.
          </p>
        </div>
        <button
          type="button"
          onClick={handleContactSupport}
          className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-extrabold text-xs transition-colors shrink-0 flex items-center gap-1.5 cursor-pointer shadow-md shadow-amber-500/20 active:scale-95"
        >
          <Mail className="w-3.5 h-3.5" />
          <span>Contact Support</span>
        </button>
      </div>
    </div>
  );
}
