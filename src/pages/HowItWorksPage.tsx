import React from 'react';
import {
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
  Wallet,
  HelpCircle,
  Mail
} from 'lucide-react';
import { useLottery } from '../context/LotteryContext';

interface HowItWorksPageProps {
  onBackToHome?: () => void;
  onNavigateToTab?: (tabId: string) => void;
}

export default function HowItWorksPage({ onBackToHome, onNavigateToTab }: HowItWorksPageProps) {
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
      {/* Header Banner - Responsive padding and typography */}
      <div className="rounded-2xl bg-gradient-to-r from-[#111827] via-[#161F33] to-[#111827] border border-amber-500/30 p-4 xs:p-5 sm:p-7 lg:p-8 space-y-2.5 sm:space-y-3 shadow-xl">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-400 text-[11px] sm:text-xs font-bold">
          <Zap className="w-3.5 h-3.5" />
          <span>Four Digit Lottery Guide</span>
        </div>
        <h1 className="font-display font-black text-xl xs:text-2xl sm:text-3xl lg:text-4xl text-white tracking-tight leading-tight">
          How Four Digit Lottery Works
        </h1>
        <p className="text-xs sm:text-sm text-[#CBD5E1] leading-relaxed max-w-2xl">
          Everything you need to know about selecting digits (0000–9999), single-ticket purchasing rules, live countdown draws, and automated USDT TRC-20 prize distributions.
        </p>
      </div>

      {/* Step-by-Step Walkthrough (6 Detailed Steps) */}
      <div className="space-y-3 sm:space-y-4">
        <h2 className="font-display font-black text-base xs:text-lg sm:text-xl text-white flex items-center gap-2">
          <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 text-amber-400 shrink-0" />
          <span>Simple Step-by-Step Process</span>
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
          {/* Step 1 */}
          <div className="bg-[#111827] border border-[#1F2737] rounded-2xl p-4 sm:p-5 space-y-2 hover:border-amber-500/30 transition-colors">
            <div className="flex items-center justify-between">
              <span className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center font-mono-numbers font-black text-xs sm:text-sm border border-amber-500/30">
                1
              </span>
              <span className="text-[10px] uppercase font-bold text-[#94A3B8] tracking-wider">Step 1</span>
            </div>
            <h3 className="font-display font-bold text-sm sm:text-base text-white">Enter a Live Draw Room</h3>
            <p className="text-xs text-[#94A3B8] leading-relaxed">
              From the homepage Available Pools, click <strong>&quot;Enter Room&quot;</strong> on any active lottery event. Each room features an authoritative live ticking countdown and a transparent jackpot pool.
            </p>
          </div>

          {/* Step 2 */}
          <div className="bg-[#111827] border border-[#1F2737] rounded-2xl p-4 sm:p-5 space-y-2 hover:border-amber-500/30 transition-colors">
            <div className="flex items-center justify-between">
              <span className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center font-mono-numbers font-black text-xs sm:text-sm border border-cyan-500/30">
                2
              </span>
              <span className="text-[10px] uppercase font-bold text-[#94A3B8] tracking-wider">Step 2</span>
            </div>
            <h3 className="font-display font-bold text-sm sm:text-base text-white">Select Your Four Digits (0000–9999)</h3>
            <p className="text-xs text-[#94A3B8] leading-relaxed">
              Choose any 4-digit number from <strong>0000 to 9999</strong>. You can manually adjust the 4 roller dials or use the <strong>Quick Pick</strong> numeric keypad to generate random combinations instantly.
            </p>
          </div>

          {/* Step 3 */}
          <div className="bg-[#111827] border border-[#1F2737] rounded-2xl p-4 sm:p-5 space-y-2 hover:border-amber-500/30 transition-colors">
            <div className="flex items-center justify-between">
              <span className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-mono-numbers font-black text-xs sm:text-sm border border-emerald-500/30">
                3
              </span>
              <span className="text-[10px] uppercase font-bold text-[#94A3B8] tracking-wider">Step 3</span>
            </div>
            <h3 className="font-display font-bold text-sm sm:text-base text-white">Single-Ticket Uniqueness Rule</h3>
            <p className="text-xs text-[#94A3B8] leading-relaxed">
              Every 4-digit combination can only be purchased <strong>once per event</strong>. Once a number is bought, it is locked and unavailable for anyone else in that draw, strictly enforced by a database unique constraint.
            </p>
          </div>

          {/* Step 4 */}
          <div className="bg-[#111827] border border-[#1F2737] rounded-2xl p-4 sm:p-5 space-y-2 hover:border-amber-500/30 transition-colors">
            <div className="flex items-center justify-between">
              <span className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center font-mono-numbers font-black text-xs sm:text-sm border border-purple-500/30">
                4
              </span>
              <span className="text-[10px] uppercase font-bold text-[#94A3B8] tracking-wider">Step 4</span>
            </div>
            <h3 className="font-display font-bold text-sm sm:text-base text-white">Instant Purchase with USDT</h3>
            <p className="text-xs text-[#94A3B8] leading-relaxed">
              Ticket prices are clearly listed (e.g. 10.00 USDT). Confirming your purchase deducts the ticket price from your USDT balance and records an atomic ticket entry with cryptographic proof.
            </p>
          </div>

          {/* Step 5 */}
          <div className="bg-[#111827] border border-[#1F2737] rounded-2xl p-4 sm:p-5 space-y-2 hover:border-amber-500/30 transition-colors">
            <div className="flex items-center justify-between">
              <span className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center font-mono-numbers font-black text-xs sm:text-sm border border-amber-500/30">
                5
              </span>
              <span className="text-[10px] uppercase font-bold text-[#94A3B8] tracking-wider">Step 5</span>
            </div>
            <h3 className="font-display font-bold text-sm sm:text-base text-white">Automated Transparent Draw</h3>
            <p className="text-xs text-[#94A3B8] leading-relaxed">
              When the event countdown reaches zero, ticket purchasing closes immediately. The backend executes the draw using SHA-256 verifiable random seeds to produce the official 4 winning digits.
            </p>
          </div>

          {/* Step 6 */}
          <div className="bg-[#111827] border border-[#1F2737] rounded-2xl p-4 sm:p-5 space-y-2 hover:border-amber-500/30 transition-colors">
            <div className="flex items-center justify-between">
              <span className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-mono-numbers font-black text-xs sm:text-sm border border-emerald-500/30">
                6
              </span>
              <span className="text-[10px] uppercase font-bold text-[#94A3B8] tracking-wider">Step 6</span>
            </div>
            <h3 className="font-display font-bold text-sm sm:text-base text-white">Instant Prize Disbursement</h3>
            <p className="text-xs text-[#94A3B8] leading-relaxed">
              Prize winnings credit automatically to your platform USDT wallet. You can withdraw your funds via TRC-20 to your personal crypto wallet within 24 hours anytime.
            </p>
          </div>
        </div>
      </div>

      {/* Single Winner vs Multiple Winner Explanation */}
      <div className="bg-[#111827] border border-[#1F2737] rounded-2xl p-4 xs:p-5 sm:p-7 space-y-3 sm:space-y-4 shadow-lg">
        <h2 className="font-display font-black text-sm xs:text-base sm:text-lg text-white flex items-center gap-2">
          <Trophy className="w-4 h-4 sm:w-5 sm:h-5 text-amber-400 shrink-0" />
          <span>Understanding Event Modes: Single Winner vs Multiple Winner</span>
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4 pt-1">
          <div className="bg-[#161F33] border border-[#273248] rounded-xl p-3.5 sm:p-4 space-y-1.5 sm:space-y-2">
            <div className="flex items-center gap-2 text-amber-400 font-bold text-xs uppercase tracking-wider">
              <Award className="w-4 h-4 shrink-0" />
              <span>Single Winner Events</span>
            </div>
            <p className="text-xs text-[#CBD5E1] leading-relaxed">
              In a Single Winner event, exactly <strong>one 4-digit combination</strong> is selected as the grand champion. That single ticket holder wins 100% of the allocated winner prize pool.
            </p>
          </div>

          <div className="bg-[#161F33] border border-[#273248] rounded-xl p-3.5 sm:p-4 space-y-1.5 sm:space-y-2">
            <div className="flex items-center gap-2 text-cyan-400 font-bold text-xs uppercase tracking-wider">
              <Dices className="w-4 h-4 shrink-0" />
              <span>Multiple Winner Events</span>
            </div>
            <p className="text-xs text-[#CBD5E1] leading-relaxed">
              In a Multiple Winner event, the prize pool is distributed across multiple winning positions according to the room&apos;s preset tier distribution (e.g. 1st: 60%, 2nd: 25%, 3rd: 15%).
            </p>
          </div>
        </div>
      </div>

      {/* Need Assistance? Internal Support Routing */}
      <div className="p-4 sm:p-5 rounded-2xl bg-[#111827] border border-amber-500/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
        <div>
          <h3 className="font-bold text-xs sm:text-sm text-white">Need help understanding the draw mechanics?</h3>
          <p className="text-[11px] sm:text-xs text-[#94A3B8] mt-0.5">
            Our support desk is available 24/7 to assist with room rules, ticket orders, or payouts.
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
