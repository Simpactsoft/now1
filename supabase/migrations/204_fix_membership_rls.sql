
-- Migration: 204_fix_membership_rls.sql
-- Description: Hardens party_memberships RLS to enforce RBAC.
-- Prevents unauthorized role modifications.

BEGIN;

-- Drop old weak policies
DROP POLICY IF EXISTS tenant_isolation_memberships ON party_memberships;

-- 1. READ: Allow users to see memberships in their tenant (Required for UI)
CREATE POLICY "RBAC Read Memberships" ON party_memberships
    FOR SELECT TO authenticated
    USING (
        tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid())
    );

-- 2. CREATE/UPDATE/DELETE: Enforce RBAC
CREATE POLICY "RBAC Write Memberships" ON party_memberships
    FOR ALL TO authenticated
    USING (
        tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid())
        AND public.has_permission('contacts.update')
    )
    WITH CHECK (
        tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid())
        AND public.has_permission('contacts.update')
    );

COMMIT;
