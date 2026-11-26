-- ============================================================================
-- EarnFlow.in: Payout Integrity, Automated Monthly Leaderboard Finalization,
-- Super Admin Reward Approval, Audit Trail, & Duplicate Protection Migration
-- ============================================================================

-- 1. Extend winner_payouts safely (no duplicate tables)
ALTER TABLE public.winner_payouts
  ADD COLUMN IF NOT EXISTS payout_type text NOT NULL DEFAULT 'lottery_win',
  ADD COLUMN IF NOT EXISTS competition_month text,
  ADD COLUMN IF NOT EXISTS leaderboard_rank integer,
  ADD COLUMN IF NOT EXISTS payout_reference text,
  ADD COLUMN IF NOT EXISTS max_allowed_amount numeric,
  ADD COLUMN IF NOT EXISTS manual_adjustment_reason text,
  ADD COLUMN IF NOT EXISTS failure_reason text,
  ADD COLUMN IF NOT EXISTS processed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS cancelled_at timestamptz,
  ADD COLUMN IF NOT EXISTS cancelled_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS cancellation_reason text,
  ADD COLUMN IF NOT EXISTS is_deleted boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS notes text;

-- Ensure currency defaults to USDT cleanly
ALTER TABLE public.winner_payouts ALTER COLUMN currency SET DEFAULT 'USDT';

-- Backfill missing classification, unique reference, user_id, username, and actual ticket stats
-- without overwriting historical settled payout_amount values
UPDATE public.winner_payouts wp
SET
  payout_type = CASE
    WHEN COALESCE(wp.payout_type, '') IN ('lottery_win', 'monthly_leaderboard', 'manual_grant') THEN
      CASE
        WHEN wp.competition_month IS NOT NULL THEN 'monthly_leaderboard'
        WHEN wp.ticket_id = 'MANUAL' OR wp.event_id = 'manual-reward' THEN 'manual_grant'
        ELSE wp.payout_type
      END
    WHEN wp.ticket_id = 'MANUAL' OR wp.event_id = 'manual-reward' THEN 'manual_grant'
    WHEN wp.competition_month IS NOT NULL THEN 'monthly_leaderboard'
    ELSE 'lottery_win'
  END,
  payout_reference = COALESCE(NULLIF(wp.payout_reference, ''), wp.id),
  currency = 'USDT';

UPDATE public.winner_payouts wp
SET
  user_id = COALESCE(
    wp.user_id,
    lt.user_id,
    (SELECT lw.user_id FROM public.lottery_wallets lw WHERE lower(lw.address) = lower(wp.winner_address) LIMIT 1),
    (SELECT pr.id FROM public.profiles pr WHERE pr.trc20_address IS NOT NULL AND lower(pr.trc20_address) = lower(wp.winner_address) LIMIT 1)
  ),
  winner_username = COALESCE(
    NULLIF(regexp_replace(COALESCE(
      (SELECT pr.username FROM public.profiles pr WHERE pr.id = COALESCE(wp.user_id, lt.user_id) LIMIT 1),
      lt.username,
      wp.winner_username
    ), '^@+', ''), ''),
    wp.winner_username
  ),
  tickets_sold = CASE
    WHEN COALESCE(wp.tickets_sold, 0) = 0 AND wp.event_id IS NOT NULL THEN
      COALESCE((SELECT COUNT(*)::integer FROM public.lottery_tickets lt2 WHERE lt2.event_id = wp.event_id AND COALESCE(lt2.status, 'active') <> 'refunded'), 0)
    ELSE wp.tickets_sold
  END,
  max_allowed_amount = COALESCE(
    wp.max_allowed_amount,
    CASE
      WHEN COALESCE(wp.calculated_amount, 0) > 0 THEN GREATEST(wp.calculated_amount, wp.payout_amount)
      ELSE wp.payout_amount
    END
  )
FROM public.lottery_tickets lt
WHERE wp.ticket_id = lt.id;

-- Backfill any remaining rows without matching ticket_id where event has tickets
UPDATE public.winner_payouts wp
SET
  tickets_sold = COALESCE((SELECT COUNT(*)::integer FROM public.lottery_tickets lt2 WHERE lt2.event_id = wp.event_id AND COALESCE(lt2.status, 'active') <> 'refunded'), 0)
WHERE wp.payout_type = 'lottery_win'
  AND COALESCE(wp.tickets_sold, 0) = 0
  AND wp.event_id IS NOT NULL;

-- Drop old conflicting constraints if any and enforce clean status/type checks
ALTER TABLE public.winner_payouts DROP CONSTRAINT IF EXISTS chk_winner_payouts_status;
ALTER TABLE public.winner_payouts
  ADD CONSTRAINT chk_winner_payouts_status CHECK (
    status IN ('pending_approval', 'processing', 'completed', 'paid', 'failed', 'cancelled', 'rejected')
  );

ALTER TABLE public.winner_payouts DROP CONSTRAINT IF EXISTS chk_winner_payouts_type;
ALTER TABLE public.winner_payouts
  ADD CONSTRAINT chk_winner_payouts_type CHECK (
    payout_type IN ('lottery_win', 'monthly_leaderboard', 'manual_grant')
  );

-- Duplicate-protection unique indexes
CREATE UNIQUE INDEX IF NOT EXISTS uq_winner_payouts_reference
  ON public.winner_payouts (payout_reference)
  WHERE payout_reference IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_winner_payouts_monthly_user
  ON public.winner_payouts (competition_month, user_id)
  WHERE payout_type = 'monthly_leaderboard'
    AND user_id IS NOT NULL
    AND COALESCE(is_deleted, false) = false
    AND status NOT IN ('cancelled', 'rejected');

CREATE UNIQUE INDEX IF NOT EXISTS uq_winner_payouts_monthly_rank
  ON public.winner_payouts (competition_month, leaderboard_rank)
  WHERE payout_type = 'monthly_leaderboard'
    AND leaderboard_rank IS NOT NULL
    AND COALESCE(is_deleted, false) = false
    AND status NOT IN ('cancelled', 'rejected');

CREATE UNIQUE INDEX IF NOT EXISTS uq_winner_payouts_lottery_ticket
  ON public.winner_payouts (event_id, ticket_id)
  WHERE payout_type = 'lottery_win'
    AND ticket_id IS NOT NULL
    AND ticket_id <> 'MANUAL'
    AND COALESCE(is_deleted, false) = false
    AND status NOT IN ('cancelled', 'rejected');

-- Protect financial records from hard DELETE via RLS; all removal goes through soft-delete RPC
DROP POLICY IF EXISTS winner_payouts_delete_policy ON public.winner_payouts;
CREATE POLICY winner_payouts_delete_policy ON public.winner_payouts
  FOR DELETE TO authenticated
  USING (false);

DROP POLICY IF EXISTS winner_payouts_select_policy ON public.winner_payouts;
CREATE POLICY winner_payouts_select_policy ON public.winner_payouts
  FOR SELECT TO authenticated
  USING (
    COALESCE(is_deleted, false) = false
    AND (
      (SELECT public.is_admin())
      OR ((SELECT auth.uid()) = user_id)
      OR EXISTS (
        SELECT 1 FROM public.lottery_wallets lw
        WHERE lw.user_id = (SELECT auth.uid())
          AND lower(lw.address) = lower(winner_payouts.winner_address)
      )
    )
  );

