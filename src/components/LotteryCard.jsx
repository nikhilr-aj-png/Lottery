import React, { useState, useEffect } from 'react';
import { Clock, Users, Ticket, ArrowRight, ShieldCheck, Flame, Trophy } from 'lucide-react';

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
  const isTimedOut = isCompleted || (event.drawTime && event.drawTime <= Date.now());

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
    <div className={`glass-panel rounded-2xl p-3.5 xs:p-4.5 sm:p-6 relative flex flex-col justify-between group transition-all duration-300 hover:-translate-y-1 overflow-hidden ${getThemeStyling()}`}>
      {/* Seasonal Banner Image with Overlaid Text & Badges */}
      {event.bannerImage ? (
        <div className="relative -mx-3.5 xs:-mx-4.5 sm:-mx-6 -mt-3.5 xs:-mt-4.5 sm:-mt-6 mb-3 sm:mb-4 h-32 xs:h-36 overflow-hidden border-b border-[#272a31]">
          <img 
            src={event.bannerImage} 
            alt={event.title} 
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0b0e14] via-[#0b0e14]/50 to-black/30" />
          
          {/* Overlaid Badges */}
          <div className="absolute top-2.5 xs:top-3 left-2.5 xs:left-3 right-2.5 xs:right-3 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] xs:text-[11px] font-mono-numbers px-2 xs:px-2.5 py-0.5 xs:py-1 rounded-md font-bold tracking-wider bg-black/70 backdrop-blur-md text-[#ffd700] border border-[#f5c451]/40 shadow-lg flex items-center gap-1">
                {event.badge || 'FESTIVE SPECIAL'}
              </span>
              <span className="text-[9px] xs:text-[10px] font-mono-numbers px-1.5 xs:px-2 py-0.5 rounded bg-black/80 text-amber-300 border border-amber-500/40 font-bold">
                ROUND #{event.id.replace('evt-', '').toUpperCase()}
              </span>
            </div>
          </div>

          {/* Overlaid Title on Banner */}
          <div className="absolute bottom-2 xs:bottom-2.5 left-3 xs:left-4 right-3 xs:right-4">
            <h3 className="font-display font-black text-lg xs:text-xl text-white drop-shadow-md truncate">
              {event.title}
            </h3>
          </div>
        </div>
      ) : (
        <>
          {/* Default Top Banner Accent */}
          <div className="flex items-center justify-between gap-2 mb-3 sm:mb-4">
            <div className="flex items-center gap-1.5">
              <span className={`text-[10px] xs:text-[11px] font-mono-numbers px-2.5 xs:px-3 py-0.5 xs:py-1 rounded-md font-bold tracking-wider ${
                isCompleted 
                  ? 'bg-slate-800 text-slate-400 border border-slate-700'
                  : 'bg-[rgba(245,196,81,0.12)] text-[#ffd700] border border-[#f5c451]/30'
              }`}>
                {event.badge || 'LOTTERY POOL'}
              </span>
              <span className="text-[9px] xs:text-[10px] font-mono-numbers px-1.5 xs:px-2 py-0.5 rounded bg-[#141924] text-amber-300 border border-amber-500/40 font-bold">
                ROUND #{event.id.replace('evt-', '').toUpperCase()}
              </span>
            </div>
          </div>

          {/* Title */}
          <h3 className="font-display font-bold text-lg xs:text-xl text-white mb-2 group-hover:text-[#ffd700] transition-colors truncate">
            {event.title}
          </h3>
        </>
      )}

      {/* Pool Prize Highlight */}
      <div className="my-3 sm:my-4 p-3 xs:p-4 rounded-xl bg-[#0b0e14]/80 border border-[#32353c] group-hover:border-[#f5c451]/40 transition-colors">
        <div className="text-[11px] xs:text-xs text-[#9b8f7c] uppercase font-bold tracking-wider mb-1 flex items-center justify-between">
          <span className="flex items-center gap-1.5">
            <span className="text-amber-400 font-extrabold">
              {event.minPrize && event.maxPrize ? 'PRIZE RANGE' : 'WIN UP TO'}
            </span>
            <span className="text-[9px] xs:text-[10px] text-[#9b8f7c] font-normal">
              {event.minPrize && event.maxPrize ? '(Guaranteed Range)' : '(Jackpot Cap)'}
            </span>
          </span>
          <span className="text-[9px] xs:text-[10px] text-[#05d5aa] font-semibold bg-[#05d5aa]/10 px-1.5 xs:px-2 py-0.5 rounded border border-[#05d5aa]/20">
            {event.winnerCount > 1 ? `${event.winnerCount} Lucky Winners` : 'Lucky Winner Pot'}
          </span>
        </div>
        <div className="flex items-baseline gap-1.5 xs:gap-2">
          <span className="font-display font-black text-2xl xs:text-3xl text-gold-gradient tracking-tight">
            {event.minPrize && event.maxPrize 
              ? `${event.minPrize} – ${event.maxPrize}` 
              : event.poolPrize.toLocaleString()}
          </span>
          <span className="font-display font-black text-base xs:text-lg text-[#05d5aa]">
            USDT
          </span>
        </div>
        <div className="mt-2 pt-1.5 sm:mt-2.5 sm:pt-2 border-t border-[#272a31]/60 flex items-center justify-between text-[10px] xs:text-[11px] text-[#9b8f7c]">
          <span className="text-white/90 font-medium truncate pr-1">
            {event.winnerCount > 1 ? `${event.winnerCount} Lucky Winners Share Pot` : 'Lucky 4-Digit Match Wins Full Pot'}
          </span>
          <span className="text-[#05d5aa] font-medium text-[9px] xs:text-[10px] shrink-0">Provably Fair</span>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 gap-2 xs:gap-3 mb-3.5 sm:mb-5 text-[11px] xs:text-xs">
        <div className="bg-[#10131a] p-2 xs:p-2.5 rounded-lg border border-[#272a31]">
          <span className="text-[#9b8f7c] block mb-0.5 xs:mb-1 flex items-center gap-1 text-[10px] xs:text-[11px] truncate">
            <Ticket className="w-3 xs:w-3.5 h-3 xs:h-3.5 text-[#f5c451] shrink-0" />
            Entry Price
          </span>
          <span className="font-mono-numbers font-bold text-xs xs:text-sm text-white truncate block">
            {event.ticketPrice} USDT
          </span>
        </div>

        <div className="bg-[#10131a] p-2 xs:p-2.5 rounded-lg border border-[#272a31]">
          <span className="text-[#9b8f7c] block mb-0.5 xs:mb-1 flex items-center gap-1 text-[10px] xs:text-[11px] truncate">
            <Users className="w-3 xs:w-3.5 h-3 xs:h-3.5 text-[#00f2fe] shrink-0" />
            Tickets Sold
          </span>
          <span className="font-mono-numbers font-bold text-xs xs:text-sm text-white truncate block">
            {event.ticketsSold.toLocaleString()}
          </span>
        </div>
      </div>

      {/* 4-Digit Lucky Preview */}
      {isCompleted ? (
        <div className="mb-3.5 sm:mb-5 p-2.5 xs:p-3 rounded-xl bg-[#1a2232] border border-[#05d5aa]/40">
          <span className="text-[10px] xs:text-[11px] text-[#05d5aa] font-bold block uppercase mb-1.5 text-center">
            🏆 Official Winning Number:
          </span>
          <div className="flex items-center justify-center gap-1.5 xs:gap-2">
            {event.winningDigits ? event.winningDigits.split('').map((d, i) => (
              <span 
                key={i} 
                className="w-7 xs:w-8 sm:w-9 h-7 xs:h-8 sm:h-9 rounded-lg bg-[#0b0e14] border border-[#05d5aa] flex items-center justify-center font-display font-extrabold text-base xs:text-lg text-[#05d5aa]"
              >
                {d}
              </span>
            )) : null}
          </div>
        </div>
      ) : isTimedOut ? (
        <div className="mb-3.5 sm:mb-5 p-2.5 xs:p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between text-[11px] xs:text-xs text-amber-300">
          <span className="flex items-center gap-1.5 font-bold">
            <Clock className="w-3 xs:w-3.5 h-3 xs:h-3.5 text-amber-400" />
            Draw Time Expired
          </span>
          <span className="font-mono-numbers text-[10px] xs:text-[11px] text-amber-400 font-semibold uppercase">
            Closed for Tickets
          </span>
        </div>
      ) : (
        <div className="mb-3.5 sm:mb-5">
          <div className="flex items-center justify-between text-[11px] xs:text-xs text-[#9b8f7c] mb-1.5 font-medium">
            <span className="flex items-center gap-1">
              <Clock className="w-3 xs:w-3.5 h-3 xs:h-3.5 text-[#f5c451]" />
              Draw Countdown:
            </span>
            <span className="font-mono-numbers text-[#e1e2eb] font-semibold text-[10px] xs:text-[11px]">
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

      {/* CTA Button: Show Result if timed out, else Buy 4-Digit Ticket */}
      {isTimedOut ? (
        <button
          onClick={() => onSelect(event)}
          className="w-full py-2.5 xs:py-3 rounded-xl bg-gradient-to-r from-amber-500/20 via-[#191c22] to-emerald-500/20 hover:from-amber-500/30 hover:to-emerald-500/30 text-amber-300 border border-amber-500/40 text-xs xs:text-sm font-bold flex items-center justify-center gap-2 cursor-pointer transition-all shadow-md"
        >
          <Trophy className="w-3.5 xs:w-4 h-3.5 xs:h-4 text-[#ffd700]" />
          <span>Show Result</span>
          <ArrowRight className="w-3.5 xs:w-4 h-3.5 xs:h-4 ml-1 text-[#ffd700]" />
        </button>
      ) : (
        <button
          onClick={() => onSelect(event)}
          className="btn-gold w-full py-2.5 xs:py-3 rounded-xl text-xs xs:text-sm font-bold flex items-center justify-center gap-2 cursor-pointer shadow-md"
        >
          <Flame className="w-3.5 xs:w-4 h-3.5 xs:h-4" />
          <span>Buy 4-Digit Ticket ({event.ticketPrice} USDT)</span>
          <ArrowRight className="w-3.5 xs:w-4 h-3.5 xs:h-4 ml-1" />
        </button>
      )}
    </div>
  );
}
