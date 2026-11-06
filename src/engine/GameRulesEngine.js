/**
 * ============================================================================
 * GAME RULES ENGINE — MATHEMATICS, PROBABILITIES & PAYOUT MULTIPLIERS
 * ============================================================================
 * Centralized calculation service for odds, probabilities, house edge,
 * and valid bet parameters across all modular casino games.
 */

import { getGameById } from './GameRegistry.js';

// Factorial / Combinations helper
function factorial(n) {
  if (n <= 1) return 1;
  let res = 1;
  for (let i = 2; i <= n; i++) res *= i;
  return res;
}

function combinations(n, k) {
  if (k < 0 || k > n) return 0;
  if (k === 0 || k === n) return 1;
  let c = 1;
  for (let i = 1; i <= k; i++) {
    c = (c * (n - (k - i))) / i;
  }
  return c;
}

// 1. General Stake Validation
export function validateBet(gameId, betAmountFC, userBalanceFC) {
  const game = getGameById(gameId);
  const amount = Number(betAmountFC);

  if (isNaN(amount) || amount <= 0) {
    return { valid: false, error: 'Bet amount must be greater than 0.' };
  }

  if (game) {
    if (amount < game.minStakeFC) {
      return { valid: false, error: `Minimum bet for ${game.name} is ${game.minStakeFC} FC.` };
    }
    if (amount > game.maxStakeFC) {
      return { valid: false, error: `Maximum bet for ${game.name} is ${game.maxStakeFC} FC.` };
    }
  }

  if (amount > Number(userBalanceFC || 0)) {
    return { valid: false, error: 'Insufficient Flow Coin balance. Claim your daily bonus or faucet!' };
  }

  return { valid: true, amount };
}

// 2. DICE CALCULATOR
export function calculateDiceMultiplier(target, mode = 'over', houseEdge = 1.0) {
  const t = Math.max(1.0, Math.min(98.0, parseFloat(target) || 50.0));
  const winChance = mode === 'over' ? (100 - t) : t;
  const safeChance = Math.max(0.01, Math.min(98.0, winChance));
  const rawMultiplier = (100 - houseEdge) / safeChance;
  return {
    target: t,
    mode,
    winChance: parseFloat(safeChance.toFixed(2)),
    multiplier: parseFloat(rawMultiplier.toFixed(4))
  };
}

// 3. MINES CALCULATOR
export function calculateMinesMultiplier(mineCount, gemsUncovered, houseEdge = 1.0) {
  const mines = Math.max(1, Math.min(24, parseInt(mineCount, 10) || 3));
  const gems = Math.max(0, Math.min(25 - mines, parseInt(gemsUncovered, 10) || 0));

  if (gems === 0) {
    return { multiplier: 1.0, nextMultiplier: 1.0, gems, mines };
  }

  // Combinatorics probability: C(25 - mines, gems) / C(25, gems)
  const totalComb = combinations(25, gems);
  const safeComb = combinations(25 - mines, gems);
  const prob = safeComb / totalComb;
  const multiplier = parseFloat(((1 - houseEdge / 100) / prob).toFixed(4));

  // Next gem multiplier
  let nextMultiplier = multiplier;
  if (gems < 25 - mines) {
    const nextTotal = combinations(25, gems + 1);
    const nextSafe = combinations(25 - mines, gems + 1);
    const nextProb = nextSafe / nextTotal;
    nextMultiplier = parseFloat(((1 - houseEdge / 100) / nextProb).toFixed(4));
  }

  return {
    multiplier: Math.max(1.01, multiplier),
    nextMultiplier: Math.max(multiplier, nextMultiplier),
    gems,
    mines,
    prob: parseFloat((prob * 100).toFixed(2))
  };
}

// 4. LIMBO CALCULATOR
export function calculateLimboOdds(targetMultiplier, houseEdge = 1.0) {
  const target = Math.max(1.01, Math.min(10000.0, parseFloat(targetMultiplier) || 2.0));
  const winChance = (100 - houseEdge) / target;
  return {
    targetMultiplier: target,
    winChance: parseFloat(winChance.toFixed(4))
  };
}

