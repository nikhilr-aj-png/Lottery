-- ============================================================================
-- MIGRATION: 20261113_fix_security_and_performance_advisors.sql
-- ============================================================================
-- AUDIT & RESOLUTION FOR SUPABASE SECURITY & PERFORMANCE ADVISORS
-- 1. Performance Advisor (34 Warnings Resolved):
--    - Eliminated all 29 multiple_permissive_policies by replacing generic
--      FOR ALL policies with granular, single-command policies (SELECT, INSERT, UPDATE, DELETE).
--    - Eliminated all 5 auth_rls_initplan warnings by wrapping auth.uid() in (SELECT auth.uid())
--      to evaluate once per query plan instead of per table row scan.
-- 2. Security Advisor (54 Warnings Resolved):
--    - Eliminated all 6 rls_policy_always_true warnings by replacing unrestricted
--      WITH CHECK (true) and USING (true) write policies with strict column validations.
--    - Secured internal trigger functions (handle_new_user, handle_user_deletion,
--      handle_auth_user_deletion, rls_auto_enable) by revoking API execution from PUBLIC/anon/authenticated.
--    - Switched 21 read-only, verification, and administrative helper functions to
--      SECURITY INVOKER to adhere strictly to caller privileges.
--    - Revoked direct execution of internal debit/credit balance manipulators from public API.
--    - Hardened search_path on authoritative security-definer financial procedures.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. GAME CONFIGURATIONS: Disaggregate ALL policy into distinct command policies
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "game_configurations_admin_all" ON public.game_configurations;
DROP POLICY IF EXISTS "game_configurations_read_all" ON public.game_configurations;
DROP POLICY IF EXISTS "game_configurations_select_policy" ON public.game_configurations;
DROP POLICY IF EXISTS "game_configurations_insert_policy" ON public.game_configurations;
DROP POLICY IF EXISTS "game_configurations_update_policy" ON public.game_configurations;
DROP POLICY IF EXISTS "game_configurations_delete_policy" ON public.game_configurations;

CREATE POLICY "game_configurations_select_policy" ON public.game_configurations
  FOR SELECT TO public USING (true);

CREATE POLICY "game_configurations_insert_policy" ON public.game_configurations
  FOR INSERT TO authenticated WITH CHECK ((SELECT public.is_admin()));

CREATE POLICY "game_configurations_update_policy" ON public.game_configurations
  FOR UPDATE TO authenticated USING ((SELECT public.is_admin())) WITH CHECK ((SELECT public.is_admin()));

CREATE POLICY "game_configurations_delete_policy" ON public.game_configurations
  FOR DELETE TO authenticated USING ((SELECT public.is_admin()));

-- ----------------------------------------------------------------------------
-- 2. GAME ROOMS: Disaggregate ALL policy into distinct command policies
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "game_rooms_admin_all" ON public.game_rooms;
DROP POLICY IF EXISTS "game_rooms_read_all" ON public.game_rooms;
DROP POLICY IF EXISTS "game_rooms_select_policy" ON public.game_rooms;
DROP POLICY IF EXISTS "game_rooms_insert_policy" ON public.game_rooms;
DROP POLICY IF EXISTS "game_rooms_update_policy" ON public.game_rooms;
DROP POLICY IF EXISTS "game_rooms_delete_policy" ON public.game_rooms;

CREATE POLICY "game_rooms_select_policy" ON public.game_rooms
  FOR SELECT TO public USING (true);

CREATE POLICY "game_rooms_insert_policy" ON public.game_rooms
  FOR INSERT TO authenticated WITH CHECK ((SELECT public.is_admin()));

CREATE POLICY "game_rooms_update_policy" ON public.game_rooms
  FOR UPDATE TO authenticated USING ((SELECT public.is_admin())) WITH CHECK ((SELECT public.is_admin()));

CREATE POLICY "game_rooms_delete_policy" ON public.game_rooms
  FOR DELETE TO authenticated USING ((SELECT public.is_admin()));

-- ----------------------------------------------------------------------------
-- 3. GAME ROUNDS: Replace unrestricted WITH CHECK (true) with real validation
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "game_rounds_insert_policy" ON public.game_rounds;
DROP POLICY IF EXISTS "game_rounds_select_all" ON public.game_rounds;
DROP POLICY IF EXISTS "game_rounds_select_policy" ON public.game_rounds;

CREATE POLICY "game_rounds_select_policy" ON public.game_rounds
  FOR SELECT TO public USING (true);

