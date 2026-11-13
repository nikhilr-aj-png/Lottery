import React, { useState, useEffect } from 'react';
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
import { soundFX } from '../engine/SoundFXService';

export default function CoinflipGame({ 
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
  } = useGameEngine('coinflip');

  // Enforce room-specific stake bounds
  useEffect(() => {
    if (room?.minStakeFC && betAmount < room.minStakeFC) {
      setBetAmount(room.minStakeFC);
    } else if (room?.maxStakeFC && betAmount > room.maxStakeFC) {
      setBetAmount(room.maxStakeFC);
    }
  }, [room?.minStakeFC, room?.maxStakeFC]);

  // Player choice: 'heads' | 'tails'
  const [selectedSide, setSelectedSide] = useState('heads');
  const [isFlipping, setIsFlipping] = useState(false);
  const [coinRotation, setCoinRotation] = useState(0);
  const [lastResult, setLastResult] = useState<any>(null); // 'won' | 'lost' | null
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

    soundFX.playChipBet();
    soundFX.playCoinflipToss();

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
    soundFX.playCoinflipLand(isWin);
    setLastResult(isWin ? 'won' : 'lost');

    const finalMultiplier = isWin ? multiplier : 0;
    const finalPayout = isWin ? potentialPayout : 0;

    if (isWin) {
      soundFX.playWinFanfare('standard');
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
        isWin,
        roomId: room?.id
      },
      metadata: { roomId: room?.id, roomName: room?.name }
    });

    setRecentFlips(prev => [
      { side: outcomeSide, won: isWin, multiplier: finalMultiplier },
      ...prev.slice(0, 7)
    ]);
  };

  return (
    <div className="w-full h-full flex flex-col min-h-0 overflow-hidden text-left space-y-1.5">
      {/* 1. RECENT FLIPS STRIP */}
      <div className="flex items-center gap-2 overflow-x-auto pb-0.5 text-xs font-mono-numbers no-scrollbar shrink-0">
        <span className="text-[#94A3B8] text-[10px] uppercase tracking-wider flex items-center gap-1 font-bold pl-1 shrink-0">
          <History className="w-3 h-3 text-amber-400" />
          Recent:
        </span>
        {recentFlips.map((f, idx) => (
          <span
            key={idx}
            className={`px-1.5 py-0.2 rounded text-[10px] border font-bold flex items-center gap-1 shrink-0 ${
              f.won
                ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-300'
                : 'bg-rose-950/40 border-rose-500/30 text-rose-300'
            }`}
          >
            <span className="text-xs leading-none">{f.side === 'heads' ? '👑' : '🦅'}</span>
            <span className="capitalize">{f.side}</span>
            <span className="text-[9px] opacity-75">({f.won ? `${f.multiplier}x` : '0x'})</span>
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
                  disabled={isFlipping}
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
                disabled={isFlipping}
                className="py-1 rounded bg-[#0B0F19] hover:bg-[#151C2B] text-[#94A3B8] hover:text-white border border-[#1F2737] transition-colors cursor-pointer disabled:opacity-50 text-[11px]"
              >
                ½
              </button>
              <button
                type="button"
                onClick={doubleBet}
                disabled={isFlipping}
                className="py-1 rounded bg-[#0B0F19] hover:bg-[#151C2B] text-[#94A3B8] hover:text-white border border-[#1F2737] transition-colors cursor-pointer disabled:opacity-50 text-[11px]"
              >
                2x
              </button>
              <button
                type="button"
                onClick={setMinBet}
                disabled={isFlipping}
                className="py-1 rounded bg-[#0B0F19] hover:bg-[#151C2B] text-[#94A3B8] hover:text-white border border-[#1F2737] transition-colors cursor-pointer disabled:opacity-50 text-[11px]"
              >
                Min
              </button>
              <button
                type="button"
                onClick={setMaxBet}
                disabled={isFlipping}
                className="py-1 rounded bg-[#0B0F19] hover:bg-[#151C2B] text-amber-400 border border-[#1F2737] transition-colors cursor-pointer disabled:opacity-50 text-[11px]"
              >
                Max
              </button>
            </div>

            {/* Side Selection: Heads vs Tails */}
            <div>
              <span className="text-[11px] font-bold text-[#94A3B8] block mb-1 font-mono-numbers">
                Select Side:
              </span>
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  onClick={() => setSelectedSide('heads')}
                  disabled={isFlipping}
                  className={`p-2 rounded-lg border flex flex-col items-center gap-0.5 transition-all cursor-pointer disabled:opacity-50 ${
                    selectedSide === 'heads'
                      ? 'bg-amber-500/20 border-amber-500 text-white shadow-md'
                      : 'bg-[#0B0F19] hover:bg-[#151C2B] border-[#1F2737] text-[#94A3B8]'
                  }`}
                >
                  <span className="text-xl">👑</span>
                  <span className="font-extrabold text-[11px] uppercase tracking-wider">Heads</span>
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedSide('tails')}
                  disabled={isFlipping}
                  className={`p-2 rounded-lg border flex flex-col items-center gap-0.5 transition-all cursor-pointer disabled:opacity-50 ${
                    selectedSide === 'tails'
                      ? 'bg-purple-500/20 border-purple-500 text-white shadow-md'
                      : 'bg-[#0B0F19] hover:bg-[#151C2B] border-[#1F2737] text-[#94A3B8]'
                  }`}
                >
                  <span className="text-xl">🦅</span>
                  <span className="font-extrabold text-[11px] uppercase tracking-wider">Tails</span>
                </button>
              </div>
            </div>

            {/* Payout & Odds Dashboard */}
            <div className="grid grid-cols-2 gap-1 text-xs font-mono-numbers pt-1.5 border-t border-[#1F2737]">
              <div className="bg-[#0B0F19] p-2 rounded-lg border border-[#1F2737]">
                <span className="text-[9px] text-[#94A3B8] block">Multiplier</span>
                <span className="font-black text-sm text-amber-300">{multiplier}x</span>
              </div>

              <div className="bg-[#0B0F19] p-2 rounded-lg border border-[#1F2737]">
                <span className="text-[9px] text-[#94A3B8] block">Win Chance</span>
                <span className="font-black text-sm text-emerald-400">49.50%</span>
              </div>
            </div>

          </div>

          {/* Action Button: Flip Coin */}
          <div className="shrink-0">
            <button
              type="button"
              onClick={handleFlip}
              disabled={isFlipping || loading}
              className="w-full py-2.5 sm:py-3 rounded-xl font-extrabold text-xs sm:text-sm flex items-center justify-center gap-1.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black shadow-md shadow-amber-500/20 transition-all cursor-pointer disabled:opacity-60"
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

          {/* Dedicated In-Room Activity Box */}
          {activityBox}
        </div>

        {/* Coinflip Animation Stage (Landscape: Right / Portrait: Top) */}
        <div className="order-1 lg:order-2 lg:col-span-8 bg-[#07090E] border border-[#1F2737] rounded-xl p-3 sm:p-4 flex flex-col justify-between items-center text-center relative overflow-hidden h-full min-h-[160px] lg:min-h-0">
          <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />

          {/* Stage Header */}
          <div className="w-full flex items-center justify-between text-xs text-[#94A3B8] font-mono-numbers pb-2 border-b border-[#1F2737] shrink-0">
            <div className="flex items-center gap-1.5">
              <Coins className="w-3.5 h-3.5 text-amber-400" />
              <span>Selection: <strong className="text-white uppercase font-bold">{selectedSide}</strong></span>
            </div>
            <span>
              Profit: <strong className="text-amber-300">+{potentialPayout.toLocaleString()} FC</strong>
            </span>
          </div>

          {/* 3D Animated Coin Center */}
          <div className="my-auto py-2 sm:py-4 space-y-3">
            <div className="relative w-28 h-28 sm:w-36 sm:h-36 mx-auto [perspective:1000px]">
              <div 
                className="w-full h-full relative [transform-style:preserve-3d] transition-transform duration-[1200ms] ease-out"
                style={{ transform: `rotateY(${coinRotation}deg)` }}
              >
                {/* Heads Face (Front) */}
                <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-amber-600 via-[#F5C451] to-amber-300 border-4 border-amber-300 flex flex-col items-center justify-center shadow-[0_0_35px_rgba(245,196,81,0.4)] [backface-visibility:hidden]">
                  <span className="text-4xl sm:text-5xl drop-shadow-md">👑</span>
                  <span className="font-display font-black text-[10px] text-amber-950 uppercase tracking-widest mt-0.5">HEADS</span>
                </div>

                {/* Tails Face (Back) */}
                <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-purple-700 via-purple-500 to-indigo-400 border-4 border-purple-300 flex flex-col items-center justify-center shadow-[0_0_35px_rgba(168,85,247,0.4)] [backface-visibility:hidden] [transform:rotateY(180deg)]">
                  <span className="text-4xl sm:text-5xl drop-shadow-md">🦅</span>
                  <span className="font-display font-black text-[10px] text-purple-950 uppercase tracking-widest mt-0.5">TAILS</span>
                </div>
              </div>
            </div>

            {/* Outcome Badge / Announcement */}
            <div>
              {isFlipping ? (
                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300 text-xs font-mono-numbers font-bold animate-pulse">
                  <RefreshCw className="w-3 h-3 animate-spin" />
                  Coin in Flight...
                </span>
              ) : lastResult === 'won' ? (
                <div className="space-y-0.5 animate-in zoom-in-75">
                  <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/50 text-emerald-300 text-xs font-mono-numbers font-black">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    {landedSide.toUpperCase()}! Won +{potentialPayout.toLocaleString()} FC
                  </span>
                </div>
              ) : lastResult === 'lost' ? (
                <div className="space-y-0.5 animate-in zoom-in-75">
                  <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-rose-500/20 border border-rose-500/50 text-rose-300 text-xs font-mono-numbers font-black">
                    <XCircle className="w-3.5 h-3.5 text-rose-400" />
                    Landed on {landedSide.toUpperCase()}
                  </span>
                </div>
              ) : (
                <span className="text-[11px] text-[#94A3B8]">
                  Choose Heads or Tails and click Flip
                </span>
              )}
            </div>
          </div>

          {/* Stage Footer: Provably Fair Note */}
          <div className="w-full flex items-center justify-between pt-2 border-t border-[#1F2737] text-[10px] text-[#94A3B8] shrink-0">
            <span className="flex items-center gap-1">
              <ShieldCheck className="w-3 h-3 text-emerald-400" />
              <span>Provably Fair Binary Flip</span>
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

