import React from 'react';
import { useLottery } from '../context/LotteryContext';
import { 
  Coins, 
  Clock, 
  Headphones, 
  ArrowRight, 
  FileText, 
  ShieldAlert,
  Zap,
  Mail
} from 'lucide-react';

interface FooterProps {
  onSelectTab: (tabId: string) => void;
  onGoHome: () => void;
}

export default function Footer({ onSelectTab, onGoHome }: FooterProps) {
  const { platformSettings } = useLottery();
  const supportEmail = platformSettings?.supportEmail ? platformSettings.supportEmail.trim() : '';

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
    <footer className="shrink-0 w-full mt-auto border-t border-[#1F2737] bg-[#07090D] text-left pt-6 pb-16 md:pb-8 px-3 xs:px-4 sm:px-6 lg:px-8 select-none">
      <div className="w-full max-w-7xl 2xl:max-w-[1600px] 3xl:max-w-[1800px] 4k:max-w-[2000px] mx-auto space-y-6 sm:space-y-8">
        
        {/* =================================================================== */}
        {/* 1. PLATFORM INFORMATION & BRANDING (CLEAN LOGO ONLY)               */}
        {/* =================================================================== */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start pb-6 border-b border-[#1F2737]">
          
          {/* Left Brand Column: Clean Logo and Platform Overview */}
          <div className="lg:col-span-5 space-y-3">
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
              <span className="font-display font-black text-base sm:text-lg text-white">
                EarnFlow<span className="text-[#a855f7]">.in</span>
              </span>
            </div>

            <p className="text-xs text-[#94A3B8] leading-relaxed max-w-md">
              EarnFlow.in is an online gaming platform that provides users with access to interactive games, gaming events, account management, and USDT-based payment features.
            </p>
          </div>

          {/* Right Pillar Cards: Currency, Payout SLA, Customer Support */}
          <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-3.5 rounded-xl bg-[#0B0F19] border border-[#1F2737] space-y-1">
              <div className="flex items-center gap-1.5 text-emerald-400 font-bold text-xs">
                <Coins className="w-4 h-4 shrink-0" />
                <span>USDT TRC-20</span>
              </div>
              <p className="text-[11px] text-[#94A3B8] leading-relaxed">
                Platform currency denominated exclusively in USDT for transparent accounting.
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-[#0B0F19] border border-[#1F2737] space-y-1">
              <div className="flex items-center gap-1.5 text-purple-400 font-bold text-xs">
                <Clock className="w-4 h-4 shrink-0" />
                <span>24-Hour Payouts</span>
              </div>
              <p className="text-[11px] text-[#94A3B8] leading-relaxed">
                Withdrawals audited, approved, and disbursed to your wallet within 24 hours.
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-[#0B0F19] border border-[#1F2737] space-y-1">
              <div className="flex items-center gap-1.5 text-amber-400 font-bold text-xs">
                <Headphones className="w-4 h-4 shrink-0" />
                <span>24/7 Support Desk</span>
              </div>
              <p className="text-[11px] text-[#94A3B8] leading-relaxed">
                {supportEmail ? (
                  <>Inquiries: <a href={`mailto:${supportEmail}`} className="text-amber-300 font-mono hover:underline">{supportEmail}</a></>
                ) : (
                  <span>Dedicated support agents available around the clock.</span>
                )}
              </p>
            </div>
          </div>

        </div>

        {/* =================================================================== */}
        {/* 2. HOW THE PLATFORM WORKS (ORGANIZED NEATLY IN FOOTER)              */}
        {/* =================================================================== */}
        <div className="space-y-3.5">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-amber-400" />
            <h3 className="font-display font-bold text-sm text-white">
              How The Platform Works
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 sm:gap-4 text-xs text-[#94A3B8] leading-relaxed">
            <div className="p-3.5 rounded-xl bg-[#0B0F19] border border-[#1F2737] space-y-1.5">
              <div className="flex items-center gap-2 text-white font-bold text-xs">
                <span className="w-5 h-5 rounded-md bg-amber-500/20 text-amber-400 flex items-center justify-center font-mono-numbers text-[10px]">1</span>
                <span>Account &amp; Sign-In</span>
              </div>
              <p className="text-[11px]">
                Explore game rooms as a guest or sign in in 1-click using Google OAuth or email. We only request basic profile info to manage your wallet and game access securely.
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-[#0B0F19] border border-[#1F2737] space-y-1.5">
              <div className="flex items-center gap-2 text-white font-bold text-xs">
                <span className="w-5 h-5 rounded-md bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-mono-numbers text-[10px]">2</span>
                <span>USDT Currency &amp; Payments</span>
              </div>
              <p className="text-[11px]">
                EarnFlow.in operates strictly using USDT (Tether TRC-20). Deposits credit automatically to your wallet balance, and withdrawals disburse directly to your external address.
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-[#0B0F19] border border-[#1F2737] space-y-1.5">
              <div className="flex items-center gap-2 text-white font-bold text-xs">
                <span className="w-5 h-5 rounded-md bg-purple-500/20 text-purple-400 flex items-center justify-center font-mono-numbers text-[10px]">3</span>
                <span>Transparent Gaming &amp; Support</span>
              </div>
              <p className="text-[11px]">
                Participate in interactive games and lottery events with automated payouts. For questions, visit our{' '}
                <a 
                  href="/support" 
                  onClick={(e) => handleLinkClick(e, 'support', '/support')}
                  className="text-amber-400 hover:underline"
                >
                  Customer Support Desk
                </a>.
              </p>
            </div>
          </div>
        </div>

        {/* =================================================================== */}
        {/* 3. LEGAL NAVIGATION & COPYRIGHT                                     */}
        {/* =================================================================== */}
        <div className="pt-4 border-t border-[#1F2737] flex flex-col sm:flex-row items-center justify-between gap-3 text-[11px] text-[#94A3B8]">
          <div className="text-center sm:text-left">
            © 2026 EarnFlow.in Platform. All rights reserved. 18+ entertainment platform.
          </div>

          <div className="flex items-center gap-3 font-semibold text-[11px] shrink-0 flex-wrap justify-center sm:justify-end">
            <a
              href="/support"
              onClick={(e) => handleLinkClick(e, 'support', '/support')}
              className="hover:text-purple-400 transition-colors cursor-pointer text-[#a855f7]"
            >
              Customer Support &amp; FAQ
            </a>
            <span>•</span>
            <a
              href="/legal/terms"
              onClick={(e) => handleLinkClick(e, 'terms', '/legal/terms')}
              className="hover:text-white transition-colors cursor-pointer"
            >
              Terms &amp; Conditions
            </a>
            <span>•</span>
            <a
              href="/legal/privacy"
              onClick={(e) => handleLinkClick(e, 'privacy', '/legal/privacy')}
              className="hover:text-white transition-colors cursor-pointer"
            >
              Privacy Policy
            </a>
            <span>•</span>
            <a
              href="/transaction-history"
              onClick={(e) => handleLinkClick(e, 'transactions', '/transaction-history')}
              className="hover:text-white transition-colors cursor-pointer"
            >
              Transaction History
            </a>
          </div>
        </div>

      </div>
    </footer>
  );
}
