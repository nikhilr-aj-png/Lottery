import { runSql } from './supabase_admin.mjs';

async function updateFinalizeRpc() {
  console.log('Updating finalize_lottery_draw_secure RPC with event-specific winner distribution & currencies...');

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
  v_currency text := 'FC';
BEGIN
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized: Admin privileges required.');
  END IF;

  -- 1. Lock and check event
  SELECT * INTO v_event FROM public.lottery_events WHERE id = p_event_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Lottery event not found.');
  END IF;

  IF v_event.status = 'completed' THEN
    RETURN jsonb_build_object(
      'success', true,
      'already_completed', true,
      'winning_digits', v_event.winning_digits,
      'message', 'This lottery round was already finalized.'
    );
  END IF;

  v_currency := COALESCE(v_event.currency, 'FC');

  -- 2. Snapshot tickets & build ticket accumulator hash
  SELECT count(*), string_agg(id, ',') INTO v_snapshot_count, v_ticket_accumulator
  FROM public.lottery_tickets 
  WHERE event_id = p_event_id AND status = 'active';

  v_snapshot_count := COALESCE(v_snapshot_count, 0);

  -- 3. Resolve seeds
  v_server_seed := COALESCE(v_event.server_seed, 'seed_' || encode(extensions.gen_random_bytes(32), 'hex'));
  v_commit_hash := COALESCE(v_event.sha256_seed, '0x' || encode(extensions.digest(v_server_seed, 'sha256'), 'hex'));
  v_client_seed := 'tickets_' || v_snapshot_count || '_' || COALESCE(substr(md5(COALESCE(v_ticket_accumulator, '')), 1, 16), 'empty');

  -- 4. Calculate Winning 4 Digits (0000 - 9999)
  IF p_custom_digits IS NOT NULL AND trim(p_custom_digits) <> '' THEN
    v_final_digits := lpad(trim(p_custom_digits), 4, '0');
    v_outcome_hash := encode(extensions.digest('custom:' || v_final_digits, 'sha256'), 'hex');
  ELSIF v_event.draw_mode = 'preset' AND v_event.preset_winning_digits IS NOT NULL AND trim(v_event.preset_winning_digits) <> '' THEN
    v_final_digits := lpad(trim(v_event.preset_winning_digits), 4, '0');
    v_outcome_hash := encode(extensions.digest('preset:' || v_final_digits, 'sha256'), 'hex');
  ELSE
    -- Deterministic Provably Fair derivation: SHA256(server_seed : client_seed : event_id)
    v_combined_seed := v_server_seed || ':' || v_client_seed || ':' || p_event_id;
    v_outcome_hash := encode(extensions.digest(v_combined_seed, 'sha256'), 'hex');
    v_hex_slice := substr(v_outcome_hash, 1, 8);
    v_int_val := ('x' || v_hex_slice)::bit(32)::bigint;
    v_final_digits := lpad((v_int_val % 10000)::text, 4, '0');
  END IF;

  -- 5. Winner Count & Distribution
  v_configured_winner_count := GREATEST(1, COALESCE(p_custom_winner_count, v_event.winner_count, 1));
  v_share_percent := COALESCE(v_event.winner_payout_share_percent, 90);
  v_distribution := COALESCE(v_event.winner_distribution, '[{"position": 1, "percent": 100}]'::jsonb);

  -- Total pool collected
  v_total_collected := COALESCE(v_event.pool_prize, 0) + (v_snapshot_count * COALESCE(v_event.ticket_price, 10));
  IF v_total_collected <= 0 THEN
    v_total_collected := COALESCE(v_event.pool_prize, 1000);
  END IF;

  -- Distributable winner pool
  v_total_winner_pool := ROUND(v_total_collected * (v_share_percent / 100.0), 2);

  -- 6. Find Winning Tickets
  -- Exact 4/4 matches first
  SELECT array_agg(id ORDER BY created_at ASC) INTO v_matching_tkt_ids
  FROM public.lottery_tickets
  WHERE event_id = p_event_id AND status = 'active' AND lpad(ticket_number, 4, '0') = v_final_digits;

  v_selected_tkt_ids := COALESCE(v_matching_tkt_ids, ARRAY[]::text[]);

  -- If fewer winners than configured and tickets exist, sample remaining lucky winners
  IF array_length(v_selected_tkt_ids, 1) IS NULL OR array_length(v_selected_tkt_ids, 1) < v_configured_winner_count THEN
    SELECT array_agg(id) INTO v_remaining_tkt_ids
    FROM (
      SELECT id FROM public.lottery_tickets
      WHERE event_id = p_event_id 
        AND status = 'active' 
        AND id <> ALL(v_selected_tkt_ids)
      ORDER BY extensions.digest(id || ':' || v_outcome_hash, 'sha256')
      LIMIT (v_configured_winner_count - COALESCE(array_length(v_selected_tkt_ids, 1), 0))
    ) t;

    IF v_remaining_tkt_ids IS NOT NULL THEN
      v_selected_tkt_ids := array_cat(v_selected_tkt_ids, v_remaining_tkt_ids);
    END IF;
  END IF;

  -- 7. Distribute Payouts according to winner configuration
  IF array_length(v_selected_tkt_ids, 1) IS NOT NULL AND array_length(v_selected_tkt_ids, 1) > 0 THEN
    v_dist_len := jsonb_array_length(v_distribution);

    FOR v_idx IN 1..array_length(v_selected_tkt_ids, 1) LOOP
      v_tkt_id := v_selected_tkt_ids[v_idx];
      v_pos := v_idx;

      -- Look up position percentage from distribution array
      IF v_idx <= v_dist_len AND (v_distribution->(v_idx - 1)->>'percent') IS NOT NULL THEN
        v_pos_pct := (v_distribution->(v_idx - 1)->>'percent')::numeric;
      ELSE
        -- Fallback: equal remaining share
        v_pos_pct := ROUND(100.0 / array_length(v_selected_tkt_ids, 1), 2);
      END IF;

      v_payout_amt := ROUND(v_total_winner_pool * (v_pos_pct / 100.0), 2);
      IF v_payout_amt <= 0 THEN
        v_payout_amt := ROUND(v_total_winner_pool / array_length(v_selected_tkt_ids, 1), 2);
      END IF;

      SELECT * INTO v_tkt_rec FROM public.lottery_tickets WHERE id = v_tkt_id;

      -- Update ticket status
      UPDATE public.lottery_tickets
      SET status = 'won',
          match_tier = CASE WHEN lpad(v_tkt_rec.ticket_number, 4, '0') = v_final_digits THEN 'EXACT 4/4 MATCH' ELSE 'RANK #' || v_pos || ' WINNER' END,
          won_amount = v_payout_amt,
          claimed = false
      WHERE id = v_tkt_id;

      -- Queue into winner_payouts
      v_payout_id := 'WP-' || (EXTRACT(EPOCH FROM now()) * 1000)::bigint || '-' || v_pos || '-' || substr(md5(v_tkt_id), 1, 4);
      INSERT INTO public.winner_payouts (
        id,
        event_id,
        event_title,
        ticket_id,
        user_id,
        winner_address,
        winner_username,
        winning_digits,
        tickets_sold,
        ticket_price,
        total_pool_collected,
        winner_share_percent,
        calculated_amount,
        payout_amount,
        status,
        position,
        currency,
        created_at
      ) VALUES (
        v_payout_id,
        p_event_id,
        v_event.title,
        v_tkt_id,
        v_tkt_rec.user_id,
        v_tkt_rec.user_address,
        v_tkt_rec.username,
        v_final_digits,
        v_snapshot_count,
        COALESCE(v_event.ticket_price, 10),
        v_total_collected,
        v_pos_pct,
        v_payout_amt,
        v_payout_amt,
        'pending_approval',
        v_pos,
        v_currency,
        now()
      );
    END LOOP;

    -- Non-winning tickets
    UPDATE public.lottery_tickets
    SET status = 'lost',
        match_tier = 'NO MATCH',
        won_amount = 0
    WHERE event_id = p_event_id AND status = 'active' AND id <> ALL(v_selected_tkt_ids);
  ELSE
    -- No tickets sold or none active
    UPDATE public.lottery_tickets
    SET status = 'lost', match_tier = 'NO MATCH', won_amount = 0
    WHERE event_id = p_event_id AND status = 'active';
  END IF;

  -- 8. Record Draw Audit Log
  v_audit_id := 'draw_audit_' || to_char(now(), 'YYYYMMDDHH24MISS') || '_' || substr(md5(random()::text), 1, 6);
  INSERT INTO public.lottery_draw_audits (
    id,
    event_id,
    event_title,
    draw_timestamp,
    winning_digits,
    commit_hash,
    revealed_seed,
    client_seed,
    outcome_hash,
    tickets_snapshot_count,
    winner_count,
    total_payout_fc,
    verified,
    metadata
  ) VALUES (
    v_audit_id,
    p_event_id,
    v_event.title,
    now(),
    v_final_digits,
    v_commit_hash,
    v_server_seed,
    v_client_seed,
    v_outcome_hash,
    v_snapshot_count,
    COALESCE(array_length(v_selected_tkt_ids, 1), 0),
    v_total_winner_pool,
    true,
    jsonb_build_object(
      'combined_seed', v_server_seed || ':' || v_client_seed || ':' || p_event_id,
      'winner_tickets', v_selected_tkt_ids,
      'currency', v_currency,
      'payout_share_percent', v_share_percent,
      'distribution', v_distribution
    )
  );

  -- 9. Update event status to completed & reveal seeds
  UPDATE public.lottery_events
  SET status = 'completed',
      winning_digits = v_final_digits,
      server_seed = v_server_seed,
      revealed_seed = v_server_seed,
      client_seed = v_client_seed,
      snapshot_count = v_snapshot_count,
      draw_audit_id = v_audit_id,
      draw_time = (EXTRACT(EPOCH FROM now()) * 1000)::bigint
  WHERE id = p_event_id;

  RETURN jsonb_build_object(
    'success', true,
    'event_id', p_event_id,
    'winning_digits', v_final_digits,
    'winner_count', COALESCE(array_length(v_selected_tkt_ids, 1), 0),
    'distributable_pool', v_total_winner_pool,
    'commit_hash', v_commit_hash,
    'revealed_seed', v_server_seed,
    'audit_id', v_audit_id,
    'snapshot_count', v_snapshot_count,
    'currency', v_currency
  );
END;
$$;
  `);

  console.log('✓ Successfully updated finalize_lottery_draw_secure RPC with event-specific winner percentages and currencies!');
}

updateFinalizeRpc().catch(err => {
  console.error('Error updating RPC:', err);
  process.exit(1);
});
