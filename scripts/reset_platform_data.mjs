import { runSql } from './supabase_admin.mjs';

async function resetPlatformData() {
  console.log('--- 1. Resetting all event and transaction data to 0-0 ---');
  await runSql(`
    -- Delete all events, tickets, and payouts
    DELETE FROM public.winner_payouts;
    DELETE FROM public.lottery_tickets;
    DELETE FROM public.lottery_events;

    -- Delete all test/mock deposits and withdrawals
    DELETE FROM public.lottery_deposits;
    DELETE FROM public.lottery_withdrawals;

    -- Delete support tickets and username change audit logs
    DELETE FROM public.support_tickets;
    DELETE FROM public.username_changes;

    -- Remove orphan/unassigned dummy wallets
    DELETE FROM public.lottery_wallets WHERE user_id IS NULL;

    -- Reset all user wallets to clean 0.00 balance and 0.00 lifetime won
    UPDATE public.lottery_wallets
    SET balance = 0.00,
        lifetime_won = 0.00,
        updated_at = now();
  `);
  console.log('✓ All platform data cleanly reset to 0-0.');

  console.log('--- 2. Ensuring admin user deletion cascades to auth.users & profiles ---');
  await runSql(`
    -- Function to delete from auth.users when profile is deleted by admin
    CREATE OR REPLACE FUNCTION public.handle_user_deletion()
    RETURNS trigger
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path = public, auth, pg_temp
    AS $$
    BEGIN
      -- Delete from auth.users (if still present)
      DELETE FROM auth.users WHERE id = OLD.id;
      
      -- Clean up any related user records across tables
      DELETE FROM public.lottery_wallets WHERE user_id = OLD.id;
      DELETE FROM public.lottery_tickets WHERE user_id = OLD.id;
      DELETE FROM public.lottery_deposits WHERE user_id = OLD.id;
      DELETE FROM public.lottery_withdrawals WHERE user_id = OLD.id;
      DELETE FROM public.support_tickets WHERE user_id = OLD.id;
      DELETE FROM public.username_changes WHERE user_id = OLD.id;
      DELETE FROM public.winner_payouts WHERE user_id = OLD.id;
      
      RETURN OLD;
    END;
    $$;

    REVOKE EXECUTE ON FUNCTION public.handle_user_deletion() FROM PUBLIC, anon, authenticated;

    DROP TRIGGER IF EXISTS on_profile_deleted ON public.profiles;
    CREATE TRIGGER on_profile_deleted
      AFTER DELETE ON public.profiles
      FOR EACH ROW
      EXECUTE FUNCTION public.handle_user_deletion();

    -- Also handle case where user is deleted directly in Supabase Auth Dashboard
    CREATE OR REPLACE FUNCTION public.handle_auth_user_deletion()
    RETURNS trigger
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path = public, auth, pg_temp
    AS $$
    BEGIN
      DELETE FROM public.profiles WHERE id = OLD.id;
      RETURN OLD;
    END;
    $$;

    REVOKE EXECUTE ON FUNCTION public.handle_auth_user_deletion() FROM PUBLIC, anon, authenticated;

    DROP TRIGGER IF EXISTS on_auth_user_deleted ON auth.users;
    CREATE TRIGGER on_auth_user_deleted
      AFTER DELETE ON auth.users
      FOR EACH ROW
      EXECUTE FUNCTION public.handle_auth_user_deletion();

    -- Ensure profiles delete policy allows admin & super_admin
    DROP POLICY IF EXISTS "profiles_delete_policy" ON public.profiles;
    CREATE POLICY "profiles_delete_policy" ON public.profiles
      FOR DELETE TO authenticated
      USING ((SELECT public.is_admin()));

    -- Ensure lottery_events update policy allows authenticated ticket updates or admin
    DROP POLICY IF EXISTS "lottery_events_update_policy" ON public.lottery_events;
    CREATE POLICY "lottery_events_update_policy" ON public.lottery_events
      FOR UPDATE TO authenticated
      USING ((SELECT auth.uid()) IS NOT NULL)
      WITH CHECK ((SELECT auth.uid()) IS NOT NULL);
  `);
  console.log('✓ Configured bi-directional user deletion and clean RLS.');

  // Verification queries
  const counts = await runSql(`
    SELECT
      (SELECT count(*) FROM public.lottery_events) AS events,
      (SELECT count(*) FROM public.lottery_tickets) AS tickets,
      (SELECT count(*) FROM public.winner_payouts) AS payouts,
      (SELECT count(*) FROM public.lottery_deposits) AS deposits,
      (SELECT count(*) FROM public.lottery_withdrawals) AS withdrawals,
      (SELECT count(*) FROM public.support_tickets) AS support_tickets,
      (SELECT count(*) FROM public.lottery_wallets) AS wallets;
  `);
  console.log('Final counts:', counts[0]);

  const walletBalances = await runSql(`SELECT address, balance, lifetime_won, user_id FROM public.lottery_wallets;`);
  console.log('Remaining registered wallets:', walletBalances);
}

resetPlatformData().catch(console.error);
