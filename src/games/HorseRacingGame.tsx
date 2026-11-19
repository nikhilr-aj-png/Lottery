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
  Zap
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { soundFX } from '../engine/SoundFXService';

interface Horse {
  number: number;
  name: string;
  jockey: string;
  odds: number;
  color: string;
  textColor: string;
  form: string;
}

const HORSES: Horse[] = [
  { number: 1, name: 'Golden Thunder', jockey: 'L. Dettori', odds: 2.4, color: '#f5c451', textColor: '#000000', form: '1-1-2' },
  { number: 2, name: 'Silver Streak', jockey: 'R. Moore', odds: 3.8, color: '#94a3b8', textColor: '#000000', form: '2-1-3' },
  { number: 3, name: 'Crimson Comet', jockey: 'W. Buick', odds: 5.2, color: '#ef4444', textColor: '#ffffff', form: '3-4-1' },
  { number: 4, name: 'Midnight Stallion', jockey: 'C. Soumillon', odds: 8.0, color: '#8b5cf6', textColor: '#ffffff', form: '4-2-5' },
  { number: 5, name: 'Royal Pegasus', jockey: 'O. Murphy', odds: 15.0, color: '#06b6d4', textColor: '#ffffff', form: '6-3-2' },
  { number: 6, name: 'Wild Valkyrie', jockey: 'J. Crowley', odds: 35.0, color: '#10b981', textColor: '#ffffff', form: '5-6-4' }
];

