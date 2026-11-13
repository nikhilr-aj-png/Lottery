import React, { useEffect } from 'react';
import { 
  Flame, 
  Gamepad2, 
  Ticket, 
  Trophy, 
  Wallet, 
  ShieldCheck, 
  Headphones, 
  Gift, 
  FileText, 
  ChevronRight, 
  ChevronLeft,
  X,
  Sparkles,
  Rocket,
  Dices,
  Bomb,
  Target,
  CircleDot,
  Coins,
  Layers,
  Spade,
  Zap,
  LayoutGrid,
  Medal,
  PanelLeftClose,
  PanelLeftOpen,
  Menu,
  History
} from 'lucide-react';
import { useLottery } from '../context/LotteryContext';
import { GAMES, getGameIconUrl } from '../engine';

export default function Sidebar({ 
  isOpen, 
  onClose, 
  isCollapsed, 
  onToggleCollapse, 
  activeTab, 
  onSelectTab,
  onLaunchGame 
}) {
  const { wallet, user } = useLottery();

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
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen && onClose) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const getGameIcon = (id) => {
    switch (id) {
      case 'lottery': return Ticket;
      case 'crash': return Rocket;
      case 'dice': return Dices;
      case 'mines': return Bomb;
      case 'plinko': return Target;
      case 'roulette': return CircleDot;
      case 'coinflip': return Coins;
      case 'blackjack': return Layers;
      case 'slots': return Sparkles;
      case 'poker': return Spade;
      case 'keno': return CircleDot;
      case 'limbo': return Zap;
      default: return Gamepad2;
    }
  };

  const navSections = [
    {
      title: 'Casino Lobby',
      items: [
        { id: 'lotteries', label: 'All Games Lobby', icon: LayoutGrid, isLobby: true },
        { id: 'lottery-game', label: 'Four-Digit Lottery', icon: Ticket, image: getGameIconUrl('lottery'), isLottery: true },
      ]
    },
    {
      title: 'Originals & Instant',
      items: GAMES.filter(g => g.id !== 'lottery').map(g => ({
        id: `game-${g.id}`,
        gameId: g.id,
        label: g.name,
        icon: getGameIcon(g.id),
        image: getGameIconUrl(g.id),
        badge: g.badge,
        isModularGame: true
      }))
    },
    {
      title: 'Player Hub',
      items: [
        { id: 'rewards', label: 'Daily Bonus & Rewards', icon: Gift },
        { id: 'leaderboard', label: 'High Rollers Podium', icon: Medal },
        { id: 'tickets', label: 'My Tickets', icon: Ticket, requiresAuth: true },
        { id: 'results', label: 'Draw Results', icon: Trophy, requiresAuth: true },
        { id: 'wallet', label: 'Virtual Wallet & Ledger', icon: Wallet, requiresAuth: true },
        { id: 'transactions', label: 'Transaction History', icon: History, requiresAuth: true },
      ]
    },
    {
      title: 'Help & Compliance',
      items: [
        { id: 'fairness', label: 'Provably Fair Proofs', icon: ShieldCheck },
        { id: 'support', label: 'Customer Support & FAQ', icon: Headphones },
        { id: 'terms', label: 'Terms & Conditions', icon: FileText }
      ]
    }
  ];

  const handleItemClick = (item) => {
    if (item.isModularGame && onLaunchGame) {
      onLaunchGame(item.gameId);
      if (onClose) onClose();
      return;
    }

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

  const sidebarContent = (
    <div className="h-full flex flex-col overflow-hidden pt-1.5 pb-2.5 px-2 sm:px-2.5 text-left relative">
      
      {/* Top Header / Three-Line (Hamburger) Menu Button — Fixed Stationary Header */}
      <div className={`shrink-0 flex items-center py-1.5 mb-1.5 border-b border-[#1F2737] bg-[#0B0F19] z-20 ${
        isCollapsed ? 'justify-center' : 'justify-between px-1'
      }`}>
        {/* Desktop Three-Line (Hamburger) Menu Button (>= 1024px) */}
        <button
          onClick={onToggleCollapse}
          className={`hidden lg:flex w-9 h-9 rounded-xl bg-[#111827] hover:bg-[#151C2B] text-amber-400 hover:text-white items-center justify-center border border-[#1F2737] hover:border-amber-400/50 transition-all cursor-pointer shadow-sm shrink-0 ${
            isCollapsed ? 'mx-auto' : 'ml-0.5'
          }`}
          title={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
          aria-label={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
        >
          <Menu className="w-4.5 h-4.5 text-amber-400" />
        </button>

        {/* Mobile & Tablet Close Button (< 1024px) */}
        <button
          onClick={onClose}
          className="lg:hidden w-9 h-9 rounded-xl bg-[#111827] hover:bg-[#151C2B] text-[#94A3B8] hover:text-white flex items-center justify-center border border-[#1F2737] hover:border-rose-400/40 transition-colors cursor-pointer shrink-0 ml-auto mr-0.5"
          title="Close Navigation Menu"
          aria-label="Close Navigation Menu"
        >
          <X className="w-4.5 h-4.5 text-rose-400" />
        </button>
      </div>

      {/* Navigation Sections — Scrollable Menu Items Area */}
      <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden no-scrollbar space-y-3 pr-0.5">
        {navSections.map((sec, secIdx) => (
          <div key={secIdx} className="space-y-1">
            {!isCollapsed ? (
              <span className="text-[10px] font-mono-numbers font-bold uppercase tracking-wider text-[#94A3B8] px-2.5 block">
                {sec.title}
              </span>
            ) : (
              <div className="w-6 h-px bg-[#1F2737] mx-auto my-2" />
            )}

            <div className="space-y-0.5">
              {sec.items.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id || (item.isLobby && activeTab === 'lotteries');
                return (
                  <button
                    key={item.id}
                    onClick={() => handleItemClick(item)}
                    className={`w-full min-h-[44px] flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-xs font-semibold transition-all duration-150 cursor-pointer group ${
                      isCollapsed ? 'justify-center px-0' : 'justify-between'
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
                              if (e.currentTarget.nextSibling) {
                                e.currentTarget.nextSibling.style.display = 'inline';
                              }
                            }}
                          />
                          <Icon className={`w-3.5 h-3.5 shrink-0 hidden ${isActive ? 'text-black' : 'text-amber-400 group-hover:scale-110 transition-transform'}`} />
                        </div>
                      ) : (
                        <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-black' : 'text-amber-400 group-hover:scale-110 transition-transform'}`} />
                      )}
                      {!isCollapsed && (
                        <span className="truncate">{item.label}</span>
                      )}
                    </div>

                    {!isCollapsed && item.badge && (
                      <span className={`text-[9px] font-mono-numbers px-1.5 py-0.2 rounded font-black shrink-0 ${
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
            <span className="text-[9px] uppercase font-bold text-[#94A3B8] block">Wallet Balance</span>
            <div className="flex items-center justify-between mt-1">
              <span className="font-mono-numbers font-black text-xs sm:text-sm text-[#F5C451] truncate">
                {Number(wallet?.balance || 0).toLocaleString()} FLO
              </span>
              <span className="text-[10px] text-[#94A3B8] font-mono-numbers">
                ≈ ${Number(wallet?.balance || 0).toLocaleString()}
              </span>
            </div>
          </div>
        ) : (
          /* Collapsed Mini Wallet Icon Button */
          <div className="flex justify-center">
            <button
              onClick={() => onSelectTab && onSelectTab('wallet')}
              className="w-10 h-10 rounded-xl bg-[#111827] hover:bg-[#151C2B] text-amber-400 border border-[#1F2737] flex items-center justify-center transition-colors cursor-pointer"
              title="Open Wallet (1 FLO = 1 USDT)"
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
      {/* 1. Desktop Persistent Sidebar (68px when collapsed on laptop, 240px expanded on desktop) */}
      <aside 
        className={`hidden lg:block shrink-0 bg-[#0B0F19] border-r border-[#1F2737] transition-all duration-300 z-30 sticky top-13 xs:top-14 sm:top-16 h-[calc(100vh-3.25rem)] sm:h-[calc(100vh-4rem)] ${
          isCollapsed ? 'w-[68px]' : 'w-60'
        }`}
      >
        {sidebarContent}
      </aside>

      {/* 2. Mobile/Tablet Slide-out Drawer (< 1024px) */}
      {isOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          {/* Backdrop with click-to-dismiss */}
          <div 
            onClick={onClose}
            className="absolute inset-0 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
          />
          {/* Drawer panel with slide-in animation */}
          <div className="absolute top-0 bottom-0 left-0 w-64 xs:w-72 max-w-[85vw] bg-[#0B0F19] border-r border-[#1F2737] shadow-2xl animate-in slide-in-from-left duration-250 z-10">
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
}
