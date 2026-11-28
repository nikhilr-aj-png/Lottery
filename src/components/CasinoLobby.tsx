import React, { useEffect, useMemo, useState } from 'react';
import { useLottery } from '../context/LotteryContext';
import {
  Sparkles,
  Trophy,
  Ticket,
  ChevronRight,
  Wallet,
  Crown,
  Lock,
  X
} from 'lucide-react';
import LotteryCard from './LotteryCard';
import LotteryShowResultScreen from './LotteryShowResultScreen';
import { getEventStatusInfo } from '../utils/eventStatus';

interface CasinoLobbyProps {
  onLaunchGame?: (gameIdOrEventId: string) => void;
  onOpenLotteryRules?: () => void;
  onShowResult?: (event: any) => void;
}

export default function CasinoLobby({ onLaunchGame, onShowResult }: CasinoLobbyProps) {
  const {
    events,
    tickets,
    setActiveTab,
    platformSettings,
    requireAuth,
    user,
    isVipMember,
    getServerNowMs,
    verifyRoomEntry,
    showToast
  } = useLottery();
  const [selectedResultEvent, setSelectedResultEvent] = useState<any>(null);
  const [nowTick, setNowTick] = useState<number>(() => (getServerNowMs ? getServerNowMs() : Date.now()));

  useEffect(() => {
    const timer = setInterval(() => {
      setNowTick(getServerNowMs ? getServerNowMs() : Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, [getServerNowMs]);
  const netPoolSharePct = Math.max(0, Math.min(100, 100 - Number(platformSettings?.houseFeePercent ?? 5))).toFixed(1);

  // Results Retention Setting from Admin Panel (Default: 1 hour)
  const retentionHours = useMemo(() => {
    const raw =
      platformSettings?.resultsRetentionHours ??
      platformSettings?.resultsRetention?.duration_hours ??
      platformSettings?.resultsRetention?.retention_duration_hours ??
      1.0;
    const parsed = Number(raw);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 1.0;
  }, [platformSettings?.resultsRetentionHours, platformSettings?.resultsRetention]);

  // 1. Available Pool: ONLY published active events within their valid availability window
  const availableEvents = useMemo(() => {
    const serverNow = getServerNowMs ? getServerNowMs() : Date.now();
    const list = (events || []).filter((e: any) => {
      const info = getEventStatusInfo(e, undefined, serverNow);
      return !info.isEnd && !info.isScheduledUnpublished;
    });

    return list.sort((a: any, b: any) => {
      const aInfo = getEventStatusInfo(a, undefined, serverNow);
      const bInfo = getEventStatusInfo(b, undefined, serverNow);
      if (!aInfo.isUpcoming && bInfo.isUpcoming) return -1;
      if (aInfo.isUpcoming && !bInfo.isUpcoming) return 1;
      return (a.drawTime || 0) - (b.drawTime || 0);
    });
  }, [events, getServerNowMs]);

  // Primary Live Event for Hero metadata & top jackpot lookup
  const primaryLiveEvent = useMemo(() => {
    return availableEvents.find((e: any) => e.status === 'active') || availableEvents[0] || null;
  }, [availableEvents]);

  // Real highest jackpot across active pools
  const topJackpotDisplay = useMemo(() => {
    if (!primaryLiveEvent) return '0 USDT';
    if (primaryLiveEvent.minPrize && primaryLiveEvent.maxPrize) {
      return `${Number(primaryLiveEvent.minPrize).toLocaleString('en-US')}–${Number(primaryLiveEvent.maxPrize).toLocaleString('en-US')} USDT`;
    }
    const maxPool = Math.max(
      ...availableEvents.map((e: any) => Number(e.poolPrize || e.pool_prize || 0)),
      Number(primaryLiveEvent.poolPrize || primaryLiveEvent.pool_prize || 0)
    );
    return `${maxPool.toLocaleString('en-US')} USDT`;
  }, [availableEvents, primaryLiveEvent]);

  const primaryStatusInfo = useMemo(
    () => (primaryLiveEvent ? getEventStatusInfo(primaryLiveEvent) : null),
    [primaryLiveEvent]
  );

  // Categorize Normal vs VIP active/upcoming events
  const normalAvailableEvents = useMemo(
    () => availableEvents.filter((e: any) => (e.eventCategory || e.event_category || 'normal') !== 'vip'),
    [availableEvents]
  );
  const vipAvailableEvents = useMemo(
    () => availableEvents.filter((e: any) => (e.eventCategory || e.event_category || 'normal') === 'vip'),
    [availableEvents]
  );

  // 2. Results: Ended events strictly within their authoritative result visibility window
  const resultsEvents = useMemo(() => {
    const retentionMs = retentionHours * 3600 * 1000;

    return (events || [])
      .filter((e: any) => {
        if (e.status === 'deleted' || e.is_deleted) return false;
        const isFinalized =
          e.status === 'completed' &&
          Boolean(e.winningDigits) &&
          Boolean(e.resultPublishedAtMs || e.finalizedAtMs || e.drawExecutedAt);
        const isConcluded = isFinalized || e.status === 'completed' || Boolean(e.winningDigits) || (e.drawTime && e.drawTime <= nowTick);
        if (!isConcluded) return false;

        const publishedAtMs =
          e.resultPublishedAtMs ||
          e.finalizedAtMs ||
          (e.drawExecutedAt ? new Date(e.drawExecutedAt).getTime() : 0);
        const visibleUntilMs =
          e.resultVisibleUntilMs ||
          e.ticketVisibilityUntilMs ||
          (publishedAtMs > 0 ? publishedAtMs + retentionMs : 0);

        if (isFinalized && visibleUntilMs > 0) {
          return nowTick < visibleUntilMs;
        }
        if (e.drawTime && nowTick - e.drawTime > retentionMs) {
          return false;
        }
        return true;
      })
      .sort((a: any, b: any) => (b.finalizedAtMs || b.drawTime || 0) - (a.finalizedAtMs || a.drawTime || 0));
  }, [events, retentionHours, nowTick]);

  // Single-action Direct Room Entry (Protected: Login + VIP Membership + Authoritative Server Active Check)
  const handleDirectEnterRoom = async (eventOrId?: any) => {
    const targetId =
      typeof eventOrId === 'string'
        ? eventOrId
        : eventOrId?.id || primaryLiveEvent?.id || 'lottery';

    const matchedEvt = (events || []).find((e: any) => e.id === targetId);
    if (matchedEvt && (matchedEvt.eventCategory || matchedEvt.event_category || 'normal') === 'vip' && !isVipMember) {
      showToast?.('VIP Membership required to join VIP events. Upgrade in Profile.', 'info');
      setActiveTab('profile');
      return;
    }

    const roomId = targetId && targetId !== 'lottery' && targetId !== 'four-digit-lottery' ? targetId : null;
    if (!requireAuth({ type: 'game', gameSlug: 'four-digit-lottery', roomId }, 'Please log in to enter the Live Draw Room.')) {
      return;
    }

    if (roomId && verifyRoomEntry) {
      const check = await verifyRoomEntry(roomId);
      if (!check?.allowed) {
        showToast?.(check?.message || 'This event has expired. Room entry is no longer available.', 'error');
        return;
      }
    }

    if (onLaunchGame) {
      onLaunchGame(targetId);
    }
  };

  const handleShowResultAction = (evt: any) => {
    if (onShowResult) {
      onShowResult(evt);
    } else {
      setSelectedResultEvent(evt);
    }
  };

  return (
    <div
      data-testid="homepage-lobby"
      className="w-full max-w-7xl 2xl:max-w-[1600px] 3xl:max-w-[1800px] 4k:max-w-[2000px] mx-auto space-y-3.5 sm:space-y-5 pb-3 text-left box-border"
    >
      {/* ------------------------------------------------------------------ */}
      {/* 1. PRIORITY HERO & FOUR DIGIT LUCKY LOTTERY CARD                   */}
      {/* ------------------------------------------------------------------ */}
      <section
        data-testid="homepage-hero-card"
        aria-label="Four Digit Lucky Lottery"
        className="ef-hero-320 relative overflow-hidden rounded-2xl sm:rounded-3xl bg-gradient-to-br from-[#121728] via-[#0F1422] to-[#17122B] border border-amber-500/30 p-3 xs:p-3.5 sm:p-5 lg:p-6 shadow-xl box-border"
      >
        <div className="pointer-events-none absolute -top-16 -right-12 w-56 h-56 bg-amber-500/8 rounded-full blur-3xl" />
        <div className="pointer-events-none absolute -bottom-16 -left-12 w-48 h-48 bg-purple-600/8 rounded-full blur-3xl" />

        <div className="relative z-10 grid grid-cols-1 xl:grid-cols-12 gap-3 sm:gap-4 xl:gap-6 items-center">
          {/* Top / Left Area: Icon, Status Badges, Heading, Description & Supported Badges */}
          <div className="xl:col-span-7 space-y-2 sm:space-y-2.5 min-w-0">
            <div className="flex items-center gap-2.5 sm:gap-3.5 min-w-0">
              <div className="w-11 h-11 xs:w-13 xs:h-13 sm:w-16 sm:h-16 rounded-xl sm:rounded-2xl bg-[#090D16] border-2 border-amber-400/75 shadow-[0_0_16px_rgba(245,196,81,0.2)] overflow-hidden flex items-center justify-center shrink-0">
                <img
                  src="/items/Four Digit Lottery.jpg"
                  alt="Four Digit Lucky Lottery"
                  className="w-full h-full object-cover"
                />
              </div>

              <div className="min-w-0 flex-1 space-y-0.5 sm:space-y-1">
                <div className="flex items-center gap-1 sm:gap-1.5 flex-wrap">
                  <span className="inline-flex items-center gap-1 px-1.5 sm:px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 font-mono-numbers text-[9px] sm:text-[10.5px] font-bold whitespace-nowrap">
                    <Sparkles className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-amber-400 shrink-0" />
                    <span>Official Lucky Draw</span>
                  </span>
                  {primaryStatusInfo && (
                    <span className={`inline-flex items-center gap-1 px-1.5 sm:px-2 py-0.5 rounded-full text-[8.5px] sm:text-[10px] font-mono-numbers font-bold uppercase whitespace-nowrap ${primaryStatusInfo.badgeClass}`}>
                      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${primaryStatusInfo.dotClass}`} />
                      <span>{primaryStatusInfo.label}</span>
                    </span>
                  )}
                </div>

                <h1 className="font-display font-black text-white text-[15.5px] xs:text-lg sm:text-2xl lg:text-[26px] tracking-tight leading-tight">
                  Four Digit <span className="text-amber-400">Lucky Lottery</span>
                </h1>
              </div>
            </div>

            <p
              data-testid="homepage-hero-description"
              className="text-[11px] xs:text-xs sm:text-[13px] text-[#CBD5E1] leading-snug sm:leading-relaxed max-w-2xl"
            >
              Pick your lucky 4-digit number between <strong className="text-white">0000 and 9999</strong> to enter transparent jackpot pools with instant 24-hour USDT payouts.
            </p>

            <div className="flex flex-wrap items-center gap-1.5">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-[9px] sm:text-[10px] font-bold font-mono-numbers whitespace-nowrap">
                USDT TRC-20
              </span>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-white/5 text-[#CBD5E1] border border-white/10 text-[9px] sm:text-[10px] font-bold whitespace-nowrap">
                18+ Players
              </span>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-purple-500/15 text-purple-300 border border-purple-500/30 text-[9px] sm:text-[10px] font-bold font-mono-numbers whitespace-nowrap">
                {netPoolSharePct}% Net Funding
              </span>
            </div>
          </div>

          {/* Information Area: Strictly Two Balanced Stat Cards (Live Pools & Top Jackpot) */}
          <div
            data-testid="hero-info-cards"
            className="xl:col-span-5 grid grid-cols-2 gap-2 sm:gap-3 min-w-0"
          >
            <div
              data-testid="hero-live-pools-card"
              className="px-2.5 py-2 sm:px-3.5 sm:py-3 rounded-xl sm:rounded-2xl bg-[#0B0F19]/90 border border-[#1F2737] min-w-0 flex flex-col justify-between gap-1"
            >
              <span className="text-[9.5px] sm:text-[10.5px] uppercase tracking-wider text-[#94A3B8] font-bold inline-flex items-center gap-1.5 whitespace-nowrap">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                <span>Live Pools</span>
              </span>
              <span className="font-mono-numbers font-black text-[12px] xs:text-[13px] sm:text-base xl:text-[16px] text-emerald-400 leading-tight break-words">
                {availableEvents.length} Active
              </span>
            </div>

            <div
              data-testid="hero-top-jackpot-card"
              className="px-2.5 py-2 sm:px-3.5 sm:py-3 rounded-xl sm:rounded-2xl bg-[#0B0F19]/90 border border-amber-500/20 min-w-0 flex flex-col justify-between gap-1"
            >
              <span className="text-[9.5px] sm:text-[10.5px] uppercase tracking-wider text-[#94A3B8] font-bold whitespace-nowrap">
                Top Jackpot
              </span>
              <span className="font-mono-numbers font-black text-[11px] xs:text-xs sm:text-sm xl:text-[13.5px] 2xl:text-[15px] text-amber-300 leading-tight break-words">
                {topJackpotDisplay}
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* 2. AVAILABLE POOL: ONLY RENDERED WHEN ACTIVE/UPCOMING POOLS EXIST  */}
      {/* ------------------------------------------------------------------ */}
      {availableEvents.length > 0 && (
      <section data-testid="available-pool-section" className="space-y-3 sm:space-y-4">
        <div className="pb-2.5 border-b border-[#1F2737] space-y-1">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
              <h2 className="font-display font-extrabold text-base sm:text-lg lg:text-xl text-white truncate">
                Available Pool
              </h2>
            </div>

            <span className="text-[10px] sm:text-[11px] font-mono-numbers px-2.5 py-0.5 sm:py-1 rounded-full bg-[#141924] text-amber-300 border border-amber-500/30 font-bold whitespace-nowrap shrink-0">
              {availableEvents.length} Active {availableEvents.length === 1 ? 'Pool' : 'Pools'}
            </span>
          </div>

          <p className="text-[11px] sm:text-xs text-[#94A3B8] leading-snug">
            Select any active or upcoming Four Digit Lottery pool to enter the live room.
          </p>
        </div>

          <div className="space-y-6">
            {/* Normal Events */}
            {normalAvailableEvents.length > 0 && (
              <div className="space-y-2.5" data-testid="normal-events-section">
                {vipAvailableEvents.length > 0 && (
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
                      Normal Events (Open to All Players)
                    </span>
                    <span className="text-[10px] font-mono-numbers text-slate-400">
                      {normalAvailableEvents.length} {normalAvailableEvents.length === 1 ? 'Event' : 'Events'}
                    </span>
                  </div>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4 lg:gap-5">
                  {normalAvailableEvents.map((evt: any, idx: number) => (
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
              </div>
            )}

            {/* VIP Exclusive Events */}
            {vipAvailableEvents.length > 0 && (
              <div
                data-testid="vip-events-section"
                className="space-y-3 p-3.5 sm:p-4 rounded-2xl bg-gradient-to-br from-amber-500/[0.06] via-[#0F1422] to-[#17122B] border border-amber-500/30"
              >
                <div className="flex flex-col xs:flex-row xs:items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <Crown className="w-4 h-4 text-amber-400 shrink-0" />
                    <span className="text-xs sm:text-sm font-extrabold uppercase tracking-wider text-amber-300 truncate">
                      VIP Exclusive Events
                    </span>
                  </div>
                  {!isVipMember ? (
                    <button
                      type="button"
                      data-testid="lobby-upgrade-vip-btn"
                      onClick={() => setActiveTab('profile')}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/40 text-amber-300 text-[11px] font-bold cursor-pointer transition-colors whitespace-nowrap self-start xs:self-auto"
                    >
                      <Lock className="w-3 h-3 text-amber-400 shrink-0" />
                      <span>Upgrade to VIP Player</span>
                    </button>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-500/15 border border-amber-500/35 text-amber-300 text-[10px] font-bold whitespace-nowrap self-start xs:self-auto">
                      VIP Access Unlocked
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4 lg:gap-5">
                  {vipAvailableEvents.map((evt: any, idx: number) => (
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
              </div>
            )}
          </div>
      </section>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* 3. RESULTS: CONCLUDED DRAWS WITHIN CONFIGURABLE RETENTION PERIOD   */}
      {/* ------------------------------------------------------------------ */}
      {resultsEvents.length > 0 && (
        <section data-testid="recent-results-section" className="space-y-3 sm:space-y-4">
          <div className="pb-2.5 border-b border-[#1F2737] space-y-1">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <Trophy className="w-4.5 h-4.5 sm:w-5 sm:h-5 text-amber-400 shrink-0" />
                <h2 className="font-display font-extrabold text-base sm:text-lg lg:text-xl text-white truncate">
                  Recent Results
                </h2>
              </div>

              <button
                type="button"
                onClick={() => setActiveTab('results')}
                className="text-xs text-amber-400 hover:text-amber-300 font-bold inline-flex items-center gap-1 cursor-pointer transition-colors whitespace-nowrap shrink-0"
              >
                <span>View All</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <p className="text-[11px] sm:text-xs text-[#94A3B8] leading-snug">
              Official winning 4-digit results (Retained for{' '}
              {retentionHours >= 1
                ? `${retentionHours} hour${retentionHours > 1 ? 's' : ''}`
                : `${Math.round(retentionHours * 60)} minutes`}
              ).
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4 lg:gap-5">
            {resultsEvents.map((evt: any) => (
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

      {/* Full-Screen Draw Result Screen Overlay (matches ResultsView flow) */}
      {selectedResultEvent && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Official Draw Result"
          className="fixed inset-0 z-50 bg-[#07090E]/95 backdrop-blur-md flex flex-col overflow-hidden"
        >
          <div className="flex items-center justify-between px-4 sm:px-6 py-2.5 bg-[#0B0F19] border-b border-[#1F2737] shrink-0">
            <span className="text-xs font-mono-numbers font-bold text-amber-400">
              #{selectedResultEvent.id}
            </span>
            <button
              type="button"
              onClick={() => setSelectedResultEvent(null)}
              className="px-3 py-1.5 rounded-xl bg-[#141924] hover:bg-[#1E2536] text-white border border-[#273145] text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer transition-colors"
              title="Close Result Screen"
            >
              <X className="w-4 h-4 text-amber-400" />
              <span>Close</span>
            </button>
          </div>

          <div className="flex-1 min-h-0 overflow-hidden">
            <LotteryShowResultScreen
              event={selectedResultEvent}
              room={{
                name: selectedResultEvent.roomName || selectedResultEvent.title?.split(':')[0] || 'Lottery Room',
                drawId: selectedResultEvent.id
              }}
              onBackToLobby={() => setSelectedResultEvent(null)}
              myTickets={(tickets || []).filter(
                (t: any) => t.eventId === selectedResultEvent.id || t.event_id === selectedResultEvent.id
              )}
            />
          </div>
        </div>
      )}
    </div>
  );
}
