
-- Migration: 101_enforce_rbac_policies.sql
-- Description: Updates RLS policies to enforce RBAC permissions.
-- Phase 4 of ERP Foundation.

BEGIN;

-- 1. Update INSERT Policy (Create)
-- Must have 'contacts.create' permission AND valid tenant.
DROP POLICY IF EXISTS "Hierarchy Insert" ON cards;
CREATE POLICY "Hierarchy Insert" ON cards
    FOR INSERT TO authenticated
    WITH CHECK (
        public.has_permission('contacts.create')
        AND
        -- Ensure user is creating card in their own tenant (Basic Sanity)
        tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid())
    );

-- 2. Update SELECT Policy (Read) - (Already done in 95, just verifying)
-- We keep the "Cone of Visibility". Usually 'contacts.read' is implied for all active users,
-- but we can add it for strictness if desired. For now, we assume if you are authenticated and in hierarchy, you can read.
-- (No change to SELECT policy to avoid breaking basic access, unless specified).

-- 3. Update UPDATE Policy (Edit)
-- Must have Visibility (Hierarchy) AND 'contacts.update' permission.
DROP POLICY IF EXISTS "Hierarchy Edit" ON cards;
CREATE POLICY "Hierarchy Edit" ON cards
    FOR UPDATE TO authenticated
    USING (
        public.user_org_path() @> hierarchy_path -- Visibility
        AND
        public.has_permission('contacts.update') -- Permission
    );

-- 4. Create DELETE Policy (Delete)
-- Must have Visibility AND 'contacts.delete' permission.
-- This is where the magic happens: Agents won't have this permission.
DROP POLICY IF EXISTS "Hierarchy Delete" ON cards;
CREATE POLICY "Hierarchy Delete" ON cards
    FOR DELETE TO authenticated
    USING (
        public.user_org_path() @> hierarchy_path -- Visibility
        AND
        public.has_permission('contacts.delete') -- Permission
    );

COMMIT;
