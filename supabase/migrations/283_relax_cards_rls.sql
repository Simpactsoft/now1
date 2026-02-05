-- Migration: 283_relax_cards_rls.sql
-- Description: Relax RLS policies on 'cards' to fix update failures.
-- Removes the strict hierarchy_path check, relying on tenant_id and permissions.

BEGIN;

-- Drop strict RBAC policies
DROP POLICY IF EXISTS "RBAC Read Cards" ON public.cards;
DROP POLICY IF EXISTS "RBAC Create Cards" ON public.cards;
DROP POLICY IF EXISTS "RBAC Update Cards" ON public.cards;
DROP POLICY IF EXISTS "RBAC Delete Cards" ON public.cards;

-- Create relaxed policies (Tenant + Permissions Only)

-- 1. SELECT
CREATE POLICY "RBAC Read Cards" ON public.cards FOR SELECT
TO authenticated
USING (
    tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid())
    AND public.has_permission('contacts.read')
);

-- 2. INSERT
CREATE POLICY "RBAC Create Cards" ON public.cards FOR INSERT
TO authenticated
WITH CHECK (
    tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid())
    AND public.has_permission('contacts.create')
);

-- 3. UPDATE
CREATE POLICY "RBAC Update Cards" ON public.cards FOR UPDATE
TO authenticated
USING (
    tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid())
    AND public.has_permission('contacts.update')
)
WITH CHECK (
    tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid())
    AND public.has_permission('contacts.update')
);

-- 4. DELETE
CREATE POLICY "RBAC Delete Cards" ON public.cards FOR DELETE
TO authenticated
USING (
    tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid())
    AND public.has_permission('contacts.delete')
);

COMMIT;
