import { runSql } from './supabase_admin.mjs';

async function updateBuyRpc() {
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
          user_id,
          user_address,
          username,
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
          v_uid,
          p_user_address,
          v_user_display,
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
  console.log('✓ buy_lottery_tickets_secure updated with user_id and username support');
}

updateBuyRpc().catch(console.error);
