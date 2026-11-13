import React, { useState, useEffect } from 'react';
import { useGameEngine } from '../hooks/useGameEngine';
import { generateRouletteNumber, ROULETTE_PAYOUTS } from '../engine';
import { 
  Play, 
  RefreshCw, 
  ShieldCheck, 
  History, 
  Coins, 
  Trophy, 
  CheckCircle2, 
  XCircle,
  Hash
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { soundFX } from '../engine/SoundFXService';

const RED_NUMBERS = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);

export default function RouletteGame({ 
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
  } = useGameEngine('roulette');

  // Enforce room-specific stake bounds
  useEffect(() => {
    if (room?.minStakeFC && betAmount < room.minStakeFC) {
      setBetAmount(room.minStakeFC);
    } else if (room?.maxStakeFC && betAmount > room.maxStakeFC) {
      setBetAmount(room.maxStakeFC);
    }
  }, [room?.minStakeFC, room?.maxStakeFC]);

  // Bet selection: can be outside bet ('red', 'black', 'even', 'odd', 'low', 'high', 'dozen1', 'dozen2', 'dozen3') or straight number (0 to 36)
  const [selectedBetType, setSelectedBetType] = useState('red');
  const [selectedNumber, setSelectedNumber] = useState(7);
  const [isSpinning, setIsSpinning] = useState(false);
  const [winningOutcome, setWinningOutcome] = useState<any>(null);
  const [lastRoundResult, setLastRoundResult] = useState<any>(null); // 'won' | 'lost' | null
  const [lastPayout, setLastPayout] = useState(0);

  // Recent roulette winning numbers
  const [recentSpins, setRecentSpins] = useState([
    { number: 17, color: 'black' },
    { number: 32, color: 'red' },
    { number: 0, color: 'green' },
    { number: 7, color: 'red' },
    { number: 24, color: 'black' },
    { number: 3, color: 'red' },
    { number: 11, color: 'black' }
  ]);

  // Multiplier for current selection
  const currentMultiplier = selectedBetType === 'straight' 
    ? ROULETTE_PAYOUTS.straight 
    : (ROULETTE_PAYOUTS[selectedBetType] || 2.0);

  const potentialPayout = parseFloat((betAmount * currentMultiplier).toFixed(2));

  // Spin Roulette Wheel Action
  const handleSpin = async () => {
    if (isSpinning || loading) return;

    // 1. Start round in game engine (debit stake)
    const startRes = await startRound();
    if (!startRes.success) return;

    soundFX.playChipBet();
    soundFX.playRouletteSpin();

    setIsSpinning(true);
    setLastRoundResult(null);

    // 2. Derive deterministic winning number from Provably Fair HMAC-SHA256
    const outcome = await generateRouletteNumber(
      seeds.serverHash || 'seed_roulette_default',
      seeds.clientSeed,
      seeds.nonce
    );

    // Dynamic spinning animation (600ms)
    let step = 0;
    const interval = setInterval(() => {
      const fakeNumber = Math.floor(Math.random() * 37);
      const fakeColor = fakeNumber === 0 ? 'green' : (RED_NUMBERS.has(fakeNumber) ? 'red' : 'black');
      setWinningOutcome({ number: fakeNumber, color: fakeColor });
      step++;

      if (step >= 12) {
        clearInterval(interval);
        finalizeSpin(outcome);
      }
    }, 50);
  };

  const finalizeSpin = async (outcome) => {
    soundFX.playRoulettePocket(outcome.number);
    setWinningOutcome(outcome);
    setIsSpinning(false);

    // Evaluate Win Condition
    let isWin = false;
    const n = outcome.number;

    if (selectedBetType === 'straight') {
      isWin = (n === selectedNumber);
    } else if (selectedBetType === 'red') {
      isWin = (outcome.color === 'red');
    } else if (selectedBetType === 'black') {
      isWin = (outcome.color === 'black');
    } else if (selectedBetType === 'even') {
      isWin = (n > 0 && n % 2 === 0);
    } else if (selectedBetType === 'odd') {
      isWin = (n > 0 && n % 2 === 1);
    } else if (selectedBetType === 'low') {
      isWin = (n >= 1 && n <= 18);
    } else if (selectedBetType === 'high') {
      isWin = (n >= 19 && n <= 36);
    } else if (selectedBetType === 'dozen1') {
      isWin = (n >= 1 && n <= 12);
    } else if (selectedBetType === 'dozen2') {
      isWin = (n >= 13 && n <= 24);
    } else if (selectedBetType === 'dozen3') {
      isWin = (n >= 25 && n <= 36);
    }

    setLastRoundResult(isWin ? 'won' : 'lost');
    const finalMultiplier = isWin ? currentMultiplier : 0;
    const finalPayout = isWin ? potentialPayout : 0;
    setLastPayout(finalPayout);

    if (isWin) {
      soundFX.playWinFanfare(selectedBetType === 'straight' ? 'big' : 'standard');
      try {
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#F5C451', '#22C55E', '#EF4444']
        });
      } catch (_) {}
    }

    // Settle round in Supabase
    await settleRound({
      multiplier: finalMultiplier,
      payout: finalPayout,
      outcomeData: {
        selectedBetType,
        selectedNumber: selectedBetType === 'straight' ? selectedNumber : null,
        winningNumber: outcome.number,
        winningColor: outcome.color,
        isWin,
        roomId: room?.id
      },
      metadata: { roomId: room?.id, roomName: room?.name }
    });

    setRecentSpins(prev => [
      { number: outcome.number, color: outcome.color },
      ...prev.slice(0, 7)
    ]);
  };

  return (
    <div className="w-full h-full flex flex-col min-h-0 overflow-hidden text-left space-y-1.5">
      {/* 1. RECENT SPINS STRIP */}
      <div className="flex items-center gap-2 overflow-x-auto pb-0.5 text-xs font-mono-numbers no-scrollbar shrink-0">
        <span className="text-[#94A3B8] text-[10px] uppercase tracking-wider flex items-center gap-1 font-bold pl-1 shrink-0">
          <History className="w-3 h-3 text-amber-400" />
          Recent:
        </span>
        {recentSpins.map((s, idx) => (
          <span
            key={idx}
            className={`w-5 h-5 rounded-full flex items-center justify-center font-black text-[10px] shrink-0 shadow-xs ${
              s.color === 'green'
                ? 'bg-emerald-600 text-white border border-emerald-400'
                : s.color === 'red'
                ? 'bg-rose-600 text-white border border-rose-400'
                : 'bg-[#151C2B] text-white border border-white/20'
            }`}
          >
            {s.number}
          </span>
        ))}
      </div>

      {/* 2. MAIN GRID & CONTROLS CONTAINER */}
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
                  disabled={isSpinning}
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
                disabled={isSpinning}
                className="py-1 rounded bg-[#0B0F19] hover:bg-[#151C2B] text-[#94A3B8] hover:text-white border border-[#1F2737] transition-colors cursor-pointer disabled:opacity-50 text-[11px]"
              >
                ½
              </button>
              <button
                type="button"
                onClick={doubleBet}
                disabled={isSpinning}
                className="py-1 rounded bg-[#0B0F19] hover:bg-[#151C2B] text-[#94A3B8] hover:text-white border border-[#1F2737] transition-colors cursor-pointer disabled:opacity-50 text-[11px]"
              >
                2x
              </button>
              <button
                type="button"
                onClick={setMinBet}
                disabled={isSpinning}
                className="py-1 rounded bg-[#0B0F19] hover:bg-[#151C2B] text-[#94A3B8] hover:text-white border border-[#1F2737] transition-colors cursor-pointer disabled:opacity-50 text-[11px]"
              >
                Min
              </button>
              <button
                type="button"
                onClick={setMaxBet}
                disabled={isSpinning}
                className="py-1 rounded bg-[#0B0F19] hover:bg-[#151C2B] text-amber-400 border border-[#1F2737] transition-colors cursor-pointer disabled:opacity-50 text-[11px]"
              >
                Max
              </button>
            </div>

            {/* Outside Bets Selector */}
            <div>
              <span className="text-[11px] font-bold text-[#94A3B8] block mb-1 font-mono-numbers">
                Popular Outside Bets:
              </span>
              <div className="grid grid-cols-2 gap-1 text-xs font-bold font-mono-numbers">
                <button
                  type="button"
                  onClick={() => setSelectedBetType('red')}
                  disabled={isSpinning}
                  className={`py-1 rounded-lg border flex items-center justify-center gap-1 transition-all cursor-pointer disabled:opacity-50 text-[11px] ${
                    selectedBetType === 'red'
                      ? 'bg-rose-600 text-white border-rose-400 shadow-md'
                      : 'bg-[#0B0F19] hover:bg-[#151C2B] text-rose-400 border-[#1F2737]'
                  }`}
                >
                  <span className="w-2 h-2 rounded-full bg-rose-500" />
                  Red (2x)
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedBetType('black')}
                  disabled={isSpinning}
                  className={`py-1 rounded-lg border flex items-center justify-center gap-1 transition-all cursor-pointer disabled:opacity-50 text-[11px] ${
                    selectedBetType === 'black'
                      ? 'bg-slate-800 text-white border-slate-400 shadow-md'
                      : 'bg-[#0B0F19] hover:bg-[#151C2B] text-slate-300 border-[#1F2737]'
                  }`}
                >
                  <span className="w-2 h-2 rounded-full bg-slate-400" />
                  Black (2x)
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedBetType('even')}
                  disabled={isSpinning}
                  className={`py-1 rounded-lg border transition-all cursor-pointer disabled:opacity-50 text-[11px] ${
                    selectedBetType === 'even'
                      ? 'bg-amber-500/20 border-amber-500 text-amber-300'
                      : 'bg-[#0B0F19] hover:bg-[#151C2B] text-[#94A3B8] border-[#1F2737]'
                  }`}
                >
                  Even (2x)
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedBetType('odd')}
                  disabled={isSpinning}
                  className={`py-1 rounded-lg border transition-all cursor-pointer disabled:opacity-50 text-[11px] ${
                    selectedBetType === 'odd'
                      ? 'bg-amber-500/20 border-amber-500 text-amber-300'
                      : 'bg-[#0B0F19] hover:bg-[#151C2B] text-[#94A3B8] border-[#1F2737]'
                  }`}
                >
                  Odd (2x)
                </button>
              </div>

              {/* Dozens */}
              <div className="grid grid-cols-3 gap-1 mt-1 text-[10px] font-bold font-mono-numbers">
                {['dozen1', 'dozen2', 'dozen3'].map((d, i) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setSelectedBetType(d)}
                    disabled={isSpinning}
                    className={`py-0.5 rounded border transition-all cursor-pointer disabled:opacity-50 ${
                      selectedBetType === d
                        ? 'bg-amber-500/20 border-amber-500 text-amber-300'
                        : 'bg-[#0B0F19] hover:bg-[#151C2B] text-[#94A3B8] border-[#1F2737]'
                    }`}
                  >
                    {i === 0 ? '1st 12' : i === 1 ? '2nd 12' : '3rd 12'} (3x)
                  </button>
                ))}
              </div>
            </div>

            {/* Straight Number Option */}
            <div>
              <div className="flex items-center justify-between text-xs mb-1 font-bold font-mono-numbers">
                <button
                  type="button"
                  onClick={() => setSelectedBetType('straight')}
                  className={`text-[11px] font-bold underline cursor-pointer ${
                    selectedBetType === 'straight' ? 'text-amber-400' : 'text-[#94A3B8]'
                  }`}
                >
                  Straight Number (36x):
                </button>
                {selectedBetType === 'straight' && (
                  <span className="text-amber-400 font-black text-xs">#{selectedNumber}</span>
                )}
              </div>
              <input
                type="number"
                min="0"
                max="36"
                value={selectedNumber}
                onChange={(e) => {
                  setSelectedBetType('straight');
                  setSelectedNumber(Math.max(0, Math.min(36, parseInt(e.target.value, 10) || 0)));
                }}
                disabled={isSpinning}
                className="w-full bg-[#0B0F19] border border-[#1F2737] focus:border-amber-500/50 rounded-lg px-2.5 py-1 text-white font-mono-numbers text-xs outline-none disabled:opacity-50"
              />
            </div>

            {/* Payout Summary */}
            <div className="bg-[#0B0F19] border border-[#1F2737] rounded-lg p-2 flex items-center justify-between text-xs font-mono-numbers">
              <span className="text-[#94A3B8] text-[11px]">Potential Profit:</span>
              <span className="text-amber-300 font-black text-xs">
                +{potentialPayout.toLocaleString()} FC ({currentMultiplier}x)
              </span>
            </div>

          </div>

          {/* Action Button: Spin Roulette */}
          <div className="shrink-0">
            <button
              type="button"
              onClick={handleSpin}
              disabled={isSpinning || loading}
              className="w-full py-2.5 sm:py-3 rounded-xl font-extrabold text-xs sm:text-sm flex items-center justify-center gap-1.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black shadow-md shadow-amber-500/20 transition-all cursor-pointer disabled:opacity-60"
            >
              {loading || isSpinning ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <Play className="w-4 h-4 fill-current" />
                  <span>Spin Wheel ({betAmount} FC)</span>
                </>
              )}
            </button>
          </div>

          {/* Dedicated In-Room Activity Box */}
          {activityBox}
        </div>

        {/* Roulette Wheel Stage (Landscape: Right / Portrait: Top) */}
        <div className="order-1 lg:order-2 lg:col-span-8 bg-[#07090E] border border-[#1F2737] rounded-xl p-2 sm:p-4 flex flex-col justify-between items-center text-center relative overflow-hidden h-full min-h-[180px] lg:min-h-0">
          <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />

          {/* Top Status */}
          <div className="w-full flex items-center justify-between text-xs text-[#94A3B8] font-mono-numbers pb-2 border-b border-[#1F2737] shrink-0">
            <span>Bet: <strong className="text-white uppercase font-bold">{selectedBetType === 'straight' ? `Number #${selectedNumber}` : selectedBetType}</strong></span>
            <span>Multiplier: <strong className="text-amber-400 font-bold">{currentMultiplier}x</strong></span>
          </div>

          {/* Roulette Wheel Center Display */}
          <div className="my-auto py-2 sm:py-4 space-y-2">
            <div className="relative w-32 h-32 sm:w-40 sm:h-40 mx-auto flex items-center justify-center">
              {/* Outer Golden Rim */}
              <div className={`absolute inset-0 rounded-full border-4 border-amber-500/60 shadow-[0_0_25px_rgba(245,196,81,0.25)] ${isSpinning ? 'animate-spin' : ''}`} />
              
              {/* Ball Orbit track */}
              <div className="absolute inset-2.5 rounded-full border-2 border-dashed border-white/20" />

              {/* Center Winning Result Ball */}
              <div 
                className={`w-20 h-20 sm:w-28 sm:h-28 rounded-full flex flex-col items-center justify-center shadow-xl transition-all duration-300 border-2 ${
                  winningOutcome
                    ? winningOutcome.color === 'green'
                      ? 'bg-gradient-to-br from-emerald-600 to-emerald-800 border-emerald-400 text-white shadow-emerald-500/50'
                      : winningOutcome.color === 'red'
                      ? 'bg-gradient-to-br from-rose-600 to-red-800 border-rose-400 text-white shadow-rose-500/50'
                      : 'bg-gradient-to-br from-slate-800 to-black border-slate-500 text-white shadow-black/80'
                    : 'bg-[#111827] border-amber-500/40 text-amber-400'
                }`}
              >
                <span className="font-mono-numbers font-black text-3xl sm:text-4xl">
                  {winningOutcome ? winningOutcome.number : '🎡'}
                </span>
                {winningOutcome && (
                  <span className="text-[9px] uppercase font-bold tracking-widest opacity-80">
                    {winningOutcome.color}
                  </span>
                )}
              </div>
            </div>

            {/* Outcome Announcement */}
            <div>
              {isSpinning ? (
                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300 text-xs font-mono-numbers font-bold animate-pulse">
                  <RefreshCw className="w-3 h-3 animate-spin" />
                  Spinning...
                </span>
              ) : lastRoundResult === 'won' ? (
                <div className="space-y-0.5 animate-in zoom-in-75">
                  <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/50 text-emerald-300 text-xs font-mono-numbers font-black">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    WIN! +{lastPayout.toLocaleString()} FC ({currentMultiplier}x)
                  </span>
                </div>
              ) : lastRoundResult === 'lost' ? (
                <div className="space-y-0.5 animate-in zoom-in-75">
                  <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-rose-500/20 border border-rose-500/50 text-rose-300 text-xs font-mono-numbers font-black">
                    <XCircle className="w-3.5 h-3.5 text-rose-400" />
                    Landed on #{winningOutcome?.number} ({winningOutcome?.color.toUpperCase()})
                  </span>
                </div>
              ) : (
                <span className="text-[11px] text-[#94A3B8]">
                  Select bets and click Spin Wheel
                </span>
              )}
            </div>
          </div>

          {/* Stage Footer: Provably Fair Note */}
          <div className="w-full flex items-center justify-between pt-2 border-t border-[#1F2737] text-[10px] text-[#94A3B8] shrink-0">
            <span className="flex items-center gap-1">
              <ShieldCheck className="w-3 h-3 text-emerald-400" />
              <span>Provably Fair European Wheel</span>
            </span>
            <span className="text-amber-400 font-mono-numbers font-bold">
              House Edge: 2.7%
            </span>
          </div>

        </div>

      </div>
    </div>
  );
}

