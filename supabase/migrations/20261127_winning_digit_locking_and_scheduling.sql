-- ============================================================================
-- Migration: 20261127_winning_digit_locking_and_scheduling.sql
-- Purpose:
--   1. Add scheduling & processing lifecycle columns to public.lottery_events:
--      scheduled_publish_at, published_at, processing_started_at.
--   2. Enforce server-side expiration locking of winning digits via BOTH
--      admin_save_event_winning_digits_secure() AND BEFORE UPDATE trigger
--      (trg_lock_winning_digits_after_expiration) so direct API/DB updates
--      cannot modify winning digits once the event expires or finalizes.
--   3. Update finalize_lottery_draw_secure() to use session-scoped internal
--      lock token when finalizing results, consuming the last saved digits.
--   4. Upgrade process_lottery_lifecycle_tick() to handle the complete flow:
--      Scheduled (auto-publish once at scheduled_publish_at) -> Active ->
--      Expired (locks winning digits) -> Processing -> Completed (+1h My Ticket).
--   5. Add admin_manage_scheduled_event_secure() to edit or cancel scheduled
--      events before publication.
-- ============================================================================

ALTER TABLE public.lottery_events
  ADD COLUMN IF NOT EXISTS scheduled_publish_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS published_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS processing_started_at timestamptz NULL;

CREATE INDEX IF NOT EXISTS idx_lottery_events_scheduled_publish
  ON public.lottery_events (status, scheduled_publish_at)
  WHERE status = 'scheduled' AND published_at IS NULL AND COALESCE(is_deleted, false) = false;

-- Backfill published_at for already-published existing events
UPDATE public.lottery_events
SET published_at = COALESCE(created_at, clock_timestamp())
WHERE status <> 'scheduled'
  AND status <> 'draft'
  AND published_at IS NULL;

-- ----------------------------------------------------------------------------
-- Trigger: Reject any direct/API winning digit edits after event expiration or finalization
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.lock_winning_digits_after_expiration()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_now_ms bigint := (EXTRACT(EPOCH FROM clock_timestamp()) * 1000)::bigint;
  v_window_end bigint;
  v_digits_changed boolean;
  v_is_expired_or_locked boolean;
BEGIN
  IF current_setting('earnflow.internal_finalizing', true) = 'true' THEN
    RETURN NEW;
  END IF;

  v_digits_changed := (
    NEW.preset_winning_digits IS DISTINCT FROM OLD.preset_winning_digits
    OR NEW.winning_codes IS DISTINCT FROM OLD.winning_codes
    OR NEW.winning_digits IS DISTINCT FROM OLD.winning_digits
    OR NEW.winner_mode IS DISTINCT FROM OLD.winner_mode
    OR NEW.winner_count IS DISTINCT FROM OLD.winner_count
    OR NEW.winning_code_count IS DISTINCT FROM OLD.winning_code_count
    OR NEW.draw_mode IS DISTINCT FROM OLD.draw_mode
    OR (COALESCE(OLD.codes_locked, false) = true AND COALESCE(NEW.codes_locked, false) = false)
  );

  IF NOT v_digits_changed THEN
    RETURN NEW;
  END IF;

  v_window_end := public._compute_event_window_end(
    OLD.start_time,
    OLD.draw_time,
    OLD.duration_value::text,
    OLD.duration_unit
  );

  v_is_expired_or_locked := (
    COALESCE(OLD.codes_locked, false) = true
    OR OLD.finalized_at IS NOT NULL
    OR lower(COALESCE(OLD.status, '')) IN ('expired', 'processing', 'result_pending', 'completed', 'settled', 'deleted')
    OR COALESCE(OLD.is_deleted, false) = true
    OR (
      lower(COALESCE(OLD.status, '')) NOT IN ('scheduled', 'draft')
      AND v_window_end > 0
      AND v_now_ms >= v_window_end
    )
  );

  IF v_is_expired_or_locked THEN
    RAISE EXCEPTION 'Winning digits are permanently locked after event expiration/finalization (event_id: %). No post-expiration modifications are permitted.', OLD.id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_lock_winning_digits_after_expiration ON public.lottery_events;
CREATE TRIGGER trg_lock_winning_digits_after_expiration
  BEFORE UPDATE ON public.lottery_events
  FOR EACH ROW
  EXECUTE FUNCTION public.lock_winning_digits_after_expiration();

