import React, { useState, useEffect, useMemo } from 'react';
import { LotteryProvider, useLottery } from './context/LotteryContext';
import Navbar from './components/Navbar';
import Sidebar from './components/Sidebar';
import CasinoLobby from './components/CasinoLobby';
import LiveBetsTicker from './components/LiveBetsTicker';
import GameModal from './components/GameModal';
import ProvablyFairModal from './components/ProvablyFairModal';
import HeroBanner from './components/HeroBanner';
import LotteryCard from './components/LotteryCard';
import TicketModal from './components/TicketModal';
import WalletView from './components/WalletView';
import WalletModal from './components/WalletModal';
import MyTicketsView from './components/MyTicketsView';
import ResultsView from './components/ResultsView';
import ProfileView from './components/ProfileView';
import AuthModal from './components/AuthModal';
import UsernameSetupModal from './components/UsernameSetupModal';
import WinnerCelebrationModal from './components/WinnerCelebrationModal';
import RulesModal from './components/RulesModal';
import Toast from './components/Toast';
import RewardsView from './components/RewardsView';
import LeaderboardView from './components/LeaderboardView';
import SupportView from './components/SupportView';
import TransactionHistoryView from './components/TransactionHistoryView';
import TransactionHistoryPage from './pages/TransactionHistoryPage';
import NotificationsModal from './components/NotificationsModal';
import TermsPage from './pages/TermsPage';
import PrivacyPolicyPage from './pages/PrivacyPolicyPage';
import ContactPage from './pages/ContactPage';
import AdminPortal from './admin/AdminPortal';
import GamePage from './pages/GamePage';
import { getGameById } from './engine';
import { PwaProvider, usePwa } from './context/PwaContext';
import PwaInstallBanner from './components/PwaInstallBanner';
import PwaInstallModal from './components/PwaInstallModal';
import { ShieldCheck, Flame, Trophy, Sparkles, ShieldAlert, Lock, LogIn } from 'lucide-react';

function AuthRequiredPrompt({ title, onLogin, onHome }) {
  return (
    <div className="max-w-md mx-auto px-4 py-20 text-center space-y-4 animate-in fade-in zoom-in-95 duration-200">
      <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mx-auto text-amber-400 shadow-[0_0_25px_rgba(245,196,81,0.2)]">
        <Lock className="w-8 h-8" />
      </div>
      <span className="text-[10px] font-mono-numbers px-2.5 py-1 rounded bg-amber-500/15 text-amber-400 border border-amber-500/30 font-bold uppercase tracking-wider">
        Authentication Required
      </span>
      <h2 className="font-display font-extrabold text-2xl text-white">
        Please Log In
      </h2>
      <p className="text-xs text-[#9b8f7c] leading-relaxed max-w-sm mx-auto">
        You must log in to access <strong className="text-white">{title}</strong>. Guests can explore the public lottery lobby and view active pools.
      </p>
      <div className="flex flex-col sm:flex-row gap-3 pt-3 max-w-xs mx-auto">
        <button
          onClick={onLogin}
          className="btn-gold flex-1 py-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer shadow-lg shadow-[#f5c451]/20"
        >
          <LogIn className="w-4 h-4" />
          <span>Login / Sign Up</span>
        </button>
        <button
          onClick={onHome}
          className="px-4 py-3 rounded-xl bg-[#141924] hover:bg-[#1a2130] text-xs text-[#9b8f7c] hover:text-white border border-[#272a31] transition-colors cursor-pointer"
        >
          Back to Lobby
        </button>
      </div>
    </div>
  );
}

