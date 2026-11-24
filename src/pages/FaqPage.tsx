import React, { useState } from 'react';
import { ArrowLeft, HelpCircle, ChevronDown, Ticket, Coins, ShieldCheck, Mail } from 'lucide-react';
import { useLottery } from '../context/LotteryContext';

export interface FaqPageProps {
  onBackToHome?: () => void;
  onNavigateToTab?: (tabId: string) => void;
}

export default function FaqPage({ onBackToHome, onNavigateToTab }: FaqPageProps) {
  const { platformSettings } = useLottery();
  const supportEmail = platformSettings?.supportEmail?.trim() || 'earnflow.user@gmail.com';
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  React.useEffect(() => {
    const mainEl = document.getElementById('main-content');
    if (mainEl) {
      mainEl.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    }
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, []);

  const categories = [
    {
      category: 'Four-Digit Lottery Gameplay & Rules',
      items: [
        {
          q: 'How do I participate in a Four-Digit Lottery draw?',
          a: 'Select any active draw room from the home page or lottery workstation. Choose your lucky four digits (from 0000 to 9999) using the interactive dial rollers or Quick Pick keypad, then confirm your purchase in USDT.'
        },
        {
          q: 'Can two players purchase the exact same 4-digit number in the same draw?',
          a: 'No. On EarnFlow.in, each four-digit combination can only be purchased once per lottery event. Once a combination is purchased by any player, it immediately becomes unavailable for anyone else in that draw. This exclusivity is strictly enforced at the database level with atomic constraints.'
        },
        {
          q: 'What is the single-ticket purchase rule?',
          a: 'Every ticket entry is purchased individually for a fixed room price (Total Cost = Unit Price). This prevents automated bots from bulk-buying number blocks and guarantees equal opportunity for every participant.'
        },
        {
          q: 'What is the difference between a Single Winner and Multiple Winner event?',
          a: 'In a Single Winner event, only one winning combination is selected and that player receives 100% of the winner prize share. In a Multiple Winner event, prizes are split across the configured winner count according to preset tier percentages (e.g., 1st: 60%, 2nd: 25%, 3rd: 15%).'
        },
        {
          q: 'How are the winning four digits determined?',
          a: 'Winning numbers are generated automatically at the scheduled draw cutoff time through cryptographic algorithms based on pre-committed random seeds and SHA-256 hashes. The process is fully autonomous with zero human intervention.'
        },
        {
          q: 'What are Fixed vs Range jackpot pools?',
          a: 'Fixed pools offer a guaranteed set jackpot (e.g., 10,000 USDT). Range pools start at a guaranteed minimum baseline and scale dynamically as participants purchase tickets (95% of ticket sales are added directly to the pool).'
        }
      ]
    },
    {
      category: 'Wallet & USDT Payments',
      items: [
        {
          q: 'Which blockchain network and currency does EarnFlow use?',
          a: 'EarnFlow.in operates exclusively with Tether (USDT) on the Tron blockchain network (TRC-20).'
        },
        {
          q: 'How long do withdrawals take?',
          a: 'Withdrawals are processed, audited, and broadcasted to your TRC-20 address within 24 hours. The minimum withdrawal threshold is 5 USDT.'
        },
        {
          q: 'Are there any hidden fees on ticket purchases or withdrawals?',
          a: 'No hidden fees. Ticket entries are charged at the exact stated room price. The platform operates on a transparent 5% house edge built directly into the game mathematics.'
        }
      ]
    },
    {
      category: 'Account & Security',
      items: [
        {
          q: 'What is the minimum age to play?',
          a: 'You must be at least 18 years of age or the legal age of majority in your jurisdiction to participate on EarnFlow.in.'
        },
        {
          q: 'How can I view my purchased tickets and draw history?',
          a: 'Click "My Tickets" in the main navigation to see all active entries and past draw outcomes associated with your account.'
        },
        {
          q: 'How do I contact customer support?',
          a: `You can reach our support team 24/7 by visiting the Customer Support tab or emailing us directly at ${supportEmail}.`
        }
      ]
    }
  ];

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
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/15 border border-purple-500/30 text-purple-300 font-mono-numbers text-[11px] font-bold">
          <HelpCircle className="w-3.5 h-3.5 text-purple-400" />
          <span>Help Center</span>
        </div>
        <h1 className="font-display font-black text-2xl sm:text-3xl text-white">
          Frequently Asked Questions
        </h1>
        <p className="text-xs sm:text-sm text-[#94A3B8]">
          Answers to common questions regarding Four-Digit Lottery rules, wallet transactions, and draws.
        </p>
      </div>

      <div className="space-y-6">
        {categories.map((cat, cIdx) => (
          <div key={cIdx} className="space-y-3">
            <h2 className="font-display font-bold text-sm text-amber-400 uppercase tracking-wider">
              {cat.category}
            </h2>
            <div className="space-y-2.5">
              {cat.items.map((item, iIdx) => {
                const uniqueId = cIdx * 100 + iIdx;
                const isOpen = openIndex === uniqueId;
                return (
                  <div
                    key={iIdx}
                    className="bg-[#111827] border border-[#1F2737] rounded-xl overflow-hidden transition-all"
                  >
                    <button
                      type="button"
                      onClick={() => setOpenIndex(isOpen ? null : uniqueId)}
                      className="w-full p-4 text-left flex items-center justify-between gap-3 text-xs sm:text-sm font-bold text-white hover:text-amber-400 transition-colors cursor-pointer"
                    >
                      <span>{item.q}</span>
                      <ChevronDown className={`w-4 h-4 text-[#94A3B8] shrink-0 transition-transform ${isOpen ? 'rotate-180 text-amber-400' : ''}`} />
                    </button>
                    {isOpen && (
                      <div className="px-4 pb-4 text-xs text-[#94A3B8] leading-relaxed border-t border-[#1F2737]/60 pt-3">
                        {item.a}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="p-5 rounded-2xl bg-[#111827] border border-amber-500/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h3 className="font-bold text-sm text-white">Still have questions?</h3>
          <p className="text-xs text-[#94A3B8] mt-0.5">
            Our support desk is available to assist you with tickets, payments, or rules.
          </p>
        </div>
        {onNavigateToTab ? (
          <button
            type="button"
            onClick={() => onNavigateToTab('contact')}
            className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-extrabold text-xs transition-colors shrink-0 flex items-center gap-1.5 cursor-pointer shadow-md shadow-amber-500/20"
          >
            <Mail className="w-3.5 h-3.5" />
            <span>Contact Support</span>
          </button>
        ) : (
          <a
            href={`mailto:${supportEmail}`}
            className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-extrabold text-xs transition-colors shrink-0 flex items-center gap-1.5"
          >
            <Mail className="w-3.5 h-3.5" />
            <span>Contact Support</span>
          </a>
        )}
      </div>
    </div>
  );
}
