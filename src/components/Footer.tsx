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
    if (mainEl) mainEl.scrollTo({ top: 0, behavior: 'smooth' });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <footer className="shrink-0 w-full mt-auto border-t border-[#1F2737] bg-[#07090D] text-left pt-8 pb-16 md:pb-8 px-3 xs:px-4 sm:px-6 lg:px-8 select-none">
      <div className="w-full max-w-7xl 2xl:max-w-[1600px] mx-auto space-y-8">
        
        {/* 1. MAIN FOOTER GRID (4 COLUMNS) */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-8 pb-8 border-b border-[#1F2737]">
          
          {/* Column 1: Brand & Overview (5 cols) */}
          <div className="lg:col-span-5 space-y-4">
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
                className="w-8 h-8 rounded-full border border-purple-500/40 object-cover shadow-md shrink-0 group-hover:scale-105 transition-transform" 
              />
              <span className="font-display font-black text-lg text-white">
                EarnFlow<span className="text-purple-400">.in</span>
              </span>
            </div>

            <p className="text-xs text-[#94A3B8] leading-relaxed max-w-md">
              EarnFlow.in is an online Four-Digit Lottery platform offering transparent 0000–9999 lucky draws with instant USDT (TRC-20) wallet settlements and 24-hour payouts.
            </p>

            <div className="flex items-center gap-2 text-xs font-mono-numbers text-[#94A3B8] pt-1">
              <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold">
                USDT TRC-20
              </span>
              <span className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 font-bold">
                18+ Only
              </span>
              <span className="px-2 py-0.5 rounded bg-purple-500/10 text-purple-400 border border-purple-500/20 font-bold">
                95.0% RTP
              </span>
            </div>
          </div>

          {/* Column 2: Lottery & Gameplay (2 cols) */}
          <div className="lg:col-span-2 space-y-3">
            <h4 className="font-display font-bold text-xs uppercase tracking-wider text-white">
              Lottery
            </h4>
            <ul className="space-y-2 text-xs text-[#94A3B8]">
              <li>
                <a 
                  href="/lottery"
                  onClick={(e) => handleLinkClick(e, 'lotteries', '/')}
                  className="hover:text-amber-400 transition-colors cursor-pointer"
                >
                  Four-Digit Lottery
                </a>
              </li>
              <li>
                <a 
                  href="/#how-it-works-section"
                  onClick={(e) => handleLinkClick(e, 'lotteries', '/#how-it-works-section')}
                  className="hover:text-amber-400 transition-colors cursor-pointer"
                >
                  How It Works
                </a>
              </li>
              <li>
                <a 
                  href="/results"
                  onClick={(e) => handleLinkClick(e, 'results', '/results')}
                  className="hover:text-amber-400 transition-colors cursor-pointer"
                >
                  Draw Results
                </a>
              </li>
              <li>
                <a 
                  href="/faq"
                  onClick={(e) => handleLinkClick(e, 'faq', '/faq')}
                  className="hover:text-amber-400 transition-colors cursor-pointer"
                >
                  FAQ
                </a>
              </li>
            </ul>
          </div>

          {/* Column 3: Legal & Trust (3 cols) */}
          <div className="lg:col-span-3 space-y-3">
            <h4 className="font-display font-bold text-xs uppercase tracking-wider text-white">
              Legal &amp; Trust
            </h4>
            <ul className="space-y-2 text-xs text-[#94A3B8]">
              <li>
                <a 
                  href="/terms-and-conditions"
                  onClick={(e) => handleLinkClick(e, 'terms', '/terms-and-conditions')}
                  className="hover:text-white transition-colors cursor-pointer"
                >
                  Terms and Conditions
                </a>
              </li>
              <li>
                <a 
                  href="/privacy-policy"
                  onClick={(e) => handleLinkClick(e, 'privacy', '/privacy-policy')}
                  className="hover:text-white transition-colors cursor-pointer"
                >
                  Privacy Policy
                </a>
              </li>
              <li>
                <a 
                  href="/responsible-gaming"
                  onClick={(e) => handleLinkClick(e, 'responsible-gaming', '/responsible-gaming')}
                  className="hover:text-white transition-colors cursor-pointer"
                >
                  Responsible Gaming
                </a>
              </li>
              <li>
                <a 
                  href="/refund-policy"
                  onClick={(e) => handleLinkClick(e, 'refund-policy', '/refund-policy')}
                  className="hover:text-white transition-colors cursor-pointer"
                >
                  Refund Policy
                </a>
              </li>
              <li>
                <a 
                  href="/payment-policy"
                  onClick={(e) => handleLinkClick(e, 'payment-policy', '/payment-policy')}
                  className="hover:text-white transition-colors cursor-pointer"
                >
                  Payment Policy
                </a>
              </li>
              <li>
                <a 
                  href="/disclaimer"
                  onClick={(e) => handleLinkClick(e, 'disclaimer', '/disclaimer')}
                  className="hover:text-white transition-colors cursor-pointer"
                >
                  Disclaimer
                </a>
              </li>
            </ul>
          </div>

          {/* Column 4: Account & Support (2 cols) */}
          <div className="lg:col-span-2 space-y-3">
            <h4 className="font-display font-bold text-xs uppercase tracking-wider text-white">
              Support
            </h4>
            <ul className="space-y-2 text-xs text-[#94A3B8]">
              <li>
                <a 
                  href="/contact"
                  onClick={(e) => handleLinkClick(e, 'contact', '/contact')}
                  className="hover:text-amber-400 transition-colors cursor-pointer"
                >
                  Contact Support
                </a>
              </li>
              <li>
                <a 
                  href="/wallet"
                  onClick={(e) => handleLinkClick(e, 'wallet', '/wallet')}
                  className="hover:text-white transition-colors cursor-pointer"
                >
                  USDT Wallet
                </a>
              </li>
              <li>
                <a 
                  href="/transaction-history"
                  onClick={(e) => handleLinkClick(e, 'transactions', '/transaction-history')}
                  className="hover:text-white transition-colors cursor-pointer"
                >
                  Transaction History
                </a>
              </li>
              <li>
                <a 
                  href={`mailto:${supportEmail}`}
                  className="text-amber-400 hover:underline break-words"
                >
                  {supportEmail}
                </a>
              </li>
            </ul>
          </div>

        </div>

        {/* 2. COPYRIGHT & COMPLIANCE BAR */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-[11px] text-[#94A3B8]">
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
