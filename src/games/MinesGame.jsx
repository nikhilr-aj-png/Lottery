import React, { useState, useEffect } from 'react';
import { useGameEngine } from '../hooks/useGameEngine';
import { generateMinesGrid, calculateMinesMultiplier } from '../engine';
import { 
  Bomb, 
  Gem, 
  Coins, 
  RefreshCw, 
  TrendingUp, 
  ShieldCheck, 
  History,
  Sparkles,
  AlertTriangle,
  Play
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { soundFX } from '../engine/SoundFXService';

export default function MinesGame({ room }) {
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
  } = useGameEngine('mines');

  // Enforce room-specific stake bounds
  useEffect(() => {
    if (room?.minStakeFC && betAmount < room.minStakeFC) {
      setBetAmount(room.minStakeFC);
    } else if (room?.maxStakeFC && betAmount > room.maxStakeFC) {
      setBetAmount(room.maxStakeFC);
    }
  }, [room?.minStakeFC, room?.maxStakeFC]);

  // Mine count: 1 to 24 (Default: 3)
  const [mineCount, setMineCount] = useState(3);
  
  // Game states: 'idle' | 'playing' | 'cashed_out' | 'exploded'
  const [gameState, setGameState] = useState('idle');
  
  // Tiles state: array of 25 objects: { index, state: 'hidden' | 'gem' | 'mine', isRevealed: boolean }
  const [tiles, setTiles] = useState(
    Array.from({ length: 25 }, (_, i) => ({ index: i, state: 'hidden', isRevealed: false }))
  );
  
  // Array of mine indices (e.g. [4, 11, 23])
  const [minePositions, setMinePositions] = useState([]);
  const [uncoveredGems, setUncoveredGems] = useState(0);
  const [lastPayout, setLastPayout] = useState(null);
  
  // Recent rounds history
  const [recentRounds, setRecentRounds] = useState([
    { multiplier: 2.14, won: true, gems: 4, mines: 3 },
    { multiplier: 0, won: false, gems: 1, mines: 5 },
    { multiplier: 4.88, won: true, gems: 7, mines: 3 },
    { multiplier: 0, won: false, gems: 2, mines: 10 },
    { multiplier: 1.48, won: true, gems: 2, mines: 3 }
  ]);

  // Multiplier calculations from rules engine
  const currentCalc = calculateMinesMultiplier(mineCount, uncoveredGems, 1.0);
  const nextCalc = calculateMinesMultiplier(mineCount, uncoveredGems + 1, 1.0);

  // Current potential payout
  const currentPayout = uncoveredGems > 0 
    ? parseFloat((betAmount * currentCalc.multiplier).toFixed(2)) 
    : 0;

  // Next potential payout if next tile is gem
  const nextPayout = parseFloat((betAmount * nextCalc.multiplier).toFixed(2));

  // 1. START NEW MINES ROUND
  const handleStartGame = async () => {
    if (gameState === 'playing' || loading) return;

    // Reset grid
    setTiles(Array.from({ length: 25 }, (_, i) => ({ index: i, state: 'hidden', isRevealed: false })));
    setUncoveredGems(0);
    setLastPayout(null);

    // Debit stake via Game Engine
    const startRes = await startRound();
    if (!startRes.success) return;

    soundFX.playChipBet();

    // Derive deterministic mine positions using Provably Fair HMAC-SHA256
    const gridData = await generateMinesGrid(
      seeds.serverHash || 'seed_mines_default',
      seeds.clientSeed,
      seeds.nonce,
      mineCount
    );

    setMinePositions(gridData.minePositions);
    setGameState('playing');
  };

  // 2. TILE CLICK HANDLER
  const handleTileClick = async (index) => {
    if (gameState !== 'playing') return;

    const currentTile = tiles[index];
    if (currentTile.isRevealed) return;

    const isMine = minePositions.includes(index);

    if (isMine) {
      soundFX.playMinesReveal(false);
      // BOMB EXPLODED! (Loss)
      handleExplosion(index);
    } else {
      soundFX.playMinesReveal(true);
      // SAFE GEM!
      const newGemsCount = uncoveredGems + 1;
      const totalSafeTiles = 25 - mineCount;

      // Update tile state to gem
      setTiles(prev => prev.map(t => 
        t.index === index ? { ...t, state: 'gem', isRevealed: true } : t
      ));
      setUncoveredGems(newGemsCount);

      // Check if all gems uncovered (Jackpot Win!)
      if (newGemsCount >= totalSafeTiles) {
        handleMaxWin(newGemsCount);
      }
    }
  };

  // 3. EXPLOSION HANDLER
  const handleExplosion = async (explodedIndex) => {
    setGameState('exploded');

    // Reveal entire board: show exploded mine, other mines, and remaining gems
    setTiles(prev => prev.map(t => {
      const isMine = minePositions.includes(t.index);
      return {
        ...t,
        isRevealed: true,
        state: isMine ? (t.index === explodedIndex ? 'exploded' : 'mine') : (t.state === 'gem' ? 'gem' : 'missed_gem')
      };
    }));

    // Settle round as lost
    await settleRound({
      multiplier: 0,
      payout: 0,
      outcomeData: {
        gemsUncovered: uncoveredGems,
        mineCount,
        minePositions,
        explodedAt: explodedIndex,
        roomId: room?.id
      },
      metadata: { roomId: room?.id, roomName: room?.name }
    });

    setRecentRounds(prev => [
      { multiplier: 0, won: false, gems: uncoveredGems, mines: mineCount },
      ...prev.slice(0, 7)
    ]);
  };

  // 4. CASHOUT HANDLER (Voluntary Win)
  const handleCashout = async () => {
    if (gameState !== 'playing' || uncoveredGems === 0) return;

    setGameState('cashed_out');
    const finalMultiplier = currentCalc.multiplier;
    const finalPayout = currentPayout;

    soundFX.playWinFanfare(finalMultiplier >= 5 ? 'big' : 'standard');

    // Trigger celebration confetti
    try {
      confetti({
        particleCount: 60,
        spread: 60,
        origin: { y: 0.6 },
        colors: ['#F5C451', '#22C55E', '#3B82F6']
      });
    } catch (_) {}

    // Reveal all remaining mines on the board
    setTiles(prev => prev.map(t => {
      const isMine = minePositions.includes(t.index);
      return {
        ...t,
        isRevealed: true,
        state: isMine ? 'mine' : t.state
      };
    }));

    setLastPayout({
      multiplier: finalMultiplier,
      payout: finalPayout
    });

    // Settle round via Game Engine & Supabase RPC
    await settleRound({
      multiplier: finalMultiplier,
      payout: finalPayout,
      outcomeData: {
        gemsUncovered: uncoveredGems,
        mineCount,
        minePositions,
        cashedOut: true,
        roomId: room?.id
      },
      metadata: { roomId: room?.id, roomName: room?.name }
    });

    setRecentRounds(prev => [
      { multiplier: finalMultiplier, won: true, gems: uncoveredGems, mines: mineCount },
      ...prev.slice(0, 7)
    ]);
  };

  // 5. MAX WIN HANDLER (All safe gems uncovered)
  const handleMaxWin = async (gemsCount) => {
    soundFX.playWinFanfare('jackpot');
    setGameState('cashed_out');
    const finalCalc = calculateMinesMultiplier(mineCount, gemsCount, 1.0);
    const finalPayout = parseFloat((betAmount * finalCalc.multiplier).toFixed(2));

    try {
      confetti({
        particleCount: 120,
        spread: 90,
        origin: { y: 0.5 },
        colors: ['#F5C451', '#22C55E', '#8B5CF6', '#3B82F6']
      });
    } catch (_) {}

    setTiles(prev => prev.map(t => ({
      ...t,
      isRevealed: true,
      state: minePositions.includes(t.index) ? 'mine' : 'gem'
    })));

    setLastPayout({
      multiplier: finalCalc.multiplier,
      payout: finalPayout
    });

    await settleRound({
      multiplier: finalCalc.multiplier,
      payout: finalPayout,
      outcomeData: {
        gemsUncovered: gemsCount,
        mineCount,
        minePositions,
        maxWin: true
      }
    });

    setRecentRounds(prev => [
      { multiplier: finalCalc.multiplier, won: true, gems: gemsCount, mines: mineCount },
      ...prev.slice(0, 7)
    ]);
  };

  return (
    <div className="w-full space-y-4">
      {/* 1. RECENT ROUNDS STRIP */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs font-mono-numbers no-scrollbar">
        <span className="text-[#94A3B8] text-[11px] uppercase tracking-wider flex items-center gap-1 font-bold pl-1">
          <History className="w-3.5 h-3.5 text-amber-400" />
          Recent:
        </span>
        {recentRounds.map((r, idx) => (
          <span
            key={idx}
            className={`px-2.5 py-1 rounded-lg border font-bold flex items-center gap-1 shrink-0 ${
              r.won
                ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-300'
                : 'bg-rose-950/40 border-rose-500/30 text-rose-300'
            }`}
          >
            {r.won ? (
              <>
                <Gem className="w-3 h-3 text-emerald-400" />
                {r.multiplier.toFixed(2)}x
              </>
            ) : (
              <>
                <Bomb className="w-3 h-3 text-rose-400" />
                0.00x
              </>
            )}
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
                  disabled={gameState === 'playing'}
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
                disabled={gameState === 'playing'}
                className="py-1.5 rounded-lg bg-[#0B0F19] hover:bg-[#151C2B] text-[#94A3B8] hover:text-white border border-[#1F2737] transition-colors cursor-pointer disabled:opacity-50"
              >
                ½
              </button>
              <button
                type="button"
                onClick={doubleBet}
                disabled={gameState === 'playing'}
                className="py-1.5 rounded-lg bg-[#0B0F19] hover:bg-[#151C2B] text-[#94A3B8] hover:text-white border border-[#1F2737] transition-colors cursor-pointer disabled:opacity-50"
              >
                2x
              </button>
              <button
                type="button"
                onClick={setMinBet}
                disabled={gameState === 'playing'}
                className="py-1.5 rounded-lg bg-[#0B0F19] hover:bg-[#151C2B] text-[#94A3B8] hover:text-white border border-[#1F2737] transition-colors cursor-pointer disabled:opacity-50"
              >
                Min
              </button>
              <button
                type="button"
                onClick={setMaxBet}
                disabled={gameState === 'playing'}
                className="py-1.5 rounded-lg bg-[#0B0F19] hover:bg-[#151C2B] text-amber-400 border border-[#1F2737] transition-colors cursor-pointer disabled:opacity-50"
              >
                Max
              </button>
            </div>

            {/* Mine Count Selector */}
            <div>
              <div className="flex items-center justify-between text-xs mb-1.5 font-bold font-mono-numbers">
                <span className="text-[#94A3B8] flex items-center gap-1">
                  <Bomb className="w-3.5 h-3.5 text-rose-400" />
                  Mines Count:
                </span>
                <span className="text-rose-400 font-black">{mineCount} / 24</span>
              </div>
              <div className="grid grid-cols-4 gap-1.5 text-xs font-mono-numbers font-bold">
                {[1, 3, 5, 10].map(cnt => (
                  <button
                    key={cnt}
                    type="button"
                    onClick={() => setMineCount(cnt)}
                    disabled={gameState === 'playing'}
                    className={`py-1.5 rounded-lg border transition-all cursor-pointer disabled:opacity-50 ${
                      mineCount === cnt
                        ? 'bg-rose-500/20 border-rose-500 text-rose-300 font-black'
                        : 'bg-[#0B0F19] hover:bg-[#151C2B] text-[#94A3B8] border-[#1F2737]'
                    }`}
                  >
                    {cnt}
                  </button>
                ))}
              </div>
              <input
                type="range"
                min="1"
                max="24"
                value={mineCount}
                onChange={(e) => setMineCount(parseInt(e.target.value, 10))}
                disabled={gameState === 'playing'}
                className="w-full mt-2 accent-rose-500 h-1.5 bg-[#0B0F19] rounded-lg cursor-pointer disabled:opacity-50"
              />
            </div>

            {/* Odds & Multipliers Card */}
            <div className="bg-[#0B0F19] border border-[#1F2737] rounded-xl p-3 space-y-2 text-xs font-mono-numbers">
              <div className="flex items-center justify-between text-[#94A3B8]">
                <span>Gems Remaining:</span>
                <span className="text-emerald-400 font-bold">
                  {gameState === 'playing' ? (25 - mineCount - uncoveredGems) : (25 - mineCount)}
                </span>
              </div>
              <div className="flex items-center justify-between text-[#94A3B8]">
                <span>Current Multiplier:</span>
                <span className="text-amber-300 font-black text-sm">
                  {uncoveredGems > 0 ? `${currentCalc.multiplier}x` : '1.00x'}
                </span>
              </div>
              <div className="flex items-center justify-between text-[#94A3B8]">
                <span>Next Gem Multiplier:</span>
                <span className="text-emerald-300 font-bold">
                  {nextCalc.multiplier}x (+{nextPayout} FC)
                </span>
              </div>
            </div>

          </div>

          {/* Action Button: Start Game OR Cashout */}
          <div className="pt-2">
            {gameState === 'playing' ? (
              <button
                type="button"
                onClick={handleCashout}
                disabled={uncoveredGems === 0 || loading}
                className={`w-full py-3.5 rounded-xl font-extrabold text-sm flex items-center justify-center gap-2 transition-all shadow-lg cursor-pointer ${
                  uncoveredGems > 0
                    ? 'bg-gradient-to-r from-emerald-500 to-[#05D5AA] text-black shadow-emerald-500/20 hover:scale-[1.02] active:scale-95'
                    : 'bg-[#1F2737] text-[#94A3B8] cursor-not-allowed opacity-60'
                }`}
              >
                <Coins className="w-4 h-4" />
                <span>
                  {uncoveredGems > 0 
                    ? `Cashout ${currentPayout.toLocaleString()} FC` 
                    : 'Select a Tile'}
                </span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleStartGame}
                disabled={loading}
                className="w-full py-3.5 rounded-xl font-extrabold text-sm flex items-center justify-center gap-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black shadow-lg shadow-amber-500/20 hover:scale-[1.02] active:scale-95 transition-all cursor-pointer"
              >
                {loading ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Play className="w-4 h-4 fill-current" />
                    <span>Start Mines Game ({betAmount} FC)</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>

        {/* 5x5 Mines Grid Stage (Right) */}
        <div className="lg:col-span-8 bg-[#07090E] border border-[#1F2737] rounded-2xl p-4 sm:p-6 flex flex-col justify-between items-center relative overflow-hidden min-h-[420px]">
          <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />

          {/* Grid Top Status Banner */}
          <div className="w-full flex items-center justify-between text-xs text-[#94A3B8] font-mono-numbers pb-3 border-b border-[#1F2737]">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
              <span>Grid: <strong className="text-white">5x5 (25 Tiles)</strong></span>
            </div>
            <span>
              Status:{' '}
              <strong className={
                gameState === 'playing' ? 'text-amber-400 uppercase animate-pulse' :
                gameState === 'cashed_out' ? 'text-emerald-400 uppercase font-black' :
                gameState === 'exploded' ? 'text-rose-400 uppercase font-black' : 'text-[#94A3B8] uppercase'
              }>
                {gameState}
              </strong>
            </span>
          </div>

          {/* 5x5 Interactive Tile Grid */}
          <div className="my-auto py-4">
            <div className="grid grid-cols-5 gap-2 sm:gap-3 w-[290px] sm:w-[380px] md:w-[420px]">
              {tiles.map((tile) => {
                const isGem = tile.state === 'gem';
                const isMine = tile.state === 'mine';
                const isExploded = tile.state === 'exploded';
                const isMissedGem = tile.state === 'missed_gem';

                return (
                  <button
                    key={tile.index}
                    type="button"
                    onClick={() => handleTileClick(tile.index)}
                    disabled={gameState !== 'playing' || tile.isRevealed}
                    className={`aspect-square rounded-xl sm:rounded-2xl flex items-center justify-center text-xl sm:text-2xl transition-all duration-300 font-bold select-none cursor-pointer ${
                      // 1. Revealed GEM
                      isGem
                        ? 'bg-gradient-to-br from-emerald-500/30 to-emerald-700/40 border-2 border-emerald-400 text-emerald-300 shadow-[0_0_15px_rgba(34,197,94,0.35)] scale-[1.02]'
                        :
                      // 2. Exploded MINE
                      isExploded
                        ? 'bg-gradient-to-br from-rose-600 to-red-700 border-2 border-rose-400 text-white shadow-[0_0_20px_rgba(239,68,68,0.6)] animate-bounce'
                        :
                      // 3. Other revealed MINES on round end
                      isMine
                        ? 'bg-rose-950/60 border border-rose-500/40 text-rose-400 opacity-90'
                        :
                      // 4. Missed GEM on loss
                      isMissedGem
                        ? 'bg-emerald-950/20 border border-emerald-500/20 text-emerald-500/40'
                        :
                      // 5. UNOPENED TILE
                      gameState === 'playing'
                        ? 'bg-[#151C2B] hover:bg-[#1E293B] border border-[#2A374A] hover:border-amber-500/60 hover:scale-105 active:scale-95 shadow-md'
                        : 'bg-[#111827] border border-[#1F2737] hover:border-[#2A374A] opacity-75'
                    }`}
                  >
                    {isGem ? (
                      <Gem className="w-6 h-6 sm:w-8 sm:h-8 text-emerald-300 animate-in zoom-in-75 fill-emerald-400/20" />
                    ) : isExploded ? (
                      <Bomb className="w-7 h-7 sm:w-9 sm:h-9 text-white animate-in zoom-in fill-white/20" />
                    ) : isMine ? (
                      <Bomb className="w-5 h-5 sm:w-7 sm:h-7 text-rose-400" />
                    ) : isMissedGem ? (
                      <Gem className="w-4 h-4 text-emerald-600/40" />
                    ) : (
                      <span className="w-2.5 h-2.5 rounded-full bg-[#2A374A]/60" />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Result Announcement Overlay Banner */}
            {lastPayout && gameState === 'cashed_out' && (
              <div className="mt-4 bg-emerald-950/80 border border-emerald-500/50 rounded-xl px-4 py-2 text-center text-emerald-300 font-mono-numbers animate-in zoom-in-95">
                <span className="text-xs uppercase tracking-wider block font-bold text-emerald-400">Round Won</span>
                <span className="text-lg font-black">
                  +{lastPayout.payout.toLocaleString()} FC ({lastPayout.multiplier}x)
                </span>
              </div>
            )}

            {gameState === 'exploded' && (
              <div className="mt-4 bg-rose-950/80 border border-rose-500/50 rounded-xl px-4 py-2 text-center text-rose-300 font-mono-numbers animate-in zoom-in-95">
                <span className="text-xs uppercase tracking-wider block font-bold text-rose-400">Mine Exploded!</span>
                <span className="text-sm font-semibold">Stake lost. Select new bet to retry.</span>
              </div>
            )}
          </div>

          {/* Stage Footer: Provably Fair Note */}
          <div className="w-full flex items-center justify-between pt-3 border-t border-[#1F2737] text-[11px] text-[#94A3B8]">
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>Provably Fair: Shuffled via HMAC-SHA256</span>
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

