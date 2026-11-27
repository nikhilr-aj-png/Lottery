import React from 'react';
import { useLottery } from '../context/LotteryContext';
import { usePwa } from '../context/PwaContext';
import { 
  Download,
  Smartphone,
  CheckCircle2
} from 'lucide-react';

interface FooterProps {
  onSelectTab: (tabId: string) => void;
  onGoHome: () => void;
}

export default function Footer({ onSelectTab, onGoHome }: FooterProps) {
  const { isNativeApp, apkDirectDownloadUrl } = useLottery();
  const { isInstalled, isInstallable, triggerInstall } = usePwa();

  const handleLinkClick = (e: React.MouseEvent, tabId: string, path: string) => {
    e.preventDefault();
    onSelectTab(tabId);
    try {
      window.history.pushState(null, '', path);
    } catch {}
    const mainEl = document.getElementById('main-content');
    if (mainEl) mainEl.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  };

  const showAppSection = (!isNativeApp && !isInstalled) && (Boolean(apkDirectDownloadUrl) || isInstallable);

  return (
    <footer
      data-testid="site-footer"
      className="shrink-0 w-full mt-auto border-t border-[#1F2737] bg-[#07090D] text-left pt-5 sm:pt-6 pb-24 sm:pb-28 lg:pb-28 px-3 xs:px-4 sm:px-6 lg:px-8 select-none box-border overflow-visible relative z-10"
    >
      <div className="w-full max-w-7xl 2xl:max-w-[1600px] 3xl:max-w-[1800px] 4k:max-w-[2000px] mx-auto space-y-4 sm:space-y-5">
        
        {/* 1. MAIN FOOTER GRID */}
        <div className="grid grid-cols-2 md:grid-cols-12 gap-x-3 gap-y-5 xs:gap-x-4 md:gap-5 pb-4 sm:pb-5 border-b border-[#1F2737]">
          
          {/* Column 1: Brand & Overview */}
          <div className={`col-span-2 ${showAppSection ? 'md:col-span-5 lg:col-span-4 xl:col-span-4' : 'md:col-span-6 lg:col-span-6 xl:col-span-5'} space-y-2.5 sm:space-y-3 min-w-0`}>
            <div 
              onClick={onGoHome}
              className="flex items-center gap-2 sm:gap-2.5 cursor-pointer group select-none inline-flex"
              role="button"
              tabIndex={0}
              title="Return to EarnFlow Home Page"
            >
              <img 
                src="/logo.png" 
                alt="EarnFlow.in Logo" 
                className="w-7 h-7 xs:w-8 xs:h-8 rounded-full border border-amber-400/50 object-cover shadow-md shrink-0 group-hover:scale-105 transition-transform" 
              />
              <span className="font-display font-black text-base xs:text-lg text-white">
                EarnFlow<span className="text-amber-400">.in</span>
              </span>
            </div>

            <p className="text-[11px] xs:text-xs text-[#94A3B8] leading-relaxed max-w-md break-words">
              EarnFlow.in is an online Four-Digit Lottery platform offering transparent 0000–9999 lucky draws with instant USDT (TRC-20) wallet settlements and 24-hour payouts.
            </p>

            <div className="flex flex-wrap items-center gap-1.5 text-xs font-mono-numbers text-[#94A3B8] pt-0.5">
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold text-[10px] whitespace-nowrap">
                USDT TRC-20
              </span>
              <span className="px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 font-bold text-[10px] whitespace-nowrap">
                18+ Players Only
              </span>
              <span className="px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/20 font-bold text-[10px] whitespace-nowrap">
                95.0% RTP
              </span>
            </div>
          </div>

          {/* Column 2: Information Pages */}
          <div data-testid="footer-col-info" className={`col-span-1 ${showAppSection ? 'md:col-span-3 lg:col-span-3' : 'md:col-span-3 lg:col-span-3'} space-y-2 sm:space-y-2.5 min-w-0`}>
            <h4 className="font-display font-bold text-[11px] xs:text-xs uppercase tracking-wider text-white">
              Information
            </h4>
            <ul className="space-y-1.5 sm:space-y-2 text-[11px] xs:text-xs text-[#94A3B8] leading-snug">
              <li>
                <a 
                  href="/how-it-works"
                  onClick={(e) => handleLinkClick(e, 'how-it-works', '/how-it-works')}
                  className="hover:text-amber-400 active:text-amber-300 transition-colors cursor-pointer block break-words"
                >
                  How It Works
                </a>
              </li>
              <li>
                <a 
                  href="/lottery-rules"
                  onClick={(e) => handleLinkClick(e, 'rules', '/lottery-rules')}
                  className="hover:text-amber-400 active:text-amber-300 transition-colors cursor-pointer block break-words"
                >
                  Lottery Rules &amp; Prize Distribution
                </a>
              </li>
              <li>
                <a 
                  href="/faq"
                  onClick={(e) => handleLinkClick(e, 'faq', '/faq')}
                  className="hover:text-amber-400 active:text-amber-300 transition-colors cursor-pointer block break-words"
                >
                  Frequently Asked Questions
                </a>
              </li>
            </ul>
          </div>

          {/* Column 3: Support & Legal */}
          <div data-testid="footer-col-legal" className={`col-span-1 ${showAppSection ? 'md:col-span-4 lg:col-span-2 xl:col-span-3' : 'md:col-span-3 lg:col-span-3 xl:col-span-4'} space-y-2 sm:space-y-2.5 min-w-0`}>
            <h4 className="font-display font-bold text-[11px] xs:text-xs uppercase tracking-wider text-white">
              Support &amp; Legal
            </h4>
            <ul className="space-y-1.5 sm:space-y-2 text-[11px] xs:text-xs text-[#94A3B8] leading-snug">
              <li>
                <a 
                  href="/responsible-gaming"
                  onClick={(e) => handleLinkClick(e, 'responsible-gaming', '/responsible-gaming')}
                  className="hover:text-amber-400 active:text-amber-300 transition-colors cursor-pointer block break-words"
                >
                  Responsible Gaming
                </a>
              </li>
              <li>
                <a 
                  href="/terms-and-conditions"
                  onClick={(e) => handleLinkClick(e, 'terms', '/terms-and-conditions')}
                  className="hover:text-amber-400 active:text-amber-300 transition-colors cursor-pointer block break-words"
                >
                  Terms &amp; Conditions
                </a>
              </li>
              <li>
                <a 
                  href="/contact-support"
                  onClick={(e) => handleLinkClick(e, 'contact', '/contact-support')}
                  className="hover:text-amber-400 active:text-amber-300 transition-colors cursor-pointer block break-words"
                >
                  Contact &amp; Support
                </a>
              </li>
              <li>
                <a 
                  href="/privacy-policy"
                  onClick={(e) => handleLinkClick(e, 'privacy', '/privacy-policy')}
                  className="hover:text-amber-400 active:text-amber-300 transition-colors cursor-pointer block break-words"
                >
                  Privacy Policy
                </a>
              </li>
            </ul>
          </div>

          {/* Column 4: App & Mobile (Full compact bar on mobile/tablet, dedicated column on laptop/desktop) */}
          {showAppSection && (
            <div data-testid="footer-col-app" className="col-span-2 md:col-span-12 lg:col-span-3 xl:col-span-2 space-y-2.5 md:space-y-0 lg:space-y-2.5 pt-1 md:pt-3 lg:pt-0 border-t border-[#1F2737]/70 lg:border-t-0 md:flex md:items-center md:justify-between lg:block text-center md:text-left min-w-0 gap-4">
              <div className="space-y-1">
                <h4 className="font-display font-bold text-xs uppercase tracking-wider text-white">
                  App &amp; Mobile
                </h4>
                <p className="text-[11px] text-[#94A3B8] leading-snug max-w-xs mx-auto md:mx-0">
                  Play in full-screen with instant one-tap draws.
                </p>
              </div>

              <div
                data-testid="footer-app-buttons"
                className={`grid ${apkDirectDownloadUrl ? 'grid-cols-2' : 'grid-cols-1 max-w-[200px]'} md:flex md:items-center lg:grid lg:grid-cols-1 gap-2 xs:gap-2.5 pt-0.5 md:pt-0 max-w-md md:max-w-none mx-auto md:mx-0 w-full md:w-auto lg:w-full shrink-0`}
              >
                {apkDirectDownloadUrl && (
                  <a
                    href={apkDirectDownloadUrl}
                    download="earnflow.apk"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full md:w-auto lg:w-full min-h-[38px] inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 active:bg-emerald-500/30 border border-emerald-500/30 text-emerald-400 text-[11px] xs:text-xs font-bold transition-colors cursor-pointer whitespace-nowrap"
                    title="Direct Android APK Download"
                  >
                    <Download className="w-3.5 h-3.5 shrink-0" />
                    <span>Download APK</span>
                  </a>
                )}
                <button
                  type="button"
                  onClick={triggerInstall}
                  className="w-full md:w-auto lg:w-full min-h-[38px] inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 active:bg-amber-500/30 border border-amber-500/30 text-amber-300 text-[11px] xs:text-xs font-bold transition-colors cursor-pointer whitespace-nowrap"
                  title="Install EarnFlow Web App (PWA)"
                >
                  <Smartphone className="w-3.5 h-3.5 shrink-0" />
                  <span>Install App</span>
                </button>
              </div>
            </div>
          )}

        </div>

        {/* 2. COPYRIGHT & COMPLIANCE BAR */}
        <div
          data-testid="footer-copyright-bar"
          className="flex flex-col sm:flex-row flex-wrap items-center justify-between gap-2 text-center sm:text-left text-[11px] text-[#94A3B8]"
        >
          <div className="break-words">
            © 2026 EarnFlow.in. All rights reserved. Online Four-Digit Lottery Platform.
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2 shrink-0">
            <span>18+ Play Responsibly</span>
            <span>•</span>
            <span>USDT TRC-20 Settlements</span>
          </div>
        </div>

      </div>
    </footer>
  );
}
