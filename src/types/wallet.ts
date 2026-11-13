import { PlatformTransaction } from './database';

export interface WalletState {
  balance: number;
  pendingBalance: number;
  lockedBalance: number;
  currency: 'FLO' | 'USDT';
  address: string | null;
  isConnected: boolean;
  isLoading: boolean;
}

export type TransactionFilterType = 'all' | 'deposits' | 'withdrawals';

export interface DepositRequest {
  id: string;
  userId: string;
  amount: number;
  currency: string;
  txHash: string;
  senderAddress: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
  reviewedAt?: string;
  notes?: string;
}

export interface WithdrawalRequest {
  id: string;
  userId: string;
  amount: number;
  currency: string;
  destinationAddress: string;
  status: 'pending' | 'processing' | 'completed' | 'rejected';
  txHash?: string;
  createdAt: string;
  processedAt?: string;
  rejectionReason?: string;
}

export interface FloConversionRate {
  rate: number; // 1 FLO = 1 USDT
  minimumDeposit: number;
  minimumWithdrawal: number;
  withdrawalFeePercent: number;
}