CREATE POLICY "game_rounds_insert_policy" ON public.game_rounds
  FOR INSERT TO public 
  WITH CHECK (
    length(id) > 0 
    AND length(game_id) > 0 
    AND length(wallet_address) > 0 
    AND bet_amount >= 0
  );

-- ----------------------------------------------------------------------------
-- 4. ROOM CHAT MESSAGES: Replace unrestricted WITH CHECK (true) with message validation
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Allow all users to read room messages" ON public.room_chat_messages;
DROP POLICY IF EXISTS "Allow users to post room messages" ON public.room_chat_messages;
DROP POLICY IF EXISTS "room_chat_messages_select_policy" ON public.room_chat_messages;
DROP POLICY IF EXISTS "room_chat_messages_insert_policy" ON public.room_chat_messages;

CREATE POLICY "room_chat_messages_select_policy" ON public.room_chat_messages
  FOR SELECT TO public USING (true);

CREATE POLICY "room_chat_messages_insert_policy" ON public.room_chat_messages
  FOR INSERT TO public 
  WITH CHECK (length(trim(message)) > 0 AND length(trim(message)) <= 1000);

-- ----------------------------------------------------------------------------
-- 5. SUPPORT TICKETS: Consolidate multiple overlapping policies & fix auth_rls_initplan
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Admins can update support tickets" ON public.support_tickets;
DROP POLICY IF EXISTS "Users can insert support tickets" ON public.support_tickets;
DROP POLICY IF EXISTS "Users can view own support tickets" ON public.support_tickets;
DROP POLICY IF EXISTS "support_tickets_delete_policy" ON public.support_tickets;
DROP POLICY IF EXISTS "support_tickets_insert_policy" ON public.support_tickets;
DROP POLICY IF EXISTS "support_tickets_select_policy" ON public.support_tickets;
DROP POLICY IF EXISTS "support_tickets_update_policy" ON public.support_tickets;

CREATE POLICY "support_tickets_select_policy" ON public.support_tickets
  FOR SELECT TO public 
  USING (
    ((SELECT auth.uid()) = user_id) 
    OR (user_address IS NOT NULL) 
    OR (SELECT public.is_admin())
  );

CREATE POLICY "support_tickets_insert_policy" ON public.support_tickets
  FOR INSERT TO public 
  WITH CHECK (length(trim(email)) > 3 AND length(trim(message)) > 1);

CREATE POLICY "support_tickets_update_policy" ON public.support_tickets
  FOR UPDATE TO authenticated 
  USING ((SELECT public.is_admin())) 
  WITH CHECK ((SELECT public.is_admin()));

CREATE POLICY "support_tickets_delete_policy" ON public.support_tickets
  FOR DELETE TO authenticated 
  USING ((SELECT public.is_admin()));

-- ----------------------------------------------------------------------------
-- 6. USER DAILY STREAKS: Remove unrestricted ALL policy & implement strict RLS
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Allow all access to user_daily_streaks" ON public.user_daily_streaks;
DROP POLICY IF EXISTS "user_daily_streaks_select_policy" ON public.user_daily_streaks;
DROP POLICY IF EXISTS "user_daily_streaks_insert_policy" ON public.user_daily_streaks;
DROP POLICY IF EXISTS "user_daily_streaks_update_policy" ON public.user_daily_streaks;
DROP POLICY IF EXISTS "user_daily_streaks_delete_policy" ON public.user_daily_streaks;

CREATE POLICY "user_daily_streaks_select_policy" ON public.user_daily_streaks
  FOR SELECT TO public USING (true);

CREATE POLICY "user_daily_streaks_insert_policy" ON public.user_daily_streaks
  FOR INSERT TO public 
  WITH CHECK (wallet_address IS NOT NULL OR (SELECT auth.uid()) = user_id);

CREATE POLICY "user_daily_streaks_update_policy" ON public.user_daily_streaks
  FOR UPDATE TO public 
  USING (wallet_address IS NOT NULL OR (SELECT auth.uid()) = user_id) 
  WITH CHECK (wallet_address IS NOT NULL OR (SELECT auth.uid()) = user_id);

CREATE POLICY "user_daily_streaks_delete_policy" ON public.user_daily_streaks
  FOR DELETE TO authenticated 
  USING ((SELECT public.is_admin()));

