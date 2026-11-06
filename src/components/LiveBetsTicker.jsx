import React, { useState, useEffect } from 'react';
import { gameHistoryStore } from '../engine';
import { useLottery } from '../context/LotteryContext';
import { 
  Flame, 
  Trophy, 
  Coins, 
  ExternalLink, 
  ShieldCheck, 
  Sparkles,
  Zap,
  TrendingUp,
  Clock,
  User
} from 'lucide-react';
import ProvablyFairModal from './ProvablyFairModal';

export default function LiveBetsTicker({ onSelectGame }) {
  const { wallet } = useLottery();
  const [activeFeedTab, setActiveFeedTab] = useState('all'); // 'all' | 'high' | 'my'
  const [allBets, setAllBets] = useState([]);
  const [myBets, setMyBets] = useState([]);
  const [highRollers, setHighRollers] = useState([]);
  const [verifyModalBet, setVerifyModalBet] = useState(null);

  useEffect(() => {
    // Initial fetch
    gameHistoryStore.fetchAllBets(30).then(setAllBets);
    gameHistoryStore.fetchHighRollers(15).then(setHighRollers);
    if (wallet.address) {
      gameHistoryStore.fetchMyBets(wallet.address, 30).then(setMyBets);
    }

    // Subscribe to live updates
    gameHistoryStore.initRealtime();
    const unsubscribe = gameHistoryStore.subscribe((data) => {
      setAllBets(data.allBets);
      setHighRollers(data.highRollers);
      if (wallet.address) {
        setMyBets(data.myBets);
      }
    });

    return () => {
      unsubscribe();
      gameHistoryStore.cleanupRealtime();
    };
  }, [wallet.address]);

  const currentList = activeFeedTab === 'high' 
    ? highRollers 
    : (activeFeedTab === 'my' ? myBets : allBets);

  const getGameEmoji = (gameId) => {
    switch (gameId?.toLowerCase()) {
      case 'crash': return '🚀';
      case 'dice': return '🎲';
      case 'mines': return '💣';
      case 'plinko': return '🎯';
      case 'roulette': return '🎡';
      case 'coinflip': return '🪙';
      case 'blackjack': return '🃏';
      case 'slots': return '🎰';
      case 'poker': return '♠️';
      case 'keno': return '🎱';
      case 'limbo': return '⚡';
      case 'lottery': return '🎟️';
      default: return '🎮';
    }
  };

  return (
    <div className="w-full bg-[#07090E] border-y border-[#1F2737] py-2.5 px-3 sm:px-6">
      <div className="max-w-7xl 2xl:max-w-[1600px] 3xl:max-w-[1920px] mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-2.5">
        
        {/* Ticker Tabs */}
        <div className="flex items-center gap-1.5 shrink-0">
          <div className="flex items-center gap-1 text-[11px] font-bold text-amber-400 mr-1.5 uppercase tracking-wider font-display">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Live Casino Activity</span>
          </div>

          <div className="flex items-center bg-[#111827] p-0.5 rounded-xl border border-[#1F2737] text-[10px] font-bold">
            <button
              onClick={() => setActiveFeedTab('all')}
              className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                activeFeedTab === 'all'
                  ? 'bg-amber-500 text-black font-extrabold shadow-sm'
                  : 'text-[#94A3B8] hover:text-white'
              }`}
            >
              All Bets
            </button>
            <button
              onClick={() => setActiveFeedTab('high')}
              className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer flex items-center gap-1 ${
                activeFeedTab === 'high'
                  ? 'bg-gradient-to-r from-purple-500 to-indigo-600 text-white font-extrabold shadow-sm'
                  : 'text-[#94A3B8] hover:text-purple-300'
              }`}
            >
              <Trophy className="w-3 h-3 text-amber-300" />
              <span>High Rollers</span>
            </button>
            {wallet.address && (
              <button
                onClick={() => setActiveFeedTab('my')}
                className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                  activeFeedTab === 'my'
                    ? 'bg-emerald-500 text-black font-extrabold shadow-sm'
                    : 'text-[#94A3B8] hover:text-white'
                }`}
              >
                My Bets
              </button>
            )}
          </div>
        </div>

        {/* Rolling Bets Track */}
        <div className="flex-1 w-full overflow-x-auto no-scrollbar">
          <div className="flex items-center gap-2 min-w-max py-0.5">
            {currentList.length === 0 ? (
              <span className="text-[11px] text-[#94A3B8] font-mono-numbers italic py-0.5">
                Waiting for next live bet across the network...
              </span>
            ) : (
              currentList.slice(0, 10).map((bet) => {
                const isWin = bet.payout > 0;
                return (
                  <div
                    key={bet.id}
                    onClick={() => {
                      if (onSelectGame && bet.gameId) onSelectGame(bet.gameId);
                    }}
                    className="flex items-center gap-2 bg-[#111827] hover:bg-[#151C2B] border border-[#1F2737] hover:border-amber-500/40 px-2.5 py-1.5 rounded-xl transition-all cursor-pointer shadow-sm group shrink-0"
                    title="Click to view game"
                  >
                    <span className="text-sm shrink-0">{getGameEmoji(bet.gameId)}</span>
                    <div className="flex flex-col">
                      <div className="flex items-center gap-1 text-[10px] font-mono-numbers">
                        <span className="font-sans font-semibold text-[#F8FAFC] group-hover:text-amber-300 transition-colors truncate max-w-[80px]">
                          {bet.username}
                        </span>
                        <span className="text-[#94A3B8]">·</span>
                        <span className="uppercase text-[#94A3B8] font-bold text-[9px]">
                          {bet.gameId}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 text-[10px] font-mono-numbers font-bold">
                        <span className="text-[#94A3B8]">
                          {bet.betAmount} FC
                        </span>
                        <span className={`px-1 py-0.2 rounded text-[9px] ${
                          isWin ? 'bg-emerald-500/15 text-emerald-300' : 'bg-red-500/10 text-red-400'
                        }`}>
                          {bet.multiplier ? `${bet.multiplier.toFixed(2)}x` : (isWin ? 'WIN' : 'LOST')}
                        </span>
                        <span className={isWin ? 'text-emerald-400 font-extrabold' : 'text-[#64748B]'}>
                          {isWin ? `+${bet.payout.toFixed(2)}` : '0'} FC
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

      </div>

      {/* Verification modal for bet auditing */}
      {verifyModalBet && (
        <ProvablyFairModal
          isOpen={!!verifyModalBet}
          onClose={() => setVerifyModalBet(null)}
          auditData={{
            event_id: verifyModalBet.id,
            event_title: `${verifyModalBet.gameId.toUpperCase()} Round #${verifyModalBet.id.slice(-6)}`,
            winning_digits: verifyModalBet.multiplier ? `${verifyModalBet.multiplier}x` : 'N/A',
            commit_hash: verifyModalBet.serverSeedHash,
            revealed_seed: verifyModalBet.serverSeed,
            client_seed: verifyModalBet.clientSeed
          }}
        />
      )}
    </div>
  );
}

