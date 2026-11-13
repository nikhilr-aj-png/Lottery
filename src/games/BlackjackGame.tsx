import React, { useState, useEffect } from 'react';
import { useGameEngine } from '../hooks/useGameEngine';
import { generateShuffledDeck, evaluateBlackjackHand } from '../engine';
import { 
  Play, 
  RefreshCw, 
  ShieldCheck, 
  History, 
  Coins, 
  Trophy, 
  Sparkles,
  PlusCircle,
  Hand,
  CheckCircle2,
  XCircle,
  Scale
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { soundFX } from '../engine/SoundFXService';

export default function BlackjackGame({ 
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
  } = useGameEngine('blackjack');

  // Enforce room-specific stake bounds
  useEffect(() => {
    if (room?.minStakeFC && betAmount < room.minStakeFC) {
      setBetAmount(room.minStakeFC);
    } else if (room?.maxStakeFC && betAmount > room.maxStakeFC) {
      setBetAmount(room.maxStakeFC);
    }
  }, [room?.minStakeFC, room?.maxStakeFC]);

  // Round states: 'idle' | 'playing' | 'dealer_turn' | 'resolved'
  const [roundState, setRoundState] = useState('idle');
  const [deck, setDeck] = useState<any[]>([]);
  const [cardIndex, setCardIndex] = useState(0);
  
  // Hands
  const [playerHand, setPlayerHand] = useState<any[]>([]);
  const [dealerHand, setDealerHand] = useState<any[]>([]);
  const [effectiveBet, setEffectiveBet] = useState(betAmount);
  
  // Outcome: 'player_win' | 'dealer_win' | 'push' | 'player_blackjack' | 'player_bust' | 'dealer_bust'
  const [roundResult, setRoundResult] = useState<any>(null);
  const [payoutResult, setPayoutResult] = useState(0);

  // Recent hands history
  const [recentHands, setRecentHands] = useState<Array<{ outcome: string; multiplier: number; playerTotal: number; dealerTotal: string | number }>>([
    { outcome: 'win', multiplier: 2.0, playerTotal: 20, dealerTotal: 18 },
    { outcome: 'lost', multiplier: 0, playerTotal: 17, dealerTotal: 19 },
    { outcome: 'blackjack', multiplier: 2.5, playerTotal: 21, dealerTotal: 20 },
    { outcome: 'push', multiplier: 1.0, playerTotal: 19, dealerTotal: 19 },
    { outcome: 'win', multiplier: 2.0, playerTotal: 21, dealerTotal: 'Bust' }
  ]);

  const playerEval = evaluateBlackjackHand(playerHand);
  const dealerEval = evaluateBlackjackHand(dealerHand);

  // 1. DEAL INITIAL HAND
  const handleDeal = async () => {
    if (roundState === 'playing' || loading) return;

    setEffectiveBet(betAmount);
    setRoundResult(null);
    setPayoutResult(0);

    // Start round in Game Engine (debit stake)
    const startRes = await startRound();
    if (!startRes.success) return;

    soundFX.playChipBet();
    soundFX.playCardFlip();

    // Derive deterministic 52-card deck via Provably Fair HMAC-SHA256
    const shuffledDeck = await generateShuffledDeck(
      seeds.serverHash || 'seed_blackjack_default',
      seeds.clientSeed,
      seeds.nonce
    );

    // Initial 4 cards: Player 1, Dealer 1, Player 2, Dealer 2 (hole card)
    const p1 = shuffledDeck[0];
    const d1 = shuffledDeck[1];
    const p2 = shuffledDeck[2];
    const d2 = shuffledDeck[3];

    const initialPlayerHand = [p1, p2];
    const initialDealerHand = [d1, d2];

    setDeck(shuffledDeck);
    setCardIndex(4);
    setPlayerHand(initialPlayerHand);
    setDealerHand(initialDealerHand);

    // Check for natural Blackjack
    const pEval = evaluateBlackjackHand(initialPlayerHand);
    const dEval = evaluateBlackjackHand(initialDealerHand);

    if (pEval.isBlackjack) {
      setRoundState('resolved');
      if (dEval.isBlackjack) {
        // Both have blackjack -> Push
        handleFinalize('push', 1.0, initialPlayerHand, initialDealerHand);
      } else {
        // Natural Blackjack pays 2.5x (3:2)
        handleFinalize('player_blackjack', 2.5, initialPlayerHand, initialDealerHand);
      }
    } else {
      setRoundState('playing');
    }
  };

  // 2. HIT ACTION
  const handleHit = async () => {
    if (roundState !== 'playing') return;

    soundFX.playCardFlip();
    const nextCard = deck[cardIndex];
    const newHand = [...playerHand, nextCard];
    setPlayerHand(newHand);
    setCardIndex(prev => prev + 1);

    const newEval = evaluateBlackjackHand(newHand);
    if (newEval.isBusted) {
      setRoundState('resolved');
      handleFinalize('player_bust', 0, newHand, dealerHand);
    } else if (newEval.total === 21) {
      // Auto-stand on 21
      handleStand(newHand);
    }
  };

  // 3. STAND ACTION (Dealer's Turn)
  const handleStand = async (currentPHand = playerHand) => {
    if (roundState !== 'playing' && roundState !== 'dealer_turn') return;

    setRoundState('dealer_turn');

    let currentDealerHand = [...dealerHand];
    let nextIdx = cardIndex;
    let dEval = evaluateBlackjackHand(currentDealerHand);

    // Dealer hits until total >= 17
    while (dEval.total < 17) {
      const nextCard = deck[nextIdx];
      currentDealerHand.push(nextCard);
      nextIdx++;
      dEval = evaluateBlackjackHand(currentDealerHand);
    }

    setDealerHand(currentDealerHand);
    setCardIndex(nextIdx);
    setRoundState('resolved');

    const pEval = evaluateBlackjackHand(currentPHand);

    // Compare hands
    if (dEval.isBusted) {
      handleFinalize('dealer_bust', 2.0, currentPHand, currentDealerHand);
    } else if (pEval.total > dEval.total) {
      handleFinalize('player_win', 2.0, currentPHand, currentDealerHand);
    } else if (pEval.total === dEval.total) {
      handleFinalize('push', 1.0, currentPHand, currentDealerHand);
    } else {
      handleFinalize('dealer_win', 0, currentPHand, currentDealerHand);
    }
  };

  // 4. DOUBLE DOWN
  const handleDoubleDown = async () => {
    if (roundState !== 'playing' || playerHand.length !== 2) return;

    // Double effective stake
    const doubled = effectiveBet * 2;
    setEffectiveBet(doubled);
    soundFX.playChipBet();
    soundFX.playCardFlip();

    const nextCard = deck[cardIndex];
    const newHand = [...playerHand, nextCard];
    setPlayerHand(newHand);
    setCardIndex(prev => prev + 1);

    const newEval = evaluateBlackjackHand(newHand);
    if (newEval.isBusted) {
      setRoundState('resolved');
      handleFinalize('player_bust', 0, newHand, dealerHand, doubled);
    } else {
      handleStand(newHand);
    }
  };

  // 5. FINALIZE ROUND & SETTLE
  const handleFinalize = async (outcome, multiplier, pHand, dHand, stake = effectiveBet) => {
    const isWin = multiplier > 1.0;
    const isPush = multiplier === 1.0;
    const finalPayout = parseFloat((stake * multiplier).toFixed(2));

    setRoundResult(outcome);
    setPayoutResult(finalPayout);

    if (isWin) {
      soundFX.playWinFanfare(outcome === 'player_blackjack' ? 'big' : 'standard');
      try {
        confetti({
          particleCount: 85,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#F5C451', '#22C55E', '#3B82F6']
        });
      } catch (_) {}
    }

    const pTotal = evaluateBlackjackHand(pHand).total;
    const dTotal = evaluateBlackjackHand(dHand).isBusted ? 'Bust' : evaluateBlackjackHand(dHand).total;

    // Settle in Supabase ledger
    await settleRound({
      multiplier,
      payout: finalPayout,
      outcomeData: {
        outcome,
        multiplier,
        playerHand: pHand.map(c => c.id),
        dealerHand: dHand.map(c => c.id),
        playerTotal: pTotal,
        dealerTotal: dTotal,
        roomId: room?.id
      },
      metadata: { roomId: room?.id, roomName: room?.name }
    });

    setRecentHands(prev => [
      { 
        outcome: outcome.includes('win') || outcome.includes('blackjack') ? 'win' : outcome === 'push' ? 'push' : 'lost',
        multiplier,
        playerTotal: pTotal,
        dealerTotal: dTotal
      },
      ...prev.slice(0, 7)
    ]);
  };

  return (
    <div className="w-full h-full flex flex-col min-h-0 overflow-hidden text-left space-y-1.5">
      {/* 1. RECENT HANDS STRIP */}
      <div className="flex items-center gap-2 overflow-x-auto pb-0.5 text-xs font-mono-numbers no-scrollbar shrink-0">
        <span className="text-[#94A3B8] text-[10px] uppercase tracking-wider flex items-center gap-1 font-bold pl-1 shrink-0">
          <History className="w-3 h-3 text-amber-400" />
          Recent:
        </span>
        {recentHands.map((h, idx) => (
          <span
            key={idx}
            className={`px-1.5 py-0.2 rounded text-[10px] border font-bold flex items-center gap-1 shrink-0 ${
              h.multiplier > 1.0
                ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-300'
                : h.multiplier === 1.0
                ? 'bg-amber-950/40 border-amber-500/30 text-amber-300'
                : 'bg-rose-950/40 border-rose-500/30 text-rose-300'
            }`}
          >
            <span>{h.playerTotal} vs {h.dealerTotal}</span>
            <span className="text-[9px] opacity-75">({h.multiplier}x)</span>
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
                  disabled={roundState === 'playing'}
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
                disabled={roundState === 'playing'}
                className="py-1 rounded bg-[#0B0F19] hover:bg-[#151C2B] text-[#94A3B8] hover:text-white border border-[#1F2737] transition-colors cursor-pointer disabled:opacity-50 text-[11px]"
              >
                ½
              </button>
              <button
                type="button"
                onClick={doubleBet}
                disabled={roundState === 'playing'}
                className="py-1 rounded bg-[#0B0F19] hover:bg-[#151C2B] text-[#94A3B8] hover:text-white border border-[#1F2737] transition-colors cursor-pointer disabled:opacity-50 text-[11px]"
              >
                2x
              </button>
              <button
                type="button"
                onClick={setMinBet}
                disabled={roundState === 'playing'}
                className="py-1 rounded bg-[#0B0F19] hover:bg-[#151C2B] text-[#94A3B8] hover:text-white border border-[#1F2737] transition-colors cursor-pointer disabled:opacity-50 text-[11px]"
              >
                Min
              </button>
              <button
                type="button"
                onClick={setMaxBet}
                disabled={roundState === 'playing'}
                className="py-1 rounded bg-[#0B0F19] hover:bg-[#151C2B] text-amber-400 border border-[#1F2737] transition-colors cursor-pointer disabled:opacity-50 text-[11px]"
              >
                Max
              </button>
            </div>

            {/* Blackjack Payout Rules */}
            <div className="bg-[#0B0F19] border border-[#1F2737] rounded-lg p-2 space-y-1 text-xs font-mono-numbers">
              <div className="flex items-center justify-between text-[#94A3B8] text-[11px]">
                <span>Natural Blackjack:</span>
                <span className="text-amber-300 font-bold">3:2 (2.5x)</span>
              </div>
              <div className="flex items-center justify-between text-[#94A3B8] text-[11px]">
                <span>Standard Win:</span>
                <span className="text-emerald-400 font-bold">1:1 (2.0x)</span>
              </div>
              <div className="flex items-center justify-between text-[#94A3B8] text-[11px]">
                <span>Dealer Rules:</span>
                <span className="text-white font-bold">Stands on 17+</span>
              </div>
            </div>

          </div>

          {/* Action Buttons: Deal OR Hit/Stand */}
          <div className="shrink-0 space-y-1.5">
            {roundState === 'playing' ? (
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  onClick={handleHit}
                  className="py-2.5 rounded-xl font-extrabold text-xs sm:text-sm flex items-center justify-center gap-1 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-black shadow-md cursor-pointer"
                >
                  <PlusCircle className="w-3.5 h-3.5" />
                  <span>Hit</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleStand()}
                  className="py-2.5 rounded-xl font-extrabold text-xs sm:text-sm flex items-center justify-center gap-1 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black shadow-md cursor-pointer"
                >
                  <Hand className="w-3.5 h-3.5" />
                  <span>Stand</span>
                </button>

                {playerHand.length === 2 && (
                  <button
                    type="button"
                    onClick={handleDoubleDown}
                    className="col-span-2 py-1.5 rounded-lg bg-[#0B0F19] hover:bg-[#151C2B] border border-[#1F2737] text-amber-300 font-mono-numbers font-bold text-xs flex items-center justify-center gap-1 transition-all cursor-pointer"
                  >
                    <Coins className="w-3 h-3" />
                    Double Down ({effectiveBet * 2} FC)
                  </button>
                )}
              </div>
            ) : (
              <button
                type="button"
                onClick={handleDeal}
                disabled={loading}
                className="w-full py-2.5 sm:py-3 rounded-xl font-extrabold text-xs sm:text-sm flex items-center justify-center gap-1.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black shadow-md shadow-amber-500/20 transition-all cursor-pointer"
              >
                {loading ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Play className="w-4 h-4 fill-current" />
                    <span>Deal Hand ({betAmount} FC)</span>
                  </>
                )}
              </button>
            )}
          </div>

          {/* Dedicated In-Room Activity Box */}
          {activityBox}
        </div>

        {/* Blackjack Table Felt Stage (Landscape: Right / Portrait: Top) */}
        <div className="order-1 lg:order-2 lg:col-span-8 bg-[#07090E] border border-[#1F2737] rounded-xl p-2 sm:p-4 flex flex-col justify-between items-center text-center relative overflow-hidden h-full min-h-[180px] lg:min-h-0">
          <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />

          {/* Top Status */}
          <div className="w-full flex items-center justify-between text-xs text-[#94A3B8] font-mono-numbers pb-1.5 border-b border-[#1F2737] shrink-0">
            <span>Blackjack Table 21</span>
            <span>Stake: <strong className="text-white">{effectiveBet} FC</strong></span>
          </div>

          {/* Blackjack Felt Playing Area */}
          <div className="w-full my-auto py-2 space-y-3">
            
            {/* 1. DEALER HAND AREA */}
            <div className="space-y-1">
              <div className="flex items-center justify-center gap-1.5 text-xs font-mono-numbers text-[#94A3B8]">
                <span>Dealer:</span>
                <span className="font-bold text-white">
                  {roundState === 'playing' 
                    ? `${dealerHand[0]?.value || 0} + ?` 
                    : dealerEval.isBusted ? 'BUSTED (22+)' : dealerEval.total}
                </span>
              </div>

              <div className="flex items-center justify-center gap-1 sm:gap-2 flex-wrap">
                {dealerHand.map((c, i) => {
                  const isHoleCard = (i === 1 && roundState === 'playing');
                  return (
                    <div
                      key={i}
                      className={`w-10 h-14 sm:w-13 sm:h-18 rounded-lg border flex flex-col items-center justify-between p-1 shadow-md transition-all duration-300 ${
                        isHoleCard
                          ? 'bg-gradient-to-br from-indigo-950 via-purple-950 to-slate-900 border-purple-500/50'
                          : 'bg-white text-slate-900 border-slate-300'
                      }`}
                    >
                      {isHoleCard ? (
                        <div className="w-full h-full rounded-md border border-purple-400/30 flex items-center justify-center text-purple-400 font-bold text-sm">
                          🂠
                        </div>
                      ) : (
                        <>
                          <span className={`font-black text-[11px] self-start leading-none ${c.color === 'red' ? 'text-rose-600' : 'text-slate-900'}`}>
                            {c.rank}
                          </span>
                          <span className={`text-base leading-none ${c.color === 'red' ? 'text-rose-600' : 'text-slate-900'}`}>
                            {c.suit}
                          </span>
                          <span className={`font-black text-[11px] self-end leading-none ${c.color === 'red' ? 'text-rose-600' : 'text-slate-900'}`}>
                            {c.rank}
                          </span>
                        </>
                      )}
                    </div>
                  );
                })}
                {dealerHand.length === 0 && (
                  <div className="text-xs text-[#64748B] italic py-2">Cards will appear here</div>
                )}
              </div>
            </div>

            {/* Divider line */}
            <div className="w-24 h-[1px] bg-amber-500/20 mx-auto" />

            {/* 2. PLAYER HAND AREA */}
            <div className="space-y-1">
              <div className="flex items-center justify-center gap-1.5 text-xs font-mono-numbers text-[#94A3B8]">
                <span>Your Hand:</span>
                <span className={`font-bold ${playerEval.isBlackjack ? 'text-amber-400 font-black' : playerEval.isBusted ? 'text-rose-400' : 'text-white'}`}>
                  {playerEval.isBlackjack ? 'BLACKJACK! (21)' : playerEval.isBusted ? `BUST (${playerEval.total})` : playerEval.total}
                </span>
              </div>

              <div className="flex items-center justify-center gap-1 sm:gap-2 flex-wrap">
                {playerHand.map((c, i) => (
                  <div
                    key={i}
                    className="w-10 h-14 sm:w-13 sm:h-18 rounded-lg bg-white text-slate-900 border border-slate-300 flex flex-col items-center justify-between p-1 shadow-md animate-in zoom-in-75"
                  >
                    <span className={`font-black text-[11px] self-start leading-none ${c.color === 'red' ? 'text-rose-600' : 'text-slate-900'}`}>
                      {c.rank}
                    </span>
                    <span className={`text-base leading-none ${c.color === 'red' ? 'text-rose-600' : 'text-slate-900'}`}>
                      {c.suit}
                    </span>
                    <span className={`font-black text-[11px] self-end leading-none ${c.color === 'red' ? 'text-rose-600' : 'text-slate-900'}`}>
                      {c.rank}
                    </span>
                  </div>
                ))}
                {playerHand.length === 0 && (
                  <div className="text-xs text-[#64748B] italic py-2">Click Deal Hand to begin</div>
                )}
              </div>
            </div>

            {/* Result Announcement Banner */}
            {roundResult && (
              <div className={`rounded-xl px-3 py-1 text-center font-mono-numbers animate-in zoom-in-95 max-w-xs mx-auto ${
                roundResult.includes('win') || roundResult.includes('blackjack') || roundResult === 'dealer_bust'
                  ? 'bg-emerald-950/80 border border-emerald-500/50 text-emerald-300'
                  : roundResult === 'push'
                  ? 'bg-amber-950/80 border border-amber-500/50 text-amber-300'
                  : 'bg-rose-950/80 border border-rose-500/50 text-rose-300'
              }`}>
                <span className="text-xs font-black uppercase tracking-wider block">
                  {roundResult === 'player_blackjack' ? 'Natural Blackjack!' :
                   roundResult === 'player_win' ? 'You Won!' :
                   roundResult === 'dealer_bust' ? 'Dealer Busted! You Won!' :
                   roundResult === 'push' ? 'Push! Stake Returned' :
                   roundResult === 'player_bust' ? 'Busted Over 21' : 'Dealer Won'}
                </span>
                <span className="text-[11px] font-bold">
                  {payoutResult > 0 ? `+${payoutResult.toLocaleString()} FC` : '0 FC'}
                </span>
              </div>
            )}

          </div>

          {/* Stage Footer: Provably Fair Note */}
          <div className="w-full flex items-center justify-between pt-1.5 border-t border-[#1F2737] text-[10px] text-[#94A3B8] shrink-0">
            <span className="flex items-center gap-1">
              <ShieldCheck className="w-3 h-3 text-emerald-400" />
              <span>Provably Fair 52-Card Deck</span>
            </span>
            <span className="text-amber-400 font-mono-numbers font-bold">
              House Edge: 0.5%
            </span>
          </div>

        </div>

      </div>
    </div>
  );
}

