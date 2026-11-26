import React, { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useSoundFX } from '../hooks/useSoundFX';
import { Trophy, RefreshCw, Crown, Megaphone } from 'lucide-react';

interface MonthlyAnnouncementPrize {
  rank: number;
  reward_usdt: number;
}

interface MonthlyStandingRow {
  rank: number;
  username: string | null;
  reward_usdt: number;
}

interface MonthlyLeaderboardAnnouncement {
  is_published: boolean;
  month_key?: string;
  month_label?: string;
  title?: string;
  description?: string;
  finalized?: boolean;
  prizes?: MonthlyAnnouncementPrize[];
  standings?: MonthlyStandingRow[];
}
import { LeaderboardEntry } from '../types/database';

const TIME_FILTERS = [
  { id: '24h', label: '24 Hours', days: 1 },
  { id: '7d', label: '1 Week', days: 7 },
  { id: '14d', label: '2 Weeks', days: 14 },
  { id: '21d', label: '3 Weeks', days: 21 },
  { id: '28d', label: '4 Weeks (1 Month)', days: 28 }
] as const;

type TimeFilterId = (typeof TIME_FILTERS)[number]['id'];

interface RpcLeaderboardRow {
  rank: number | string;
  username: string;
  total_won_usdt: number | string;
}

const RAW_HEX_REGEX = /^0x[0-9a-f]{16,}$/i;
const IGNORED_HANDLES = new Set(['player', 'anonymous', 'lucky winner', 'you']);

function normalizeHandle(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const cleaned = raw.trim().replace(/^@+/, '').trim();
  if (!cleaned || IGNORED_HANDLES.has(cleaned.toLowerCase()) || RAW_HEX_REGEX.test(cleaned)) {
    return null;
  }
  return cleaned;
}

function formatFallbackAddress(addr: string | null): string {
  if (!addr) return 'Player';
  return addr.length > 10 ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : addr;
}

/**
 * Fallback client aggregation matching the server `get_leaderboard_rankings` RPC
 * in case an un-migrated local/staging database lacks the RPC function.
 */
