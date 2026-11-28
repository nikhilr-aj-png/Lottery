export interface NormalizedReferralSettings {
  configured: boolean;
  enabled: boolean;
  normal_enabled: boolean;
  vip_enabled: boolean;
  vip_reward_mode: 'double_normal' | 'custom';
  reward_currency: 'USDT';
  supported_network: 'TRC-20';
  config_version: number;
  registration_reward_enabled: boolean;
  registration_reward_amount: number;
  vip_registration_reward_amount: number;
  first_deposit_reward_enabled: boolean;
  first_deposit_reward_percent: number;
  vip_first_deposit_reward_percent: number;
  minimum_qualifying_deposit: number;
  maximum_first_deposit_bonus: number;
  lifetime_commission_enabled: boolean;
  lifetime_commission_percent: number;
  vip_lifetime_commission_percent: number;
  lifetime_commission_activity: string;
}

export function resolveVipRewardValue(
  normalValue: number,
  customVipValue: number | null | undefined,
  isVip: boolean,
  mode: string = 'double_normal'
): number {
  const safeNorm = Math.max(0, Number(normalValue || 0));
  if (!isVip) return Math.round(safeNorm * 100) / 100;
  if (String(mode || '').toLowerCase() === 'custom') {
    const custom = Number(customVipValue ?? safeNorm * 2);
    return Math.round(Math.max(0, Number.isFinite(custom) ? custom : safeNorm * 2) * 100) / 100;
  }
  return Math.round(safeNorm * 2 * 100) / 100;
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
      normal_enabled: false,
      vip_enabled: false,
      vip_reward_mode: 'double_normal',
      reward_currency: 'USDT',
      supported_network: 'TRC-20',
      config_version: 0,
      registration_reward_enabled: false,
      registration_reward_amount: 0,
      vip_registration_reward_amount: 0,
      first_deposit_reward_enabled: false,
      first_deposit_reward_percent: 0,
      vip_first_deposit_reward_percent: 0,
      minimum_qualifying_deposit: 0,
      maximum_first_deposit_bonus: 0,
      lifetime_commission_enabled: false,
      lifetime_commission_percent: 0,
      vip_lifetime_commission_percent: 0,
      lifetime_commission_activity: 'ticket_purchase',
    };
  }

  const enabled = pickBoolean(raw.enabled, true) ?? true;
  const normalEnabled = pickBoolean(raw.normal_enabled, true) ?? true;
  const vipEnabled = pickBoolean(raw.vip_enabled, true) ?? true;
  const vipRewardMode: 'double_normal' | 'custom' =
    String(raw.vip_reward_mode || '').toLowerCase() === 'custom' ? 'custom' : 'double_normal';
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

  const vipRegAmount =
    pickFiniteNumber(
      raw.vip_registration_reward_amount,
      raw.registration_reward?.vip_amount,
      raw.registrationReward?.vip_amount
    ) ?? Math.round(regAmount * 2 * 100) / 100;

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
  const vipFdPercent =
    pickFiniteNumber(
      raw.vip_first_deposit_reward_percent,
      raw.first_deposit_reward?.vip_amount,
      raw.firstDepositReward?.vip_amount
    ) ?? Math.min(100, Math.round(fdPercent * 2 * 100) / 100);
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
  const vipLcPercent =
    pickFiniteNumber(
      raw.vip_lifetime_commission_percent,
      raw.lifetime_commission?.vip_percent,
      raw.lifetimeCommission?.vip_percent
    ) ?? Math.min(50, Math.round(lcPercent * 2 * 100) / 100);

  return {
    configured: true,
    enabled,
    normal_enabled: normalEnabled,
    vip_enabled: vipEnabled,
    vip_reward_mode: vipRewardMode,
    reward_currency: 'USDT',
    supported_network: 'TRC-20',
    config_version: pickFiniteNumber(raw.config_version) ?? 1,
    registration_reward_enabled: regEnabled,
    registration_reward_amount: regAmount,
    vip_registration_reward_amount: vipRegAmount,
    first_deposit_reward_enabled: fdEnabled,
    first_deposit_reward_percent: fdPercent,
    vip_first_deposit_reward_percent: vipFdPercent,
    minimum_qualifying_deposit: minDeposit,
    maximum_first_deposit_bonus: maxBonus,
    lifetime_commission_enabled: lcEnabled,
    lifetime_commission_percent: lcPercent,
    vip_lifetime_commission_percent: vipLcPercent,
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
