import React from 'react';
import { Trophy, Sparkles, X, CheckCircle, ArrowRight } from 'lucide-react';
import { useLottery } from '../context/LotteryContext';

export default function WinnerCelebrationModal() {
  const { winCelebration, setWinCelebration, setActiveTab } = useLottery();

  if (!winCelebration) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
      <div className="glass-modal max-w-lg w-full rounded-3xl p-6 sm:p-8 border-2 border-[#ffd700] text-center relative overflow-hidden animate-in fade-in zoom-in duration-300">
        
        {/* Glow ambient background */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-72 h-36 bg-[#ffd700]/20 blur-3xl pointer-events-none" />

        <button
          onClick={() => setWinCelebration(null)}
          className="absolute top-4 right-4 w-8 h-8 rounded-full bg-[#121721] text-[#9b8f7c] hover:text-white flex items-center justify-center cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Trophy Icon */}
        <div className="w-20 h-20 rounded-2xl bg-gradient-to-tr from-[#ffd700] to-[#f5c451] p-1 mx-auto mb-4 shadow-[0_0_40px_rgba(245,196,81,0.5)]">
          <div className="w-full h-full bg-[#0b0e14] rounded-[14px] flex items-center justify-center text-4xl">
            🏆
          </div>
        </div>

        <span className="badge-provably-fair px-3 py-1 rounded-full text-xs font-bold font-mono-numbers inline-flex items-center gap-1.5 mb-2">
          <Sparkles className="w-3.5 h-3.5 text-[#05d5aa]" />
          PROVABLY FAIR WINNER
        </span>

        <h3 className="font-display font-black text-2xl sm:text-3xl text-white mb-1">
          CONGRATULATIONS!
        </h3>
        <p className="text-xs text-[#9b8f7c] mb-6">
          Your 4-digit ticket matched in <strong className="text-white">{winCelebration.eventTitle}</strong>!
        </p>

        {/* Winning Spheres */}
        <div className="bg-[#0b0e14] p-4 rounded-2xl border border-[#272a31] my-4">
          <span className="text-[10px] text-[#9b8f7c] uppercase font-bold block mb-2 font-mono-numbers">
            Winning Combination:
          </span>
          <div className="flex items-center justify-center gap-2">
            {winCelebration.winningDigits.split('').map((char, i) => (
              <span
                key={i}
                className="w-11 h-11 rounded-xl bg-[#1a2232] border-2 border-[#05d5aa] flex items-center justify-center font-display font-black text-xl text-[#05d5aa]"
              >
                {char}
              </span>
            ))}
          </div>
        </div>

        {/* Prize Amount */}
        <div className="p-4 rounded-2xl bg-[rgba(245,196,81,0.1)] border border-[#f5c451]/40 my-4">
          <span className="text-xs text-[#ffd700] font-bold uppercase block mb-1">
            Total Prize Won
          </span>
          <div className="font-display font-black text-3xl sm:text-4xl text-gold-gradient">
            +{winCelebration.totalWon.toLocaleString()} USDT
          </div>
          <span className="text-[11px] text-[#05d5aa] font-semibold flex items-center justify-center gap-1 mt-1">
            <CheckCircle className="w-3.5 h-3.5" />
            Automatically Credited to Your Wallet Balance ✅
          </span>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 mt-6">
          <button
            onClick={() => {
              setWinCelebration(null);
              setActiveTab('wallet');
            }}
            className="btn-gold flex-1 py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 cursor-pointer"
          >
            Go to Wallet & Withdraw (24h)
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

      </div>
    </div>
  );
}
