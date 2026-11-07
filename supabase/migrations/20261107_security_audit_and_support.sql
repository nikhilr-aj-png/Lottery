-- ============================================================================
-- MIGRATION: ADMIN AUDIT LOGS, SECURITY HARDENING & SUPPORT SYSTEM
-- ============================================================================

-- 1. Create public.admin_audit_logs table
CREATE TABLE IF NOT EXISTS public.admin_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  admin_email text,
  action_type text NOT NULL,
  target_type text,
  target_id text,
  changes jsonb DEFAULT '{}'::jsonb,
  ip_address text,
  created_at timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_created ON public.admin_audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_action ON public.admin_audit_logs(action_type);
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_admin_id ON public.admin_audit_logs(admin_id);

-- Enable RLS on admin_audit_logs
ALTER TABLE public.admin_audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view audit logs" ON public.admin_audit_logs;
CREATE POLICY "Admins can view audit logs"
  ON public.admin_audit_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'super_admin'
    )
  );

-- ============================================================================
-- 2. RPC: log_admin_action
-- ============================================================================
CREATE OR REPLACE FUNCTION public.log_admin_action(
  p_action_type text,
  p_target_type text DEFAULT NULL,
  p_target_id text DEFAULT NULL,
  p_changes jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth', 'pg_temp'
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_email text;
  v_role text;
  v_log_id uuid;
BEGIN
  -- Verify admin role
  SELECT email, role INTO v_email, v_role
  FROM public.profiles
  WHERE id = v_uid;

  IF v_role != 'super_admin' AND v_role != 'admin' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized: Admin role required');
  END IF;

  INSERT INTO public.admin_audit_logs (
    admin_id,
    admin_email,
    action_type,
    target_type,
    target_id,
    changes,
    created_at
  ) VALUES (
    v_uid,
    COALESCE(v_email, 'admin@earnflow.in'),
    p_action_type,
    p_target_type,
    p_target_id,
    p_changes,
    now()
  )
  RETURNING id INTO v_log_id;

  RETURN jsonb_build_object('success', true, 'log_id', v_log_id);
END;
$$;

-- ============================================================================
-- 3. Secure support_tickets RLS policies
-- ============================================================================
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own support tickets" ON public.support_tickets;
CREATE POLICY "Users can view own support tickets"
  ON public.support_tickets FOR SELECT
  USING (
    auth.uid() = user_id 
    OR user_address IS NOT NULL
    OR EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'super_admin')
  );

DROP POLICY IF EXISTS "Users can insert support tickets" ON public.support_tickets;
CREATE POLICY "Users can insert support tickets"
  ON public.support_tickets FOR INSERT
  WITH CHECK (true);

DROP POLICY IF EXISTS "Admins can update support tickets" ON public.support_tickets;
CREATE POLICY "Admins can update support tickets"
  ON public.support_tickets FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'super_admin')
  );

-- ============================================================================
-- 4. Server-Side Operator Passkey Verification RPC (Replaces plaintext client key)
-- ============================================================================
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION public.verify_admin_operator_passkey(p_passkey text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions', 'auth', 'pg_temp'
AS $$
DECLARE
  v_stored_hash text := '6cbfef548840682f637e0036a99a86bd23e4d051e7f2472d2a8f4e07a169d713';
  v_input_hash text;
BEGIN
  IF p_passkey IS NULL OR length(trim(p_passkey)) = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Operator passkey required');
  END IF;

  v_input_hash := encode(extensions.digest(trim(p_passkey)::bytea, 'sha256'), 'hex');

  IF v_input_hash = v_stored_hash THEN
    RETURN jsonb_build_object('success', true);
  ELSE
    RETURN jsonb_build_object('success', false, 'error', 'Invalid operator passkey. Access Denied.');
  END IF;
END;
$$;

