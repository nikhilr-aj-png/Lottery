export interface NormalizedReferralSettings {
  configured: boolean;
  enabled: boolean;
  reward_currency: 'USDT';
  supported_network: 'TRC-20';
  config_version: number;
  registration_reward_enabled: boolean;
  registration_reward_amount: number;
  first_deposit_reward_enabled: boolean;
  first_deposit_reward_percent: number;
  minimum_qualifying_deposit: number;
  maximum_first_deposit_bonus: number;
  lifetime_commission_enabled: boolean;
  lifetime_commission_percent: number;
  lifetime_commission_activity: string;
}

function pickFiniteNumber(...candidates: unknown[]): number | null {
  for (const val of candidates) {
    if (val === null || val === undefined || val === '') continue;
    const n = typeof val === 'number' ? val : Number(val);
    if (Number.isFinite(n)) return Math.max(0, n);
  }
  return null;
}

function pickBoolean(...candidates: unknown[]): boolean | null {
  for (const val of candidates) {
    if (typeof val === 'boolean') return val;
    if (val === 'true') return true;
    if (val === 'false') return false;
  }
  return null;
}

/**
 * Normalizes referral configuration from authoritative platform_settings without
 * ever coercing explicit `0` or `false` values to hardcoded fallbacks.
 */
export function normalizeReferralSettings(raw: any): NormalizedReferralSettings {
  if (!raw || typeof raw !== 'object') {
    return {
      configured: false,
      enabled: false,
      reward_currency: 'USDT',
      supported_network: 'TRC-20',
      config_version: 0,
      registration_reward_enabled: false,
      registration_reward_amount: 0,
      first_deposit_reward_enabled: false,
      first_deposit_reward_percent: 0,
      minimum_qualifying_deposit: 0,
      maximum_first_deposit_bonus: 0,
      lifetime_commission_enabled: false,
      lifetime_commission_percent: 0,
      lifetime_commission_activity: 'ticket_purchase',
    };
  }

  const enabled = pickBoolean(raw.enabled, true) ?? true;
  const regEnabled =
    pickBoolean(
      raw.registration_reward_enabled,
      raw.registration_reward?.enabled,
      raw.registrationReward?.enabled
    ) ?? true;
  const regAmount =
    pickFiniteNumber(
      raw.registration_reward_amount,
      raw.registration_reward?.amount,
      raw.registrationReward?.amount
    ) ?? 0;

  const fdEnabled =
    pickBoolean(
      raw.first_deposit_reward_enabled,
      raw.first_deposit_reward?.enabled,
      raw.firstDepositReward?.enabled
    ) ?? true;
  const fdPercent =
    pickFiniteNumber(
      raw.first_deposit_reward_percent,
      raw.first_deposit_reward?.amount,
      raw.firstDepositReward?.amount
    ) ?? 0;
  const minDeposit =
    pickFiniteNumber(
      raw.minimum_qualifying_deposit,
      raw.first_deposit_reward?.min_deposit,
      raw.firstDepositReward?.min_deposit
    ) ?? 0;
  const maxBonus =
    pickFiniteNumber(
      raw.maximum_first_deposit_bonus,
      raw.first_deposit_reward?.max_reward,
      raw.firstDepositReward?.max_reward
    ) ?? 0;

  const lcEnabled =
    pickBoolean(
      raw.lifetime_commission_enabled,
      raw.lifetime_commission?.enabled,
      raw.lifetimeCommission?.enabled
    ) ?? true;
  const lcPercent =
    pickFiniteNumber(
      raw.lifetime_commission_percent,
      raw.lifetime_commission?.percent,
      raw.lifetimeCommission?.percent
    ) ?? 0;

  return {
    configured: true,
    enabled,
    reward_currency: 'USDT',
    supported_network: 'TRC-20',
    config_version: pickFiniteNumber(raw.config_version) ?? 1,
    registration_reward_enabled: regEnabled,
    registration_reward_amount: regAmount,
    first_deposit_reward_enabled: fdEnabled,
    first_deposit_reward_percent: fdPercent,
    minimum_qualifying_deposit: minDeposit,
    maximum_first_deposit_bonus: maxBonus,
    lifetime_commission_enabled: lcEnabled,
    lifetime_commission_percent: lcPercent,
    lifetime_commission_activity: String(
      raw.lifetime_commission_activity ||
        raw.lifetime_commission?.activity ||
        'ticket_purchase'
    ),
  };
}

export function formatNumericDisplay(value: number, maxDecimals = 2): string {
  const rounded = Number(value.toFixed(maxDecimals));
  return Number.isInteger(rounded) ? String(rounded) : String(rounded);
}
