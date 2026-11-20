import React, { useState, useEffect, useRef, useCallback } from 'react';
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
  History,
  Activity,
  CheckCircle2,
  XCircle,
  Clock,
  Sparkles,
  Layers
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { soundFX } from '../engine/SoundFXService';

export interface CrashGameProps {
  room?: any;
  activityBox?: React.ReactNode;
}

/**
 * Crash Game - Provably Fair Rocket Multiplier
 * Designed strictly in Google Stitch (Obsidian Sovereign Design System: #0B0F19, #111728, #7C3AED, #F59E0B, #10B981)
 */
export default function CrashGame({ room, activityBox }: CrashGameProps) {
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

  // Crash round states: 'idle' | 'countdown' | 'flying' | 'crashed'
  const [gameState, setGameState] = useState<'idle' | 'countdown' | 'flying' | 'crashed'>('idle');
  const [currentMultiplier, setCurrentMultiplier] = useState(1.00);
  const [crashPoint, setCrashPoint] = useState<number | null>(null);
  const [autoCashout, setAutoCashout] = useState('2.00');
  const [isAutoCashoutEnabled, setIsAutoCashoutEnabled] = useState(false);
  const [cashedOutAt, setCashedOutAt] = useState<number | null>(null);
  const [countdownSeconds, setCountdownSeconds] = useState(1.2);

  const [recentCrashes, setRecentCrashes] = useState([
    { point: 1.45, isWin: false },
    { point: 2.80, isWin: true },
    { point: 1.12, isWin: false },
    { point: 5.40, isWin: true },
    { point: 18.25, isWin: true },
    { point: 1.02, isWin: false },
    { point: 3.15, isWin: true },
    { point: 7.60, isWin: true }
  ]);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const startTimeRef = useRef<number | null>(null);

  // Clean animation frame & sound on unmount
  useEffect(() => {
    return () => {
      soundFX.stopCrashHum();
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  // Quick preset helper
  const handleQuickAdd = (addVal: number) => {
    const maxVal = room?.maxStakeFC || 2000;
    setBetAmount(Math.min(maxVal, betAmount + addVal));
  };

  // Launch New Crash Flight
  const handleLaunch = async () => {
    if (gameState === 'flying' || gameState === 'countdown' || loading) return;

    // 1. Debit stake and record round in engine
    const startRes = await startRound();
    if (!startRes.success) return;

    soundFX.playChipBet();

    // 2. Derive crash point using Provably Fair HMAC-SHA256
    const derivedPoint = await generateCrashPoint(
      seeds.serverHash || 'seed_crash_default',
      seeds.clientSeed,
      seeds.nonce
    );

    setCrashPoint(derivedPoint);
    setCurrentMultiplier(1.00);
    setCashedOutAt(null);
    setGameState('countdown');
    setCountdownSeconds(1.2);

    // 1.2s countdown ticker before flight
    const countdownInterval = setInterval(() => {
      setCountdownSeconds(prev => {
        if (prev <= 0.2) {
          clearInterval(countdownInterval);
          return 0;
        }
        return parseFloat((prev - 0.2).toFixed(1));
      });
    }, 200);

    setTimeout(() => {
      clearInterval(countdownInterval);
      setGameState('flying');
      startTimeRef.current = Date.now();
      startFlightAnimation(derivedPoint);
    }, 1200);
  };

  // Flying Animation Loop
  const startFlightAnimation = (targetCrash: number) => {
    const tick = () => {
      if (!startTimeRef.current) return;
      const elapsed = Date.now() - startTimeRef.current;
      
      // Exponential curve formula: 1.00 + (elapsed/1000)^1.8 * 0.16
      const calculatedMult = parseFloat((1.00 + Math.pow(elapsed / 1000, 1.8) * 0.16).toFixed(2));

      // Auto-cashout trigger
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

      // Check if crash threshold reached
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
  const handleCashout = async (forcedMult: number | null = null) => {
    if (gameState !== 'flying' || cashedOutAt) return;

    soundFX.stopCrashHum();
    soundFX.playCrashCashout();
    soundFX.playWinFanfare('standard');

    const mult = forcedMult || currentMultiplier;
    setCashedOutAt(mult);

    const winAmount = parseFloat((betAmount * mult).toFixed(2));
    try {
      confetti({
        particleCount: 90,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#F59E0B', '#10B981', '#7C3AED', '#ffffff']
      });
    } catch (_) {}

    await settleRound({
      multiplier: mult,
      payout: winAmount,
      outcomeData: { crashPoint, cashedOutAt: mult, roomId: room?.id },
      metadata: { roomId: room?.id, roomName: room?.name }
    });
  };

  // Crash Occurred
  const handleCrash = async (finalPoint: number) => {
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

    // Append to local history ribbon
    setRecentCrashes(prev => [
      { point: finalPoint, isWin: !!cashedOutAt },
      ...prev.slice(0, 11)
    ]);

    // Reset to idle after 2.5 seconds
    setTimeout(() => {
      setGameState('idle');
      drawCanvas(1.00, false);
    }, 2500);
  };

  // High-Performance HTML5 Canvas Trajectory Renderer
  const drawCanvas = useCallback((mult: number, isCrashed: boolean) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Handle high DPI displays
    const dpr = window.devicePixelRatio || 1;
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    
    if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
      canvas.width = width * dpr;
      canvas.height = height * dpr;
    }
    
    ctx.resetTransform();
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, width, height);

    // 1. Draw Starfield & Grid
    ctx.strokeStyle = 'rgba(31, 39, 55, 0.45)';
    ctx.lineWidth = 1;
    const gridStepX = Math.max(50, Math.floor(width / 8));
    const gridStepY = Math.max(40, Math.floor(height / 6));

    for (let x = gridStepX; x < width; x += gridStepX) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height - 28);
      ctx.stroke();
    }
    for (let y = gridStepY; y < height - 28; y += gridStepY) {
      ctx.beginPath();
      ctx.moveTo(35, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    // 2. Base Axis lines
    ctx.strokeStyle = '#27334D';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(35, 10);
    ctx.lineTo(35, height - 28);
    ctx.lineTo(width - 10, height - 28);
    ctx.stroke();

    // Axis tick labels
    ctx.fillStyle = '#64748B';
    ctx.font = '10px "Space Mono", monospace';
    ctx.fillText('1.0x', 8, height - 26);
    ctx.fillText('0s', 36, height - 12);

    // 3. Upward Trajectory Curve
    const originX = 35;
    const originY = height - 28;
    const progress = Math.min(1.0, (mult - 1.0) / 10.0);
    const endX = originX + (width - 60) * Math.min(1.0, progress * 1.15 + 0.05);
    const endY = originY - (height - 55) * Math.min(0.96, Math.pow(progress, 0.65) + 0.05);

    // Quadratic bezier curve from origin to rocket position
    ctx.beginPath();
    ctx.moveTo(originX, originY);
    const controlX = originX + (endX - originX) * 0.55;
    const controlY = originY;
    ctx.quadraticCurveTo(controlX, controlY, endX, endY);

    // Gradient stroke for trajectory path
    const strokeGrad = ctx.createLinearGradient(originX, originY, endX, endY);
    if (isCrashed) {
      strokeGrad.addColorStop(0, '#EF4444');
      strokeGrad.addColorStop(1, '#F87171');
      ctx.strokeStyle = strokeGrad;
    } else {
      strokeGrad.addColorStop(0, '#7C3AED');
      strokeGrad.addColorStop(0.5, '#F59E0B');
      strokeGrad.addColorStop(1, '#FDE047');
      ctx.strokeStyle = strokeGrad;
    }
    ctx.lineWidth = 3.5;
    ctx.stroke();

    // Area fill under trajectory
    const fillGrad = ctx.createLinearGradient(0, endY, 0, originY);
    if (isCrashed) {
      fillGrad.addColorStop(0, 'rgba(239, 68, 68, 0.35)');
      fillGrad.addColorStop(1, 'rgba(239, 68, 68, 0.0)');
    } else {
      fillGrad.addColorStop(0, 'rgba(245, 158, 11, 0.30)');
      fillGrad.addColorStop(0.5, 'rgba(124, 58, 237, 0.15)');
      fillGrad.addColorStop(1, 'rgba(11, 15, 25, 0.0)');
    }
    ctx.lineTo(endX, originY);
    ctx.closePath();
    ctx.fillStyle = fillGrad;
    ctx.fill();

    // 4. Draw Leading Rocket Sprite / Explosion
    if (isCrashed) {
      // Explosion Shockwave Rings
      ctx.fillStyle = 'rgba(239, 68, 68, 0.4)';
      ctx.beginPath();
      ctx.arc(endX, endY, 18, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#EF4444';
      ctx.beginPath();
      ctx.arc(endX, endY, 8, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(endX, endY, 3, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // Rocket Flame Exhaust Trail
      ctx.fillStyle = 'rgba(245, 158, 11, 0.4)';
      ctx.beginPath();
      ctx.arc(endX - 8, endY + 4, 6, 0, Math.PI * 2);
      ctx.fill();

      // Glowing Rocket Tip Node
      ctx.fillStyle = '#F59E0B';
      ctx.shadowColor = '#F59E0B';
      ctx.shadowBlur = 18;
      ctx.beginPath();
      ctx.arc(endX, endY, 7, 0, Math.PI * 2);
      ctx.fill();

      // Core white light center
      ctx.fillStyle = '#FFFFFF';
      ctx.shadowBlur = 0;
      ctx.beginPath();
      ctx.arc(endX, endY, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }, []);

  // Initial canvas draw
  useEffect(() => {
    drawCanvas(currentMultiplier, gameState === 'crashed');
  }, [drawCanvas, currentMultiplier, gameState]);

  return (
    <div className="w-full flex-1 flex flex-col min-h-0 text-left space-y-2 select-none">
      
      {/* 1. COMPACT IN-GAME TELEMETRY STRIP (NO SEPARATE NAVIGATION STRIP) */}
      <div className="p-2 sm:px-3 rounded-xl bg-[#111728]/95 border border-[#1B2238] flex flex-wrap items-center justify-between gap-2 shrink-0 shadow-md">
        {/* Left: Room Title, Live Status & Round */}
        <div className="flex items-center gap-2 shrink-0">
          <span className="font-display font-black text-white text-xs sm:text-sm tracking-wide">
            {room?.name || 'Crash Rocket Arena'}
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
            <span>Max: <strong className="text-[#F59E0B]">1,000x</strong></span>
          </div>
        </div>

        {/* Right: Recent Multipliers Strip */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5 max-w-[60%] sm:max-w-[70%]">
          <span className="text-[10px] font-mono-numbers uppercase text-[#94A3B8] font-bold shrink-0 hidden md:inline">
            History:
          </span>
          {recentCrashes.map((r, idx) => {
            const isHigh = r.point >= 10.0;
            const isMid = r.point >= 2.0 && r.point < 10.0;
            const badgeClass = isHigh
              ? 'bg-amber-500/15 border-amber-500/40 text-amber-300 shadow-amber-500/10'
              : isMid
              ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
              : 'bg-rose-500/10 border-rose-500/25 text-rose-400';

            return (
              <span
                key={idx}
                className={`px-2 py-0.5 rounded-lg text-[10px] font-mono-numbers font-black shrink-0 border ${badgeClass}`}
              >
                {r.point.toFixed(2)}x
              </span>
            );
          })}
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
                  disabled={gameState === 'flying' || gameState === 'countdown'}
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
                disabled={gameState === 'flying' || gameState === 'countdown'}
                className="py-1.5 rounded-lg bg-[#0B0F19] hover:bg-[#151C2B] text-[#94A3B8] hover:text-white border border-[#1F2737] transition-colors cursor-pointer disabled:opacity-40 text-[11px]"
              >
                ½
              </button>
              <button
                type="button"
                onClick={doubleBet}
                disabled={gameState === 'flying' || gameState === 'countdown'}
                className="py-1.5 rounded-lg bg-[#0B0F19] hover:bg-[#151C2B] text-[#94A3B8] hover:text-white border border-[#1F2737] transition-colors cursor-pointer disabled:opacity-40 text-[11px]"
              >
                2×
              </button>
              <button
                type="button"
                onClick={setMinBet}
                disabled={gameState === 'flying' || gameState === 'countdown'}
                className="py-1.5 rounded-lg bg-[#0B0F19] hover:bg-[#151C2B] text-[#94A3B8] hover:text-white border border-[#1F2737] transition-colors cursor-pointer disabled:opacity-40 text-[11px]"
              >
                Min
              </button>
              <button
                type="button"
                onClick={setMaxBet}
                disabled={gameState === 'flying' || gameState === 'countdown'}
                className="py-1.5 rounded-lg bg-[#0B0F19] hover:bg-[#151C2B] text-amber-400 border border-[#1F2737] transition-colors cursor-pointer disabled:opacity-40 text-[11px]"
              >
                Max
              </button>
            </div>

            {/* Quick Add Preset Pills */}
            <div className="grid grid-cols-4 gap-1 text-[10px] font-mono-numbers font-bold">
              {[1, 5, 25, 100].map(val => (
                <button
                  key={val}
                  type="button"
                  onClick={() => handleQuickAdd(val)}
                  disabled={gameState === 'flying' || gameState === 'countdown'}
                  className="py-1 rounded bg-[#0B0F19]/80 hover:bg-[#151C2B] text-violet-300 border border-violet-500/20 transition-colors cursor-pointer disabled:opacity-40"
                >
                  +{val}
                </button>
              ))}
            </div>

            {/* Auto Cashout Target Module */}
            <div className="pt-2 border-t border-[#1F2737] space-y-2">
              <div className="flex items-center justify-between text-xs font-mono-numbers">
                <label className="flex items-center gap-2 cursor-pointer text-[#94A3B8] font-bold text-[11px]">
                  <input
                    type="checkbox"
                    checked={isAutoCashoutEnabled}
                    onChange={(e) => setIsAutoCashoutEnabled(e.target.checked)}
                    className="accent-amber-500 rounded cursor-pointer w-4 h-4"
                  />
                  <span>Auto Cashout Target</span>
                </label>
                {isAutoCashoutEnabled && (
                  <span className="text-[10px] text-amber-400 font-bold font-mono-numbers">ACTIVE</span>
                )}
              </div>

              {isAutoCashoutEnabled && (
                <div className="space-y-1.5 animate-in fade-in duration-150">
                  <div className="flex items-center bg-[#0B0F19] border border-[#1F2737] rounded-xl p-1">
                    <input
                      type="number"
                      step="0.1"
                      min="1.01"
                      max="1000"
                      value={autoCashout}
                      onChange={(e) => setAutoCashout(e.target.value)}
                      disabled={gameState === 'flying'}
                      className="flex-1 bg-transparent px-3 py-1 text-white font-mono-numbers font-black text-xs outline-none"
                      placeholder="2.00"
                    />
                    <span className="text-amber-400 font-bold text-xs px-2 font-mono-numbers">× Multiplier</span>
                  </div>

                  <div className="grid grid-cols-4 gap-1 text-[10px] font-mono-numbers">
                    {['1.50', '2.00', '5.00', '10.00'].map(preset => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setAutoCashout(preset)}
                        className={`py-0.5 rounded border transition-colors cursor-pointer font-bold ${
                          autoCashout === preset 
                            ? 'bg-amber-500/20 border-amber-500/50 text-amber-300' 
                            : 'bg-[#0B0F19] border-[#1F2737] text-[#94A3B8]'
                        }`}
                      >
                        {preset}x
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

          </div>

          {/* Action Button: Launch Rocket vs Cashout */}
          <div className="pt-2">
            {gameState === 'flying' ? (
              <button
                type="button"
                onClick={() => handleCashout()}
                disabled={!!cashedOutAt}
                className={`w-full py-3.5 rounded-xl font-black text-sm flex items-center justify-center gap-2 cursor-pointer transition-all shadow-xl active:scale-98 ${
                  cashedOutAt
                    ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-500/50 cursor-default'
                    : 'bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-500 text-black shadow-emerald-500/30 animate-pulse hover:brightness-110'
                }`}
              >
                <Coins className="w-4 h-4 fill-current" />
                <span>
                  {cashedOutAt
                    ? `Cashed Out @ ${cashedOutAt.toFixed(2)}x (+${(betAmount * cashedOutAt).toFixed(2)} USDT)`
                    : `Cashout ${(betAmount * currentMultiplier).toFixed(2)} USDT (${currentMultiplier.toFixed(2)}x)`
                  }
                </span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleLaunch}
                disabled={loading || gameState === 'countdown'}
                className="w-full py-3.5 rounded-xl btn-gold text-black font-black text-sm flex items-center justify-center gap-2 cursor-pointer transition-all shadow-lg active:scale-98 disabled:opacity-50"
              >
                {gameState === 'countdown' ? (
                  <span className="animate-pulse flex items-center gap-1.5">
                    <Rocket className="w-4 h-4 animate-bounce" />
                    Launching in {countdownSeconds}s...
                  </span>
                ) : (
                  <>
                    <Rocket className="w-4 h-4 fill-current" />
                    <span>Launch Rocket • {betAmount} USDT</span>
                  </>
                )}
              </button>
            )}
          </div>

          {/* Embedded In-Room Activity Box */}
          {activityBox && (
            <div className="border-t border-[#1F2737] pt-2">
              {activityBox}
            </div>
          )}

        </div>

        {/* FLIGHT ARENA STAGE (Desktop: 8 cols / Mobile Landscape: 7 cols / Mobile Portrait: top) */}
        <div className={`bg-[#0B0F19] border border-[#1B2238] rounded-2xl p-3 sm:p-4 flex flex-col justify-between items-center relative overflow-hidden h-full min-h-[220px] lg:min-h-0 shadow-2xl ${
          isMobileLandscape ? 'col-span-7 order-2' : 'order-1 lg:order-2 lg:col-span-8'
        }`}>
          
          {/* Ambient Cosmic Background Wash */}
          <div className="absolute top-0 right-0 w-80 h-80 bg-violet-600/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-80 h-80 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

          {/* Central Multiplier HUD */}
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-10 px-4">
            {gameState === 'crashed' ? (
              <div className="text-center space-y-1.5 animate-in zoom-in-90 duration-150">
                <span className="font-display font-black text-4xl sm:text-6xl text-rose-500 tracking-tight drop-shadow-[0_0_35px_rgba(239,68,68,0.6)] font-mono-numbers">
                  {currentMultiplier.toFixed(2)}x
                </span>
                <div>
                  <span className="inline-flex items-center gap-1 text-[11px] font-mono-numbers uppercase tracking-widest text-rose-300 font-extrabold bg-rose-950/70 border border-rose-500/50 px-3 py-1 rounded-full shadow-lg">
                    <XCircle className="w-3.5 h-3.5" />
                    Crashed! Next flight soon...
                  </span>
                </div>
              </div>
            ) : gameState === 'flying' ? (
              <div className="text-center space-y-1">
                <span className="font-display font-black text-5xl sm:text-7xl text-white tracking-tight drop-shadow-[0_0_40px_rgba(245,158,11,0.45)] font-mono-numbers">
                  {currentMultiplier.toFixed(2)}x
                </span>
                {cashedOutAt ? (
                  <div className="animate-in fade-in">
                    <span className="inline-flex items-center gap-1 text-[11px] font-mono-numbers uppercase tracking-widest text-emerald-300 font-extrabold bg-emerald-950/70 border border-emerald-500/50 px-3 py-1 rounded-full shadow-lg">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      Locked @ {cashedOutAt.toFixed(2)}x (+{(betAmount * cashedOutAt).toFixed(2)} USDT)
                    </span>
                  </div>
                ) : (
                  <span className="block text-[11px] font-mono-numbers uppercase tracking-widest text-amber-400/80 font-bold">
                    Current Payout: {(betAmount * currentMultiplier).toFixed(2)} USDT
                  </span>
                )}
              </div>
            ) : gameState === 'countdown' ? (
              <div className="text-center space-y-2">
                <Rocket className="w-10 h-10 text-amber-400 animate-bounce mx-auto" />
                <span className="font-display font-extrabold text-base text-white tracking-wide">
                  Preparing Engine...
                </span>
                <span className="block text-xs font-mono-numbers text-amber-300 font-bold">
                  {countdownSeconds}s
                </span>
              </div>
            ) : (
              <div className="text-center space-y-2">
                <div className="w-14 h-14 rounded-full bg-violet-600/15 border border-violet-500/30 flex items-center justify-center mx-auto shadow-lg">
                  <Rocket className="w-7 h-7 text-amber-400/80" />
                </div>
                <span className="font-display font-black text-base text-white tracking-wide">
                  Ready to Launch
                </span>
                <p className="text-[11px] text-[#94A3B8] max-w-xs">
                  Set wager stake and tap Launch Rocket to ride the multiplier.
                </p>
              </div>
            )}
          </div>

          {/* HTML5 Canvas */}
          <canvas
            ref={canvasRef}
            className="w-full flex-1 min-h-[140px] block"
          />

          {/* Stage Footer */}
          <div className="w-full flex items-center justify-end pt-2 border-t border-[#1F2737] text-[10px] text-[#94A3B8] font-mono-numbers shrink-0">
            <span className="text-amber-400/80 font-bold">
              1.0% House Edge · Max Cap 1,000x
            </span>
          </div>

        </div>

      </div>

    </div>
  );
}
