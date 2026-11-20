import React, { useState, useEffect } from 'react';
import { useGameEngine } from '../hooks/useGameEngine';
import { generateBingoResult } from '../engine';
import { 
  Play, 
  Sparkles, 
  Clock, 
  CheckCircle2, 
  TrendingUp, 
  ShieldCheck, 
  Flame,
  Award,
  Zap,
  RotateCcw,
  Coins,
  History
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { soundFX } from '../engine/SoundFXService';

type BetSelectionType = 'color' | 'number' | 'size';

interface BetSelection {
  type: BetSelectionType;
  value: string | number; // 'green' | 'violet' | 'red' | 'big' | 'small' | 0..9
  odds: number;
  label: string;
}

export interface BingoGameProps {
  room?: any;
  activityBox?: React.ReactNode;
}

/**
 * Bingo Color Trading Game
 * Designed strictly in Google Stitch (Obsidian Sovereign Design System: #0B0F19, #111728, #7C3AED, #F59E0B, #10B981)
 */
export default function BingoGame({ room, activityBox }: BingoGameProps) {
  const {
    game,
    betAmount,
    setBetAmount,
    doubleBet,
    halveBet,
    setMinBet,
    setMaxBet,
    seeds,
    startRound,
    settleRound,
    walletBalance,
    loading
  } = useGameEngine('bingo');

  // Enforce room-specific stake bounds
  useEffect(() => {
    if (room?.minStakeFC && betAmount < room.minStakeFC) {
      setBetAmount(room.minStakeFC);
    } else if (room?.maxStakeFC && betAmount > room.maxStakeFC) {
      setBetAmount(room.maxStakeFC);
    }
  }, [room?.minStakeFC, room?.maxStakeFC]);

  // Viewport tracking for responsive layout
  const [viewport, setViewport] = useState({
    width: typeof window !== 'undefined' ? window.innerWidth : 1200,
    height: typeof window !== 'undefined' ? window.innerHeight : 800
  });

  useEffect(() => {
    const handleResize = () => {
      setViewport({ width: window.innerWidth, height: window.innerHeight });
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const isMobileLandscape = viewport.width > viewport.height && viewport.height < 540;
  const isMobilePortrait = viewport.width < 768 && !isMobileLandscape;

  // Selected Bet State
  const [selectedBet, setSelectedBet] = useState<BetSelection>({
    type: 'color',
    value: 'green',
    odds: 2.0,
    label: 'GREEN (2.0x)'
  });

  const [isPlaying, setIsPlaying] = useState(false);
  const [roundOutcome, setRoundOutcome] = useState<{
    number: number;
    color: 'red' | 'green' | 'violet';
    hasViolet: boolean;
    size: 'big' | 'small';
  } | null>(null);

  const [lastResult, setLastResult] = useState<'won' | 'lost' | null>(null);
  const [countdown, setCountdown] = useState(25);
  const [isRevealing, setIsRevealing] = useState(false);

  // History strip of recent color rounds
  const [history, setHistory] = useState<Array<{ number: number; color: 'red' | 'green' | 'violet'; hasViolet?: boolean; size: 'big' | 'small' }>>([
    { number: 7, color: 'green', size: 'big' },
    { number: 2, color: 'red', size: 'small' },
    { number: 0, color: 'red', hasViolet: true, size: 'small' },
    { number: 9, color: 'green', size: 'big' },
    { number: 5, color: 'green', hasViolet: true, size: 'big' },
    { number: 4, color: 'red', size: 'small' },
    { number: 8, color: 'red', size: 'big' },
    { number: 3, color: 'green', size: 'small' }
  ]);

  // 30-second cycle countdown ticker
  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) return 30;
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const potentialPayout = parseFloat((betAmount * selectedBet.odds).toFixed(2));
  const netProfit = parseFloat((potentialPayout - betAmount).toFixed(2));

  // Quick preset helper
  const handleQuickAdd = (addVal: number) => {
    const maxVal = room?.maxStakeFC || 2000;
    setBetAmount(Math.min(maxVal, betAmount + addVal));
  };

  // Handle Trade / Bet Action
  const handleTrade = async () => {
    if (isPlaying || loading) return;

    const startRes = await startRound();
    if (!startRes.success) return;

    soundFX.playChipBet();
    setIsPlaying(true);
    setIsRevealing(true);
    setLastResult(null);

    // Provably fair generation
    const outcome = await generateBingoResult(
      seeds.serverHash || 'seed_bingo_default',
      seeds.clientSeed,
      seeds.nonce
    );

    // Dramatic 1.2s reveal
    setTimeout(() => {
      finalizeRound(outcome);
    }, 1200);
  };

  const finalizeRound = async (outcome: { number: number; color: 'red' | 'green' | 'violet'; hasViolet: boolean; size: 'big' | 'small' }) => {
    setRoundOutcome(outcome);
    setIsRevealing(false);
    setIsPlaying(false);

    // Determine win condition
    let isWin = false;
    let effectiveMultiplier = 0;

    if (selectedBet.type === 'color') {
      if (selectedBet.value === 'violet' && outcome.hasViolet) {
        isWin = true;
        effectiveMultiplier = 4.5;
      } else if (selectedBet.value === 'green' && outcome.color === 'green') {
        isWin = true;
        effectiveMultiplier = outcome.hasViolet ? 1.5 : 2.0;
      } else if (selectedBet.value === 'red' && outcome.color === 'red') {
        isWin = true;
        effectiveMultiplier = outcome.hasViolet ? 1.5 : 2.0;
      }
    } else if (selectedBet.type === 'number') {
      if (selectedBet.value === outcome.number) {
        isWin = true;
        effectiveMultiplier = 9.0;
      }
    } else if (selectedBet.type === 'size') {
      if (selectedBet.value === outcome.size) {
        isWin = true;
        effectiveMultiplier = 1.98;
      }
    }

    const payout = isWin ? parseFloat((betAmount * effectiveMultiplier).toFixed(2)) : 0;
    setLastResult(isWin ? 'won' : 'lost');

    // Add to history
    setHistory((prev) => [outcome, ...prev.slice(0, 11)]);

    if (isWin) {
      soundFX.playWinFanfare('standard');
      try {
        confetti({
          particleCount: 85,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#10B981', '#7C3AED', '#EF4444', '#F59E0B']
        });
      } catch (_) {}
    } else {
      soundFX.playCoinflipLand(false);
    }

    // Settle with backend engine
    await settleRound({
      multiplier: effectiveMultiplier,
      payout,
      outcomeData: {
        drawnNumber: outcome.number,
        drawnColor: outcome.color,
        hasViolet: outcome.hasViolet,
        drawnSize: outcome.size,
        betType: selectedBet.type,
        betValue: selectedBet.value
      }
    });
  };

  return (
    <div className="w-full flex-1 flex flex-col min-h-0 text-left space-y-2 select-none">
      
      {/* 1. COMPACT IN-GAME TELEMETRY STRIP (NO SEPARATE NAVIGATION STRIP) */}
      <div className="p-2 sm:px-3 rounded-xl bg-[#111728]/95 border border-[#1B2238] flex flex-wrap items-center justify-between gap-2 shrink-0 shadow-md">
        {/* Left: Room Title, Live Status, Countdown & Round */}
        <div className="flex items-center gap-2 shrink-0">
          <span className="font-display font-black text-white text-xs sm:text-sm tracking-wide">
            {room?.name || 'Bingo Color Trading'}
          </span>
          <span className="px-2 py-0.5 rounded-full bg-[#10B981]/15 text-[#10B981] border border-[#10B981]/30 text-[10px] font-mono-numbers font-extrabold uppercase flex items-center gap-1 shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-[#10B981] animate-ping" />
            <span>LIVE</span>
          </span>
          <div className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-amber-500/15 text-amber-300 border border-amber-500/30 font-mono-numbers font-black text-xs">
            <Clock className="w-3.5 h-3.5 text-amber-400" />
            <span>00:{countdown.toString().padStart(2, '0')}</span>
          </div>
          <span className="text-[10px] font-mono-numbers px-2 py-0.5 rounded bg-[#7C3AED]/15 text-[#D2BBFF] border border-[#7C3AED]/30 font-bold uppercase">
            ROUND #{seeds.nonce}
          </span>
          <div className="hidden sm:flex items-center gap-2 text-[11px] font-mono-numbers text-[#94A3B8] ml-1">
            <span>Entry: <strong className="text-white">{room?.minStakeFC || 1} - {room?.maxStakeFC || 1000} USDT</strong></span>
            <span>•</span>
            <span>Max Odds: <strong className="text-[#F59E0B]">9.0x</strong></span>
          </div>
        </div>

        {/* Right: History Balls Strip */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5 max-w-[60%] sm:max-w-[70%]">
          <span className="text-[10px] font-mono-numbers uppercase text-[#94A3B8] font-bold shrink-0 hidden md:inline">
            Recent:
          </span>
          {history.map((h, i) => {
            const bg = h.hasViolet 
              ? (h.color === 'green' ? 'bg-gradient-to-r from-emerald-600 to-purple-600' : 'bg-gradient-to-r from-red-600 to-purple-600')
              : h.color === 'green' ? 'bg-emerald-600' : 'bg-red-600';
            return (
              <span
                key={i}
                className={`w-6 h-6 rounded-full ${bg} text-white font-mono-numbers font-black text-xs flex items-center justify-center shadow-xs shrink-0`}
                title={`Number ${h.number} (${h.color.toUpperCase()}${h.hasViolet ? ' + VIOLET' : ''}, ${h.size.toUpperCase()})`}
              >
                {h.number}
              </span>
            );
          })}
        </div>
      </div>

      {/* 2. MAIN WORKSTATION GRID */}
      <div className={`flex-1 min-h-0 grid gap-2 sm:gap-3 overflow-y-auto no-scrollbar ${
        isMobileLandscape ? 'grid-cols-12' : 'grid-cols-1 lg:grid-cols-12'
      }`}>
        
        {/* PREDICTION BOARD & DRAW ARENA (Desktop: 8 cols / Mobile Landscape: 7 cols) */}
        <div className={`flex flex-col space-y-2 ${
          isMobileLandscape ? 'col-span-7 order-1' : 'order-1 lg:order-1 lg:col-span-8'
        }`}>
          
          {/* Active Reveal Display Oracle */}
          <div className="relative rounded-2xl bg-[#0B0F19] border border-[#1B2238] p-4 sm:p-5 flex flex-col items-center justify-center overflow-hidden min-h-[160px] shadow-2xl">
            <div className="absolute top-0 right-0 w-80 h-80 bg-violet-600/10 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-80 h-80 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

            <div className="absolute top-2.5 left-3 flex items-center gap-1.5 text-[10px] font-mono-numbers text-amber-400 z-10">
              <Zap className="w-3.5 h-3.5" />
              <span>Live Draw Oracle</span>
            </div>

            {/* Central Reveal Orb */}
            <div className="my-2 flex flex-col items-center justify-center z-10">
              {isRevealing ? (
                <div className="flex flex-col items-center space-y-2 animate-pulse">
                  <div className="w-20 h-20 rounded-full border-4 border-amber-400 border-t-transparent animate-spin flex items-center justify-center shadow-[0_0_30px_rgba(245,158,11,0.3)]">
                    <span className="text-2xl">🎲</span>
                  </div>
                  <span className="text-xs font-mono-numbers font-black text-amber-300 uppercase tracking-widest">
                    Drawing Color...
                  </span>
                </div>
              ) : roundOutcome ? (
                <div className="flex flex-col items-center space-y-2 animate-in zoom-in-95 duration-200">
                  <div className={`w-20 h-20 rounded-full flex items-center justify-center shadow-[0_0_35px_rgba(245,158,11,0.45)] ${
                    roundOutcome.hasViolet
                      ? (roundOutcome.color === 'green' ? 'bg-gradient-to-tr from-emerald-500 via-purple-600 to-purple-400' : 'bg-gradient-to-tr from-red-500 via-purple-600 to-purple-400')
                      : roundOutcome.color === 'green' ? 'bg-emerald-500' : 'bg-red-500'
                  }`}>
                    <span className="text-3xl font-mono-numbers font-black text-white drop-shadow-md">
                      {roundOutcome.number}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black uppercase text-white px-2.5 py-0.5 rounded-lg bg-black/60 border border-white/20">
                      {roundOutcome.color.toUpperCase()}{roundOutcome.hasViolet ? ' + VIOLET' : ''}
                    </span>
                    <span className="text-xs font-mono-numbers font-bold text-amber-300 px-2.5 py-0.5 rounded-lg bg-black/60 border border-amber-500/30 uppercase">
                      {roundOutcome.size}
                    </span>
                  </div>
                  {lastResult && (
                    <div className={`text-xs font-black uppercase px-4 py-1 rounded-full font-mono-numbers shadow-lg ${
                      lastResult === 'won' 
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/50' 
                        : 'bg-rose-500/20 text-rose-300 border border-rose-500/50'
                    }`}>
                      {lastResult === 'won' ? `🎉 WIN +${potentialPayout} USDT` : 'MISSED · NEXT ROUND'}
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex flex-col items-center space-y-2 text-center">
                  <div className="w-16 h-16 rounded-full bg-violet-600/15 border border-violet-500/30 flex items-center justify-center shadow-lg">
                    <Sparkles className="w-8 h-8 text-amber-400" />
                  </div>
                  <span className="text-sm font-black text-white">Place Your Prediction</span>
                  <span className="text-[11px] text-[#94A3B8]">Choose Color, Number (0–9), or Big/Small below</span>
                </div>
              )}
            </div>
          </div>

          {/* 3 PRIMARY COLOR TRADING CARDS */}
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              disabled={isPlaying}
              onClick={() => setSelectedBet({ type: 'color', value: 'green', odds: 2.0, label: 'GREEN (2.0x)' })}
              className={`p-3 rounded-2xl font-bold flex flex-col items-center justify-center transition-all cursor-pointer shadow-md ${
                selectedBet.type === 'color' && selectedBet.value === 'green'
                  ? 'bg-emerald-500 text-white ring-2 ring-emerald-300 ring-offset-2 ring-offset-[#0B0F19] scale-102 font-black shadow-emerald-500/30'
                  : 'bg-emerald-950/40 hover:bg-emerald-900/50 text-emerald-300 border border-emerald-500/40'
              }`}
            >
              <span className="text-xs sm:text-sm font-black uppercase">Green</span>
              <span className="text-[11px] font-mono-numbers text-emerald-200 font-bold">2.0x Payout</span>
              <span className="text-[9px] text-emerald-300/80">Wins: 1, 3, 7, 9</span>
            </button>

            <button
              type="button"
              disabled={isPlaying}
              onClick={() => setSelectedBet({ type: 'color', value: 'violet', odds: 4.5, label: 'VIOLET (4.5x)' })}
              className={`p-3 rounded-2xl font-bold flex flex-col items-center justify-center transition-all cursor-pointer shadow-md ${
                selectedBet.type === 'color' && selectedBet.value === 'violet'
                  ? 'bg-violet-600 text-white ring-2 ring-violet-300 ring-offset-2 ring-offset-[#0B0F19] scale-102 font-black shadow-violet-500/30'
                  : 'bg-violet-950/40 hover:bg-violet-900/50 text-violet-300 border border-violet-500/40'
              }`}
            >
              <span className="text-xs sm:text-sm font-black uppercase">Violet</span>
              <span className="text-[11px] font-mono-numbers text-violet-200 font-bold">4.5x Payout</span>
              <span className="text-[9px] text-violet-300/80">Wins: 0, 5</span>
            </button>

            <button
              type="button"
              disabled={isPlaying}
              onClick={() => setSelectedBet({ type: 'color', value: 'red', odds: 2.0, label: 'RED (2.0x)' })}
              className={`p-3 rounded-2xl font-bold flex flex-col items-center justify-center transition-all cursor-pointer shadow-md ${
                selectedBet.type === 'color' && selectedBet.value === 'red'
                  ? 'bg-rose-600 text-white ring-2 ring-rose-300 ring-offset-2 ring-offset-[#0B0F19] scale-102 font-black shadow-rose-500/30'
                  : 'bg-rose-950/40 hover:bg-rose-900/50 text-rose-300 border border-rose-500/40'
              }`}
            >
              <span className="text-xs sm:text-sm font-black uppercase">Red</span>
              <span className="text-[11px] font-mono-numbers text-rose-200 font-bold">2.0x Payout</span>
              <span className="text-[9px] text-rose-300/80">Wins: 2, 4, 6, 8</span>
            </button>
          </div>

          {/* NUMBER CHIPS GRID (0 to 9) - PAYS 9X */}
          <div className="p-3 rounded-2xl bg-[#111728]/95 border border-[#1B2238] space-y-2 backdrop-blur-md">
            <div className="flex items-center justify-between text-xs">
              <span className="font-extrabold text-white flex items-center gap-1.5">
                <span>Numbers Grid</span>
                <span className="text-[9px] px-2 py-0.5 rounded bg-amber-500/15 text-amber-300 font-mono-numbers border border-amber-500/30 font-bold">
                  9.0X PAYOUT
                </span>
              </span>
              <span className="text-[10px] text-[#94A3B8]">Direct Number Hits</span>
            </div>

            <div className="grid grid-cols-5 sm:grid-cols-10 gap-1.5">
              {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => {
                const isSelected = selectedBet.type === 'number' && selectedBet.value === num;
                const isGreen = [1, 3, 7, 9].includes(num);
                const isVioletSplit = num === 0 || num === 5;
                const numColorClass = isVioletSplit 
                  ? (num === 0 ? 'bg-gradient-to-r from-rose-600 to-violet-600' : 'bg-gradient-to-r from-emerald-600 to-violet-600')
                  : isGreen ? 'bg-emerald-600' : 'bg-rose-600';

                return (
                  <button
                    key={num}
                    type="button"
                    disabled={isPlaying}
                    onClick={() => setSelectedBet({ type: 'number', value: num, odds: 9.0, label: `NUMBER #${num} (9.0x)` })}
                    className={`py-2 rounded-xl font-mono-numbers font-black text-sm flex flex-col items-center justify-center transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-amber-400 text-black ring-2 ring-amber-300 ring-offset-2 ring-offset-[#0B0F19] scale-105 shadow-lg'
                        : `${numColorClass} text-white hover:brightness-110 shadow-xs`
                    }`}
                  >
                    <span>{num}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* SIZE SELECTION ROW (BIG VS SMALL - 1.98X) */}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              disabled={isPlaying}
              onClick={() => setSelectedBet({ type: 'size', value: 'big', odds: 1.98, label: 'BIG (5–9) 1.98x' })}
              className={`p-3 rounded-2xl font-bold flex items-center justify-between px-4 transition-all cursor-pointer border ${
                selectedBet.type === 'size' && selectedBet.value === 'big'
                  ? 'bg-amber-500/20 border-amber-400 text-white ring-2 ring-amber-400/50 shadow-md'
                  : 'bg-[#111728] hover:bg-[#151C2B] border-[#1F2737] text-[#94A3B8]'
              }`}
            >
              <span className="text-xs uppercase font-black text-white">Big (5 – 9)</span>
              <span className="text-[11px] font-mono-numbers font-black text-amber-300">1.98x</span>
            </button>

            <button
              type="button"
              disabled={isPlaying}
              onClick={() => setSelectedBet({ type: 'size', value: 'small', odds: 1.98, label: 'SMALL (0–4) 1.98x' })}
              className={`p-3 rounded-2xl font-bold flex items-center justify-between px-4 transition-all cursor-pointer border ${
                selectedBet.type === 'size' && selectedBet.value === 'small'
                  ? 'bg-amber-500/20 border-amber-400 text-white ring-2 ring-amber-400/50 shadow-md'
                  : 'bg-[#111728] hover:bg-[#151C2B] border-[#1F2737] text-[#94A3B8]'
              }`}
            >
              <span className="text-xs uppercase font-black text-white">Small (0 – 4)</span>
              <span className="text-[11px] font-mono-numbers font-black text-amber-300">1.98x</span>
            </button>
          </div>

        </div>

        {/* BETTING CONTROLS PANEL (Desktop: 4 cols / Mobile Landscape: 5 cols) */}
        <div className={`bg-[#111728]/95 border border-[#1B2238] rounded-2xl p-3 sm:p-4 flex flex-col justify-between overflow-y-auto no-scrollbar gap-2.5 backdrop-blur-md shadow-xl ${
          isMobileLandscape ? 'col-span-5 order-2' : 'order-2 lg:order-2 lg:col-span-4'
        }`}>
          
          <div className="space-y-3">
            
            {/* Selected Bet Summary Badge */}
            <div className="bg-[#0B0F19] p-2.5 rounded-xl border border-[#1F2737] flex items-center justify-between">
              <span className="text-[11px] text-[#94A3B8] font-mono-numbers">Current Pick:</span>
              <span className="font-mono-numbers font-black text-xs text-amber-300 px-2 py-0.5 rounded bg-amber-500/15 border border-amber-500/30">
                {selectedBet.label}
              </span>
            </div>

            {/* Stake Input with Balance Indicator */}
            <div>
              <div className="flex items-center justify-between text-xs mb-1.5 font-bold font-mono-numbers">
                <span className="text-[#94A3B8] flex items-center gap-1">
                  <Coins className="w-3.5 h-3.5 text-amber-400" />
                  <span>Wager Stake</span>
                </span>
                <span className="text-white text-[11px] font-normal">
                  Bal: <strong className="text-amber-400 font-bold">{walletBalance.toFixed(2)} USDT</strong>
                </span>
              </div>

              <div className="flex items-center bg-[#0B0F19] border border-[#1F2737] focus-within:border-amber-500/60 rounded-xl p-1 transition-colors">
                <input
                  type="number"
                  min={room?.minStakeFC || 1}
                  max={room?.maxStakeFC || 2000}
                  value={betAmount}
                  onChange={(e) => setBetAmount(Math.max(1, parseFloat(e.target.value) || 0))}
                  disabled={isPlaying}
                  className="flex-1 bg-transparent px-3 py-1 text-white font-mono-numbers font-black text-sm outline-none disabled:opacity-50"
                />
                <span className="text-amber-400 font-black text-xs px-2.5 font-mono-numbers">USDT</span>
              </div>
            </div>

            {/* Quick Multiplier Steppers */}
            <div className="grid grid-cols-4 gap-1.5 text-xs font-mono-numbers font-bold">
              <button
                type="button"
                onClick={halveBet}
                disabled={isPlaying}
                className="py-1.5 rounded-lg bg-[#0B0F19] hover:bg-[#151C2B] text-[#94A3B8] hover:text-white border border-[#1F2737] transition-colors cursor-pointer disabled:opacity-40 text-[11px]"
              >
                ½
              </button>
              <button
                type="button"
                onClick={doubleBet}
                disabled={isPlaying}
                className="py-1.5 rounded-lg bg-[#0B0F19] hover:bg-[#151C2B] text-[#94A3B8] hover:text-white border border-[#1F2737] transition-colors cursor-pointer disabled:opacity-40 text-[11px]"
              >
                2×
              </button>
              <button
                type="button"
                onClick={setMinBet}
                disabled={isPlaying}
                className="py-1.5 rounded-lg bg-[#0B0F19] hover:bg-[#151C2B] text-[#94A3B8] hover:text-white border border-[#1F2737] transition-colors cursor-pointer disabled:opacity-40 text-[11px]"
              >
                Min
              </button>
              <button
                type="button"
                onClick={setMaxBet}
                disabled={isPlaying}
                className="py-1.5 rounded-lg bg-[#0B0F19] hover:bg-[#151C2B] text-amber-400 border border-[#1F2737] transition-colors cursor-pointer disabled:opacity-40 text-[11px]"
              >
                Max
              </button>
            </div>

            {/* Quick Add Presets */}
            <div className="grid grid-cols-4 gap-1 text-[10px] font-mono-numbers font-bold">
              {[1, 5, 25, 100].map(val => (
                <button
                  key={val}
                  type="button"
                  onClick={() => handleQuickAdd(val)}
                  disabled={isPlaying}
                  className="py-1 rounded bg-[#0B0F19]/80 hover:bg-[#151C2B] text-violet-300 border border-violet-500/20 transition-colors cursor-pointer disabled:opacity-40"
                >
                  +{val}
                </button>
              ))}
            </div>

            {/* Payout & Odds Dashboard */}
            <div className="grid grid-cols-2 gap-2 text-xs font-mono-numbers pt-1 border-t border-[#1F2737]">
              <div className="bg-[#0B0F19] p-2 rounded-xl border border-[#1F2737]">
                <span className="text-[10px] text-[#94A3B8] block">Odds Multiplier</span>
                <span className="font-black text-sm text-amber-300">{selectedBet.odds}x</span>
              </div>

              <div className="bg-[#0B0F19] p-2 rounded-xl border border-[#1F2737]">
                <span className="text-[10px] text-[#94A3B8] block">Net Win Profit</span>
                <span className="font-black text-sm text-emerald-400">+{netProfit} USDT</span>
              </div>
            </div>

            {/* Total Potential Return */}
            <div className="bg-[#0B0F19] p-2 rounded-xl border border-[#1F2737] text-xs font-mono-numbers flex items-center justify-between">
              <span className="text-[#94A3B8]">Est. Win Return:</span>
              <span className="font-black text-emerald-300 text-sm">
                +{potentialPayout} USDT
              </span>
            </div>

          </div>

          {/* Action Button: Place Bet */}
          <div className="pt-2">
            <button
              type="button"
              onClick={handleTrade}
              disabled={isPlaying || loading}
              className="w-full py-3.5 rounded-xl btn-gold text-black font-black text-sm flex items-center justify-center gap-2 cursor-pointer transition-all shadow-lg active:scale-98 disabled:opacity-50"
            >
              {isPlaying ? (
                <>
                  <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                  <span>Oracle Drawing...</span>
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 fill-current" />
                  <span>Place Bet • {betAmount} USDT</span>
                </>
              )}
            </button>
          </div>

          {/* Embedded In-Room Activity Box */}
          {activityBox && (
            <div className="border-t border-[#1F2737] pt-2">
              {activityBox}
            </div>
          )}

          {/* Edge Telemetry Strip */}
          <div className="flex items-center justify-end pt-1 text-[10px] text-[#94A3B8] font-mono-numbers">
            <span className="text-amber-400/80 font-bold">1% House Edge</span>
          </div>

        </div>

      </div>

    </div>
  );
}
