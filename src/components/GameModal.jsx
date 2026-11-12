import React, { useState } from 'react';
import { 
  X, 
  ShieldCheck, 
  RefreshCw, 
  Coins, 
  Key, 
  Hash, 
  Info, 
  Play, 
  Sparkles,
  ChevronDown,
  ChevronUp,
  Layers
} from 'lucide-react';
import { useGameEngine } from '../hooks/useGameEngine';
import { useLottery } from '../context/LotteryContext';
import ProvablyFairModal from './ProvablyFairModal';
import { 
  CrashGame, 
  DiceGame, 
  MinesGame, 
  LimboGame,
  CoinflipGame,
  PlinkoGame,
  RouletteGame,
  KenoGame,
  BlackjackGame,
  SlotsGame,
  PokerGame
} from '../games';

export default function GameModal({ gameId, onClose }) {
  const { wallet, claimDailyBonus } = useLottery();
  const {
    game,
    session,
    isPlaying,
    betAmount,
    setBetAmount,
    doubleBet,
    halveBet,
    setMinBet,
    setMaxBet,
    seeds,
    rotateSeeds,
    startRound,
    settleRound,
    resetRound,
    myBets,
    walletBalance,
    loading
  } = useGameEngine(gameId);

  const [showFairnessDrawer, setShowFairnessDrawer] = useState(false);
  const [customClientSeed, setCustomClientSeed] = useState(seeds.clientSeed);
  const [auditRecord, setAuditRecord] = useState(null);

  if (!game) return null;

  const handleRotate = async (e) => {
    e.preventDefault();
    await rotateSeeds(customClientSeed);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div 
        className="w-full max-w-5xl max-h-[95vh] overflow-y-auto rounded-3xl bg-[#0B0F19] border border-[#1F2737] shadow-2xl flex flex-col justify-between relative text-left"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Glow accent */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-[#F5C451] to-transparent" />

        {/* 1. MODAL TOP HEADER */}
        <div className="flex items-center justify-between p-3.5 sm:p-5 border-b border-[#1F2737] bg-[#07090E]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#111827] border border-amber-500/30 flex items-center justify-center overflow-hidden shrink-0 shadow-inner">
              <img 
                src={game.icon || game.image || `/items/${game.id}.jpg`} 
                alt={game.name} 
                className="w-full h-full object-cover"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                  if (e.currentTarget.nextSibling) {
                    e.currentTarget.nextSibling.style.display = 'inline';
                  }
                }}
              />
              <span className="hidden text-xl">
                {game.id === 'crash' ? '🚀' : 
                 game.id === 'dice' ? '🎲' : 
                 game.id === 'mines' ? '💣' : 
                 game.id === 'plinko' ? '🎯' : 
                 game.id === 'roulette' ? '🎡' : 
                 game.id === 'coinflip' ? '🪙' : 
                 game.id === 'blackjack' ? '🃏' : 
                 game.id === 'slots' ? '🎰' : 
                 game.id === 'poker' ? '♠️' : 
                 game.id === 'keno' ? '🎱' : 
                 game.id === 'limbo' ? '⚡' : '🎟️'}
              </span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-display font-black text-base sm:text-lg text-white">
                  {game.name}
                </h2>
                <span className="text-[10px] font-mono-numbers font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20 uppercase">
                  {game.badge || 'PROVABLY FAIR'}
                </span>
              </div>
              <p className="text-[11px] text-[#94A3B8] hidden xs:block">
                RTP: <strong className="text-white">{game.rtp}%</strong> · Max Multiplier: <strong className="text-amber-300">{game.maxMultiplier}x</strong>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Provably Fair Seed Drawer Toggle */}
            <button
              onClick={() => setShowFairnessDrawer(!showFairnessDrawer)}
              className="px-2.5 py-1.5 rounded-xl bg-[#111827] hover:bg-[#151C2B] text-emerald-400 border border-emerald-500/30 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Inspect or customize Provably Fair seeds"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span className="hidden sm:inline">Fairness</span>
            </button>

            {/* Close Button */}
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-xl bg-white/5 hover:bg-white/10 text-[#94A3B8] hover:text-white flex items-center justify-center transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* 2. PROVABLY FAIR SEED DRAWER (Slide-down toggle) */}
        {showFairnessDrawer && (
          <div className="bg-[#111827] border-b border-[#1F2737] p-4 text-xs font-mono-numbers space-y-3 animate-in slide-in-from-top-2 duration-200">
            <div className="flex items-center justify-between text-amber-400 font-bold">
              <span className="flex items-center gap-1.5">
                <Key className="w-3.5 h-3.5" />
                <span>Active Provably Fair Seed Pair</span>
              </span>
              <span className="text-[10px] text-[#94A3B8]">Nonce: #{seeds.nonce}</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[11px]">
              <div>
                <span className="text-[#94A3B8] block mb-1">Pre-Committed Server Seed Hash (SHA-256):</span>
                <input
                  type="text"
                  readOnly
                  value={seeds.serverHash}
                  className="w-full bg-[#0B0F19] border border-[#1F2737] rounded-xl px-3 py-1.5 text-amber-300 select-all outline-none"
                />
              </div>

              <div>
                <span className="text-[#94A3B8] block mb-1">Your Active Client Seed:</span>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={customClientSeed}
                    onChange={(e) => setCustomClientSeed(e.target.value)}
                    className="flex-1 bg-[#0B0F19] border border-[#1F2737] focus:border-amber-500/40 rounded-xl px-3 py-1.5 text-white outline-none"
                  />
                  <button
                    onClick={handleRotate}
                    className="px-3 py-1.5 rounded-xl bg-amber-500 text-black font-extrabold text-[10px] cursor-pointer"
                  >
                    Rotate
                  </button>
                </div>
              </div>
            </div>

            {seeds.previousServerSeed && (
              <div className="pt-2 border-t border-[#1F2737]/60 text-[10px] text-[#94A3B8]">
                <span>Previous Revealed Server Seed: </span>
                <span className="text-purple-300 select-all font-mono">{seeds.previousServerSeed}</span>
              </div>
            )}
          </div>
        )}

        {/* 3. MAIN GAME INTERACTION AREA */}
        <div className="p-4 sm:p-6">
          {game.id === 'crash' ? (
            <CrashGame />
          ) : game.id === 'dice' ? (
            <DiceGame />
          ) : game.id === 'mines' ? (
            <MinesGame />
          ) : game.id === 'limbo' ? (
            <LimboGame />
          ) : game.id === 'coinflip' ? (
            <CoinflipGame />
          ) : game.id === 'plinko' ? (
            <PlinkoGame />
          ) : game.id === 'roulette' ? (
            <RouletteGame />
          ) : game.id === 'keno' ? (
            <KenoGame />
          ) : game.id === 'blackjack' ? (
            <BlackjackGame />
          ) : game.id === 'slots' ? (
            <SlotsGame />
          ) : game.id === 'poker' ? (
            <PokerGame />
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
              
              {/* Bet Controls Sidebar (Left on desktop) */}
              <div className="lg:col-span-4 bg-[#111827] border border-[#1F2737] rounded-2xl p-4 sm:p-5 space-y-4">
                
                {/* Stake Input Header */}
                <div>
                  <div className="flex items-center justify-between text-xs mb-1.5 font-bold font-mono-numbers">
                    <span className="text-[#94A3B8]">Bet Amount:</span>
                    <span className="text-amber-300">
                      Balance: {walletBalance.toLocaleString()} FC
                    </span>
                  </div>

                  <div className="flex items-center bg-[#0B0F19] border border-[#1F2737] focus-within:border-amber-500/50 rounded-xl p-1.5 shadow-inner">
                    <input
                      type="number"
                      min={game.minStakeFC}
                      max={game.maxStakeFC}
                      step="1"
                      value={betAmount}
                      onChange={(e) => setBetAmount(Math.max(game.minStakeFC, parseFloat(e.target.value) || 0))}
                      disabled={isPlaying}
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
                    disabled={isPlaying}
                    className="py-1.5 rounded-lg bg-[#0B0F19] hover:bg-[#151C2B] text-[#94A3B8] hover:text-white border border-[#1F2737] transition-colors cursor-pointer disabled:opacity-50"
                  >
                    ½
                  </button>
                  <button
                    type="button"
                    onClick={doubleBet}
                    disabled={isPlaying}
                    className="py-1.5 rounded-lg bg-[#0B0F19] hover:bg-[#151C2B] text-[#94A3B8] hover:text-white border border-[#1F2737] transition-colors cursor-pointer disabled:opacity-50"
                  >
                    2x
                  </button>
                  <button
                    type="button"
                    onClick={setMinBet}
                    disabled={isPlaying}
                    className="py-1.5 rounded-lg bg-[#0B0F19] hover:bg-[#151C2B] text-[#94A3B8] hover:text-white border border-[#1F2737] transition-colors cursor-pointer disabled:opacity-50"
                  >
                    Min
                  </button>
                  <button
                    type="button"
                    onClick={setMaxBet}
                    disabled={isPlaying}
                    className="py-1.5 rounded-lg bg-[#0B0F19] hover:bg-[#151C2B] text-amber-400 border border-[#1F2737] transition-colors cursor-pointer disabled:opacity-50"
                  >
                    Max
                  </button>
                </div>

                {/* Game Rules / Highlights */}
                <div className="bg-[#0B0F19] p-3 rounded-xl border border-[#1F2737] text-[11px] text-[#94A3B8] space-y-1">
                  <span className="text-amber-400 font-bold font-sans block">Game Instructions:</span>
                  <p className="leading-snug">{game.instructions}</p>
                </div>

                {/* Primary Action Button */}
                <button
                  onClick={async () => {
                    if (isPlaying) {
                      await settleRound({ multiplier: 1.5, payout: betAmount * 1.5, outcomeData: { demo: true } });
                    } else {
                      await startRound();
                    }
                  }}
                  disabled={loading}
                  className={`w-full py-3.5 rounded-xl font-extrabold text-sm flex items-center justify-center gap-2 cursor-pointer transition-all shadow-lg ${
                    isPlaying
                      ? 'bg-gradient-to-r from-emerald-500 to-[#05D5AA] text-black shadow-emerald-500/20'
                      : 'bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black shadow-amber-500/20'
                  }`}
                >
                  {loading ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : isPlaying ? (
                    <>
                      <Coins className="w-4 h-4" />
                      <span>Cashout / Settle</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4 fill-current" />
                      <span>Place Bet ({betAmount} FC)</span>
                    </>
                  )}
                </button>

              </div>

              {/* Interactive Game Stage / Canvas Area (Right on desktop) */}
              <div className="lg:col-span-8 bg-[#07090E] border border-[#1F2737] rounded-2xl p-6 flex flex-col justify-between items-center text-center relative overflow-hidden min-h-[360px]">
                <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />

                {/* Game State Header */}
                <div className="w-full flex items-center justify-between text-xs text-[#94A3B8] font-mono-numbers pb-3 border-b border-[#1F2737]">
                  <span>Round Status: <strong className={isPlaying ? 'text-amber-400 uppercase animate-pulse' : 'text-emerald-400 uppercase'}>{session.status}</strong></span>
                  <span>Stake: <strong className="text-white">{session.betAmount || betAmount} FC</strong></span>
                </div>

                {/* Animated Game Stage Center */}
                <div className="my-auto py-8 space-y-4">
                  <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-3xl bg-[#111827] border-2 border-amber-500/40 flex items-center justify-center text-5xl sm:text-6xl mx-auto shadow-[0_0_30px_rgba(245,196,81,0.2)]">
                    {game.id === 'plinko' ? '🎯' : 
                     game.id === 'roulette' ? '🎡' : 
                     game.id === 'coinflip' ? '🪙' : 
                     game.id === 'blackjack' ? '🃏' : 
                     game.id === 'slots' ? '🎰' : 
                     game.id === 'poker' ? '♠️' : 
                     game.id === 'keno' ? '🎱' : '🎟️'}
                  </div>

                  <div>
                    <h3 className="font-display font-black text-xl sm:text-2xl text-white">
                      {game.name}
                    </h3>
                    <p className="text-xs text-[#94A3B8] max-w-sm mx-auto mt-1">
                      {isPlaying ? 'Round active! Outcome will be derived authoritatively from HMAC-SHA256.' : 'Click "Place Bet" to launch round with server-authoritative provably fair seeds.'}
                    </p>
                  </div>

                  {session.status === 'won' && (
                    <div className="bg-emerald-950/60 border border-emerald-500/40 px-4 py-2 rounded-xl text-emerald-300 font-mono-numbers font-black text-lg animate-in zoom-in-95">
                      Won +{session.payout} Flow Coins ({session.multiplier}x)!
                    </div>
                  )}
                </div>

                {/* Stage Footer: Multiplier & Quick info */}
                <div className="w-full flex items-center justify-between pt-3 border-t border-[#1F2737] text-[11px] text-[#94A3B8]">
                  <span>Provably Fair Seed Hash Committed</span>
                  <span className="text-amber-400 font-bold font-mono-numbers">{game.houseEdge}% House Edge</span>
                </div>

              </div>

            </div>
          )}
        </div>

        {/* 4. RECENT BETS FOR THIS GAME */}
        <div className="p-4 sm:p-5 bg-[#07090E] border-t border-[#1F2737]">
          <div className="flex items-center justify-between text-xs font-bold text-white mb-2">
            <span>Recent {game.name} Bets</span>
            <span className="text-[10px] text-[#94A3B8] font-mono-numbers">Immutable Public Log</span>
          </div>

          <div className="overflow-x-auto no-scrollbar">
            <table className="w-full text-left text-xs font-mono-numbers">
              <thead className="text-[10px] text-[#94A3B8] uppercase border-b border-[#1F2737]">
                <tr>
                  <th className="py-2 px-2">Round</th>
                  <th className="py-2 px-2">Bet</th>
                  <th className="py-2 px-2">Multiplier</th>
                  <th className="py-2 px-2">Payout</th>
                  <th className="py-2 px-2 text-right">Audit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1F2737]/60">
                {myBets.slice(0, 5).map((b) => (
                  <tr key={b.id} className="hover:bg-white/2">
                    <td className="py-2 px-2 text-amber-300 font-bold">{b.id.slice(-8)}</td>
                    <td className="py-2 px-2 text-white">{b.betAmount} FC</td>
                    <td className="py-2 px-2 text-blue-300">{b.multiplier ? `${b.multiplier}x` : '—'}</td>
                    <td className={`py-2 px-2 font-black ${b.payout > 0 ? 'text-emerald-400' : 'text-[#64748B]'}`}>
                      {b.payout > 0 ? `+${b.payout} FC` : '0 FC'}
                    </td>
                    <td className="py-2 px-2 text-right">
                      <button
                        onClick={() => setAuditRecord({
                          event_id: b.id,
                          event_title: `${game.name} #${b.id.slice(-6)}`,
                          winning_digits: b.multiplier ? `${b.multiplier}x` : '0x',
                          commit_hash: b.serverSeedHash,
                          revealed_seed: b.serverSeed,
                          client_seed: b.clientSeed
                        })}
                        className="text-emerald-400 hover:text-emerald-300 text-[10px] underline cursor-pointer"
                      >
                        Verify
                      </button>
                    </td>
                  </tr>
                ))}
                {myBets.length === 0 && (
                  <tr>
                    <td colSpan="5" className="py-4 text-center text-[11px] text-[#94A3B8] italic">
                      No bets placed yet on {game.name}.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>

      {/* Provably Fair Modal for Round Verification */}
      {auditRecord && (
        <ProvablyFairModal
          isOpen={!!auditRecord}
          onClose={() => setAuditRecord(null)}
          auditData={auditRecord}
        />
      )}
    </div>
  );
}

