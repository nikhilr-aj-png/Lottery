/**
 * ============================================================================
 * UNIVERSAL GAME REGISTRY — FOUR-DIGIT LOTTERY ONLY (USDT-ONLY)
 * ============================================================================
 * EarnFlow.in operates exclusively as a Four-Digit Lottery platform.
 * All other games (Crash, Dice, Coinflip, Bingo, Horse Racing, Mines, Plinko)
 * have been permanently removed.
 */

import { GameDefinition, GameCategory, GameId } from '../types/games';

export const GAME_CATEGORIES: Record<string, GameCategory> = {
  ALL: 'all',
  LOTTERY: 'lottery'
};

export const GAMES: GameDefinition[] = [
  {
    id: 'lottery',
    name: 'Four-Digit Lottery',
    shortName: 'Lottery',
    slug: 'four-digit-lottery',
    aliases: ['lottery', '4-digit-lottery', 'four-digit-lottery'],
    category: GAME_CATEGORIES.LOTTERY,
    badge: 'JACKPOT',
    themeColor: '#ffd700',
    icon: '/items/Four Digit Lottery.jpg',
    image: '/items/Four Digit Lottery.jpg',
    description: 'Pick your lucky 4-digit number (0000–9999) and enter live jackpot prize pools with automated transparent draws and 24h USDT payouts.',
    rtp: 95.0,
    houseEdge: 5.0,
    minStakeUSDT: 1,
    maxStakeUSDT: 500,
    defaultStakeUSDT: 10,
    minStakeFC: 1,
    maxStakeFC: 500,
    defaultStakeFC: 10,
    maxMultiplier: 1000.0,
    isProvablyFair: true,
    status: 'active',
    releaseDate: '2026-01-01',
    features: [
      '4-Digit Sequence (0000-9999)',
      'Multiple Live Rooms',
      'Automated Oracle Draws',
      'Realtime Countdown Timer',
      'Direct USDT (TRC-20) Payouts'
    ],
    rules: [
      'Select any 4-digit combination between 0000 and 9999.',
      'Purchase tickets using your available USDT balance.',
      'When the round countdown concludes, the draw process is finalized.',
      'Exact matches share the pool jackpot based on configured winner distribution rules.'
    ],
    instructions: 'Use the interactive dials or quick-pick keypad to select your numbers, then click "Buy Ticket".'
  }
];

// Helper to look up game by ID or slug
export function getGameById(idOrSlug?: string | null): GameDefinition | undefined {
  if (!idOrSlug) return GAMES[0];
  const lower = idOrSlug.toLowerCase();
  return GAMES.find(g => 
    g.id.toLowerCase() === lower || 
    g.slug.toLowerCase() === lower ||
    (g.aliases && g.aliases.some(a => a.toLowerCase() === lower))
  ) || GAMES[0];
}

// Helper to get game icon image URL
export function getGameIconUrl(gameId?: GameId | string): string {
  return '/items/Four Digit Lottery.jpg';
}

// Helper to get fallback artwork URL
export function getGameFallbackIconUrl(gameId?: GameId | string): string {
  return '/items/Four Digit Lottery.jpg';
}

// Helper to get active games list
export function getActiveGames(): GameDefinition[] {
  return GAMES.filter(g => g.status === 'active');
}
