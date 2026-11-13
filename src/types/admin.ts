import { GameId } from './games';

export type AdminRole = 'admin' | 'superadmin' | 'moderator' | 'support';

export type AdminTab = 
  | 'overview' 
  | 'games-management' 
  | 'pools' 
  | 'games' 
  | 'game-rounds' 
  | 'withdrawals' 
  | 'deposits'
  | 'users' 
  | 'winner-payouts' 
  | 'support' 
  | 'settings';

export interface AdminStats {
  totalUsers: number;
  activeUsers24h: number;
  totalVolume: number;
  totalDeposits: number;
  totalWithdrawals: number;
  totalPlatformProfit: number;
  activeLotteryPools: number;
  pendingWithdrawalsCount: number;
}

export interface AdminGameConfig {
  id: GameId;
  name: string;
  isEnabled: boolean;
  minStake: number;
  maxStake: number;
  houseEdgePercent: number;
  maxPayoutMultiplier: number;
  maintenanceMode: boolean;
}

export interface UserAuditRecord {
  id: string;
  email: string;
  username: string;
  role: string;
  balance: number;
  totalWagered: number;
  totalDeposited: number;
  totalWithdrawn: number;
  isBanned: boolean;
  createdAt: string;
  lastLogin?: string;
}

