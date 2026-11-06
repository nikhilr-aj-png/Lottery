import React, { useState } from 'react';
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

export default function BlackjackGame() {
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

  // Round states: 'idle' | 'playing' | 'dealer_turn' | 'resolved'
  const [roundState, setRoundState] = useState('idle');
  const [deck, setDeck] = useState([]);
  const [cardIndex, setCardIndex] = useState(0);
  
  // Hands
  const [playerHand, setPlayerHand] = useState([]);
  const [dealerHand, setDealerHand] = useState([]);
  const [effectiveBet, setEffectiveBet] = useState(betAmount);
  
  // Outcome: 'player_win' | 'dealer_win' | 'push' | 'player_blackjack' | 'player_bust' | 'dealer_bust'
  const [roundResult, setRoundResult] = useState(null);
  const [payoutResult, setPayoutResult] = useState(0);

  // Recent hands history
  const [recentHands, setRecentHands] = useState([
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
        dealerTotal: dTotal
      }
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
    <div className="w-full space-y-4">
      {/* 1. RECENT HANDS STRIP */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs font-mono-numbers no-scrollbar">
        <span className="text-[#94A3B8] text-[11px] uppercase tracking-wider flex items-center gap-1 font-bold pl-1">
          <History className="w-3.5 h-3.5 text-amber-400" />
          Recent:
        </span>
        {recentHands.map((h, idx) => (
          <span
            key={idx}
            className={`px-2.5 py-1 rounded-lg border font-bold flex items-center gap-1.5 shrink-0 ${
              h.multiplier > 1.0
                ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-300'
                : h.multiplier === 1.0
                ? 'bg-amber-950/40 border-amber-500/30 text-amber-300'
                : 'bg-rose-950/40 border-rose-500/30 text-rose-300'
            }`}
          >
            <span>{h.playerTotal} vs {h.dealerTotal}</span>
            <span className="text-[10px] opacity-75">({h.multiplier}x)</span>
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
                  disabled={roundState === 'playing'}
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
                disabled={roundState === 'playing'}
                className="py-1.5 rounded-lg bg-[#0B0F19] hover:bg-[#151C2B] text-[#94A3B8] hover:text-white border border-[#1F2737] transition-colors cursor-pointer disabled:opacity-50"
              >
                ½
              </button>
              <button
                type="button"
                onClick={doubleBet}
                disabled={roundState === 'playing'}
                className="py-1.5 rounded-lg bg-[#0B0F19] hover:bg-[#151C2B] text-[#94A3B8] hover:text-white border border-[#1F2737] transition-colors cursor-pointer disabled:opacity-50"
              >
                2x
              </button>
              <button
                type="button"
                onClick={setMinBet}
                disabled={roundState === 'playing'}
                className="py-1.5 rounded-lg bg-[#0B0F19] hover:bg-[#151C2B] text-[#94A3B8] hover:text-white border border-[#1F2737] transition-colors cursor-pointer disabled:opacity-50"
              >
                Min
              </button>
              <button
                type="button"
                onClick={setMaxBet}
                disabled={roundState === 'playing'}
                className="py-1.5 rounded-lg bg-[#0B0F19] hover:bg-[#151C2B] text-amber-400 border border-[#1F2737] transition-colors cursor-pointer disabled:opacity-50"
              >
                Max
              </button>
            </div>

            {/* Blackjack Payout Rules */}
            <div className="bg-[#0B0F19] border border-[#1F2737] rounded-xl p-3 space-y-2 text-xs font-mono-numbers">
              <div className="flex items-center justify-between text-[#94A3B8]">
                <span>Natural Blackjack:</span>
                <span className="text-amber-300 font-bold">3:2 (2.5x)</span>
              </div>
              <div className="flex items-center justify-between text-[#94A3B8]">
                <span>Standard Win:</span>
                <span className="text-emerald-400 font-bold">1:1 (2.0x)</span>
              </div>
              <div className="flex items-center justify-between text-[#94A3B8]">
                <span>Dealer Rules:</span>
                <span className="text-white font-bold">Stands on 17+</span>
              </div>
            </div>

          </div>

          {/* Action Buttons: Deal OR Hit/Stand */}
          <div className="pt-2 space-y-2">
            {roundState === 'playing' ? (
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={handleHit}
                  className="py-3 rounded-xl font-extrabold text-sm flex items-center justify-center gap-1.5 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-black shadow-lg shadow-emerald-500/20 cursor-pointer"
                >
                  <PlusCircle className="w-4 h-4" />
                  <span>Hit</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleStand()}
                  className="py-3 rounded-xl font-extrabold text-sm flex items-center justify-center gap-1.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black shadow-lg shadow-amber-500/20 cursor-pointer"
                >
                  <Hand className="w-4 h-4" />
                  <span>Stand</span>
                </button>

                {playerHand.length === 2 && (
                  <button
                    type="button"
                    onClick={handleDoubleDown}
                    className="col-span-2 py-2 rounded-xl bg-[#0B0F19] hover:bg-[#151C2B] border border-[#1F2737] text-amber-300 font-mono-numbers font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                  >
                    <Coins className="w-3.5 h-3.5" />
                    Double Down ({effectiveBet * 2} FC)
                  </button>
                )}
              </div>
            ) : (
              <button
                type="button"
                onClick={handleDeal}
                disabled={loading}
                className="w-full py-3.5 rounded-xl font-extrabold text-sm flex items-center justify-center gap-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black shadow-lg shadow-amber-500/20 hover:scale-[1.02] active:scale-95 transition-all cursor-pointer"
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
        </div>

        {/* Blackjack Table Felt Stage (Right) */}
        <div className="lg:col-span-8 bg-[#07090E] border border-[#1F2737] rounded-2xl p-4 sm:p-6 flex flex-col justify-between items-center text-center relative overflow-hidden min-h-[460px]">
          <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />

          {/* Top Status */}
          <div className="w-full flex items-center justify-between text-xs text-[#94A3B8] font-mono-numbers pb-2 border-b border-[#1F2737]">
            <span>Blackjack Table 21</span>
            <span>Stake: <strong className="text-white">{effectiveBet} FC</strong></span>
          </div>

          {/* Blackjack Felt Playing Area */}
          <div className="w-full my-auto py-3 space-y-6">
            
            {/* 1. DEALER HAND AREA */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-center gap-2 text-xs font-mono-numbers text-[#94A3B8]">
                <span>Dealer Hand:</span>
                <span className="font-bold text-white">
                  {roundState === 'playing' 
                    ? `${dealerHand[0]?.value || 0} + ?` 
                    : dealerEval.isBusted ? 'BUSTED (22+)' : dealerEval.total}
                </span>
              </div>

              <div className="flex items-center justify-center gap-2.5">
                {dealerHand.map((c, i) => {
                  const isHoleCard = (i === 1 && roundState === 'playing');
                  return (
                    <div
                      key={i}
                      className={`w-14 h-20 sm:w-16 sm:h-24 rounded-xl border flex flex-col items-center justify-between p-1.5 shadow-xl transition-all duration-300 ${
                        isHoleCard
                          ? 'bg-gradient-to-br from-indigo-950 via-purple-950 to-slate-900 border-purple-500/50'
                          : 'bg-white text-slate-900 border-slate-300'
                      }`}
                    >
                      {isHoleCard ? (
                        <div className="w-full h-full rounded-lg border border-purple-400/30 flex items-center justify-center text-purple-400 font-bold text-xl">
                          🂠
                        </div>
                      ) : (
                        <>
                          <span className={`font-black text-sm self-start leading-none ${c.color === 'red' ? 'text-rose-600' : 'text-slate-900'}`}>
                            {c.rank}
                          </span>
                          <span className={`text-2xl leading-none ${c.color === 'red' ? 'text-rose-600' : 'text-slate-900'}`}>
                            {c.suit}
                          </span>
                          <span className={`font-black text-xs self-end leading-none ${c.color === 'red' ? 'text-rose-600' : 'text-slate-900'}`}>
                            {c.rank}
                          </span>
                        </>
                      )}
                    </div>
                  );
                })}
                {dealerHand.length === 0 && (
                  <div className="text-xs text-[#64748B] italic py-6">Cards will appear here</div>
                )}
              </div>
            </div>

            {/* Divider line */}
            <div className="w-32 h-[1px] bg-amber-500/20 mx-auto" />

            {/* 2. PLAYER HAND AREA */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-center gap-2 text-xs font-mono-numbers text-[#94A3B8]">
                <span>Your Hand:</span>
                <span className={`font-bold ${playerEval.isBlackjack ? 'text-amber-400 text-sm font-black' : playerEval.isBusted ? 'text-rose-400' : 'text-white'}`}>
                  {playerEval.isBlackjack ? 'BLACKJACK! (21)' : playerEval.isBusted ? `BUST (${playerEval.total})` : playerEval.total}
                </span>
              </div>

              <div className="flex items-center justify-center gap-2.5">
                {playerHand.map((c, i) => (
                  <div
                    key={i}
                    className="w-14 h-20 sm:w-16 sm:h-24 rounded-xl bg-white text-slate-900 border border-slate-300 flex flex-col items-center justify-between p-1.5 shadow-xl transition-all duration-300 animate-in zoom-in-75"
                  >
                    <span className={`font-black text-sm self-start leading-none ${c.color === 'red' ? 'text-rose-600' : 'text-slate-900'}`}>
                      {c.rank}
                    </span>
                    <span className={`text-2xl leading-none ${c.color === 'red' ? 'text-rose-600' : 'text-slate-900'}`}>
                      {c.suit}
                    </span>
                    <span className={`font-black text-xs self-end leading-none ${c.color === 'red' ? 'text-rose-600' : 'text-slate-900'}`}>
                      {c.rank}
                    </span>
                  </div>
                ))}
                {playerHand.length === 0 && (
                  <div className="text-xs text-[#64748B] italic py-6">Click Deal Hand to begin</div>
                )}
              </div>
            </div>

            {/* Result Announcement Banner */}
            {roundResult && (
              <div className={`rounded-xl px-4 py-2 text-center font-mono-numbers animate-in zoom-in-95 max-w-sm mx-auto ${
                roundResult.includes('win') || roundResult.includes('blackjack') || roundResult === 'dealer_bust'
                  ? 'bg-emerald-950/80 border border-emerald-500/50 text-emerald-300'
                  : roundResult === 'push'
                  ? 'bg-amber-950/80 border border-amber-500/50 text-amber-300'
                  : 'bg-rose-950/80 border border-rose-500/50 text-rose-300'
              }`}>
                <span className="text-sm font-black uppercase tracking-wider block">
                  {roundResult === 'player_blackjack' ? 'Natural Blackjack!' :
                   roundResult === 'player_win' ? 'You Won!' :
                   roundResult === 'dealer_bust' ? 'Dealer Busted! You Won!' :
                   roundResult === 'push' ? 'Push (Tie)! Stake Returned' :
                   roundResult === 'player_bust' ? 'Busted Over 21' : 'Dealer Won'}
                </span>
                <span className="text-xs font-bold">
                  {payoutResult > 0 ? `+${payoutResult.toLocaleString()} FC` : '0 FC'}
                </span>
              </div>
            )}

          </div>

          {/* Stage Footer: Provably Fair Note */}
          <div className="w-full flex items-center justify-between pt-2 border-t border-[#1F2737] text-[11px] text-[#94A3B8]">
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>Provably Fair: Shuffled 52-Card Deck</span>
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

