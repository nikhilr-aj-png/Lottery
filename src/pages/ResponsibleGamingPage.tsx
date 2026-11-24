import React from 'react';
import { ArrowLeft, ShieldAlert, HeartHandshake, CheckCircle2, Clock, AlertTriangle, Phone, Mail } from 'lucide-react';
import { useLottery } from '../context/LotteryContext';

export interface ResponsibleGamingPageProps {
  onBackToHome?: () => void;
}

export default function ResponsibleGamingPage({ onBackToHome }: ResponsibleGamingPageProps) {
  const { platformSettings } = useLottery();
  const supportEmail = platformSettings?.supportEmail?.trim() || 'earnflow.user@gmail.com';

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-10 text-left space-y-6">
      {onBackToHome && (
        <button
          onClick={onBackToHome}
          className="inline-flex items-center gap-1.5 text-xs text-[#94A3B8] hover:text-white transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Home</span>
        </button>
      )}

      <div className="pb-4 border-b border-[#1F2737] space-y-2">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 font-mono-numbers text-[11px] font-bold">
          <HeartHandshake className="w-3.5 h-3.5 text-amber-400" />
          <span>Player Wellbeing &amp; Safety</span>
        </div>
        <h1 className="font-display font-black text-2xl sm:text-3xl text-white">
          Responsible Gaming Policy
        </h1>
        <p className="text-xs sm:text-sm text-[#94A3B8]">
          EarnFlow.in is committed to maintaining a safe, transparent, and enjoyable gaming environment.
        </p>
      </div>

      <div className="bg-[#111827] border border-[#1F2737] rounded-2xl p-5 sm:p-7 space-y-4 text-xs sm:text-sm text-[#CBD5E1] leading-relaxed">
        <h2 className="font-display font-bold text-base text-white">Principles of Responsible Play</h2>
        <p>
          Four-Digit Lottery participation must be approached solely as an entertaining leisure activity, not as a reliable mechanism to generate income, accumulate wealth, or solve personal financial difficulties.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
          <div className="p-4 rounded-xl bg-[#0B0F19] border border-[#1F2737] space-y-2">
            <h3 className="font-bold text-amber-400 text-xs flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4" />
              <span>Recommended Habits</span>
            </h3>
            <ul className="space-y-1.5 text-xs text-[#94A3B8] list-disc pl-4">
              <li>Establish a clear entertainment budget before entering draws.</li>
              <li>Only participate with funds you can afford to lose comfortably.</li>
              <li>Never chase lottery losses with larger ticket entries.</li>
              <li>Balance gaming with other daily activities and hobbies.</li>
            </ul>
          </div>

          <div className="p-4 rounded-xl bg-[#0B0F19] border border-[#1F2737] space-y-2">
            <h3 className="font-bold text-red-400 text-xs flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4" />
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

        <h2 className="font-display font-bold text-base text-white pt-4">Self-Exclusion &amp; Account Limits</h2>
        <p>
          If you feel you are developing unhealthy gaming habits, you can request temporary or permanent self-exclusion at any time. During exclusion, your account will be locked and prevented from purchasing tickets.
        </p>

        <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between gap-4">
          <div>
            <h3 className="font-bold text-xs text-amber-300">Need a break or cooling-off period?</h3>
            <p className="text-[11px] text-[#94A3B8] mt-0.5">
              Contact our Support Desk with &quot;Self-Exclusion Request&quot; to suspend your account immediately.
            </p>
          </div>
          <a
            href={`mailto:${supportEmail}?subject=Self-Exclusion%20Request`}
            className="px-4 py-2 rounded-xl bg-amber-500 text-black font-extrabold text-xs shrink-0"
          >
            Request Exclusion
          </a>
        </div>
      </div>
    </div>
  );
}
