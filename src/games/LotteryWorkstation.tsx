import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useLottery } from '../context/LotteryContext';
import {
  ShieldCheck,
  Sparkles,
  AlertCircle,
  Clock,
  Ticket,
  RotateCcw,
  Activity,
  Wallet,
  Check,
  Trophy,
  Zap,
  Copy,
  Dices,
  Smartphone,
  Maximize2,
  X,
  Lock,
  Hash
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { soundFX } from '../engine/SoundFXService';
import LotteryShowResultScreen from '../components/LotteryShowResultScreen';
import { getEventStatusInfo } from '../utils/eventStatus';

export interface LotteryWorkstationProps {
  room?: any;
}

interface ViewportMetrics {
  width: number;
  height: number;
  isPortraitMedia: boolean;
}

interface DialState {
  digits: string[];
  activeSlot: number;
}

const ORDINALS = ['1ST', '2ND', '3RD', '4TH'] as const;
const KEYPAD_NUMS = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const;

export default function LotteryWorkstation({ room }: LotteryWorkstationProps) {
  const {
    user,
    wallet,
    events,
    tickets,
    buyTickets,
    isTicketNumberSold,
    isUserTicketNumberPurchased,
    getUnsoldRandomNumber,
    showToast,
    setIsAuthModalOpen
  } = useLottery();

  // ---------------------------------------------------------------------------
  // 1. Dynamic Viewport, Aspect Ratio & Mandatory Mobile Landscape Detection
  // ---------------------------------------------------------------------------
  const readViewport = useCallback((): ViewportMetrics => {
    if (typeof window === 'undefined') {
      return { width: 1200, height: 800, isPortraitMedia: false };
    }
    const isPortraitMedia =
      typeof window.matchMedia === 'function'
        ? window.matchMedia('(orientation: portrait)').matches
        : window.innerHeight > window.innerWidth;
    return {
      width: window.innerWidth,
      height: window.innerHeight,
      isPortraitMedia
    };
  }, []);

  const [viewport, setViewport] = useState<ViewportMetrics>(() => readViewport());
  const [orientationLockMessage, setOrientationLockMessage] = useState<string | null>(null);

  useEffect(() => {
    const syncViewport = () => setViewport(readViewport());

    window.addEventListener('resize', syncViewport);
    window.addEventListener('orientationchange', syncViewport);
    const orientationObj = window.screen?.orientation;
    if (orientationObj && typeof orientationObj.addEventListener === 'function') {
      orientationObj.addEventListener('change', syncViewport);
    }

    return () => {
      window.removeEventListener('resize', syncViewport);
      window.removeEventListener('orientationchange', syncViewport);
      if (orientationObj && typeof orientationObj.removeEventListener === 'function') {
        orientationObj.removeEventListener('change', syncViewport);
      }
    };
  }, [readViewport]);

  const isPortrait =
    viewport.height > viewport.width ||
    (viewport.width === viewport.height && viewport.isPortraitMedia);
  const isMobileViewport = viewport.width < 768;
  const isMobilePortrait = isMobileViewport && isPortrait;
  const isCompactLandscape = !isMobilePortrait && viewport.height <= 540;
  const isUltraNarrowLandscape = isCompactLandscape && viewport.width < 500;

  // Best-effort Screen Orientation API lock on mobile devices (graceful fallback to overlay)
  useEffect(() => {
    const orientationApi = (window.screen?.orientation as any) || null;
    if (!orientationApi || typeof orientationApi.lock !== 'function') return;

    const isTouchOrMobile =
      viewport.width < 768 ||
      (typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches);

    if (isTouchOrMobile) {
      orientationApi.lock('landscape').catch(() => {
        // Browsers often require fullscreen or PWA context for orientation.lock; overlay handles fallback cleanly.
      });
    }

    return () => {
      if (typeof orientationApi.unlock === 'function') {
        try {
          orientationApi.unlock();
        } catch {
          // Ignore unlock errors on unsupported browsers
        }
      }
    };
  }, []);

  const handleRequestLandscapeFullscreen = async () => {
    try {
      if (document.documentElement.requestFullscreen && !document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      }
      const orientationApi = (window.screen?.orientation as any) || null;
      if (orientationApi && typeof orientationApi.lock === 'function') {
        await orientationApi.lock('landscape');
        setOrientationLockMessage(null);
      } else {
        setOrientationLockMessage('Please rotate your device sideways into landscape mode.');
      }
    } catch {
      setOrientationLockMessage('Automatic rotation is blocked by your browser. Please turn your device sideways.');
    }
  };

  // ---------------------------------------------------------------------------
  // 2. Resolve Matching or Active Lottery Event for This Room
  // ---------------------------------------------------------------------------
  const event = useMemo(() => {
    if (!room) return events[0] || null;
    if (room.event) return room.event;

    const matching = events.find(
      (e: any) =>
        e.id === room.id ||
        e.id === room.drawId ||
        (room.name && e.title && e.title.toLowerCase().includes(room.name.toLowerCase()))
    );
    if (matching) return matching;

    const active = events.find((e: any) => e.status === 'active');
    if (active) {
      return {
        ...active,
        id: room.drawId || room.id || active.id,
        title: room.name || active.title,
        ticketPrice: room.minStakeFC || active.ticketPrice || 10,
        poolPrize: room.prizeInfo?.match(/\d+[\d,]*/)?.[0]?.replace(',', '') || active.poolPrize || 1000
      };
    }

    return {
      id: room.drawId || room.id || 'evt-default',
      title: room.name || 'Four-Digit Lottery Draw',
      ticketPrice: room.minStakeFC || 10,
      currency: room.currency || 'USDT',
      poolPrize: room.poolPrize || 1000,
      drawTime: Date.now() + (room.drawDurationHours || 24) * 3600 * 1000,
      status: 'active',
      ticketsSold: 0,
      participantsCount: 0,
      sha256Seed: ''
    };
  }, [room, events]);

  // ---------------------------------------------------------------------------
  // 3. Atomic 4-Digit Selection & Modal State (Never Reset on Rotate)
  // ---------------------------------------------------------------------------
  const [dialState, setDialState] = useState<DialState>({
    digits: ['7', '4', '2', '9'],
    activeSlot: 0
  });
  const { digits, activeSlot } = dialState;

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isVrfModalOpen, setIsVrfModalOpen] = useState<boolean>(false);
  const [copiedSeed, setCopiedSeed] = useState<boolean>(false);

  // ---------------------------------------------------------------------------
  // 4. Countdown Timer & Status
  // ---------------------------------------------------------------------------
  const [timeLeft, setTimeLeft] = useState({ hours: 0, minutes: 0, seconds: 0 });
  const statusInfo = getEventStatusInfo(event);
  const isTimedOut = statusInfo.isEnd;

  useEffect(() => {
    const updateTime = () => {
      const diff = Math.max(0, (event?.drawTime || Date.now() + 86400000) - Date.now());
      const h = Math.floor(diff / (1000 * 60 * 60));
      const m = Math.floor((diff / (1000 * 60)) % 60);
      const s = Math.floor((diff / 1000) % 60);
      setTimeLeft({ hours: h, minutes: m, seconds: s });
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, [event?.drawTime]);

  const currentNumberStr = digits.join('');

  // ---------------------------------------------------------------------------
  // 5. Availability Checks (Current User Ownership + Global Draw Uniqueness)
  // ---------------------------------------------------------------------------
  const isAlreadyPurchasedByMe = useMemo(() => {
    if (!event?.id) return false;
    if (isUserTicketNumberPurchased) {
      return isUserTicketNumberPurchased(event.id, currentNumberStr);
    }
    if (!user && !wallet?.address) return false;
    return (tickets || []).some(
      (t: any) =>
        (t.eventId === event.id || t.event_id === event.id) &&
        String(t.ticketNumber).padStart(4, '0') === currentNumberStr &&
        ((wallet?.address && t.userAddress === wallet.address) ||
          (user?.id && (t.userId === user.id || t.user_id === user.id)))
    );
  }, [isUserTicketNumberPurchased, event?.id, currentNumberStr, tickets, user, wallet?.address]);

  const isSoldToAnyPlayer = useMemo(() => {
    if (!event?.id || isAlreadyPurchasedByMe) return false;
    if (isTicketNumberSold) {
      return isTicketNumberSold(event.id, currentNumberStr);
    }
    return false;
  }, [isTicketNumberSold, event?.id, currentNumberStr, isAlreadyPurchasedByMe]);

  // ---------------------------------------------------------------------------
  // 6. Atomic Manual Keypad & Keyboard Actions (Safe Under Rapid Input)
  // ---------------------------------------------------------------------------
  const selectSlot = useCallback((slotIndex: number) => {
    setDialState((prev) => ({ ...prev, activeSlot: slotIndex }));
  }, []);

  const handleKeypadPress = useCallback(
    (val: number) => {
      if (isTimedOut || isSubmitting) return;
      soundFX.playDialTick();
      setDialState((prev) => {
        const updated = [...prev.digits];
        updated[prev.activeSlot] = String(val);
        return {
          digits: updated,
          activeSlot: prev.activeSlot < 3 ? prev.activeSlot + 1 : 0
        };
      });
    },
    [isTimedOut, isSubmitting]
  );

  const handleClearSlot = useCallback(() => {
    if (isTimedOut || isSubmitting) return;
    soundFX.playClick();
    setDialState((prev) => {
      const updated = [...prev.digits];
      updated[prev.activeSlot] = '0';
      return {
        digits: updated,
        activeSlot: prev.activeSlot === 0 ? 0 : prev.activeSlot - 1
      };
    });
  }, [isTimedOut, isSubmitting]);

  const handleResetAll = useCallback(() => {
    if (isTimedOut || isSubmitting) return;
    soundFX.playClick();
    setDialState({ digits: ['0', '0', '0', '0'], activeSlot: 0 });
  }, [isTimedOut, isSubmitting]);

  const handleRandomize = useCallback(() => {
    if (isTimedOut || isSubmitting) return;
    soundFX.playClick();
    const rndStr =
      (getUnsoldRandomNumber && event?.id ? getUnsoldRandomNumber(event.id) : null) ||
      String(Math.floor(Math.random() * 10000)).padStart(4, '0');
    setDialState((prev) => ({ ...prev, digits: rndStr.split('') }));
  }, [event?.id, getUnsoldRandomNumber, isTimedOut, isSubmitting]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isVrfModalOpen) {
        if (e.key === 'Escape') {
          e.stopPropagation();
          setIsVrfModalOpen(false);
        }
        return;
      }
      if (isMobilePortrait) return;
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) return;

      if (/^[0-9]$/.test(e.key)) {
        handleKeypadPress(parseInt(e.key, 10));
      } else if (e.key === 'Backspace' || e.key === 'Delete') {
        handleClearSlot();
      } else if (e.key === 'ArrowLeft') {
        setDialState((prev) => ({
          ...prev,
          activeSlot: prev.activeSlot === 0 ? 3 : prev.activeSlot - 1
        }));
      } else if (e.key === 'ArrowRight') {
        setDialState((prev) => ({
          ...prev,
          activeSlot: prev.activeSlot === 3 ? 0 : prev.activeSlot + 1
        }));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeypadPress, handleClearSlot, isMobilePortrait, isVrfModalOpen]);

  // ---------------------------------------------------------------------------
  // 7. Direct Ticket Purchase Flow (Preserves Existing Backend Contract)
  // ---------------------------------------------------------------------------
  const ticketPrice = Number(event?.ticketPrice || 10);
  const gasEscrowFee = 0;
  const totalPurchaseCost = ticketPrice + gasEscrowFee;
  const walletBalance = Number(wallet?.balance || 0);
  const hasSufficientBalance = walletBalance >= totalPurchaseCost;

  const handlePurchaseAction = async () => {
    if (isSubmitting) return;

    if (isTimedOut) {
      showToast('This draw has concluded and is closed for purchases!', 'error');
      return;
    }
    if (!user) {
      showToast('Please log in to complete your ticket purchase!', 'info');
      setIsAuthModalOpen(true);
      return;
    }
    if (!hasSufficientBalance) {
      showToast(
        `Insufficient USDT balance. Required: ${totalPurchaseCost.toFixed(2)} USDT, Available: ${walletBalance.toFixed(2)} USDT`,
        'error'
      );
      return;
    }
    if (isAlreadyPurchasedByMe) {
      showToast(`You already own ticket #${currentNumberStr} in this round. Please pick another number!`, 'info');
      return;
    }
    if (isSoldToAnyPlayer) {
      showToast(`Ticket #${currentNumberStr} is already taken by another player. Please choose a different number!`, 'error');
      return;
    }

    setIsSubmitting(true);
    soundFX.playChipBet();

    try {
      const success = await buyTickets(event.id, [currentNumberStr]);
      if (success) {
        soundFX.playWinFanfare();
        confetti({
          particleCount: 55,
          spread: 65,
          origin: { y: 0.6 }
        });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // ---------------------------------------------------------------------------
  // 8. Room Activity Data (Real Backend Tickets Stream)
  // ---------------------------------------------------------------------------
  const roomActivityTickets = useMemo(() => {
    if (!tickets || !event?.id) return [];
    return tickets
      .filter((t: any) => t.eventId === event.id || t.event_id === event.id)
      .slice(0, 40);
  }, [tickets, event?.id]);

  const myTicketsInThisRoom = useMemo(() => {
    if (!tickets || (!user && !wallet?.address) || !event?.id) return [];
    return tickets.filter(
      (t: any) =>
        (t.eventId === event.id || t.event_id === event.id) &&
        ((wallet?.address && t.userAddress === wallet.address) ||
          (user?.id && (t.userId === user.id || t.user_id === user.id)))
    );
  }, [tickets, user, wallet?.address, event?.id]);

  const formatTimeAgo = (timestamp: number) => {
    const diff = Math.max(0, Date.now() - timestamp);
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  };

  const handleCopySeed = () => {
    const seed = event?.sha256Seed || event?.sha256_seed;
    if (seed) {
      navigator.clipboard?.writeText(seed);
      setCopiedSeed(true);
      setTimeout(() => setCopiedSeed(false), 2000);
    }
  };

  // ---------------------------------------------------------------------------
  // 9. Concluded / Expired State -> Show Result Screen
  // ---------------------------------------------------------------------------
  if (isTimedOut) {
    return (
      <div className="w-full h-full max-h-full min-h-0 overflow-hidden flex flex-col">
        <LotteryShowResultScreen
          event={event}
          room={room}
          myTickets={myTicketsInThisRoom}
        />
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // 10. Computed Display Values & Status Helpers
  // ---------------------------------------------------------------------------
  const eventTitle = event?.title || room?.name || 'Four-Digit Lottery';
  const drawIdFormatted = event?.id
    ? `#DRAW-${String(event.id).replace(/^evt-/, '').slice(-6).toUpperCase()}`
    : '#DRAW-LIVE';

  const jackpotDisplay =
    event?.minPrize && event?.maxPrize
      ? `${Number(event.minPrize).toLocaleString()}–${Number(event.maxPrize).toLocaleString()} USDT`
      : `${Number(event?.poolPrize || event?.pool_prize || 1000).toLocaleString()} USDT`;

  const countdownFormatted = `${String(timeLeft.hours).padStart(2, '0')}:${String(timeLeft.minutes).padStart(2, '0')}:${String(timeLeft.seconds).padStart(2, '0')}`;

  const availabilityBadge = isAlreadyPurchasedByMe
    ? {
        label: 'OWNED',
        cls: 'bg-purple-500/15 text-purple-300 border-purple-500/35',
        dot: 'bg-purple-400'
      }
    : isSoldToAnyPlayer
    ? {
        label: 'SOLD OUT',
        cls: 'bg-rose-500/15 text-rose-300 border-rose-500/35',
        dot: 'bg-rose-500'
      }
    : {
        label: 'AVAILABLE',
        cls: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/35',
        dot: 'bg-emerald-400 animate-pulse'
      };

  const isPurchaseDisabled =
    isSubmitting ||
    isTimedOut ||
    (Boolean(user) && (isAlreadyPurchasedByMe || isSoldToAnyPlayer || !hasSufficientBalance));

  // ---------------------------------------------------------------------------
  // 11. Three Unified Column Renderers (Consistent Across All Devices)
  // ---------------------------------------------------------------------------

  const renderDigitSelectionPanel = () => (
    <section
      aria-label="Four-Digit Selection Panel"
      className="ef-game-card rounded-xl flex flex-col justify-between min-h-0 h-full overflow-hidden p-[clamp(8px,1.4dvh,16px)] gap-[clamp(6px,1.1dvh,12px)]"
    >
      {/* Column 1 Header */}
      <div className="flex items-center justify-between gap-1.5 pb-[clamp(5px,0.9dvh,10px)] border-b border-[#1E293B] shrink-0">
        <div className="flex items-center gap-1.5 min-w-0">
          <div className="w-[clamp(20px,3.2dvh,28px)] h-[clamp(20px,3.2dvh,28px)] rounded-lg bg-[#7C3AED]/15 border border-[#7C3AED]/35 flex items-center justify-center text-[#A78BFA] shrink-0">
            <Sparkles className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
          </div>
          <h2 className="font-display font-extrabold text-[clamp(10px,1.25vw,15px)] text-white leading-tight whitespace-nowrap">
            Pick 4 Digits
          </h2>
        </div>

        <span
          className={`text-[clamp(7.5px,0.9vw,10px)] font-mono-numbers px-1.5 sm:px-2 py-0.5 rounded-full font-bold uppercase flex items-center gap-1 border shrink-0 whitespace-nowrap ${availabilityBadge.cls}`}
        >
          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${availabilityBadge.dot}`} />
          <span>{availabilityBadge.label}</span>
        </span>
      </div>

      {/* 4 Position Digit Slots (1ST, 2ND, 3RD, 4TH) */}
      <div className="grid grid-cols-4 gap-[clamp(4px,0.85vw,10px)] shrink-0">
        {digits.map((digit, idx) => {
          const isSelected = activeSlot === idx;
          const isDisabledSlot = isTimedOut || isSubmitting;

          return (
            <button
              key={idx}
              type="button"
              disabled={isDisabledSlot}
              onClick={() => selectSlot(idx)}
              aria-pressed={isSelected}
              aria-label={`${ORDINALS[idx]} digit: ${digit}`}
              className={`ef-touch-btn relative rounded-xl flex flex-col items-center justify-center transition-all duration-150 select-none border-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A78BFA] ${
                isCompactLandscape
                  ? 'h-[clamp(40px,13.5dvh,60px)]'
                  : 'h-[clamp(54px,8.5dvh,84px)]'
              } ${
                isDisabledSlot
                  ? 'opacity-60 cursor-not-allowed bg-[#080D18] border-[#1B2438]'
                  : isSelected
                  ? 'cursor-pointer bg-gradient-to-b from-[#1E1940] to-[#110D28] border-[#8B5CF6] shadow-[0_0_18px_rgba(124,58,237,0.38)] scale-[1.015]'
                  : 'cursor-pointer bg-[#070B14] border-[#1E293B] hover:border-[#475569] hover:bg-[#0D1424] active:scale-[0.98]'
              }`}
            >
              <span
                className={`font-mono-numbers font-black tracking-wider uppercase leading-none transition-colors ${
                  isCompactLandscape ? 'text-[7.5px]' : 'text-[9px]'
                } ${isSelected ? 'text-[#DDD6FE]' : 'text-[#64748B]'}`}
              >
                {ORDINALS[idx]}
              </span>

              <span
                className={`font-mono-numbers font-black leading-none mt-0.5 transition-colors ${
                  isCompactLandscape
                    ? 'text-[clamp(17px,5.2dvh,26px)]'
                    : 'text-[clamp(22px,4dvh,36px)]'
                } ${isSelected ? 'text-[#FBBF24]' : 'text-white'}`}
              >
                {digit}
              </span>

              {isSelected && (
                <span className="absolute -bottom-0.5 w-5 h-0.5 rounded-full bg-[#8B5CF6] shadow-[0_0_8px_#8B5CF6]" />
              )}
            </button>
          );
        })}
      </div>

      {/* Tactile 3x4 Numeric Keypad (0–9, Clear, Reset) */}
      <div className="flex-1 min-h-0 grid grid-cols-3 grid-rows-4 gap-[clamp(4px,0.8dvh,9px)]">
        {KEYPAD_NUMS.map((num) => {
          const isCurrentSlotValue = digits[activeSlot] === String(num);
          const disabled = isTimedOut || isSubmitting;

          return (
            <button
              key={num}
              type="button"
              disabled={disabled}
              onClick={() => handleKeypadPress(num)}
              className={`ef-touch-btn rounded-xl font-mono-numbers font-extrabold flex items-center justify-center transition-all border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A78BFA] ${
                isCompactLandscape
                  ? 'text-[clamp(13px,3.8dvh,18px)]'
                  : 'text-[clamp(15px,2.4dvh,22px)]'
              } ${
                disabled
                  ? 'opacity-45 cursor-not-allowed bg-[#070B14] border-[#1B2438] text-[#64748B]'
                  : isCurrentSlotValue
                  ? 'cursor-pointer bg-[#141A33] hover:bg-[#1B2344] active:scale-[0.96] border-[#7C3AED]/70 text-[#FBBF24] shadow-[inset_0_0_12px_rgba(124,58,237,0.18)]'
                  : 'cursor-pointer bg-[#070B14] hover:bg-[#11192B] active:bg-[#1B2540] active:scale-[0.96] border-[#1E293B] hover:border-[#7C3AED]/50 text-white shadow-sm'
              }`}
            >
              {num}
            </button>
          );
        })}

        <button
          type="button"
          disabled={isTimedOut || isSubmitting}
          onClick={handleClearSlot}
          title="Clear active digit"
          className={`ef-touch-btn rounded-xl font-mono-numbers font-bold flex items-center justify-center transition-all border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 ${
            isCompactLandscape ? 'text-[10.5px]' : 'text-xs sm:text-sm'
          } ${
            isTimedOut || isSubmitting
              ? 'opacity-45 cursor-not-allowed bg-[#160E17] border-rose-900/20 text-rose-400/50'
              : 'cursor-pointer bg-[#18101A] hover:bg-[#271528] active:bg-[#331B34] active:scale-[0.96] border-rose-500/30 text-rose-300'
          }`}
        >
          Clear
        </button>

        <button
          type="button"
          disabled={isTimedOut || isSubmitting}
          onClick={() => handleKeypadPress(0)}
          className={`ef-touch-btn rounded-xl font-mono-numbers font-extrabold flex items-center justify-center transition-all border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A78BFA] ${
            isCompactLandscape
              ? 'text-[clamp(13px,3.8dvh,18px)]'
              : 'text-[clamp(15px,2.4dvh,22px)]'
          } ${
            isTimedOut || isSubmitting
              ? 'opacity-45 cursor-not-allowed bg-[#070B14] border-[#1B2438] text-[#64748B]'
              : digits[activeSlot] === '0'
              ? 'cursor-pointer bg-[#141A33] hover:bg-[#1B2344] active:scale-[0.96] border-[#7C3AED]/70 text-[#FBBF24]'
              : 'cursor-pointer bg-[#070B14] hover:bg-[#11192B] active:bg-[#1B2540] active:scale-[0.96] border-[#1E293B] hover:border-[#7C3AED]/50 text-white shadow-sm'
          }`}
        >
          0
        </button>

        <button
          type="button"
          disabled={isTimedOut || isSubmitting}
          onClick={handleResetAll}
          title="Reset all 4 digits to 0000"
          className={`ef-touch-btn rounded-xl font-mono-numbers font-bold flex items-center justify-center transition-all border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 ${
            isCompactLandscape ? 'text-[10.5px]' : 'text-xs sm:text-sm'
          } ${
            isTimedOut || isSubmitting
              ? 'opacity-45 cursor-not-allowed bg-[#0D1320] border-[#1E293B] text-[#64748B]'
              : 'cursor-pointer bg-[#111827] hover:bg-[#1B253A] active:bg-[#24324E] active:scale-[0.96] border-[#263248] text-[#CBD5E1] hover:text-white'
          }`}
        >
          Reset
        </button>
      </div>

      {/* Clean Quick Helper Bar (Lucky Pick + Reset 0000 only) */}
      <div className="flex items-center justify-between gap-2 pt-0.5 px-0.5 text-[clamp(10px,1.1vw,12px)] shrink-0">
        <button
          type="button"
          disabled={isTimedOut || isSubmitting}
          onClick={handleRandomize}
          className="ef-touch-btn inline-flex items-center gap-1.5 text-[#CBD5E1] hover:text-[#FBBF24] disabled:opacity-45 cursor-pointer disabled:cursor-not-allowed font-bold transition-colors"
        >
          <Dices className="w-3.5 h-3.5 text-[#F59E0B]" />
          <span>Lucky Pick</span>
        </button>

        <button
          type="button"
          disabled={isTimedOut || isSubmitting}
          onClick={handleResetAll}
          className="ef-touch-btn inline-flex items-center gap-1 text-[#94A3B8] hover:text-rose-400 disabled:opacity-45 cursor-pointer disabled:cursor-not-allowed font-semibold transition-colors"
        >
          <RotateCcw className="w-3 h-3" />
          <span>0000</span>
        </button>
      </div>
    </section>
  );

  const renderPurchasePanel = () => (
    <section
      aria-label="Direct Purchase Summary"
      className="ef-game-card rounded-xl flex flex-col justify-between min-h-0 h-full overflow-hidden p-[clamp(6px,1.3dvh,16px)] gap-[clamp(6px,1.1dvh,12px)]"
    >
      {/* Column 2 Header */}
      <div className="flex items-center justify-between gap-1.5 pb-[clamp(5px,0.9dvh,10px)] border-b border-[#1E293B] shrink-0">
        <div className="flex items-center gap-1.5 min-w-0">
          <div className="w-[clamp(20px,3.2dvh,28px)] h-[clamp(20px,3.2dvh,28px)] rounded-lg bg-[#F59E0B]/15 border border-[#F59E0B]/35 flex items-center justify-center text-[#FBBF24] shrink-0">
            <Ticket className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
          </div>
          <h2 className="font-display font-extrabold text-[clamp(10.5px,1.3vw,15px)] text-white leading-tight whitespace-nowrap">
            Purchase
          </h2>
        </div>

        <span className="text-[clamp(7.5px,0.85vw,9.5px)] font-mono-numbers px-1.5 sm:px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-bold uppercase shrink-0">
          INSTANT
        </span>
      </div>

      {/* Focused Payment Breakdown Card (Evenly Distributed & Clip-Free) */}
      <div className="flex-1 min-h-0 flex flex-col justify-evenly rounded-xl bg-[#070B14] border border-[#1B2438] p-[clamp(7px,1.2vw,16px)] font-mono-numbers overflow-hidden gap-[clamp(4px,0.8dvh,10px)]">
        {/* Unit Ticket Price */}
        <div className="flex items-center justify-between gap-1.5 text-[clamp(9.5px,1.05vw,13px)] min-w-0">
          <span className="text-[#94A3B8] truncate min-w-0">
            {viewport.width < 900 ? 'Unit Price' : 'Unit Ticket Price'}
          </span>
          <strong className="text-white font-bold shrink-0 whitespace-nowrap">
            {ticketPrice.toFixed(2)} USDT
          </strong>
        </div>

        {/* Gas / Escrow */}
        <div className="flex items-center justify-between gap-1.5 text-[clamp(9.5px,1.05vw,13px)] min-w-0">
          <span className="text-[#94A3B8] truncate min-w-0">Gas / Escrow</span>
          <span className="text-emerald-400 font-bold shrink-0 whitespace-nowrap">
            0.00 USDT
          </span>
        </div>

        {/* Total Purchase */}
        <div className="flex items-center justify-between gap-1.5 pt-[clamp(5px,1.1dvh,12px)] border-t border-[#1B2438] min-w-0">
          <span className="text-[#DDD6FE] font-bold text-[clamp(10px,1.15vw,14px)] truncate min-w-0">
            {viewport.width < 900 ? 'Total' : 'Total Purchase'}
          </span>
          <strong className="text-[#FBBF24] font-black text-[clamp(11px,1.4vw,18px)] shrink-0 whitespace-nowrap">
            {totalPurchaseCost.toFixed(2)} USDT
          </strong>
        </div>

        {/* Available Wallet Balance */}
        <div className="flex items-center justify-between gap-1.5 pt-[clamp(5px,1dvh,10px)] border-t border-[#1B2438]/60 text-[clamp(9.5px,1.05vw,12.5px)] min-w-0">
          <span className="flex items-center gap-1 text-[#94A3B8] truncate min-w-0">
            <Wallet className="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0" />
            <span className="truncate">{viewport.width < 900 ? 'Balance' : 'Wallet Balance'}</span>
          </span>
          <span
            className={`font-bold shrink-0 whitespace-nowrap ${
              user && !hasSufficientBalance ? 'text-rose-400' : 'text-emerald-400'
            }`}
          >
            {walletBalance.toFixed(2)} USDT
          </span>
        </div>
      </div>

      {/* Golden-Yellow Primary Purchase / Login Action Button */}
      <button
        type="button"
        onClick={handlePurchaseAction}
        disabled={isPurchaseDisabled}
        className={`ef-touch-btn w-full rounded-xl font-display font-black uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all shadow-lg whitespace-nowrap shrink-0 ${
          isCompactLandscape
            ? 'h-[clamp(32px,10dvh,40px)] text-[10.5px] px-2'
            : 'h-[clamp(40px,6dvh,48px)] text-xs sm:text-sm px-3'
        } ${
          isSubmitting
            ? 'bg-amber-400/80 text-black cursor-wait'
            : !user
            ? 'btn-gold cursor-pointer shadow-[#F59E0B]/25 active:scale-[0.98]'
            : isAlreadyPurchasedByMe
            ? 'bg-[#181D29] text-purple-300 border border-purple-500/40 cursor-not-allowed opacity-85'
            : isSoldToAnyPlayer
            ? 'bg-[#181D29] text-rose-300 border border-rose-500/40 cursor-not-allowed opacity-85'
            : !hasSufficientBalance
            ? 'bg-[#181D29] text-[#94A3B8] border border-[#263248] cursor-not-allowed opacity-85'
            : 'btn-gold cursor-pointer shadow-[#F59E0B]/25 active:scale-[0.98]'
        }`}
      >
        {isSubmitting ? (
          <>
            <div className="w-3.5 h-3.5 border-2 border-black border-t-transparent rounded-full animate-spin" />
            <span>Processing...</span>
          </>
        ) : !user ? (
          <>
            <Lock className="w-3.5 h-3.5 shrink-0" />
            <span>
              {isCompactLandscape
                ? `Log In · ${totalPurchaseCost.toFixed(0)} USDT`
                : `Log In · ${totalPurchaseCost.toFixed(2)} USDT`}
            </span>
          </>
        ) : isAlreadyPurchasedByMe ? (
          <>
            <AlertCircle className="w-3.5 h-3.5 text-purple-400 shrink-0" />
            <span>Already Owned</span>
          </>
        ) : isSoldToAnyPlayer ? (
          <>
            <AlertCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
            <span>Sold Out</span>
          </>
        ) : !hasSufficientBalance ? (
          <span>Insufficient Balance</span>
        ) : (
          <>
            <Zap className="w-3.5 h-3.5 fill-current shrink-0" />
            <span>
              {isCompactLandscape
                ? `Buy · ${totalPurchaseCost.toFixed(0)} USDT`
                : `Buy Ticket · ${totalPurchaseCost.toFixed(2)} USDT`}
            </span>
          </>
        )}
      </button>
    </section>
  );

  const renderActivityPanel = () => (
    <section
      aria-label="Live Recent Activity"
      className="ef-game-card rounded-xl flex flex-col justify-between min-h-0 h-full overflow-hidden p-[clamp(8px,1.4dvh,16px)] gap-[clamp(6px,1dvh,12px)]"
    >
      {/* Column 3 Header */}
      <div className="flex items-center justify-between gap-1 pb-[clamp(5px,0.9dvh,10px)] border-b border-[#1E293B] shrink-0">
        <div className="flex items-center gap-1 sm:gap-1.5 min-w-0">
          {!isCompactLandscape && (
            <div className="w-[clamp(20px,3dvh,28px)] h-[clamp(20px,3dvh,28px)] rounded-lg bg-[#10B981]/15 border border-[#10B981]/30 flex items-center justify-center text-[#10B981] shrink-0">
              <Activity className="w-3.5 h-3.5" />
            </div>
          )}
          <h2 className="font-display font-extrabold text-[clamp(10px,1.2vw,14px)] text-white whitespace-nowrap">
            Activity
          </h2>
          <span className="text-[clamp(7.5px,0.85vw,9.5px)] font-mono-numbers font-black px-1.5 py-0.5 rounded-full bg-[#10B981]/15 text-[#10B981] border border-[#10B981]/30 shrink-0 whitespace-nowrap">
            {roomActivityTickets.length}
          </span>
        </div>

        <span className="flex items-center gap-1 text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded-md border border-emerald-500/20 text-[clamp(7.5px,0.85vw,9.5px)] font-mono-numbers font-bold shrink-0 whitespace-nowrap">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
          <span>Live</span>
        </span>
      </div>

      {/* Internal Vertical Scrollable Feed (Never Scrolls Page) */}
      {roomActivityTickets.length === 0 ? (
        <div className="flex-1 min-h-0 flex flex-col items-center justify-center p-2 text-center space-y-1">
          {!isUltraNarrowLandscape && (
            <Activity className="w-4 h-4 sm:w-5 sm:h-5 text-[#64748B] opacity-60 shrink-0" />
          )}
          <p className="font-bold text-white text-[clamp(10px,1.2vw,13px)] leading-tight">
            No tickets minted yet
          </p>
          {!isUltraNarrowLandscape && (
            <p className="text-[clamp(9px,1vw,11px)] text-[#64748B] leading-snug max-w-[220px]">
              Be the first to claim a 4-digit combination in this live draw.
            </p>
          )}
        </div>
      ) : (
        <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar space-y-1.5 pr-0.5">
          {roomActivityTickets.map((tkt: any, idx: number) => {
            const isMine =
              (user && (tkt.userId === user.id || tkt.user_id === user.id)) ||
              (wallet?.address && tkt.userAddress === wallet.address);
            const rawName =
              tkt.username ||
              (tkt.userAddress
                ? `${tkt.userAddress.slice(0, 5)}..${tkt.userAddress.slice(-3)}`
                : `@p_${tkt.id ? String(tkt.id).slice(-4) : idx}`);
            const displayUsername = isMine
              ? '★ You'
              : rawName.startsWith('@')
              ? rawName
              : `@${rawName}`;
            const ticketNumberFormatted = `#${String(tkt.ticketNumber).padStart(4, '0')}`;

            return (
              <div
                key={tkt.id || idx}
                className={`px-2 py-1.5 rounded-lg border flex items-center justify-between gap-1.5 text-[10px] sm:text-xs font-mono-numbers transition-colors ${
                  isMine
                    ? 'bg-[#7C3AED]/15 border-[#7C3AED]/40 text-[#DDD6FE]'
                    : 'bg-[#070B14] border-[#1B2438] hover:border-[#2C3A57] text-white'
                }`}
              >
                <div className="flex items-center gap-1.5 min-w-0">
                  <span
                    className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                      isMine ? 'bg-[#F59E0B]' : 'bg-[#10B981]'
                    }`}
                  />
                  <span className="font-bold truncate text-[10px] sm:text-[11px] text-[#E2E8F0]">
                    {displayUsername}
                  </span>
                  {!isCompactLandscape && (
                    <span className="text-[9.5px] text-[#64748B] shrink-0 hidden xl:inline">
                      {formatTimeAgo(Number(tkt.purchaseTime || Date.now()))}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="font-black text-[10px] sm:text-[11px] text-[#10B981] bg-[#10B981]/10 px-1.5 py-0.5 rounded border border-[#10B981]/25">
                    {ticketNumberFormatted}
                  </span>
                  <span className="text-[10px] sm:text-[11px] font-bold text-[#FBBF24]">
                    {tkt.price || ticketPrice} USDT
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );

  // ---------------------------------------------------------------------------
  // 12. Main Render (Portrait Guard Overlay + Distraction-Free 3-Column Room)
  // ---------------------------------------------------------------------------
  return (
    <div className="relative w-full h-full max-h-full min-h-0 overflow-hidden select-none bg-[#080C16]">
      {/* Subtle Ambient Background Accents */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-24 -left-24 w-72 h-72 rounded-full bg-[#7C3AED]/10 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-24 -right-24 w-72 h-72 rounded-full bg-[#F59E0B]/8 blur-3xl"
      />

      {/* MANDATORY MOBILE PORTRAIT ORIENTATION GUARD (Full-Screen Blocking Overlay) */}
      {isMobilePortrait && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Rotate Device to Landscape Mode"
          className="fixed inset-0 z-50 bg-[#070B14]/98 backdrop-blur-xl flex flex-col items-center justify-between p-6 text-center overflow-hidden"
        >
          {/* Top Brand Identity */}
          <div className="flex items-center gap-2 shrink-0 pt-2">
            <img
              src="/logo.png"
              alt="EarnFlow.in"
              className="w-8 h-8 rounded-full border border-amber-400/50 object-cover"
            />
            <span className="font-display font-black text-base text-white">
              EarnFlow<span className="text-[#F5C451]">.in</span>
            </span>
          </div>

          {/* Center Rotation Guidance */}
          <div className="max-w-xs w-full flex flex-col items-center space-y-5 my-auto">
            <div className="relative w-24 h-24 rounded-3xl bg-[#111728] border border-[#7C3AED]/40 flex items-center justify-center shadow-[0_0_35px_rgba(124,58,237,0.25)]">
              <Smartphone className="w-11 h-11 text-[#FBBF24] ef-rotate-phone-anim" />
            </div>

            <div className="space-y-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 text-[10px] font-mono-numbers font-bold uppercase tracking-wider">
                Landscape Mode Required
              </span>
              <h1 className="font-display font-extrabold text-lg text-white leading-snug">
                Please Rotate Your Device to Landscape Mode to Play
              </h1>
              <p className="text-xs text-[#94A3B8] leading-relaxed">
                The Four-Digit Lottery Game Room runs in widescreen landscape so your digit controls, purchase summary, and live draw feed stay on one screen.
              </p>
            </div>

            <button
              type="button"
              onClick={handleRequestLandscapeFullscreen}
              className="ef-touch-btn btn-gold w-full py-3 px-4 rounded-xl text-xs font-extrabold flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-amber-500/20"
            >
              <Maximize2 className="w-4 h-4 shrink-0" />
              <span>Switch to Landscape Fullscreen</span>
            </button>

            {orientationLockMessage && (
              <p className="text-[11px] text-amber-300/90 leading-snug">
                {orientationLockMessage}
              </p>
            )}
          </div>

          {/* Bottom Preserved State Note */}
          <div className="shrink-0 pb-2 text-[11px] font-mono-numbers text-[#64748B]">
            Game session &amp; wallet state preserved
          </div>
        </div>
      )}

      {/* GAME ROOM WORKSTATION (Kept mounted while hidden in mobile portrait to preserve state) */}
      <div
        aria-hidden={isMobilePortrait}
        className={`ef-game-room-shell relative z-10 text-left ${
          isMobilePortrait ? 'invisible pointer-events-none' : ''
        }`}
      >
        <div className="w-full max-w-[1640px] mx-auto my-auto flex-1 min-h-0 flex flex-col justify-center gap-[clamp(6px,1.1dvh,14px)]">
          {/* ================================================================= */}
          {/* A. COMPACT TELEMETRY HEADER BAR (NO TOP NAVBAR, NO BACK BUTTON)   */}
          {/* ================================================================= */}
          <header className="ef-game-card rounded-xl w-full shrink-0 px-[clamp(8px,1.2vw,16px)] py-[clamp(5px,0.85dvh,10px)] flex items-center justify-between gap-2 overflow-hidden">
            {/* Left: Draw Identification, LIVE & VRF Indicators */}
            <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
              <div className="flex items-center gap-1 min-w-0">
                <Hash className="w-3.5 h-3.5 text-[#F59E0B] shrink-0 hidden sm:block" />
                <h1 className="font-display font-black text-white text-[clamp(10.5px,1.35vw,15px)] truncate max-w-[90px] sm:max-w-[200px] md:max-w-xs">
                  {eventTitle}
                </h1>
              </div>

              {!isUltraNarrowLandscape && (
                <span className="text-[clamp(8.5px,1vw,11px)] font-mono-numbers text-[#94A3B8] font-semibold shrink-0 whitespace-nowrap">
                  {drawIdFormatted}
                </span>
              )}

              <span
                className={`px-1.5 sm:px-2 py-0.5 rounded-full text-[clamp(7.5px,0.95vw,10px)] font-mono-numbers font-extrabold uppercase flex items-center gap-1 shrink-0 whitespace-nowrap ${statusInfo.badgeClass}`}
              >
                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${statusInfo.dotClass}`} />
                <span>{statusInfo.label}</span>
              </span>

              <button
                type="button"
                onClick={() => setIsVrfModalOpen(true)}
                title="View VRF Cryptographic Commitment"
                className="ef-touch-btn inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-500/12 hover:bg-emerald-500/22 text-emerald-300 border border-emerald-500/30 text-[clamp(7.5px,0.95vw,10px)] font-mono-numbers font-bold cursor-pointer transition-colors shrink-0 whitespace-nowrap"
              >
                <ShieldCheck className="w-3 h-3 shrink-0" />
                <span>VRF</span>
              </button>
            </div>

            {/* Right: Entry Price, Jackpot Amount & Live Countdown */}
            <div className="flex items-center gap-1.5 sm:gap-3 font-mono-numbers shrink-0">
              <div className="flex items-center gap-0.5 sm:gap-1 text-[clamp(8.5px,1.05vw,12px)] whitespace-nowrap">
                {!isUltraNarrowLandscape && <span className="text-[#94A3B8]">Entry:</span>}
                <strong className="text-white font-bold">{ticketPrice} USDT</strong>
              </div>

              <div className="flex items-center gap-0.5 sm:gap-1 text-[clamp(8.5px,1.05vw,12px)] whitespace-nowrap">
                <Trophy className="w-3 h-3 text-[#F59E0B] shrink-0" />
                <span className="text-[#94A3B8] hidden sm:inline">Jackpot:</span>
                <strong className="text-[#FBBF24] font-extrabold">{jackpotDisplay}</strong>
              </div>

              <div className="flex items-center gap-1 text-[clamp(9px,1.05vw,12.5px)] bg-[#070B14] px-2 py-0.5 rounded-lg border border-[#1E293B] shrink-0 whitespace-nowrap">
                <Clock className="w-3 h-3 text-[#A78BFA] shrink-0" />
                <span className="text-[#DDD6FE] font-bold">{countdownFormatted}</span>
              </div>
            </div>
          </header>

          {/* ================================================================= */}
          {/* B. UNIFIED THREE-COLUMN GAME STAGE ACROSS ALL DEVICES             */}
          {/* ================================================================= */}
          {isUltraNarrowLandscape ? (
            /* Ultra-Narrow Edge Case (< 500px wide): 50% Pick 4 Digits | 50% Purchase + Activity */
            <div className="flex-1 min-h-0 grid grid-cols-[minmax(0,50fr)_minmax(0,50fr)] gap-1.5">
              {renderDigitSelectionPanel()}
              <div className="min-h-0 h-full grid grid-rows-[minmax(0,1.4fr)_minmax(52px,0.6fr)] gap-1.5">
                {renderPurchasePanel()}
                {renderActivityPanel()}
              </div>
            </div>
          ) : (
            /* Preferred 3-Column Horizontal Interface (Mobile Landscape, Tablet, Laptop, Desktop, 4K) */
            <div
              className={`flex-1 min-h-0 grid grid-cols-[minmax(0,38fr)_minmax(0,34fr)_minmax(0,28fr)] gap-[clamp(6px,1.1vw,16px)] ${
                !isCompactLandscape ? 'max-h-[clamp(420px,70dvh,600px)]' : ''
              }`}
            >
              {renderDigitSelectionPanel()}
              {renderPurchasePanel()}
              {renderActivityPanel()}
            </div>
          )}
        </div>
      </div>

      {/* ===================================================================== */}
      {/* VRF COMMITMENT VERIFICATION MODAL (ACTIVE DRAW AUDIT INFO)            */}
      {/* ===================================================================== */}
      {isVrfModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          data-game-modal="true"
          onClick={() => setIsVrfModalOpen(false)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-150"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-2xl bg-[#0E1525] border border-emerald-500/35 p-4 sm:p-5 shadow-2xl space-y-3.5 text-left"
          >
            <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-[#1E293B]">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-8 h-8 rounded-xl bg-emerald-500/15 border border-emerald-500/35 flex items-center justify-center text-emerald-400 shrink-0">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <h3 className="font-display font-extrabold text-sm text-white truncate">
                    VRF Provably Fair Commitment
                  </h3>
                  <p className="text-[10px] font-mono-numbers text-[#94A3B8]">
                    {eventTitle} · {drawIdFormatted}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsVrfModalOpen(false)}
                className="w-7 h-7 rounded-lg bg-[#161F33] hover:bg-[#1F2A44] text-[#94A3B8] hover:text-white flex items-center justify-center cursor-pointer shrink-0"
                aria-label="Close VRF modal"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2.5 text-xs font-mono-numbers">
              <div className="p-2.5 rounded-xl bg-[#070B14] border border-[#1B2438] space-y-1">
                <span className="text-[10px] text-emerald-400 font-bold uppercase block">
                  Pre-Draw SHA-256 Commit Hash
                </span>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] text-amber-300 truncate select-all">
                    {event?.sha256Seed || event?.sha256_seed || 'Committed on-chain prior to draw'}
                  </span>
                  {(event?.sha256Seed || event?.sha256_seed) && (
                    <button
                      type="button"
                      onClick={handleCopySeed}
                      className="p-1 rounded hover:bg-white/10 text-[#94A3B8] hover:text-white cursor-pointer shrink-0"
                      title="Copy Commit Hash"
                    >
                      {copiedSeed ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="p-2.5 rounded-xl bg-[#070B14] border border-[#1B2438]">
                  <span className="text-[9.5px] text-[#94A3B8] block">Ticket Snapshot</span>
                  <strong className="text-white text-xs">
                    {roomActivityTickets.length} Minted
                  </strong>
                </div>
                <div className="p-2.5 rounded-xl bg-[#070B14] border border-[#1B2438]">
                  <span className="text-[9.5px] text-[#94A3B8] block">Seed Status</span>
                  <strong className="text-emerald-400 text-xs">Locked Pre-Draw</strong>
                </div>
              </div>

              <p className="text-[11px] font-sans text-[#94A3B8] leading-relaxed">
                The secret server seed is cryptographically hashed before ticket sales begin and revealed upon official draw settlement so outcomes cannot be altered.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
