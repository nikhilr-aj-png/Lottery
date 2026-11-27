import React, { useEffect } from 'react';
import {
  Trophy,
  Award,
  Wallet,
  LayoutGrid,
  Ticket,
  History,
  Gift,
  Share2,
  X,
  Menu
} from 'lucide-react';
import { useLottery } from '../context/LotteryContext';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  activeTab: string;
  onSelectTab: (tabId: string) => void;
  onLaunchGame?: (gameId: string) => void;
  isInGameRoom?: boolean;
  onGoHome?: () => void;
}

interface NavItem {
  id: string;
  label: string;
  icon: any;
  badge?: string;
  image?: string;
  isLobby?: boolean;
  isLottery?: boolean;
  requiresAuth?: boolean;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

export default function Sidebar({
  isOpen,
  onClose,
  isCollapsed,
  onToggleCollapse,
  activeTab,
  onSelectTab,
  onLaunchGame,
  isInGameRoom = false,
  onGoHome
}: SidebarProps) {
  const { wallet } = useLottery();

  // Prevent background scrolling when mobile drawer is open outside Game Room
  useEffect(() => {
    if (isOpen && !isInGameRoom) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen, isInGameRoom]);

  // Handle ESC key to dismiss mobile drawer
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && onClose) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const navSections: NavSection[] = [
    {
      title: 'Lottery',
      items: [
        { id: 'lotteries', label: 'Home', icon: LayoutGrid, isLobby: true },
        { id: 'tickets', label: 'My Ticket', icon: Ticket, requiresAuth: true },
        { id: 'results', label: 'Results', icon: Trophy },
        { id: 'leaderboard', label: 'Leaderboard', icon: Award, requiresAuth: true }
      ]
    },
    {
      title: 'Account & Hub',
      items: [
        { id: 'rewards', label: 'Daily Bonus', icon: Gift, badge: 'FREE', requiresAuth: true },
        { id: 'wallet', label: 'USDT Wallet', icon: Wallet, requiresAuth: true },
        { id: 'promotion', label: 'Promotions & Referral', icon: Share2, badge: 'HOT', requiresAuth: true },
        { id: 'transactions', label: 'Transaction History', icon: History, requiresAuth: true }
      ]
    }
  ];

  const handleItemClick = (item: any) => {
    if (item.isLottery) {
      if (onLaunchGame) {
        onLaunchGame('four-digit-lottery');
      } else {
        onSelectTab('lotteries');
      }
      if (onClose) onClose();
      return;
    }

    onSelectTab(item.id);
    if (onClose) onClose();
  };

