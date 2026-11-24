import React, { useState, useMemo } from 'react';
import { useLottery } from '../context/LotteryContext';
import { 
  Sparkles, 
  Trophy, 
  ShieldCheck, 
  Coins, 
  ArrowRight,
  Ticket,
  Play,
  Lock,
  FileText,
  Clock,
  CheckCircle2,
  HelpCircle,
  ChevronDown,
  Layers,
  Award,
  Wallet,
  Zap,
  Users
} from 'lucide-react';

interface CasinoLobbyProps {
  onLaunchGame?: (gameId: string) => void;
  onOpenLotteryRules?: () => void;
}

export default function CasinoLobby({ onLaunchGame, onOpenLotteryRules }: CasinoLobbyProps) {
  const { events, setSelectedEventForModal, setActiveTab } = useLottery();
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null);

  // Active lottery events from Supabase
  const activeEvents = useMemo(() => {
    return (events || []).filter(e => e.status === 'active');
  }, [events]);

  const recentConcludedEvents = useMemo(() => {
    return (events || []).filter(e => e.status === 'completed' || Boolean(e.winningDigits)).slice(0, 3);
  }, [events]);

  const handleEnterRoom = (eventId?: string) => {
    if (onLaunchGame) {
      onLaunchGame('four-digit-lottery');
    }
  };

  const handleBuyTicket = (evt: any) => {
    setSelectedEventForModal(evt);
  };

  const faqs = [
    {
      q: 'What is EarnFlow Four-Digit Lottery?',
      a: 'EarnFlow Four-Digit Lottery is an online lucky draw game where players select a four-digit number between 0000 and 9999. Every round features an automated, transparent draw with prize pools distributed in USDT.'
    },
    {
      q: 'How does ticket pricing and single-ticket entry work?',
      a: 'Each ticket has a fixed unit price in USDT (e.g., 10 USDT per entry). To ensure fair participation, each ticket is selected and entered individually with full transparency.'
    },
    {
      q: 'How are winning numbers drawn?',
      a: 'Winning four-digit sequences are determined at the scheduled draw time through automated cryptographic algorithms. Outcomes are finalized by the platform draw engine without human intervention.'
    },
    {
      q: 'How and when are winnings paid out?',
      a: 'When an event concludes, exact matching tickets automatically receive their share of the jackpot prize pool. Payouts are credited directly to your EarnFlow USDT wallet and can be withdrawn via TRC-20 within 24 hours.'
    },
    {
      q: 'Which currency is used on EarnFlow.in?',
      a: 'EarnFlow.in operates exclusively with USDT (Tether on TRC-20 network). All ticket entries, jackpots, wallet deposits, and withdrawals are conducted in USDT.'
    },
    {
      q: 'What are the eligibility requirements to play?',
      a: 'You must be at least 18 years of age and comply with the applicable online gaming laws and regulations of your local jurisdiction.'
    }
  ];

  return (
    <div className="space-y-6 sm:space-y-8 pb-4 text-left">
      
      {/* 1. HERO SECTION: EXCLUSIVELY FOUR-DIGIT LOTTERY */}
      <section className="relative overflow-hidden rounded-2xl sm:rounded-3xl bg-gradient-to-br from-[#121624] via-[#0E131F] to-[#1C1335] border border-amber-500/30 p-4 xs:p-6 sm:p-8 lg:p-10 shadow-2xl">
        <div className="absolute top-0 right-0 w-80 sm:w-96 h-80 sm:h-96 bg-gradient-to-b from-amber-500/15 via-purple-600/10 to-transparent rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-60 sm:w-72 h-60 sm:h-72 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-6 lg:gap-8">
          
          {/* Left Column: Hero Copy & Actions */}
          <div className="flex-1 space-y-4 max-w-2xl min-w-0">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 font-mono-numbers text-[11px] font-bold">
              <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span>EarnFlow.in · Official Online Four-Digit Lottery Platform</span>
            </div>

            <h1 
              className="font-display font-black text-white tracking-tight leading-[1.15]"
              style={{ fontSize: 'clamp(1.5rem, 3.2vw + 0.5rem, 2.85rem)' }}
            >
              Online Four-Digit Lucky Draw with <span className="text-amber-400">USDT Settlements</span>
            </h1>

            <p className="text-xs sm:text-sm text-[#CBD5E1] leading-relaxed max-w-xl">
              <strong>EarnFlow.in is a dedicated Four-Digit Lottery platform. Pick your lucky combination between 0000 and 9999 to enter live jackpot pools with automated transparent draws and direct 24-hour USDT payouts.</strong>
            </p>

            <p className="text-xs sm:text-[13px] text-[#94A3B8] leading-relaxed max-w-xl">
              Enjoy fair play with a 95.0% RTP model, single-ticket entry rules, live countdown timers, and full cryptographic draw auditability.
            </p>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-2">
              <button
                onClick={() => handleEnterRoom()}
                className="px-6 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black font-extrabold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg shadow-amber-500/25 transition-all cursor-pointer"
              >
                <Play className="w-4 h-4 fill-current shrink-0" />
                <span>Enter Live Draw Room</span>
              </button>

              <button
                onClick={() => {
                  const el = document.getElementById('how-it-works-section');
                  if (el) el.scrollIntoView({ behavior: 'smooth' });
                }}
                className="px-5 py-3 rounded-xl bg-[#111827] hover:bg-[#151C2B] text-white border border-[#272A31] hover:border-amber-500/40 font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                <span>How It Works</span>
                <ArrowRight className="w-4 h-4 text-amber-400 shrink-0" />
              </button>
            </div>
          </div>

          {/* Right Column: Key Metrics Card */}
          <div className="flex flex-col gap-3 w-full sm:w-80 shrink-0 bg-[#0B0F19]/90 border border-amber-500/20 rounded-2xl p-4 shadow-xl backdrop-blur-md">
            
            <div className="flex items-center justify-between p-3 rounded-xl bg-[#111827] border border-[#1F2737]">
              <div>
                <span className="text-[10px] font-mono-numbers uppercase text-[#94A3B8] font-bold block">
                  Platform Currency
                </span>
                <span className="font-display font-black text-emerald-400 text-sm">
                  USDT (TRC-20)
                </span>
              </div>
              <div className="px-2.5 py-1 rounded-lg bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-xs font-bold font-mono-numbers flex items-center gap-1">
                <span>₮</span>
                <span>USDT</span>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-[#111827] border border-[#1F2737] space-y-1">
              <div className="flex items-center justify-between text-xs font-bold">
                <span className="text-[#94A3B8]">Game Math Model</span>
                <span className="text-amber-400 font-mono-numbers">95.0% RTP</span>
              </div>
              <div className="flex items-center justify-between text-xs font-bold pt-1 border-t border-[#1F2737]">
                <span className="text-[#94A3B8]">Drawn Sequence</span>
                <span className="text-white font-mono-numbers">0000 – 9999</span>
              </div>
              <div className="flex items-center justify-between text-xs font-bold pt-1 border-t border-[#1F2737]">
                <span className="text-[#94A3B8]">Payout Timeline</span>
                <span className="text-emerald-400 font-mono-numbers">Within 24 Hours</span>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-gradient-to-r from-amber-500/10 to-purple-500/10 border border-amber-500/30 flex items-center justify-between">
              <div>
                <span className="text-[9px] font-mono-numbers text-amber-400 font-bold block uppercase">
                  Player Compliance
                </span>
                <span className="font-mono-numbers text-xs font-extrabold text-white">
                  18+ Only · Responsible Gaming
                </span>
              </div>
              <ShieldCheck className="w-5 h-5 text-amber-400" />
            </div>

          </div>

        </div>
      </section>

      {/* 2. LIVE FOUR-DIGIT LOTTERY EVENTS / POOLS */}
      <section className="space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-[#1F2737]">
          <div>
            <h2 className="font-display font-extrabold text-lg sm:text-xl text-white flex items-center gap-2">
              <Ticket className="w-5 h-5 text-amber-400" />
              <span>Live Lottery Pools &amp; Draw Rooms</span>
            </h2>
            <p className="text-xs text-[#94A3B8]">
              Select an active room to pick your four digits and enter the lucky draw.
            </p>
          </div>

          <button
            onClick={() => handleEnterRoom()}
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#111827] hover:bg-[#151C2B] text-amber-400 border border-amber-500/30 text-xs font-bold cursor-pointer transition-colors"
          >
            <span>Open Workstation</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {activeEvents.length === 0 ? (
          <div className="bg-[#111827] rounded-2xl border border-[#1F2737] p-8 text-center space-y-3">
            <Clock className="w-8 h-8 text-amber-400 mx-auto" />
            <h3 className="font-display font-bold text-base text-white">Next Event Opening Soon</h3>
            <p className="text-xs text-[#94A3B8] max-w-md mx-auto">
              Our automated lottery draws run on regular schedules. Check back shortly or view past draw results below.
            </p>
            <button
              onClick={() => setActiveTab('results')}
              className="px-4 py-2 rounded-xl bg-amber-500 text-black font-bold text-xs cursor-pointer inline-flex items-center gap-1.5 shadow-md"
            >
              <Trophy className="w-3.5 h-3.5" />
              <span>View Past Results</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
            {activeEvents.map((evt, idx) => (
              <div 
                key={evt.id || idx}
                className="bg-[#111827] border border-[#1F2737] hover:border-amber-500/40 rounded-2xl p-5 space-y-4 shadow-lg transition-all flex flex-col justify-between"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold font-mono-numbers">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      <span>LIVE DRAW</span>
                    </span>

                    <span className="text-[11px] font-mono-numbers text-[#94A3B8]">
                      #{evt.id.slice(-6)}
                    </span>
                  </div>

                  <div>
                    <h3 className="font-display font-extrabold text-base text-white">
                      {evt.roomName || evt.title || `Lottery Room ${idx + 1}`}
                    </h3>
                    <p className="text-xs text-[#94A3B8] line-clamp-2 mt-1">
                      {evt.description || 'Pick your 4 digits (0000–9999). Exact match shares the USDT jackpot pool.'}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-[#1F2737] text-xs font-mono-numbers">
                    <div className="p-2 rounded-lg bg-[#0B0F19]">
                      <span className="text-[10px] text-[#94A3B8] block">Ticket Entry</span>
                      <strong className="text-white text-sm">{evt.ticketPrice || 10} USDT</strong>
                    </div>

                    <div className="p-2 rounded-lg bg-[#0B0F19]">
                      <span className="text-[10px] text-[#94A3B8] block">Prize Pool</span>
                      <strong className="text-amber-400 text-sm">
                        {evt.poolPrize ? `${evt.poolPrize} USDT` : 'Jackpot'}
                      </strong>
                    </div>
                  </div>
                </div>

                <div className="pt-2 flex gap-2">
                  <button
                    onClick={() => handleEnterRoom(evt.id)}
                    className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-extrabold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-md shadow-amber-500/20"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>Enter Room</span>
                  </button>
                  <button
                    onClick={() => handleBuyTicket(evt)}
                    className="px-3.5 py-2.5 rounded-xl bg-[#1F2737] hover:bg-[#273248] text-white font-bold text-xs flex items-center justify-center transition-colors cursor-pointer"
                    title="Quick Buy Ticket"
                  >
                    <Ticket className="w-4 h-4 text-amber-400" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 3. HOW FOUR-DIGIT LOTTERY WORKS (4 STEPS) */}
      <section id="how-it-works-section" className="space-y-4">
        <div className="text-left pb-2 border-b border-[#1F2737]">
          <h2 className="font-display font-extrabold text-lg sm:text-xl text-white flex items-center gap-2">
            <Zap className="w-5 h-5 text-amber-400" />
            <span>How Four-Digit Lottery Works</span>
          </h2>
          <p className="text-xs text-[#94A3B8]">
            Four straightforward steps from number selection to automated USDT payouts.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          
          <div className="bg-[#111827] border border-[#1F2737] rounded-2xl p-5 space-y-3 relative overflow-hidden">
            <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 font-display font-black text-base">
              1
            </div>
            <h3 className="font-display font-bold text-sm text-white">Select 4 Digits</h3>
            <p className="text-xs text-[#94A3B8] leading-relaxed">
              Pick your lucky 4-digit number from 0000 to 9999 using interactive dial rollers or the quick-pick numeric keypad.
            </p>
          </div>

          <div className="bg-[#111827] border border-[#1F2737] rounded-2xl p-5 space-y-3 relative overflow-hidden">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 font-display font-black text-base">
              2
            </div>
            <h3 className="font-display font-bold text-sm text-white">Single-Ticket Entry</h3>
            <p className="text-xs text-[#94A3B8] leading-relaxed">
              Every entry is priced clearly in USDT. Single-ticket purchase ensures fair, equal opportunity across every player.
            </p>
          </div>

          <div className="bg-[#111827] border border-[#1F2737] rounded-2xl p-5 space-y-3 relative overflow-hidden">
            <div className="w-10 h-10 rounded-xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-center text-purple-400 font-display font-black text-base">
              3
            </div>
            <h3 className="font-display font-bold text-sm text-white">Live Countdown</h3>
            <p className="text-xs text-[#94A3B8] leading-relaxed">
              Watch the live draw countdown timer. Ticket purchases close before the draw, locking the participant roster.
            </p>
          </div>

          <div className="bg-[#111827] border border-[#1F2737] rounded-2xl p-5 space-y-3 relative overflow-hidden">
            <div className="w-10 h-10 rounded-xl bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-blue-400 font-display font-black text-base">
              4
            </div>
            <h3 className="font-display font-bold text-sm text-white">Automated USDT Payout</h3>
            <p className="text-xs text-[#94A3B8] leading-relaxed">
              Winning numbers are drawn automatically. Winners receive their prize pool share directly to their wallet within 24 hours.
            </p>
          </div>

        </div>
      </section>

      {/* 4. RULES & TRANSPARENCY OVERVIEW */}
      <section className="bg-[#111827] border border-[#1F2737] rounded-2xl p-6 sm:p-8 space-y-5">
        <div className="flex items-center gap-2 pb-2 border-b border-[#1F2737]">
          <Award className="w-5 h-5 text-amber-400" />
          <h2 className="font-display font-extrabold text-base sm:text-lg text-white">
            Lottery Rules &amp; Prize Distribution
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs text-[#94A3B8]">
          <div className="space-y-3">
            <h3 className="font-bold text-white uppercase text-[11px] tracking-wider flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>Draw Mechanics &amp; Eligibility:</span>
            </h3>
            <ul className="space-y-2 list-none">
              <li className="flex items-start gap-2">
                <span className="text-amber-400 font-bold">•</span>
                <span><strong>4-Digit Exact Match:</strong> Winning combination consists of 4 numerical digits (0000 through 9999).</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-amber-400 font-bold">•</span>
                <span><strong>Jackpot Allocation:</strong> 100% of the allocated prize pool is distributed among winning ticket holders.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-amber-400 font-bold">•</span>
                <span><strong>Multiple Winners:</strong> If multiple tickets match the drawn numbers, the pool is split equally among winners.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-amber-400 font-bold">•</span>
                <span><strong>Roll-over / Guaranteed Minimum:</strong> Unclaimed prize pools roll over or follow room jackpot rules.</span>
              </li>
            </ul>
          </div>

          <div className="space-y-3">
            <h3 className="font-bold text-white uppercase text-[11px] tracking-wider flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
              <span>Platform Integrity &amp; Settlements:</span>
            </h3>
            <ul className="space-y-2 list-none">
              <li className="flex items-start gap-2">
                <span className="text-emerald-400 font-bold">•</span>
                <span><strong>No Bulk Scalping:</strong> Single-ticket action ensures every participant enjoys transparent access.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-emerald-400 font-bold">•</span>
                <span><strong>Cryptographic Auditing:</strong> Every draw outcome can be verified against its pre-committed server seed.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-emerald-400 font-bold">•</span>
                <span><strong>Direct TRC-20 Disbursal:</strong> Withdrawals are processed via standard USDT wallet transactions within 24 hours.</span>
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* 5. FREQUENTLY ASKED QUESTIONS */}
      <section className="space-y-4">
        <div className="pb-2 border-b border-[#1F2737]">
          <h2 className="font-display font-extrabold text-lg sm:text-xl text-white flex items-center gap-2">
            <HelpCircle className="w-5 h-5 text-amber-400" />
            <span>Frequently Asked Questions</span>
          </h2>
          <p className="text-xs text-[#94A3B8]">
            Everything you need to know about participating in Four-Digit Lottery on EarnFlow.in.
          </p>
        </div>

        <div className="space-y-2.5">
          {faqs.map((faq, idx) => {
            const isOpen = openFaqIndex === idx;
            return (
              <div
                key={idx}
                className="bg-[#111827] border border-[#1F2737] rounded-xl overflow-hidden transition-all"
              >
                <button
                  type="button"
                  onClick={() => setOpenFaqIndex(isOpen ? null : idx)}
                  className="w-full p-4 text-left flex items-center justify-between gap-3 text-xs sm:text-sm font-bold text-white hover:text-amber-400 transition-colors cursor-pointer"
                >
                  <span>{faq.q}</span>
                  <ChevronDown className={`w-4 h-4 text-[#94A3B8] shrink-0 transition-transform ${isOpen ? 'rotate-180 text-amber-400' : ''}`} />
                </button>

                {isOpen && (
                  <div className="px-4 pb-4 text-xs text-[#94A3B8] leading-relaxed border-t border-[#1F2737]/60 pt-3">
                    {faq.a}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* 6. RESPONSIBLE GAMING & CUSTOMER SUPPORT BANNER */}
      <section className="rounded-2xl bg-gradient-to-r from-[#111827] via-[#151D2F] to-[#111827] border border-amber-500/20 p-5 sm:p-7 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        <div className="space-y-1.5 max-w-xl">
          <span className="text-[10px] font-mono-numbers px-2 py-0.5 rounded bg-amber-500/15 text-amber-400 border border-amber-500/30 font-bold uppercase tracking-wider">
            Responsible Gaming
          </span>
          <h3 className="font-display font-extrabold text-base text-white">
            Play Responsibly &amp; Stay in Control
          </h3>
          <p className="text-xs text-[#94A3B8] leading-relaxed">
            Lottery participation should always be for entertainment. Set personal limits, participate within your means, and seek support if needed. EarnFlow.in is strictly for adults aged 18 and older.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setActiveTab('support')}
            className="px-4 py-2.5 rounded-xl bg-[#1F2737] hover:bg-[#273248] text-white font-bold text-xs transition-colors cursor-pointer"
          >
            Customer Support
          </button>
          <button
            onClick={() => setActiveTab('terms')}
            className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-extrabold text-xs transition-colors cursor-pointer shadow-md"
          >
            Terms &amp; Rules
          </button>
        </div>
      </section>

    </div>
  );
}