async function fetchLeaderboardFallback(days: number): Promise<LeaderboardEntry[]> {
  const nowMs = Date.now();
  const cutoffMs = nowMs - days * 24 * 60 * 60 * 1000;
  const cutoffIso = new Date(cutoffMs).toISOString();

  const [wpRes, ltRes, leRes, lwRes, profRes, grRes] = await Promise.all([
    supabase
      .from('winner_payouts')
      .select('id, event_id, ticket_id, user_id, winner_address, winner_username, payout_amount, payout_type, is_deleted, status, approved_at, created_at')
      .in('status', ['paid', 'approved', 'completed'])
      .or('payout_type.is.null,payout_type.eq.lottery_win')
      .or('is_deleted.is.null,is_deleted.eq.false')
      .gte('created_at', cutoffIso),
    supabase
      .from('lottery_tickets')
      .select('id, event_id, user_id, user_address, username, status, won_amount, purchase_time, created_at'),
    supabase
      .from('lottery_events')
      .select('id, status, draw_time, draw_executed_at'),
    supabase
      .from('lottery_wallets')
      .select('address, user_id'),
    supabase
      .from('profiles')
      .select('id, username, trc20_address'),
    supabase
      .from('game_rounds')
      .select('id, user_id, wallet_address, username, payout, status, created_at')
      .gte('created_at', cutoffIso)
  ]);

  const profileNameById = new Map<string, string>();
  const profileByAddr = new Map<string, { id: string; username: string | null }>();
  for (const p of profRes.data || []) {
    const cleanName = normalizeHandle(p.username);
    if (p.id && cleanName) profileNameById.set(p.id, cleanName);
    if (p.trc20_address) {
      profileByAddr.set(String(p.trc20_address).toLowerCase(), { id: p.id, username: cleanName });
    }
  }

  const walletUserByAddr = new Map<string, string>();
  for (const w of lwRes.data || []) {
    if (w.address && w.user_id) {
      walletUserByAddr.set(String(w.address).toLowerCase(), w.user_id);
    }
  }

  const eventMap = new Map<string, any>();
  for (const ev of leRes.data || []) {
    if (ev.id) eventMap.set(ev.id, ev);
  }

  const ticketById = new Map<string, any>();
  for (const lt of ltRes.data || []) {
    if (lt.id) ticketById.set(lt.id, lt);
  }

  const paidPayoutByTicket = new Map<string, number>();
  for (const wp of wpRes.data || []) {
    const ts = new Date(wp.approved_at || wp.created_at).getTime();
    if (wp.ticket_id && Number.isFinite(ts)) {
      const prev = paidPayoutByTicket.get(wp.ticket_id) || 0;
      if (ts > prev) paidPayoutByTicket.set(wp.ticket_id, ts);
    }
  }

  const resolveIdentity = (
    userId: string | null | undefined,
    addr: string | null | undefined,
    ...candidateNames: Array<string | null | undefined>
  ) => {
    const cleanAddr = typeof addr === 'string' && addr.trim() ? addr.trim() : null;
    const addrLower = cleanAddr ? cleanAddr.toLowerCase() : null;
    const profFromAddr = addrLower ? profileByAddr.get(addrLower) : undefined;
    const resolvedUid =
      userId || (addrLower ? walletUserByAddr.get(addrLower) : undefined) || profFromAddr?.id || null;

    let bestName: string | null = resolvedUid ? profileNameById.get(resolvedUid) || null : null;
    if (!bestName && profFromAddr?.username) bestName = profFromAddr.username;
    if (!bestName) {
      for (const candidate of candidateNames) {
        const clean = normalizeHandle(candidate);
        if (clean) {
          bestName = clean;
          break;
        }
      }
    }

    const userKey = resolvedUid
      ? resolvedUid
      : addrLower
      ? `addr:${addrLower}`
      : bestName
      ? `name:${bestName.toLowerCase()}`
      : null;

    return { userKey, cleanAddr, bestName };
  };

  interface EntryRecord {
    userKey: string;
    username: string | null;
    address: string | null;
    won: boolean;
    wonUsdt: number;
    winTs: number | null;
  }

  const userEntries = new Map<string, Map<string, EntryRecord>>();
  const upsertEntry = (
    userKey: string,
    entryRef: string,
    username: string | null,
    address: string | null,
    won: boolean,
    wonUsdt: number,
    ts: number
  ) => {
    let entries = userEntries.get(userKey);
    if (!entries) {
      entries = new Map();
      userEntries.set(userKey, entries);
    }
    const existing = entries.get(entryRef);
    if (!existing) {
      entries.set(entryRef, {
        userKey,
        username,
        address,
        won,
        wonUsdt,
        winTs: won ? ts : null
      });
    } else {
      existing.username = existing.username || username;
      existing.address = existing.address || address;
      existing.won = existing.won || won;
      existing.wonUsdt += wonUsdt;
      if (won && (existing.winTs === null || ts < existing.winTs)) {
        existing.winTs = ts;
      }
    }
  };

  const coveredTicketIds = new Set<string>();

  for (const wp of wpRes.data || []) {
    const payoutAmt = Number(wp.payout_amount || 0);
    const ts = new Date(wp.approved_at || wp.created_at).getTime();
    if (payoutAmt <= 0 || !Number.isFinite(ts) || ts < cutoffMs || ts > nowMs) continue;

    const linkedTicket = wp.ticket_id ? ticketById.get(wp.ticket_id) : null;
    const { userKey, cleanAddr, bestName } = resolveIdentity(
      wp.user_id || linkedTicket?.user_id,
      wp.winner_address || linkedTicket?.user_address,
      linkedTicket?.username,
      wp.winner_username
    );
    if (!userKey) continue;

    const cleanTicketId = wp.ticket_id && wp.ticket_id !== 'MANUAL' ? wp.ticket_id : null;
    if (cleanTicketId) coveredTicketIds.add(cleanTicketId);
    const entryRef = `lwin:${cleanTicketId || wp.id}`;
    upsertEntry(userKey, entryRef, bestName, cleanAddr, true, payoutAmt, ts);
  }

  for (const lt of ltRes.data || []) {
    const statusLower = String(lt.status || '').toLowerCase();
    const ev = lt.event_id ? eventMap.get(lt.event_id) : null;
    const evStatusLower = String(ev?.status || '').toLowerCase();
    const isSettled = statusLower === 'won' || statusLower === 'lost' || evStatusLower === 'completed';
    if (!isSettled) continue;

    const rawSettleTs =
      paidPayoutByTicket.get(lt.id) ??
      (ev?.draw_executed_at ? new Date(ev.draw_executed_at).getTime() : null) ??
      (ev?.draw_time && evStatusLower === 'completed' ? Number(ev.draw_time) : null) ??
      new Date(lt.created_at || lt.purchase_time || 0).getTime();

    if (!Number.isFinite(rawSettleTs) || rawSettleTs < cutoffMs || rawSettleTs > nowMs) continue;

    const { userKey, cleanAddr, bestName } = resolveIdentity(lt.user_id, lt.user_address, lt.username);
    if (!userKey) continue;

    const wonAmount = Number(lt.won_amount || 0);
    const isTicketWin = statusLower === 'won';
    const extraUsdt = isTicketWin && !coveredTicketIds.has(lt.id) && wonAmount > 0 ? wonAmount : 0;

    upsertEntry(userKey, `lwin:${lt.id}`, bestName, cleanAddr, isTicketWin, extraUsdt, rawSettleTs);
  }

  const settledRoundStatuses = new Set(['won', 'win', 'lost', 'completed', 'settled', 'cashout']);
  for (const gr of grRes.data || []) {
    const st = String(gr.status || '').toLowerCase();
    if (!settledRoundStatuses.has(st)) continue;
    const ts = new Date(gr.created_at).getTime();
    if (!Number.isFinite(ts) || ts < cutoffMs || ts > nowMs) continue;

    const payout = Number(gr.payout || 0);
    const isWin = payout > 0 || st === 'won' || st === 'win';
    const { userKey, cleanAddr, bestName } = resolveIdentity(gr.user_id, gr.wallet_address, gr.username);
    if (!userKey) continue;

    upsertEntry(userKey, `rnd:${gr.id}`, bestName, cleanAddr, isWin, payout > 0 ? payout : 0, ts);
  }

  interface ScoredUser {
    username: string;
    totalWonUSDT: number;
    winPct: number;
    winsCount: number;
    firstWinAt: number;
  }

  const qualifying: ScoredUser[] = [];
  for (const [, entriesMap] of userEntries) {
    let totalEntries = 0;
    let winsCount = 0;
    let totalWonUSDT = 0;
    let firstWinAt = Number.MAX_SAFE_INTEGER;
    let displayUsername: string | null = null;
    let displayAddr: string | null = null;

    for (const entry of entriesMap.values()) {
      totalEntries += 1;
      if (!displayUsername && entry.username) displayUsername = entry.username;
      if (!displayAddr && entry.address) displayAddr = entry.address;
      if (entry.won) {
        winsCount += 1;
        totalWonUSDT += entry.wonUsdt;
        if (entry.winTs !== null && entry.winTs < firstWinAt) {
          firstWinAt = entry.winTs;
        }
      }
    }

    const roundedTotalWon = Number(totalWonUSDT.toFixed(2));
    if (winsCount <= 0 || roundedTotalWon <= 0) continue;

    qualifying.push({
      username: displayUsername || formatFallbackAddress(displayAddr),
      totalWonUSDT: roundedTotalWon,
      winPct: totalEntries > 0 ? (winsCount / totalEntries) * 100 : 0,
      winsCount,
      firstWinAt
    });
  }

  // Primary sort: Winning Percentage DESC, deterministic tie-breakers
  qualifying.sort((a, b) => {
    if (b.winPct !== a.winPct) return b.winPct - a.winPct;
    if (b.totalWonUSDT !== a.totalWonUSDT) return b.totalWonUSDT - a.totalWonUSDT;
    if (b.winsCount !== a.winsCount) return b.winsCount - a.winsCount;
    if (a.firstWinAt !== b.firstWinAt) return a.firstWinAt - b.firstWinAt;
    return a.username.localeCompare(b.username);
  });

  return qualifying.slice(0, 100).map((item, idx) => ({
    rank: idx + 1,
    username: item.username,
    total_won: item.totalWonUSDT
  }));
}

