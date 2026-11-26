-- ============================================================================
-- MIGRATION: 20261126_leaderboard_win_percentage_ranking.sql
-- ============================================================================
-- Ranks players by winning percentage during the selected timeframe while
-- exposing ONLY rank, username, and total USDT won to the Leaderboard UI.
--
-- Winning Percentage Formula (consistent with platform GameHistoryStore):
--   win_percentage = (confirmed_wins / total_settled_entries) * 100
--
-- Tie-Breaking Rule (strict & deterministic):
--   1. Higher win_percentage DESC
--   2. Higher total_won_usdt DESC
--   3. Higher confirmed_wins_count DESC
--   4. Earlier first_win_at ASC NULLS LAST
--   5. Canonical username ASC
-- ============================================================================

-- Performance indexes for period-filtered leaderboard queries
CREATE INDEX IF NOT EXISTS idx_winner_payouts_created_at
  ON public.winner_payouts (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_winner_payouts_ticket_id
  ON public.winner_payouts (ticket_id);

CREATE INDEX IF NOT EXISTS idx_lottery_tickets_status_created
  ON public.lottery_tickets (status, created_at DESC);

CREATE OR REPLACE FUNCTION public.get_leaderboard_rankings(
  p_days integer DEFAULT 28,
  p_limit integer DEFAULT 100
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO 'public', 'auth', 'pg_temp'
AS $$
DECLARE
  v_days integer := GREATEST(1, LEAST(COALESCE(p_days, 28), 365));
  v_limit integer := GREATEST(1, LEAST(COALESCE(p_limit, 100), 250));
  v_now timestamptz := now();
  v_cutoff timestamptz := v_now - make_interval(days => v_days);
  v_rows jsonb;
BEGIN
  WITH raw_payout_wins AS (
    SELECT
      COALESCE(
        wp.user_id,
        lt.user_id,
        lw.user_id,
        prof_addr.id
      ) AS resolved_user_id,
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
    WHERE lower(COALESCE(wp.status, '')) IN ('paid', 'approved', 'completed')
      AND COALESCE(wp.payout_amount, 0) > 0
      AND COALESCE(wp.approved_at, wp.created_at) >= v_cutoff
      AND COALESCE(wp.approved_at, wp.created_at) <= v_now
  ),
  direct_ticket_wins AS (
    -- Fallback only for winning lottery tickets with won_amount > 0 not already represented by raw_payout_wins
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
    -- Every settled lottery ticket (won or lost) in the same date range
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
    -- Optional game_rounds support (settled entries in the same date range)
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
    WHERE lower(COALESCE(gr.status, '')) IN ('won', 'win', 'lost', 'completed', 'settled', 'cashout')
      AND gr.created_at >= v_cutoff
      AND gr.created_at <= v_now
  ),
  combined_events AS (
    SELECT
      resolved_user_id,
      resolved_address,
      resolved_username,
      entry_ref,
      1 AS is_win,
      won_usdt,
      event_ts
    FROM raw_payout_wins

    UNION ALL

    SELECT
      resolved_user_id,
      resolved_address,
      resolved_username,
      entry_ref,
      1 AS is_win,
      won_usdt,
      event_ts
    FROM direct_ticket_wins

    UNION ALL

    SELECT
      resolved_user_id,
      resolved_address,
      resolved_username,
      entry_ref,
      is_win,
      won_usdt,
      event_ts
    FROM settled_lottery_entries

    UNION ALL

    SELECT
      resolved_user_id,
      resolved_address,
      resolved_username,
      entry_ref,
      is_win,
      won_usdt,
      event_ts
    FROM settled_round_entries
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
    -- Deduplicate each ticket/round entry_ref per user while summing genuine payout USDT
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
$$;

GRANT EXECUTE ON FUNCTION public.get_leaderboard_rankings(integer, integer) TO anon, authenticated, service_role;
