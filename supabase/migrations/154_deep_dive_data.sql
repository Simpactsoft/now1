
-- Migration: 154_deep_dive_data.sql
-- Description: Deep inspection of why specific queries return empty results.

BEGIN;

DO $$
DECLARE
    v_profile_tenant UUID;
    v_cards_count BIGINT;
    v_card_sample RECORD;
    v_rpc_count BIGINT;
BEGIN
    RAISE NOTICE '--- DEEP DIVE START ---';

    -- 1. Check Profile Tenant
    SELECT tenant_id INTO v_profile_tenant FROM profiles LIMIT 1;
    RAISE NOTICE '1. User Profile Tenant ID: %', v_profile_tenant;

    -- 2. Check Cards Count for this Tenant (Raw Table)
    SELECT count(*) INTO v_cards_count FROM cards WHERE tenant_id = v_profile_tenant;
    RAISE NOTICE '2. Cards found for this Tenant (Direct Query): %', v_cards_count;

    -- 3. Check if ANY cards exist at all (and what their tenants are)
    IF v_cards_count = 0 THEN
        RAISE NOTICE '   WARNING: This tenant has NO data. Checking who DOES have data...';
        FOR v_card_sample IN SELECT tenant_id, count(*) as c FROM cards GROUP BY tenant_id ORDER BY count(*) DESC LIMIT 3 LOOP
            RAISE NOTICE '   -> Tenant % has % cards', v_card_sample.tenant_id, v_card_sample.c;
        END LOOP;
    END IF;

    -- 4. Execute RPC with Explicit ID
    -- We assume the RPC internal query uses the same ID.
    SELECT count(*) INTO v_rpc_count FROM fetch_people_crm(
        arg_tenant_id := v_profile_tenant, 
        arg_limit := 100
    );
    RAISE NOTICE '3. RPC returned % rows for this Tenant', v_rpc_count;

    RAISE NOTICE '--- DEEP DIVE END ---';
END $$;

ROLLBACK; -- Read only debug
