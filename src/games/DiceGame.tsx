import React, { useState, useEffect } from 'react';
import { useGameEngine } from '../hooks/useGameEngine';
import { generateDiceRoll, calculateDiceMultiplier } from '../engine';
import { 
  Dices, 
  RotateCcw, 
  TrendingUp, 
  History, 
  ShieldCheck, 
  Coins, 
  CheckCircle2, 
  XCircle,
  Percent,
  Hash,
  Sparkles,
  Zap
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { soundFX } from '../engine/SoundFXService';

export interface DiceGameProps {
  room?: any;
  activityBox?: React.ReactNode;
}

/**
 * Dice Game - Provably Fair 100-Sided Multiplier
 * Designed strictly in Google Stitch (Obsidian Sovereign Design System: #0B0F19, #111728, #7C3AED, #F59E0B, #10B981)
 */
export default function DiceGame({ room, activityBox }: DiceGameProps) {
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
  } = useGameEngine('dice');

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

  const [targetNumber, setTargetNumber] = useState(50.50);
  const [rollMode, setRollMode] = useState<'over' | 'under'>('over');
  const [lastRoll, setLastRoll] = useState<number | null>(null);
  const [isRolling, setIsRolling] = useState(false);
  const [lastOutcome, setLastOutcome] = useState<'won' | 'lost' | null>(null);
  const [recentRolls, setRecentRolls] = useState([
    { roll: 68.42, isWin: true },
    { roll: 12.05, isWin: false },
    { roll: 91.30, isWin: true },
    { roll: 44.80, isWin: false },
    { roll: 73.18, isWin: true },
    { roll: 85.90, isWin: true }
  ]);

  // Derived calculations from Rules Engine
  const calc = calculateDiceMultiplier(targetNumber, rollMode, 1.0);

  // Target Slider Handler
  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setTargetNumber(parseFloat(val.toFixed(2)));
  };

  // Roll Mode Switch
  const toggleRollMode = () => {
    setRollMode(prev => prev === 'over' ? 'under' : 'over');
  };

  // Quick preset helper
  const handleQuickAdd = (addVal: number) => {
    const maxVal = room?.maxStakeFC || 2000;
    setBetAmount(Math.min(maxVal, betAmount + addVal));
  };

  // Roll Dice Action
  const handleRoll = async () => {
    if (isRolling || loading) return;

    // 1. Debit stake and record round
    const startRes = await startRound();
    if (!startRes.success) return;

    soundFX.playChipBet();
    soundFX.playDiceRoll();

    setIsRolling(true);
    setLastOutcome(null);

    // 2. Derive roll outcome using Provably Fair algorithm
    const rolledNumber = await generateDiceRoll(
      seeds.serverHash || 'seed_dice_default',
      seeds.clientSeed,
      seeds.nonce
    );

    // Animated digital spin ticker (400ms)
    let counter = 0;
    const interval = setInterval(() => {
      setLastRoll(parseFloat((Math.random() * 99.99).toFixed(2)));
      counter++;
      if (counter >= 8) {
        clearInterval(interval);
        finalizeRoll(rolledNumber);
      }
    }, 50);
  };

  const finalizeRoll = async (rolledNumber: number) => {
    setLastRoll(rolledNumber);
    setIsRolling(false);

    const isWin = rollMode === 'over' 
      ? rolledNumber > targetNumber 
      : rolledNumber < targetNumber;

    const multiplier = isWin ? calc.multiplier : 0;
    const payout = isWin ? parseFloat((betAmount * calc.multiplier).toFixed(2)) : 0;

    setLastOutcome(isWin ? 'won' : 'lost');

    if (isWin) {
      soundFX.playWinFanfare(calc.multiplier >= 10 ? 'big' : 'standard');
      try {
        confetti({
          particleCount: 80,
          spread: 65,
          origin: { y: 0.6 },
          colors: ['#F59E0B', '#10B981', '#7C3AED', '#ffffff']
        });
      } catch (_) {}
    }

    // Settle round authoritatively
    await settleRound({
      multiplier,
      payout,
      outcomeData: {
        roll: rolledNumber,
        target: targetNumber,
        mode: rollMode,
        isWin,
        roomId: room?.id
      },
      metadata: { roomId: room?.id, roomName: room?.name }
    });

    // Add to history
    setRecentRolls(prev => [
      { roll: rolledNumber, isWin },
      ...prev.slice(0, 11)
    ]);
  };

  // Win zone percentage calculation for slider gradient
  const winPercent = rollMode === 'over' ? 100 - targetNumber : targetNumber;

  return (
    <div className="w-full flex-1 flex flex-col min-h-0 text-left space-y-2 select-none">
      
      {/* 1. COMPACT IN-GAME TELEMETRY STRIP (NO SEPARATE NAVIGATION STRIP) */}
      <div className="p-2 sm:px-3 rounded-xl bg-[#111728]/95 border border-[#1B2238] flex flex-wrap items-center justify-between gap-2 shrink-0 shadow-md">
        {/* Left: Room Title, Live Status & Round */}
        <div className="flex items-center gap-2 shrink-0">
          <span className="font-display font-black text-white text-xs sm:text-sm tracking-wide">
            {room?.name || 'Lucky Dice Arena'}
          </span>
          <span className="px-2 py-0.5 rounded-full bg-[#10B981]/15 text-[#10B981] border border-[#10B981]/30 text-[10px] font-mono-numbers font-extrabold uppercase flex items-center gap-1 shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-[#10B981] animate-ping" />
            <span>LIVE</span>
          </span>
          <span className="text-[10px] font-mono-numbers px-2 py-0.5 rounded bg-[#7C3AED]/15 text-[#D2BBFF] border border-[#7C3AED]/30 font-bold uppercase">
            ROUND #{seeds.nonce}
          </span>
          <div className="hidden sm:flex items-center gap-2 text-[11px] font-mono-numbers text-[#94A3B8] ml-1">
            <span>Entry: <strong className="text-white">{room?.minStakeFC || 1} - {room?.maxStakeFC || 2000} USDT</strong></span>
            <span>•</span>
            <span>Edge: <strong className="text-emerald-400">1.0%</strong></span>
          </div>
        </div>

        {/* Right: History Strip */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5 max-w-[60%] sm:max-w-[70%]">
          <span className="text-[10px] font-mono-numbers uppercase text-[#94A3B8] font-bold shrink-0 hidden md:inline">
            History:
          </span>
          {recentRolls.map((r, idx) => (
            <span
              key={idx}
              className={`px-2 py-0.5 rounded-lg text-[10px] font-mono-numbers font-black shrink-0 border ${
                r.isWin
                  ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                  : 'bg-rose-500/10 text-rose-400 border-rose-500/25'
              }`}
            >
              {r.roll.toFixed(2)}
            </span>
          ))}
        </div>
      </div>

      {/* 2. MAIN WORKSTATION GRID */}
      <div className={`flex-1 min-h-0 grid gap-2 sm:gap-3 overflow-hidden ${
        isMobileLandscape ? 'grid-cols-12' : 'grid-cols-1 lg:grid-cols-12'
      }`}>
        
        {/* CONTROLS STATION (Desktop: 4 cols / Mobile Landscape: 5 cols / Mobile Portrait: bottom) */}
        <div className={`bg-[#111728]/95 border border-[#1B2238] rounded-2xl p-3 sm:p-4 flex flex-col justify-between overflow-y-auto no-scrollbar gap-2.5 backdrop-blur-md shadow-xl ${
          isMobileLandscape ? 'col-span-5 order-1' : 'order-2 lg:order-1 lg:col-span-4'
        }`}>
          
          <div className="space-y-3">
            
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
                  disabled={isRolling}
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
                disabled={isRolling}
                className="py-1.5 rounded-lg bg-[#0B0F19] hover:bg-[#151C2B] text-[#94A3B8] hover:text-white border border-[#1F2737] transition-colors cursor-pointer disabled:opacity-40 text-[11px]"
              >
                ½
              </button>
              <button
                type="button"
                onClick={doubleBet}
                disabled={isRolling}
                className="py-1.5 rounded-lg bg-[#0B0F19] hover:bg-[#151C2B] text-[#94A3B8] hover:text-white border border-[#1F2737] transition-colors cursor-pointer disabled:opacity-40 text-[11px]"
              >
                2×
              </button>
              <button
                type="button"
                onClick={setMinBet}
                disabled={isRolling}
                className="py-1.5 rounded-lg bg-[#0B0F19] hover:bg-[#151C2B] text-[#94A3B8] hover:text-white border border-[#1F2737] transition-colors cursor-pointer disabled:opacity-40 text-[11px]"
              >
                Min
              </button>
              <button
                type="button"
                onClick={setMaxBet}
                disabled={isRolling}
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
                  disabled={isRolling}
                  className="py-1 rounded bg-[#0B0F19]/80 hover:bg-[#151C2B] text-violet-300 border border-violet-500/20 transition-colors cursor-pointer disabled:opacity-40"
                >
                  +{val}
                </button>
              ))}
            </div>

            {/* Odds & Telemetry Dashboard */}
            <div className="grid grid-cols-2 gap-2 text-xs font-mono-numbers pt-2 border-t border-[#1F2737]">
              <div className="bg-[#0B0F19] p-2.5 rounded-xl border border-[#1F2737]">
                <span className="text-[10px] text-[#94A3B8] block mb-0.5">Payout Multiplier</span>
                <span className="font-black text-base text-amber-300">{calc.multiplier}x</span>
              </div>

              <div className="bg-[#0B0F19] p-2.5 rounded-xl border border-[#1F2737]">
                <span className="text-[10px] text-[#94A3B8] block mb-0.5">Win Probability</span>
                <span className="font-black text-base text-emerald-400">{calc.winChance}%</span>
              </div>
            </div>

            {/* Potential Profit on Win */}
            <div className="bg-[#0B0F19] p-2.5 rounded-xl border border-[#1F2737] text-xs font-mono-numbers flex items-center justify-between">
              <span className="text-[#94A3B8]">Est. Profit on Win:</span>
              <span className="font-black text-emerald-300 text-sm">
                +{(betAmount * calc.multiplier - betAmount).toFixed(2)} USDT
              </span>
            </div>

          </div>

          {/* Action Button: Roll Dice */}
          <div className="pt-2">
            <button
              type="button"
              onClick={handleRoll}
              disabled={isRolling || loading}
              className="w-full py-3.5 rounded-xl btn-gold text-black font-black text-sm flex items-center justify-center gap-2 cursor-pointer transition-all shadow-lg active:scale-98 disabled:opacity-50"
            >
              <Dices className={`w-4 h-4 ${isRolling ? 'animate-spin' : ''}`} />
              <span>{isRolling ? 'Rolling Dice...' : `Roll Dice • ${betAmount} USDT`}</span>
            </button>
          </div>

          {/* Embedded In-Room Activity Box */}
          {activityBox && (
            <div className="border-t border-[#1F2737] pt-2">
              {activityBox}
            </div>
          )}

        </div>

        {/* DICE INTERACTIVE STAGE (Desktop: 8 cols / Mobile Landscape: 7 cols / Mobile Portrait: top) */}
        <div className={`bg-[#0B0F19] border border-[#1B2238] rounded-2xl p-3 sm:p-5 flex flex-col justify-between items-center relative overflow-hidden h-full min-h-[240px] lg:min-h-0 shadow-2xl ${
          isMobileLandscape ? 'col-span-7 order-2' : 'order-1 lg:order-2 lg:col-span-8'
        }`}>
          
          {/* Ambient Glows */}
          <div className="absolute top-0 right-0 w-80 h-80 bg-violet-600/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-80 h-80 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

          {/* Top Stage Bar: Mode Toggle */}
          <div className="w-full flex items-center justify-between pb-2 border-b border-[#1F2737] shrink-0 z-10">
            <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
              <Dices className="w-4 h-4 text-amber-400" />
              <span>100-Sided Lucky Die</span>
            </span>

            <button
              type="button"
              onClick={toggleRollMode}
              disabled={isRolling}
              className="px-3 py-1 rounded-xl bg-[#111728] hover:bg-[#1a2338] text-amber-300 border border-amber-500/40 text-xs font-mono-numbers font-extrabold flex items-center gap-1.5 cursor-pointer transition-colors shadow-xs active:scale-95"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Mode: {rollMode === 'over' ? 'Roll Over >' : 'Roll Under <'}</span>
            </button>
          </div>

          {/* Central Digital Roll Stage */}
          <div className="my-auto py-2 sm:py-4 text-center space-y-3 z-10">
            
            {/* Tactile 3D Number Card */}
            <div className={`w-32 sm:w-40 h-32 sm:h-40 rounded-3xl mx-auto flex flex-col items-center justify-center border-2 transition-all duration-300 backdrop-blur-md ${
              lastOutcome === 'won'
                ? 'bg-emerald-950/70 border-emerald-400 text-emerald-300 shadow-[0_0_45px_rgba(16,185,129,0.4)] scale-105'
                : lastOutcome === 'lost'
                ? 'bg-rose-950/70 border-rose-500 text-rose-400 shadow-[0_0_35px_rgba(239,68,68,0.4)]'
                : 'bg-[#111728]/90 border-violet-500/40 text-white shadow-[0_0_35px_rgba(124,58,237,0.25)]'
            }`}>
              <span className="font-display font-black text-4xl sm:text-5xl tracking-tight font-mono-numbers drop-shadow-md">
                {lastRoll !== null ? lastRoll.toFixed(2) : '50.00'}
              </span>
              <span className="text-[10px] uppercase font-mono-numbers font-black tracking-widest mt-1 text-[#94A3B8]">
                {isRolling ? 'Rolling...' : (lastOutcome ? lastOutcome.toUpperCase() : 'Ready')}
              </span>
            </div>

            {/* Outcome Announcement */}
            <div>
              {lastOutcome === 'won' ? (
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/50 text-emerald-300 text-xs font-mono-numbers font-black animate-in zoom-in-95">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  Won +{(betAmount * calc.multiplier).toFixed(2)} USDT ({calc.multiplier}x)
                </div>
              ) : lastOutcome === 'lost' ? (
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-500/20 border border-rose-500/50 text-rose-300 text-xs font-mono-numbers font-black animate-in zoom-in-95">
                  <XCircle className="w-3.5 h-3.5 text-rose-400" />
                  Did not meet target {rollMode === 'over' ? `>${targetNumber.toFixed(2)}` : `<${targetNumber.toFixed(2)}`}
                </div>
              ) : (
                <span className="text-xs text-[#94A3B8]">
                  Adjust slider target below and click Roll Dice
                </span>
              )}
            </div>

          </div>

          {/* Interactive Range Slider (00.00 to 99.99) */}
          <div className="w-full space-y-2 pt-2 border-t border-[#1F2737] shrink-0 z-10">
            <div className="flex items-center justify-between text-xs font-mono-numbers font-bold">
              <span className="text-[#94A3B8]">0.00</span>
              <span className="text-amber-300 bg-amber-500/15 px-3 py-1 rounded-lg border border-amber-500/40 text-xs font-black shadow-xs">
                Target: {rollMode === 'over' ? `> ${targetNumber.toFixed(2)}` : `< ${targetNumber.toFixed(2)}`}
              </span>
              <span className="text-[#94A3B8]">100.00</span>
            </div>

            {/* Split Target Slider Bar */}
            <div className="relative flex items-center py-2">
              <input
                type="range"
                min="1.00"
                max="98.00"
                step="0.01"
                value={targetNumber}
                onChange={handleSliderChange}
                disabled={isRolling}
                className="w-full h-3 rounded-lg appearance-none cursor-pointer accent-amber-400 outline-none transition-all shadow-inner"
                style={{
                  background: rollMode === 'over'
                    ? `linear-gradient(to right, #EF4444 0%, #EF4444 ${targetNumber}%, #10B981 ${targetNumber}%, #10B981 100%)`
                    : `linear-gradient(to right, #10B981 0%, #10B981 ${targetNumber}%, #EF4444 ${targetNumber}%, #EF4444 100%)`
                }}
              />
            </div>

            {/* Tick Mark Scale */}
            <div className="flex items-center justify-between text-[10px] text-[#64748B] font-mono-numbers px-1">
              <span>0</span>
              <span>25</span>
              <span>50</span>
              <span>75</span>
              <span>100</span>
            </div>

            {/* Stage Footer: Edge & Odds */}
            <div className="flex items-center justify-between text-[10px] text-[#94A3B8] font-mono-numbers pt-1">
              <span>1.0% House Edge</span>
              <span className="text-amber-400/80 font-bold">
                Win Rate: {calc.winChance}%
              </span>
            </div>
          </div>

        </div>

      </div>

    </div>
  );
}