// 5. PLINKO PAYTABLES (Rows: 8, 10, 12, 14, 16)
export const PLINKO_PAYTABLES = {
  8: {
    low: [5.6, 2.1, 1.1, 1.0, 0.5, 1.0, 1.1, 2.1, 5.6],
    medium: [13, 3, 1.3, 0.7, 0.4, 0.7, 1.3, 3, 13],
    high: [29, 4, 1.5, 0.3, 0.2, 0.3, 1.5, 4, 29]
  },
  10: {
    low: [8.9, 3, 1.4, 1.1, 1.0, 0.5, 1.0, 1.1, 1.4, 3, 8.9],
    medium: [22, 5, 2, 1.4, 0.6, 0.4, 0.6, 1.4, 2, 5, 22],
    high: [76, 10, 3, 0.9, 0.2, 0.2, 0.2, 0.9, 3, 10, 76]
  },
  12: {
    low: [10, 3, 1.6, 1.4, 1.1, 1.0, 0.5, 1.0, 1.1, 1.4, 1.6, 3, 10],
    medium: [33, 11, 4, 2, 1.1, 0.6, 0.3, 0.6, 1.1, 2, 4, 11, 33],
    high: [170, 24, 8.1, 2, 0.7, 0.2, 0.2, 0.2, 0.7, 2, 8.1, 24, 170]
  },
  14: {
    low: [7.1, 4, 1.9, 1.4, 1.3, 1.1, 1.0, 0.5, 1.0, 1.1, 1.3, 1.4, 1.9, 4, 7.1],
    medium: [58, 15, 7, 4, 1.9, 1.0, 0.5, 0.2, 0.5, 1.0, 1.9, 4, 7, 15, 58],
    high: [420, 56, 18, 5, 1.9, 0.3, 0.2, 0.2, 0.2, 0.3, 1.9, 5, 18, 56, 420]
  },
  16: {
    low: [16, 9, 2, 1.4, 1.4, 1.2, 1.1, 1.0, 0.5, 1.0, 1.1, 1.2, 1.4, 1.4, 2, 9, 16],
    medium: [110, 41, 10, 5, 3, 1.5, 1.0, 0.5, 0.3, 0.5, 1.0, 1.5, 3, 5, 10, 41, 110],
    high: [1000, 130, 26, 9, 4, 2, 0.2, 0.2, 0.2, 0.2, 0.2, 2, 4, 9, 26, 130, 1000]
  }
};

export function getPlinkoMultiplier(rows, risk, slotIndex) {
  const r = PLINKO_PAYTABLES[rows] ? rows : 16;
  const profile = PLINKO_PAYTABLES[r][risk] || PLINKO_PAYTABLES[r].medium;
  const safeSlot = Math.max(0, Math.min(profile.length - 1, slotIndex));
  return profile[safeSlot] || 1.0;
}

// 6. ROULETTE PAYOUT TABLE
export const ROULETTE_PAYOUTS = {
  straight: 36.0,
  red: 2.0,
  black: 2.0,
  even: 2.0,
  odd: 2.0,
  low: 2.0,   // 1 - 18
  high: 2.0,  // 19 - 36
  dozen1: 3.0, // 1 - 12
  dozen2: 3.0, // 13 - 24
  dozen3: 3.0  // 25 - 36
};

// 7. KENO PAYTABLES (Picks 1 to 10)
export const KENO_PAYTABLES = {
  1: { 1: 3.8 },
  2: { 2: 15.0, 1: 1.5 },
  3: { 3: 45.0, 2: 3.0, 1: 1.0 },
  4: { 4: 90.0, 3: 8.0, 2: 1.8 },
  5: { 5: 150.0, 4: 18.0, 3: 3.5, 2: 1.2 },
  6: { 6: 250.0, 5: 45.0, 4: 7.0, 3: 2.0 },
  7: { 7: 350.0, 6: 80.0, 5: 18.0, 4: 4.0, 3: 1.5 },
  8: { 8: 400.0, 7: 120.0, 6: 35.0, 5: 9.0, 4: 2.5 },
  9: { 9: 450.0, 8: 180.0, 7: 60.0, 6: 15.0, 5: 4.0 },
  10: { 10: 500.0, 9: 250.0, 8: 90.0, 7: 25.0, 6: 7.0, 5: 2.0 }
};

export function getKenoMultiplier(pickCount, hitsCount) {
  const table = KENO_PAYTABLES[pickCount];
  if (!table) return 0;
  return table[hitsCount] || 0;
}

// 8. BLACKJACK HAND EVALUATOR
export function evaluateBlackjackHand(cards) {
  if (!Array.isArray(cards) || cards.length === 0) return { total: 0, isBusted: false, isSoft: false, isBlackjack: false };
  
  let total = 0;
  let aces = 0;

  for (const c of cards) {
    if (c.rank === 'A') {
      aces++;
      total += 11;
    } else {
      total += c.value;
    }
  }

  while (total > 21 && aces > 0) {
    total -= 10;
    aces--;
  }

  const isBlackjack = (cards.length === 2 && total === 21);
  const isBusted = total > 21;
  const isSoft = aces > 0;

  return { total, isBusted, isSoft, isBlackjack };
}

// 9. SLOTS WIN EVALUATOR (3x3 Matrix)
export const SLOTS_PAYTABLE = {
  '💎': 50.0,
  '7': 25.0,
  '🎰': 15.0,
  '⭐': 10.0,
  '🔔': 6.0,
  '🍒': 4.0,
  '🍋': 2.0
};

