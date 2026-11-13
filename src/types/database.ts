export type UserRole = 'user' | 'vip' | 'moderator' | 'admin' | 'superadmin';

export interface UserProfile {
  id: string;
  email?: string | null;
  username?: string | null;
  full_name?: string | null;
  avatar_url?: string | null;
  role?: UserRole;
  is_active?: boolean;
  trc20_address?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface UserWallet {
  id?: string;
  user_id?: string;
  balance: number;
  pending_balance?: number;
  locked_balance?: number;
  currency?: string;
  address?: string;
  created_at?: string;
  updated_at?: string;
}

export interface LotteryEvent {
  id: string;
  title: string;
  description?: string;
  ticket_price: number;
  total_tickets: number;
  sold_tickets?: number;
  prize_pool: number;
  status: 'active' | 'upcoming' | 'drawing' | 'completed' | 'cancelled';
  draw_time?: string;
  start_time?: string;
  end_time?: string;
  winning_number?: string | null;
  winning_numbers?: string[];
  banner_url?: string;
  created_at?: string;
  rules?: string[];
}

export interface LotteryTicket {
  id: string;
  event_id: string;
  user_id: string;
  ticket_number: string;
  status: 'active' | 'won' | 'lost' | 'refunded';
  prize_amount?: number;
  created_at: string;
  event?: LotteryEvent;
}

export type TransactionType = 
  | 'deposit' 
  | 'withdrawal' 
  | 'ticket_purchase' 
  | 'lottery_win' 
  | 'game_bet' 
  | 'game_win' 
  | 'daily_bonus' 
  | 'daily_claim' 
  | 'vip_reward' 
  | 'referral' 
  | 'admin_adjustment';

export type TransactionStatus = 'pending' | 'completed' | 'failed' | 'rejected' | 'cancelled';

export interface PlatformTransaction {
  id: string;
  user_id?: string;
  user_address?: string;
  type: TransactionType;
  amount: number;
  currency: string;
  status: TransactionStatus;
  tx_hash?: string | null;
  address?: string | null;
  description?: string | null;
  created_at: string;
  updated_at?: string;
  metadata?: Record<string, unknown>;
}

export interface DailyBonusRecord {
  id?: string;
  user_id: string;
  claimed_at: string;
  amount: number;
  streak_day: number;
  streak_count?: number;
  bonus_type?: 'streak' | 'wheel' | 'mystery';
}

export interface LeaderboardEntry {
  rank: number;
  user_id?: string;
  username: string;
  avatar_url?: string;
  total_wagered?: number;
  total_won: number;
  win_count?: number;
  badge?: string;
  is_user?: boolean;
}

