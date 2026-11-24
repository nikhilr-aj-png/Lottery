import React from 'react';
import { 
  ArrowLeft, 
  Ticket, 
  Dices, 
  DollarSign, 
  Trophy, 
  ShieldCheck, 
  Clock, 
  CheckCircle2, 
  Zap, 
  Sparkles,
  Award,
  Wallet
} from 'lucide-react';

interface HowItWorksPageProps {
  onBackToHome: () => void;
  onNavigateToTab?: (tabId: string) => void;
}

export default function HowItWorksPage({ onBackToHome, onNavigateToTab }: HowItWorksPageProps) {
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
          EarnFlow Player Guide
        </span>
      </div>

      {/* Header Banner */}
      <div className="rounded-2xl bg-gradient-to-r from-[#111827] via-[#161F33] to-[#111827] border border-amber-500/30 p-6 sm:p-8 space-y-3 shadow-xl">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-400 text-xs font-bold">
          <Zap className="w-3.5 h-3.5" />
          <span>Four Digit Lottery Guide</span>
        </div>
        <h1 className="font-display font-black text-2xl sm:text-3xl lg:text-4xl text-white tracking-tight">
          How Four Digit Lottery Works
        </h1>
        <p className="text-xs sm:text-sm text-[#CBD5E1] leading-relaxed max-w-2xl">
          Everything you need to know about selecting digits (0000–9999), single-ticket purchasing rules, live countdown draws, and automated USDT TRC-20 prize distributions.
        </p>
      </div>

      {/* Step-by-Step Walkthrough (6 Detailed Steps) */}
      <div className="space-y-4">
        <h2 className="font-display font-black text-lg sm:text-xl text-white flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-amber-400" />
          <span>Simple Step-by-Step Process</span>
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Step 1 */}
          <div className="bg-[#111827] border border-[#1F2737] rounded-2xl p-5 space-y-2.5 hover:border-amber-500/30 transition-colors">
            <div className="flex items-center justify-between">
              <span className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center font-mono-numbers font-black text-sm border border-amber-500/30">
                1
              </span>
              <span className="text-[10px] uppercase font-bold text-[#94A3B8] tracking-wider">Step 1</span>
            </div>
            <h3 className="font-display font-bold text-base text-white">Enter a Live Draw Room</h3>
            <p className="text-xs text-[#94A3B8] leading-relaxed">
              From the homepage Available Pools, click <strong>"Enter Room"</strong> on any active lottery event. Each room features an authoritative live ticking countdown (e.g. <code>LIVE 02:29:48</code>) and a clear jackpot pool.
            </p>
          </div>

          {/* Step 2 */}
          <div className="bg-[#111827] border border-[#1F2737] rounded-2xl p-5 space-y-2.5 hover:border-amber-500/30 transition-colors">
            <div className="flex items-center justify-between">
              <span className="w-8 h-8 rounded-xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center font-mono-numbers font-black text-sm border border-cyan-500/30">
                2
              </span>
              <span className="text-[10px] uppercase font-bold text-[#94A3B8] tracking-wider">Step 2</span>
            </div>
            <h3 className="font-display font-bold text-base text-white">Select Your Four Digits (0000–9999)</h3>
            <p className="text-xs text-[#94A3B8] leading-relaxed">
              Choose any 4-digit number from <strong>0000 to 9999</strong>. You can manually adjust the 4 roller dials or use the <strong>Quick Pick</strong> numeric keypad to generate random combinations instantly.
            </p>
          </div>

          {/* Step 3 */}
          <div className="bg-[#111827] border border-[#1F2737] rounded-2xl p-5 space-y-2.5 hover:border-amber-500/30 transition-colors">
            <div className="flex items-center justify-between">
              <span className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-mono-numbers font-black text-sm border border-emerald-500/30">
                3
              </span>
              <span className="text-[10px] uppercase font-bold text-[#94A3B8] tracking-wider">Step 3</span>
            </div>
            <h3 className="font-display font-bold text-base text-white">Single-Ticket Uniqueness Rule</h3>
            <p className="text-xs text-[#94A3B8] leading-relaxed">
              Every 4-digit combination can only be purchased <strong>once per event</strong>. Once a number is bought, it is locked and unavailable for anyone else in that draw, strictly enforced by a database unique constraint.
            </p>
          </div>

          {/* Step 4 */}
          <div className="bg-[#111827] border border-[#1F2737] rounded-2xl p-5 space-y-2.5 hover:border-amber-500/30 transition-colors">
            <div className="flex items-center justify-between">
              <span className="w-8 h-8 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center font-mono-numbers font-black text-sm border border-purple-500/30">
                4
              </span>
              <span className="text-[10px] uppercase font-bold text-[#94A3B8] tracking-wider">Step 4</span>
            </div>
            <h3 className="font-display font-bold text-base text-white">Instant Purchase with USDT</h3>
            <p className="text-xs text-[#94A3B8] leading-relaxed">
              Ticket prices are clearly listed (e.g. 10.00 USDT). Confirming your purchase deducts the ticket price from your USDT balance and records an atomic ticket entry with cryptographic proof.
            </p>
          </div>

          {/* Step 5 */}
          <div className="bg-[#111827] border border-[#1F2737] rounded-2xl p-5 space-y-2.5 hover:border-amber-500/30 transition-colors">
            <div className="flex items-center justify-between">
              <span className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center font-mono-numbers font-black text-sm border border-amber-500/30">
                5
              </span>
              <span className="text-[10px] uppercase font-bold text-[#94A3B8] tracking-wider">Step 5</span>
            </div>
            <h3 className="font-display font-bold text-base text-white">Automated Transparent Draw</h3>
            <p className="text-xs text-[#94A3B8] leading-relaxed">
              When the event countdown reaches zero, ticket purchasing closes immediately. The backend executes the draw using SHA-256 verifiable random seeds to produce the official 4 winning digits.
            </p>
          </div>

          {/* Step 6 */}
          <div className="bg-[#111827] border border-[#1F2737] rounded-2xl p-5 space-y-2.5 hover:border-amber-500/30 transition-colors">
            <div className="flex items-center justify-between">
              <span className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-mono-numbers font-black text-sm border border-emerald-500/30">
                6
              </span>
              <span className="text-[10px] uppercase font-bold text-[#94A3B8] tracking-wider">Step 6</span>
            </div>
            <h3 className="font-display font-bold text-base text-white">Instant Prize Disbursement</h3>
            <p className="text-xs text-[#94A3B8] leading-relaxed">
              Prize winnings credit automatically to your platform USDT wallet. You can withdraw your funds via TRC-20 to your personal crypto wallet within 24 hours anytime.
            </p>
          </div>
        </div>
      </div>

      {/* Single Winner vs Multiple Winner Explanation */}
      <div className="bg-[#111827] border border-[#1F2737] rounded-2xl p-6 sm:p-7 space-y-4 shadow-lg">
        <h2 className="font-display font-black text-base sm:text-lg text-white flex items-center gap-2">
          <Trophy className="w-5 h-5 text-amber-400" />
          <span>Understanding Event Modes: Single Winner vs Multiple Winner</span>
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
          <div className="bg-[#161F33] border border-[#273248] rounded-xl p-4 space-y-2">
            <div className="flex items-center gap-2 text-amber-400 font-bold text-xs uppercase tracking-wider">
              <Award className="w-4 h-4" />
              <span>Single Winner Events</span>
            </div>
            <p className="text-xs text-[#CBD5E1] leading-relaxed">
              In a Single Winner event, exactly <strong>one 4-digit combination</strong> is selected as the grand champion. That single ticket holder wins 100% of the allocated winner prize pool.
            </p>
          </div>

          <div className="bg-[#161F33] border border-[#273248] rounded-xl p-4 space-y-2">
            <div className="flex items-center gap-2 text-cyan-400 font-bold text-xs uppercase tracking-wider">
              <Dices className="w-4 h-4" />
              <span>Multiple Winner Events</span>
            </div>
            <p className="text-xs text-[#CBD5E1] leading-relaxed">
              In a Multiple Winner event, the prize pool is distributed across multiple winning positions according to the room's preset tier distribution (e.g. 1st: 60%, 2nd: 25%, 3rd: 15%).
            </p>
          </div>
        </div>
      </div>

      {/* CTA Section */}
      <div className="text-center pt-2">
        <button
          onClick={onBackToHome}
          className="px-8 py-3.5 rounded-xl btn-gold text-xs sm:text-sm font-black cursor-pointer shadow-lg shadow-amber-500/20 active:scale-95 transition-all"
        >
          Explore Live Lottery Pools Now
        </button>
      </div>
    </div>
  );
}