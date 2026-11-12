import React, { useState } from 'react';
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
  Trash2 
} from 'lucide-react';

const INITIAL_NOTIFICATIONS = [
  {
    id: 1,
    title: 'Daily FLO Coin Reward Available',
    message: 'Your 24-hour daily reward (up to 1.00 FLO = 1.00 USDT) is ready to claim inside your Wallet!',
    type: 'reward',
    time: 'Recent',
    isUnread: true
  },
  {
    id: 2,
    title: 'Provably Fair Cryptographic Engine',
    message: 'All 12 modular games and lottery draws use immutable SHA-256 pre-commit verification.',
    type: 'security',
    time: 'Active',
    isUnread: false
  }
];

export default function NotificationsModal({ isOpen, onClose, onNavigate }) {
  const [notifications, setNotifications] = useState(INITIAL_NOTIFICATIONS);

  if (!isOpen) return null;

  const unreadCount = notifications.filter(n => n.isUnread).length;

  const handleMarkAllRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, isUnread: false })));
  };

  const handleClearAll = () => {
    setNotifications([]);
  };

  const getIcon = (type) => {
    switch (type) {
      case 'reward': return <Gift className="w-4 h-4 text-amber-400" />;
      case 'lottery': return <Ticket className="w-4 h-4 text-purple-400" />;
      case 'game': return <Rocket className="w-4 h-4 text-emerald-400" />;
      case 'security': return <ShieldCheck className="w-4 h-4 text-blue-400" />;
      default: return <Bell className="w-4 h-4 text-[#94A3B8]" />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div 
        className="w-full max-w-lg rounded-3xl bg-[#0B0F19] border border-[#1F2737] shadow-2xl flex flex-col overflow-hidden text-left relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Glow Accent */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-amber-400 to-transparent" />

        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-[#1F2737] bg-[#07090E]">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Bell className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-display font-black text-base text-white">
                  Notifications
                </h2>
                {unreadCount > 0 && (
                  <span className="px-1.5 py-0.5 rounded-full bg-amber-500 text-black text-[10px] font-mono-numbers font-black">
                    {unreadCount} New
                  </span>
                )}
              </div>
              <span className="text-[10px] text-[#94A3B8]">
                Real-time platform activity & rewards
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-[11px] font-bold text-amber-300 flex items-center gap-1 transition-colors cursor-pointer"
                title="Mark all as read"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                <span>Mark Read</span>
              </button>
            )}

            <button
              onClick={onClose}
              className="w-8 h-8 rounded-xl bg-white/5 hover:bg-white/10 text-[#94A3B8] hover:text-white flex items-center justify-center transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Notifications List */}
        <div className="max-h-[60vh] overflow-y-auto divide-y divide-[#1F2737]/60 p-2 sm:p-3 space-y-1">
          {notifications.map((n) => (
            <div
              key={n.id}
              className={`p-3 rounded-2xl flex items-start gap-3 transition-colors ${
                n.isUnread ? 'bg-[#111827] border border-amber-500/20 shadow-sm' : 'hover:bg-white/2'
              }`}
            >
              <div className="w-8 h-8 rounded-xl bg-[#0B0F19] border border-[#1F2737] flex items-center justify-center shrink-0 mt-0.5 shadow-inner">
                {getIcon(n.type)}
              </div>

              <div className="flex-1 space-y-0.5">
                <div className="flex items-center justify-between">
                  <h3 className="font-display font-bold text-xs text-white">
                    {n.title}
                  </h3>
                  <span className="text-[10px] font-mono-numbers text-[#64748B] flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {n.time}
                  </span>
                </div>
                <p className="text-xs text-[#94A3B8] leading-snug">
                  {n.message}
                </p>
              </div>

              {n.isUnread && (
                <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0 mt-1.5" />
              )}
            </div>
          ))}

          {notifications.length === 0 && (
            <div className="py-12 text-center space-y-2">
              <Bell className="w-8 h-8 text-[#64748B] mx-auto opacity-40" />
              <p className="text-xs text-[#94A3B8] italic">
                You're all caught up! No notifications right now.
              </p>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        {notifications.length > 0 && (
          <div className="p-3 border-t border-[#1F2737] bg-[#07090E] flex items-center justify-between text-xs">
            <button
              onClick={handleClearAll}
              className="text-[#64748B] hover:text-rose-400 flex items-center gap-1 transition-colors cursor-pointer text-[11px]"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear All</span>
            </button>
            <span className="text-[10px] text-[#94A3B8]">
              Automated Push Feeds
            </span>
          </div>
        )}

      </div>
    </div>
  );
}

