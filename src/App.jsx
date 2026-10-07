import React, { useState, useEffect } from 'react';
import { LotteryProvider, useLottery } from './context/LotteryContext';
import Navbar from './components/Navbar';
import HeroBanner from './components/HeroBanner';
import LotteryCard from './components/LotteryCard';
import TicketModal from './components/TicketModal';
import WalletView from './components/WalletView';
import WalletModal from './components/WalletModal';
import MyTicketsView from './components/MyTicketsView';
import ResultsView from './components/ResultsView';
import ProfileModal from './components/ProfileModal';
import AuthModal from './components/AuthModal';
import UsernameSetupModal from './components/UsernameSetupModal';
import WinnerCelebrationModal from './components/WinnerCelebrationModal';
import RulesModal from './components/RulesModal';
import Toast from './components/Toast';
import TermsPage from './pages/TermsPage';
import PrivacyPolicyPage from './pages/PrivacyPolicyPage';
import ContactPage from './pages/ContactPage';
import AdminPortal from './admin/AdminPortal';
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

  const [isRulesModalOpen, setIsRulesModalOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  
  // Dedicated check for isolated Admin Route
  const [isAdminRoute, setIsAdminRoute] = useState(() => {
    return window.location.pathname === '/admin' || 
           window.location.hash === '#admin' || 
           window.location.search.includes('admin=true');
  });

  useEffect(() => {
    const handleHashChange = () => {
      setIsAdminRoute(
        window.location.pathname === '/admin' || 
        window.location.hash === '#admin' || 
        window.location.search.includes('admin=true')
      );
    };

    window.addEventListener('hashchange', handleHashChange);
    window.addEventListener('popstate', handleHashChange);
    return () => {
      window.removeEventListener('hashchange', handleHashChange);
      window.removeEventListener('popstate', handleHashChange);
    };
  }, []);

  // Strict Login Gating: unauthenticated visitors cannot access tickets, results, or wallet
  useEffect(() => {
    if (!user && (activeTab === 'tickets' || activeTab === 'results' || activeTab === 'wallet')) {
      const tabNames = {
        tickets: 'My Tickets',
        results: 'Draw Results & Past Winners',
        wallet: 'USDT Wallet & 24h Payouts'
      };
      setActiveTab('lotteries');
      setIsAuthModalOpen(true);
      showToast(`Please log in to access ${tabNames[activeTab] || 'this section'}!`, 'info');
    }
  }, [user, activeTab]);

  const activeEvents = events.filter(e => e.status === 'active');

  // 1. STRICT DATABASE ROLE CHECK:
  // If user has database role 'super_admin', they ONLY see and access the Admin Panel!
  if (profile?.role === 'super_admin') {
    return <AdminPortal />;
  }

  // 2. If Admin Route is accessed (/#admin or /admin):
  if (isAdminRoute) {
    // If logged in as normal user (not super_admin), strictly block access
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
                onClick={() => {
                  window.location.hash = '';
                  window.history.pushState(null, '', '/');
                  setIsAdminRoute(false);
                }}
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

    return <AdminPortal />;
  }

  // Otherwise: Pure Public User Platform
  return (
    <div className="min-h-screen bg-[#0b0e14] text-[#e1e2eb] flex flex-col">
      {/* Top Navbar */}
      <Navbar onOpenProfile={() => setIsProfileOpen(true)} />

      {/* Main Public User Content */}
      <main className="flex-1 pb-20 md:pb-8">
        
        {/* VIEW 1: LOTTERIES LOBBY / HOMEPAGE */}
        {activeTab === 'lotteries' && (
          <div>
            <HeroBanner 
              onPlayNowClick={(evt) => {
                if (!user) {
                  showToast('Please log in to enter the event and pick lucky digits!', 'info');
                  setIsAuthModalOpen(true);
                  return;
                }
                setSelectedEventForModal(evt || activeEvents[0]);
              }}
              onRulesClick={() => setIsRulesModalOpen(true)}
            />

            {/* Active Pools Section */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Flame className="w-4 h-4 text-[#ffd700]" />
                    <span className="text-xs font-mono-numbers text-[#f5c451] uppercase font-bold tracking-wider">
                      HIGH-STAKES AUTONOMOUS CONTRACTS
                    </span>
                  </div>
                  <h2 className="font-display font-extrabold text-2xl sm:text-4xl text-white">
                    Active <span className="text-gold-gradient">Lottery Pools</span>
                  </h2>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setIsRulesModalOpen(true)}
                    className="btn-ghost-gold px-4 py-2 rounded-xl text-xs font-bold cursor-pointer"
                  >
                    Prize Allocation Guide
                  </button>
                  <button
                    onClick={() => {
                      if (!user) {
                        showToast('Please log in to view draw results & past winners!', 'info');
                        setIsAuthModalOpen(true);
                        return;
                      }
                      setActiveTab('results');
                    }}
                    className="px-4 py-2 rounded-xl bg-[#191c22] hover:bg-[#272a31] text-xs font-bold text-white border border-[#32353c] cursor-pointer flex items-center gap-1.5"
                  >
                    <span>Past Draws</span>
                    {!user && <Lock className="w-3 h-3 text-[#9b8f7c]" />}
                  </button>
                </div>
              </div>

              {/* Grid of Pools */}
              {loadingEvents ? (
                <div className="py-20 text-center glass-panel rounded-3xl border border-[#272a31] p-8 space-y-4">
                  <div className="w-12 h-12 mx-auto rounded-full border-2 border-[#ffd700] border-t-transparent animate-spin" />
                  <p className="text-sm font-mono-numbers text-[#ffd700] font-semibold">
                    Syncing on-chain pools from database...
                  </p>
                </div>
              ) : activeEvents.length === 0 ? (
                <div className="py-16 text-center glass-panel rounded-3xl border border-[#272a31] p-8 space-y-4">
                  <div className="w-16 h-16 mx-auto rounded-2xl bg-[#1e2638] flex items-center justify-center text-[#ffd700] border border-[#f5c451]/30">
                    <Sparkles className="w-8 h-8 animate-pulse text-[#ffd700]" />
                  </div>
                  <h3 className="text-xl font-display font-extrabold text-white">
                    No Active Pools Right Now
                  </h3>
                  <p className="text-xs text-[#9b8f7c] max-w-md mx-auto leading-relaxed">
                    All previous lottery pools have concluded or been settled. New autonomous smart contracts will be launched shortly by the administration.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {activeEvents.map((event) => (
                    <LotteryCard
                      key={event.id}
                      event={event}
                      onSelect={(evt) => {
                        if (!user) {
                          showToast('Please log in to enter the event and purchase tickets!', 'info');
                          setIsAuthModalOpen(true);
                          return;
                        }
                        setSelectedEventForModal(evt);
                      }}
                    />
                  ))}
                </div>
              )}

              {/* How it works feature banners */}
              <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="glass-panel p-6 rounded-2xl border border-[rgba(245,196,81,0.2)] space-y-3">
                  <div className="w-10 h-10 rounded-xl bg-[rgba(245,196,81,0.15)] flex items-center justify-center text-[#ffd700]">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <h3 className="font-display font-bold text-base text-white">
                    1. Pick 4 Lucky Digits
                  </h3>
                  <p className="text-xs text-[#9b8f7c] leading-relaxed">
                    Select any 4 digits between 0000 and 9999 or use our Quick Pick randomizer to generate combinations.
                  </p>
                </div>

                <div className="glass-panel p-6 rounded-2xl border border-[rgba(5,213,170,0.2)] space-y-3">
                  <div className="w-10 h-10 rounded-xl bg-[rgba(5,213,170,0.15)] flex items-center justify-center text-[#05d5aa]">
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <h3 className="font-display font-bold text-base text-white">
                    2. Provably Fair SHA-256
                  </h3>
                  <p className="text-xs text-[#9b8f7c] leading-relaxed">
                    Pre-committed cryptographic hashes ensure completely tamper-proof draws executed automatically.
                  </p>
                </div>

                <div className="glass-panel p-6 rounded-2xl border border-[rgba(0,242,254,0.2)] space-y-3">
                  <div className="w-10 h-10 rounded-xl bg-[rgba(0,242,254,0.15)] flex items-center justify-center text-[#00f2fe]">
                    <Trophy className="w-5 h-5" />
                  </div>
                  <h3 className="font-display font-bold text-base text-white">
                    3. Auto-Credit & 24h Payouts
                  </h3>
                  <p className="text-xs text-[#9b8f7c] leading-relaxed">
                    Winning prizes are credited instantly to your account. Withdraw your USDT to any TRC-20 wallet within 24 hours.
                  </p>
                </div>
              </div>

            </div>
          </div>
        )}

        {/* VIEW 2: WALLET & 24H PAYOUTS */}
        {activeTab === 'wallet' && (user ? <WalletView /> : (
          <AuthRequiredPrompt 
            title="USDT Wallet & 24h Payouts" 
            onLogin={() => setIsAuthModalOpen(true)} 
            onHome={() => setActiveTab('lotteries')} 
          />
        ))}

        {/* VIEW 3: MY TICKETS */}
        {activeTab === 'tickets' && (user ? (
          <MyTicketsView onOpenPicker={() => setSelectedEventForModal(activeEvents[0])} />
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

        {/* VIEW 5: TERMS & CONDITIONS PAGE */}
        {activeTab === 'terms' && (
          <TermsPage onBackToHome={() => setActiveTab('lotteries')} />
        )}

        {/* VIEW 6: PRIVACY POLICY PAGE */}
        {activeTab === 'privacy' && (
          <PrivacyPolicyPage onBackToHome={() => setActiveTab('lotteries')} />
        )}

        {/* VIEW 7: CONTACT US PAGE */}
        {activeTab === 'contact' && (
          <ContactPage onBackToHome={() => setActiveTab('lotteries')} />
        )}

      </main>

      {/* Global Modals */}
      {selectedEventForModal && (
        <TicketModal
          event={selectedEventForModal}
          onClose={() => setSelectedEventForModal(null)}
        />
      )}

      {/* Profile Modal */}
      <ProfileModal 
        isOpen={isProfileOpen} 
        onClose={() => setIsProfileOpen(false)}
      />

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
      <Toast />

      {/* Platform Public Footer */}
      <footer className="mt-auto border-t border-[rgba(245,196,81,0.15)] bg-[#07090d] py-10 pb-24 md:pb-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-3">
              <img 
                src="/logo.png" 
                alt="EarnFlow.In USDT" 
                className="w-10 h-10 rounded-full border border-[#ffd700]/40 object-cover shadow-md" 
              />
              <div>
                <span className="font-display font-black text-lg text-white">
                  EarnFlow<span className="text-[#f5c451]">.In</span> <span className="text-[#ffd700]">USDT</span>
                </span>
                <p className="text-xs text-[#9b8f7c]">
                  Sovereign Autonomous Crypto Lottery Protocol · TRON (TRC-20)
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4 text-xs text-[#9b8f7c] flex-wrap justify-center">
              <span className="flex items-center gap-1 text-[#05d5aa]">
                <ShieldCheck className="w-3.5 h-3.5" />
                CertiK Audited
              </span>
              <span>•</span>
              <span className="flex items-center gap-1 text-[#ffd700]">
                24-Hour SLA Payout Guarantee
              </span>
              <span>•</span>
              <span className="font-mono-numbers">
                Chainlink VRF Oracle
              </span>
            </div>
          </div>
          
          {/* Legal Navigation Links */}
          <div className="mt-8 pt-6 border-t border-[#1f2737] flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[#9b8f7c]">
            <div className="text-center sm:text-left">
              © 2026 EarnFlow.In Protocol. All drawings are provably fair, verifiable on the public blockchain, and executed autonomously with guaranteed 24-hour USDT withdrawal SLA.
            </div>

            <div className="flex items-center gap-4 font-semibold text-xs shrink-0 flex-wrap justify-center sm:justify-end">
              <button
                onClick={() => {
                  setActiveTab('contact');
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                className="hover:text-[#ffd700] transition-colors cursor-pointer text-[#ffd700]"
              >
                Contact Support
              </button>
              <span>•</span>
              <button
                onClick={() => {
                  setActiveTab('terms');
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                className="hover:text-[#ffd700] transition-colors cursor-pointer"
              >
                Terms & Conditions
              </button>
              <span>•</span>
              <button
                onClick={() => {
                  setActiveTab('privacy');
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                className="hover:text-[#05d5aa] transition-colors cursor-pointer"
              >
                Privacy Policy
              </button>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <LotteryProvider>
      <LotteryAppContent />
    </LotteryProvider>
  );
}
