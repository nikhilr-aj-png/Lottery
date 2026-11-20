/**
 * ============================================================================
 * UNIVERSAL GAME REGISTRY — 6 ACTIVE PROVABLY FAIR GAMES (USDT-ONLY)
 * ============================================================================
 * Modular configuration and metadata for all active games on EarnFlow.in.
 * Active Games: Four-Digit Lottery, Crash, Dice, Coinflip,
 *               Bingo – Color Trading, Horse Racing.
 * Discontinued Games permanently removed: Roulette, Blackjack, Slots, Poker, Keno, Limbo.
 */

import { GameDefinition, GameCategory, GameId } from '../types/games';

export const GAME_CATEGORIES: Record<string, GameCategory> = {
  ALL: 'all',
  LOTTERY: 'lottery',
  INSTANT: 'instant',
  ARCADE: 'arcade',
  TABLE: 'table'
};

export const GAMES: GameDefinition[] = [
  // --------------------------------------------------------------------------
  // GAME 01: FOUR-DIGIT LOTTERY
  // --------------------------------------------------------------------------
  {
    id: 'lottery',
    name: 'Four-Digit Lottery',
    shortName: 'Lottery',
    slug: 'four-digit-lottery',
    aliases: ['lottery', '4-digit-lottery'],
    category: GAME_CATEGORIES.LOTTERY,
    badge: 'JACKPOT',
    themeColor: '#ffd700',
    icon: '/items/Four Digit Lottery.jpg',
    image: '/items/Four Digit Lottery.jpg',
    description: 'Pick your lucky 4-digit number (0000–9999) and win huge USDT jackpot pools with transparent draws.',
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
    features: ['4-Digit Sequence (0000-9999)', 'Multiple Rounds', 'Instant Audit Log', 'Realtime Countdown', 'Direct USDT Disbursal'],
    rules: [
      'Select any 4-digit combination between 0000 and 9999.',
      'Purchase tickets using your available USDT balance.',
      'When the round timer concludes, the server-side Oracle finalizes winning digits.',
      'Exact matches share the pool jackpot based on configured winner distribution rules.'
    ],
    instructions: 'Use the number dials or quick-pick keypad to select your numbers, then click "Buy Ticket".'
  },

  // --------------------------------------------------------------------------
  // GAME 02: CRASH
  // --------------------------------------------------------------------------
  {
    id: 'crash',
    name: 'Crash',
    shortName: 'Crash',
    slug: 'crash',
    category: GAME_CATEGORIES.INSTANT,
    badge: 'HOT',
    themeColor: '#f97316',
    icon: '/items/Crash.jpg',
    image: '/items/Crash.jpg',
    description: 'Watch the multiplier climb from 1.00x upward. Cash out before the rocket crashes to multiply your USDT!',
    rtp: 99.0,
    houseEdge: 1.0,
    minStakeUSDT: 1,
    maxStakeUSDT: 1000,
    defaultStakeUSDT: 10,
    minStakeFC: 1,
    maxStakeFC: 1000,
    defaultStakeFC: 10,
    maxMultiplier: 1000.0,
    isProvablyFair: true,
    status: 'active',
    features: ['Realtime Canvas Curve', 'Auto-Cashout Target', 'Live Players Bets', '1% House Edge', 'Instant USDT Payout'],
    rules: [
      'Place your stake in USDT before the launch begins.',
      'Watch multiplier increase exponentially in real time.',
      'Press Cashout to lock in your payout before crash occurs.',
      'If rocket crashes before cashout, the round is lost.'
    ],
    instructions: 'Set your bet amount in USDT and optional auto-cashout multiplier, then click "Launch".'
  },

  // --------------------------------------------------------------------------
  // GAME 03: DICE
  // --------------------------------------------------------------------------
  {
    id: 'dice',
    name: 'Dice',
    shortName: 'Dice',
    slug: 'dice',
    category: GAME_CATEGORIES.INSTANT,
    badge: 'CLASSIC',
    themeColor: '#3b82f6',
    icon: '/items/Dice.jpg',
    image: '/items/Dice.jpg',
    description: 'Classic lucky slider dice. Predict Roll Over or Roll Under from 0.00 to 99.99 for customizable odds in USDT.',
    rtp: 99.0,
    houseEdge: 1.0,
    minStakeUSDT: 1,
    maxStakeUSDT: 2000,
    defaultStakeUSDT: 10,
    minStakeFC: 1,
    maxStakeFC: 2000,
    defaultStakeFC: 10,
    maxMultiplier: 990.0,
    isProvablyFair: true,
    status: 'active',
    features: ['Smooth Canvas Slider', 'Roll Over / Under Switch', 'Dynamic Multiplier (1.01x - 990x)', '1% House Edge'],
    rules: [
      'Choose your target roll number between 1.00 and 98.00.',
      'Select whether outcome will roll OVER or UNDER your target.',
      'Win probability and multiplier adjust dynamically.',
      'If rolled number satisfies condition, payout is instantly credited in USDT.'
    ],
    instructions: 'Adjust target slider to modify win chance and multiplier, enter USDT stake, and press Roll Dice.'
  },

  // --------------------------------------------------------------------------
  // GAME 04: COINFLIP
  // --------------------------------------------------------------------------
  {
    id: 'coinflip',
    name: 'Coinflip',
    shortName: 'Coinflip',
    slug: 'coinflip',
    category: GAME_CATEGORIES.INSTANT,
    badge: 'FAST',
    themeColor: '#eab308',
    icon: '/items/Coinflip.jpg',
    image: '/items/Coinflip.jpg',
    description: 'Pure 50/50 heads or tails coin toss. Double your USDT stake with lightning fast 1.98x instant flips!',
    rtp: 99.0,
    houseEdge: 1.0,
    minStakeUSDT: 1,
    maxStakeUSDT: 2500,
    defaultStakeUSDT: 10,
    minStakeFC: 1,
    maxStakeFC: 2500,
    defaultStakeFC: 10,
    maxMultiplier: 1.98,
    isProvablyFair: true,
    status: 'active',
    features: ['3D Coin Toss Animation', 'Heads or Tails Choice', 'Fixed 1.98x Payout', 'Streak Tracker'],
    rules: [
      'Select your side: Heads (Gold) or Tails (Silver).',
      'Enter your USDT stake and flip the coin.',
      'Win 1.98x your stake on correct prediction.',
      'Build consecutive winning streaks for leaderboard bragging rights.'
    ],
    instructions: 'Pick Heads or Tails, set USDT stake, and tap Flip Coin.'
  },

  // --------------------------------------------------------------------------
  // GAME 05: BINGO – COLOR TRADING
  // --------------------------------------------------------------------------
  {
    id: 'bingo',
    name: 'Bingo – Color Trading',
    shortName: 'Bingo',
    slug: 'bingo-color-trading',
    aliases: ['bingo', 'color-trading', 'bingo-color'],
    category: GAME_CATEGORIES.ARCADE,
    badge: 'TRADING',
    themeColor: '#8b5cf6',
    icon: '/items/Color.jpg',
    image: '/items/Color.jpg',
    description: 'Fast-paced color prediction. Pick Red, Green, Violet, Numbers (0–9), or Big/Small with instant USDT payouts!',
    rtp: 98.0,
    houseEdge: 2.0,
    minStakeUSDT: 1,
    maxStakeUSDT: 1000,
    defaultStakeUSDT: 10,
    minStakeFC: 1,
    maxStakeFC: 1000,
    defaultStakeFC: 10,
    maxMultiplier: 9.0,
    isProvablyFair: true,
    status: 'active',
    features: ['Red / Green / Violet Trades', 'Numbers 0 to 9 (9x Payout)', 'Big (5-9) & Small (0-4)', '60s Rapid Draw Cycles', 'Direct USDT Settlement'],
    rules: [
      'Green wins on 1, 3, 7, 9 (2x payout in USDT). If 5 appears with Violet, half split applies.',
      'Red wins on 2, 4, 6, 8 (2x payout in USDT). If 0 appears with Violet, half split applies.',
      'Violet wins on 0 and 5 (4.5x payout in USDT).',
      'Select any single number 0–9 for a 9x USDT payout. Big (5–9) or Small (0–4) pays 1.98x.'
    ],
    instructions: 'Select your chosen color, number, or size category, set your USDT stake, and trade before the round countdown completes.'
  },

  // --------------------------------------------------------------------------
  // GAME 06: HORSE RACING
  // --------------------------------------------------------------------------
  {
    id: 'horse-racing',
    name: 'Horse Racing',
    shortName: 'Horse Racing',
    slug: 'horse-racing',
    aliases: ['horse-racing', 'derby', 'racing'],
    category: GAME_CATEGORIES.TABLE,
    badge: 'DERBY',
    themeColor: '#10b981',
    icon: '/items/Horse Racing.jpg',
    image: '/items/Horse Racing.jpg',
    description: 'Live virtual derby turf racing. Back your champion thoroughbred from 6 horses with fixed odds up to 35.0x in USDT!',
    rtp: 97.5,
    houseEdge: 2.5,
    minStakeUSDT: 1,
    maxStakeUSDT: 1000,
    defaultStakeUSDT: 10,
    minStakeFC: 1,
    maxStakeFC: 1000,
    defaultStakeFC: 10,
    maxMultiplier: 35.0,
    isProvablyFair: true,
    status: 'active',
    features: ['6-Runner Thoroughbred Sprint', 'Fixed Odds (2.4x to 35.0x)', 'Realtime Visual Track Sprint', 'Win & Place Betting in USDT'],
    rules: [
      'Study the 6 competing horses, their post positions, and live odds.',
      'Place your USDT stake on your chosen horse to Win.',
      'Watch the thoroughbreds sprint down the turf in real time.',
      'If your horse crosses the finish line first, receive your USDT payout instantly!'
    ],
    instructions: 'Select your winning horse from the roster, enter your USDT bet, and watch the live virtual derby sprint.'
  }
];

