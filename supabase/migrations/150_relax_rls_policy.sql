
-- Migration: 150_relax_rls_policy.sql
-- Description: Debugging RLS Visibility.
-- Temporarily simplifies the RLS policy to ONLY check tenant_id.
-- This effectively removes the Ltree Hierarchy check.
-- If data appears after this, we confirm the issue is with `org_path` vs `hierarchy_path` alignment.

BEGIN;

-- Drop existing strict policy
DROP POLICY IF EXISTS "hierarchy_access_policy_new" ON public.cards;
DROP POLICY IF EXISTS "hierarchy_access_policy" ON public.cards;

-- Create relaxed policy (Tenant Only)
CREATE POLICY "tenant_access_policy_debug" ON public.cards
FOR ALL
USING (
    tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid())
);

-- Note: We still rely on profiles.tenant_id matching cards.tenant_id
-- If this still fails, the tenant IDs themselves are mismatched.

COMMIT;
