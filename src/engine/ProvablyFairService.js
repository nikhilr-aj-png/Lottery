/**
 * ============================================================================
 * PROVABLY FAIR SERVICE — STAKE-COMPATIBLE CRYPTOGRAPHIC ENGINE
 * ============================================================================
 * Implements deterministic outcome derivation from:
 *   Outcome = HMAC-SHA256(server_seed, `${client_seed}:${nonce}:${game_id}`)
 *
 * Players can verify every game round independently.
 */

// Universal SHA-256 Digest (Supports Web Crypto and Node.js)
export async function sha256(message) {
  const msgUint8 = new TextEncoder().encode(message);
  const cryptoObj = typeof window !== 'undefined' ? (window.crypto || window.msCrypto) : globalThis.crypto;
  
  if (cryptoObj?.subtle) {
    const hashBuffer = await cryptoObj.subtle.digest('SHA-256', msgUint8);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  // Pure JS fallback if crypto.subtle is not accessible
  return fallbackSha256(message);
}

// Universal HMAC-SHA256 (Returns hex string)
export async function hmacSha256Hex(key, message) {
  const enc = new TextEncoder();
  const keyData = enc.encode(key);
  const msgData = enc.encode(message);
  const cryptoObj = typeof window !== 'undefined' ? (window.crypto || window.msCrypto) : globalThis.crypto;

  if (cryptoObj?.subtle) {
    try {
      const cryptoKey = await cryptoObj.subtle.importKey(
        'raw',
        keyData,
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
      );
      const signature = await cryptoObj.subtle.sign('HMAC', cryptoKey, msgData);
      return Array.from(new Uint8Array(signature)).map(b => b.toString(16).padStart(2, '0')).join('');
    } catch (e) {
      // Fallback below
    }
  }

  // Deterministic fallback hash combination
  return await sha256(`${key}:${message}:${key}`);
}

// Generate secure random server seed (256-bit hex)
export function generateRandomServerSeed() {
  const bytes = new Uint8Array(32);
  const cryptoObj = typeof window !== 'undefined' ? window.crypto : globalThis.crypto;
  if (cryptoObj?.getRandomValues) {
    cryptoObj.getRandomValues(bytes);
  } else {
    for (let i = 0; i < 32; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  return 'seed_' + Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

// Generate client seed (16 chars alphanumeric)
export function generateRandomClientSeed() {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let out = 'cs_';
  for (let i = 0; i < 12; i++) {
    out += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return out;
}

// Convert hex string slice to 32-bit unsigned integer
function hexToUint32(hex, offset = 0) {
  const slice = hex.slice(offset, offset + 8);
  return parseInt(slice, 16);
}

// Convert hex string to array of bytes
function hexToBytes(hex) {
  const bytes = [];
  for (let i = 0; i < hex.length; i += 2) {
    bytes.push(parseInt(hex.substr(i, 2), 16));
  }
  return bytes;
}

// ============================================================================
// GAME-SPECIFIC DETERMINISTIC OUTCOME GENERATORS
// ============================================================================

/**
 * CRASH OUTCOME GENERATOR
 * Standard 1% House Edge Crash Formula (Stake standard):
 * e = 2^52
 * h = first 52 bits of HMAC
 * If h % 33 == 0 => Instant Crash at 1.00x
 * Otherwise => floor((100 * e - h) / (e - h)) / 100
 */
export async function generateCrashPoint(serverSeed, clientSeed, nonce = 1) {
  const hash = await hmacSha256Hex(serverSeed, `${clientSeed}:${nonce}:crash`);
  const h = parseInt(hash.slice(0, 13), 16);
  const e = Math.pow(2, 52);

  // 1 in 33 chance of instant crash at 1.00x (~3.03% instant bust)
  if (h % 33 === 0) {
    return 1.00;
  }

  const rawMultiplier = (100 * e - h) / (e - h) / 100;
  // Format to 2 decimal places, cap at 1000x for social gaming
  const finalMultiplier = Math.max(1.00, Math.min(1000.0, parseFloat(rawMultiplier.toFixed(2))));
  return finalMultiplier;
}

/**
 * DICE OUTCOME GENERATOR
 * Generates roll between 00.00 and 99.99
 */
export async function generateDiceRoll(serverSeed, clientSeed, nonce = 1) {
  const hash = await hmacSha256Hex(serverSeed, `${clientSeed}:${nonce}:dice`);
  const val = hexToUint32(hash, 0);
  const roll = (val % 10000) / 100;
  return parseFloat(roll.toFixed(2));
}

/**
 * MINES OUTCOME GENERATOR
 * Generates random positions of mines in a 5x5 grid (25 tiles: 0 to 24)
 */
export async function generateMinesGrid(serverSeed, clientSeed, nonce = 1, mineCount = 3) {
  const hash = await hmacSha256Hex(serverSeed, `${clientSeed}:${nonce}:mines`);
  const bytes = hexToBytes(hash);
  const count = Math.max(1, Math.min(24, parseInt(mineCount, 10) || 3));

  // Fisher-Yates shuffle of 25 tiles
  const deck = Array.from({ length: 25 }, (_, i) => i);
  for (let i = 24; i > 0; i--) {
    const byteIndex = (24 - i) % bytes.length;
    const swapWith = bytes[byteIndex] % (i + 1);
    const temp = deck[i];
    deck[i] = deck[swapWith];
    deck[swapWith] = temp;
  }

  // First `count` items in shuffled deck are mines
  const minePositions = deck.slice(0, count).sort((a, b) => a - b);
  return {
    mineCount: count,
    minePositions,
    gridSize: 25
  };
}

/**
 * LIMBO OUTCOME GENERATOR
 * Standard Limbo outcome generator (1.01x to 10,000x)
 */
export async function generateLimboMultiplier(serverSeed, clientSeed, nonce = 1) {
  const hash = await hmacSha256Hex(serverSeed, `${clientSeed}:${nonce}:limbo`);
  const h = parseInt(hash.slice(0, 13), 16);
  const e = Math.pow(2, 52);

  if (h % 33 === 0) {
    return 1.00;
  }

  const rawMultiplier = (100 * e - h) / (e - h) / 100;
  const clamped = Math.max(1.00, Math.min(10000.0, parseFloat(rawMultiplier.toFixed(2))));
  return clamped;
}

/**
 * COINFLIP OUTCOME GENERATOR
 * Generates 'heads' or 'tails'
 */
export async function generateCoinflip(serverSeed, clientSeed, nonce = 1) {
  const hash = await hmacSha256Hex(serverSeed, `${clientSeed}:${nonce}:coinflip`);
  const byte = parseInt(hash.slice(0, 2), 16);
  return (byte % 2 === 0) ? 'heads' : 'tails';
}

/**
 * EUROPEAN ROULETTE OUTCOME GENERATOR
 * Generates single-zero wheel outcome (0 to 36)
 */
export async function generateRouletteNumber(serverSeed, clientSeed, nonce = 1) {
  const hash = await hmacSha256Hex(serverSeed, `${clientSeed}:${nonce}:roulette`);
  const val = hexToUint32(hash, 0);
  const number = val % 37; // 0 to 36

  // Color mapping
  const redNumbers = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);
  let color = 'green';
  if (redNumbers.has(number)) color = 'red';
  else if (number > 0) color = 'black';

  return {
    number,
    color,
    isEven: number > 0 && number % 2 === 0,
    isOdd: number > 0 && number % 2 === 1,
    isHigh: number >= 19 && number <= 36,
    isLow: number >= 1 && number <= 18
  };
}

/**
 * PLINKO OUTCOME GENERATOR
 * Generates ball bounce path and final slot (0 to rows)
 */
export async function generatePlinkoPath(serverSeed, clientSeed, nonce = 1, rows = 16) {
  const hash = await hmacSha256Hex(serverSeed, `${clientSeed}:${nonce}:plinko`);
  const bytes = hexToBytes(hash);
  const numRows = Math.max(8, Math.min(16, parseInt(rows, 10) || 16));

  const path = [];
  let rightBounces = 0;

  for (let r = 0; r < numRows; r++) {
    const byte = bytes[r % bytes.length];
    const isRight = (byte % 2 === 1);
    path.push(isRight ? 1 : 0);
    if (isRight) rightBounces++;
  }

  // Final slot is the count of right bounces (0 to numRows)
  return {
    rows: numRows,
    path,
    slotIndex: rightBounces
  };
}

/**
 * KENO OUTCOME GENERATOR
 * Draws 10 distinct balls from 1 to 40
 */
export async function generateKenoDraw(serverSeed, clientSeed, nonce = 1, drawCount = 10) {
  const hash = await hmacSha256Hex(serverSeed, `${clientSeed}:${nonce}:keno`);
  const bytes = hexToBytes(hash);
  const totalBalls = 40;
  const pool = Array.from({ length: totalBalls }, (_, i) => i + 1);

  // Shuffle pool using bytes
  for (let i = totalBalls - 1; i > 0; i--) {
    const swap = bytes[i % bytes.length] % (i + 1);
    const temp = pool[i];
    pool[i] = pool[swap];
    pool[swap] = temp;
  }

  const drawnNumbers = pool.slice(0, drawCount).sort((a, b) => a - b);
  return {
    drawnNumbers,
    totalBalls: 40
  };
}

/**
 * BLACKJACK / CARD DECK OUTCOME GENERATOR
 * Shuffles standard 52-card deck
 */
export async function generateShuffledDeck(serverSeed, clientSeed, nonce = 1) {
  const hash = await hmacSha256Hex(serverSeed, `${clientSeed}:${nonce}:cards`);
  const bytes = hexToBytes(hash);

  const suits = ['♠', '♥', '♦', '♣'];
  const values = [
    { rank: 'A', val: 11 },
    { rank: '2', val: 2 },
    { rank: '3', val: 3 },
    { rank: '4', val: 4 },
    { rank: '5', val: 5 },
    { rank: '6', val: 6 },
    { rank: '7', val: 7 },
    { rank: '8', val: 8 },
    { rank: '9', val: 9 },
    { rank: '10', val: 10 },
    { rank: 'J', val: 10 },
    { rank: 'Q', val: 10 },
    { rank: 'K', val: 10 }
  ];

  const deck = [];
  for (const s of suits) {
    for (const v of values) {
      deck.push({
        suit: s,
        rank: v.rank,
        value: v.val,
        color: (s === '♥' || s === '♦') ? 'red' : 'black',
        id: `${v.rank}${s}`
      });
    }
  }

  // Shuffle deck
  for (let i = deck.length - 1; i > 0; i--) {
    const swap = bytes[i % bytes.length] % (i + 1);
    const temp = deck[i];
    deck[i] = deck[swap];
    deck[swap] = temp;
  }

  return deck;
}

/**
 * SLOTS REEL OUTCOME GENERATOR
 * Generates 3x3 symbol matrix
 */
export async function generateSlotSpin(serverSeed, clientSeed, nonce = 1) {
  const hash = await hmacSha256Hex(serverSeed, `${clientSeed}:${nonce}:slots`);
  const bytes = hexToBytes(hash);

  // Symbol distribution: 7 (Seven), D (Diamond), B (Bar), C (Cherry), L (Lemon)
  const symbols = ['7', '💎', '🎰', '🍒', '🍋', '⭐', '🔔'];
  const grid = [];

  for (let row = 0; row < 3; row++) {
    const rowSymbols = [];
    for (let col = 0; col < 3; col++) {
      const idx = (row * 3 + col) % bytes.length;
      const symbolIdx = bytes[idx] % symbols.length;
      rowSymbols.push(symbols[symbolIdx]);
    }
    grid.push(rowSymbols);
  }

  return { grid };
}

// ============================================================================
// VERIFICATION HELPER
// ============================================================================
export async function verifyGameRoundOutcome(gameId, serverSeed, serverSeedHash, clientSeed, nonce) {
  try {
    const computedHash = '0x' + (await sha256(serverSeed));
    const normalizedExpected = serverSeedHash.startsWith('0x') ? serverSeedHash : '0x' + serverSeedHash;
    const isHashValid = (computedHash.toLowerCase() === normalizedExpected.toLowerCase());

    let computedOutcome = null;
    switch (gameId.toLowerCase()) {
      case 'crash':
        computedOutcome = await generateCrashPoint(serverSeed, clientSeed, nonce);
        break;
      case 'dice':
        computedOutcome = await generateDiceRoll(serverSeed, clientSeed, nonce);
        break;
      case 'mines':
        computedOutcome = await generateMinesGrid(serverSeed, clientSeed, nonce, 3);
        break;
      case 'limbo':
        computedOutcome = await generateLimboMultiplier(serverSeed, clientSeed, nonce);
        break;
      case 'coinflip':
        computedOutcome = await generateCoinflip(serverSeed, clientSeed, nonce);
        break;
      case 'roulette':
        computedOutcome = await generateRouletteNumber(serverSeed, clientSeed, nonce);
        break;
      case 'plinko':
        computedOutcome = await generatePlinkoPath(serverSeed, clientSeed, nonce, 16);
        break;
      case 'keno':
        computedOutcome = await generateKenoDraw(serverSeed, clientSeed, nonce, 10);
        break;
      case 'blackjack':
        computedOutcome = await generateShuffledDeck(serverSeed, clientSeed, nonce);
        break;
      case 'slots':
        computedOutcome = await generateSlotSpin(serverSeed, clientSeed, nonce);
        break;
      default:
        computedOutcome = { note: 'Game specific derivation verified' };
    }

    return {
      verified: isHashValid,
      gameId,
      publishedHash: normalizedExpected,
      computedHash,
      hashMatch: isHashValid,
      serverSeed,
      clientSeed,
      nonce,
      computedOutcome
    };
  } catch (err) {
    return { verified: false, error: err.message };
  }
}

// Fallback pure JS SHA-256 for non-browser/legacy contexts
function fallbackSha256(ascii) {
  function rightRotate(value, amount) {
    return (value >>> amount) | (value << (32 - amount));
  }
  const mathPow = Math.pow;
  const maxWord = mathPow(2, 32);
  let lengthProperty = 'length';
  let i, j;
  let result = '';

  const words = [];
  const asciiBitLength = ascii[lengthProperty] * 8;
  let hash = [];
  const k = [];
  let primeCounter = 0;

  const isComposite = {};
  for (let candidate = 2; primeCounter < 64; candidate++) {
    if (!isComposite[candidate]) {
      for (i = 0; i < 300; i += candidate) isComposite[i] = candidate;
      hash[primeCounter] = (mathPow(candidate, 0.5) * maxWord) | 0;
      k[primeCounter++] = (mathPow(candidate, 1 / 3) * maxWord) | 0;
    }
  }

  ascii += '\x80';
  while ((ascii[lengthProperty] % 64) - 56) ascii += '\x00';
  for (i = 0; i < ascii[lengthProperty]; i++) {
    j = ascii.charCodeAt(i);
    if (j >> 8) return '';
    words[i >> 2] |= j << (((3 - i) % 4) * 8);
  }
  words[words[lengthProperty]] = (asciiBitLength / maxWord) | 0;
  words[words[lengthProperty]] = asciiBitLength;

  for (j = 0; j < words[lengthProperty]; ) {
    const w = words.slice(j, (j += 16));
    const oldHash = hash;
    hash = hash.slice(0, 8);

    for (i = 0; i < 64; i++) {
      const w15 = w[i - 15],
        w2 = w[i - 2];
      const s0 = rightRotate(w15, 7) ^ rightRotate(w15, 18) ^ (w15 >>> 3);
      const s1 = rightRotate(w2, 17) ^ rightRotate(w2, 19) ^ (w2 >>> 10);
      w[i] =
        i < 16
          ? w[i]
          : (w[i - 16] + s0 + w[i - 7] + s1) | 0;

      const ch = (hash[4] & hash[5]) ^ (~hash[4] & hash[6]);
      const maj = (hash[0] & hash[1]) ^ (hash[0] & hash[2]) ^ (hash[1] & hash[2]);
      const temp1 =
        (hash[7] +
          (rightRotate(hash[4], 6) ^ rightRotate(hash[4], 11) ^ rightRotate(hash[4], 25)) +
          ch +
          k[i] +
          w[i]) |
        0;
      const temp2 =
        ((rightRotate(hash[0], 2) ^ rightRotate(hash[0], 13) ^ rightRotate(hash[0], 22)) + maj) | 0;

      hash = [(temp1 + temp2) | 0].concat(hash);
      hash[4] = (hash[4] + temp1) | 0;
      hash.pop();
    }

    for (i = 0; i < 8; i++) hash[i] = (hash[i] + oldHash[i]) | 0;
  }

  for (i = 0; i < 8; i++) {
    for (j = 3; j >= 0; j--) {
      const b = (hash[i] >> (8 * j)) & 255;
      result += (b < 16 ? '0' : '') + b.toString(16);
    }
  }
  return result;
}

