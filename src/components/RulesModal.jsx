import React from 'react';
import { X, ShieldCheck, Trophy, Sparkles, CheckCircle2 } from 'lucide-react';

export default function RulesModal({ isOpen, onClose }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
      <div className="glass-modal max-w-2xl w-full rounded-2xl p-6 sm:p-8 border border-[#ffd700]/40 relative max-h-[90vh] overflow-y-auto">
        
        <div className="flex items-center justify-between pb-4 border-b border-[#272a31] mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[rgba(245,196,81,0.15)] flex items-center justify-center text-[#ffd700] border border-[#f5c451]/30">
              <Trophy className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-display font-extrabold text-xl text-white">
                4-Digit Lottery Rules & Matching System
              </h3>
              <p className="text-xs text-[#9b8f7c]">
                Provably fair mathematical payout allocation
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-[#191c22] text-[#9b8f7c] hover:text-white flex items-center justify-center cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-6 text-sm text-[#e1e2eb]">
          {/* Section 1 */}
          <div>
            <h4 className="font-display font-bold text-base text-[#ffd700] mb-2 flex items-center gap-2">
              <Sparkles className="w-4 h-4" /> 1. How It Works
            </h4>
            <p className="text-xs text-[#9b8f7c] leading-relaxed">
              Each participant selects a 4-digit combination from <strong>0000</strong> to <strong>9999</strong> (or uses the <strong>Quick Pick</strong> auto-generator). When the countdown timer ends, a provably fair cryptographic draw reveals the winning 4 digits (e.g., <strong>7-4-2-9</strong>).
            </p>
          </div>

          {/* Section 2: Single Winner Jackpot Protocol */}
          <div>
            <h4 className="font-display font-bold text-base text-[#ffd700] mb-3 flex items-center gap-2">
              <Trophy className="w-4 h-4" /> 2. Single Winner Jackpot Protocol (Exact 4/4 Match)
            </h4>
            
            <div className="space-y-2.5">
              <div className="p-4 rounded-xl bg-gradient-to-r from-amber-500/15 via-[#121721] to-[#121721] border border-amber-500/40 flex items-center justify-between">
                <div>
                  <strong className="text-white block font-display text-sm">🏆 Single Winner Takes All (Full Pot)</strong>
                  <span className="text-xs text-[#05d5aa]">Match the exact 4-digit winning seed (e.g. 7-4-2-9)</span>
                </div>
                <span className="font-mono-numbers font-black text-sm text-[#ffd700]">
                  100% of Winner Pot
                </span>
              </div>

              <div className="p-3.5 rounded-xl bg-[#121721] border border-red-500/30 flex items-center justify-between">
                <div>
                  <strong className="text-red-400 block font-display text-xs">❌ Non-Matching Combinations (Lose)</strong>
                  <span className="text-xs text-[#9b8f7c]">No partial match tiers (no 3/4, 2/4, 1/4 matches)</span>
                </div>
                <span className="font-mono-numbers font-bold text-xs text-red-400">
                  0 USDT (Direct Lose)
                </span>
              </div>

              <div className="p-3 rounded-xl bg-[#0b0e14] border border-[#272a31] text-[11px] text-[#d2c5b0] leading-relaxed">
                💡 <strong>Win Up To Rule:</strong> The winner receives up to the maximum jackpot pool limit announced for the event. Winnings are automatically deposited into your wallet instantly upon draw settlement.
              </div>
            </div>
          </div>

          {/* Section 3: Instant Credit & 24h Withdrawal */}
          <div className="p-4 rounded-xl bg-[rgba(5,213,170,0.08)] border border-[#05d5aa]/30 space-y-2">
            <h4 className="font-display font-bold text-sm text-[#05d5aa] flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" /> 3. Automated Payouts & 24-Hour Withdrawal SLA
            </h4>
            <p className="text-xs text-[#d2c5b0] leading-relaxed">
              When a draw concludes, winning USDT prizes are <strong>automatically credited</strong> into your platform wallet balance without manual claiming. You can withdraw your USDT at any time to your TRC-20, BEP-20, or ERC-20 crypto wallet with our guaranteed <strong>24-Hour SLA</strong>.
            </p>
          </div>

          {/* Section 4: Provably Fair */}
          <div className="flex items-center gap-2 text-xs text-[#9b8f7c] pt-2 font-mono-numbers">
            <ShieldCheck className="w-4 h-4 text-[#00f2fe]" />
            <span>SHA-256 pre-committed cryptographic seeds guarantee zero operator tampering.</span>
          </div>
        </div>

        <button
          onClick={onClose}
          className="btn-gold w-full mt-6 py-3 rounded-xl text-sm font-bold cursor-pointer"
        >
          Got it, Close
        </button>

      </div>
    </div>
  );
}