export default function LeaderboardView() {
  const { playClick } = useSoundFX();

  const [timeFilter, setTimeFilter] = useState<TimeFilterId>('28d');
  const [rows, setRows] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [monthlyAnnouncement, setMonthlyAnnouncement] =
    useState<MonthlyLeaderboardAnnouncement | null>(null);
  const requestSeqRef = useRef(0);

  const fetchPublishedAnnouncement = useCallback(async () => {
    try {
      const { data, error } = await supabase.rpc('get_published_monthly_leaderboard_announcement');
      if (!error && data?.is_published && Array.isArray(data?.prizes)) {
        setMonthlyAnnouncement(data as MonthlyLeaderboardAnnouncement);
      } else {
        setMonthlyAnnouncement(null);
      }
    } catch {
      setMonthlyAnnouncement(null);
    }
  }, []);

  useEffect(() => {
    fetchPublishedAnnouncement();
    const channel = supabase
      .channel('monthly_leaderboard_announcement_live')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'platform_settings' },
        () => {
          fetchPublishedAnnouncement();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'winner_payouts' },
        () => {
          fetchPublishedAnnouncement();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchPublishedAnnouncement]);

  const fetchLeaderboard = useCallback(
    async (showLoader = true) => {
      const reqId = ++requestSeqRef.current;
      if (showLoader) setLoading(true);

      try {
        const selectedTf = TIME_FILTERS.find((tf) => tf.id === timeFilter) || TIME_FILTERS[4];

        const { data, error } = await supabase.rpc('get_leaderboard_rankings', {
          p_days: selectedTf.days,
          p_limit: 100
        });

        let formatted: LeaderboardEntry[];
        if (!error && Array.isArray(data)) {
          formatted = (data as RpcLeaderboardRow[]).map((item, idx) => ({
            rank: Number(item.rank) || idx + 1,
            username: normalizeHandle(item.username) || String(item.username || 'Player'),
            total_won: Number(Number(item.total_won_usdt || 0).toFixed(2))
          }));
        } else {
          if (error) {
            console.warn('get_leaderboard_rankings RPC fallback:', error.message);
          }
          formatted = await fetchLeaderboardFallback(selectedTf.days);
        }

        if (reqId === requestSeqRef.current) {
          setRows(formatted);
        }
      } catch (err) {
        console.error('fetchLeaderboard error:', err);
        if (reqId === requestSeqRef.current) {
          setRows([]);
        }
      } finally {
        if (reqId === requestSeqRef.current) {
          setLoading(false);
          setIsRefreshing(false);
        }
      }
    },
    [timeFilter]
  );

  useEffect(() => {
    fetchLeaderboard(true);
  }, [fetchLeaderboard]);

  useEffect(() => {
    const channel = supabase
      .channel('realtime:leaderboard_rankings')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'winner_payouts' }, () => {
        fetchLeaderboard(false);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'lottery_tickets' }, () => {
        fetchLeaderboard(false);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'game_rounds' }, () => {
        fetchLeaderboard(false);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchLeaderboard]);

  const activePeriodLabel =
    TIME_FILTERS.find((tf) => tf.id === timeFilter)?.label || '4 Weeks (1 Month)';

  return (
    <div className="w-full max-w-5xl mx-auto px-2 xs:px-3 sm:px-4 py-3 sm:py-6 space-y-4 sm:space-y-6 text-left">
      {/* Header */}
      <div className="relative rounded-2xl sm:rounded-3xl bg-gradient-to-r from-[#111827] via-[#151C2B] to-[#111827] border border-[#1F2737] p-4 sm:p-6 overflow-hidden shadow-xl">
        <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-amber-500/15 border border-amber-500/35 flex items-center justify-center text-amber-400 shrink-0 shadow-[0_0_20px_rgba(245,196,81,0.18)]">
              <Trophy className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div className="min-w-0">
              <h1 className="font-display font-black text-lg sm:text-2xl text-white tracking-tight">
                Leaderboard
              </h1>
              <p className="text-[11px] sm:text-xs text-[#94A3B8] mt-0.5 leading-snug">
                Top ranked players and USDT winnings · {activePeriodLabel}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              playClick();
              setIsRefreshing(true);
              fetchLeaderboard(false);
            }}
            className="self-start sm:self-auto px-3.5 py-2 rounded-xl bg-[#0B0F19] hover:bg-[#151C2B] border border-[#1F2737] hover:border-amber-400/50 text-amber-400 text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer shadow-sm transition-all shrink-0"
            title="Refresh leaderboard"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span>Sync</span>
          </button>
        </div>
      </div>

      {/* 5 Time-Period Filters */}
      <div
        role="tablist"
        aria-label="Leaderboard Time Period"
        className="flex flex-wrap sm:flex-nowrap items-center justify-center sm:justify-start gap-1.5 bg-[#111827] p-1.5 rounded-2xl border border-[#1F2737]"
      >
        {TIME_FILTERS.map((tf) => {
          const isSelected = timeFilter === tf.id;
          return (
            <button
              key={tf.id}
              type="button"
              role="tab"
              aria-selected={isSelected}
              onClick={() => {
                playClick();
                setTimeFilter(tf.id);
              }}
              className={`px-2.5 sm:px-4 py-1.5 sm:py-2 rounded-xl text-[11px] sm:text-xs font-bold whitespace-nowrap transition-all cursor-pointer shrink-0 ${
                isSelected
                  ? 'bg-amber-400 text-black shadow-md shadow-amber-500/20 font-black'
                  : 'text-[#94A3B8] hover:text-white hover:bg-white/5'
              }`}
            >
              {tf.label}
            </button>
          );
        })}
      </div>

      {/* This Month's Announcement (Published by Super Admin only — single-row Rank | Username | Reward) */}
      {monthlyAnnouncement?.is_published &&
        Array.isArray(monthlyAnnouncement.prizes) &&
        monthlyAnnouncement.prizes.length > 0 && (() => {
          const prizeRows: MonthlyStandingRow[] =
            Array.isArray(monthlyAnnouncement.standings) && monthlyAnnouncement.standings.length > 0
              ? monthlyAnnouncement.standings.slice(0, 10)
              : monthlyAnnouncement.prizes.slice(0, 10).map((p) => ({
                  rank: Number(p.rank),
                  username: null,
                  reward_usdt: Number(p.reward_usdt || 0)
                }));

          const totalMonthlyPool = prizeRows.reduce((sum, p) => sum + Number(p.reward_usdt || 0), 0);

          return (
            <div
              data-testid="monthly-leaderboard-announcement"
              className="rounded-2xl sm:rounded-3xl bg-gradient-to-br from-[#161c2c] via-[#111827] to-[#0B0F19] border border-[#f5c451]/35 p-3.5 sm:p-5 space-y-3.5 shadow-xl overflow-hidden"
            >
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2.5">
                <div className="space-y-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                    <span className="inline-flex items-center gap-1.5 text-[10px] sm:text-[11px] font-mono-numbers uppercase tracking-wider text-amber-400 font-bold">
                      <Megaphone className="w-3.5 h-3.5 shrink-0" />
                      This Month&apos;s Announcement
                    </span>
                    {monthlyAnnouncement.month_label && (
                      <span className="px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-[10px] font-mono-numbers font-bold text-amber-300">
                        {monthlyAnnouncement.month_label}
                      </span>
                    )}
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-mono-numbers font-bold uppercase border ${
                        monthlyAnnouncement.finalized
                          ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                          : 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30'
                      }`}
                    >
                      {monthlyAnnouncement.finalized ? 'Finalized' : 'Active Competition'}
                    </span>
                  </div>
                  <h2 className="font-display font-bold text-sm sm:text-base text-white break-words">
                    {monthlyAnnouncement.title || `${monthlyAnnouncement.month_label || 'Monthly'} Top 10 Prize Pool`}
                  </h2>
                  {monthlyAnnouncement.description && (
                    <p className="text-[11px] sm:text-xs text-[#94A3B8] leading-relaxed">
                      {monthlyAnnouncement.description}
                    </p>
                  )}
                </div>

                <div className="shrink-0 flex sm:flex-col items-center sm:items-end justify-between gap-1 px-3 py-2 rounded-xl bg-[#0B0F19]/80 border border-amber-500/25">
                  <span className="text-[10px] font-mono-numbers uppercase tracking-wider text-[#94A3B8]">
                    Top 10 Pool
                  </span>
                  <span className="text-xs sm:text-sm font-mono-numbers font-extrabold text-amber-400 whitespace-nowrap">
                    $
                    {totalMonthlyPool.toLocaleString('en-US', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2
                    })}{' '}
                    USDT
                  </span>
                </div>
              </div>

              {/* Single-Row Standings & Rewards Table: Rank | Username | Reward (USDT) */}
              <div className="rounded-xl border border-[#1F2737] bg-[#0B0F19]/75 overflow-hidden">
                <div className="grid grid-cols-[44px_minmax(0,1fr)_auto] sm:grid-cols-[72px_minmax(0,1fr)_160px] items-center gap-2 sm:gap-4 px-2.5 sm:px-4 py-2 bg-[#080B12] border-b border-[#1F2737] text-[10px] font-mono-numbers uppercase tracking-wider text-[#94A3B8]">
                  <span>Rank</span>
                  <span>Username</span>
                  <span className="text-right">Reward (USDT)</span>
                </div>

                <div className="divide-y divide-[#1F2737]/70">
                  {prizeRows.map((row) => {
                    const rank = Number(row.rank);
                    const reward = Number(row.reward_usdt || 0);
                    const rankBadgeClass =
                      rank === 1
                        ? 'bg-amber-500/20 text-amber-300 border-amber-500/45'
                        : rank === 2
                        ? 'bg-slate-400/20 text-slate-200 border-slate-400/40'
                        : rank === 3
                        ? 'bg-orange-500/20 text-orange-300 border-orange-500/40'
                        : 'bg-[#111827] text-[#94A3B8] border-[#1F2737]';

                    return (
                      <div
                        key={rank}
                        data-testid={`monthly-prize-row-${rank}`}
                        className="grid grid-cols-[44px_minmax(0,1fr)_auto] sm:grid-cols-[72px_minmax(0,1fr)_160px] items-center gap-2 sm:gap-4 px-2.5 sm:px-4 py-2 text-xs hover:bg-white/[0.02] transition-colors"
                      >
                        <div className="shrink-0">
                          <span
                            className={`inline-flex items-center justify-center min-w-[34px] sm:min-w-[40px] px-1.5 py-0.5 rounded-md border font-mono-numbers font-extrabold text-[10px] sm:text-xs whitespace-nowrap ${rankBadgeClass}`}
                          >
                            #{rank}
                          </span>
                        </div>

                        <div className="min-w-0">
                          {row.username ? (
                            <span
                              className={`block truncate whitespace-nowrap font-display font-bold text-[11px] xs:text-xs sm:text-sm ${
                                rank === 1 ? 'text-amber-300' : 'text-white'
                              }`}
                              title={row.username}
                            >
                              {row.username}
                            </span>
                          ) : (
                            <span className="block truncate whitespace-nowrap font-mono-numbers text-[11px] sm:text-xs text-[#64748B] italic">
                              Rank #{rank} Qualifying Slot
                            </span>
                          )}
                        </div>

                        <div className="text-right whitespace-nowrap shrink-0 font-mono-numbers font-extrabold text-[11px] xs:text-xs sm:text-sm text-emerald-400">
                          {reward.toLocaleString('en-US', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2
                          })}{' '}
                          <span className="text-[9.5px] sm:text-[11px] text-emerald-300/85">USDT</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })()}

      {/* Strictly 3-Column Leaderboard Table: Rank | Username | Total Won (USDT) */}
      <div className="rounded-2xl sm:rounded-3xl bg-[#111827] border border-[#1F2737] overflow-hidden shadow-xl">
        <div
          data-testid="leaderboard-scroll-container"
          className="max-h-[540px] sm:max-h-[580px] overflow-y-auto overflow-x-auto ef-subtle-scroll overscroll-contain"
        >
          <table className="w-full text-left">
            <thead className="sticky top-0 z-10 bg-[#0B0F19] text-[#94A3B8] font-mono-numbers uppercase text-[10px] sm:text-xs tracking-wider shadow-[0_1px_0_0_#1F2737]">
            <tr>
              <th className="py-3 px-2.5 xs:px-3.5 sm:px-6 w-12 xs:w-16 sm:w-28 whitespace-nowrap">Rank</th>
              <th className="py-3 px-2 xs:px-3.5 sm:px-6 whitespace-nowrap">Username</th>
              <th className="py-3 px-2.5 xs:px-3.5 sm:px-6 text-right whitespace-nowrap">
                Total Won (USDT)
              </th>
            </tr>
          </thead>

          <tbody className="divide-y divide-[#1F2737] text-xs sm:text-sm">
            {loading ? (
              <tr>
                <td colSpan={3} className="py-14 text-center text-[#94A3B8]">
                  <RefreshCw className="w-6 h-6 animate-spin text-amber-400 mx-auto mb-2" />
                  <p className="text-xs font-mono-numbers">Loading leaderboard...</p>
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={3} className="py-14 px-4 text-center text-[#94A3B8]">
                  <Trophy className="w-8 h-8 text-[#64748B] mx-auto mb-2.5" />
                  <p className="text-sm font-bold text-white">
                    No winning activity recorded for {activePeriodLabel}
                  </p>
                  <p className="text-xs text-[#94A3B8] mt-1">
                    Players with verified USDT winnings during this period will appear here.
                  </p>
                </td>
              </tr>
            ) : (
              rows.map((player) => {
                const isTop1 = player.rank === 1;
                const isTop2 = player.rank === 2;
                const isTop3 = player.rank === 3;

                return (
                  <tr
                    key={`${player.rank}-${player.username}`}
                    className={`transition-colors hover:bg-[#151C2B] ${
                      isTop1
                        ? 'bg-amber-500/[0.06]'
                        : isTop2
                        ? 'bg-slate-400/[0.04]'
                        : isTop3
                        ? 'bg-amber-700/[0.04]'
                        : ''
                    }`}
                  >
                    {/* 1. Rank */}
                    <td className="py-3 px-2.5 xs:px-3.5 sm:px-6 whitespace-nowrap">
                      {isTop1 ? (
                        <span className="inline-flex items-center justify-center w-6 h-6 xs:w-7 xs:h-7 sm:w-8 sm:h-8 rounded-full bg-amber-400 text-black font-black text-[11px] sm:text-xs shadow-md shadow-amber-500/25">
                          <Crown className="w-3.5 h-3.5 mr-0.5 hidden sm:inline" />1
                        </span>
                      ) : isTop2 ? (
                        <span className="inline-flex items-center justify-center w-6 h-6 xs:w-7 xs:h-7 sm:w-8 sm:h-8 rounded-full bg-slate-300 text-black font-black text-[11px] sm:text-xs shadow-md">
                          2
                        </span>
                      ) : isTop3 ? (
                        <span className="inline-flex items-center justify-center w-6 h-6 xs:w-7 xs:h-7 sm:w-8 sm:h-8 rounded-full bg-amber-600 text-white font-black text-[11px] sm:text-xs shadow-md">
                          3
                        </span>
                      ) : (
                        <span className="inline-flex items-center justify-center w-6 h-6 xs:w-7 xs:h-7 sm:w-8 sm:h-8 text-[#94A3B8] font-mono-numbers font-bold text-[11px] sm:text-sm">
                          {player.rank}
                        </span>
                      )}
                    </td>

                    {/* 2. Username */}
                    <td className="py-3 px-2 xs:px-3.5 sm:px-6 min-w-0 max-w-[110px] xs:max-w-[160px] sm:max-w-none">
                      <span
                        className={`font-display font-bold truncate block text-[12px] sm:text-sm ${
                          isTop1 ? 'text-amber-300' : 'text-white'
                        }`}
                        title={player.username}
                      >
                        {player.username}
                      </span>
                    </td>

                    {/* 3. Total Won (USDT) */}
                    <td className="py-3 px-2.5 xs:px-3.5 sm:px-6 text-right whitespace-nowrap font-mono-numbers text-[11px] xs:text-xs sm:text-sm">
                      <span
                        className={`font-black ${
                          isTop1 ? 'text-amber-300' : 'text-emerald-400'
                        }`}
                      >
                        {Number(player.total_won || 0).toLocaleString('en-US', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2
                        })}
                      </span>{' '}
                      <span className="text-[9.5px] sm:text-xs font-bold text-amber-400/85">
                        USDT
                      </span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
