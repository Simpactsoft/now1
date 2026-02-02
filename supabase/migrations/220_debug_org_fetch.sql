
-- Migration: 220_debug_org_fetch.sql
-- Description: Debugs Organization visibility issues (Tenant mismatch, Indices, RPC execution).

DO $$
DECLARE
    v_top_tenant uuid;
    v_count bigint;
    r RECORD;
BEGIN
    RAISE NOTICE '--- 1. Organization Counts per Tenant ---';
    
    FOR r IN 
        SELECT tenant_id, count(*) as c 
        FROM cards 
        WHERE type = 'organization' 
        GROUP BY tenant_id
    LOOP
        RAISE NOTICE 'Tenant: % | Count: %', r.tenant_id, r.c;
        v_top_tenant := r.tenant_id; -- Capture the last one (likely the one we just seeded)
    END LOOP;

    IF v_top_tenant IS NULL THEN
        RAISE NOTICE 'WARNING: No organizations found in the entire table!';
    ELSE
        RAISE NOTICE 'Testing RPC with Tenant: %', v_top_tenant;
        
        -- Test Count RPC
        SELECT get_organizations_count(v_top_tenant, '{}'::jsonb) INTO v_count;
        RAISE NOTICE 'RPC Count Result: %', v_count;

        -- Test Data RPC (Fetch 5 rows)
        RAISE NOTICE '--- Fetching first 5 rows ---';
        FOR r IN 
            SELECT * FROM fetch_organizations_data(v_top_tenant, 0, 5, 'updated_at', 'desc', '{}'::jsonb)
        LOOP
             RAISE NOTICE 'Found: % (Status: %)', r.ret_name, r.ret_status;
        END LOOP;
    END IF;

    RAISE NOTICE '--- 2. Checking Indices ---';
    FOR r IN
        SELECT indexname, indexdef 
        FROM pg_indexes 
        WHERE tablename = 'cards'
    LOOP
         RAISE NOTICE 'Index: % | Def: %', r.indexname, r.indexdef;
    END LOOP;

END $$;
