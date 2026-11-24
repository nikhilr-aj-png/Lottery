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
  Clock,
  CheckCircle2,
  HelpCircle,
  ChevronDown,
  Layers,
  Award,
  Wallet,
  Zap,
  Users,
  Flame,
  Check
} from 'lucide-react';
import LotteryCard from './LotteryCard';

interface CasinoLobbyProps {
  onLaunchGame?: (gameIdOrEventId: string) => void;
  onOpenLotteryRules?: () => void;
  onShowResult?: (event: any) => void;
}

export default function CasinoLobby({ onLaunchGame, onOpenLotteryRules, onShowResult }: CasinoLobbyProps) {
  const { events, setSelectedEventForModal, setActiveTab, platformSettings } = useLottery();
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null);

  // Results Retention Setting from Admin Panel (Default: 1 hour)
  const retentionHours = useMemo(() => {
    return Number(platformSettings?.resultsRetention?.retention_duration_hours || 1.0);
  }, [platformSettings?.resultsRetention]);

  // 1. Available Pool: Active and scheduled events (LIVE event first)
  const availableEvents = useMemo(() => {
    const list = (events || []).filter(e => {
      if (e.status === 'deleted' || e.is_deleted) return false;
      if (e.status === 'completed' || Boolean(e.winningDigits)) return false;
      return true;
    });

    // Sort so currently active/LIVE event appears first
    return list.sort((a, b) => {
      if (a.status === 'active' && b.status !== 'active') return -1;
      if (b.status === 'active' && a.status !== 'active') return 1;
      return (a.drawTime || 0) - (b.drawTime || 0);
    });
  }, [events]);

  // Primary Live Event for Hero CTA
  const primaryLiveEvent = useMemo(() => {
    return availableEvents.find(e => e.status === 'active') || availableEvents[0] || (events || [])[0] || null;
  }, [availableEvents, events]);

  // 2. Results: Ended events within retention window
  const resultsEvents = useMemo(() => {
    const now = Date.now();
    const retentionMs = retentionHours * 3600 * 1000;

    return (events || []).filter(e => {
      if (e.status === 'deleted' || e.is_deleted) return false;
      const isConcluded = e.status === 'completed' || Boolean(e.winningDigits) || (e.drawTime && e.drawTime <= now);
      if (!isConcluded) return false;

      // Filter by retention duration (default 1 hour)
      if (e.drawTime && (now - e.drawTime) > retentionMs) {
        return false;
      }
      return true;
    }).sort((a, b) => (b.drawTime || 0) - (a.drawTime || 0));
  }, [events, retentionHours]);

  // Single-action Direct Room Entry (Fixes duplicate enter room flow)
  const handleDirectEnterRoom = (eventOrId?: any) => {
    const targetId = typeof eventOrId === 'string' 
      ? eventOrId 
      : (eventOrId?.id || primaryLiveEvent?.id || 'lottery');

    if (onLaunchGame) {
      onLaunchGame(targetId);
    }
  };

  const handleShowResultAction = (evt: any) => {
    if (onShowResult) {
      onShowResult(evt);
    } else {
      setSelectedEventForModal(evt);
    }
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
    <div className="space-y-7 sm:space-y-9 pb-6 text-left">
      
      {/* 1. HERO SECTION: RESTORED ORIGINAL FOUR DIGIT LUCKY LOTTERY LOGO & BRANDING */}
      <section className="relative overflow-hidden rounded-2xl sm:rounded-3xl bg-gradient-to-br from-[#121624] via-[#0E131F] to-[#1C1335] border border-amber-500/35 p-4 xs:p-5 sm:p-8 lg:p-10 shadow-2xl">
        <div className="absolute top-0 right-0 w-80 sm:w-96 h-80 sm:h-96 bg-gradient-to-b from-amber-500/15 via-purple-600/10 to-transparent rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-60 sm:w-72 h-60 sm:h-72 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-6 lg:gap-8">
          
          {/* Left Column: Restored Logo, Branding Copy & Direct Entry */}
          <div className="flex-1 space-y-4 max-w-2xl min-w-0">
            
            {/* Platform Identification Header with EarnFlow Logo */}
            <div className="flex items-center gap-2 xs:gap-2.5">
              <div className="w-7 h-7 xs:w-8 xs:h-8 rounded-full p-0.5 bg-[#0B0F19] border border-amber-400/50 shadow-[0_0_12px_rgba(245,196,81,0.3)] shrink-0 flex items-center justify-center">
                <img 
                  src="/logo.png" 
                  alt="EarnFlow.in" 
                  className="w-full h-full rounded-full object-cover" 
                />
              </div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 font-mono-numbers text-[10px] xs:text-[11px] font-bold">
                <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span>EarnFlow.in · Official Four Digit Lucky Lottery</span>
              </div>
            </div>

            {/* Official Four Digit Lottery Logo & Title Showcase */}
            <div className="flex flex-col xs:flex-row items-start xs:items-center gap-3.5 sm:gap-5 pt-1">
              
              {/* Four Digit Lottery Logo Image Asset */}
              <div className="relative group shrink-0">
                <div className="w-18 h-18 xs:w-20 xs:h-20 sm:w-24 sm:h-24 rounded-2xl bg-[#090D16] border-2 border-amber-400/80 shadow-[0_0_25px_rgba(245,196,81,0.35)] overflow-hidden flex items-center justify-center transition-transform group-hover:scale-105 duration-300">
                  <img 
                    src="/items/Four Digit Lottery.jpg" 
                    alt="Four Digit Lucky Lottery" 
                    className="w-full h-full object-cover rounded-xl"
                  />
                </div>
                <span className="absolute -bottom-2 -right-1.5 px-1.5 py-0.2 rounded bg-amber-500 text-black font-mono-numbers text-[9px] font-black uppercase tracking-wider shadow-md">
                  OFFICIAL
                </span>
              </div>

              {/* Title & Headline */}
              <div className="min-w-0 flex-1">
                <h1 
                  className="font-display font-black text-white tracking-tight leading-[1.12]"
                  style={{ fontSize: 'clamp(1.45rem, 3.2vw + 0.5rem, 2.75rem)' }}
                >
                  Four Digit <span className="text-amber-400">Lucky Lottery</span>
                </h1>
                <p className="text-xs xs:text-sm font-semibold text-[#CBD5E1] mt-1">
                  Online 4-Digit Lucky Draw with <span className="text-emerald-400 font-mono-numbers">USDT Settlements</span>
                </p>
              </div>
            </div>

            {/* Description Copy */}
            <p className="text-xs sm:text-sm text-[#CBD5E1] leading-relaxed max-w-xl">
              Pick your lucky 4-digit number between <strong>0000 and 9999</strong> to enter transparent jackpot pools. Live countdown timers, automated oracle draws, and instant 24-hour USDT payouts.
            </p>

            {/* Direct 1-Click Action Buttons */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => handleDirectEnterRoom(primaryLiveEvent?.id)}
                className="px-6 py-3.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg shadow-amber-500/25 transition-all cursor-pointer active:scale-98"
              >
                <Play className="w-4 h-4 fill-current shrink-0" />
                <span>Enter Live Draw Room</span>
                <ArrowRight className="w-4 h-4 ml-1" />
              </button>

              <button
                type="button"
                onClick={() => {
                  const el = document.getElementById('how-it-works-section');
                  if (el) el.scrollIntoView({ behavior: 'smooth' });
                }}
                className="px-5 py-3.5 rounded-xl bg-[#111827] hover:bg-[#151C2B] text-white border border-[#272A31] hover:border-amber-500/40 font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                <span>How It Works</span>
              </button>
            </div>
          </div>

          {/* Right Column: Platform Metrics & Live Status Card */}
          <div className="flex flex-col gap-3 w-full sm:w-80 shrink-0 bg-[#0B0F19]/90 border border-amber-500/25 rounded-2xl p-4 sm:p-5 shadow-xl backdrop-blur-md">
            
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

            <div className="p-3 rounded-xl bg-[#111827] border border-[#1F2737] space-y-1.5">
              <div className="flex items-center justify-between text-xs font-bold">
                <span className="text-[#94A3B8]">Game Math Model</span>
                <span className="text-amber-400 font-mono-numbers">95.0% RTP</span>
              </div>
              <div className="flex items-center justify-between text-xs font-bold pt-1.5 border-t border-[#1F2737]">
                <span className="text-[#94A3B8]">Number Range</span>
                <span className="text-white font-mono-numbers">0000 – 9999</span>
              </div>
              <div className="flex items-center justify-between text-xs font-bold pt-1.5 border-t border-[#1F2737]">
                <span className="text-[#94A3B8]">Settlement Speed</span>
                <span className="text-emerald-400 font-mono-numbers">Instant Wallet</span>
              </div>
            </div>

            {/* Single Ticket Rule Highlight */}
            <div className="p-3 rounded-xl bg-gradient-to-r from-amber-500/10 via-purple-500/10 to-amber-500/10 border border-amber-500/30 flex items-center gap-2.5">
              <ShieldCheck className="w-5 h-5 text-amber-400 shrink-0" />
              <div className="text-[11px] leading-snug">
                <strong className="text-white block font-bold">Fair Play Rule:</strong>
                <span className="text-[#94A3B8]">Single-ticket purchase ensures equal opportunity for all participants.</span>
              </div>
            </div>

          </div>

        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* 2. AVAILABLE POOL: ACTIVE & UPCOMING EVENTS (LIVE EVENT FIRST)     */}
      {/* ------------------------------------------------------------------ */}
      <section className="space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pb-2 border-b border-[#1F2737]">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
              <h2 className="font-display font-extrabold text-lg sm:text-xl text-white">
                Available Pool
              </h2>
            </div>
            <p className="text-xs text-[#94A3B8] mt-0.5">
              Eligible active and upcoming Four Digit Lottery rooms. Select any pool to enter the live workstation.
            </p>
          </div>

          <span className="text-[11px] font-mono-numbers px-3 py-1 rounded-lg bg-[#141924] text-amber-300 border border-amber-500/30 font-bold shrink-0">
            {availableEvents.length} Active {availableEvents.length === 1 ? 'Pool' : 'Pools'}
          </span>
        </div>

        {availableEvents.length === 0 ? (
          <div className="p-8 rounded-2xl bg-[#111827] border border-[#1F2737] text-center space-y-3">
            <Ticket className="w-10 h-10 text-amber-400/60 mx-auto" />
            <h3 className="font-display font-bold text-white text-base">New Draws Coming Soon</h3>
            <p className="text-xs text-[#94A3B8] max-w-md mx-auto">
              Our automated lottery engine publishes new pools regularly. Check back shortly or view past winning numbers in Draw Results.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
            {availableEvents.map((evt, idx) => (
              <LotteryCard
                key={evt.id}
                event={evt}
                mode="available"
                isLive={idx === 0 && evt.status === 'active'}
                onEnterRoom={() => handleDirectEnterRoom(evt.id)}
                onSelect={() => handleDirectEnterRoom(evt.id)}
              />
            ))}
          </div>
        )}
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* 3. RESULTS: CONCLUDED DRAWS WITHIN CONFIGURABLE RETENTION PERIOD   */}
      {/* ------------------------------------------------------------------ */}
      {resultsEvents.length > 0 && (
        <section className="space-y-4 pt-2">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pb-2 border-b border-[#1F2737]">
            <div>
              <div className="flex items-center gap-2">
                <Trophy className="w-5 h-5 text-amber-400 shrink-0" />
                <h2 className="font-display font-extrabold text-lg sm:text-xl text-white">
                  Draw Results &amp; Concluded Pools
                </h2>
              </div>
              <p className="text-xs text-[#94A3B8] mt-0.5">
                Official winning 4-digit combinations from recent draws (Retained for {retentionHours >= 1 ? `${retentionHours} hour${retentionHours > 1 ? 's' : ''}` : `${Math.round(retentionHours * 60)} minutes`}).
              </p>
            </div>

            <button
              onClick={() => setActiveTab('results')}
              className="text-xs text-amber-400 hover:text-amber-300 font-bold flex items-center gap-1 cursor-pointer transition-colors"
            >
              <span>View All Past Results</span>
              <ChevronDown className="w-3.5 h-3.5 -rotate-90" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
            {resultsEvents.map((evt) => (
              <LotteryCard
                key={evt.id}
                event={evt}
                mode="result"
                onShowResult={() => handleShowResultAction(evt)}
                onSelect={() => handleShowResultAction(evt)}
              />
            ))}
          </div>
        </section>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* 4. HOW IT WORKS                                                    */}
      {/* ------------------------------------------------------------------ */}
      <section id="how-it-works-section" className="space-y-4 pt-2">
        <div className="pb-2 border-b border-[#1F2737]">
          <h2 className="font-display font-extrabold text-lg sm:text-xl text-white flex items-center gap-2">
            <Zap className="w-5 h-5 text-amber-400" />
            <span>How Four-Digit Lottery Works</span>
          </h2>
          <p className="text-xs text-[#94A3B8]">
            Three simple steps from number selection to automated jackpot settlements.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 sm:gap-4">
          <div className="p-4 sm:p-5 rounded-2xl bg-[#111827] border border-[#1F2737] space-y-2">
            <div className="w-8 h-8 rounded-xl bg-amber-500/15 text-amber-400 flex items-center justify-center font-mono-numbers font-black text-sm">
              1
            </div>
            <h3 className="font-display font-bold text-sm text-white">Select Your 4 Digits</h3>
            <p className="text-xs text-[#94A3B8] leading-relaxed">
              Pick your lucky 4-digit number from 0000 to 9999 using interactive dial rollers or the quick-pick numeric keypad.
            </p>
          </div>

          <div className="p-4 sm:p-5 rounded-2xl bg-[#111827] border border-[#1F2737] space-y-2">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center font-mono-numbers font-black text-sm">
              2
            </div>
            <h3 className="font-display font-bold text-sm text-white">Enter The Live Pool</h3>
            <p className="text-xs text-[#94A3B8] leading-relaxed">
              Confirm your single-ticket purchase using USDT. Your ticket is registered immutably on the platform database ledger.
            </p>
          </div>

          <div className="p-4 sm:p-5 rounded-2xl bg-[#111827] border border-[#1F2737] space-y-2">
            <div className="w-8 h-8 rounded-xl bg-purple-500/15 text-purple-400 flex items-center justify-center font-mono-numbers font-black text-sm">
              3
            </div>
            <h3 className="font-display font-bold text-sm text-white">Instant Automated Payouts</h3>
            <p className="text-xs text-[#94A3B8] leading-relaxed">
              When the live countdown ends, winning numbers are determined transparently. Winnings credit automatically to your platform wallet.
            </p>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* 5. RULES & FAIR PLAY                                               */}
      {/* ------------------------------------------------------------------ */}
      <section className="rounded-2xl bg-[#111827] border border-[#1F2737] p-5 sm:p-7 space-y-4">
        <div className="flex items-center gap-2 pb-2 border-b border-[#1F2737]">
          <Award className="w-5 h-5 text-amber-400" />
          <h2 className="font-display font-extrabold text-base sm:text-lg text-white">
            Rules, Payouts &amp; Platform Transparency
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-xs text-[#94A3B8] leading-relaxed">
          <div className="space-y-3">
            <h3 className="font-bold text-white uppercase text-[11px] tracking-wider flex items-center gap-1.5">
              <Ticket className="w-3.5 h-3.5 text-amber-400" />
              <span>Matching &amp; Prize Distribution:</span>
            </h3>
            <ul className="space-y-2 list-none">
              <li className="flex items-start gap-2">
                <span className="text-amber-400 font-bold">•</span>
                <span><strong>Exact Match (All 4 Digits):</strong> Wins the primary jackpot pool. If multiple participants hold the winning code, the pot is split equally.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-amber-400 font-bold">•</span>
                <span><strong>Fixed vs Range Pools:</strong> Fixed pools guarantee a set prize, while range pools scale dynamically with ticket participation.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-amber-400 font-bold">•</span>
                <span><strong>Transparent Oracle:</strong> Winning digits are generated via cryptographic pseudo-random number seeds finalized upon draw closing.</span>
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
                <span><strong>Single-Ticket Entry:</strong> Equal access for all participants without automated bots or bulk scalping.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-emerald-400 font-bold">•</span>
                <span><strong>Immutable Ledger:</strong> Every purchase, draw result, and payout is recorded permanently in the financial audit ledger.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-emerald-400 font-bold">•</span>
                <span><strong>Direct TRC-20 Withdrawals:</strong> Withdraw your wallet winnings in standard USDT within 24 hours.</span>
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* 6. FREQUENTLY ASKED QUESTIONS                                      */}
      {/* ------------------------------------------------------------------ */}
      <section className="space-y-4">
        <div className="pb-2 border-b border-[#1F2737]">
          <h2 className="font-display font-extrabold text-lg sm:text-xl text-white flex items-center gap-2">
            <HelpCircle className="w-5 h-5 text-amber-400" />
            <span>Frequently Asked Questions</span>
          </h2>
          <p className="text-xs text-[#94A3B8]">
            Common questions regarding Four-Digit Lottery participation on EarnFlow.in.
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

      {/* ------------------------------------------------------------------ */}
      {/* 7. RESPONSIBLE GAMING & SUPPORT BANNER                             */}
      {/* ------------------------------------------------------------------ */}
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
