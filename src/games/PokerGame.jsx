import React, { useState, useEffect } from 'react';
import { useGameEngine } from '../hooks/useGameEngine';
import { generateShuffledDeck, evaluatePokerHand } from '../engine';
import { 
  Play, 
  RefreshCw, 
  ShieldCheck, 
  History, 
  Coins, 
  Trophy, 
  Sparkles,
  ChevronRight,
  Eye,
  Hand,
  CheckCircle2,
  XCircle,
  AlertCircle
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { soundFX } from '../engine/SoundFXService';

export default function PokerGame({ room }) {
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
  } = useGameEngine('poker');

  // Enforce room-specific stake bounds
  useEffect(() => {
    if (room?.minStakeFC && betAmount < room.minStakeFC) {
      setBetAmount(room.minStakeFC);
    } else if (room?.maxStakeFC && betAmount > room.maxStakeFC) {
      setBetAmount(room.maxStakeFC);
    }
  }, [room?.minStakeFC, room?.maxStakeFC]);

  // Stages: 'idle' | 'preflop' | 'flop' | 'turn' | 'river' | 'showdown'
  const [street, setStreet] = useState('idle');
  const [deck, setDeck] = useState([]);
  
  // Cards
  const [playerHoleCards, setPlayerHoleCards] = useState([]);
  const [dealerHoleCards, setDealerHoleCards] = useState([]);
  const [communityCards, setCommunityCards] = useState([]);
  const [pot, setPot] = useState(betAmount);
  
  // Hand Evaluations
  const [playerRank, setPlayerRank] = useState(null);
  const [dealerRank, setDealerRank] = useState(null);
  const [pokerResult, setPokerResult] = useState(null); // 'player_won' | 'dealer_won' | 'push' | 'folded'

  // Recent hands history
  const [recentHands, setRecentHands] = useState([
    { result: 'win', rank: 'Two Pair', multiplier: 2.0 },
    { result: 'lost', rank: 'High Card', multiplier: 0 },
    { result: 'win', rank: 'Three of a Kind', multiplier: 2.5 },
    { result: 'win', rank: 'Flush', multiplier: 3.5 },
    { result: 'lost', rank: 'One Pair', multiplier: 0 }
  ]);

  // 1. DEAL NEW TEXAS HOLD'EM HAND
  const handleDeal = async () => {
    if (street !== 'idle' && street !== 'showdown') return;

    setPot(betAmount * 2);
    setPokerResult(null);
    setPlayerRank(null);
    setDealerRank(null);

    // Start round in game engine (debit stake)
    const startRes = await startRound();
    if (!startRes.success) return;

    soundFX.playChipBet();
    soundFX.playCardFlip();

    // Derive deterministic 52-card deck
    const shuffledDeck = await generateShuffledDeck(
      seeds.serverHash || 'seed_poker_default',
      seeds.clientSeed,
      seeds.nonce
    );

    // Deal: 2 to player, 2 to dealer, 5 for board (Total 9 cards needed)
    const pHole = [shuffledDeck[0], shuffledDeck[1]];
    const dHole = [shuffledDeck[2], shuffledDeck[3]];
    const board = [shuffledDeck[4], shuffledDeck[5], shuffledDeck[6], shuffledDeck[7], shuffledDeck[8]];

    setDeck(shuffledDeck);
    setPlayerHoleCards(pHole);
    setDealerHoleCards(dHole);
    setCommunityCards([]);
    setStreet('preflop');

    // Preflop rank
    const currentEval = evaluatePokerHand(pHole);
    setPlayerRank(currentEval);
  };

  // 2. ADVANCE STREET (Check / Call action)
  const handleNextStreet = async () => {
    soundFX.playCardFlip();
    if (street === 'preflop') {
      // Deal Flop (First 3 community cards)
      const flop = [deck[4], deck[5], deck[6]];
      setCommunityCards(flop);
      setStreet('flop');
      setPlayerRank(evaluatePokerHand([...playerHoleCards, ...flop]));
    } else if (street === 'flop') {
      // Deal Turn (4th community card)
      const turn = [deck[4], deck[5], deck[6], deck[7]];
      setCommunityCards(turn);
      setStreet('turn');
      setPlayerRank(evaluatePokerHand([...playerHoleCards, ...turn]));
    } else if (street === 'turn') {
      // Deal River (5th community card)
      const river = [deck[4], deck[5], deck[6], deck[7], deck[8]];
      setCommunityCards(river);
      setStreet('river');
      setPlayerRank(evaluatePokerHand([...playerHoleCards, ...river]));
    } else if (street === 'river') {
      // Showdown!
      handleShowdown();
    }
  };

  // Raise Action (Adds betAmount to pot and advances street)
  const handleRaise = () => {
    if (street === 'idle' || street === 'showdown') return;
    soundFX.playChipBet();
    setPot(prev => prev + betAmount);
    handleNextStreet();
  };

  // 3. FOLD
  const handleFold = async () => {
    if (street === 'idle' || street === 'showdown') return;
    setStreet('showdown');
    setPokerResult('folded');

    await settleRound({
      multiplier: 0,
      payout: 0,
      outcomeData: { action: 'folded', playerHand: playerHoleCards.map(c => c.id), roomId: room?.id },
      metadata: { roomId: room?.id, roomName: room?.name }
    });

    setRecentHands(prev => [
      { result: 'lost', rank: 'Folded', multiplier: 0 },
      ...prev.slice(0, 7)
    ]);
  };

  // 4. SHOWDOWN & WINNER DETERMINATION
  const handleShowdown = async () => {
    setStreet('showdown');

    const fullBoard = [deck[4], deck[5], deck[6], deck[7], deck[8]];
    const finalPlayerEval = evaluatePokerHand([...playerHoleCards, ...fullBoard]);
    const finalDealerEval = evaluatePokerHand([...dealerHoleCards, ...fullBoard]);

    setPlayerRank(finalPlayerEval);
    setDealerRank(finalDealerEval);

    let winner = 'player_won';
    let multiplier = 2.0;

    // Bonus multipliers for monster hands
    if (finalPlayerEval.score >= 8) multiplier = 10.0; // Quads or better
    else if (finalPlayerEval.score >= 6) multiplier = 4.0; // Full house or Flush
    else if (finalPlayerEval.score >= 4) multiplier = 2.5; // Straight or Trips

    if (finalPlayerEval.score > finalDealerEval.score) {
      winner = 'player_won';
    } else if (finalPlayerEval.score < finalDealerEval.score) {
      winner = 'dealer_won';
      multiplier = 0;
    } else {
      winner = 'push';
      multiplier = 1.0;
    }

    setPokerResult(winner);
    const finalPayout = parseFloat((betAmount * multiplier).toFixed(2));

    if (winner === 'player_won') {
      soundFX.playWinFanfare(multiplier >= 4 ? 'big' : 'standard');
      try {
        confetti({
          particleCount: 90,
          spread: 80,
          origin: { y: 0.6 },
          colors: ['#F5C451', '#22C55E', '#A855F7']
        });
      } catch (_) {}
    }

    // Settle in Supabase ledger
    await settleRound({
      multiplier,
      payout: finalPayout,
      outcomeData: {
        winner,
        playerRank: finalPlayerEval.rankName,
        dealerRank: finalDealerEval.rankName,
        multiplier,
        roomId: room?.id
      },
      metadata: { roomId: room?.id, roomName: room?.name }
    });

    setRecentHands(prev => [
      { 
        result: winner === 'player_won' ? 'win' : winner === 'push' ? 'push' : 'lost',
        rank: finalPlayerEval.rankName,
        multiplier 
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
            className={`px-2.5 py-1 rounded-lg border font-bold flex items-center gap-1 shrink-0 ${
              h.result === 'win'
                ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-300'
                : h.result === 'push'
                ? 'bg-amber-950/40 border-amber-500/30 text-amber-300'
                : 'bg-rose-950/40 border-rose-500/30 text-rose-300'
            }`}
          >
            <span>{h.rank}</span>
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
                  disabled={street !== 'idle' && street !== 'showdown'}
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
                disabled={street !== 'idle' && street !== 'showdown'}
                className="py-1.5 rounded-lg bg-[#0B0F19] hover:bg-[#151C2B] text-[#94A3B8] hover:text-white border border-[#1F2737] transition-colors cursor-pointer disabled:opacity-50"
              >
                ½
              </button>
              <button
                type="button"
                onClick={doubleBet}
                disabled={street !== 'idle' && street !== 'showdown'}
                className="py-1.5 rounded-lg bg-[#0B0F19] hover:bg-[#151C2B] text-[#94A3B8] hover:text-white border border-[#1F2737] transition-colors cursor-pointer disabled:opacity-50"
              >
                2x
              </button>
              <button
                type="button"
                onClick={setMinBet}
                disabled={street !== 'idle' && street !== 'showdown'}
                className="py-1.5 rounded-lg bg-[#0B0F19] hover:bg-[#151C2B] text-[#94A3B8] hover:text-white border border-[#1F2737] transition-colors cursor-pointer disabled:opacity-50"
              >
                Min
              </button>
              <button
                type="button"
                onClick={setMaxBet}
                disabled={street !== 'idle' && street !== 'showdown'}
                className="py-1.5 rounded-lg bg-[#0B0F19] hover:bg-[#151C2B] text-amber-400 border border-[#1F2737] transition-colors cursor-pointer disabled:opacity-50"
              >
                Max
              </button>
            </div>

            {/* Street Progression Indicator */}
            <div className="bg-[#0B0F19] border border-[#1F2737] rounded-xl p-3 space-y-2 text-xs font-mono-numbers">
              <span className="text-[10px] text-[#94A3B8] uppercase tracking-wider block font-bold border-b border-[#1F2737] pb-1">
                Hand Progression:
              </span>
              <div className="flex items-center justify-between text-[11px] font-bold">
                {['preflop', 'flop', 'turn', 'river', 'showdown'].map((st, i) => (
                  <span
                    key={st}
                    className={`capitalize ${
                      street === st
                        ? 'text-amber-400 font-black underline'
                        : 'text-[#64748B]'
                    }`}
                  >
                    {st}
                  </span>
                ))}
              </div>
            </div>

            {/* Current Best Player Hand Evaluation */}
            {playerRank && (
              <div className="bg-[#0B0F19] border border-[#1F2737] rounded-xl p-3 space-y-1 text-xs font-mono-numbers">
                <span className="text-[#94A3B8] block">Your Best Hand:</span>
                <span className="text-amber-300 font-black text-sm block">
                  {playerRank.rankName}
                </span>
                <span className="text-[10px] text-[#64748B] block">
                  {playerRank.description}
                </span>
              </div>
            )}

          </div>

          {/* Action Buttons: Deal Hand OR Check / Fold */}
          <div className="pt-2 space-y-2">
            {street !== 'idle' && street !== 'showdown' ? (
              <div className="grid grid-cols-3 gap-1.5">
                <button
                  type="button"
                  onClick={handleNextStreet}
                  className="py-3 rounded-xl font-extrabold text-xs flex items-center justify-center gap-1 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 text-black shadow-lg shadow-emerald-500/20 cursor-pointer"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                  <span>{street === 'river' ? 'Showdown' : 'Check / Call'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleRaise}
                  className="py-3 rounded-xl font-extrabold text-xs flex items-center justify-center gap-1 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 text-black shadow-lg shadow-amber-500/20 cursor-pointer"
                >
                  <Coins className="w-3.5 h-3.5" />
                  <span>Raise (+{betAmount})</span>
                </button>

                <button
                  type="button"
                  onClick={handleFold}
                  className="py-3 rounded-xl font-extrabold text-xs flex items-center justify-center gap-1 bg-[#1F2737] hover:bg-[#2A374A] text-rose-400 border border-rose-500/30 cursor-pointer"
                >
                  <Hand className="w-3.5 h-3.5" />
                  <span>Fold</span>
                </button>
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

        {/* Texas Hold'em Felt Poker Table Stage (Right) */}
        <div className="lg:col-span-8 bg-[#07090E] border border-[#1F2737] rounded-2xl p-4 sm:p-6 flex flex-col justify-between items-center text-center relative overflow-hidden min-h-[480px]">
          <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />

          {/* Top Status & Dealer Button */}
          <div className="w-full flex flex-wrap items-center justify-between gap-2 text-xs text-[#94A3B8] font-mono-numbers pb-2 border-b border-[#1F2737]">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded bg-blue-500/15 text-blue-300 border border-blue-500/30 text-[10px] font-bold">
                HEADS-UP DEMO TABLE (SOLO vs DEALER)
              </span>
              <div className="flex items-center gap-1 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/30">
                <span className="w-4 h-4 rounded-full bg-white text-slate-900 font-black text-[9px] flex items-center justify-center border border-amber-400 shadow">
                  D
                </span>
                <span className="text-[10px] text-amber-300 font-bold uppercase">Dealer Button</span>
              </div>
            </div>
            <span>Pot: <strong className="text-amber-400 font-bold">{pot} FC</strong></span>
          </div>

          {/* Poker Felt Table Area */}
          <div className="w-full my-auto py-2 space-y-5">
            
            {/* 1. DEALER HOLE CARDS */}
            <div className="space-y-1">
              <div className="flex items-center justify-center gap-2 text-xs font-mono-numbers text-[#94A3B8]">
                <span>Dealer Hand:</span>
                <span className="font-bold text-white">
                  {street === 'showdown' ? dealerRank?.rankName : 'Hidden Hole Cards'}
                </span>
              </div>

              <div className="flex items-center justify-center gap-1.5 xs:gap-2">
                {dealerHoleCards.map((c, i) => {
                  const isHidden = (street !== 'showdown');
                  return (
                    <div
                      key={i}
                      className={`w-11 h-16 xs:w-12 xs:h-18 sm:w-14 sm:h-20 rounded-xl border flex flex-col items-center justify-between p-1 shadow-md transition-all ${
                        isHidden
                          ? 'bg-gradient-to-br from-indigo-950 via-purple-950 to-slate-900 border-purple-500/40 text-purple-400'
                          : 'bg-white text-slate-900 border-slate-300'
                      }`}
                    >
                      {isHidden ? (
                        <div className="w-full h-full rounded border border-purple-400/20 flex items-center justify-center text-lg">
                          🂠
                        </div>
                      ) : (
                        <>
                          <span className={`font-black text-xs self-start leading-none ${c.color === 'red' ? 'text-rose-600' : 'text-slate-900'}`}>
                            {c.rank}
                          </span>
                          <span className={`text-xl leading-none ${c.color === 'red' ? 'text-rose-600' : 'text-slate-900'}`}>
                            {c.suit}
                          </span>
                          <span className={`font-black text-[10px] self-end leading-none ${c.color === 'red' ? 'text-rose-600' : 'text-slate-900'}`}>
                            {c.rank}
                          </span>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 2. COMMUNITY BOARD (5 CARDS) */}
            <div className="p-3 rounded-2xl bg-[#111827]/80 border border-[#1F2737] max-w-sm mx-auto space-y-1.5 shadow-inner">
              <span className="text-[10px] font-mono-numbers uppercase tracking-wider text-amber-400 font-bold block">
                Community Cards (Flop • Turn • River)
              </span>

              <div className="flex items-center justify-center gap-1 xs:gap-1.5 sm:gap-2">
                {Array.from({ length: 5 }, (_, i) => {
                  const card = communityCards[i];
                  return (
                    <div
                      key={i}
                      className={`w-11 h-16 xs:w-12 xs:h-18 sm:w-14 sm:h-20 rounded-xl border flex flex-col items-center justify-between p-1 shadow-md transition-all ${
                        card
                          ? 'bg-white text-slate-900 border-slate-300 animate-in zoom-in-75'
                          : 'bg-[#0B0F19] border-dashed border-[#1F2737] text-[#64748B]'
                      }`}
                    >
                      {card ? (
                        <>
                          <span className={`font-black text-xs self-start leading-none ${card.color === 'red' ? 'text-rose-600' : 'text-slate-900'}`}>
                            {card.rank}
                          </span>
                          <span className={`text-xl leading-none ${card.color === 'red' ? 'text-rose-600' : 'text-slate-900'}`}>
                            {card.suit}
                          </span>
                          <span className={`font-black text-[10px] self-end leading-none ${card.color === 'red' ? 'text-rose-600' : 'text-slate-900'}`}>
                            {card.rank}
                          </span>
                        </>
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-xs opacity-40">
                          {i < 3 ? 'Flop' : i === 3 ? 'Turn' : 'River'}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 3. PLAYER HOLE CARDS */}
            <div className="space-y-1">
              <div className="flex items-center justify-center gap-2 text-xs font-mono-numbers text-[#94A3B8]">
                <span>Your Hole Cards:</span>
                <span className="font-bold text-amber-300">
                  {playerRank?.rankName || '2 Pocket Cards'}
                </span>
              </div>

              <div className="flex items-center justify-center gap-1.5 xs:gap-2">
                {playerHoleCards.map((c, i) => (
                  <div
                    key={i}
                    className="w-11 h-16 xs:w-12 xs:h-18 sm:w-14 sm:h-20 rounded-xl bg-white text-slate-900 border border-slate-300 flex flex-col items-center justify-between p-1 shadow-md transition-all animate-in zoom-in-75"
                  >
                    <span className={`font-black text-xs self-start leading-none ${c.color === 'red' ? 'text-rose-600' : 'text-slate-900'}`}>
                      {c.rank}
                    </span>
                    <span className={`text-xl leading-none ${c.color === 'red' ? 'text-rose-600' : 'text-slate-900'}`}>
                      {c.suit}
                    </span>
                    <span className={`font-black text-[10px] self-end leading-none ${c.color === 'red' ? 'text-rose-600' : 'text-slate-900'}`}>
                      {c.rank}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Showdown Result Announcement */}
            {pokerResult && (
              <div className={`rounded-xl px-4 py-2 text-center font-mono-numbers animate-in zoom-in-95 max-w-sm mx-auto ${
                pokerResult === 'player_won'
                  ? 'bg-emerald-950/80 border border-emerald-500/50 text-emerald-300'
                  : pokerResult === 'push'
                  ? 'bg-amber-950/80 border border-amber-500/50 text-amber-300'
                  : 'bg-rose-950/80 border border-rose-500/50 text-rose-300'
              }`}>
                <span className="text-sm font-black uppercase tracking-wider block">
                  {pokerResult === 'player_won' ? `You Won with ${playerRank?.rankName}!` :
                   pokerResult === 'push' ? 'Split Pot / Tie!' :
                   pokerResult === 'folded' ? 'Hand Folded' : `Dealer Won with ${dealerRank?.rankName}`}
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
              Multiplayer-Ready Architecture
            </span>
          </div>

        </div>

      </div>
    </div>
  );
}

