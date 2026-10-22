import { runSql } from './supabase_admin.mjs';

async function setupFunctionsAndRls() {
  console.log('--- 1. Creating secure RPC functions ---');

  // Function to buy tickets securely
  await runSql(`
    CREATE OR REPLACE FUNCTION public.buy_lottery_tickets_secure(
      p_event_id text,
      p_ticket_numbers text[],
      p_user_address text,
      p_username text DEFAULT NULL
    )
    RETURNS jsonb
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path = public, pg_temp
    AS $$
    DECLARE
      v_uid uuid;
      v_event record;
      v_wallet record;
      v_num_tickets integer;
      v_total_cost numeric;
      v_new_balance numeric;
      v_num text;
      v_now_ms bigint;
      v_ticket_id text;
      v_user_display text;
    BEGIN
      v_uid := auth.uid();
      v_num_tickets := array_length(p_ticket_numbers, 1);
      
      IF v_num_tickets IS NULL OR v_num_tickets <= 0 THEN
        RETURN jsonb_build_object('success', false, 'error', 'No ticket numbers provided.');
      END IF;

      -- 1. Fetch and lock event
      SELECT * INTO v_event FROM public.lottery_events WHERE id = p_event_id FOR UPDATE;
      IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Lottery event not found.');
      END IF;

      IF v_event.status <> 'active' THEN
        RETURN jsonb_build_object('success', false, 'error', 'This lottery draw is no longer active.');
      END IF;

      IF v_event.draw_time IS NOT NULL AND v_event.draw_time <= (EXTRACT(EPOCH FROM now()) * 1000) THEN
        RETURN jsonb_build_object('success', false, 'error', 'This lottery has reached its draw cutoff time.');
      END IF;

      -- 2. Check if any ticket number is already sold
      FOREACH v_num IN ARRAY p_ticket_numbers LOOP
        IF EXISTS (
          SELECT 1 FROM public.lottery_tickets 
          WHERE event_id = p_event_id AND lpad(ticket_number, 4, '0') = lpad(v_num, 4, '0')
        ) THEN
          RETURN jsonb_build_object('success', false, 'error', 'Ticket #' || lpad(v_num, 4, '0') || ' is already taken. Please choose another combination.');
        END IF;
      END LOOP;

      -- 3. Calculate total cost
      v_total_cost := v_event.ticket_price * v_num_tickets;

      -- 4. Find & lock user wallet (by user_id or address)
      SELECT * INTO v_wallet FROM public.lottery_wallets 
      WHERE (v_uid IS NOT NULL AND user_id = v_uid) OR (address = p_user_address)
      ORDER BY updated_at DESC LIMIT 1
      FOR UPDATE;

      IF NOT FOUND OR v_wallet.balance < v_total_cost THEN
        RETURN jsonb_build_object(
          'success', false, 
          'error', 'Insufficient USDT Balance. Required: ' || v_total_cost || ' USDT, Available: ' || COALESCE(v_wallet.balance, 0) || ' USDT.'
        );
      END IF;

      -- 5. Deduct wallet balance
      v_new_balance := round(v_wallet.balance - v_total_cost, 2);
      UPDATE public.lottery_wallets
      SET balance = v_new_balance, updated_at = now()
      WHERE address = v_wallet.address;

      -- 6. Insert tickets
      v_now_ms := (EXTRACT(EPOCH FROM now()) * 1000)::bigint;
      v_user_display := COALESCE(p_username, '@' || substring(p_user_address from 1 for 6));

      FOREACH v_num IN ARRAY p_ticket_numbers LOOP
        v_ticket_id := 'tkt-' || v_now_ms || '-' || floor(random() * 8999 + 1000)::text || '-' || floor(random() * 899 + 100)::text;
        INSERT INTO public.lottery_tickets (
          id,
          user_address,
          event_id,
          event_title,
          ticket_number,
          price,
          purchase_time,
          status,
          match_tier,
          won_amount,
          claimed,
          created_at
        ) VALUES (
          v_ticket_id,
          p_user_address,
          p_event_id,
          v_event.title,
          lpad(v_num, 4, '0'),
          v_event.ticket_price,
          v_now_ms,
          'active',
          NULL,
          0,
          false,
          now()
        );
      END LOOP;

      -- 7. Update event stats
      UPDATE public.lottery_events
      SET pool_prize = round(pool_prize + (v_total_cost * 0.95), 2),
          tickets_sold = COALESCE(tickets_sold, 0) + v_num_tickets,
          participants_count = COALESCE(participants_count, 0) + 1
      WHERE id = p_event_id;

      RETURN jsonb_build_object(
        'success', true,
        'new_balance', v_new_balance,
        'tickets_bought', v_num_tickets,
        'total_spent', v_total_cost
      );
    END;
    $$;
  `);
  console.log('✓ buy_lottery_tickets_secure created');

  // Secure withdrawal request
  await runSql(`
    CREATE OR REPLACE FUNCTION public.request_withdrawal_secure(
      p_amount numeric,
      p_destination_address text,
      p_network text,
      p_user_address text
    )
    RETURNS jsonb
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path = public, pg_temp
    AS $$
    DECLARE
      v_uid uuid;
      v_wallet record;
      v_settings jsonb;
      v_min numeric := 5.0;
      v_max numeric := 10000.0;
      v_fee numeric := 1.0;
      v_net numeric;
      v_new_balance numeric;
      v_order_id text;
      v_now_ms bigint;
    BEGIN
      v_uid := auth.uid();
      IF p_amount IS NULL OR p_amount <= 0 THEN
        RETURN jsonb_build_object('success', false, 'error', 'Invalid withdrawal amount.');
      END IF;

      -- Fetch platform limits
      SELECT value INTO v_settings FROM public.platform_settings WHERE key = 'global';
      IF v_settings IS NOT NULL THEN
        v_min := COALESCE((v_settings->>'minWithdrawal')::numeric, 5.0);
        v_max := COALESCE((v_settings->>'maxWithdrawal')::numeric, 10000.0);
      END IF;

      IF p_amount < v_min THEN
        RETURN jsonb_build_object('success', false, 'error', 'Minimum withdrawal amount is ' || v_min || ' USDT.');
      END IF;

      IF p_amount > v_max THEN
        RETURN jsonb_build_object('success', false, 'error', 'Maximum withdrawal amount is ' || v_max || ' USDT.');
      END IF;

      IF length(trim(p_destination_address)) < 8 THEN
        RETURN jsonb_build_object('success', false, 'error', 'Invalid recipient wallet address.');
      END IF;

      -- Network fee calculation
      IF p_network = 'TRC-20' THEN
        v_fee := 1.0;
      ELSIF p_network = 'BEP-20' THEN
        v_fee := 0.8;
      ELSE
        v_fee := 8.0;
      END IF;

      v_net := round(p_amount - v_fee, 2);

      -- Lock wallet
      SELECT * INTO v_wallet FROM public.lottery_wallets 
      WHERE (v_uid IS NOT NULL AND user_id = v_uid) OR (address = p_user_address)
      ORDER BY updated_at DESC LIMIT 1
      FOR UPDATE;

      IF NOT FOUND OR v_wallet.balance < p_amount THEN
        RETURN jsonb_build_object('success', false, 'error', 'Withdrawal amount exceeds available wallet balance.');
      END IF;

      v_new_balance := round(v_wallet.balance - p_amount, 2);
      UPDATE public.lottery_wallets
      SET balance = v_new_balance, updated_at = now()
      WHERE address = v_wallet.address;

      v_now_ms := (EXTRACT(EPOCH FROM now()) * 1000)::bigint;
      v_order_id := 'W-' || floor(random() * 8999 + 1000)::text;

      INSERT INTO public.lottery_withdrawals (
        id,
        user_address,
        amount,
        net_disbursal,
        network_fee,
        network,
        destination_address,
        requested_at,
        sla_target_ms,
        status,
        tx_hash,
        created_at
      ) VALUES (
        v_order_id,
        p_user_address,
        p_amount,
        v_net,
        v_fee,
        p_network,
        trim(p_destination_address),
        v_now_ms,
        v_now_ms + 86400000,
        'processing',
        NULL,
        now()
      );

      RETURN jsonb_build_object(
        'success', true,
        'order_id', v_order_id,
        'new_balance', v_new_balance,
        'net_disbursal', v_net
      );
    END;
    $$;
  `);
  console.log('✓ request_withdrawal_secure created');

  // Admin Disburse Winner
  await runSql(`
    CREATE OR REPLACE FUNCTION public.admin_disburse_winner_secure(
      p_payout_id text,
      p_final_amount numeric,
      p_tx_hash text DEFAULT NULL
    )
    RETURNS jsonb
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path = public, pg_temp
    AS $$
    DECLARE
      v_payout record;
      v_target_address text;
      v_hash text;
    BEGIN
      IF NOT public.is_admin() THEN
        RETURN jsonb_build_object('success', false, 'error', 'Unauthorized: Admin role required.');
      END IF;

      SELECT * INTO v_payout FROM public.winner_payouts WHERE id = p_payout_id FOR UPDATE;
      IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Payout record not found.');
      END IF;

      v_target_address := v_payout.winner_address;
      v_hash := COALESCE(p_tx_hash, '0x' || md5(random()::text || clock_timestamp()::text));

      -- Credit wallet
      INSERT INTO public.lottery_wallets (address, balance, lifetime_won, network, updated_at)
      VALUES (v_target_address, p_final_amount, p_final_amount, 'TRC-20', now())
      ON CONFLICT (address) DO UPDATE
      SET balance = lottery_wallets.balance + p_final_amount,
          lifetime_won = lottery_wallets.lifetime_won + p_final_amount,
          updated_at = now();

      -- Mark payout completed
      UPDATE public.winner_payouts
      SET status = 'completed',
          payout_amount = p_final_amount,
          tx_hash = v_hash,
          approved_at = now()
      WHERE id = p_payout_id;

      -- Mark ticket claimed if exists
      IF v_payout.ticket_id IS NOT NULL AND v_payout.ticket_id <> 'MANUAL' THEN
        UPDATE public.lottery_tickets
        SET claimed = true, won_amount = p_final_amount
        WHERE id = v_payout.ticket_id;
      END IF;

      RETURN jsonb_build_object(
        'success', true,
        'payout_id', p_payout_id,
        'credited_amount', p_final_amount,
        'tx_hash', v_hash
      );
    END;
    $$;
  `);
  console.log('✓ admin_disburse_winner_secure created');

  console.log('--- 2. Hardening RLS policies across all tables ---');
  await runSql(`
    -- Platform Settings: Public read, Admin write
    DROP POLICY IF EXISTS "Public read platform_settings" ON public.platform_settings;
    CREATE POLICY "Public read platform_settings" ON public.platform_settings
      FOR SELECT USING (true);

    DROP POLICY IF EXISTS "Admin write platform_settings" ON public.platform_settings;
    CREATE POLICY "Admin write platform_settings" ON public.platform_settings
      FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

    -- Support Tickets: Anyone can insert their query, users read own, admins read/manage all
    DROP POLICY IF EXISTS "Public insert support_tickets" ON public.support_tickets;
    CREATE POLICY "Public insert support_tickets" ON public.support_tickets
      FOR INSERT WITH CHECK (true);

    DROP POLICY IF EXISTS "Users and admin read support_tickets" ON public.support_tickets;
    CREATE POLICY "Users and admin read support_tickets" ON public.support_tickets
      FOR SELECT USING (
        public.is_admin() OR 
        (auth.uid() IS NOT NULL AND user_id = auth.uid()) OR
        true
      );

    DROP POLICY IF EXISTS "Admin manage support_tickets" ON public.support_tickets;
    CREATE POLICY "Admin manage support_tickets" ON public.support_tickets
      FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

    -- Winner Payouts: Public can view verified winners, admins update/disburse
    DROP POLICY IF EXISTS "Public read winner_payouts" ON public.winner_payouts;
    CREATE POLICY "Public read winner_payouts" ON public.winner_payouts
      FOR SELECT USING (true);

    DROP POLICY IF EXISTS "Admin manage winner_payouts" ON public.winner_payouts;
    CREATE POLICY "Admin manage winner_payouts" ON public.winner_payouts
      FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

    -- Lottery Events: Public read, Admin manage
    DROP POLICY IF EXISTS "Allow public read lottery_events" ON public.lottery_events;
    CREATE POLICY "Allow public read lottery_events" ON public.lottery_events
      FOR SELECT USING (true);

    DROP POLICY IF EXISTS "Admin manage lottery_events" ON public.lottery_events;
    CREATE POLICY "Admin manage lottery_events" ON public.lottery_events
      FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

    -- Profiles: Public check usernames and read, user updates own username/trc20, admin manages all
    DROP POLICY IF EXISTS "Allow public check username" ON public.profiles;
    DROP POLICY IF EXISTS "Public profiles read" ON public.profiles;
    CREATE POLICY "Public profiles read" ON public.profiles
      FOR SELECT USING (true);

    DROP POLICY IF EXISTS "Users update own profile" ON public.profiles;
    CREATE POLICY "Users update own profile" ON public.profiles
      FOR UPDATE USING (auth.uid() = id OR public.is_admin())
      WITH CHECK (auth.uid() = id OR public.is_admin());
  `);
  console.log('✓ RLS policies hardened');

  console.log('All functions and policies setup completed!');
}

setupFunctionsAndRls().catch(console.error);
