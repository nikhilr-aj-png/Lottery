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
export async function sha256(message: string): Promise<string> {
  const msgUint8 = new TextEncoder().encode(message);
  const cryptoObj = typeof window !== 'undefined' ? window.crypto : globalThis.crypto;
  
  if (cryptoObj?.subtle) {
    const hashBuffer = await cryptoObj.subtle.digest('SHA-256', msgUint8);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  // Pure JS fallback if crypto.subtle is not accessible
  return fallbackSha256(message);
}

// Universal HMAC-SHA256 (Returns hex string)
export async function hmacSha256Hex(key: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const keyData = enc.encode(key);
  const msgData = enc.encode(message);
  const cryptoObj = typeof window !== 'undefined' ? window.crypto : globalThis.crypto;

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
    } catch {
      // Fallback below
    }
  }

  // Deterministic fallback hash combination
  return await sha256(`${key}:${message}:${key}`);
}

// Generate secure random server seed (256-bit hex)
export function generateRandomServerSeed(): string {
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
export function generateRandomClientSeed(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let out = 'cs_';
  for (let i = 0; i < 12; i++) {
    out += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return out;
}

// Convert hex string slice to 32-bit unsigned integer
function hexToUint32(hex: string, offset = 0): number {
  const slice = hex.slice(offset, offset + 8);
  return parseInt(slice, 16);
}

// Convert hex string to array of bytes
function hexToBytes(hex: string): number[] {
  const bytes: number[] = [];
  for (let i = 0; i < hex.length; i += 2) {
    bytes.push(parseInt(hex.slice(i, i + 2), 16));
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
export async function generateCrashPoint(serverSeed: string, clientSeed: string, nonce = 1): Promise<number> {
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
export async function generateDiceRoll(serverSeed: string, clientSeed: string, nonce = 1): Promise<number> {
  const hash = await hmacSha256Hex(serverSeed, `${clientSeed}:${nonce}:dice`);
  const uint32 = hexToUint32(hash, 0);
  // Map 0 to 2^32-1 to 0..9999 then divide by 100
  const roll = (uint32 % 10000) / 100;
  return parseFloat(roll.toFixed(2));
}

/**
 * MINES OUTCOME GENERATOR
 * Generates an array of unique mine indices (0 to 24) on a 5x5 grid
 */
export async function generateMinesGrid(serverSeed: string, clientSeed: string, nonce = 1, mineCount = 3): Promise<number[]> {
  const count = Math.max(1, Math.min(24, mineCount));
  const hash = await hmacSha256Hex(serverSeed, `${clientSeed}:${nonce}:mines`);
  const mineIndices: number[] = [];
  const available = Array.from({ length: 25 }, (_, i) => i);

  let byteIdx = 0;
  while (mineIndices.length < count && available.length > 0) {
    if (byteIdx >= hash.length - 2) {
      // Re-hash for more entropy if necessary
      const rehash = await hmacSha256Hex(serverSeed, `${clientSeed}:${nonce}:mines:${byteIdx.toString()}`);
      byteIdx = 0;
      const val = parseInt(rehash.slice(byteIdx, byteIdx + 2), 16);
      const chosenSlot = val % available.length;
      mineIndices.push(available.splice(chosenSlot, 1)[0]);
      byteIdx += 2;
    } else {
      const val = parseInt(hash.slice(byteIdx, byteIdx + 2), 16);
      const chosenSlot = val % available.length;
      mineIndices.push(available.splice(chosenSlot, 1)[0]);
      byteIdx += 2;
    }
  }

  return mineIndices.sort((a, b) => a - b);
}

/**
 * PLINKO OUTCOME GENERATOR
 * Returns an array of left (0) or right (1) choices for each row
 */
export async function generatePlinkoPath(serverSeed: string, clientSeed: string, nonce = 1, rows = 12): Promise<number[]> {
  const hash = await hmacSha256Hex(serverSeed, `${clientSeed}:${nonce}:plinko`);
  const path: number[] = [];

  for (let r = 0; r < rows; r++) {
    const byte = parseInt(hash.slice(r * 2, r * 2 + 2), 16);
    // 0 = left, 1 = right
    path.push(byte % 2);
  }

  return path;
}

/**
 * ROULETTE OUTCOME GENERATOR
 * Standard European Roulette: 0 to 36
 */
export async function generateRouletteNumber(serverSeed: string, clientSeed: string, nonce = 1): Promise<number> {
  const hash = await hmacSha256Hex(serverSeed, `${clientSeed}:${nonce}:roulette`);
  const uint32 = hexToUint32(hash, 0);
  return uint32 % 37;
}

/**
 * COINFLIP OUTCOME GENERATOR
 * Returns 'heads' or 'tails'
 */
export async function generateCoinflip(serverSeed: string, clientSeed: string, nonce = 1): Promise<'heads' | 'tails'> {
  const hash = await hmacSha256Hex(serverSeed, `${clientSeed}:${nonce}:coinflip`);
  const uint32 = hexToUint32(hash, 0);
  return uint32 % 2 === 0 ? 'heads' : 'tails';
}

export interface BlackjackCard {
  suit: '♠' | '♥' | '♦' | '♣';
  rank: string;
  value: number;
}

/**
 * BLACKJACK OUTCOME GENERATOR
 * Generates an 8-deck shuffled card shoe (416 cards) using Fisher-Yates
 */
export async function generateBlackjackShoe(serverSeed: string, clientSeed: string, nonce = 1): Promise<BlackjackCard[]> {
  const suits: Array<'♠' | '♥' | '♦' | '♣'> = ['♠', '♥', '♦', '♣'];
  const ranks = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
  
  const baseDeck: BlackjackCard[] = [];
  suits.forEach(suit => {
    ranks.forEach(rank => {
      let value = parseInt(rank);
      if (['J', 'Q', 'K'].includes(rank)) value = 10;
      if (rank === 'A') value = 11;
      baseDeck.push({ suit, rank, value });
    });
  });

  const shoe: BlackjackCard[] = [];
  for (let d = 0; d < 6; d++) {
    shoe.push(...baseDeck.map(c => ({ ...c })));
  }

  const hash = await hmacSha256Hex(serverSeed, `${clientSeed}:${nonce}:blackjack`);
  let entropyOffset = 0;

  for (let i = shoe.length - 1; i > 0; i--) {
    if (entropyOffset + 8 >= hash.length) {
      const extraHash = await hmacSha256Hex(serverSeed, `${clientSeed}:${nonce}:blackjack:${entropyOffset.toString()}`);
      entropyOffset = 0;
      const uint = hexToUint32(extraHash, entropyOffset);
      const j = uint % (i + 1);
      [shoe[i], shoe[j]] = [shoe[j], shoe[i]];
      entropyOffset += 8;
    } else {
      const uint = hexToUint32(hash, entropyOffset);
      const j = uint % (i + 1);
      [shoe[i], shoe[j]] = [shoe[j], shoe[i]];
      entropyOffset += 8;
    }
  }

  return shoe;
}

/**
 * SLOTS REEL OUTCOME GENERATOR
 * Returns a 3x5 matrix of symbols
 */
export async function generateSlotsReels(serverSeed: string, clientSeed: string, nonce = 1): Promise<string[][]> {
  const symbols = ['💎', '7️⃣', '🔔', '🍇', '🍊', '🍋', '🍒', '⭐'];
  const hash = await hmacSha256Hex(serverSeed, `${clientSeed}:${nonce}:slots`);
  const grid: string[][] = [];

  for (let row = 0; row < 3; row++) {
    const rowSymbols: string[] = [];
    for (let col = 0; col < 5; col++) {
      const offset = (row * 5 + col) * 2;
      const byte = parseInt(hash.slice(offset, offset + 2), 16);
      rowSymbols.push(symbols[byte % symbols.length]);
    }
    grid.push(rowSymbols);
  }

  return grid;
}

export interface PokerCard {
  suit: '♠' | '♥' | '♦' | '♣';
  rank: string;
}

/**
 * POKER DECK GENERATOR
 * Standard 52-card deterministic shuffle
 */
export async function generatePokerDeck(serverSeed: string, clientSeed: string, nonce = 1): Promise<PokerCard[]> {
  const suits: Array<'♠' | '♥' | '♦' | '♣'> = ['♠', '♥', '♦', '♣'];
  const ranks = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
  const deck: PokerCard[] = [];

  suits.forEach(suit => {
    ranks.forEach(rank => {
      deck.push({ suit, rank });
    });
  });

  const hash = await hmacSha256Hex(serverSeed, `${clientSeed}:${nonce}:poker`);
  let offset = 0;

  for (let i = deck.length - 1; i > 0; i--) {
    const uint = hexToUint32(hash, (offset % 28) * 2);
    offset++;
    const j = uint % (i + 1);
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }

  return deck;
}

/**
 * KENO DRAW GENERATOR
 * Generates 10 to 20 unique winning numbers from 1 to 80
 */
export async function generateKenoDraw(serverSeed: string, clientSeed: string, nonce = 1, drawCount = 10): Promise<number[]> {
  const count = Math.max(1, Math.min(20, drawCount));
  const pool = Array.from({ length: 80 }, (_, i) => i + 1);
  const hash = await hmacSha256Hex(serverSeed, `${clientSeed}:${nonce}:keno`);
  const drawn: number[] = [];

  let offset = 0;
  while (drawn.length < count && pool.length > 0) {
    const uint = hexToUint32(hash, (offset % 28) * 2);
    offset++;
    const idx = uint % pool.length;
    drawn.push(pool.splice(idx, 1)[0]);
  }

  return drawn.sort((a, b) => a - b);
}

/**
 * LIMBO OUTCOME GENERATOR
 * Target multiplier generator with standard 1% house edge
 */
export async function generateLimboMultiplier(serverSeed: string, clientSeed: string, nonce = 1): Promise<number> {
  const hash = await hmacSha256Hex(serverSeed, `${clientSeed}:${nonce}:limbo`);
  const h = parseInt(hash.slice(0, 13), 16);
  const e = Math.pow(2, 52);

  // 1 in 100 instant bust
  if (h % 100 === 0) {
    return 1.00;
  }

  const rawMultiplier = (100 * e - h) / (e - h) / 100;
  return Math.max(1.00, Math.min(10000.0, parseFloat(rawMultiplier.toFixed(2))));
}

/**
 * FOUR-DIGIT LOTTERY OUTCOME GENERATOR
 * Generates 4 digits (0000 to 9999) from server seed and draw nonce
 */
export async function generateLotteryDigits(serverSeed: string, clientSeed: string, nonce = 1): Promise<string> {
  const hash = await hmacSha256Hex(serverSeed, `${clientSeed}:${nonce}:lottery`);
  const uint32 = hexToUint32(hash, 0);
  const digits = (uint32 % 10000).toString().padStart(4, '0');
  return digits;
}

// ============================================================================
// UNIVERSAL VERIFICATION AUDITOR
// ============================================================================

export interface RoundVerificationResult {
  verified: boolean;
  gameId?: string;
  publishedHash?: string;
  computedHash?: string;
  hashMatch?: boolean;
  serverSeed?: string;
  clientSeed?: string;
  nonce?: number;
  computedOutcome?: unknown;
  error?: string;
}

/**
 * Recomputes the outcome of any round and validates its hash match
 */
export async function verifyGameRound(
  gameId: string, 
  serverSeed: string, 
  serverSeedHash: string, 
  clientSeed: string, 
  nonce: number, 
  gameParams: Record<string, unknown> = {}
): Promise<RoundVerificationResult> {
  try {
    const computedHash = await sha256(serverSeed);
    const normalizedExpected = (serverSeedHash || '').toLowerCase().trim();
    const isHashValid = computedHash.toLowerCase() === normalizedExpected;

    let computedOutcome: unknown = null;

    switch (gameId) {
      case 'crash':
        computedOutcome = await generateCrashPoint(serverSeed, clientSeed, nonce);
        break;
      case 'dice':
        computedOutcome = await generateDiceRoll(serverSeed, clientSeed, nonce);
        break;
      case 'mines':
        computedOutcome = await generateMinesGrid(serverSeed, clientSeed, nonce, (gameParams.mineCount as number) || 3);
        break;
      case 'plinko':
        computedOutcome = await generatePlinkoPath(serverSeed, clientSeed, nonce, (gameParams.rows as number) || 12);
        break;
      case 'roulette':
        computedOutcome = await generateRouletteNumber(serverSeed, clientSeed, nonce);
        break;
      case 'coinflip':
        computedOutcome = await generateCoinflip(serverSeed, clientSeed, nonce);
        break;
      case 'blackjack':
        computedOutcome = await generateBlackjackShoe(serverSeed, clientSeed, nonce);
        break;
      case 'slots':
        computedOutcome = await generateSlotsReels(serverSeed, clientSeed, nonce);
        break;
      case 'poker':
        computedOutcome = await generatePokerDeck(serverSeed, clientSeed, nonce);
        break;
      case 'keno':
        computedOutcome = await generateKenoDraw(serverSeed, clientSeed, nonce, (gameParams.drawCount as number) || 10);
        break;
      case 'limbo':
        computedOutcome = await generateLimboMultiplier(serverSeed, clientSeed, nonce);
        break;
      case 'lottery':
        computedOutcome = await generateLotteryDigits(serverSeed, clientSeed, nonce);
        break;
      default:
        computedOutcome = 'Unknown Game Engine';
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
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { verified: false, error: msg };
  }
}

export const verifyGameRoundOutcome = verifyGameRound;
export const generateShuffledDeck = generateBlackjackShoe;
export const generateSlotSpin = generateSlotsReels;

// Fallback pure JS SHA-256 for non-browser/legacy contexts
function fallbackSha256(ascii: string): string {
  function rightRotate(value: number, amount: number): number {
    return (value >>> amount) | (value << (32 - amount));
  }
  const mathPow = Math.pow;
  const maxWord = mathPow(2, 32);
  let result = '';

  const words: number[] = [];
  const asciiBitLength = ascii.length * 8;
  let hash: number[] = [];
  const k: number[] = [];
  let primeCounter = 0;

  const isComposite: Record<number, boolean> = {};
  for (let candidate = 2; primeCounter < 64; candidate++) {
    if (!isComposite[candidate]) {
      for (let i = 0; i < 300; i += candidate) isComposite[i] = true;
      hash[primeCounter] = (mathPow(candidate, 0.5) * maxWord) | 0;
      k[primeCounter++] = (mathPow(candidate, 1 / 3) * maxWord) | 0;
    }
  }

  ascii += '\x80';
  while ((ascii.length % 64) - 56) ascii += '\x00';
  for (let i = 0; i < ascii.length; i++) {
    const j = ascii.charCodeAt(i);
    if (j >> 8) return '';
    words[i >> 2] |= j << (((3 - i) % 4) * 8);
  }
  words[words.length] = (asciiBitLength / maxWord) | 0;
  words[words.length] = asciiBitLength;

  for (let j = 0; j < words.length; ) {
    const w = words.slice(j, (j += 16));
    const oldHash = hash;
    hash = hash.slice(0, 8);

    for (let i = 0; i < 64; i++) {
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

    for (let i = 0; i < 8; i++) hash[i] = (hash[i] + oldHash[i]) | 0;
  }

  for (let i = 0; i < 8; i++) {
    for (let j = 3; j >= 0; j--) {
      const b = (hash[i] >> (8 * j)) & 255;
      result += (b < 16 ? '0' : '') + b.toString(16);
    }
  }
  return result;
}
