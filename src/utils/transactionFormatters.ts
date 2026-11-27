export interface TransactionTypeMeta {
  label: string;
  bg: string;
}

export interface TransactionStatusMeta {
  label: string;
  pillClass: string;
  dotClass: string;
}

export interface FormattedTimestamp {
  date: string;
  time: string;
  full: string;
}

const GREEN_REWARD_BADGE =
  'bg-emerald-500/15 text-emerald-300 border-emerald-500/35';

const AMBER_DEBIT_BADGE =
  'bg-amber-500/15 text-amber-300 border-amber-500/35';

const INDIGO_TICKET_BADGE =
  'bg-indigo-500/15 text-indigo-300 border-indigo-500/35';

const SLATE_GAME_BADGE =
  'bg-slate-500/20 text-slate-200 border-slate-400/35';

const SKY_ADMIN_BADGE =
  'bg-sky-500/15 text-sky-300 border-sky-500/35';

export const TRANSACTION_TYPE_MAP: Record<string, TransactionTypeMeta> = {
  daily_reward: {
    label: 'Daily Reward',
    bg: GREEN_REWARD_BADGE,
  },
  daily_bonus: {
    label: 'Daily Reward',
    bg: GREEN_REWARD_BADGE,
  },
  lucky_wheel_spin: {
    label: 'Lucky Wheel Spin',
    bg: GREEN_REWARD_BADGE,
  },
  spin_wheel_reward: {
    label: 'Lucky Wheel Spin',
    bg: GREEN_REWARD_BADGE,
  },
  lottery_win: {
    label: 'Lottery Win',
    bg: GREEN_REWARD_BADGE,
  },
  game_win: {
    label: 'Game Win',
    bg: GREEN_REWARD_BADGE,
  },
  deposit: {
    label: 'Deposit',
    bg: GREEN_REWARD_BADGE,
  },
  referral_bonus: {
    label: 'Referral Bonus',
    bg: GREEN_REWARD_BADGE,
  },
  referral_reward: {
    label: 'Referral Bonus',
    bg: GREEN_REWARD_BADGE,
  },
  referral_registration_reward: {
    label: 'Registration Bonus',
    bg: GREEN_REWARD_BADGE,
  },
  referral_commission: {
    label: 'Referral Commission',
    bg: GREEN_REWARD_BADGE,
  },
  first_deposit_bonus: {
    label: 'First Deposit Bonus',
    bg: GREEN_REWARD_BADGE,
  },
  welcome_grant: {
    label: 'Welcome Bonus',
    bg: GREEN_REWARD_BADGE,
  },
  monthly_leaderboard_reward: {
    label: 'Monthly Leaderboard Reward',
    bg: GREEN_REWARD_BADGE,
  },
  withdrawal_refund: {
    label: 'Withdrawal Refund',
    bg: GREEN_REWARD_BADGE,
  },
  withdrawal: {
    label: 'Withdrawal',
    bg: AMBER_DEBIT_BADGE,
  },
  withdrawal_request: {
    label: 'Withdrawal',
    bg: AMBER_DEBIT_BADGE,
  },
  ticket_purchase: {
    label: 'Ticket Purchase',
    bg: INDIGO_TICKET_BADGE,
  },
  game_bet: {
    label: 'Game Play',
    bg: SLATE_GAME_BADGE,
  },
  admin_adjustment: {
    label: 'Wallet Adjustment',
    bg: SKY_ADMIN_BADGE,
  },
  vip_membership: {
    label: 'VIP Membership',
    bg: 'bg-amber-500/15 text-amber-300 border-amber-500/35',
  },
};

/**
 * Converts a raw database transaction enum (e.g. LUCKY_WHEEL_SPIN, daily_reward)
 * into a clean, user-friendly human label with zero underscores.
 */
export function formatTransactionTypeLabel(rawType?: string | null): string {
  if (!rawType) return 'Transaction';
  const normalized = String(rawType).trim().toLowerCase();
  if (!normalized) return 'Transaction';
  const mapped = TRANSACTION_TYPE_MAP[normalized];
  if (mapped) return mapped.label;
  return normalized
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (ch) => ch.toUpperCase());
}

