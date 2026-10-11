import React from 'react';
import { usePwa } from '../context/PwaContext';
import { Download, X, Smartphone, Sparkles } from 'lucide-react';

export default function PwaInstallBanner() {
  const { isInstalled, bannerDismissed, dismissBanner, triggerInstall } = usePwa();

  // If already installed as PWA or user dismissed it in this session/recent days, don't show floating banner
  if (isInstalled || bannerDismissed) return null;

  return (
    <aside 
      aria-label="Install App"
      className="fixed bottom-16 sm:bottom-6 left-3 right-3 sm:left-auto sm:right-6 sm:max-w-md z-45 bg-[#0e121b]/95 backdrop-blur-xl border border-[rgba(245,196,81,0.35)] rounded-2xl p-3 sm:p-3.5 shadow-[0_12px_40px_rgba(0,0,0,0.85)] animate-in slide-in-from-bottom-5 duration-300"
    >
      <div className="flex items-center gap-3">
        {/* App Logo */}
        <div className="relative w-10 h-10 rounded-xl p-0.5 bg-[#141924] border border-[#ffd700]/30 shadow-[0_0_15px_rgba(245,196,81,0.25)] flex items-center justify-center shrink-0">
          <img 
            src="/logo.png" 
            alt="EarnFlow" 
            className="w-full h-full object-cover rounded-lg"
          />
          <div className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-[#05d5aa] flex items-center justify-center text-[8px] text-black font-black">
            +
          </div>
        </div>

        {/* Text Details */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <h4 className="font-display font-bold text-xs sm:text-sm text-white truncate">
              Install EarnFlow App
            </h4>
            <span className="text-[9px] font-mono-numbers px-1 rounded bg-[rgba(245,196,81,0.15)] text-[#f5c451] border border-[#f5c451]/30 font-bold shrink-0">
              FAST
            </span>
          </div>
          <p className="text-[11px] text-[#9b8f7c] truncate">
            Add to Home Screen for 1-tap draws & full screen
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={triggerInstall}
            className="btn-gold px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer shadow-md shadow-[#f5c451]/20"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Install</span>
          </button>
          
          <button
            onClick={dismissBanner}
            aria-label="Dismiss install banner"
            className="p-1 rounded-lg text-[#9b8f7c] hover:text-white hover:bg-[#1a2130] transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
