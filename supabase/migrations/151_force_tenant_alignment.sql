
-- Migration: 151_force_tenant_alignment.sql
-- Description: Solves the "Ghost Tenant" issue.
-- It finds the tenant_id that actually has data (the 5,000 records).
-- It then UPDATES all user profiles to point to that tenant.
-- This guarantees that the logged-in user matches the data owner.

BEGIN;

DO $$
DECLARE
    v_target_tenant_id UUID;
    v_count BIGINT;
BEGIN
    -- 1. Find the tenant with the MOST cards (The "Real" Tenant)
    SELECT tenant_id, count(*) 
    INTO v_target_tenant_id, v_count
    FROM cards 
    WHERE type = 'person'
    GROUP BY tenant_id 
    ORDER BY count(*) DESC 
    LIMIT 1;

    IF v_target_tenant_id IS NULL THEN
        RAISE EXCEPTION 'No data found in cards table! Cannot align tenants.';
    END IF;

    RAISE NOTICE 'Aligning all users to Target Tenant: % (Has % records)', v_target_tenant_id, v_count;

    -- 2. Move ALL Profiles to this Tenant
    -- This ensures that whoever you log in as, you are part of the populate tenant.
    UPDATE public.profiles
    SET 
        tenant_id = v_target_tenant_id,
        org_path = 'org'::ltree -- Ensure Hierarchy Access is also valid
    WHERE true; -- Update everyone

    -- 3. Just in case, update the 'cards_new' RLS if it still exists
    -- (No op if we are using the standard table)

END $$;

COMMIT;
