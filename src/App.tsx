import React, { useState, useEffect, useMemo } from 'react';
import { LotteryProvider, useLottery } from './context/LotteryContext';
import Navbar from './components/Navbar';
import Sidebar from './components/Sidebar';
import CasinoLobby from './components/CasinoLobby';
import Footer from './components/Footer';
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
import ResponsibleGamingPage from './pages/ResponsibleGamingPage';
import RefundPolicyPage from './pages/RefundPolicyPage';
import PaymentPolicyPage from './pages/PaymentPolicyPage';
import DisclaimerPage from './pages/DisclaimerPage';
import FaqPage from './pages/FaqPage';
import HowItWorksPage from './pages/HowItWorksPage';
import LotteryRulesPage from './pages/LotteryRulesPage';
import PromotionPage from './pages/PromotionPage';
import AdminPortal from './admin/AdminPortal';
import GamePage from './pages/GamePage';
import { getGameById } from './engine';
import { PwaProvider, usePwa } from './context/PwaContext';
import PwaInstallBanner from './components/PwaInstallBanner';
import PwaInstallModal from './components/PwaInstallModal';
import { ShieldCheck, Flame, Trophy, Sparkles, ShieldAlert, Lock, LogIn } from 'lucide-react';

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: any;
}

class GlobalErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Application Runtime Error Caught by GlobalErrorBoundary:', error, errorInfo);
  }

  handleReload = () => {
    try {
      sessionStorage.clear();
    } catch (e) {}
    window.location.href = '/';
  };

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      const errMsg = this.state.error?.message || String(this.state.error || 'Unknown error');
      const errStack = this.state.error?.stack || '';

      return (
        <div className="min-h-screen bg-[#0B0F19] text-[#F8FAFC] flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-[#111827] border border-amber-500/30 rounded-2xl p-6 text-center space-y-4 shadow-2xl shadow-black/80">
            <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mx-auto text-amber-400 shadow-[0_0_25px_rgba(245,196,81,0.2)]">
              <ShieldAlert className="w-8 h-8" />
            </div>
            <h2 className="font-display font-extrabold text-xl text-white">
              Application Refresh Notice
            </h2>
            <p className="text-xs text-[#94A3B8] leading-relaxed">
              An unexpected render issue occurred while loading this view. Click below to reload the platform cleanly.
            </p>

            {/* Error Details in development or debug */}
            <div className="text-left bg-black/60 p-3 rounded-xl border border-red-500/30 text-xs font-mono text-red-400 overflow-x-auto max-h-40">
              <p className="font-bold text-red-300 break-words">{errMsg}</p>
              {errStack && (
                <pre className="text-[10px] text-gray-400 mt-1 whitespace-pre-wrap leading-tight">{errStack.slice(0, 400)}</pre>
              )}
            </div>

            <div className="flex gap-2">
              <button
                onClick={this.handleReset}
                className="flex-1 py-2.5 rounded-xl bg-[#1f2737] hover:bg-[#2d3748] text-white font-bold text-xs uppercase tracking-wider transition-colors cursor-pointer"
              >
                Try Again
              </button>
              <button
                onClick={this.handleReload}
                className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-extrabold text-xs uppercase tracking-wider transition-colors cursor-pointer shadow-lg shadow-amber-500/20"
              >
                Reload Platform
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

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
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);

  // Parse dedicated game routes: /games/:gameSlug or /games/:gameSlug/:roomId
  const parseGameRoute = (path) => {
    if (!path) return null;
    const cleanPath = path.split('?')[0].split('#')[0];
    const match = cleanPath.match(/^\/games\/([^\/]+)(?:\/([^\/]+))?/);
    if (match) {
      const slug = match[1]?.toLowerCase();
      if (slug === 'four-digit-lottery' || slug === 'lottery' || slug === '4-digit-lottery') {
        return { gameSlug: 'four-digit-lottery', roomId: match[2] || null };
      }
      // Any other game slug: clean redirect to /
      if (typeof window !== 'undefined') {
        try {
          window.history.replaceState(null, '', '/');
        } catch (e) {}
      }
      return null;
    }
    if (cleanPath === '/lottery' || cleanPath === '/four-digit-lottery') {
      return { gameSlug: 'four-digit-lottery', roomId: null };
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
  const navigate = (path: string) => {
    try {
      window.history.pushState(null, '', path);
    } catch (e) {}
    const gr = parseGameRoute(path);
    setCurrentGameRoute(gr);
    if (gr) {
      setActiveGameId(null);
    }
    if (path.startsWith('/admin')) {
      setIsAdminRoute(true);
      setIsViewingUserLobby(false);
    } else {
      setIsAdminRoute(false);
    }

    const onTx = isTransactionHistoryRoute(path);
    setIsTransactionRoute(onTx);
    const clean = path.toLowerCase().split('?')[0].split('#')[0].replace(/\/+$/, '');

    if (onTx) {
      setActiveTab('transactions', false);
      document.title = 'Transaction History · EarnFlow.in';
    } else if (clean === '' || clean === '/') {
      setActiveTab('lotteries', false);
      document.title = 'EarnFlow - Four Digit Lottery | Online USDT 4-Digit Lucky Draw';
    } else if (clean === '/profile') {
      setActiveTab('profile', false);
      document.title = 'Player Profile · EarnFlow.in';
    } else if (clean === '/wallet') {
      setActiveTab('wallet', false);
      document.title = 'USDT Wallet & 24h Payouts · EarnFlow.in';
    } else if (clean === '/my-tickets' || clean === '/tickets') {
      setActiveTab('tickets', false);
      document.title = 'My Tickets · EarnFlow.in';
    } else if (clean === '/results' || clean === '/lottery-results' || clean === '/draw-results') {
      setActiveTab('results', false);
      document.title = 'Results · EarnFlow.in';
    } else if (clean === '/terms' || clean === '/terms-and-conditions' || clean === '/legal/terms') {
      setActiveTab('terms', false);
      document.title = 'Terms & Conditions · EarnFlow.in';
    } else if (clean === '/privacy' || clean === '/privacy-policy' || clean === '/legal/privacy') {
      setActiveTab('privacy', false);
      document.title = 'Privacy Policy · EarnFlow.in';
    } else if (clean === '/responsible-gaming' || clean === '/responsible-gaming-policy') {
      setActiveTab('responsible-gaming', false);
      document.title = 'Responsible Gaming · EarnFlow.in';
    } else if (clean === '/how-it-works' || clean === '/howitworks') {
      setActiveTab('how-it-works', false);
      document.title = 'How It Works · EarnFlow.in';
    } else if (clean === '/lottery-rules' || clean === '/rules' || clean === '/rules-and-prizes' || clean === '/lottery-rules-and-prize-distribution') {
      setActiveTab('rules', false);
      document.title = 'Lottery Rules & Prize Distribution · EarnFlow.in';
    } else if (clean === '/faq' || clean === '/faqs' || clean === '/frequently-asked-questions') {
      setActiveTab('faq', false);
      document.title = 'Frequently Asked Questions · EarnFlow.in';
    } else if (clean === '/contact-support' || clean === '/contact' || clean === '/contact-us' || clean === '/support' || clean === '/help') {
      setActiveTab('contact', false);
      document.title = 'Contact & Support · EarnFlow.in';
    } else if (clean === '/promotion' || clean === '/promotions' || clean === '/referral') {
      setActiveTab('promotion', false);
      document.title = 'Promotions & Referral Hub · EarnFlow.in';
    } else if (clean === '/daily-bonus' || clean === '/rewards' || clean === '/dailybonus' || clean === '/bonus') {
      setActiveTab('rewards', false);
      document.title = 'Daily Bonus & Rewards · EarnFlow.in';
    } else if (clean === '/refund-policy') {
      setActiveTab('refund-policy', false);
      document.title = 'Refund and Cancellation Policy · EarnFlow.in';
    } else if (clean === '/payment-policy') {
      setActiveTab('payment-policy', false);
      document.title = 'Payment Policy · EarnFlow.in';
    } else if (clean === '/disclaimer') {
      setActiveTab('disclaimer', false);
      document.title = 'Disclaimer · EarnFlow.in';
    }

    const mainEl = document.getElementById('main-content');
    if (mainEl) mainEl.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  };

  const handleGoHome = () => {
    setIsTransactionRoute(false);
    setCurrentGameRoute(null);
    setIsAdminRoute(false);
    setActiveGameId(null);
    setActiveTab('lotteries', false);
    navigate('/');
  };

  const handleSelectTab = (tab: string) => {
    if (tab === 'lotteries') {
      handleGoHome();
      return;
    }
    setCurrentGameRoute(null);
    setActiveGameId(null);
    setIsTransactionRoute(tab === 'transactions');

    const tabRouteMap: Record<string, string> = {
      'how-it-works': '/how-it-works',
      'rules': '/lottery-rules',
      'faq': '/faq',
      'responsible-gaming': '/responsible-gaming',
      'terms': '/terms-and-conditions',
      'privacy': '/privacy-policy',
      'contact': '/contact-support',
      'support': '/contact-support',
      'results': '/results',
      'tickets': '/my-tickets',
      'wallet': '/wallet',
      'profile': '/profile',
      'promotion': '/promotion',
      'transactions': '/transaction-history',
      'refund-policy': '/refund-policy',
      'payment-policy': '/payment-policy',
      'disclaimer': '/disclaimer',
      'rewards': '/daily-bonus',
      'daily-bonus': '/daily-bonus',
      'leaderboard': '/?tab=leaderboard'
    };

    const targetUrl = tabRouteMap[tab] || `/?tab=${tab}`;
    navigate(targetUrl);
  };
  
  // Dedicated check for isolated Admin Route
  const [isAdminRoute, setIsAdminRoute] = useState(() => {
    return window.location.pathname.startsWith('/admin') || 
           window.location.hash === '#admin' || 
           window.location.search.includes('admin=true');
  });

  const [isViewingUserLobby, setIsViewingUserLobby] = useState(() => {
    if (window.location.pathname.startsWith('/admin') || window.location.hash === '#admin' || window.location.search.includes('admin=true')) {
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
      const onAdmin = window.location.pathname.startsWith('/admin') || 
                      window.location.hash === '#admin' || 
                      window.location.search.includes('admin=true');
      setIsAdminRoute(onAdmin);
      if (onAdmin) {
        setIsViewingUserLobby(false);
      } else {
        const userMode = sessionStorage.getItem('earnflow_view_mode_user') === 'true';
        setIsViewingUserLobby(userMode);
      }

      // Capture optional referral query parameter
      const search = new URLSearchParams(window.location.search || '');
      const refCode = search.get('ref') || search.get('r');
      if (refCode) {
        try {
          localStorage.setItem('earnflow_referrer_code', refCode.trim());
        } catch (e) {}
      }

      const gr = parseGameRoute(window.location.pathname);
      setCurrentGameRoute(gr);

      const pParam = search.get('p')?.toLowerCase().replace(/\/+$/, '');
      const onTx = isTransactionHistoryRoute(window.location.pathname) || 
                   (pParam && isTransactionHistoryRoute('/' + pParam)) ||
                   window.location.hash === '#transaction-history' || 
                   window.location.hash === '#transactions' ||
                   search.get('tab') === 'transactions' ||
                   search.get('tab') === 'transaction-history';
      setIsTransactionRoute(onTx);
      const cleanPath = window.location.pathname.toLowerCase().replace(/\/+$/, '');
      if (onTx) {
        setActiveTab('transactions', false);
        document.title = 'Transaction History · EarnFlow.in';
      } else if (cleanPath === '/how-it-works' || cleanPath === '/howitworks' || search.get('tab') === 'how-it-works' || search.get('tab') === 'howitworks') {
        setActiveTab('how-it-works', false);
        document.title = 'How It Works · EarnFlow.in';
      } else if (cleanPath === '/lottery-rules' || cleanPath === '/rules' || cleanPath === '/rules-and-prizes' || search.get('tab') === 'rules' || search.get('tab') === 'lottery-rules') {
        setActiveTab('rules', false);
        document.title = 'Lottery Rules & Prize Distribution · EarnFlow.in';
      } else if (cleanPath === '/faq' || cleanPath === '/faqs' || cleanPath === '/frequently-asked-questions' || search.get('tab') === 'faq' || search.get('tab') === 'faqs') {
        setActiveTab('faq', false);
        document.title = 'Frequently Asked Questions · EarnFlow.in';
      } else if (cleanPath === '/responsible-gaming' || cleanPath === '/responsible-gaming-policy' || search.get('tab') === 'responsible-gaming') {
        setActiveTab('responsible-gaming', false);
        document.title = 'Responsible Gaming · EarnFlow.in';
      } else if (cleanPath === '/terms' || cleanPath === '/terms-and-conditions' || cleanPath === '/legal/terms' || search.get('tab') === 'terms') {
        setActiveTab('terms', false);
        document.title = 'Terms & Conditions · EarnFlow.in';
      } else if (cleanPath === '/privacy' || cleanPath === '/privacy-policy' || cleanPath === '/legal/privacy' || search.get('tab') === 'privacy') {
        setActiveTab('privacy', false);
        document.title = 'Privacy Policy · EarnFlow.in';
      } else if (
        cleanPath === '/contact-support' ||
        cleanPath === '/contact' ||
        cleanPath === '/contact-us' ||
        cleanPath === '/support' ||
        cleanPath === '/help' ||
        pParam === 'contact-support' ||
        pParam === 'contact' ||
        pParam === 'support' ||
        pParam === 'help' ||
        search.get('tab') === 'contact' ||
        search.get('tab') === 'support' ||
        search.get('tab') === 'help'
      ) {
        setActiveTab('contact', false);
        document.title = 'Contact & Support · EarnFlow.in';
      } else if (cleanPath === '/promotion' || cleanPath === '/promotions' || cleanPath === '/referral' || search.get('tab') === 'promotion') {
        setActiveTab('promotion', false);
        document.title = 'Promotions & Referral Hub · EarnFlow.in';
      } else if (cleanPath === '/tickets' || cleanPath === '/my-tickets' || search.get('tab') === 'tickets') {
        setActiveTab('tickets', false);
        document.title = 'My Tickets · EarnFlow.in';
      } else if (cleanPath === '/daily-bonus' || cleanPath === '/rewards' || cleanPath === '/dailybonus' || cleanPath === '/bonus' || search.get('tab') === 'rewards' || search.get('tab') === 'daily-bonus') {
        setActiveTab('rewards', false);
        document.title = 'Daily Bonus & Rewards · EarnFlow.in';
      } else if (cleanPath === '/results' || cleanPath === '/lottery-results' || cleanPath === '/draw-results' || search.get('tab') === 'results') {
        setActiveTab('results', false);
        document.title = 'Results · EarnFlow.in';
      } else if (cleanPath === '/refund-policy' || search.get('tab') === 'refund-policy') {
        setActiveTab('refund-policy', false);
        document.title = 'Refund and Cancellation Policy · EarnFlow.in';
      } else if (cleanPath === '/payment-policy' || search.get('tab') === 'payment-policy') {
        setActiveTab('payment-policy', false);
        document.title = 'Payment Policy · EarnFlow.in';
      } else if (cleanPath === '/disclaimer' || search.get('tab') === 'disclaimer') {
        setActiveTab('disclaimer', false);
        document.title = 'Disclaimer · EarnFlow.in';
      } else if (!gr && (cleanPath === '/' || cleanPath === '' || cleanPath === '/profile' || cleanPath === '/wallet')) {
        const tab = search.get('tab') || (cleanPath === '/profile' ? 'profile' : cleanPath === '/wallet' ? 'wallet' : null);
        if (tab) {
          setActiveTab(tab, false);
        } else {
          setActiveTab('lotteries', false);
        }
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

  // Comprehensive Layout-Level Scroll Reset: Ensure any route/tab switch unconditionally resets scroll to top (0,0)
  useEffect(() => {
    const mainEl = document.getElementById('main-content');
    if (mainEl) {
      mainEl.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    }
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, [activeTab, currentGameRoute, isTransactionRoute]);

  // Strict Login Gating for sensitive direct modals/actions
  useEffect(() => {
    if (!user && (activeTab === 'tickets' || activeTab === 'transactions')) {
      const tabNames = {
        tickets: 'My Tickets',
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
        onGoHome={handleGoHome}
        onSelectTab={handleSelectTab}
        isInGameRoom={Boolean(currentGameRoute?.roomId)}
        onOpenProfile={() => {
          handleSelectTab('profile');
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

      {/* Main Layout: Left Navigation Sidebar + Content Area */}
      <div className="flex-1 min-h-0 flex overflow-hidden w-full max-w-[2000px] mx-auto min-w-0">
        
        {/* Left Navigation Sidebar */}
        <Sidebar
          isOpen={isMobileSidebarOpen}
          onClose={() => setIsMobileSidebarOpen(false)}
          isCollapsed={isSidebarCollapsed}
          onToggleCollapse={() => setIsSidebarCollapsed(prev => !prev)}
          activeTab={isTransactionRoute ? 'transactions' : (currentGameRoute ? `game-${currentGameRoute.gameSlug}` : activeTab)}
          onSelectTab={handleSelectTab}
          onLaunchGame={(gid) => {
            setIsTransactionRoute(false);
            const g = getGameById(gid);
            navigate('/games/' + (g?.slug || gid));
          }}
        />

        {/* Main Content Pane */}
        <main 
          id="main-content" 
          className={`flex-1 min-w-0 h-full text-left flex flex-col overscroll-contain ${
            currentGameRoute?.roomId 
              ? 'overflow-hidden p-1 xs:p-1.5 sm:p-2' 
              : 'overflow-y-auto pt-2.5 sm:pt-3.5 pb-0'
          }`}
        >
          
          <div className={currentGameRoute?.roomId ? 'flex-1 min-h-0 flex flex-col overflow-hidden h-full' : 'w-full flex-grow shrink-0 px-2.5 xs:px-4 sm:px-6 lg:px-8'}>
            {/* DEDICATED SEPARATE PAGE: TRANSACTION HISTORY */}
            {(isTransactionRoute || activeTab === 'transactions') ? (
              <TransactionHistoryPage 
                onBackToWallet={() => {
                  handleSelectTab('wallet');
                }}
                onBackToHome={handleGoHome}
              />
            ) : currentGameRoute ? (
              /* DEDICATED GAME ROUTE VIEW (LOBBY OR DEDICATED ROOM) */
              <GamePage
                key={`${currentGameRoute.gameSlug}-${currentGameRoute.roomId || 'lobby'}`}
                gameSlug={currentGameRoute.gameSlug}
                roomId={currentGameRoute.roomId}
                onNavigate={(path) => navigate(path)}
                onBackToHome={handleGoHome}
              />
            ) : (
              <>
                {/* VIEW 1: DEDICATED FOUR-DIGIT LOTTERY HOMEPAGE */}
                {activeTab === 'lotteries' && (
                  <CasinoLobby 
                    onLaunchGame={(gidOrEventId) => {
                      if (gidOrEventId && gidOrEventId.startsWith('evt-')) {
                        navigate('/games/lottery/' + gidOrEventId);
                      } else {
                        navigate('/game/lottery');
                      }
                    }}
                    onOpenLotteryRules={() => setIsRulesModalOpen(true)}
                    onShowResult={(evt) => setSelectedEventForModal(evt)}
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
              {activeTab === 'results' && (
                <ResultsView />
              )}

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
              {(activeTab === 'rewards' || activeTab === 'daily-bonus') && (
                <RewardsView />
              )}

              {/* VIEW 9: SOCIAL LEADERBOARD & HIGH ROLLERS */}
              {activeTab === 'leaderboard' && (
                <LeaderboardView />
              )}

              {/* VIEW 10: CUSTOMER SUPPORT & CONTACT */}
              {(activeTab === 'contact' || activeTab === 'support') && (
                <ContactPage onBackToHome={handleGoHome} />
              )}

              {/* VIEW 18: PROMOTIONS & REFERRAL HUB */}
              {activeTab === 'promotion' && (
                <PromotionPage onBackToHome={handleGoHome} />
              )}

              {/* VIEW 12: TERMS & CONDITIONS PAGE */}
              {activeTab === 'terms' && (
                <TermsPage 
                  onBackToHome={handleGoHome} 
                  onNavigateToTab={handleSelectTab}
                />
              )}

              {/* VIEW 13: PRIVACY POLICY PAGE */}
              {activeTab === 'privacy' && (
                <PrivacyPolicyPage 
                  onBackToHome={handleGoHome} 
                  onNavigateToTab={handleSelectTab}
                />
              )}

              {/* VIEW 14: RESPONSIBLE GAMING PAGE */}
              {activeTab === 'responsible-gaming' && (
                <ResponsibleGamingPage 
                  onBackToHome={handleGoHome} 
                  onNavigateToTab={handleSelectTab}
                />
              )}

              {/* VIEW 15: REFUND & CANCELLATION POLICY PAGE */}
              {activeTab === 'refund-policy' && (
                <RefundPolicyPage 
                  onBackToHome={handleGoHome} 
                  onNavigateToTab={handleSelectTab}
                />
              )}

              {/* VIEW 16: PAYMENT POLICY PAGE */}
              {activeTab === 'payment-policy' && (
                <PaymentPolicyPage 
                  onBackToHome={handleGoHome} 
                  onNavigateToTab={handleSelectTab}
                />
              )}

              {/* VIEW 17: DISCLAIMER PAGE */}
              {activeTab === 'disclaimer' && (
                <DisclaimerPage 
                  onBackToHome={handleGoHome} 
                  onNavigateToTab={handleSelectTab}
                />
              )}

              {/* VIEW 18: FAQ PAGE */}
              {activeTab === 'faq' && (
                <FaqPage 
                  onBackToHome={handleGoHome} 
                  onNavigateToTab={handleSelectTab}
                />
              )}

              {/* VIEW 19: HOW IT WORKS PAGE */}
              {activeTab === 'how-it-works' && (
                <HowItWorksPage 
                  onBackToHome={handleGoHome} 
                  onNavigateToTab={handleSelectTab}
                />
              )}

              {/* VIEW 20: LOTTERY RULES & PRIZE DISTRIBUTION */}
              {activeTab === 'rules' && (
                <LotteryRulesPage 
                  onBackToHome={handleGoHome}
                  onNavigateToTab={handleSelectTab}
                />
              )}
            </>
          )}
          </div>

          {/* Platform Public Footer — Hidden in Active Dedicated Game Rooms */}
          {!currentGameRoute?.roomId && (
            <Footer
              onSelectTab={handleSelectTab}
              onGoHome={handleGoHome}
            />
          )}

        </main>

      </div>

      {/* Global Modals */}
      {selectedEventForModal && (
        <TicketModal
          event={selectedEventForModal}
          onClose={() => setSelectedEventForModal(null)}
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
      
      {/* PWA Add to Screen Prompt & Modal (Hidden in dedicated active game rooms) */}
      {!currentGameRoute?.roomId && <PwaInstallBanner />}
      <PwaInstallModal />
    </div>
  );
}

export default function App() {
  return (
    <GlobalErrorBoundary>
      <PwaProvider>
        <LotteryProvider>
          <LotteryAppContent />
        </LotteryProvider>
      </PwaProvider>
    </GlobalErrorBoundary>
  );
}