-- ----------------------------------------------------------------------------
-- RPC: Edit Winning Digits Strictly BEFORE Expiration (Single & Multiple Winners)
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
  v_now_ms bigint := (EXTRACT(EPOCH FROM clock_timestamp()) * 1000)::bigint;
  v_window_end bigint;
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
    RETURN jsonb_build_object('success', false, 'locked', true, 'error', 'Deleted/archived events cannot be modified.');
  END IF;

  IF v_event.status IN ('completed', 'settled') OR v_event.finalized_at IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'locked', true, 'error', 'Event is already completed. Winning digits are permanently locked.');
  END IF;

  v_window_end := public._compute_event_window_end(
    v_event.start_time,
    v_event.draw_time,
    v_event.duration_value::text,
    v_event.duration_unit
  );

  IF COALESCE(v_event.codes_locked, false)
     OR lower(COALESCE(v_event.status, '')) IN ('expired', 'processing', 'result_pending')
     OR (lower(COALESCE(v_event.status, '')) NOT IN ('scheduled', 'draft') AND v_window_end > 0 AND v_now_ms >= v_window_end) THEN
    -- Ensure lock state is persisted safely
    UPDATE public.lottery_events
    SET codes_locked = true,
        status = CASE WHEN status = 'active' THEN 'expired' ELSE status END,
        is_active = CASE WHEN status = 'active' THEN false ELSE is_active END
    WHERE id = p_event_id;

    RETURN jsonb_build_object(
      'success', false,
      'locked', true,
      'error', 'Winning digits are permanently locked because this event has reached its expiration time.'
    );
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

  -- Preserve the event's configured winner policy unless explicitly aligned
  v_mode := COALESCE(NULLIF(trim(COALESCE(v_event.winner_mode, '')), ''), NULLIF(trim(COALESCE(p_winner_mode, '')), ''), 'single');
  IF v_mode = 'single' THEN
    v_codes_array := ARRAY[v_codes_array[1]];
    v_code_count := 1;
  ELSE
    v_code_count := GREATEST(2, COALESCE(v_event.winner_count, v_event.winning_code_count, array_length(v_codes_array, 1)));
    IF array_length(v_codes_array, 1) <> v_code_count THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'Multiple Winners mode requires exactly ' || v_code_count || ' unique 4-digit winning codes.'
      );
    END IF;
  END IF;

  v_draw_mode := 'preset';
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
      'saved_codes', to_jsonb(v_codes_array),
      'expires_at_ms', v_window_end
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
-- RPC: Manage Scheduled Events BEFORE Publication (Edit Schedule / Cancel)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_manage_scheduled_event_secure(
  p_event_id text,
  p_action text,
  p_new_scheduled_at timestamptz DEFAULT NULL::timestamptz,
  p_updates jsonb DEFAULT NULL::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth', 'pg_temp'
AS $$
DECLARE
  v_event record;
  v_act text := lower(trim(COALESCE(p_action, '')));
  v_now timestamptz := clock_timestamp();
  v_sched_ms bigint;
  v_dur_ms bigint;
  v_dur_num numeric;
  v_unit text;
BEGIN
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized: Admin privileges required.');
  END IF;

  SELECT * INTO v_event FROM public.lottery_events WHERE id = p_event_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Scheduled event not found.');
  END IF;

  IF v_event.status <> 'scheduled' OR v_event.published_at IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only unpublished scheduled events can be modified or cancelled via this workflow.');
  END IF;

  IF v_act = 'cancel' THEN
    UPDATE public.lottery_events
    SET status = 'deleted',
        is_deleted = true,
        is_active = false,
        archived_at = v_now,
        deleted_by = auth.uid(),
        deletion_reason = COALESCE(NULLIF(trim(COALESCE(p_updates->>'reason', '')), ''), 'Cancelled scheduled event prior to publication')
    WHERE id = p_event_id;

    INSERT INTO public.admin_audit_logs (
      admin_id, action_type, target_type, target_id, changes
    ) VALUES (
      auth.uid(), 'CANCEL_SCHEDULED_EVENT', 'lottery_events', p_event_id,
      jsonb_build_object('cancelled_at', v_now)
    );

    RETURN jsonb_build_object('success', true, 'event_id', p_event_id, 'status', 'deleted');
  ELSIF v_act = 'update' THEN
    IF p_new_scheduled_at IS NOT NULL THEN
      IF p_new_scheduled_at <= v_now THEN
        RETURN jsonb_build_object('success', false, 'error', 'Scheduled publish time must be in the future.');
      END IF;
      v_sched_ms := (EXTRACT(EPOCH FROM p_new_scheduled_at) * 1000)::bigint;
    ELSE
      v_sched_ms := v_event.start_time;
    END IF;

    v_dur_num := GREATEST(1, COALESCE(v_event.duration_value, 60));
    v_unit := lower(COALESCE(v_event.duration_unit, 'minutes'));
    v_dur_ms := CASE
      WHEN v_unit LIKE 'min%' THEN (v_dur_num * 60 * 1000)::bigint
      WHEN v_unit LIKE 'day%' THEN (v_dur_num * 86400 * 1000)::bigint
      ELSE (v_dur_num * 3600 * 1000)::bigint
    END;

    UPDATE public.lottery_events
    SET scheduled_publish_at = COALESCE(p_new_scheduled_at, scheduled_publish_at),
        start_time = v_sched_ms,
        draw_time = v_sched_ms + v_dur_ms,
        title = COALESCE(NULLIF(trim(COALESCE(p_updates->>'title', '')), ''), title),
        room_name = COALESCE(NULLIF(trim(COALESCE(p_updates->>'room_name', '')), ''), room_name),
        description = COALESCE(p_updates->>'description', description)
    WHERE id = p_event_id;

    INSERT INTO public.admin_audit_logs (
      admin_id, action_type, target_type, target_id, changes
    ) VALUES (
      auth.uid(), 'UPDATE_SCHEDULED_EVENT', 'lottery_events', p_event_id,
      jsonb_build_object('scheduled_publish_at', COALESCE(p_new_scheduled_at, v_event.scheduled_publish_at))
    );

    RETURN jsonb_build_object(
      'success', true,
      'event_id', p_event_id,
      'scheduled_publish_at', COALESCE(p_new_scheduled_at, v_event.scheduled_publish_at)
    );
  ELSE
    RETURN jsonb_build_object('success', false, 'error', 'Unsupported action. Use update or cancel.');
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_manage_scheduled_event_secure(text, text, timestamptz, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_manage_scheduled_event_secure(text, text, timestamptz, jsonb) TO authenticated, service_role;

-- ----------------------------------------------------------------------------
-- Update finalize_lottery_draw_secure(): sets internal finalization session guard
-- and preserves locked saved winning digits atomically
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
    PERFORM set_config('earnflow.internal_finalizing', 'true', true);

    SELECT * INTO v_event FROM public.lottery_events WHERE id = p_event_id FOR UPDATE;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Event not found: ' || p_event_id);
    END IF;

    IF COALESCE(v_event.is_deleted, false) OR v_event.status = 'deleted' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Deleted events cannot be finalized.');
    END IF;

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

    -- Prefer locked/saved DB winning codes when codes_locked OR explicit args omitted
    IF v_event.winning_codes IS NOT NULL AND jsonb_typeof(v_event.winning_codes) = 'array' AND jsonb_array_length(v_event.winning_codes) > 0 THEN
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
    ELSIF p_winning_codes IS NOT NULL AND jsonb_typeof(p_winning_codes) = 'array' AND jsonb_array_length(p_winning_codes) > 0 THEN
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
    END IF;

    IF v_effective_draw_mode = 'preset' AND COALESCE(array_length(v_codes_array, 1), 0) = 0 THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Winning digits have not been saved for this preset event. Cannot finalize without winning digits.'
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

    UPDATE public.lottery_tickets
    SET status = 'lost',
        match_tier = 'NO MATCH',
        won_amount = 0
    WHERE event_id = p_event_id AND status = 'active';

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

    UPDATE public.lottery_events
    SET status = 'completed',
        is_active = false,
        codes_locked = true,
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

-- ----------------------------------------------------------------------------
-- Upgrade Automated Lifecycle Tick Processor:
--   1. Scheduled -> Active (auto-publishes at scheduled_publish_at once only)
--   2. Active -> Expired (permanently locks winning digits at expiration)
--   3. Expired -> Processing -> Completed (atomic automatic finalization)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.process_lottery_lifecycle_tick()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth', 'extensions', 'pg_temp'
AS $$
DECLARE
  v_now_ts timestamptz := clock_timestamp();
  v_now_ms bigint := (EXTRACT(EPOCH FROM v_now_ts) * 1000)::bigint;
  v_evt record;
  v_window_end bigint;
  v_dur_ms bigint;
  v_dur_num numeric;
  v_unit text;
  v_published_count integer := 0;
  v_expired_count integer := 0;
  v_finalized_count integer := 0;
  v_pending_count integer := 0;
  v_has_digits boolean;
  v_res jsonb;
BEGIN
  -- 1. Publish Scheduled events once their UTC scheduled_publish_at time arrives (strict single-publish guard)
  FOR v_evt IN
    SELECT id, duration_value, duration_unit, scheduled_publish_at
    FROM public.lottery_events
    WHERE status = 'scheduled'
      AND published_at IS NULL
      AND scheduled_publish_at IS NOT NULL
      AND scheduled_publish_at <= v_now_ts
      AND COALESCE(is_deleted, false) = false
      AND COALESCE(is_paused, false) = false
  LOOP
    PERFORM pg_advisory_xact_lock(hashtext('publish_sched:' || v_evt.id));

    v_dur_num := GREATEST(1, COALESCE(v_evt.duration_value, 60));
    v_unit := lower(COALESCE(v_evt.duration_unit, 'minutes'));
    v_dur_ms := CASE
      WHEN v_unit LIKE 'min%' THEN (v_dur_num * 60 * 1000)::bigint
      WHEN v_unit LIKE 'day%' THEN (v_dur_num * 86400 * 1000)::bigint
      ELSE (v_dur_num * 3600 * 1000)::bigint
    END;

    UPDATE public.lottery_events
    SET status = 'active',
        is_active = true,
        published_at = v_now_ts,
        start_time = (EXTRACT(EPOCH FROM v_evt.scheduled_publish_at) * 1000)::bigint,
        draw_time = (EXTRACT(EPOCH FROM v_evt.scheduled_publish_at) * 1000)::bigint + v_dur_ms
    WHERE id = v_evt.id
      AND status = 'scheduled'
      AND published_at IS NULL;

    IF FOUND THEN
      INSERT INTO public.admin_audit_logs (
        admin_id, action_type, target_type, target_id, changes
      ) VALUES (
        NULL, 'AUTO_PUBLISH_SCHEDULED_EVENT', 'lottery_events', v_evt.id,
        jsonb_build_object('scheduled_publish_at', v_evt.scheduled_publish_at, 'published_at', v_now_ts)
      );
      v_published_count := v_published_count + 1;
    END IF;
  END LOOP;

  -- 2. Transition elapsed active events strictly to 'expired' & lock winning digits
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
          is_active = false,
          codes_locked = true
      WHERE id = v_evt.id AND status = 'active';
      v_expired_count := v_expired_count + 1;
    END IF;
  END LOOP;

  -- 3. Process Expired / Processing / Result Pending unfinalized events automatically
  FOR v_evt IN
    SELECT id, draw_mode, preset_winning_digits, winning_codes
    FROM public.lottery_events
    WHERE status IN ('expired', 'processing', 'result_pending')
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
        UPDATE public.lottery_events
        SET status = 'processing',
            codes_locked = true,
            processing_started_at = COALESCE(processing_started_at, v_now_ts)
        WHERE id = v_evt.id AND finalized_at IS NULL;

        v_res := public.finalize_lottery_draw_secure(v_evt.id);
        IF COALESCE((v_res->>'success')::boolean, false) THEN
          v_finalized_count := v_finalized_count + 1;
        ELSE
          UPDATE public.lottery_events
          SET status = 'expired'
          WHERE id = v_evt.id AND finalized_at IS NULL;
          v_pending_count := v_pending_count + 1;
        END IF;
      EXCEPTION WHEN OTHERS THEN
        UPDATE public.lottery_events
        SET status = 'expired'
        WHERE id = v_evt.id AND finalized_at IS NULL;
        v_pending_count := v_pending_count + 1;
      END;
    ELSE
      UPDATE public.lottery_events
      SET status = 'result_pending',
          codes_locked = true
      WHERE id = v_evt.id AND status <> 'result_pending' AND finalized_at IS NULL;
      v_pending_count := v_pending_count + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'server_now_ms', v_now_ms,
    'auto_published', v_published_count,
    'transitioned_expired', v_expired_count,
    'auto_finalized', v_finalized_count,
    'awaiting_digits', v_pending_count
  );
END;
$$;

REVOKE ALL ON FUNCTION public.process_lottery_lifecycle_tick() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.process_lottery_lifecycle_tick() TO postgres, service_role;
