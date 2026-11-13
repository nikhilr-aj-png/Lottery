export type GameId = 
  | 'lottery' 
  | 'crash' 
  | 'dice' 
  | 'mines' 
  | 'plinko' 
  | 'roulette' 
  | 'coinflip' 
  | 'blackjack' 
  | 'slots' 
  | 'poker' 
  | 'keno' 
  | 'limbo';

export type GameCategory = 'all' | 'lottery' | 'instant' | 'table' | 'arcade' | 'card' | 'slots';

export type GameBadge = 
  | 'HOT' 
  | 'JACKPOT' 
  | 'POPULAR' 
  | 'CLASSIC' 
  | 'NEW' 
  | 'PROVABLY FAIR' 
  | 'VIRAL' 
  | 'CASINO VIP' 
  | 'FAST' 
  | 'STRATEGY' 
  | 'VEGAS' 
  | 'SKILL' 
  | 'LOTTO' 
  | '10,000X';

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
  minStakeFC: number;
  maxStakeFC: number;
  defaultStakeFC: number;
  maxMultiplier: number;
  isProvablyFair: boolean;
  status: 'active' | 'maintenance' | 'beta';
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
}

export interface RoomChatMessage {
  id: string;
  roomId: string;
  userId: string;
  username: string;
  avatarUrl?: string;
  message: string;
  timestamp: string | number;
  isModerator?: boolean;
  isSystem?: boolean;
}
