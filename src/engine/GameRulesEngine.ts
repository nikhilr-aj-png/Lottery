/**
 * ============================================================================
 * GAME RULES ENGINE — FOUR-DIGIT LOTTERY PLATFORM
 * ============================================================================
 * Validation logic for Four-Digit Lottery ticket purchases and wallet limits.
 * All non-lottery games have been permanently removed.
 */

export interface BetValidationResult {
  valid: boolean;
  amount?: number;
  error?: string;
}

export function validateBet(gameId: string, betAmountUSDT: number | string, userBalanceUSDT?: number | string): BetValidationResult {
  const amount = Number(betAmountUSDT);

  if (isNaN(amount) || amount <= 0) {
    return { valid: false, error: 'Ticket amount must be greater than 0.' };
  }

  if (amount < 1) {
    return { valid: false, error: 'Minimum ticket price is 1 USDT.' };
  }

  if (amount > 500) {
    return { valid: false, error: 'Maximum ticket price is 500 USDT.' };
  }

  if (amount > Number(userBalanceUSDT || 0)) {
    return { valid: false, error: 'Insufficient USDT balance. Deposit USDT to continue!' };
  }

  return { valid: true, amount };
}

export function validateLotteryDigits(digits: string): boolean {
  return /^\d{4}$/.test(digits);
}
