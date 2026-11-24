/**
 * ============================================================================
 * PROVABLY FAIR SERVICE — FOUR-DIGIT LOTTERY PLATFORM
 * ============================================================================
 * Cryptographic random number verification for Four-Digit Lottery draws.
 * All non-lottery games have been permanently removed.
 */

export async function sha256Hex(message: string): Promise<string> {
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const encoder = new TextEncoder();
    const data = encoder.encode(message);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }
  return fallbackSha256(message);
}

export const sha256 = sha256Hex;

export async function hmacSha256Hex(key: string, message: string): Promise<string> {
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const encoder = new TextEncoder();
    const keyData = encoder.encode(key);
    const msgData = encoder.encode(message);

    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );

    const signature = await crypto.subtle.sign('HMAC', cryptoKey, msgData);
    const hashArray = Array.from(new Uint8Array(signature));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }
  return sha256Hex(`${key}:${message}`);
}

export function generateRandomSeed(byteLength = 32): string {
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const array = new Uint8Array(byteLength);
    crypto.getRandomValues(array);
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
  }
  let result = '';
  const hexChars = '0123456789abcdef';
  for (let i = 0; i < byteLength * 2; i++) {
    result += hexChars[Math.floor(Math.random() * 16)];
  }
  return result;
}

export function hexToUint32(hex: string, offset = 0): number {
  const slice = hex.slice(offset, offset + 8);
  return parseInt(slice, 16) >>> 0;
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
 * Validates the cryptographic commitment and reproduced winning digits for Four-Digit Lottery
 */
export async function verifyGameRound(
  gameId: string, 
  serverSeed: string, 
  serverSeedHash: string, 
  clientSeed: string, 
  nonce: number
): Promise<RoundVerificationResult> {
  try {
    const computedHash = await sha256(serverSeed);
    const normalizedExpected = (serverSeedHash || '').toLowerCase().trim();
    const isHashValid = computedHash.toLowerCase() === normalizedExpected;
    const computedOutcome = await generateLotteryDigits(serverSeed, clientSeed, nonce);

    return {
      verified: isHashValid,
      gameId: 'lottery',
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
