
-- Migration: 195_enforce_rbac_on_cards.sql
-- Description: Split monolithic RLS into granular RBAC policies.

-- 1. Drop the old "All in One" policy
DROP POLICY IF EXISTS "cards_isolation_policy" ON public.cards;


-- 2. Define the Security Basis (Tenant + Hierarchy)
-- We repeat this logic in each policy for clarity and performance.
-- (Ideally we would have a function auth.filter_accessible_cards() but repeating is fine).


-- POLICY: READ (SELECT)
DROP POLICY IF EXISTS "RBAC Read Cards" ON public.cards;
CREATE POLICY "RBAC Read Cards" ON public.cards FOR SELECT
TO authenticated
USING (
    -- 1. Visibility Scope
    tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid())
    AND 
    hierarchy_path <@ (SELECT COALESCE(org_path, 'non_existent_path'::ltree) FROM profiles WHERE id = auth.uid())
    
    -- 2. Permission Check
    AND public.has_permission('contacts.read')
);


-- POLICY: CREATE (INSERT)
DROP POLICY IF EXISTS "RBAC Create Cards" ON public.cards;
CREATE POLICY "RBAC Create Cards" ON public.cards FOR INSERT
TO authenticated
WITH CHECK (
    -- 1. Must create in own scope (Prevent creating for others)
    tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid())
    AND 
    hierarchy_path <@ (SELECT COALESCE(org_path, 'non_existent_path'::ltree) FROM profiles WHERE id = auth.uid())
    
    -- 2. Permission Check
    AND public.has_permission('contacts.create')
);


-- POLICY: UPDATE (UPDATE)
DROP POLICY IF EXISTS "RBAC Update Cards" ON public.cards;
CREATE POLICY "RBAC Update Cards" ON public.cards FOR UPDATE
TO authenticated
USING (
    -- Can only update what you can see
    tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid())
    AND hierarchy_path <@ (SELECT COALESCE(org_path, 'non_existent_path'::ltree) FROM profiles WHERE id = auth.uid())
    AND public.has_permission('contacts.update')
)
WITH CHECK (
    -- Cannot move card out of scope
    tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid())
    AND hierarchy_path <@ (SELECT COALESCE(org_path, 'non_existent_path'::ltree) FROM profiles WHERE id = auth.uid())
    AND public.has_permission('contacts.update')
);


-- POLICY: DELETE (DELETE)
DROP POLICY IF EXISTS "RBAC Delete Cards" ON public.cards;
CREATE POLICY "RBAC Delete Cards" ON public.cards FOR DELETE
TO authenticated
USING (
    -- Can only delete what you can see
    tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid())
    AND hierarchy_path <@ (SELECT COALESCE(org_path, 'non_existent_path'::ltree) FROM profiles WHERE id = auth.uid())
    
    -- CRITICAL: Permission Check
    AND public.has_permission('contacts.delete')
);
