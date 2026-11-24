import React from 'react';
import { ShieldAlert, HeartHandshake, CheckCircle2, Clock, AlertTriangle, Mail } from 'lucide-react';
import { useLottery } from '../context/LotteryContext';

export interface ResponsibleGamingPageProps {
  onBackToHome?: () => void;
  onNavigateToTab?: (tabId: string) => void;
}

export default function ResponsibleGamingPage({ onBackToHome, onNavigateToTab }: ResponsibleGamingPageProps) {
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
    <div className="w-full max-w-4xl mx-auto px-3 xs:px-4 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-8 text-left space-y-4 sm:space-y-6 animate-in fade-in duration-200">
      {/* Top Header */}
      <div className="pb-3 sm:pb-4 border-b border-[#1F2737] space-y-1.5 sm:space-y-2">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 font-mono-numbers text-[10px] sm:text-[11px] font-bold">
          <HeartHandshake className="w-3.5 h-3.5 text-amber-400" />
          <span>Player Wellbeing &amp; Safety</span>
        </div>
        <h1 className="font-display font-black text-xl xs:text-2xl sm:text-3xl text-white tracking-tight leading-tight">
          Responsible Gaming Policy
        </h1>
        <p className="text-xs sm:text-sm text-[#94A3B8]">
          EarnFlow.in is committed to maintaining a safe, transparent, and enjoyable gaming environment.
        </p>
      </div>

      <div className="bg-[#111827] border border-[#1F2737] rounded-2xl p-4 xs:p-5 sm:p-7 space-y-4 sm:space-y-5 text-xs sm:text-sm text-[#CBD5E1] leading-relaxed shadow-lg">
        {/* Core Principles */}
        <div className="space-y-2">
          <h2 className="font-display font-bold text-sm sm:text-base text-white">Principles of Responsible Play</h2>
          <p>
            Four-Digit Lottery participation must be approached solely as an entertaining leisure activity, not as a reliable mechanism to generate income, accumulate wealth, or solve personal financial difficulties.
          </p>
        </div>

        {/* Habits vs Warning Signs */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4 pt-1">
          <div className="p-3.5 sm:p-4 rounded-xl bg-[#0B0F19] border border-[#1F2737] space-y-2">
            <h3 className="font-bold text-amber-400 text-xs flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>Recommended Habits</span>
            </h3>
            <ul className="space-y-1.5 text-xs text-[#94A3B8] list-disc pl-4">
              <li>Establish a clear entertainment budget before entering draws.</li>
              <li>Only participate with funds you can afford to lose comfortably.</li>
              <li>Never chase lottery losses with larger ticket entries.</li>
              <li>Balance gaming with other daily activities and hobbies.</li>
            </ul>
          </div>

          <div className="p-3.5 sm:p-4 rounded-xl bg-[#0B0F19] border border-[#1F2737] space-y-2">
            <h3 className="font-bold text-red-400 text-xs flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>Warning Signs</span>
            </h3>
            <ul className="space-y-1.5 text-xs text-[#94A3B8] list-disc pl-4">
              <li>Borrowing funds or using essential living expenses for tickets.</li>
              <li>Neglecting family, professional, or social obligations to play.</li>
              <li>Feeling stress, anxiety, or desperation when draws conclude.</li>
              <li>Hiding participation from family members or friends.</li>
            </ul>
          </div>
        </div>

        {/* Stake Control & Practical Tools */}
        <div className="space-y-2 pt-2">
          <h2 className="font-display font-bold text-sm sm:text-base text-white">Stake Control &amp; Session Management</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-3 pt-1">
            <div className="p-3 sm:p-3.5 rounded-xl bg-[#0B0F19] border border-[#1F2737] space-y-1">
              <span className="font-mono-numbers text-xs font-bold text-amber-400 block">1. Fixed Unit Pricing</span>
              <p className="text-[11px] text-[#94A3B8] leading-relaxed">
                Ticket entries are purchased individually with transparent per-unit pricing, preventing impulsive bulk wagering.
              </p>
            </div>
            <div className="p-3 sm:p-3.5 rounded-xl bg-[#0B0F19] border border-[#1F2737] space-y-1">
              <span className="font-mono-numbers text-xs font-bold text-emerald-400 block">2. Personal Deposit Caps</span>
              <p className="text-[11px] text-[#94A3B8] leading-relaxed">
                Define your monthly USDT wallet deposit ceiling in advance and never exceed your allocated entertainment budget.
              </p>
            </div>
            <div className="p-3 sm:p-3.5 rounded-xl bg-[#0B0F19] border border-[#1F2737] space-y-1">
              <span className="font-mono-numbers text-xs font-bold text-cyan-400 block">3. Time &amp; Draw Limits</span>
              <p className="text-[11px] text-[#94A3B8] leading-relaxed">
                Take regular breaks between lottery rounds. Avoid participating in every consecutive pool without taking time off.
              </p>
            </div>
          </div>
        </div>

        {/* Strict 18+ Age Restrictions */}
        <div className="space-y-2 pt-2">
          <h2 className="font-display font-bold text-sm sm:text-base text-white">Strict 18+ Age Restrictions</h2>
          <div className="p-3.5 sm:p-4 rounded-xl bg-[#0B0F19] border border-amber-500/20 space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-400 border border-amber-500/40 text-[10px] font-mono-numbers font-black">
                18+ ONLY
              </span>
              <span className="font-bold text-xs text-white">Underage Gaming Prohibition</span>
            </div>
            <p className="text-xs text-[#94A3B8] leading-relaxed">
              EarnFlow.in strictly prohibits anyone under the age of 18 (or the legal age of majority in your jurisdiction) from creating an account, depositing cryptocurrency, or purchasing lottery tickets. Any account identified as belonging to a minor will be immediately closed, and any active ticket orders will be voided.
            </p>
          </div>
        </div>

        {/* Cooling-off Period & Assistance via Internal Support Desk */}
        <div className="space-y-2 pt-2">
          <h2 className="font-display font-bold text-sm sm:text-base text-white">Cooling-off Period &amp; Player Assistance</h2>
          <p>
            If you feel you are developing unhealthy gaming habits or need a temporary break from entering draws, our support team can assist you with cooling-off periods and account guidance at any time.
          </p>

          <div className="p-3.5 sm:p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4 mt-2">
            <div className="space-y-0.5">
              <h3 className="font-bold text-xs sm:text-sm text-amber-300">Need a break or cooling-off period?</h3>
              <p className="text-[11px] sm:text-xs text-[#94A3B8] leading-normal">
                Submit an inquiry to our 24/7 Support Desk to discuss cooling-off options or account assistance.
              </p>
            </div>
            <button
              type="button"
              onClick={handleContactSupport}
              className="w-full sm:w-auto px-4 py-2 sm:py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-extrabold text-xs transition-colors shrink-0 flex items-center justify-center gap-1.5 cursor-pointer shadow-md shadow-amber-500/20 active:scale-95"
            >
              <Mail className="w-3.5 h-3.5" />
              <span>Contact Support Desk</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
