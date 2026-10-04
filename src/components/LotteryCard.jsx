import React, { useState, useEffect } from 'react';
import { Clock, Users, Ticket, ArrowRight, ShieldCheck, Flame } from 'lucide-react';

export default function LotteryCard({ event, onSelect }) {
  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });

  useEffect(() => {
    const updateCountdown = () => {
      const diff = Math.max(0, event.drawTime - Date.now());
      const d = Math.floor(diff / (1000 * 60 * 60 * 24));
      const h = Math.floor((diff / (1000 * 60 * 60)) % 24);
      const m = Math.floor((diff / (1000 * 60)) % 60);
      const s = Math.floor((diff / 1000) % 60);
      setTimeLeft({ days: d, hours: h, minutes: m, seconds: s });
    };

    updateCountdown();
    const timer = setInterval(updateCountdown, 1000);
    return () => clearInterval(timer);
  }, [event.drawTime]);

  const isCompleted = event.status === 'completed';

  const getThemeStyling = () => {
    switch (event.theme) {
      case 'diwali':
        return 'border-amber-500/60 shadow-[0_0_35px_rgba(245,158,11,0.22)] hover:border-amber-400 hover:shadow-[0_0_50px_rgba(245,158,11,0.4)]';
      case 'eid':
        return 'border-emerald-500/50 shadow-[0_0_30px_rgba(16,185,129,0.2)] hover:border-emerald-400 hover:shadow-[0_0_40px_rgba(16,185,129,0.35)]';
      case 'holi':
        return 'border-pink-500/50 shadow-[0_0_30px_rgba(236,72,153,0.2)] hover:border-pink-400 hover:shadow-[0_0_40px_rgba(236,72,153,0.35)]';
      case 'durga_puja':
        return 'border-red-500/50 shadow-[0_0_30px_rgba(239,68,68,0.2)] hover:border-red-400 hover:shadow-[0_0_40px_rgba(239,68,68,0.35)]';
      case 'new_year':
        return 'border-purple-500/50 shadow-[0_0_30px_rgba(168,85,247,0.2)] hover:border-purple-400 hover:shadow-[0_0_40px_rgba(168,85,247,0.35)]';
      default:
        return 'border-[#272a31] hover:border-[#f5c451]/50';
    }
  };

  return (
    <div className={`glass-panel rounded-2xl p-6 relative flex flex-col justify-between group transition-all duration-300 hover:-translate-y-1 overflow-hidden ${getThemeStyling()}`}>
      {/* Seasonal Banner Image with Overlaid Text & Badges */}
      {event.bannerImage ? (
        <div className="relative -mx-6 -mt-6 mb-4 h-36 overflow-hidden border-b border-[#272a31]">
          <img 
            src={event.bannerImage} 
            alt={event.title} 
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0b0e14] via-[#0b0e14]/50 to-black/30" />
          
          {/* Overlaid Badges */}
          <div className="absolute top-3 left-3 right-3 flex items-center justify-between">
            <span className="text-[11px] font-mono-numbers px-2.5 py-1 rounded-md font-bold tracking-wider bg-black/70 backdrop-blur-md text-[#ffd700] border border-[#f5c451]/40 shadow-lg flex items-center gap-1">
              {event.badge || 'FESTIVE SPECIAL'}
            </span>
            <span className="flex items-center gap-1.5 text-xs text-[#05d5aa] font-mono-numbers font-semibold bg-black/70 backdrop-blur-md px-2 py-0.5 rounded border border-[#05d5aa]/30">
              <ShieldCheck className="w-3.5 h-3.5" />
              SHA-256
            </span>
          </div>

          {/* Overlaid Title on Banner */}
          <div className="absolute bottom-2.5 left-4 right-4">
            <h3 className="font-display font-black text-xl text-white drop-shadow-md truncate">
              {event.title}
            </h3>
          </div>
        </div>
      ) : (
        <>
          {/* Default Top Banner Accent */}
          <div className="flex items-center justify-between gap-2 mb-4">
            <span className={`text-[11px] font-mono-numbers px-3 py-1 rounded-md font-bold tracking-wider ${
              isCompleted 
                ? 'bg-slate-800 text-slate-400 border border-slate-700'
                : 'bg-[rgba(245,196,81,0.12)] text-[#ffd700] border border-[#f5c451]/30'
            }`}>
              {event.badge || 'LOTTERY POOL'}
            </span>

            <span className="flex items-center gap-1.5 text-xs text-[#05d5aa] font-mono-numbers font-semibold">
              <ShieldCheck className="w-3.5 h-3.5" />
              SHA-256
            </span>
          </div>

          {/* Title */}
          <h3 className="font-display font-bold text-xl text-white mb-2 group-hover:text-[#ffd700] transition-colors">
            {event.title}
          </h3>
        </>
      )}

      {/* Pool Prize Highlight */}
      <div className="my-4 p-4 rounded-xl bg-[#0b0e14]/80 border border-[#32353c] group-hover:border-[#f5c451]/40 transition-colors">
        <div className="text-xs text-[#9b8f7c] uppercase font-bold tracking-wider mb-1 flex items-center justify-between">
          <span className="flex items-center gap-1.5">
            <span className="text-amber-400 font-extrabold">
              {event.minPrize && event.maxPrize ? 'PRIZE RANGE' : 'WIN UP TO'}
            </span>
            <span className="text-[10px] text-[#9b8f7c] lowercase font-normal">
              {event.minPrize && event.maxPrize ? '(इनाम सीमा)' : '(अधिकतम तक)'}
            </span>
          </span>
          <span className="text-[10px] text-[#05d5aa] font-semibold bg-[#05d5aa]/10 px-2 py-0.5 rounded border border-[#05d5aa]/20">
            Single Winner Pot
          </span>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="font-display font-black text-3xl text-gold-gradient tracking-tight">
            {event.minPrize && event.maxPrize 
              ? `${event.minPrize} – ${event.maxPrize}` 
              : event.poolPrize.toLocaleString()}
          </span>
          <span className="font-display font-black text-lg text-[#05d5aa]">
            USDT
          </span>
        </div>
        <div className="mt-2.5 pt-2 border-t border-[#272a31]/60 flex items-center justify-between text-[11px] text-[#9b8f7c]">
          <span className="text-white/90 font-medium">Exact 4-Digit Match Wins Full Pot</span>
          <span className="text-red-400/80 font-medium text-[10px]">Other Numbers Lose</span>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 gap-3 mb-5 text-xs">
        <div className="bg-[#10131a] p-2.5 rounded-lg border border-[#272a31]">
          <span className="text-[#9b8f7c] block mb-1 flex items-center gap-1">
            <Ticket className="w-3.5 h-3.5 text-[#f5c451]" />
            Entry Price
          </span>
          <span className="font-mono-numbers font-bold text-sm text-white">
            {event.ticketPrice} USDT
          </span>
        </div>

        <div className="bg-[#10131a] p-2.5 rounded-lg border border-[#272a31]">
          <span className="text-[#9b8f7c] block mb-1 flex items-center gap-1">
            <Users className="w-3.5 h-3.5 text-[#00f2fe]" />
            Tickets Sold
          </span>
          <span className="font-mono-numbers font-bold text-sm text-white">
            {event.ticketsSold.toLocaleString()}
          </span>
        </div>
      </div>

      {/* 4-Digit Lucky Preview */}
      {isCompleted ? (
        <div className="mb-5 p-3 rounded-xl bg-[#1a2232] border border-[#05d5aa]/40">
          <span className="text-[11px] text-[#05d5aa] font-bold block uppercase mb-1.5">
            🏆 Official Winning Number:
          </span>
          <div className="flex items-center justify-center gap-2">
            {event.winningDigits ? event.winningDigits.split('').map((d, i) => (
              <span 
                key={i} 
                className="w-9 h-9 rounded-lg bg-[#0b0e14] border border-[#05d5aa] flex items-center justify-center font-display font-extrabold text-lg text-[#05d5aa]"
              >
                {d}
              </span>
            )) : null}
          </div>
        </div>
      ) : (
        <div className="mb-5">
          <div className="flex items-center justify-between text-xs text-[#9b8f7c] mb-1.5 font-medium">
            <span className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-[#f5c451]" />
              Draw Countdown:
            </span>
            <span className="font-mono-numbers text-[#e1e2eb] font-semibold">
              {timeLeft.days > 0 ? `${timeLeft.days}d ` : ''}
              {String(timeLeft.hours).padStart(2, '0')}h : {String(timeLeft.minutes).padStart(2, '0')}m : {String(timeLeft.seconds).padStart(2, '0')}s
            </span>
          </div>
          {/* Progress bar visual */}
          <div className="w-full bg-[#191c22] h-1.5 rounded-full overflow-hidden">
            <div className="bg-gradient-to-r from-[#ffd700] to-[#05d5aa] h-full w-[65%]" />
          </div>
        </div>
      )}

      {/* CTA Button */}
      {isCompleted ? (
        <button
          onClick={() => onSelect(event)}
          className="w-full py-3 rounded-xl bg-[#191c22] hover:bg-[#272a31] text-[#e1e2eb] border border-[#32353c] text-sm font-bold flex items-center justify-center gap-2 cursor-pointer transition-colors"
        >
          View Draw Proof & Winners
        </button>
      ) : (
        <button
          onClick={() => onSelect(event)}
          className="btn-gold w-full py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 cursor-pointer"
        >
          <Flame className="w-4 h-4" />
          Buy 4-Digit Ticket ({event.ticketPrice} USDT)
          <ArrowRight className="w-4 h-4 ml-1" />
        </button>
      )}
    </div>
  );
}
