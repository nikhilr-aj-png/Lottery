export interface ProvablyFairSeed {
  serverSeed: string;
  serverSeedHash: string;
  clientSeed: string;
  nonce: number;
}

export interface FairnessVerificationResult {
  isValid: boolean;
  computedHash: string;
  expectedHash: string;
  rawFloat: number;
  computedOutcome: string | number;
  details?: Record<string, unknown>;
}

export interface SeedPair {
  activeServerSeedHash: string;
  activeClientSeed: string;
  currentNonce: number;
  previousServerSeed?: string;
}