function LotteryAppContent() {
  const { 
    events, 
    loadingEvents,
    activeTab, 
    setActiveTab, 
    selectedEventForModal, 
    setSelectedEventForModal,
    user,
    profile,
    logout,
    setIsAuthModalOpen,
    showToast
  } = useLottery();

  const { triggerInstall, isInstalled } = usePwa();

  const [isRulesModalOpen, setIsRulesModalOpen] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth >= 1024 && window.innerWidth < 1440;
    }
    return false;
  });

  // Responsive sidebar collapse on window resize
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024 && window.innerWidth < 1440) {
        setIsSidebarCollapsed(true);
      } else if (window.innerWidth >= 1440) {
        setIsSidebarCollapsed(false);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const [activeGameId, setActiveGameId] = useState(null);
  const [isFairnessModalOpen, setIsFairnessModalOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);

  // Parse dedicated game routes: /games/:gameSlug or /games/:gameSlug/:roomId
  const parseGameRoute = (path) => {
    if (!path) return null;
    const cleanPath = path.split('?')[0].split('#')[0];
    const match = cleanPath.match(/^\/games\/([^\/]+)(?:\/([^\/]+))?/);
    if (match) {
      return { gameSlug: match[1], roomId: match[2] || null };
    }
    return null;
  };

  const isTransactionHistoryRoute = (path) => {
    if (!path) return false;
    const cleanPath = path.toLowerCase().split('?')[0].split('#')[0].replace(/\/+$/, '');
    return cleanPath === '/transaction-history' || cleanPath === '/transactions';
  };

  const [currentGameRoute, setCurrentGameRoute] = useState(() => {
    if (typeof window !== 'undefined') {
      return parseGameRoute(window.location.pathname);
    }
    return null;
  });

  const [isTransactionRoute, setIsTransactionRoute] = useState(() => {
    if (typeof window !== 'undefined') {
      const search = new URLSearchParams(window.location.search || '');
      const pParam = search.get('p')?.toLowerCase().replace(/\/+$/, '');
      const path = window.location.pathname;
      return isTransactionHistoryRoute(path) || 
             (pParam && isTransactionHistoryRoute('/' + pParam)) ||
             window.location.hash === '#transaction-history' || 
             window.location.hash === '#transactions' ||
             search.get('tab') === 'transactions' ||
             search.get('tab') === 'transaction-history';
    }
    return false;
  });

  // Programmatic navigation for SPA routing
  const navigate = (path) => {
    try {
      window.history.pushState(null, '', path);
    } catch (e) {}
    const gr = parseGameRoute(path);
    setCurrentGameRoute(gr);
    if (gr) {
      setActiveGameId(null);
    }
    if (path === '/admin') {
      setIsAdminRoute(true);
      setIsViewingUserLobby(false);
    } else {
      setIsAdminRoute(false);
    }

    const onTx = isTransactionHistoryRoute(path);
    setIsTransactionRoute(onTx);
    if (onTx) {
      setActiveTab('transactions', false);
      document.title = 'Transaction History · EarnFlow.In';
    }

    const mainEl = document.getElementById('main-content');
    if (mainEl) mainEl.scrollTo({ top: 0, behavior: 'smooth' });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  
  // Dedicated check for isolated Admin Route
  const [isAdminRoute, setIsAdminRoute] = useState(() => {
    return window.location.pathname === '/admin' || 
           window.location.hash === '#admin' || 
           window.location.search.includes('admin=true');
  });

  const [isViewingUserLobby, setIsViewingUserLobby] = useState(() => {
    if (window.location.pathname === '/admin' || window.location.hash === '#admin' || window.location.search.includes('admin=true')) {
      return false;
    }
    return sessionStorage.getItem('earnflow_view_mode_user') === 'true';
  });

  const switchToUserLobby = () => {
    sessionStorage.setItem('earnflow_view_mode_user', 'true');
    setIsViewingUserLobby(true);
    setIsAdminRoute(false);
    navigate('/');
  };

  const switchToAdminConsole = () => {
    sessionStorage.removeItem('earnflow_view_mode_user');
    setIsViewingUserLobby(false);
    setIsAdminRoute(true);
    navigate('/admin');
  };

  useEffect(() => {
    const handleLocationChange = () => {
      const onAdmin = window.location.pathname === '/admin' || 
                      window.location.hash === '#admin' || 
                      window.location.search.includes('admin=true');
      setIsAdminRoute(onAdmin);
      if (onAdmin) {
        setIsViewingUserLobby(false);
      } else {
        const userMode = sessionStorage.getItem('earnflow_view_mode_user') === 'true';
        setIsViewingUserLobby(userMode);
      }

      const gr = parseGameRoute(window.location.pathname);
      setCurrentGameRoute(gr);

      const search = new URLSearchParams(window.location.search || '');
      const pParam = search.get('p')?.toLowerCase().replace(/\/+$/, '');
      const onTx = isTransactionHistoryRoute(window.location.pathname) || 
                   (pParam && isTransactionHistoryRoute('/' + pParam)) ||
                   window.location.hash === '#transaction-history' || 
                   window.location.hash === '#transactions' ||
                   search.get('tab') === 'transactions' ||
                   search.get('tab') === 'transaction-history';
      setIsTransactionRoute(onTx);
      if (onTx) {
        setActiveTab('transactions', false);
        document.title = 'Transaction History · EarnFlow.In';
      }
    };

    window.addEventListener('hashchange', handleLocationChange);
    window.addEventListener('popstate', handleLocationChange);

    // Clean OAuth access token fragment from the address bar
    if (window.location.hash && (window.location.hash.includes('access_token=') || window.location.hash.includes('refresh_token='))) {
      setTimeout(() => {
        window.history.replaceState(null, '', window.location.pathname + window.location.search);
      }, 50);
    }

    return () => {
      window.removeEventListener('hashchange', handleLocationChange);
      window.removeEventListener('popstate', handleLocationChange);
    };
  }, []);

  // Strict Login Gating: unauthenticated visitors cannot access tickets, results, wallet, transactions, or profile
  useEffect(() => {
    if (!user && (activeTab === 'tickets' || activeTab === 'results' || activeTab === 'wallet' || activeTab === 'profile' || activeTab === 'transactions')) {
      const tabNames = {
        tickets: 'My Tickets',
        results: 'Draw Results & Past Winners',
        wallet: 'USDT Wallet & 24h Payouts',
        profile: 'Player Profile & Account Settings',
        transactions: 'Transaction History'
      };
      setActiveTab('lotteries');
      setIsAuthModalOpen(true);
      showToast(`Please log in to access ${tabNames[activeTab] || 'this section'}!`, 'info');
    }
  }, [user, activeTab]);

  // Active events strictly filters out any pool whose draw time has expired
  const activeEvents = useMemo(() => {
    const now = Date.now();
    return events.filter(e => e.status === 'active' && (!e.drawTime || e.drawTime > now));
  }, [events]);

  // If currently selected modal event expires or concluded, auto-close and switch to results
  useEffect(() => {
    if (selectedEventForModal) {
      const isConcluded = selectedEventForModal.status === 'completed' || 
        (selectedEventForModal.drawTime && selectedEventForModal.drawTime <= Date.now());
      if (isConcluded) {
        setSelectedEventForModal(null);
        setActiveTab('results');
        showToast('This round has concluded! Redirecting to Results to view drawn winning digits.', 'info');
      }
    }
  }, [selectedEventForModal, events]);

  // 1. DATABASE ROLE & ROUTE CHECK:
  // If user has role 'super_admin' and is on /admin or hasn't selected User Lobby mode:
  if ((profile?.role === 'super_admin' && !isViewingUserLobby) || isAdminRoute) {
    // If logged in as normal user (not super_admin), strictly block access to admin route
    if (user && profile && profile.role !== 'super_admin') {
      return (
        <div className="min-h-screen bg-[#07090d] flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-[#0d1117] border border-red-500/40 rounded-3xl p-6 sm:p-8 text-center shadow-2xl relative z-10">
            <div className="w-14 h-14 rounded-2xl bg-red-500/10 border border-red-500/30 flex items-center justify-center mx-auto mb-3 text-red-400">
              <ShieldAlert className="w-7 h-7" />
            </div>
            <span className="text-[10px] font-mono-numbers px-2.5 py-1 rounded bg-red-500/10 text-red-400 border border-red-500/30 uppercase font-bold tracking-wider">
              403 Forbidden
            </span>
            <h1 className="font-display font-bold text-xl text-white mt-3">
              Access Denied
            </h1>
            <p className="text-xs text-[#9b8f7c] mt-2 leading-relaxed">
              Your account (<strong className="text-white">@{profile.username || user.email}</strong>) has role <span className="font-mono text-amber-400">'{profile.role || 'user'}'</span>.
            </p>
            <p className="text-xs text-red-300 mt-2 font-medium">
              Only database accounts with role 'super_admin' can access the Admin Panel.
            </p>
            <div className="mt-6 flex flex-col gap-2">
              <button
                onClick={switchToUserLobby}
                className="w-full py-2.5 rounded-xl btn-gold text-xs font-bold flex items-center justify-center gap-2 cursor-pointer shadow-md"
              >
                Return to User Panel
              </button>
              <button
                onClick={logout}
                className="w-full py-2.5 rounded-xl bg-[#141924] hover:bg-[#1a2130] text-xs text-red-400 font-medium cursor-pointer transition-colors"
              >
                Sign Out & Switch Account
              </button>
            </div>
          </div>
        </div>
      );
    }

    return <AdminPortal onSwitchToUserLobby={switchToUserLobby} />;
  }

  // Otherwise: Pure Public User Platform
  return (
    <div className="h-screen h-[100dvh] bg-[#0B0F19] text-[#F8FAFC] flex flex-col font-sans overflow-hidden">
      {/* Top Navbar */}
      <Navbar 
        onOpenProfile={() => {
          setIsTransactionRoute(false);
          setActiveTab('profile');
        }} 
        onToggleSidebar={() => {
          if (typeof window !== 'undefined' && window.innerWidth < 1024) {
            setIsMobileSidebarOpen(prev => !prev);
          } else {
            setIsSidebarCollapsed(prev => !prev);
          }
        }}
        onOpenNotifications={() => setIsNotificationsOpen(true)}
      />

      {/* Live Bets and High Rollers Realtime Activity Ticker */}
      <div className="shrink-0">
        <LiveBetsTicker onSelectGame={(gid) => {
          setIsTransactionRoute(false);
          const g = getGameById(gid);
          navigate('/games/' + (g?.slug || gid));
        }} />
      </div>

      {/* Main Layout: Left Navigation Sidebar + Content Area */}
      <div className="flex-1 min-h-0 flex overflow-hidden w-full max-w-[2000px] mx-auto min-w-0">
        
        {/* Left Navigation Sidebar */}
        <Sidebar
          isOpen={isMobileSidebarOpen}
          onClose={() => setIsMobileSidebarOpen(false)}
          isCollapsed={isSidebarCollapsed}
          onToggleCollapse={() => setIsSidebarCollapsed(prev => !prev)}
          activeTab={isTransactionRoute ? 'transactions' : (currentGameRoute ? `game-${currentGameRoute.gameSlug}` : activeTab)}
          onSelectTab={(tab) => {
            if (currentGameRoute) {
              navigate('/');
            }
            if (tab === 'transactions') {
              navigate('/transaction-history');
            } else if (tab === 'fairness') {
              setIsFairnessModalOpen(true);
            } else {
              setIsTransactionRoute(false);
              navigate(tab === 'lotteries' ? '/' : `/?tab=${tab}`);
              setActiveTab(tab);
            }
          }}
          onLaunchGame={(gid) => {
            setIsTransactionRoute(false);
            const g = getGameById(gid);
            navigate('/games/' + (g?.slug || gid));
          }}
        />

        {/* Main Content Pane */}
        <main id="main-content" className="flex-1 min-w-0 h-full overflow-y-auto pb-24 md:pb-12 px-2.5 xs:px-4 sm:px-6 lg:px-8 py-4 sm:py-6 text-left flex flex-col">
          
          <div className="flex-1">
            {/* DEDICATED SEPARATE PAGE: TRANSACTION HISTORY */}
            {(isTransactionRoute || activeTab === 'transactions') ? (
              <TransactionHistoryPage 
                onBackToWallet={() => {
                  navigate('/?tab=wallet');
                  setActiveTab('wallet');
                }}
                onBackToHome={() => {
                  navigate('/');
                  setActiveTab('lotteries');
                }}
              />
            ) : currentGameRoute ? (
              /* DEDICATED GAME ROUTE VIEW (LOBBY OR DEDICATED ROOM) */
              <GamePage
                gameSlug={currentGameRoute.gameSlug}
                roomId={currentGameRoute.roomId}
                onNavigate={(path) => navigate(path)}
                onBackToHome={() => {
                  navigate('/');
                  setActiveTab('lotteries');
                }}
              />
            ) : (
              <>
                {/* VIEW 1: MULTI-GAME CASINO LOBBY & FOUR-DIGIT LOTTERY */}
                {activeTab === 'lotteries' && (
                  <CasinoLobby 
                    onLaunchGame={(gid) => {
                      const g = getGameById(gid);
                      navigate('/games/' + (g?.slug || gid));
                    }}
                    onOpenLotteryRules={() => setIsRulesModalOpen(true)}
                  />
                )}

                {/* VIEW 2: WALLET & 24H PAYOUTS */}
                {activeTab === 'wallet' && (user ? (
                  <WalletView onOpenTransactionHistory={() => navigate('/transaction-history')} />
                ) : (
                  <AuthRequiredPrompt 
                    title="USDT Wallet & 24h Payouts" 
                    onLogin={() => setIsAuthModalOpen(true)} 
                    onHome={() => setActiveTab('lotteries')} 
                  />
                ))}

              {/* VIEW 3: MY TICKETS */}
              {activeTab === 'tickets' && (user ? (
                <MyTicketsView 
                  onOpenPicker={() => {
                    const liveEvent = activeEvents[0];
                    if (liveEvent) {
                      setSelectedEventForModal(liveEvent);
                    } else {
                      setActiveTab('lotteries');
                      showToast('All previous rounds have ended! Check Results tab.', 'info');
                    }
                  }} 
                />
              ) : (
                <AuthRequiredPrompt 
                  title="My Lottery Tickets" 
                  onLogin={() => setIsAuthModalOpen(true)} 
                  onHome={() => setActiveTab('lotteries')} 
                />
              ))}

              {/* VIEW 4: RESULTS */}
              {activeTab === 'results' && (user ? <ResultsView /> : (
                <AuthRequiredPrompt 
                  title="Draw Results & Past Winners" 
                  onLogin={() => setIsAuthModalOpen(true)} 
                  onHome={() => setActiveTab('lotteries')} 
                />
              ))}

              {/* VIEW 5: PLAYER PROFILE FULL SCREEN PAGE */}
              {activeTab === 'profile' && (user ? (
                <ProfileView 
                  onSwitchToAdmin={switchToAdminConsole}
                  onBackToHome={() => setActiveTab('lotteries')}
                />
              ) : (
                <AuthRequiredPrompt 
                  title="Player Profile & Account Settings" 
                  onLogin={() => setIsAuthModalOpen(true)} 
                  onHome={() => setActiveTab('lotteries')} 
                />
              ))}

              {/* VIEW 8: REWARDS & DAILY BONUS FAUCET */}
              {activeTab === 'rewards' && (
                <RewardsView />
              )}

              {/* VIEW 9: SOCIAL LEADERBOARD & HIGH ROLLERS */}
              {activeTab === 'leaderboard' && (
                <LeaderboardView />
              )}

              {/* VIEW 10: CUSTOMER SUPPORT, FAQ & RESPONSIBLE GAMING */}
              {(activeTab === 'support' || activeTab === 'contact') && (
                <SupportView />
              )}

              {/* VIEW 11: TERMS & CONDITIONS PAGE */}
              {activeTab === 'terms' && (
                <TermsPage onBackToHome={() => setActiveTab('lotteries')} />
              )}

              {/* VIEW 12: PRIVACY POLICY PAGE */}
              {activeTab === 'privacy' && (
                <PrivacyPolicyPage onBackToHome={() => setActiveTab('lotteries')} />
              )}
            </>
          )}
          </div>

          {/* Platform Public Footer — Inside Scrollable Main Container */}
          <footer className="mt-12 sm:mt-16 border-t border-[rgba(245,196,81,0.15)] bg-[#07090d] py-8 sm:py-10 pb-24 md:pb-10 -mx-2.5 xs:-mx-4 sm:-mx-6 lg:-mx-8 px-2.5 xs:px-4 sm:px-6 lg:px-8">
            <div className="w-full max-w-7xl 2xl:max-w-[1600px] 3xl:max-w-[1800px] 4k:max-w-[2000px] mx-auto">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 sm:gap-6">
                <div className="flex items-center gap-2.5 xs:gap-3 text-center sm:text-left">
                  <img 
                    src="/logo.png" 
                    alt="EarnFlow.In" 
                    className="w-8 xs:w-10 h-8 xs:h-10 rounded-full border border-[#ffd700]/40 object-cover shadow-md shrink-0" 
                  />
                  <div>
                    <span className="font-display font-black text-base xs:text-lg text-white">
                      EarnFlow<span className="text-[#f5c451]">.In</span>
                    </span>
                    <p className="text-[11px] xs:text-xs text-[#9b8f7c]">
                      Provably Fair Casino & Lottery Platform · Flow Coins (FC)
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2.5 xs:gap-4 text-[11px] xs:text-xs text-[#9b8f7c] flex-wrap justify-center">
                  <span className="flex items-center gap-1 text-[#05d5aa]">
                    <ShieldCheck className="w-3 xs:w-3.5 h-3 xs:h-3.5" />
                    CertiK Audited
                  </span>
                  <span>•</span>
                  <span className="flex items-center gap-1 text-[#ffd700]">
                    24-Hour Payout Guarantee
                  </span>
                </div>
              </div>
              
              {/* Legal Navigation Links */}
              <div className="mt-6 sm:mt-8 pt-4 sm:pt-6 border-t border-[#1f2737] flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-4 text-[11px] xs:text-xs text-[#9b8f7c]">
                <div className="text-center sm:text-left leading-relaxed">
                  © 2026 EarnFlow.In Platform. All drawings and games are provably fair, verifiable on the public ledger with Flow Coins (FC).
                </div>

                <div className="flex items-center gap-3 xs:gap-4 font-semibold text-[11px] xs:text-xs shrink-0 flex-wrap justify-center sm:justify-end">
                  <a
                    href="/contact"
                    onClick={(e) => {
                      e.preventDefault();
                      setIsTransactionRoute(false);
                      setActiveTab('contact');
                      const mainEl = document.getElementById('main-content');
                      if (mainEl) mainEl.scrollTo({ top: 0, behavior: 'smooth' });
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    className="hover:text-[#ffd700] transition-colors cursor-pointer text-[#ffd700]"
                  >
                    Contact Support
                  </a>
                  <span>•</span>
                  <a
                    href="/terms-and-conditions"
                    onClick={(e) => {
                      e.preventDefault();
                      setIsTransactionRoute(false);
                      setActiveTab('terms');
                      const mainEl = document.getElementById('main-content');
                      if (mainEl) mainEl.scrollTo({ top: 0, behavior: 'smooth' });
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    className="hover:text-[#ffd700] transition-colors cursor-pointer"
                  >
                    Terms & Conditions
                  </a>
                  <span>•</span>
                  <a
                    href="/privacy-policy"
                    onClick={(e) => {
                      e.preventDefault();
                      setIsTransactionRoute(false);
                      setActiveTab('privacy');
                      const mainEl = document.getElementById('main-content');
                      if (mainEl) mainEl.scrollTo({ top: 0, behavior: 'smooth' });
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    className="hover:text-[#05d5aa] transition-colors cursor-pointer"
                  >
                    Privacy Policy
                  </a>
                  {!isInstalled && (
                    <>
                      <span>•</span>
                      <button
                        onClick={triggerInstall}
                        className="hover:text-[#ffd700] transition-colors cursor-pointer text-[#ffd700] flex items-center gap-1 font-bold"
                      >
                        <span>📲 Install App</span>
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          </footer>

        </main>

      </div>

      {/* Global Modals */}
      {selectedEventForModal && (
        <TicketModal
          event={selectedEventForModal}
          onClose={() => setSelectedEventForModal(null)}
        />
      )}

      {/* Universal Modular Game Modal (Crash, Dice, Mines, etc.) */}
      {activeGameId && (
        <GameModal
          gameId={activeGameId}
          onClose={() => setActiveGameId(null)}
        />
      )}

      {/* Provably Fair Auditor Modal */}
      {isFairnessModalOpen && (
        <ProvablyFairModal
          isOpen={isFairnessModalOpen}
          onClose={() => setIsFairnessModalOpen(false)}
          event={activeEvents[0] || events[0]}
        />
      )}


      {/* Auth Modal for Email/Password & Google Login */}
      <AuthModal />

      {/* One-Time Username Setup for Google/OAuth Users */}
      <UsernameSetupModal />

      <WalletModal />
      <WinnerCelebrationModal />
      <RulesModal 
        isOpen={isRulesModalOpen} 
        onClose={() => setIsRulesModalOpen(false)} 
      />
      <NotificationsModal
        isOpen={isNotificationsOpen}
        onClose={() => setIsNotificationsOpen(false)}
        onNavigate={(tab) => {
          setIsNotificationsOpen(false);
          setActiveTab(tab);
        }}
      />
      <Toast />
      
      {/* PWA Add to Screen Prompt & Modal */}
      <PwaInstallBanner />
      <PwaInstallModal />
    </div>
  );
}

export default function App() {
  return (
    <PwaProvider>
      <LotteryProvider>
        <LotteryAppContent />
      </LotteryProvider>
    </PwaProvider>
  );
}
