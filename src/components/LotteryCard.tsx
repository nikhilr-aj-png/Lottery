import React, { useState, useEffect } from 'react';
import { Clock, Users, Ticket, ArrowRight, Flame, Trophy, Play, CheckCircle2, Crown, Lock } from 'lucide-react';
import { getEventStatusInfo } from '../utils/eventStatus';
import { useLottery } from '../context/LotteryContext';

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
  const { getServerNowMs, isVipMember, setActiveTab, platformSettings, showToast } = useLottery();
  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0, totalSeconds: 0 });
  const [nowTick, setNowTick] = useState<number>(() => (getServerNowMs ? getServerNowMs() : Date.now()));
  const serverNowMs = nowTick;
  const statusInfo = getEventStatusInfo(event, undefined, serverNowMs);
  const isVipEvent = (event.eventCategory || event.event_category || 'normal') === 'vip';
  const isVipLockedForUser = isVipEvent && !isVipMember;

  useEffect(() => {
    const updateCountdown = () => {
      const now = getServerNowMs ? getServerNowMs() : Date.now();
      const targetTime = statusInfo.isUpcoming
        ? (statusInfo.startTimeMs || event.drawTime || 0)
        : (statusInfo.expiresAtMs || event.drawTime || 0);
      const diff = targetTime > 0 ? Math.max(0, targetTime - now) : 0;
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
  }, [event.drawTime, statusInfo.isUpcoming, statusInfo.startTimeMs, statusInfo.expiresAtMs, getServerNowMs]);

  const isCompleted = mode === 'result' || statusInfo.isEnd || Boolean(event.winningDigits) || event.status === 'completed';
  const isTimedOut = isCompleted || (timeLeft.totalSeconds === 0 && Boolean(statusInfo.expiresAtMs && statusInfo.expiresAtMs <= serverNowMs));

  // Authoritative event title (Never fallback to generic verification text)
  const eventTitle = event.title || event.name || event.roomName || 'Four Digit Lottery Draw';

  // Live 1-second ticker for both active draw timers and published result visibility countdown
  useEffect(() => {
    const interval = setInterval(() => {
      setNowTick(getServerNowMs ? getServerNowMs() : Date.now());
    }, 1000);
    return () => clearInterval(interval);
  }, [getServerNowMs]);

  const retentionHours = (() => {
    const raw =
      platformSettings?.resultsRetentionHours ??
      platformSettings?.resultsRetention?.duration_hours ??
      platformSettings?.resultsRetention?.retention_duration_hours ??
      1.0;
    const parsed = Number(raw);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 1.0;
  })();

  const resultPublishedAtMs =
    event.resultPublishedAtMs ||
    event.finalizedAtMs ||
    (event.result_published_at ? new Date(event.result_published_at).getTime() : 0) ||
    (event.finalized_at ? new Date(event.finalized_at).getTime() : 0) ||
    (event.drawExecutedAt ? new Date(event.drawExecutedAt).getTime() : 0);

  const resultVisibleUntilMs =
    event.resultVisibleUntilMs ||
    event.ticketVisibilityUntilMs ||
    (event.result_visible_until ? new Date(event.result_visible_until).getTime() : 0) ||
    (event.ticket_visibility_until ? new Date(event.ticket_visibility_until).getTime() : 0) ||
    (resultPublishedAtMs > 0 ? resultPublishedAtMs + retentionHours * 3600 * 1000 : 0);

  const resultRemainingMs = resultVisibleUntilMs > 0 ? Math.max(0, resultVisibleUntilMs - serverNowMs) : 0;

  // Live timer formatted as HH:MM:SS
  const formatLiveClock = () => {
    const totalHours = timeLeft.days * 24 + timeLeft.hours;
    return `${String(totalHours).padStart(2, '0')}:${String(timeLeft.minutes).padStart(2, '0')}:${String(timeLeft.seconds).padStart(2, '0')}`;
  };

  const formatCountdownMs = (ms: number) => {
    const totalSecs = Math.max(0, Math.floor(ms / 1000));
    const hrs = Math.floor(totalSecs / 3600);
    const mins = Math.floor((totalSecs % 3600) / 60);
    const secs = totalSecs % 60;
    return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  // Auto-hide concluded published result card the exact second its visibility countdown expires
  if (mode === 'result' && isCompleted && Boolean(event.winningDigits) && resultVisibleUntilMs > 0 && resultRemainingMs <= 0) {
    return null;
  }

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
    } else if (isVipLockedForUser) {
      showToast?.('VIP Membership required. Upgrade to VIP Player to enter VIP Events.', 'info');
      setActiveTab?.('profile');
    } else {
      if (onEnterRoom) onEnterRoom(event);
      else if (onSelect) onSelect(event);
    }
  };

  return (
    <div
      data-testid={`lottery-card-${event.id}`}
      className={`glass-panel rounded-2xl p-3.5 sm:p-4 lg:p-5 relative flex flex-col justify-between h-full group transition-all duration-300 hover:-translate-y-0.5 overflow-hidden text-left box-border min-w-0 ${getThemeStyling()}`}
    >
      {/* Top Banner & Status Header */}
      <div className="min-w-0">
        {/* Verification, Status Beacon & Round ID Row — Strictly Single Horizontal Line */}
        <div className="flex items-center justify-between gap-1.5 mb-2.5 w-full flex-nowrap min-w-0 overflow-hidden">
          <div className="flex items-center gap-1.5 min-w-0 shrink">
            {!isCompleted ? (
              <span className="px-2 py-0.5 rounded-md text-[9.5px] sm:text-[10.5px] font-mono-numbers font-extrabold tracking-tight bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center gap-1 shadow-xs whitespace-nowrap shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping shrink-0" />
                <span>LIVE {formatLiveClock()}</span>
              </span>
            ) : event.winningDigits ? (
              <span className="px-2 py-0.5 rounded-md text-[9.5px] sm:text-[10.5px] font-mono-numbers font-extrabold tracking-tight bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center gap-1 whitespace-nowrap shrink-0">
                <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
                <span>OFFICIAL</span>
              </span>
            ) : (
              <span className="px-2 py-0.5 rounded-md text-[9.5px] sm:text-[10.5px] font-mono-numbers font-extrabold tracking-tight bg-amber-500/15 text-amber-300 border border-amber-500/30 flex items-center gap-1 whitespace-nowrap shrink-0">
                <Clock className="w-3 h-3 text-amber-400 shrink-0 animate-pulse" />
                <span>PENDING</span>
              </span>
            )}

            {isVipEvent ? (
              <span
                data-testid={`event-category-badge-${event.id}`}
                className="text-[9px] font-mono-numbers px-1.5 py-0.5 rounded-md font-extrabold tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/40 inline-flex items-center gap-1 whitespace-nowrap shrink-0"
              >
                <Crown className="w-2.5 h-2.5 text-amber-400 shrink-0" />
                <span>VIP</span>
              </span>
            ) : (
              <span
                data-testid={`event-category-badge-${event.id}`}
                className="text-[9px] font-mono-numbers px-1.5 py-0.5 rounded-md font-bold tracking-wider bg-slate-800/90 text-slate-300 border border-slate-700 inline-flex items-center whitespace-nowrap shrink-0"
              >
                NORMAL
              </span>
            )}

            {event.badge && (
              <span className="text-[9px] font-mono-numbers px-1.5 py-0.5 rounded-md font-bold tracking-wider bg-amber-500/10 text-amber-400 border border-amber-500/25 hidden xs:inline-flex items-center gap-1 min-w-0 max-w-[115px] overflow-hidden">
                <Flame className="w-2.5 h-2.5 text-amber-400 shrink-0" />
                <span className="truncate">{event.badge}</span>
              </span>
            )}
          </div>

          <div className="flex items-center gap-1 text-[9.5px] sm:text-[10px] font-mono-numbers text-[#94A3B8] font-bold shrink-0 whitespace-nowrap pl-1.5">
            <span className="text-amber-400/90 font-mono tracking-tight" title={`Event #${event.id}`}>
              #{event.id?.replace('evt-', '').toUpperCase().slice(0, 8)}
            </span>
          </div>
        </div>

        {/* Event Title */}
        <h3 className="font-display font-extrabold text-sm sm:text-base text-white mb-2 leading-snug group-hover:text-amber-300 transition-colors line-clamp-1" title={eventTitle}>
          {eventTitle}
        </h3>

        {/* Prize Pool Display */}
        <div className="p-2.5 sm:p-3 rounded-xl bg-[#090D16] border border-[#1F2737] mb-2.5 sm:mb-3">
          <div className="flex items-center justify-between gap-2 text-[9.5px] sm:text-[10.5px] text-[#94A3B8] mb-0.5">
            <span className="font-bold uppercase tracking-wider text-amber-400 truncate">
              {event.minPrize && event.maxPrize && !isCompleted ? 'Prize Pool Range' : 'Jackpot Pool'}
            </span>
            <span className="text-emerald-400 font-mono-numbers font-semibold whitespace-nowrap shrink-0">
              USDT (TRC-20)
            </span>
          </div>

          <div className="flex items-baseline gap-1.5 min-w-0">
            <span className="font-display font-black text-lg sm:text-xl text-white tracking-tight text-gold-gradient truncate">
              {event.minPrize && event.maxPrize && !isCompleted
                ? `${Number(event.minPrize).toLocaleString('en-US')} – ${Number(event.maxPrize).toLocaleString('en-US')}`
                : Number(event.lockedJackpot || event.poolPrize || event.pool_prize || 0).toLocaleString('en-US')}
            </span>
            <span className="text-xs font-bold text-amber-400 font-mono-numbers shrink-0">
              USDT
            </span>
          </div>
        </div>

        {/* Key Metrics Row */}
        <div className="grid grid-cols-2 gap-2 mb-3 text-xs min-w-0">
          <div className="p-2 rounded-xl bg-[#0B0F19] border border-[#1F2737] min-w-0">
            <span className="text-[9.5px] text-[#94A3B8] flex items-center gap-1 mb-0.5 truncate">
              <Ticket className="w-3 h-3 text-amber-400 shrink-0" />
              <span className="truncate">Ticket Price</span>
            </span>
            <strong className="font-mono-numbers font-bold text-white text-xs block truncate">
              {event.ticketPrice || event.ticket_price || 10} USDT
            </strong>
          </div>

          <div className="p-2 rounded-xl bg-[#0B0F19] border border-[#1F2737] min-w-0">
            <span className="text-[9.5px] text-[#94A3B8] flex items-center gap-1 mb-0.5 truncate">
              <Users className="w-3 h-3 text-cyan-400 shrink-0" />
              <span className="truncate">{isCompleted ? 'Total Entries' : 'Tickets Sold'}</span>
            </span>
            <strong className="font-mono-numbers font-bold text-white text-xs block truncate">
              {Number(event.ticketsSold || event.tickets_sold || 0).toLocaleString()}
            </strong>
          </div>
        </div>

        {/* Concluded Winning Digits Preview if Ended */}
        {isCompleted && (
          <div className="mb-3 p-2.5 rounded-xl bg-gradient-to-r from-amber-500/10 via-purple-500/10 to-emerald-500/10 border border-amber-500/30 text-center">
            {event.winningDigits ? (
              <>
                <span className="text-[9.5px] text-emerald-400 font-bold uppercase tracking-wider block mb-1">
                  Official Winning Combination
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
                  Ticket sales closed · Processing results
                </span>
              </div>
            )}
          </div>
        )}

        {/* Live Draw Scheduled Info & Result Visibility Countdown */}
        {isCompleted && (resultPublishedAtMs > 0 || event.drawTime) && (
          <div className="space-y-1.5 mb-2.5 px-1">
            <div className="text-[10px] text-[#94A3B8] flex items-center justify-between gap-2">
              <span className="truncate">{event.winningDigits ? 'Published On:' : 'Concluded On:'}</span>
              <span className="font-mono-numbers text-white font-medium shrink-0">
                {new Date(resultPublishedAtMs || event.drawTime).toLocaleDateString()}{' '}
                {new Date(resultPublishedAtMs || event.drawTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>

            {event.winningDigits && resultVisibleUntilMs > 0 && (
              <div
                data-testid={`result-countdown-${event.id}`}
                className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-[10px]"
              >
                <span className="inline-flex items-center gap-1 text-amber-300 font-bold truncate">
                  <Clock className="w-3 h-3 text-amber-400 shrink-0" />
                  <span>Result Available For:</span>
                </span>
                <span className="font-mono-numbers font-black text-amber-200 tracking-wider shrink-0">
                  {formatCountdownMs(resultRemainingMs)}
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* CTA Button */}
      <div className="pt-1">
        {isCompleted ? (
          <button
            type="button"
            onClick={handleCardAction}
            className="w-full min-h-[40px] py-2 rounded-xl bg-gradient-to-r from-amber-500/20 via-[#141924] to-amber-500/20 hover:from-amber-500/30 hover:to-amber-500/30 text-amber-300 border border-amber-500/40 font-extrabold text-xs flex items-center justify-center gap-2 cursor-pointer transition-all shadow-md group-hover:border-amber-400 whitespace-nowrap"
          >
            <Trophy className="w-4 h-4 text-amber-400 shrink-0" />
            <span>Show Result</span>
            <ArrowRight className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          </button>
        ) : isVipLockedForUser ? (
          <button
            type="button"
            data-testid={`lottery-card-vip-lock-${event.id}`}
            onClick={handleCardAction}
            className="w-full min-h-[40px] py-2 px-3 rounded-xl bg-[#161B2B] hover:bg-amber-500/15 border border-amber-500/40 text-amber-300 font-extrabold text-xs flex items-center justify-center gap-2 cursor-pointer transition-all whitespace-nowrap"
          >
            <Lock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span>VIP Required • Upgrade</span>
          </button>
        ) : statusInfo.isUpcoming ? (
          <button
            type="button"
            disabled
            className="w-full min-h-[40px] py-2 rounded-xl bg-[#141924] text-blue-300 border border-blue-500/30 font-extrabold text-xs flex items-center justify-center gap-2 cursor-not-allowed opacity-85 whitespace-nowrap"
          >
            <Clock className="w-3.5 h-3.5 shrink-0" />
            <span>Starts Soon</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={handleCardAction}
            className="w-full min-h-[40px] py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black font-extrabold text-xs flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-amber-500/20 active:scale-[0.98] transition-all whitespace-nowrap"
          >
            <Play className="w-3.5 h-3.5 fill-current shrink-0" />
            <span>Enter Room</span>
            <ArrowRight className="w-3.5 h-3.5 shrink-0" />
          </button>
        )}
      </div>
    </div>
  );
}