// Helper to look up game by ID or slug
export function getGameById(idOrSlug: string): GameDefinition | undefined {
  if (!idOrSlug) return undefined;
  const lower = idOrSlug.toLowerCase();
  return GAMES.find(g => 
    g.id.toLowerCase() === lower || 
    g.slug.toLowerCase() === lower ||
    (g.aliases && g.aliases.some(a => a.toLowerCase() === lower))
  );
}

// Helper to get game icon image URL with fallback
export function getGameIconUrl(gameId: GameId | string): string {
  const g = typeof gameId === 'string' ? getGameById(gameId) : GAMES.find(x => x.id === gameId);
  if (g?.icon) return g.icon;
  if (gameId === 'bingo' || gameId === 'color-trading') return '/items/Color.jpg';
  if (gameId === 'horse-racing') return '/items/Horse Racing.jpg';
  if (gameId === 'lottery') return '/items/Four Digit Lottery.jpg';
  if (gameId === 'crash') return '/items/Crash.jpg';
  if (gameId === 'dice') return '/items/Dice.jpg';
  if (gameId === 'coinflip') return '/items/Coinflip.jpg';
  return `/items/${gameId}.jpg`;
}

// Helper to get fallback artwork URL
export function getGameFallbackIconUrl(gameId: GameId | string): string {
  if (gameId === 'bingo' || gameId === 'color-trading') return '/items/Color.jpg';
  if (gameId === 'horse-racing') return '/items/Horse Racing.jpg';
  if (gameId === 'lottery') return '/items/Four Digit Lottery.jpg';
  if (gameId === 'crash') return '/items/Crash.jpg';
  if (gameId === 'dice') return '/items/Dice.jpg';
  if (gameId === 'coinflip') return '/items/Coinflip.jpg';
  return `/items/${gameId}.jpg`;
}

// Helper to get active games list
export function getActiveGames(): GameDefinition[] {
  return GAMES.filter(g => g.status === 'active');
}
