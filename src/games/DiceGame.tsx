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
  Hash
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { soundFX } from '../engine/SoundFXService';

export default function DiceGame({ 
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

  const [targetNumber, setTargetNumber] = useState(50.50);
  const [rollMode, setRollMode] = useState('over'); // 'over' | 'under'
  const [lastRoll, setLastRoll] = useState<any>(null);
  const [isRolling, setIsRolling] = useState(false);
  const [lastOutcome, setLastOutcome] = useState<any>(null); // 'won' | 'lost' | null
  const [recentRolls, setRecentRolls] = useState([
    { roll: 68.42, isWin: true },
    { roll: 12.05, isWin: false },
    { roll: 91.30, isWin: true },
    { roll: 44.80, isWin: false },
    { roll: 73.18, isWin: true }
  ]);

  // Derived calculations from Rules Engine
  const calc = calculateDiceMultiplier(targetNumber, rollMode as 'over' | 'under', 1.0);

  // Target Slider Handler
  const handleSliderChange = (e) => {
    const val = parseFloat(e.target.value);
    setTargetNumber(parseFloat(val.toFixed(2)));
  };

  // Roll Mode Switch
  const toggleRollMode = () => {
    setRollMode(prev => prev === 'over' ? 'under' : 'over');
  };

  // Roll Dice Action
  const handleRoll = async () => {
    if (isRolling) return;

    // 1. Start round in game engine (debits stake)
    const startRes = await startRound();
    if (!startRes.success) return;

    soundFX.playChipBet();
    soundFX.playDiceRoll();

    setIsRolling(true);
    setLastOutcome(null);

    // 2. Pre-derive roll outcome using Provably Fair algorithm
    const rolledNumber = await generateDiceRoll(
      seeds.serverHash || 'seed_dice_default',
      seeds.clientSeed,
      seeds.nonce
    );

    // Roll counter spin animation (400ms)
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

  const finalizeRoll = async (rolledNumber) => {
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
      confetti({
        particleCount: 70,
        spread: 60,
        origin: { y: 0.6 },
        colors: ['#ffd700', '#22c55e', '#3b82f6', '#ffffff']
      });
    }

    // 3. Settle round authoritatively with virtual wallet
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
      ...prev.slice(0, 9)
    ]);
  };

  return (
    <div className="w-full h-full flex flex-col min-h-0 overflow-hidden text-left space-y-1.5">
      
      {/* 1. RECENT ROLLS BAR */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-0.5 shrink-0">
        <span className="text-[10px] font-mono-numbers uppercase tracking-wider text-[#94A3B8] flex items-center gap-1 shrink-0">
          <History className="w-3 h-3 text-amber-400" />
          <span>History:</span>
        </span>
        {recentRolls.map((r, idx) => (
          <span
            key={idx}
            className={`px-1.5 py-0.2 rounded text-[10px] font-mono-numbers font-black shrink-0 border ${
              r.isWin
                ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                : 'bg-red-500/10 text-red-400 border-red-500/20'
            }`}
          >
            {r.roll.toFixed(2)}
          </span>
        ))}
      </div>

      {/* 2. MAIN STAGE & CONTROLS GRID */}
      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 gap-2 sm:gap-3 overflow-hidden">
        
        {/* Controls Column (Landscape: Left / Portrait: Middle & Bottom) */}
        <div className="order-2 lg:order-1 lg:col-span-4 bg-[#111827] border border-[#1F2737] rounded-xl p-2.5 sm:p-3 flex flex-col justify-between overflow-hidden h-full min-h-0 gap-2">
          
          <div className="space-y-2 shrink-0">
            {/* Stake Input */}
            <div>
              <div className="flex items-center justify-between text-xs mb-1 font-bold font-mono-numbers">
                <span className="text-[#94A3B8]">Bet Amount:</span>
              </div>
              <div className="flex items-center bg-[#0B0F19] border border-[#1F2737] focus-within:border-amber-500/50 rounded-lg p-1">
                <input
                  type="number"
                  min="1"
                  max="2000"
                  value={betAmount}
                  onChange={(e) => setBetAmount(Math.max(1, parseFloat(e.target.value) || 0))}
                  disabled={isRolling}
                  className="flex-1 bg-transparent px-2 text-white font-mono-numbers font-black text-sm outline-none disabled:opacity-50"
                />
                <span className="text-amber-400 font-black text-xs px-2 font-mono-numbers">FC</span>
              </div>
            </div>

            {/* Quick Stake Adjusters */}
            <div className="grid grid-cols-4 gap-1 text-xs font-mono-numbers font-bold">
              <button
                type="button"
                onClick={halveBet}
                disabled={isRolling}
                className="py-1 rounded bg-[#0B0F19] hover:bg-[#151C2B] text-[#94A3B8] hover:text-white border border-[#1F2737] transition-colors cursor-pointer disabled:opacity-50 text-[11px]"
              >
                ½
              </button>
              <button
                type="button"
                onClick={doubleBet}
                disabled={isRolling}
                className="py-1 rounded bg-[#0B0F19] hover:bg-[#151C2B] text-[#94A3B8] hover:text-white border border-[#1F2737] transition-colors cursor-pointer disabled:opacity-50 text-[11px]"
              >
                2x
              </button>
              <button
                type="button"
                onClick={setMinBet}
                disabled={isRolling}
                className="py-1 rounded bg-[#0B0F19] hover:bg-[#151C2B] text-[#94A3B8] hover:text-white border border-[#1F2737] transition-colors cursor-pointer disabled:opacity-50 text-[11px]"
              >
                Min
              </button>
              <button
                type="button"
                onClick={setMaxBet}
                disabled={isRolling}
                className="py-1 rounded bg-[#0B0F19] hover:bg-[#151C2B] text-amber-400 border border-[#1F2737] transition-colors cursor-pointer disabled:opacity-50 text-[11px]"
              >
                Max
              </button>
            </div>

            {/* Odds & Payout Dashboard */}
            <div className="grid grid-cols-2 gap-1.5 text-xs font-mono-numbers pt-1.5 border-t border-[#1F2737]">
              <div className="bg-[#0B0F19] p-2 rounded-lg border border-[#1F2737]">
                <span className="text-[9px] text-[#94A3B8] block">Multiplier</span>
                <span className="font-black text-sm text-amber-300">{calc.multiplier}x</span>
              </div>

              <div className="bg-[#0B0F19] p-2 rounded-lg border border-[#1F2737]">
                <span className="text-[9px] text-[#94A3B8] block">Win Chance</span>
                <span className="font-black text-sm text-emerald-400">{calc.winChance}%</span>
              </div>
            </div>

            {/* Profit on Win */}
            <div className="bg-[#0B0F19] p-1.5 rounded-lg border border-[#1F2737] text-xs font-mono-numbers flex items-center justify-between">
              <span className="text-[#94A3B8] text-[11px]">Profit:</span>
              <span className="font-black text-emerald-300 text-xs">
                +{(betAmount * calc.multiplier - betAmount).toFixed(2)} FC
              </span>
            </div>
          </div>

          {/* Roll Button */}
          <div className="shrink-0">
            <button
              type="button"
              onClick={handleRoll}
              disabled={isRolling || loading}
              className="w-full py-2.5 sm:py-3 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-400 hover:to-indigo-500 text-white font-black text-xs sm:text-sm flex items-center justify-center gap-1.5 cursor-pointer transition-all shadow-md shadow-blue-500/25 disabled:opacity-50"
            >
              <Dices className={`w-4 h-4 ${isRolling ? 'animate-spin' : ''}`} />
              <span>{isRolling ? 'Rolling...' : `Roll Dice (${betAmount} FC)`}</span>
            </button>
          </div>

          {/* Dedicated In-Room Activity Box */}
          {activityBox}

        </div>

        {/* Dice Interactive Stage (Landscape: Right / Portrait: Top) */}
        <div className="order-1 lg:order-2 lg:col-span-8 bg-[#07090E] border border-[#1F2737] rounded-xl p-3 sm:p-4 flex flex-col justify-between items-center relative overflow-hidden h-full min-h-[160px] lg:min-h-0">
          
          {/* Top Stage Header: Mode Toggle */}
          <div className="w-full flex items-center justify-between pb-2 border-b border-[#1F2737] shrink-0">
            <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
              <Dices className="w-3.5 h-3.5 text-blue-400" />
              <span>100-Sided Die</span>
            </span>

            <button
              onClick={toggleRollMode}
              disabled={isRolling}
              className="px-2.5 py-1 rounded-lg bg-[#111827] hover:bg-[#151C2B] text-amber-300 border border-amber-500/30 text-xs font-mono-numbers font-bold flex items-center gap-1 cursor-pointer transition-colors"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Mode: {rollMode === 'over' ? 'Over' : 'Under'}</span>
            </button>
          </div>

          {/* Central Digital Roll Counter */}
          <div className="my-auto py-2 sm:py-4 text-center space-y-2">
            <div className={`w-28 sm:w-36 h-28 sm:h-36 rounded-2xl mx-auto flex flex-col items-center justify-center border-2 shadow-xl transition-all duration-300 ${
              lastOutcome === 'won'
                ? 'bg-emerald-950/60 border-emerald-400 text-emerald-300 shadow-[0_0_35px_rgba(34,197,94,0.35)]'
                : lastOutcome === 'lost'
                ? 'bg-red-950/60 border-red-500 text-red-400 shadow-[0_0_25px_rgba(239,68,68,0.35)]'
                : 'bg-[#111827] border-blue-500/40 text-white shadow-[0_0_25px_rgba(59,130,246,0.2)]'
            }`}>
              <span className="font-display font-black text-3xl sm:text-4xl tracking-tight font-mono-numbers">
                {lastRoll !== null ? lastRoll.toFixed(2) : '50.00'}
              </span>
              <span className="text-[9px] uppercase font-mono-numbers font-bold text-[#94A3B8]">
                {isRolling ? 'Rolling...' : (lastOutcome ? lastOutcome.toUpperCase() : 'Ready')}
              </span>
            </div>

            {lastOutcome && (
              <div className="text-xs font-mono-numbers font-extrabold animate-in fade-in">
                {lastOutcome === 'won' ? (
                  <span className="text-emerald-400">
                    Won +{(betAmount * calc.multiplier).toFixed(2)} FC
                  </span>
                ) : (
                  <span className="text-red-400">
                    Did not meet target {rollMode === 'over' ? `>${targetNumber}` : `<${targetNumber}`}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Interactive Range Slider (00.00 to 99.99) */}
          <div className="w-full space-y-2 pt-2 border-t border-[#1F2737] shrink-0">
            <div className="flex items-center justify-between text-xs font-mono-numbers font-bold">
              <span className="text-[#94A3B8]">0.00</span>
              <span className="text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-lg border border-amber-500/30 text-xs">
                Target: {rollMode === 'over' ? `> ${targetNumber.toFixed(2)}` : `< ${targetNumber.toFixed(2)}`}
              </span>
              <span className="text-[#94A3B8]">99.99</span>
            </div>

            <div className="relative flex items-center">
              <input
                type="range"
                min="1.00"
                max="98.00"
                step="0.01"
                value={targetNumber}
                onChange={handleSliderChange}
                disabled={isRolling}
                className="w-full h-2.5 bg-gradient-to-r from-red-500/40 via-amber-500/40 to-emerald-500/40 rounded-lg appearance-none cursor-pointer accent-amber-400 outline-none"
              />
            </div>

            <div className="flex items-center justify-between text-[9px] text-[#94A3B8] font-mono-numbers">
              <span>Provably Fair 1% House Edge</span>
              <span>Stake: 1 - 2,000 FC</span>
            </div>
          </div>

        </div>

      </div>

    </div>
  );
}

