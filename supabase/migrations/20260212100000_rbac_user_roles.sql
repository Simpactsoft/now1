-- ============================================================================
-- RBAC: User Roles Table
-- ============================================================================
-- Author: Based on Supabase Best Practices + Architect Research
-- Date: 2026-02-12
-- 
-- This migration creates the foundation for role-based access control:
-- - user_roles table (secure, normalized storage)
-- - RLS policies (only service role can manage)
-- - Performance indexes
-- ============================================================================

-- Create roles table
CREATE TABLE IF NOT EXISTS public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'user' 
    CHECK (role IN ('user', 'admin', 'super_admin')),
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Policy: Only service role can INSERT/UPDATE/DELETE roles
CREATE POLICY "service_role_manages_roles"
ON public.user_roles FOR ALL
TO service_role
USING (true);

-- Policy: Admins can read all roles (for user management UI)
CREATE POLICY "admins_read_roles"
ON public.user_roles FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
    AND ur.role IN ('admin', 'super_admin')
  )
);

-- Performance index (critical for Auth Hook performance)
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id 
ON public.user_roles USING btree (user_id);

-- Index for role queries
CREATE INDEX IF NOT EXISTS idx_user_roles_role 
ON public.user_roles USING btree (role) 
WHERE role IN ('admin', 'super_admin');

-- Updated timestamp trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_user_roles_updated_at
BEFORE UPDATE ON public.user_roles
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Comments
COMMENT ON TABLE public.user_roles IS 'User roles for RBAC system - managed via service role only';
COMMENT ON COLUMN public.user_roles.role IS 'User role: user (default), admin (cross-tenant access), super_admin (system-wide)';
COMMENT ON COLUMN public.user_roles.tenant_id IS 'User primary tenant (NULL for admins)';
