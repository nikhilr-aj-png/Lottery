/**
 * ============================================================================
 * UNIVERSAL GAME REGISTRY — ALL 12 CASINO & LOTTERY GAMES
 * ============================================================================
 * Modular configuration and metadata for every game on the platform.
 * Supports: Lottery, Crash, Dice, Mines, Plinko, Roulette, Coinflip,
 *           Blackjack, Slots, Poker, Keno, Limbo.
 */

import { GameDefinition, GameCategory, GameId } from '../types/games';

export const GAME_CATEGORIES: Record<string, GameCategory> = {
  ALL: 'all',
  LOTTERY: 'lottery',
  INSTANT: 'instant',
  TABLE: 'table',
  ARCADE: 'arcade',
  CARD: 'card',
  SLOTS: 'slots'
};

export const GAMES: GameDefinition[] = [
  // --------------------------------------------------------------------------
  // GAME 01: FOUR-DIGIT LOTTERY (EXISTING & HARDENED)
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
    description: 'Pick your lucky 4-digit number (0000–9999) and win huge Flow Coin jackpot pots with provably fair draws.',
    rtp: 95.0,
    houseEdge: 5.0,
    minStakeFC: 1,
    maxStakeFC: 500,
    defaultStakeFC: 10,
    maxMultiplier: 1000.0,
    isProvablyFair: true,
    status: 'active',
    releaseDate: '2026-01-01',
    features: ['4-Digit Sequence (0000-9999)', 'Multiple Rounds', 'Instant Audit Log', 'Realtime Countdown'],
    rules: [
      'Select any 4-digit combination between 0000 and 9999.',
      'Purchase tickets using your Flow Coin balance.',
      'When round timer concludes, server-side provably fair Oracle finalizes winning digits.',
      'Exact matches share the pool jackpot equally based on pure luck.'
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
    description: 'Watch the multiplier climb from 1.00x upward. Cash out before the rocket crashes to multiply your Flow Coins!',
    rtp: 99.0,
    houseEdge: 1.0,
    minStakeFC: 1,
    maxStakeFC: 1000,
    defaultStakeFC: 10,
    maxMultiplier: 1000.0,
    isProvablyFair: true,
    status: 'active',
    features: ['Realtime Canvas Curve', 'Auto-Cashout Target', 'Live Players Bets', '1% House Edge'],
    rules: [
      'Place your stake in Flow Coins before the launch begins.',
      'Watch multiplier increase exponentially in real time.',
      'Press Cashout to lock in your payout before crash occurs.',
      'If rocket crashes before cashout, the round is lost.'
    ],
    instructions: 'Set your bet amount and optional auto-cashout multiplier, then click "Launch".'
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
    description: 'Roll the provably fair 100-sided die. Choose Roll Over or Roll Under and adjust win probability up to 99%.',
    rtp: 99.0,
    houseEdge: 1.0,
    minStakeFC: 1,
    maxStakeFC: 2000,
    defaultStakeFC: 10,
    maxMultiplier: 990.0,
    isProvablyFair: true,
    status: 'active',
    features: ['Roll Over / Roll Under', 'Dynamic Slider (1.00 - 98.00)', 'Instant Roll Result', 'Custom Client Seed'],
    rules: [
      'Select Roll Over or Roll Under mode.',
      'Adjust the slider to choose your target number between 1.00 and 98.00.',
      'Multiplier and win chance update automatically in real-time.',
      'Roll a number satisfying your condition to win the payout.'
    ],
    instructions: 'Slide to choose your win chance, then click "Roll Dice".'
  },

  // --------------------------------------------------------------------------
  // GAME 04: BINGO – COLOR TRADING
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
    icon: '/items/Bingo.jpg',
    image: '/items/Bingo.jpg',
    description: 'Fast-paced provably fair color prediction. Pick Red, Green, Violet, Numbers (0–9), or Big/Small with instant payouts!',
    rtp: 98.0,
    houseEdge: 2.0,
    minStakeFC: 1,
    maxStakeFC: 1000,
    defaultStakeFC: 10,
    maxMultiplier: 9.0,
    isProvablyFair: true,
    status: 'active',
    features: ['Red / Green / Violet', 'Numbers 0 to 9 (9x Payout)', 'Big (5-9) & Small (0-4)', '60s Rapid Draw Cycles'],
    rules: [
      'Green wins on 1, 3, 7, 9 (2x payout). If 5 appears with Violet, half split applies.',
      'Red wins on 2, 4, 6, 8 (2x payout). If 0 appears with Violet, half split applies.',
      'Violet wins on 0 and 5 (4.5x payout).',
      'Select any number 0–9 for a 9x payout. Big (5–9) or Small (0–4) pays 1.98x.'
    ],
    instructions: 'Select your chosen color, number, or size category, set stake, and trade before the round countdown completes.'
  },

  // --------------------------------------------------------------------------
  // GAME 05: HORSE RACING
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
    description: 'Live virtual derby turf racing. Back your champion thoroughbred from 6 horses with fixed odds up to 35.0x!',
    rtp: 97.5,
    houseEdge: 2.5,
    minStakeFC: 1,
    maxStakeFC: 1000,
    defaultStakeFC: 10,
    maxMultiplier: 35.0,
    isProvablyFair: true,
    status: 'active',
    features: ['6-Runner Thoroughbred Sprint', 'Fixed Odds (2.4x to 35.0x)', 'Realtime Visual Track Sprint', 'Win & Place Betting'],
    rules: [
      'Study the 6 competing horses, their post positions, and live odds.',
      'Place your Flow Coin stake on your chosen horse to Win.',
      'Watch the runners sprint down the turf in real time.',
      'If your horse crosses the finish line first, receive the payout instantly!'
    ],
    instructions: 'Select your winning horse from the roster, enter your bet, and watch the race.'
  },

  // --------------------------------------------------------------------------
  // GAME 06: ROULETTE
  // --------------------------------------------------------------------------
  {
    id: 'roulette',
    name: 'European Roulette',
    shortName: 'Roulette',
    slug: 'european-roulette',
    aliases: ['roulette'],
    category: GAME_CATEGORIES.TABLE,
    badge: 'CASINO VIP',
    themeColor: '#dc2626',
    icon: '/items/European Roulette.jpg',
    image: '/items/European Roulette.jpg',
    description: 'Classic European Roulette wheel with single green zero (0) and 36 red and black numbers. Place inside or outside bets.',
    rtp: 97.3,
    houseEdge: 2.7,
    minStakeFC: 1,
    maxStakeFC: 1000,
    defaultStakeFC: 10,
    maxMultiplier: 36.0,
    isProvablyFair: true,
    status: 'active',
    features: ['Single-Zero European Layout', 'Red/Black, Odd/Even, Dozens', 'Interactive Betting Board', 'Smooth Wheel Spin'],
    rules: [
      'Place chips on Red, Black, Odd, Even, Columns, Dozens, or Straight Up numbers (0-36).',
      'The ball spins in the wheel and rests in a pocket.',
      'Straight number pays 36x; Red/Black & Odd/Even pay 2x; Dozens pay 3x.'
    ],
    instructions: 'Click on betting board cells to place chips, then click "Spin".'
  },

  // --------------------------------------------------------------------------
  // GAME 07: COINFLIP
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
    description: 'The purest game of 50/50 luck. Pick Heads or Tails, flip the 3D coin, and double your Flow Coins instantly.',
    rtp: 98.0,
    houseEdge: 2.0,
    minStakeFC: 1,
    maxStakeFC: 2500,
    defaultStakeFC: 10,
    maxMultiplier: 1.98,
    isProvablyFair: true,
    status: 'active',
    features: ['3D Coin Flip Animation', 'Heads or Tails Choice', 'Streak Counter', 'Instant Result'],
    rules: [
      'Choose Heads (👑 Gold) or Tails (⚡ Silver).',
      'Flip the coin with provably fair server seed commitment.',
      'If your chosen side lands face-up, win 1.98x your stake.'
    ],
    instructions: 'Select Heads or Tails, enter your bet, and click "Flip Coin".'
  },

  // --------------------------------------------------------------------------
  // GAME 08: BLACKJACK
  // --------------------------------------------------------------------------
  {
    id: 'blackjack',
    name: 'Blackjack',
    shortName: 'Blackjack',
    slug: 'blackjack-21',
    aliases: ['blackjack', 'blackjack-21'],
    category: GAME_CATEGORIES.CARD,
    badge: 'STRATEGY',
    themeColor: '#10b981',
    icon: '/items/Black Jack.jpg',
    image: '/items/Black Jack.jpg',
    description: 'Beat the dealer by getting closer to 21 without going over. Features Hit, Stand, Double Down, and Dealer stands on 17.',
    rtp: 99.5,
    houseEdge: 0.5,
    minStakeFC: 1,
    maxStakeFC: 1000,
    defaultStakeFC: 10,
    maxMultiplier: 2.5,
    isProvablyFair: true,
    status: 'active',
    features: ['Hit, Stand, Double Down', 'Natural Blackjack 3:2 Payout', 'Dealer Stands on Soft 17', 'Card Deal Sound & FX'],
    rules: [
      'Numbered cards 2-10 hold face value; J, Q, K are 10; Aces are 1 or 11.',
      'Get closer to 21 than the dealer without busting (over 21).',
      'Natural Blackjack (Ace + 10-value card) pays 2.5x your bet.',
      'Dealer must hit until reaching at least 17.'
    ],
    instructions: 'Place your bet, receive 2 cards, and choose Hit or Stand.'
  },

  // --------------------------------------------------------------------------
  // GAME 09: SLOTS
  // --------------------------------------------------------------------------
  {
    id: 'slots',
    name: 'Golden Slot',
    shortName: 'Golden Slot',
    slug: 'golden-reels-slot',
    aliases: ['slots', 'golden-reels', 'golden-slot', 'golden-reels-slot'],
    category: GAME_CATEGORIES.SLOTS,
    badge: 'VEGAS',
    themeColor: '#8b5cf6',
    icon: '/items/Golden Slot.jpg',
    image: '/items/Golden Slot.jpg',
    description: 'Classic Vegas-style slot machine with 5 paylines, wild diamonds, golden sevens, lucky bars, and juicy cherries.',
    rtp: 97.5,
    houseEdge: 2.5,
    minStakeFC: 1,
    maxStakeFC: 500,
    defaultStakeFC: 10,
    maxMultiplier: 250.0,
    isProvablyFair: true,
    status: 'active',
    features: ['3x3 Reels with 5 Paylines', 'Scatter & Wild Diamonds', 'Authentic Spin FX', 'Transparent Paytable'],
    rules: [
      'Spin 3 reels to match symbols along 5 active paylines.',
      'Triple Sevens (777) pay 250x; Triple Diamonds pay 100x; Bars pay 50x; Fruit pays 10-25x.',
      'Wild diamonds substitute for any regular symbol to complete wins.'
    ],
    instructions: 'Select your bet size, and click "Spin" or use Spacebar.'
  },

  // --------------------------------------------------------------------------
  // GAME 10: POKER
  // --------------------------------------------------------------------------
  {
    id: 'poker',
    name: "Texas Hold'em Poker",
    shortName: 'Poker',
    slug: 'texas-holdem-poker',
    aliases: ['poker', 'texas-holdem'],
    category: GAME_CATEGORIES.CARD,
    badge: 'SKILL',
    themeColor: '#06b6d4',
    icon: "/items/Texas Hold'em poker.jpg",
    image: "/items/Texas Hold'em poker.jpg",
    description: 'High-stakes Texas Hold’em table action. Play your hole cards with the community flop, turn, and river against AI dealers.',
    rtp: 98.5,
    houseEdge: 1.5,
    minStakeFC: 5,
    maxStakeFC: 1000,
    defaultStakeFC: 25,
    maxMultiplier: 50.0,
    isProvablyFair: true,
    status: 'active',
    features: ['52-Card Deck Shuffler', 'Standard Hand Rankings', 'Pre-Flop, Flop, Turn & River', 'Multiplayer-Ready Architecture'],
    rules: [
      'Each player receives two private hole cards.',
      'Five community cards are dealt face-up (Flop, Turn, River).',
      'Make the best five-card poker hand using any combination of hole and community cards.',
      'Hand ranks: High Card < Pair < Two Pair < Three of a Kind < Straight < Flush < Full House < Four of a Kind < Straight Flush < Royal Flush.'
    ],
    instructions: 'Check, Bet, or Fold through the rounds to showdown.'
  },

  // --------------------------------------------------------------------------
  // GAME 11: KENO
  // --------------------------------------------------------------------------
  {
    id: 'keno',
    name: 'Classic Keno',
    shortName: 'Keno',
    slug: 'classic-keno',
    aliases: ['keno'],
    category: GAME_CATEGORIES.ARCADE,
    badge: 'LOTTO',
    themeColor: '#14b8a6',
    icon: '/items/Classic Keno.jpg',
    image: '/items/Classic Keno.jpg',
    description: 'Pick between 1 and 10 lucky numbers from a 40-ball board. 10 balls are drawn; match them for massive multiplier payouts!',
    rtp: 97.0,
    houseEdge: 3.0,
    minStakeFC: 1,
    maxStakeFC: 500,
    defaultStakeFC: 10,
    maxMultiplier: 500.0,
    isProvablyFair: true,
    status: 'active',
    features: ['40-Number Grid', 'Pick 1 to 10 Numbers', 'Dynamic Paytable', 'Rapid 10-Ball Draw'],
    rules: [
      'Select between 1 and 10 numbers from the 40 available numbers.',
      '10 winning numbers are drawn randomly using provably fair seeds.',
      'The more numbers you match (Hits), the higher your payout multiplier.'
    ],
    instructions: 'Pick your lucky numbers, choose your bet, and click "Start Draw".'
  },

  // --------------------------------------------------------------------------
  // GAME 12: LIMBO
  // --------------------------------------------------------------------------
  {
    id: 'limbo',
    name: 'Limbo',
    shortName: 'Limbo',
    slug: 'limbo',
    category: GAME_CATEGORIES.INSTANT,
    badge: '10,000X',
    themeColor: '#6366f1',
    icon: '/items/Limbo.jpg',
    image: '/items/Limbo.jpg',
    description: 'Target astronomical multipliers up to 10,000x! Set your target multiplier and see if the outcome flies higher.',
    rtp: 99.0,
    houseEdge: 1.0,
    minStakeFC: 1,
    maxStakeFC: 1000,
    defaultStakeFC: 10,
    maxMultiplier: 10000.0,
    isProvablyFair: true,
    status: 'active',
    features: ['Target Multipliers up to 10,000x', 'Instant Resolution', 'Win Chance Calculator', 'Custom Seed Management'],
    rules: [
      'Set your target multiplier between 1.01x and 10,000x.',
      'Win chance adjusts dynamically according to the target multiplier.',
      'A random multiplier is generated with provably fair outcome.',
      'If the generated multiplier is greater than or equal to your target, you win!'
    ],
    instructions: 'Enter your desired multiplier (e.g. 2.00x), then click "Play".'
  }
];

