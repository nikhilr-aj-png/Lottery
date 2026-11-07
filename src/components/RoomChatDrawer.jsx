import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  MessageSquare, 
  Send, 
  Smile, 
  Users, 
  X, 
  Flame, 
  Trophy, 
  Coins, 
  Sparkles, 
  Volume2, 
  VolumeX, 
  Radio,
  ChevronDown,
  CheckCircle2,
  Clock,
  Heart
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useLottery } from '../context/LotteryContext';

const QUICK_EMOJIS = ['🔥', '🚀', '💎', '👑', '🎉', '🤑', '🍀', '🎲'];

export default function RoomChatDrawer({
  room,
  game,
  isOpen,
  onClose,
  onUnreadChange
}) {
  const { wallet, user, profile, setIsAuthModalOpen, showToast } = useLottery();
  
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [showPresenceList, setShowPresenceList] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [sending, setSending] = useState(false);

  const messagesEndRef = useRef(null);
  const channelRef = useRef(null);
  const lastSendTimeRef = useRef(0);

  const roomId = room?.id || 'standard';
  const gameId = game?.id || 'casino';

  const myUsername = useMemo(() => {
    return profile?.username || user?.user_metadata?.username || (wallet?.address ? `Player_${wallet.address.slice(-4)}` : 'Guest');
  }, [profile?.username, user, wallet?.address]);

  // 1. Fetch recent persistent messages for this room
  useEffect(() => {
    let isMounted = true;
    async function fetchRecentMessages() {
      try {
        const { data, error } = await supabase
          .from('room_chat_messages')
          .select('*')
          .eq('room_id', roomId)
          .order('created_at', { ascending: false })
          .limit(40);

        if (isMounted && !error && data) {
          setMessages(data.reverse());
        }
      } catch (err) {
        console.warn('Error fetching room messages:', err);
      }
    }

    fetchRecentMessages();

    return () => {
      isMounted = false;
    };
  }, [roomId]);

  // 2. Set up Supabase Realtime Channel: Presence + Broadcast
  useEffect(() => {
    const channelName = `realtime:room_${roomId}`;
    const channel = supabase.channel(channelName, {
      config: {
        presence: {
          key: wallet?.address || `guest_${Math.floor(Math.random() * 10000)}`
        }
      }
    });

    channelRef.current = channel;

    // A. PRESENCE SYNC
    channel.on('presence', { event: 'sync' }, () => {
      const state = channel.presenceState();
      const players = [];
      Object.keys(state).forEach(key => {
        state[key].forEach(p => {
          players.push(p);
        });
      });
      setOnlineUsers(players);
    });

    // B. BROADCAST: CHAT MESSAGES
    channel.on('broadcast', { event: 'chat_message' }, ({ payload }) => {
      setMessages(prev => {
        // Prevent duplicate IDs
        if (prev.some(m => m.id === payload.id)) return prev;
        return [...prev.slice(-60), payload];
      });

      if (!isOpen && onUnreadChange) {
        onUnreadChange(prev => (prev || 0) + 1);
      }
    });

    // C. BROADCAST: WIN ANNOUNCEMENTS
    channel.on('broadcast', { event: 'win_alert' }, ({ payload }) => {
      const winMessage = {
        id: `sys_win_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        room_id: roomId,
        game_id: gameId,
        username: payload.username || 'Lucky Player',
        wallet_address: payload.walletAddress || '0x...',
        message: payload.message || `Won +${payload.payout} FC (${payload.multiplier}x)!`,
        message_type: 'system_win',
        metadata: payload,
        created_at: new Date().toISOString()
      };

      setMessages(prev => [...prev.slice(-60), winMessage]);
      if (!isOpen && onUnreadChange) {
        onUnreadChange(prev => (prev || 0) + 1);
      }
    });

    // SUBSCRIBE & TRACK
    channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        const userPresence = {
          userId: user?.id || null,
          username: myUsername,
          walletAddress: wallet?.address || null,
          balance: Number(wallet?.balance || 0),
          joinedAt: new Date().toISOString()
        };
        await channel.track(userPresence);
      }
    });

    return () => {
      channel.unsubscribe();
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [roomId, gameId, wallet?.address, user?.id, myUsername, isOpen, onUnreadChange]);

  // Scroll to bottom when messages update
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  // Handle Send Message
  const handleSendMessage = async (textToSend = null) => {
    const rawText = textToSend !== null ? textToSend : inputText;
    const trimmed = rawText.trim();
    if (!trimmed) return;

    if (!wallet?.address) {
      setIsAuthModalOpen(true);
      showToast('Please connect wallet or log in to chat with other players', 'info');
      return;
    }

    // Rate limiting: 1 message per 1000ms
    const now = Date.now();
    if (now - lastSendTimeRef.current < 1000) {
      showToast('Please slow down your messages slightly', 'warning');
      return;
    }
    lastSendTimeRef.current = now;

    setSending(true);
    const msgId = `msg_${roomId}_${now}_${Math.random().toString(36).substring(7)}`;
    
    const messagePayload = {
      id: msgId,
      room_id: roomId,
      game_id: gameId,
      user_id: user?.id || null,
      wallet_address: wallet.address,
      username: myUsername,
      message: trimmed.slice(0, 150),
      message_type: 'chat',
      metadata: {
        isVip: (wallet.balance || 0) >= 500
      },
      created_at: new Date().toISOString()
    };

    // 1. Optimistic local update
    setMessages(prev => [...prev.slice(-60), messagePayload]);
    setInputText('');

    try {
      // 2. Broadcast to all clients in this room immediately
      if (channelRef.current) {
        await channelRef.current.send({
          type: 'broadcast',
          event: 'chat_message',
          payload: messagePayload
        });
      }

      // 3. Persist asynchronously in database
      await supabase
        .from('room_chat_messages')
        .insert(messagePayload);

    } catch (err) {
      console.warn('Error broadcasting message:', err);
    } finally {
      setSending(false);
    }
  };

  // Quick Emoji Sender
  const handleSendEmoji = (emoji) => {
    handleSendMessage(emoji);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-full sm:w-96 bg-[#0B0F19]/95 backdrop-blur-xl border-l border-[#272a31] shadow-2xl flex flex-col justify-between text-left animate-in slide-in-from-right duration-200">
      
      {/* 1. CHAT HEADER */}
      <div className="p-3.5 sm:p-4 border-b border-[#1f2737] bg-[#07090E] flex items-center justify-between">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-amber-500/20 to-purple-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
            <MessageSquare className="w-4 h-4" />
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-display font-black text-sm text-white truncate">
                {room?.name?.split(':')[0] || 'Room'} Chat
              </h3>
              <span className="text-[9px] font-mono-numbers px-1.5 py-0.2 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30 font-bold uppercase">
                {game?.name}
              </span>
            </div>

            {/* Online Presence Pill */}
            <button
              onClick={() => setShowPresenceList(!showPresenceList)}
              className="flex items-center gap-1.5 text-[11px] text-emerald-400 font-mono-numbers hover:text-emerald-300 transition-colors cursor-pointer"
            >
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_6px_rgba(34,197,94,0.6)]" />
              <span>{onlineUsers.length || 1} Seated Online</span>
              <ChevronDown className="w-3 h-3 text-[#9b8f7c]" />
            </button>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className="p-1.5 rounded-lg text-[#9b8f7c] hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
            title={soundEnabled ? 'Mute Chat Alerts' : 'Unmute Chat Alerts'}
          >
            {soundEnabled ? <Volume2 className="w-4 h-4 text-emerald-400" /> : <VolumeX className="w-4 h-4" />}
          </button>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#9b8f7c] hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
            title="Close Chat Drawer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 2. PRESENCE ROSTER POPOVER (IF TOGGLED) */}
      {showPresenceList && (
        <div className="bg-[#141924] border-b border-[#272a31] p-3 text-xs space-y-2 animate-in slide-in-from-top-1 duration-150">
          <div className="flex items-center justify-between text-[11px] text-[#9b8f7c] font-bold">
            <span className="flex items-center gap-1">
              <Users className="w-3.5 h-3.5 text-amber-400" />
              <span>Players At This Table:</span>
            </span>
            <span className="font-mono-numbers text-emerald-400">{onlineUsers.length || 1} Connected</span>
          </div>

          <div className="max-h-36 overflow-y-auto no-scrollbar space-y-1.5 pr-1">
            {onlineUsers.map((p, idx) => {
              const isMe = p.walletAddress && p.walletAddress === wallet?.address;
              return (
                <div 
                  key={idx}
                  className="flex items-center justify-between p-1.5 rounded-lg bg-[#0b0e14] border border-[#272a31] text-[11px]"
                >
                  <div className="flex items-center gap-2 truncate">
                    <div className="w-5 h-5 rounded-full bg-gradient-to-br from-amber-400 to-purple-600 flex items-center justify-center text-[10px] text-black font-extrabold shrink-0">
                      {(p.username || 'P')[0].toUpperCase()}
                    </div>
                    <span className="text-white font-medium truncate">
                      {p.username || 'Anonymous'} {isMe && <span className="text-amber-400 text-[10px] font-bold">(You)</span>}
                    </span>
                  </div>

                  <span className="text-[10px] text-emerald-400 font-mono-numbers shrink-0 font-bold">
                    ONLINE
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 3. MESSAGE STREAM FEED */}
      <div className="flex-1 overflow-y-auto p-3.5 sm:p-4 space-y-3 no-scrollbar text-xs">
        
        {/* Welcome pinned notice */}
        <div className="p-3 rounded-2xl bg-gradient-to-r from-amber-500/10 via-purple-500/10 to-transparent border border-amber-500/20 text-[11px] text-[#9b8f7c] space-y-1">
          <div className="flex items-center gap-1.5 text-amber-300 font-bold">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Welcome to {room?.name || 'Room'}!</span>
          </div>
          <p className="leading-snug">
            Chat with seated players, celebrate big multipliers, and follow live win alerts. Be polite and respectful.
          </p>
        </div>

        {/* Message Cards */}
        {messages.map((m) => {
          const isSystemWin = m.message_type === 'system_win';
          const isMe = m.wallet_address && m.wallet_address === wallet?.address;

          if (isSystemWin) {
            return (
              <div 
                key={m.id}
                className="p-3 rounded-2xl bg-gradient-to-r from-amber-500/20 via-yellow-500/15 to-emerald-500/20 border border-amber-500/40 text-left shadow-lg space-y-1 animate-in zoom-in-95 duration-200"
              >
                <div className="flex items-center justify-between text-[10px] text-amber-300 font-bold uppercase font-mono-numbers">
                  <span className="flex items-center gap-1">
                    <Trophy className="w-3.5 h-3.5 text-amber-400 fill-current" />
                    <span>BIG WIN ALERT!</span>
                  </span>
                  <span>{new Date(m.created_at || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
                <p className="text-white font-bold text-xs">
                  <span className="text-amber-300 font-extrabold">{m.username}</span> hit a winning streak in {game?.name}!
                </p>
                <div className="text-[11px] font-mono-numbers font-black text-emerald-400">
                  ⭐ {m.message}
                </div>
              </div>
            );
          }

          return (
            <div 
              key={m.id}
              className={`p-2.5 rounded-2xl border text-left transition-all ${
                isMe 
                  ? 'bg-amber-500/10 border-amber-500/30 ml-3' 
                  : 'bg-[#141924]/80 border-[#272a31] mr-3'
              }`}
            >
              <div className="flex items-center justify-between text-[10px] mb-1">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className={`font-bold truncate ${isMe ? 'text-amber-400 font-black' : 'text-[#8b92a2]'}`}>
                    {isMe ? 'You' : m.username}
                  </span>
                  {m.metadata?.isVip && (
                    <span className="text-[8px] font-mono-numbers px-1 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold">
                      VIP
                    </span>
                  )}
                </div>

                <span className="text-[9px] text-[#64748b] font-mono-numbers shrink-0">
                  {new Date(m.created_at || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>

              <div className="text-white text-xs break-words leading-relaxed">
                {m.message}
              </div>
            </div>
          );
        })}

        <div ref={messagesEndRef} />
      </div>

      {/* 4. CHAT INPUT & QUICK EMOJI TOOLBAR */}
      <div className="p-3 sm:p-4 border-t border-[#1f2737] bg-[#07090E] space-y-2.5">
        
        {/* Quick Emoji Strip */}
        <div className="flex items-center justify-between gap-1 overflow-x-auto no-scrollbar py-0.5">
          {QUICK_EMOJIS.map((emoji, i) => (
            <button
              key={i}
              type="button"
              onClick={() => handleSendEmoji(emoji)}
              className="p-1.5 rounded-lg bg-[#141924] hover:bg-[#1f2737] hover:scale-115 text-sm transition-transform cursor-pointer shrink-0"
              title={`Send ${emoji}`}
            >
              {emoji}
            </button>
          ))}
        </div>

        {/* Text Input Row */}
        <form 
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage();
          }}
          className="flex items-center gap-2"
        >
          <div className="flex-1 bg-[#141924] border border-[#272a31] focus-within:border-amber-500/50 rounded-xl px-3 py-2 flex items-center gap-2 shadow-inner">
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder={wallet?.address ? "Message room..." : "Log in to chat..."}
              maxLength={150}
              disabled={sending}
              className="w-full bg-transparent text-xs text-white placeholder-[#64748B] outline-none"
            />
            {inputText.length > 100 && (
              <span className="text-[9px] font-mono-numbers text-[#9b8f7c]">
                {150 - inputText.length}
              </span>
            )}
          </div>

          <button
            type="submit"
            disabled={!inputText.trim() || sending}
            className="p-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black font-extrabold transition-all shadow-md cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
            title="Send Message"
          >
            <Send className="w-4 h-4 fill-current" />
          </button>
        </form>

        <div className="flex items-center justify-between text-[10px] text-[#64748B]">
          <span>Free social entertainment with Flow Coins</span>
          <span>150 chars max</span>
        </div>

      </div>

    </div>
  );
}
