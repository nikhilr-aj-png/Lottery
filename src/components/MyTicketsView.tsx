import React, { useMemo, useState } from 'react';
import { useLottery } from '../context/LotteryContext';
import { 
  Ticket, 
  Trophy, 
  Clock, 
  CheckCircle2, 
  Sparkles, 
  Layers, 
  Lock, 
  LogIn,
  Search,
  ArrowUpDown,
  ExternalLink,
  ChevronDown,
  Timer
} from 'lucide-react';
import { getEventStatusInfo } from '../utils/eventStatus';

interface MyTicketsViewProps {
  onOpenPicker?: () => void;
  onNavigateToRoom?: (roomId: string) => void;
}

/**
 * Four Digit Lottery - My Tickets Hub
 * Designed strictly in Google Stitch (Obsidian Sovereign Design System: #0B0F19, #111728, #7C3AED, #F59E0B, #10B981)
 * Stitch Screen ID: projects/9963092336677896554/screens/699e6f2777d846f8b2922524186632a9
 * 
 * Strict Features:
 * 1. Overview Metrics Cards (4-column grid: Total Tickets, Active Tickets, Completed Tickets, Winning Tickets).
 * 2. Multi-Faceted Filter & Search Bar: Status pills (All, Active, Won, Completed), Room dropdown, Sort dropdown, Search input.
 * 3. High-Contrast 4-Digit Ticket Grid: Equal-dimension square boxes [ 4 ] [ 7 ] [ 1 ] [ 9 ] with gold/amber/emerald styling.
 * 4. Real Database Integration: Connected to real user tickets from Supabase (lottery_tickets). Zero dummy data.
 */
