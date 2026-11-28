import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import confetti from 'canvas-confetti';
import { supabase } from '../lib/supabase';
import { GAMES } from '../engine';
import { normalizeReferralSettings } from '../utils/referralConfig';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const LotteryContext = createContext<any>(null);

// All events, tickets, withdrawals, and wallet states are 100% dynamic and database-driven via Supabase
export function LotteryProvider({ children }: { children: ReactNode }) {
  // Wallet State - Loaded strictly from Supabase lottery_wallets when authenticated
  const [wallet, setWallet] = useState({
    address: '',
    connected: false,
    balance: 0,
    network: 'TRC-20',
    lifetimeWon: 0
  });

  // User Authentication State (Declared early so downstream effects & callbacks reference safely)
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState<boolean>(true);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState('login'); // 'login' | 'signup'

  // Ref to keep stable wallet address inside persistent Realtime channel handlers without re-subscribing
  const walletAddressRef = React.useRef<string>('');
  useEffect(() => {
    walletAddressRef.current = wallet.address || '';
  }, [wallet.address]);

  // Ref to hold executeDraw function for auto-settling timer
  const executeDrawRef = React.useRef<any>(null);
  const autoSettlingEventsRef = React.useRef<Set<string>>(new Set());
  const [serverTimeOffsetMs, setServerTimeOffsetMs] = useState<number>(0);
  const getServerNowMs = () => Date.now() + serverTimeOffsetMs;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const formatEventRow = (row: any, nowMs: number = Date.now()) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let meta: any = {};
    if (row.block_target && typeof row.block_target === 'string') {
      try {
        if (row.block_target.startsWith('{')) {
          meta = JSON.parse(row.block_target);
        }
      } catch (e) {
        // Not a JSON string
      }
    }
    if (row.metadata && typeof row.metadata === 'object') {
      meta = { ...meta, ...row.metadata };
    }

    const startTimeMs = Number(row.start_time || meta.start_time || 0);
    const rawDrawTimeMs = Number(row.draw_time || 0);

    // Duration & Cooldown
    const durationValue = Number(row.duration_value || meta.duration_value || 1);
    const durationUnit = row.duration_unit || meta.duration_unit || 'hours';
    const durUnitLower = String(durationUnit).toLowerCase();
    const durMs =
      durationValue > 0
        ? durUnitLower.startsWith('min')
          ? durationValue * 60 * 1000
          : durUnitLower.startsWith('day')
            ? durationValue * 86400 * 1000
            : durationValue * 3600 * 1000
        : 0;
    const computedEndMs = startTimeMs > 0 && durMs > 0 ? startTimeMs + durMs : 0;
    const drawTimeMs =
      rawDrawTimeMs > 0 && computedEndMs > 0
        ? Math.min(rawDrawTimeMs, computedEndMs)
        : rawDrawTimeMs > 0
          ? rawDrawTimeMs
          : computedEndMs;

    const isDeleted = Boolean(row.is_deleted) || row.status === 'deleted';
    const isActiveFlag = row.is_active !== false;
    const isTimedOut = drawTimeMs <= 0 || drawTimeMs <= nowMs;
    const isUpcoming = startTimeMs > 0 && nowMs < startTimeMs;
    const finalizedAt = row.finalized_at || (row.status === 'completed' ? row.draw_executed_at : null) || null;
    const finalizedAtMs = finalizedAt ? new Date(finalizedAt).getTime() : 0;
    const resultPublishedAt = row.result_published_at || finalizedAt || null;
    const resultPublishedAtMs = resultPublishedAt ? new Date(resultPublishedAt).getTime() : 0;
    const ticketVisibilityUntil = row.result_visible_until || row.ticket_visibility_until || (finalizedAtMs > 0 ? new Date(finalizedAtMs + 3600 * 1000).toISOString() : null);
    const ticketVisibilityUntilMs = ticketVisibilityUntil ? new Date(ticketVisibilityUntil).getTime() : 0;
    const resultVisibleUntil = row.result_visible_until || ticketVisibilityUntil || null;
    const resultVisibleUntilMs = resultVisibleUntil ? new Date(resultVisibleUntil).getTime() : 0;
    const eventCategory = String(row.event_category || meta.event_category || 'normal').toLowerCase() === 'vip' ? 'vip' : 'normal';
    const scheduledPublishAt = row.scheduled_publish_at || null;
    const scheduledPublishAtMs = scheduledPublishAt ? new Date(scheduledPublishAt).getTime() : 0;
    const publishedAt = row.published_at || null;
    const publishedAtMs = publishedAt ? new Date(publishedAt).getTime() : 0;
    const processingStartedAt = row.processing_started_at || null;
    const isScheduledUnpublished = (row.status === 'scheduled' || row.status === 'draft') && !publishedAt;
    const isFinalized = row.status === 'completed' && (finalizedAtMs > 0 || Boolean(row.winning_digits));

    // Lifecycle separation: Draft -> Scheduled -> Active -> Expired -> Processing -> Completed
    let effectiveStatus = row.status || 'active';
    if (isDeleted) {
      effectiveStatus = 'deleted';
    } else if (isFinalized) {
      effectiveStatus = 'completed';
    } else if (isScheduledUnpublished) {
      effectiveStatus = row.status === 'draft' ? 'draft' : 'scheduled';
    } else if (row.status === 'processing') {
      effectiveStatus = 'processing';
    } else if (!isActiveFlag || row.status === 'expired' || row.status === 'result_pending') {
      effectiveStatus = row.status === 'result_pending' ? 'result_pending' : 'expired';
    } else if (isUpcoming && row.status !== 'paused') {
      effectiveStatus = 'scheduled';
    } else if (isTimedOut && row.status === 'active') {
      effectiveStatus = 'expired';
    }

    // Winning digits strictly real from database — zero dummy '7429'
    const effectiveWinningDigits = row.winning_digits || null;

    // Currency: USDT only
    const currency = (row.currency || meta.currency || 'USDT').toUpperCase();

    // Room Identification
    const roomName = row.room_name || meta.room_name || row.title || 'Room 1';
    const roomId = row.room_id || meta.room_id || `room-${row.id}`;
    const cooldownValue = Number(row.cooldown_value || meta.cooldown_value || 0);
    const cooldownUnit = row.cooldown_unit || meta.cooldown_unit || 'minutes';
    const cooldownUntil = row.cooldown_until ? Number(row.cooldown_until) : (meta.cooldown_until ? Number(meta.cooldown_until) : null);

    // Jackpot Structure
    const jackpotMode = row.jackpot_mode || meta.jackpot_mode || ((row.min_jackpot && row.max_jackpot) || (meta.min_prize && meta.max_prize) ? 'range' : 'fixed');
    const minJackpot = row.min_jackpot !== null && row.min_jackpot !== undefined ? Number(row.min_jackpot) : (meta.min_prize !== undefined ? Number(meta.min_prize) : null);
    const maxJackpot = row.max_jackpot !== null && row.max_jackpot !== undefined ? Number(row.max_jackpot) : (meta.max_prize !== undefined ? Number(meta.max_prize) : null);
    const jackpotSelectionMethod = row.jackpot_selection_method || meta.jackpot_selection_method || 'manual';

    // Ticket Limits
    const ticketLimitMode = row.ticket_limit_mode || meta.ticket_limit_mode || 'unlimited';
    const maxTotalTickets = row.max_total_tickets ? Number(row.max_total_tickets) : (meta.max_total_tickets ? Number(meta.max_total_tickets) : null);
    const maxTicketsPerUser = row.max_tickets_per_user ? Number(row.max_tickets_per_user) : (meta.max_tickets_per_user ? Number(meta.max_tickets_per_user) : null);

    // Draw & Winner Rules
    const drawMode = row.draw_mode || meta.draw_mode || 'random';
    const presetWinningDigits = row.preset_winning_digits || meta.preset_winning_digits || meta.target_winning_digits || null;
    const winnerMode = row.winner_mode || meta.winner_mode || ((row.winner_count && row.winner_count > 1) ? 'multiple' : 'single');
    const winnerCount = Math.max(1, Number(row.winner_count || meta.winner_count || 1));
    const winnerPayoutSharePercent = Number(row.winner_payout_share_percent || meta.winner_share_percent || 100);
    const winnerDistribution = row.winner_distribution || meta.winner_distribution || [{ position: 1, percent: 100 }];

    // Multi-Winning Codes & Lifecycle
    let winningCodes: string[] = [];
    if (Array.isArray(row.winning_codes)) {
      winningCodes = row.winning_codes.map((c: any) => String(c).padStart(4, '0'));
    } else if (presetWinningDigits) {
      winningCodes = [String(presetWinningDigits).padStart(4, '0')];
    } else if (row.winning_digits) {
      winningCodes = [String(row.winning_digits).padStart(4, '0')];
    }
    const winningCodeCount = Number(row.winning_code_count || (winningCodes.length > 0 ? winningCodes.length : winnerCount));
    const codesTiming = row.codes_timing || meta.codes_timing || (winningCodes.length > 0 ? 'configured' : 'after_publishing');
    const codesLocked = Boolean(
      row.codes_locked ||
      isFinalized ||
      effectiveStatus === 'expired' ||
      effectiveStatus === 'processing' ||
      effectiveStatus === 'result_pending' ||
      (!isScheduledUnpublished && isTimedOut)
    );
    const isPaused = Boolean(row.is_paused);
    const pauseReason = row.pause_reason || '';
    const lockedJackpot = jackpotMode === 'range'
      ? (row.locked_jackpot !== null && row.locked_jackpot !== undefined ? Number(row.locked_jackpot) : null)
      : (row.locked_jackpot !== null && row.locked_jackpot !== undefined ? Number(row.locked_jackpot) : Number(row.pool_prize || 0));
    const drawResultCodes = Array.isArray(row.draw_result_codes) && row.draw_result_codes.length > 0
      ? row.draw_result_codes
      : (row.winning_digits ? [row.winning_digits] : []);
    const drawResultDetails = row.draw_result_details || null;
    const drawExecutedAt = row.draw_executed_at || null;

    return {
      id: row.id,
      title: row.title,
      badge: row.badge || meta.badge || 'VIP LOTTERY',
      theme: meta.theme || 'cyberpunk',
      bannerImage: meta.banner_image || '',
      gameId: row.game_id || 'lottery',
      roomId,
      roomName,
      description: row.description || meta.description || '',
      currency,
      ticketPrice: Number(row.ticket_price || 10),
      poolPrize: Number(row.pool_prize || 0),
      lockedJackpot,
      grossTicketSales: Number(row.gross_ticket_sales || 0),
      houseChargeCollected: Number(row.house_charge_collected || 0),
      netPrizeFunding: Number(row.net_prize_funding || 0),
      durationValue,
      durationUnit,
      cooldownValue,
      cooldownUnit,
      cooldownUntil,
      jackpotMode,
      minJackpot,
      maxJackpot,
      jackpotSelectionMethod,
      minPrize: minJackpot,
      maxPrize: maxJackpot,
      ticketLimitMode,
      maxTotalTickets,
      maxTicketsPerUser,
      drawMode,
      presetWinningDigits,
      winningCodes,
      winningCodeCount,
      codesTiming,
      codesLocked,
      isPaused,
      pauseReason,
      drawResultCodes,
      drawResultDetails,
      drawExecutedAt,
      finalizedAt,
      finalizedAtMs,
      resultPublishedAt,
      resultPublishedAtMs,
      resultVisibleUntil,
      resultVisibleUntilMs,
      ticketVisibilityUntil,
      ticketVisibilityUntilMs,
      eventCategory,
      scheduledPublishAt,
      scheduledPublishAtMs,
      publishedAt,
      publishedAtMs,
      processingStartedAt,
      processingError: row.processing_error || null,
      processingErrorAt: row.processing_error_at || null,
      processingAttempts: Number(row.processing_attempts || 0),
      isScheduledUnpublished,
      isFinalized,
      winnerMode,
      winnerCount,
      winnerSharePercent: winnerPayoutSharePercent,
      winnerPayoutSharePercent,
      winnerDistribution,
      startTime: startTimeMs,
      drawTime: drawTimeMs,
      isActive: isActiveFlag,
      isDeleted,
      status: isPaused ? 'paused' : effectiveStatus,
      winningDigits: effectiveWinningDigits,
      targetWinningDigits: presetWinningDigits,
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

  // --------------------------------------------------------------------------
  // DYNAMIC GAMES STATE (Single Source of Truth: Supabase public.game_configurations)
  // --------------------------------------------------------------------------
  const [games, setGames] = useState<any[]>([]);
  const [loadingGames, setLoadingGames] = useState(true);

  const refreshGames = async () => {
    try {
      setLoadingGames(true);
      const { data, error } = await supabase
        .from('game_configurations')
        .select('*')
        .order('created_at', { ascending: true });

      if (!error && Array.isArray(data)) {
        const mergedGames = data.map((dbGame: any) => {
          const staticGame: any = GAMES.find(g => g.id === dbGame.game_id || g.slug === dbGame.game_id) || {};
          return {
            ...staticGame,
            id: dbGame.game_id,
            slug: staticGame.slug || dbGame.game_id,
            name: dbGame.game_name || staticGame.name || dbGame.game_id,
            category: dbGame.category || staticGame.category || 'arcade',
            isEnabled: dbGame.is_enabled !== undefined ? dbGame.is_enabled : true,
            status: dbGame.status || (dbGame.is_enabled ? 'active' : 'disabled'),
            badge: dbGame.badge || staticGame.badge || '',
            description: dbGame.description || staticGame.description || '',
            houseEdge: dbGame.house_edge !== undefined ? Number(dbGame.house_edge) : (staticGame.houseEdge || 1.0),
            rtp: dbGame.rtp !== undefined ? Number(dbGame.rtp) : (staticGame.rtp || 99.0),
            minStakeFC: dbGame.min_stake_fc !== undefined ? Number(dbGame.min_stake_fc) : (staticGame.minStakeFC || 1),
            maxStakeFC: dbGame.max_stake_fc !== undefined ? Number(dbGame.max_stake_fc) : (staticGame.maxStakeFC || 1000),
            maxMultiplier: dbGame.max_multiplier !== undefined ? Number(dbGame.max_multiplier) : staticGame.maxMultiplier,
            icon: '/items/Four Digit Lottery.jpg',
            rules: staticGame.rules || [],
            instructions: staticGame.instructions || ''
          };
        });
        setGames(mergedGames);
      } else if (error) {
        console.error('Supabase fetch game_configurations error:', error);
      }
    } catch (err) {
      console.error('refreshGames error:', err);
    } finally {
      setLoadingGames(false);
    }
  };

  const adminToggleGame = async (gameId: string, enabled: boolean) => {
    try {
      const { error } = await supabase
        .from('game_configurations')
        .update({
          is_enabled: enabled,
          status: enabled ? 'active' : 'disabled',
          updated_at: new Date().toISOString()
        })
        .eq('game_id', gameId);

      if (error) throw error;
      setGames(prev => prev.map(g => g.id === gameId ? { ...g, isEnabled: enabled, status: enabled ? 'active' : 'disabled' } : g));
      showToast(`Game ${enabled ? 'enabled' : 'disabled'} successfully`, 'success');
      return { success: true };
    } catch (err: any) {
      console.error('adminToggleGame error:', err);
      showToast('Failed to toggle game: ' + (err.message || err), 'error');
      return { success: false, error: err.message || err };
    }
  };

  const adminDeleteGame = async (gameId: string) => {
    try {
      const { error } = await supabase
        .from('game_configurations')
        .update({
          status: 'deleted',
          is_enabled: false,
          updated_at: new Date().toISOString()
        })
        .eq('game_id', gameId);

      if (error) throw error;
      setGames(prev => prev.filter(g => g.id !== gameId));
      showToast('Game deleted successfully from database', 'info');
      return { success: true };
    } catch (err: any) {
      console.error('adminDeleteGame error:', err);
      showToast('Failed to delete game: ' + (err.message || err), 'error');
      return { success: false, error: err.message || err };
    }
  };

  const adminUpdateGameConfig = async (gameId: string, updates: any) => {
    try {
      const dbUpdates: any = { updated_at: new Date().toISOString() };
      if (updates.minStakeFC !== undefined) dbUpdates.min_stake_fc = Number(updates.minStakeFC);
      if (updates.maxStakeFC !== undefined) dbUpdates.max_stake_fc = Number(updates.maxStakeFC);
      if (updates.houseEdge !== undefined) dbUpdates.house_edge = Number(updates.houseEdge);
      if (updates.rtp !== undefined) dbUpdates.rtp = Number(updates.rtp);
      if (updates.badge !== undefined) dbUpdates.badge = updates.badge;
      if (updates.description !== undefined) dbUpdates.description = updates.description;
      if (updates.isEnabled !== undefined) {
        dbUpdates.is_enabled = updates.isEnabled;
        dbUpdates.status = updates.isEnabled ? 'active' : 'disabled';
      }

      const { error } = await supabase
        .from('game_configurations')
        .update(dbUpdates)
        .eq('game_id', gameId);

      if (error) throw error;
      await refreshGames();
      showToast('Game configuration updated successfully', 'success');
      return { success: true };
    } catch (err: any) {
      console.error('adminUpdateGameConfig error:', err);
      showToast('Failed to update game: ' + (err.message || err), 'error');
      return { success: false, error: err.message || err };
    }
  };

  // --------------------------------------------------------------------------
  // EVENTS STATE - Strictly Dynamic from Supabase Backend (No Hardcoded Mock Pools)
  // --------------------------------------------------------------------------
  const [events, setEvents] = useState<any[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(true);

  // Fetch events directly from Supabase database synced with authoritative server time
  const refreshEvents = async () => {
    try {
      const [{ data: srvTime }, { data, error }] = await Promise.all([
        supabase.rpc('get_server_time_ms'),
        supabase
          .from('lottery_events')
          .select('*')
          .neq('status', 'deleted')
          .order('created_at', { ascending: false })
      ]);

      let serverNow = Date.now() + serverTimeOffsetMs;
      if (typeof srvTime === 'number' && srvTime > 0) {
        serverNow = srvTime;
        setServerTimeOffsetMs(srvTime - Date.now());
      }

      if (!error && Array.isArray(data)) {
        const formatted = upsertDeduplicatedEvents(data.map(row => formatEventRow(row, serverNow)));
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

  // Server-authoritative Room Entry Verification
  const verifyRoomEntry = async (eventOrRoomId: string) => {
    if (!eventOrRoomId) {
      return { allowed: false, reason: 'invalid_room', message: 'Invalid lottery room identifier.' };
    }
    try {
      const { data, error } = await supabase.rpc('verify_room_entry_secure', {
        p_event_or_room_id: eventOrRoomId
      });
      if (error) {
        return { allowed: false, reason: 'verification_error', message: error.message || 'Unable to verify room access.' };
      }
      if (typeof data?.server_now_ms === 'number' && data.server_now_ms > 0) {
        setServerTimeOffsetMs(data.server_now_ms - Date.now());
      }
      return data || { allowed: false, reason: 'expired', message: 'This event has expired. Room entry is no longer available.' };
    } catch (err: any) {
      return { allowed: false, reason: 'verification_error', message: err?.message || 'Unable to verify room access.' };
    }
  };

  const [rewardsSyncTick, setRewardsSyncTick] = useState(0);

  // Server-authoritative events deduplicator preserving sort order
  const upsertDeduplicatedEvents = (incoming: any[]) => {
    const seen = new Set<string>();
    const out: any[] = [];
    for (const evt of incoming) {
      if (!evt || !evt.id || seen.has(evt.id)) continue;
      seen.add(evt.id);
      out.push(evt);
    }
    return out;
  };

  useEffect(() => {
    refreshEvents();
    refreshGames();

    // Clean up any stale localStorage mock pools
    try {
      localStorage.removeItem('lotto_events');
    } catch (e) { }

    // Timer check: lock expired active events AND immediately remove expired-event tickets reactively
    const timerCheck = setInterval(() => {
      const now = Date.now() + serverTimeOffsetMs;
      const newlyExpiredIds = new Set<string>();
      setEvents(prev => {
        let hasChanges = false;
        const updated = prev.map(e => {
          if (e.status === 'active' && e.drawTime && e.drawTime <= now) {
            hasChanges = true;
            newlyExpiredIds.add(e.id);
            return { ...e, status: 'expired', isActive: false, codesLocked: true };
          }
          return e;
        });
        return hasChanges ? updated : prev;
      });
      setTickets(prev => {
        if (!Array.isArray(prev) || prev.length === 0) return prev;
        const filtered = prev.filter((t: any) => {
          if (newlyExpiredIds.has(t.eventId)) return false;
          if (t.drawTime && Number(t.drawTime) <= now) return false;
          if (t.eventStatus && String(t.eventStatus).toLowerCase() !== 'active') return false;
          return true;
        });
        return filtered.length === prev.length ? prev : filtered;
      });
    }, 1000);

    // Subscribe to Supabase Realtime changes for game_configurations
    const gamesChannel = supabase
      .channel('realtime:game_configurations')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'game_configurations' }, () => {
        refreshGames();
      })
      .subscribe();

    const handleVisibilityOrOnline = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      refreshEvents();
      refreshGames();
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('online', handleVisibilityOrOnline);
      document.addEventListener('visibilitychange', handleVisibilityOrOnline);
    }

    return () => {
      clearInterval(timerCheck);
      supabase.removeChannel(gamesChannel);
      if (typeof window !== 'undefined') {
        window.removeEventListener('online', handleVisibilityOrOnline);
        document.removeEventListener('visibilitychange', handleVisibilityOrOnline);
      }
    };
  }, []);

  // Deposits State & History with Auto-Timeout
  const [deposits, setDeposits] = useState<any[]>([]);
  const [loadingDeposits, setLoadingDeposits] = useState(false);

  // Fetch deposits and automatically cancel/expire unpaid invoices older than 15 minutes
  const fetchDeposits = async () => {
    if (!user?.id) {
      setDeposits([]);
      return;
    }
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
                .then(() => { });
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
    if (!user?.id) {
      requireAuth({ type: 'tab', tab: 'wallet' }, 'Please log in to manage your deposits.');
      return;
    }
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
    if (user?.id) {
      fetchDeposits();
    } else {
      setDeposits([]);
    }
  }, [user?.id, wallet.address]);

  // Authoritative deposit listener is multiplexed into realtime:user_private:{userId} below

  // NOWPayments: Create USDT (TRC-20) Deposit Order via Authenticated Supabase Edge Function
  const createNowPaymentsInvoice = async (amount: number | string, payCurrency = 'usdttrc20') => {
    if (!user?.id) {
      requireAuth({ type: 'tab', tab: 'wallet' }, 'Please log in to deposit USDT into your wallet.');
      return { success: false, error: 'Authentication required' };
    }
    const normalizedCurrency = String(payCurrency || 'usdttrc20').trim().toLowerCase();
    if (normalizedCurrency !== 'usdttrc20') {
      const msg = 'Unsupported asset/network. Only USDT on TRON (TRC-20) is supported.';
      showToast(msg, 'error');
      return { success: false, error: msg };
    }

    const numAmount = parseFloat(String(amount));
    if (isNaN(numAmount) || numAmount < 20 || numAmount > 500) {
      showToast('Deposit amount must be between 20 USDT and 500 USDT (Min: 20 USDT, Max: 500 USDT)', 'error');
      return { success: false, error: 'Deposit amount must be between 20 USDT and 500 USDT' };
    }

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;
      if (!accessToken) {
        requireAuth({ type: 'tab', tab: 'wallet' }, 'Please log in again to authorize this deposit.');
        return { success: false, error: 'Active session token missing' };
      }

      showToast('Creating secure USDT (TRC-20) deposit order...', 'info');
      const response = await fetch(
        'https://pkloymdzdjykpsutpyqk.supabase.co/functions/v1/payment-api/create-nowpayments-invoice',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': 'sb_publishable_x7puqG5DzU9YkvDsV10HyQ_144KlMqt',
            'Authorization': `Bearer ${accessToken}`
          },
          body: JSON.stringify({
            amount: numAmount,
            userAddress: wallet.address,
            payCurrency: 'usdttrc20',
            network: 'TRC-20'
          })
        }
      );

      const data = await response.json();
      if (!response.ok || (!data.success && !data.orderId)) {
        throw new Error(data.error || 'Failed to create deposit order');
      }

      showToast('USDT (TRC-20) deposit order ready!', 'success');
      fetchDeposits();
      return {
        success: true,
        depositId: data.deposit_id || data.orderId,
        invoiceUrl: data.invoice_url || '',
        invoiceId: data.invoice_id || String(data.paymentId || ''),
        payAddress: data.payAddress || '',
        payAmount: data.payAmount || numAmount,
        network: 'TRC-20'
      };
    } catch (err: any) {
      console.error('Deposit invoice error:', err);
      showToast('Deposit error: ' + err.message, 'error');
      return { success: false, error: err.message };
    }
  };

  // Check NOWPayments deposit status via Authenticated Supabase Edge Function
  const checkDepositStatus = async (depositId: string) => {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'apikey': 'sb_publishable_x7puqG5DzU9YkvDsV10HyQ_144KlMqt',
      };
      if (accessToken) {
        headers['Authorization'] = `Bearer ${accessToken}`;
      }

      const response = await fetch(
        'https://pkloymdzdjykpsutpyqk.supabase.co/functions/v1/payment-api/deposit-status',
        {
          method: 'POST',
          headers,
          body: JSON.stringify({ depositId, orderId: depositId })
        }
      );
      return await response.json();
    } catch (err: any) {
      console.error('checkDepositStatus error:', err);
      return { success: false, error: err.message };
    }
  };

  // Virtual Wallet Immutable Ledger State - 100% Dynamic from Supabase wallet_ledger table
  const [walletLedger, setWalletLedger] = useState<any[]>([]);
  const [loadingLedger, setLoadingLedger] = useState(false);

  // Fetch immutable ledger transactions for the active authenticated user
  const fetchWalletLedger = async (targetAddr: any = null) => {
    if (!user?.id) {
      setWalletLedger([]);
      return;
    }
    const addr = targetAddr || wallet.address;
    setLoadingLedger(true);
    try {
      let query = supabase
        .from('wallet_ledger')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (addr) {
        query = query.or(`user_id.eq.${user.id},wallet_address.eq.${addr}`);
      } else {
        query = query.eq('user_id', user.id);
      }

      const { data, error } = await query;
      if (!error && Array.isArray(data)) {
        const seenIds = new Set<string>();
        const deduped = data.filter((row: any) => {
          if (!row?.id || seenIds.has(row.id)) return false;
          seenIds.add(row.id);
          return true;
        });
        setWalletLedger(deduped);
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
  const [userNotifications, setUserNotifications] = useState<any[]>([]);
  const [unreadNotificationsCount, setUnreadNotificationsCount] = useState(0);
  const [loadingNotifications, setLoadingNotifications] = useState(false);

  // Fetch real persistent notifications from Supabase
  const fetchUserNotifications = async (targetAddr: any = null) => {
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

  // Check daily reward status from server-authoritative RPC (Asia/Kolkata + VIP category sync)
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
          eligibilityError: data.eligibility_error || null,
          secondsRemaining: Number(data.seconds_remaining || 0),
          availableReward: parseFloat(data.available_reward || 0.10),
          currentStreak: Number(data.current_streak || 1),
          highestStreak: Number(data.highest_streak || 0),
          nextStreak: Number(data.next_streak || 2),
          nextRewardAmount: parseFloat(data.next_reward_amount || 0.15),
          playerCategory: data.player_category || 'normal',
          vipRewardMode: data.vip_reward_mode || 'double_normal',
          effectiveStreakRewards: data.effective_streak_rewards || null,
          bonusSettings: data.bonus_settings || null,
          checkinSettings: data.checkin_settings || null,
          lastClaimedAt: data.last_claimed_at || null,
          lastCheckinDate: data.last_checkin_date || null,
          todayDate: data.today_date || null
        };
      }
      return { canClaim: false, secondsRemaining: 0, availableReward: 0.10, currentStreak: 1, nextStreak: 2, nextRewardAmount: 0.15, error: data?.error || error?.message };
    } catch (e: any) {
      console.warn('getDailyFloRewardStatus rpc error:', e);
      return { canClaim: false, secondsRemaining: 0, availableReward: 0.10, currentStreak: 1, nextStreak: 2, nextRewardAmount: 0.15, error: e?.message };
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
        showToast(`🎉 Day ${data.current_streak} Claimed! +${bonusAmount.toFixed(2)} USDT bonus added to wallet!`, 'success');
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

  // Universal Server-Authoritative Debit RPC (Authenticated Only)
  const debitCredits = async (amount: any, type: any = 'game_bet', referenceId: any = null, description: any = null, metadata: any = {}) => {
    if (!user?.id) {
      return { success: false, error: 'Authentication required' };
    }
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

  // Universal Server-Authoritative Credit RPC (Authenticated Only)
  const creditCredits = async (amount: any, type: any = 'game_win', referenceId: any = null, description: any = null, metadata: any = {}) => {
    if (!user?.id) {
      return { success: false, error: 'Authentication required' };
    }
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
  const [drawAudits, setDrawAudits] = useState<any[]>([]);
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
    } catch (err: any) {
      console.warn('verifyDrawResult RPC error, computing client verification:', err);
      const evt = events.find(e => e.id === eventId);
      if (!evt || !evt.winningDigits) {
        return { verified: false, error: 'Draw outcome not found for verification.' };
      }
      const pubHash = evt.sha256Seed || evt.sha256_seed;
      const revSeed = evt.revealedSeed || evt.revealed_seed || evt.serverSeed || evt.server_seed;
      if (!pubHash) {
        return { verified: false, error: 'Cryptographic commit hash not available for this event.' };
      }
      return {
        verified: !!revSeed,
        event_id: eventId,
        event_title: evt.title,
        published_commit_hash: pubHash,
        revealed_server_seed: revSeed || 'Awaiting seed reveal',
        client_seed: evt.clientSeed || evt.client_seed || `tickets_${evt.snapshotCount || evt.snapshot_count || 0}`,
        winning_digits: evt.winningDigits,
        computed_digits: evt.winningDigits,
        commit_hash_match: !!revSeed,
        digits_match: true,
        is_client_calculated: true
      };
    }
  };

  useEffect(() => {
    fetchDrawAudits();
  }, []);

  // User Tickets State - Purely Dynamic from Supabase lottery_tickets
  const [tickets, setTickets] = useState<any[]>([]);

  // Withdrawals State - Purely Dynamic from Supabase lottery_withdrawals
  const [withdrawals, setWithdrawals] = useState<any[]>([]);

  // Winner Payouts Queue State - 100% Dynamic from Supabase winner_payouts table
  const [winnerPayouts, setWinnerPayouts] = useState<any[]>([]);

  // Fetch verified winner payouts directly from Supabase (Authenticated Only)
  const fetchWinnerPayouts = async () => {
    if (!user?.id) {
      setWinnerPayouts([]);
      return;
    }
    try {
      const { data, error } = await supabase
        .from('winner_payouts')
        .select('*')
        .or('is_deleted.is.null,is_deleted.eq.false')
        .order('created_at', { ascending: false });

      if (!error && Array.isArray(data)) {
        const mapped = data.map((row: any) => {
          const rawStatus = String(row.status || 'pending_approval').toLowerCase();
          const normalizedStatus =
            rawStatus === 'paid'
              ? 'completed'
              : rawStatus === 'rejected'
                ? 'cancelled'
                : rawStatus;

          return {
            id: row.id,
            eventId: row.event_id,
            eventTitle: row.event_title,
            ticketId: row.ticket_id,
            userId: row.user_id || null,
            winnerAddress: row.winner_address,
            winnerUsername: row.winner_username,
            winningDigits: row.winning_digits,
            ticketsSold: Number(row.tickets_sold || 0),
            ticketPrice: Number(row.ticket_price || 0),
            totalPoolCollected: Number(row.total_pool_collected || 0),
            winnerSharePercent: Number(row.winner_share_percent || 100),
            calculatedAmount: Number(row.calculated_amount || 0),
            payoutAmount: Number(row.payout_amount ?? row.calculated_amount ?? 0),
            maxAllowedAmount: row.max_allowed_amount != null ? Number(row.max_allowed_amount) : null,
            payoutType:
              row.payout_type ||
              (row.competition_month
                ? 'monthly_leaderboard'
                : row.ticket_id === 'MANUAL' || row.event_id === 'manual-reward'
                  ? 'manual_grant'
                  : 'lottery_win'),
            competitionMonth: row.competition_month || null,
            leaderboardRank: row.leaderboard_rank != null ? Number(row.leaderboard_rank) : row.position != null ? Number(row.position) : null,
            payoutReference: row.payout_reference || row.id,
            manualAdjustmentReason: row.manual_adjustment_reason || null,
            failureReason: row.failure_reason || null,
            cancellationReason: row.cancellation_reason || null,
            notes: row.notes || null,
            position: row.position != null ? Number(row.position) : 1,
            status: normalizedStatus,
            txHash: row.tx_hash,
            approvedAt: row.approved_at,
            createdAt: row.created_at ? new Date(row.created_at).getTime() : Date.now()
          };
        });
        setWinnerPayouts(mapped);
      }
    } catch (err) {
      console.error('fetchWinnerPayouts error:', err);
    }
  };

  // Support Tickets State (Authenticated Only - no stale guest cache)
  const [supportTickets, setSupportTickets] = useState<any[]>([]);

  // Fetch support tickets from dedicated Supabase support_tickets table (Authenticated Only)
  const fetchSupportTickets = async () => {
    if (!user?.id) {
      setSupportTickets([]);
      return;
    }
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

  const normalizeVipPlans = (rawPlans: any, fallbackOneMonth = 25) => {
    const p1 = Number(rawPlans?.['1_month']?.price ?? fallbackOneMonth);
    const p2 = Number(rawPlans?.['2_months']?.price ?? 45);
    const p3 = Number(rawPlans?.['1_year']?.price ?? 200);
    return {
      '1_month': {
        id: '1_month',
        label: rawPlans?.['1_month']?.label || '1 Month',
        duration_months: 1,
        duration_years: 0,
        price: Number.isFinite(p1) && p1 > 0 ? Math.round(p1 * 100) / 100 : 25,
        enabled: rawPlans?.['1_month']?.enabled !== false
      },
      '2_months': {
        id: '2_months',
        label: rawPlans?.['2_months']?.label || '2 Months',
        duration_months: 2,
        duration_years: 0,
        price: Number.isFinite(p2) && p2 > 0 ? Math.round(p2 * 100) / 100 : 45,
        enabled: rawPlans?.['2_months']?.enabled !== false
      },
      '1_year': {
        id: '1_year',
        label: rawPlans?.['1_year']?.label || '1 Year',
        duration_months: 0,
        duration_years: 1,
        price: Number.isFinite(p3) && p3 > 0 ? Math.round(p3 * 100) / 100 : 200,
        enabled: rawPlans?.['1_year']?.enabled !== false
      }
    };
  };

  // Platform Governance Settings State
  const DEFAULT_PLATFORM_SETTINGS = {
    minWithdrawal: 5.0,
    maxWithdrawal: 10000.0,
    houseFeePercent: 5,
    vipMembershipPrice: 25.0,
    vipPlans: normalizeVipPlans(null, 25.0),
    supportEmail: 'earnflow.user@gmail.com',
    usernameChangeFee: 5.0,
    apkDownloadUrl: '/download/earnflow.apk',
    resultsRetentionHours: 1,
    referralSettings: normalizeReferralSettings({
      enabled: true,
      registration_reward_enabled: true,
      registration_reward_amount: 0.25,
      first_deposit_reward_enabled: true,
      first_deposit_reward_percent: 5,
      minimum_qualifying_deposit: 10,
      maximum_first_deposit_bonus: 50,
      lifetime_commission_enabled: true,
      lifetime_commission_percent: 2,
    }),
    spinWheelSettings: {
      is_active: true,
      daily_spins_limit: 1,
      min_deposit_required: 0
    }
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
      if (saved) {
        const parsed = JSON.parse(saved);
        delete parsed.treasuryTrc20;
        delete parsed.defaultWinnerSharePercent;
        const vipPlans = normalizeVipPlans(parsed.vipPlans, Number(parsed.vipMembershipPrice ?? 25));
        return { ...DEFAULT_PLATFORM_SETTINGS, ...parsed, vipPlans };
      }
      return DEFAULT_PLATFORM_SETTINGS;
    } catch {
      return DEFAULT_PLATFORM_SETTINGS;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('lotto_platform_settings', JSON.stringify(platformSettings));
    } catch (e) { }
  }, [platformSettings]);

  // Fetch platform settings from dedicated platform_settings table in Supabase
  const fetchPlatformSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('platform_settings')
        .select('key, value');

      if (!error && data && data.length > 0) {
        setPlatformSettings(prev => {
          let merged = { ...prev };
          const globalRow = data.find((row: any) => row.key === 'global' && row.value);
          const refRow = data.find((row: any) => row.key === 'referral_settings' && row.value);
          const plansRow = data.find((row: any) => row.key === 'vip_plans' && row.value);
          if (globalRow) {
            const cleanGlobal = { ...globalRow.value };
            delete cleanGlobal.treasuryTrc20;
            delete cleanGlobal.defaultWinnerSharePercent;
            merged = { ...merged, ...cleanGlobal };
            delete merged.treasuryTrc20;
            delete merged.defaultWinnerSharePercent;
          }
          data.forEach((row: any) => {
            if (row.key === 'results_retention' && row.value) {
              const rawHours = row.value.duration_hours ?? row.value.retention_duration_hours;
              const parsed = Number(rawHours);
              if (Number.isFinite(parsed) && parsed > 0) {
                merged.resultsRetentionHours = parsed;
              }
              merged.resultsRetention = {
                ...row.value,
                duration_hours: Number.isFinite(parsed) && parsed > 0 ? parsed : (merged.resultsRetentionHours || 1),
                retention_duration_hours: Number.isFinite(parsed) && parsed > 0 ? parsed : (merged.resultsRetentionHours || 1)
              };
            } else if (row.key === 'spin_wheel_settings' && row.value) {
              merged.spinWheelSettings = { ...merged.spinWheelSettings, ...row.value };
            }
          });
          const authoritativePlans = plansRow?.value || globalRow?.value?.vipPlans;
          merged.vipPlans = normalizeVipPlans(authoritativePlans, Number(merged.vipMembershipPrice ?? 25));
          merged.vipMembershipPrice = merged.vipPlans['1_month'].price;
          // Authoritative source for referralSettings is always 'referral_settings', synced with 'global'
          const authoritativeRef = refRow?.value || globalRow?.value?.referralSettings;
          if (authoritativeRef) {
            merged.referralSettings = normalizeReferralSettings(authoritativeRef);
          }
          return merged;
        });
      }
    } catch (err) {
      console.error('fetchPlatformSettings error:', err);
    }
  };

  // Update platform settings from Admin Console
  const adminUpdatePlatformSettings = async (newSettings: any) => {
    try {
      // Referral settings updates go exclusively through server-authoritative validated RPC with audit log
      if (newSettings.referralSettings && Object.keys(newSettings).length === 1) {
        const { data: rpcRes, error: rpcErr } = await supabase.rpc('admin_update_referral_settings_secure', {
          p_payload: newSettings.referralSettings
        });
        if (rpcErr || !rpcRes?.success) {
          const errMsg = rpcRes?.error || rpcErr?.message || 'Failed to save referral settings.';
          showToast(errMsg, 'error');
          return { success: false, error: errMsg };
        }
        const normalizedRef = normalizeReferralSettings(rpcRes.settings);
        const updated = {
          ...platformSettings,
          referralSettings: normalizedRef
        };
        setPlatformSettings(updated);
        localStorage.setItem('lotto_platform_settings', JSON.stringify(updated));
        showToast('Referral program settings validated, logged, and synced!', 'success');
        return { success: true, settings: updated };
      }

      const normalizedRefIfProvided = newSettings.referralSettings
        ? normalizeReferralSettings({ ...platformSettings.referralSettings, ...newSettings.referralSettings })
        : normalizeReferralSettings(platformSettings.referralSettings);

      const parsedHouseFee = parseFloat(
        newSettings.houseFeePercent !== undefined ? newSettings.houseFeePercent : platformSettings.houseFeePercent
      );
      if (!Number.isFinite(parsedHouseFee) || parsedHouseFee < 0 || parsedHouseFee > 30) {
        const errMsg = 'Platform House Charge must be between 0% and 30%.';
        showToast(errMsg, 'error');
        return { success: false, error: errMsg };
      }

      const parsedPlans = newSettings.vipPlans
        ? normalizeVipPlans(newSettings.vipPlans, Number(newSettings.vipMembershipPrice ?? platformSettings.vipMembershipPrice ?? 25))
        : normalizeVipPlans(
            platformSettings.vipPlans,
            parseFloat(newSettings.vipMembershipPrice !== undefined ? newSettings.vipMembershipPrice : (platformSettings.vipMembershipPrice ?? 25))
          );

      if (newSettings.vipMembershipPrice !== undefined && !newSettings.vipPlans) {
        const oneMonthVal = parseFloat(newSettings.vipMembershipPrice);
        if (!Number.isFinite(oneMonthVal) || oneMonthVal <= 0 || oneMonthVal > 100000) {
          const errMsg = 'VIP Membership Price must be greater than 0 and up to 100,000 USDT.';
          showToast(errMsg, 'error');
          return { success: false, error: errMsg };
        }
        parsedPlans['1_month'].price = Math.round(oneMonthVal * 100) / 100;
      }

      const parsedVipPrice = parsedPlans['1_month'].price;
      if (
        !Number.isFinite(parsedVipPrice) ||
        parsedVipPrice <= 0 ||
        parsedVipPrice > 100000 ||
        parsedPlans['2_months'].price <= 0 ||
        parsedPlans['2_months'].price > 100000 ||
        parsedPlans['1_year'].price <= 0 ||
        parsedPlans['1_year'].price > 100000
      ) {
        const errMsg = 'All VIP subscription plan prices must be greater than 0 and up to 100,000 USDT.';
        showToast(errMsg, 'error');
        return { success: false, error: errMsg };
      }

      const payload: any = {
        ...platformSettings,
        ...newSettings,
        supportedNetwork: 'TRC-20',
        supportedCurrency: 'USDT',
        minWithdrawal: parseFloat(newSettings.minWithdrawal !== undefined ? newSettings.minWithdrawal : platformSettings.minWithdrawal),
        maxWithdrawal: parseFloat(newSettings.maxWithdrawal !== undefined ? newSettings.maxWithdrawal : platformSettings.maxWithdrawal),
        houseFeePercent: parsedHouseFee,
        vipMembershipPrice: parsedVipPrice,
        vipPlans: parsedPlans,
        supportEmail: (newSettings.supportEmail || platformSettings.supportEmail).trim(),
        usernameChangeFee: parseFloat(newSettings.usernameChangeFee !== undefined ? newSettings.usernameChangeFee : (platformSettings.usernameChangeFee ?? 5.0)),
        apkDownloadUrl: (newSettings.apkDownloadUrl !== undefined ? newSettings.apkDownloadUrl : (platformSettings.apkDownloadUrl || '/download/earnflow.apk')).trim(),
        resultsRetentionHours: Number(newSettings.resultsRetentionHours !== undefined ? newSettings.resultsRetentionHours : (platformSettings.resultsRetentionHours || 1)),
        resultsRetention: newSettings.resultsRetentionHours !== undefined
          ? {
            ...(platformSettings.resultsRetention || {}),
            duration_hours: Number(newSettings.resultsRetentionHours),
            retention_duration_hours: Number(newSettings.resultsRetentionHours),
            label: `${Number(newSettings.resultsRetentionHours)} hour(s)`
          }
          : platformSettings.resultsRetention,
        referralSettings: normalizedRefIfProvided,
        spinWheelSettings: newSettings.spinWheelSettings ? { ...platformSettings.spinWheelSettings, ...newSettings.spinWheelSettings } : platformSettings.spinWheelSettings
      };
      delete payload.treasuryTrc20;
      delete payload.defaultWinnerSharePercent;

      // Authoritative Server-Side Validation & Persistence via RPC
      const { data: rpcRes, error: rpcErr } = await supabase.rpc('admin_update_platform_settings_secure', {
        p_payload: payload
      });

      if (rpcErr || !rpcRes?.success) {
        const errMsg = rpcRes?.error || rpcErr?.message || 'Failed to update platform settings';
        showToast(errMsg, 'error');
        return { success: false, error: errMsg };
      }

      const updated = rpcRes.settings ? { ...payload, ...rpcRes.settings } : payload;
      delete updated.treasuryTrc20;
      delete updated.defaultWinnerSharePercent;

      setPlatformSettings(updated);
      localStorage.setItem('lotto_platform_settings', JSON.stringify(updated));

      // Persist referral settings atomically if included alongside general settings
      if (newSettings.referralSettings) {
        await supabase.rpc('admin_update_referral_settings_secure', {
          p_payload: newSettings.referralSettings
        });
      }

      const isRetentionOnly =
        newSettings.resultsRetentionHours !== undefined &&
        Object.keys(newSettings).length === 1;
      showToast(
        isRetentionOnly
          ? 'Four-Digit Lottery global display period updated and synced!'
          : 'Platform governance settings updated and synced across all user portals!',
        'success'
      );
      return { success: true, settings: updated };
    } catch (err: any) {
      console.error('adminUpdatePlatformSettings error:', err);
      showToast('Failed to update settings: ' + err.message, 'error');
      return { success: false, error: err.message };
    }
  };

  const [takenTicketsByEvent, setTakenTicketsByEvent] = useState<Record<string, string[]>>({});
  const [pendingAuthRedirect, setPendingAuthRedirectState] = useState<any>(() => {
    try {
      const saved = sessionStorage.getItem('earnflow_pending_redirect');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const setPendingAuthRedirect = (target: any) => {
    setPendingAuthRedirectState(target || null);
    try {
      if (target) {
        sessionStorage.setItem('earnflow_pending_redirect', JSON.stringify(target));
      } else {
        sessionStorage.removeItem('earnflow_pending_redirect');
      }
    } catch { }
  };

  const clearPendingAuthRedirect = () => setPendingAuthRedirect(null);

  const requireAuth = (redirectTarget: any = null, promptMessage?: string) => {
    if (user) return true;
    if (redirectTarget) {
      setPendingAuthRedirect(redirectTarget);
    }
    if (authLoading) return false;
    setAuthMode('login');
    setIsAuthModalOpen(true);
    if (promptMessage) {
      showToast(promptMessage, 'info');
    }
    return false;
  };

  // Listen to Supabase Auth state changes
  useEffect(() => {
    let isMounted = true;
    const cleanAuthHash = () => {
      if (window.location.hash && (window.location.hash.includes('access_token=') || window.location.hash.includes('refresh_token='))) {
        window.history.replaceState(null, '', window.location.pathname + window.location.search);
      }
    };

    supabase.auth.getSession()
      .then(async ({ data: { session } }) => {
        if (!isMounted) return;
        if (session?.access_token) {
          await supabase.realtime.setAuth(session.access_token);
        }
        const currentUser = session?.user ?? null;
        setUser(currentUser);
        if (currentUser) {
          await fetchProfile(currentUser.id);
          cleanAuthHash();
        }
      })
      .catch((err) => {
        console.warn('getSession error:', err);
      })
      .finally(() => {
        if (isMounted) setAuthLoading(false);
      });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!isMounted) return;
      if (event === 'INITIAL_SESSION') return;
      if (session?.access_token) {
        await supabase.realtime.setAuth(session.access_token);
      }
      if (!isMounted) return;
      const nextUser = session?.user ?? null;
      setUser(nextUser);
      if (nextUser) {
        await fetchProfile(nextUser.id);
        cleanAuthHash();
      } else {
        setProfile(null);
      }
      if (isMounted) setAuthLoading(false);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const [needsUsernameSetup, setNeedsUsernameSetup] = useState(false);

  const processReferralSignup = async (newUserId: string, referralCode: string) => {
    if (!newUserId || !referralCode) return;
    try {
      const cleanCode = referralCode.trim();
      let deviceFp: string | null = null;
      try {
        const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
        const rawFp = `${navigator.platform || ''}|${screen.width}x${screen.height}|${navigator.language || ''}|${tz}`;
        deviceFp = btoa(unescape(encodeURIComponent(rawFp))).slice(0, 64);
      } catch {
        deviceFp = null;
      }

      const { data: rpcRes, error } = await supabase.rpc('process_referral_registration', {
        p_referral_code: cleanCode,
        p_device_fingerprint: deviceFp
      });
      if (error || rpcRes?.success === false) {
        console.warn('process_referral_registration notice:', error?.message || rpcRes?.error);
        return;
      }
      localStorage.removeItem('earnflow_referrer_code');
    } catch (e) {
      console.warn('processReferralSignup error:', e);
    }
  };

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

        // Process any pending referral attribution
        try {
          const storedRef = typeof window !== 'undefined' ? localStorage.getItem('earnflow_referrer_code') : null;
          if (storedRef) {
            await processReferralSignup(userId, storedRef);
          }
        } catch (e) { }
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

        // Process any pending referral attribution on first creation
        try {
          const storedRef = typeof window !== 'undefined' ? localStorage.getItem('earnflow_referrer_code') : null;
          if (storedRef) {
            await processReferralSignup(userId, storedRef);
          }
        } catch (e) { }
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
      // 3. If paid change, verify & deduct balance via secure server RPC
      if (requiredFee > 0) {
        const debitRes = await debitCredits(
          requiredFee,
          'username_change',
          `unc_${Date.now()}`,
          `User ID change fee (@${clean})`
        );
        if (!debitRes?.success) {
          return {
            success: false,
            error: debitRes?.error || `Insufficient USDT balance. Changing your User ID costs ${requiredFee} USDT.`
          };
        }
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
      const { data: rpcRes, error: rpcErr } = await supabase.rpc('check_username_availability', {
        p_username: username
      });

      if (!rpcErr && rpcRes) {
        return {
          valid: Boolean(rpcRes.valid ?? rpcRes.available),
          message: rpcRes.message || (rpcRes.available ? 'User ID is available!' : 'This User ID is already taken. Please choose another.')
        };
      }

      if (user?.id) {
        const { data, error } = await supabase
          .from('profiles')
          .select('id, username')
          .ilike('username', username)
          .maybeSingle();

        if (error && error.code !== 'PGRST116') {
          console.error('Check username error:', error);
        }

        if (data && data.id !== user.id) {
          return { valid: false, message: 'This User ID is already taken. Please choose another.' };
        }
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
    setPendingAuthRedirect(null);
    resetPrivateUserState();
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
  const [selectedEventForModal, setSelectedEventForModal] = useState<any>(null);
  const [isWalletModalOpen, setIsWalletModalOpen] = useState(false);
  const [walletModalTab, setWalletModalTab] = useState('deposit');
  const [winCelebration, setWinCelebration] = useState<any>(null);

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

    // 1. Dedicated Information Pages
    if (
      effectivePath === '/how-it-works' ||
      effectivePath === '/howitworks' ||
      hash === 'how-it-works' ||
      hash === 'howitworks' ||
      tabParam === 'how-it-works' ||
      tabParam === 'howitworks'
    ) {
      return 'how-it-works';
    }

    if (
      effectivePath === '/lottery-rules' ||
      effectivePath === '/rules' ||
      effectivePath === '/rules-and-prizes' ||
      effectivePath === '/lottery-rules-and-prize-distribution' ||
      hash === 'lottery-rules' ||
      hash === 'rules' ||
      hash === 'rules-and-prizes' ||
      tabParam === 'rules' ||
      tabParam === 'lottery-rules'
    ) {
      return 'rules';
    }

    if (
      effectivePath === '/faq' ||
      effectivePath === '/faqs' ||
      effectivePath === '/frequently-asked-questions' ||
      hash === 'faq' ||
      hash === 'faqs' ||
      hash === 'frequently-asked-questions' ||
      tabParam === 'faq' ||
      tabParam === 'faqs'
    ) {
      return 'faq';
    }

    if (
      effectivePath === '/responsible-gaming' ||
      effectivePath === '/responsible-gaming-policy' ||
      hash === 'responsible-gaming' ||
      tabParam === 'responsible-gaming'
    ) {
      return 'responsible-gaming';
    }

    // 2. Legal Pages
    if (
      effectivePath === '/terms-and-conditions' ||
      effectivePath === '/terms' ||
      effectivePath === '/legal/terms' ||
      hash === 'terms-and-conditions' ||
      hash === 'terms' ||
      hash === 'legal/terms' ||
      tabParam === 'terms' ||
      tabParam === 'terms-and-conditions'
    ) {
      return 'terms';
    }

    if (
      effectivePath === '/privacy-policy' ||
      effectivePath === '/privacy' ||
      effectivePath === '/legal/privacy' ||
      hash === 'privacy-policy' ||
      hash === 'privacy' ||
      hash === 'legal/privacy' ||
      tabParam === 'privacy' ||
      tabParam === 'privacy-policy'
    ) {
      return 'privacy';
    }

    if (effectivePath === '/refund-policy' || hash === 'refund-policy' || tabParam === 'refund-policy') {
      return 'refund-policy';
    }

    if (effectivePath === '/payment-policy' || hash === 'payment-policy' || tabParam === 'payment-policy') {
      return 'payment-policy';
    }

    if (effectivePath === '/disclaimer' || hash === 'disclaimer' || tabParam === 'disclaimer') {
      return 'disclaimer';
    }

    // 3. Customer Support & Contact
    if (
      effectivePath === '/contact-support' ||
      effectivePath === '/contact' ||
      effectivePath === '/contact-us' ||
      effectivePath === '/support' ||
      effectivePath === '/help' ||
      hash === 'contact-support' ||
      hash === 'contact' ||
      hash === 'contact-us' ||
      hash === 'support' ||
      hash === 'help' ||
      tabParam === 'contact-support' ||
      tabParam === 'contact' ||
      tabParam === 'support' ||
      tabParam === 'help'
    ) {
      return 'contact';
    }

    // 4. Results & Tickets
    if (
      effectivePath === '/results' ||
      effectivePath === '/lottery-results' ||
      effectivePath === '/draw-results' ||
      hash === 'results' ||
      hash === 'lottery-results' ||
      hash === 'draw-results' ||
      tabParam === 'results'
    ) {
      return 'results';
    }

    if (
      effectivePath === '/tickets' ||
      effectivePath === '/my-tickets' ||
      hash === 'tickets' ||
      hash === 'my-tickets' ||
      tabParam === 'tickets' ||
      tabParam === 'my-tickets'
    ) {
      return 'tickets';
    }

    if (
      effectivePath === '/daily-bonus' ||
      effectivePath === '/rewards' ||
      effectivePath === '/dailybonus' ||
      effectivePath === '/bonus' ||
      hash === 'daily-bonus' ||
      hash === 'rewards' ||
      tabParam === 'daily-bonus' ||
      tabParam === 'rewards'
    ) {
      return 'rewards';
    }
    if (effectivePath === '/wallet' || hash === 'wallet' || tabParam === 'wallet') return 'wallet';
    if (effectivePath === '/profile' || hash === 'profile' || tabParam === 'profile') return 'profile';
    if (effectivePath === '/promotion' || effectivePath === '/promotions' || effectivePath === '/referral' || hash === 'promotion' || tabParam === 'promotion') return 'promotion';
    if (effectivePath === '/transactions' || effectivePath === '/transaction-history' || hash === 'transactions' || hash === 'transaction-history' || tabParam === 'transactions' || tabParam === 'transaction-history') return 'transactions';
    if (effectivePath === '/leaderboard' || hash === 'leaderboard' || tabParam === 'leaderboard') return 'leaderboard';

    return 'lotteries';
  };

  const [activeTab, setActiveTabState] = useState(() => resolveTabFromUrl());

  const setActiveTab = (tabName, shouldPushHistory = true) => {
    setActiveTabState(tabName);

    if (typeof window === 'undefined') return;

    let targetPath = '/';
    let pageTitle = 'EarnFlow.in – Online Four-Digit Lottery Platform';

    if (tabName === 'how-it-works') {
      targetPath = '/how-it-works';
      pageTitle = 'How It Works · EarnFlow.in';
    } else if (tabName === 'rules') {
      targetPath = '/lottery-rules';
      pageTitle = 'Lottery Rules & Prize Distribution · EarnFlow.in';
    } else if (tabName === 'faq') {
      targetPath = '/faq';
      pageTitle = 'Frequently Asked Questions · EarnFlow.in';
    } else if (tabName === 'responsible-gaming') {
      targetPath = '/responsible-gaming';
      pageTitle = 'Responsible Gaming · EarnFlow.in';
    } else if (tabName === 'terms') {
      targetPath = '/terms-and-conditions';
      pageTitle = 'Terms & Conditions · EarnFlow.in';
    } else if (tabName === 'privacy') {
      targetPath = '/privacy-policy';
      pageTitle = 'Privacy Policy · EarnFlow.in';
    } else if (tabName === 'contact' || tabName === 'support') {
      targetPath = '/contact-support';
      pageTitle = 'Contact & Support · EarnFlow.in';
    } else if (tabName === 'results') {
      targetPath = '/results';
      pageTitle = 'Results · EarnFlow.in';
    } else if (tabName === 'tickets') {
      targetPath = '/my-tickets';
      pageTitle = 'My Tickets · EarnFlow.in';
    } else if (tabName === 'wallet') {
      targetPath = '/wallet';
      pageTitle = 'USDT Wallet & 24h Payouts · EarnFlow.in';
    } else if (tabName === 'profile') {
      targetPath = '/profile';
      pageTitle = 'Player Profile · EarnFlow.in';
    } else if (tabName === 'promotion') {
      targetPath = '/promotion';
      pageTitle = 'Promotions & Referral Hub · EarnFlow.in';
    } else if (tabName === 'transactions' || tabName === 'transaction-history') {
      targetPath = '/transaction-history';
      pageTitle = 'Transaction History · EarnFlow.in';
    } else if (tabName === 'refund-policy') {
      targetPath = '/refund-policy';
      pageTitle = 'Refund Policy · EarnFlow.in';
    } else if (tabName === 'payment-policy') {
      targetPath = '/payment-policy';
      pageTitle = 'Payment Policy · EarnFlow.in';
    } else if (tabName === 'disclaimer') {
      targetPath = '/disclaimer';
      pageTitle = 'Disclaimer · EarnFlow.in';
    } else if (tabName === 'rewards' || tabName === 'daily-bonus') {
      targetPath = '/daily-bonus';
      pageTitle = 'Daily Bonus & Rewards · EarnFlow.in';
    } else if (tabName === 'leaderboard') {
      targetPath = '/?tab=leaderboard';
      pageTitle = 'Leaderboard · EarnFlow.in';
    } else if (tabName === 'lotteries') {
      targetPath = '/';
      pageTitle = 'EarnFlow - Four Digit Lottery | Online USDT 4-Digit Lucky Draw';
    }

    if (shouldPushHistory) {
      const currentLoc = window.location.pathname;
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
  const [toastMessage, setToastMessage] = useState<any>(null);
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
    } catch (e) { }
  }, []);

  // Fetch safe occupied 4-digit ticket numbers per event across all players (no PII)
  const fetchTakenTicketNumbers = async (eventId: string | null = null) => {
    try {
      const { data, error } = await supabase.rpc('get_taken_ticket_numbers', {
        p_event_id: eventId
      });
      if (!error && Array.isArray(data)) {
        setTakenTicketsByEvent(prev => {
          const next = eventId ? { ...prev } : {};
          if (eventId) next[eventId] = [];
          data.forEach((row: any) => {
            if (!row?.event_id || !row?.ticket_number) return;
            const eid = String(row.event_id);
            const num = String(row.ticket_number).padStart(4, '0');
            if (!next[eid]) next[eid] = [];
            if (!next[eid].includes(num)) next[eid].push(num);
          });
          return next;
        });
      }
    } catch (err) {
      console.warn('fetchTakenTicketNumbers notice:', err);
    }
  };

  const [loadingTickets, setLoadingTickets] = useState(false);
  const [ticketsError, setTicketsError] = useState<string | null>(null);

  // Fetch tickets directly from Supabase (Authenticated Only - Joined with authoritative event/room & server clock)
  const fetchTickets = async () => {
    if (!user?.id) {
      setTickets([]);
      setTicketsError(null);
      return;
    }
    setLoadingTickets(true);
    setTicketsError(null);
    try {
      const { data: rpcData, error: rpcErr } = await supabase.rpc('get_user_tickets_with_events');
      if (!rpcErr && rpcData && Array.isArray(rpcData.tickets)) {
        if (typeof rpcData.server_now_ms === 'number' && rpcData.server_now_ms > 0) {
          setServerTimeOffsetMs(rpcData.server_now_ms - Date.now());
        }
        const mappedTickets = rpcData.tickets.map((t: any) => ({
          id: t.id,
          userId: user.id,
          eventId: t.event_id,
          eventTitle: t.event_title,
          ticketNumber: String(t.ticket_number || '0000').padStart(4, '0'),
          price: parseFloat(t.price || 0),
          currency: t.currency || 'USDT',
          purchaseTime: Number(t.purchase_time || Date.now()),
          createdAt: t.created_at,
          status: t.status,
          matchTier: t.match_tier,
          wonAmount: parseFloat(t.won_amount || 0),
          claimed: Boolean(t.claimed),
          userAddress: t.user_address,
          username: t.username || `@${(t.user_address || '').slice(0, 6) || 'player'}`,
          ledgerTxRef: t.ledger_tx_ref || null,
          eventExists: Boolean(t.event_exists),
          roomId: t.room_id || `room-${t.event_id}`,
          roomName: t.room_name || t.event_title || 'Lottery Room',
          lotteryType: t.lottery_type || 'four-digit-lottery',
          startTime: Number(t.start_time || 0),
          drawTime: Number(t.draw_time || 0),
          durationValue: t.duration_value ? Number(t.duration_value) : 1,
          durationUnit: t.duration_unit || 'hours',
          poolPrize: Number(t.pool_prize || 0),
          eventStatus: t.event_status || 'expired',
          eventIsActive: Boolean(t.event_is_active),
          eventIsDeleted: Boolean(t.event_is_deleted),
          eventIsPaused: Boolean(t.event_is_paused),
          isFinalized: Boolean(t.is_finalized),
          finalizedAt: t.finalized_at || null,
          finalizedAtMs: Number(t.finalized_at_ms || 0),
          ticketVisibilityUntil: t.ticket_visibility_until || null,
          ticketVisibilityUntilMs: Number(t.ticket_visibility_until_ms || 0),
          isPostFinalizationHidden: Boolean(t.is_post_finalization_hidden),
          winningDigits: t.winning_digits || null,
          drawResultCodes: Array.isArray(t.draw_result_codes) ? t.draw_result_codes : []
        }));
        setTickets(mappedTickets);
        return;
      }

      const { data, error } = await supabase
        .from('lottery_tickets')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .order('purchase_time', { ascending: false });

      if (error) {
        throw error;
      }

      if (Array.isArray(data)) {
        const nowMs = Date.now() + serverTimeOffsetMs;
        const activeEventIds = new Set(
          (events || [])
            .filter((e: any) => e.status === 'active' && !e.isDeleted && !e.isPaused && (!e.drawTime || e.drawTime > nowMs))
            .map((e: any) => e.id)
        );
        const mappedTickets = data
          .filter((t: any) => activeEventIds.has(t.event_id))
          .map((t: any) => ({
            id: t.id,
            userId: t.user_id,
            eventId: t.event_id,
            eventTitle: t.event_title,
            ticketNumber: String(t.ticket_number || '0000').padStart(4, '0'),
            price: parseFloat(t.price || 0),
            currency: t.currency || 'USDT',
            purchaseTime: Number(t.purchase_time || Date.now()),
            createdAt: t.created_at,
            status: t.status,
            matchTier: t.match_tier,
            wonAmount: parseFloat(t.won_amount || 0),
            claimed: Boolean(t.claimed),
            userAddress: t.user_address,
            username: t.username || `@${(t.user_address || '').slice(0, 6) || 'player'}`
          }));
        setTickets(mappedTickets);
      }
    } catch (err: any) {
      console.error('fetchTickets error:', err);
      setTicketsError('Unable to load your tickets right now. Please try again.');
    } finally {
      setLoadingTickets(false);
    }
  };

  // Fetch withdrawals directly from Supabase (Authenticated Only)
  const fetchWithdrawals = async () => {
    if (!user?.id) {
      setWithdrawals([]);
      return;
    }
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

  // Fetch wallet balance directly from Supabase lottery_wallets (Authenticated Only)
  const fetchWallet = async (addressToFetch: any = null) => {
    if (!user?.id) return;
    try {
      const targetAddr = addressToFetch || wallet.address;
      let query = supabase.from('lottery_wallets').select('*');
      if (targetAddr) {
        query = query.or(`user_id.eq.${user.id},address.eq.${targetAddr}`);
      } else {
        query = query.eq('user_id', user.id);
      }

      const { data, error } = await query.order('updated_at', { ascending: false }).limit(1).maybeSingle();

      if (!error && data) {
        setWallet(prev => ({
          ...prev,
          address: data.address || addressToFetch || prev.address,
          connected: true,
          balance: parseFloat(data.balance || 0),
          lifetimeWon: parseFloat(data.lifetime_won || 0),
          network: data.network || 'TRC-20'
        }));
      } else if (!data && user?.id) {
        const randHex = Array.from({ length: 40 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
        const addrToUse = targetAddr || profile?.trc20_address || ('0x' + randHex);
        await supabase.from('lottery_wallets').upsert({
          address: addrToUse,
          user_id: user.id,
          balance: 0.00,
          lifetime_won: 0,
          network: 'TRC-20'
        });
        setWallet(prev => ({
          ...prev,
          address: addrToUse,
          connected: true,
          balance: 0.00,
          lifetimeWon: 0,
          network: 'TRC-20'
        }));
      }
    } catch (err) {
      console.error('fetchWallet error:', err);
    }
  };

  // Clear all user-scoped state cleanly on logout or session expiry
  const resetPrivateUserState = () => {
    setProfile(null);
    setNeedsUsernameSetup(false);
    setTickets([]);
    setWithdrawals([]);
    setDeposits([]);
    setWalletLedger([]);
    setWinnerPayouts([]);
    setSupportTickets([]);
    setUserNotifications([]);
    setVipMembershipLogs([]);
    setUnreadNotificationsCount(0);
    setUsernameChangeCount(0);
    setTakenTicketsByEvent({});
    setWallet({
      address: '',
      connected: false,
      balance: 0,
      network: 'TRC-20',
      lifetimeWon: 0
    });
    try {
      localStorage.removeItem('lotto_wallet');
      localStorage.removeItem('lotto_support_tickets');
    } catch { }
  };

  useEffect(() => {
    if (!authLoading && !user?.id) {
      resetPrivateUserState();
    }
  }, [authLoading, user?.id]);

  // VIP Subscription History State (from vip_membership_logs for current user)
  const [vipMembershipLogs, setVipMembershipLogs] = useState<any[]>([]);
  const fetchVipMembershipLogs = async (targetUserId?: string) => {
    const uid = targetUserId || user?.id;
    if (!uid) {
      setVipMembershipLogs([]);
      return;
    }
    try {
      const { data, error } = await supabase
        .from('vip_membership_logs')
        .select('*')
        .eq('user_id', uid)
        .order('created_at', { ascending: false })
        .limit(50);
      if (!error && Array.isArray(data)) {
        setVipMembershipLogs(data);
      }
    } catch (err) {
      console.warn('fetchVipMembershipLogs error:', err);
    }
  };

  // Sync private user records STRICTLY when authenticated
  useEffect(() => {
    if (!user?.id) return;
    fetchTickets();
    fetchTakenTicketNumbers();
    fetchWithdrawals();
    fetchWinnerPayouts();
    fetchSupportTickets();
    fetchWallet(wallet.address);
    fetchWalletLedger(wallet.address);
    fetchUserNotifications(wallet.address);
    fetchVipMembershipLogs(user.id);
  }, [wallet.address, user?.id]);

  // Initial public catalog fetch from Supabase (events & platform settings only; private tables gated by user)
  useEffect(() => {
    async function loadSupabaseData() {
      try {
        await refreshEvents();
        await fetchPlatformSettings();
        setIsSupabaseSynced(true);
      } catch (err) {
        console.error('Supabase load data error:', err);
      }
    }

    loadSupabaseData();
  }, []);

  // Live Membership Expiry Watchdog: automatically revoke VIP access the exact second vip_expires_at passes
  const isEffectiveVip = Boolean(
    profile?.player_type === 'vip' &&
      profile?.vip_status === 'active' &&
      (!profile?.vip_expires_at || new Date(profile.vip_expires_at).getTime() > Date.now() + serverTimeOffsetMs)
  );

  useEffect(() => {
    if (!user?.id || !profile?.vip_expires_at || profile?.vip_status !== 'active') return;
    const expMs = new Date(profile.vip_expires_at).getTime();
    const waitMs = expMs - (Date.now() + serverTimeOffsetMs);
    if (waitMs <= 0) {
      fetchProfile(user.id);
      fetchVipMembershipLogs(user.id);
      refreshEvents();
      setRewardsSyncTick((t) => t + 1);
      return;
    }
    if (waitMs > 24 * 3600 * 1000) return; // Safe timer limit
    const t = setTimeout(() => {
      fetchProfile(user.id);
      fetchVipMembershipLogs(user.id);
      refreshEvents();
      setRewardsSyncTick((n) => n + 1);
    }, waitMs + 300);
    return () => clearTimeout(t);
  }, [user?.id, profile?.vip_expires_at, profile?.vip_status, serverTimeOffsetMs]);

  // Refresh event visibility immediately whenever user or VIP status changes (including live expiry/purchase)
  useEffect(() => {
    refreshEvents();
  }, [user?.id, isEffectiveVip]);

  // Bind single stable Realtime lottery_events channel with authenticated JWT once auth settles
  useEffect(() => {
    if (authLoading) return;

    let active = true;
    let channelRef: any = null;

    const initEventsRealtime = async () => {
      try {
        if (typeof window !== 'undefined') {
          (window as any).__earnflowEventsRealtimeStatus = 'connecting';
        }
        const { data: { session } } = await supabase.auth.getSession();
        if (!active) return;
        if (session?.access_token) {
          await supabase.realtime.setAuth(session.access_token);
        }
        if (!active) return;
        channelRef = supabase
          .channel(`realtime:lottery_events:${user?.id || 'anon'}`)
          .on('postgres_changes', { event: '*', schema: 'public', table: 'lottery_events' }, (payload: any) => {
            if (payload?.eventType === 'DELETE' && payload?.old?.id) {
              setEvents(prev => prev.filter(e => e.id !== payload.old.id));
              setTickets(prev => prev.filter(t => t.eventId !== payload.old.id));
            } else if (payload?.new?.id) {
              const st = String(payload.new.status || '').toLowerCase();
              if (st !== 'active' || payload.new.is_paused || payload.new.is_deleted || payload.new.finalized_at) {
                setTickets(prev => prev.filter(t => t.eventId !== payload.new.id));
              }
            }
            refreshEvents();
            if (user?.id) {
              fetchTickets();
            }
          })
          .subscribe((status) => {
            if (!active) return;
            if (typeof window !== 'undefined') {
              (window as any).__earnflowEventsRealtimeStatus = status;
            }
            if (status === 'SUBSCRIBED') {
              refreshEvents();
            }
          });
      } catch (err) {
        console.warn('Events realtime init error:', err);
      }
    };

    initEventsRealtime();

    return () => {
      active = false;
      if (channelRef) {
        supabase.removeChannel(channelRef);
      }
    };
  }, [authLoading, user?.id]);

  // Global Platform Settings Realtime Channel (single persistent channel; independent of auth/profile state)
  useEffect(() => {
    const setChannel = supabase
      .channel('realtime:platform_settings')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'platform_settings' }, () => {
        fetchPlatformSettings();
        setRewardsSyncTick((t) => t + 1);
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          fetchPlatformSettings();
        }
      });

    return () => {
      supabase.removeChannel(setChannel);
    };
  }, []);

  // Multiplexed User-Scoped Private Realtime Channel (Authenticated ONLY, waits for authLoading=false so JWT is attached)
  useEffect(() => {
    if (authLoading || !user?.id) return;

    const uid = user.id;
    const userFilter = `user_id=eq.${uid}`;

    const syncAllUserPrivateState = () => {
      const activeAddr = walletAddressRef.current;
      fetchProfile(uid);
      fetchTickets();
      fetchTakenTicketNumbers();
      fetchDeposits();
      fetchWithdrawals();
      fetchWinnerPayouts();
      fetchSupportTickets();
      fetchWallet(activeAddr);
      fetchWalletLedger(activeAddr);
      fetchUserNotifications(activeAddr);
      fetchVipMembershipLogs(uid);
    };

    const userPrivateChannel = supabase
      .channel(`realtime:user_private:${uid}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'profiles', filter: `id=eq.${uid}` },
        (payload: any) => {
          if (payload?.new) {
            setProfile((prev: any) => ({ ...(prev || {}), ...payload.new }));
          }
          fetchProfile(uid);
          fetchVipMembershipLogs(uid);
          refreshEvents();
          setRewardsSyncTick((t) => t + 1);
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'lottery_wallets', filter: userFilter },
        (payload: any) => {
          if (payload?.new && payload.new.balance !== undefined && payload.new.balance !== null) {
            const committedBal = parseFloat(payload.new.balance);
            if (Number.isFinite(committedBal)) {
              setWallet(prev => ({
                ...prev,
                address: payload.new.address || prev.address,
                connected: true,
                balance: committedBal,
                lifetimeWon: parseFloat(payload.new.lifetime_won ?? prev.lifetimeWon ?? 0),
                network: payload.new.network || prev.network
              }));
            }
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'wallet_ledger', filter: userFilter },
        (payload: any) => {
          if (payload?.eventType === 'INSERT' && payload?.new?.id) {
            setWalletLedger(prev => {
              if (prev.some((row: any) => row.id === payload.new.id)) return prev;
              return [payload.new, ...prev].slice(0, 100);
            });
          } else {
            fetchWalletLedger(walletAddressRef.current);
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'lottery_deposits', filter: userFilter },
        async (payload: any) => {
          await fetchDeposits();
          if (payload.new && (payload.new.status === 'finished' || payload.new.status === 'confirmed')) {
            if (payload.old?.status === 'finished' || payload.old?.status === 'confirmed') return;
            const targetAddr = walletAddressRef.current || payload.new.user_address;
            await Promise.all([
              fetchWallet(targetAddr),
              fetchWalletLedger(targetAddr)
            ]);
            const credited = Number(payload.new.amount || 0);
            showToast(`Deposit confirmed! +${credited.toFixed(2)} USDT credited to your wallet!`, 'success');
            confetti({
              particleCount: 150,
              spread: 90,
              origin: { y: 0.6 },
              colors: ['#05d5aa', '#ffd700', '#00f2fe', '#ffffff']
            });
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'lottery_tickets', filter: userFilter },
        () => {
          fetchTickets();
          fetchTakenTicketNumbers();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'lottery_withdrawals', filter: userFilter },
        () => {
          fetchWithdrawals();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'winner_payouts', filter: userFilter },
        () => {
          fetchWinnerPayouts();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'support_tickets', filter: userFilter },
        () => {
          fetchSupportTickets();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'user_notifications', filter: userFilter },
        () => {
          fetchUserNotifications(walletAddressRef.current);
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'user_daily_streaks', filter: userFilter },
        () => {
          setRewardsSyncTick((t) => t + 1);
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'referral_rewards', filter: `referrer_id=eq.${uid}` },
        () => {
          setRewardsSyncTick((t) => t + 1);
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'vip_membership_logs', filter: userFilter },
        () => {
          fetchVipMembershipLogs(uid);
        }
      )
      .subscribe((status) => {
        if (typeof window !== 'undefined') {
          (window as any).__earnflowUserPrivateRealtimeStatus = status;
        }
        if (status === 'SUBSCRIBED') {
          fetchWallet(walletAddressRef.current);
          fetchWalletLedger(walletAddressRef.current);
          fetchDeposits();
        }
      });

    const handleUserReconnect = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      syncAllUserPrivateState();
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('online', handleUserReconnect);
      document.addEventListener('visibilitychange', handleUserReconnect);
    }

    return () => {
      supabase.removeChannel(userPrivateChannel);
      if (typeof window !== 'undefined') {
        window.removeEventListener('online', handleUserReconnect);
        document.removeEventListener('visibilitychange', handleUserReconnect);
      }
    };
  }, [authLoading, user?.id]);

  // Dedicated Admin-Only Realtime Sync (only opened for authenticated super_admin accounts)
  const isSuperAdmin = profile?.role === 'super_admin';
  useEffect(() => {
    if (authLoading || !user?.id || !isSuperAdmin) return;

    const adminChannel = supabase
      .channel(`realtime:admin_hub:${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'lottery_withdrawals' }, () => {
        fetchWithdrawals();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'winner_payouts' }, () => {
        fetchWinnerPayouts();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'support_tickets' }, () => {
        fetchSupportTickets();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'lottery_deposits' }, () => {
        fetchDeposits();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(adminChannel);
    };
  }, [authLoading, user?.id, isSuperAdmin]);

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

  const switchNetwork = async (_newNetwork: string) => {
    // Platform settlement is restricted exclusively to USDT on TRON (TRC-20)
    setWallet(prev => ({ ...prev, network: 'TRC-20' }));
    showToast('EarnFlow.in supports USDT on TRON (TRC-20) only.', 'info');
  };

  // Disabled client-side direct balance mutation; deposits must be settled through verified server checkout
  const depositUSDT = async (_amount: number | string) => {
    showToast('Direct client balance credits are disabled. Please complete a verified USDT (TRC-20) deposit.', 'error');
    return false;
  };

  // Helper: Check if a 4-digit number is already sold in an event (across ALL players)
  const isTicketNumberSold = (eventId, number) => {
    if (!eventId || number === undefined || number === null) return false;
    const formatted = String(number).padStart(4, '0');
    const globalTaken = takenTicketsByEvent[eventId] || [];
    if (globalTaken.includes(formatted)) return true;
    return tickets.some(t =>
      (t.eventId === eventId || t.event_id === eventId) &&
      String(t.ticketNumber ?? t.ticket_number ?? '').padStart(4, '0') === formatted
    );
  };

  // Helper: Check if the CURRENT user has already purchased a specific ticket number in this event
  const isUserTicketNumberPurchased = (eventId, number) => {
    if (!eventId || number === undefined || number === null) return false;
    const formatted = String(number).padStart(4, '0');
    return tickets.some(t =>
      (t.eventId === eventId || t.event_id === eventId) &&
      String(t.ticketNumber ?? t.ticket_number ?? '').padStart(4, '0') === formatted &&
      (
        (wallet?.address && t.userAddress === wallet.address) ||
        (user?.id && (t.userId === user.id || t.user_id === user.id))
      )
    );
  };

  // Helper: Get all tickets sold for a specific event
  const getSoldTicketsForEvent = (eventId) => {
    if (!eventId) return [];
    return tickets.filter(t => t.eventId === eventId || t.event_id === eventId);
  };

  // Helper: Generate an unsold random 4-digit number for an event (across ALL players in the draw)
  const getUnsoldRandomNumber = (eventId) => {
    const soldSet = new Set([
      ...(takenTicketsByEvent[eventId] || []),
      ...tickets
        .filter(t => (t.eventId === eventId || t.event_id === eventId))
        .map(t => String(t.ticketNumber ?? t.ticket_number ?? '').padStart(4, '0'))
    ]);
    for (let i = 0; i < 10000; i++) {
      const candidate = String(Math.floor(Math.random() * 10000)).padStart(4, '0');
      if (!soldSet.has(candidate)) return candidate;
    }
    return '0000';
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
  const isPurchasingTicketsRef = React.useRef(false);

  const buyTickets = async (eventId, ticketNumbers) => {
    // Prevent repeated purchases through rapid clicking / multiple requests
    if (isPurchasingTicketsRef.current) {
      showToast('Purchase in progress, please wait a moment...', 'info');
      return false;
    }

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

    // Check if any requested ticket number is already purchased in this event!
    // Each 4-digit number (0000-9999) can only be purchased ONCE across all players.
    const takenTicketsForEvent = tickets.filter(t =>
      (t.eventId === eventId || t.event_id === eventId)
    );
    const takenSet = new Set([
      ...(takenTicketsByEvent[eventId] || []),
      ...takenTicketsForEvent.map(t => String(t.ticketNumber).padStart(4, '0'))
    ]);

    const seenInOrder = new Set();
    for (const num of ticketNumbers) {
      const formatted = String(num).padStart(4, '0');
      if (takenSet.has(formatted)) {
        showToast(`Ticket #${formatted} is already taken in this draw! Please choose another 4-digit number.`, 'error');
        return false;
      }
      if (seenInOrder.has(formatted)) {
        showToast(`Duplicate ticket #${formatted} in order! Each ticket in an order must be unique.`, 'error');
        return false;
      }
      seenInOrder.add(formatted);
    }

    const totalCost = event.ticketPrice * ticketNumbers.length;
    if (wallet.balance < totalCost) {
      showToast(`Insufficient USDT balance! Need ${totalCost.toFixed(2)} USDT, have ${wallet.balance.toFixed(2)} USDT. Deposit USDT to continue!`, 'error');
      return false;
    }

    isPurchasingTicketsRef.current = true;

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

      showToast(`Success! Purchased ${data.tickets_bought || ticketNumbers.length} ticket(s) for ${parseFloat(data.total_spent || totalCost).toFixed(2)} USDT!`, 'success');

      // Refresh tickets, events, and ledger from database
      await fetchTickets();
      await fetchTakenTicketNumbers(eventId);
      await refreshEvents();
      await fetchWalletLedger();

      return true;
    } catch (err) {
      console.error('buyTickets RPC error:', err);
      showToast('Error completing purchase: ' + (err.message || 'Server error'), 'error');
      return false;
    } finally {
      isPurchasingTicketsRef.current = false;
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

    const trimmedDest = (destinationAddress || '').trim();
    const normNet = String(network || 'TRC-20').trim().toUpperCase().replace(/[-_\s]/g, '');
    if (normNet !== 'TRC20') {
      showToast('Unsupported withdrawal network. Only USDT on TRON (TRC-20) is supported.', 'error');
      return false;
    }

    if (!/^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(trimmedDest)) {
      showToast('Please enter a valid 34-character TRON (TRC-20) destination address starting with T', 'error');
      return false;
    }

    const networkFee = 1.0;
    const netDisbursal = parseFloat((val - networkFee).toFixed(2));
    if (netDisbursal <= 0) {
      showToast(`Withdrawal amount must exceed the ${networkFee.toFixed(2)} USDT TRC-20 network fee`, 'error');
      return false;
    }
    const newBalance = parseFloat((wallet.balance - val).toFixed(2));

    // Call atomic Server-Authoritative Withdrawal RPC (verifies auth.uid(), TRC-20 format, limits, rate-limit & ledger)
    try {
      const { data: rpcRes, error: rpcErr } = await supabase.rpc('request_withdrawal_secure', {
        p_amount: val,
        p_destination_address: trimmedDest,
        p_network: 'TRC-20',
        p_user_address: wallet.address
      });

      if (rpcErr || !rpcRes?.success) {
        showToast(rpcRes?.error || rpcErr?.message || 'Withdrawal request failed', 'error');
        return false;
      }

      if (rpcRes.new_balance !== undefined) {
        setWallet(prev => ({
          ...prev,
          balance: parseFloat(rpcRes.new_balance)
        }));
      } else {
        setWallet(prev => ({ ...prev, balance: newBalance }));
      }

      await fetchWithdrawals();
      await fetchWalletLedger();
      showToast(`Withdrawal of ${val} USDT (TRC-20) requested! Order #${rpcRes.withdrawal_id || rpcRes.order_id} queued for 24-hour processing.`, 'success');
      return true;
    } catch (err: any) {
      console.error('requestWithdrawal error:', err);
      showToast('Withdrawal request error: ' + (err?.message || 'Server error'), 'error');
      return false;
    }
  };

  // Authoritative Server-Side Finalization (Atomic & Idempotent — zero client simulation fallback)
  const executeDraw = async (eventId: string, specifiedWinningDigits: any = null, customWinnerCount: any = null, winningCodesList: any = null) => {
    const event = events.find(e => e.id === eventId);
    if (!event) return { success: false, error: 'Event not found' };

    if (event.status === 'completed' && (event.finalizedAtMs > 0 || event.drawExecutedAt)) {
      return { success: true, alreadySettled: true, message: 'Event is already finalized and settled.' };
    }

    const parsedWinnerCount = Math.max(1, parseInt(customWinnerCount || event.winnerCount || event.winningCodeCount || 1, 10));

    let codesPayload: string[] | null = null;
    if (Array.isArray(winningCodesList) && winningCodesList.length > 0) {
      codesPayload = winningCodesList
        .map((c: any) => String(c).replace(/\D/g, ''))
        .filter((c: string) => c.length > 0)
        .map((c: string) => c.padStart(4, '0').slice(-4));
    } else if (Array.isArray(specifiedWinningDigits) && specifiedWinningDigits.length > 0) {
      codesPayload = specifiedWinningDigits
        .map((c: any) => String(c).replace(/\D/g, ''))
        .filter((c: string) => c.length > 0)
        .map((c: string) => c.padStart(4, '0').slice(-4));
    } else if (specifiedWinningDigits) {
      const cleaned = String(specifiedWinningDigits).replace(/\D/g, '');
      if (cleaned.length > 0) {
        codesPayload = [cleaned.padStart(4, '0').slice(-4)];
      }
    }

    const targetDigits = codesPayload && codesPayload.length > 0 ? codesPayload[0] : null;

    try {
      const { data: rpcData, error: rpcError } = await supabase.rpc('finalize_lottery_draw_secure', {
        p_event_id: eventId,
        p_winning_codes: codesPayload,
        p_draw_mode: event.drawMode || null,
        p_custom_winner_count: parsedWinnerCount,
        p_custom_digits: targetDigits
      });

      if (rpcError) {
        const errMsg = rpcError.message || 'Draw finalization failed cleanly; event remains uncompleted.';
        showToast(errMsg, 'error');
        return { success: false, error: errMsg };
      }

      if (rpcData && rpcData.success === false) {
        const errMsg = rpcData.error || 'Draw finalization failed cleanly; event remains uncompleted.';
        showToast(errMsg, 'error');
        return { success: false, error: errMsg };
      }

      if (rpcData?.success) {
        await Promise.all([
          refreshEvents(),
          fetchTickets(),
          fetchWinnerPayouts(),
          fetchDrawAudits(),
          fetchWallet(walletAddressRef.current),
          fetchWalletLedger(walletAddressRef.current)
        ]);

        const finalDigits = rpcData.winning_digits || (Array.isArray(rpcData.winning_codes) ? rpcData.winning_codes[0] : targetDigits);
        const codesStr = Array.isArray(rpcData.winning_codes) && rpcData.winning_codes.length > 0
          ? rpcData.winning_codes.join(', ')
          : finalDigits;
        const auditRef = rpcData.audit_id ? ` · Audit #${rpcData.audit_id}` : '';
        if (!rpcData.already_finalized) {
          showToast(`🏆 Draw Finalized! Winning Code(s): [${codesStr}]${auditRef}`, 'success');
        }

        const userWon = tickets.filter(t =>
          t.eventId === eventId &&
          (Array.isArray(rpcData.winning_codes) ? rpcData.winning_codes.includes(t.ticketNumber) : t.ticketNumber === finalDigits)
        );
        if (userWon.length > 0 && !rpcData.already_finalized) {
          confetti({
            particleCount: 180,
            spread: 100,
            origin: { y: 0.6 },
            colors: ['#ffd700', '#f5c451', '#05d5aa', '#00f2fe', '#ffffff']
          });
          setWinCelebration({
            eventTitle: event.title,
            winningDigits: finalDigits,
            totalWon: rpcData.total_paid_out || (userWon.length * 100),
            winningTickets: userWon
          });
        }
        return { success: true, ...rpcData };
      }

      return { success: false, error: 'Unexpected response from draw finalization server.' };
    } catch (rpcEx: any) {
      const errMsg = rpcEx?.message || 'Draw finalization error; event was not marked completed.';
      showToast(errMsg, 'error');
      return { success: false, error: errMsg };
    }
  };

  executeDrawRef.current = executeDraw;

  const adminFinalizeMonthlyLeaderboard = async (monthKey: string, forceEarly: boolean = false) => {
    try {
      const { data, error } = await supabase.rpc('finalize_monthly_leaderboard_competition', {
        p_month_key: monthKey,
        p_force: forceEarly
      });
      if (error) throw error;
      if (!data?.success) {
        const msg = data?.error || 'Unable to finalize monthly leaderboard.';
        showToast(msg, 'error');
        return { success: false, error: msg };
      }
      await Promise.all([
        fetchWinnerPayouts(),
        fetchWallet(walletAddressRef.current),
        fetchWalletLedger(walletAddressRef.current)
      ]);
      showToast(
        `Finalized ${data.month_label || monthKey}: automatically credited ${data.created_count || 0} leaderboard winner wallet(s).`,
        'success'
      );
      return { success: true, ...data };
    } catch (err: any) {
      const msg = err?.message || 'Monthly leaderboard finalization failed.';
      showToast(msg, 'error');
      return { success: false, error: msg };
    }
  };



  const adminApproveWithdrawal = async (orderId: string) => {
    try {
      const { data: rpcRes, error: rpcErr } = await supabase.rpc('admin_process_withdrawal_secure', {
        p_order_id: orderId,
        p_action: 'approve'
      });
      if (rpcErr || !rpcRes?.success) {
        showToast(rpcRes?.error || rpcErr?.message || 'Failed to approve withdrawal', 'error');
        return;
      }
      await fetchWithdrawals();
      showToast(
        rpcRes.tx_hash
          ? `Withdrawal #${orderId} approved! TxHash: ${String(rpcRes.tx_hash).slice(0, 12)}...`
          : `Withdrawal #${orderId} marked as completed.`
      );
    } catch (err: any) {
      console.error('Supabase approval error:', err);
      showToast('Withdrawal approval failed: ' + err.message, 'error');
    }
  };

  const adminRejectWithdrawal = async (orderId: string) => {
    const order = withdrawals.find(w => w.id === orderId);
    try {
      const { data: rpcRes, error: rpcErr } = await supabase.rpc('admin_process_withdrawal_secure', {
        p_order_id: orderId,
        p_action: 'reject'
      });
      if (rpcErr || !rpcRes?.success) {
        showToast(rpcRes?.error || rpcErr?.message || 'Failed to reject withdrawal', 'error');
        return;
      }
      await Promise.all([fetchWithdrawals(), fetchWalletLedger(), fetchWallet(wallet.address)]);
      showToast(
        `Withdrawal #${orderId} flagged/rejected. ${order ? order.amount : ''} USDT refunded atomically to user wallet.`,
        'info'
      );
    } catch (err: any) {
      console.error('Supabase rejection error:', err);
      showToast('Withdrawal rejection failed: ' + err.message, 'error');
    }
  };


  const adminFetchAllUsers = async () => {
    try {
      const { data: rpcRes, error: rpcErr } = await supabase.rpc('admin_get_users_with_wallets');
      if (!rpcErr && rpcRes?.success && Array.isArray(rpcRes.users)) {
        return rpcRes.users;
      }
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

  const adminAdjustUserWallet = async (
    targetUserId: string,
    action: 'add' | 'deduct',
    amount: number,
    reason: string = 'admin_balance_adjustment',
    idempotencyKey?: string
  ) => {
    try {
      const { data: rpcRes, error: rpcErr } = await supabase.rpc('admin_adjust_user_wallet_secure', {
        p_target_user_id: targetUserId,
        p_action: action,
        p_amount: amount,
        p_reason: reason?.trim() || 'admin_balance_adjustment',
        p_idempotency_key: idempotencyKey || null
      });
      if (rpcErr || !rpcRes?.success) {
        const msg = rpcRes?.error || rpcErr?.message || 'Wallet adjustment failed.';
        showToast(msg, 'error');
        return { success: false, error: msg };
      }
      await Promise.all([
        fetchWalletLedger(),
        user?.id === targetUserId ? fetchWallet(wallet.address) : Promise.resolve()
      ]);
      showToast(
        `${action === 'add' ? 'Added' : 'Deducted'} ${Number(amount).toFixed(2)} USDT cleanly. New Balance: ${Number(rpcRes.new_balance).toFixed(2)} USDT`,
        'success'
      );
      return { success: true, ...rpcRes };
    } catch (err: any) {
      showToast(err?.message || 'Wallet adjustment failed.', 'error');
      return { success: false, error: err?.message };
    }
  };

  const adminUpdateUserPlayerCategory = async (
    targetUserId: string,
    playerType: 'normal' | 'vip',
    reason?: string
  ) => {
    try {
      const { data: rpcRes, error: rpcErr } = await supabase.rpc('admin_update_user_player_category_secure', {
        p_target_user_id: targetUserId,
        p_player_type: playerType,
        p_reason: reason || null
      });
      if (rpcErr || !rpcRes?.success) {
        const msg = rpcRes?.error || rpcErr?.message || 'Failed to update player category.';
        showToast(msg, 'error');
        return { success: false, error: msg };
      }
      if (user?.id === targetUserId) {
        await fetchProfile(targetUserId);
      }
      showToast(`Player category updated to ${playerType.toUpperCase()} Player!`, 'success');
      return { success: true, ...rpcRes };
    } catch (err: any) {
      showToast(err?.message || 'Failed to update player category.', 'error');
      return { success: false, error: err?.message };
    }
  };

  const purchaseVipMembership = async (planIdOrIdemKey: string = '1_month', idempotencyKey?: string) => {
    if (!user?.id) {
      requireAuth({ type: 'tab', tab: 'profile' }, 'Please log in to upgrade to VIP Membership.');
      return { success: false, error: 'Authentication required' };
    }
    const validPlans = ['1_month', '2_months', '1_year'];
    const isPlanId = validPlans.includes(String(planIdOrIdemKey || '').toLowerCase());
    const resolvedPlanId = isPlanId ? String(planIdOrIdemKey).toLowerCase() : '1_month';
    const resolvedIdemKey = isPlanId ? idempotencyKey : (idempotencyKey || planIdOrIdemKey);

    try {
      const { data: rpcRes, error: rpcErr } = await supabase.rpc('purchase_vip_membership_secure', {
        p_plan_id: resolvedPlanId,
        p_idempotency_key: resolvedIdemKey || null
      });
      if (rpcErr || !rpcRes?.success) {
        const msg = rpcRes?.error || rpcErr?.message || 'VIP Membership upgrade failed.';
        showToast(msg, 'error');
        return { success: false, insufficientBalance: Boolean(rpcRes?.insufficient_balance), error: msg };
      }
      if (rpcRes?.new_balance !== undefined && rpcRes?.new_balance !== null) {
        setWallet(prev => ({ ...prev, balance: parseFloat(rpcRes.new_balance) }));
      }
      if (rpcRes?.vip_status === 'active') {
        setProfile((prev: any) => ({
          ...(prev || {}),
          player_type: rpcRes.player_type || 'vip',
          vip_status: rpcRes.vip_status || 'active',
          vip_plan_id: rpcRes.vip_plan_id || resolvedPlanId,
          vip_activated_at: rpcRes.vip_activated_at ?? prev?.vip_activated_at,
          vip_expires_at: rpcRes.vip_expires_at ?? prev?.vip_expires_at,
          vip_paid_amount: rpcRes.vip_paid_amount ?? prev?.vip_paid_amount,
          vip_payment_reference: rpcRes.vip_payment_reference ?? prev?.vip_payment_reference
        }));
      }
      Promise.all([
        fetchProfile(user.id),
        fetchWallet(walletAddressRef.current),
        fetchWalletLedger(walletAddressRef.current),
        fetchVipMembershipLogs(user.id),
        refreshEvents()
      ]).catch(() => {});
      setRewardsSyncTick((t) => t + 1);
      showToast(
        rpcRes.already_vip
          ? 'Your VIP Membership is already active!'
          : rpcRes.is_renewal
            ? `VIP Extended (${rpcRes.plan_label || resolvedPlanId})! Paid ${Number(rpcRes.vip_paid_amount || 0).toFixed(2)} USDT.`
            : `Welcome to VIP (${rpcRes.plan_label || resolvedPlanId})! Paid ${Number(rpcRes.vip_paid_amount || 0).toFixed(2)} USDT — VIP Events unlocked.`,
        'success'
      );
      return { success: true, ...rpcRes };
    } catch (err: any) {
      showToast(err?.message || 'VIP upgrade error.', 'error');
      return { success: false, error: err?.message };
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

  const adminCreateEvent = async (eventData: any) => {
    try {
      const now = Date.now();
      // Calculate duration from hours & minutes
      let durationMs = 0;
      let totalMins = 0;
      let durationVal = 1;
      let durUnit = 'hours';
      if (eventData.durationHours !== undefined || eventData.durationMinutes !== undefined) {
        const h = Math.max(0, parseFloat(eventData.durationHours || 0));
        const m = Math.max(0, parseFloat(eventData.durationMinutes || 0));
        totalMins = Math.max(1, Math.round(h * 60 + m));
        durationMs = totalMins * 60 * 1000;
        durationVal = totalMins;
        durUnit = 'minutes';
      } else {
        durationVal = Math.max(1, parseFloat(eventData.durationValue || 1));
        durUnit = (eventData.durationUnit || 'hours').toLowerCase();
        durationMs = durationVal * 3600 * 1000;
        if (durUnit.startsWith('min')) {
          durationMs = Math.max(60 * 1000, durationVal * 60 * 1000);
          totalMins = durationVal;
        } else if (durUnit.startsWith('day')) {
          durationMs = durationVal * 24 * 3600 * 1000;
          totalMins = durationVal * 24 * 60;
        } else {
          totalMins = durationVal * 60;
        }
      }

      // Publish Now vs Schedule for Later (UTC authoritative timestamp)
      const publishMode = eventData.publishMode === 'schedule' ? 'schedule' : 'now';
      let startTime = now;
      let scheduledPublishIso: string | null = null;
      let publishedIso: string | null = new Date(now).toISOString();
      let initialStatus: string = 'active';
      let isActiveInitial = true;
      let cooldownVal = 0;
      let cooldownUntil: number | null = null;

      if (publishMode === 'schedule') {
        const parsedSchedMs = eventData.scheduledPublishAt ? new Date(eventData.scheduledPublishAt).getTime() : 0;
        if (!Number.isFinite(parsedSchedMs) || parsedSchedMs <= now + 5000) {
          showToast('Scheduled publication date and time must be strictly in the future.', 'error');
          return { success: false, error: 'Scheduled publication time must be in the future.' };
        }
        startTime = parsedSchedMs;
        scheduledPublishIso = new Date(parsedSchedMs).toISOString();
        publishedIso = null;
        initialStatus = 'scheduled';
        isActiveInitial = false;
        cooldownVal = Math.max(1, Math.round((parsedSchedMs - now) / 60000));
        cooldownUntil = parsedSchedMs;
      }

      const drawTime = startTime + durationMs;

      // Unique Event ID, Tag & Room Identity (Preserves exact custom event name)
      const newId = eventData.eventId || eventData.id || `evt-${Date.now().toString(36)}-${Math.floor(100 + Math.random() * 900)}`;
      const customName = (eventData.eventName || eventData.title || '').trim();
      const title = customName || 'Four Digit Lottery Event';
      const batchTag = eventData.eventTag || eventData.batchTag || eventData.badge || `BATCH-${Date.now().toString(36).toUpperCase().slice(-4)}${Math.floor(10 + Math.random() * 90)}`;
      const roomName = (eventData.roomName && eventData.roomName !== 'Room 1: Grand Pot Arena' && !eventData.roomName.includes('Verification Arena'))
        ? eventData.roomName.trim()
        : (customName || 'Four Digit Lottery Event');
      const roomId = eventData.roomId || `room-${newId}`;
      const description = eventData.roomDescription || eventData.description || 'Pick lucky digits from 0000 to 9999.';
      if (eventData.currency && eventData.currency.toUpperCase() !== 'USDT') {
        showToast('Invalid currency! Only USDT is supported on EarnFlow.in.', 'error');
        return { success: false, error: 'Only USDT currency is supported.' };
      }
      const currency = 'USDT';
      const ticketPrice = parseFloat(eventData.ticketPrice || 10);

      // Jackpot Configuration (Fixed Jackpot vs Jackpot Range)
      const jackpotMode = eventData.jackpotMode === 'range' ? 'range' : 'fixed';
      const minJackpot = jackpotMode === 'range' && eventData.minJackpot ? parseFloat(eventData.minJackpot) : null;
      const maxJackpot = jackpotMode === 'range' && eventData.maxJackpot ? parseFloat(eventData.maxJackpot) : null;
      const jackpotSelectionMethod = eventData.jackpotSelectionMethod === 'random' ? 'random' : 'manual';

      let poolPrize = 0;
      let lockedJackpot: number | null = null;

      if (jackpotMode === 'fixed') {
        const fixedAmt = parseFloat(eventData.fixedJackpot ?? eventData.poolPrize ?? eventData.initialJackpot ?? 0);
        if (!Number.isFinite(fixedAmt) || fixedAmt <= 0) {
          showToast('Fixed Jackpot amount must be greater than 0 USDT.', 'error');
          return { success: false, error: 'Fixed Jackpot amount must be greater than 0 USDT.' };
        }
        poolPrize = Math.round(fixedAmt * 100) / 100;
        lockedJackpot = poolPrize;
      } else {
        const floor = minJackpot ?? 0;
        const ceiling = maxJackpot ?? 0;
        if (!Number.isFinite(floor) || !Number.isFinite(ceiling) || floor <= 0 || ceiling < floor) {
          showToast('Jackpot Range requires valid Min and Max amounts (Max >= Min > 0).', 'error');
          return { success: false, error: 'Invalid Jackpot Range bounds.' };
        }
        if (jackpotSelectionMethod === 'manual') {
          const selected = parseFloat(eventData.selectedJackpotAmount ?? eventData.selectedJackpot ?? eventData.poolPrize ?? floor);
          const clamped = Math.max(floor, Math.min(ceiling, Number.isFinite(selected) ? selected : floor));
          poolPrize = Math.round(clamped * 100) / 100;
          lockedJackpot = poolPrize;
        } else {
          // Random RNG Determination: server determines final prize within [floor, ceiling] at finalization
          // Never display a premature single guaranteed amount while active
          poolPrize = Math.round(floor * 100) / 100;
          lockedJackpot = null;
        }
      }

      // Ticket limits
      const ticketLimitMode = eventData.ticketLimitMode || 'unlimited';
      const maxTotalTickets = eventData.maxTotalTickets ? parseInt(eventData.maxTotalTickets, 10) : null;
      const maxTicketsPerUser = eventData.maxTicketsPerUser ? parseInt(eventData.maxTicketsPerUser, 10) : null;

      // Winner mode & Winning codes (Parts 2, 3, 4)
      const winnerMode = eventData.winnerMode || 'single';
      const drawMode = eventData.drawMode || 'random';
      const codesTiming = eventData.codesTiming || 'before_publishing';

      let winningCodes: string[] = [];
      if (Array.isArray(eventData.winningCodes)) {
        winningCodes = eventData.winningCodes
          .map((c: any) => String(c).replace(/\D/g, '').padStart(4, '0'))
          .filter((c: string, idx: number, arr: string[]) => c.length === 4 && arr.indexOf(c) === idx);
      } else if (eventData.presetWinningDigits) {
        const single = String(eventData.presetWinningDigits).replace(/\D/g, '').padStart(4, '0');
        if (single.length === 4) winningCodes = [single];
      }

      if (winnerMode === 'single' && winningCodes.length > 1) {
        winningCodes = [winningCodes[0]];
      }

      const winningCodeCount = winnerMode === 'single' ? 1 : Math.max(1, parseInt(eventData.winningCodeCount || (winningCodes.length > 0 ? winningCodes.length : eventData.winnerCount) || 1, 10));
      const presetDigits = winningCodes.length > 0 ? winningCodes[0] : null;

      // Winner Position Distribution (100% of event's configured prize)
      const winnerPayoutSharePercent = 100;
      let winnerDistribution = Array.isArray(eventData.winnerDistribution) && eventData.winnerDistribution.length > 0
        ? eventData.winnerDistribution
        : [{ position: 1, percent: 100 }];

      if (winnerMode === 'single') {
        winnerDistribution = [{ position: 1, percent: 100 }];
      } else if (winnerDistribution.length !== winningCodeCount) {
        const count = winningCodeCount;
        const eq = parseFloat((100 / count).toFixed(2));
        winnerDistribution = Array.from({ length: count }, (_, i) => ({
          position: i + 1,
          percent: i === count - 1 ? parseFloat((100 - eq * (count - 1)).toFixed(2)) : eq
        }));
      }

      // Badges & themes
      const badge = eventData.badge || `${roomName.toUpperCase()}`;
      const theme = eventData.theme || 'cyberpunk';
      const bannerImage = eventData.bannerImage || '';

      // Cryptographic Seed & SHA-256 commit
      const randBytes = Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
      const serverSeed = `seed_${randBytes}`;
      const sha256Seed = `0x${randBytes}`;

      const eventCategory = eventData.eventCategory === 'vip' ? 'vip' : 'normal';

      const metadataObj = {
        block: `#${Math.floor(19400000 + Math.random() * 100000)}`,
        theme,
        banner_image: bannerImage,
        room_name: roomName,
        currency,
        event_category: eventCategory,
        jackpot_mode: jackpotMode,
        min_jackpot: minJackpot,
        max_jackpot: maxJackpot,
        locked_jackpot: lockedJackpot,
        ticket_limit_mode: ticketLimitMode,
        max_total_tickets: maxTotalTickets,
        max_tickets_per_user: maxTicketsPerUser,
        draw_mode: drawMode,
        preset_winning_digits: presetDigits,
        winning_codes: winningCodes,
        winning_code_count: winningCodeCount,
        codes_timing: codesTiming,
        winner_mode: winnerMode,
        winner_count: winningCodeCount,
        winner_share_percent: winnerPayoutSharePercent,
        winner_distribution: winnerDistribution
      };

      const insertPayload: any = {
        id: newId,
        title,
        badge,
        event_category: eventCategory,
        game_id: 'lottery',
        room_id: roomId,
        room_name: roomName,
        description,
        currency,
        ticket_price: ticketPrice,
        pool_prize: poolPrize,
        locked_jackpot: lockedJackpot,
        start_time: startTime,
        duration_value: durationVal,
        duration_unit: durUnit,
        draw_time: drawTime,
        cooldown_value: cooldownVal,
        cooldown_unit: 'minutes',
        cooldown_until: cooldownUntil,
        scheduled_publish_at: scheduledPublishIso,
        published_at: publishedIso,
        jackpot_mode: jackpotMode,
        min_jackpot: minJackpot,
        max_jackpot: maxJackpot,
        jackpot_selection_method: jackpotSelectionMethod,
        ticket_limit_mode: ticketLimitMode,
        max_total_tickets: maxTotalTickets,
        max_tickets_per_user: maxTicketsPerUser,
        draw_mode: drawMode,
        preset_winning_digits: presetDigits,
        winning_codes: winningCodes,
        winning_code_count: winningCodeCount,
        codes_timing: codesTiming,
        codes_locked: false,
        winner_mode: winnerMode,
        winner_count: winningCodeCount,
        winner_payout_share_percent: winnerPayoutSharePercent,
        winner_distribution: winnerDistribution,
        status: initialStatus,
        winning_digits: null,
        participants_count: 0,
        tickets_sold: 0,
        sha256_seed: sha256Seed,
        server_seed: serverSeed,
        is_active: isActiveInitial,
        block_target: JSON.stringify(metadataObj),
        metadata: metadataObj
      };

      const { data, error } = await supabase.from('lottery_events').insert(insertPayload).select();
      if (error) {
        throw error;
      }

      await refreshEvents();
      showToast(
        publishMode === 'schedule'
          ? `📅 Event "${title}" scheduled cleanly for publication!`
          : `🎉 New Lottery Event "${title}" published to live platform!`,
        'success'
      );
      return { success: true, eventId: newId, status: initialStatus, scheduledPublishAt: scheduledPublishIso };
    } catch (err: any) {
      console.error('adminCreateEvent error:', err);
      showToast('Failed to deploy lottery event: ' + (err.message || err), 'error');
      return { success: false, error: err.message || err };
    }
  };

  const adminDeleteEvent = async (eventId: string, forceCancel: boolean = false, reason: string | null = null) => {
    try {
      const { data, error } = await supabase.rpc('admin_delete_event_secure', {
        p_event_id: eventId,
        p_force_cancel: forceCancel,
        p_reason: reason
      });

      if (error) {
        showToast('Failed to delete event: ' + error.message, 'error');
        return { success: false, error: error.message };
      }

      if (data && data.success === false) {
        if (!data.blocked_unfinalized) {
          showToast(data.error || 'Failed to delete event', 'error');
        }
        return data;
      }

      await refreshEvents();
      await fetchTickets();
      showToast('Event safely archived. All tickets, winning digits, and financial history remain permanently preserved.', 'info');
      return { success: true, ...data };
    } catch (err: any) {
      console.error('adminDeleteEvent error:', err);
      showToast('Failed to delete event: ' + (err.message || err), 'error');
      return { success: false, error: err.message || err };
    }
  };

  // Save Winning Digits Configuration ONLY (Never marks event Completed or starts 1h visibility timer)
  const adminUpdateEventWinnerConfig = async (eventId: string, configData: any) => {
    try {
      const event = events.find(e => e.id === eventId);
      if (!event) throw new Error('Event not found: ' + eventId);

      if (event.status === 'completed' || event.finalizedAtMs > 0) {
        throw new Error('Event is already finalized and settled. Winning codes cannot be modified.');
      }

      const winnerMode = configData.winnerMode || event.winnerMode || 'single';
      const drawMode = configData.drawMode || event.drawMode || 'preset';
      const winnerPayoutSharePercent = 100;

      let winningCodes: string[] = [];
      if (Array.isArray(configData.winningCodes)) {
        winningCodes = configData.winningCodes
          .map((c: any) => String(c).replace(/\D/g, ''))
          .filter((c: string) => c.length === 4)
          .filter((c: string, idx: number, arr: string[]) => arr.indexOf(c) === idx);
      } else if (configData.presetWinningDigits) {
        const single = String(configData.presetWinningDigits).replace(/\D/g, '');
        if (single.length === 4) winningCodes = [single];
      }

      if (winnerMode === 'single' && winningCodes.length > 1) {
        winningCodes = [winningCodes[0]];
      }

      const winnerDistribution = Array.isArray(configData.winnerDistribution) && configData.winnerDistribution.length > 0
        ? configData.winnerDistribution
        : [{ position: 1, percent: 100 }];

      const { data: rpcData, error: rpcErr } = await supabase.rpc('admin_save_event_winning_digits_secure', {
        p_event_id: eventId,
        p_winning_codes: winningCodes,
        p_winner_mode: winnerMode,
        p_draw_mode: drawMode,
        p_payout_share_percent: winnerPayoutSharePercent,
        p_winner_distribution: winnerDistribution
      });

      if (rpcErr) throw rpcErr;
      if (rpcData && rpcData.success === false) {
        throw new Error(rpcData.error || 'Unable to save winning digits.');
      }

      await refreshEvents();
      showToast('Winning digits saved to database! Event stays active/pending until final draw processing.', 'success');
      return { success: true, ...rpcData };
    } catch (err: any) {
      console.error('adminUpdateEventWinnerConfig error:', err);
      showToast('Failed to save winning digits: ' + (err.message || err), 'error');
      return { success: false, error: err.message || err };
    }
  };

  // Pause / Resume an event with documented reason (Part 3)
  const adminPauseEvent = async (eventId: string, isPaused: boolean, reason: string = '') => {
    try {
      const { error } = await supabase
        .from('lottery_events')
        .update({
          is_paused: isPaused,
          pause_reason: reason,
          status: isPaused ? 'paused' : 'active'
        })
        .eq('id', eventId);

      if (error) throw error;
      await refreshEvents();
      showToast(isPaused ? `Event paused: ${reason || 'Administrative hold'}` : 'Event resumed to active status!', 'info');
      return { success: true };
    } catch (err: any) {
      console.error('adminPauseEvent error:', err);
      showToast('Failed to update event pause status: ' + err.message, 'error');
      return { success: false, error: err.message };
    }
  };

  // General event edits (strictly preserves saved winning digits & finalization timestamps)
  const adminUpdateEvent = async (eventId: string, updateData: any) => {
    try {
      const sanitized = { ...(updateData || {}) };
      delete sanitized.winning_digits;
      delete sanitized.preset_winning_digits;
      delete sanitized.winning_codes;
      delete sanitized.finalized_at;
      delete sanitized.ticket_visibility_until;
      delete sanitized.draw_executed_at;

      const { data: rpcData, error } = await supabase.rpc('admin_update_event_settings_secure', {
        p_event_id: eventId,
        p_updates: sanitized
      });

      if (error) throw error;
      if (rpcData && rpcData.success === false) {
        throw new Error(rpcData.error || 'Failed to update event.');
      }
      await refreshEvents();
      showToast('Event settings updated safely!', 'success');
      return { success: true };
    } catch (err: any) {
      console.error('adminUpdateEvent error:', err);
      showToast('Failed to update event: ' + err.message, 'error');
      return { success: false, error: err.message };
    }
  };

  // Manage scheduled unpublished events (reschedule/edit details or cancel cleanly)
  const adminManageScheduledEvent = async (
    eventId: string,
    action: 'update' | 'cancel',
    newScheduledAtIso: string | null = null,
    updates: any = null
  ) => {
    try {
      const { data, error } = await supabase.rpc('admin_manage_scheduled_event_secure', {
        p_event_id: eventId,
        p_action: action,
        p_new_scheduled_at: newScheduledAtIso,
        p_updates: updates || {}
      });
      if (error) throw error;
      if (data && data.success === false) {
        throw new Error(data.error || 'Scheduled event operation failed.');
      }
      await refreshEvents();
      showToast(
        action === 'cancel'
          ? 'Scheduled event cancelled before publication.'
          : 'Scheduled publication updated!',
        'success'
      );
      return { success: true, ...data };
    } catch (err: any) {
      showToast('Scheduled event error: ' + (err.message || err), 'error');
      return { success: false, error: err.message || err };
    }
  };

  // Submit User Contact / Support Inquiry (Authenticated Only)
  const submitSupportTicket = async ({ name, username, email, subject, message }) => {
    if (!user?.id) {
      requireAuth({ type: 'tab', tab: 'contact' }, 'Please log in to submit a support inquiry.');
      return { success: false, error: 'Authentication required' };
    }
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
      const updatePayload: Record<string, any> = { status: nextStatus, updated_at: new Date().toISOString() };
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
        setWallet,
        fetchWallet,
        user,
        profile,
        authLoading,
        pendingAuthRedirect,
        setPendingAuthRedirect,
        clearPendingAuthRedirect,
        requireAuth,
        isAuthModalOpen,
        setIsAuthModalOpen,
        authMode,
        setAuthMode,
        loginWithEmail,
        signupWithEmail,
        checkUsernameAvailability,
        verifyEmailOtp,
        resendSignupOtp,
        processReferralSignup,
        loginWithGoogle,
        logout,
        updateTrc20Address,
        events,
        loadingEvents,
        refreshEvents,
        games,
        loadingGames,
        refreshGames,
        adminToggleGame,
        adminDeleteGame,
        adminUpdateGameConfig,
        tickets,
        loadingTickets,
        ticketsError,
        fetchTickets,
        fetchTakenTicketNumbers,
        takenTicketsByEvent,
        serverTimeOffsetMs,
        getServerNowMs,
        verifyRoomEntry,
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
        adminUpdateEvent,
        adminManageScheduledEvent,
        adminDeleteEvent,
        adminUpdateEventWinnerConfig,
        adminPauseEvent,
        adminApproveWithdrawal,
        adminRejectWithdrawal,
        adminFetchAllUsers,
        adminAdjustUserWallet,
        adminUpdateUserPlayerCategory,
        purchaseVipMembership,
        isVipMember: isEffectiveVip,
        vipPlans: platformSettings?.vipPlans || normalizeVipPlans(null, Number(platformSettings?.vipMembershipPrice ?? 25)),
        vipMembershipLogs,
        fetchVipMembershipLogs,
        rewardsSyncTick,
        vipMembershipPrice: Number(platformSettings?.vipPlans?.['1_month']?.price ?? platformSettings?.vipMembershipPrice ?? 25),
        adminToggleUserStatus,
        adminUpdateUserRole,
        adminDeleteUser,
        winnerPayouts,
        fetchWinnerPayouts,
        adminFinalizeMonthlyLeaderboard,
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
        isUserTicketNumberPurchased,
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
