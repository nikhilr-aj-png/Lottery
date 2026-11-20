import React, { useState, useEffect, useRef } from 'react';
import { useGameEngine } from '../hooks/useGameEngine';
import { generateHorseRaceWinner } from '../engine';
import { 
  Play, 
  Sparkles, 
  Award, 
  ShieldCheck, 
  Flame, 
  Flag, 
  CheckCircle2, 
  RotateCcw,
  Trophy,
  Zap,
  Coins,
  Medal,
  Clock
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { soundFX } from '../engine/SoundFXService';

export interface Horse {
  number: number;
  name: string;
  jockey: string;
  odds: number;
  color: string;
  textColor: string;
  form: string;
  winChance: string;
}

const HORSES: Horse[] = [
  { number: 1, name: 'Golden Thunder', jockey: 'L. Dettori', odds: 2.4, color: '#F59E0B', textColor: '#000000', form: '1-1-2', winChance: '38%' },
  { number: 2, name: 'Silver Streak', jockey: 'R. Moore', odds: 3.8, color: '#38BDF8', textColor: '#000000', form: '2-1-3', winChance: '25%' },
  { number: 3, name: 'Crimson Comet', jockey: 'W. Buick', odds: 5.2, color: '#EF4444', textColor: '#ffffff', form: '3-4-1', winChance: '18%' },
  { number: 4, name: 'Midnight Stallion', jockey: 'C. Soumillon', odds: 8.0, color: '#8B5CF6', textColor: '#ffffff', form: '4-2-5', winChance: '11%' },
  { number: 5, name: 'Royal Pegasus', jockey: 'O. Murphy', odds: 15.0, color: '#06B6D4', textColor: '#ffffff', form: '6-3-2', winChance: '6%' },
  { number: 6, name: 'Wild Valkyrie', jockey: 'J. Crowley', odds: 35.0, color: '#10B981', textColor: '#ffffff', form: '5-6-4', winChance: '2%' }
];

export interface HorseRacingGameProps {
  room?: any;
  activityBox?: React.ReactNode;
}

/**
 * Horse Racing Game - Provably Fair Virtual Turf Derby
 * Designed strictly in Google Stitch (Obsidian Sovereign Design System: #0B0F19, #111728, #7C3AED, #F59E0B, #10B981)
 */
export default function HorseRacingGame({ room, activityBox }: HorseRacingGameProps) {
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
  } = useGameEngine('horse-racing');

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

  const [selectedHorseNumber, setSelectedHorseNumber] = useState(1);
  const [isRacing, setIsRacing] = useState(false);
  const [racePositions, setRacePositions] = useState<number[]>([4, 4, 4, 4, 4, 4]); // 0 to 92%
  const [raceWinner, setRaceWinner] = useState<Horse | null>(null);
  const [podium, setPodium] = useState<Horse[]>([]);
  const [lastResult, setLastResult] = useState<'won' | 'lost' | null>(null);

  const selectedHorse = HORSES.find(h => h.number === selectedHorseNumber) || HORSES[0];
  const potentialPayout = parseFloat((betAmount * selectedHorse.odds).toFixed(2));
  const netProfit = parseFloat((potentialPayout - betAmount).toFixed(2));

  const animFrameRef = useRef<number | null>(null);

  // Quick preset helper
  const handleQuickAdd = (addVal: number) => {
    const maxVal = room?.maxStakeFC || 2000;
    setBetAmount(Math.min(maxVal, betAmount + addVal));
  };

  const handleStartRace = async () => {
    if (isRacing || loading) return;

    const startRes = await startRound();
    if (!startRes.success) return;

    soundFX.playChipBet();
    setIsRacing(true);
    setRaceWinner(null);
    setPodium([]);
    setLastResult(null);

    // Provably fair generation
    const outcome = await generateHorseRaceWinner(
      seeds.serverHash || 'seed_horse_default',
      seeds.clientSeed,
      seeds.nonce
    );

    const winningHorseNum = outcome.winner;
    const winningHorse = HORSES.find(h => h.number === winningHorseNum) || HORSES[0];

    // Animated race simulation (3.8 seconds sprint)
    const startTime = Date.now();
    const raceDuration = 3800;

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(1, elapsed / raceDuration);

      setRacePositions(() => {
        return HORSES.map((h) => {
          if (progress >= 1) {
            // At finish line: winner is at 90%, others staggered behind
            if (h.number === winningHorseNum) return 90;
            const rank = outcome.podium.indexOf(h.number);
            if (rank === 1) return 84;
            if (rank === 2) return 80;
            return 68 + (h.number * 1.8);
          }

          // Dynamic sprint noise with dynamic gallop
          const base = progress * 82;
          const wobble = Math.sin(progress * 14 + h.number) * 3.5;
          const boost = (h.number === winningHorseNum ? progress * 7 : 0);
          return Math.max(4, Math.min(89, base + wobble + boost));
        });
      });

      if (progress < 1) {
        animFrameRef.current = requestAnimationFrame(animate);
      } else {
        finalizeRace(winningHorse, outcome.podium);
      }
    };

    animFrameRef.current = requestAnimationFrame(animate);
  };

  const finalizeRace = async (winningHorse: Horse, podiumNums: number[]) => {
    setIsRacing(false);
    setRaceWinner(winningHorse);
    const podiumHorses = podiumNums.map(n => HORSES.find(h => h.number === n)!).filter(Boolean);
    setPodium(podiumHorses);

    const isWin = winningHorse.number === selectedHorseNumber;
    setLastResult(isWin ? 'won' : 'lost');

    const payout = isWin ? potentialPayout : 0;
    const effectiveMultiplier = isWin ? selectedHorse.odds : 0;

    if (isWin) {
      soundFX.playWinFanfare('mega');
      try {
        confetti({
          particleCount: 100,
          spread: 80,
          origin: { y: 0.6 },
          colors: ['#F59E0B', '#10B981', '#38BDF8', '#ffffff']
        });
      } catch (_) {}
    } else {
      soundFX.playCoinflipLand(false);
    }

    await settleRound({
      multiplier: effectiveMultiplier,
      payout,
      outcomeData: {
        winnerNumber: winningHorse.number,
        winnerName: winningHorse.name,
        winnerOdds: winningHorse.odds,
        podium: podiumNums,
        selectedHorse: selectedHorse.number
      }
    });
  };

  useEffect(() => {
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, []);

  return (
    <div className="w-full flex-1 flex flex-col min-h-0 text-left space-y-2 select-none">
      
      {/* 1. COMPACT IN-GAME TELEMETRY STRIP (NO SEPARATE NAVIGATION STRIP) */}
      <div className="p-2 sm:px-3 rounded-xl bg-[#111728]/95 border border-[#1B2238] flex flex-wrap items-center justify-between gap-2 shrink-0 shadow-md">
        {/* Left: Room Title, Live Status & Round */}
        <div className="flex items-center gap-2 shrink-0">
          <span className="font-display font-black text-white text-xs sm:text-sm tracking-wide flex items-center gap-1.5">
            <Flag className="w-4 h-4 text-emerald-400" />
            <span>{room?.name || 'Championship Turf Derby'}</span>
          </span>
          <span className="px-2 py-0.5 rounded-full bg-[#10B981]/15 text-[#10B981] border border-[#10B981]/30 text-[10px] font-mono-numbers font-extrabold uppercase flex items-center gap-1 shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-[#10B981] animate-ping" />
            <span>LIVE</span>
          </span>
          <span className="text-[10px] font-mono-numbers px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 uppercase font-bold">
            1,000M TURF
          </span>
          <span className="text-[10px] font-mono-numbers px-2 py-0.5 rounded bg-[#7C3AED]/15 text-[#D2BBFF] border border-[#7C3AED]/30 font-bold uppercase">
            ROUND #{seeds.nonce}
          </span>
          <div className="hidden sm:flex items-center gap-2 text-[11px] font-mono-numbers text-[#94A3B8] ml-1">
            <span>Entry: <strong className="text-white">{room?.minStakeFC || 1} - {room?.maxStakeFC || 1500} USDT</strong></span>
            <span>•</span>
            <span>Top Odds: <strong className="text-amber-400">35.0x</strong></span>
          </div>
        </div>

        {/* Right: Track condition indicator & Race status */}
        <div className="flex items-center gap-2 text-[11px] font-mono-numbers text-[#94A3B8] shrink-0">
          <span className="hidden md:inline">Track: <strong className="text-white">Fast & Firm</strong></span>
          <span className={`px-2 py-0.5 rounded border text-xs font-bold ${
            isRacing 
              ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 animate-pulse' 
              : 'bg-[#0B0F19] border-[#1F2737] text-emerald-400'
          }`}>
            {isRacing ? 'RUNNING SPRINT' : 'READY TO RACE'}
          </span>
        </div>
      </div>

      {/* 2. MAIN WORKSTATION GRID */}
      <div className={`flex-1 min-h-0 grid gap-2 sm:gap-3 overflow-y-auto no-scrollbar ${
        isMobileLandscape ? 'grid-cols-12' : 'grid-cols-1 lg:grid-cols-12'
      }`}>
        
        {/* TURF TRACK ARENA & RUNNER GRID (Desktop: 8 cols / Mobile Landscape: 7 cols) */}
        <div className={`flex flex-col space-y-2 ${
          isMobileLandscape ? 'col-span-7 order-1' : 'order-1 lg:order-1 lg:col-span-8'
        }`}>
          
          {/* Virtual Turf Racetrack Container */}
          <div className="rounded-2xl bg-gradient-to-b from-[#0B150E] via-[#07100B] to-[#040806] border border-emerald-500/30 p-3 sm:p-4 flex flex-col space-y-2 relative overflow-hidden shadow-2xl">
            
            {/* Finish Line Indicator */}
            <div className="absolute top-0 bottom-0 right-[10%] w-2 bg-repeating-linear-gradient(to bottom, #FFFFFF 0, #FFFFFF 8px, #EF4444 8px, #EF4444 16px) z-10 opacity-85 shadow-[0_0_15px_rgba(255,255,255,0.4)]" />
            <div className="absolute top-2 right-[11%] flex items-center gap-1 text-[9px] font-mono-numbers text-amber-400 font-extrabold uppercase z-10 bg-black/70 px-2 py-0.5 rounded-md border border-amber-500/30">
              <Trophy className="w-2.5 h-2.5" />
              <span>FINISH</span>
            </div>

            {/* Distance Markers along top rail */}
            <div className="w-full flex items-center justify-between text-[9px] font-mono-numbers text-[#10B981]/70 px-4 pb-0.5 border-b border-emerald-950/60">
              <span>GATE (0m)</span>
              <span>250m</span>
              <span>500m</span>
              <span>750m</span>
              <span className="pr-12">1,000m POST</span>
            </div>

            {/* 6 Running Lanes */}
            <div className="space-y-1.5 relative">
              {HORSES.map((horse, idx) => {
                const pos = racePositions[idx] || 4;
                const isSelected = selectedHorseNumber === horse.number;
                const isWinner = raceWinner?.number === horse.number;

                return (
                  <div
                    key={horse.number}
                    className={`relative h-10 sm:h-11 rounded-xl flex items-center px-2 transition-all border ${
                      isSelected
                        ? 'bg-[#102416] border-amber-400/60 shadow-[0_0_15px_rgba(245,158,11,0.15)] ring-1 ring-amber-400/40'
                        : 'bg-[#09140C]/85 border-[#1A3320]'
                    }`}
                  >
                    {/* Lane Number Badge */}
                    <div
                      className="w-6 h-6 rounded-md font-mono-numbers font-black text-xs flex items-center justify-center shrink-0 z-10 shadow-xs"
                      style={{ backgroundColor: horse.color, color: horse.textColor }}
                    >
                      {horse.number}
                    </div>

                    {/* Horse & Jockey Info */}
                    <div className="ml-2 w-28 sm:w-36 truncate shrink-0 z-10">
                      <span className="font-extrabold text-xs text-white block truncate leading-tight">
                        {horse.name}
                      </span>
                      <span className="text-[10px] text-[#94A3B8] font-mono-numbers block">
                        {horse.odds}x · {horse.jockey}
                      </span>
                    </div>

                    {/* Animated Galloping Horse Runner Token */}
                    <div
                      className="absolute transition-all duration-75 flex items-center z-20 pointer-events-none"
                      style={{ left: `${pos}%` }}
                    >
                      <div
                        className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center shadow-lg transition-transform ${
                          isWinner ? 'scale-125 ring-2 ring-amber-400 shadow-[0_0_20px_rgba(245,158,11,0.6)]' : ''
                        }`}
                        style={{ backgroundColor: horse.color }}
                      >
                        <span className="text-base sm:text-lg">🐎</span>
                      </div>
                      {isWinner && (
                        <span className="ml-1.5 px-2 py-0.5 rounded-full bg-amber-400 text-black font-mono-numbers font-black text-[9px] uppercase shadow-lg animate-bounce">
                          WINNER!
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 6 HORSE SELECTION GRID */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {HORSES.map((horse) => {
              const isSelected = selectedHorseNumber === horse.number;
              return (
                <button
                  key={horse.number}
                  type="button"
                  disabled={isRacing}
                  onClick={() => setSelectedHorseNumber(horse.number)}
                  className={`p-3 rounded-2xl font-bold flex flex-col text-left transition-all cursor-pointer border ${
                    isSelected
                      ? 'bg-amber-500/15 border-amber-400 ring-2 ring-amber-400/50 shadow-lg scale-102'
                      : 'bg-[#111728]/95 hover:bg-[#151C2B] border-[#1B2238]'
                  }`}
                >
                  <div className="flex items-center justify-between w-full">
                    <span
                      className="w-5 h-5 rounded font-mono-numbers font-black text-[11px] flex items-center justify-center"
                      style={{ backgroundColor: horse.color, color: horse.textColor }}
                    >
                      #{horse.number}
                    </span>
                    <span className="font-mono-numbers font-black text-sm text-amber-300">
                      {horse.odds}x
                    </span>
                  </div>
                  <span className="font-extrabold text-xs text-white truncate mt-1">
                    {horse.name}
                  </span>
                  <div className="flex items-center justify-between text-[10px] text-[#94A3B8] font-mono-numbers mt-1">
                    <span>{horse.jockey}</span>
                    <span className="text-emerald-400 font-bold">{horse.form}</span>
                  </div>
                  <div className="flex items-center justify-between text-[9px] text-[#64748B] font-mono-numbers mt-0.5">
                    <span>Win Chance: {horse.winChance}</span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Winner Podium Showcase (when race completed) */}
          {podium.length > 0 && (
            <div className="p-3 sm:p-4 rounded-2xl bg-[#111728]/95 border border-amber-500/30 flex flex-col sm:flex-row items-center justify-around gap-2 animate-in zoom-in-95 duration-200 backdrop-blur-md">
              <div className="flex items-center gap-2">
                <Trophy className="w-6 h-6 text-amber-400" />
                <div>
                  <span className="text-xs text-[#94A3B8] block">1st Place Winner</span>
                  <strong className="text-amber-300 font-black text-sm">
                    #{podium[0]?.number} {podium[0]?.name} ({podium[0]?.odds}x)
                  </strong>
                </div>
              </div>

              {podium[1] && (
                <div className="flex items-center gap-2 text-xs">
                  <Medal className="w-5 h-5 text-slate-300" />
                  <div>
                    <span className="text-[10px] text-[#94A3B8] block">2nd Place</span>
                    <span className="text-white font-bold">#{podium[1]?.number} {podium[1]?.name}</span>
                  </div>
                </div>
              )}

              {podium[2] && (
                <div className="flex items-center gap-2 text-xs">
                  <Medal className="w-5 h-5 text-amber-600" />
                  <div>
                    <span className="text-[10px] text-[#94A3B8] block">3rd Place</span>
                    <span className="text-white font-bold">#{podium[2]?.number} {podium[2]?.name}</span>
                  </div>
                </div>
              )}
            </div>
          )}

        </div>

        {/* BETTING CONTROLS PANEL (Desktop: 4 cols / Mobile Landscape: 5 cols) */}
        <div className={`bg-[#111728]/95 border border-[#1B2238] rounded-2xl p-3 sm:p-4 flex flex-col justify-between overflow-y-auto no-scrollbar gap-2.5 backdrop-blur-md shadow-xl ${
          isMobileLandscape ? 'col-span-5 order-2' : 'order-2 lg:order-2 lg:col-span-4'
        }`}>
          
          <div className="space-y-3">
            
            {/* Selected Runner Summary */}
            <div className="bg-[#0B0F19] p-2.5 rounded-xl border border-[#1F2737] flex items-center justify-between">
              <span className="text-[11px] text-[#94A3B8] font-mono-numbers">Selected:</span>
              <span className="font-mono-numbers font-black text-xs text-amber-300 px-2 py-0.5 rounded bg-amber-500/15 border border-amber-500/30">
                #{selectedHorse.number} {selectedHorse.name} ({selectedHorse.odds}x)
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
                  disabled={isRacing}
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
                disabled={isRacing}
                className="py-1.5 rounded-lg bg-[#0B0F19] hover:bg-[#151C2B] text-[#94A3B8] hover:text-white border border-[#1F2737] transition-colors cursor-pointer disabled:opacity-40 text-[11px]"
              >
                ½
              </button>
              <button
                type="button"
                onClick={doubleBet}
                disabled={isRacing}
                className="py-1.5 rounded-lg bg-[#0B0F19] hover:bg-[#151C2B] text-[#94A3B8] hover:text-white border border-[#1F2737] transition-colors cursor-pointer disabled:opacity-40 text-[11px]"
              >
                2×
              </button>
              <button
                type="button"
                onClick={setMinBet}
                disabled={isRacing}
                className="py-1.5 rounded-lg bg-[#0B0F19] hover:bg-[#151C2B] text-[#94A3B8] hover:text-white border border-[#1F2737] transition-colors cursor-pointer disabled:opacity-40 text-[11px]"
              >
                Min
              </button>
              <button
                type="button"
                onClick={setMaxBet}
                disabled={isRacing}
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
                  disabled={isRacing}
                  className="py-1 rounded bg-[#0B0F19]/80 hover:bg-[#151C2B] text-violet-300 border border-violet-500/20 transition-colors cursor-pointer disabled:opacity-40"
                >
                  +{val}
                </button>
              ))}
            </div>

            {/* Payout & Odds Dashboard */}
            <div className="grid grid-cols-2 gap-2 text-xs font-mono-numbers pt-1 border-t border-[#1F2737]">
              <div className="bg-[#0B0F19] p-2 rounded-xl border border-[#1F2737]">
                <span className="text-[10px] text-[#94A3B8] block">Runner Odds</span>
                <span className="font-black text-sm text-amber-300">{selectedHorse.odds}x</span>
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

          {/* Action Button: Start Race */}
          <div className="pt-2">
            <button
              type="button"
              onClick={handleStartRace}
              disabled={isRacing || loading}
              className="w-full py-3.5 rounded-xl btn-gold text-black font-black text-sm flex items-center justify-center gap-2 cursor-pointer transition-all shadow-lg active:scale-98 disabled:opacity-50"
            >
              {isRacing ? (
                <>
                  <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                  <span>Race In Progress...</span>
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 fill-current" />
                  <span>Start Race • {betAmount} USDT</span>
                </>
              )}
            </button>
          </div>

          {/* Result Toast Notification */}
          {lastResult && (
            <div className={`p-2.5 rounded-xl border text-center font-mono-numbers text-xs font-bold animate-in fade-in ${
              lastResult === 'won' 
                ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300' 
                : 'bg-rose-500/15 border-rose-500/30 text-rose-300'
            }`}>
              {lastResult === 'won' ? (
                <span>🏆 WON +{potentialPayout} USDT on #{selectedHorse.number} {selectedHorse.name}!</span>
              ) : (
                <span>Finished #{raceWinner?.number} {raceWinner?.name} ({raceWinner?.odds}x) · Try again!</span>
              )}
            </div>
          )}

          {/* Embedded In-Room Activity Box */}
          {activityBox && (
            <div className="border-t border-[#1F2737] pt-2">
              {activityBox}
            </div>
          )}

          {/* Race Telemetry Strip */}
          <div className="flex items-center justify-end pt-1 text-[10px] text-[#94A3B8] font-mono-numbers">
            <span className="text-amber-400/80 font-bold">1% House Edge</span>
          </div>

        </div>

      </div>

    </div>
  );
}
