import { runSql } from './supabase_admin.mjs';

async function runMigration() {
  console.log('====================================================');
  console.log('STARTING DATABASE MIGRATION: USDT ONLY & GAME REMOVAL');
  console.log('====================================================\n');

  // 1. Create legacy_flo_reconciliation table to preserve historical FLO balances
  console.log('1. Creating legacy_flo_reconciliation table...');
  await runSql(`
    CREATE TABLE IF NOT EXISTS public.legacy_flo_reconciliation (
      id text PRIMARY KEY DEFAULT ('rec_' || to_char(now(), 'YYYYMMDDHH24MISS') || '_' || substr(md5(random()::text), 1, 8)),
      user_id uuid,
      wallet_address text NOT NULL,
      network text,
      legacy_flo_balance numeric NOT NULL,
      lifetime_won numeric DEFAULT 0,
      snapshot_at timestamp with time zone DEFAULT now(),
      status text DEFAULT 'archived_flo_retired',
      reconciliation_notes text DEFAULT 'FLO Coin system retired. Active platform currency migrated exclusively to USDT.'
    );
  `);

  // Archive existing FLO wallets if not already archived
  console.log('2. Archiving existing FLO wallet balances into legacy_flo_reconciliation...');
  await runSql(`
    INSERT INTO public.legacy_flo_reconciliation (user_id, wallet_address, network, legacy_flo_balance, lifetime_won)
    SELECT user_id, address, network, balance, lifetime_won
    FROM public.lottery_wallets
    WHERE network IN ('Flow Coin', 'FC-Virtual')
    ON CONFLICT DO NOTHING;
  `);

  // 3. Update active wallet networks to TRC-20
  console.log('3. Standardizing wallet networks to TRC-20...');
  await runSql(`
    UPDATE public.lottery_wallets
    SET network = 'TRC-20'
    WHERE network IN ('Flow Coin', 'FC-Virtual');
  `);

  // 4. Update column defaults for USDT
  console.log('4. Setting column defaults to USDT across all tables...');
  await runSql(`
    ALTER TABLE public.lottery_events ALTER COLUMN currency SET DEFAULT 'USDT';
    ALTER TABLE public.lottery_tickets ALTER COLUMN currency SET DEFAULT 'USDT';
    ALTER TABLE public.wallet_ledger ALTER COLUMN currency SET DEFAULT 'USDT';
    ALTER TABLE public.winner_payouts ALTER COLUMN currency SET DEFAULT 'USDT';
  `);

  // 5. Add or replace CHECK constraint on lottery_events
  console.log('5. Enforcing USDT-only constraint on lottery_events...');
  await runSql(`
    DO $$
    BEGIN
      IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_lottery_events_usdt_only') THEN
        ALTER TABLE public.lottery_events DROP CONSTRAINT chk_lottery_events_usdt_only;
      END IF;
      ALTER TABLE public.lottery_events ADD CONSTRAINT chk_lottery_events_usdt_only CHECK (currency = 'USDT');
    END $$;
  `);

  // 6. Permanently clean up removed games in database
  console.log('6. Permanently removing the 6 discontinued games in game_configurations...');
  const removedGames = ['roulette', 'slots', 'poker', 'keno', 'limbo', 'blackjack'];
  await runSql(`
    UPDATE public.game_configurations
    SET status = 'deleted', is_enabled = false, updated_at = now()
    WHERE game_id IN ('${removedGames.join("', '")}');
  `);

  console.log('7. Removing obsolete rooms for discontinued games...');
  await runSql(`
    DELETE FROM public.game_rooms
    WHERE game_id IN ('${removedGames.join("', '")}');
  `);

  // 8. Update Bingo and Horse Racing logos in game_configurations
  console.log('8. Updating Bingo and Horse Racing logos in game_configurations...');
  await runSql(`
    UPDATE public.game_configurations
    SET icon = '/items/Bingo – Color Trading.jpg',
        game_name = 'Bingo – Color Trading',
        category = 'arcade',
        status = 'active',
        is_enabled = true,
        description = 'Fast-paced provably fair color prediction. Pick Red, Green, Violet, Numbers (0–9), or Big/Small with instant USDT payouts!',
        updated_at = now()
    WHERE game_id = 'bingo';

    UPDATE public.game_configurations
    SET icon = '/items/Horse Racing.jpg',
        game_name = 'Horse Racing',
        category = 'table',
        status = 'active',
        is_enabled = true,
        description = 'Live virtual derby turf sprint. Back your thoroughbred with fixed odds up to 35.0x and instant USDT payouts!',
        updated_at = now()
    WHERE game_id = 'horse-racing';
  `);

  // 9. Update RPC functions for USDT
  console.log('9. Updating RPC functions (finalize_lottery_draw_secure, buy_lottery_tickets_secure, debit_virtual_credits, credit_virtual_credits)...');

  // 9a. finalize_lottery_draw_secure
  await runSql(`
CREATE OR REPLACE FUNCTION public.finalize_lottery_draw_secure(
  p_event_id text,
  p_custom_digits text DEFAULT NULL,
  p_custom_winner_count integer DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, auth, extensions, pg_temp
AS $$
DECLARE
  v_event record;
  v_server_seed text;
  v_commit_hash text;
  v_client_seed text;
  v_combined_seed text;
  v_outcome_hash text;
  v_hex_slice text;
  v_int_val bigint;
  v_final_digits text;
  v_snapshot_count integer := 0;
  v_configured_winner_count integer := 1;
  v_total_collected numeric := 0;
  v_share_percent numeric := 90;
  v_total_winner_pool numeric := 0;
  v_distribution jsonb;
  v_dist_len integer := 0;
  v_audit_id text;
  v_matching_tkt_ids text[];
  v_selected_tkt_ids text[];
  v_remaining_tkt_ids text[];
  v_tkt_id text;
  v_tkt_rec record;
  v_payout_id text;
  v_ticket_accumulator text := '';
  v_idx integer := 0;
  v_pos integer := 1;
  v_pos_pct numeric := 100;
  v_payout_amt numeric := 0;
  v_currency text := 'USDT';
BEGIN
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized: Admin privileges required.');
  END IF;

  SELECT * INTO v_event FROM public.lottery_events WHERE id = p_event_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Lottery event not found.');
  END IF;

  IF v_event.status = 'completed' THEN
    RETURN jsonb_build_object(
      'success', true,
      'already_finalized', true,
      'winning_digits', v_event.winning_digits,
      'message', 'Lottery draw was already finalized.'
    );
  END IF;

  v_currency := COALESCE(v_event.currency, 'USDT');

  -- 2. Server seed & Cryptographic Outcome Determination
  v_server_seed := COALESCE(v_event.server_seed, 'seed_' || encode(extensions.gen_random_bytes(32), 'hex'));
  v_commit_hash := COALESCE(v_event.sha256_seed, '0x' || encode(extensions.digest(v_server_seed, 'sha256'), 'hex'));
  v_client_seed := COALESCE(v_event.client_seed, 'block_final_' || floor(random() * 899999 + 100000)::text);

  IF p_custom_digits IS NOT NULL AND p_custom_digits ~ '^[0-9]{4}$' THEN
    v_final_digits := p_custom_digits;
  ELSIF v_event.preset_winning_digits IS NOT NULL AND v_event.preset_winning_digits ~ '^[0-9]{4}$' THEN
    v_final_digits := v_event.preset_winning_digits;
  ELSE
    v_combined_seed := v_server_seed || ':' || v_client_seed || ':' || p_event_id;
    v_outcome_hash := encode(extensions.digest(v_combined_seed, 'sha256'), 'hex');
    v_hex_slice := substr(v_outcome_hash, 1, 8);
    v_int_val := ('x' || v_hex_slice)::bit(32)::bigint;
    v_final_digits := lpad((v_int_val % 10000)::text, 4, '0');
  END IF;

  -- 3. Gather ticket snapshot
  SELECT COUNT(*), COALESCE(SUM(price), 0)
  INTO v_snapshot_count, v_total_collected
  FROM public.lottery_tickets
  WHERE event_id = p_event_id AND status = 'active';

  v_configured_winner_count := COALESCE(p_custom_winner_count, v_event.winner_count, 1);
  v_share_percent := COALESCE(v_event.winner_payout_share_percent, 90);
  v_distribution := COALESCE(v_event.winner_distribution, '[{"position": 1, "percent": 100}]'::jsonb);
  v_dist_len := jsonb_array_length(v_distribution);

  IF v_event.jackpot_mode = 'fixed' THEN
    v_total_winner_pool := ROUND(COALESCE(v_event.pool_prize, 1000) * (v_share_percent / 100.0), 2);
  ELSE
    IF v_total_collected > 0 THEN
      v_total_winner_pool := ROUND(v_total_collected * (v_share_percent / 100.0), 2);
    ELSE
      v_total_winner_pool := ROUND(COALESCE(v_event.pool_prize, 1000) * (v_share_percent / 100.0), 2);
    END IF;
  END IF;

  -- Find exact matches
  SELECT array_agg(id ORDER BY purchase_time ASC)
  INTO v_matching_tkt_ids
  FROM public.lottery_tickets
  WHERE event_id = p_event_id AND status = 'active' AND lpad(ticket_number, 4, '0') = v_final_digits;

  IF v_matching_tkt_ids IS NOT NULL AND array_length(v_matching_tkt_ids, 1) > 0 THEN
    v_selected_tkt_ids := v_matching_tkt_ids[1:LEAST(array_length(v_matching_tkt_ids, 1), v_configured_winner_count)];
  ELSE
    v_selected_tkt_ids := ARRAY[]::text[];
  END IF;

  -- Fallback if tiered distribution needs more winners
  IF (array_length(v_selected_tkt_ids, 1) IS NULL OR array_length(v_selected_tkt_ids, 1) < v_configured_winner_count) THEN
    SELECT array_agg(id ORDER BY purchase_time ASC)
    INTO v_remaining_tkt_ids
    FROM public.lottery_tickets
    WHERE event_id = p_event_id AND status = 'active'
      AND (v_selected_tkt_ids IS NULL OR id != ALL(v_selected_tkt_ids));

    IF v_remaining_tkt_ids IS NOT NULL THEN
      DECLARE
        v_need integer := v_configured_winner_count - COALESCE(array_length(v_selected_tkt_ids, 1), 0);
        v_take integer := LEAST(array_length(v_remaining_tkt_ids, 1), v_need);
      BEGIN
        IF v_take > 0 THEN
          v_selected_tkt_ids := array_cat(v_selected_tkt_ids, v_remaining_tkt_ids[1:v_take]);
        END IF;
      END;
    END IF;
  END IF;

  -- Disburse payouts if winners exist
  IF v_selected_tkt_ids IS NOT NULL AND array_length(v_selected_tkt_ids, 1) > 0 THEN
    FOR v_idx IN 1..array_length(v_selected_tkt_ids, 1) LOOP
      v_tkt_id := v_selected_tkt_ids[v_idx];
      v_pos := v_idx;

      IF v_idx <= v_dist_len AND (v_distribution->(v_idx - 1)->>'percent') IS NOT NULL THEN
        v_pos_pct := (v_distribution->(v_idx - 1)->>'percent')::numeric;
      ELSE
        v_pos_pct := ROUND(100.0 / array_length(v_selected_tkt_ids, 1), 2);
      END IF;

      v_payout_amt := ROUND(v_total_winner_pool * (v_pos_pct / 100.0), 2);
      IF v_payout_amt <= 0 THEN
        v_payout_amt := ROUND(v_total_winner_pool / array_length(v_selected_tkt_ids, 1), 2);
      END IF;

      SELECT * INTO v_tkt_rec FROM public.lottery_tickets WHERE id = v_tkt_id;

      UPDATE public.lottery_tickets
      SET status = 'won',
          match_tier = CASE WHEN lpad(v_tkt_rec.ticket_number, 4, '0') = v_final_digits THEN 'EXACT 4/4 MATCH' ELSE 'RANK #' || v_pos || ' WINNER' END,
          won_amount = v_payout_amt,
          claimed = false,
          currency = v_currency
      WHERE id = v_tkt_id;

      v_payout_id := 'WP-' || (EXTRACT(EPOCH FROM now()) * 1000)::bigint || '-' || v_pos || '-' || substr(md5(v_tkt_id), 1, 4);
      INSERT INTO public.winner_payouts (
        id, event_id, event_title, ticket_id, user_id, winner_address, winner_username,
        winning_digits, tickets_sold, ticket_price, total_pool_collected, winner_share_percent,
        calculated_amount, payout_amount, status, position, currency, created_at
      ) VALUES (
        v_payout_id, p_event_id, v_event.title, v_tkt_id, v_tkt_rec.user_id, v_tkt_rec.user_address,
        v_tkt_rec.username, v_final_digits, v_snapshot_count, COALESCE(v_event.ticket_price, 10),
        v_total_collected, v_pos_pct, v_payout_amt, v_payout_amt, 'pending_approval', v_pos, v_currency, now()
      );
    END LOOP;
  END IF;

  -- Mark non-winning tickets
  UPDATE public.lottery_tickets
  SET status = 'lost'
  WHERE event_id = p_event_id AND status = 'active'
    AND (v_selected_tkt_ids IS NULL OR id != ALL(v_selected_tkt_ids));

  -- Finalize event
  v_audit_id := 'AUD-' || (EXTRACT(EPOCH FROM now()) * 1000)::bigint || '-' || substr(md5(p_event_id), 1, 6);
  UPDATE public.lottery_events
  SET status = 'completed',
      winning_digits = v_final_digits,
      revealed_seed = v_server_seed,
      snapshot_count = v_snapshot_count,
      draw_audit_id = v_audit_id,
      tickets_sold = v_snapshot_count,
      currency = v_currency
  WHERE id = p_event_id;

  RETURN jsonb_build_object(
    'success', true,
    'event_id', p_event_id,
    'winning_digits', v_final_digits,
    'winners_count', COALESCE(array_length(v_selected_tkt_ids, 1), 0),
    'currency', v_currency
  );
END;
$$;
  `);

  // 9b. buy_lottery_tickets_secure
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
SET search_path = public, auth, pg_temp
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
  v_tx_id text;
  v_order_ref text;
  v_curr text := 'USDT';
BEGIN
  v_uid := auth.uid();
  v_num_tickets := array_length(p_ticket_numbers, 1);
  
  IF v_num_tickets IS NULL OR v_num_tickets <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'No ticket numbers provided.');
  END IF;

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

  FOREACH v_num IN ARRAY p_ticket_numbers LOOP
    IF EXISTS (
      SELECT 1 FROM public.lottery_tickets 
      WHERE event_id = p_event_id AND lpad(ticket_number, 4, '0') = lpad(v_num, 4, '0')
    ) THEN
      RETURN jsonb_build_object('success', false, 'error', 'Ticket #' || lpad(v_num, 4, '0') || ' is already taken. Please choose another combination.');
    END IF;
  END LOOP;

  v_total_cost := v_event.ticket_price * v_num_tickets;
  v_curr := COALESCE(v_event.currency, 'USDT');

  SELECT * INTO v_wallet FROM public.lottery_wallets 
  WHERE (v_uid IS NOT NULL AND user_id = v_uid) OR (address = p_user_address)
  ORDER BY updated_at DESC LIMIT 1
  FOR UPDATE;

  IF NOT FOUND OR COALESCE(v_wallet.balance, 0) < v_total_cost THEN
    RETURN jsonb_build_object(
      'success', false, 
      'error', 'Insufficient USDT balance. Required: ' || v_total_cost || ' USDT, Available: ' || COALESCE(v_wallet.balance, 0) || ' USDT.'
    );
  END IF;

  v_new_balance := round(v_wallet.balance - v_total_cost, 2);
  UPDATE public.lottery_wallets
  SET balance = v_new_balance, updated_at = now()
  WHERE address = v_wallet.address;

  v_now_ms := (EXTRACT(EPOCH FROM now()) * 1000)::bigint;
  v_order_ref := 'tkt-order-' || v_now_ms || '-' || floor(random() * 8999 + 1000)::text;
  v_user_display := COALESCE(p_username, '@' || substring(p_user_address from 1 for 6));

  FOREACH v_num IN ARRAY p_ticket_numbers LOOP
    v_ticket_id := 'tkt-' || v_now_ms || '-' || floor(random() * 8999 + 1000)::text || '-' || floor(random() * 899 + 100)::text;
    INSERT INTO public.lottery_tickets (
      id, user_id, user_address, username, event_id, event_title, ticket_number,
      price, purchase_time, status, match_tier, won_amount, claimed, currency, created_at
    ) VALUES (
      v_ticket_id, COALESCE(v_wallet.user_id, v_uid), v_wallet.address, v_user_display,
      p_event_id, v_event.title, lpad(v_num, 4, '0'), v_event.ticket_price, v_now_ms,
      'active', NULL, 0, false, v_curr, now()
    );
  END LOOP;

  UPDATE public.lottery_events
  SET pool_prize = round(pool_prize + (v_total_cost * 0.95), 2),
      tickets_sold = COALESCE(tickets_sold, 0) + v_num_tickets,
      participants_count = COALESCE(participants_count, 0) + 1
  WHERE id = p_event_id;

  v_tx_id := 'tx_' || to_char(now(), 'YYYYMMDDHH24MISS') || '_' || substr(md5(random()::text), 1, 8);
  INSERT INTO public.wallet_ledger (
    id, user_id, wallet_address, transaction_type, amount, balance_before, balance_after,
    currency, reference_id, description, metadata, created_at
  ) VALUES (
    v_tx_id, COALESCE(v_wallet.user_id, v_uid), v_wallet.address, 'ticket_purchase',
    -v_total_cost, v_wallet.balance, v_new_balance, 'USDT', v_order_ref,
    'Purchased ' || v_num_tickets || ' ticket(s) for ' || v_event.title,
    jsonb_build_object('event_id', p_event_id, 'tickets_count', v_num_tickets, 'currency', 'USDT'),
    now()
  );

  RETURN jsonb_build_object(
    'success', true,
    'total_cost', v_total_cost,
    'new_balance', v_new_balance,
    'tickets_count', v_num_tickets,
    'currency', 'USDT',
    'transaction_id', v_tx_id
  );
