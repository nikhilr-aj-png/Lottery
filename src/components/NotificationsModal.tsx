import React, { useState, useMemo } from 'react';
import { 
  Bell, 
  X, 
  CheckCheck, 
  Sparkles, 
  Gift, 
  Rocket, 
  Ticket, 
  ShieldCheck, 
  Clock, 
  Trash2,
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  ExternalLink,
  BellOff,
  Filter
} from 'lucide-react';
import { useLottery } from '../context/LotteryContext';

export default function NotificationsModal({ isOpen, onClose, onNavigate }) {
  const { 
    userNotifications = [], 
    unreadNotificationsCount = 0, 
    loadingNotifications,
    fetchUserNotifications,
    markNotificationAsRead, 
    markAllNotificationsAsRead, 
    clearUserNotifications,
    wallet
  } = useLottery();

  const [activeFilter, setActiveFilter] = useState('all'); // 'all' | 'unread' | 'reward' | 'security' | 'games'
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [isClearing, setIsClearing] = useState(false);

  // Filtered notifications
  const filteredNotifications = useMemo(() => {
    if (!Array.isArray(userNotifications)) return [];
    return userNotifications.filter(item => {
      if (activeFilter === 'unread') return !item.is_read;
      if (activeFilter === 'reward') return item.type === 'reward' || item.type === 'bonus';
      if (activeFilter === 'security') return item.type === 'security' || item.type === 'system';
      if (activeFilter === 'games') return item.type === 'lottery' || item.type === 'game';
      return true;
    });
  }, [userNotifications, activeFilter]);

  if (!isOpen) return null;

  const handleNotificationClick = (item) => {
    if (!item.is_read && markNotificationAsRead) {
      markNotificationAsRead(item.id);
    }
    if (item.action_url) {
      if (item.action_url.includes('wallet') && onNavigate) {
        onNavigate('wallet');
        if (onClose) onClose();
      } else if (item.action_url.includes('lottery') && onNavigate) {
        onNavigate('lotteries');
        if (onClose) onClose();
      }
    }
  };

  const handleConfirmClear = async () => {
    setIsClearing(true);
    try {
      if (clearUserNotifications) {
        await clearUserNotifications();
      }
      setShowClearConfirm(false);
    } finally {
      setIsClearing(false);
    }
  };

  const formatTimestamp = (dateStr) => {
    if (!dateStr) return 'Just now';
    try {
      const date = new Date(dateStr);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMs / 3600000);
      const diffDays = Math.floor(diffMs / 86400000);

      if (diffMins < 1) return 'Just now';
      if (diffMins < 60) return `${diffMins}m ago`;
      if (diffHours < 24) return `${diffHours}h ago`;
      if (diffDays < 7) return `${diffDays}d ago`;

      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return 'Recently';
    }
  };

  const getNotificationIcon = (type) => {
    switch (type) {
      case 'reward':
      case 'bonus':
        return <Gift className="w-5 h-5 text-amber-400" />;
      case 'lottery':
        return <Ticket className="w-5 h-5 text-purple-400" />;
      case 'game':
        return <Rocket className="w-5 h-5 text-emerald-400" />;
      case 'security':
        return <ShieldCheck className="w-5 h-5 text-blue-400" />;
      default:
        return <Bell className="w-5 h-5 text-amber-400" />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#07090E] text-white flex flex-col overflow-hidden animate-in fade-in duration-200">
      
      {/* Top Banner Accent Line */}
      <div className="h-1 w-full bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-600 shrink-0" />

      {/* Main Full-Screen Header */}
      <header className="border-b border-[#1F2737] bg-[#0B0F19]/90 backdrop-blur-xl px-4 sm:px-6 lg:px-8 py-3.5 sm:py-4 shrink-0">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-3">
          
          {/* Back Button & Title */}
          <div className="flex items-center gap-3 sm:gap-4 min-w-0">
            <button
              onClick={onClose}
              className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[#151C2B] hover:bg-[#1E2638] text-amber-400 hover:text-amber-300 border border-[#272A31] transition-all cursor-pointer text-xs font-bold shrink-0 shadow-sm"
              title="Return to lobby"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Back to Platform</span>
            </button>

            <div className="min-w-0 flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
                <Bell className="w-5 h-5" />
              </div>
              <div className="truncate">
                <div className="flex items-center gap-2">
                  <h1 className="font-display font-black text-base sm:text-xl text-white truncate">
                    Notifications & Alerts
                  </h1>
                  {unreadNotificationsCount > 0 && (
                    <span className="px-2 py-0.5 rounded-full bg-amber-500 text-black text-[10px] sm:text-xs font-mono-numbers font-black shrink-0 animate-pulse">
                      {unreadNotificationsCount} New
                    </span>
                  )}
                </div>
                <p className="text-[11px] sm:text-xs text-[#94A3B8] hidden xs:block truncate">
                  Real-time database-synchronized activity, rewards, and system notices
                </p>
              </div>
            </div>
          </div>

          {/* Header Action Buttons */}
          <div className="flex items-center gap-2 shrink-0">
            {unreadNotificationsCount > 0 && (
              <button
                onClick={markAllNotificationsAsRead}
                className="px-3 py-2 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-sm"
                title="Mark all notifications as read in database"
              >
                <CheckCheck className="w-4 h-4" />
                <span className="hidden sm:inline">Mark All as Read</span>
              </button>
            )}

            {userNotifications.length > 0 && (
              <button
                onClick={() => setShowClearConfirm(true)}
                className="px-3 py-2 rounded-xl bg-white/5 hover:bg-rose-500/15 text-[#94A3B8] hover:text-rose-400 border border-[#272A31] hover:border-rose-500/30 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-sm"
                title="Clear all notifications"
              >
                <Trash2 className="w-4 h-4" />
                <span className="hidden md:inline">Clear All</span>
              </button>
            )}

            <button
              onClick={onClose}
              className="w-9 h-9 rounded-xl bg-[#151C2B] hover:bg-[#1E2638] text-[#94A3B8] hover:text-white flex items-center justify-center border border-[#272A31] transition-colors cursor-pointer"
              title="Close notifications"
              aria-label="Close notifications"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
        <div className="max-w-4xl mx-auto space-y-4">
          
          {/* Filter Pills Bar */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
            <button
              onClick={() => setActiveFilter('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 ${
                activeFilter === 'all'
                  ? 'bg-amber-400 text-black shadow-md font-black'
                  : 'bg-[#151C2B] text-[#94A3B8] hover:text-white border border-[#272A31]'
              }`}
            >
              All ({userNotifications.length})
            </button>

            <button
              onClick={() => setActiveFilter('unread')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 ${
                activeFilter === 'unread'
                  ? 'bg-amber-400 text-black shadow-md font-black'
                  : 'bg-[#151C2B] text-[#94A3B8] hover:text-white border border-[#272A31]'
              }`}
            >
              Unread ({unreadNotificationsCount})
            </button>

            <button
              onClick={() => setActiveFilter('reward')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 flex items-center gap-1.5 ${
                activeFilter === 'reward'
                  ? 'bg-amber-400 text-black shadow-md font-black'
                  : 'bg-[#151C2B] text-[#94A3B8] hover:text-white border border-[#272A31]'
              }`}
            >
              <Gift className="w-3.5 h-3.5" />
              <span>Rewards</span>
            </button>

            <button
              onClick={() => setActiveFilter('security')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 flex items-center gap-1.5 ${
                activeFilter === 'security'
                  ? 'bg-amber-400 text-black shadow-md font-black'
                  : 'bg-[#151C2B] text-[#94A3B8] hover:text-white border border-[#272A31]'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Security</span>
            </button>

            <button
              onClick={() => setActiveFilter('games')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 flex items-center gap-1.5 ${
                activeFilter === 'games'
                  ? 'bg-amber-400 text-black shadow-md font-black'
                  : 'bg-[#151C2B] text-[#94A3B8] hover:text-white border border-[#272A31]'
              }`}
            >
              <Rocket className="w-3.5 h-3.5" />
              <span>Games & Lottery</span>
            </button>

            {/* Refresh button */}
            <button
              onClick={() => fetchUserNotifications && fetchUserNotifications()}
              disabled={loadingNotifications}
              className="ml-auto w-8 h-8 rounded-xl bg-[#151C2B] hover:bg-[#1E2638] text-[#94A3B8] hover:text-amber-300 border border-[#272A31] flex items-center justify-center transition-colors cursor-pointer shrink-0"
              title="Refresh notifications"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingNotifications ? 'animate-spin text-amber-400' : ''}`} />
            </button>
          </div>

          {/* Notifications Card List */}
          {loadingNotifications && userNotifications.length === 0 ? (
            <div className="py-20 text-center space-y-3">
              <RefreshCw className="w-8 h-8 text-amber-400 animate-spin mx-auto" />
              <p className="text-xs text-[#94A3B8]">Loading synchronized notifications...</p>
            </div>
          ) : filteredNotifications.length > 0 ? (
            <div className="space-y-3">
              {filteredNotifications.map((n) => {
                const isUnread = !n.is_read;
                return (
                  <div
                    key={n.id}
                    onClick={() => handleNotificationClick(n)}
                    className={`group relative rounded-2xl p-4 sm:p-5 transition-all duration-200 cursor-pointer border ${
                      isUnread
                        ? 'bg-[#131B2A] border-amber-500/40 hover:border-amber-400 shadow-[0_0_15px_rgba(245,196,81,0.08)]'
                        : 'bg-[#0E131F] border-[#1F2737] hover:border-[#2D384D] hover:bg-[#121826]'
                    }`}
                  >
                    <div className="flex items-start gap-3.5 sm:gap-4">
                      
                      {/* Icon Container */}
                      <div className={`w-10 h-10 sm:w-11 sm:h-11 rounded-2xl flex items-center justify-center shrink-0 mt-0.5 shadow-inner border transition-transform duration-200 group-hover:scale-105 ${
                        isUnread
                          ? 'bg-[#0B0F19] border-amber-500/40 text-amber-400 shadow-[0_0_12px_rgba(245,196,81,0.2)]'
                          : 'bg-[#0B0F19] border-[#272A31] text-[#94A3B8]'
                      }`}>
                        {getNotificationIcon(n.type)}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className={`font-display font-bold text-sm sm:text-base leading-snug ${
                              isUnread ? 'text-white' : 'text-[#E2E8F0]'
                            }`}>
                              {n.title}
                            </h3>

                            {isUnread && (
                              <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
                            )}
                          </div>

                          <span className="text-[11px] font-mono-numbers text-[#64748B] flex items-center gap-1 shrink-0 whitespace-nowrap">
                            <Clock className="w-3 h-3 text-[#64748B]" />
                            {formatTimestamp(n.created_at)}
                          </span>
                        </div>

                        <p className="text-xs sm:text-sm text-[#94A3B8] leading-relaxed">
                          {n.message}
                        </p>

                        {/* Action link or CTA */}
                        <div className="pt-1.5 flex items-center gap-3">
                          {n.action_url && (
                            <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-400 group-hover:underline">
                              <span>Open details</span>
                              <ExternalLink className="w-3 h-3" />
                            </span>
                          )}

                          {isUnread && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                markNotificationAsRead(n.id);
                              }}
                              className="text-[11px] font-medium text-[#64748B] hover:text-amber-300 transition-colors cursor-pointer"
                            >
                              Mark as read
                            </button>
                          )}
                        </div>
                      </div>

                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* Empty State */
            <div className="rounded-3xl bg-[#0E131F] border border-[#1F2737] p-8 sm:p-12 text-center space-y-4 my-8">
              <div className="w-16 h-16 rounded-3xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400/60 mx-auto">
                <BellOff className="w-8 h-8" />
              </div>
              <div className="space-y-1">
                <h3 className="font-display font-black text-lg text-white">
                  No Notifications Found
                </h3>
                <p className="text-xs sm:text-sm text-[#94A3B8] max-w-md mx-auto">
                  {activeFilter === 'unread'
                    ? "You've read all your notifications! Check back later for daily rewards and announcements."
                    : "You're all caught up! Game winnings, bonus drops, and system alerts will automatically appear here."}
                </p>
              </div>

              {activeFilter !== 'all' && (
                <button
                  onClick={() => setActiveFilter('all')}
                  className="px-4 py-2 rounded-xl btn-gold text-xs font-bold cursor-pointer"
                >
                  View All Notifications
                </button>
              )}
            </div>
          )}

        </div>
      </main>

      {/* Confirmation Modal for Clear All */}
      {showClearConfirm && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-md rounded-2xl bg-[#0B0F19] border border-[#272A31] p-6 space-y-4 shadow-2xl text-left">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400 shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-display font-black text-base text-white">
                  Clear All Notifications?
                </h3>
                <p className="text-xs text-[#94A3B8]">
                  This will permanently remove all notifications from your account history.
                </p>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-white/2 border border-white/5 text-xs text-[#94A3B8]">
              Read and unread alerts will be purged from the database. This action cannot be reversed.
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                onClick={() => setShowClearConfirm(false)}
                disabled={isClearing}
                className="px-4 py-2 rounded-xl bg-[#151C2B] hover:bg-[#1E2638] text-xs font-bold text-[#94A3B8] hover:text-white border border-[#272A31] transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmClear}
                disabled={isClearing}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-xs font-bold text-white transition-all flex items-center gap-1.5 cursor-pointer shadow-lg shadow-rose-600/30"
              >
                {isClearing ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Clearing...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Confirm Clear</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
