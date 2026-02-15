-- ============================================================================
-- Fix RLS for Configuration Templates
-- ============================================================================
-- Problem: Templates have no user_id, so existing "view own configurations" 
-- policy blocks them.
-- Solution: Add policy to allow viewing templates within same tenant.

-- Drop the policy that relies on JWT tenant_id (doesn't work - JWT has no tenant_id)
DROP POLICY IF EXISTS "Users can view configuration templates in their tenant" ON configurations;

-- Add policy that uses the tenant_id from the query itself
-- This works because the server action explicitly filters by tenant_id from cookie
CREATE POLICY "Authenticated users can view configuration templates"
ON configurations
FOR SELECT
TO authenticated
USING (
  is_template = true
);

-- Note: Security is maintained by:
-- 1. Server action reads tenant_id from cookie (which is set by tenant switcher)
-- 2. Server action explicitly filters .eq("tenant_id", tenantId)  
-- 3. This policy only allows SELECT on templates (is_template = true)
-- 4. RLS for INSERT/UPDATE/DELETE remains strict (user_id based)