export function evaluateSlotsSpin(grid) {
  if (!grid || !Array.isArray(grid) || grid.length < 3) {
    return { totalMultiplier: 0, winningLines: [] };
  }

  const winningLines = [];
  let totalMultiplier = 0;

  // Paylines: 3 horizontal rows, 2 diagonals
  const lines = [
    { name: 'Top Row', symbols: [grid[0][0], grid[0][1], grid[0][2]], coords: [[0,0], [0,1], [0,2]] },
    { name: 'Middle Row', symbols: [grid[1][0], grid[1][1], grid[1][2]], coords: [[1,0], [1,1], [1,2]] },
    { name: 'Bottom Row', symbols: [grid[2][0], grid[2][1], grid[2][2]], coords: [[2,0], [2,1], [2,2]] },
    { name: 'Diagonal Top-Left to Bottom-Right', symbols: [grid[0][0], grid[1][1], grid[2][2]], coords: [[0,0], [1,1], [2,2]] },
    { name: 'Diagonal Bottom-Left to Top-Right', symbols: [grid[2][0], grid[1][1], grid[0][2]], coords: [[2,0], [1,1], [0,2]] }
  ];

  for (const line of lines) {
    const [s1, s2, s3] = line.symbols;
    if (s1 === s2 && s2 === s3) {
      const mult = SLOTS_PAYTABLE[s1] || 2.0;
      totalMultiplier += mult;
      winningLines.push({ name: line.name, symbol: s1, count: 3, multiplier: mult, coords: line.coords });
    } else if (line.name === 'Middle Row' && (s1 === s2 || s2 === s3)) {
      // 2 matching symbols on center payline pays small consolation (1.2x)
      const matchingSym = (s1 === s2) ? s1 : s2;
      const mult = 1.2;
      totalMultiplier += mult;
      winningLines.push({ name: 'Middle Row Pair', symbol: matchingSym, count: 2, multiplier: mult, coords: line.coords });
    }
  }

  return {
    totalMultiplier: parseFloat(totalMultiplier.toFixed(2)),
    winningLines
  };
}

// 10. TEXAS HOLD'EM POKER HAND EVALUATOR
const RANK_VALUES = {
  '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9,
  '10': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14
};

export function evaluatePokerHand(allCards) {
  if (!Array.isArray(allCards) || allCards.length < 5) {
    return { rankName: 'High Card', score: 1, description: 'Cards dealt' };
  }

  // Count ranks and suits
  const rankCounts = {};
  const suitCounts = {};
  const values = [];

  for (const c of allCards) {
    const val = RANK_VALUES[c.rank] || c.value || 0;
    values.push(val);
    rankCounts[val] = (rankCounts[val] || 0) + 1;
    suitCounts[c.suit] = (suitCounts[c.suit] || 0) + 1;
  }

  values.sort((a, b) => b - a);
  const uniqueVals = Array.from(new Set(values));

  // Check Flush (5 or more of same suit)
  const isFlush = Object.values(suitCounts).some(cnt => cnt >= 5);

  // Check Straight
  let isStraight = false;
  let straightHigh = 0;
  for (let i = 0; i <= uniqueVals.length - 5; i++) {
    if (uniqueVals[i] - uniqueVals[i + 4] === 4) {
      isStraight = true;
      straightHigh = uniqueVals[i];
      break;
    }
  }
  // Check Wheel Straight (A, 2, 3, 4, 5)
  if (!isStraight && uniqueVals.includes(14) && uniqueVals.includes(2) && uniqueVals.includes(3) && uniqueVals.includes(4) && uniqueVals.includes(5)) {
    isStraight = true;
    straightHigh = 5;
  }

  // Rank counts breakdown
  const counts = Object.values(rankCounts).sort((a, b) => b - a);

  if (isStraight && isFlush) {
    if (straightHigh === 14) {
      return { rankName: 'Royal Flush', score: 10, description: 'Royal Flush in ' + Object.keys(suitCounts).find(s => suitCounts[s] >= 5) };
    }
    return { rankName: 'Straight Flush', score: 9, description: 'Straight Flush high ' + straightHigh };
  }

  if (counts[0] === 4) {
    return { rankName: 'Four of a Kind', score: 8, description: 'Four of a Kind' };
  }

  if (counts[0] === 3 && counts[1] >= 2) {
    return { rankName: 'Full House', score: 7, description: 'Full House' };
  }

  if (isFlush) {
    return { rankName: 'Flush', score: 6, description: 'Flush' };
  }

  if (isStraight) {
    return { rankName: 'Straight', score: 5, description: 'Straight high ' + straightHigh };
  }

  if (counts[0] === 3) {
    return { rankName: 'Three of a Kind', score: 4, description: 'Three of a Kind' };
  }

  if (counts[0] === 2 && counts[1] === 2) {
    return { rankName: 'Two Pair', score: 3, description: 'Two Pair' };
  }

  if (counts[0] === 2) {
    return { rankName: 'One Pair', score: 2, description: 'One Pair' };
  }

  return { rankName: 'High Card', score: 1, description: 'High Card ' + (values[0] || 'A') };
}
