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
  XCircle,
  Crown
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { soundFX } from '../engine/SoundFXService';

export interface CoinflipGameProps {
  room?: any;
  activityBox?: React.ReactNode;
}

/**
 * Coin Flip Game - Provably Fair Web3 Casino
 * Designed strictly in Google Stitch (Obsidian Sovereign Design System: #0B0F19, #111728, #7C3AED, #F59E0B, #10B981)
 */
export default function CoinflipGame({ room, activityBox }: CoinflipGameProps) {
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

  // Player choice: 'heads' | 'tails'
  const [selectedSide, setSelectedSide] = useState<'heads' | 'tails'>('heads');
  const [isFlipping, setIsFlipping] = useState(false);
  const [coinRotation, setCoinRotation] = useState(0);
  const [lastResult, setLastResult] = useState<'won' | 'lost' | null>(null);
  const [landedSide, setLandedSide] = useState<'heads' | 'tails'>('heads');
  
  // History strip
  const [recentFlips, setRecentFlips] = useState([
    { side: 'heads' as const, won: true, multiplier: 1.98 },
    { side: 'tails' as const, won: false, multiplier: 0 },
    { side: 'tails' as const, won: true, multiplier: 1.98 },
    { side: 'heads' as const, won: true, multiplier: 1.98 },
    { side: 'tails' as const, won: false, multiplier: 0 },
    { side: 'heads' as const, won: true, multiplier: 1.98 }
  ]);

  const multiplier = 1.98; // 1% house edge
  const potentialPayout = parseFloat((betAmount * multiplier).toFixed(2));
  const netProfit = parseFloat((potentialPayout - betAmount).toFixed(2));

  // Quick preset helper
  const handleQuickAdd = (addVal: number) => {
    const maxVal = room?.maxStakeFC || 2000;
    setBetAmount(Math.min(maxVal, betAmount + addVal));
  };

  // Flip Action
  const handleFlip = async () => {
    if (isFlipping || loading) return;

    // 1. Debit stake and record round in engine
    const startRes = await startRound();
    if (!startRes.success) return;

    soundFX.playChipBet();
    soundFX.playCoinflipToss();

    setIsFlipping(true);
    setLastResult(null);

    // 2. Pre-derive coinflip outcome authoritatively via HMAC-SHA256
    const outcomeSide = await generateCoinflip(
      seeds.serverHash || 'seed_coinflip_default',
      seeds.clientSeed,
      seeds.nonce
    );

    // 3. Smooth 3D animation (5 full turns + final face)
    const extraTurns = 1800; // 5 full 360 spins
    const finalAngle = outcomeSide === 'heads' ? 0 : 180;
    const targetRotation = coinRotation + extraTurns + finalAngle;
    setCoinRotation(targetRotation);

    setTimeout(() => {
      finalizeFlip(outcomeSide as 'heads' | 'tails');
    }, 1200);
  };

  const finalizeFlip = async (outcomeSide: 'heads' | 'tails') => {
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
          particleCount: 85,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#F59E0B', '#10B981', '#7C3AED', '#ffffff']
        });
      } catch (_) {}
    }

    // Settle round authoritatively
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
      ...prev.slice(0, 11)
    ]);
  };

  return (
    <div className="w-full flex-1 flex flex-col min-h-0 text-left space-y-2 select-none">
      
      {/* 1. TOP METADATA & RECENT FLIPS STRIP */}
      <div className="p-2 sm:px-3 rounded-xl bg-[#090D16] border border-[#1F2737] flex items-center justify-between gap-2 shrink-0">
        
        {/* Left: Room Status & Nonce */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="relative flex items-center justify-center">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping absolute" />
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
          </div>
          <span className="font-extrabold text-white text-xs sm:text-sm tracking-wide">
            Coin Flip Arena
          </span>
          <span className="text-[10px] font-mono-numbers px-2 py-0.5 rounded bg-violet-500/15 text-violet-300 border border-violet-500/30 font-bold uppercase">
            ROUND #{seeds.nonce}
          </span>
        </div>

        {/* Right: Recent Flips Strip */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5 max-w-[60%] sm:max-w-[70%]">
          <span className="text-[10px] font-mono-numbers uppercase text-[#94A3B8] font-bold shrink-0 hidden md:inline">
            History:
          </span>
          {recentFlips.map((f, idx) => (
            <span
              key={idx}
              className={`px-2 py-0.5 rounded-lg text-[10px] font-mono-numbers font-black shrink-0 border flex items-center gap-1 ${
                f.won
                  ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                  : 'bg-rose-500/10 text-rose-400 border-rose-500/25'
              }`}
            >
              <span>{f.side === 'heads' ? '👑' : '🦅'}</span>
              <span className="capitalize">{f.side}</span>
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
                  disabled={isFlipping}
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
                disabled={isFlipping}
                className="py-1.5 rounded-lg bg-[#0B0F19] hover:bg-[#151C2B] text-[#94A3B8] hover:text-white border border-[#1F2737] transition-colors cursor-pointer disabled:opacity-40 text-[11px]"
              >
                ½
              </button>
              <button
                type="button"
                onClick={doubleBet}
                disabled={isFlipping}
                className="py-1.5 rounded-lg bg-[#0B0F19] hover:bg-[#151C2B] text-[#94A3B8] hover:text-white border border-[#1F2737] transition-colors cursor-pointer disabled:opacity-40 text-[11px]"
              >
                2×
              </button>
              <button
                type="button"
                onClick={setMinBet}
                disabled={isFlipping}
                className="py-1.5 rounded-lg bg-[#0B0F19] hover:bg-[#151C2B] text-[#94A3B8] hover:text-white border border-[#1F2737] transition-colors cursor-pointer disabled:opacity-40 text-[11px]"
              >
                Min
              </button>
              <button
                type="button"
                onClick={setMaxBet}
                disabled={isFlipping}
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
                  disabled={isFlipping}
                  className="py-1 rounded bg-[#0B0F19]/80 hover:bg-[#151C2B] text-violet-300 border border-violet-500/20 transition-colors cursor-pointer disabled:opacity-40"
                >
                  +{val}
                </button>
              ))}
            </div>

            {/* Interactive Side Selection Cards */}
            <div className="space-y-1.5 pt-1 border-t border-[#1F2737]">
              <span className="text-[11px] font-bold text-[#94A3B8] block font-mono-numbers">
                Choose Side:
              </span>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedSide('heads')}
                  disabled={isFlipping}
                  className={`p-3 rounded-xl border flex flex-col items-center justify-center gap-1 transition-all cursor-pointer disabled:opacity-50 ${
                    selectedSide === 'heads'
                      ? 'bg-amber-500/20 border-amber-400 text-white ring-2 ring-amber-400/50 shadow-[0_0_20px_rgba(245,158,11,0.25)] scale-102'
                      : 'bg-[#0B0F19] hover:bg-[#151C2B] border-[#1F2737] text-[#94A3B8]'
                  }`}
                >
                  <span className="text-2xl drop-shadow-sm">👑</span>
                  <span className="font-extrabold text-xs uppercase tracking-wider text-amber-300">Heads</span>
                  <span className="text-[10px] font-mono-numbers text-[#94A3B8]">49.5% · 1.98x</span>
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedSide('tails')}
                  disabled={isFlipping}
                  className={`p-3 rounded-xl border flex flex-col items-center justify-center gap-1 transition-all cursor-pointer disabled:opacity-50 ${
                    selectedSide === 'tails'
                      ? 'bg-violet-600/20 border-violet-400 text-white ring-2 ring-violet-400/50 shadow-[0_0_20px_rgba(124,58,237,0.25)] scale-102'
                      : 'bg-[#0B0F19] hover:bg-[#151C2B] border-[#1F2737] text-[#94A3B8]'
                  }`}
                >
                  <span className="text-2xl drop-shadow-sm">🦅</span>
                  <span className="font-extrabold text-xs uppercase tracking-wider text-violet-300">Tails</span>
                  <span className="text-[10px] font-mono-numbers text-[#94A3B8]">49.5% · 1.98x</span>
                </button>
              </div>
            </div>

            {/* Payout & Odds Dashboard */}
            <div className="grid grid-cols-2 gap-2 text-xs font-mono-numbers pt-1 border-t border-[#1F2737]">
              <div className="bg-[#0B0F19] p-2 rounded-xl border border-[#1F2737]">
                <span className="text-[10px] text-[#94A3B8] block">Multiplier</span>
                <span className="font-black text-sm text-amber-300">1.98x</span>
              </div>

              <div className="bg-[#0B0F19] p-2 rounded-xl border border-[#1F2737]">
                <span className="text-[10px] text-[#94A3B8] block">Win Chance</span>
                <span className="font-black text-sm text-emerald-400">49.50%</span>
              </div>
            </div>

            {/* Potential Return */}
            <div className="bg-[#0B0F19] p-2 rounded-xl border border-[#1F2737] text-xs font-mono-numbers flex items-center justify-between">
              <span className="text-[#94A3B8]">Est. Win Return:</span>
              <span className="font-black text-emerald-300 text-sm">
                +{potentialPayout} USDT
              </span>
            </div>

          </div>

          {/* Action Button: Flip Coin */}
          <div className="pt-2">
            <button
              type="button"
              onClick={handleFlip}
              disabled={isFlipping || loading}
              className="w-full py-3.5 rounded-xl btn-gold text-black font-black text-sm flex items-center justify-center gap-2 cursor-pointer transition-all shadow-lg active:scale-98 disabled:opacity-50"
            >
              {isFlipping ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Coin In Flight...</span>
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 fill-current" />
                  <span>Flip Coin • {betAmount} USDT</span>
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

        </div>

        {/* 3D COIN ARENA STAGE (Desktop: 8 cols / Mobile Landscape: 7 cols / Mobile Portrait: top) */}
        <div className={`bg-[#0B0F19] border border-[#1B2238] rounded-2xl p-4 sm:p-6 flex flex-col justify-between items-center text-center relative overflow-hidden h-full min-h-[240px] lg:min-h-0 shadow-2xl ${
          isMobileLandscape ? 'col-span-7 order-2' : 'order-1 lg:order-2 lg:col-span-8'
        }`}>
          
          {/* Ambient Cosmic Halos */}
          <div className="absolute top-0 right-0 w-80 h-80 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-80 h-80 bg-violet-600/10 rounded-full blur-3xl pointer-events-none" />

          {/* Stage Header */}
          <div className="w-full flex items-center justify-between text-xs text-[#94A3B8] font-mono-numbers pb-2 border-b border-[#1F2737] shrink-0 z-10">
            <div className="flex items-center gap-2">
              <Coins className="w-4 h-4 text-amber-400" />
              <span>Selected: <strong className="text-white uppercase font-extrabold">{selectedSide}</strong></span>
            </div>
            <span>
              Net Profit: <strong className="text-emerald-400 font-bold">+{netProfit} USDT</strong>
            </span>
          </div>

          {/* 3D Animated Metallic Coin Stage */}
          <div className="my-auto py-3 sm:py-6 space-y-4 z-10">
            <div className="relative w-36 h-36 sm:w-44 sm:h-44 mx-auto [perspective:1000px]">
              <div 
                className="w-full h-full relative [transform-style:preserve-3d] transition-transform duration-[1200ms] ease-out"
                style={{ transform: `rotateY(${coinRotation}deg)` }}
              >
                {/* Heads Face (Front) */}
                <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-amber-600 via-[#F59E0B] to-amber-300 border-4 border-amber-300 flex flex-col items-center justify-center shadow-[0_0_45px_rgba(245,158,11,0.45)] [backface-visibility:hidden]">
                  <span className="text-5xl sm:text-6xl drop-shadow-lg">👑</span>
                  <span className="font-display font-black text-xs text-amber-950 uppercase tracking-widest mt-1">HEADS</span>
                </div>

                {/* Tails Face (Back) */}
                <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-violet-800 via-purple-600 to-indigo-500 border-4 border-violet-300 flex flex-col items-center justify-center shadow-[0_0_45px_rgba(124,58,237,0.45)] [backface-visibility:hidden] [transform:rotateY(180deg)]">
                  <span className="text-5xl sm:text-6xl drop-shadow-lg">🦅</span>
                  <span className="font-display font-black text-xs text-purple-950 uppercase tracking-widest mt-1">TAILS</span>
                </div>
              </div>
            </div>

            {/* Outcome Announcement */}
            <div>
              {isFlipping ? (
                <span className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300 text-xs font-mono-numbers font-black animate-pulse shadow-md">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  Coin in Flight...
                </span>
              ) : lastResult === 'won' ? (
                <div className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-emerald-500/20 border border-emerald-500/50 text-emerald-300 text-xs font-mono-numbers font-black animate-in zoom-in-95 shadow-lg">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  {landedSide.toUpperCase()}! Won +{potentialPayout} USDT (1.98x)
                </div>
              ) : lastResult === 'lost' ? (
                <div className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-rose-500/20 border border-rose-500/50 text-rose-300 text-xs font-mono-numbers font-black animate-in zoom-in-95 shadow-lg">
                  <XCircle className="w-4 h-4 text-rose-400" />
                  Landed on {landedSide.toUpperCase()} · Try again!
                </div>
              ) : (
                <span className="text-xs text-[#94A3B8]">
                  Select Heads or Tails and tap Flip Coin
                </span>
              )}
            </div>
          </div>

          {/* Stage Footer: Provably Fair Telemetry Strip */}
          <div className="w-full flex items-center justify-between pt-2 border-t border-[#1F2737] text-[10px] text-[#94A3B8] shrink-0 z-10">
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>Provably Fair Binary Randomness</span>
            </span>
            <span className="text-amber-400/80 font-mono-numbers font-bold">
              House Edge: 1.0% · Payout: 1.98x
            </span>
          </div>

        </div>

      </div>

    </div>
  );
}
