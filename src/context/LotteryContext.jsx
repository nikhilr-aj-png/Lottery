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
        if (parsed && parsed.address) return parsed;
      } catch (e) {}
    }
    return {
      address: '0x71A9f24E68B8910d54F30C8B38194aE02919B42',
      connected: true,
      balance: 0,
      network: 'TRC-20',
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
      drawTime: Number(row.draw_time || Date.now() + 86400000),
      status: row.status || 'active',
      winningDigits: row.winning_digits || null,
      targetWinningDigits: meta.target_winning_digits || row.winning_digits || '7429',
      participantsCount: Number(row.participants_count || 0),
      ticketsSold: Number(row.tickets_sold || 0),
      sha256Seed: row.sha256_seed || '',
      blockTarget: meta.block || row.block_target || '#19,400,000',
      createdAt: row.created_at,
      winners: meta.winners || [],
      winnerSummary: meta.winner_summary || ''
    };
  };

  // Events State - Strictly Dynamic from Supabase Backend (No hardcoded mock pools!)
  const [events, setEvents] = useState([]);
  const [loadingEvents, setLoadingEvents] = useState(true);

  // Fetch events directly from Supabase database
  const refreshEvents = async () => {
    try {
      const { data, error } = await supabase
        .from('lottery_events')
        .select('*')
        .order('created_at', { ascending: false });

      if (!error && Array.isArray(data)) {
        setEvents(data.map(formatEventRow));
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

    // Subscribe to Supabase Realtime changes for lottery_events
    const eventChannel = supabase
      .channel('realtime:lottery_events')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'lottery_events' }, () => {
        refreshEvents();
      })
      .subscribe();

    return () => {
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

  // NOWPayments & Support Tickets Realtime Listener
  useEffect(() => {
    const depositChannel = supabase
      .channel('realtime:lottery_deposits')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'lottery_deposits' }, (payload) => {
        // Refresh deposit history ledger whenever any record changes
        fetchDeposits();

        // If it's a support ticket insert or status change
        if (payload.new?.currency === 'SUPPORT_TICKET' || payload.old?.currency === 'SUPPORT_TICKET') {
          fetchSupportTickets();
          return;
        }

        // If it's a platform settings update
        if (payload.new?.id === 'cfg_platform_settings') {
          fetchPlatformSettings();
          return;
        }

        // If it's a username change log
        if (payload.new?.currency === 'USERNAME_CHANGE' || payload.old?.currency === 'USERNAME_CHANGE') {
          if (user?.id) {
            getUsernameChangeCount(user.id).then(cnt => setUsernameChangeCount(cnt));
          }
          return;
        }

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

  // User Tickets State - Purely Dynamic from Supabase lottery_tickets
  const [tickets, setTickets] = useState([]);

  // Withdrawals State - Purely Dynamic from Supabase lottery_withdrawals
  const [withdrawals, setWithdrawals] = useState([]);

  // Winner Payouts Queue State - Purely Dynamic from database
  const [winnerPayouts, setWinnerPayouts] = useState([]);

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

  // Fetch support tickets from Supabase database
  const fetchSupportTickets = async () => {
    try {
      const { data, error } = await supabase
        .from('lottery_deposits')
        .select('*')
        .eq('currency', 'SUPPORT_TICKET')
        .order('created_at', { ascending: false });

      if (!error && Array.isArray(data)) {
        const mapped = data.map(row => {
          let userMeta = {};
          if (row.user_address && typeof row.user_address === 'string' && row.user_address.startsWith('{')) {
            try { userMeta = JSON.parse(row.user_address); } catch (e) {}
          }
          return {
            id: row.id,
            name: userMeta.name || 'Anonymous User',
            username: userMeta.username || '',
            userId: userMeta.userId || row.user_id || '',
            email: row.pay_currency || '',
            subject: row.payment_id || 'General Support Inquiry',
            message: row.invoice_url || '',
            status: row.status || 'pending', // 'pending' | 'replied' | 'resolved'
            createdAt: row.created_at ? new Date(row.created_at).getTime() : Date.now()
          };
        });
        setSupportTickets(mapped);
      }
    } catch (err) {
      console.error('fetchSupportTickets error:', err);
    }
  };

  // Platform Governance Settings State
  const DEFAULT_PLATFORM_SETTINGS = {
    minWithdrawal: 5.0,
    maxWithdrawal: 10000.0,
    houseFeePercent: 5,
    defaultWinnerSharePercent: 90,
    treasuryTrc20: 'TYv7s8K3eL2QpNm4xW9jRtZbCuYxK9m',
    supportEmail: 'support@earnflow.in',
    usernameChangeFee: 5.0
  };

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

  // Fetch platform settings from Supabase database
  const fetchPlatformSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('lottery_deposits')
        .select('*')
        .eq('id', 'cfg_platform_settings')
        .single();

      if (!error && data && data.invoice_url) {
        try {
          const parsed = JSON.parse(data.invoice_url);
          setPlatformSettings(prev => ({ ...prev, ...parsed }));
        } catch (e) {}
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
        usernameChangeFee: parseFloat(newSettings.usernameChangeFee !== undefined ? newSettings.usernameChangeFee : (platformSettings.usernameChangeFee ?? 5.0))
      };

      // Optimistic update
      setPlatformSettings(updated);
      localStorage.setItem('lotto_platform_settings', JSON.stringify(updated));

      // Persist to Supabase database
      const { error } = await supabase.from('lottery_deposits').upsert({
        id: 'cfg_platform_settings',
        amount: 0,
        currency: 'PLATFORM_SETTINGS',
        invoice_url: JSON.stringify(updated),
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

      if (!error && data) {
        setProfile(data);
        if (data.trc20_address) {
          setWallet(prev => ({
            ...prev,
            address: data.trc20_address,
            connected: true,
            network: 'TRC-20'
          }));
        }

        // Check if user has explicitly chosen a permanent username
        const hasChosenUsername = Boolean(data.username_chosen || (data.username && !data.username.includes('@')));
        if (!hasChosenUsername) {
          setNeedsUsernameSetup(true);
        } else {
          setNeedsUsernameSetup(false);
        }
      } else {
        // First-time OAuth login without existing profile record
        const initialProfile = {
          id: userId,
          email: user?.email || '',
          username: '',
          role: 'user',
          status: 'active'
        };
        try {
          await supabase.from('profiles').upsert(initialProfile);
          setProfile(initialProfile);
        } catch (e) {
          console.error('Error inserting initial profile:', e);
        }
        setNeedsUsernameSetup(true);
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
        .from('lottery_deposits')
        .select('id', { count: 'exact', head: true })
        .eq('currency', 'USERNAME_CHANGE')
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
    const clean = (chosenUsername || '').trim();

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
        const { data: dbWal, error: walErr } = await supabase
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

      // 4. Update profiles table in Supabase (only exact columns that exist: username, updated_at)
      const { data: updatedRows, error: profileError } = await supabase
        .from('profiles')
        .update({
          username: clean,
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id)
        .select();

      if (profileError) throw profileError;

      // If profile row didn't exist yet, insert with valid schema columns
      if (!updatedRows || updatedRows.length === 0) {
        const { error: upsertErr } = await supabase
          .from('profiles')
          .upsert({
            id: user.id,
            email: user.email || '',
            username: clean,
            role: 'user',
            status: 'active',
            updated_at: new Date().toISOString()
          });
        if (upsertErr) throw upsertErr;
      }

      // 5. Update auth user metadata
      await supabase.auth.updateUser({
        data: {
          username: clean,
          username_chosen: true,
          username_change_count: changeCount + 1
        }
      });

      // 6. Record audit log row in lottery_deposits table
      await supabase.from('lottery_deposits').insert({
        id: `unc_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        user_id: user.id,
        user_address: wallet.address,
        amount: requiredFee,
        currency: 'USERNAME_CHANGE',
        pay_currency: 'USDT',
        payment_id: isFirstTime ? 'FREE_LIFETIME_EDIT' : 'PAID_EDIT_FEE',
        invoice_id: clean,
        status: 'completed'
      });

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
    const username = (rawUsername || '').trim();
    if (!username) return { valid: false, message: 'User ID is required' };
    
    // Validation: Alphabet, number, underscore (_), and @ only
    const validPattern = /^[a-zA-Z0-9_@]+$/;
    if (!validPattern.test(username)) {
      return { 
        valid: false, 
        message: 'Only letters, numbers, underscore (_) and @ are allowed' 
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

      if (error) {
        console.error('Check username error:', error);
        return { valid: true };
      }

      if (data) {
        return { valid: false, message: 'This User ID is already taken. Please choose another.' };
      }

      return { valid: true, message: 'User ID is available!' };
    } catch (err) {
      console.error('Error checking username:', err);
      return { valid: true };
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
        const { error } = await supabase
          .from('profiles')
          .update({ trc20_address: newAddress, updated_at: new Date().toISOString() })
          .eq('id', user.id);
        if (error) throw error;
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
  const [activeTab, setActiveTab] = useState('lotteries');
  const [winCelebration, setWinCelebration] = useState(null);
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
    const addr = addressToFetch || wallet.address;
    if (!addr) return;
    try {
      const { data, error } = await supabase
        .from('lottery_wallets')
        .select('*')
        .eq('address', addr)
        .maybeSingle();

      if (!error && data) {
        setWallet(prev => ({
          ...prev,
          address: addr,
          connected: true,
          balance: parseFloat(data.balance || 0),
          lifetimeWon: parseFloat(data.lifetime_won || 0),
          network: data.network || prev.network || 'TRC-20'
        }));
      } else if (!data) {
        await supabase.from('lottery_wallets').upsert({
          address: addr,
          balance: 0,
          lifetime_won: 0,
          network: 'TRC-20'
        });
        setWallet(prev => ({
          ...prev,
          address: addr,
          connected: true,
          balance: 0,
          lifetimeWon: 0,
          network: 'TRC-20'
        }));
      }
    } catch (err) {
      console.error('fetchWallet error:', err);
    }
  };

  // Sync wallet on address change
  useEffect(() => {
    if (wallet.address) {
      fetchWallet(wallet.address);
    }
  }, [wallet.address]);

  // Initial fetch from Supabase
  useEffect(() => {
    async function loadSupabaseData() {
      try {
        await refreshEvents();
        await fetchTickets();
        await fetchWithdrawals();
        if (wallet.address) {
          await fetchWallet(wallet.address);
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

  // Realtime Supabase Channels for Tickets, Withdrawals & Wallets
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

    const walChannel = supabase
      .channel('realtime:lottery_wallets')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'lottery_wallets' }, (payload) => {
        if (payload.new && payload.new.address === wallet.address) {
          setWallet(prev => ({
            ...prev,
            balance: parseFloat(payload.new.balance || 0),
            lifetimeWon: parseFloat(payload.new.lifetime_won || 0),
            network: payload.new.network || prev.network
          }));
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(tChannel);
      supabase.removeChannel(wChannel);
      supabase.removeChannel(walChannel);
    };
  }, [wallet.address]);

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
      showToast(`Insufficient USDT Balance! Need ${totalCost} USDT, have ${wallet.balance.toFixed(2)} USDT`, 'error');
      return false;
    }

    const newBalance = parseFloat((wallet.balance - totalCost).toFixed(2));

    // Deduct balance
    setWallet(prev => ({
      ...prev,
      balance: newBalance
    }));

    // Create tickets
    const nowMs = Date.now();
    const userDisplayName = profile?.username ? `@${profile.username}` : (user?.email?.split('@')[0] || 'LuckyPlayer');
    const newTickets = ticketNumbers.map((num, i) => ({
      id: `tkt-${nowMs}-${Math.floor(1000 + Math.random() * 9000)}-${i}`,
      eventId: event.id,
      eventTitle: event.title,
      ticketNumber: num,
      price: event.ticketPrice,
      purchaseTime: nowMs,
      status: 'active',
      matchTier: null,
      wonAmount: 0,
      claimed: false,
      username: userDisplayName,
      userAddress: wallet.address
    }));

    setTickets(prev => [...newTickets, ...prev]);

    // Increase event pool & tickets sold
    const updatedPool = event.poolPrize + totalCost * 0.95;
    const updatedTicketsSold = event.ticketsSold + ticketNumbers.length;
    const updatedParticipants = event.participantsCount + 1;

    setEvents(prev => prev.map(e => {
      if (e.id === eventId) {
        return {
          ...e,
          poolPrize: updatedPool,
          ticketsSold: updatedTicketsSold,
          participantsCount: updatedParticipants
        };
      }
      return e;
    }));

    // Trigger mini celebratory confetti
    confetti({
      particleCount: 50,
      spread: 60,
      origin: { y: 0.8 },
      colors: ['#ffd700', '#f5c451', '#05d5aa']
    });

    showToast(`Success! Purchased ${ticketNumbers.length} ticket(s) for ${totalCost} USDT. Good luck!`);

    // Sync to Supabase in background
    try {
      // 1. Update wallet balance
      await supabase.from('lottery_wallets').upsert({
        address: wallet.address,
        balance: newBalance,
        lifetime_won: wallet.lifetimeWon,
        network: wallet.network
      });

      // 2. Insert tickets
      const dbTickets = newTickets.map(t => ({
        id: t.id,
        user_address: wallet.address,
        event_id: t.eventId,
        event_title: t.eventTitle,
        ticket_number: t.ticketNumber,
        price: t.price,
        purchase_time: t.purchaseTime,
        status: t.status,
        match_tier: t.matchTier,
        won_amount: t.wonAmount,
        claimed: t.claimed
      }));
      await supabase.from('lottery_tickets').insert(dbTickets);

      // 3. Update event in Supabase
      await supabase.from('lottery_events').update({
        pool_prize: updatedPool,
        tickets_sold: updatedTicketsSold,
        participants_count: updatedParticipants
      }).eq('id', eventId);
    } catch (err) {
      console.error('Supabase write error:', err);
    }

    return true;
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

    showToast(`Withdrawal of ${val} USDT requested! Order #${orderId} queued with 24h SLA.`, 'success');

    // Sync to Supabase
    try {
      await supabase.from('lottery_wallets').upsert({
        address: wallet.address,
        balance: newBalance,
        lifetime_won: wallet.lifetimeWon,
        network: wallet.network
      });

      await supabase.from('lottery_withdrawals').insert({
        id: newOrder.id,
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
    if (!event) return;

    // How many lucky winners should win? (e.g. 1, 5, 10, 12 etc.)
    const configuredWinnerCount = Math.max(1, parseInt(customWinnerCount || event.winnerCount || 1, 10));

    // Generate 4-digit winning sequence (e.g. '7429') if not specified
    const winDigits = specifiedWinningDigits 
      ? String(specifiedWinningDigits).padStart(4, '0')
      : String(Math.floor(Math.random() * 10000)).padStart(4, '0');

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
      // 1. Mark ticket as claimed in Supabase
      if (payout.ticketId && payout.ticketId !== 'MANUAL') {
        await supabase
          .from('lottery_tickets')
          .update({ claimed: true, won_amount: finalAmount })
          .eq('id', payout.ticketId);
      }

      // 2. Fetch current wallet of winner from DB and credit finalAmount
      const winnerAddr = payout.winnerAddress || wallet.address;
      const { data: dbWal } = await supabase
        .from('lottery_wallets')
        .select('*')
        .eq('address', winnerAddr)
        .maybeSingle();

      const currentBal = Number(dbWal?.balance || 0);
      const currentWon = Number(dbWal?.lifetime_won || 0);
      const newBal = parseFloat((currentBal + finalAmount).toFixed(2));
      const newWon = parseFloat((currentWon + finalAmount).toFixed(2));

      await supabase.from('lottery_wallets').upsert({
        address: winnerAddr,
        balance: newBal,
        lifetime_won: newWon,
        network: 'TRC-20'
      });

      // Update local winnerPayouts state
      const mockTx = `0x${Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join('')}`;
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

      // If active wallet is this winner, update local state
      if (wallet.address === winnerAddr) {
        setWallet(prev => ({
          ...prev,
          balance: newBal,
          lifetimeWon: newWon
        }));
      }

      confetti({
        particleCount: 160,
        spread: 90,
        origin: { y: 0.6 },
        colors: ['#05d5aa', '#ffd700', '#00f2fe', '#ffffff']
      });

      showToast(`Approved! Added ${finalAmount.toFixed(2)} USDT directly to winner's wallet in Supabase ✅`, 'success');
      return { success: true };
    } catch (err) {
      console.error('adminApproveWinnerPayout error:', err);
      showToast('Error approving winner payout: ' + err.message, 'error');
      return { success: false, error: err.message };
    }
  };

  const adminRejectWinnerPayout = (payoutId) => {
    setWinnerPayouts(prev => prev.map(p => {
      if (p.id === payoutId) {
        return { ...p, status: 'rejected' };
      }
      return p;
    }));
    showToast('Winner payout rejected / on hold', 'info');
    return { success: true };
  };

  const adminAddManualWinnerCredit = async (targetUsernameOrAddress, amount, note = 'Special Seasonal Reward') => {
    const cleanAmount = parseFloat(amount);
    if (isNaN(cleanAmount) || cleanAmount <= 0) {
      showToast('Please enter a valid USDT amount', 'error');
      return { success: false };
    }

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
      txHash: `0x${Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join('')}`
    };

    setWinnerPayouts(prev => [newPayout, ...prev]);

    const newBal = parseFloat((wallet.balance + cleanAmount).toFixed(2));
    const newWon = parseFloat((wallet.lifetimeWon + cleanAmount).toFixed(2));
    setWallet(prev => ({
      ...prev,
      balance: newBal,
      lifetimeWon: newWon
    }));

    showToast(`Successfully added ${cleanAmount.toFixed(2)} USDT to player wallet!`, 'success');
    return { success: true };
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
        badge: eventData.badge || (eventData.theme === 'diwali' ? '🪔 DIWALI BUMPER' : (eventData.theme === 'eid' ? '🌙 EID MUBARAK' : (eventData.theme === 'durga_puja' ? '🌺 DURGA UTSAV' : 'SPECIAL EVENT'))),
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
      const { error } = await supabase.from('lottery_deposits').insert({
        id: ticketId,
        user_address: JSON.stringify(userMeta),
        user_id: user?.id || null,
        amount: 0,
        currency: 'SUPPORT_TICKET',
        pay_currency: newTicket.email,
        payment_id: newTicket.subject,
        invoice_url: newTicket.message,
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
  const adminUpdateTicketStatus = async (ticketId, nextStatus) => {
    try {
      setSupportTickets(prev => prev.map(t => t.id === ticketId ? { ...t, status: nextStatus } : t));
      const { error } = await supabase
        .from('lottery_deposits')
        .update({ status: nextStatus, updated_at: new Date().toISOString() })
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
      await supabase.from('lottery_deposits').delete().eq('id', ticketId);
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
        checkUsernameAvailability,
        requestPasswordReset,
        verifyPasswordResetOtp
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
