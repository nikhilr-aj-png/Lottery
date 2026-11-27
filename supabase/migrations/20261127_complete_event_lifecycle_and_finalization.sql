-- ============================================================================
-- Migration: 20261127_complete_event_lifecycle_and_finalization.sql
-- Purpose:
--   1. Add authoritative server finalization & 1-hour ticket visibility fields:
--      finalized_at, ticket_visibility_until, deleted_by, deletion_reason.
--   2. Backfill finalized_at & ticket_visibility_until ONLY for legitimately
--      finalized historical events (draw_executed_at IS NOT NULL & winning_digits IS NOT NULL).
--   3. Replace destructive ON DELETE CASCADE on lottery_tickets and
--      lottery_draw_audits with ON DELETE RESTRICT + BEFORE DELETE trigger
--      to guarantee purchased tickets & audit records are never destroyed.
--   4. Add admin_save_event_winning_digits_secure (never marks Completed).
--   5. Harden finalize_lottery_draw_secure:
--      - Advisory lock + FOR UPDATE + idempotent guard
--      - Authoritative retrieval of saved winning digits (preserving leading zeros e.g. '0025', '2538')
--      - Fails safely on missing preset digits (never fakes Completed)
--      - Persists lottery_draw_audits row & returns audit_id
--      - Sets finalized_at = clock_timestamp(), ticket_visibility_until = finalized_at + 1h
--   6. Add admin_delete_event_secure (protects unfinalized events; soft-archives finalized events).
--   7. Add process_lottery_lifecycle_tick() + pg_cron minute job for automated lifecycle & auto-finalization.
--   8. Update get_user_tickets_with_events() and verify_room_entry_secure() with finalized_at & 1h visibility.
-- ============================================================================

ALTER TABLE public.lottery_events
  ADD COLUMN IF NOT EXISTS finalized_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS ticket_visibility_until timestamptz NULL,
  ADD COLUMN IF NOT EXISTS deleted_by uuid NULL,
  ADD COLUMN IF NOT EXISTS deletion_reason text NULL;

CREATE INDEX IF NOT EXISTS idx_lottery_events_lifecycle
  ON public.lottery_events (status, is_deleted, finalized_at, ticket_visibility_until);

-- Backfill finalized_at and 1-hour visibility deadline ONLY on genuinely finalized historical events
UPDATE public.lottery_events
SET finalized_at = draw_executed_at,
    ticket_visibility_until = draw_executed_at + interval '1 hour'
WHERE draw_executed_at IS NOT NULL
  AND winning_digits IS NOT NULL
  AND finalized_at IS NULL;

-- Prevent cascading physical deletion of tickets & audit history when events are archived/cleaned up
ALTER TABLE public.lottery_tickets
  DROP CONSTRAINT IF EXISTS lottery_tickets_event_id_fkey,
  ADD CONSTRAINT lottery_tickets_event_id_fkey
    FOREIGN KEY (event_id) REFERENCES public.lottery_events(id) ON DELETE RESTRICT;

ALTER TABLE public.lottery_draw_audits
  DROP CONSTRAINT IF EXISTS lottery_draw_audits_event_id_fkey,
  ADD CONSTRAINT lottery_draw_audits_event_id_fkey
    FOREIGN KEY (event_id) REFERENCES public.lottery_events(id) ON DELETE RESTRICT;

CREATE OR REPLACE FUNCTION public.prevent_destructive_lottery_event_delete()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  IF COALESCE(OLD.is_deleted, false) IS NOT TRUE THEN
    RAISE EXCEPTION 'Direct DELETE on lottery_events (%) is blocked; use admin_delete_event_secure() soft-archival.', OLD.id;
  END IF;

  IF EXISTS (SELECT 1 FROM public.lottery_tickets WHERE event_id = OLD.id)
     OR EXISTS (SELECT 1 FROM public.winner_payouts WHERE event_id = OLD.id)
     OR EXISTS (SELECT 1 FROM public.lottery_draw_audits WHERE event_id = OLD.id) THEN
    RAISE EXCEPTION 'Cannot permanently purge lottery_event (%) while linked tickets, payouts, or audit logs exist.', OLD.id;
  END IF;

  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_destructive_lottery_event_delete ON public.lottery_events;
CREATE TRIGGER trg_prevent_destructive_lottery_event_delete
  BEFORE DELETE ON public.lottery_events
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_destructive_lottery_event_delete();