  const renderSidebarBody = (inGameMode: boolean, collapsedState: boolean) => (
    <div
      className={`h-full flex flex-col overflow-hidden text-left relative ${inGameMode
          ? 'pt-1.5 sm:pt-2.5 lg:pt-3 pb-1.5 sm:pb-2.5 lg:pb-3 px-1.5 sm:px-2.5'
          : 'pt-3 pb-3 px-2 sm:px-2.5'
        }`}
    >
      {/* Single Three-Line Hamburger Menu Button at Top of Sidebar during Immersive Gameplay */}
      {inGameMode && (
        <div
          className={`shrink-0 pb-1 sm:pb-1.5 lg:pb-2 mb-1 lg:mb-1.5 border-b border-[#1F2737] flex items-center ${collapsedState ? 'justify-center' : 'gap-2.5 px-1'
            }`}
        >
          <button
            type="button"
            onClick={onToggleCollapse}
            data-sidebar-toggle="true"
            aria-expanded={!collapsedState}
            aria-label={collapsedState ? 'Expand Sidebar' : 'Collapse Sidebar'}
            title={collapsedState ? 'Expand Menu' : 'Collapse Menu'}
            className="w-7.5 h-7.5 sm:w-8 sm:h-8 lg:w-9 lg:h-9 rounded-xl bg-[#111827] hover:bg-[#1B2438] text-white hover:text-[#FBBF24] border border-[#1F2737] hover:border-amber-500/40 flex items-center justify-center cursor-pointer transition-colors shrink-0 shadow-sm"
          >
            <Menu className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
          </button>

          {!collapsedState && (
            <button
              type="button"
              onClick={() => (onGoHome ? onGoHome() : onSelectTab('lotteries'))}
              className="font-display font-extrabold text-sm sm:text-base tracking-tight text-white hover:text-[#FBBF24] transition-colors whitespace-nowrap truncate cursor-pointer"
              title="EarnFlow.in Home"
            >
              EarnFlow<span className="text-[#F5C451]">.in</span>
            </button>
          )}
        </div>
      )}

      {/* Navigation Sections — Scrollable Menu Items Area */}
      <div
        className={`flex-1 min-h-0 overflow-y-auto overflow-x-hidden no-scrollbar pr-0.5 overscroll-contain ${inGameMode ? 'space-y-0.5 lg:space-y-2' : 'space-y-2'
          }`}
      >
        {navSections.map((sec, secIdx) => (
          <div key={secIdx} className="space-y-0.5">
            {sec.title ? (
              <div className={`${inGameMode ? 'h-3 sm:h-3.5 lg:h-5' : 'h-5'} flex items-center px-2 overflow-hidden`}>
                {!collapsedState ? (
                  <span className="text-[8.5px] sm:text-[9px] lg:text-[10px] font-mono-numbers font-bold uppercase tracking-wider text-[#94A3B8] whitespace-nowrap transition-opacity duration-200">
                    {sec.title}
                  </span>
                ) : (
                  <div className="w-5 sm:w-6 h-px bg-[#1F2737] mx-auto" />
                )}
              </div>
            ) : null}

            <div className="space-y-0.5">
              {sec.items.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id || (item.isLobby && activeTab === 'lotteries');
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleItemClick(item)}
                    className={`w-full flex items-center gap-2 sm:gap-2.5 rounded-lg lg:rounded-xl text-[11px] sm:text-xs font-semibold transition-colors duration-150 cursor-pointer group ${inGameMode ? 'h-7 sm:h-7.5 lg:h-11' : 'min-h-[42px] py-2'
                      } ${collapsedState ? 'justify-center px-0 overflow-hidden' : 'justify-between px-2.5'
                      } ${isActive
                        ? 'bg-[#7C3AED] lg:bg-amber-500 text-white lg:text-black font-extrabold shadow-md shadow-purple-500/20 lg:shadow-amber-500/20'
                        : 'text-[#94A3B8] hover:text-white hover:bg-[#151C2B]'
                      }`}
                    title={item.label}
                    aria-label={item.label}
                  >
                    <div className={`flex items-center gap-2 sm:gap-2.5 min-w-0 ${collapsedState ? 'justify-center' : ''}`}>
                      <Icon
                        className={`w-4 h-4 shrink-0 ${isActive
                            ? 'text-white lg:text-black'
                            : 'text-amber-400 group-hover:scale-110 transition-transform'
                          }`}
                      />
                      {!collapsedState && (
                        <span className="leading-snug text-left">{item.label}</span>
                      )}
                    </div>

                    {!collapsedState && item.badge && (
                      <span
                        className={`text-[8px] sm:text-[9px] font-mono-numbers px-1.5 py-0.2 rounded font-black shrink-0 whitespace-nowrap ${isActive
                            ? 'bg-black/30 lg:bg-black text-white lg:text-amber-300'
                            : 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                          }`}
                      >
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Bottom Balance Widget */}
      <div className={`shrink-0 mt-auto border-t border-[#1F2737] bg-[#0B0F19] z-20 ${inGameMode ? 'pt-1 sm:pt-1.5 lg:pt-2' : 'pt-2'}`}>
        {!collapsedState ? (
          <button
            type="button"
            onClick={() => {
              if (onSelectTab) onSelectTab('wallet');
              if (onClose) onClose();
            }}
            className={`w-full text-left bg-[#111827] hover:bg-[#161F33] border border-[#1F2737] transition-colors cursor-pointer ${inGameMode ? 'px-2 py-1 sm:py-1.5 lg:p-2.5 rounded-xl lg:rounded-2xl' : 'p-2.5 rounded-2xl'
              }`}
          >
            <span className="text-[8px] sm:text-[8.5px] lg:text-[9px] uppercase font-bold text-[#94A3B8] block truncate">
              USDT Wallet Balance
            </span>
            <div className="flex items-center justify-between gap-1 mt-0.5 lg:mt-1">
              <span className="font-mono-numbers font-black text-[11px] sm:text-xs lg:text-sm text-emerald-400 truncate">
                {Number(wallet?.balance || 0).toLocaleString('en-US', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2
                })}{' '}
                USDT
              </span>
              <span className="text-[8.5px] sm:text-[9.5px] lg:text-[10px] text-emerald-400 font-mono-numbers font-bold shrink-0">
                TRC-20
              </span>
            </div>
          </button>
        ) : (
          <div className="flex justify-center">
            <button
              type="button"
              onClick={() => {
                if (onSelectTab) onSelectTab('wallet');
                if (onClose) onClose();
              }}
              className="w-8 h-8 sm:w-9 sm:h-9 lg:w-10 lg:h-10 rounded-xl bg-[#111827] hover:bg-[#151C2B] text-emerald-400 border border-[#1F2737] flex items-center justify-center transition-colors cursor-pointer"
              title={`Open USDT Wallet (${Number(wallet?.balance || 0).toFixed(2)} USDT)`}
              aria-label="Open Wallet"
            >
              <Wallet className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );

  // When inside Immersive Game Room: ONE unified responsive hamburger-controlled <aside> across ALL devices
  if (isInGameRoom) {
    return (
      <aside
        aria-label="Game Navigation Sidebar"
        data-testid="user-game-sidebar"
        className={`flex flex-col shrink-0 bg-[#0B0F19] border-r border-[#1F2737] transition-[width] duration-250 ease-in-out will-change-[width] z-30 h-full overflow-hidden ${isCollapsed ? 'w-11 sm:w-14 lg:w-[68px]' : 'w-56 sm:w-64 lg:w-64'
          }`}
      >
        {renderSidebarBody(true, isCollapsed)}
      </aside>
    );
  }

  return (
    <>
      {/* 1. Desktop / Laptop Persistent Sidebar outside Game Room */}
      <aside
        aria-label="User Navigation Sidebar"
        data-testid="user-desktop-sidebar"
        className={`hidden lg:flex flex-col shrink-0 bg-[#0B0F19] border-r border-[#1F2737] transition-[width] duration-250 ease-in-out will-change-[width] z-30 h-full overflow-hidden ${isCollapsed ? 'w-[68px]' : 'w-64'
          }`}
      >
        {renderSidebarBody(false, isCollapsed)}
      </aside>

      {/* 2. Mobile/Tablet Slide-out Drawer (< 1024px when Top Navbar is visible) */}
      {isOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            onClick={onClose}
            className="absolute inset-0 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
          />
          <aside
            aria-label="Mobile Navigation Drawer"
            data-testid="user-mobile-drawer"
            className="absolute top-0 bottom-0 left-0 w-[276px] sm:w-72 max-w-[88vw] bg-[#0B0F19] border-r border-[#1F2737] shadow-2xl animate-in slide-in-from-left duration-250 z-10 flex flex-col"
          >
            <div className="flex items-center justify-between px-3 h-13 xs:h-14 border-b border-[#1F2737] shrink-0 bg-[#0B0F19]">
              <div
                onClick={() => {
                  onSelectTab('lotteries');
                  if (onClose) onClose();
                }}
                className="flex items-center gap-2 cursor-pointer group select-none shrink-0"
              >
                <div className="w-7.5 h-7.5 xs:w-8 xs:h-8 rounded-full p-0.5 shadow-[0_0_10px_rgba(245,196,81,0.3)] flex items-center justify-center shrink-0">
                  <img
                    src="/logo.png"
                    alt="EarnFlow.in"
                    className="w-full h-full rounded-full object-cover border border-[#ffd700]/40"
                  />
                </div>
                <div className="flex flex-col justify-center shrink-0">
                  <span className="font-display font-extrabold text-sm xs:text-base tracking-tight text-white group-hover:text-[#ffd700] transition-colors leading-tight whitespace-nowrap">
                    EarnFlow<span className="text-[#F5C451]">.in</span>
                  </span>
                  <span className="text-[9px] text-[#94A3B8] font-medium leading-none mt-0.5 whitespace-nowrap">
                    Casino &amp; Games
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="w-8 h-8 rounded-lg bg-[#111827] hover:bg-[#151C2B] text-[#94A3B8] hover:text-white flex items-center justify-center border border-[#1F2737] hover:border-rose-400/40 transition-colors cursor-pointer shrink-0"
                title="Close Navigation"
                aria-label="Close Navigation"
              >
                <X className="w-4 h-4 text-rose-400" />
              </button>
            </div>

            <div className="flex-1 min-h-0 overflow-hidden">
              {renderSidebarBody(false, false)}
            </div>
          </aside>
        </div>
      )}
    </>
  );
}
