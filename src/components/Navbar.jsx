import React, { useState } from 'react';
import { useLottery } from '../context/LotteryContext';
import { 
  Wallet, 
  Ticket, 
  Trophy, 
  ArrowUpRight, 
  Flame, 
  Menu, 
  X, 
  ArrowDownLeft,
  ChevronDown,
  User,
  LogIn,
  Lock,
  Headphones
} from 'lucide-react';

export default function Navbar({ onOpenProfile }) {
  const {
    user,
    profile,
    wallet,
    activeTab,
    setActiveTab,
    setIsWalletModalOpen,
    setWalletModalTab,
    setIsAuthModalOpen,
    showToast
  } = useLottery();

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const isLoggedIn = !!user;

  const handleNavClick = (tabId) => {
    // Unauthenticated visitors are allowed on public tabs: lotteries, contact, terms, privacy
    const publicTabs = ['lotteries', 'contact', 'terms', 'privacy'];
    if (!isLoggedIn && !publicTabs.includes(tabId)) {
      setIsMobileMenuOpen(false);
      setIsAuthModalOpen(true);
      const tabNames = {
        tickets: 'My Tickets',
        results: 'Draw Results & Past Winners',
        wallet: 'USDT Wallet'
      };
      showToast(`Please log in to access ${tabNames[tabId] || 'this section'}!`, 'info');
      return;
    }
    setActiveTab(tabId);
    setIsMobileMenuOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Pure public user navigation
  const navItems = [
    { id: 'lotteries', label: 'Home', icon: Flame },
    { id: 'tickets', label: 'My Tickets', icon: Ticket },
    { id: 'results', label: 'Results', icon: Trophy },
    { id: 'wallet', label: 'Wallet', icon: Wallet },
    { id: 'contact', label: 'Contact Us', icon: Headphones },
  ];

  return (
    <>
      {/* Top Navbar */}
      <header className="sticky top-0 z-40 bg-[#0b0e14]/95 backdrop-blur-xl border-b border-[rgba(245,196,81,0.18)]">
        <div className="max-w-7xl mx-auto px-2.5 sm:px-4 lg:px-8">
          <div className="flex items-center justify-between h-16 sm:h-18">
            
            {/* Brand Logo & Name */}
            <div 
              onClick={() => handleNavClick('lotteries')}
              className="flex items-center gap-2 sm:gap-3 cursor-pointer group shrink-0"
            >
              <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-full p-0.5 shadow-[0_0_16px_rgba(245,196,81,0.35)] group-hover:scale-105 transition-transform duration-200 flex items-center justify-center shrink-0">
                <img 
                  src="/logo.png" 
                  alt="EarnFlow.In USDT" 
                  className="w-full h-full rounded-full object-cover border border-[#ffd700]/40" 
                />
              </div>
              
              <div className="flex flex-col">
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <span className="font-display font-extrabold text-base sm:text-xl tracking-tight text-white group-hover:text-[#ffd700] transition-colors leading-none">
                    EarnFlow<span className="text-[#f5c451]">.In</span>
                  </span>
                  <span className="text-[9px] sm:text-[10px] font-mono-numbers px-1.5 py-0.5 rounded bg-[rgba(5,213,170,0.15)] text-[#05d5aa] border border-[#05d5aa]/30 font-bold tracking-wide">
                    USDT
                  </span>
                </div>
                <span className="text-[10px] text-[#9b8f7c] font-medium hidden lg:block leading-tight mt-0.5">
                  Sovereign Crypto Lottery Protocol
                </span>
              </div>
            </div>

            {/* Desktop Navigation Links (>= 1024px) */}
            <nav className="hidden lg:flex items-center gap-1 bg-[#10131a]/90 p-1 rounded-xl border border-[rgba(245,196,81,0.15)]">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                const isLocked = !isLoggedIn && !['lotteries', 'contact'].includes(item.id);
                return (
                  <button
                    key={item.id}
                    onClick={() => handleNavClick(item.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0 ${
                      isActive
                        ? 'bg-gradient-to-r from-[#ffd700] to-[#f5c451] text-[#0b0e14] shadow-sm font-bold'
                        : 'text-[#d2c5b0] hover:text-[#ffd700] hover:bg-white/5'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5 shrink-0" />
                    <span className="whitespace-nowrap">{item.label}</span>
                    {isLocked && (
                      <Lock className="w-2.5 h-2.5 text-[#9b8f7c] opacity-60 ml-0.5 shrink-0" />
                    )}
                  </button>
                );
              })}
            </nav>

            {/* Right Action: Wallet Balance & Login / Profile */}
            <div className="flex items-center gap-1.5 sm:gap-2.5">
              {isLoggedIn ? (
                <>
                  {/* Balance Pill */}
                  <div 
                    onClick={() => handleNavClick('wallet')}
                    title="Click to view Wallet & 24h Payouts"
                    className="cursor-pointer bg-[#10131a] hover:bg-[#161b26] border border-[rgba(245,196,81,0.25)] hover:border-[#f5c451] rounded-xl px-2.5 sm:px-3.5 py-1.5 flex items-center gap-1.5 sm:gap-2 transition-all shadow-inner"
                  >
                    <span className="w-2 h-2 rounded-full bg-[#05d5aa] animate-pulse shrink-0"></span>
                    <span className="font-mono-numbers font-bold text-xs sm:text-sm text-[#ffd700] whitespace-nowrap">
                      {wallet.balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                    <span className="text-[10px] sm:text-xs text-[#05d5aa] font-bold font-mono-numbers">
                      USDT
                    </span>
                  </div>

                  {/* Desktop Quick Deposit Button (Full screen page navigation) */}
                  <button
                    onClick={() => {
                      setWalletModalTab('deposit');
                      handleNavClick('wallet');
                    }}
                    className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[rgba(5,213,170,0.12)] text-[#05d5aa] hover:bg-[#05d5aa] hover:text-[#0b0e14] border border-[#05d5aa]/30 text-xs font-bold transition-all cursor-pointer whitespace-nowrap"
                  >
                    <ArrowDownLeft className="w-3.5 h-3.5" />
                    Deposit
                  </button>

                  {/* Profile Button */}
                  <button
                    onClick={onOpenProfile}
                    className="flex items-center gap-1.5 text-xs font-mono-numbers px-2.5 py-1.5 rounded-xl bg-[#161c28] text-[#e1e2eb] border border-[#2d3545] hover:border-[#f5c451]/50 transition-all cursor-pointer"
                    title="Open User Profile"
                  >
                    <div className="w-4 h-4 rounded-full bg-[#05d5aa]/20 text-[#05d5aa] flex items-center justify-center">
                      <User className="w-3 h-3" />
                    </div>
                    <span className="truncate max-w-[80px] sm:max-w-[110px] font-bold text-white">
                      {profile?.username ? `@${profile.username}` : (user?.user_metadata?.username ? `@${user.user_metadata.username}` : (user?.email ? user.email.split('@')[0] : 'Profile'))}
                    </span>
                    <ChevronDown className="w-3 h-3 text-[#9b8f7c]" />
                  </button>

                  {/* Mobile Drawer Toggle (visible < 1024px) */}
                  <button
                    onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                    aria-label="Toggle Navigation Menu"
                    className="lg:hidden w-8 h-8 rounded-lg bg-[#161c28] border border-[#2d3545] text-[#d2c5b0] hover:text-[#ffd700] flex items-center justify-center cursor-pointer shrink-0 ml-1"
                  >
                    {isMobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
                  </button>
                </>
              ) : (
                /* Login Button when not signed in */
                <button
                  onClick={() => setIsAuthModalOpen(true)}
                  className="btn-gold px-3.5 sm:px-5 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-1.5 shadow-md cursor-pointer whitespace-nowrap"
                >
                  <LogIn className="w-4 h-4" />
                  <span>Login</span>
                </button>
              )}
            </div>

          </div>
        </div>

        {/* Mobile Dropdown Drawer Menu (< 1024px) */}
        {isMobileMenuOpen && (
          <div className="lg:hidden bg-[#0e1118] border-b border-[rgba(245,196,81,0.2)] px-4 py-4 space-y-3 animate-in slide-in-from-top duration-200 no-scrollbar">
            {/* Navigation links */}
            <div className="grid grid-cols-2 gap-2">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                const isLocked = !isLoggedIn && !['lotteries', 'contact'].includes(item.id);
                return (
                  <button
                    key={item.id}
                    onClick={() => handleNavClick(item.id)}
                    className={`p-2.5 rounded-xl text-xs font-semibold flex items-center justify-between border text-left cursor-pointer ${
                      isActive
                        ? 'bg-gradient-to-r from-[#ffd700] to-[#f5c451] text-[#0b0e14] border-[#fff2a3] font-bold shadow-sm'
                        : 'bg-[#121721] text-[#e1e2eb] border-[#272a31] hover:border-[#f5c451]/40'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Icon className="w-4 h-4 shrink-0" />
                      <span className="truncate">{item.label}</span>
                    </div>
                    {isLocked && (
                      <Lock className="w-3 h-3 text-[#9b8f7c] opacity-60" />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Quick Actions in drawer (Full-screen view) */}
            {isLoggedIn && (
              <div className="pt-2 border-t border-[#1f2737] flex gap-2">
                <button
                  onClick={() => {
                    setWalletModalTab('deposit');
                    handleNavClick('wallet');
                    setIsMobileMenuOpen(false);
                  }}
                  className="flex-1 py-2 rounded-xl bg-[rgba(5,213,170,0.15)] text-[#05d5aa] border border-[#05d5aa]/30 text-xs font-bold flex items-center justify-center gap-1 cursor-pointer whitespace-nowrap"
                >
                  <ArrowDownLeft className="w-3.5 h-3.5" />
                  Deposit USDT
                </button>
                <button
                  onClick={() => {
                    setWalletModalTab('withdraw');
                    handleNavClick('wallet');
                    setIsMobileMenuOpen(false);
                  }}
                  className="flex-1 py-2 rounded-xl bg-[rgba(245,196,81,0.15)] text-[#ffd700] border border-[#f5c451]/30 text-xs font-bold flex items-center justify-center gap-1 cursor-pointer whitespace-nowrap"
                >
                  <ArrowUpRight className="w-3.5 h-3.5" />
                  Withdraw 24h
                </button>
              </div>
            )}

            {/* Profile trigger in mobile drawer */}
            {isLoggedIn ? (
              <button
                onClick={() => {
                  setIsMobileMenuOpen(false);
                  onOpenProfile();
                }}
                className="w-full py-2.5 rounded-xl bg-[#141924] border border-[#272a31] flex items-center justify-between px-3 text-xs text-white font-medium"
              >
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-[#ffd700]" />
                  <span>View Player Profile (TRC-20)</span>
                </div>
                <span className="text-[10px] text-[#05d5aa] font-mono-numbers">
                  {profile?.username ? `@${profile.username}` : user?.email}
                </span>
              </button>
            ) : (
              <button
                onClick={() => {
                  setIsMobileMenuOpen(false);
                  setIsAuthModalOpen(true);
                }}
                className="w-full py-2.5 rounded-xl btn-gold flex items-center justify-center gap-2 text-xs font-bold"
              >
                <LogIn className="w-4 h-4" />
                <span>Login with Email / Google</span>
              </button>
            )}
          </div>
        )}
      </header>

      {/* Persistent Bottom Mobile Nav Bar (Fixed on screens < 768px for supreme thumb ergonomics) */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#0b0e14]/95 backdrop-blur-xl border-t border-[rgba(245,196,81,0.18)] px-2 py-1.5 flex items-center justify-around safe-area-pb shadow-[0_-5px_20px_rgba(0,0,0,0.8)]">
        <button
          onClick={() => handleNavClick('lotteries')}
          className={`flex flex-col items-center justify-center py-1 px-2 rounded-lg transition-all duration-150 cursor-pointer ${
            activeTab === 'lotteries' ? 'text-[#ffd700]' : 'text-[#8b92a2] hover:text-[#e1e2eb]'
          }`}
        >
          <div className={`p-1 rounded-lg ${activeTab === 'lotteries' ? 'bg-[#f5c451]/15 text-[#ffd700]' : ''}`}>
            <Flame className="w-4 h-4" />
          </div>
          <span className={`text-[10px] tracking-tight mt-0.5 leading-none ${activeTab === 'lotteries' ? 'font-bold text-[#ffd700]' : 'font-medium'}`}>
            Home
          </span>
        </button>

        <button
          onClick={() => handleNavClick('tickets')}
          className={`flex flex-col items-center justify-center py-1 px-2 rounded-lg transition-all duration-150 cursor-pointer relative ${
            activeTab === 'tickets' ? 'text-[#ffd700]' : 'text-[#8b92a2] hover:text-[#e1e2eb]'
          }`}
        >
          <div className={`p-1 rounded-lg ${activeTab === 'tickets' ? 'bg-[#f5c451]/15 text-[#ffd700]' : ''}`}>
            <Ticket className="w-4 h-4" />
          </div>
          <span className={`text-[10px] tracking-tight mt-0.5 leading-none flex items-center gap-0.5 ${activeTab === 'tickets' ? 'font-bold text-[#ffd700]' : 'font-medium'}`}>
            <span>Tickets</span>
            {!isLoggedIn && <Lock className="w-2 h-2 text-[#9b8f7c] opacity-70" />}
          </span>
        </button>

        <button
          onClick={() => handleNavClick('results')}
          className={`flex flex-col items-center justify-center py-1 px-2 rounded-lg transition-all duration-150 cursor-pointer relative ${
            activeTab === 'results' ? 'text-[#ffd700]' : 'text-[#8b92a2] hover:text-[#e1e2eb]'
          }`}
        >
          <div className={`p-1 rounded-lg ${activeTab === 'results' ? 'bg-[#f5c451]/15 text-[#ffd700]' : ''}`}>
            <Trophy className="w-4 h-4" />
          </div>
          <span className={`text-[10px] tracking-tight mt-0.5 leading-none flex items-center gap-0.5 ${activeTab === 'results' ? 'font-bold text-[#ffd700]' : 'font-medium'}`}>
            <span>Results</span>
            {!isLoggedIn && <Lock className="w-2 h-2 text-[#9b8f7c] opacity-70" />}
          </span>
        </button>

        <button
          onClick={() => handleNavClick('wallet')}
          className={`flex flex-col items-center justify-center py-1 px-2 rounded-lg transition-all duration-150 cursor-pointer relative ${
            activeTab === 'wallet' ? 'text-[#ffd700]' : 'text-[#8b92a2] hover:text-[#e1e2eb]'
          }`}
        >
          <div className={`p-1 rounded-lg ${activeTab === 'wallet' ? 'bg-[#f5c451]/15 text-[#ffd700]' : ''}`}>
            <Wallet className="w-4 h-4" />
          </div>
          <span className={`text-[10px] tracking-tight mt-0.5 leading-none flex items-center gap-0.5 ${activeTab === 'wallet' ? 'font-bold text-[#ffd700]' : 'font-medium'}`}>
            <span>Wallet</span>
            {!isLoggedIn && <Lock className="w-2 h-2 text-[#9b8f7c] opacity-70" />}
          </span>
        </button>

        {isLoggedIn ? (
          <button
            onClick={onOpenProfile}
            className="flex flex-col items-center justify-center py-1 px-2 rounded-lg transition-all duration-150 cursor-pointer text-[#8b92a2] hover:text-[#e1e2eb]"
          >
            <div className="p-1 rounded-lg">
              <User className="w-4 h-4" />
            </div>
            <span className="text-[10px] tracking-tight mt-0.5 leading-none font-medium">
              Profile
            </span>
          </button>
        ) : (
          <button
            onClick={() => setIsAuthModalOpen(true)}
            className="flex flex-col items-center justify-center py-1 px-2 rounded-lg transition-all duration-150 cursor-pointer text-[#ffd700]"
          >
            <div className="p-1 rounded-lg bg-[#ffd700]/15">
              <LogIn className="w-4 h-4" />
            </div>
            <span className="text-[10px] tracking-tight mt-0.5 leading-none font-bold">
              Login
            </span>
          </button>
        )}
      </div>
    </>
  );
}
