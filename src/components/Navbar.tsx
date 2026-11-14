import React, { useState, useRef, useEffect } from 'react';
import { useLottery } from '../context/LotteryContext';
import { useSoundFX } from '../hooks/useSoundFX';
import { 
  Wallet, 
  Menu, 
  ChevronDown,
  User,
  LogIn,
  Download,
  Coins,
  Bell,
  Sparkles,
  Volume2,
  VolumeX,
  Volume1,
  Flame,
  Ticket,
  Lock,
  Trophy
} from 'lucide-react';

interface NavbarProps {
  onOpenProfile?: () => void;
  onToggleSidebar?: () => void;
  onOpenNotifications?: () => void;
  onGoHome?: () => void;
  onSelectTab?: (tabId: string) => void;
}

export default function Navbar({ 
  onOpenProfile, 
  onToggleSidebar, 
  onOpenNotifications,
  onGoHome,
  onSelectTab 
}: NavbarProps) {
  const {
    user,
    profile,
    wallet,
    activeTab,
    setActiveTab,
    setIsAuthModalOpen,
    showToast,
    isNativeApp,
    apkDirectDownloadUrl,
    unreadNotificationsCount = 0
  } = useLottery();

  const {
    enabled: soundEnabled,
    volume: soundVolume,
    toggleSound,
    setVolume: setSoundVolume,
    playClick
  } = useSoundFX();

  const [showVolumeSlider, setShowVolumeSlider] = useState(false);
  const volumeMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (volumeMenuRef.current && !volumeMenuRef.current.contains(e.target)) {
        setShowVolumeSlider(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const isLoggedIn = !!user;

  const handleNavClick = (tabId) => {
    // Public tabs where unauthenticated visitors can freely navigate:
    const publicTabs = ['lotteries', 'contact', 'terms', 'privacy', 'rewards', 'leaderboard', 'profile', 'wallet'];
    if (!isLoggedIn && !publicTabs.includes(tabId)) {
      setIsAuthModalOpen(true);
      const tabNames = {
        tickets: 'My Tickets',
        results: 'Lottery Results & Past Winners',
        wallet: 'Flow Coin Wallet',
        profile: 'User Profile'
      };
      showToast(`Please log in to access ${tabNames[tabId] || 'this section'}!`, 'info');
      return;
    }

    if (tabId === 'lotteries') {
      if (onGoHome) {
        onGoHome();
        return;
      }
    }

    if (tabId === 'profile') {
      if (onOpenProfile) {
        onOpenProfile();
        return;
      }
    }

    if (onSelectTab) {
      onSelectTab(tabId);
    } else {
      setActiveTab(tabId);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const usernameDisplay = profile?.username 
    ? `@${profile.username}` 
    : (user?.user_metadata?.username 
      ? `@${user.user_metadata.username}` 
      : (user?.email ? user.email.split('@')[0] : 'Profile'));

  return (
    <>
      {/* ======================================================== */}
      {/* 1. TOP HEADER                                            */}
      {/* ======================================================== */}
      <header className="sticky top-0 z-40 bg-[#0B0F19]/95 backdrop-blur-xl border-b border-[rgba(245,196,81,0.18)]">
        <div className="w-full max-w-7xl 2xl:max-w-[1600px] 3xl:max-w-[1800px] 4k:max-w-[2000px] mx-auto px-2 xs:px-3 sm:px-4 lg:px-6 xl:px-8">
          <div className="flex items-center justify-between h-13 xs:h-14 sm:h-16">
            
            {/* LEFT: Sidebar Toggle & EarnFlow.In Branding */}
            <div className="flex items-center gap-1.5 xs:gap-2 sm:gap-3 shrink-0">
              
              {/* Sidebar Drawer Toggle (Mobile / Tablet / Desktop) */}
              <button
                onClick={onToggleSidebar}
                className="w-8 h-8 xs:w-8.5 xs:h-8.5 sm:w-9.5 sm:h-9.5 rounded-xl bg-[#111827] hover:bg-[#151C2B] text-amber-400 hover:text-white flex items-center justify-center border border-[#1F2737] hover:border-amber-500/40 transition-colors cursor-pointer shrink-0 shadow-sm"
                title="Toggle Casino Navigation"
                aria-label="Toggle Casino Navigation"
              >
                <Menu className="w-4 h-4 xs:w-4.5 xs:h-4.5" />
              </button>

              {/* Brand Logo & Clean Name (Always visible together across all viewports) */}
              <div 
                onClick={() => {
                  if (onGoHome) {
                    onGoHome();
                  } else {
                    handleNavClick('lotteries');
                  }
                }}
                className="flex items-center gap-1.5 xs:gap-2 sm:gap-2.5 cursor-pointer group shrink-0 select-none"
                role="button"
                tabIndex={0}
                title="Return to EarnFlow Home Page"
              >
                <div className="w-7 h-7 xs:w-8 xs:h-8 sm:w-9.5 sm:h-9.5 rounded-full p-0.5 shadow-[0_0_12px_rgba(245,196,81,0.3)] group-hover:scale-105 transition-transform duration-200 flex items-center justify-center shrink-0">
                  <img 
                    src="/logo.png" 
                    alt="EarnFlow.In" 
                    className="w-full h-full rounded-full object-cover border border-[#ffd700]/40" 
                  />
                </div>
                
                <div className="flex flex-col justify-center shrink-0">
                  <span className="font-display font-extrabold text-[13px] xs:text-base sm:text-lg lg:text-xl tracking-tight text-white group-hover:text-[#ffd700] transition-colors leading-tight whitespace-nowrap shrink-0">
                    EarnFlow<span className="text-[#F5C451]">.In</span>
                  </span>
                  {/* Subtitle visible ONLY on xl (1280px+) where ample space exists */}
                  <span className="text-[10px] text-[#94A3B8] font-medium hidden xl:block leading-none mt-0.5 whitespace-nowrap">
                    Casino & Multi-Game Platform
                  </span>
                </div>
              </div>
            </div>

            {/* RIGHT: Desktop Controls (Wallet + Notifications + Profile) / Mobile Icons */}
            <div className="flex items-center gap-1 xs:gap-1.5 sm:gap-2.5 shrink-0">
              
              {/* Optional Android APK direct download (hidden on small/medium displays) */}
              {!isNativeApp && (
                <a
                  href={apkDirectDownloadUrl}
                  download="earnflow.apk"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hidden 2xl:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-gradient-to-r from-amber-500/10 to-emerald-500/10 hover:from-amber-500/20 hover:to-emerald-500/20 border border-amber-500/30 text-[#ffd700] hover:text-white text-xs font-bold transition-all shadow-sm cursor-pointer whitespace-nowrap"
                  title="Download Official Android App"
                >
                  <Download className="w-3.5 h-3.5 text-[#ffd700]" />
                  <span>APK</span>
                </a>
              )}

              {/* Master Audio FX Toggle & Volume Popover (Desktop / Tablet sm+ ONLY) */}
              <div className="relative hidden sm:flex items-center" ref={volumeMenuRef}>
                <button
                  onClick={() => {
                    toggleSound();
                    playClick();
                  }}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    setShowVolumeSlider(prev => !prev);
                  }}
                  className={`w-8 h-8 xs:w-8.5 xs:h-8.5 sm:w-10 sm:h-10 rounded-xl border flex items-center justify-center transition-all cursor-pointer relative shrink-0 shadow-sm ${
                    soundEnabled 
                      ? 'bg-[#10131A] hover:bg-[#151C2B] text-amber-400 border-[#2D3545] hover:border-amber-400/50 hover:shadow-[0_0_12px_rgba(245,196,81,0.2)]' 
                      : 'bg-[#10131A] text-[#64748B] border-[#2D3545] hover:text-[#94A3B8] hover:border-slate-600'
                  }`}
                  title={soundEnabled ? `Sound FX On (${Math.round(soundVolume * 100)}%) — Tap to mute, right-click for volume` : 'Sound FX Muted — Tap to unmute'}
                  aria-label="Toggle Sound FX"
                >
                  {soundEnabled ? (
                    soundVolume > 0.4 ? <Volume2 className="w-4 h-4 text-amber-400" /> : <Volume1 className="w-4 h-4 text-amber-400" />
                  ) : (
                    <VolumeX className="w-4 h-4 text-[#64748B]" />
                  )}
                </button>

                {showVolumeSlider && (
                  <div className="absolute right-0 top-full mt-2 w-48 p-3 rounded-2xl bg-[#0B0F19]/95 backdrop-blur-xl border border-amber-500/30 shadow-2xl z-50 text-left animate-in fade-in zoom-in-95 duration-150">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[11px] font-bold text-white uppercase tracking-wider">Sound Volume</span>
                      <span className="text-[11px] font-mono-numbers font-bold text-amber-400">
                        {soundEnabled ? `${Math.round(soundVolume * 100)}%` : 'MUTED'}
                      </span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.05"
                      value={soundEnabled ? soundVolume : 0}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value);
                        if (!soundEnabled && val > 0) toggleSound();
                        setSoundVolume(val);
                      }}
                      className="w-full accent-amber-400 cursor-pointer h-1.5 bg-[#1F2737] rounded-lg appearance-none"
                    />
                    <div className="flex items-center justify-between mt-2.5 pt-2 border-t border-[#1F2737]">
                      <button
                        onClick={() => {
                          toggleSound();
                          playClick();
                        }}
                        className="text-[10px] text-amber-400 hover:text-white font-bold cursor-pointer"
                      >
                        {soundEnabled ? 'Mute' : 'Unmute'}
                      </button>
                      <button
                        onClick={() => setShowVolumeSlider(false)}
                        className="text-[10px] text-[#94A3B8] hover:text-white cursor-pointer"
                      >
                        Close
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {isLoggedIn ? (
                <>
                  {/* Flow Coin Balance Pill: Desktop/Tablet view ONLY (>= 640px) */}
                  <div 
                    onClick={() => handleNavClick('wallet')}
                    title="Click to view Flow Coin Virtual Wallet & Ledger (1 FLO = 1 USDT)"
                    className="hidden sm:flex cursor-pointer bg-[#10131A] hover:bg-[#151C2B] border border-[rgba(245,196,81,0.25)] hover:border-[#f5c451] rounded-xl px-2.5 sm:px-3 py-1 sm:py-1.5 items-center gap-1.5 transition-all shadow-inner"
                  >
                    <Coins className="w-3.5 h-3.5 text-[#ffd700] shrink-0" />
                    <span className="font-mono-numbers font-bold text-xs sm:text-sm text-[#ffd700] whitespace-nowrap">
                      {Number(wallet?.balance || 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                    </span>
                    <span className="text-[10px] sm:text-xs text-amber-400 font-extrabold font-mono-numbers">
                      FLO
                    </span>
                  </div>

                  {/* Realtime Notifications Bell (Desktop / Tablet sm+ ONLY) */}
                  <button
                    onClick={onOpenNotifications}
                    className="hidden sm:flex w-8 h-8 xs:w-8.5 xs:h-8.5 sm:w-9 sm:h-9 rounded-xl bg-[#10131A] hover:bg-[#151C2B] border border-[#2D3545] hover:border-amber-400/50 items-center justify-center text-[#94A3B8] hover:text-amber-300 transition-colors cursor-pointer relative shrink-0 shadow-sm"
                    title={unreadNotificationsCount > 0 ? `${unreadNotificationsCount} unread notification(s)` : 'View Notifications'}
                    aria-label="View Notifications"
                  >
                    <Bell className="w-4 h-4 sm:w-4 sm:h-4" />
                    {unreadNotificationsCount > 0 && (
                      <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-amber-500 text-black text-[9px] font-mono-numbers font-black flex items-center justify-center border border-[#0B0F19] shadow-sm animate-pulse">
                        {unreadNotificationsCount > 9 ? '9+' : unreadNotificationsCount}
                      </span>
                    )}
                  </button>

                  {/* User Profile Pill: Desktop / Tablet sm+ ONLY */}
                  <button
                    onClick={() => {
                      if (onOpenProfile) onOpenProfile();
                      else handleNavClick('profile');
                    }}
                    className={`hidden sm:flex items-center gap-1.5 text-xs font-mono-numbers px-2.5 py-1.5 rounded-xl border transition-all cursor-pointer shrink-0 shadow-sm ${
                      activeTab === 'profile'
                        ? 'bg-gradient-to-r from-[#ffd700] to-[#f5c451] text-[#0b0e14] border-[#fff2a3] font-bold'
                        : 'bg-[#151C2B] text-[#E1E2EB] border-[#2D3545] hover:border-[#F5C451]/50'
                    }`}
                    title="Open Player Profile"
                    aria-label="Open Player Profile"
                  >
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${
                      activeTab === 'profile' ? 'bg-[#0b0e14]/20 text-[#0b0e14]' : 'bg-[#05d5aa]/20 text-[#05d5aa]'
                    }`}>
                      <User className="w-3 h-3" />
                    </div>
                    <span className={`truncate max-w-[95px] lg:max-w-[120px] font-bold text-xs ${
                      activeTab === 'profile' ? 'text-[#0b0e14]' : 'text-white'
                    }`}>
                      {usernameDisplay}
                    </span>
                    <ChevronDown className={`w-3 h-3 shrink-0 ${
                      activeTab === 'profile' ? 'text-[#0b0e14]' : 'text-[#94A3B8]'
                    }`} />
                  </button>
                </>
              ) : (
                /* Login / Sign Up Button when unauthenticated */
                <button
                  onClick={() => setIsAuthModalOpen(true)}
                  className="btn-gold px-2.5 xs:px-3 sm:px-4.5 py-1.5 sm:py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-1 sm:gap-1.5 shadow-md cursor-pointer whitespace-nowrap shrink-0"
                >
                  <LogIn className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  <span>Login</span>
                </button>
              )}

            </div>

          </div>
        </div>
      </header>

      {/* ======================================================== */}
      {/* 2. REFINED BOTTOM MOBILE NAV BAR (< 768px)                */}
      {/* Three items only: 1. Home, 2. Wallet, 3. Profile          */}
      {/* ======================================================== */}
      <nav 
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#0B0F19]/95 backdrop-blur-xl border-t border-[rgba(245,196,81,0.18)] px-2 py-1 safe-area-pb shadow-[0_-5px_25px_rgba(0,0,0,0.85)]"
        aria-label="Mobile Bottom Navigation"
      >
        <div className="grid grid-cols-3 max-w-md mx-auto items-center">
          
          {/* 1. Home */}
          <button
            onClick={() => {
              if (onGoHome) onGoHome();
              else handleNavClick('lotteries');
            }}
            className={`min-h-[48px] flex flex-col items-center justify-center py-1 rounded-xl transition-all cursor-pointer ${
              activeTab === 'lotteries' ? 'text-[#ffd700]' : 'text-[#94A3B8] hover:text-[#E1E2EB]'
            }`}
          >
            <div className={`p-1.5 rounded-lg transition-colors ${activeTab === 'lotteries' ? 'bg-amber-500/15 text-[#ffd700]' : ''}`}>
              <Flame className="w-5 h-5" />
            </div>
            <span className={`text-[11px] tracking-tight mt-0.5 leading-none ${activeTab === 'lotteries' ? 'font-bold text-[#ffd700]' : 'font-medium'}`}>
              Home
            </span>
          </button>

          {/* 2. Virtual Wallet */}
          <button
            onClick={() => handleNavClick('wallet')}
            className={`min-h-[48px] flex flex-col items-center justify-center py-1 rounded-xl transition-all cursor-pointer ${
              activeTab === 'wallet' ? 'text-[#ffd700]' : 'text-[#94A3B8] hover:text-[#E1E2EB]'
            }`}
          >
            <div className={`p-1.5 rounded-lg transition-colors ${activeTab === 'wallet' ? 'bg-amber-500/15 text-[#ffd700]' : ''}`}>
              <Wallet className="w-5 h-5" />
            </div>
            <span className={`text-[11px] tracking-tight mt-0.5 leading-none ${activeTab === 'wallet' ? 'font-bold text-[#ffd700]' : 'font-medium'}`}>
              Wallet
            </span>
          </button>

          {/* 3. Player Profile */}
          <button
            onClick={() => {
              if (onOpenProfile) onOpenProfile();
              else handleNavClick('profile');
            }}
            className={`min-h-[48px] flex flex-col items-center justify-center py-1 rounded-xl transition-all cursor-pointer ${
              activeTab === 'profile' ? 'text-[#ffd700]' : 'text-[#94A3B8] hover:text-[#E1E2EB]'
            }`}
          >
            <div className={`p-1.5 rounded-lg transition-colors ${activeTab === 'profile' ? 'bg-amber-500/15 text-[#ffd700]' : ''}`}>
              <User className="w-5 h-5" />
            </div>
            <span className={`text-[11px] tracking-tight mt-0.5 leading-none ${activeTab === 'profile' ? 'font-bold text-[#ffd700]' : 'font-medium'}`}>
              Profile
            </span>
          </button>

        </div>
      </nav>
    </>
  );
}