export default function HorseRacingGame({ 
  room, 
  activityBox 
}: { 
  room?: any; 
  activityBox?: React.ReactNode; 
}) {
  const {
    game,
    betAmount,
    setBetAmount,
    doubleBet,
    halveBet,
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

  const [selectedHorseNumber, setSelectedHorseNumber] = useState(1);
  const [isRacing, setIsRacing] = useState(false);
  const [racePositions, setRacePositions] = useState<number[]>([5, 5, 5, 5, 5, 5]); // 0 to 100%
  const [raceWinner, setRaceWinner] = useState<Horse | null>(null);
  const [podium, setPodium] = useState<Horse[]>([]);
  const [lastResult, setLastResult] = useState<'won' | 'lost' | null>(null);

  const selectedHorse = HORSES.find(h => h.number === selectedHorseNumber) || HORSES[0];
  const potentialPayout = parseFloat((betAmount * selectedHorse.odds).toFixed(2));

  const animFrameRef = useRef<number | null>(null);

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

    // Animated race simulation
    const startTime = Date.now();
    const raceDuration = 4000; // 4 seconds sprint

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(1, elapsed / raceDuration);

      setRacePositions((_) => {
        return HORSES.map((h) => {
          if (progress >= 1) {
            // At finish line: winner is at 95%, others staggered behind
            if (h.number === winningHorseNum) return 93;
            const rank = outcome.podium.indexOf(h.number);
            if (rank === 1) return 88;
            if (rank === 2) return 84;
            return 72 + (h.number * 2);
          }

          // Dynamic sprint noise during run
          const base = progress * 85;
          const wobble = Math.sin(progress * 15 + h.number) * 4;
          const boost = (h.number === winningHorseNum ? progress * 8 : 0);
          return Math.max(5, Math.min(92, base + wobble + boost));
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
          colors: ['#F5C451', '#10B981', '#3B82F6']
        });
      } catch (e) {}
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
    <div className="w-full flex-1 flex flex-col min-h-0 space-y-2 text-left">
      {/* Top Bar: Derby Track Conditions & Nonce */}
      <div className="flex items-center justify-between p-2 sm:px-3 rounded-xl bg-[#090D16] border border-[#1F2737] shrink-0 text-xs">
        <div className="flex items-center gap-2">
          <img 
            src="/items/Horse Racing.jpg" 
            alt="Horse Racing" 
            className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg object-cover border border-emerald-500/40 shrink-0 shadow-xs"
          />
          <span className="font-extrabold text-white text-xs sm:text-sm flex items-center gap-1.5">
            <Flag className="w-4 h-4 text-emerald-400" />
            <span className="hidden xs:inline">Championship Derby</span>
          </span>
          <span className="text-[10px] font-mono-numbers px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 uppercase font-bold">
            1,000M TURF SPRINT
          </span>
        </div>
        <div className="flex items-center gap-2 text-[11px] font-mono-numbers text-[#94A3B8]">
          <span>Track: <strong className="text-white">Fast & Firm</strong></span>
          <span>•</span>
          <span>Race #{seeds.nonce}</span>
        </div>
      </div>

      {/* Main 2-Column Responsive Layout */}
      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 gap-2 sm:gap-3 overflow-y-auto no-scrollbar">
        {/* Left Stage Area: Live Turf Track Simulation (7 cols on Desktop) */}
        <div className="lg:col-span-8 flex flex-col space-y-2">
          {/* Virtual Turf Racetrack */}
          <div className="rounded-2xl bg-gradient-to-b from-[#0a180e] via-[#06120b] to-[#040806] border border-emerald-500/30 p-3 sm:p-4 flex flex-col space-y-2 relative overflow-hidden shadow-xl">
            {/* Finish Line Indicator */}
            <div className="absolute top-0 bottom-0 right-[8%] w-1.5 bg-repeating-linear-gradient(to bottom, #fff 0, #fff 8px, #ef4444 8px, #ef4444 16px) z-10 opacity-80" />
            <div className="absolute top-2 right-[9%] flex items-center gap-1 text-[9px] font-mono-numbers text-amber-400 font-bold uppercase z-10 bg-black/60 px-1.5 py-0.2 rounded">
              <Trophy className="w-2.5 h-2.5" />
              <span>FINISH</span>
            </div>

            {/* 6 Running Lanes */}
            <div className="space-y-1.5 relative">
              {HORSES.map((horse, idx) => {
                const pos = racePositions[idx] || 5;
                const isSelected = selectedHorseNumber === horse.number;
                const isWinner = raceWinner?.number === horse.number;

                return (
                  <div
                    key={horse.number}
                    className={`relative h-10 sm:h-11 rounded-xl flex items-center px-2 transition-all border ${
                      isSelected
                        ? 'bg-[#102416] border-amber-500/50 shadow-xs'
                        : 'bg-[#09140c]/80 border-[#1a3320]'
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
                      className="absolute transition-all duration-75 flex items-center z-20"
                      style={{ left: `${pos}%` }}
                    >
                      <div
                        className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center shadow-lg transition-transform ${
                          isWinner ? 'scale-125 ring-2 ring-amber-400' : ''
                        }`}
                        style={{ backgroundColor: horse.color }}
                      >
                        <span className="text-base sm:text-lg">🐎</span>
                      </div>
                      {isWinner && (
                        <span className="ml-1 px-1.5 py-0.2 rounded bg-amber-400 text-black font-mono-numbers font-black text-[9px] uppercase shadow-md animate-bounce">
                          WINNER!
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Horse Roster Selection Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {HORSES.map((horse) => {
              const isSelected = selectedHorseNumber === horse.number;
              return (
                <button
                  key={horse.number}
                  type="button"
                  disabled={isRacing}
                  onClick={() => setSelectedHorseNumber(horse.number)}
                  className={`p-2.5 rounded-xl font-bold flex flex-col text-left transition-all cursor-pointer border ${
                    isSelected
                      ? 'bg-amber-500/20 border-amber-400 ring-1 ring-amber-400 shadow-md scale-102'
                      : 'bg-[#0B0F19] hover:bg-[#121927] border-[#1F2737]'
                  }`}
                >
                  <div className="flex items-center justify-between w-full">
                    <span
                      className="w-5 h-5 rounded font-mono-numbers font-black text-[11px] flex items-center justify-center"
                      style={{ backgroundColor: horse.color, color: horse.textColor }}
                    >
                      #{horse.number}
                    </span>
                    <span className="font-mono-numbers font-black text-xs text-amber-300">
                      {horse.odds}x
                    </span>
                  </div>
                  <span className="font-extrabold text-xs text-white truncate mt-1">
                    {horse.name}
                  </span>
                  <div className="flex items-center justify-between text-[10px] text-[#94A3B8] font-mono-numbers mt-0.5">
                    <span>{horse.jockey}</span>
                    <span className="text-emerald-400">{horse.form}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right Stage Area: Bet Slip, Potential Payout & Room Activity (4 cols on Desktop) */}
        <div className="lg:col-span-4 flex flex-col space-y-2">
          {/* Bet Slip Controls */}
          <div className="p-3 sm:p-3.5 rounded-xl bg-[#0B0F19] border border-[#1F2737] space-y-2.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-[#94A3B8]">Selected Runner:</span>
              <span className="font-extrabold text-amber-300 font-mono-numbers">
                #{selectedHorse.number} {selectedHorse.name} ({selectedHorse.odds}x)
              </span>
            </div>

            {/* Stake Input with Quick Presets */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-[#94A3B8]">Bet Stake:</span>
                <span className="font-mono-numbers text-white font-bold">{betAmount} FC</span>
              </div>

              <div className="flex items-center gap-1">
                <input
                  type="number"
                  min={room?.minStakeFC || 1}
                  max={room?.maxStakeFC || 1000}
                  value={betAmount}
                  disabled={isRacing}
                  onChange={(e) => setBetAmount(Math.max(1, parseInt(e.target.value) || 1))}
                  className="flex-1 bg-[#141924] border border-[#272a31] rounded-xl px-3 py-2 text-xs font-mono-numbers text-white outline-none focus:border-amber-500"
                />
                <button
                  type="button"
                  onClick={halveBet}
                  disabled={isRacing}
                  className="px-2.5 py-2 rounded-xl bg-[#141924] hover:bg-[#1f2737] text-[10px] font-bold text-[#94A3B8] border border-[#272a31] cursor-pointer"
                >
                  ½
                </button>
                <button
                  type="button"
                  onClick={doubleBet}
                  disabled={isRacing}
                  className="px-2.5 py-2 rounded-xl bg-[#141924] hover:bg-[#1f2737] text-[10px] font-bold text-[#94A3B8] border border-[#272a31] cursor-pointer"
                >
                  2×
                </button>
              </div>

              {/* Quick Preset Buttons */}
              <div className="grid grid-cols-4 gap-1 pt-1">
                {[1, 5, 25, 100].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    disabled={isRacing}
                    onClick={() => setBetAmount(preset)}
                    className="py-1 rounded bg-[#111827] hover:bg-[#1a2333] text-[10px] font-mono-numbers text-purple-300 border border-[#1f2737] cursor-pointer font-bold"
                  >
                    +{preset} USDT
                  </button>
                ))}
              </div>
            </div>

            {/* Potential Payout */}
            <div className="flex items-center justify-between p-2 rounded-lg bg-[#07090d] border border-[#1F2737] text-xs">
              <span className="text-[#94A3B8]">Est. Win Payout:</span>
              <strong className="text-emerald-400 font-mono-numbers font-black text-sm">
                {potentialPayout} USDT
              </strong>
            </div>

            {/* Start Race Action Button */}
            <button
              type="button"
              disabled={isRacing || loading}
              onClick={handleStartRace}
              className="w-full py-3 rounded-xl btn-gold text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer shadow-lg transition-transform active:scale-98"
            >
              {isRacing ? (
                <>
                  <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                  <span>Race In Progress...</span>
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 fill-current" />
                  <span>Place Bet &amp; Run · {betAmount} USDT</span>
                </>
              )}
            </button>

            {/* Result Toast Card */}
            {lastResult && (
              <div className={`p-2.5 rounded-xl border text-center font-mono-numbers text-xs font-bold animate-in fade-in ${
                lastResult === 'won' 
                  ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300' 
                  : 'bg-red-500/15 border-red-500/30 text-red-300'
              }`}>
                {lastResult === 'won' ? (
                  <span>🏆 WON +{potentialPayout} USDT on #{selectedHorse.number} {selectedHorse.name}!</span>
                ) : (
                  <span>Finished #{raceWinner?.number} {raceWinner?.name} ({raceWinner?.odds}x)</span>
                )}
              </div>
            )}
          </div>

          {/* Dedicated In-Room Activity Box */}
          {activityBox && (
            <div className="flex-1 min-h-[140px] flex flex-col">
              {activityBox}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