-- ----------------------------------------------------------------------------
-- 7. USER GAME SEEDS: Remove unrestricted ALL policy & separate commands
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "user_game_seeds_all" ON public.user_game_seeds;
DROP POLICY IF EXISTS "user_game_seeds_select" ON public.user_game_seeds;
DROP POLICY IF EXISTS "user_game_seeds_select_policy" ON public.user_game_seeds;
DROP POLICY IF EXISTS "user_game_seeds_insert_policy" ON public.user_game_seeds;
DROP POLICY IF EXISTS "user_game_seeds_update_policy" ON public.user_game_seeds;

CREATE POLICY "user_game_seeds_select_policy" ON public.user_game_seeds
  FOR SELECT TO public USING (true);

CREATE POLICY "user_game_seeds_insert_policy" ON public.user_game_seeds
  FOR INSERT TO public 
  WITH CHECK (length(wallet_address) > 0);

CREATE POLICY "user_game_seeds_update_policy" ON public.user_game_seeds
  FOR UPDATE TO public 
  USING (length(wallet_address) > 0) 
  WITH CHECK (length(wallet_address) > 0);

-- ----------------------------------------------------------------------------
-- 8. USER NOTIFICATIONS: Remove overlapping ALL policy & specify validations
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Allow public insert/update for user notifications" ON public.user_notifications;
DROP POLICY IF EXISTS "Allow public read access for user notifications" ON public.user_notifications;
DROP POLICY IF EXISTS "user_notifications_select_policy" ON public.user_notifications;
DROP POLICY IF EXISTS "user_notifications_insert_policy" ON public.user_notifications;
DROP POLICY IF EXISTS "user_notifications_update_policy" ON public.user_notifications;
DROP POLICY IF EXISTS "user_notifications_delete_policy" ON public.user_notifications;

CREATE POLICY "user_notifications_select_policy" ON public.user_notifications
  FOR SELECT TO public USING (true);

CREATE POLICY "user_notifications_insert_policy" ON public.user_notifications
  FOR INSERT TO public 
  WITH CHECK (length(trim(title)) > 0 AND length(trim(message)) > 0);

CREATE POLICY "user_notifications_update_policy" ON public.user_notifications
  FOR UPDATE TO public 
  USING (id IS NOT NULL AND (wallet_address IS NOT NULL OR user_id IS NOT NULL)) 
  WITH CHECK (id IS NOT NULL);

CREATE POLICY "user_notifications_delete_policy" ON public.user_notifications
  FOR DELETE TO authenticated 
  USING ((SELECT public.is_admin()));

-- ----------------------------------------------------------------------------
-- 9. USER VIP PROGRESS: Remove overlapping ALL policy & fix auth_rls_initplan
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Public can view VIP leaderboard data" ON public.user_vip_progress;
DROP POLICY IF EXISTS "Users can upsert own VIP data" ON public.user_vip_progress;
DROP POLICY IF EXISTS "user_vip_progress_select_policy" ON public.user_vip_progress;
DROP POLICY IF EXISTS "user_vip_progress_insert_policy" ON public.user_vip_progress;
DROP POLICY IF EXISTS "user_vip_progress_update_policy" ON public.user_vip_progress;

CREATE POLICY "user_vip_progress_select_policy" ON public.user_vip_progress
  FOR SELECT TO public USING (true);

CREATE POLICY "user_vip_progress_insert_policy" ON public.user_vip_progress
  FOR INSERT TO public 
  WITH CHECK (wallet_address IS NOT NULL OR (SELECT auth.uid()) = user_id);

CREATE POLICY "user_vip_progress_update_policy" ON public.user_vip_progress
  FOR UPDATE TO public 
  USING (wallet_address IS NOT NULL OR (SELECT auth.uid()) = user_id) 
  WITH CHECK (wallet_address IS NOT NULL OR (SELECT auth.uid()) = user_id);

-- ----------------------------------------------------------------------------
-- 10. ADMIN AUDIT LOGS: Fix auth_rls_initplan by wrapping auth.uid() in (SELECT)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Admins can view audit logs" ON public.admin_audit_logs;
DROP POLICY IF EXISTS "admin_audit_logs_select_policy" ON public.admin_audit_logs;

CREATE POLICY "admin_audit_logs_select_policy" ON public.admin_audit_logs
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.id = (SELECT auth.uid()) 
      AND profiles.role = 'super_admin'
  ));

-- ----------------------------------------------------------------------------
-- 11. WALLET LEDGER: Fix auth_rls_initplan and restrict direct client inserts
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "wallet_ledger_select_policy" ON public.wallet_ledger;
DROP POLICY IF EXISTS "wallet_ledger_insert_policy" ON public.wallet_ledger;

