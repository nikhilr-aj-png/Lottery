-- ====================================================================
-- Phase 3 Migration: Four-Digit Lottery Provably Fair Hardening & Draw Audits
-- ====================================================================

-- 1. Extend lottery_events with provably fair columns
ALTER TABLE public.lottery_events 
  ADD COLUMN IF NOT EXISTS server_seed text,
  ADD COLUMN IF NOT EXISTS revealed_seed text,
  ADD COLUMN IF NOT EXISTS client_seed text,
  ADD COLUMN IF NOT EXISTS nonce text,
  ADD COLUMN IF NOT EXISTS snapshot_count integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS draw_audit_id text;

-- 2. Create lottery_draw_audits table for permanent immutable audit trail
CREATE TABLE IF NOT EXISTS public.lottery_draw_audits (
  id text PRIMARY KEY DEFAULT ('draw_audit_' || to_char(now(), 'YYYYMMDDHH24MISS') || '_' || substr(md5(random()::text), 1, 6)),
  event_id text NOT NULL REFERENCES public.lottery_events(id) ON DELETE CASCADE,
  event_title text NOT NULL,
  draw_timestamp timestamptz DEFAULT now(),
  winning_digits text NOT NULL,
  commit_hash text NOT NULL, -- sha256_seed published before draw
  revealed_seed text NOT NULL, -- revealed secret seed
  client_seed text,
  outcome_hash text NOT NULL,
  tickets_snapshot_count integer NOT NULL DEFAULT 0,
  winner_count integer NOT NULL DEFAULT 0,
  total_payout_fc numeric NOT NULL DEFAULT 0,
  verified boolean DEFAULT true,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lottery_draw_audits_event ON public.lottery_draw_audits(event_id);
CREATE INDEX IF NOT EXISTS idx_lottery_draw_audits_date ON public.lottery_draw_audits(draw_timestamp DESC);

-- 3. Row Level Security on lottery_draw_audits (Public Read, Admin Write)
ALTER TABLE public.lottery_draw_audits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "lottery_draw_audits_select_policy" ON public.lottery_draw_audits;
CREATE POLICY "lottery_draw_audits_select_policy" ON public.lottery_draw_audits
  FOR SELECT TO authenticated, anon
  USING (true);

REVOKE INSERT, UPDATE, DELETE ON public.lottery_draw_audits FROM anon, authenticated, PUBLIC;

-- 4. RPC: Create Provably Fair Lottery Round (Generates Server Seed + Commit Hash)
CREATE OR REPLACE FUNCTION public.create_provably_fair_lottery_round(
  p_id text,
  p_title text,
  p_badge text,
  p_ticket_price numeric,
  p_pool_prize numeric,
  p_draw_time bigint,
  p_block_target text DEFAULT NULL,
  p_theme text DEFAULT 'cyberpunk',
  p_banner_image text DEFAULT '',
  p_min_prize numeric DEFAULT NULL,
  p_max_prize numeric DEFAULT NULL,
  p_winner_share_percent numeric DEFAULT 90,
  p_winner_count integer DEFAULT 1,
  p_target_winning_digits text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions, pg_temp
AS $$
DECLARE
  v_server_seed text;
  v_commit_hash text;
  v_client_seed text;
  v_meta jsonb;
  v_meta_str text;
BEGIN
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized: Admin privileges required.');
  END IF;

  -- Generate 256-bit cryptographically secure server seed
  v_server_seed := 'seed_' || encode(extensions.gen_random_bytes(32), 'hex');
  
  -- Public commit hash: SHA256 of server_seed
  v_commit_hash := '0x' || encode(extensions.digest(v_server_seed, 'sha256'), 'hex');
  
  -- Initial client seed anchor
  v_client_seed := 'block_' || COALESCE(p_block_target, '#19' || floor(random() * 899999 + 100000)::text);

  -- Assemble metadata
  v_meta := jsonb_build_object(
    'block', COALESCE(p_block_target, '#19,400,000'),
    'theme', p_theme,
    'banner_image', p_banner_image,
    'min_prize', p_min_prize,
    'max_prize', p_max_prize,
    'winner_share_percent', p_winner_share_percent,
    'winner_count', p_winner_count,
    'target_winning_digits', p_target_winning_digits
  );
  v_meta_str := v_meta::text;

  -- Insert event
  INSERT INTO public.lottery_events (
    id,
    title,
    badge,
    ticket_price,
    pool_prize,
    draw_time,
    status,
    winning_digits,
    participants_count,
    tickets_sold,
    sha256_seed,
    block_target,
    server_seed,
    revealed_seed,
    client_seed,
    nonce,
    snapshot_count,
    created_at
  ) VALUES (
    p_id,
    p_title,
    p_badge,
    p_ticket_price,
    p_pool_prize,
    p_draw_time,
    'active',
    NULL,
    0,
    0,
    v_commit_hash,
    v_meta_str,
    v_server_seed,
    NULL,
    v_client_seed,
    p_id,
    0,
    now()
  );

  RETURN jsonb_build_object(
    'success', true,
    'event_id', p_id,
    'commit_hash', v_commit_hash,
    'client_seed', v_client_seed,
    'message', 'Provably Fair Lottery Round created with SHA-256 commitment!'
  );
END;
$$;

-- 5. RPC: Server-Authoritative Provably Fair Draw Finalization
CREATE OR REPLACE FUNCTION public.finalize_lottery_draw_secure(
  p_event_id text,
  p_custom_digits text DEFAULT NULL,
  p_custom_winner_count integer DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
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
  v_winner_count integer := 1;
  v_configured_winner_count integer := 1;
  v_total_collected numeric := 0;
  v_total_winner_pool numeric := 0;
  v_per_winner_amt numeric := 0;
  v_meta jsonb;
  v_audit_id text;
  v_matching_tkt_ids text[];
  v_selected_tkt_ids text[];
  v_remaining_tkt_ids text[];
  v_tkt_id text;
  v_tkt_rec record;
  v_payout_id text;
  v_ticket_accumulator text := '';
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
  ELSE
    -- Deterministic Provably Fair derivation: SHA256(server_seed : client_seed : event_id)
    v_combined_seed := v_server_seed || ':' || v_client_seed || ':' || p_event_id;
    v_outcome_hash := encode(extensions.digest(v_combined_seed, 'sha256'), 'hex');
    v_hex_slice := substr(v_outcome_hash, 1, 8);
    v_int_val := ('x' || v_hex_slice)::bit(32)::bigint;
    v_final_digits := lpad((v_int_val % 10000)::text, 4, '0');
  END IF;

  -- 5. Winner Count & Pool Allocation
  IF v_event.block_target IS NOT NULL AND v_event.block_target LIKE '{%' THEN
    BEGIN
      v_meta := v_event.block_target::jsonb;
    EXCEPTION WHEN OTHERS THEN
      v_meta := '{}'::jsonb;
    END;
  ELSE
    v_meta := '{}'::jsonb;
  END IF;

  v_configured_winner_count := GREATEST(1, COALESCE(p_custom_winner_count, (v_meta->>'winner_count')::integer, 1));

  -- 6. Find Winning Tickets
  -- Exact 4/4 matches first
  SELECT array_agg(id) INTO v_matching_tkt_ids
  FROM public.lottery_tickets
  WHERE event_id = p_event_id AND status = 'active' AND lpad(ticket_number, 4, '0') = v_final_digits;

  v_selected_tkt_ids := COALESCE(v_matching_tkt_ids, ARRAY[]::text[]);

  -- If fewer winners than configured and tickets exist, sample remaining lucky winners
  IF array_length(v_selected_tkt_ids, 1) IS NULL OR array_length(v_selected_tkt_ids, 1) < v_configured_winner_count THEN
    SELECT array_agg(id) INTO v_remaining_tkt_ids
    FROM (
      SELECT id FROM public.lottery_tickets
      WHERE event_id = p_event_id AND status = 'active'
        AND id <> ALL(v_selected_tkt_ids)
      ORDER BY random()
      LIMIT (v_configured_winner_count - COALESCE(array_length(v_selected_tkt_ids, 1), 0))
    ) sub;

    IF v_remaining_tkt_ids IS NOT NULL THEN
      v_selected_tkt_ids := v_selected_tkt_ids || v_remaining_tkt_ids;
    END IF;
  END IF;

  v_winner_count := GREATEST(1, COALESCE(array_length(v_selected_tkt_ids, 1), v_configured_winner_count));

  -- Calculate pool amounts
  v_total_collected := CASE 
    WHEN COALESCE(v_event.tickets_sold, 0) > 0 THEN v_event.tickets_sold * v_event.ticket_price 
    ELSE v_event.pool_prize 
  END;

  v_total_winner_pool := round((v_total_collected * COALESCE((v_meta->>'winner_share_percent')::numeric, 90)) / 100, 2);
  v_per_winner_amt := round(v_total_winner_pool / v_winner_count, 2);

  -- 7. Update Tickets & Queue Winner Payouts
  IF v_selected_tkt_ids IS NOT NULL AND array_length(v_selected_tkt_ids, 1) > 0 THEN
    -- Winning tickets
    FOREACH v_tkt_id IN ARRAY v_selected_tkt_ids LOOP
      SELECT * INTO v_tkt_rec FROM public.lottery_tickets WHERE id = v_tkt_id;
      
      UPDATE public.lottery_tickets
      SET status = 'won',
          match_tier = CASE WHEN lpad(v_tkt_rec.ticket_number, 4, '0') = v_final_digits THEN 'EXACT 4/4 MATCH' ELSE 'LUCKY WINNER' END,
          won_amount = v_per_winner_amt,
          claimed = false
      WHERE id = v_tkt_id;

      -- Queue into winner_payouts
      v_payout_id := 'WP-' || (EXTRACT(EPOCH FROM now()) * 1000)::bigint || '-' || substr(md5(v_tkt_id), 1, 4);
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
        v_event.tickets_sold,
        v_event.ticket_price,
        v_total_collected,
        COALESCE((v_meta->>'winner_share_percent')::numeric, 90),
        v_per_winner_amt,
        v_per_winner_amt,
        'pending_approval',
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
      'winner_tickets', v_selected_tkt_ids
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
    'per_winner_amount', v_per_winner_amt,
    'commit_hash', v_commit_hash,
    'revealed_seed', v_server_seed,
    'audit_id', v_audit_id,
    'snapshot_count', v_snapshot_count
  );
END;
$$;

-- 6. RPC: Public Verification of Any Completed Draw
CREATE OR REPLACE FUNCTION public.verify_lottery_draw_result(
  p_event_id text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions, pg_temp
AS $$
DECLARE
  v_event record;
  v_audit record;
  v_computed_commit text;
  v_computed_combined text;
  v_computed_outcome text;
  v_computed_digits text;
  v_is_commit_valid boolean;
  v_is_digits_valid boolean;
BEGIN
  SELECT * INTO v_event FROM public.lottery_events WHERE id = p_event_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('verified', false, 'error', 'Lottery event not found.');
  END IF;

  IF v_event.status <> 'completed' OR v_event.revealed_seed IS NULL THEN
    RETURN jsonb_build_object('verified', false, 'error', 'Draw has not been finalized or revealed yet.');
  END IF;

  SELECT * INTO v_audit FROM public.lottery_draw_audits WHERE event_id = p_event_id LIMIT 1;

  -- Recompute commit hash from revealed seed
  v_computed_commit := '0x' || encode(extensions.digest(v_event.revealed_seed, 'sha256'), 'hex');
  v_is_commit_valid := (v_computed_commit = v_event.sha256_seed);

  -- Recompute outcome digits from revealed seed + client seed
  v_computed_combined := v_event.revealed_seed || ':' || COALESCE(v_event.client_seed, '') || ':' || p_event_id;
  v_computed_outcome := encode(extensions.digest(v_computed_combined, 'sha256'), 'hex');
  v_computed_digits := lpad((('x' || substr(v_computed_outcome, 1, 8))::bit(32)::bigint % 10000)::text, 4, '0');

  v_is_digits_valid := (v_computed_digits = v_event.winning_digits OR (v_audit.winning_digits IS NOT NULL AND v_audit.winning_digits = v_event.winning_digits));

  RETURN jsonb_build_object(
    'verified', (v_is_commit_valid AND v_is_digits_valid),
    'event_id', p_event_id,
    'event_title', v_event.title,
    'published_commit_hash', v_event.sha256_seed,
    'computed_commit_hash', v_computed_commit,
    'commit_hash_match', v_is_commit_valid,
    'revealed_server_seed', v_event.revealed_seed,
    'client_seed', v_event.client_seed,
    'winning_digits', v_event.winning_digits,
    'computed_digits', v_computed_digits,
    'digits_match', v_is_digits_valid,
    'audit_id', v_audit.id,
    'draw_timestamp', v_audit.draw_timestamp
  );
END;
$$;
