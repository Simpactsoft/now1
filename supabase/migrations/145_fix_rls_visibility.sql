
-- Migration: 145_fix_rls_visibility.sql
-- Description: Ensures all users can see the seeded data by fixing 'org_path'.

BEGIN;

-- 1. Fix Profiles: Ensure everyone has a root path 'org' if missing.
-- The RLS policy requires 'hierarchy_path <@ profiles.org_path'. 
-- If profiles.org_path is NULL, the result is HIDDEN.
UPDATE public.profiles
SET org_path = 'org'::ltree
WHERE org_path IS NULL;

-- 2. Debug: Count how many cards are technically available per tenant
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN SELECT tenant_id, count(*) as c FROM cards GROUP BY tenant_id LOOP
        RAISE NOTICE 'Tenant % has % cards', r.tenant_id, r.c;
    END LOOP;
END $$;

COMMIT;
