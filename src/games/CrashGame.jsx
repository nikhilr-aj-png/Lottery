import React, { useState, useEffect, useRef } from 'react';
import { useGameEngine } from '../hooks/useGameEngine';
import { generateCrashPoint } from '../engine';
import { 
  Rocket, 
  Flame, 
  Coins, 
  RefreshCw, 
  TrendingUp, 
  Zap, 
  ShieldCheck, 
  Trophy,
  History
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { soundFX } from '../engine/SoundFXService';

export default function CrashGame({ room }) {
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
  } = useGameEngine('crash');

  // Enforce room-specific stake bounds
  useEffect(() => {
    if (room?.minStakeFC && betAmount < room.minStakeFC) {
      setBetAmount(room.minStakeFC);
    } else if (room?.maxStakeFC && betAmount > room.maxStakeFC) {
      setBetAmount(room.maxStakeFC);
    }
  }, [room?.minStakeFC, room?.maxStakeFC]);

  // Crash round states: 'idle' | 'countdown' | 'flying' | 'crashed'
  const [gameState, setGameState] = useState('idle');
  const [currentMultiplier, setCurrentMultiplier] = useState(1.00);
  const [crashPoint, setCrashPoint] = useState(null);
  const [autoCashout, setAutoCashout] = useState('2.00');
  const [isAutoCashoutEnabled, setIsAutoCashoutEnabled] = useState(false);
  const [cashedOutAt, setCashedOutAt] = useState(null);
  const [recentCrashes, setRecentCrashes] = useState([
    { point: 1.45, isWin: false },
    { point: 2.80, isWin: true },
    { point: 1.12, isWin: false },
    { point: 5.40, isWin: true },
    { point: 18.25, isWin: true },
    { point: 1.02, isWin: false },
    { point: 3.15, isWin: true }
  ]);

  const canvasRef = useRef(null);
  const animationFrameRef = useRef(null);
  const startTimeRef = useRef(null);

  // Clean animation frame on unmount
  useEffect(() => {
    return () => {
      soundFX.stopCrashHum();
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  // Launch New Crash Flight
  const handleLaunch = async () => {
    if (gameState === 'flying' || gameState === 'countdown') return;

    // 1. Start round in game engine
    const startRes = await startRound();
    if (!startRes.success) return;

    soundFX.playChipBet();

    // 2. Pre-derive crash point using Provably Fair algorithm
    const derivedPoint = await generateCrashPoint(
      seeds.serverHash || 'seed_crash_default',
      seeds.clientSeed,
      seeds.nonce
    );

    setCrashPoint(derivedPoint);
    setCurrentMultiplier(1.00);
    setCashedOutAt(null);
    setGameState('countdown');

    // 1.5s countdown before launch
    setTimeout(() => {
      setGameState('flying');
      startTimeRef.current = Date.now();
      startFlightAnimation(derivedPoint);
    }, 1200);
  };

  // Flying Animation Loop
  const startFlightAnimation = (targetCrash) => {
    const durationExponent = 0.00006; // Growth rate

    const tick = () => {
      if (!startTimeRef.current) return;
      const elapsed = Date.now() - startTimeRef.current;
      
      // Exponential growth curve: 1.00 + (elapsed * rate)^2
      const calculatedMult = parseFloat((1.00 + Math.pow(elapsed / 1000, 1.8) * 0.15).toFixed(2));

      // Auto-cashout check
      const autoTarget = parseFloat(autoCashout);
      if (
        isAutoCashoutEnabled && 
        autoTarget && 
        calculatedMult >= autoTarget && 
        !cashedOutAt && 
        targetCrash >= autoTarget
      ) {
        handleCashout(autoTarget);
      }

      // Check if crash point reached
      if (calculatedMult >= targetCrash) {
        setCurrentMultiplier(targetCrash);
        handleCrash(targetCrash);
        return;
      }

      soundFX.playCrashHum(calculatedMult);
      setCurrentMultiplier(calculatedMult);
      drawCanvas(calculatedMult, false);
      animationFrameRef.current = requestAnimationFrame(tick);
    };

    animationFrameRef.current = requestAnimationFrame(tick);
  };

  // Cashout during flight
  const handleCashout = async (forcedMult = null) => {
    if (gameState !== 'flying' || cashedOutAt) return;

    soundFX.stopCrashHum();
    soundFX.playCrashCashout();
    soundFX.playWinFanfare('standard');

    const mult = forcedMult || currentMultiplier;
    setCashedOutAt(mult);

    const winAmount = parseFloat((betAmount * mult).toFixed(2));
    confetti({
      particleCount: 80,
      spread: 60,
      origin: { y: 0.6 },
      colors: ['#ffd700', '#22c55e', '#8b5cf6', '#ffffff']
    });

    await settleRound({
      multiplier: mult,
      payout: winAmount,
      outcomeData: { crashPoint, cashedOutAt: mult, roomId: room?.id },
      metadata: { roomId: room?.id, roomName: room?.name }
    });
  };

  // Crash Occurred
  const handleCrash = async (finalPoint) => {
    soundFX.playCrashExplosion();
    setGameState('crashed');
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    drawCanvas(finalPoint, true);

    // If player didn't cash out in time, settle as lost
    if (!cashedOutAt) {
      await settleRound({
        multiplier: 0,
        payout: 0,
        outcomeData: { crashPoint: finalPoint, cashedOutAt: null, roomId: room?.id },
        metadata: { roomId: room?.id, roomName: room?.name }
      });
    }

    // Add to history
    setRecentCrashes(prev => [
      { point: finalPoint, isWin: !!cashedOutAt },
      ...prev.slice(0, 9)
    ]);
  };

  // Canvas Renderer (Draws curve, grid, rocket, explosion)
  const drawCanvas = (mult, isCrashed) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;

    ctx.clearRect(0, 0, width, height);

    // 1. Draw Grid Lines
    ctx.strokeStyle = '#1F2737';
    ctx.lineWidth = 1;
    for (let x = 50; x < width; x += 70) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height - 30);
      ctx.stroke();
    }
    for (let y = 30; y < height - 30; y += 50) {
      ctx.beginPath();
      ctx.moveTo(40, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    // 2. Axes
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(40, 10);
    ctx.lineTo(40, height - 30);
    ctx.lineTo(width - 10, height - 30);
    ctx.stroke();

    // 3. Curve Path
    const originX = 40;
    const originY = height - 30;
    const progress = Math.min(1.0, (mult - 1.0) / 10.0);
    const endX = originX + (width - 70) * Math.min(1.0, progress * 1.2);
    const endY = originY - (height - 60) * Math.min(0.95, Math.pow(progress, 0.7));

    ctx.beginPath();
    ctx.moveTo(originX, originY);
    ctx.quadraticCurveTo(
      originX + (endX - originX) * 0.6,
      originY,
      endX,
      endY
    );

    // Gradient fill under curve
    const gradient = ctx.createLinearGradient(0, endY, 0, originY);
    if (isCrashed) {
      gradient.addColorStop(0, 'rgba(239, 68, 68, 0.35)');
      gradient.addColorStop(1, 'rgba(239, 68, 68, 0.0)');
      ctx.strokeStyle = '#EF4444';
    } else {
      gradient.addColorStop(0, 'rgba(245, 196, 81, 0.4)');
      gradient.addColorStop(1, 'rgba(245, 196, 81, 0.0)');
      ctx.strokeStyle = '#F5C451';
    }

    ctx.lineWidth = 4;
    ctx.stroke();

    // Fill area
    ctx.lineTo(endX, originY);
    ctx.closePath();
    ctx.fillStyle = gradient;
    ctx.fill();

    // 4. Draw Rocket or Explosion at endX, endY
    if (isCrashed) {
      // Explosion Shockwave
      ctx.fillStyle = '#EF4444';
      ctx.beginPath();
      ctx.arc(endX, endY, 14, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#F87171';
      ctx.beginPath();
      ctx.arc(endX, endY, 8, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // Glowing Rocket Tip
      ctx.fillStyle = '#F5C451';
      ctx.shadowColor = '#F5C451';
      ctx.shadowBlur = 15;
      ctx.beginPath();
      ctx.arc(endX, endY, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0; // reset
    }
  };

  return (
    <div className="w-full space-y-4 text-left">
      
      {/* 1. RECENT CRASH ROUNDS BAR */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
        <span className="text-[10px] font-mono-numbers uppercase tracking-wider text-[#94A3B8] flex items-center gap-1 shrink-0">
          <History className="w-3 h-3 text-amber-400" />
          <span>History:</span>
        </span>
        {recentCrashes.map((r, idx) => (
          <span
            key={idx}
            className={`px-2 py-0.5 rounded-lg text-xs font-mono-numbers font-black shrink-0 border ${
              r.point >= 2.0
                ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                : 'bg-red-500/10 text-red-400 border-red-500/20'
            }`}
          >
            {r.point.toFixed(2)}x
          </span>
        ))}
      </div>

      {/* 2. MAIN STAGE & CONTROLS GRID */}
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
                  max="1000"
                  value={betAmount}
                  onChange={(e) => setBetAmount(Math.max(1, parseFloat(e.target.value) || 0))}
                  disabled={gameState === 'flying' || gameState === 'countdown'}
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
                disabled={gameState === 'flying' || gameState === 'countdown'}
                className="py-1.5 rounded-lg bg-[#0B0F19] hover:bg-[#151C2B] text-[#94A3B8] hover:text-white border border-[#1F2737] transition-colors cursor-pointer disabled:opacity-50"
              >
                ½
              </button>
              <button
                type="button"
                onClick={doubleBet}
                disabled={gameState === 'flying' || gameState === 'countdown'}
                className="py-1.5 rounded-lg bg-[#0B0F19] hover:bg-[#151C2B] text-[#94A3B8] hover:text-white border border-[#1F2737] transition-colors cursor-pointer disabled:opacity-50"
              >
                2x
              </button>
              <button
                type="button"
                onClick={setMinBet}
                disabled={gameState === 'flying' || gameState === 'countdown'}
                className="py-1.5 rounded-lg bg-[#0B0F19] hover:bg-[#151C2B] text-[#94A3B8] hover:text-white border border-[#1F2737] transition-colors cursor-pointer disabled:opacity-50"
              >
                Min
              </button>
              <button
                type="button"
                onClick={setMaxBet}
                disabled={gameState === 'flying' || gameState === 'countdown'}
                className="py-1.5 rounded-lg bg-[#0B0F19] hover:bg-[#151C2B] text-amber-400 border border-[#1F2737] transition-colors cursor-pointer disabled:opacity-50"
              >
                Max
              </button>
            </div>

            {/* Auto-Cashout Config */}
            <div className="pt-2 border-t border-[#1F2737] space-y-2">
              <div className="flex items-center justify-between text-xs font-mono-numbers">
                <label className="flex items-center gap-2 cursor-pointer text-[#94A3B8] font-bold">
                  <input
                    type="checkbox"
                    checked={isAutoCashoutEnabled}
                    onChange={(e) => setIsAutoCashoutEnabled(e.target.checked)}
                    className="accent-amber-500 rounded cursor-pointer"
                  />
                  <span>Auto Cashout Target</span>
                </label>
              </div>

              {isAutoCashoutEnabled && (
                <div className="flex items-center bg-[#0B0F19] border border-[#1F2737] rounded-xl p-1.5">
                  <input
                    type="number"
                    step="0.1"
                    min="1.01"
                    max="1000"
                    value={autoCashout}
                    onChange={(e) => setAutoCashout(e.target.value)}
                    disabled={gameState === 'flying'}
                    className="flex-1 bg-transparent px-2.5 text-white font-mono-numbers font-black text-sm outline-none"
                    placeholder="2.00"
                  />
                  <span className="text-amber-400 font-bold text-xs px-2 font-mono-numbers">x</span>
                </div>
              )}
            </div>
          </div>

          {/* Action Button: Launch vs Cashout */}
          <div className="pt-4">
            {gameState === 'flying' ? (
              <button
                type="button"
                onClick={() => handleCashout()}
                disabled={!!cashedOutAt}
                className={`w-full py-4 rounded-2xl font-black text-base flex items-center justify-center gap-2 cursor-pointer transition-all shadow-xl ${
                  cashedOutAt
                    ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-500/40 cursor-default'
                    : 'bg-gradient-to-r from-emerald-500 to-[#05D5AA] hover:from-emerald-400 hover:to-[#05D5AA] text-black shadow-emerald-500/30 animate-pulse'
                }`}
              >
                <Coins className="w-5 h-5 fill-current" />
                <span>
                  {cashedOutAt
                    ? `Cashed Out @ ${cashedOutAt.toFixed(2)}x (+${(betAmount * cashedOutAt).toFixed(2)} FC)`
                    : `Cashout ${(betAmount * currentMultiplier).toFixed(2)} FC (${currentMultiplier.toFixed(2)}x)`
                  }
                </span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleLaunch}
                disabled={loading || gameState === 'countdown'}
                className="w-full py-4 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black font-black text-base flex items-center justify-center gap-2 cursor-pointer transition-all shadow-xl shadow-amber-500/20 disabled:opacity-50"
              >
                {gameState === 'countdown' ? (
                  <span className="animate-pulse">Launching in 1s...</span>
                ) : (
                  <>
                    <Rocket className="w-5 h-5 fill-current" />
                    <span>Launch Rocket ({betAmount} FC)</span>
                  </>
                )}
              </button>
            )}
          </div>

        </div>

        {/* Canvas Stage (Right) */}
        <div className="lg:col-span-8 bg-[#07090E] border border-[#1F2737] rounded-2xl p-4 sm:p-6 flex flex-col justify-between items-center relative min-h-[380px] overflow-hidden">
          
          {/* Multiplier Central Overlay */}
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-10">
            {gameState === 'crashed' ? (
              <div className="text-center space-y-1 animate-in zoom-in-90 duration-150">
                <span className="font-display font-black text-4xl sm:text-6xl text-red-500 tracking-tight drop-shadow-[0_0_25px_rgba(239,68,68,0.5)] font-mono-numbers">
                  {currentMultiplier.toFixed(2)}x
                </span>
                <span className="block text-xs font-mono-numbers uppercase tracking-widest text-red-400 font-extrabold bg-red-950/60 border border-red-500/40 px-3 py-1 rounded-full">
                  Crashed!
                </span>
              </div>
            ) : gameState === 'flying' ? (
              <div className="text-center space-y-1">
                <span className="font-display font-black text-5xl sm:text-7xl text-white tracking-tight drop-shadow-[0_0_30px_rgba(245,196,81,0.35)] font-mono-numbers">
                  {currentMultiplier.toFixed(2)}x
                </span>
                {cashedOutAt && (
                  <span className="block text-xs font-mono-numbers uppercase tracking-widest text-emerald-300 font-extrabold bg-emerald-950/60 border border-emerald-500/40 px-3 py-1 rounded-full animate-in fade-in">
                    Locked @ {cashedOutAt.toFixed(2)}x
                  </span>
                )}
              </div>
            ) : gameState === 'countdown' ? (
              <div className="text-center space-y-2">
                <Rocket className="w-12 h-12 text-amber-400 animate-bounce mx-auto" />
                <span className="font-display font-extrabold text-lg text-white">Preparing Launch...</span>
              </div>
            ) : (
              <div className="text-center space-y-2">
                <Rocket className="w-12 h-12 text-amber-400/50 mx-auto" />
                <span className="font-display font-black text-lg sm:text-xl text-white">Ready to Launch</span>
                <p className="text-xs text-[#94A3B8]">Set stake and press Launch to start flight.</p>
              </div>
            )}
          </div>

          {/* Canvas */}
          <canvas
            ref={canvasRef}
            width={600}
            height={340}
            className="w-full h-full max-h-[340px] block"
          />

          {/* Footer note */}
          <div className="w-full flex items-center justify-between pt-2 border-t border-[#1F2737] text-[10px] text-[#94A3B8] font-mono-numbers">
            <span>Provably Fair 1% House Edge</span>
            <span>Multiplier Cap: 1,000x</span>
          </div>

        </div>

      </div>

    </div>
  );
}

