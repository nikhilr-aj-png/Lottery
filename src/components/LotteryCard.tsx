import React, { useState, useEffect } from 'react';
import { Clock, Users, Ticket, ArrowRight, Flame, Trophy, Play, CheckCircle2 } from 'lucide-react';
import { getEventStatusInfo } from '../utils/eventStatus';

interface LotteryCardProps {
  event: any;
  onSelect?: (event: any) => void;
  onEnterRoom?: (event: any) => void;
  onShowResult?: (event: any) => void;
  mode?: 'available' | 'result';
  isLive?: boolean;
}

export default function LotteryCard({ 
  event, 
  onSelect, 
  onEnterRoom, 
  onShowResult,
  mode = 'available',
  isLive = false 
}: LotteryCardProps) {
  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0, totalSeconds: 0 });

  useEffect(() => {
    const updateCountdown = () => {
      const targetTime = event.drawTime || (Date.now() + 86400000);
      const diff = Math.max(0, targetTime - Date.now());
      const totalSecs = Math.floor(diff / 1000);
      const d = Math.floor(diff / (1000 * 60 * 60 * 24));
      const h = Math.floor((diff / (1000 * 60 * 60)) % 24);
      const m = Math.floor((diff / (1000 * 60)) % 60);
      const s = Math.floor((diff / 1000) % 60);
      setTimeLeft({ days: d, hours: h, minutes: m, seconds: s, totalSeconds: totalSecs });
    };

    updateCountdown();
    const timer = setInterval(updateCountdown, 1000);
    return () => clearInterval(timer);
  }, [event.drawTime]);

  const statusInfo = getEventStatusInfo(event);
  const isCompleted = mode === 'result' || statusInfo.isEnd || Boolean(event.winningDigits) || event.status === 'completed';
  const isTimedOut = isCompleted || (timeLeft.totalSeconds === 0 && Boolean(event.drawTime && event.drawTime <= Date.now()));

  // Authoritative event title (Never fallback to generic verification text)
  const eventTitle = event.title || event.name || event.roomName || 'Four Digit Lottery Draw';

  // Live timer formatted as HH:MM:SS
  const formatLiveClock = () => {
    const totalHours = timeLeft.days * 24 + timeLeft.hours;
    return `${String(totalHours).padStart(2, '0')}:${String(timeLeft.minutes).padStart(2, '0')}:${String(timeLeft.seconds).padStart(2, '0')}`;
  };

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
        return isCompleted 
          ? 'border-[#272a31] hover:border-amber-500/40 bg-[#0E131F]/90'
          : 'border-amber-500/35 hover:border-amber-400/80 shadow-[0_0_25px_rgba(245,196,81,0.12)] bg-[#111728]/95';
    }
  };

  const handleCardAction = () => {
    if (isCompleted) {
      if (onShowResult) onShowResult(event);
      else if (onSelect) onSelect(event);
    } else {
      if (onEnterRoom) onEnterRoom(event);
      else if (onSelect) onSelect(event);
    }
  };

  return (
    <div className={`glass-panel rounded-2xl p-4 sm:p-5 relative flex flex-col justify-between group transition-all duration-300 hover:-translate-y-1 overflow-hidden text-left ${getThemeStyling()}`}>
      
      {/* Top Banner & Status Header */}
      <div>
        {/* Verification, Status Beacon & Hash Information Row — Strictly Single Horizontal Line */}
        <div className="flex items-center justify-between gap-1 xs:gap-1.5 sm:gap-2 mb-2.5 sm:mb-3 w-full flex-nowrap min-w-0 overflow-hidden">
          <div className="flex items-center gap-1 xs:gap-1.5 min-w-0 shrink">
            {/* Status Beacon / Responsive LIVE Countdown */}
            {!isCompleted ? (
              <span className="px-1.5 xs:px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-md text-[9px] xs:text-[10px] sm:text-[11px] font-mono-numbers font-extrabold tracking-tight bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center gap-1 xs:gap-1.5 shadow-xs whitespace-nowrap shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping shrink-0" />
                <span className="truncate">LIVE {formatLiveClock()}</span>
              </span>
            ) : event.winningDigits ? (
              <span className="px-1.5 xs:px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-md text-[9px] xs:text-[10px] sm:text-[11px] font-mono-numbers font-extrabold tracking-tight bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center gap-1 xs:gap-1.5 whitespace-nowrap shrink-0">
                <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
                <span className="truncate">OFFICIAL</span>
              </span>
            ) : (
              <span className="px-1.5 xs:px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-md text-[9px] xs:text-[10px] sm:text-[11px] font-mono-numbers font-extrabold tracking-tight bg-amber-500/15 text-amber-300 border border-amber-500/30 flex items-center gap-1 xs:gap-1.5 whitespace-nowrap shrink-0">
                <Clock className="w-3 h-3 text-amber-400 shrink-0 animate-pulse" />
                <span className="truncate">PENDING</span>
              </span>
            )}

            {event.badge && (
              <span className="text-[9px] xs:text-[10px] font-mono-numbers px-1.5 xs:px-2 py-0.5 rounded-md font-bold tracking-wider bg-amber-500/10 text-amber-400 border border-amber-500/25 hidden xs:flex items-center gap-1 shrink-0 whitespace-nowrap">
                <Flame className="w-2.5 h-2.5 text-amber-400" />
                <span>{event.badge}</span>
              </span>
            )}
          </div>

          {/* Verification & Hash/Dash Value: Exactly Single Line, Never Wraps */}
          <div className="flex items-center gap-1 text-[9px] xs:text-[10px] font-mono-numbers text-[#94A3B8] font-bold shrink-0 min-w-0 whitespace-nowrap pl-1">
            <span className="text-amber-400/90 font-mono tracking-tight" title={`Event #${event.id}`}>
              #{event.id?.replace('evt-', '').toUpperCase().slice(0, 8)}
            </span>
          </div>
        </div>

        {/* Event Title */}
        <h3 className="font-display font-extrabold text-base sm:text-lg text-white mb-2 leading-snug group-hover:text-amber-300 transition-colors line-clamp-1" title={eventTitle}>
          {eventTitle}
        </h3>

        {/* Prize Pool Display */}
        <div className="p-3 rounded-xl bg-[#090D16] border border-[#1F2737] mb-3.5">
          <div className="flex items-center justify-between text-[10px] sm:text-[11px] text-[#94A3B8] mb-0.5">
            <span className="font-bold uppercase tracking-wider text-amber-400">
              {event.minPrize && event.maxPrize ? 'Prize Pool Range' : 'Jackpot Pool'}
            </span>
            <span className="text-emerald-400 font-mono-numbers font-semibold">
              USDT (TRC-20)
            </span>
          </div>

          <div className="flex items-baseline gap-1.5">
            <span className="font-display font-black text-xl sm:text-2xl text-white tracking-tight text-gold-gradient">
              {event.minPrize && event.maxPrize
                ? `${event.minPrize} – ${event.maxPrize}`
                : Number(event.poolPrize || event.pool_prize || 1000).toLocaleString()}
            </span>
            <span className="text-xs sm:text-sm font-bold text-amber-400 font-mono-numbers">
              USDT
            </span>
          </div>
        </div>

        {/* Key Metrics Row */}
        <div className="grid grid-cols-2 gap-2 mb-3.5 text-xs">
          <div className="p-2 rounded-xl bg-[#0B0F19] border border-[#1F2737]">
            <span className="text-[10px] text-[#94A3B8] flex items-center gap-1 mb-0.5">
              <Ticket className="w-3 h-3 text-amber-400" />
              <span>Ticket Price</span>
            </span>
            <strong className="font-mono-numbers font-bold text-white text-xs">
              {event.ticketPrice || event.ticket_price || 10} USDT
            </strong>
          </div>

          <div className="p-2 rounded-xl bg-[#0B0F19] border border-[#1F2737]">
            <span className="text-[10px] text-[#94A3B8] flex items-center gap-1 mb-0.5">
              <Users className="w-3 h-3 text-cyan-400" />
              <span>{isCompleted ? 'Total Entries' : 'Tickets Sold'}</span>
            </span>
            <strong className="font-mono-numbers font-bold text-white text-xs">
              {Number(event.ticketsSold || event.tickets_sold || 0).toLocaleString()}
            </strong>
          </div>
        </div>

        {/* Concluded Winning Digits Preview if Ended */}
        {isCompleted && (
          <div className="mb-3.5 p-2.5 rounded-xl bg-gradient-to-r from-amber-500/10 via-purple-500/10 to-emerald-500/10 border border-amber-500/30 text-center">
            {event.winningDigits ? (
              <>
                <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider block mb-1">
                  🏆 Official Winning Combination:
                </span>
                <div className="flex items-center justify-center gap-1.5">
                  {event.winningDigits.split('').map((d: string, i: number) => (
                    <span 
                      key={i} 
                      className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-[#0B0F19] border border-amber-400/80 text-amber-300 font-display font-black text-sm sm:text-base flex items-center justify-center shadow-inner"
                    >
                      {d}
                    </span>
                  ))}
                </div>
              </>
            ) : (
              <div className="py-1">
                <span className="text-[10px] text-amber-300 font-bold uppercase tracking-wider block">
                  Draw Pending Official Declaration
                </span>
                <span className="text-[10px] text-[#94A3B8] block mt-0.5">
                  Ticket sales closed • Oracle processing results
                </span>
              </div>
            )}
          </div>
        )}

        {/* Live Draw Scheduled Info */}
        {isCompleted && event.drawTime && (
          <div className="text-[10px] text-[#94A3B8] flex items-center justify-between mb-3 px-1">
            <span>Concluded On:</span>
            <span className="font-mono-numbers text-white font-medium">
              {new Date(event.drawTime).toLocaleDateString()} {new Date(event.drawTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        )}
      </div>

      {/* CTA Button */}
      <div className="pt-1">
        {isCompleted ? (
          <button
            type="button"
            onClick={handleCardAction}
            className="w-full py-2.5 sm:py-3 rounded-xl bg-gradient-to-r from-amber-500/20 via-[#141924] to-amber-500/20 hover:from-amber-500/30 hover:to-amber-500/30 text-amber-300 border border-amber-500/40 font-extrabold text-xs flex items-center justify-center gap-2 cursor-pointer transition-all shadow-md group-hover:border-amber-400"
          >
            <Trophy className="w-4 h-4 text-amber-400" />
            <span>Show Result</span>
            <ArrowRight className="w-3.5 h-3.5 ml-0.5 text-amber-400" />
          </button>
        ) : (
          <button
            type="button"
            onClick={handleCardAction}
            className="w-full py-2.5 sm:py-3 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black font-extrabold text-xs flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-amber-500/20 active:scale-98 transition-all"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>Enter Room</span>
            <ArrowRight className="w-3.5 h-3.5 ml-0.5" />
          </button>
        )}
      </div>

    </div>
  );
}
