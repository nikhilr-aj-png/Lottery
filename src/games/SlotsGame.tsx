import React, { useState, useEffect } from 'react';
import { useGameEngine } from '../hooks/useGameEngine';
import { generateSlotSpin, evaluateSlotsSpin, SLOTS_PAYTABLE } from '../engine';
import { 
  Play, 
  RefreshCw, 
  ShieldCheck, 
  History, 
  Coins, 
  Trophy, 
  Sparkles,
  Info,
  CheckCircle2,
  XCircle,
  Flame
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { soundFX } from '../engine/SoundFXService';

const SYMBOLS = ['💎', '7', '🎰', '⭐', '🔔', '🍒', '🍋'];

export default function SlotsGame({ 
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
  } = useGameEngine('slots');

  // Enforce room-specific stake bounds
  useEffect(() => {
    if (room?.minStakeFC && betAmount < room.minStakeFC) {
      setBetAmount(room.minStakeFC);
    } else if (room?.maxStakeFC && betAmount > room.maxStakeFC) {
      setBetAmount(room.maxStakeFC);
    }
  }, [room?.minStakeFC, room?.maxStakeFC]);

  // 3x3 Grid of symbols
  const [grid, setGrid] = useState([
    ['💎', '7', '🎰'],
    ['⭐', '🔔', '🍒'],
    ['🍋', '7', '💎']
  ]);

  const [isSpinning, setIsSpinning] = useState(false);
  const [winningData, setWinningData] = useState<any>(null);
  const [lastWin, setLastWin] = useState<any>(null);

  // Recent spins history
  const [recentSpins, setRecentSpins] = useState([
    { multiplier: 4.0, line: 'Cherries x3' },
    { multiplier: 0, line: 'No Win' },
    { multiplier: 15.0, line: 'Slots x3' },
    { multiplier: 1.2, line: 'Center Pair' },
    { multiplier: 0, line: 'No Win' },
    { multiplier: 50.0, line: 'Diamonds x3' }
  ]);

  // Spin Reels Action
  const handleSpin = async () => {
    if (isSpinning || loading) return;

    // 1. Start round in Game Engine (debit stake)
    const startRes = await startRound();
    if (!startRes.success) return;

    soundFX.playChipBet();
    soundFX.playSlotSpin();

    setIsSpinning(true);
    setWinningData(null);
    setLastWin(null);

    // 2. Derive deterministic 3x3 slot outcome from Provably Fair HMAC-SHA256
    const spinOutcome = await generateSlotSpin(
      seeds.serverHash || 'seed_slots_default',
      seeds.clientSeed,
      seeds.nonce
    );

    const finalGrid: string[][] = Array.isArray(spinOutcome) 
      ? spinOutcome 
      : ((spinOutcome as any)?.grid || [
          ['🍒', '🍋', '🍇'],
          ['🔔', '💎', '7️⃣'],
          ['🍒', '🍋', '🍇']
        ]);

    // Fast reel spinning animation (700ms)
    let steps = 0;
    const interval = setInterval(() => {
      // Generate random visual spinning symbols
      setGrid([
        [SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)], SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)], SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)]],
        [SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)], SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)], SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)]],
        [SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)], SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)], SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)]]
      ]);
      steps++;

      if (steps >= 12) {
        clearInterval(interval);
        finalizeSpin(finalGrid);
      }
    }, 55);
  };

  const finalizeSpin = async (finalGrid) => {
    soundFX.playSlotReelStop(0);
    setTimeout(() => soundFX.playSlotReelStop(1), 50);
    setTimeout(() => soundFX.playSlotReelStop(2), 100);

    setGrid(finalGrid);
    setIsSpinning(false);

    // Evaluate paylines
    const evalResult = evaluateSlotsSpin(finalGrid);
    const multiplierWon = evalResult.totalMultiplier;
    const payoutWon = parseFloat((betAmount * multiplierWon).toFixed(2));
    const isWin = multiplierWon > 0;

    if (isWin) {
      soundFX.playWinFanfare(multiplierWon >= 15 ? 'jackpot' : multiplierWon >= 5 ? 'big' : 'standard');
    }

    setWinningData(evalResult);
    setLastWin({
      multiplier: multiplierWon,
      payout: payoutWon,
      lines: evalResult.winningLines
    });

    if (multiplierWon >= 15.0) {
      try {
        confetti({
          particleCount: 120,
          spread: 90,
          origin: { y: 0.5 },
          colors: ['#F5C451', '#22C55E', '#A855F7', '#3B82F6']
        });
      } catch (_) {}
    } else if (isWin) {
      try {
        confetti({
          particleCount: 65,
          spread: 60,
          origin: { y: 0.6 },
          colors: ['#F5C451', '#22C55E']
        });
      } catch (_) {}
    }

    // Settle round in Supabase ledger
    await settleRound({
      multiplier: multiplierWon,
      payout: payoutWon,
      outcomeData: {
        grid: finalGrid,
        winningLines: evalResult.winningLines,
        multiplierWon,
        roomId: room?.id
      },
      metadata: { roomId: room?.id, roomName: room?.name }
    });

    const summaryLine = evalResult.winningLines[0]
      ? `${evalResult.winningLines[0].symbol} ${evalResult.winningLines[0].name}`
      : 'No Win';

    setRecentSpins(prev => [
      { multiplier: multiplierWon, line: summaryLine },
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
            className={`px-1.5 py-0.2 rounded text-[10px] border font-bold flex items-center gap-1 shrink-0 ${
              s.multiplier >= 10.0
                ? 'bg-amber-950/40 border-amber-500/40 text-amber-300'
                : s.multiplier > 0
                ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-300'
                : 'bg-rose-950/40 border-rose-500/30 text-rose-300'
            }`}
          >
            <span>{s.line}</span>
            <span className="text-[9px] opacity-75">({s.multiplier}x)</span>
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

            {/* Paylines & Paytable Summary */}
            <div className="bg-[#0B0F19] border border-[#1F2737] rounded-lg p-2 space-y-1 text-xs font-mono-numbers">
              <span className="text-[9px] text-[#94A3B8] uppercase tracking-wider block font-bold border-b border-[#1F2737] pb-0.5">
                Top Paytable (3 Matching):
              </span>
              <div className="grid grid-cols-2 gap-1 pt-0.5 text-[10px]">
                <div className="flex items-center justify-between bg-[#151C2B] px-1.5 py-0.5 rounded">
                  <span>💎 Diamond</span>
                  <span className="text-amber-400 font-bold">50x</span>
                </div>
                <div className="flex items-center justify-between bg-[#151C2B] px-1.5 py-0.5 rounded">
                  <span>7️⃣ Lucky 7</span>
                  <span className="text-amber-400 font-bold">25x</span>
                </div>
                <div className="flex items-center justify-between bg-[#151C2B] px-1.5 py-0.5 rounded">
                  <span>🎰 Vegas</span>
                  <span className="text-amber-400 font-bold">15x</span>
                </div>
                <div className="flex items-center justify-between bg-[#151C2B] px-1.5 py-0.5 rounded">
                  <span>⭐ Star</span>
                  <span className="text-amber-400 font-bold">10x</span>
                </div>
              </div>
            </div>

          </div>

          {/* Action Button: Spin Reels */}
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
                  <span>Spin Reels ({betAmount} FC)</span>
                </>
              )}
            </button>
          </div>

          {/* Dedicated In-Room Activity Box */}
          {activityBox}
        </div>

        {/* 3x3 Slots Machine Stage (Landscape: Right / Portrait: Top) */}
        <div className="order-1 lg:order-2 lg:col-span-8 bg-[#07090E] border border-[#1F2737] rounded-xl p-2 sm:p-4 flex flex-col justify-between items-center text-center relative overflow-hidden h-full min-h-[180px] lg:min-h-0">
          <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />

          {/* Top Status */}
          <div className="w-full flex items-center justify-between text-xs text-[#94A3B8] font-mono-numbers pb-1.5 border-b border-[#1F2737] shrink-0">
            <span>Vegas Gold 3x3 Slots</span>
            <span>Max Jackpot: <strong className="text-amber-400 font-bold">{(betAmount * 50).toLocaleString()} FC (50x)</strong></span>
          </div>

          {/* 3x3 Luxury Reel Matrix */}
          <div className="my-auto py-2">
            <div className="p-2 sm:p-3 rounded-2xl bg-gradient-to-b from-[#151C2B] via-[#0B0F19] to-[#151C2B] border-2 border-amber-500/40 shadow-[0_0_40px_rgba(245,196,81,0.2)]">
              <div className="grid grid-cols-3 gap-1.5 sm:gap-2 w-full max-w-[220px] sm:max-w-[260px]">
                {grid.map((row, rIdx) => 
                  row.map((symbol, cIdx) => {
                    const isWinningCell = winningData?.winningLines?.some(line => 
                      line.coords.some(([r, c]) => r === rIdx && c === cIdx)
                    );

                    return (
                      <div
                        key={`${rIdx}-${cIdx}`}
                        className={`aspect-square rounded-xl flex items-center justify-center text-2xl sm:text-3xl shadow-inner select-none transition-all duration-300 ${
                          isWinningCell
                            ? 'bg-gradient-to-br from-amber-500/40 to-amber-700/50 border-2 border-amber-400 shadow-[0_0_20px_rgba(245,196,81,0.7)] scale-105 z-10 animate-pulse'
                            : 'bg-[#0B0F19] border border-[#1F2737] text-white'
                        }`}
                      >
                        {symbol}
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Announcement Banner */}
            {lastWin && (
              <div className={`mt-2 rounded-xl px-3 py-1 text-center font-mono-numbers animate-in zoom-in-95 max-w-xs mx-auto ${
                lastWin.multiplier > 0
                  ? 'bg-emerald-950/80 border border-emerald-500/50 text-emerald-300'
                  : 'bg-rose-950/80 border border-rose-500/50 text-rose-300'
              }`}>
                <span className="text-xs font-black uppercase tracking-wider block">
                  {lastWin.multiplier > 0 
                    ? `WIN! +${lastWin.payout.toLocaleString()} FC (${lastWin.multiplier}x)` 
                    : 'No matching paylines. Spin again!'}
                </span>
                {lastWin.lines.length > 0 && (
                  <span className="text-[10px] font-semibold opacity-90 block">
                    {lastWin.lines.map(l => `${l.name} (${l.multiplier}x)`).join(' + ')}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Stage Footer: Provably Fair Note */}
          <div className="w-full flex items-center justify-between pt-1.5 border-t border-[#1F2737] text-[10px] text-[#94A3B8] shrink-0">
            <span className="flex items-center gap-1">
              <ShieldCheck className="w-3 h-3 text-emerald-400" />
              <span>Provably Fair HMAC-SHA256 Seeds</span>
            </span>
            <span className="text-amber-400 font-mono-numbers font-bold">
              House Edge: 3.0%
            </span>
          </div>

        </div>

      </div>
    </div>
  );
}

