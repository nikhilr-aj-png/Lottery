import React, { useState } from 'react';
import { useGameEngine } from '../hooks/useGameEngine';
import { generateCoinflip } from '../engine';
import { 
  Coins, 
  RefreshCw, 
  ShieldCheck, 
  History, 
  Play, 
  Sparkles,
  Trophy,
  CheckCircle2,
  XCircle
} from 'lucide-react';
import confetti from 'canvas-confetti';

export default function CoinflipGame() {
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
  } = useGameEngine('coinflip');

  // Player choice: 'heads' | 'tails'
  const [selectedSide, setSelectedSide] = useState('heads');
  const [isFlipping, setIsFlipping] = useState(false);
  const [coinRotation, setCoinRotation] = useState(0);
  const [lastResult, setLastResult] = useState(null); // 'won' | 'lost' | null
  const [landedSide, setLandedSide] = useState('heads');
  
  // History strip
  const [recentFlips, setRecentFlips] = useState([
    { side: 'heads', won: true, multiplier: 1.98 },
    { side: 'tails', won: false, multiplier: 0 },
    { side: 'tails', won: true, multiplier: 1.98 },
    { side: 'heads', won: true, multiplier: 1.98 },
    { side: 'tails', won: false, multiplier: 0 },
    { side: 'heads', won: true, multiplier: 1.98 }
  ]);

  const multiplier = 1.98; // 1% house edge
  const potentialPayout = parseFloat((betAmount * multiplier).toFixed(2));

  // Flip Action
  const handleFlip = async () => {
    if (isFlipping || loading) return;

    // 1. Start round in game engine (debit stake)
    const startRes = await startRound();
    if (!startRes.success) return;

    setIsFlipping(true);
    setLastResult(null);

    // 2. Pre-derive coinflip outcome authoritatively via Provably Fair HMAC-SHA256
    const outcomeSide = await generateCoinflip(
      seeds.serverHash || 'seed_coinflip_default',
      seeds.clientSeed,
      seeds.nonce
    );

    // 3. Spin animation (rotates 5 full turns + final face)
    const extraTurns = 1800; // 5 full 360 spins
    const finalAngle = outcomeSide === 'heads' ? 0 : 180;
    const targetRotation = coinRotation + extraTurns + finalAngle;
    setCoinRotation(targetRotation);

    setTimeout(() => {
      finalizeFlip(outcomeSide);
    }, 1200);
  };

  const finalizeFlip = async (outcomeSide) => {
    setLandedSide(outcomeSide);
    setIsFlipping(false);

    const isWin = outcomeSide === selectedSide;
    setLastResult(isWin ? 'won' : 'lost');

    const finalMultiplier = isWin ? multiplier : 0;
    const finalPayout = isWin ? potentialPayout : 0;

    if (isWin) {
      try {
        confetti({
          particleCount: 75,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#F5C451', '#22C55E', '#EAB308']
        });
      } catch (_) {}
    }

    // Settle round securely via Supabase RPC
    await settleRound({
      multiplier: finalMultiplier,
      payout: finalPayout,
      outcomeData: {
        selectedSide,
        landedSide: outcomeSide,
        isWin
      }
    });

    setRecentFlips(prev => [
      { side: outcomeSide, won: isWin, multiplier: finalMultiplier },
      ...prev.slice(0, 7)
    ]);
  };

  return (
    <div className="w-full space-y-4">
      {/* 1. RECENT FLIPS STRIP */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs font-mono-numbers no-scrollbar">
        <span className="text-[#94A3B8] text-[11px] uppercase tracking-wider flex items-center gap-1 font-bold pl-1">
          <History className="w-3.5 h-3.5 text-amber-400" />
          Recent:
        </span>
        {recentFlips.map((f, idx) => (
          <span
            key={idx}
            className={`px-2.5 py-1 rounded-lg border font-bold flex items-center gap-1.5 shrink-0 ${
              f.won
                ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-300'
                : 'bg-rose-950/40 border-rose-500/30 text-rose-300'
            }`}
          >
            <span className="text-base leading-none">{f.side === 'heads' ? '👑' : '🦅'}</span>
            <span className="capitalize">{f.side}</span>
            <span className="text-[10px] opacity-75">({f.won ? `${f.multiplier}x` : '0x'})</span>
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
                  disabled={isFlipping}
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
                disabled={isFlipping}
                className="py-1.5 rounded-lg bg-[#0B0F19] hover:bg-[#151C2B] text-[#94A3B8] hover:text-white border border-[#1F2737] transition-colors cursor-pointer disabled:opacity-50"
              >
                ½
              </button>
              <button
                type="button"
                onClick={doubleBet}
                disabled={isFlipping}
                className="py-1.5 rounded-lg bg-[#0B0F19] hover:bg-[#151C2B] text-[#94A3B8] hover:text-white border border-[#1F2737] transition-colors cursor-pointer disabled:opacity-50"
              >
                2x
              </button>
              <button
                type="button"
                onClick={setMinBet}
                disabled={isFlipping}
                className="py-1.5 rounded-lg bg-[#0B0F19] hover:bg-[#151C2B] text-[#94A3B8] hover:text-white border border-[#1F2737] transition-colors cursor-pointer disabled:opacity-50"
              >
                Min
              </button>
              <button
                type="button"
                onClick={setMaxBet}
                disabled={isFlipping}
                className="py-1.5 rounded-lg bg-[#0B0F19] hover:bg-[#151C2B] text-amber-400 border border-[#1F2737] transition-colors cursor-pointer disabled:opacity-50"
              >
                Max
              </button>
            </div>

            {/* Side Selection: Heads vs Tails */}
            <div>
              <span className="text-xs font-bold text-[#94A3B8] block mb-1.5 font-mono-numbers">
                Select Side:
              </span>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedSide('heads')}
                  disabled={isFlipping}
                  className={`p-3 rounded-xl border flex flex-col items-center gap-1 transition-all cursor-pointer disabled:opacity-50 ${
                    selectedSide === 'heads'
                      ? 'bg-amber-500/20 border-amber-500 text-white shadow-lg shadow-amber-500/10'
                      : 'bg-[#0B0F19] hover:bg-[#151C2B] border-[#1F2737] text-[#94A3B8]'
                  }`}
                >
                  <span className="text-2xl">👑</span>
                  <span className="font-extrabold text-xs uppercase tracking-wider">Heads</span>
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedSide('tails')}
                  disabled={isFlipping}
                  className={`p-3 rounded-xl border flex flex-col items-center gap-1 transition-all cursor-pointer disabled:opacity-50 ${
                    selectedSide === 'tails'
                      ? 'bg-purple-500/20 border-purple-500 text-white shadow-lg shadow-purple-500/10'
                      : 'bg-[#0B0F19] hover:bg-[#151C2B] border-[#1F2737] text-[#94A3B8]'
                  }`}
                >
                  <span className="text-2xl">🦅</span>
                  <span className="font-extrabold text-xs uppercase tracking-wider">Tails</span>
                </button>
              </div>
            </div>

            {/* Payout & Odds Dashboard */}
            <div className="grid grid-cols-2 gap-2 text-xs font-mono-numbers pt-2 border-t border-[#1F2737]">
              <div className="bg-[#0B0F19] p-2.5 rounded-xl border border-[#1F2737]">
                <span className="text-[10px] text-[#94A3B8] block">Multiplier</span>
                <span className="font-black text-base text-amber-300">{multiplier}x</span>
              </div>

              <div className="bg-[#0B0F19] p-2.5 rounded-xl border border-[#1F2737]">
                <span className="text-[10px] text-[#94A3B8] block">Win Chance</span>
                <span className="font-black text-base text-emerald-400">49.50%</span>
              </div>
            </div>

          </div>

          {/* Action Button: Flip Coin */}
          <div className="pt-2">
            <button
              type="button"
              onClick={handleFlip}
              disabled={isFlipping || loading}
              className="w-full py-3.5 rounded-xl font-extrabold text-sm flex items-center justify-center gap-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black shadow-lg shadow-amber-500/20 hover:scale-[1.02] active:scale-95 transition-all cursor-pointer disabled:opacity-60"
            >
              {loading || isFlipping ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <Play className="w-4 h-4 fill-current" />
                  <span>Flip Coin ({betAmount} FC)</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Coinflip Animation Stage (Right) */}
        <div className="lg:col-span-8 bg-[#07090E] border border-[#1F2737] rounded-2xl p-6 flex flex-col justify-between items-center text-center relative overflow-hidden min-h-[380px]">
          <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />

          {/* Stage Header */}
          <div className="w-full flex items-center justify-between text-xs text-[#94A3B8] font-mono-numbers pb-3 border-b border-[#1F2737]">
            <div className="flex items-center gap-2">
              <Coins className="w-4 h-4 text-amber-400" />
              <span>Selection: <strong className="text-white uppercase font-bold">{selectedSide}</strong></span>
            </div>
            <span>
              Win Profit: <strong className="text-amber-300">+{potentialPayout.toLocaleString()} FC</strong>
            </span>
          </div>

          {/* 3D Animated Coin Center */}
          <div className="my-auto py-8 space-y-5">
            <div className="relative w-36 h-36 sm:w-44 sm:h-44 mx-auto [perspective:1000px]">
              <div 
                className="w-full h-full relative [transform-style:preserve-3d] transition-transform duration-[1200ms] ease-out"
                style={{ transform: `rotateY(${coinRotation}deg)` }}
              >
                {/* Heads Face (Front) */}
                <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-amber-600 via-[#F5C451] to-amber-300 border-4 border-amber-300 flex flex-col items-center justify-center shadow-[0_0_35px_rgba(245,196,81,0.4)] [backface-visibility:hidden]">
                  <span className="text-5xl sm:text-6xl drop-shadow-md">👑</span>
                  <span className="font-display font-black text-xs text-amber-950 uppercase tracking-widest mt-1">HEADS</span>
                </div>

                {/* Tails Face (Back) */}
                <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-purple-700 via-purple-500 to-indigo-400 border-4 border-purple-300 flex flex-col items-center justify-center shadow-[0_0_35px_rgba(168,85,247,0.4)] [backface-visibility:hidden] [transform:rotateY(180deg)]">
                  <span className="text-5xl sm:text-6xl drop-shadow-md">🦅</span>
                  <span className="font-display font-black text-xs text-purple-950 uppercase tracking-widest mt-1">TAILS</span>
                </div>
              </div>
            </div>

            {/* Outcome Badge / Announcement */}
            <div>
              {isFlipping ? (
                <span className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300 text-xs font-mono-numbers font-bold animate-pulse">
                  <RefreshCw className="w-3 h-3 animate-spin" />
                  Coin in Flight...
                </span>
              ) : lastResult === 'won' ? (
                <div className="space-y-1 animate-in zoom-in-75">
                  <span className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-emerald-500/20 border border-emerald-500/50 text-emerald-300 text-sm font-mono-numbers font-black">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    CORRECT! {landedSide.toUpperCase()} WON +{potentialPayout.toLocaleString()} FC
                  </span>
                </div>
              ) : lastResult === 'lost' ? (
                <div className="space-y-1 animate-in zoom-in-75">
                  <span className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-rose-500/20 border border-rose-500/50 text-rose-300 text-sm font-mono-numbers font-black">
                    <XCircle className="w-4 h-4 text-rose-400" />
                    LANDED ON {landedSide.toUpperCase()}! Stake Lost
                  </span>
                </div>
              ) : (
                <span className="text-xs text-[#94A3B8]">
                  Choose Heads or Tails and click Flip to launch
                </span>
              )}
            </div>
          </div>

          {/* Stage Footer: Provably Fair Note */}
          <div className="w-full flex items-center justify-between pt-3 border-t border-[#1F2737] text-[11px] text-[#94A3B8]">
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>Provably Fair: HMAC-SHA256 Binary Flip</span>
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