/**
 * Returns both the human-readable transaction type label and high-contrast badge classes.
 */
export function getTransactionTypeMeta(rawType?: string | null): TransactionTypeMeta {
  const normalized = String(rawType || '').trim().toLowerCase();
  const mapped = TRANSACTION_TYPE_MAP[normalized];
  if (mapped) return mapped;
  return {
    label: formatTransactionTypeLabel(rawType),
    bg: SLATE_GAME_BADGE,
  };
}

/**
 * Formats long UUID/hash TX IDs compactly while keeping start and tail characters readable.
 */
export function formatCompactTxId(
  rawId?: string | number | null,
  visibleStart = 8,
  visibleEnd = 4
): string {
  const clean = String(rawId ?? '').trim();
  if (!clean) return '—';
  if (clean.length <= visibleStart + visibleEnd + 3) return clean;
  return `${clean.slice(0, visibleStart)}…${clean.slice(-visibleEnd)}`;
}

/**
 * Strictly parses a database timestamp without inventing or substituting current time.
 */
export function formatTransactionTimestamp(
  rawDate?: string | number | null
): FormattedTimestamp | null {
  if (rawDate === null || rawDate === undefined || rawDate === '') return null;
  const parsed = new Date(rawDate);
  if (Number.isNaN(parsed.getTime())) return null;
  const date = parsed.toLocaleDateString('en-US', {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
  });
  const time = parsed.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  return {
    date,
    time,
    full: `${date} • ${time}`,
  };
}

/**
 * Formats transaction / order status cleanly with semantic contrast styling.
 */
export function formatTransactionStatusMeta(
  rawStatus?: string | null
): TransactionStatusMeta {
  const normalized = String(rawStatus || 'completed').trim().toLowerCase();
  switch (normalized) {
    case 'completed':
    case 'finished':
    case 'confirmed':
    case 'paid':
    case 'credited':
    case 'approved':
    case 'success':
      return {
        label: normalized === 'confirmed' ? 'Confirmed' : 'Completed',
        pillClass:
          'bg-emerald-500/15 text-emerald-300 border-emerald-500/35',
        dotClass: 'bg-emerald-400',
      };
    case 'waiting':
      return {
        label: 'Awaiting Payment',
        pillClass: 'bg-amber-500/15 text-amber-300 border-amber-500/35',
        dotClass: 'bg-amber-400',
      };
    case 'confirming':
    case 'sending':
    case 'processing':
      return {
        label: 'Processing',
        pillClass: 'bg-amber-500/15 text-amber-300 border-amber-500/35',
        dotClass: 'bg-amber-400',
      };
    case 'pending':
      return {
        label: 'Pending',
        pillClass: 'bg-amber-500/15 text-amber-300 border-amber-500/35',
        dotClass: 'bg-amber-400',
      };
    case 'partially_paid':
      return {
        label: 'Partially Paid',
        pillClass: 'bg-amber-500/15 text-amber-300 border-amber-500/35',
        dotClass: 'bg-amber-400',
      };
    case 'expired':
    case 'cancelled':
    case 'canceled':
      return {
        label: normalized === 'expired' ? 'Expired' : 'Cancelled',
        pillClass: 'bg-slate-500/15 text-slate-300 border-slate-500/35',
        dotClass: 'bg-slate-400',
      };
    case 'failed':
    case 'rejected':
      return {
        label: normalized === 'rejected' ? 'Rejected' : 'Failed',
        pillClass: 'bg-rose-500/15 text-rose-300 border-rose-500/35',
        dotClass: 'bg-rose-400',
      };
    case 'refunded':
      return {
        label: 'Refunded',
        pillClass: 'bg-sky-500/15 text-sky-300 border-sky-500/35',
        dotClass: 'bg-sky-400',
      };
    default:
      return {
        label: normalized
          .replace(/[_-]+/g, ' ')
          .replace(/\s+/g, ' ')
          .trim()
          .replace(/\b\w/g, (ch) => ch.toUpperCase()) || 'Completed',
        pillClass:
          'bg-emerald-500/15 text-emerald-300 border-emerald-500/35',
        dotClass: 'bg-emerald-400',
      };
  }
}