-- 2. Enhance _internal_credit_virtual_credits to also count monthly_leaderboard_reward
--    toward lifetime_won while keeping duplicate protection rock-solid
CREATE OR REPLACE FUNCTION public._internal_credit_virtual_credits(
  p_amount numeric,
  p_transaction_type text,
  p_reference_id text DEFAULT NULL::text,
  p_description text DEFAULT NULL::text,
  p_user_address text DEFAULT NULL::text,
  p_target_user_id uuid DEFAULT NULL::uuid,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth', 'pg_temp'
AS $function$
DECLARE
  v_uid uuid;
  v_wallet record;
  v_addr text;
  v_exact_amount numeric;
  v_old_balance numeric := 0;
  v_new_balance numeric;
  v_tx_id text;
BEGIN
  v_uid := COALESCE(p_target_user_id, auth.uid());

  IF p_amount IS NULL OR p_amount <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Amount must be greater than zero.');
  END IF;

  v_exact_amount := ROUND(p_amount, 2);

  IF p_reference_id IS NOT NULL THEN
    SELECT * INTO v_wallet FROM public.wallet_ledger
    WHERE reference_id = p_reference_id
      AND transaction_type = p_transaction_type
    LIMIT 1;
    IF FOUND THEN
      SELECT balance, address INTO v_new_balance, v_addr FROM public.lottery_wallets
      WHERE (v_uid IS NOT NULL AND user_id = v_uid)
         OR (p_user_address IS NOT NULL AND lower(address) = lower(p_user_address))
      ORDER BY updated_at DESC LIMIT 1;
      RETURN jsonb_build_object(
        'success', true,
        'already_processed', true,
        'new_balance', COALESCE(v_new_balance, 0),
        'wallet_address', COALESCE(v_addr, p_user_address),
        'transaction_id', v_wallet.id,
        'amount', v_wallet.amount,
        'message', 'Transaction already processed previously.'
      );
    END IF;
  END IF;

  SELECT * INTO v_wallet FROM public.lottery_wallets
  WHERE (v_uid IS NOT NULL AND user_id = v_uid)
     OR (p_user_address IS NOT NULL AND lower(address) = lower(p_user_address))
  ORDER BY updated_at DESC LIMIT 1
  FOR UPDATE;

  IF NOT FOUND THEN
    v_addr := COALESCE(NULLIF(trim(COALESCE(p_user_address, '')), ''), '0x' || substr(md5(random()::text || clock_timestamp()::text), 1, 40));
    v_old_balance := 0.00;
    v_new_balance := v_exact_amount;

    INSERT INTO public.lottery_wallets (
      address, user_id, balance, lifetime_won, network, updated_at
    ) VALUES (
      v_addr,
      v_uid,
      v_new_balance,
      CASE WHEN p_transaction_type IN ('lottery_win', 'game_win', 'monthly_leaderboard_reward') THEN v_exact_amount ELSE 0.00 END,
      'USDT-TRC20',
      now()
    );
  ELSE
    IF v_uid IS NOT NULL AND v_wallet.user_id IS NOT NULL AND v_wallet.user_id <> v_uid THEN
      RETURN jsonb_build_object('success', false, 'error', 'Wallet ownership verification failed: address belongs to a different user.');
    END IF;

    v_addr := v_wallet.address;
    v_old_balance := COALESCE(v_wallet.balance, 0.00);
    v_new_balance := ROUND(v_old_balance + v_exact_amount, 2);

    UPDATE public.lottery_wallets
    SET balance = v_new_balance,
        lifetime_won = CASE
          WHEN p_transaction_type IN ('lottery_win', 'game_win', 'monthly_leaderboard_reward')
          THEN ROUND(COALESCE(lifetime_won, 0.00) + v_exact_amount, 2)
          ELSE lifetime_won
        END,
        user_id = COALESCE(lottery_wallets.user_id, v_uid),
        updated_at = now()
    WHERE address = v_addr;
  END IF;

  v_tx_id := 'tx_' || to_char(now(), 'YYYYMMDDHH24MISS') || '_' || substr(md5(random()::text || COALESCE(p_reference_id, '')), 1, 8);
  INSERT INTO public.wallet_ledger (
    id, user_id, wallet_address, transaction_type, amount,
    balance_before, balance_after, currency, reference_id, description, metadata, created_at
  ) VALUES (
    v_tx_id, v_uid, v_addr, p_transaction_type, v_exact_amount,
    v_old_balance, v_new_balance, 'USDT', p_reference_id,
    COALESCE(p_description, 'Credit from ' || p_transaction_type), p_metadata, now()
  );

  RETURN jsonb_build_object(
    'success', true,
    'already_processed', false,
    'new_balance', v_new_balance,
    'wallet_address', v_addr,
    'credited', v_exact_amount,
    'currency', 'USDT',
    'transaction_id', v_tx_id
  );
END;
$function$;

REVOKE ALL ON FUNCTION public._internal_credit_virtual_credits(numeric, text, text, text, text, uuid, jsonb) FROM PUBLIC, anon, authenticated;

-- 3. Update get_leaderboard_rankings so monthly leaderboard prize payouts
--    NEVER feed back into win-rate lottery rankings
CREATE OR REPLACE FUNCTION public.get_leaderboard_rankings(
  p_days integer DEFAULT 28,
  p_limit integer DEFAULT 100
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth', 'pg_temp'
AS $function$
DECLARE
  v_days integer := GREATEST(1, LEAST(COALESCE(p_days, 28), 365));
  v_limit integer := GREATEST(1, LEAST(COALESCE(p_limit, 100), 100));
  v_now timestamptz := now();
  v_cutoff timestamptz := v_now - make_interval(days => v_days);
  v_rows jsonb;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN '[]'::jsonb;
  END IF;

  WITH raw_payout_wins AS (
    SELECT
      COALESCE(wp.user_id, lt.user_id, lw.user_id, prof_addr.id) AS resolved_user_id,
      NULLIF(trim(COALESCE(wp.winner_address, lt.user_address, '')), '') AS resolved_address,
      NULLIF(regexp_replace(trim(COALESCE(
        prof_id.username,
        prof_addr.username,
        CASE
          WHEN lt.username IS NOT NULL
            AND trim(lt.username) <> ''
            AND lower(trim(lt.username)) NOT IN ('player', 'anonymous', 'lucky winner', 'you')
            AND trim(lt.username) !~* '^0x[0-9a-f]{16,}$'
          THEN lt.username
          ELSE NULL
        END,
        CASE
          WHEN wp.winner_username IS NOT NULL
            AND trim(wp.winner_username) <> ''
            AND lower(trim(wp.winner_username)) NOT IN ('player', 'anonymous', 'lucky winner', 'you')
            AND trim(wp.winner_username) !~* '^0x[0-9a-f]{16,}$'
          THEN wp.winner_username
          ELSE NULL
        END,
        ''
      )), '^@+', ''), '') AS resolved_username,
      ('lwin:' || COALESCE(NULLIF(NULLIF(trim(wp.ticket_id), ''), 'MANUAL'), wp.id)) AS entry_ref,
      NULLIF(NULLIF(trim(wp.ticket_id), ''), 'MANUAL') AS covered_ticket_id,
      COALESCE(wp.payout_amount, 0)::numeric AS won_usdt,
      COALESCE(wp.approved_at, wp.created_at) AS event_ts
    FROM public.winner_payouts wp
    LEFT JOIN public.lottery_tickets lt ON lt.id = wp.ticket_id
    LEFT JOIN public.lottery_wallets lw ON lower(lw.address) = lower(COALESCE(wp.winner_address, lt.user_address, ''))
    LEFT JOIN public.profiles prof_addr ON prof_addr.trc20_address IS NOT NULL
      AND lower(prof_addr.trc20_address) = lower(COALESCE(wp.winner_address, lt.user_address, ''))
    LEFT JOIN public.profiles prof_id ON prof_id.id = COALESCE(wp.user_id, lt.user_id, lw.user_id, prof_addr.id)
    WHERE COALESCE(wp.payout_type, 'lottery_win') = 'lottery_win'
      AND COALESCE(wp.is_deleted, false) = false
      AND lower(COALESCE(wp.status, '')) IN ('paid', 'approved', 'completed')
      AND COALESCE(wp.payout_amount, 0) > 0
      AND COALESCE(wp.approved_at, wp.created_at) >= v_cutoff
      AND COALESCE(wp.approved_at, wp.created_at) <= v_now
  ),
  direct_ticket_wins AS (
    SELECT
      COALESCE(lt.user_id, lw.user_id, prof_addr.id) AS resolved_user_id,
      NULLIF(trim(COALESCE(lt.user_address, '')), '') AS resolved_address,
      NULLIF(regexp_replace(trim(COALESCE(
        prof_id.username,
        prof_addr.username,
        CASE
          WHEN lt.username IS NOT NULL
            AND trim(lt.username) <> ''
            AND lower(trim(lt.username)) NOT IN ('player', 'anonymous', 'lucky winner', 'you')
            AND trim(lt.username) !~* '^0x[0-9a-f]{16,}$'
          THEN lt.username
          ELSE NULL
        END,
        ''
      )), '^@+', ''), '') AS resolved_username,
      ('lwin:' || lt.id) AS entry_ref,
      lt.id AS covered_ticket_id,
      COALESCE(lt.won_amount, 0)::numeric AS won_usdt,
      COALESCE(
        le.draw_executed_at,
        CASE WHEN le.draw_time IS NOT NULL AND le.status = 'completed' THEN to_timestamp(le.draw_time / 1000.0) END,
        lt.created_at
      ) AS event_ts
    FROM public.lottery_tickets lt
    LEFT JOIN public.lottery_events le ON le.id = lt.event_id
    LEFT JOIN public.lottery_wallets lw ON lower(lw.address) = lower(COALESCE(lt.user_address, ''))
    LEFT JOIN public.profiles prof_addr ON prof_addr.trc20_address IS NOT NULL
      AND lower(prof_addr.trc20_address) = lower(COALESCE(lt.user_address, ''))
    LEFT JOIN public.profiles prof_id ON prof_id.id = COALESCE(lt.user_id, lw.user_id, prof_addr.id)
    WHERE lower(COALESCE(lt.status, '')) = 'won'
      AND COALESCE(lt.won_amount, 0) > 0
      AND NOT EXISTS (
        SELECT 1 FROM raw_payout_wins pw WHERE pw.covered_ticket_id = lt.id
      )
      AND COALESCE(
        le.draw_executed_at,
        CASE WHEN le.draw_time IS NOT NULL AND le.status = 'completed' THEN to_timestamp(le.draw_time / 1000.0) END,
        lt.created_at
      ) >= v_cutoff
      AND COALESCE(
        le.draw_executed_at,
        CASE WHEN le.draw_time IS NOT NULL AND le.status = 'completed' THEN to_timestamp(le.draw_time / 1000.0) END,
        lt.created_at
      ) <= v_now
  ),
  settled_lottery_entries AS (
    SELECT
      COALESCE(lt.user_id, lw.user_id, prof_addr.id) AS resolved_user_id,
      NULLIF(trim(COALESCE(lt.user_address, '')), '') AS resolved_address,
      NULLIF(regexp_replace(trim(COALESCE(
        prof_id.username,
        prof_addr.username,
        CASE
          WHEN lt.username IS NOT NULL
            AND trim(lt.username) <> ''
            AND lower(trim(lt.username)) NOT IN ('player', 'anonymous', 'lucky winner', 'you')
            AND trim(lt.username) !~* '^0x[0-9a-f]{16,}$'
          THEN lt.username
          ELSE NULL
        END,
        ''
      )), '^@+', ''), '') AS resolved_username,
      ('lwin:' || lt.id) AS entry_ref,
      CASE WHEN lower(COALESCE(lt.status, '')) = 'won' THEN 1 ELSE 0 END AS is_win,
      0::numeric AS won_usdt,
      COALESCE(
        wp_paid.payout_ts,
        le.draw_executed_at,
        CASE WHEN le.draw_time IS NOT NULL AND le.status = 'completed' THEN to_timestamp(le.draw_time / 1000.0) END,
        lt.created_at
      ) AS event_ts
    FROM public.lottery_tickets lt
    LEFT JOIN public.lottery_events le ON le.id = lt.event_id
    LEFT JOIN LATERAL (
      SELECT MAX(COALESCE(wp.approved_at, wp.created_at)) AS payout_ts
      FROM public.winner_payouts wp
      WHERE wp.ticket_id = lt.id
        AND COALESCE(wp.payout_type, 'lottery_win') = 'lottery_win'
        AND COALESCE(wp.is_deleted, false) = false
        AND lower(COALESCE(wp.status, '')) IN ('paid', 'approved', 'completed')
    ) wp_paid ON true
    LEFT JOIN public.lottery_wallets lw ON lower(lw.address) = lower(COALESCE(lt.user_address, ''))
    LEFT JOIN public.profiles prof_addr ON prof_addr.trc20_address IS NOT NULL
      AND lower(prof_addr.trc20_address) = lower(COALESCE(lt.user_address, ''))
    LEFT JOIN public.profiles prof_id ON prof_id.id = COALESCE(lt.user_id, lw.user_id, prof_addr.id)
    WHERE (
        lower(COALESCE(lt.status, '')) IN ('won', 'lost')
        OR lower(COALESCE(le.status, '')) = 'completed'
      )
      AND COALESCE(
        wp_paid.payout_ts,
        le.draw_executed_at,
        CASE WHEN le.draw_time IS NOT NULL AND le.status = 'completed' THEN to_timestamp(le.draw_time / 1000.0) END,
        lt.created_at
      ) >= v_cutoff
      AND COALESCE(
        wp_paid.payout_ts,
        le.draw_executed_at,
        CASE WHEN le.draw_time IS NOT NULL AND le.status = 'completed' THEN to_timestamp(le.draw_time / 1000.0) END,
        lt.created_at
      ) <= v_now
  ),
  settled_round_entries AS (
    SELECT
      COALESCE(gr.user_id, lw.user_id, prof_addr.id) AS resolved_user_id,
      NULLIF(trim(COALESCE(gr.wallet_address, '')), '') AS resolved_address,
      NULLIF(regexp_replace(trim(COALESCE(
        prof_id.username,
        prof_addr.username,
        CASE
          WHEN gr.username IS NOT NULL
            AND trim(gr.username) <> ''
            AND lower(trim(gr.username)) NOT IN ('player', 'anonymous', 'lucky winner', 'you')
            AND trim(gr.username) !~* '^0x[0-9a-f]{16,}$'
          THEN gr.username
          ELSE NULL
        END,
        ''
      )), '^@+', ''), '') AS resolved_username,
      ('rnd:' || gr.id) AS entry_ref,
      CASE
        WHEN COALESCE(gr.payout, 0) > 0 OR lower(COALESCE(gr.status, '')) IN ('won', 'win') THEN 1
        ELSE 0
      END AS is_win,
      CASE
        WHEN COALESCE(gr.payout, 0) > 0 THEN gr.payout::numeric
        ELSE 0::numeric
      END AS won_usdt,
      gr.created_at AS event_ts
    FROM public.game_rounds gr
    LEFT JOIN public.lottery_wallets lw ON lower(lw.address) = lower(COALESCE(gr.wallet_address, ''))
    LEFT JOIN public.profiles prof_addr ON prof_addr.trc20_address IS NOT NULL
      AND lower(prof_addr.trc20_address) = lower(COALESCE(gr.wallet_address, ''))
    LEFT JOIN public.profiles prof_id ON prof_id.id = COALESCE(gr.user_id, lw.user_id, prof_addr.id)
    WHERE gr.created_at >= v_cutoff
      AND gr.created_at <= v_now
      AND lower(COALESCE(gr.status, '')) <> 'pending'
  ),
  combined_events AS (
    SELECT resolved_user_id, resolved_address, resolved_username, entry_ref, 1 AS is_win, won_usdt, event_ts FROM raw_payout_wins
    UNION ALL
    SELECT resolved_user_id, resolved_address, resolved_username, entry_ref, 1 AS is_win, won_usdt, event_ts FROM direct_ticket_wins
    UNION ALL
    SELECT resolved_user_id, resolved_address, resolved_username, entry_ref, is_win, won_usdt, event_ts FROM settled_lottery_entries
    UNION ALL
    SELECT resolved_user_id, resolved_address, resolved_username, entry_ref, is_win, won_usdt, event_ts FROM settled_round_entries
  ),
  keyed_events AS (
    SELECT
      COALESCE(
        resolved_user_id::text,
        CASE WHEN resolved_address IS NOT NULL THEN 'addr:' || lower(resolved_address) END,
        CASE WHEN resolved_username IS NOT NULL THEN 'name:' || lower(resolved_username) END
      ) AS user_key,
      resolved_username,
      resolved_address,
      entry_ref,
      is_win,
      won_usdt,
      event_ts
    FROM combined_events
    WHERE COALESCE(resolved_user_id::text, resolved_address, resolved_username) IS NOT NULL
  ),
  deduped_entries AS (
    SELECT
      user_key,
      MAX(resolved_username) AS best_username,
      MAX(resolved_address) AS best_address,
      entry_ref,
      MAX(is_win) AS entry_won,
      SUM(won_usdt) AS entry_won_usdt,
      MIN(CASE WHEN is_win = 1 THEN event_ts END) AS win_ts
    FROM keyed_events
    GROUP BY user_key, entry_ref
  ),
  aggregated_users AS (
    SELECT
      user_key,
      COALESCE(
        NULLIF(MAX(best_username), ''),
        CASE
          WHEN MAX(best_address) IS NOT NULL AND length(MAX(best_address)) > 10
            THEN left(MAX(best_address), 6) || '...' || right(MAX(best_address), 4)
          ELSE COALESCE(MAX(best_address), 'Player')
        END
      ) AS username,
      COUNT(*)::integer AS total_entries,
      SUM(entry_won)::integer AS wins_count,
      ROUND(SUM(entry_won_usdt), 2) AS total_won_usdt,
      MIN(win_ts) AS first_win_at
    FROM deduped_entries
    GROUP BY user_key
    HAVING SUM(entry_won) > 0 AND SUM(entry_won_usdt) > 0
  ),
  scored_and_ranked AS (
    SELECT
      ROW_NUMBER() OVER (
        ORDER BY
          (wins_count::numeric / GREATEST(total_entries, 1)::numeric) DESC,
          total_won_usdt DESC,
          wins_count DESC,
          first_win_at ASC NULLS LAST,
          username ASC
      ) AS rank,
      username,
      total_won_usdt
    FROM aggregated_users
    LIMIT v_limit
  )
  SELECT jsonb_agg(
    jsonb_build_object(
      'rank', rank,
      'username', username,
      'total_won_usdt', total_won_usdt
    )
    ORDER BY rank ASC
  )
  INTO v_rows
  FROM scored_and_ranked;

  RETURN COALESCE(v_rows, '[]'::jsonb);
END;
$function$;

-- 4. Server-side Month-Bounded Leaderboard Top 10 Calculation & Finalization
CREATE OR REPLACE FUNCTION public.get_monthly_competition_top10(
  p_month_key text
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'auth', 'pg_temp'
AS $function$
DECLARE
  v_start timestamptz;
  v_end timestamptz;
  v_rows jsonb;
BEGIN
  IF p_month_key IS NULL OR p_month_key !~ '^\d{4}-(0[1-9]|1[0-2])$' THEN
    RETURN '[]'::jsonb;
  END IF;

  v_start := (to_date(p_month_key || '-01', 'YYYY-MM-DD')::timestamp AT TIME ZONE 'UTC');
  v_end := ((to_date(p_month_key || '-01', 'YYYY-MM-DD') + interval '1 month')::timestamp AT TIME ZONE 'UTC');

  WITH raw_payout_wins AS (
    SELECT
      COALESCE(wp.user_id, lt.user_id, lw.user_id, prof_addr.id) AS resolved_user_id,
      NULLIF(trim(COALESCE(prof_id.trc20_address, lw_id.address, wp.winner_address, lt.user_address, '')), '') AS resolved_address,
      NULLIF(regexp_replace(trim(COALESCE(
        prof_id.username,
        prof_addr.username,
        CASE
          WHEN lt.username IS NOT NULL
            AND trim(lt.username) <> ''
            AND lower(trim(lt.username)) NOT IN ('player', 'anonymous', 'lucky winner', 'you')
            AND trim(lt.username) !~* '^0x[0-9a-f]{16,}$'
          THEN lt.username
          ELSE NULL
        END,
        CASE
          WHEN wp.winner_username IS NOT NULL
            AND trim(wp.winner_username) <> ''
            AND lower(trim(wp.winner_username)) NOT IN ('player', 'anonymous', 'lucky winner', 'you')
            AND trim(wp.winner_username) !~* '^0x[0-9a-f]{16,}$'
          THEN wp.winner_username
          ELSE NULL
        END,
        ''
      )), '^@+', ''), '') AS resolved_username,
      ('lwin:' || COALESCE(NULLIF(NULLIF(trim(wp.ticket_id), ''), 'MANUAL'), wp.id)) AS entry_ref,
      NULLIF(NULLIF(trim(wp.ticket_id), ''), 'MANUAL') AS covered_ticket_id,
      COALESCE(wp.payout_amount, 0)::numeric AS won_usdt,
      COALESCE(wp.approved_at, wp.created_at) AS event_ts
    FROM public.winner_payouts wp
    LEFT JOIN public.lottery_tickets lt ON lt.id = wp.ticket_id
    LEFT JOIN public.lottery_wallets lw ON lower(lw.address) = lower(COALESCE(wp.winner_address, lt.user_address, ''))
    LEFT JOIN public.profiles prof_addr ON prof_addr.trc20_address IS NOT NULL
      AND lower(prof_addr.trc20_address) = lower(COALESCE(wp.winner_address, lt.user_address, ''))
    LEFT JOIN public.profiles prof_id ON prof_id.id = COALESCE(wp.user_id, lt.user_id, lw.user_id, prof_addr.id)
    LEFT JOIN LATERAL (
      SELECT lw2.address FROM public.lottery_wallets lw2
      WHERE lw2.user_id = COALESCE(wp.user_id, lt.user_id, lw.user_id, prof_addr.id)
      ORDER BY lw2.updated_at DESC LIMIT 1
    ) lw_id ON true
    WHERE COALESCE(wp.payout_type, 'lottery_win') = 'lottery_win'
      AND COALESCE(wp.is_deleted, false) = false
      AND lower(COALESCE(wp.status, '')) IN ('paid', 'approved', 'completed')
      AND COALESCE(wp.payout_amount, 0) > 0
      AND COALESCE(wp.approved_at, wp.created_at) >= v_start
      AND COALESCE(wp.approved_at, wp.created_at) < v_end
  ),
  direct_ticket_wins AS (
    SELECT
      COALESCE(lt.user_id, lw.user_id, prof_addr.id) AS resolved_user_id,
      NULLIF(trim(COALESCE(prof_id.trc20_address, lw_id.address, lt.user_address, '')), '') AS resolved_address,
      NULLIF(regexp_replace(trim(COALESCE(
        prof_id.username,
        prof_addr.username,
        CASE
          WHEN lt.username IS NOT NULL
            AND trim(lt.username) <> ''
            AND lower(trim(lt.username)) NOT IN ('player', 'anonymous', 'lucky winner', 'you')
            AND trim(lt.username) !~* '^0x[0-9a-f]{16,}$'
          THEN lt.username
          ELSE NULL
        END,
        ''
      )), '^@+', ''), '') AS resolved_username,
      ('lwin:' || lt.id) AS entry_ref,
      COALESCE(lt.won_amount, 0)::numeric AS won_usdt,
      COALESCE(
        le.draw_executed_at,
        CASE WHEN le.draw_time IS NOT NULL AND le.status = 'completed' THEN to_timestamp(le.draw_time / 1000.0) END,
        lt.created_at
      ) AS event_ts
    FROM public.lottery_tickets lt
    LEFT JOIN public.lottery_events le ON le.id = lt.event_id
    LEFT JOIN public.lottery_wallets lw ON lower(lw.address) = lower(COALESCE(lt.user_address, ''))
    LEFT JOIN public.profiles prof_addr ON prof_addr.trc20_address IS NOT NULL
      AND lower(prof_addr.trc20_address) = lower(COALESCE(lt.user_address, ''))
    LEFT JOIN public.profiles prof_id ON prof_id.id = COALESCE(lt.user_id, lw.user_id, prof_addr.id)
    LEFT JOIN LATERAL (
      SELECT lw2.address FROM public.lottery_wallets lw2
      WHERE lw2.user_id = COALESCE(lt.user_id, lw.user_id, prof_addr.id)
      ORDER BY lw2.updated_at DESC LIMIT 1
    ) lw_id ON true
    WHERE lower(COALESCE(lt.status, '')) = 'won'
      AND COALESCE(lt.won_amount, 0) > 0
      AND NOT EXISTS (SELECT 1 FROM raw_payout_wins pw WHERE pw.covered_ticket_id = lt.id)
      AND COALESCE(
        le.draw_executed_at,
        CASE WHEN le.draw_time IS NOT NULL AND le.status = 'completed' THEN to_timestamp(le.draw_time / 1000.0) END,
        lt.created_at
      ) >= v_start
      AND COALESCE(
        le.draw_executed_at,
        CASE WHEN le.draw_time IS NOT NULL AND le.status = 'completed' THEN to_timestamp(le.draw_time / 1000.0) END,
        lt.created_at
      ) < v_end
  ),
  settled_lottery_entries AS (
    SELECT
      COALESCE(lt.user_id, lw.user_id, prof_addr.id) AS resolved_user_id,
      NULLIF(trim(COALESCE(prof_id.trc20_address, lw_id.address, lt.user_address, '')), '') AS resolved_address,
      NULLIF(regexp_replace(trim(COALESCE(
        prof_id.username,
        prof_addr.username,
        CASE
          WHEN lt.username IS NOT NULL
            AND trim(lt.username) <> ''
            AND lower(trim(lt.username)) NOT IN ('player', 'anonymous', 'lucky winner', 'you')
            AND trim(lt.username) !~* '^0x[0-9a-f]{16,}$'
          THEN lt.username
          ELSE NULL
        END,
        ''
      )), '^@+', ''), '') AS resolved_username,
      ('lwin:' || lt.id) AS entry_ref,
      CASE WHEN lower(COALESCE(lt.status, '')) = 'won' THEN 1 ELSE 0 END AS is_win,
      0::numeric AS won_usdt,
      COALESCE(
        wp_paid.payout_ts,
        le.draw_executed_at,
        CASE WHEN le.draw_time IS NOT NULL AND le.status = 'completed' THEN to_timestamp(le.draw_time / 1000.0) END,
        lt.created_at
      ) AS event_ts
    FROM public.lottery_tickets lt
    LEFT JOIN public.lottery_events le ON le.id = lt.event_id
    LEFT JOIN LATERAL (
      SELECT MAX(COALESCE(wp.approved_at, wp.created_at)) AS payout_ts
      FROM public.winner_payouts wp
      WHERE wp.ticket_id = lt.id
        AND COALESCE(wp.payout_type, 'lottery_win') = 'lottery_win'
        AND COALESCE(wp.is_deleted, false) = false
        AND lower(COALESCE(wp.status, '')) IN ('paid', 'approved', 'completed')
    ) wp_paid ON true
    LEFT JOIN public.lottery_wallets lw ON lower(lw.address) = lower(COALESCE(lt.user_address, ''))
    LEFT JOIN public.profiles prof_addr ON prof_addr.trc20_address IS NOT NULL
      AND lower(prof_addr.trc20_address) = lower(COALESCE(lt.user_address, ''))
    LEFT JOIN public.profiles prof_id ON prof_id.id = COALESCE(lt.user_id, lw.user_id, prof_addr.id)
    LEFT JOIN LATERAL (
      SELECT lw2.address FROM public.lottery_wallets lw2
      WHERE lw2.user_id = COALESCE(lt.user_id, lw.user_id, prof_addr.id)
      ORDER BY lw2.updated_at DESC LIMIT 1
    ) lw_id ON true
    WHERE (lower(COALESCE(lt.status, '')) IN ('won', 'lost') OR lower(COALESCE(le.status, '')) = 'completed')
      AND COALESCE(
        wp_paid.payout_ts,
        le.draw_executed_at,
        CASE WHEN le.draw_time IS NOT NULL AND le.status = 'completed' THEN to_timestamp(le.draw_time / 1000.0) END,
        lt.created_at
      ) >= v_start
      AND COALESCE(
        wp_paid.payout_ts,
        le.draw_executed_at,
        CASE WHEN le.draw_time IS NOT NULL AND le.status = 'completed' THEN to_timestamp(le.draw_time / 1000.0) END,
        lt.created_at
      ) < v_end
  ),
  settled_round_entries AS (
    SELECT
      COALESCE(gr.user_id, lw.user_id, prof_addr.id) AS resolved_user_id,
      NULLIF(trim(COALESCE(prof_id.trc20_address, lw_id.address, gr.wallet_address, '')), '') AS resolved_address,
      NULLIF(regexp_replace(trim(COALESCE(
        prof_id.username,
        prof_addr.username,
        CASE
          WHEN gr.username IS NOT NULL
            AND trim(gr.username) <> ''
            AND lower(trim(gr.username)) NOT IN ('player', 'anonymous', 'lucky winner', 'you')
            AND trim(gr.username) !~* '^0x[0-9a-f]{16,}$'
          THEN gr.username
          ELSE NULL
        END,
        ''
      )), '^@+', ''), '') AS resolved_username,
      ('rnd:' || gr.id) AS entry_ref,
      CASE WHEN COALESCE(gr.payout, 0) > 0 OR lower(COALESCE(gr.status, '')) IN ('won', 'win') THEN 1 ELSE 0 END AS is_win,
      CASE WHEN COALESCE(gr.payout, 0) > 0 THEN gr.payout::numeric ELSE 0::numeric END AS won_usdt,
      gr.created_at AS event_ts
    FROM public.game_rounds gr
    LEFT JOIN public.lottery_wallets lw ON lower(lw.address) = lower(COALESCE(gr.wallet_address, ''))
    LEFT JOIN public.profiles prof_addr ON prof_addr.trc20_address IS NOT NULL
      AND lower(prof_addr.trc20_address) = lower(COALESCE(gr.wallet_address, ''))
    LEFT JOIN public.profiles prof_id ON prof_id.id = COALESCE(gr.user_id, lw.user_id, prof_addr.id)
    LEFT JOIN LATERAL (
      SELECT lw2.address FROM public.lottery_wallets lw2
      WHERE lw2.user_id = COALESCE(gr.user_id, lw.user_id, prof_addr.id)
      ORDER BY lw2.updated_at DESC LIMIT 1
    ) lw_id ON true
    WHERE gr.created_at >= v_start
      AND gr.created_at < v_end
      AND lower(COALESCE(gr.status, '')) <> 'pending'
  ),
  combined_events AS (
    SELECT resolved_user_id, resolved_address, resolved_username, entry_ref, 1 AS is_win, won_usdt, event_ts FROM raw_payout_wins
    UNION ALL
    SELECT resolved_user_id, resolved_address, resolved_username, entry_ref, 1 AS is_win, won_usdt, event_ts FROM direct_ticket_wins
    UNION ALL
    SELECT resolved_user_id, resolved_address, resolved_username, entry_ref, is_win, won_usdt, event_ts FROM settled_lottery_entries
    UNION ALL
    SELECT resolved_user_id, resolved_address, resolved_username, entry_ref, is_win, won_usdt, event_ts FROM settled_round_entries
  ),
  keyed_events AS (
    SELECT
      COALESCE(
        resolved_user_id::text,
        CASE WHEN resolved_address IS NOT NULL THEN 'addr:' || lower(resolved_address) END,
        CASE WHEN resolved_username IS NOT NULL THEN 'name:' || lower(resolved_username) END
      ) AS user_key,
      resolved_user_id,
      resolved_address,
      resolved_username,
      entry_ref,
      is_win,
      won_usdt,
      event_ts
    FROM combined_events
    WHERE COALESCE(resolved_user_id::text, resolved_address, resolved_username) IS NOT NULL
  ),
  deduped_entries AS (
    SELECT
      user_key,
      MAX(resolved_user_id::text)::uuid AS best_user_id,
      MAX(resolved_username) AS best_username,
      MAX(resolved_address) AS best_address,
      entry_ref,
      MAX(is_win) AS entry_won,
      SUM(won_usdt) AS entry_won_usdt,
      MIN(CASE WHEN is_win = 1 THEN event_ts END) AS win_ts
    FROM keyed_events
    GROUP BY user_key, entry_ref
  ),
  aggregated_users AS (
    SELECT
      user_key,
      MAX(best_user_id::text)::uuid AS user_id,
      COALESCE(
        NULLIF(MAX(best_username), ''),
        CASE
          WHEN MAX(best_address) IS NOT NULL AND length(MAX(best_address)) > 10
            THEN left(MAX(best_address), 6) || '...' || right(MAX(best_address), 4)
          ELSE COALESCE(MAX(best_address), 'Player')
        END
      ) AS username,
      MAX(best_address) AS wallet_address,
      COUNT(*)::integer AS total_entries,
      SUM(entry_won)::integer AS wins_count,
      ROUND(SUM(entry_won_usdt), 2) AS total_won_usdt,
      MIN(win_ts) AS first_win_at
    FROM deduped_entries
    GROUP BY user_key
    HAVING SUM(entry_won) > 0 AND SUM(entry_won_usdt) > 0
  ),
  ranked AS (
    SELECT
      ROW_NUMBER() OVER (
        ORDER BY
          (wins_count::numeric / GREATEST(total_entries, 1)::numeric) DESC,
          total_won_usdt DESC,
          wins_count DESC,
          first_win_at ASC NULLS LAST,
          username ASC
      )::integer AS rank,
      user_id,
      username,
      wallet_address,
      total_won_usdt
    FROM aggregated_users
    LIMIT 10
  )
  SELECT jsonb_agg(
    jsonb_build_object(
      'rank', rank,
      'user_id', user_id,
      'username', username,
      'wallet_address', wallet_address,
      'total_won_usdt', total_won_usdt
    )
    ORDER BY rank ASC
  )
  INTO v_rows
  FROM ranked;

  RETURN COALESCE(v_rows, '[]'::jsonb);
END;
$function$;

REVOKE ALL ON FUNCTION public.get_monthly_competition_top10(text) FROM PUBLIC, anon, authenticated;

-- Update user-facing announcement RPC to include current competition month standings (Rank, Username, Reward)
CREATE OR REPLACE FUNCTION public.get_published_monthly_leaderboard_announcement()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'auth', 'pg_temp'
AS $function$
DECLARE
  v_val jsonb;
  v_month_key text;
  v_top10 jsonb := '[]'::jsonb;
  v_config jsonb;
  v_finalized boolean := false;
  v_rows jsonb := '[]'::jsonb;
  v_rank integer;
  v_prize numeric;
  v_winner jsonb;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('is_published', false);
  END IF;

  SELECT value INTO v_val
  FROM public.platform_settings
  WHERE key = 'monthly_leaderboard_published';

  IF v_val IS NULL OR COALESCE((v_val->>'is_published')::boolean, false) IS NOT TRUE THEN
    RETURN jsonb_build_object('is_published', false);
  END IF;

  v_month_key := COALESCE(v_val->>'month_key', to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM'));
  SELECT value INTO v_config FROM public.platform_settings WHERE key = 'monthly_leaderboard_config';
  v_finalized := COALESCE((v_config->'months'->v_month_key->>'finalized')::boolean, false);

  v_top10 := public.get_monthly_competition_top10(v_month_key);

  FOR v_rank IN 1..10 LOOP
    SELECT ROUND(COALESCE((elem->>'reward_usdt')::numeric, 0), 2)
    INTO v_prize
    FROM jsonb_array_elements(COALESCE(v_val->'prizes', '[]'::jsonb)) AS elem
    WHERE COALESCE((elem->>'rank')::integer, 0) = v_rank
    LIMIT 1;

    SELECT elem
    INTO v_winner
    FROM jsonb_array_elements(COALESCE(v_top10, '[]'::jsonb)) AS elem
    WHERE COALESCE((elem->>'rank')::integer, 0) = v_rank
    LIMIT 1;

    v_rows := v_rows || jsonb_build_object(
      'rank', v_rank,
      'username', v_winner->>'username',
      'reward_usdt', COALESCE(v_prize, 0)
    );
  END LOOP;

  RETURN v_val || jsonb_build_object(
    'finalized', v_finalized,
    'standings', v_rows
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.get_published_monthly_leaderboard_announcement() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_published_monthly_leaderboard_announcement() TO authenticated;

-- 5. Monthly Competition Finalization RPC (Creates individual pending_approval payout records)
CREATE OR REPLACE FUNCTION public.finalize_monthly_leaderboard_competition(
  p_month_key text DEFAULT NULL::text,
  p_force boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth', 'pg_temp'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_is_privileged_cron boolean := (
    current_setting('role', true) = 'service_role'
    OR (current_setting('request.jwt.claims', true) IS NULL AND session_user IN ('postgres', 'supabase_admin'))
  );
  v_month text;
  v_end timestamptz;
  v_month_label text;
  v_config jsonb;
  v_months jsonb;
  v_month_cfg jsonb;
  v_published jsonb;
  v_prizes jsonb;
  v_top10 jsonb;
  v_item jsonb;
  v_rank integer;
  v_user_id uuid;
  v_username text;
  v_wallet_addr text;
  v_reward_amt numeric;
  v_payout_id text;
  v_payout_ref text;
  v_created_count integer := 0;
  v_skipped_count integer := 0;
  v_now timestamptz := now();
BEGIN
  IF NOT v_is_privileged_cron AND NOT public.is_super_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized: Super Admin privileges required.');
  END IF;

  IF p_month_key IS NULL OR trim(p_month_key) = '' THEN
    v_month := to_char(((date_trunc('month', now() AT TIME ZONE 'UTC') - interval '1 day')::date), 'YYYY-MM');
  ELSE
    v_month := trim(p_month_key);
  END IF;

  IF v_month !~ '^\d{4}-(0[1-9]|1[0-2])$' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid month format. Expected YYYY-MM.');
  END IF;

  v_end := ((to_date(v_month || '-01', 'YYYY-MM-DD') + interval '1 month')::timestamp AT TIME ZONE 'UTC');
  v_month_label := trim(to_char(to_date(v_month || '-01', 'YYYY-MM-DD'), 'FMMonth YYYY'));

  IF v_now < v_end AND NOT COALESCE(p_force, false) THEN
    RETURN jsonb_build_object(
      'success', false,
      'month_key', v_month,
      'error', 'Competition month ' || v_month_label || ' has not ended yet. Scheduled finalization runs after ' || to_char(v_end AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI"Z"') || '.'
    );
  END IF;

  IF COALESCE(p_force, false) AND NOT v_is_privileged_cron AND NOT public.is_super_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only Super Admin can manually finalize early.');
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('lb_finalize:' || v_month));

  SELECT value INTO v_config FROM public.platform_settings WHERE key = 'monthly_leaderboard_config';
  SELECT value INTO v_published FROM public.platform_settings WHERE key = 'monthly_leaderboard_published';
  v_config := COALESCE(v_config, '{}'::jsonb);
  v_months := COALESCE(v_config->'months', '{}'::jsonb);
  v_month_cfg := v_months->v_month;

  IF v_month_cfg IS NULL AND v_published IS NOT NULL AND COALESCE(v_published->>'month_key', '') = v_month THEN
    v_month_cfg := v_published;
  END IF;

  IF v_month_cfg IS NULL THEN
    RETURN jsonb_build_object('success', false, 'month_key', v_month, 'error', 'No Super Admin prize configuration saved for ' || v_month_label || '.');
  END IF;

  v_prizes := COALESCE(v_month_cfg->'prizes', '[]'::jsonb);
  v_top10 := public.get_monthly_competition_top10(v_month);

  FOR v_item IN SELECT * FROM jsonb_array_elements(v_top10) LOOP
    v_rank := COALESCE((v_item->>'rank')::integer, 0);
    v_user_id := NULLIF(v_item->>'user_id', '')::uuid;
    v_username := COALESCE(NULLIF(v_item->>'username', ''), 'Player');
    v_wallet_addr := NULLIF(trim(COALESCE(v_item->>'wallet_address', '')), '');

    IF v_wallet_addr IS NULL AND v_user_id IS NOT NULL THEN
      SELECT COALESCE(
        NULLIF(trim(p.trc20_address), ''),
        (SELECT lw.address FROM public.lottery_wallets lw WHERE lw.user_id = v_user_id ORDER BY lw.updated_at DESC LIMIT 1)
      )
      INTO v_wallet_addr
      FROM public.profiles p
      WHERE p.id = v_user_id;
    END IF;

    SELECT ROUND(COALESCE((elem->>'reward_usdt')::numeric, (elem->>'amount')::numeric, 0), 2)
    INTO v_reward_amt
    FROM jsonb_array_elements(v_prizes) AS elem
    WHERE COALESCE((elem->>'rank')::integer, 0) = v_rank
    LIMIT 1;

    IF v_rank BETWEEN 1 AND 10
       AND v_user_id IS NOT NULL
       AND v_wallet_addr IS NOT NULL
       AND COALESCE(v_reward_amt, 0) > 0 THEN

      v_payout_ref := 'lb-' || v_month || '-rank-' || v_rank || '-' || v_user_id::text;
      v_payout_id := 'WP-LB-' || replace(v_month, '-', '') || '-R' || v_rank;

      IF NOT EXISTS (
        SELECT 1 FROM public.winner_payouts wp
        WHERE (
          wp.payout_reference = v_payout_ref
          OR (
            wp.payout_type = 'monthly_leaderboard'
            AND wp.competition_month = v_month
            AND (wp.user_id = v_user_id OR wp.leaderboard_rank = v_rank)
            AND COALESCE(wp.is_deleted, false) = false
            AND wp.status NOT IN ('cancelled', 'rejected')
          )
        )
      ) THEN
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
          max_allowed_amount,
          status,
          position,
          currency,
          payout_type,
          competition_month,
          leaderboard_rank,
          payout_reference,
          notes,
          created_at
        ) VALUES (
          v_payout_id,
          'leaderboard-' || v_month,
          v_month_label || ' Monthly Leaderboard',
          'RANK-' || v_rank,
          v_user_id,
          v_wallet_addr,
          v_username,
          'RANK #' || v_rank,
          0,
          0,
          v_reward_amt,
          100,
          v_reward_amt,
          v_reward_amt,
          v_reward_amt,
          'pending_approval',
          v_rank,
          'USDT',
          'monthly_leaderboard',
          v_month,
          v_rank,
          v_payout_ref,
          'Auto-generated for ' || v_month_label || ' Rank #' || v_rank,
          v_now
        )
        ON CONFLICT DO NOTHING;

        IF FOUND THEN
          v_created_count := v_created_count + 1;
        ELSE
          v_skipped_count := v_skipped_count + 1;
        END IF;
      ELSE
        v_skipped_count := v_skipped_count + 1;
      END IF;
    ELSE
      v_skipped_count := v_skipped_count + 1;
    END IF;
  END LOOP;

  -- Mark month finalized in config
  v_month_cfg := v_month_cfg || jsonb_build_object(
    'finalized', true,
    'finalized_at', v_now,
    'finalized_winners_count', v_created_count
  );
  v_months := v_months || jsonb_build_object(v_month, v_month_cfg);
  v_config := v_config || jsonb_build_object('months', v_months, 'updated_at', v_now);

  INSERT INTO public.platform_settings (key, value, updated_at)
  VALUES ('monthly_leaderboard_config', v_config, v_now)
  ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = v_now;

  INSERT INTO public.admin_audit_logs (admin_id, action_type, target_type, target_id, changes)
  VALUES (
    v_uid,
    'FINALIZE_MONTHLY_LEADERBOARD',
    'monthly_leaderboard',
    v_month,
    jsonb_build_object(
      'month_key', v_month,
      'created_payouts', v_created_count,
      'skipped_or_existing', v_skipped_count,
      'forced', COALESCE(p_force, false)
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'month_key', v_month,
    'month_label', v_month_label,
    'created_count', v_created_count,
    'skipped_count', v_skipped_count
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.finalize_monthly_leaderboard_competition(text, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.finalize_monthly_leaderboard_competition(text, boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.auto_finalize_elapsed_monthly_competitions()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth', 'pg_temp'
AS $function$
DECLARE
  v_config jsonb;
  v_published jsonb;
  v_current_month text := to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM');
  v_mkey text;
  v_res jsonb;
  v_processed jsonb := '[]'::jsonb;
  v_candidate_months text[] := ARRAY[]::text[];
BEGIN
  SELECT value INTO v_config FROM public.platform_settings WHERE key = 'monthly_leaderboard_config';
  SELECT value INTO v_published FROM public.platform_settings WHERE key = 'monthly_leaderboard_published';

  IF v_config->'months' IS NOT NULL THEN
    FOR v_mkey IN SELECT key FROM jsonb_object_keys(v_config->'months') AS key LOOP
      IF v_mkey ~ '^\d{4}-(0[1-9]|1[0-2])$'
         AND v_mkey < v_current_month
         AND COALESCE((v_config->'months'->v_mkey->>'finalized')::boolean, false) IS NOT TRUE THEN
        v_candidate_months := array_append(v_candidate_months, v_mkey);
      END IF;
    END LOOP;
  END IF;

  IF v_published IS NOT NULL
     AND COALESCE(v_published->>'month_key', '') ~ '^\d{4}-(0[1-9]|1[0-2])$'
     AND (v_published->>'month_key') < v_current_month
     AND NOT ((v_published->>'month_key') = ANY(v_candidate_months))
     AND COALESCE((v_config->'months'->(v_published->>'month_key')->>'finalized')::boolean, false) IS NOT TRUE THEN
    v_candidate_months := array_append(v_candidate_months, v_published->>'month_key');
  END IF;

  FOREACH v_mkey IN ARRAY v_candidate_months LOOP
    v_res := public.finalize_monthly_leaderboard_competition(v_mkey, false);
    v_processed := v_processed || jsonb_build_object('month_key', v_mkey, 'result', v_res);
  END LOOP;

  RETURN jsonb_build_object('success', true, 'checked_before', v_current_month, 'processed', v_processed);
END;
$function$;

REVOKE ALL ON FUNCTION public.auto_finalize_elapsed_monthly_competitions() FROM PUBLIC, anon, authenticated;

-- Register hourly pg_cron auto-finalization job safely (idempotent)
DO $$
DECLARE
  v_existing_job_id bigint;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    SELECT jobid INTO v_existing_job_id FROM cron.job WHERE jobname = 'monthly-leaderboard-auto-finalize' LIMIT 1;
    IF v_existing_job_id IS NOT NULL THEN
      PERFORM cron.unschedule(v_existing_job_id);
    END IF;
    PERFORM cron.schedule(
      'monthly-leaderboard-auto-finalize',
      '5 * * * *',
      'SELECT public.auto_finalize_elapsed_monthly_competitions();'
    );
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'pg_cron scheduling note: %', SQLERRM;
END;
$$;

-- 6. Fix finalize_lottery_draw_secure:
--    - Authoritative ticket sales & revenue count directly from lottery_tickets
--    - Zero-ticket events have 0 pool & cannot yield fabricated payouts
--    - Updates ticket won_amount properly & queues pending_approval payouts with user_id & username
CREATE OR REPLACE FUNCTION public.finalize_lottery_draw_secure(
  p_event_id text,
  p_winning_codes jsonb DEFAULT '[]'::jsonb,
  p_draw_mode text DEFAULT 'random'::text,
  p_custom_winner_count integer DEFAULT 1,
  p_custom_digits text DEFAULT NULL::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth', 'pg_temp'
AS $function$
DECLARE
    v_event record;
    v_actual_tickets_sold integer := 0;
    v_actual_collected numeric := 0;
    v_gross_pool numeric := 0;
    v_share_percent numeric;
    v_distributable_pool numeric := 0;
    v_distribution jsonb;
    v_winning_mode text;
    v_currency text := 'USDT';
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
    i integer;
    v_temp_num integer;
    v_temp_code text;
BEGIN
    IF NOT public.is_admin() THEN
        RETURN jsonb_build_object('success', false, 'error', 'Unauthorized: Admin privileges required.');
    END IF;

    SELECT * INTO v_event FROM public.lottery_events WHERE id = p_event_id FOR UPDATE;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Event not found: ' || p_event_id);
    END IF;

    IF v_event.status = 'completed' THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Event already finalized',
            'winning_digits', v_event.winning_digits,
            'winning_codes', v_event.winning_codes
        );
    END IF;

    v_currency := 'USDT';
    v_winning_mode := COALESCE(v_event.winner_mode, 'single');
    v_distribution := COALESCE(v_event.winner_distribution, '[{"position": 1, "percent": 100}]'::jsonb);
    v_share_percent := COALESCE(v_event.winner_payout_share_percent, 90.0);

    -- Verify actual ticket sales directly from lottery_tickets
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
        -- Zero eligible ticket sales => pool must remain 0 USDT (no fake payouts)
        v_gross_pool := 0;
    END IF;

    v_distributable_pool := ROUND((v_gross_pool * v_share_percent) / 100.0, 2);

    -- Determine winning codes
    IF p_winning_codes IS NOT NULL AND jsonb_typeof(p_winning_codes) = 'array' AND jsonb_array_length(p_winning_codes) > 0 THEN
        FOR i IN 0..(jsonb_array_length(p_winning_codes) - 1) LOOP
            v_temp_code := lpad(regexp_replace(COALESCE(p_winning_codes->>i, ''), '\D', '', 'g'), 4, '0');
            IF length(v_temp_code) = 4 AND NOT (v_temp_code = ANY(v_codes_array)) THEN
                v_codes_array := array_append(v_codes_array, v_temp_code);
            END IF;
        END LOOP;
    ELSIF p_custom_digits IS NOT NULL AND length(regexp_replace(p_custom_digits, '\D', '', 'g')) > 0 THEN
        v_codes_array := ARRAY[lpad(regexp_replace(p_custom_digits, '\D', '', 'g'), 4, '0')];
    ELSIF v_event.winning_codes IS NOT NULL AND jsonb_typeof(v_event.winning_codes) = 'array' AND jsonb_array_length(v_event.winning_codes) > 0 THEN
        FOR i IN 0..(jsonb_array_length(v_event.winning_codes) - 1) LOOP
            v_temp_code := lpad(regexp_replace(COALESCE(v_event.winning_codes->>i, ''), '\D', '', 'g'), 4, '0');
            IF length(v_temp_code) = 4 AND NOT (v_temp_code = ANY(v_codes_array)) THEN
                v_codes_array := array_append(v_codes_array, v_temp_code);
            END IF;
        END LOOP;
    ELSIF v_event.preset_winning_digits IS NOT NULL AND length(regexp_replace(v_event.preset_winning_digits, '\D', '', 'g')) > 0 THEN
        v_codes_array := ARRAY[lpad(regexp_replace(v_event.preset_winning_digits, '\D', '', 'g'), 4, '0')];
    END IF;

    v_code_count := CASE
        WHEN v_winning_mode = 'single' THEN 1
        ELSE GREATEST(2, COALESCE(v_event.winning_code_count, v_event.winner_count, p_custom_winner_count, 3))
    END;

    WHILE array_length(v_codes_array, 1) IS NULL OR array_length(v_codes_array, 1) < v_code_count LOOP
        v_temp_num := floor(random() * 10000)::integer;
        v_temp_code := lpad(v_temp_num::text, 4, '0');
        IF NOT (v_temp_code = ANY(v_codes_array)) THEN
            v_codes_array := array_append(v_codes_array, v_temp_code);
        END IF;
    END LOOP;

    v_primary_digits := v_codes_array[1];

    -- Evaluate winning tickets per position & queue pending_approval payout records
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
                    max_allowed_amount,
                    status,
                    position,
                    currency,
                    payout_type,
                    payout_reference,
                    notes,
                    created_at
                ) VALUES (
                    v_payout_id,
                    p_event_id,
                    v_event.title,
                    v_matching_tkt.id,
                    v_resolved_uid,
                    COALESCE(v_matching_tkt.user_address, ''),
                    v_resolved_username,
                    v_curr_code,
                    v_actual_tickets_sold,
                    COALESCE(v_event.ticket_price, 0),
                    v_gross_pool,
                    ROUND((v_share_percent * v_pos_share_percent) / 100.0, 2),
                    v_payout_per_ticket,
                    v_payout_per_ticket,
                    GREATEST(v_pos_pool, v_payout_per_ticket),
                    'pending_approval',
                    i,
                    'USDT',
                    'lottery_win',
                    v_payout_ref,
                    CASE WHEN v_pos_match_count > 1 THEN 'Tie-split across ' || v_pos_match_count || ' matching tickets' ELSE NULL END,
                    now()
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

    -- Mark losing active tickets
    UPDATE public.lottery_tickets
    SET status = 'lost',
        match_tier = 'NO MATCH',
        won_amount = 0
    WHERE event_id = p_event_id AND status = 'active';

    -- Mark event completed and synchronize actual tickets_sold count
    UPDATE public.lottery_events
    SET status = 'completed',
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
        draw_executed_at = now()
    WHERE id = p_event_id;

    INSERT INTO public.admin_audit_logs (
        admin_id, action_type, target_type, target_id, changes
    ) VALUES (
        auth.uid(),
        'FINALIZE_LOTTERY_DRAW',
        'lottery_events',
        p_event_id,
        jsonb_build_object(
            'winning_codes', to_jsonb(v_codes_array),
            'tickets_sold', v_actual_tickets_sold,
            'gross_pool', v_gross_pool,
            'total_winners', COALESCE(array_length(v_all_winning_tkt_ids, 1), 0),
            'total_allocated', v_total_allocated,
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
        'currency', 'USDT'
    );
END;
$function$;

REVOKE ALL ON FUNCTION public.finalize_lottery_draw_secure(text, jsonb, text, integer, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.finalize_lottery_draw_secure(text, jsonb, text, integer, text) TO authenticated;

-- 7. Atomic, Safe Admin/Super-Admin Payout Approval & Credit RPC
--    Supports both 4-digit lottery payouts and Monthly Leaderboard rewards separately
DROP FUNCTION IF EXISTS public.admin_disburse_winner_secure(text, numeric, text);
DROP FUNCTION IF EXISTS public.admin_disburse_winner_secure(text, numeric, text, text);

CREATE OR REPLACE FUNCTION public.admin_disburse_winner_secure(
  p_payout_id text,
  p_final_amount numeric DEFAULT NULL::numeric,
  p_tx_hash text DEFAULT NULL::text,
  p_adjustment_reason text DEFAULT NULL::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth', 'pg_temp'
AS $function$
DECLARE
  v_admin_uid uuid := auth.uid();
  v_payout record;
  v_amount numeric;
  v_target_uid uuid;
  v_target_address text;
  v_wallet_owner uuid;
  v_event_actual_tickets integer := 0;
  v_event_actual_rev numeric := 0;
  v_hash text;
  v_payout_ref text;
  v_ledger_type text;
  v_ledger_desc text;
  v_month_label text;
  v_credit_res jsonb;
  v_now timestamptz := now();
BEGIN
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized: Admin privileges required.');
  END IF;

  SELECT * INTO v_payout
  FROM public.winner_payouts
  WHERE id = p_payout_id
    AND COALESCE(is_deleted, false) = false
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Payout record not found or was removed.');
  END IF;

  -- Separate stricter governance: Monthly Leaderboard rewards require Super Admin
  IF v_payout.payout_type = 'monthly_leaderboard' AND NOT public.is_super_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized: Only Super Admin can approve Monthly Leaderboard rewards.');
  END IF;

  IF v_payout.status IN ('completed', 'paid') THEN
    RETURN jsonb_build_object(
      'success', false,
      'already_completed', true,
      'error', 'This payout has already been completed and cannot be credited twice.'
    );
  END IF;

  IF v_payout.status IN ('cancelled', 'rejected') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cancelled payouts cannot be approved.');
  END IF;

  v_amount := ROUND(COALESCE(p_final_amount, v_payout.payout_amount), 2);
  IF v_amount IS NULL OR v_amount <= 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Disbursal amount must be greater than 0.00 USDT. Records with 0 sales or 0 USDT cannot be approved.'
    );
  END IF;

  -- Enforce authorized pool / rank reward cap when adjusting manually
  IF v_payout.max_allowed_amount IS NOT NULL AND v_payout.max_allowed_amount > 0 AND v_amount > v_payout.max_allowed_amount THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Adjusted amount (' || to_char(v_amount, 'FM999999990.00') || ' USDT) exceeds the authorized pool cap (' || to_char(v_payout.max_allowed_amount, 'FM999999990.00') || ' USDT).'
    );
  END IF;

  -- For Four-Digit Lottery payouts tied to an event, verify actual eligible ticket sales exist
  IF v_payout.payout_type = 'lottery_win'
     AND v_payout.event_id IS NOT NULL
     AND v_payout.event_id <> 'manual-reward'
     AND EXISTS (SELECT 1 FROM public.lottery_events le WHERE le.id = v_payout.event_id) THEN
    SELECT COUNT(*)::integer, COALESCE(SUM(COALESCE(price, 0)), 0)::numeric
    INTO v_event_actual_tickets, v_event_actual_rev
    FROM public.lottery_tickets
    WHERE event_id = v_payout.event_id
      AND COALESCE(status, 'active') <> 'refunded';

    IF COALESCE(v_event_actual_tickets, 0) <= 0 OR COALESCE(v_event_actual_rev, 0) <= 0 THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'Cannot approve lottery payout: underlying event has 0 eligible ticket sales in database.'
      );
    END IF;
  END IF;

  -- Resolve & verify winner user + wallet ownership
  v_target_address := NULLIF(trim(COALESCE(v_payout.winner_address, '')), '');
  v_target_uid := COALESCE(
    v_payout.user_id,
    (SELECT lt.user_id FROM public.lottery_tickets lt WHERE lt.id = v_payout.ticket_id LIMIT 1),
    (SELECT lw.user_id FROM public.lottery_wallets lw WHERE v_target_address IS NOT NULL AND lower(lw.address) = lower(v_target_address) LIMIT 1),
    (SELECT pr.id FROM public.profiles pr WHERE v_target_address IS NOT NULL AND pr.trc20_address IS NOT NULL AND lower(pr.trc20_address) = lower(v_target_address) LIMIT 1)
  );

  IF v_target_uid IS NULL AND v_target_address IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Winner user identity and wallet address could not be verified.');
  END IF;

  IF v_target_uid IS NOT NULL AND v_target_address IS NOT NULL THEN
    SELECT lw.user_id INTO v_wallet_owner
    FROM public.lottery_wallets lw
    WHERE lower(lw.address) = lower(v_target_address)
    LIMIT 1;

    IF v_wallet_owner IS NOT NULL AND v_wallet_owner <> v_target_uid THEN
      RETURN jsonb_build_object('success', false, 'error', 'Security verification failed: wallet address does not match the winning user.');
    END IF;
  END IF;

  IF v_target_address IS NULL AND v_target_uid IS NOT NULL THEN
    SELECT COALESCE(
      NULLIF(trim(p.trc20_address), ''),
      (SELECT lw.address FROM public.lottery_wallets lw WHERE lw.user_id = v_target_uid ORDER BY lw.updated_at DESC LIMIT 1)
    )
    INTO v_target_address
    FROM public.profiles p
    WHERE p.id = v_target_uid;
  END IF;

  v_payout_ref := COALESCE(NULLIF(trim(COALESCE(v_payout.payout_reference, '')), ''), v_payout.id);
  v_hash := COALESCE(NULLIF(trim(COALESCE(p_tx_hash, '')), ''), 'TX-' || upper(substr(md5(v_payout_ref || v_now::text), 1, 24)));

  -- Separate business logic, ledger transaction_type, and descriptions cleanly
  IF v_payout.payout_type = 'monthly_leaderboard' THEN
    v_ledger_type := 'monthly_leaderboard_reward';
    IF v_payout.competition_month ~ '^\d{4}-(0[1-9]|1[0-2])$' THEN
      v_month_label := trim(to_char(to_date(v_payout.competition_month || '-01', 'YYYY-MM-DD'), 'FMMonth YYYY'));
      v_ledger_desc := 'Monthly Leaderboard Reward – Rank #' || COALESCE(v_payout.leaderboard_rank, v_payout.position, 1) || ' (' || v_month_label || ')';
    ELSE
      v_ledger_desc := 'Monthly Leaderboard Reward – Rank #' || COALESCE(v_payout.leaderboard_rank, v_payout.position, 1);
    END IF;
  ELSIF v_payout.payout_type = 'manual_grant' OR v_payout.ticket_id = 'MANUAL' THEN
    v_ledger_type := 'admin_adjustment';
    v_ledger_desc := COALESCE(NULLIF(trim(v_payout.event_title), ''), 'Admin Winner USDT Grant');
  ELSE
    v_ledger_type := 'lottery_win';
    v_ledger_desc := 'Four-Digit Lottery Winner Payout – #' || COALESCE(v_payout.winning_digits, '0000') || ' (' || COALESCE(v_payout.event_title, 'Lottery Draw') || ')';
  END IF;

  -- Check immutable ledger duplicate before attempting wallet credit
  IF EXISTS (SELECT 1 FROM public.wallet_ledger WHERE reference_id = v_payout_ref) THEN
    RETURN jsonb_build_object(
      'success', false,
      'already_completed', true,
      'error', 'Duplicate credit blocked: ledger already contains payout reference ' || v_payout_ref || '.'
    );
  END IF;

  -- Subtransaction ensures failure records status='failed' without partial wallet credit
  BEGIN
    UPDATE public.winner_payouts
    SET status = 'processing',
        processed_by = v_admin_uid
    WHERE id = p_payout_id;

    v_credit_res := public._internal_credit_virtual_credits(
      v_amount,
      v_ledger_type,
      v_payout_ref,
      v_ledger_desc,
      v_target_address,
      v_target_uid,
      jsonb_build_object(
        'payout_id', p_payout_id,
        'payout_type', v_payout.payout_type,
        'payout_reference', v_payout_ref,
        'competition_month', v_payout.competition_month,
        'leaderboard_rank', v_payout.leaderboard_rank,
        'event_id', v_payout.event_id,
        'ticket_id', v_payout.ticket_id,
        'winning_digits', v_payout.winning_digits,
        'approved_by', v_admin_uid,
        'tx_hash', v_hash
      )
    );

    IF NOT COALESCE((v_credit_res->>'success')::boolean, false) THEN
      RAISE EXCEPTION '%', COALESCE(v_credit_res->>'error', 'Wallet credit failed');
    END IF;

    IF COALESCE((v_credit_res->>'already_processed')::boolean, false) THEN
      RAISE EXCEPTION 'Duplicate credit detected for reference %', v_payout_ref;
    END IF;

    UPDATE public.winner_payouts
    SET status = 'completed',
        user_id = COALESCE(user_id, v_target_uid),
        winner_address = COALESCE(NULLIF(v_credit_res->>'wallet_address', ''), winner_address, v_target_address),
        payout_amount = v_amount,
        tx_hash = v_hash,
        approved_at = v_now,
        processed_by = v_admin_uid,
        failure_reason = NULL,
        manual_adjustment_reason = CASE
          WHEN v_amount <> calculated_amount THEN COALESCE(NULLIF(trim(COALESCE(p_adjustment_reason, '')), ''), 'Admin adjusted from ' || calculated_amount || ' to ' || v_amount || ' USDT')
          ELSE manual_adjustment_reason
        END
    WHERE id = p_payout_id;

    IF v_payout.payout_type = 'lottery_win' AND v_payout.ticket_id IS NOT NULL AND v_payout.ticket_id <> 'MANUAL' THEN
      UPDATE public.lottery_tickets
      SET claimed = true,
          won_amount = v_amount
      WHERE id = v_payout.ticket_id;
    END IF;

    INSERT INTO public.admin_audit_logs (
      admin_id, action_type, target_type, target_id, changes
    ) VALUES (
      v_admin_uid,
      CASE WHEN v_payout.payout_type = 'monthly_leaderboard' THEN 'APPROVE_MONTHLY_LEADERBOARD_PAYOUT' ELSE 'APPROVE_LOTTERY_PAYOUT' END,
      'winner_payouts',
      p_payout_id,
      jsonb_build_object(
        'payout_reference', v_payout_ref,
        'payout_type', v_payout.payout_type,
        'competition_month', v_payout.competition_month,
        'leaderboard_rank', v_payout.leaderboard_rank,
        'recipient_user_id', v_target_uid,
        'recipient_address', COALESCE(v_credit_res->>'wallet_address', v_target_address),
        'calculated_amount', v_payout.calculated_amount,
        'approved_amount', v_amount,
        'adjustment_reason', p_adjustment_reason,
        'ledger_tx_id', v_credit_res->>'transaction_id',
        'tx_hash', v_hash
      )
    );
  EXCEPTION WHEN OTHERS THEN
    UPDATE public.winner_payouts
    SET status = 'failed',
        failure_reason = SQLERRM,
        processed_by = v_admin_uid
    WHERE id = p_payout_id;

    INSERT INTO public.admin_audit_logs (
      admin_id, action_type, target_type, target_id, changes
    ) VALUES (
      v_admin_uid,
      'PAYOUT_APPROVAL_FAILED',
      'winner_payouts',
      p_payout_id,
      jsonb_build_object(
        'payout_reference', v_payout_ref,
        'attempted_amount', v_amount,
        'error', SQLERRM
      )
    );

    RETURN jsonb_build_object(
      'success', false,
      'status', 'failed',
      'error', SQLERRM
    );
  END;

  RETURN jsonb_build_object(
    'success', true,
    'status', 'completed',
    'payout_id', p_payout_id,
    'payout_reference', v_payout_ref,
    'payout_type', v_payout.payout_type,
    'credited_amount', v_amount,
    'new_balance', v_credit_res->>'new_balance',
    'wallet_address', v_credit_res->>'wallet_address',
    'tx_hash', v_hash,
    'transaction_id', v_credit_res->>'transaction_id'
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.admin_disburse_winner_secure(text, numeric, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_disburse_winner_secure(text, numeric, text, text) TO authenticated;

-- 8. Safe Soft-Delete / Cancellation RPC preserving financial audit history
CREATE OR REPLACE FUNCTION public.admin_cancel_or_delete_payout_secure(
  p_payout_id text,
  p_mode text DEFAULT 'cancel'::text,
  p_reason text DEFAULT NULL::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth', 'pg_temp'
AS $function$
DECLARE
  v_admin_uid uuid := auth.uid();
  v_payout record;
  v_mode text := lower(trim(COALESCE(p_mode, 'cancel')));
  v_reason text := COALESCE(NULLIF(trim(COALESCE(p_reason, '')), ''), CASE WHEN v_mode = 'delete' THEN 'Cancelled & Archived by Administrator' ELSE 'Cancelled by Administrator' END);
  v_now timestamptz := now();
BEGIN
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized: Admin privileges required.');
  END IF;

  SELECT * INTO v_payout FROM public.winner_payouts WHERE id = p_payout_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Payout record not found.');
  END IF;

  IF v_payout.payout_type = 'monthly_leaderboard' AND NOT public.is_super_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized: Only Super Admin can manage Monthly Leaderboard payouts.');
  END IF;

  IF v_payout.status IN ('completed', 'paid') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Completed payouts cannot be deleted or cancelled. Audit & ledger records are protected.');
  END IF;

  UPDATE public.winner_payouts
  SET status = 'cancelled',
      cancelled_at = v_now,
      cancelled_by = v_admin_uid,
      cancellation_reason = v_reason,
      is_deleted = CASE WHEN v_mode = 'delete' THEN true ELSE is_deleted END,
      deleted_at = CASE WHEN v_mode = 'delete' THEN v_now ELSE deleted_at END,
      deleted_by = CASE WHEN v_mode = 'delete' THEN v_admin_uid ELSE deleted_by END
  WHERE id = p_payout_id;

  INSERT INTO public.admin_audit_logs (
    admin_id, action_type, target_type, target_id, changes
  ) VALUES (
    v_admin_uid,
    CASE WHEN v_mode = 'delete' THEN 'SOFT_DELETE_PAYOUT' ELSE 'CANCEL_PAYOUT' END,
    'winner_payouts',
    p_payout_id,
    jsonb_build_object(
      'payout_reference', v_payout.payout_reference,
      'payout_type', v_payout.payout_type,
      'previous_status', v_payout.status,
      'reason', v_reason
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'payout_id', p_payout_id,
    'status', 'cancelled',
    'soft_deleted', (v_mode = 'delete'),
    'reason', v_reason
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.admin_cancel_or_delete_payout_secure(text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_cancel_or_delete_payout_secure(text, text, text) TO authenticated;
