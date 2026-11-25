import React, { useEffect } from 'react';
import {
  Trophy,
  Wallet,
  LayoutGrid,
  History,
  Gift,
  Share2,
  X,
  PanelLeftClose,
  PanelLeftOpen
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

  // Prevent background scrolling when mobile drawer is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

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
        { id: 'results', label: 'Results', icon: Trophy }
      ]
    },
    {
      title: 'Account & Hub',
      items: [
        { id: 'rewards', label: 'Daily Bonus', icon: Gift, badge: 'FREE' },
        { id: 'wallet', label: 'USDT Wallet', icon: Wallet, requiresAuth: true },
        { id: 'promotion', label: 'Promotions & Referral', icon: Share2, badge: 'HOT' },
        { id: 'transactions', label: 'Transaction History', icon: History, requiresAuth: true }
      ]
    }
  ];

  const flatItems = navSections.flatMap((s) => s.items);

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

  const handleBrandClick = () => {
    if (onGoHome) onGoHome();
    else onSelectTab('lotteries');
    if (onClose) onClose();
  };

  const sidebarContent = (
    <div className="h-full flex flex-col overflow-hidden pt-3 pb-3 px-2 sm:px-2.5 text-left relative">
      {/* Compact Brand + Collapse Header inside Sidebar when Top Navbar is hidden in Game Room */}
      {isInGameRoom && (
        <div
          className={`shrink-0 pb-2.5 mb-2 border-b border-[#1F2737] flex items-center ${
            isCollapsed ? 'flex-col gap-2 justify-center' : 'justify-between px-1'
          }`}
        >
          <button
            type="button"
            onClick={handleBrandClick}
            className="flex items-center gap-2 cursor-pointer group shrink-0"
            title="EarnFlow.in Home"
          >
            <img
              src="/logo.png"
              alt="EarnFlow.in"
              className="w-7 h-7 rounded-full border border-[#ffd700]/45 object-cover shadow-sm group-hover:scale-105 transition-transform"
            />
            {!isCollapsed && (
              <span className="font-display font-extrabold text-sm text-white whitespace-nowrap">
                EarnFlow<span className="text-[#F5C451]">.in</span>
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={onToggleCollapse}
            className="w-7 h-7 rounded-lg bg-[#111827] hover:bg-[#1A2234] text-[#94A3B8] hover:text-amber-400 border border-[#1F2737] flex items-center justify-center cursor-pointer transition-colors shrink-0"
            title={isCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
            aria-label={isCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
          >
            {isCollapsed ? <PanelLeftOpen className="w-3.5 h-3.5" /> : <PanelLeftClose className="w-3.5 h-3.5" />}
          </button>
        </div>
      )}

      {/* Navigation Sections — Scrollable Menu Items Area */}
      <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden no-scrollbar space-y-2 pr-0.5 overscroll-contain">
        {navSections.map((sec, secIdx) => (
          <div key={secIdx} className="space-y-0.5">
            {sec.title ? (
              <div className="h-5 flex items-center px-2.5 overflow-hidden">
                {!isCollapsed ? (
                  <span className="text-[10px] font-mono-numbers font-bold uppercase tracking-wider text-[#94A3B8] truncate transition-opacity duration-200">
                    {sec.title}
                  </span>
                ) : (
                  <div className="w-6 h-px bg-[#1F2737] mx-auto" />
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
                    onClick={() => handleItemClick(item)}
                    className={`w-full h-11 flex items-center gap-2.5 rounded-xl text-xs font-semibold transition-colors duration-150 cursor-pointer group overflow-hidden ${
                      isCollapsed ? 'justify-center px-0' : 'justify-between px-2.5'
                    } ${
                      isActive
                        ? 'bg-amber-500 text-black font-extrabold shadow-md shadow-amber-500/20'
                        : 'text-[#94A3B8] hover:text-white hover:bg-[#151C2B]'
                    }`}
                    title={item.label}
                    aria-label={item.label}
                  >
                    <div className={`flex items-center gap-2.5 min-w-0 ${isCollapsed ? 'justify-center' : ''}`}>
                      {item.image ? (
                        <div className="w-5 h-5 rounded-md overflow-hidden shrink-0 border border-[#272A31] bg-[#0B0F19] flex items-center justify-center">
                          <img
                            src={item.image}
                            alt=""
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              e.currentTarget.style.display = 'none';
                              const next = e.currentTarget.nextSibling as HTMLElement | null;
                              if (next) {
                                next.style.display = 'inline';
                              }
                            }}
                          />
                          <Icon className={`w-3.5 h-3.5 shrink-0 hidden ${isActive ? 'text-black' : 'text-amber-400 group-hover:scale-110 transition-transform'}`} />
                        </div>
                      ) : (
                        <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-black' : 'text-amber-400 group-hover:scale-110 transition-transform'}`} />
                      )}
                      {!isCollapsed && (
                        <span className="truncate whitespace-nowrap">{item.label}</span>
                      )}
                    </div>

                    {!isCollapsed && item.badge && (
                      <span className={`text-[9px] font-mono-numbers px-1.5 py-0.2 rounded font-black shrink-0 whitespace-nowrap ${
                        isActive ? 'bg-black text-amber-300' : 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                      }`}>
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

      {/* Bottom Balance & Faucet Banner — Fixed Stationary Footer */}
      <div className="shrink-0 pt-2.5 mt-auto border-t border-[#1F2737] bg-[#0B0F19] z-20">
        {!isCollapsed ? (
          <div className="bg-[#111827] border border-[#1F2737] p-2.5 rounded-2xl">
            <span className="text-[9px] uppercase font-bold text-[#94A3B8] block">USDT Wallet Balance</span>
            <div className="flex items-center justify-between mt-1">
              <span className="font-mono-numbers font-black text-xs sm:text-sm text-emerald-400 truncate">
                {Number(wallet?.balance || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDT
              </span>
              <span className="text-[10px] text-emerald-400 font-mono-numbers font-bold">
                TRC-20
              </span>
            </div>
          </div>
        ) : (
          /* Collapsed Mini Wallet Icon Button */
          <div className="flex justify-center">
            <button
              onClick={() => onSelectTab && onSelectTab('wallet')}
              className="w-10 h-10 rounded-xl bg-[#111827] hover:bg-[#151C2B] text-amber-400 border border-[#1F2737] flex items-center justify-center transition-colors cursor-pointer"
              title="Open USDT Wallet"
              aria-label="Open Wallet"
            >
              <Wallet className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <>
      {/* 1. Desktop / Laptop Persistent Sidebar (68px collapsed on laptop, 240px expanded on desktop) */}
      <aside
        className={`hidden lg:flex flex-col shrink-0 bg-[#0B0F19] border-r border-[#1F2737] transition-[width] duration-250 ease-in-out will-change-[width] z-30 h-full ${
          isCollapsed ? 'w-[68px]' : 'w-60'
        }`}
      >
        {sidebarContent}
      </aside>

      {/* 2. Compact Responsive Game Sidebar Rail for Mobile/Tablet (< 1024px) during Immersive Gameplay */}
      {isInGameRoom && (
        <aside
          aria-label="Game Navigation"
          className="flex lg:hidden flex-col items-center justify-between shrink-0 w-11 sm:w-14 bg-[#0B0F19] border-r border-[#1F2737] z-30 h-full overflow-hidden py-1.5 sm:py-2 px-1"
        >
          {/* Compact Brand Mark (Go Home) */}
          <button
            type="button"
            onClick={handleBrandClick}
            className="w-8 h-8 sm:w-9 sm:h-9 rounded-full p-0.5 border border-[#ffd700]/40 bg-[#111827] flex items-center justify-center cursor-pointer shrink-0 hover:scale-105 transition-transform"
            title="Return to Home"
            aria-label="Return to Home"
          >
            <img
              src="/logo.png"
              alt="EarnFlow.in"
              className="w-full h-full rounded-full object-cover"
            />
          </button>

          {/* Compact Navigation Icons */}
          <nav className="flex-1 min-h-0 overflow-y-auto no-scrollbar flex flex-col items-center justify-center gap-1 py-1 w-full">
            {flatItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id || (item.isLobby && activeTab === 'lotteries');
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleItemClick(item)}
                  title={item.label}
                  aria-label={item.label}
                  className={`w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center transition-colors cursor-pointer shrink-0 ${
                    isActive
                      ? 'bg-amber-500 text-black shadow-sm shadow-amber-500/20'
                      : 'text-[#94A3B8] hover:text-white hover:bg-[#151C2B]'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-black' : 'text-amber-400'}`} />
                </button>
              );
            })}
          </nav>

          {/* Compact Wallet Shortcut */}
          <button
            type="button"
            onClick={() => onSelectTab && onSelectTab('wallet')}
            title={`USDT Wallet (${Number(wallet?.balance || 0).toFixed(2)} USDT)`}
            aria-label="Open USDT Wallet"
            className="relative w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-[#111827] hover:bg-[#151C2B] border border-[#1F2737] text-emerald-400 flex items-center justify-center cursor-pointer shrink-0 transition-colors"
          >
            <Wallet className="w-4 h-4" />
          </button>
        </aside>
      )}

      {/* 3. Mobile/Tablet Slide-out Drawer (< 1024px when Top Navbar is visible) */}
      {isOpen && !isInGameRoom && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            onClick={onClose}
            className="absolute inset-0 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
          />
          <div className="absolute top-0 bottom-0 left-0 w-64 xs:w-72 max-w-[85vw] bg-[#0B0F19] border-r border-[#1F2737] shadow-2xl animate-in slide-in-from-left duration-250 z-10 flex flex-col">
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
                onClick={onClose}
                className="w-8 h-8 rounded-lg bg-[#111827] hover:bg-[#151C2B] text-[#94A3B8] hover:text-white flex items-center justify-center border border-[#1F2737] hover:border-rose-400/40 transition-colors cursor-pointer shrink-0"
                title="Close Navigation"
                aria-label="Close Navigation"
              >
                <X className="w-4 h-4 text-rose-400" />
              </button>
            </div>

            <div className="flex-1 min-h-0 overflow-hidden">
              {sidebarContent}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