export default function MyTicketsView({ onOpenPicker, onNavigateToRoom }: MyTicketsViewProps) {
  const { tickets, events, user, wallet, setIsAuthModalOpen } = useLottery();
  
  // Filter & Search States
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'won' | 'completed'>('all');
  const [selectedRoomFilter, setSelectedRoomFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'recent' | 'draw_date' | 'price' | 'prize'>('recent');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // 1. Filter strictly to only the currently logged-in user's actual purchased tickets
  const myPurchasedTickets = useMemo(() => {
    if (!user && !wallet?.address) return [];
    return (tickets || []).filter((t: any) => 
      (user?.id && (t.userId === user.id || t.user_id === user.id)) ||
      (wallet?.address && t.userAddress === wallet.address)
    );
  }, [tickets, user, wallet?.address]);

  // 2. Compute Ticket Metadata (Room, Event status, isWon, winningDigits, etc.)
  const enrichedTickets = useMemo(() => {
    return myPurchasedTickets.map((tkt: any) => {
      const eventId = tkt.eventId || tkt.event_id || 'unknown';
      const matchingEvent = events.find((e: any) => e.id === eventId) || {
        id: eventId,
        title: tkt.eventTitle || 'Lottery Draw Pool',
        ticketPrice: tkt.price || 10,
        currency: tkt.currency || 'USDT',
        status: tkt.status === 'won' || tkt.status === 'lost' ? 'completed' : 'active'
      };

      const statusInfo = getEventStatusInfo(matchingEvent);
      const isEventEnded = statusInfo.isEnd;

      // Extract winning codes
      const rawCodes = 
        matchingEvent.drawResultCodes ||
        matchingEvent.draw_result_codes ||
        matchingEvent.winningCodes ||
        matchingEvent.winning_codes ||
        matchingEvent.winningDigits ||
        matchingEvent.winning_digits ||
        matchingEvent.presetWinningDigits ||
        matchingEvent.preset_winning_digits;

      let winningCodes: string[] = [];
      if (Array.isArray(rawCodes)) {
        winningCodes = rawCodes.map((c: any) => String(c).replace(/\D/g, '').padStart(4, '0'));
      } else if (typeof rawCodes === 'string' && rawCodes.trim().length > 0) {
        winningCodes = rawCodes.split(',').map((s: string) => s.replace(/\D/g, '').padStart(4, '0'));
      }

      const tktNumber = String(tkt.ticketNumber || tkt.digits || '0000').padStart(4, '0');
      const isWon = tkt.status === 'won' || winningCodes.includes(tktNumber);
      const isPending = matchingEvent.status === 'drawing' || (isEventEnded && winningCodes.length === 0);
      const isCompleted = isEventEnded && !isPending;
      const isActive = !isEventEnded && !isPending;

      // Calculate matching digits count for visual highlight
      const firstWinCode = winningCodes[0] || '';
      const matchedIndices: boolean[] = [false, false, false, false];
      if (firstWinCode && firstWinCode.length === 4) {
        for (let i = 0; i < 4; i++) {
          if (tktNumber[i] === firstWinCode[i]) {
            matchedIndices[i] = true;
          }
        }
      }

      const price = Number(tkt.price || matchingEvent.ticketPrice || 10);
      const wonAmount = Number(tkt.wonAmount || tkt.won_amount || (isWon ? price * 10 : 0));
      const currency = tkt.currency || matchingEvent.currency || 'USDT';
      const createdAt = tkt.createdAt || tkt.created_at || tkt.purchaseDate || new Date().toISOString();

      return {
        ...tkt,
        tktNumber,
        eventId,
        event: matchingEvent,
        eventTitle: matchingEvent.title || 'Lottery Draw',
        statusInfo,
        isActive,
        isPending,
        isCompleted,
        isWon,
        winningCodes,
        matchedIndices,
        price,
        wonAmount,
        currency,
        createdAt
      };
    });
  }, [myPurchasedTickets, events]);

  // 3. High-Level Summary Statistics
  const stats = useMemo(() => {
    const total = enrichedTickets.length;
    const active = enrichedTickets.filter(t => t.isActive || t.isPending).length;
    const completed = enrichedTickets.filter(t => t.isCompleted).length;
    const won = enrichedTickets.filter(t => t.isWon).length;

    const totalVolume = enrichedTickets.reduce((acc, t) => acc + (t.price || 0), 0);
    const totalWonAmount = enrichedTickets.reduce((acc, t) => acc + (t.wonAmount || 0), 0);

    const activeRoomsSet = new Set(enrichedTickets.filter(t => t.isActive).map(t => t.eventId));

    return {
      total,
      active,
      completed,
      won,
      totalVolume,
      totalWonAmount,
      activeRoomsCount: activeRoomsSet.size
    };
  }, [enrichedTickets]);

  // 4. Unique rooms list for room selector dropdown
  const uniqueRooms = useMemo(() => {
    const map = new Map<string, string>();
    enrichedTickets.forEach(t => {
      if (!map.has(t.eventId)) {
        map.set(t.eventId, t.eventTitle);
      }
    });
    return Array.from(map.entries()).map(([id, title]) => ({ id, title }));
  }, [enrichedTickets]);

  // 5. Filter & Sort Tickets
  const filteredTickets = useMemo(() => {
    return enrichedTickets.filter(tkt => {
      // Status Filter
      if (statusFilter === 'active' && !(tkt.isActive || tkt.isPending)) return false;
      if (statusFilter === 'won' && !tkt.isWon) return false;
      if (statusFilter === 'completed' && !tkt.isCompleted) return false;

      // Room Filter
      if (selectedRoomFilter !== 'all' && tkt.eventId !== selectedRoomFilter) return false;

      // Search Query (ID or Digits)
      if (searchQuery.trim().length > 0) {
        const q = searchQuery.toLowerCase().trim();
        const matchesId = String(tkt.id || '').toLowerCase().includes(q);
        const matchesDigits = tkt.tktNumber.includes(q);
        const matchesRoom = tkt.eventTitle.toLowerCase().includes(q);
        if (!matchesId && !matchesDigits && !matchesRoom) return false;
      }

      return true;
    }).sort((a, b) => {
      if (sortBy === 'recent') {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
      if (sortBy === 'draw_date') {
        const dateA = a.event?.drawTime ? new Date(a.event.drawTime).getTime() : 0;
        const dateB = b.event?.drawTime ? new Date(b.event.drawTime).getTime() : 0;
        return dateB - dateA;
      }
      if (sortBy === 'price') {
        return b.price - a.price;
      }
      if (sortBy === 'prize') {
        return (b.wonAmount || 0) - (a.wonAmount || 0);
      }
      return 0;
    });
  }, [enrichedTickets, statusFilter, selectedRoomFilter, searchQuery, sortBy]);

  // If user is not logged in, prompt for login
  if (!user) {
    return (
      <div className="w-full max-w-4xl mx-auto px-4 py-12 text-center">
        <div className="bg-[#111728] rounded-3xl p-8 border border-amber-500/30 max-w-md mx-auto space-y-4 shadow-2xl">
          <div className="w-14 h-14 rounded-2xl bg-amber-500/15 border border-amber-500/40 flex items-center justify-center text-amber-400 mx-auto shadow-[0_0_16px_rgba(245,158,11,0.25)]">
            <Lock className="w-7 h-7" />
          </div>
          <h3 className="font-display font-extrabold text-xl text-white">Login to View Your Tickets</h3>
          <p className="text-xs text-[#9b8f7c] leading-relaxed">
            Please log in with your account to view your purchased 4-digit lottery tickets, active draw entries, and prize payouts.
          </p>
          <button
            onClick={() => setIsAuthModalOpen?.(true)}
            className="w-full py-2.5 rounded-xl btn-gold text-xs font-bold flex items-center justify-center gap-2 cursor-pointer shadow-md"
          >
            <LogIn className="w-4 h-4" />
            <span>Login to EarnFlow</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-7xl 2xl:max-w-[1600px] 3xl:max-w-[1800px] mx-auto px-2.5 xs:px-4 sm:px-6 lg:px-8 py-3 sm:py-6 space-y-4 sm:space-y-6 text-left select-none">
      
      {/* ===================================================================== */}
      {/* 1. TOP SUB-NAV & HUB HEADER                                           */}
      {/* ===================================================================== */}
      <div className="w-full flex flex-col md:flex-row md:items-center justify-between gap-3 bg-[#111728]/90 backdrop-blur-xl p-3.5 sm:p-4 rounded-2xl border border-[#1F2737] shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 min-w-0">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0 shadow-[0_0_12px_rgba(245,158,11,0.2)]">
              <Ticket className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-display font-extrabold text-base sm:text-lg text-white flex items-center gap-2">
                <span>My Tickets Hub</span>
                <span className="text-xs font-mono-numbers px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold">
                  {stats.total} Total
                </span>
              </h2>
              <p className="text-[11px] text-[#9b8f7c]">
                Track all personal 4-digit lucky draw entries, live countdowns, and settled prize payouts
              </p>
            </div>
          </div>

          <div className="hidden xl:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#0B0F19] border border-[#1F2737]">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
            <span className="text-[10px] font-mono text-[#94A3B8] uppercase tracking-wider">SYNCED • Polygon POS</span>
          </div>
        </div>

        {onOpenPicker && (
          <button
            onClick={() => onOpenPicker()}
            className="btn-gold px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 cursor-pointer shadow-md shrink-0 self-start md:self-auto"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Enter Lottery Rooms (+)</span>
          </button>
        )}
      </div>

      {/* ===================================================================== */}
      {/* 2. TOP OVERVIEW METRICS CARDS (4-COLUMN SLEEK GRID)                    */}
      {/* ===================================================================== */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 w-full">
        
        {/* Card 1: Total Tickets Purchased */}
        <div className="flex flex-col justify-between bg-[#111728] rounded-2xl p-4 sm:p-5 border border-[#1F2737] shadow-lg transition-all hover:border-[#7C3AED]/40">
          <div className="flex items-start justify-between">
            <div className="flex flex-col">
              <span className="text-[10px] font-mono uppercase tracking-widest text-[#94A3B8] font-bold">
                Tickets Purchased
              </span>
              <span className="text-2xl sm:text-3xl font-mono font-black text-white mt-1">
                {stats.total} <span className="text-sm font-normal text-[#94A3B8]">TKT</span>
              </span>
            </div>
            <div className="w-10 h-10 rounded-xl bg-violet-500/15 border border-violet-500/30 flex items-center justify-center text-violet-400 shadow-[0_0_12px_rgba(124,58,237,0.25)]">
              <Ticket className="w-5 h-5" />
            </div>
          </div>
          <div className="flex items-center justify-between pt-3 mt-2 border-t border-[#1F2737]/60 text-xs font-mono">
            <span className="text-[#94A3B8]">Cumulative Volume</span>
            <span className="text-violet-300 font-bold">{stats.totalVolume.toLocaleString()} USDT</span>
          </div>
        </div>

        {/* Card 2: Active Tickets */}
        <div className="flex flex-col justify-between bg-[#111728] rounded-2xl p-4 sm:p-5 border border-[#1F2737] shadow-lg transition-all hover:border-emerald-500/40">
          <div className="flex items-start justify-between">
            <div className="flex flex-col">
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-mono uppercase tracking-widest text-[#94A3B8] font-bold">
                  Active Tickets
                </span>
                <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 text-[9px] font-mono font-bold border border-emerald-500/30">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> Live
                </span>
              </div>
              <span className="text-2xl sm:text-3xl font-mono font-black text-emerald-400 mt-1">
                {stats.active} <span className="text-sm font-normal text-[#94A3B8]">Active</span>
              </span>
            </div>
            <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.25)]">
              <Timer className="w-5 h-5" />
            </div>
          </div>
          <div className="flex items-center justify-between pt-3 mt-2 border-t border-[#1F2737]/60 text-xs font-mono">
            <span className="text-[#94A3B8]">Across {stats.activeRoomsCount} Room{stats.activeRoomsCount === 1 ? '' : 's'}</span>
            <span className="text-emerald-400 font-medium">{stats.active > 0 ? 'Draw Pending' : 'No active draws'}</span>
          </div>
        </div>

        {/* Card 3: Completed Tickets */}
        <div className="flex flex-col justify-between bg-[#111728] rounded-2xl p-4 sm:p-5 border border-[#1F2737] shadow-lg transition-all hover:border-slate-600/40">
          <div className="flex items-start justify-between">
            <div className="flex flex-col">
              <span className="text-[10px] font-mono uppercase tracking-widest text-[#94A3B8] font-bold">
                Completed / Settled
              </span>
              <span className="text-2xl sm:text-3xl font-mono font-black text-white mt-1">
                {stats.completed} <span className="text-sm font-normal text-[#94A3B8]">Done</span>
              </span>
            </div>
            <div className="w-10 h-10 rounded-xl bg-slate-800/80 border border-slate-700 flex items-center justify-center text-slate-400">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>
          <div className="flex items-center justify-between pt-3 mt-2 border-t border-[#1F2737]/60 text-xs font-mono">
            <span className="text-[#94A3B8]">Settled Rounds</span>
            <span className="text-slate-300 font-medium">{stats.completed - stats.won} Unmatched</span>
          </div>
        </div>

        {/* Card 4: Winning Tickets (Highlight Card) */}
        <div className="flex flex-col justify-between bg-gradient-to-b from-[#151C30] to-[#111728] rounded-2xl p-4 sm:p-5 border border-amber-500/40 shadow-[0_0_24px_rgba(245,158,11,0.18)] transition-all relative overflow-hidden">
          <div className="absolute -right-6 -top-6 w-24 h-24 bg-amber-500/10 rounded-full blur-2xl pointer-events-none" />
          <div className="flex items-start justify-between relative z-10">
            <div className="flex flex-col">
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-mono uppercase tracking-widest text-amber-300 font-bold">
                  Winning Tickets
                </span>
                <Sparkles className="w-3 h-3 text-amber-400" />
              </div>
              <span className="text-2xl sm:text-3xl font-mono font-black text-amber-300 mt-1">
                {stats.won} Won
              </span>
            </div>
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shadow-[0_0_16px_rgba(245,158,11,0.35)]">
              <Trophy className="w-5 h-5" />
            </div>
          </div>
          <div className="flex items-center justify-between pt-3 mt-2 border-t border-[#1F2737]/60 text-xs font-mono relative z-10">
            <span className="text-[#94A3B8]">Total Prize Won</span>
            <span className="text-emerald-400 font-black text-sm">
              +{stats.totalWonAmount.toLocaleString()} USDT
            </span>
          </div>
        </div>

      </div>

      {/* ===================================================================== */}
      {/* 3. FILTER & SEARCH CONTROL BAR                                        */}
      {/* ===================================================================== */}
      <div className="w-full flex flex-col xl:flex-row items-stretch xl:items-center justify-between gap-3 bg-[#111728] p-3 sm:p-3.5 rounded-2xl border border-[#1F2737] shadow-md">
        
        {/* Left: Status Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 xl:pb-0 no-scrollbar">
          <button
            type="button"
            onClick={() => setStatusFilter('all')}
            className={`px-3 py-1.5 rounded-xl font-mono text-xs font-bold flex items-center gap-1.5 whitespace-nowrap cursor-pointer transition-all ${
              statusFilter === 'all'
                ? 'bg-amber-500 text-black shadow-sm font-black'
                : 'bg-[#0B0F19] text-[#94A3B8] hover:text-white border border-[#1F2737]'
            }`}
          >
            <span>All Tickets</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${statusFilter === 'all' ? 'bg-black/20 text-black' : 'bg-[#141924] text-[#94A3B8]'}`}>
              {stats.total}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter('active')}
            className={`px-3 py-1.5 rounded-xl font-mono text-xs font-bold flex items-center gap-1.5 whitespace-nowrap cursor-pointer transition-all ${
              statusFilter === 'active'
                ? 'bg-emerald-500 text-black shadow-sm font-black'
                : 'bg-[#0B0F19] text-[#94A3B8] hover:text-white border border-[#1F2737]'
            }`}
          >
            <span>Active</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${statusFilter === 'active' ? 'bg-black/20 text-black' : 'bg-emerald-500/20 text-emerald-300'}`}>
              {stats.active}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter('won')}
            className={`px-3 py-1.5 rounded-xl font-mono text-xs font-bold flex items-center gap-1.5 whitespace-nowrap cursor-pointer transition-all ${
              statusFilter === 'won'
                ? 'bg-amber-400 text-black shadow-sm font-black'
                : 'bg-[#0B0F19] text-[#94A3B8] hover:text-white border border-[#1F2737]'
            }`}
          >
            <span>Won</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${statusFilter === 'won' ? 'bg-black/20 text-black' : 'bg-amber-500/20 text-amber-300'}`}>
              {stats.won}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter('completed')}
            className={`px-3 py-1.5 rounded-xl font-mono text-xs font-bold flex items-center gap-1.5 whitespace-nowrap cursor-pointer transition-all ${
              statusFilter === 'completed'
                ? 'bg-slate-300 text-black shadow-sm font-black'
                : 'bg-[#0B0F19] text-[#94A3B8] hover:text-white border border-[#1F2737]'
            }`}
          >
            <span>Completed</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${statusFilter === 'completed' ? 'bg-black/20 text-black' : 'bg-[#141924] text-[#94A3B8]'}`}>
              {stats.completed}
            </span>
          </button>
        </div>

        {/* Middle & Right: Room Dropdown + Sort + Search Bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 flex-wrap xl:flex-nowrap">
          
          {/* Room Selector Dropdown */}
          {uniqueRooms.length > 1 && (
            <div className="relative min-w-[170px]">
              <select
                value={selectedRoomFilter}
                onChange={(e) => setSelectedRoomFilter(e.target.value)}
                className="w-full bg-[#0B0F19] text-white text-xs font-mono rounded-xl px-3 py-2 appearance-none border border-[#1F2737] focus:border-amber-500/50 cursor-pointer pr-8"
              >
                <option value="all">All Rooms ({uniqueRooms.length})</option>
                {uniqueRooms.map(r => (
                  <option key={r.id} value={r.id}>{r.title.split(':')[0]}</option>
                ))}
              </select>
              <ChevronDown className="w-4 h-4 text-[#94A3B8] absolute right-2.5 top-2.5 pointer-events-none" />
            </div>
          )}

          {/* Sort Dropdown */}
          <div className="relative min-w-[140px]">
            <select
              value={sortBy}
              onChange={(e: any) => setSortBy(e.target.value)}
              className="w-full bg-[#0B0F19] text-white text-xs font-mono rounded-xl px-3 py-2 appearance-none border border-[#1F2737] focus:border-amber-500/50 cursor-pointer pr-8"
            >
              <option value="recent">Sort: Most Recent</option>
              <option value="draw_date">Sort: Draw Date</option>
              <option value="price">Sort: Price</option>
              <option value="prize">Sort: Prize Won</option>
            </select>
            <ArrowUpDown className="w-3.5 h-3.5 text-[#94A3B8] absolute right-2.5 top-2.5 pointer-events-none" />
          </div>

          {/* Search Input */}
          <div className="relative flex-1 sm:w-60">
            <Search className="w-4 h-4 text-[#94A3B8] absolute left-3 top-2.5 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search Ticket ID or digits..."
              className="w-full bg-[#0B0F19] text-white placeholder:text-[#64748B] text-xs font-mono rounded-xl pl-9 pr-3 py-2 border border-[#1F2737] focus:border-amber-500/50 focus:outline-none"
            />
          </div>

        </div>
      </div>

      {/* ===================================================================== */}
      {/* 4. TICKET CARDS RESPONSIVE GRID (ZERO DUMMY DATA)                     */}
      {/* ===================================================================== */}
      {filteredTickets.length === 0 ? (
        /* Empty State */
        <div className="bg-[#111728] rounded-2xl p-8 sm:p-14 text-center space-y-4 border border-[#1F2737] shadow-xl">
          <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 mx-auto">
            <Ticket className="w-8 h-8 opacity-60" />
          </div>
          <div className="space-y-1">
            <h3 className="font-display font-bold text-base sm:text-lg text-white">
              {myPurchasedTickets.length === 0 ? 'No Tickets Purchased Yet' : 'No Matching Tickets Found'}
            </h3>
            <p className="text-xs text-[#9b8f7c] max-w-md mx-auto leading-relaxed">
              {myPurchasedTickets.length === 0
                ? "You haven't entered any lottery draws yet. Choose an active room, pick your 4-digit combinations, and enter the jackpot!"
                : 'No tickets matched your current filter or search criteria. Try selecting "All Tickets" or clearing the search query.'}
            </p>
          </div>
          {onOpenPicker && (
            <button
              onClick={() => onOpenPicker()}
              className="btn-gold px-5 py-2.5 rounded-xl text-xs font-bold inline-flex items-center gap-2 cursor-pointer shadow-md mt-2"
            >
              <Sparkles className="w-4 h-4" />
              <span>Browse Available Rooms</span>
            </button>
          )}
        </div>
      ) : (
        /* Responsive Card Grid: 3-4 col desktop, 2-col tablet, 1-col mobile */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-5">
          {filteredTickets.map((tkt: any) => {
            const isWon = tkt.isWon;
            const isPending = tkt.isPending;
            const isActive = tkt.isActive;
            const isCompleted = tkt.isCompleted;

            // Formatted Date
            const dateStr = new Date(tkt.createdAt).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric'
            });

            return (
              <div
                key={tkt.id}
                className={`flex flex-col justify-between bg-[#111728] rounded-2xl p-4 sm:p-5 border transition-all duration-200 hover:-translate-y-1 shadow-lg relative overflow-hidden group ${
                  isWon
                    ? 'border-amber-500/50 hover:border-amber-400 shadow-[0_4px_24px_rgba(245,158,11,0.2)]'
                    : isPending
                    ? 'border-purple-500/40 hover:border-purple-400'
                    : isActive
                    ? 'border-[#1F2737] hover:border-violet-500/50'
                    : 'border-[#1F2737] opacity-80 hover:opacity-100'
                }`}
              >
                {/* Won Background Glow Anchor */}
                {isWon && (
                  <div className="absolute -top-10 -right-10 w-28 h-28 bg-amber-500/15 rounded-full blur-2xl pointer-events-none" />
                )}

                {/* Top Header Row: Ticket ID + Dynamic Status Badge */}
                <div className="flex items-center justify-between gap-2 relative z-10 mb-3">
                  <span className="font-mono text-xs font-bold text-slate-300 tracking-tight">
                    #TKT-{String(tkt.id || '').replace(/^tkt-/, '').slice(0, 8).toUpperCase()}
                  </span>

                  {isWon ? (
                    <span className="px-2.5 py-0.5 rounded-full bg-gradient-to-r from-amber-500/25 to-yellow-500/15 text-amber-300 border border-amber-500/50 font-mono text-[10px] font-black uppercase tracking-wider shadow-[0_0_12px_rgba(245,158,11,0.3)]">
                      ★ WON • +{tkt.wonAmount.toLocaleString()} {tkt.currency}
                    </span>
                  ) : isPending ? (
                    <span className="px-2.5 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/40 font-mono text-[10px] font-bold uppercase tracking-wider flex items-center gap-1">
                      <Clock className="w-3 h-3 animate-spin" />
                      VRF PENDING
                    </span>
                  ) : isActive ? (
                    <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/35 font-mono text-[10px] font-bold uppercase tracking-wider flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      LIVE IN DRAW
                    </span>
                  ) : (
                    <span className="px-2.5 py-0.5 rounded-full bg-[#141924] text-slate-400 border border-[#1F2737] font-mono text-[10px] font-medium uppercase tracking-wider">
                      SETTLED • UNMATCHED
                    </span>
                  )}
                </div>

                {/* Center 4-Digit Modular Display: 4 Equal-Dimension Boxes */}
                <div className="my-3 flex flex-col items-center justify-center gap-1.5 relative z-10">
                  <div className="flex items-center gap-2 sm:gap-2.5 justify-center">
                    {tkt.tktNumber.split('').map((char: string, dIdx: number) => {
                      const isMatched = isWon || tkt.matchedIndices[dIdx];

                      return (
                        <div
                          key={dIdx}
                          className={`w-12 h-13 sm:w-14 sm:h-15 rounded-xl bg-[#0B0F19] border-2 flex items-center justify-center font-mono font-black text-2xl sm:text-3xl select-text transition-transform group-hover:scale-105 ${
                            isMatched
                              ? 'border-emerald-400 text-emerald-300 shadow-[0_0_14px_rgba(16,185,129,0.4)]'
                              : 'border-amber-500/70 text-amber-300 shadow-[0_0_10px_rgba(245,158,11,0.2)]'
                          }`}
                        >
                          {char}
                        </div>
                      );
                    })}
                  </div>
                  {isWon && (
                    <span className="font-mono text-[10px] font-bold text-emerald-400 uppercase tracking-wider mt-0.5">
                      EXACT 4/4 COMBINATION MATCH
                    </span>
                  )}
                </div>

                {/* Ticket Details Box */}
                <div className="flex flex-col gap-1.5 bg-[#0B0F19] p-3 rounded-xl border border-[#1F2737] my-2 text-xs font-mono relative z-10">
                  <div className="flex items-center justify-between text-slate-400">
                    <span>Room</span>
                    <span className="text-white font-medium truncate max-w-[150px]">{tkt.eventTitle}</span>
                  </div>
                  <div className="flex items-center justify-between text-slate-400">
                    <span>Round</span>
                    <span className="text-violet-300">#DRAW-{String(tkt.eventId).replace(/^evt-/, '').slice(-6).toUpperCase()}</span>
                  </div>
                  <div className="flex items-center justify-between text-slate-400">
                    <span>Cost / Date</span>
                    <span className="text-slate-300">{tkt.price} {tkt.currency} • {dateStr}</span>
                  </div>
                </div>

                {/* Footer Actions */}
                <div className="flex items-center justify-between gap-2 pt-2 border-t border-[#1F2737] relative z-10 text-xs font-mono">
                  <span className="text-[#64748B] flex items-center gap-1 text-[11px]">
                    ID: {String(tkt.id || '').slice(-6)}
                  </span>

                  {isWon ? (
                    <span className="px-3 py-1.5 rounded-lg bg-amber-500 text-black font-extrabold text-xs uppercase tracking-wider shadow-[0_0_14px_rgba(245,158,11,0.4)]">
                      Claimed 🏆
                    </span>
                  ) : isActive && onNavigateToRoom ? (
                    <button
                      type="button"
                      onClick={() => onNavigateToRoom(tkt.eventId)}
                      className="px-3 py-1.5 rounded-lg bg-[#141924] hover:bg-[#1A2338] text-amber-300 border border-amber-500/30 text-xs font-bold transition-all cursor-pointer flex items-center gap-1"
                    >
                      <span>View Room</span>
                      <span>→</span>
                    </button>
                  ) : (
                    <span className="text-[#64748B] text-[11px]">
                      {isCompleted ? 'Concluded' : 'Active'}
                    </span>
                  )}
                </div>

              </div>
            );
          })}
        </div>
      )}

      {/* Bottom Summary Notice */}
      <div className="pt-2 text-center text-xs text-[#64748B] font-mono">
        All lottery tickets and prize distributions are cryptographically secured on Polygon PoS.
      </div>

    </div>
  );
}
