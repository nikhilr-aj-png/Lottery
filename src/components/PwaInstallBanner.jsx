import React from 'react';
import { usePwa } from '../context/PwaContext';
import { useLottery } from '../context/LotteryContext';
import { Download, X, Smartphone, Sparkles } from 'lucide-react';

export default function PwaInstallBanner() {
  const { isInstalled, bannerDismissed, dismissBanner, triggerInstall } = usePwa();
  const { isNativeApp, apkDirectDownloadUrl } = useLottery();

  // If already running inside Native App, or already installed as PWA or user dismissed it, don't show floating banner
  if (isNativeApp || isInstalled || bannerDismissed) return null;

  return (
    <aside 
      aria-label="Install App"
      className="fixed bottom-[72px] sm:bottom-6 left-2.5 right-2.5 sm:left-auto sm:right-6 sm:max-w-sm z-45 bg-[#0e121b]/95 backdrop-blur-xl border border-[rgba(245,196,81,0.35)] rounded-2xl p-2.5 sm:p-3 shadow-[0_12px_40px_rgba(0,0,0,0.85)] animate-in slide-in-from-bottom-5 duration-300"
    >
      <div className="flex items-center gap-2.5 sm:gap-3">
        {/* App Logo */}
        <div className="relative w-8 h-8 sm:w-9 sm:h-9 rounded-xl p-0.5 bg-[#141924] border border-[#ffd700]/30 shadow-[0_0_12px_rgba(245,196,81,0.2)] flex items-center justify-center shrink-0">
          <img 
            src="/logo.png" 
            alt="EarnFlow" 
            className="w-full h-full object-cover rounded-lg"
          />
          <div className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-[#05d5aa] flex items-center justify-center text-[7px] text-black font-black">
            +
          </div>
        </div>

        {/* Text Details */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <h4 className="font-display font-bold text-xs sm:text-sm text-white truncate">
              Install App
            </h4>
            <span className="text-[8px] sm:text-[9px] font-mono-numbers px-1 rounded bg-[rgba(245,196,81,0.15)] text-[#f5c451] border border-[#f5c451]/30 font-bold shrink-0">
              FAST
            </span>
          </div>
          <p className="text-[10px] sm:text-[11px] text-[#94A3B8] truncate leading-tight">
            1-tap draws & full screen
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
          {apkDirectDownloadUrl && (
            <a
              href={apkDirectDownloadUrl}
              download="earnflow.apk"
              target="_blank"
              rel="noopener noreferrer"
              className="hidden xs:inline-flex px-2 py-1 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-400 text-[11px] font-bold items-center gap-1 cursor-pointer transition-colors"
              title="Direct Android APK Download"
            >
              <span>APK</span>
            </a>
          )}
          <button
            onClick={triggerInstall}
            className="btn-gold px-2.5 sm:px-3 py-1 rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer shadow-md shadow-[#f5c451]/20"
          >
            <Download className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
            <span>Install</span>
          </button>
          
          <button
            onClick={dismissBanner}
            aria-label="Dismiss install banner"
            className="w-7 h-7 rounded-lg text-[#94A3B8] hover:text-white hover:bg-[#1a2130] flex items-center justify-center transition-colors cursor-pointer"
            title="Dismiss"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </aside>
  );
}
