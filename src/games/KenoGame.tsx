import React, { useState, useEffect } from 'react';
import { useGameEngine } from '../hooks/useGameEngine';
import { generateKenoDraw, getKenoMultiplier, KENO_PAYTABLES } from '../engine';
import { 
  Play, 
  RefreshCw, 
  ShieldCheck, 
  History, 
  Coins, 
  Trophy, 
  Sparkles, 
  Trash2, 
  Shuffle,
  CheckCircle2,
  XCircle
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { soundFX } from '../engine/SoundFXService';

export default function KenoGame({ room, activityBox }: { room?: any; activityBox?: React.ReactNode; }) {
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
  } = useGameEngine('keno');

  // Enforce room-specific stake bounds
  useEffect(() => {
    if (room?.minStakeFC && betAmount < room.minStakeFC) {
      setBetAmount(room.minStakeFC);
    } else if (room?.maxStakeFC && betAmount > room.maxStakeFC) {
      setBetAmount(room.maxStakeFC);
    }
  }, [room?.minStakeFC, room?.maxStakeFC]);

  // Player selected numbers: Array of numbers (1 to 40), max 10
  const [selectedNumbers, setSelectedNumbers] = useState([7, 12, 19, 23, 33]);
  const [drawnNumbers, setDrawnNumbers] = useState<any[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hits, setHits] = useState(0);
  const [lastWin, setLastWin] = useState<any>(null);

  // Recent draws history
  const [recentDraws, setRecentDraws] = useState([
    { hits: 4, picks: 5, multiplier: 18.0 },
    { hits: 1, picks: 5, multiplier: 0 },
    { hits: 3, picks: 4, multiplier: 8.0 },
    { hits: 2, picks: 3, multiplier: 3.0 },
    { hits: 0, picks: 5, multiplier: 0 },
    { hits: 5, picks: 6, multiplier: 45.0 }
  ]);

  const paytable = KENO_PAYTABLES[selectedNumbers.length] || {};

  // Toggle number pick
  const toggleNumber = (num) => {
    if (isDrawing) return;

    soundFX.playKenoPick();
    if (selectedNumbers.includes(num)) {
      setSelectedNumbers(prev => prev.filter(n => n !== num));
    } else {
      if (selectedNumbers.length >= 10) return; // max 10 picks
      setSelectedNumbers(prev => [...prev, num].sort((a, b) => a - b));
    }
  };

  // Auto Pick 10 random numbers
  const handleAutoPick = () => {
    if (isDrawing) return;
    soundFX.playClick();
    const pool = Array.from({ length: 40 }, (_, i) => i + 1);
    const shuffled = pool.sort(() => 0.5 - Math.random());
    setSelectedNumbers(shuffled.slice(0, 10).sort((a, b) => a - b));
  };

  // Clear selections
  const handleClear = () => {
    if (isDrawing) return;
    soundFX.playClick();
    setSelectedNumbers([]);
  };

  // Launch Keno Draw
  const handlePlayKeno = async () => {
    if (isDrawing || selectedNumbers.length === 0 || loading) return;

    // 1. Start round in Game Engine (debits stake)
    const startRes = await startRound();
    if (!startRes.success) return;

    soundFX.playChipBet();

    setIsDrawing(true);
    setDrawnNumbers([]);
    setHits(0);
    setLastWin(null);

    // 2. Derive 10 distinct winning balls from Provably Fair HMAC-SHA256
    const kenoDrawResult = await generateKenoDraw(
      seeds.serverHash || 'seed_keno_default',
      seeds.clientSeed,
      seeds.nonce,
      10
    );

    const winningBalls: number[] = Array.isArray(kenoDrawResult) 
      ? kenoDrawResult 
      : ((kenoDrawResult as any)?.drawnNumbers || (kenoDrawResult as any)?.drawnBalls || []);

    // 3. Sequentially reveal the 10 drawn balls (120ms each)
    let currentDrawn: number[] = [];
    let currentHits = 0;

    winningBalls.forEach((ball, idx) => {
      setTimeout(() => {
        soundFX.playKenoPick();
        currentDrawn.push(ball);
        setDrawnNumbers([...currentDrawn]);

        if (selectedNumbers.includes(ball)) {
          currentHits++;
          setHits(currentHits);
        }

        // When all 10 balls drawn, finalize
        if (idx === winningBalls.length - 1) {
          finalizeKenoRound(winningBalls, currentHits);
        }
      }, (idx + 1) * 120);
    });
  };

  const finalizeKenoRound = async (winningBalls, totalHits) => {
    setIsDrawing(false);

    const pickCount = selectedNumbers.length;
    const multiplierWon = getKenoMultiplier(pickCount, totalHits);
    const payoutWon = parseFloat((betAmount * multiplierWon).toFixed(2));
    const isWin = payoutWon > 0;

    if (isWin) {
      soundFX.playWinFanfare(multiplierWon >= 10 ? 'big' : 'standard');
    }

    setLastWin({
      hits: totalHits,
      picks: pickCount,
      multiplier: multiplierWon,
      payout: payoutWon
    });

    if (multiplierWon >= 2.0) {
      try {
        confetti({
          particleCount: 90,
          spread: 80,
          origin: { y: 0.6 },
          colors: ['#F5C451', '#22C55E', '#3B82F6']
        });
      } catch (_) {}
    }

    // Settle round in Supabase ledger
    await settleRound({
      multiplier: multiplierWon,
      payout: payoutWon,
      outcomeData: {
        picks: selectedNumbers,
        winningBalls,
        totalHits,
        multiplierWon,
        roomId: room?.id
      },
      metadata: { roomId: room?.id, roomName: room?.name }
    });

    setRecentDraws(prev => [
      { hits: totalHits, picks: pickCount, multiplier: multiplierWon },
      ...prev.slice(0, 7)
    ]);
  };

  return (
    <div className="w-full h-full flex flex-col min-h-0 overflow-hidden text-left space-y-1.5">
      {/* 1. COMPACT RECENT DRAWS STRIP */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 text-[11px] font-mono-numbers no-scrollbar shrink-0">
        <span className="text-[#94A3B8] text-[10px] uppercase tracking-wider flex items-center gap-1 font-bold pl-1 shrink-0">
          <History className="w-3 h-3 text-amber-400" />
          Recent:
        </span>
        {recentDraws.map((d, idx) => (
          <span
            key={idx}
            className={`px-2 py-0.5 rounded border text-[10px] font-bold flex items-center gap-1 shrink-0 ${
              d.multiplier > 0
                ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-300'
                : 'bg-rose-950/40 border-rose-500/30 text-rose-300'
            }`}
          >
            {d.hits}/{d.picks} ({d.multiplier}x)
          </span>
        ))}
      </div>

      {/* 2. MAIN GRID & CONTROLS CONTAINER */}
      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 gap-2 sm:gap-3 overflow-hidden">
        
        {/* Controls Column (order-2 on mobile, order-1 on desktop) */}
        <div className="order-2 lg:order-1 lg:col-span-4 bg-[#111827] border border-[#1F2737] rounded-xl p-2.5 sm:p-3 flex flex-col justify-between overflow-hidden h-full min-h-0 gap-2">
          <div className="space-y-2 shrink-0">
            
            {/* Stake Input */}
            <div>
              <div className="flex items-center justify-between text-[11px] mb-1 font-bold font-mono-numbers">
                <span className="text-[#94A3B8]">Bet Amount:</span>
              </div>
              <div className="flex items-center bg-[#0B0F19] border border-[#1F2737] focus-within:border-amber-500/50 rounded-lg p-1">
                <input
                  type="number"
                  min="1"
                  max="2000"
                  value={betAmount}
                  onChange={(e) => setBetAmount(Math.max(1, parseFloat(e.target.value) || 0))}
                  disabled={isDrawing}
                  className="flex-1 bg-transparent px-2 text-white font-mono-numbers font-black text-sm outline-none disabled:opacity-50"
                />
                <span className="text-amber-400 font-black text-xs px-2 font-mono-numbers">FC</span>
              </div>
            </div>

            {/* Quick Stake Adjusters */}
            <div className="grid grid-cols-4 gap-1 text-[11px] font-mono-numbers font-bold">
              <button
                type="button"
                onClick={halveBet}
                disabled={isDrawing}
                className="py-1 rounded bg-[#0B0F19] hover:bg-[#151C2B] text-[#94A3B8] hover:text-white border border-[#1F2737] transition-colors cursor-pointer disabled:opacity-50"
              >
                ½
              </button>
              <button
                type="button"
                onClick={doubleBet}
                disabled={isDrawing}
                className="py-1 rounded bg-[#0B0F19] hover:bg-[#151C2B] text-[#94A3B8] hover:text-white border border-[#1F2737] transition-colors cursor-pointer disabled:opacity-50"
              >
                2x
              </button>
              <button
                type="button"
                onClick={setMinBet}
                disabled={isDrawing}
                className="py-1 rounded bg-[#0B0F19] hover:bg-[#151C2B] text-[#94A3B8] hover:text-white border border-[#1F2737] transition-colors cursor-pointer disabled:opacity-50"
              >
                Min
              </button>
              <button
                type="button"
                onClick={setMaxBet}
                disabled={isDrawing}
                className="py-1 rounded bg-[#0B0F19] hover:bg-[#151C2B] text-amber-400 border border-[#1F2737] transition-colors cursor-pointer disabled:opacity-50"
              >
                Max
              </button>
            </div>

            {/* Pick Counters & Helpers */}
            <div>
              <div className="flex items-center justify-between text-[11px] mb-1 font-bold font-mono-numbers">
                <span className="text-[#94A3B8]">Selected:</span>
                <span className="text-amber-400 font-black">{selectedNumbers.length} / 10 Max</span>
              </div>
              <div className="grid grid-cols-2 gap-1.5 text-[11px] font-bold font-mono-numbers">
                <button
                  type="button"
                  onClick={handleAutoPick}
                  disabled={isDrawing}
                  className="py-1.5 rounded-lg bg-[#0B0F19] hover:bg-[#151C2B] border border-[#1F2737] hover:border-amber-500/40 text-amber-300 flex items-center justify-center gap-1 transition-all cursor-pointer disabled:opacity-50"
                >
                  <Shuffle className="w-3 h-3" />
                  Auto Pick 10
                </button>
                <button
                  type="button"
                  onClick={handleClear}
                  disabled={isDrawing || selectedNumbers.length === 0}
                  className="py-1.5 rounded-lg bg-[#0B0F19] hover:bg-[#151C2B] border border-[#1F2737] text-rose-400 flex items-center justify-center gap-1 transition-all cursor-pointer disabled:opacity-50"
                >
                  <Trash2 className="w-3 h-3" />
                  Clear Board
                </button>
              </div>
            </div>

            {/* Dynamic Paytable For Current Pick Count */}
            <div className="bg-[#0B0F19] border border-[#1F2737] rounded-lg p-2 space-y-1 text-[11px] font-mono-numbers">
              <span className="text-[10px] text-[#94A3B8] uppercase tracking-wider block font-bold border-b border-[#1F2737] pb-0.5">
                Multipliers ({selectedNumbers.length} Picks):
              </span>
              {Object.keys(paytable).length > 0 ? (
                <div className="grid grid-cols-3 gap-1 pt-0.5 max-h-[60px] overflow-y-auto no-scrollbar">
                  {Object.entries(paytable).map(([hitCount, mult]) => (
                    <div key={hitCount} className="flex items-center justify-between bg-[#151C2B] px-1.5 py-0.5 rounded text-[10px]">
                      <span className="text-[#94A3B8]">{hitCount}H:</span>
                      <span className="text-amber-300 font-bold">{mult}x</span>
                    </div>
                  ))}
                </div>
              ) : (
                <span className="text-[10px] text-[#64748B] italic block pt-0.5">
                  Pick at least 1 number to view paytable.
                </span>
              )}
            </div>

          </div>

          {/* Action Button: Draw Keno Balls */}
          <div className="shrink-0 pt-1">
            <button
              type="button"
              onClick={handlePlayKeno}
              disabled={isDrawing || selectedNumbers.length === 0 || loading}
              className="w-full py-2.5 rounded-xl font-extrabold text-xs sm:text-sm flex items-center justify-center gap-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black shadow-lg shadow-amber-500/20 hover:scale-[1.01] active:scale-95 transition-all cursor-pointer disabled:opacity-60"
            >
              {loading || isDrawing ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>Draw 10 Balls ({betAmount} FC)</span>
                </>
              )}
            </button>
          </div>

          {/* Dedicated In-Room Live Activity Box */}
          {activityBox && (
            <div className="flex-1 min-h-[120px] max-h-[160px] xs:max-h-[180px] lg:max-h-[220px] overflow-hidden">
              {activityBox}
            </div>
          )}
        </div>

        {/* 40-Number Keno Grid Stage (order-1 on mobile, order-2 on desktop) */}
        <div className="order-1 lg:order-2 lg:col-span-8 bg-[#07090E] border border-[#1F2737] rounded-xl p-2 sm:p-3 flex flex-col justify-between items-center text-center relative overflow-hidden h-full min-h-[200px] lg:min-h-0">
          <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />

          {/* Top Status */}
          <div className="w-full flex items-center justify-between text-xs text-[#94A3B8] font-mono-numbers pb-1.5 border-b border-[#1F2737] shrink-0">
            <span>Picks: <strong className="text-white font-bold">{selectedNumbers.length} Numbers</strong></span>
            <span>Hits: <strong className="text-emerald-400 font-bold">{hits} Matched</strong></span>
          </div>

          {/* 40-Number Interactive Grid */}
          <div className="my-auto py-2 w-full max-w-[440px]">
            <div className="grid grid-cols-8 sm:grid-cols-10 gap-1 xs:gap-1.5">
              {Array.from({ length: 40 }, (_, i) => i + 1).map((num) => {
                const isSelected = selectedNumbers.includes(num);
                const isDrawn = drawnNumbers.includes(num);
                const isMatch = isSelected && isDrawn;

                return (
                  <button
                    key={num}
                    type="button"
                    onClick={() => toggleNumber(num)}
                    disabled={isDrawing}
                    className={`aspect-square rounded-lg font-mono-numbers font-black text-[11px] sm:text-xs flex items-center justify-center transition-all cursor-pointer select-none ${
                      isMatch
                        ? 'bg-gradient-to-br from-emerald-500 to-emerald-700 text-white border-2 border-emerald-300 shadow-[0_0_12px_rgba(34,197,94,0.7)] scale-110 z-10 animate-bounce'
                        : isDrawn
                        ? 'bg-purple-950/80 border border-purple-500/50 text-purple-300'
                        : isSelected
                        ? 'bg-amber-500 text-black border border-amber-300 shadow-md shadow-amber-500/20 scale-105'
                        : 'bg-[#151C2B] hover:bg-[#1E293B] border border-[#1F2737] hover:border-amber-500/40 text-white/80'
                    }`}
                  >
                    {isMatch ? '★' : num}
                  </button>
                );
              })}
            </div>

            {/* Announcement Banner */}
            {lastWin && (
              <div className={`mt-2 rounded-lg px-3 py-1.5 text-center font-mono-numbers animate-in zoom-in-95 ${
                lastWin.payout > 0
                  ? 'bg-emerald-950/80 border border-emerald-500/50 text-emerald-300'
                  : 'bg-rose-950/80 border border-rose-500/50 text-rose-300'
              }`}>
                <span className="text-xs font-black">
                  {lastWin.payout > 0 
                    ? `Matched ${lastWin.hits}/${lastWin.picks}! Won +${lastWin.payout.toLocaleString()} FC (${lastWin.multiplier}x)` 
                    : `Matched ${lastWin.hits}/${lastWin.picks} — No hit. Better luck next draw!`}
                </span>
              </div>
            )}
          </div>

          {/* Stage Footer: Provably Fair Note */}
          <div className="w-full flex items-center justify-between pt-1.5 border-t border-[#1F2737] text-[10px] text-[#94A3B8] shrink-0">
            <span className="flex items-center gap-1">
              <ShieldCheck className="w-3 h-3 text-emerald-400" />
              <span>Provably Fair: HMAC-SHA256 10-Ball Blower</span>
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
