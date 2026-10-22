import { runSql } from './supabase_admin.mjs';

async function migrateDatabase() {
  console.log('--- 1. Dropping broken legacy triggers and functions ---');
  await runSql(`
    DROP TRIGGER IF EXISTS protect_profile_columns ON public.profiles;
    DROP FUNCTION IF EXISTS public.protect_profile_columns CASCADE;
    DROP FUNCTION IF EXISTS public.protect_order_columns CASCADE;
    DROP FUNCTION IF EXISTS public.update_service_order_count CASCADE;
    DROP FUNCTION IF EXISTS public.protect_service_order_count CASCADE;
    DROP FUNCTION IF EXISTS public.is_assigned_staff CASCADE;
    DROP FUNCTION IF EXISTS public.worker_share_percent CASCADE;
  `);
  console.log('✓ Cleaned legacy functions');

  console.log('--- 2. Enhancing profiles table ---');
  await runSql(`
    ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS username_chosen boolean DEFAULT false;
    ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS username_change_count integer DEFAULT 0;
  `);
  console.log('✓ Profiles table enhanced');

  console.log('--- 3. Enhancing lottery_wallets table ---');
  await runSql(`
    ALTER TABLE public.lottery_wallets ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;
    CREATE INDEX IF NOT EXISTS idx_lottery_wallets_user_id ON public.lottery_wallets(user_id);
  `);
  console.log('✓ lottery_wallets enhanced');

  console.log('--- 4. Creating platform_settings table ---');
  await runSql(`
    CREATE TABLE IF NOT EXISTS public.platform_settings (
      key text PRIMARY KEY,
      value jsonb NOT NULL,
      updated_at timestamptz DEFAULT now()
    );
    ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;

    INSERT INTO public.platform_settings (key, value)
    VALUES ('global', '{
      "minWithdrawal": 5.0,
      "maxWithdrawal": 10000.0,
      "houseFeePercent": 5,
      "defaultWinnerSharePercent": 90,
      "treasuryTrc20": "TYv7s8K3eL2QpNm4xW9jRtZbCuYxK9m",
      "supportEmail": "support@earnflow.in",
      "usernameChangeFee": 5.0
    }'::jsonb)
    ON CONFLICT (key) DO NOTHING;
  `);
  console.log('✓ platform_settings created');

  console.log('--- 5. Creating support_tickets table ---');
  await runSql(`
    CREATE TABLE IF NOT EXISTS public.support_tickets (
      id text PRIMARY KEY,
      user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
      user_address text,
      name text,
      username text,
      email text NOT NULL,
      subject text,
      message text NOT NULL,
      status text DEFAULT 'pending',
      admin_reply text,
      created_at timestamptz DEFAULT now(),
      updated_at timestamptz DEFAULT now()
    );
    ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;
  `);
  console.log('✓ support_tickets created');

  console.log('--- 6. Creating winner_payouts table ---');
  await runSql(`
    CREATE TABLE IF NOT EXISTS public.winner_payouts (
      id text PRIMARY KEY,
      event_id text,
      event_title text,
      ticket_id text,
      user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
      winner_address text NOT NULL,
      winner_username text,
      winning_digits text,
      tickets_sold integer DEFAULT 0,
      ticket_price numeric DEFAULT 0,
      total_pool_collected numeric DEFAULT 0,
      winner_share_percent numeric DEFAULT 90,
      calculated_amount numeric NOT NULL,
      payout_amount numeric NOT NULL,
      status text DEFAULT 'pending_approval',
      tx_hash text,
      approved_at timestamptz,
      created_at timestamptz DEFAULT now()
    );
    ALTER TABLE public.winner_payouts ENABLE ROW LEVEL SECURITY;
  `);
  console.log('✓ winner_payouts created');

  console.log('--- 7. Creating username_changes table ---');
  await runSql(`
    CREATE TABLE IF NOT EXISTS public.username_changes (
      id text PRIMARY KEY,
      user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
      user_address text,
      old_username text,
      new_username text NOT NULL,
      fee_paid numeric DEFAULT 0,
      payment_type text DEFAULT 'FREE_LIFETIME_EDIT',
      created_at timestamptz DEFAULT now()
    );
    ALTER TABLE public.username_changes ENABLE ROW LEVEL SECURITY;
  `);
  console.log('✓ username_changes created');

  console.log('--- 8. Enable Realtime Publications ---');
  await runSql(`
    DO $$
    BEGIN
      BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.platform_settings;
      EXCEPTION WHEN others THEN NULL;
      END;
      BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.support_tickets;
      EXCEPTION WHEN others THEN NULL;
      END;
      BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.winner_payouts;
      EXCEPTION WHEN others THEN NULL;
      END;
      BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.username_changes;
      EXCEPTION WHEN others THEN NULL;
      END;
    END $$;
  `);
  console.log('✓ Realtime publications registered');

  console.log('--- 9. Migrating any existing support tickets from deposits ---');
  await runSql(`
    INSERT INTO public.support_tickets (id, user_id, user_address, name, username, email, subject, message, status, created_at)
    SELECT 
      id,
      user_id,
      user_address,
      NULL as name,
      NULL as username,
      pay_currency as email,
      payment_id as subject,
      invoice_url as message,
      status,
      created_at
    FROM public.lottery_deposits
    WHERE currency = 'SUPPORT_TICKET'
    ON CONFLICT (id) DO NOTHING;
  `);
  console.log('✓ Existing support tickets migrated');

  console.log('All migrations executed successfully!');
}

migrateDatabase().catch(console.error);
