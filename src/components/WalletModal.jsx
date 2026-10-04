import React from 'react';
import { useLottery } from '../context/LotteryContext';
import WalletView from './WalletView';
import { X } from 'lucide-react';

export default function WalletModal() {
  const { isWalletModalOpen, setIsWalletModalOpen } = useLottery();

  if (!isWalletModalOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md overflow-y-auto no-scrollbar">
      <div className="glass-modal w-full max-w-5xl rounded-3xl overflow-hidden border border-[#f5c451]/35 my-auto max-h-[95vh] flex flex-col relative no-scrollbar">
        <button
          onClick={() => setIsWalletModalOpen(false)}
          className="absolute top-6 right-6 z-10 w-9 h-9 rounded-xl bg-[#1a2232] text-[#9b8f7c] hover:text-white flex items-center justify-center cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="overflow-y-auto p-2 sm:p-4 no-scrollbar">
          <WalletView />
        </div>
      </div>
    </div>
  );
}