// Helper: Find game by ID, slug, or alias
export function getGameById(idOrSlug?: string | { id?: string; slug?: string } | null): GameDefinition | null {
  if (!idOrSlug) return null;
  const key = (typeof idOrSlug === 'object' && idOrSlug !== null 
    ? (idOrSlug.id || idOrSlug.slug || '') 
    : String(idOrSlug)).toLowerCase().trim();
  if (!key) return null;

  return GAMES.find(g => 
    g.id.toLowerCase() === key || 
    g.slug.toLowerCase() === key || 
    (Array.isArray(g.aliases) && g.aliases.some(a => a.toLowerCase() === key))
  ) || null;
}

// Helper: Filter games by category
export function getGamesByCategory(category?: string): GameDefinition[] {
  if (!category || category === GAME_CATEGORIES.ALL) {
    return GAMES;
  }
  return GAMES.filter(g => g.category.toLowerCase() === category.toLowerCase());
}

// Helper: Get list of active game IDs
export function getActiveGameIds(): GameId[] {
  return GAMES.filter(g => g.status === 'active').map(g => g.id);
}

// Helper: Get canonical icon URL for any game
export function getGameIconUrl(idOrSlug?: string | { id?: string; slug?: string } | null): string | null {
  if (!idOrSlug) return null;
  const key = (typeof idOrSlug === 'object' && idOrSlug !== null ? (idOrSlug.id || idOrSlug.slug) : idOrSlug)?.toLowerCase();
  switch (key) {
    case 'lottery':
    case 'four-digit-lottery':
      return '/items/Four Digit Lottery.jpg';
    case 'crash':
      return '/items/Crash.jpg';
    case 'dice':
      return '/items/Dice.jpg';
    case 'bingo':
    case 'bingo-color-trading':
      return '/items/Bingo.jpg';
    case 'horse-racing':
      return '/items/Horse Racing.jpg';
    case 'roulette':
    case 'european-roulette':
      return '/items/European Roulette.jpg';
    case 'coinflip':
      return '/items/Coinflip.jpg';
    case 'blackjack':
    case 'blackjack-21':
      return '/items/Black Jack.jpg';
    case 'slots':
    case 'golden-reels-slot':
      return '/items/Golden Slot.jpg';
    case 'poker':
    case 'texas-holdem-poker':
      return "/items/Texas Hold'em poker.jpg";
    case 'keno':
    case 'classic-keno':
      return '/items/Classic Keno.jpg';
    case 'limbo':
      return '/items/Limbo.jpg';
    default: {
      const g = getGameById(idOrSlug);
      return g?.icon || g?.image || null;
    }
  }
}

