import React from 'react';
import { useLottery } from '../context/LotteryContext';
import { CheckCircle2, AlertCircle, Info } from 'lucide-react';

export default function Toast() {
  const { toastMessage } = useLottery();

  if (!toastMessage) return null;

  const isError = toastMessage.type === 'error';
  const isInfo = toastMessage.type === 'info';

  return (
    <div className="fixed bottom-6 right-6 z-50 animate-in slide-in-from-bottom duration-300">
      <div className={`flex items-center gap-3 px-4 py-3.5 rounded-xl border shadow-2xl backdrop-blur-xl ${
        isError 
          ? 'bg-red-950/90 border-red-500/50 text-red-200' 
          : isInfo 
            ? 'bg-[#10131a]/95 border-[#00f2fe]/40 text-[#8df7ff]' 
            : 'bg-[#10131a]/95 border-[#05d5aa]/50 text-white'
      }`}>
        {isError ? (
          <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
        ) : isInfo ? (
          <Info className="w-5 h-5 text-[#00f2fe] shrink-0" />
        ) : (
          <CheckCircle2 className="w-5 h-5 text-[#05d5aa] shrink-0" />
        )}
        <span className="text-xs sm:text-sm font-medium">
          {toastMessage.message}
        </span>
      </div>
    </div>
  );
}
