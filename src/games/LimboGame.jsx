import React, { useState } from 'react';
import { useGameEngine } from '../hooks/useGameEngine';
import { generateLimboMultiplier, calculateLimboOdds } from '../engine';
import { 
  Zap, 
  TrendingUp, 
  History, 
  ShieldCheck, 
  Coins, 
  CheckCircle2, 
  XCircle,
  Percent,
  Play,
  Flame,
  ArrowUpRight,
  RefreshCw
} from 'lucide-react';
import confetti from 'canvas-confetti';

export default function LimboGame() {
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
  } = useGameEngine('limbo');

  // Target multiplier: 1.01x to 10,000x (Default: 2.00x)
  const [targetMultiplier, setTargetMultiplier] = useState(2.00);
  const [isSpinning, setIsSpinning] = useState(false);
  const [displayedOutcome, setDisplayedOutcome] = useState(null);
  const [lastRoundResult, setLastRoundResult] = useState(null); // 'won' | 'lost' | null

  // Recent multiplier history
  const [recentLimbo, setRecentLimbo] = useState([
    { multiplier: 4.82, won: true },
    { multiplier: 1.15, won: false },
    { multiplier: 12.40, won: true },
    { multiplier: 1.03, won: false },
    { multiplier: 2.10, won: true },
    { multiplier: 1.88, won: false },
    { multiplier: 67.50, won: true }
  ]);

  // Derived calculations from Rules Engine
  const odds = calculateLimboOdds(targetMultiplier, 1.0);
  const potentialPayout = parseFloat((betAmount * targetMultiplier).toFixed(2));

  // Change target handler
  const handleTargetChange = (val) => {
    const num = Math.max(1.01, Math.min(10000.0, parseFloat(val) || 1.01));
    setTargetMultiplier(parseFloat(num.toFixed(2)));
  };

  // Launch Limbo Play
  const handlePlay = async () => {
    if (isSpinning || loading) return;

    // 1. Start round in Game Engine (debits stake)
    const startRes = await startRound();
    if (!startRes.success) return;

    setIsSpinning(true);
    setLastRoundResult(null);

    // 2. Derive deterministic Limbo outcome via Provably Fair algorithm
    const rolledOutcome = await generateLimboMultiplier(
      seeds.serverHash || 'seed_limbo_default',
      seeds.clientSeed,
      seeds.nonce
    );

    // Dynamic digital spin animation (450ms)
    let steps = 0;
    const interval = setInterval(() => {
      // Rapid random visual numbers
      const fakeNumber = (Math.random() * (targetMultiplier * 2.5)).toFixed(2);
      setDisplayedOutcome(fakeNumber);
      steps++;

      if (steps >= 9) {
        clearInterval(interval);
        finalizeRound(rolledOutcome);
      }
    }, 45);
  };

  const finalizeRound = async (outcome) => {
    setDisplayedOutcome(outcome.toFixed(2));
    setIsSpinning(false);

    const isWin = outcome >= targetMultiplier;
    setLastRoundResult(isWin ? 'won' : 'lost');

    const finalMultiplier = isWin ? targetMultiplier : 0;
    const finalPayout = isWin ? potentialPayout : 0;

    if (isWin) {
      try {
        confetti({
          particleCount: 70,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#F5C451', '#22C55E', '#A855F7']
        });
      } catch (_) {}
    }

    // Settle round securely in Supabase ledger
    await settleRound({
      multiplier: finalMultiplier,
      payout: finalPayout,
      outcomeData: {
        targetMultiplier,
        derivedOutcome: outcome,
        isWin
      }
    });

    // Update history ticker
    setRecentLimbo(prev => [
      { multiplier: outcome, won: isWin },
      ...prev.slice(0, 7)
    ]);
  };

  return (
    <div className="w-full space-y-4">
      {/* 1. RECENT OUTCOMES STRIP */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs font-mono-numbers no-scrollbar">
        <span className="text-[#94A3B8] text-[11px] uppercase tracking-wider flex items-center gap-1 font-bold pl-1">
          <History className="w-3.5 h-3.5 text-amber-400" />
          Recent:
        </span>
        {recentLimbo.map((item, idx) => (
          <span
            key={idx}
            className={`px-2.5 py-1 rounded-lg border font-bold flex items-center gap-1 shrink-0 ${
              item.won
                ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-300'
                : 'bg-rose-950/40 border-rose-500/30 text-rose-300'
            }`}
          >
            <Zap className={`w-3 h-3 ${item.won ? 'text-emerald-400' : 'text-rose-400'}`} />
            {item.multiplier.toFixed(2)}x
          </span>
        ))}
      </div>

      {/* 2. MAIN GRID & CONTROLS CONTAINER */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        
        {/* Controls Column (Left) */}
        <div className="lg:col-span-4 bg-[#111827] border border-[#1F2737] rounded-2xl p-4 sm:p-5 space-y-4 flex flex-col justify-between">
          <div className="space-y-4">
            
            {/* Stake Input */}
            <div>
              <div className="flex items-center justify-between text-xs mb-1.5 font-bold font-mono-numbers">
                <span className="text-[#94A3B8]">Bet Amount:</span>
                <span className="text-amber-300">Balance: {walletBalance.toLocaleString()} FC</span>
              </div>
              <div className="flex items-center bg-[#0B0F19] border border-[#1F2737] focus-within:border-amber-500/50 rounded-xl p-1.5">
                <input
                  type="number"
                  min="1"
                  max="2000"
                  value={betAmount}
                  onChange={(e) => setBetAmount(Math.max(1, parseFloat(e.target.value) || 0))}
                  disabled={isSpinning}
                  className="flex-1 bg-transparent px-2.5 text-white font-mono-numbers font-black text-base outline-none disabled:opacity-50"
                />
                <span className="text-amber-400 font-black text-xs px-2 font-mono-numbers">FC</span>
              </div>
            </div>

            {/* Quick Stake Adjusters */}
            <div className="grid grid-cols-4 gap-1.5 text-xs font-mono-numbers font-bold">
              <button
                type="button"
                onClick={halveBet}
                disabled={isSpinning}
                className="py-1.5 rounded-lg bg-[#0B0F19] hover:bg-[#151C2B] text-[#94A3B8] hover:text-white border border-[#1F2737] transition-colors cursor-pointer disabled:opacity-50"
              >
                ½
              </button>
              <button
                type="button"
                onClick={doubleBet}
                disabled={isSpinning}
                className="py-1.5 rounded-lg bg-[#0B0F19] hover:bg-[#151C2B] text-[#94A3B8] hover:text-white border border-[#1F2737] transition-colors cursor-pointer disabled:opacity-50"
              >
                2x
              </button>
              <button
                type="button"
                onClick={setMinBet}
                disabled={isSpinning}
                className="py-1.5 rounded-lg bg-[#0B0F19] hover:bg-[#151C2B] text-[#94A3B8] hover:text-white border border-[#1F2737] transition-colors cursor-pointer disabled:opacity-50"
              >
                Min
              </button>
              <button
                type="button"
                onClick={setMaxBet}
                disabled={isSpinning}
                className="py-1.5 rounded-lg bg-[#0B0F19] hover:bg-[#151C2B] text-amber-400 border border-[#1F2737] transition-colors cursor-pointer disabled:opacity-50"
              >
                Max
              </button>
            </div>

            {/* Target Multiplier Input */}
            <div>
              <div className="flex items-center justify-between text-xs mb-1.5 font-bold font-mono-numbers">
                <span className="text-[#94A3B8] flex items-center gap-1">
                  <TrendingUp className="w-3.5 h-3.5 text-amber-400" />
                  Target Multiplier:
                </span>
                <span className="text-amber-300 font-black">{targetMultiplier.toFixed(2)}x</span>
              </div>

              <div className="flex items-center bg-[#0B0F19] border border-[#1F2737] focus-within:border-amber-500/50 rounded-xl p-1.5 mb-2">
                <input
                  type="number"
                  min="1.01"
                  max="10000"
                  step="0.10"
                  value={targetMultiplier}
                  onChange={(e) => handleTargetChange(e.target.value)}
                  disabled={isSpinning}
                  className="flex-1 bg-transparent px-2.5 text-white font-mono-numbers font-black text-base outline-none disabled:opacity-50"
                />
                <span className="text-amber-400 font-black text-xs px-2 font-mono-numbers">X</span>
              </div>

              {/* Quick Target Presets */}
              <div className="grid grid-cols-5 gap-1 text-xs font-mono-numbers font-bold">
                {[1.5, 2.0, 5.0, 10.0, 100.0].map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => handleTargetChange(t)}
                    disabled={isSpinning}
                    className={`py-1 rounded-lg border transition-all cursor-pointer disabled:opacity-50 ${
                      targetMultiplier === t
                        ? 'bg-amber-500/20 border-amber-500 text-amber-300 font-black'
                        : 'bg-[#0B0F19] hover:bg-[#151C2B] text-[#94A3B8] border-[#1F2737]'
                    }`}
                  >
                    {t}x
                  </button>
                ))}
              </div>
            </div>

            {/* Odds & Payout Dashboard */}
            <div className="grid grid-cols-2 gap-2 text-xs font-mono-numbers pt-2 border-t border-[#1F2737]">
              <div className="bg-[#0B0F19] p-2.5 rounded-xl border border-[#1F2737]">
                <span className="text-[10px] text-[#94A3B8] block">Win Chance</span>
                <span className="font-black text-base text-emerald-400">{odds.winChance}%</span>
              </div>

              <div className="bg-[#0B0F19] p-2.5 rounded-xl border border-[#1F2737]">
                <span className="text-[10px] text-[#94A3B8] block">Estimated Profit</span>
                <span className="font-black text-base text-amber-300">
                  +{potentialPayout.toLocaleString()} FC
                </span>
              </div>
            </div>

          </div>

          {/* Action Button: Play Limbo */}
          <div className="pt-2">
            <button
              type="button"
              onClick={handlePlay}
              disabled={isSpinning || loading}
              className="w-full py-3.5 rounded-xl font-extrabold text-sm flex items-center justify-center gap-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black shadow-lg shadow-amber-500/20 hover:scale-[1.02] active:scale-95 transition-all cursor-pointer disabled:opacity-60"
            >
              {loading || isSpinning ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <Play className="w-4 h-4 fill-current" />
                  <span>Launch Rocket ({betAmount} FC)</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Limbo Display Stage (Right) */}
        <div className="lg:col-span-8 bg-[#07090E] border border-[#1F2737] rounded-2xl p-6 flex flex-col justify-between items-center text-center relative overflow-hidden min-h-[380px]">
          <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />

          {/* Stage Header */}
          <div className="w-full flex items-center justify-between text-xs text-[#94A3B8] font-mono-numbers pb-3 border-b border-[#1F2737]">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-400" />
              <span>Target: <strong className="text-white font-bold">{targetMultiplier.toFixed(2)}x</strong></span>
            </div>
            <span>
              Win Chance: <strong className="text-emerald-400">{odds.winChance}%</strong>
            </span>
          </div>

          {/* Massive Digital Multiplier Readout Center */}
          <div className="my-auto py-8 space-y-4">
            <div className="relative inline-block">
              <div
                className={`font-mono-numbers font-black tracking-tight transition-all duration-200 select-none ${
                  isSpinning
                    ? 'text-6xl sm:text-7xl md:text-8xl text-amber-400/80 animate-pulse'
                    : lastRoundResult === 'won'
                    ? 'text-6xl sm:text-7xl md:text-8xl text-emerald-400 drop-shadow-[0_0_35px_rgba(34,197,94,0.6)]'
                    : lastRoundResult === 'lost'
                    ? 'text-6xl sm:text-7xl md:text-8xl text-rose-500 drop-shadow-[0_0_25px_rgba(239,68,68,0.5)]'
                    : 'text-6xl sm:text-7xl md:text-8xl text-white'
                }`}
              >
                {displayedOutcome !== null ? `${displayedOutcome}x` : `${targetMultiplier.toFixed(2)}x`}
              </div>

              {/* Subtext Badge */}
              <div className="mt-2">
                {isSpinning ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300 text-xs font-mono-numbers font-bold animate-pulse">
                    <RefreshCw className="w-3 h-3 animate-spin" />
                    Calculating Hash...
                  </span>
                ) : lastRoundResult === 'won' ? (
                  <span className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-emerald-500/20 border border-emerald-500/50 text-emerald-300 text-sm font-mono-numbers font-black animate-in zoom-in-75">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    TARGET HIT! Won +{potentialPayout.toLocaleString()} FC
                  </span>
                ) : lastRoundResult === 'lost' ? (
                  <span className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-rose-500/20 border border-rose-500/50 text-rose-300 text-sm font-mono-numbers font-black animate-in zoom-in-75">
                    <XCircle className="w-4 h-4 text-rose-400" />
                    BUSTED! Below {targetMultiplier.toFixed(2)}x
                  </span>
                ) : (
                  <span className="text-xs text-[#94A3B8]">
                    Set target and click Launch to test Provably Fair outcome
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Stage Footer */}
          <div className="w-full flex items-center justify-between pt-3 border-t border-[#1F2737] text-[11px] text-[#94A3B8]">
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>Provably Fair: HMAC-SHA256 Limbo Curve</span>
            </span>
            <span className="text-amber-400 font-mono-numbers font-bold">
              House Edge: 1.0%
            </span>
          </div>

        </div>

      </div>
    </div>
  );
}

