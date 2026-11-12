-- ============================================================================
-- MIGRATION: VIRTUAL WALLET LEADERBOARD RPC
-- ============================================================================
-- Returns genuine ranking of users by virtual wallet balance (1 FLO = 1 USDT)
-- Masks sensitive address data while showing public username, rank, and balance.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_virtual_wallet_leaderboard(
  p_limit integer DEFAULT 50
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth', 'pg_temp'
AS $$
DECLARE
  v_rows jsonb;
BEGIN
  SELECT jsonb_agg(sub) INTO v_rows FROM (
    SELECT 
      ROW_NUMBER() OVER(ORDER BY w.balance DESC, w.updated_at DESC) AS rank,
      COALESCE(p.username, 'Player_' || substring(w.address from 3 for 6)) AS username,
      substring(w.address from 1 for 6) || '...' || substring(w.address from length(w.address)-3 for 4) AS address,
      w.address AS raw_address,
      ROUND(w.balance::numeric, 2) AS wallet_balance,
      ROUND(w.balance::numeric, 2) AS usdt_value,
      COALESCE(vip.current_tier, 'Bronze') AS vip_tier,
      COALESCE(vip.tier_level, 1) AS vip_level,
      COALESCE(w.lifetime_won, 0)::numeric AS lifetime_won,
      w.updated_at AS last_active
    FROM public.lottery_wallets w
    LEFT JOIN public.profiles p ON (w.user_id IS NOT NULL AND p.id = w.user_id) OR (p.trc20_address = w.address)
    LEFT JOIN public.user_vip_progress vip ON vip.wallet_address = w.address
    WHERE w.balance > 0
    ORDER BY w.balance DESC, w.updated_at DESC
    LIMIT p_limit
  ) sub;

  RETURN COALESCE(v_rows, '[]'::jsonb);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_virtual_wallet_leaderboard(integer) TO anon, authenticated, service_role;

