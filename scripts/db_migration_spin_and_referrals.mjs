import { runSql } from './supabase_admin.mjs';

async function migrateDatabase() {
  console.log('================================================================');
  console.log('DATABASE MIGRATION: SPIN WHEEL USDT FIX & REFERRAL SYSTEM');
  console.log('================================================================\n');

  // 1. Fix public.spin_lucky_wheel RPC to credit EXACT USDT amounts (e.g. 0.25 USDT, not 250)
  console.log('[1/5] Updating public.spin_lucky_wheel stored procedure...');
  const fixSpinWheelSql = `
CREATE OR REPLACE FUNCTION public.spin_lucky_wheel(p_user_address text, p_user_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth', 'extensions', 'pg_temp'
AS $function$
DECLARE
  v_uid uuid := COALESCE(p_user_id, auth.uid());
  v_last_spin timestamptz;
  v_now timestamptz := now();
  v_cooldown integer := 86400; -- 24 hours
  v_elapsed integer;
  v_rand numeric;
  v_slice_index integer;
  v_base_prize numeric;
  v_multiplier numeric := 1.0;
  v_final_prize numeric;
  v_tier text := 'Bronze';
  v_spin_ref text;
  v_credit_res jsonb;
  v_wheel_settings jsonb;
BEGIN
  IF p_user_address IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Wallet address is required');
  END IF;

  -- Check cooldown from user_vip_progress or wallet_ledger
  SELECT last_wheel_spin_at INTO v_last_spin 
  FROM public.user_vip_progress 
  WHERE wallet_address = p_user_address;

  IF v_last_spin IS NULL THEN
    SELECT created_at INTO v_last_spin
    FROM public.wallet_ledger
    WHERE wallet_address = p_user_address AND transaction_type = 'lucky_wheel_spin'
    ORDER BY created_at DESC LIMIT 1;
  END IF;

  IF v_last_spin IS NOT NULL THEN
    v_elapsed := EXTRACT(EPOCH FROM (v_now - v_last_spin))::integer;
    IF v_elapsed < v_cooldown THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'Lucky Wheel on 24-hour cooldown. Return in ' || ((v_cooldown - v_elapsed) / 3600) || ' hour(s).',
        'seconds_remaining', (v_cooldown - v_elapsed)
      );
    END IF;
  END IF;

  -- Fetch current VIP multiplier
  SELECT faucet_multiplier, current_tier 
  INTO v_multiplier, v_tier
  FROM public.user_vip_progress 
  WHERE wallet_address = p_user_address;

  IF v_multiplier IS NULL THEN
    v_multiplier := 1.0;
    v_tier := 'Bronze';
  END IF;

  -- Deterministic random prize slice calculation in EXACT USDT
  -- Slices:
  -- Index 0: 0.10 USDT (25%)
  -- Index 1: 0.20 USDT (25%)
  -- Index 2: 0.25 USDT (20%)
  -- Index 3: 0.50 USDT (14%)
  -- Index 4: 0.75 USDT (8%)
  -- Index 5: 1.00 USDT (5%)
  -- Index 6: 2.50 USDT (2.5%)
  -- Index 7: 5.00 USDT (0.5% Jackpot)
  v_rand := random() * 100.0;

  IF v_rand < 0.5 THEN
    v_slice_index := 7; v_base_prize := 5.00;   -- 0.5% Jackpot
  ELSIF v_rand < 3.0 THEN
    v_slice_index := 6; v_base_prize := 2.50;   -- 2.5%
  ELSIF v_rand < 8.0 THEN
    v_slice_index := 5; v_base_prize := 1.00;   -- 5.0%
  ELSIF v_rand < 16.0 THEN
    v_slice_index := 4; v_base_prize := 0.75;   -- 8.0%
  ELSIF v_rand < 30.0 THEN
    v_slice_index := 3; v_base_prize := 0.50;   -- 14.0%
  ELSIF v_rand < 50.0 THEN
    v_slice_index := 2; v_base_prize := 0.25;   -- 20.0%
  ELSIF v_rand < 75.0 THEN
    v_slice_index := 1; v_base_prize := 0.20;   -- 25.0%
  ELSE
    v_slice_index := 0; v_base_prize := 0.10;   -- 25.0%
  END IF;

  -- Round to exactly 2 decimal places for standard USDT accounting
  v_final_prize := ROUND(v_base_prize * v_multiplier, 2);
  v_spin_ref := 'wheel-' || to_char(v_now, 'YYYY-MM-DD') || '-' || substring(p_user_address from 3 for 8);

  -- Credit virtual wallet via double-entry ledger
  v_credit_res := public.credit_virtual_credits(
    v_final_prize,
    'lucky_wheel_spin',
    v_spin_ref,
    'Daily Lucky Wheel Prize: ' || v_final_prize || ' USDT (' || v_tier || ' Tier ' || v_multiplier || 'x)',
    p_user_address,
    v_uid,
    jsonb_build_object('slice', v_slice_index, 'base', v_base_prize, 'vip_mult', v_multiplier, 'currency', 'USDT')
  );

  -- Record spin history
  INSERT INTO public.user_vip_progress (wallet_address, user_id, last_wheel_spin_at, updated_at)
  VALUES (p_user_address, v_uid, v_now, v_now)
  ON CONFLICT (wallet_address) DO UPDATE SET
    last_wheel_spin_at = v_now,
    updated_at = v_now;

  RETURN jsonb_build_object(
    'success', true,
    'slice_index', v_slice_index,
    'base_prize', v_base_prize,
    'vip_multiplier', v_multiplier,
    'final_prize', v_final_prize,
    'currency', 'USDT',
    'vip_tier', v_tier,
    'new_balance', (v_credit_res->>'new_balance')::numeric,
    'message', 'Congratulations! You won ' || v_final_prize || ' USDT!'
  );
END;
$function$;
GRANT EXECUTE ON FUNCTION public.spin_lucky_wheel(text, uuid) TO anon, authenticated;
  `;
  await runSql(fixSpinWheelSql);
  console.log('[1/5] public.spin_lucky_wheel successfully updated!');

  // 2. Create public.user_referrals table
  console.log('[2/5] Creating public.user_referrals and referral tables...');
  const referralTablesSql = `
CREATE TABLE IF NOT EXISTS public.user_referrals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  referrer_address text,
  referrer_username text,
  referred_user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  referred_address text,
  referred_username text,
  referral_code text NOT NULL,
  status text NOT NULL DEFAULT 'active',
  registration_reward_credited boolean NOT NULL DEFAULT false,
  first_deposit_amount numeric(18, 4) NOT NULL DEFAULT 0,
  first_deposit_reward_credited boolean NOT NULL DEFAULT false,
  total_commission_earned numeric(18, 4) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_referred_user UNIQUE (referred_user_id)
);

CREATE INDEX IF NOT EXISTS idx_user_referrals_referrer_id ON public.user_referrals(referrer_id);
CREATE INDEX IF NOT EXISTS idx_user_referrals_referral_code ON public.user_referrals(referral_code);

CREATE TABLE IF NOT EXISTS public.referral_rewards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  referred_user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  reward_type text NOT NULL, -- 'registration', 'first_deposit', 'lifetime_commission'
  amount numeric(18, 4) NOT NULL,
  currency text NOT NULL DEFAULT 'USDT',
  status text NOT NULL DEFAULT 'completed',
  ledger_tx_id text,
  details jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_referral_rewards_referrer ON public.referral_rewards(referrer_id);

CREATE TABLE IF NOT EXISTS public.admin_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action text NOT NULL,
  target_type text NOT NULL,
  target_id text,
  details jsonb DEFAULT '{}'::jsonb,
  admin_id uuid,
  admin_email text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS and grant permissions
ALTER TABLE public.user_referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referral_rewards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_audit_logs ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Public read user_referrals" ON public.user_referrals FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE POLICY "Public insert user_referrals" ON public.user_referrals FOR INSERT WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE POLICY "Public update user_referrals" ON public.user_referrals FOR UPDATE USING (true);
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE POLICY "Public read referral_rewards" ON public.referral_rewards FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE POLICY "Public insert referral_rewards" ON public.referral_rewards FOR INSERT WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE POLICY "Public read admin_audit_logs" ON public.admin_audit_logs FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE POLICY "Public insert admin_audit_logs" ON public.admin_audit_logs FOR INSERT WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN null; END $$;

GRANT ALL ON public.user_referrals TO anon, authenticated, service_role;
GRANT ALL ON public.referral_rewards TO anon, authenticated, service_role;
GRANT ALL ON public.admin_audit_logs TO anon, authenticated, service_role;
  `;
  await runSql(referralTablesSql);
  console.log('[2/5] Referral & audit tables successfully created!');

  // 3. Add is_deleted and archived_at to lottery_events if not present
  console.log('[3/5] Adding is_deleted to public.lottery_events...');
  const alterEventsSql = `
ALTER TABLE public.lottery_events ADD COLUMN IF NOT EXISTS is_deleted boolean DEFAULT false;
ALTER TABLE public.lottery_events ADD COLUMN IF NOT EXISTS archived_at timestamptz;
CREATE INDEX IF NOT EXISTS idx_lottery_events_is_deleted ON public.lottery_events(is_deleted);
  `;
  await runSql(alterEventsSql);
  console.log('[3/5] public.lottery_events columns added!');

  // 4. Initialize platform_settings keys
  console.log('[4/5] Initializing platform settings for referral, spin wheel, and results retention...');
  const initSettingsSql = `
INSERT INTO public.platform_settings (key, value, updated_at)
VALUES (
  'referral_settings',
  '{
    "enabled": true,
    "registration_reward": { "enabled": true, "amount": 0.25 },
    "first_deposit_reward": { "enabled": true, "mode": "percentage", "amount": 5.0, "min_deposit": 10.0, "max_reward": 50.0 },
    "lifetime_commission": { "enabled": true, "percent": 1.0, "activity": "ticket_purchase" }
  }'::jsonb,
  now()
)
ON CONFLICT (key) DO UPDATE SET
  value = EXCLUDED.value,
  updated_at = now();

INSERT INTO public.platform_settings (key, value, updated_at)
VALUES (
  'spin_wheel_settings',
  '{
    "enabled": true,
    "daily_spin_limit": 1,
    "cooldown_hours": 24,
    "eligibility": "all",
    "segments": [
      { "index": 0, "amount": 0.10, "label": "0.10 USDT", "probability": 25.0, "color": "#B45309", "textColor": "#FEF3C7" },
      { "index": 1, "amount": 0.20, "label": "0.20 USDT", "probability": 25.0, "color": "#475569", "textColor": "#F1F5F9" },
      { "index": 2, "amount": 0.25, "label": "0.25 USDT", "probability": 20.0, "color": "#854D0E", "textColor": "#FEF9C3" },
      { "index": 3, "amount": 0.50, "label": "0.50 USDT", "probability": 14.0, "color": "#065F46", "textColor": "#D1FAE5" },
      { "index": 4, "amount": 0.75, "label": "0.75 USDT", "probability": 8.0, "color": "#1E40AF", "textColor": "#DBEAFE" },
      { "index": 5, "amount": 1.00, "label": "1.00 USDT", "probability": 5.0, "color": "#7C2D12", "textColor": "#FFEDD5" },
      { "index": 6, "amount": 2.50, "label": "2.50 USDT", "probability": 2.5, "color": "#581C87", "textColor": "#F3E8FF" },
      { "index": 7, "amount": 5.00, "label": "5.00 USDT", "probability": 0.5, "color": "#831843", "textColor": "#FCE7F3" }
    ]
  }'::jsonb,
  now()
)
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.platform_settings (key, value, updated_at)
VALUES (
  'results_retention',
  '{
    "retention_duration_hours": 1.0,
    "default_option": "1_hour"
  }'::jsonb,
  now()
)
ON CONFLICT (key) DO NOTHING;
  `;
  await runSql(initSettingsSql);
  console.log('[4/5] Platform settings initialized!');

  // 5. Clean up stale event room names that had "Verification Arena"
  console.log('[5/5] Cleaning up stale room_name values in lottery_events...');
  const cleanRoomsSql = `
UPDATE public.lottery_events
SET room_name = title
WHERE room_name ILIKE '%Verification Arena%' AND title NOT ILIKE '%Verification%';
  `;
  await runSql(cleanRoomsSql);
  console.log('[5/5] Stale room names sanitized to match custom event titles!');

  console.log('\n================================================================');
  console.log('ALL DATABASE MIGRATION STEPS COMPLETED SUCCESSFULLY!');
  console.log('================================================================');
}

migrateDatabase().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