-- ----------------------------------------------------------------------------
-- Admin Save Winning Digits (Stores exact digits; NEVER marks Completed or starts 1h timer)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_save_event_winning_digits_secure(
  p_event_id text,
  p_winning_codes jsonb,
  p_winner_mode text DEFAULT 'single',
  p_draw_mode text DEFAULT 'preset',
  p_payout_share_percent numeric DEFAULT 90,
  p_winner_distribution jsonb DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth', 'pg_temp'
AS $$
DECLARE
  v_event record;
  v_codes_array text[] := ARRAY[]::text[];
  v_raw text;
  v_clean text;
  i integer;
  v_mode text;
  v_draw_mode text;
  v_code_count integer;
  v_prev_codes jsonb;
  v_share_pct numeric;
  v_dist jsonb;
  v_audit_entry jsonb;
  v_existing_log jsonb;
  v_meta jsonb;
  v_admin_identity text;
BEGIN
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized: Admin privileges required.');
  END IF;

  SELECT * INTO v_event FROM public.lottery_events WHERE id = p_event_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Event not found: ' || p_event_id);
  END IF;

  IF COALESCE(v_event.is_deleted, false) OR v_event.status = 'deleted' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Deleted/archived events cannot be modified.');
  END IF;

  IF v_event.status IN ('completed', 'settled') OR v_event.finalized_at IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Event is already finalized. Winning digits are locked.');
  END IF;

  IF p_winning_codes IS NULL OR jsonb_typeof(p_winning_codes) <> 'array' OR jsonb_array_length(p_winning_codes) = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'At least one 4-digit winning code must be provided.');
  END IF;

  FOR i IN 0..(jsonb_array_length(p_winning_codes) - 1) LOOP
    v_raw := trim(COALESCE(p_winning_codes->>i, ''));
    IF v_raw !~ '^\d{4}$' THEN
      RETURN jsonb_build_object('success', false, 'error', 'Each winning code must be exactly 4 digits (e.g., 2538 or 0025). Got: ' || COALESCE(v_raw, 'empty'));
    END IF;
    v_clean := lpad(v_raw, 4, '0');
    IF v_clean = ANY(v_codes_array) THEN
      RETURN jsonb_build_object('success', false, 'error', 'Duplicate winning code detected: ' || v_clean);
    END IF;
    v_codes_array := array_append(v_codes_array, v_clean);
  END LOOP;

  v_mode := COALESCE(NULLIF(trim(COALESCE(p_winner_mode, '')), ''), v_event.winner_mode, 'single');
  IF v_mode = 'single' AND array_length(v_codes_array, 1) > 1 THEN
    v_codes_array := ARRAY[v_codes_array[1]];
  END IF;

  v_draw_mode := COALESCE(NULLIF(trim(COALESCE(p_draw_mode, '')), ''), 'preset');
  v_code_count := CASE WHEN v_mode = 'single' THEN 1 ELSE array_length(v_codes_array, 1) END;
  v_share_pct := LEAST(100, GREATEST(1, COALESCE(p_payout_share_percent, v_event.winner_payout_share_percent, 90)));
  v_dist := COALESCE(p_winner_distribution, v_event.winner_distribution, '[{"position": 1, "percent": 100}]'::jsonb);

  SELECT COALESCE(p.username, p.email, p.trc20_address, auth.uid()::text)
  INTO v_admin_identity
  FROM public.profiles p
  WHERE p.id = auth.uid();

  v_prev_codes := COALESCE(v_event.winning_codes, '[]'::jsonb);
  v_audit_entry := jsonb_build_object(
    'action', 'UPDATE_WINNING_CODES',
    'eventId', p_event_id,
    'previousCodes', v_prev_codes,
    'newCodes', to_jsonb(v_codes_array),
    'adminIdentity', COALESCE(v_admin_identity, 'Admin'),
    'timestamp', now()
  );

  v_existing_log := CASE
    WHEN v_event.metadata IS NOT NULL AND jsonb_typeof(v_event.metadata->'audit_log') = 'array'
    THEN v_event.metadata->'audit_log'
    ELSE '[]'::jsonb
  END;

  v_meta := COALESCE(v_event.metadata, '{}'::jsonb) || jsonb_build_object(
    'audit_log', v_existing_log || v_audit_entry,
    'winning_codes', to_jsonb(v_codes_array),
    'winner_mode', v_mode
  );

  -- Explicitly updates ONLY configuration columns.
  -- NEVER touches winning_digits, status = 'completed', finalized_at, or ticket_visibility_until!
  UPDATE public.lottery_events
  SET winner_mode = v_mode,
      draw_mode = v_draw_mode,
      winning_codes = to_jsonb(v_codes_array),
      winning_code_count = v_code_count,
      winner_count = v_code_count,
      preset_winning_digits = v_codes_array[1],
      winner_payout_share_percent = v_share_pct,
      winner_distribution = v_dist,
      codes_timing = 'configured',
      metadata = v_meta
  WHERE id = p_event_id;

  INSERT INTO public.admin_audit_logs (
    admin_id, action_type, target_type, target_id, changes
  ) VALUES (
    auth.uid(),
    'UPDATE_WINNING_CODES',
    'lottery_events',
    p_event_id,
    jsonb_build_object(
      'previous_codes', v_prev_codes,
      'saved_preset_digits', v_codes_array[1],
      'saved_codes', to_jsonb(v_codes_array)
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'event_id', p_event_id,
    'preset_winning_digits', v_codes_array[1],
    'winning_codes', to_jsonb(v_codes_array),
    'status', v_event.status
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_save_event_winning_digits_secure(text, jsonb, text, text, numeric, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_save_event_winning_digits_secure(text, jsonb, text, text, numeric, jsonb) TO authenticated, service_role;

-- ----------------------------------------------------------------------------
-- Protect Unrelated Settings Updates from Overwriting Saved Winning Digits or Finalized Fields
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_update_event_settings_secure(
  p_event_id text,
  p_updates jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth', 'pg_temp'
AS $$
DECLARE
  v_event record;
BEGIN
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized: Admin privileges required.');
  END IF;

  SELECT * INTO v_event FROM public.lottery_events WHERE id = p_event_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Event not found.');
  END IF;

  IF COALESCE(v_event.is_deleted, false) OR v_event.status = 'deleted' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Deleted events cannot be updated.');
  END IF;

  -- Preserve preset_winning_digits, winning_codes, winning_digits, finalized_at, ticket_visibility_until!
  UPDATE public.lottery_events
  SET title = COALESCE(NULLIF(trim(COALESCE(p_updates->>'title', '')), ''), title),
      room_name = COALESCE(NULLIF(trim(COALESCE(p_updates->>'room_name', '')), ''), room_name),
      description = COALESCE(p_updates->>'description', description),
      is_paused = COALESCE((p_updates->>'is_paused')::boolean, is_paused),
      pause_reason = COALESCE(p_updates->>'pause_reason', pause_reason),
      max_total_tickets = COALESCE((p_updates->>'max_total_tickets')::integer, max_total_tickets),
      max_tickets_per_user = COALESCE((p_updates->>'max_tickets_per_user')::integer, max_tickets_per_user)
  WHERE id = p_event_id;

  RETURN jsonb_build_object('success', true, 'event_id', p_event_id);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_update_event_settings_secure(text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_update_event_settings_secure(text, jsonb) TO authenticated, service_role;

-- ----------------------------------------------------------------------------
-- Atomic, Idempotent Lottery Draw Finalization RPC
-- - Consumes saved winning digits (e.g. '2538', '0025') cleanly
-- - Fails safely without marking Completed if preset draw has no digits
-- - Persists lottery_draw_audits proof + winner_payouts + ticket results
-- - Sets finalized_at = clock_timestamp() and ticket_visibility_until = finalized_at + 1 hour
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.finalize_lottery_draw_secure(
  p_event_id text,
  p_winning_codes jsonb DEFAULT NULL::jsonb,
  p_draw_mode text DEFAULT NULL::text,
  p_custom_winner_count integer DEFAULT NULL::integer,
  p_custom_digits text DEFAULT NULL::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth', 'extensions', 'pg_temp'
AS $$
DECLARE
    v_event record;
    v_actual_tickets_sold integer := 0;
    v_actual_collected numeric := 0;
    v_gross_pool numeric := 0;
    v_share_percent numeric;
    v_distributable_pool numeric := 0;
    v_distribution jsonb;
    v_winning_mode text;
    v_effective_draw_mode text;
    v_code_count integer;
    v_codes_array text[] := ARRAY[]::text[];
    v_winning_tickets jsonb := '[]'::jsonb;
    v_total_allocated numeric := 0;
    v_curr_code text;
    v_matching_tkt record;
    v_pos_matches text[] := ARRAY[]::text[];
    v_pos_match_count integer;
    v_pos_share_percent numeric;
    v_pos_pool numeric;
    v_payout_per_ticket numeric;
    v_all_winning_tkt_ids text[] := ARRAY[]::text[];
    v_primary_digits text;
    v_resolved_uid uuid;
    v_resolved_username text;
    v_payout_id text;
    v_payout_ref text;
    v_finalized_at timestamptz;
    v_visibility_until timestamptz;
    v_revealed_seed text;
    v_client_seed text;
    v_commit_hash text;
    v_outcome_hash text;
    v_audit_id text;
    i integer;
    v_temp_num integer;
    v_temp_code text;
BEGIN
    IF NOT (
      public.is_admin()
      OR session_user IN ('postgres', 'supabase_admin')
      OR current_setting('role', true) = 'service_role'
    ) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Unauthorized: Admin privileges required.');
    END IF;

    PERFORM pg_advisory_xact_lock(hashtext('finalize_draw:' || p_event_id));

    SELECT * INTO v_event FROM public.lottery_events WHERE id = p_event_id FOR UPDATE;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Event not found: ' || p_event_id);
    END IF;

    IF COALESCE(v_event.is_deleted, false) OR v_event.status = 'deleted' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Deleted events cannot be finalized.');
    END IF;

    -- Idempotency check: never duplicate settlements or extend 1-hour visibility countdown
    IF v_event.status IN ('completed', 'settled') OR v_event.finalized_at IS NOT NULL THEN
        RETURN jsonb_build_object(
            'success', true,
            'already_finalized', true,
            'event_id', p_event_id,
            'winning_digits', v_event.winning_digits,
            'winning_codes', COALESCE(v_event.draw_result_codes, v_event.winning_codes),
            'finalized_at', v_event.finalized_at,
            'ticket_visibility_until', v_event.ticket_visibility_until,
            'audit_id', v_event.draw_audit_id,
            'message', 'Event is already finalized.'
        );
    END IF;

    v_winning_mode := COALESCE(v_event.winner_mode, 'single');
    v_effective_draw_mode := lower(trim(COALESCE(NULLIF(trim(COALESCE(p_draw_mode, '')), ''), v_event.draw_mode, 'random')));
    v_distribution := COALESCE(v_event.winner_distribution, '[{"position": 1, "percent": 100}]'::jsonb);
    v_share_percent := COALESCE(v_event.winner_payout_share_percent, 90.0);

    -- Resolve authoritative winning digits:
    -- 1. Explicit array argument (if non-empty valid 4-digit codes)
    -- 2. Explicit custom digits argument (if valid 4-digit code)
    -- 3. Saved DB v_event.winning_codes array
    -- 4. Saved DB v_event.preset_winning_digits scalar
    IF p_winning_codes IS NOT NULL AND jsonb_typeof(p_winning_codes) = 'array' AND jsonb_array_length(p_winning_codes) > 0 THEN
        FOR i IN 0..(jsonb_array_length(p_winning_codes) - 1) LOOP
            v_temp_code := trim(COALESCE(p_winning_codes->>i, ''));
            IF v_temp_code ~ '^\d{1,4}$' THEN
                v_temp_code := lpad(v_temp_code, 4, '0');
                IF NOT (v_temp_code = ANY(v_codes_array)) THEN
                    v_codes_array := array_append(v_codes_array, v_temp_code);
                END IF;
            END IF;
        END LOOP;
    ELSIF p_custom_digits IS NOT NULL AND trim(p_custom_digits) ~ '^\d{1,4}$' THEN
        v_codes_array := ARRAY[lpad(trim(p_custom_digits), 4, '0')];
    ELSIF v_event.winning_codes IS NOT NULL AND jsonb_typeof(v_event.winning_codes) = 'array' AND jsonb_array_length(v_event.winning_codes) > 0 THEN
        FOR i IN 0..(jsonb_array_length(v_event.winning_codes) - 1) LOOP
            v_temp_code := trim(COALESCE(v_event.winning_codes->>i, ''));
            IF v_temp_code ~ '^\d{1,4}$' THEN
                v_temp_code := lpad(v_temp_code, 4, '0');
                IF NOT (v_temp_code = ANY(v_codes_array)) THEN
                    v_codes_array := array_append(v_codes_array, v_temp_code);
                END IF;
            END IF;
        END LOOP;
    ELSIF v_event.preset_winning_digits IS NOT NULL AND trim(v_event.preset_winning_digits) ~ '^\d{1,4}$' THEN
        v_codes_array := ARRAY[lpad(trim(v_event.preset_winning_digits), 4, '0')];
    END IF;

    -- Preset mode MUST have saved or explicitly supplied winning digits; fail cleanly instead of guessing randomly
    IF v_effective_draw_mode = 'preset' AND COALESCE(array_length(v_codes_array, 1), 0) = 0 THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Winning digits have not been saved for this preset event. Save a 4-digit winning number before finalization.'
        );
    END IF;

    v_code_count := CASE
        WHEN v_winning_mode = 'single' THEN 1
        ELSE GREATEST(2, COALESCE(v_event.winning_code_count, v_event.winner_count, p_custom_winner_count, 3))
    END;

    IF v_winning_mode = 'single' AND array_length(v_codes_array, 1) > 1 THEN
        v_codes_array := ARRAY[v_codes_array[1]];
    END IF;

    WHILE COALESCE(array_length(v_codes_array, 1), 0) < v_code_count LOOP
        IF v_effective_draw_mode = 'preset' AND COALESCE(array_length(v_codes_array, 1), 0) >= 1 THEN
            EXIT;
        END IF;
        v_temp_num := floor(random() * 10000)::integer;
        v_temp_code := lpad(v_temp_num::text, 4, '0');
        IF NOT (v_temp_code = ANY(v_codes_array)) THEN
            v_codes_array := array_append(v_codes_array, v_temp_code);
        END IF;
    END LOOP;

    v_primary_digits := v_codes_array[1];

    -- Count eligible purchased tickets directly from lottery_tickets
    SELECT COUNT(*)::integer, COALESCE(SUM(COALESCE(price, 0)), 0)::numeric
    INTO v_actual_tickets_sold, v_actual_collected
    FROM public.lottery_tickets
    WHERE event_id = p_event_id
      AND COALESCE(status, 'active') <> 'refunded';

    v_actual_tickets_sold := COALESCE(v_actual_tickets_sold, 0);
    IF v_actual_tickets_sold > 0 THEN
        IF COALESCE(v_actual_collected, 0) > 0 THEN
            v_gross_pool := ROUND(v_actual_collected, 2);
        ELSE
            v_gross_pool := ROUND(v_actual_tickets_sold * GREATEST(COALESCE(v_event.ticket_price, 0), 0), 2);
        END IF;
    ELSE
        v_gross_pool := 0;
    END IF;

    v_distributable_pool := ROUND((v_gross_pool * v_share_percent) / 100.0, 2);

    -- Evaluate matching active tickets per winning position
    FOR i IN 1..array_length(v_codes_array, 1) LOOP
        v_curr_code := v_codes_array[i];
        v_pos_matches := ARRAY[]::text[];

        IF jsonb_array_length(v_distribution) >= i THEN
            v_pos_share_percent := COALESCE((v_distribution->(i - 1)->>'percent')::numeric, (100.0 / array_length(v_codes_array, 1)));
        ELSE
            v_pos_share_percent := 100.0 / array_length(v_codes_array, 1);
        END IF;

        v_pos_pool := ROUND((v_distributable_pool * v_pos_share_percent) / 100.0, 2);

        FOR v_matching_tkt IN
            SELECT t.id
            FROM public.lottery_tickets t
            WHERE t.event_id = p_event_id
              AND t.status = 'active'
              AND lpad(regexp_replace(t.ticket_number::text, '\D', '', 'g'), 4, '0') = v_curr_code
            ORDER BY t.created_at ASC
        LOOP
            v_pos_matches := array_append(v_pos_matches, v_matching_tkt.id);
        END LOOP;

        v_pos_match_count := COALESCE(array_length(v_pos_matches, 1), 0);

        IF v_pos_match_count > 0 THEN
            v_payout_per_ticket := ROUND(v_pos_pool / v_pos_match_count, 2);

            FOR v_matching_tkt IN
                SELECT t.id, t.user_id, t.user_address, t.username, t.ticket_number
                FROM public.lottery_tickets t
                WHERE t.id = ANY(v_pos_matches)
            LOOP
                SELECT COALESCE(
                  v_matching_tkt.user_id,
                  (SELECT lw.user_id FROM public.lottery_wallets lw WHERE lower(lw.address) = lower(v_matching_tkt.user_address) LIMIT 1),
                  (SELECT p.id FROM public.profiles p WHERE p.trc20_address IS NOT NULL AND lower(p.trc20_address) = lower(v_matching_tkt.user_address) LIMIT 1)
                ) INTO v_resolved_uid;

                SELECT COALESCE(
                  NULLIF(regexp_replace(COALESCE(
                    (SELECT p.username FROM public.profiles p WHERE p.id = v_resolved_uid LIMIT 1),
                    v_matching_tkt.username
                  ), '^@+', ''), ''),
                  CASE WHEN v_matching_tkt.user_address IS NOT NULL AND length(v_matching_tkt.user_address) > 10
                    THEN left(v_matching_tkt.user_address, 6) || '...' || right(v_matching_tkt.user_address, 4)
                    ELSE 'Player'
                  END
                ) INTO v_resolved_username;

                v_payout_id := 'wp-' || p_event_id || '-' || v_matching_tkt.id;
                v_payout_ref := 'lottery-' || p_event_id || '-' || v_matching_tkt.id;

                INSERT INTO public.winner_payouts (
                    id, event_id, event_title, ticket_id, user_id,
                    winner_address, winner_username, winning_digits,
                    tickets_sold, ticket_price, total_pool_collected,
                    winner_share_percent, calculated_amount, payout_amount, max_allowed_amount,
                    status, position, currency, payout_type, payout_reference, notes, created_at
                ) VALUES (
                    v_payout_id, p_event_id, v_event.title, v_matching_tkt.id, v_resolved_uid,
                    COALESCE(v_matching_tkt.user_address, ''), v_resolved_username, v_curr_code,
                    v_actual_tickets_sold, COALESCE(v_event.ticket_price, 0), v_gross_pool,
                    ROUND((v_share_percent * v_pos_share_percent) / 100.0, 2),
                    v_payout_per_ticket, v_payout_per_ticket, GREATEST(v_pos_pool, v_payout_per_ticket),
                    'pending_approval', i, 'USDT', 'lottery_win', v_payout_ref,
                    CASE WHEN v_pos_match_count > 1 THEN 'Tie-split across ' || v_pos_match_count || ' matching tickets' ELSE NULL END,
                    clock_timestamp()
                )
                ON CONFLICT (id) DO NOTHING;

                UPDATE public.lottery_tickets
                SET status = 'won',
                    won_amount = v_payout_per_ticket,
                    claimed = false,
                    match_tier = 'EXACT 4/4 MATCH (POS #' || i || ')'
                WHERE id = v_matching_tkt.id;

                v_all_winning_tkt_ids := array_append(v_all_winning_tkt_ids, v_matching_tkt.id);
                v_total_allocated := v_total_allocated + v_payout_per_ticket;

                v_winning_tickets := v_winning_tickets || jsonb_build_object(
                    'ticket_id', v_matching_tkt.id,
                    'position', i,
                    'code', v_curr_code,
                    'payout', v_payout_per_ticket
                );
            END LOOP;
        END IF;
    END LOOP;

    -- Settle remaining active tickets as lost
    UPDATE public.lottery_tickets
    SET status = 'lost',
        match_tier = 'NO MATCH',
        won_amount = 0
    WHERE event_id = p_event_id AND status = 'active';

    -- Authoritative server finalization timestamp & exact 1-hour My Ticket visibility deadline
    v_finalized_at := clock_timestamp();
    v_visibility_until := v_finalized_at + interval '1 hour';

    v_revealed_seed := COALESCE(NULLIF(trim(COALESCE(v_event.revealed_seed, '')), ''), v_event.server_seed, 'seed_' || md5(p_event_id || v_finalized_at::text));
    v_client_seed := COALESCE(NULLIF(trim(COALESCE(v_event.client_seed, '')), ''), 'earnflow-official-draw');
    v_commit_hash := COALESCE(NULLIF(trim(COALESCE(v_event.sha256_seed, '')), ''), '0x' || encode(extensions.digest(v_revealed_seed, 'sha256'), 'hex'));
    v_outcome_hash := encode(extensions.digest(v_revealed_seed || ':' || v_client_seed || ':' || p_event_id, 'sha256'), 'hex');
    v_audit_id := 'draw_audit_' || to_char(v_finalized_at, 'YYYYMMDDHH24MISS') || '_' || substr(md5(p_event_id || random()::text), 1, 6);

    INSERT INTO public.lottery_draw_audits (
        id, event_id, event_title, draw_timestamp, winning_digits,
        commit_hash, revealed_seed, client_seed, outcome_hash,
        tickets_snapshot_count, winner_count, total_payout_fc, verified, metadata, created_at
    ) VALUES (
        v_audit_id, p_event_id, v_event.title, v_finalized_at, v_primary_digits,
        v_commit_hash, v_revealed_seed, v_client_seed, v_outcome_hash,
        v_actual_tickets_sold, COALESCE(array_length(v_all_winning_tkt_ids, 1), 0), v_total_allocated,
        true,
        jsonb_build_object(
          'winning_codes', to_jsonb(v_codes_array),
          'draw_mode', v_effective_draw_mode,
          'ticket_visibility_until', v_visibility_until
        ),
        v_finalized_at
    );

    -- Mark Completed ONLY as the final atomic step after all ticket/payout/audit writes succeed
    UPDATE public.lottery_events
    SET status = 'completed',
        is_active = false,
        tickets_sold = v_actual_tickets_sold,
        winning_digits = v_primary_digits,
        winning_codes = to_jsonb(v_codes_array),
        draw_result_codes = to_jsonb(v_codes_array),
        draw_result_details = jsonb_build_object(
            'codes', to_jsonb(v_codes_array),
            'winning_tickets', v_winning_tickets,
            'tickets_sold', v_actual_tickets_sold,
            'gross_pool', v_gross_pool,
            'total_allocated', v_total_allocated,
            'distributable_pool', v_distributable_pool,
            'winner_count', COALESCE(array_length(v_all_winning_tkt_ids, 1), 0)
        ),
        revealed_seed = v_revealed_seed,
        client_seed = v_client_seed,
        draw_audit_id = v_audit_id,
        draw_executed_at = v_finalized_at,
        finalized_at = v_finalized_at,
        ticket_visibility_until = v_visibility_until
    WHERE id = p_event_id;

    INSERT INTO public.admin_audit_logs (
        admin_id, action_type, target_type, target_id, changes
    ) VALUES (
        auth.uid(),
        'FINALIZE_LOTTERY_DRAW',
        'lottery_events',
        p_event_id,
        jsonb_build_object(
            'winning_digits', v_primary_digits,
            'winning_codes', to_jsonb(v_codes_array),
            'tickets_sold', v_actual_tickets_sold,
            'gross_pool', v_gross_pool,
            'total_winners', COALESCE(array_length(v_all_winning_tkt_ids, 1), 0),
            'total_allocated', v_total_allocated,
            'finalized_at', v_finalized_at,
            'ticket_visibility_until', v_visibility_until,
            'audit_id', v_audit_id,
            'currency', 'USDT'
        )
    );

    RETURN jsonb_build_object(
        'success', true,
        'event_id', p_event_id,
        'tickets_sold', v_actual_tickets_sold,
        'gross_pool', v_gross_pool,
        'winning_digits', v_primary_digits,
        'winning_codes', to_jsonb(v_codes_array),
        'winner_count', COALESCE(array_length(v_all_winning_tkt_ids, 1), 0),
        'total_paid_out', v_total_allocated,
        'distributable_pool', v_distributable_pool,
        'finalized_at', v_finalized_at,
        'finalized_at_ms', (EXTRACT(EPOCH FROM v_finalized_at) * 1000)::bigint,
        'ticket_visibility_until', v_visibility_until,
        'ticket_visibility_until_ms', (EXTRACT(EPOCH FROM v_visibility_until) * 1000)::bigint,
        'audit_id', v_audit_id,
        'currency', 'USDT'
    );
END;
$$;

REVOKE ALL ON FUNCTION public.finalize_lottery_draw_secure(text, jsonb, text, integer, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.finalize_lottery_draw_secure(text, jsonb, text, integer, text) TO authenticated, service_role;

-- ----------------------------------------------------------------------------
-- Safe Admin Event Deletion RPC (Protects unfinished draws; soft-archives finalized)
-- Never cascades into deleting tickets, payouts, or ledger history
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_delete_event_secure(
  p_event_id text,
  p_force_cancel boolean DEFAULT false,
  p_reason text DEFAULT NULL::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth', 'pg_temp'
AS $$
DECLARE
  v_event record;
  v_is_finalized boolean;
  v_ticket_count integer := 0;
  v_has_saved_digits boolean := false;
  v_now timestamptz := clock_timestamp();
BEGIN
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized: Admin privileges required.');
  END IF;

  SELECT * INTO v_event FROM public.lottery_events WHERE id = p_event_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Event not found.');
  END IF;

  IF COALESCE(v_event.is_deleted, false) OR v_event.status = 'deleted' THEN
    RETURN jsonb_build_object('success', true, 'already_deleted', true, 'event_id', p_event_id);
  END IF;

  v_is_finalized := (v_event.status IN ('completed', 'settled') AND v_event.finalized_at IS NOT NULL);
  v_has_saved_digits := (v_event.preset_winning_digits IS NOT NULL OR (v_event.winning_codes IS NOT NULL AND jsonb_array_length(v_event.winning_codes) > 0));
  SELECT COUNT(*)::integer INTO v_ticket_count FROM public.lottery_tickets WHERE event_id = p_event_id;

  IF NOT v_is_finalized AND NOT COALESCE(p_force_cancel, false) THEN
    RETURN jsonb_build_object(
      'success', false,
      'blocked_unfinalized', true,
      'has_saved_digits', v_has_saved_digits,
      'tickets_count', v_ticket_count,
      'error', 'Cannot delete an unfinalized event before final result processing completes. Use the Authorized Cancellation / Recovery workflow if aborting this draw.'
    );
  END IF;

  UPDATE public.lottery_events
  SET status = 'deleted',
      is_active = false,
      is_deleted = true,
      archived_at = COALESCE(archived_at, v_now),
      deleted_by = auth.uid(),
      deletion_reason = COALESCE(
        NULLIF(trim(COALESCE(p_reason, '')), ''),
        CASE WHEN v_is_finalized THEN 'Post-finalization admin cleanup' ELSE 'Authorized recovery cancellation' END
      )
  WHERE id = p_event_id;

  INSERT INTO public.admin_audit_logs (
    admin_id, action_type, target_type, target_id, changes
  ) VALUES (
    auth.uid(),
    CASE WHEN v_is_finalized THEN 'ARCHIVE_FINALIZED_EVENT' ELSE 'AUTHORIZED_CANCEL_EVENT' END,
    'lottery_events',
    p_event_id,
    jsonb_build_object(
      'was_finalized', v_is_finalized,
      'forced_recovery', COALESCE(p_force_cancel, false),
      'preserved_winning_digits', v_event.winning_digits,
      'preserved_preset_digits', v_event.preset_winning_digits,
      'preserved_tickets_count', v_ticket_count,
      'archived_at', v_now,
      'reason', p_reason
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'event_id', p_event_id,
    'was_finalized', v_is_finalized,
    'preserved_tickets_count', v_ticket_count,
    'archived_at', v_now
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_delete_event_secure(text, boolean, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_delete_event_secure(text, boolean, text) TO authenticated, service_role;

-- ----------------------------------------------------------------------------
-- Automated Background Lifecycle & Finalization Processor (for pg_cron)
-- Runs every minute cleanly inside Postgres:
--   1. Transitions expired active events -> 'expired'
--   2. Auto-finalizes expired events that have configured winning digits (or random mode)
--   3. Transitions expired preset events without saved digits -> 'result_pending'
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.process_lottery_lifecycle_tick()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth', 'extensions', 'pg_temp'
AS $$
DECLARE
  v_now_ms bigint := (EXTRACT(EPOCH FROM clock_timestamp()) * 1000)::bigint;
  v_evt record;
  v_window_end bigint;
  v_expired_count integer := 0;
  v_finalized_count integer := 0;
  v_pending_count integer := 0;
  v_has_digits boolean;
  v_res jsonb;
BEGIN
  -- 1. Move elapsed active events strictly to 'expired' (never straight to 'completed')
  FOR v_evt IN
    SELECT id, start_time, draw_time, duration_value, duration_unit
    FROM public.lottery_events
    WHERE status = 'active'
      AND COALESCE(is_deleted, false) = false
      AND COALESCE(is_paused, false) = false
  LOOP
    v_window_end := public._compute_event_window_end(
      v_evt.start_time, v_evt.draw_time, v_evt.duration_value::text, v_evt.duration_unit
    );
    IF v_window_end > 0 AND v_now_ms >= v_window_end THEN
      UPDATE public.lottery_events
      SET status = 'expired',
          is_active = false
      WHERE id = v_evt.id AND status = 'active';
      v_expired_count := v_expired_count + 1;
    END IF;
  END LOOP;

  -- 2. Process expired / result_pending unfinalized events safely
  FOR v_evt IN
    SELECT id, draw_mode, preset_winning_digits, winning_codes
    FROM public.lottery_events
    WHERE status IN ('expired', 'result_pending')
      AND COALESCE(is_deleted, false) = false
      AND COALESCE(is_paused, false) = false
      AND finalized_at IS NULL
  LOOP
    v_has_digits := (
      (v_evt.preset_winning_digits IS NOT NULL AND trim(v_evt.preset_winning_digits) ~ '^\d{1,4}$')
      OR (v_evt.winning_codes IS NOT NULL AND jsonb_typeof(v_evt.winning_codes) = 'array' AND jsonb_array_length(v_evt.winning_codes) > 0)
    );

    IF lower(COALESCE(v_evt.draw_mode, 'random')) = 'random' OR v_has_digits THEN
      BEGIN
        v_res := public.finalize_lottery_draw_secure(v_evt.id);
        IF COALESCE((v_res->>'success')::boolean, false) THEN
          v_finalized_count := v_finalized_count + 1;
        END IF;
      EXCEPTION WHEN OTHERS THEN
        UPDATE public.lottery_events
        SET status = 'result_pending'
        WHERE id = v_evt.id AND finalized_at IS NULL;
        v_pending_count := v_pending_count + 1;
      END;
    ELSE
      UPDATE public.lottery_events
      SET status = 'result_pending'
      WHERE id = v_evt.id AND status <> 'result_pending' AND finalized_at IS NULL;
      v_pending_count := v_pending_count + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'server_now_ms', v_now_ms,
    'transitioned_expired', v_expired_count,
    'auto_finalized', v_finalized_count,
    'awaiting_digits', v_pending_count
  );
END;
$$;

REVOKE ALL ON FUNCTION public.process_lottery_lifecycle_tick() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.process_lottery_lifecycle_tick() TO postgres, service_role;

-- Schedule pg_cron job every minute (idempotent re-registration)
DO $$
DECLARE
  v_job_id bigint;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    SELECT jobid INTO v_job_id FROM cron.job WHERE jobname = 'lottery-lifecycle-auto-processor' LIMIT 1;
    IF v_job_id IS NOT NULL THEN
      PERFORM cron.unschedule(v_job_id);
    END IF;
    PERFORM cron.schedule(
      'lottery-lifecycle-auto-processor',
      '* * * * *',
      'SELECT public.process_lottery_lifecycle_tick();'
    );
  END IF;
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

-- ----------------------------------------------------------------------------
-- Update verify_room_entry_secure: allow entry strictly while event is active & unfinalized
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.verify_room_entry_secure(
  p_event_or_room_id text
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'auth', 'pg_temp'
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_key text := trim(COALESCE(p_event_or_room_id, ''));
  v_now_ms bigint := (EXTRACT(EPOCH FROM clock_timestamp()) * 1000)::bigint;
  v_prof_status text;
  v_event record;
  v_expires_at bigint;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'unauthenticated',
      'message', 'Please log in to enter a lottery room.',
      'server_now_ms', v_now_ms
    );
  END IF;

  SELECT status INTO v_prof_status FROM public.profiles WHERE id = v_uid;
  IF lower(COALESCE(v_prof_status, 'active')) IN ('suspended', 'banned') THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'account_restricted',
      'message', 'Your account does not currently have room access permission.',
      'server_now_ms', v_now_ms
    );
  END IF;

  IF v_key = '' THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'invalid_room',
      'message', 'Invalid lottery room identifier.',
      'server_now_ms', v_now_ms
    );
  END IF;

  SELECT * INTO v_event
  FROM public.lottery_events
  WHERE id = v_key OR room_id = v_key
  ORDER BY created_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'not_found',
      'message', 'This lottery event could not be found.',
      'server_now_ms', v_now_ms
    );
  END IF;

  v_expires_at := public._compute_event_window_end(
    v_event.start_time,
    v_event.draw_time,
    v_event.duration_value::text,
    v_event.duration_unit
  );

  IF COALESCE(v_event.is_deleted, false) OR lower(COALESCE(v_event.status, '')) = 'deleted' THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'deleted',
      'event_id', v_event.id,
      'room_id', v_event.room_id,
      'message', 'This event has expired. Room entry is no longer available.',
      'server_now_ms', v_now_ms
    );
  END IF;

  IF COALESCE(v_event.is_paused, false) OR lower(COALESCE(v_event.status, '')) = 'paused' THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'paused',
      'event_id', v_event.id,
      'room_id', v_event.room_id,
      'message', COALESCE(NULLIF(trim(COALESCE(v_event.pause_reason, '')), ''), 'This event room is temporarily paused.'),
      'server_now_ms', v_now_ms
    );
  END IF;

  IF lower(COALESCE(v_event.status, '')) IN ('completed', 'ended', 'settled', 'result_pending', 'expired')
     OR v_event.finalized_at IS NOT NULL
     OR v_event.winning_digits IS NOT NULL
     OR NOT COALESCE(v_event.is_active, true) THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'expired',
      'event_id', v_event.id,
      'room_id', v_event.room_id,
      'expires_at', v_expires_at,
      'message', 'This event has expired. Room entry is no longer available.',
      'server_now_ms', v_now_ms
    );
  END IF;

  IF v_event.start_time IS NOT NULL AND v_event.start_time > 0 AND v_now_ms < v_event.start_time THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'upcoming',
      'event_id', v_event.id,
      'room_id', v_event.room_id,
      'start_time', v_event.start_time,
      'expires_at', v_expires_at,
      'message', 'This event has not started yet. Room entry opens at the scheduled start time.',
      'server_now_ms', v_now_ms
    );
  END IF;

  IF v_expires_at <= 0 OR v_now_ms >= v_expires_at THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'expired',
      'event_id', v_event.id,
      'room_id', v_event.room_id,
      'expires_at', v_expires_at,
      'message', 'This event has expired. Room entry is no longer available.',
      'server_now_ms', v_now_ms
    );
  END IF;

  RETURN jsonb_build_object(
    'allowed', true,
    'reason', 'active',
    'event_id', v_event.id,
    'room_id', COALESCE(v_event.room_id, 'room-' || v_event.id),
    'room_name', COALESCE(v_event.room_name, v_event.title),
    'title', v_event.title,
    'start_time', v_event.start_time,
    'expires_at', v_expires_at,
    'server_now_ms', v_now_ms
  );
END;
$$;

-- ----------------------------------------------------------------------------
-- Update get_user_tickets_with_events():
-- Returns server finalized_at & 1-hour ticket_visibility_until deadline,
-- strictly hides official winning_digits until finalized_at is set,
-- and marks is_post_finalization_hidden based on server clock_timestamp().
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_user_tickets_with_events()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'auth', 'pg_temp'
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_now_ts timestamptz := clock_timestamp();
  v_now_ms bigint := (EXTRACT(EPOCH FROM v_now_ts) * 1000)::bigint;
  v_rows jsonb;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('server_now_ms', v_now_ms, 'tickets', '[]'::jsonb);
  END IF;

  SELECT COALESCE(jsonb_agg(row_data ORDER BY purchase_ts DESC), '[]'::jsonb)
  INTO v_rows
  FROM (
    SELECT
      COALESCE(lt.purchase_time, (EXTRACT(EPOCH FROM lt.created_at) * 1000)::bigint) AS purchase_ts,
      jsonb_build_object(
        'id', lt.id,
        'event_id', lt.event_id,
        'event_title', COALESCE(le.title, lt.event_title, 'Lottery Draw Room'),
        'ticket_number', lpad(lt.ticket_number, 4, '0'),
        'price', lt.price,
        'currency', COALESCE(lt.currency, le.currency, 'USDT'),
        'purchase_time', lt.purchase_time,
        'created_at', lt.created_at,
        'status', lt.status,
        'match_tier', lt.match_tier,
        'won_amount', lt.won_amount,
        'claimed', lt.claimed,
        'user_address', lt.user_address,
        'username', lt.username,
        'ledger_tx_ref', tx.ledger_id,
        'event_exists', (le.id IS NOT NULL),
        'room_id', COALESCE(le.room_id, 'room-' || lt.event_id),
        'room_name', COALESCE(le.room_name, le.title, lt.event_title, 'Lottery Room'),
        'lottery_type', COALESCE(le.game_id, 'four-digit-lottery'),
        'start_time', COALESCE(le.start_time, 0),
        'draw_time', public._compute_event_window_end(le.start_time, le.draw_time, le.duration_value::text, le.duration_unit),
        'duration_value', le.duration_value,
        'duration_unit', le.duration_unit,
        'pool_prize', COALESCE(le.pool_prize, 0),
        'event_status', CASE
          WHEN le.id IS NULL THEN 'expired'
          ELSE COALESCE(le.status, 'expired')
        END,
        'event_is_active', COALESCE(le.is_active, false),
        'event_is_deleted', COALESCE(le.is_deleted, false),
        'event_is_paused', COALESCE(le.is_paused, false),
        'is_finalized', (
          COALESCE(le.status, '') IN ('completed', 'settled')
          AND (le.finalized_at IS NOT NULL OR le.draw_executed_at IS NOT NULL)
        ),
        'finalized_at', le.finalized_at,
        'finalized_at_ms', CASE
          WHEN le.finalized_at IS NOT NULL THEN (EXTRACT(EPOCH FROM le.finalized_at) * 1000)::bigint
          WHEN le.draw_executed_at IS NOT NULL AND le.status IN ('completed', 'settled') THEN (EXTRACT(EPOCH FROM le.draw_executed_at) * 1000)::bigint
          ELSE NULL
        END,
        'ticket_visibility_until', COALESCE(
          le.ticket_visibility_until,
          CASE WHEN le.finalized_at IS NOT NULL THEN le.finalized_at + interval '1 hour'
               WHEN le.draw_executed_at IS NOT NULL AND le.status IN ('completed', 'settled') THEN le.draw_executed_at + interval '1 hour'
               ELSE NULL
          END
        ),
        'ticket_visibility_until_ms', CASE
          WHEN le.ticket_visibility_until IS NOT NULL THEN (EXTRACT(EPOCH FROM le.ticket_visibility_until) * 1000)::bigint
          WHEN le.finalized_at IS NOT NULL THEN (EXTRACT(EPOCH FROM (le.finalized_at + interval '1 hour')) * 1000)::bigint
          WHEN le.draw_executed_at IS NOT NULL AND le.status IN ('completed', 'settled') THEN (EXTRACT(EPOCH FROM (le.draw_executed_at + interval '1 hour')) * 1000)::bigint
          ELSE NULL
        END,
        'is_post_finalization_hidden', (
          COALESCE(le.status, '') IN ('completed', 'settled')
          AND (le.finalized_at IS NOT NULL OR le.draw_executed_at IS NOT NULL)
          AND v_now_ts >= COALESCE(
            le.ticket_visibility_until,
            COALESCE(le.finalized_at, le.draw_executed_at) + interval '1 hour'
          )
        ),
        'winning_digits', CASE
          WHEN COALESCE(le.status, '') IN ('completed', 'settled') AND (le.finalized_at IS NOT NULL OR le.draw_executed_at IS NOT NULL)
          THEN le.winning_digits
          ELSE NULL
        END,
        'draw_result_codes', CASE
          WHEN COALESCE(le.status, '') IN ('completed', 'settled') AND (le.finalized_at IS NOT NULL OR le.draw_executed_at IS NOT NULL)
          THEN COALESCE(le.draw_result_codes, '[]'::jsonb)
          ELSE '[]'::jsonb
        END
      ) AS row_data
    FROM public.lottery_tickets lt
    LEFT JOIN public.lottery_events le ON le.id = lt.event_id
    LEFT JOIN LATERAL (
      SELECT wl.id AS ledger_id
      FROM public.wallet_ledger wl
      WHERE wl.user_id = v_uid
        AND wl.transaction_type = 'ticket_purchase'
        AND lt.created_at IS NOT NULL
        AND wl.created_at BETWEEN lt.created_at - interval '3 seconds' AND lt.created_at + interval '3 seconds'
      ORDER BY abs(EXTRACT(EPOCH FROM (wl.created_at - lt.created_at))) ASC
      LIMIT 1
    ) tx ON true
    WHERE lt.user_id = v_uid
  ) sub;

  RETURN jsonb_build_object(
    'server_now_ms', v_now_ms,
    'tickets', v_rows
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.verify_room_entry_secure(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_user_tickets_with_events() TO authenticated, service_role;
