import React from 'react';
import { 
  ArrowLeft, 
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
  Clock
} from 'lucide-react';

interface LotteryRulesPageProps {
  onBackToHome: () => void;
}

export default function LotteryRulesPage({ onBackToHome }: LotteryRulesPageProps) {
  React.useEffect(() => {
    const mainEl = document.getElementById('main-content');
    if (mainEl) {
      mainEl.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    }
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, []);
  return (
    <div className="w-full max-w-4xl mx-auto py-6 sm:py-8 space-y-6 sm:space-y-8 animate-in fade-in duration-200 text-left">
      {/* Top Breadcrumb & Navigation */}
      <div className="flex items-center justify-between pb-3 border-b border-[#1F2737]">
        <button
          onClick={onBackToHome}
          className="inline-flex items-center gap-2 text-xs font-bold text-[#94A3B8] hover:text-white transition-colors cursor-pointer group"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform text-amber-400" />
          <span>Back to Lottery Lobby</span>
        </button>

        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono-numbers font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30">
          Official Platform Governance
        </span>
      </div>

      {/* Header Banner */}
      <div className="rounded-2xl bg-gradient-to-r from-[#111827] via-[#161F33] to-[#111827] border border-amber-500/30 p-6 sm:p-8 space-y-3 shadow-xl">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-400 text-xs font-bold">
          <Scale className="w-3.5 h-3.5" />
          <span>Provably Fair Gaming Standards</span>
        </div>
        <h1 className="font-display font-black text-2xl sm:text-3xl lg:text-4xl text-white tracking-tight">
          Lottery Rules &amp; Prize Distribution
        </h1>
        <p className="text-xs sm:text-sm text-[#CBD5E1] leading-relaxed max-w-2xl">
          Authoritative operational specifications for EarnFlow.in Four Digit Lottery events, digit purchase exclusivity, winner determination models, and database-level security constraints.
        </p>
      </div>

      {/* RULE 1: DIGIT PURCHASE EXCLUSIVITY */}
      <div className="bg-[#111827] border border-amber-500/40 rounded-2xl p-6 sm:p-7 space-y-4 shadow-lg relative overflow-hidden">
        <div className="flex items-center gap-3 pb-3 border-b border-[#1F2737]">
          <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0 border border-amber-500/40">
            <Lock className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-display font-black text-base sm:text-lg text-white">
              1. 4-Digit Combination Uniqueness Rule
            </h2>
            <p className="text-xs text-amber-400 font-mono-numbers">
              Single-Owner Exclusivity per Draw Event
            </p>
          </div>
        </div>

        <div className="space-y-3 text-xs text-[#CBD5E1] leading-relaxed">
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
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Single Winner Event */}
        <div className="bg-[#111827] border border-[#1F2737] rounded-2xl p-5 sm:p-6 space-y-3">
          <div className="flex items-center gap-2.5 text-amber-400 font-bold text-sm uppercase tracking-wider pb-2 border-b border-[#1F2737]">
            <Trophy className="w-5 h-5 text-amber-400" />
            <span>Single Winner Event</span>
          </div>
          <div className="space-y-2 text-xs text-[#CBD5E1] leading-relaxed">
            <p>
              When a lottery event is designated as a <strong>Single Winner</strong> draw:
            </p>
            <ul className="space-y-1.5 list-disc list-inside text-[#94A3B8]">
              <li>Only <strong>one 4-digit combination</strong> is selected by the provably fair oracle.</li>
              <li>The verified ticket holder matching that combination receives <strong>100% of the winner payout share</strong> (typically 90% of the entire pool, after the standard 5% platform house fee).</li>
              <li>No secondary winners are created for a Single Winner event.</li>
            </ul>
          </div>
        </div>

        {/* Multiple Winner Event */}
        <div className="bg-[#111827] border border-[#1F2737] rounded-2xl p-5 sm:p-6 space-y-3">
          <div className="flex items-center gap-2.5 text-cyan-400 font-bold text-sm uppercase tracking-wider pb-2 border-b border-[#1F2737]">
            <Award className="w-5 h-5 text-cyan-400" />
            <span>Multiple Winner Event</span>
          </div>
          <div className="space-y-2 text-xs text-[#CBD5E1] leading-relaxed">
            <p>
              When an event is designated as a <strong>Multiple Winner</strong> draw:
            </p>
            <ul className="space-y-1.5 list-disc list-inside text-[#94A3B8]">
              <li>The event specifies an exact configured winner count (e.g. 2, 3, or 5 winners).</li>
              <li>The winner pool share is split across positions according to the configured distribution schedule (e.g. 1st: 60%, 2nd: 25%, 3rd: 15%).</li>
              <li>Prizes are credited to each matching winner's wallet based on their verified placement.</li>
            </ul>
          </div>
        </div>
      </div>

      {/* RULE 4: JACKPOT MODES (FIXED VS RANGE) */}
      <div className="bg-[#111827] border border-[#1F2737] rounded-2xl p-6 sm:p-7 space-y-4">
        <h2 className="font-display font-black text-base sm:text-lg text-white flex items-center gap-2">
          <DollarSign className="w-5 h-5 text-emerald-400" />
          <span>Pool Prize Scaling: Fixed vs Dynamic Range</span>
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-[#CBD5E1] leading-relaxed">
          <div className="bg-[#161F33] p-4 rounded-xl border border-[#273248] space-y-2">
            <span className="font-bold text-white block">Fixed Jackpot Pools</span>
            <p className="text-[#94A3B8]">
              Guarantees a preset, predetermined jackpot prize in USDT (e.g. 10,000 USDT) regardless of the number of participants. The winner receives the full prize amount allocated.
            </p>
          </div>

          <div className="bg-[#161F33] p-4 rounded-xl border border-[#273248] space-y-2">
            <span className="font-bold text-white block">Dynamic Range Pools</span>
            <p className="text-[#94A3B8]">
              The jackpot starts at a minimum guaranteed baseline and dynamically expands with every ticket purchased by participating players (95% of ticket sales added directly to the pool).
            </p>
          </div>
        </div>
      </div>

      {/* RULE 5: DRAW TIMING & CUTOFF */}
      <div className="bg-[#111827] border border-[#1F2737] rounded-2xl p-6 sm:p-7 space-y-3">
        <h2 className="font-display font-black text-base sm:text-lg text-white flex items-center gap-2">
          <Clock className="w-5 h-5 text-amber-400" />
          <span>Cutoff Time &amp; Draw Mechanics</span>
        </h2>
        <p className="text-xs text-[#CBD5E1] leading-relaxed">
          Every draw event features an immutable scheduled <code>draw_time</code>. When the countdown timer reaches zero, ticket purchasing is locked immediately. The backend settlement worker queries all participating tickets, generates the deterministic winning digits, logs the results in the cryptographic ledger, and initiates instant wallet credits.
        </p>
      </div>

      {/* CTA */}
      <div className="text-center pt-2">
        <button
          onClick={onBackToHome}
          className="px-8 py-3.5 rounded-xl btn-gold text-xs sm:text-sm font-black cursor-pointer shadow-lg shadow-amber-500/20 active:scale-95 transition-all"
        >
          Return to Lottery Lobby
        </button>
      </div>
    </div>
  );
}