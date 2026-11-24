export type GameId = 'lottery';

export type GameCategory = 'all' | 'lottery';

export type GameBadge = 
  | 'HOT' 
  | 'JACKPOT' 
  | 'POPULAR' 
  | 'CLASSIC' 
  | 'NEW' 
  | 'PROVABLY FAIR' 
  | 'VIP'
  | 'LOTTO';

export interface GameDefinition {
  id: GameId;
  name: string;
  shortName: string;
  slug: string;
  aliases?: string[];
  category: GameCategory;
  badge?: GameBadge;
  themeColor: string;
  icon: string;
  image: string;
  description: string;
  rtp: number;
  houseEdge: number;
  minStakeUSDT: number;
  maxStakeUSDT: number;
  defaultStakeUSDT: number;
  minStakeFC?: number;
  maxStakeFC?: number;
  defaultStakeFC?: number;
  maxMultiplier: number;
  isProvablyFair: boolean;
  status: 'active' | 'maintenance';
  releaseDate?: string;
  features: string[];
  rules: string[];
  instructions?: string;
}

export interface GameBet {
  id: string;
  gameId: GameId;
  userId?: string;
  username?: string;
  amount: number;
  multiplier?: number;
  payout?: number;
  won?: boolean;
  timestamp: number | string;
  serverSeedHash?: string;
  clientSeed?: string;
  nonce?: number;
}

export interface GameRoundResult {
  roundId: string;
  gameId: GameId;
  stake: number;
  multiplier: number;
  payout: number;
  isWin: boolean;
  details?: Record<string, unknown>;
  fairness?: {
    serverSeedHash: string;
    serverSeed?: string;
    clientSeed: string;
    nonce: number;
    combinedHash?: string;
  };
}

export interface GameRoom {
  id: string;
  name: string;
  gameId: GameId;
  activePlayersCount: number;
  minStake: number;
  maxStake: number;
  speed: 'normal' | 'turbo' | 'vip';
  status: 'active' | 'maintenance' | 'full';
  rulesConfig?: Record<string, unknown>;
}

export interface ProvablyFairSeeds {
  serverSeedHash: string;
  serverSeed?: string;
  clientSeed: string;
  nonce: number;
}
