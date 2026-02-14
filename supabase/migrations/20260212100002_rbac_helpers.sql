-- ============================================================================
-- RBAC: Helper Functions
-- ============================================================================
-- Author: Based on Supabase Best Practices
-- Date: 2026-02-12
--
-- These functions are used by RLS policies to extract role/tenant from JWT.
-- All are STABLE (results don't change within transaction) for caching.
-- ============================================================================

-- Get current user's role from JWT app_metadata
CREATE OR REPLACE FUNCTION public.get_app_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT COALESCE(
    auth.jwt() -> 'app_metadata' ->> 'app_role',
    'user'  -- Default to least-privilege role
  );
$$;

-- Get current user's tenant_id from JWT app_metadata
CREATE OR REPLACE FUNCTION public.get_tenant_id_from_jwt()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid;
$$;

-- Check if current user is admin (or super_admin)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT get_app_role() IN ('admin', 'super_admin');
$$;

-- ============================================================================
-- BACKWARDS COMPATIBILITY (if needed)
-- ============================================================================

-- Alias for existing get_current_tenant_id() function
CREATE OR REPLACE FUNCTION public.get_current_tenant_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT get_tenant_id_from_jwt();
$$;

-- ============================================================================
-- DOCUMENTATION
-- ============================================================================

COMMENT ON FUNCTION get_app_role IS 
'Returns user role from JWT app_metadata. Used in RLS policies.
STABLE for performance caching within transaction.';

COMMENT ON FUNCTION get_tenant_id_from_jwt IS 
'Returns tenant_id from JWT app_metadata. NULL for admin users.';

COMMENT ON FUNCTION is_admin IS 
'Returns TRUE if user has admin or super_admin role. Used for cross-tenant access.';

COMMENT ON FUNCTION get_current_tenant_id IS 
'Backwards-compatible alias for get_tenant_id_from_jwt()';