// Helper: Get fallback icon URL for any game in case primary file fails
export function getGameFallbackIconUrl(idOrSlug?: string | { id?: string; slug?: string } | null): string | null {
  if (!idOrSlug) return null;
  const key = (typeof idOrSlug === 'object' && idOrSlug !== null ? (idOrSlug.id || idOrSlug.slug) : idOrSlug)?.toLowerCase();
  switch (key) {
    case 'lottery':
    case 'four-digit-lottery':
      return '/items/lottery.jpg';
    case 'roulette':
    case 'european-roulette':
      return '/items/roulette.jpg';
    case 'blackjack':
    case 'blackjack-21':
      return '/items/blackjack.jpg';
    case 'slots':
    case 'golden-reels-slot':
      return '/items/slots.jpg';
    case 'poker':
    case 'texas-holdem-poker':
      return '/items/poker.jpg';
    case 'keno':
    case 'classic-keno':
      return '/items/keno.jpg';
    case 'crash':
      return '/items/Crash.jpg';
    case 'dice':
      return '/items/Dice.jpg';
    case 'bingo':
    case 'bingo-color-trading':
      return '/items/Bingo.jpg';
    case 'horse-racing':
      return '/items/Horse Racing.jpg';
    case 'coinflip':
      return '/items/Coinflip.jpg';
    case 'limbo':
      return '/items/Limbo.jpg';
    default:
      return null;
  }
}


