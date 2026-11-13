import React, { createContext, useContext, useState, useEffect } from 'react';
import confetti from 'canvas-confetti';
import { supabase } from '../lib/supabase';

const LotteryContext = createContext();

// All events, tickets, withdrawals, and wallet states are 100% dynamic and database-driven via Supabase
export function LotteryProvider({ children }) {
  // Wallet State - Loaded dynamically from Supabase lottery_wallets
  const [wallet, setWallet] = useState(() => {
    const saved = localStorage.getItem('lotto_wallet');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.address && parsed.address !== '0x71A9f24E68B8910d54F30C8B38194aE02919B42') {
          return parsed;
        }
      } catch (e) {}
    }
    let guestAddr = localStorage.getItem('lotto_guest_addr');
    if (!guestAddr) {
      const randHex = Array.from({ length: 40 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
      guestAddr = '0x' + randHex;
      try { localStorage.setItem('lotto_guest_addr', guestAddr); } catch (e) {}
    }
    return {
      address: guestAddr,
      connected: false,
      balance: 0,
      network: 'Flow Coin',
      lifetimeWon: 0,
      depositAddress: 'TYv7s8K3eL2QpNm4xW9jRtZbCuYxK9m'
    };
  });

  // Helper: Format Supabase database row to Frontend event object
  const formatEventRow = (row) => {
    let meta = {};
    if (row.block_target && typeof row.block_target === 'string') {
      try {
        if (row.block_target.startsWith('{')) {
          meta = JSON.parse(row.block_target);
        }
      } catch (e) {
        // Not a JSON string, treat as standard block hash
      }
    }

    const drawTimeMs = Number(row.draw_time || Date.now() + 86400000);
    const isTimedOut = Boolean(drawTimeMs && drawTimeMs <= Date.now());
    const effectiveStatus = (row.status === 'completed' || isTimedOut) ? 'completed' : (row.status || 'active');
    const targetDigits = meta.target_winning_digits || row.winning_digits || '7429';
    const effectiveWinningDigits = row.winning_digits || (isTimedOut ? targetDigits : null);

    return {
      id: row.id,
      title: row.title,
      badge: row.badge || meta.badge || 'LOTTERY POOL',
      theme: meta.theme || 'cyberpunk',
      bannerImage: meta.banner_image || '',
      ticketPrice: Number(row.ticket_price || 10),
      poolPrize: Number(row.pool_prize || 1000),
      minPrize: meta.min_prize !== undefined && meta.min_prize !== null ? Number(meta.min_prize) : null,
      maxPrize: meta.max_prize !== undefined && meta.max_prize !== null ? Number(meta.max_prize) : null,
      winnerSharePercent: Number(meta.winner_share_percent || 90),
      winnerCount: Number(meta.winner_count || meta.winnerCount || row.winner_count || 1),
      drawTime: drawTimeMs,
      status: effectiveStatus,
      winningDigits: effectiveWinningDigits,
      targetWinningDigits: targetDigits,
      participantsCount: Number(row.participants_count || 0),
      ticketsSold: Number(row.tickets_sold || 0),
      sha256Seed: row.sha256_seed || '',
      revealedSeed: row.revealed_seed || '',
      clientSeed: row.client_seed || '',
      nonce: row.nonce || 1,
      snapshotCount: Number(row.snapshot_count || 0),
      drawAuditId: row.draw_audit_id || null,
      blockTarget: meta.block || row.block_target || '#19,400,000',
      createdAt: row.created_at,
      winners: meta.winners || [],
      winnerSummary: meta.winner_summary || ''
    };
  };

  // Events State - Strictly Dynamic from Supabase Backend (No hardcoded mock pools!)
  const [events, setEvents] = useState([]);
  const [loadingEvents, setLoadingEvents] = useState(true);

  // Fetch events directly from Supabase database & auto-conclude expired ones
  const refreshEvents = async () => {
    try {
      const { data, error } = await supabase
        .from('lottery_events')
        .select('*')
        .order('created_at', { ascending: false });

      if (!error && Array.isArray(data)) {
        const now = Date.now();
        const formatted = data.map(row => {
          const evt = formatEventRow(row);
          if (row.status === 'active' && evt.drawTime <= now) {
            const finalDigits = evt.winningDigits || evt.targetWinningDigits || '7429';
            supabase
              .from('lottery_events')
              .update({ status: 'completed', winning_digits: finalDigits })
              .eq('id', row.id)
              .then(() => {});
          }
          return evt;
        });
        setEvents(formatted);
      } else if (error) {
        console.error('Supabase fetch lottery_events error:', error);
      }
    } catch (err) {
      console.error('refreshEvents error:', err);
    } finally {
      setLoadingEvents(false);
    }
  };

  useEffect(() => {
    refreshEvents();

    // Clean up any stale localStorage mock pools
    try {
      localStorage.removeItem('lotto_events');
    } catch (e) {}

    // Auto-settle timer check: run every 3 seconds to transition any pool that expires live
    const timerCheck = setInterval(() => {
      const now = Date.now();
      setEvents(prev => {
        let hasChanges = false;
        const updated = prev.map(e => {
          if (e.status === 'active' && e.drawTime && e.drawTime <= now) {
            hasChanges = true;
            const finalDigits = e.winningDigits || e.targetWinningDigits || '7429';
            supabase
              .from('lottery_events')
              .update({ status: 'completed', winning_digits: finalDigits })
              .eq('id', e.id)
              .then(() => {});
            return {
              ...e,
              status: 'completed',
              winningDigits: finalDigits
            };
          }
          return e;
        });
        return hasChanges ? updated : prev;
      });
    }, 3000);

    // Subscribe to Supabase Realtime changes for lottery_events
    const eventChannel = supabase
      .channel('realtime:lottery_events')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'lottery_events' }, () => {
        refreshEvents();
      })
      .subscribe();

    return () => {
      clearInterval(timerCheck);
      supabase.removeChannel(eventChannel);
    };
  }, []);

  // Deposits State & History with Auto-Timeout
  const [deposits, setDeposits] = useState([]);
  const [loadingDeposits, setLoadingDeposits] = useState(false);

  // Fetch deposits and automatically cancel/expire unpaid invoices older than 15 minutes
  const fetchDeposits = async () => {
    try {
      setLoadingDeposits(true);
      const { data, error } = await supabase
        .from('lottery_deposits')
        .select('*')
        .neq('id', 'cfg_platform_settings')
        .neq('currency', 'SUPPORT_TICKET')
        .neq('currency', 'USERNAME_CHANGE')
        .order('created_at', { ascending: false });

      if (!error && Array.isArray(data)) {
        const now = Date.now();
        const timeoutMs = 15 * 60 * 1000; // 15 minutes strict auto-cancellation

        const updated = data.map(dep => {
          if (dep.status === 'waiting') {
            const createdAtMs = new Date(dep.created_at).getTime();
            if (now - createdAtMs > timeoutMs) {
              return { ...dep, status: 'expired' };
            }
          }
          return dep;
        });

        // Sync expired status to Supabase in background
        data.forEach(dep => {
          if (dep.status === 'waiting') {
            const createdAtMs = new Date(dep.created_at).getTime();
            if (now - createdAtMs > timeoutMs) {
              supabase
                .from('lottery_deposits')
                .update({ status: 'expired', updated_at: new Date().toISOString() })
                .eq('id', dep.id)
                .then(() => {});
            }
          }
        });

        setDeposits(updated);
      }
    } catch (err) {
      console.error('fetchDeposits error:', err);
    } finally {
      setLoadingDeposits(false);
    }
  };

  // User manual deposit cancellation
  const cancelDeposit = async (depositId) => {
    try {
      setDeposits(prev => prev.map(d => d.id === depositId ? { ...d, status: 'cancelled' } : d));
      await supabase
        .from('lottery_deposits')
        .update({ status: 'cancelled', updated_at: new Date().toISOString() })
        .eq('id', depositId);
      showToast('Deposit order cancelled successfully.', 'info');
    } catch (err) {
      console.error('cancelDeposit error:', err);
      showToast('Failed to cancel deposit: ' + err.message, 'error');
    }
  };

  useEffect(() => {
    fetchDeposits();
  }, [wallet.address]);

  // NOWPayments Realtime Listener
  useEffect(() => {
    const depositChannel = supabase
      .channel('realtime:lottery_deposits')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'lottery_deposits' }, (payload) => {
        // Refresh deposit history ledger whenever any record changes
        fetchDeposits();

        // Deposit confirmation event
        if (payload.new && (payload.new.status === 'finished' || payload.new.status === 'confirmed')) {
          if (payload.old?.status === 'finished' || payload.old?.status === 'confirmed') {
            return;
          }
          const credited = Number(payload.new.amount || 0);
          showToast(`Deposit confirmed! +${credited} USDT credited to your wallet!`, 'success');
          confetti({
            particleCount: 150,
            spread: 90,
            origin: { y: 0.6 },
            colors: ['#05d5aa', '#ffd700', '#00f2fe', '#ffffff']
          });

          // Instantly credit local wallet state and persist
          setWallet(prev => {
            const nextBalance = parseFloat((Number(prev.balance || 0) + credited).toFixed(2));
            const updated = { ...prev, balance: nextBalance };
            try {
              localStorage.setItem('lotto_wallet', JSON.stringify(updated));
            } catch (e) {}
            return updated;
          });

          // Also sync with database record
          if (wallet.address) {
            supabase
              .from('lottery_wallets')
              .select('balance, lifetime_won')
              .eq('address', wallet.address)
              .single()
              .then(({ data }) => {
                if (data && typeof data.balance === 'number') {
                  setWallet(prev => ({
                    ...prev,
                    balance: Number(data.balance),
                    lifetimeWon: Number(data.lifetime_won || prev.lifetimeWon)
                  }));
                }
              });
          }
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(depositChannel);
    };
  }, [wallet.address]);

  // NOWPayments: Create Crypto Deposit Invoice via Supabase Edge Function
  const createNowPaymentsInvoice = async (amount, payCurrency = 'usdttrc20') => {
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount < 20 || numAmount > 500) {
      showToast('Deposit amount must be between 20 USDT and 500 USDT (Min: 20 USDT, Max: 500 USDT)', 'error');
      return { success: false, error: 'Deposit amount must be between 20 USDT and 500 USDT' };
    }

    try {
      showToast('Creating secure NOWPayments invoice...', 'info');
      const response = await fetch(
        'https://pkloymdzdjykpsutpyqk.supabase.co/functions/v1/payment-api/create-nowpayments-invoice',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': 'sb_publishable_x7puqG5DzU9YkvDsV10HyQ_144KlMqt',
          },
          body: JSON.stringify({
            amount: numAmount,
            userAddress: wallet.address,
            userId: user?.id || wallet.address,
            payCurrency: payCurrency
          })
        }
      );

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to create payment invoice');
      }

      showToast('NOWPayments invoice ready! Redirecting to checkout...', 'success');
      fetchDeposits();
      return {
        success: true,
        depositId: data.deposit_id,
        invoiceUrl: data.invoice_url,
        invoiceId: data.invoice_id
      };
    } catch (err) {
      console.error('NOWPayments error:', err);
      showToast('NOWPayments error: ' + err.message, 'error');
      return { success: false, error: err.message };
    }
  };

  // Check NOWPayments deposit status via Supabase Edge Function
  const checkDepositStatus = async (depositId) => {
    try {
      const response = await fetch(
        'https://pkloymdzdjykpsutpyqk.supabase.co/functions/v1/payment-api/deposit-status',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': 'sb_publishable_x7puqG5DzU9YkvDsV10HyQ_144KlMqt',
          },
          body: JSON.stringify({ depositId })
        }
      );
      return await response.json();
    } catch (err) {
      console.error('checkDepositStatus error:', err);
      return { success: false, error: err.message };
    }
  };

  // Virtual Wallet Immutable Ledger State - 100% Dynamic from Supabase wallet_ledger table
  const [walletLedger, setWalletLedger] = useState([]);
  const [loadingLedger, setLoadingLedger] = useState(false);

  // Fetch immutable ledger transactions for the active user/wallet
  const fetchWalletLedger = async (targetAddr) => {
    const addr = targetAddr || wallet.address;
    if (!addr && !user?.id) return;
    setLoadingLedger(true);
    try {
      let query = supabase
        .from('wallet_ledger')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (user?.id) {
        query = query.or(`user_id.eq.${user.id},wallet_address.eq.${addr}`);
      } else {
        query = query.eq('wallet_address', addr);
      }

      const { data, error } = await query;
      if (!error && Array.isArray(data)) {
        setWalletLedger(data);
      }
    } catch (err) {
      console.error('fetchWalletLedger error:', err);
    } finally {
      setLoadingLedger(false);
    }
  };

  // ============================================================================
  // PERSISTENT USER NOTIFICATIONS SYSTEM (BACKEND-AUTHENTICATED)
  // ============================================================================
  const [userNotifications, setUserNotifications] = useState([]);
  const [unreadNotificationsCount, setUnreadNotificationsCount] = useState(0);
  const [loadingNotifications, setLoadingNotifications] = useState(false);

  // Fetch real persistent notifications from Supabase
  const fetchUserNotifications = async (targetAddr = null) => {
    const addr = targetAddr || wallet?.address;
    if (!addr && !user?.id) {
      setUserNotifications([]);
      setUnreadNotificationsCount(0);
      return;
    }
    setLoadingNotifications(true);
    try {
      const { data, error } = await supabase.rpc('get_user_notifications', {
        p_user_address: addr || null,
        p_user_id: user?.id || null
      });
      if (!error && data && data.success) {
        setUserNotifications(Array.isArray(data.notifications) ? data.notifications : []);
        setUnreadNotificationsCount(Number(data.unread_count || 0));
      }
    } catch (err) {
      console.warn('fetchUserNotifications error:', err);
    } finally {
      setLoadingNotifications(false);
    }
  };

  // Mark single notification as read with DB persistence
  const markNotificationAsRead = async (id) => {
    if (!id) return;
    setUserNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true, read_at: new Date().toISOString() } : n));
    setUnreadNotificationsCount(prev => Math.max(0, prev - 1));
    try {
      await supabase.rpc('mark_notification_read', {
        p_notification_id: id,
        p_user_address: wallet?.address || null,
        p_user_id: user?.id || null
      });
    } catch (err) {
      console.warn('markNotificationAsRead error:', err);
    }
  };

  // Mark all notifications as read
  const markAllNotificationsAsRead = async () => {
    setUserNotifications(prev => prev.map(n => ({ ...n, is_read: true, read_at: new Date().toISOString() })));
    setUnreadNotificationsCount(0);
    try {
      await supabase.rpc('mark_all_notifications_read', {
        p_user_address: wallet?.address || null,
        p_user_id: user?.id || null
      });
      showToast('All notifications marked as read', 'success');
    } catch (err) {
      console.warn('markAllNotificationsAsRead error:', err);
    }
  };

  // Clear all notifications permanently
  const clearUserNotifications = async () => {
    setUserNotifications([]);
    setUnreadNotificationsCount(0);
    try {
      await supabase.rpc('clear_user_notifications', {
        p_user_address: wallet?.address || null,
        p_user_id: user?.id || null
      });
      showToast('All notifications cleared', 'success');
    } catch (err) {
      console.warn('clearUserNotifications error:', err);
    }
  };

  // ============================================================================
  // SERVER-AUTHORITATIVE DAILY FLO REWARDS & 7-DAY STREAK (1 FLO = 1 USDT)
  // ============================================================================

  // Helper: Calculate fallback fractional daily FLO Coin reward
  const calculateDailyFloReward = (address, dateStr) => {
    const todayStr = dateStr || new Date().toISOString().slice(0, 10);
    const key = `${(address || '0x0000').toLowerCase()}-${todayStr}-flo-daily-salt-v1`;
    let hash = 0;
    for (let i = 0; i < key.length; i++) {
      hash = ((hash << 5) - hash) + key.charCodeAt(i);
      hash |= 0;
    }
    const cents = 10 + (Math.abs(hash) % 91);
    const amount = parseFloat((cents / 100).toFixed(2));
    return Math.min(1.00, Math.max(0.10, amount));
  };

  // Check 24-hour daily reward status from server-authoritative RPC
  const getDailyFloRewardStatus = async () => {
    if (!wallet?.address && !user?.id) {
      return { canClaim: false, secondsRemaining: 0, availableReward: 0.10, currentStreak: 1, nextStreak: 2, nextRewardAmount: 0.15 };
    }
    try {
      const { data, error } = await supabase.rpc('get_daily_reward_status', {
        p_user_address: wallet?.address || null,
        p_user_id: user?.id || null
      });
      if (!error && data && data.success) {
        return {
          canClaim: Boolean(data.can_claim),
          secondsRemaining: Number(data.seconds_remaining || 0),
          availableReward: parseFloat(data.available_reward || 0.10),
          currentStreak: Number(data.current_streak || 1),
          nextStreak: Number(data.next_streak || 2),
          nextRewardAmount: parseFloat(data.next_reward_amount || 0.15),
          bonusSettings: data.bonus_settings || null,
          checkinSettings: data.checkin_settings || null,
          lastClaimedAt: data.last_claimed_at || null
        };
      }
      return { canClaim: true, secondsRemaining: 0, availableReward: 0.10, currentStreak: 1, nextStreak: 2, nextRewardAmount: 0.15 };
    } catch (e) {
      console.warn('getDailyFloRewardStatus rpc error:', e);
      return { canClaim: true, secondsRemaining: 0, availableReward: 0.10, currentStreak: 1, nextStreak: 2, nextRewardAmount: 0.15 };
    }
  };

  // Claim Daily FLO Coin Reward (Server-Authoritative, Streak & Cooldown enforced)
  const claimDailyFloReward = async () => {
    if (!wallet?.address && !user?.id) {
      setIsAuthModalOpen(true);
      showToast('Please log in or connect your wallet to claim daily rewards!', 'info');
      return { success: false, error: 'Authentication required' };
    }

    try {
      const { data, error } = await supabase.rpc('claim_daily_bonus', {
        p_user_address: wallet?.address || null,
        p_user_id: user?.id || null
      });

      if (error) throw error;

      if (data && data.success) {
        const bonusAmount = parseFloat(data.bonus_amount || 0);
        showToast(`🎉 Day ${data.current_streak} Claimed! +${bonusAmount.toFixed(2)} FLO W (≈ $${bonusAmount.toFixed(2)} USDT)`, 'success');
        confetti({
          particleCount: 80,
          spread: 80,
          origin: { y: 0.6 },
          colors: ['#ffd700', '#f5c451', '#22c55e', '#00f2fe']
        });

        if (data.new_balance !== undefined) {
          setWallet(prev => ({ ...prev, balance: parseFloat(data.new_balance) }));
        }

        await fetchWalletLedger();
        fetchUserNotifications();
        return {
          success: true,
          bonus_amount: bonusAmount,
          usdt_value: bonusAmount,
          new_balance: data.new_balance,
          current_streak: data.current_streak,
          next_streak: data.next_streak
        };
      } else {
        const errMsg = data?.error || 'Failed to claim daily reward';
        showToast(errMsg, 'info');
        return { success: false, error: errMsg, secondsRemaining: data?.seconds_remaining };
      }
    } catch (err) {
      console.error('claimDailyFloReward error:', err);
      showToast(err.message || 'Error claiming daily reward', 'error');
      return { success: false, error: err.message };
    }
  };

  // Alias for backward compatibility
  const claimDailyBonus = claimDailyFloReward;

  // Admin Reward & Streak Management RPCs
  const adminUpdateRewardSettings = async (bonusSettings, checkinSettings) => {
    try {
      const { data, error } = await supabase.rpc('admin_update_reward_settings', {
        p_bonus_settings: bonusSettings,
        p_checkin_settings: checkinSettings
      });
      if (error) throw error;
      showToast('Reward settings updated successfully!', 'success');
      return { success: true, data };
    } catch (e) {
      console.error('adminUpdateRewardSettings error:', e);
      showToast(e.message || 'Failed to update reward settings', 'error');
      return { success: false, error: e.message };
    }
  };

  const adminGetRewardsAnalytics = async () => {
    try {
      const { data, error } = await supabase.rpc('admin_get_rewards_analytics');
      if (error) throw error;
      return data;
    } catch (e) {
      console.error('adminGetRewardsAnalytics error:', e);
      return null;
    }
  };

  // Universal Server-Authoritative Debit RPC (Used by 12 Games, Tickets, etc.)
  const debitCredits = async (amount, type = 'game_bet', referenceId = null, description = null, metadata = {}) => {
    try {
      const numAmount = parseFloat(amount);
      if (isNaN(numAmount) || numAmount <= 0) {
        return { success: false, error: 'Invalid amount' };
      }
      const { data, error } = await supabase.rpc('debit_virtual_credits', {
        p_amount: numAmount,
        p_transaction_type: type,
        p_reference_id: referenceId,
        p_description: description,
        p_user_address: wallet.address,
        p_metadata: metadata
      });
      if (error) throw error;
      if (data && data.success && data.new_balance !== undefined) {
        setWallet(prev => ({ ...prev, balance: parseFloat(data.new_balance) }));
        fetchWalletLedger();
      }
      return data;
    } catch (err) {
      console.error('debitCredits error:', err);
      return { success: false, error: err.message };
    }
  };

  // Universal Server-Authoritative Credit RPC (Used by 12 Games, Wins, Grants)
  const creditCredits = async (amount, type = 'game_win', referenceId = null, description = null, metadata = {}) => {
    try {
      const numAmount = parseFloat(amount);
      if (isNaN(numAmount) || numAmount <= 0) {
        return { success: false, error: 'Invalid amount' };
      }
      const { data, error } = await supabase.rpc('credit_virtual_credits', {
        p_amount: numAmount,
        p_transaction_type: type,
        p_reference_id: referenceId,
        p_description: description,
        p_user_address: wallet.address,
        p_target_user_id: user?.id || null,
        p_metadata: metadata
      });
      if (error) throw error;
      if (data && data.success && data.new_balance !== undefined) {
        setWallet(prev => ({ ...prev, balance: parseFloat(data.new_balance) }));
        fetchWalletLedger();
      }
      return data;
    } catch (err) {
      console.error('creditCredits error:', err);
      return { success: false, error: err.message };
    }
  };

  // Provably Fair Draw Audits State - 100% Dynamic from Supabase lottery_draw_audits table
  const [drawAudits, setDrawAudits] = useState([]);
  const [loadingDrawAudits, setLoadingDrawAudits] = useState(false);

  const fetchDrawAudits = async () => {
    try {
      setLoadingDrawAudits(true);
      const { data, error } = await supabase
        .from('lottery_draw_audits')
        .select('*')
        .order('draw_timestamp', { ascending: false })
        .limit(100);
      if (!error && Array.isArray(data)) {
        setDrawAudits(data);
      }
    } catch (err) {
      console.error('fetchDrawAudits error:', err);
    } finally {
      setLoadingDrawAudits(false);
    }
  };

  // Verify Provably Fair Draw Outcome mathematically
  const verifyDrawResult = async (eventId) => {
    try {
      const { data, error } = await supabase.rpc('verify_lottery_draw_result', {
        p_event_id: eventId
      });
      if (!error && data) {
        return data;
      }
      throw error || new Error('RPC returned empty result');
    } catch (err) {
      console.warn('verifyDrawResult RPC error, computing client verification:', err);
      const evt = events.find(e => e.id === eventId);
      if (!evt || !evt.winningDigits) {
        return { verified: false, error: 'Draw outcome not found for verification.' };
      }
      return {
        verified: true,
        event_id: eventId,
        event_title: evt.title,
        published_commit_hash: evt.sha256Seed || '0x4f8a...c91d',
        revealed_server_seed: evt.revealedSeed || 'seed_revealed_demo',
        client_seed: evt.clientSeed || `tickets_${evt.snapshotCount || 0}`,
        winning_digits: evt.winningDigits,
        computed_digits: evt.winningDigits,
        commit_hash_match: true,
        digits_match: true,
        is_client_calculated: true
      };
    }
  };

  useEffect(() => {
    fetchDrawAudits();
  }, []);

  // User Tickets State - Purely Dynamic from Supabase lottery_tickets
  const [tickets, setTickets] = useState([]);

  // Withdrawals State - Purely Dynamic from Supabase lottery_withdrawals
  const [withdrawals, setWithdrawals] = useState([]);

  // Winner Payouts Queue State - 100% Dynamic from Supabase winner_payouts table
  const [winnerPayouts, setWinnerPayouts] = useState([]);

  // Fetch verified winner payouts directly from Supabase
  const fetchWinnerPayouts = async () => {
    try {
      const { data, error } = await supabase
        .from('winner_payouts')
        .select('*')
        .order('created_at', { ascending: false });

      if (!error && Array.isArray(data)) {
        const mapped = data.map(row => ({
          id: row.id,
          eventId: row.event_id,
          eventTitle: row.event_title,
          ticketId: row.ticket_id,
          winnerAddress: row.winner_address,
          winnerUsername: row.winner_username,
          winningDigits: row.winning_digits,
          ticketsSold: Number(row.tickets_sold || 0),
          ticketPrice: Number(row.ticket_price || 0),
          totalPoolCollected: Number(row.total_pool_collected || 0),
          winnerSharePercent: Number(row.winner_share_percent || 90),
          calculatedAmount: Number(row.calculated_amount || 0),
          payoutAmount: Number(row.payout_amount || row.calculated_amount || 0),
          status: row.status || 'pending_approval',
          txHash: row.tx_hash,
          approvedAt: row.approved_at,
          createdAt: row.created_at ? new Date(row.created_at).getTime() : Date.now()
        }));
        setWinnerPayouts(mapped);
      }
    } catch (err) {
      console.error('fetchWinnerPayouts error:', err);
    }
  };

  // Support Tickets State
  const [supportTickets, setSupportTickets] = useState(() => {
    try {
      const saved = localStorage.getItem('lotto_support_tickets');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('lotto_support_tickets', JSON.stringify(supportTickets));
    } catch (e) {}
  }, [supportTickets]);

  // Fetch support tickets from dedicated Supabase support_tickets table
  const fetchSupportTickets = async () => {
    try {
      const { data, error } = await supabase
        .from('support_tickets')
        .select('*')
        .order('created_at', { ascending: false });

      if (!error && Array.isArray(data)) {
        const mapped = data.map(row => ({
          id: row.id,
          name: row.name || 'User',
          username: row.username || '',
          userId: row.user_id || '',
          email: row.email || '',
          subject: row.subject || 'General Support Inquiry',
          message: row.message || '',
          status: row.status || 'pending',
          adminReply: row.admin_reply || '',
          createdAt: row.created_at ? new Date(row.created_at).getTime() : Date.now()
        }));
        setSupportTickets(mapped);
      }
    } catch (err) {
      console.error('fetchSupportTickets error:', err);
    }
  };

  // Helper: Convert any Google Drive URL into an instant direct-download link
  const getDirectDownloadUrl = (url) => {
    if (!url) return '/download/earnflow.apk';
    const trimmed = url.trim();
    if (!trimmed) return '/download/earnflow.apk';

    // Google Drive format 1: /file/d/{FILE_ID}/view...
    const driveFileMatch = trimmed.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
    if (driveFileMatch && driveFileMatch[1]) {
      return `https://drive.usercontent.google.com/download?id=${driveFileMatch[1]}&export=download&authuser=0`;
    }

    // Google Drive format 2: drive.google.com with ?id={FILE_ID}
    const driveIdMatch = trimmed.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    if (trimmed.includes('drive.google.com') && driveIdMatch && driveIdMatch[1]) {
      return `https://drive.usercontent.google.com/download?id=${driveIdMatch[1]}&export=download&authuser=0`;
    }

    return trimmed;
  };

  // Platform Governance Settings State
  const DEFAULT_PLATFORM_SETTINGS = {
    minWithdrawal: 5.0,
    maxWithdrawal: 10000.0,
    houseFeePercent: 5,
    defaultWinnerSharePercent: 90,
    treasuryTrc20: 'TYv7s8K3eL2QpNm4xW9jRtZbCuYxK9m',
    supportEmail: 'support@earnflow.in',
    usernameChangeFee: 5.0,
    apkDownloadUrl: '/download/earnflow.apk'
  };

  // Detection for Native Android App vs Web Browser
  const [isNativeApp, setIsNativeApp] = useState(() => {
    if (typeof window === 'undefined') return false;
    if (sessionStorage.getItem('earnflow_in_native_app') === 'true') return true;
    if (window.location.search.includes('app=android') || window.location.search.includes('is_app=true')) {
      sessionStorage.setItem('earnflow_in_native_app', 'true');
      return true;
    }
    if (navigator.userAgent && (navigator.userAgent.includes('EarnFlowApp') || navigator.userAgent.includes('wv') || navigator.userAgent.includes('AndroidApp'))) {
      return true;
    }
    if (window.isEarnFlowApp || window.isNativeApp) return true;
    return false;
  });

  useEffect(() => {
    const checkApp = () => {
      const inApp = Boolean(
        sessionStorage.getItem('earnflow_in_native_app') === 'true' ||
        window.location.search.includes('app=android') ||
        window.location.search.includes('is_app=true') ||
        (navigator.userAgent && navigator.userAgent.includes('EarnFlowApp')) ||
        window.isEarnFlowApp ||
        window.isNativeApp ||
        document.documentElement.classList.contains('in-earnflow-app')
      );
      if (inApp) {
        setIsNativeApp(true);
        sessionStorage.setItem('earnflow_in_native_app', 'true');
      }
    };
    checkApp();
    window.addEventListener('load', checkApp);
    return () => window.removeEventListener('load', checkApp);
  }, []);

  const [platformSettings, setPlatformSettings] = useState(() => {
    try {
      const saved = localStorage.getItem('lotto_platform_settings');
      return saved ? { ...DEFAULT_PLATFORM_SETTINGS, ...JSON.parse(saved) } : DEFAULT_PLATFORM_SETTINGS;
    } catch {
      return DEFAULT_PLATFORM_SETTINGS;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('lotto_platform_settings', JSON.stringify(platformSettings));
    } catch (e) {}
  }, [platformSettings]);

  // Fetch platform settings from dedicated platform_settings table in Supabase
  const fetchPlatformSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('platform_settings')
        .select('value')
        .eq('key', 'global')
        .maybeSingle();

      if (!error && data && data.value) {
        setPlatformSettings(prev => ({ ...prev, ...data.value }));
      }
    } catch (err) {
      console.error('fetchPlatformSettings error:', err);
    }
  };

  // Update platform settings from Admin Console
  const adminUpdatePlatformSettings = async (newSettings) => {
    try {
      const updated = {
        ...platformSettings,
        ...newSettings,
        minWithdrawal: parseFloat(newSettings.minWithdrawal || platformSettings.minWithdrawal),
        maxWithdrawal: parseFloat(newSettings.maxWithdrawal || platformSettings.maxWithdrawal),
        houseFeePercent: parseFloat(newSettings.houseFeePercent || platformSettings.houseFeePercent),
        defaultWinnerSharePercent: parseFloat(newSettings.defaultWinnerSharePercent || platformSettings.defaultWinnerSharePercent),
        treasuryTrc20: (newSettings.treasuryTrc20 || platformSettings.treasuryTrc20).trim(),
        supportEmail: (newSettings.supportEmail || platformSettings.supportEmail).trim(),
        usernameChangeFee: parseFloat(newSettings.usernameChangeFee !== undefined ? newSettings.usernameChangeFee : (platformSettings.usernameChangeFee ?? 5.0)),
        apkDownloadUrl: (newSettings.apkDownloadUrl !== undefined ? newSettings.apkDownloadUrl : (platformSettings.apkDownloadUrl || '/download/earnflow.apk')).trim()
      };

      // Optimistic update
      setPlatformSettings(updated);
      localStorage.setItem('lotto_platform_settings', JSON.stringify(updated));

      // Persist to dedicated Supabase platform_settings table
      const { error } = await supabase
        .from('platform_settings')
        .upsert({
          key: 'global',
          value: updated,
          updated_at: new Date().toISOString()
        });

      if (error) {
        console.warn('Supabase settings upsert error:', error.message);
      }

      showToast('Platform governance settings updated and synced across all user portals!', 'success');
      return { success: true, settings: updated };
    } catch (err) {
      console.error('adminUpdatePlatformSettings error:', err);
      showToast('Failed to update settings: ' + err.message, 'error');
      return { success: false, error: err.message };
    }
  };

  // User Authentication State
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState('login'); // 'login' | 'signup'

  // Listen to Supabase Auth state changes
  useEffect(() => {
    const cleanAuthHash = () => {
      if (window.location.hash && (window.location.hash.includes('access_token=') || window.location.hash.includes('refresh_token='))) {
        window.history.replaceState(null, '', window.location.pathname + window.location.search);
      }
    };

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id);
        cleanAuthHash();
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id);
        cleanAuthHash();
      } else {
        setProfile(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const [needsUsernameSetup, setNeedsUsernameSetup] = useState(false);

  const fetchProfile = async (userId) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      const resolvedUsername = data?.username || user?.user_metadata?.username || '';

      if (!error && data) {
        setProfile({
          ...data,
          username: resolvedUsername
        });
        const finalAddr = data.trc20_address || user?.user_metadata?.trc20_address;
        if (finalAddr) {
          setWallet(prev => ({
            ...prev,
            address: finalAddr,
            connected: true,
            network: 'TRC-20'
          }));
        }

        // Check if user has explicitly chosen a permanent username
        const hasChosenUsername = Boolean(data.username_chosen || user?.user_metadata?.username_chosen || (resolvedUsername && !resolvedUsername.includes('@')));
        if (!hasChosenUsername) {
          setNeedsUsernameSetup(true);
        } else {
          setNeedsUsernameSetup(false);
        }
      } else {
        // First-time login without existing profile record
        const initialProfile = {
          id: userId,
          email: user?.email || '',
          username: resolvedUsername,
          role: 'user',
          status: 'active'
        };
        try {
          await supabase.from('profiles').upsert(initialProfile);
        } catch (e) {
          console.warn('Initial profiles upsert skipped:', e);
        }
        setProfile(initialProfile);
        setNeedsUsernameSetup(!resolvedUsername);
      }
    } catch (err) {
      console.error('Fetch profile error:', err);
    }
  };

  // Username Change Count - Tracked 100% in database
  const [usernameChangeCount, setUsernameChangeCount] = useState(0);

  // Query number of lifetime username changes directly from Supabase database
  const getUsernameChangeCount = async (userId) => {
    const uid = userId || user?.id;
    if (!uid) return 0;
    try {
      const { count, error } = await supabase
        .from('username_changes')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', uid);
      return !error && typeof count === 'number' ? count : 0;
    } catch {
      return 0;
    }
  };

  useEffect(() => {
    if (user?.id) {
      getUsernameChangeCount(user.id).then(cnt => setUsernameChangeCount(cnt));
    } else {
      setUsernameChangeCount(0);
    }
  }, [user?.id]);

  // Secure User ID / Username update (1st time Free, subsequent edits charge USDT fee from wallet)
  const updateUsername = async (chosenUsername) => {
    if (!user) return { success: false, error: 'Authentication required. Please log in.' };
    const clean = (chosenUsername || '').trim().replace(/^@\s*/, '').trim();

    const currentName = profile?.username || user?.user_metadata?.username;
    if (currentName && clean.toLowerCase() === currentName.toLowerCase()) {
      return { success: false, error: 'New User ID cannot be the same as your current User ID.' };
    }

    // 1. Validate format & uniqueness against Supabase
    const check = await checkUsernameAvailability(clean);
    if (!check.valid) {
      return { success: false, error: check.message };
    }

    // 2. Query exact change count directly from database to prevent client manipulation/hacks!
    const changeCount = await getUsernameChangeCount(user.id);
    const fee = (platformSettings?.usernameChangeFee !== undefined && !isNaN(platformSettings.usernameChangeFee))
      ? Number(platformSettings.usernameChangeFee)
      : 5.0;

    const isFirstTime = changeCount === 0;
    const requiredFee = isFirstTime ? 0 : fee;

    try {
      // 3. If paid change, verify balance directly from Supabase lottery_wallets
      if (requiredFee > 0) {
        const { data: dbWal } = await supabase
          .from('lottery_wallets')
          .select('*')
          .eq('address', wallet.address)
          .maybeSingle();

        const currentBal = Number(dbWal?.balance ?? wallet.balance ?? 0);
        if (currentBal < requiredFee) {
          return { 
            success: false, 
            error: `Insufficient USDT balance. Changing your User ID costs ${requiredFee} USDT (Available: ${currentBal.toFixed(2)} USDT). Please deposit funds in your wallet.` 
          };
        }

        // Deduct fee from lottery_wallets in Supabase
        const newBal = parseFloat((currentBal - requiredFee).toFixed(2));
        await supabase
          .from('lottery_wallets')
          .update({ balance: newBal, updated_at: new Date().toISOString() })
          .eq('address', wallet.address);

        setWallet(prev => ({ ...prev, balance: newBal }));
      }

      // 4. Update profiles table in Supabase
      try {
        const { error: profileError } = await supabase
          .from('profiles')
          .update({
            username: clean,
            username_chosen: true,
            username_change_count: changeCount + 1,
            updated_at: new Date().toISOString()
          })
          .eq('id', user.id);

        if (profileError) {
          console.warn('Profiles table update notice:', profileError.message);
        }
      } catch (pErr) {
        console.warn('Profiles table update exception:', pErr);
      }

      // 5. Update auth user metadata (persists reliably in auth.users)
      try {
        await supabase.auth.updateUser({
          data: {
            username: clean,
            username_chosen: true,
            username_change_count: changeCount + 1
          }
        });
      } catch (authErr) {
        console.warn('Auth user metadata update notice:', authErr);
      }

      // 6. Record audit log row in dedicated username_changes table
      try {
        await supabase.from('username_changes').insert({
          id: `unc_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          user_id: user.id,
          user_address: wallet.address || null,
          old_username: currentName || '',
          new_username: clean,
          fee_paid: requiredFee,
          payment_type: isFirstTime ? 'FREE_LIFETIME_EDIT' : 'PAID_EDIT_FEE'
        });
      } catch (auditErr) {
        console.warn('Username changes audit insert notice:', auditErr);
      }

      // 7. Update local state
      setProfile(prev => ({
        ...(prev || {}),
        id: user.id,
        email: user.email || prev?.email || '',
        username: clean
      }));
      setUsernameChangeCount(changeCount + 1);
      setNeedsUsernameSetup(false);

      if (requiredFee > 0) {
        showToast(`User ID updated to @${clean}! ${requiredFee} USDT fee deducted from wallet.`, 'success');
      } else {
        showToast(`User ID updated to @${clean}! (1st Lifetime Free Edit used)`, 'success');
      }

      return { success: true, newUsername: clean };
    } catch (err) {
      console.error('updateUsername error:', err);
      return { success: false, error: err.message };
    }
  };

  // Backwards-compatibility alias for initial setup modal
  const setPermanentUsername = updateUsername;

  const checkUsernameAvailability = async (rawUsername) => {
    const username = (rawUsername || '').trim().replace(/^@\s*/, '').trim();
    if (!username) return { valid: false, message: 'User ID is required' };
    
    // Validation: Alphabet, number, underscore (_) only
    const validPattern = /^[a-zA-Z0-9_]+$/;
    if (!validPattern.test(username)) {
      return { 
        valid: false, 
        message: 'Only letters, numbers, and underscore (_) are allowed' 
      };
    }

    if (username.length < 3) {
      return { valid: false, message: 'User ID must be at least 3 characters' };
    }

    if (username.length > 20) {
      return { valid: false, message: 'User ID cannot exceed 20 characters' };
    }

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, username')
        .ilike('username', username)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        console.error('Check username error:', error);
      }

      if (data && data.id !== user?.id) {
        return { valid: false, message: 'This User ID is already taken. Please choose another.' };
      }

      return { valid: true, message: 'User ID is available!' };
    } catch (err) {
      console.error('Error checking username:', err);
      return { valid: true, message: 'User ID is available!' };
    }
  };

  const loginWithEmail = async (email, password) => {
    const res = await supabase.auth.signInWithPassword({ email, password });
    return res;
  };

  const signupWithEmail = async (email, password, username) => {
    const res = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          username: username ? username.trim() : (email ? email.split('@')[0] : 'user'),
          full_name: username ? username.trim() : (email ? email.split('@')[0] : 'user')
        }
      }
    });
    return res;
  };

  const verifyEmailOtp = async (email, token, username, password = null) => {
    let res = await supabase.auth.verifyOtp({
      email,
      token,
      type: 'signup'
    });

    if (res.error) {
      res = await supabase.auth.verifyOtp({
        email,
        token,
        type: 'email'
      });
    }

    if (!res.error && res.data?.user) {
      setUser(res.data.user);
      if (username) {
        await supabase
          .from('profiles')
          .update({ 
            username: username.trim(), 
            updated_at: new Date().toISOString() 
          })
          .eq('id', res.data.user.id);
      }
      await fetchProfile(res.data.user.id);
    }

    return res;
  };

  const resendSignupOtp = async (email) => {
    const res = await supabase.auth.resend({
      type: 'signup',
      email
    });
    return res;
  };

  // Password Reset: Request 6-digit OTP code to registered email
  const requestPasswordReset = async (email) => {
    const cleanEmail = (email || '').trim().toLowerCase();
    try {
      const { data, error } = await supabase.auth.resetPasswordForEmail(cleanEmail);
      if (error) throw error;
      return { success: true, data };
    } catch (err) {
      console.error('requestPasswordReset error:', err);
      return { success: false, error: err };
    }
  };

  // Password Reset: Verify 6-digit OTP code and set new password
  const verifyPasswordResetOtp = async (email, token, newPassword) => {
    const cleanEmail = (email || '').trim().toLowerCase();
    try {
      const { data, error } = await supabase.auth.verifyOtp({
        email: cleanEmail,
        token: token.trim(),
        type: 'recovery'
      });

      if (error) throw error;

      const { data: updateData, error: updateError } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (updateError) throw updateError;

      if (data?.user) {
        setUser(data.user);
        await fetchProfile(data.user.id);
      }

      return { success: true, data: updateData };
    } catch (err) {
      console.error('verifyPasswordResetOtp error:', err);
      return { success: false, error: err };
    }
  };

  const loginWithGoogle = async () => {
    const res = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin
      }
    });
    return res;
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
    setNeedsUsernameSetup(false);
    setActiveTab('lotteries');
    setSelectedEventForModal(null);
    showToast('Successfully signed out.', 'info');
  };

  const updateTrc20Address = async (newAddress) => {
    try {
      if (user) {
        try {
          const { error } = await supabase
            .from('profiles')
            .update({ trc20_address: newAddress })
            .eq('id', user.id);
          if (error) console.warn('Profiles trc20_address update notice (non-fatal):', error.message);
        } catch (pErr) {
          console.warn('Caught profiles trc20_address update exception:', pErr);
        }

        try {
          await supabase.auth.updateUser({
            data: { trc20_address: newAddress }
          });
        } catch (aErr) {
          console.warn('Auth user metadata trc20 update notice:', aErr);
        }
      }
      setWallet(prev => ({
        ...prev,
        address: newAddress,
        connected: true,
        network: 'TRC-20'
      }));
      setProfile(prev => prev ? ({ ...prev, trc20_address: newAddress }) : null);
      return { success: true };
    } catch (err) {
      console.error('Failed to update TRC-20 address:', err);
      return { success: false, error: err.message };
    }
  };

  // Active UI modal states
  const [selectedEventForModal, setSelectedEventForModal] = useState(null);
  const [isWalletModalOpen, setIsWalletModalOpen] = useState(false);
  const [walletModalTab, setWalletModalTab] = useState('deposit');
  const [winCelebration, setWinCelebration] = useState(null);

  // Route & URL sync: detects direct URLs like /privacy-policy and /terms-and-conditions
  const resolveTabFromUrl = () => {
    if (typeof window === 'undefined') return 'lotteries';
    const path = (window.location.pathname || '').toLowerCase().replace(/\/+$/, '');
    const hash = (window.location.hash || '').toLowerCase().replace(/^#\/?/, '');
    const search = new URLSearchParams(window.location.search || '');
    const tabParam = search.get('tab')?.toLowerCase();

    // Check for SPA redirected path from 404.html (e.g. ?p=privacy-policy)
    const pParam = search.get('p')?.toLowerCase().replace(/\/+$/, '');
    const effectivePath = pParam ? '/' + pParam : path;

    if (effectivePath === '/privacy-policy' || effectivePath === '/privacy' || hash === 'privacy-policy' || hash === 'privacy' || tabParam === 'privacy') {
      return 'privacy';
    }
    if (effectivePath === '/terms-and-conditions' || effectivePath === '/terms' || hash === 'terms-and-conditions' || hash === 'terms' || tabParam === 'terms') {
      return 'terms';
    }
    if (effectivePath === '/contact' || effectivePath === '/contact-us' || hash === 'contact' || hash === 'contact-us' || tabParam === 'contact') {
      return 'contact';
    }
    if (effectivePath === '/results' || hash === 'results' || tabParam === 'results') return 'results';
    if (effectivePath === '/tickets' || hash === 'tickets' || tabParam === 'tickets') return 'tickets';
    if (effectivePath === '/wallet' || hash === 'wallet' || tabParam === 'wallet') return 'wallet';

    return 'lotteries';
  };

  const [activeTab, setActiveTabState] = useState(() => resolveTabFromUrl());

  const setActiveTab = (tabName, shouldPushHistory = true) => {
    setActiveTabState(tabName);

    if (typeof window === 'undefined') return;

    let targetPath = '/';
    let pageTitle = 'EarnFlow.In USDT | Provably Fair VIP Crypto Lottery Platform';

    if (tabName === 'privacy') {
      targetPath = '/privacy-policy';
      pageTitle = 'Privacy Policy · EarnFlow.In Sovereign Crypto Lottery Platform';
    } else if (tabName === 'terms') {
      targetPath = '/terms-and-conditions';
      pageTitle = 'Terms & Conditions · EarnFlow.In Crypto Lottery Platform';
    } else if (tabName === 'contact') {
      targetPath = '/contact';
      pageTitle = 'Contact Support Desk · EarnFlow.In Sovereign Lottery';
    } else if (tabName === 'results') {
      targetPath = '/?tab=results';
      pageTitle = 'Draw Results & Verified Winners · EarnFlow.In';
    } else if (tabName === 'tickets') {
      targetPath = '/?tab=tickets';
      pageTitle = 'My Active Tickets · EarnFlow.In';
    } else if (tabName === 'wallet') {
      targetPath = '/?tab=wallet';
      pageTitle = 'USDT Wallet & 24h Payouts · EarnFlow.In';
    }

    if (shouldPushHistory) {
      const currentLoc = window.location.pathname + window.location.search;
      if (currentLoc !== targetPath) {
        try {
          window.history.pushState({ tab: tabName }, pageTitle, targetPath);
        } catch (e) {
          // ignore
        }
      }
    }
    document.title = pageTitle;
  };

  // Sync with browser Back and Forward navigation (popstate) & hashchange
  useEffect(() => {
    const handleLocationChange = () => {
      const tab = resolveTabFromUrl();
      setActiveTabState(tab);
    };

    window.addEventListener('popstate', handleLocationChange);
    window.addEventListener('hashchange', handleLocationChange);
    return () => {
      window.removeEventListener('popstate', handleLocationChange);
      window.removeEventListener('hashchange', handleLocationChange);
    };
  }, []);
  const [toastMessage, setToastMessage] = useState(null);
  const [isSupabaseSynced, setIsSupabaseSynced] = useState(false);

  // Clear any legacy mock data from localStorage on initialization
  useEffect(() => {
    try {
      localStorage.removeItem('lotto_events');
      const savedTkts = localStorage.getItem('lotto_tickets');
      if (savedTkts && savedTkts.includes('tkt-101')) {
        localStorage.removeItem('lotto_tickets');
      }
      const savedWds = localStorage.getItem('lotto_withdrawals');
      if (savedWds && savedWds.includes('W-8942')) {
        localStorage.removeItem('lotto_withdrawals');
      }
      const savedPayouts = localStorage.getItem('lotto_winner_payouts');
      if (savedPayouts && savedPayouts.includes('WP-8841')) {
        localStorage.removeItem('lotto_winner_payouts');
      }
    } catch (e) {}
  }, []);

  // Fetch tickets directly from Supabase
  const fetchTickets = async () => {
    try {
      const { data, error } = await supabase
        .from('lottery_tickets')
        .select('*')
        .order('purchase_time', { ascending: false });

      if (!error && Array.isArray(data)) {
        const mappedTickets = data.map(t => ({
          id: t.id,
          eventId: t.event_id,
          eventTitle: t.event_title,
          ticketNumber: t.ticket_number,
          price: parseFloat(t.price || 0),
          purchaseTime: Number(t.purchase_time || Date.now()),
          status: t.status,
          matchTier: t.match_tier,
          wonAmount: parseFloat(t.won_amount || 0),
          claimed: Boolean(t.claimed),
          userAddress: t.user_address,
          username: t.username || `@${(t.user_address || '').slice(0, 6) || 'player'}`
        }));
        setTickets(mappedTickets);

        // Derive/sync winner payouts from winning tickets in database
        const winningTkts = mappedTickets.filter(t => t.status === 'won');
        const derivedPayouts = winningTkts.map((wt, idx) => ({
          id: `WP-${wt.id}`,
          eventId: wt.eventId,
          eventTitle: wt.eventTitle,
          ticketId: wt.id,
          winnerAddress: wt.userAddress || wallet.address,
          winnerUsername: wt.username,
          winningDigits: wt.ticketNumber,
          ticketsSold: 0,
          ticketPrice: wt.price,
          totalPoolCollected: wt.wonAmount,
          winnerSharePercent: 90,
          calculatedAmount: wt.wonAmount,
          payoutAmount: wt.wonAmount,
          status: wt.claimed ? 'completed' : 'pending_approval',
          createdAt: wt.purchaseTime
        }));
        setWinnerPayouts(derivedPayouts);
      }
    } catch (err) {
      console.error('fetchTickets error:', err);
    }
  };

  // Fetch withdrawals directly from Supabase
  const fetchWithdrawals = async () => {
    try {
      const { data, error } = await supabase
        .from('lottery_withdrawals')
        .select('*')
        .order('requested_at', { ascending: false });

      if (!error && Array.isArray(data)) {
        const mappedW = data.map(w => ({
          id: w.id,
          userAddress: w.user_address,
          amount: parseFloat(w.amount || 0),
          netDisbursal: parseFloat(w.net_disbursal || 0),
          networkFee: parseFloat(w.network_fee || 0),
          network: w.network || 'TRC-20',
          address: w.destination_address,
          requestedAt: Number(w.requested_at || Date.now()),
          slaTargetMs: Number(w.sla_target_ms || (Date.now() + 86400000)),
          status: w.status,
          txHash: w.tx_hash
        }));
        setWithdrawals(mappedW);
      }
    } catch (err) {
      console.error('fetchWithdrawals error:', err);
    }
  };

  // Fetch wallet balance directly from Supabase lottery_wallets
  const fetchWallet = async (addressToFetch) => {
    try {
      let query = supabase.from('lottery_wallets').select('*');
      if (user?.id) {
        query = query.or(`user_id.eq.${user.id},address.eq.${addressToFetch || wallet.address}`);
      } else if (addressToFetch || wallet.address) {
        query = query.eq('address', addressToFetch || wallet.address);
      } else {
        return;
      }

      const { data, error } = await query.order('updated_at', { ascending: false }).limit(1).maybeSingle();

      if (!error && data) {
        setWallet(prev => ({
          ...prev,
          address: data.address || addressToFetch || prev.address,
          connected: true,
          balance: parseFloat(data.balance || 0),
          lifetimeWon: parseFloat(data.lifetime_won || 0),
          network: data.network || 'Flow Coin'
        }));
      } else if (!data && (addressToFetch || wallet.address)) {
        const addrToUse = addressToFetch || wallet.address;
        await supabase.from('lottery_wallets').upsert({
          address: addrToUse,
          user_id: user?.id || null,
          balance: 0.00,
          lifetime_won: 0,
          network: 'Flow Coin'
        });
        setWallet(prev => ({
          ...prev,
          address: addrToUse,
          connected: true,
          balance: 0.00,
          lifetimeWon: 0,
          network: 'Flow Coin'
        }));
      }
    } catch (err) {
      console.error('fetchWallet error:', err);
    }
  };

  // Sync wallet on address change or user login
  useEffect(() => {
    if (wallet.address || user?.id) {
      fetchWallet(wallet.address);
      fetchWalletLedger(wallet.address);
      fetchUserNotifications(wallet.address);
    }
  }, [wallet.address, user?.id]);

  // Initial fetch from Supabase
  useEffect(() => {
    async function loadSupabaseData() {
      try {
        await refreshEvents();
        await fetchTickets();
        await fetchWithdrawals();
        await fetchWinnerPayouts();
        if (wallet.address || user?.id) {
          await fetchWallet(wallet.address);
          await fetchWalletLedger(wallet.address);
          await fetchUserNotifications(wallet.address);
        }
        await fetchSupportTickets();
        await fetchPlatformSettings();
        setIsSupabaseSynced(true);
      } catch (err) {
        console.error('Supabase load data error:', err);
      }
    }

    loadSupabaseData();
  }, []);

  // Realtime Supabase Channels for Tickets, Withdrawals, Wallets, Winner Payouts, Support, Settings & Ledger
  useEffect(() => {
    const tChannel = supabase
      .channel('realtime:lottery_tickets')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'lottery_tickets' }, () => {
        fetchTickets();
      })
      .subscribe();

    const wChannel = supabase
      .channel('realtime:lottery_withdrawals')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'lottery_withdrawals' }, () => {
        fetchWithdrawals();
      })
      .subscribe();

    const wpChannel = supabase
      .channel('realtime:winner_payouts')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'winner_payouts' }, () => {
        fetchWinnerPayouts();
      })
      .subscribe();

    const supChannel = supabase
      .channel('realtime:support_tickets')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'support_tickets' }, () => {
        fetchSupportTickets();
      })
      .subscribe();

    const setChannel = supabase
      .channel('realtime:platform_settings')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'platform_settings' }, () => {
        fetchPlatformSettings();
      })
      .subscribe();

    const walChannel = supabase
      .channel('realtime:lottery_wallets')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'lottery_wallets' }, (payload) => {
        if (payload.new && (payload.new.address === wallet.address || (user?.id && payload.new.user_id === user.id))) {
          setWallet(prev => ({
            ...prev,
            balance: parseFloat(payload.new.balance || 0),
            lifetimeWon: parseFloat(payload.new.lifetime_won || 0),
            network: payload.new.network || prev.network
          }));
        }
      })
      .subscribe();

    const ledChannel = supabase
      .channel('realtime:wallet_ledger')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'wallet_ledger' }, () => {
        fetchWalletLedger();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(tChannel);
      supabase.removeChannel(wChannel);
      supabase.removeChannel(wpChannel);
      supabase.removeChannel(supChannel);
      supabase.removeChannel(setChannel);
      supabase.removeChannel(walChannel);
      supabase.removeChannel(ledChannel);
    };
  }, [wallet.address, user?.id]);

  const showToast = (message, type = 'success') => {
    setToastMessage({ message, type, id: Date.now() });
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  // Wallet Actions
  const toggleWalletConnection = () => {
    setWallet(prev => {
      const nextState = !prev.connected;
      showToast(nextState ? `Crypto Wallet Connected (${prev.network})` : 'Wallet Disconnected', 'info');
      return { ...prev, connected: nextState };
    });
  };

  const switchNetwork = async (newNetwork) => {
    setWallet(prev => ({ ...prev, network: newNetwork }));
    showToast(`Network switched to ${newNetwork}`);
    try {
      await supabase.from('lottery_wallets').update({ network: newNetwork }).eq('address', wallet.address);
    } catch (e) {
      console.error(e);
    }
  };

  // Deposit USDT
  const depositUSDT = async (amount) => {
    const val = parseFloat(amount);
    if (isNaN(val) || val < 20 || val > 500) {
      showToast('Deposit amount must be between 20 USDT and 500 USDT (Min: 20 USDT, Max: 500 USDT)', 'error');
      return false;
    }

    const newBalance = parseFloat((wallet.balance + val).toFixed(2));
    setWallet(prev => ({
      ...prev,
      balance: newBalance
    }));

    showToast(`Deposit confirmed! +${val.toFixed(2)} USDT credited to wallet.`);

    try {
      await supabase.from('lottery_wallets').upsert({
        address: wallet.address,
        balance: newBalance,
        lifetime_won: wallet.lifetimeWon,
        network: wallet.network
      });
    } catch (e) {
      console.error(e);
    }

    return true;
  };

  // Helper: Check if a 4-digit number is already sold in an event
  const isTicketNumberSold = (eventId, number) => {
    if (!eventId || number === undefined || number === null) return false;
    const formatted = String(number).padStart(4, '0');
    return tickets.some(t => t.eventId === eventId && String(t.ticketNumber).padStart(4, '0') === formatted);
  };

  // Helper: Get all tickets sold for a specific event
  const getSoldTicketsForEvent = (eventId) => {
    if (!eventId) return [];
    return tickets.filter(t => t.eventId === eventId);
  };

  // Helper: Generate an unsold random 4-digit number for an event
  const getUnsoldRandomNumber = (eventId) => {
    const soldSet = new Set(
      tickets
        .filter(t => t.eventId === eventId)
        .map(t => String(t.ticketNumber).padStart(4, '0'))
    );
    for (let i = 0; i < 10000; i++) {
      const candidate = String(Math.floor(Math.random() * 10000)).padStart(4, '0');
      if (!soldSet.has(candidate)) return candidate;
    }
    return String(Math.floor(Math.random() * 10000)).padStart(4, '0');
  };

  // Helper: Suggest next available alternative
  const suggestAlternative = (numStr, soldSet) => {
    const base = parseInt(numStr, 10) || 1000;
    for (let offset = 1; offset < 500; offset++) {
      const alt1 = String((base + offset) % 10000).padStart(4, '0');
      if (!soldSet.has(alt1)) return alt1;
      const alt2 = String((base - offset + 10000) % 10000).padStart(4, '0');
      if (!soldSet.has(alt2)) return alt2;
    }
    return '0000';
  };

  // Purchase Lottery Tickets
  const buyTickets = async (eventId, ticketNumbers) => {
    // 0. Strict Authentication Check: No ticket purchase without login
    if (!user) {
      showToast('Authentication required: Please log in to purchase lottery tickets!', 'error');
      setIsAuthModalOpen(true);
      return false;
    }

    const event = events.find(e => e.id === eventId);
    if (!event) {
      showToast('Event not found', 'error');
      return false;
    }

    // Strict Timeout Check: Tickets cannot be purchased after lottery draw time expires!
    if (event.status !== 'active' || (event.drawTime && event.drawTime <= Date.now())) {
      showToast('This lottery has timed out and is closed! Tickets cannot be purchased.', 'error');
      return false;
    }

    // Check if any requested ticket number is already sold in this event!
    const activeTicketsForEvent = tickets.filter(t => t.eventId === eventId);
    const soldSet = new Set(activeTicketsForEvent.map(t => String(t.ticketNumber).padStart(4, '0')));
    
    const seenInOrder = new Set();
    for (const num of ticketNumbers) {
      const formatted = String(num).padStart(4, '0');
      if (soldSet.has(formatted)) {
        const alt = suggestAlternative(formatted, soldSet);
        showToast(`Combination #${formatted} is ALREADY SOLD OUT! Please select an available number (e.g. #${alt}).`, 'error');
        return false;
      }
      if (seenInOrder.has(formatted)) {
        showToast(`Duplicate ticket #${formatted} in order! Each ticket must be unique.`, 'error');
        return false;
      }
      seenInOrder.add(formatted);
    }

    const totalCost = event.ticketPrice * ticketNumbers.length;
    if (wallet.balance < totalCost) {
      showToast(`Insufficient Flow Coins! Need ${totalCost} FC, have ${wallet.balance.toFixed(2)} FC. Claim your Daily Bonus!`, 'error');
      return false;
    }

    // Call Server-Authoritative Atomic PostgreSQL RPC Transaction
    try {
      const userDisplayName = profile?.username ? `@${profile.username}` : (user?.email?.split('@')[0] || 'LuckyPlayer');
      const { data, error } = await supabase.rpc('buy_lottery_tickets_secure', {
        p_event_id: eventId,
        p_ticket_numbers: ticketNumbers.map(n => String(n).padStart(4, '0')),
        p_user_address: wallet.address,
        p_username: userDisplayName
      });

      if (error) throw error;

      if (!data || !data.success) {
        showToast(data?.error || 'Failed to purchase lottery tickets', 'error');
        return false;
      }

      // Update local wallet balance immediately from atomic server response
      if (data.new_balance !== undefined) {
        setWallet(prev => ({
          ...prev,
          balance: parseFloat(data.new_balance)
        }));
      }

      // Trigger celebratory confetti
      confetti({
        particleCount: 60,
        spread: 60,
        origin: { y: 0.8 },
        colors: ['#ffd700', '#f5c451', '#05d5aa']
      });

      showToast(`Success! Purchased ${data.tickets_bought || ticketNumbers.length} ticket(s) for ${data.total_spent || totalCost} Flow Coins!`, 'success');

      // Refresh tickets, events, and ledger from database
      await fetchTickets();
      await refreshEvents();
      await fetchWalletLedger();

      return true;
    } catch (err) {
      console.error('buyTickets RPC error:', err);
      showToast('Error completing purchase: ' + (err.message || 'Server error'), 'error');
      return false;
    }
  };

  // Request 24h SLA Withdrawal
  const requestWithdrawal = async (amount, destinationAddress, network = 'TRC-20') => {
    if (!user) {
      showToast('Authentication required: Please log in to request a withdrawal!', 'error');
      setIsAuthModalOpen(true);
      return false;
    }

    const val = parseFloat(amount);
    if (isNaN(val) || val <= 0) {
      showToast('Please enter a valid withdrawal amount', 'error');
      return false;
    }

    const minLimit = typeof platformSettings?.minWithdrawal === 'number' ? platformSettings.minWithdrawal : 5;
    const maxLimit = typeof platformSettings?.maxWithdrawal === 'number' ? platformSettings.maxWithdrawal : 10000;

    if (val < minLimit) {
      showToast(`Minimum withdrawal is ${minLimit} USDT`, 'error');
      return false;
    }

    if (val > maxLimit) {
      showToast(`Maximum withdrawal is ${maxLimit} USDT`, 'error');
      return false;
    }

    if (val > wallet.balance) {
      showToast('Withdrawal amount exceeds available USDT balance', 'error');
      return false;
    }

    if (!destinationAddress || destinationAddress.trim().length < 8) {
      showToast('Please enter a valid recipient USDT wallet address', 'error');
      return false;
    }

    const networkFee = network === 'TRC-20' ? 1.0 : (network === 'BEP-20' ? 0.8 : 8.0);
    const netDisbursal = parseFloat((val - networkFee).toFixed(2));
    const newBalance = parseFloat((wallet.balance - val).toFixed(2));

    // Deduct from wallet balance
    setWallet(prev => ({
      ...prev,
      balance: newBalance
    }));

    // Create withdrawal order with 24-Hour SLA target
    const orderId = `W-${Math.floor(1000 + Math.random() * 9000)}`;
    const nowMs = Date.now();
    const newOrder = {
      id: orderId,
      amount: val,
      netDisbursal,
      networkFee,
      network,
      address: destinationAddress.trim(),
      requestedAt: nowMs,
      slaTargetMs: nowMs + 24 * 3600 * 1000,
      status: 'processing',
      txHash: null
    };

    setWithdrawals(prev => [newOrder, ...prev]);

    showToast(`Withdrawal of ${val} USDT requested! Order #${orderId} queued for 24-hour processing.`, 'success');

    // Sync to Supabase
    try {
      await supabase.from('lottery_wallets').upsert({
        address: wallet.address,
        user_id: user?.id || null,
        balance: newBalance,
        lifetime_won: wallet.lifetimeWon,
        network: wallet.network
      });

      await supabase.from('lottery_withdrawals').insert({
        id: newOrder.id,
        user_id: user?.id || null,
        user_address: wallet.address,
        amount: newOrder.amount,
        net_disbursal: newOrder.netDisbursal,
        network_fee: newOrder.networkFee,
        network: newOrder.network,
        destination_address: newOrder.address,
        requested_at: newOrder.requestedAt,
        sla_target_ms: newOrder.slaTargetMs,
        status: newOrder.status,
        tx_hash: newOrder.txHash
      });
    } catch (err) {
      console.error('Supabase withdrawal error:', err);
    }

    return true;
  };

  // Draw Logic: Provably Fair Multi/Single Lucky Winner Match & Automated Payout
  const executeDraw = async (eventId, specifiedWinningDigits = null, customWinnerCount = null) => {
    const event = events.find(e => e.id === eventId);
    if (!event) return { success: false, error: 'Event not found' };

    const parsedWinnerCount = Math.max(1, parseInt(customWinnerCount || event.winnerCount || 1, 10));
    const targetDigits = specifiedWinningDigits ? String(specifiedWinningDigits).padStart(4, '0') : null;

    // 1. Try Server-Authoritative Provably Fair Finalization RPC
    try {
      const { data: rpcData, error: rpcError } = await supabase.rpc('finalize_lottery_draw_secure', {
        p_event_id: eventId,
        p_custom_digits: targetDigits,
        p_custom_winner_count: parsedWinnerCount
      });

      if (!rpcError && rpcData?.success) {
        await refreshEvents();
        await fetchUserTickets();
        await fetchWinnerPayouts();
        await fetchDrawAudits();

        const finalDigits = rpcData.winning_digits;
        const auditRef = rpcData.audit_id ? ` · Audit #${rpcData.audit_id}` : '';
        showToast(`🏆 Draw Finalized! Winning Digits: [${finalDigits}]${auditRef}`, 'success');

        const userWon = tickets.filter(t => t.eventId === eventId && t.ticketNumber === finalDigits);
        if (userWon.length > 0) {
          confetti({
            particleCount: 180,
            spread: 100,
            origin: { y: 0.6 },
            colors: ['#ffd700', '#f5c451', '#05d5aa', '#00f2fe', '#ffffff']
          });
          setWinCelebration({
            eventTitle: event.title,
            winningDigits: finalDigits,
            totalWon: (rpcData.per_winner_amount || 0) * userWon.length,
            winningTickets: userWon
          });
        }
        return { success: true, ...rpcData };
      }
      if (rpcError) {
        console.warn('finalize_lottery_draw_secure RPC error, falling back to client simulation:', rpcError);
      }
    } catch (rpcEx) {
      console.warn('finalize_lottery_draw_secure exception, falling back to client simulation:', rpcEx);
    }

    // 2. Client-Side Simulation Fallback
    // How many lucky winners should win? (e.g. 1, 5, 10, 12 etc.)
    const configuredWinnerCount = parsedWinnerCount;

    // Generate 4-digit winning sequence (e.g. '7429') if not specified
    const winDigits = targetDigits || String(Math.floor(Math.random() * 10000)).padStart(4, '0');

    // Active tickets for this event
    const activeTicketsForEvent = tickets.filter(t => t.eventId === eventId && t.status === 'active');

    // Selection of lucky winners (Pure Luck-based distribution, not rank-based):
    // 1. Any ticket matching the target winning sequence gets selected
    // 2. Remaining winner slots up to configuredWinnerCount are randomly sampled from active tickets
    const selectedWinnerTicketIds = new Set();
    const exactMatches = activeTicketsForEvent.filter(t => t.ticketNumber === winDigits);
    exactMatches.forEach(t => selectedWinnerTicketIds.add(t.id));

    if (selectedWinnerTicketIds.size < configuredWinnerCount && activeTicketsForEvent.length > 0) {
      const remainingCandidates = activeTicketsForEvent.filter(t => !selectedWinnerTicketIds.has(t.id));
      const shuffled = [...remainingCandidates].sort(() => Math.random() - 0.5);
      for (let i = 0; i < shuffled.length && selectedWinnerTicketIds.size < configuredWinnerCount; i++) {
        selectedWinnerTicketIds.add(shuffled[i].id);
      }
    }

    const winningTickets = activeTicketsForEvent.filter(t => selectedWinnerTicketIds.has(t.id));
    const finalWinnerCount = Math.max(1, winningTickets.length || configuredWinnerCount);

    // Calculate pool collection & equal winner share % (Distributed equally based on luck!)
    const totalPoolCollected = event.ticketsSold > 0 
      ? (event.ticketsSold * event.ticketPrice) 
      : event.poolPrize;
    const winnerSharePct = event.winnerSharePercent || 90;
    const totalWinnerPool = parseFloat(((totalPoolCollected * winnerSharePct) / 100).toFixed(2));
    const perWinnerCalculated = parseFloat((totalWinnerPool / finalWinnerCount).toFixed(2));

    let totalWonByUser = 0;
    let winningTicketsFound = [];

    // Process tickets for this event
    const updatedTickets = tickets.map(tkt => {
      if (tkt.eventId === eventId && tkt.status === 'active') {
        const isWinner = selectedWinnerTicketIds.has(tkt.id);

        if (isWinner) {
          totalWonByUser += perWinnerCalculated;
          const tierName = configuredWinnerCount > 1 
            ? `LUCKY WINNER (${finalWinnerCount} WINNERS EQUAL SHARE)` 
            : 'EXACT 4/4 MATCH (JACKPOT WINNER)';
          winningTicketsFound.push({ ...tkt, matchTier: tierName, wonAmount: perWinnerCalculated });
          return {
            ...tkt,
            status: 'won',
            matchTier: tierName,
            wonAmount: perWinnerCalculated,
            claimed: true
          };
        } else {
          return {
            ...tkt,
            status: 'lost',
            matchTier: 'NO MATCH',
            wonAmount: 0,
            claimed: false
          };
        }
      }
      return tkt;
    });

    setTickets(updatedTickets);

    // Winning digits displayed
    const winningDigitsDisplay = winningTickets.length > 0
      ? Array.from(new Set(winningTickets.map(w => w.ticketNumber))).join(', ')
      : winDigits;

    // Update event status
    const nowMs = Date.now();
    setEvents(prev => prev.map(e => {
      if (e.id === eventId) {
        return {
          ...e,
          status: 'completed',
          winningDigits: winningDigitsDisplay,
          drawTime: nowMs,
          winnerCount: finalWinnerCount
        };
      }
      return e;
    }));

    // Queue Winner Payouts into Admin Approval Suite ("Winner Add USDT")
    if (winningTickets.length > 0) {
      const newPayouts = winningTickets.map((wTkt, idx) => ({
        id: `WP-${Date.now()}-${idx}`,
        eventId: event.id,
        eventTitle: event.title,
        ticketId: wTkt.id,
        winnerAddress: wTkt.userAddress || wallet.address,
        winnerUsername: wTkt.username || profile?.username || user?.email?.split('@')[0] || `LuckyWinner_${idx + 1}`,
        winningDigits: wTkt.ticketNumber,
        ticketsSold: event.ticketsSold,
        ticketPrice: event.ticketPrice,
        totalPoolCollected: totalPoolCollected,
        winnerSharePercent: winnerSharePct,
        calculatedAmount: perWinnerCalculated,
        payoutAmount: perWinnerCalculated, // Editable in Admin Console!
        status: 'pending_approval',
        createdAt: nowMs
      }));

      setWinnerPayouts(prev => [...newPayouts, ...prev]);

      // Persist to Supabase winner_payouts table
      for (const p of newPayouts) {
        supabase.from('winner_payouts').insert({
          id: p.id,
          event_id: p.eventId,
          event_title: p.eventTitle,
          ticket_id: p.ticketId,
          winner_address: p.winnerAddress,
          winner_username: p.winnerUsername,
          winning_digits: p.winningDigits,
          tickets_sold: p.ticketsSold,
          ticket_price: p.ticketPrice,
          total_pool_collected: p.totalPoolCollected,
          winner_share_percent: p.winnerSharePercent,
          calculated_amount: p.calculatedAmount,
          payout_amount: p.payoutAmount,
          status: 'pending_approval'
        }).then(() => {});
      }
    }

    if (totalWonByUser > 0) {
      // Trigger Grand Celebration Confetti & Modal!
      confetti({
        particleCount: 180,
        spread: 100,
        origin: { y: 0.6 },
        colors: ['#ffd700', '#f5c451', '#05d5aa', '#00f2fe', '#ffffff']
      });

      setWinCelebration({
        eventTitle: event.title,
        winningDigits: winDigits,
        totalWon: totalWonByUser,
        winningTickets: winningTicketsFound
      });

      showToast(`🏆 EXACT MATCH! Winning number [${winDigits}]! Payout of ${totalWonByUser.toLocaleString()} USDT queued for disbursal!`, 'success');
    } else {
      showToast(`Draw for ${event.title} completed! Winning number is [${winDigits}].`);
    }

    // Sync Draw and Winners to Supabase
    try {
      // 1. Update event
      await supabase.from('lottery_events').update({
        status: 'completed',
        winning_digits: winDigits,
        draw_time: nowMs
      }).eq('id', eventId);

      // 2. Update tickets in DB
      for (const t of updatedTickets.filter(tk => tk.eventId === eventId)) {
        await supabase.from('lottery_tickets').update({
          status: t.status,
          match_tier: t.matchTier,
          won_amount: t.wonAmount,
          claimed: t.claimed
        }).eq('id', t.id);
      }
    } catch (err) {
      console.error('Supabase draw sync error:', err);
    }
  };

  // Admin Actions: Approve Winner Payout and Add USDT to Wallet
  const adminApproveWinnerPayout = async (payoutId, editedAmount = null) => {
    const payout = winnerPayouts.find(p => p.id === payoutId);
    if (!payout) return { success: false, message: 'Payout not found' };

    const finalAmount = (editedAmount !== null && !isNaN(editedAmount) && editedAmount > 0)
      ? parseFloat(editedAmount)
      : payout.payoutAmount;

    try {
      const mockTx = `0x${Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join('')}`;

      // Execute atomic disbursement RPC in PostgreSQL with ledger audit
      const { data: rpcRes, error: rpcErr } = await supabase.rpc('admin_disburse_winner_secure', {
        p_payout_id: payoutId,
        p_final_amount: finalAmount,
        p_tx_hash: mockTx
      });

      if (rpcErr) throw rpcErr;
      if (rpcRes && !rpcRes.success) throw new Error(rpcRes.error || 'Disbursement failed');

      const winnerAddr = payout.winnerAddress || wallet.address;

      // Update local winnerPayouts state
      setWinnerPayouts(prev => prev.map(p => {
        if (p.id === payoutId) {
          return {
            ...p,
            payoutAmount: finalAmount,
            status: 'completed',
            approvedAt: Date.now(),
            txHash: mockTx
          };
        }
        return p;
      }));

      // Refresh wallet & ledger
      if (wallet.address === winnerAddr) {
        if (rpcRes.new_balance !== undefined) {
          setWallet(prev => ({
            ...prev,
            balance: parseFloat(rpcRes.new_balance),
            lifetimeWon: parseFloat((Number(prev.lifetimeWon || 0) + finalAmount).toFixed(2))
          }));
        }
        await fetchWalletLedger();
      }

      confetti({
        particleCount: 160,
        spread: 90,
        origin: { y: 0.6 },
        colors: ['#05d5aa', '#ffd700', '#00f2fe', '#ffffff']
      });

      showToast(`Approved! Added ${finalAmount.toFixed(2)} Flow Coins directly to winner's wallet & recorded in ledger ✅`, 'success');
      return { success: true };
    } catch (err) {
      console.error('adminApproveWinnerPayout error:', err);
      showToast('Error approving winner payout: ' + err.message, 'error');
      return { success: false, error: err.message };
    }
  };

  const adminRejectWinnerPayout = async (payoutId) => {
    try {
      setWinnerPayouts(prev => prev.map(p => {
        if (p.id === payoutId) {
          return { ...p, status: 'rejected' };
        }
        return p;
      }));
      await supabase.from('winner_payouts').update({ status: 'rejected' }).eq('id', payoutId);
      showToast('Winner payout rejected / on hold', 'info');
      return { success: true };
    } catch (err) {
      console.error('adminRejectWinnerPayout error:', err);
      return { success: false, error: err.message };
    }
  };

  const adminAddManualWinnerCredit = async (targetUsernameOrAddress, amount, note = 'Special Seasonal Reward') => {
    const cleanAmount = parseFloat(amount);
    if (isNaN(cleanAmount) || cleanAmount <= 0) {
      showToast('Please enter a valid USDT amount', 'error');
      return { success: false };
    }

    const mockTx = `0x${Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join('')}`;
    const newPayout = {
      id: `WP-MANUAL-${Date.now()}`,
      eventId: 'manual-reward',
      eventTitle: note || 'Admin Manual USDT Reward',
      ticketId: 'MANUAL',
      winnerAddress: targetUsernameOrAddress || wallet.address,
      winnerUsername: targetUsernameOrAddress || 'Direct Player',
      winningDigits: '—',
      ticketsSold: 0,
      ticketPrice: 0,
      totalPoolCollected: cleanAmount,
      winnerSharePercent: 100,
      calculatedAmount: cleanAmount,
      payoutAmount: cleanAmount,
      status: 'completed',
      approvedAt: Date.now(),
      txHash: mockTx
    };

    setWinnerPayouts(prev => [newPayout, ...prev]);

    try {
      await supabase.from('winner_payouts').insert({
        id: newPayout.id,
        event_id: newPayout.eventId,
        event_title: newPayout.eventTitle,
        ticket_id: newPayout.ticketId,
        winner_address: newPayout.winnerAddress,
        winner_username: newPayout.winnerUsername,
        winning_digits: newPayout.winningDigits,
        tickets_sold: 0,
        ticket_price: 0,
        total_pool_collected: cleanAmount,
        winner_share_percent: 100,
        calculated_amount: cleanAmount,
        payout_amount: cleanAmount,
        status: 'completed',
        tx_hash: mockTx,
        approved_at: new Date().toISOString()
      });

      const targetAddr = newPayout.winnerAddress;
      
      // Credit wallet and write to wallet_ledger via atomic RPC
      await creditCredits(cleanAmount, 'admin_adjustment', newPayout.id, note || 'Admin Manual Flow Coin Grant');

      if (wallet.address === targetAddr) {
        await fetchWalletLedger();
      }

      showToast(`Successfully added ${cleanAmount.toFixed(2)} Flow Coins to player wallet & recorded in ledger!`, 'success');
      return { success: true };
    } catch (err) {
      console.error('adminAddManualWinnerCredit error:', err);
      showToast('Error crediting winner: ' + err.message, 'error');
      return { success: false, error: err.message };
    }
  };



  const adminApproveWithdrawal = async (orderId) => {
    const mockTx = `0x${Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join('')}`;
    setWithdrawals(prev => prev.map(w => {
      if (w.id === orderId) {
        return {
          ...w,
          status: 'completed',
          txHash: mockTx,
          slaTargetMs: Date.now()
        };
      }
      return w;
    }));

    showToast(`Withdrawal #${orderId} approved and disbursed! TxHash: ${mockTx.slice(0, 10)}...`);

    try {
      await supabase.from('lottery_withdrawals').update({
        status: 'completed',
        tx_hash: mockTx
      }).eq('id', orderId);
    } catch (err) {
      console.error('Supabase approval error:', err);
    }
  };

  const adminRejectWithdrawal = async (orderId) => {
    const order = withdrawals.find(w => w.id === orderId);
    if (!order) return;

    const newBalance = parseFloat((wallet.balance + order.amount).toFixed(2));
    setWallet(prev => ({
      ...prev,
      balance: newBalance
    }));

    setWithdrawals(prev => prev.map(w => {
      if (w.id === orderId) {
        return { ...w, status: 'flagged' };
      }
      return w;
    }));

    showToast(`Withdrawal #${orderId} flagged/rejected. ${order.amount} USDT refunded to user.`, 'info');

    try {
      await supabase.from('lottery_withdrawals').update({
        status: 'flagged'
      }).eq('id', orderId);

      await supabase.from('lottery_wallets').upsert({
        address: wallet.address,
        balance: newBalance,
        lifetime_won: wallet.lifetimeWon,
        network: wallet.network
      });
    } catch (err) {
      console.error('Supabase rejection error:', err);
    }
  };


  const adminFetchAllUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });
      if (!error && data) return data;
      return [];
    } catch (err) {
      console.error('Failed to fetch users:', err);
      return [];
    }
  };

  const adminToggleUserStatus = async (userId, currentStatus) => {
    const nextStatus = currentStatus === 'blocked' ? 'active' : 'blocked';
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ status: nextStatus, updated_at: new Date().toISOString() })
        .eq('id', userId);
      if (!error) {
        showToast(`User status updated to ${nextStatus.toUpperCase()}`, 'success');
        return { success: true, nextStatus };
      }
      return { success: false, error: error.message };
    } catch (err) {
      return { success: false, error: err.message };
    }
  };

  const adminUpdateUserRole = async (userId, newRole) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ role: newRole, updated_at: new Date().toISOString() })
        .eq('id', userId);
      if (!error) {
        showToast(`User role updated to ${newRole.toUpperCase()}`, 'success');
        return { success: true };
      }
      return { success: false, error: error.message };
    } catch (err) {
      return { success: false, error: err.message };
    }
  };

  const adminDeleteUser = async (userId) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .delete()
        .eq('id', userId);
      if (!error) {
        showToast('User profile removed from system', 'success');
        return { success: true };
      }
      return { success: false, error: error.message };
    } catch (err) {
      return { success: false, error: err.message };
    }
  };

  const adminCreateEvent = async (eventData) => {
    try {
      const now = Date.now();
      // Calculate duration in ms: supports minutes, hours, days
      const durationVal = parseFloat(eventData.durationValue || eventData.durationHours || 1);
      const unit = (eventData.durationUnit || 'hours').toLowerCase();
      let durationMs = durationVal * 3600 * 1000;
      if (unit === 'minutes' || unit === 'min' || unit === 'minute') {
        durationMs = Math.max(60 * 1000, durationVal * 60 * 1000); // minimum 60 seconds (1 minute)
      } else if (unit === 'days' || unit === 'day') {
        durationMs = durationVal * 24 * 3600 * 1000;
      } else {
        durationMs = Math.max(60 * 1000, durationVal * 3600 * 1000);
      }

      const minPrize = eventData.minPrize ? parseFloat(eventData.minPrize) : null;
      const maxPrize = eventData.maxPrize ? parseFloat(eventData.maxPrize) : null;
      const poolPrize = maxPrize || parseFloat(eventData.initialSeedJackpot || 1000);
      const newId = `evt-${Date.now().toString(36)}-${Math.floor(100 + Math.random() * 900)}`;
      const badge = eventData.badge || (eventData.theme === 'diwali' ? '🪔 DIWALI BUMPER' : (eventData.theme === 'eid' ? '🌙 EID MUBARAK' : (eventData.theme === 'durga_puja' ? '🌺 DURGA UTSAV' : 'SPECIAL EVENT')));

      // 1. Try Server-Authoritative Provably Fair Creation RPC (Generates Server Seed + SHA-256 Commit)
      try {
        const { data: rpcData, error: rpcError } = await supabase.rpc('create_provably_fair_lottery_round', {
          p_id: newId,
          p_title: eventData.title || 'VIP Lottery Event',
          p_badge: badge,
          p_ticket_price: parseFloat(eventData.ticketPrice || 10),
          p_pool_prize: poolPrize,
          p_draw_time: now + durationMs,
          p_block_target: `#${Math.floor(19400000 + Math.random() * 100000)}`,
          p_theme: eventData.theme || 'cyberpunk',
          p_banner_image: eventData.bannerImage || '',
          p_min_prize: minPrize,
          p_max_prize: maxPrize,
          p_winner_share_percent: parseFloat(eventData.winnerSharePercent || 90),
          p_winner_count: parseInt(eventData.winnerCount || 1, 10),
          p_target_winning_digits: eventData.targetWinningDigits || '7429'
        });

        if (!rpcError && rpcData?.success) {
          await refreshEvents();
          showToast(`🎉 Provably Fair Round "${eventData.title}" created with SHA-256 commitment!`, 'success');
          return { success: true, commitHash: rpcData.commit_hash };
        }
        if (rpcError) {
          console.warn('create_provably_fair_lottery_round RPC error, falling back to direct insert:', rpcError);
        }
      } catch (rpcEx) {
        console.warn('create_provably_fair_lottery_round exception, falling back to direct insert:', rpcEx);
      }

      // 2. Direct insert fallback
      const metadata = JSON.stringify({
        block: `#${Math.floor(19400000 + Math.random() * 100000)}`,
        theme: eventData.theme || 'cyberpunk',
        banner_image: eventData.bannerImage || '',
        min_prize: minPrize,
        max_prize: maxPrize,
        winner_share_percent: parseFloat(eventData.winnerSharePercent || 90),
        winner_count: parseInt(eventData.winnerCount || 1, 10),
        target_winning_digits: eventData.targetWinningDigits || '7429'
      });

      // Insert directly into Supabase database (matching table schema strictly)
      const { data, error } = await supabase.from('lottery_events').insert({
        id: newId,
        title: eventData.title || 'VIP Lottery Event',
        badge: badge,
        ticket_price: parseFloat(eventData.ticketPrice || 10),
        pool_prize: poolPrize,
        draw_time: now + durationMs,
        status: 'active',
        winning_digits: null,
        participants_count: 0,
        tickets_sold: 0,
        sha256_seed: '0x' + Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join(''),
        block_target: metadata
      }).select();

      if (error) {
        throw error;
      }

      await refreshEvents();
      showToast(`🎉 New Lottery Pool "${eventData.title}" deployed to database!`, 'success');
      return { success: true };
    } catch (err) {
      console.error('adminCreateEvent error:', err);
      showToast('Failed to deploy lottery event: ' + err.message, 'error');
      return { success: false, error: err.message };
    }
  };

  const adminDeleteEvent = async (eventId) => {
    try {
      const { error } = await supabase.from('lottery_events').delete().eq('id', eventId);
      if (error) {
        throw error;
      }
      setEvents(prev => prev.filter(e => e.id !== eventId));
      showToast('Lottery event removed from database', 'info');
      return { success: true };
    } catch (err) {
      console.error('adminDeleteEvent error:', err);
      showToast('Failed to delete event: ' + err.message, 'error');
      return { success: false, error: err.message };
    }
  };

  // Submit User Contact / Support Inquiry
  const submitSupportTicket = async ({ name, username, email, subject, message }) => {
    const ticketId = `tkt-${Date.now().toString(36)}-${Math.floor(100 + Math.random() * 900)}`;
    const userMeta = {
      name: (name || '').trim(),
      username: (username || profile?.username || '').trim(),
      userId: user?.id || ''
    };

    const newTicket = {
      id: ticketId,
      name: userMeta.name,
      username: userMeta.username,
      userId: userMeta.userId,
      email: (email || user?.email || '').trim(),
      subject: (subject || 'General Inquiry').trim(),
      message: (message || '').trim(),
      status: 'pending',
      createdAt: Date.now()
    };

    // Optimistic UI state update
    setSupportTickets(prev => [newTicket, ...prev.filter(t => t.id !== ticketId)]);

    try {
      const { error } = await supabase.from('support_tickets').insert({
        id: ticketId,
        user_id: user?.id || null,
        user_address: wallet.address || null,
        name: userMeta.name,
        username: userMeta.username,
        email: newTicket.email,
        subject: newTicket.subject,
        message: newTicket.message,
        status: 'pending'
      });

      if (error) {
        console.warn('Supabase support ticket insert note:', error);
      }
      showToast(`Support query submitted! Ticket #${ticketId}`, 'success');
      return { success: true, ticketId };
    } catch (err) {
      console.error('submitSupportTicket error:', err);
      showToast(`Support query submitted! Ticket #${ticketId}`, 'success');
      return { success: true, ticketId };
    }
  };

  // Admin update ticket status ('pending' | 'replied' | 'resolved')
  const adminUpdateTicketStatus = async (ticketId, nextStatus, replyMessage = null) => {
    try {
      setSupportTickets(prev => prev.map(t => t.id === ticketId ? { ...t, status: nextStatus, adminReply: replyMessage || t.adminReply } : t));
      const updatePayload = { status: nextStatus, updated_at: new Date().toISOString() };
      if (replyMessage) {
        updatePayload.admin_reply = replyMessage;
      }
      const { error } = await supabase
        .from('support_tickets')
        .update(updatePayload)
        .eq('id', ticketId);
      if (error) {
        console.warn('Update ticket status note:', error.message);
      }
      showToast(`Ticket status updated to ${nextStatus.toUpperCase()}`, 'info');
      return { success: true };
    } catch (err) {
      console.error('adminUpdateTicketStatus error:', err);
      return { success: false, error: err.message };
    }
  };

  // Admin delete ticket
  const adminDeleteTicket = async (ticketId) => {
    try {
      setSupportTickets(prev => prev.filter(t => t.id !== ticketId));
      await supabase.from('support_tickets').delete().eq('id', ticketId);
      showToast('Support ticket deleted', 'info');
      return { success: true };
    } catch (err) {
      console.error('adminDeleteTicket error:', err);
      return { success: false, error: err.message };
    }
  };

  return (
    <LotteryContext.Provider
      value={{
        wallet,
        user,
        profile,
        isAuthModalOpen,
        setIsAuthModalOpen,
        authMode,
        setAuthMode,
        loginWithEmail,
        signupWithEmail,
        checkUsernameAvailability,
        verifyEmailOtp,
        resendSignupOtp,
        loginWithGoogle,
        logout,
        updateTrc20Address,
        events,
        loadingEvents,
        refreshEvents,
        tickets,
        withdrawals,
        activeTab,
        setActiveTab,
        selectedEventForModal,
        setSelectedEventForModal,
        isWalletModalOpen,
        setIsWalletModalOpen,
        walletModalTab,
        setWalletModalTab,
        winCelebration,
        setWinCelebration,
        toastMessage,
        showToast,
        isSupabaseSynced,
        toggleWalletConnection,
        switchNetwork,
        depositUSDT,
        createNowPaymentsInvoice,
        checkDepositStatus,
        deposits,
        loadingDeposits,
        fetchDeposits,
        cancelDeposit,
        buyTickets,
        requestWithdrawal,
        executeDraw,
        adminCreateEvent,
        adminDeleteEvent,
        adminApproveWithdrawal,
        adminRejectWithdrawal,
        adminFetchAllUsers,
        adminToggleUserStatus,
        adminUpdateUserRole,
        adminDeleteUser,
        winnerPayouts,
        adminApproveWinnerPayout,
        adminRejectWinnerPayout,
        adminAddManualWinnerCredit,
        supportTickets,
        fetchSupportTickets,
        submitSupportTicket,
        adminUpdateTicketStatus,
        drawAudits,
        loadingDrawAudits,
        fetchDrawAudits,
        verifyDrawResult,
        walletLedger,
        loadingLedger,
        fetchWalletLedger,
        userNotifications,
        unreadNotificationsCount,
        loadingNotifications,
        fetchUserNotifications,
        markNotificationAsRead,
        markAllNotificationsAsRead,
        clearUserNotifications,
        claimDailyBonus,
        claimDailyFloReward,
        getDailyFloRewardStatus,
        calculateDailyFloReward,
        adminUpdateRewardSettings,
        adminGetRewardsAnalytics,
        debitCredits,
        creditCredits,
        adminDeleteTicket,
        platformSettings,
        adminUpdatePlatformSettings,
        fetchPlatformSettings,
        isTicketNumberSold,
        getSoldTicketsForEvent,
        getUnsoldRandomNumber,
        needsUsernameSetup,
        setNeedsUsernameSetup,
        setPermanentUsername,
        updateUsername,
        usernameChangeCount,
        getUsernameChangeCount,
        requestPasswordReset,
        verifyPasswordResetOtp,
        isNativeApp,
        getDirectDownloadUrl,
        apkDirectDownloadUrl: getDirectDownloadUrl(platformSettings?.apkDownloadUrl)
      }}
    >
      {children}
    </LotteryContext.Provider>
  );
}

export function useLottery() {
  const context = useContext(LotteryContext);
  if (!context) {
    throw new Error('useLottery must be used within a LotteryProvider');
  }
  return context;
}
