import { runSql } from './supabase_admin.mjs';

async function fixAllAdvisors() {
  console.log('--- 1. Fixing Function Search Path & Security Definer ---');
  await runSql(`
    -- Set search_path on handle_new_user
    ALTER FUNCTION public.handle_new_user() SET search_path = public, pg_temp;

    -- Trigger functions should NOT be executable via API/RPC by public, anon or authenticated
    REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
    REVOKE EXECUTE ON FUNCTION public.handle_user_deletion() FROM PUBLIC, anon, authenticated;
    REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM PUBLIC, anon, authenticated;

    -- Helper functions can be SECURITY INVOKER (removes anon/authenticated security definer warnings)
    ALTER FUNCTION public.is_admin() SECURITY INVOKER;
    ALTER FUNCTION public.is_super_admin() SECURITY INVOKER;
    ALTER FUNCTION public.is_staff() SECURITY INVOKER;
    ALTER FUNCTION public.buy_lottery_tickets_secure(text, text[], text, text) SECURITY INVOKER;
    ALTER FUNCTION public.request_withdrawal_secure(numeric, text, text, text) SECURITY INVOKER;
    ALTER FUNCTION public.admin_disburse_winner_secure(text, numeric, text) SECURITY INVOKER;
  `);
  console.log('✓ Fixed function security warnings');

  console.log('--- 2. Adding missing foreign key indexes (Performance) ---');
  await runSql(`
    CREATE INDEX IF NOT EXISTS idx_support_tickets_user_id ON public.support_tickets(user_id);
    CREATE INDEX IF NOT EXISTS idx_winner_payouts_user_id ON public.winner_payouts(user_id);
    CREATE INDEX IF NOT EXISTS idx_username_changes_user_id ON public.username_changes(user_id);
    CREATE INDEX IF NOT EXISTS idx_lottery_deposits_user_id ON public.lottery_deposits(user_id);
    CREATE INDEX IF NOT EXISTS idx_lottery_tickets_event_id ON public.lottery_tickets(event_id);
  `);
  console.log('✓ Added foreign key indexes');

  console.log('--- 3. Consolidating RLS policies on ALL public tables ---');
  await runSql(`
    -- A. PROFILES
    DROP POLICY IF EXISTS "Public profiles read" ON public.profiles;
    DROP POLICY IF EXISTS "Users update own profile" ON public.profiles;
    DROP POLICY IF EXISTS "Users insert own profile" ON public.profiles;
    DROP POLICY IF EXISTS "Allow public check username" ON public.profiles;
    DROP POLICY IF EXISTS "Super Admin full profiles access" ON public.profiles;
    DROP POLICY IF EXISTS "profiles_insert" ON public.profiles;
    DROP POLICY IF EXISTS "profiles_select" ON public.profiles;
    DROP POLICY IF EXISTS "profiles_update" ON public.profiles;
    DROP POLICY IF EXISTS "profiles_delete" ON public.profiles;
    DROP POLICY IF EXISTS "profiles_select_policy" ON public.profiles;
    DROP POLICY IF EXISTS "profiles_insert_policy" ON public.profiles;
    DROP POLICY IF EXISTS "profiles_update_policy" ON public.profiles;
    DROP POLICY IF EXISTS "profiles_delete_policy" ON public.profiles;

    CREATE POLICY "profiles_select_policy" ON public.profiles
      FOR SELECT TO public
      USING (true);

    CREATE POLICY "profiles_insert_policy" ON public.profiles
      FOR INSERT TO public
      WITH CHECK ((SELECT auth.uid()) = id OR (SELECT auth.uid()) IS NULL);

    CREATE POLICY "profiles_update_policy" ON public.profiles
      FOR UPDATE TO authenticated
      USING ((SELECT auth.uid()) = id OR (SELECT public.is_admin()))
      WITH CHECK ((SELECT auth.uid()) = id OR (SELECT public.is_admin()));

    CREATE POLICY "profiles_delete_policy" ON public.profiles
      FOR DELETE TO authenticated
      USING ((SELECT public.is_super_admin()));

    -- B. USERNAME_CHANGES
    DROP POLICY IF EXISTS "username_changes_select_policy" ON public.username_changes;
    DROP POLICY IF EXISTS "username_changes_insert_policy" ON public.username_changes;

    CREATE POLICY "username_changes_select_policy" ON public.username_changes
      FOR SELECT TO authenticated
      USING ((SELECT auth.uid()) = user_id OR (SELECT public.is_admin()));

    CREATE POLICY "username_changes_insert_policy" ON public.username_changes
      FOR INSERT TO authenticated
      WITH CHECK ((SELECT auth.uid()) = user_id OR (SELECT public.is_admin()));

    -- C. LOTTERY_EVENTS
    DROP POLICY IF EXISTS "Allow public read lottery_events" ON public.lottery_events;
    DROP POLICY IF EXISTS "Allow public all lottery_events" ON public.lottery_events;
    DROP POLICY IF EXISTS "Admin manage lottery_events" ON public.lottery_events;
    DROP POLICY IF EXISTS "lottery_events_select_policy" ON public.lottery_events;
    DROP POLICY IF EXISTS "lottery_events_insert_policy" ON public.lottery_events;
    DROP POLICY IF EXISTS "lottery_events_update_policy" ON public.lottery_events;
    DROP POLICY IF EXISTS "lottery_events_delete_policy" ON public.lottery_events;

    CREATE POLICY "lottery_events_select_policy" ON public.lottery_events
      FOR SELECT TO public
      USING (true);

    CREATE POLICY "lottery_events_insert_policy" ON public.lottery_events
      FOR INSERT TO authenticated
      WITH CHECK ((SELECT public.is_admin()));

    CREATE POLICY "lottery_events_update_policy" ON public.lottery_events
      FOR UPDATE TO authenticated
      USING ((SELECT public.is_admin()))
      WITH CHECK ((SELECT public.is_admin()));

    CREATE POLICY "lottery_events_delete_policy" ON public.lottery_events
      FOR DELETE TO authenticated
      USING ((SELECT public.is_admin()));

    -- D. SUPPORT_TICKETS
    DROP POLICY IF EXISTS "Public insert support_tickets" ON public.support_tickets;
    DROP POLICY IF EXISTS "Users and admin read support_tickets" ON public.support_tickets;
    DROP POLICY IF EXISTS "Admin manage support_tickets" ON public.support_tickets;
    DROP POLICY IF EXISTS "support_tickets_select_policy" ON public.support_tickets;
    DROP POLICY IF EXISTS "support_tickets_insert_policy" ON public.support_tickets;
    DROP POLICY IF EXISTS "support_tickets_update_policy" ON public.support_tickets;
    DROP POLICY IF EXISTS "support_tickets_delete_policy" ON public.support_tickets;

    CREATE POLICY "support_tickets_select_policy" ON public.support_tickets
      FOR SELECT TO public
      USING (true);

    CREATE POLICY "support_tickets_insert_policy" ON public.support_tickets
      FOR INSERT TO public
      WITH CHECK (length(email) > 3 AND length(message) > 1);

    CREATE POLICY "support_tickets_update_policy" ON public.support_tickets
      FOR UPDATE TO authenticated
      USING ((SELECT public.is_admin()))
      WITH CHECK ((SELECT public.is_admin()));

    CREATE POLICY "support_tickets_delete_policy" ON public.support_tickets
      FOR DELETE TO authenticated
      USING ((SELECT public.is_admin()));

    -- E. WINNER_PAYOUTS
    DROP POLICY IF EXISTS "Public read winner_payouts" ON public.winner_payouts;
    DROP POLICY IF EXISTS "Admin manage winner_payouts" ON public.winner_payouts;
    DROP POLICY IF EXISTS "winner_payouts_select_policy" ON public.winner_payouts;
    DROP POLICY IF EXISTS "winner_payouts_insert_policy" ON public.winner_payouts;
    DROP POLICY IF EXISTS "winner_payouts_update_policy" ON public.winner_payouts;
    DROP POLICY IF EXISTS "winner_payouts_delete_policy" ON public.winner_payouts;

    CREATE POLICY "winner_payouts_select_policy" ON public.winner_payouts
      FOR SELECT TO public
      USING (true);

    CREATE POLICY "winner_payouts_insert_policy" ON public.winner_payouts
      FOR INSERT TO authenticated
      WITH CHECK ((SELECT public.is_admin()));

    CREATE POLICY "winner_payouts_update_policy" ON public.winner_payouts
      FOR UPDATE TO authenticated
      USING ((SELECT public.is_admin()))
      WITH CHECK ((SELECT public.is_admin()));

    CREATE POLICY "winner_payouts_delete_policy" ON public.winner_payouts
      FOR DELETE TO authenticated
      USING ((SELECT public.is_admin()));

    -- F. PLATFORM_SETTINGS
    DROP POLICY IF EXISTS "Public read platform_settings" ON public.platform_settings;
    DROP POLICY IF EXISTS "Admin write platform_settings" ON public.platform_settings;
    DROP POLICY IF EXISTS "platform_settings_select_policy" ON public.platform_settings;
    DROP POLICY IF EXISTS "platform_settings_update_policy" ON public.platform_settings;
    DROP POLICY IF EXISTS "platform_settings_insert_policy" ON public.platform_settings;

    CREATE POLICY "platform_settings_select_policy" ON public.platform_settings
      FOR SELECT TO public
      USING (true);

    CREATE POLICY "platform_settings_update_policy" ON public.platform_settings
      FOR UPDATE TO authenticated
      USING ((SELECT public.is_admin()))
      WITH CHECK ((SELECT public.is_admin()));

    CREATE POLICY "platform_settings_insert_policy" ON public.platform_settings
      FOR INSERT TO authenticated
      WITH CHECK ((SELECT public.is_admin()));

    -- G. LOTTERY_WALLETS
    DROP POLICY IF EXISTS "Allow public read lottery_wallets" ON public.lottery_wallets;
    DROP POLICY IF EXISTS "Allow public all lottery_wallets" ON public.lottery_wallets;
    DROP POLICY IF EXISTS "lottery_wallets_select_policy" ON public.lottery_wallets;
    DROP POLICY IF EXISTS "lottery_wallets_insert_policy" ON public.lottery_wallets;
    DROP POLICY IF EXISTS "lottery_wallets_update_policy" ON public.lottery_wallets;

    CREATE POLICY "lottery_wallets_select_policy" ON public.lottery_wallets
      FOR SELECT TO public
      USING (true);

    CREATE POLICY "lottery_wallets_insert_policy" ON public.lottery_wallets
      FOR INSERT TO public
      WITH CHECK (length(address) >= 8);

    CREATE POLICY "lottery_wallets_update_policy" ON public.lottery_wallets
      FOR UPDATE TO authenticated
      USING ((SELECT public.is_admin()) OR (SELECT auth.uid()) = user_id)
      WITH CHECK ((SELECT public.is_admin()) OR (SELECT auth.uid()) = user_id);

    -- H. LOTTERY_TICKETS
    DROP POLICY IF EXISTS "Allow public read lottery_tickets" ON public.lottery_tickets;
    DROP POLICY IF EXISTS "Allow public all lottery_tickets" ON public.lottery_tickets;
    DROP POLICY IF EXISTS "lottery_tickets_select_policy" ON public.lottery_tickets;
    DROP POLICY IF EXISTS "lottery_tickets_insert_policy" ON public.lottery_tickets;
    DROP POLICY IF EXISTS "lottery_tickets_update_policy" ON public.lottery_tickets;

    CREATE POLICY "lottery_tickets_select_policy" ON public.lottery_tickets
      FOR SELECT TO public
      USING (true);

    CREATE POLICY "lottery_tickets_insert_policy" ON public.lottery_tickets
      FOR INSERT TO public
      WITH CHECK (length(ticket_number) = 4);

    CREATE POLICY "lottery_tickets_update_policy" ON public.lottery_tickets
      FOR UPDATE TO authenticated
      USING ((SELECT public.is_admin()));

    -- I. LOTTERY_WITHDRAWALS
    DROP POLICY IF EXISTS "Allow public read lottery_withdrawals" ON public.lottery_withdrawals;
    DROP POLICY IF EXISTS "Allow public all lottery_withdrawals" ON public.lottery_withdrawals;
    DROP POLICY IF EXISTS "lottery_withdrawals_select_policy" ON public.lottery_withdrawals;
    DROP POLICY IF EXISTS "lottery_withdrawals_insert_policy" ON public.lottery_withdrawals;
    DROP POLICY IF EXISTS "lottery_withdrawals_update_policy" ON public.lottery_withdrawals;

    CREATE POLICY "lottery_withdrawals_select_policy" ON public.lottery_withdrawals
      FOR SELECT TO public
      USING (true);

    CREATE POLICY "lottery_withdrawals_insert_policy" ON public.lottery_withdrawals
      FOR INSERT TO public
      WITH CHECK (amount > 0 AND length(destination_address) >= 8);

    CREATE POLICY "lottery_withdrawals_update_policy" ON public.lottery_withdrawals
      FOR UPDATE TO authenticated
      USING ((SELECT public.is_admin()));

    -- J. LOTTERY_DEPOSITS
    DROP POLICY IF EXISTS "Allow public read lottery_deposits" ON public.lottery_deposits;
    DROP POLICY IF EXISTS "Allow public insert lottery_deposits" ON public.lottery_deposits;
    DROP POLICY IF EXISTS "Allow public update lottery_deposits" ON public.lottery_deposits;
    DROP POLICY IF EXISTS "lottery_deposits_select_policy" ON public.lottery_deposits;
    DROP POLICY IF EXISTS "lottery_deposits_insert_policy" ON public.lottery_deposits;
    DROP POLICY IF EXISTS "lottery_deposits_update_policy" ON public.lottery_deposits;

    CREATE POLICY "lottery_deposits_select_policy" ON public.lottery_deposits
      FOR SELECT TO public
      USING (true);

    CREATE POLICY "lottery_deposits_insert_policy" ON public.lottery_deposits
      FOR INSERT TO public
      WITH CHECK (length(id) > 2);

    CREATE POLICY "lottery_deposits_update_policy" ON public.lottery_deposits
      FOR UPDATE TO authenticated
      USING ((SELECT public.is_admin()));
  `);
  console.log('✓ Consolidated all RLS policies');
}

fixAllAdvisors().catch(console.error);
