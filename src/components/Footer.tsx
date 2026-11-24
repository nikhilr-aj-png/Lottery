import React from 'react';
import { useLottery } from '../context/LotteryContext';
import { 
  Coins, 
  Clock, 
  Headphones, 
  ArrowRight, 
  FileText, 
  ShieldCheck,
  ShieldAlert,
  Zap,
  Mail,
  Ticket,
  HelpCircle,
  HeartHandshake,
  RefreshCcw,
  AlertCircle
} from 'lucide-react';

interface FooterProps {
  onSelectTab: (tabId: string) => void;
  onGoHome: () => void;
}

export default function Footer({ onSelectTab, onGoHome }: FooterProps) {
  const { platformSettings } = useLottery();
  const supportEmail = platformSettings?.supportEmail ? platformSettings.supportEmail.trim() : 'earnflow.user@gmail.com';

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

  return (
    <footer className="shrink-0 w-full mt-auto border-t border-[#1F2737] bg-[#07090D] text-left pt-7 pb-16 md:pb-7 px-3 xs:px-4 sm:px-6 lg:px-8 select-none">
      <div className="w-full max-w-7xl 2xl:max-w-[1600px] mx-auto space-y-6">
        
        {/* 1. MAIN FOOTER GRID */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-6 lg:gap-8 pb-6 border-b border-[#1F2737]">
          
          {/* Column 1: Brand & Overview (5 cols) */}
          <div className="lg:col-span-5 space-y-3.5">
            <div 
              onClick={onGoHome}
              className="flex items-center gap-2.5 cursor-pointer group select-none inline-flex"
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

            <p className="text-xs text-[#94A3B8] leading-relaxed max-w-md">
              EarnFlow.in is an online Four-Digit Lottery platform offering transparent 0000–9999 lucky draws with instant USDT (TRC-20) wallet settlements and 24-hour payouts.
            </p>

            <div className="flex flex-wrap items-center gap-1.5 text-xs font-mono-numbers text-[#94A3B8] pt-1">
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold text-[10px]">
                USDT TRC-20
              </span>
              <span className="px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 font-bold text-[10px]">
                18+ Players Only
              </span>
              <span className="px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/20 font-bold text-[10px]">
                95.0% RTP
              </span>
            </div>
          </div>

          {/* Column 2: Information Pages (3 cols) */}
          <div className="lg:col-span-3 space-y-2.5">
            <h4 className="font-display font-bold text-xs uppercase tracking-wider text-white">
              Information
            </h4>
            <ul className="space-y-2 text-xs text-[#94A3B8]">
              <li>
                <a 
                  href="/how-it-works"
                  onClick={(e) => handleLinkClick(e, 'how-it-works', '/how-it-works')}
                  className="hover:text-amber-400 transition-colors cursor-pointer"
                >
                  How It Works
                </a>
              </li>
              <li>
                <a 
                  href="/rules"
                  onClick={(e) => handleLinkClick(e, 'rules', '/rules')}
                  className="hover:text-amber-400 transition-colors cursor-pointer"
                >
                  Lottery Rules &amp; Prize Distribution
                </a>
              </li>
              <li>
                <a 
                  href="/faq"
                  onClick={(e) => handleLinkClick(e, 'faq', '/faq')}
                  className="hover:text-amber-400 transition-colors cursor-pointer"
                >
                  Frequently Asked Questions
                </a>
              </li>
              <li>
                <a 
                  href="/results"
                  onClick={(e) => handleLinkClick(e, 'results', '/results')}
                  className="hover:text-amber-400 transition-colors cursor-pointer"
                >
                  Draw Results &amp; History
                </a>
              </li>
            </ul>
          </div>

          {/* Column 3: Support & Legal (4 cols) */}
          <div className="lg:col-span-4 space-y-2.5">
            <h4 className="font-display font-bold text-xs uppercase tracking-wider text-white">
              Support &amp; Legal
            </h4>
            <ul className="space-y-2 text-xs text-[#94A3B8]">
              <li>
                <a 
                  href="/responsible-gaming"
                  onClick={(e) => handleLinkClick(e, 'responsible-gaming', '/responsible-gaming')}
                  className="hover:text-amber-400 transition-colors cursor-pointer"
                >
                  Responsible Gaming
                </a>
              </li>
              <li>
                <a 
                  href="/terms"
                  onClick={(e) => handleLinkClick(e, 'terms', '/terms')}
                  className="hover:text-amber-400 transition-colors cursor-pointer"
                >
                  Terms &amp; Conditions
                </a>
              </li>
              <li>
                <a 
                  href="/contact"
                  onClick={(e) => handleLinkClick(e, 'contact', '/contact')}
                  className="hover:text-amber-400 transition-colors cursor-pointer"
                >
                  Contact &amp; Support
                </a>
              </li>
              <li>
                <a 
                  href="/privacy-policy"
                  onClick={(e) => handleLinkClick(e, 'privacy', '/privacy-policy')}
                  className="hover:text-amber-400 transition-colors cursor-pointer"
                >
                  Privacy Policy
                </a>
              </li>
              <li className="pt-1">
                <a 
                  href={`mailto:${supportEmail}`}
                  className="text-amber-400 hover:underline break-words text-[11px] font-mono-numbers inline-flex items-center gap-1.5"
                >
                  <Mail className="w-3.5 h-3.5 shrink-0" />
                  <span>{supportEmail}</span>
                </a>
              </li>
            </ul>
          </div>

        </div>

        {/* 2. COPYRIGHT & COMPLIANCE BAR */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-2.5 text-[11px] text-[#94A3B8]">
          <div>
            © 2026 EarnFlow.in. All rights reserved. Online Four-Digit Lottery Platform.
          </div>
          <div className="flex items-center gap-2">
            <span>18+ Play Responsibly</span>
            <span>•</span>
            <span>USDT TRC-20 Settlements</span>
          </div>
        </div>

      </div>
    </footer>
  );
}