END;
$$;
  `);

  // 9c. debit_virtual_credits
  await runSql(`
CREATE OR REPLACE FUNCTION public.debit_virtual_credits(
  p_amount numeric,
  p_transaction_type text,
  p_reference_id text DEFAULT NULL,
  p_description text DEFAULT NULL,
  p_user_address text DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_uid uuid;
  v_wallet record;
  v_addr text;
  v_new_balance numeric;
  v_tx_id text;
BEGIN
  v_uid := auth.uid();
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Amount must be greater than zero.');
  END IF;

  IF p_reference_id IS NOT NULL THEN
    SELECT * INTO v_wallet FROM public.wallet_ledger 
    WHERE reference_id = p_reference_id AND transaction_type = p_transaction_type 
    LIMIT 1;
    IF FOUND THEN
      SELECT balance INTO v_new_balance FROM public.lottery_wallets WHERE (v_uid IS NOT NULL AND user_id = v_uid) OR address = p_user_address LIMIT 1;
      RETURN jsonb_build_object(
        'success', true, 
        'already_processed', true, 
        'new_balance', COALESCE(v_new_balance, 0),
        'transaction_id', v_wallet.id
      );
    END IF;
  END IF;

  SELECT * INTO v_wallet FROM public.lottery_wallets 
  WHERE (v_uid IS NOT NULL AND user_id = v_uid) OR (p_user_address IS NOT NULL AND address = p_user_address)
  ORDER BY updated_at DESC LIMIT 1
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Wallet not found.');
  END IF;

  IF COALESCE(v_wallet.balance, 0) < p_amount THEN
    RETURN jsonb_build_object(
      'success', false, 
      'error', 'Insufficient USDT balance. Required: ' || p_amount || ' USDT, Available: ' || COALESCE(v_wallet.balance, 0) || ' USDT.'
    );
  END IF;

  v_new_balance := round(v_wallet.balance - p_amount, 2);
  v_addr := v_wallet.address;

  UPDATE public.lottery_wallets
  SET balance = v_new_balance, updated_at = now()
  WHERE address = v_addr;

  v_tx_id := 'tx_' || to_char(now(), 'YYYYMMDDHH24MISS') || '_' || substr(md5(random()::text), 1, 8);
  INSERT INTO public.wallet_ledger (
    id, user_id, wallet_address, transaction_type, amount, balance_before, balance_after,
    currency, reference_id, description, metadata, created_at
  ) VALUES (
    v_tx_id, COALESCE(v_wallet.user_id, v_uid), v_addr, p_transaction_type, -p_amount,
    v_wallet.balance, v_new_balance, 'USDT', p_reference_id,
    COALESCE(p_description, 'Deduction for ' || p_transaction_type), p_metadata, now()
  );

  RETURN jsonb_build_object(
    'success', true,
    'new_balance', v_new_balance,
    'deducted', p_amount,
    'currency', 'USDT',
    'transaction_id', v_tx_id
  );
END;
$$;
  `);

  // 9d. credit_virtual_credits
  await runSql(`
CREATE OR REPLACE FUNCTION public.credit_virtual_credits(
  p_amount numeric,
  p_transaction_type text,
  p_reference_id text DEFAULT NULL,
  p_description text DEFAULT NULL,
  p_user_address text DEFAULT NULL,
  p_target_user_id uuid DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_uid uuid;
  v_wallet record;
  v_addr text;
  v_old_balance numeric := 0;
  v_new_balance numeric;
  v_tx_id text;
BEGIN
  v_uid := COALESCE(p_target_user_id, auth.uid());

  IF p_amount IS NULL OR p_amount <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Amount must be greater than zero.');
  END IF;

  IF p_reference_id IS NOT NULL THEN
    SELECT * INTO v_wallet FROM public.wallet_ledger 
    WHERE reference_id = p_reference_id AND transaction_type = p_transaction_type 
    LIMIT 1;
    IF FOUND THEN
      SELECT balance INTO v_new_balance FROM public.lottery_wallets WHERE (v_uid IS NOT NULL AND user_id = v_uid) OR address = p_user_address LIMIT 1;
      RETURN jsonb_build_object(
        'success', true, 
        'already_processed', true, 
        'new_balance', COALESCE(v_new_balance, 0),
        'transaction_id', v_wallet.id
      );
    END IF;
  END IF;

  SELECT * INTO v_wallet FROM public.lottery_wallets 
  WHERE (v_uid IS NOT NULL AND user_id = v_uid) OR (p_user_address IS NOT NULL AND address = p_user_address)
  ORDER BY updated_at DESC LIMIT 1
  FOR UPDATE;

  IF NOT FOUND THEN
    v_addr := COALESCE(p_user_address, 'T' || substr(md5(random()::text || clock_timestamp()::text), 1, 33));
    v_old_balance := 0;
    v_new_balance := round(p_amount, 2);

    INSERT INTO public.lottery_wallets (
      address, user_id, balance, lifetime_won, network, updated_at
    ) VALUES (
      v_addr, v_uid, v_new_balance,
      CASE WHEN p_transaction_type IN ('lottery_win', 'game_win') THEN p_amount ELSE 0 END,
      'TRC-20', now()
    );
  ELSE
    v_addr := v_wallet.address;
    v_old_balance := COALESCE(v_wallet.balance, 0);
    v_new_balance := round(v_old_balance + p_amount, 2);

    UPDATE public.lottery_wallets
    SET balance = v_new_balance,
        lifetime_won = CASE 
          WHEN p_transaction_type IN ('lottery_win', 'game_win') THEN round(COALESCE(lifetime_won, 0) + p_amount, 2)
          ELSE lifetime_won
        END,
        network = 'TRC-20',
        updated_at = now()
    WHERE address = v_addr;
  END IF;

  v_tx_id := 'tx_' || to_char(now(), 'YYYYMMDDHH24MISS') || '_' || substr(md5(random()::text), 1, 8);
  INSERT INTO public.wallet_ledger (
    id, user_id, wallet_address, transaction_type, amount, balance_before, balance_after,
    currency, reference_id, description, metadata, created_at
  ) VALUES (
    v_tx_id, COALESCE(v_wallet.user_id, v_uid), v_addr, p_transaction_type, p_amount,
    v_old_balance, v_new_balance, 'USDT', p_reference_id,
    COALESCE(p_description, 'Credit for ' || p_transaction_type), p_metadata, now()
  );

  RETURN jsonb_build_object(
    'success', true,
    'new_balance', v_new_balance,
    'credited', p_amount,
    'currency', 'USDT',
    'transaction_id', v_tx_id
  );
END;
$$;
  `);

  console.log('\n====================================================');
  console.log('DATABASE MIGRATION COMPLETED SUCCESSFULLY!');
  console.log('====================================================');
}

runMigration().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
