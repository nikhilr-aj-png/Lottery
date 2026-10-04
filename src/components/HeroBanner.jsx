import React, { useState, useEffect } from 'react';
import { useLottery } from '../context/LotteryContext';
import { Sparkles, Shield, Clock, Flame, ChevronRight } from 'lucide-react';

export default function HeroBanner({ onPlayNowClick, onRulesClick }) {
  const { events } = useLottery();
  
  // Find grand jackpot event
  const grandEvent = events.find(e => e.status === 'active') || events[0];

  // Live countdown timer state
  const [timeLeft, setTimeLeft] = useState({ days: 4, hours: 14, minutes: 32, seconds: 18 });

  useEffect(() => {
    const updateClock = () => {
      if (!grandEvent) return;
      const diff = Math.max(0, grandEvent.drawTime - Date.now());
      const d = Math.floor(diff / (1000 * 60 * 60 * 24));
      const h = Math.floor((diff / (1000 * 60 * 60)) % 24);
      const m = Math.floor((diff / (1000 * 60)) % 60);
      const s = Math.floor((diff / 1000) % 60);
      setTimeLeft({ days: d, hours: h, minutes: m, seconds: s });
    };

    updateClock();
    const interval = setInterval(updateClock, 1000);
    return () => clearInterval(interval);
  }, [grandEvent]);

  return (
    <div className="relative overflow-hidden pt-8 pb-12">
      {/* Background Ambient Glows */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[350px] bg-gradient-to-r from-[#ffd700]/10 via-[#00f2fe]/5 to-[#05d5aa]/10 blur-[120px] pointer-events-none rounded-full" />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        
        {/* Top Cryptographic Tag */}
        <div className="flex flex-wrap items-center justify-center gap-3 mb-6">
          <div className="badge-provably-fair px-3.5 py-1.5 rounded-full text-xs font-semibold flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#05d5aa] animate-ping" />
            <Shield className="w-3.5 h-3.5" />
            PROVABLY FAIR · SHA-256 CRYPTOGRAPHIC VRF
          </div>
          <div className="badge-gold px-3.5 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5">
            <Flame className="w-3.5 h-3.5 text-[#f5c451]" />
            100% USDT ON-CHAIN SETTLEMENT
          </div>
        </div>

        {/* Hero Title & Grand Jackpot Value */}
        <div className="text-center max-w-4xl mx-auto">
          <h1 className="font-display font-extrabold text-3xl sm:text-5xl lg:text-6xl text-white tracking-tight leading-tight mb-4">
            Next Generation <span className="text-gold-gradient">Crypto Lottery</span>
          </h1>
          <p className="text-sm sm:text-base text-[#d2c5b0] max-w-2xl mx-auto mb-8 font-normal">
            Choose your lucky 4-digit numbers, enter high-stakes USDT pools, and win the entire jackpot! Exact 4-digit match single-winner takes all. Payouts verified transparently with guaranteed 24-hour USDT withdrawals.
          </p>

          {/* Grand Jackpot Counter Card */}
          <div className="glass-panel rounded-2xl p-4 sm:p-8 max-w-2xl mx-auto mb-10 relative overflow-hidden border border-[#ffd700]/30 shadow-[0_0_50px_rgba(245,196,81,0.15)]">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-[#ffd700] to-transparent" />
            
            <span className="text-[10px] sm:text-xs font-mono-numbers uppercase tracking-widest text-[#ffd700] font-bold">
              WIN UP TO GRAND JACKPOT · SINGLE WINNER TAKES ALL
            </span>

            <div className="my-2 sm:my-3 flex items-center justify-center gap-2 sm:gap-3">
              <span className="text-gold-gradient font-display font-black text-3xl sm:text-6xl tracking-tight">
                {grandEvent ? grandEvent.poolPrize.toLocaleString() : '125,000'}
              </span>
              <span className="font-display font-black text-xl sm:text-3xl text-[#05d5aa]">
                USDT
              </span>
            </div>

            {/* Animated 4-Digit Lucky Spheres */}
            <div className="flex items-center justify-center gap-2 sm:gap-3 my-4 sm:my-6">
              {['7', '4', '2', '9'].map((digit, idx) => (
                <div
                  key={idx}
                  className="w-10 h-10 sm:w-16 sm:h-16 rounded-xl sm:rounded-2xl bg-gradient-to-b from-[#1e2638] to-[#0c0f17] border-2 border-[#f5c451]/60 flex items-center justify-center font-display font-extrabold text-xl sm:text-3xl text-[#ffd700] shadow-[0_0_20px_rgba(245,196,81,0.25)] hover:scale-110 hover:border-[#ffd700] transition-all duration-300"
                >
                  {digit}
                </div>
              ))}
            </div>

            {/* Countdown Tiles */}
            <div className="mt-6 pt-6 border-t border-[rgba(245,196,81,0.15)]">
              <div className="flex items-center justify-center gap-2 mb-3 text-xs text-[#9b8f7c] font-medium">
                <Clock className="w-3.5 h-3.5 text-[#00f2fe]" />
                <span>Next Scheduled Autonomous Draw In:</span>
              </div>
              
              <div className="grid grid-cols-4 gap-2 sm:gap-4 max-w-sm mx-auto">
                <div className="bg-[#0b0e14]/90 border border-[#32353c] rounded-xl p-2.5">
                  <div className="font-mono-numbers font-black text-xl sm:text-2xl text-white">
                    {String(timeLeft.days).padStart(2, '0')}
                  </div>
                  <div className="text-[10px] text-[#9b8f7c] uppercase font-bold tracking-wider">Days</div>
                </div>

                <div className="bg-[#0b0e14]/90 border border-[#32353c] rounded-xl p-2.5">
                  <div className="font-mono-numbers font-black text-xl sm:text-2xl text-white">
                    {String(timeLeft.hours).padStart(2, '0')}
                  </div>
                  <div className="text-[10px] text-[#9b8f7c] uppercase font-bold tracking-wider">Hours</div>
                </div>

                <div className="bg-[#0b0e14]/90 border border-[#32353c] rounded-xl p-2.5">
                  <div className="font-mono-numbers font-black text-xl sm:text-2xl text-white">
                    {String(timeLeft.minutes).padStart(2, '0')}
                  </div>
                  <div className="text-[10px] text-[#9b8f7c] uppercase font-bold tracking-wider">Mins</div>
                </div>

                <div className="bg-[#0b0e14]/90 border border-[#32353c] rounded-xl p-2.5">
                  <div className="font-mono-numbers font-black text-xl sm:text-2xl text-[#ffd700]">
                    {String(timeLeft.seconds).padStart(2, '0')}
                  </div>
                  <div className="text-[10px] text-[#9b8f7c] uppercase font-bold tracking-wider">Secs</div>
                </div>
              </div>
            </div>

            {/* CTAs */}
            <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
              <button
                onClick={() => onPlayNowClick(grandEvent)}
                className="btn-gold w-full sm:w-auto px-8 py-3.5 rounded-xl text-base font-extrabold flex items-center justify-center gap-2 cursor-pointer"
              >
                <Sparkles className="w-5 h-5" />
                Play Now · Enter with USDT
              </button>

              <button
                onClick={onRulesClick}
                className="btn-ghost-gold w-full sm:w-auto px-6 py-3.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 cursor-pointer"
              >
                View 4-Digit Rules
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

          </div>
        </div>

        {/* Live Winners Marquee Ticker */}
        <div className="mt-6 border-y border-[rgba(245,196,81,0.15)] bg-[#0b0e14]/80 py-3 overflow-hidden">
          <div className="animate-marquee flex items-center gap-8">
            <span className="text-xs text-[#9b8f7c] uppercase font-bold tracking-wider flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#05d5aa]" /> LIVE PAYOUTS STREAM:
            </span>
            <span className="text-xs font-mono-numbers text-[#e1e2eb]">
              <span className="text-[#ffd700] font-bold">0x71A...9F2</span> matched <span className="text-[#05d5aa] font-bold">[7-4-2-9]</span> won <span className="text-[#ffd700] font-bold">+75,000 USDT</span> (Just now)
            </span>
            <span className="text-xs text-white/30">•</span>
            <span className="text-xs font-mono-numbers text-[#e1e2eb]">
              <span className="text-[#ffd700] font-bold">cryptoking.eth</span> matched <span className="text-[#05d5aa] font-bold">[*-4-2-9]</span> won <span className="text-[#ffd700] font-bold">+3,084 USDT</span> (2m ago)
            </span>
            <span className="text-xs text-white/30">•</span>
            <span className="text-xs font-mono-numbers text-[#e1e2eb]">
              <span className="text-[#ffd700] font-bold">0x99B...31C</span> matched <span className="text-[#05d5aa] font-bold">[*-*-2-9]</span> won <span className="text-[#ffd700] font-bold">+1,542 USDT</span> (14m ago)
            </span>
            <span className="text-xs text-white/30">•</span>
            <span className="text-xs font-mono-numbers text-[#e1e2eb]">
              <span className="text-[#ffd700] font-bold">satoshi_vip</span> matched <span className="text-[#05d5aa] font-bold">[*-*-*-9]</span> won <span className="text-[#ffd700] font-bold">+771 USDT</span> (28m ago)
            </span>
            <span className="text-xs text-white/30">•</span>
            <span className="text-xs font-mono-numbers text-[#e1e2eb]">
              <span className="text-[#ffd700] font-bold">0x4DE...67A</span> matched <span className="text-[#05d5aa] font-bold">[3-1-0-8]</span> won <span className="text-[#ffd700] font-bold">+38,880 USDT</span> (1h ago)
            </span>
          </div>
        </div>

      </div>
    </div>
  );
}