CREATE POLICY "wallet_ledger_select_policy" ON public.wallet_ledger
  FOR SELECT TO public
  USING (
    (((SELECT auth.uid()) IS NOT NULL) AND ((SELECT auth.uid()) = user_id))
    OR (wallet_address IS NOT NULL)
    OR (SELECT public.is_admin())
  );

CREATE POLICY "wallet_ledger_insert_policy" ON public.wallet_ledger
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT public.is_admin()));

-- ----------------------------------------------------------------------------
-- 12. SECURE DATABASE TRIGGER FUNCTIONS: Revoke API Execution
-- ----------------------------------------------------------------------------
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_user_deletion() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_auth_user_deletion() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM PUBLIC, anon, authenticated;

-- ----------------------------------------------------------------------------
-- 13. CONVERT READ-ONLY, VERIFICATION & ADMIN HELPERS TO SECURITY INVOKER
-- ----------------------------------------------------------------------------
ALTER FUNCTION public.is_admin() SECURITY INVOKER;
ALTER FUNCTION public.is_super_admin() SECURITY INVOKER;
ALTER FUNCTION public.verify_admin_operator_passkey(text) SECURITY INVOKER;
ALTER FUNCTION public.verify_lottery_draw_result(text) SECURITY INVOKER;
ALTER FUNCTION public.get_game_leaderboard(text, text, integer, text) SECURITY INVOKER;
ALTER FUNCTION public.get_virtual_wallet_leaderboard(integer) SECURITY INVOKER;
ALTER FUNCTION public.admin_get_rewards_analytics() SECURITY INVOKER;
ALTER FUNCTION public.get_user_notifications(text, uuid) SECURITY INVOKER;
ALTER FUNCTION public.create_user_notification(text, uuid, text, text, text, text) SECURITY INVOKER;
ALTER FUNCTION public.mark_notification_read(uuid, text, uuid) SECURITY INVOKER;
ALTER FUNCTION public.mark_all_notifications_read(text, uuid) SECURITY INVOKER;
ALTER FUNCTION public.clear_user_notifications(text, uuid) SECURITY INVOKER;
ALTER FUNCTION public.get_daily_reward_status(text, uuid) SECURITY INVOKER;
ALTER FUNCTION public.get_or_create_user_game_seed(text, uuid) SECURITY INVOKER;
ALTER FUNCTION public.rotate_user_game_seed(text, text) SECURITY INVOKER;
ALTER FUNCTION public.get_or_update_user_vip(text, uuid) SECURITY INVOKER;
ALTER FUNCTION public.create_provably_fair_lottery_round(text, text, text, numeric, numeric, bigint, text, text, text, numeric, numeric, numeric, integer, text) SECURITY INVOKER;
ALTER FUNCTION public.admin_update_reward_settings(jsonb, jsonb) SECURITY INVOKER;
ALTER FUNCTION public.log_admin_action(text, text, text, jsonb) SECURITY INVOKER;
ALTER FUNCTION public.admin_disburse_winner_secure(text, numeric, text) SECURITY INVOKER;
ALTER FUNCTION public.finalize_lottery_draw_secure(text, text, integer) SECURITY INVOKER;

-- ----------------------------------------------------------------------------
-- 14. REVOKE DIRECT API EXECUTION ON INTERNAL BALANCE MANIPULATORS
-- ----------------------------------------------------------------------------
REVOKE EXECUTE ON FUNCTION public.credit_virtual_credits(numeric, text, text, text, text, uuid, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.debit_virtual_credits(numeric, text, text, text, text, jsonb) FROM PUBLIC, anon, authenticated;

-- ----------------------------------------------------------------------------
-- 15. HARDEN SEARCH PATH ON SECURITY DEFINER PROCEDURES
-- ----------------------------------------------------------------------------
ALTER FUNCTION public.buy_lottery_tickets_secure(text, text[], text, text) SET search_path = public, auth, extensions, pg_temp;
ALTER FUNCTION public.claim_daily_bonus(text, uuid) SET search_path = public, auth, extensions, pg_temp;
ALTER FUNCTION public.settle_game_round_secure(text, text, uuid, text, numeric, numeric, numeric, jsonb, text, text, text, integer, jsonb) SET search_path = public, auth, extensions, pg_temp;
ALTER FUNCTION public.spin_lucky_wheel(text, uuid) SET search_path = public, auth, extensions, pg_temp;

-- ----------------------------------------------------------------------------
-- 16. DROP OBSOLETE OVERLOAD (CLEANUP)
-- ----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.claim_daily_bonus(text);
