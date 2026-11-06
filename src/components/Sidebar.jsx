import React from 'react';
import { 
  Flame, 
  Gamepad2, 
  Ticket, 
  Trophy, 
  Wallet, 
  ShieldCheck, 
  HelpCircle, 
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
  Medal
} from 'lucide-react';
import { useLottery } from '../context/LotteryContext';
import { GAMES } from '../engine';

export default function Sidebar({ 
  isOpen, 
  onClose, 
  isCollapsed, 
  onToggleCollapse, 
  activeTab, 
  onSelectTab,
  onLaunchGame 
}) {
  const { wallet, user, claimDailyBonus } = useLottery();

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
        { id: 'lottery-game', label: 'Four-Digit Lottery', icon: Ticket, isLottery: true },
      ]
    },
    {
      title: 'Originals & Instant',
      items: GAMES.filter(g => g.id !== 'lottery').map(g => ({
        id: `game-${g.id}`,
        gameId: g.id,
        label: g.name,
        icon: getGameIcon(g.id),
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
      onSelectTab('lotteries');
      if (onClose) onClose();
      // Scroll to active lottery section
      setTimeout(() => {
        const el = document.getElementById('lottery-pools-section');
        if (el) el.scrollIntoView({ behavior: 'smooth' });
      }, 100);
      return;
    }

    onSelectTab(item.id);
    if (onClose) onClose();
  };

  const sidebarContent = (
    <div className="h-full flex flex-col justify-between overflow-y-auto no-scrollbar py-3 px-2 sm:px-3 text-left">
      
      {/* Top Header / Collapse Button */}
      <div className="flex items-center justify-between pb-3 mb-2 border-b border-[#1F2737]">
        {!isCollapsed && (
          <div className="flex items-center gap-2 pl-2">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse shadow-[0_0_8px_#ffd700]" />
            <span className="font-display font-black text-sm text-white uppercase tracking-wider">
              Navigation
            </span>
          </div>
        )}

        {/* Collapse toggle (Desktop) */}
        <button
          onClick={onToggleCollapse}
          className="hidden lg:flex w-8 h-8 rounded-xl bg-[#111827] hover:bg-[#151C2B] text-[#94A3B8] hover:text-white items-center justify-center border border-[#1F2737] transition-colors cursor-pointer mx-auto"
          title={isCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
        >
          {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>

        {/* Close Button (Mobile) */}
        <button
          onClick={onClose}
          className="lg:hidden w-8 h-8 rounded-xl bg-[#111827] hover:bg-[#151C2B] text-[#94A3B8] hover:text-white flex items-center justify-center border border-[#1F2737] transition-colors cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Navigation Sections */}
      <div className="flex-1 space-y-4">
        {navSections.map((sec, secIdx) => (
          <div key={secIdx} className="space-y-1">
            {!isCollapsed && (
              <span className="text-[10px] font-mono-numbers font-bold uppercase tracking-wider text-[#94A3B8] px-2.5 block">
                {sec.title}
              </span>
            )}

            <div className="space-y-0.5">
              {sec.items.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id || (item.isLobby && activeTab === 'lotteries');
                return (
                  <button
                    key={item.id}
                    onClick={() => handleItemClick(item)}
                    className={`w-full flex items-center gap-3 px-2.5 py-2 rounded-xl text-xs font-semibold transition-all duration-150 cursor-pointer group ${
                      isCollapsed ? 'justify-center' : 'justify-between'
                    } ${
                      isActive 
                        ? 'bg-amber-500 text-black font-extrabold shadow-md shadow-amber-500/20' 
                        : 'text-[#94A3B8] hover:text-white hover:bg-[#151C2B]'
                    }`}
                    title={isCollapsed ? item.label : undefined}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-black' : 'text-amber-400 group-hover:scale-110 transition-transform'}`} />
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

      {/* Bottom Balance & Faucet Banner */}
      {!isCollapsed && (
        <div className="pt-3 mt-4 border-t border-[#1F2737] space-y-2">
          <div className="bg-[#111827] border border-[#1F2737] p-3 rounded-2xl">
            <span className="text-[9px] uppercase font-bold text-[#94A3B8] block">Available Social Credits</span>
            <div className="flex items-center justify-between mt-1">
              <span className="font-mono-numbers font-black text-sm text-[#F5C451]">
                {Number(wallet?.balance || 0).toLocaleString()} FC
              </span>
              <button
                onClick={() => claimDailyBonus && claimDailyBonus()}
                className="px-2 py-1 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold flex items-center gap-1 transition-colors cursor-pointer"
                title="Claim 100 Flow Coins every 24 hours"
              >
                <Gift className="w-3 h-3" />
                <span>+100 FC</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );

  return (
    <>
      {/* 1. Desktop Persistent Sidebar */}
      <aside 
        className={`hidden lg:block shrink-0 bg-[#0B0F19] border-r border-[#1F2737] transition-all duration-300 z-30 sticky top-14 sm:top-18 h-[calc(100vh-3.5rem)] sm:h-[calc(100vh-4.5rem)] ${
          isCollapsed ? 'w-16' : 'w-64'
        }`}
      >
        {sidebarContent}
      </aside>

      {/* 2. Mobile Slide-out Drawer */}
      {isOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          {/* Backdrop */}
          <div 
            onClick={onClose}
            className="absolute inset-0 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
          />
          {/* Drawer panel */}
          <div className="absolute top-0 bottom-0 left-0 w-72 bg-[#0B0F19] border-r border-[#1F2737] shadow-2xl animate-in slide-in-from-left duration-250 z-10">
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
}

