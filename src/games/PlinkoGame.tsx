import React, { useState, useRef, useEffect } from 'react';
import { useGameEngine } from '../hooks/useGameEngine';
import { generatePlinkoPath, getPlinkoMultiplier, PLINKO_PAYTABLES } from '../engine';
import { 
  Play, 
  RefreshCw, 
  ShieldCheck, 
  History, 
  Coins, 
  Trophy, 
  Sparkles,
  Layers,
  Flame,
  ChevronRight
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { soundFX } from '../engine/SoundFXService';

export default function PlinkoGame({ 
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
  } = useGameEngine('plinko');

  // Enforce room-specific stake bounds
  useEffect(() => {
    if (room?.minStakeFC && betAmount < room.minStakeFC) {
      setBetAmount(room.minStakeFC);
    } else if (room?.maxStakeFC && betAmount > room.maxStakeFC) {
      setBetAmount(room.maxStakeFC);
    }
  }, [room?.minStakeFC, room?.maxStakeFC]);

  // Board configuration: rows (8, 10, 12, 14, 16) and risk ('low', 'medium', 'high')
  const [rows, setRows] = useState(10);
  const [risk, setRisk] = useState('medium');
  const [isDropping, setIsDropping] = useState(false);
  const [activeSlot, setActiveSlot] = useState<any>(null);
  const [lastWin, setLastWin] = useState<any>(null);

  // Recent drops history
  const [recentDrops, setRecentDrops] = useState([
    { multiplier: 2.0, slot: 6 },
    { multiplier: 0.4, slot: 5 },
    { multiplier: 5.0, slot: 8 },
    { multiplier: 0.6, slot: 4 },
    { multiplier: 22.0, slot: 9 },
    { multiplier: 1.4, slot: 3 }
  ]);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animFrameRef = useRef<number | null>(null);

  // Multiplier row for bottom buckets
  const paytable = PLINKO_PAYTABLES[rows]?.[risk] || PLINKO_PAYTABLES[10].medium;

  // Draw board pins on canvas
  useEffect(() => {
    drawStaticBoard();
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [rows, risk, activeSlot]);

  // Static board renderer
  const drawStaticBoard = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const width = canvas.width;
    const height = canvas.height;

    ctx.clearRect(0, 0, width, height);

    // Draw triangle pins
    const pinRadius = 3.5;
    const startY = 35;
    const endY = height - 45;
    const rowSpacing = (endY - startY) / rows;

    for (let r = 0; r <= rows; r++) {
      const pinCount = r + 3; // start with 3 pins at top
      const rowWidth = (pinCount - 1) * (width * 0.75 / (rows + 2));
      const startX = (width - rowWidth) / 2;
      const spacingX = rowWidth / (pinCount - 1);
      const y = startY + r * rowSpacing;

      for (let i = 0; i < pinCount; i++) {
        const x = startX + i * spacingX;
        ctx.beginPath();
        ctx.arc(x, y, pinRadius, 0, Math.PI * 2);
        ctx.fillStyle = '#94A3B8';
        ctx.shadowColor = 'rgba(255, 255, 255, 0.4)';
        ctx.shadowBlur = 4;
        ctx.fill();
        ctx.shadowBlur = 0;
      }
    }
  };

  // Launch Ball Drop
  const handleDrop = async () => {
    if (isDropping || loading) return;

    // 1. Start round in Game Engine (debits stake)
    const startRes = await startRound();
    if (!startRes.success) return;

    soundFX.playChipBet();

    setIsDropping(true);
    setActiveSlot(null);
    setLastWin(null);

    // 2. Derive deterministic path via Provably Fair algorithm
    const path = await generatePlinkoPath(
      seeds.serverHash || 'seed_plinko_default',
      seeds.clientSeed,
      seeds.nonce,
      rows
    );

    const derivedSlot = path.reduce((sum, step) => sum + step, 0);
    const multiplierWon = getPlinkoMultiplier(rows, risk as 'low' | 'medium' | 'high', derivedSlot);
    const payoutWon = parseFloat((betAmount * multiplierWon).toFixed(2));

    // 3. Animate ball physics dropping along path
    animateBallDrop(path, derivedSlot, multiplierWon, payoutWon);
  };

  const animateBallDrop = (path: number[], finalSlot: number, multiplierWon: number, payoutWon: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const width = canvas.width;
    const height = canvas.height;

    const startY = 35;
    const endY = height - 45;
    const rowSpacing = (endY - startY) / rows;

    // Precalculate peg pin coordinates for this path
    const points: Array<{ x: number; y: number }> = [];
    let currentPinIndex = 1; // start at middle pin of top row (out of 3)

    // Initial position above top row
    const topPinCount = 3;
    const topRowWidth = (topPinCount - 1) * (width * 0.75 / (rows + 2));
    const topStartX = (width - topRowWidth) / 2;
    const topSpacing = topRowWidth / (topPinCount - 1);

    points.push({ x: width / 2, y: 15 });

    for (let r = 0; r <= rows; r++) {
      const pinCount = r + 3;
      const rowWidth = (pinCount - 1) * (width * 0.75 / (rows + 2));
      const startX = (width - rowWidth) / 2;
      const spacingX = rowWidth / (pinCount - 1);
      const y = startY + r * rowSpacing;

      if (r < rows) {
        const step = path[r]; // 0 = left, 1 = right
        if (step === 1) {
          currentPinIndex++;
        }
      }

      const pegX = startX + currentPinIndex * spacingX;
      points.push({ x: pegX, y: y });
    }

    // Add final landing in slot bucket
    const bucketSpacing = width / paytable.length;
    const landingX = (finalSlot + 0.5) * bucketSpacing;
    points.push({ x: landingX, y: height - 12 });

    let currentSegment = 0;
    let t = 0;
    const speed = 0.085; // animation speed

    const animate = () => {
      drawStaticBoard();

      if (currentSegment < points.length - 1) {
        const p1 = points[currentSegment];
        const p2 = points[currentSegment + 1];

        // Interpolate position with bounce arc
        const curX = p1.x + (p2.x - p1.x) * t;
        const curY = p1.y + (p2.y - p1.y) * t;

        // Draw animated ball
        ctx.beginPath();
        ctx.arc(curX, curY, 6, 0, Math.PI * 2);
        ctx.fillStyle = '#F5C451';
        ctx.shadowColor = '#F5C451';
        ctx.shadowBlur = 10;
        ctx.fill();
        ctx.shadowBlur = 0;

        t += speed;
        if (t >= 1) {
          t = 0;
          currentSegment++;
          soundFX.playPlinkoBounce(currentSegment);
        }

        animFrameRef.current = requestAnimationFrame(animate);
      } else {
        // Drop complete!
        finalizeDrop(finalSlot, multiplierWon, payoutWon);
      }
    };

    animFrameRef.current = requestAnimationFrame(animate);
  };

  const finalizeDrop = async (finalSlot, multiplierWon, payoutWon) => {
    setIsDropping(false);
    setActiveSlot(finalSlot);

    soundFX.playPlinkoSlot(multiplierWon);
    if (multiplierWon >= 2.0) {
      soundFX.playWinFanfare(multiplierWon >= 10 ? 'big' : 'standard');
    }

    setLastWin({
      multiplier: multiplierWon,
      payout: payoutWon,
      slot: finalSlot
    });

    if (multiplierWon >= 2.0) {
      try {
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#F5C451', '#22C55E', '#A855F7']
        });
      } catch (_) {}
    }

    // Settle round in Supabase ledger
    await settleRound({
      multiplier: multiplierWon,
      payout: payoutWon,
      outcomeData: {
        rows,
        risk,
        slotIndex: finalSlot,
        multiplier: multiplierWon,
        roomId: room?.id
      },
      metadata: { roomId: room?.id, roomName: room?.name }
    });

    setRecentDrops(prev => [
      { multiplier: multiplierWon, slot: finalSlot },
      ...prev.slice(0, 7)
    ]);
  };

  return (
    <div className="w-full h-full flex flex-col min-h-0 overflow-hidden text-left space-y-1.5">
      {/* 1. RECENT DROPS STRIP */}
      <div className="flex items-center gap-2 overflow-x-auto pb-0.5 text-xs font-mono-numbers no-scrollbar shrink-0">
        <span className="text-[#94A3B8] text-[10px] uppercase tracking-wider flex items-center gap-1 font-bold pl-1 shrink-0">
          <History className="w-3 h-3 text-amber-400" />
          Recent:
        </span>
        {recentDrops.map((d, idx) => (
          <span
            key={idx}
            className={`px-1.5 py-0.2 rounded text-[10px] border font-bold flex items-center gap-1 shrink-0 ${
              d.multiplier >= 2.0
                ? 'bg-amber-950/40 border-amber-500/40 text-amber-300'
                : d.multiplier >= 1.0
                ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-300'
                : 'bg-rose-950/40 border-rose-500/30 text-rose-300'
            }`}
          >
            {d.multiplier.toFixed(1)}x
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
                  disabled={isDropping}
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
                disabled={isDropping}
                className="py-1 rounded bg-[#0B0F19] hover:bg-[#151C2B] text-[#94A3B8] hover:text-white border border-[#1F2737] transition-colors cursor-pointer disabled:opacity-50 text-[11px]"
              >
                ½
              </button>
              <button
                type="button"
                onClick={doubleBet}
                disabled={isDropping}
                className="py-1 rounded bg-[#0B0F19] hover:bg-[#151C2B] text-[#94A3B8] hover:text-white border border-[#1F2737] transition-colors cursor-pointer disabled:opacity-50 text-[11px]"
              >
                2x
              </button>
              <button
                type="button"
                onClick={setMinBet}
                disabled={isDropping}
                className="py-1 rounded bg-[#0B0F19] hover:bg-[#151C2B] text-[#94A3B8] hover:text-white border border-[#1F2737] transition-colors cursor-pointer disabled:opacity-50 text-[11px]"
              >
                Min
              </button>
              <button
                type="button"
                onClick={setMaxBet}
                disabled={isDropping}
                className="py-1 rounded bg-[#0B0F19] hover:bg-[#151C2B] text-amber-400 border border-[#1F2737] transition-colors cursor-pointer disabled:opacity-50 text-[11px]"
              >
                Max
              </button>
            </div>

            {/* Risk Selection */}
            <div>
              <span className="text-[11px] font-bold text-[#94A3B8] block mb-1 font-mono-numbers">
                Risk Profile:
              </span>
              <div className="grid grid-cols-3 gap-1 text-xs font-bold font-mono-numbers">
                {['low', 'medium', 'high'].map(r => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setRisk(r)}
                    disabled={isDropping}
                    className={`py-1 rounded-lg border capitalize transition-all cursor-pointer disabled:opacity-50 text-[11px] ${
                      risk === r
                        ? r === 'high' 
                          ? 'bg-rose-500/20 border-rose-500 text-rose-300 font-black'
                          : r === 'medium'
                          ? 'bg-amber-500/20 border-amber-500 text-amber-300 font-black'
                          : 'bg-emerald-500/20 border-emerald-500 text-emerald-300 font-black'
                        : 'bg-[#0B0F19] hover:bg-[#151C2B] text-[#94A3B8] border-[#1F2737]'
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>

            {/* Row Count Selection */}
            <div>
              <div className="flex items-center justify-between text-xs mb-1 font-bold font-mono-numbers">
                <span className="text-[#94A3B8] text-[11px]">Rows:</span>
                <span className="text-amber-400 font-black text-[11px]">{rows} Rows</span>
              </div>
              <div className="grid grid-cols-5 gap-1 text-xs font-bold font-mono-numbers">
                {[8, 10, 12, 14, 16].map(rw => (
                  <button
                    key={rw}
                    type="button"
                    onClick={() => setRows(rw)}
                    disabled={isDropping}
                    className={`py-0.5 rounded border transition-all cursor-pointer disabled:opacity-50 text-[11px] ${
                      rows === rw
                        ? 'bg-amber-500/20 border-amber-500 text-amber-300 font-black'
                        : 'bg-[#0B0F19] hover:bg-[#151C2B] text-[#94A3B8] border-[#1F2737]'
                    }`}
                  >
                    {rw}
                  </button>
                ))}
              </div>
            </div>

            {/* Max Multiplier Overview */}
            <div className="bg-[#0B0F19] border border-[#1F2737] rounded-lg p-2 flex items-center justify-between text-xs font-mono-numbers">
              <span className="text-[#94A3B8] text-[11px]">Max Multiplier:</span>
              <span className="text-amber-300 font-black text-xs">
                {Math.max(...paytable)}x
              </span>
            </div>

          </div>

          {/* Action Button: Drop Plinko Ball */}
          <div className="shrink-0">
            <button
              type="button"
              onClick={handleDrop}
              disabled={isDropping || loading}
              className="w-full py-2.5 sm:py-3 rounded-xl font-extrabold text-xs sm:text-sm flex items-center justify-center gap-1.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black shadow-md shadow-amber-500/20 transition-all cursor-pointer disabled:opacity-60"
            >
              {loading || isDropping ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <Play className="w-4 h-4 fill-current" />
                  <span>Drop Ball ({betAmount} FC)</span>
                </>
              )}
            </button>
          </div>

          {/* Dedicated In-Room Activity Box */}
          {activityBox}
        </div>

        {/* Pegboard Canvas Stage (Landscape: Right / Portrait: Top) */}
        <div className="order-1 lg:order-2 lg:col-span-8 bg-[#07090E] border border-[#1F2737] rounded-xl p-2 sm:p-3 flex flex-col justify-between items-center text-center relative overflow-hidden h-full min-h-[180px] lg:min-h-0">
          <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />

          {/* Top Status */}
          <div className="w-full flex items-center justify-between text-xs text-[#94A3B8] font-mono-numbers pb-1.5 border-b border-[#1F2737] shrink-0">
            <span>Pins: <strong className="text-white font-bold">{rows} Rows ({risk.toUpperCase()})</strong></span>
            <span>Max: <strong className="text-amber-400 font-bold">{(betAmount * Math.max(...paytable)).toLocaleString()} FC</strong></span>
          </div>

          {/* Plinko Pegboard Canvas */}
          <div className="w-full flex-1 min-h-0 my-auto py-1 flex flex-col items-center justify-center">
            <canvas
              ref={canvasRef}
              width={480}
              height={260}
              className="w-full max-w-[460px] flex-1 min-h-0 object-contain block"
            />

            {/* Bottom Multiplier Buckets */}
            <div className="w-full max-w-[460px] flex items-center justify-between gap-0.5 pt-1 overflow-x-auto no-scrollbar shrink-0">
              {paytable.map((mult, idx) => {
                const isSelected = activeSlot === idx;
                const isHigh = mult >= 10;
                const isMed = mult >= 2 && mult < 10;

                return (
                  <div
                    key={idx}
                    className={`flex-1 min-w-[20px] py-0.5 text-center rounded text-[9px] sm:text-[10px] font-mono-numbers font-extrabold transition-all duration-300 ${
                      isSelected
                        ? 'bg-amber-400 text-black scale-110 shadow-[0_0_15px_rgba(245,196,81,0.8)] z-10'
                        : isHigh
                        ? 'bg-rose-950/80 border border-rose-500/40 text-rose-300'
                        : isMed
                        ? 'bg-amber-950/80 border border-amber-500/40 text-amber-300'
                        : 'bg-[#151C2B] border border-[#1F2737] text-[#94A3B8]'
                    }`}
                  >
                    {mult}x
                  </div>
                );
              })}
            </div>

            {/* Win announcement pill */}
            {lastWin && (
              <div className="mt-1 bg-emerald-950/80 border border-emerald-500/50 rounded-lg px-3 py-0.5 text-center text-emerald-300 font-mono-numbers animate-in zoom-in-95 shrink-0">
                <span className="text-xs font-black">
                  Landed in Slot #{lastWin.slot + 1}! Won +{lastWin.payout.toLocaleString()} FC ({lastWin.multiplier}x)
                </span>
              </div>
            )}
          </div>

          {/* Stage Footer: Provably Fair Note */}
          <div className="w-full flex items-center justify-between pt-1.5 border-t border-[#1F2737] text-[10px] text-[#94A3B8] shrink-0">
            <span className="flex items-center gap-1">
              <ShieldCheck className="w-3 h-3 text-emerald-400" />
              <span>Provably Fair HMAC-SHA256</span>
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

