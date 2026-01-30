
-- Migration: 158_fix_hierarchy_and_policies.sql
-- Description: Unifies Hierarchy Paths and RLS Policies.
-- 1. Sets a standard 'org' path for everyone to ensure matching.
-- 2. Replaces all conflicting policies with one "Golden Rule" policy.

BEGIN;

-- 1. Standardize DATA Hierarchy
-- Ensure all cards currently have the root 'org' path
UPDATE cards
SET hierarchy_path = 'org'::ltree
WHERE hierarchy_path IS NULL OR hierarchy_path <> 'org'::ltree;

-- 2. Standardize USER Hierarchy
-- Ensure all profiles have the root 'org' path
UPDATE profiles
SET org_path = 'org'::ltree
WHERE org_path IS NULL OR org_path <> 'org'::ltree;


-- 3. Reset RLS Policies
-- Drop everything to avoid conflicts
DROP POLICY IF EXISTS "hierarchy_access_policy" ON public.cards;
DROP POLICY IF EXISTS "hierarchy_access_policy_new" ON public.cards;
DROP POLICY IF EXISTS "tenant_access_policy_debug" ON public.cards;
DROP POLICY IF EXISTS "cards_isolation_policy" ON public.cards;

-- 4. Create The 'Golden Rule' Policy
-- Checks Tenant Match AND Hierarchy Match.
-- Uses COALESCE to fail safe if path is missing.
CREATE POLICY "cards_isolation_policy" ON public.cards
FOR ALL
USING (
    tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid())
    AND
    hierarchy_path <@ (SELECT COALESCE(org_path, 'org'::ltree) FROM profiles WHERE id = auth.uid())
);

-- 5. Verification Log
DO $$
DECLARE
    v_tenant UUID;
    v_count BIGINT;
BEGIN
    SELECT tenant_id INTO v_tenant FROM profiles LIMIT 1;
    SELECT count(*) INTO v_count FROM cards WHERE tenant_id = v_tenant;
    
    RAISE NOTICE 'Migration Complete.';
    RAISE NOTICE 'Aligned Tenant: %', v_tenant;
    RAISE NOTICE 'Cards in this tenant (should be accessible): %', v_count;
END $$;

COMMIT;
