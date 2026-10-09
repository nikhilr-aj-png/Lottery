import React, { useState, useEffect, useMemo } from 'react';
import { useLottery } from '../context/LotteryContext';
import { 
  Sparkles, 
  ShieldCheck, 
  Clock, 
  Flame, 
  Trophy, 
  Users, 
  Ticket, 
  ChevronRight, 
  Activity,
  ArrowRight
} from 'lucide-react';

export default function HeroBanner({ onPlayNowClick, onRulesClick, onShowResultClick }) {
  const { events, getSoldTicketsForEvent, user, profile } = useLottery();
  
  // Find top trending active lottery (highest prize or first active event)
  const grandEvent = useMemo(() => {
    const active = events.filter(e => e.status === 'active');
    if (active.length === 0) return events[0];
    return [...active].sort((a, b) => (b.poolPrize || 0) - (a.poolPrize || 0))[0];
  }, [events]);

  // Live countdown timer state
  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });
  const [isTimedOut, setIsTimedOut] = useState(false);

  useEffect(() => {
    const updateClock = () => {
      if (!grandEvent) return;
      const diff = (grandEvent.drawTime || 0) - Date.now();
      if (diff <= 0 || grandEvent.status === 'completed') {
        setIsTimedOut(true);
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0 });
      } else {
        setIsTimedOut(false);
        const d = Math.floor(diff / (1000 * 60 * 60 * 24));
        const h = Math.floor((diff / (1000 * 60 * 60)) % 24);
        const m = Math.floor((diff / (1000 * 60)) % 60);
        const s = Math.floor((diff / 1000) % 60);
        setTimeLeft({ days: d, hours: h, minutes: m, seconds: s });
      }
    };

    updateClock();
    const interval = setInterval(updateClock, 1000);
    return () => clearInterval(interval);
  }, [grandEvent]);

  // Real & realistic tickets sold feed for the featured lottery
  const ticketsFeed = useMemo(() => {
    if (!grandEvent) return [];
    const real = getSoldTicketsForEvent ? getSoldTicketsForEvent(grandEvent.id) : [];

    // Realistic seeded buyers list to match ticketsSold counter
    const seedBuyers = [
      { num: '7429', user: '@LuckyWinner77', amount: 1, time: '2m ago' },
      { num: '1084', user: '@crypto_king', amount: 2, time: '5m ago' },
      { num: '5521', user: '@satoshi_vip', amount: 1, time: '9m ago' },
      { num: '9102', user: '@priya_invest', amount: 3, time: '14m ago' },
      { num: '3341', user: '@rahul_trc20', amount: 1, time: '21m ago' },
      { num: '6782', user: '@trader_dan', amount: 2, time: '35m ago' },
      { num: '4419', user: '@golden_tiger', amount: 1, time: '48m ago' },
      { num: '8820', user: '@blockchain_guru', amount: 1, time: '1h ago' }
    ];

    const formattedReal = real.map((t, idx) => {
      const isMine = user && (t.username === `@${profile?.username}` || t.userAddress);
      return {
        id: t.id || `real-${idx}`,
        num: String(t.ticketNumber).padStart(4, '0'),
        user: t.username || (isMine ? `@${profile?.username || 'You'}` : '@VIP_Player'),
        amount: 1,
        time: 'Just now',
        isUser: Boolean(isMine)
      };
    });

    const combined = [
      ...formattedReal,
      ...seedBuyers.map((s, idx) => ({
        id: `seed-${idx}`,
        num: s.num,
        user: s.user,
        amount: s.amount,
        time: s.time,
        isUser: false
      }))
    ];

    // Dedup by ticket number for clean presentation
    const seen = new Set();
    return combined.filter(item => {
      if (seen.has(item.num)) return false;
      seen.add(item.num);
      return true;
    });
  }, [grandEvent, getSoldTicketsForEvent, user, profile]);

  if (!grandEvent) return null;

  const winnerCount = grandEvent.winnerCount || 1;

  return (
    <div className="relative overflow-hidden pt-4 pb-8">
      {/* Background Ambient Glows */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[360px] bg-gradient-to-r from-amber-500/10 via-[#00f2fe]/5 to-emerald-500/10 blur-[130px] pointer-events-none rounded-full" />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        
        {/* Top Badges Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
          <div className="flex items-center gap-2">
            <div className="badge-gold px-3 py-1 rounded-full text-[11px] font-bold flex items-center gap-1.5 uppercase tracking-wider">
              <Flame className="w-3.5 h-3.5 text-[#f5c451]" />
              {grandEvent.badge || 'FEATURED JACKPOT'}
            </div>
            <div className="badge-provably-fair px-3 py-1 rounded-full text-[11px] font-bold flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-[#05d5aa]" />
              SHA-256 PROVABLY FAIR
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs font-mono-numbers">
            <span className="text-[#9b8f7c]">Round ID:</span>
            <span className="text-white font-bold bg-[#141924] px-2 py-0.5 rounded border border-[#272a31]">
              #{grandEvent.id.replace('evt-', '').toUpperCase()}
            </span>
          </div>
        </div>

        {/* CLASSIC 2-HALF SPLIT CONTAINER */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
          
          {/* LEFT HALF: Trending / Active Lottery (Prize, Timer, Action) */}
          <div className="lg:col-span-7 glass-panel rounded-2xl p-6 sm:p-7 border border-amber-500/30 flex flex-col justify-between relative overflow-hidden shadow-[0_0_40px_rgba(245,196,81,0.12)]">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-[#ffd700] to-transparent" />

            <div>
              {/* Status and Title */}
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className="text-[11px] font-mono-numbers text-amber-400 font-extrabold tracking-wider uppercase flex items-center gap-1.5">
                  <span className={`w-2 h-2 rounded-full ${isTimedOut ? 'bg-red-400' : 'bg-[#05d5aa] animate-ping'}`} />
                  {isTimedOut ? 'DRAW CLOSED · TIME EXPIRED' : 'TRENDING ACTIVE LOTTERY'}
                </span>

                <span className="text-[10px] text-[#05d5aa] font-semibold bg-[#05d5aa]/10 px-2.5 py-0.5 rounded-full border border-[#05d5aa]/20">
                  {winnerCount > 1 ? `${winnerCount} Lucky Winners` : 'Lucky Winner Pot'}
                </span>
              </div>

              <h2 className="font-display font-extrabold text-2xl sm:text-3xl text-white tracking-tight mb-4">
                {grandEvent.title}
              </h2>

              {/* Prize Highlight Box */}
              <div className="p-4 rounded-xl bg-[#07090e]/80 border border-[#272a31] mb-5">
                <div className="flex items-center justify-between text-xs text-[#9b8f7c] mb-1">
                  <span className="uppercase font-bold tracking-wider text-amber-400">
                    {grandEvent.minPrize && grandEvent.maxPrize ? 'GUARANTEED PRIZE RANGE' : 'WIN UP TO GRAND JACKPOT'}
                  </span>
                  <span className="text-[10px] font-mono-numbers text-emerald-400">
                    100% USDT Settlement
                  </span>
                </div>

                <div className="flex items-baseline gap-2">
                  <span className="text-gold-gradient font-display font-black text-3xl sm:text-5xl tracking-tight">
                    {grandEvent.minPrize && grandEvent.maxPrize
                      ? `${grandEvent.minPrize} – ${grandEvent.maxPrize}`
                      : grandEvent.poolPrize.toLocaleString()}
                  </span>
                  <span className="font-display font-black text-xl sm:text-2xl text-[#05d5aa]">
                    USDT
                  </span>
                </div>

                <p className="text-[11px] text-[#9b8f7c] mt-2 leading-relaxed">
                  {winnerCount > 1 
                    ? `Prize pool is shared equally among ${winnerCount} lucky winners selected by provably fair luck. Winnings go directly to your USDT wallet.`
                    : 'Lucky ticket combination wins the jackpot pool! Provably fair draw with guaranteed 24-hour USDT withdrawals.'}
                </p>
              </div>

              {/* Quick Metrics */}
              <div className="grid grid-cols-3 gap-3 mb-5 text-xs">
                <div className="bg-[#10131a] p-2.5 rounded-xl border border-[#272a31]">
                  <span className="text-[#9b8f7c] block mb-0.5 flex items-center gap-1 text-[11px]">
                    <Ticket className="w-3 h-3 text-[#f5c451]" />
                    Entry Price
                  </span>
                  <span className="font-mono-numbers font-bold text-white text-sm">
                    {grandEvent.ticketPrice} USDT
                  </span>
                </div>

                <div className="bg-[#10131a] p-2.5 rounded-xl border border-[#272a31]">
                  <span className="text-[#9b8f7c] block mb-0.5 flex items-center gap-1 text-[11px]">
                    <Users className="w-3 h-3 text-[#00f2fe]" />
                    Tickets Sold
                  </span>
                  <span className="font-mono-numbers font-bold text-white text-sm">
                    {grandEvent.ticketsSold.toLocaleString()}
                  </span>
                </div>

                <div className="bg-[#10131a] p-2.5 rounded-xl border border-[#272a31]">
                  <span className="text-[#9b8f7c] block mb-0.5 flex items-center gap-1 text-[11px]">
                    <Trophy className="w-3 h-3 text-[#05d5aa]" />
                    Winners Count
                  </span>
                  <span className="font-mono-numbers font-bold text-white text-sm">
                    {winnerCount} {winnerCount > 1 ? 'Winners' : 'Winner'}
                  </span>
                </div>
              </div>

              {/* Countdown Clock */}
              <div className="p-3.5 rounded-xl bg-[#0d1117] border border-[#272a31] mb-5">
                <div className="flex items-center justify-between mb-2 text-xs">
                  <span className="text-[#9b8f7c] flex items-center gap-1.5 font-medium">
                    <Clock className="w-3.5 h-3.5 text-[#00f2fe]" />
                    {isTimedOut ? 'Draw Time Expired:' : 'Scheduled Draw Countdown:'}
                  </span>
                  <span className={`text-[10px] font-bold uppercase font-mono-numbers ${isTimedOut ? 'text-red-400' : 'text-emerald-400'}`}>
                    {isTimedOut ? 'Closed for Entries' : 'Tickets Active'}
                  </span>
                </div>

                <div className="grid grid-cols-4 gap-2 text-center">
                  <div className="bg-[#07090e] border border-[#272a31] rounded-lg p-2">
                    <div className="font-mono-numbers font-black text-lg text-white">
                      {String(timeLeft.days).padStart(2, '0')}
                    </div>
                    <div className="text-[9px] text-[#9b8f7c] uppercase font-bold">Days</div>
                  </div>
                  <div className="bg-[#07090e] border border-[#272a31] rounded-lg p-2">
                    <div className="font-mono-numbers font-black text-lg text-white">
                      {String(timeLeft.hours).padStart(2, '0')}
                    </div>
                    <div className="text-[9px] text-[#9b8f7c] uppercase font-bold">Hours</div>
                  </div>
                  <div className="bg-[#07090e] border border-[#272a31] rounded-lg p-2">
                    <div className="font-mono-numbers font-black text-lg text-white">
                      {String(timeLeft.minutes).padStart(2, '0')}
                    </div>
                    <div className="text-[9px] text-[#9b8f7c] uppercase font-bold">Mins</div>
                  </div>
                  <div className="bg-[#07090e] border border-[#272a31] rounded-lg p-2">
                    <div className={`font-mono-numbers font-black text-lg ${isTimedOut ? 'text-slate-500' : 'text-[#ffd700]'}`}>
                      {String(timeLeft.seconds).padStart(2, '0')}
                    </div>
                    <div className="text-[9px] text-[#9b8f7c] uppercase font-bold">Secs</div>
                  </div>
                </div>
              </div>
            </div>

            {/* CTAs: Strictly changes to "Show Result" when timed out */}
            <div className="pt-2">
              {isTimedOut ? (
                <button
                  onClick={() => onShowResultClick ? onShowResultClick(grandEvent) : onPlayNowClick(grandEvent)}
                  className="w-full py-3.5 rounded-xl bg-gradient-to-r from-amber-500 via-amber-400 to-[#05d5aa] text-black font-extrabold text-sm flex items-center justify-center gap-2 cursor-pointer shadow-lg hover:brightness-110 transition-all"
                >
                  <Trophy className="w-5 h-5 text-black" />
                  <span>Show Result · View Draw Proof</span>
                  <ArrowRight className="w-4 h-4 ml-1" />
                </button>
              ) : (
                <div className="flex flex-col sm:flex-row items-center gap-3">
                  <button
                    onClick={() => onPlayNowClick(grandEvent)}
                    className="btn-gold flex-1 w-full py-3.5 rounded-xl text-sm font-extrabold flex items-center justify-center gap-2 cursor-pointer shadow-lg"
                  >
                    <Sparkles className="w-4 h-4" />
                    <span>Buy Lucky Ticket ({grandEvent.ticketPrice} USDT)</span>
                    <ArrowRight className="w-4 h-4 ml-1" />
                  </button>

                  <button
                    onClick={onRulesClick}
                    className="btn-ghost-gold w-full sm:w-auto px-5 py-3.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
                  >
                    <span>Draw Rules</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>

          </div>

          {/* RIGHT HALF: Live Tickets Sold & Buyers Feed */}
          <div className="lg:col-span-5 glass-panel rounded-2xl p-6 border border-[#272a31] flex flex-col justify-between shadow-lg">
            
            {/* Header */}
            <div>
              <div className="flex items-center justify-between pb-3 mb-3 border-b border-[#272a31]">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                  <h3 className="font-display font-bold text-base text-white flex items-center gap-1.5">
                    <Activity className="w-4 h-4 text-emerald-400" />
                    <span>Tickets Sold Feed</span>
                  </h3>
                </div>
                
                <span className="text-[10px] font-mono-numbers px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold">
                  {grandEvent.ticketsSold} SOLD
                </span>
              </div>

              <div className="flex items-center justify-between text-xs text-[#9b8f7c] mb-3 px-1">
                <span>Recent Buyers in This Pool</span>
                <span className="font-mono-numbers text-white font-medium">
                  Pool: {(grandEvent.ticketsSold * grandEvent.ticketPrice).toLocaleString()} USDT
                </span>
              </div>

              {/* Scrollable Feed List */}
              <div className="space-y-2.5 max-h-[360px] overflow-y-auto pr-1">
                {ticketsFeed.length === 0 ? (
                  <div className="py-12 text-center text-xs text-[#9b8f7c]">
                    No tickets purchased yet for this pool. Be the first to enter!
                  </div>
                ) : (
                  ticketsFeed.map((item) => (
                    <div 
                      key={item.id}
                      className={`p-2.5 rounded-xl border flex items-center justify-between transition-all ${
                        item.isUser 
                          ? 'bg-amber-500/10 border-amber-500/40 shadow-sm' 
                          : 'bg-[#10131a] border-[#272a31]/80 hover:border-[#32353c]'
                      }`}
                    >
                      {/* Ticket Number & Buyer User */}
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="font-mono-numbers font-black text-xs text-amber-300 bg-black/60 px-2.5 py-1 rounded-lg border border-amber-500/30 shrink-0">
                          #{item.num}
                        </span>
                        
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs text-white font-semibold truncate">
                              {item.user}
                            </span>
                            {item.isUser && (
                              <span className="text-[9px] bg-amber-500 text-black px-1.5 py-0.2 rounded font-extrabold uppercase">
                                YOU
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] text-[#9b8f7c]">
                            {item.amount} {item.amount > 1 ? 'Tickets' : 'Ticket'} · {grandEvent.ticketPrice * item.amount} USDT
                          </span>
                        </div>
                      </div>

                      {/* Time pill */}
                      <span className="text-[10px] font-mono-numbers text-[#9b8f7c] shrink-0 ml-2">
                        {item.time}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Bottom info note */}
            <div className="mt-4 pt-3 border-t border-[#272a31] flex items-center justify-between text-[11px] text-[#9b8f7c]">
              <span className="flex items-center gap-1 text-emerald-400 font-medium">
                <CheckCircle2Icon className="w-3 h-3 text-emerald-400 shrink-0" />
                All combinations registered
              </span>
              <span className="font-mono-numbers text-amber-400/90 text-[10px]">
                {winnerCount > 1 ? `${winnerCount} Lucky Winners` : 'Single Pot Draw'}
              </span>
            </div>

          </div>

        </div>

      </div>
    </div>
  );
}

function CheckCircle2Icon(props) {
  return (
    <svg 
      {...props} 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10"/>
      <path d="m9 12 2 2 4-4"/>
    </svg>
  );
}
