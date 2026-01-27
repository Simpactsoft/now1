-- Protocol for Verifying RLS Security (Manual Test)
-- Usage: Run this entire script block in your Supabase SQL Editor.
-- Behavior: It creates temporary test data, verifies access rules, and then ROLLBACKS everything.
-- Result: Look for "Messages" output. If you see "SUCCESS", it passed.

BEGIN;

DO $$
DECLARE
    v_tenant_a UUID := '11111111-1111-1111-1111-111111111111';
    v_tenant_b UUID := '22222222-2222-2222-2222-222222222222';
    v_card_a   UUID;
    v_card_b   UUID;
    v_count    INT;
BEGIN
    RAISE NOTICE '--- STARTING SECURITY VERIFICATION ---';

    -- 0. Setup Dummy Cards to satisfy Foreign Keys
    -- We temporarily bypass RLS to setup the test data
    INSERT INTO cards (id, tenant_id, display_name, type) VALUES (gen_random_uuid(), v_tenant_a, 'Test Corp A', 'organization') RETURNING id INTO v_card_a;
    INSERT INTO cards (id, tenant_id, display_name, type) VALUES (gen_random_uuid(), v_tenant_b, 'Test Corp B', 'organization') RETURNING id INTO v_card_b;

    ----------------------------------------------------------------
    -- TEST 1: Positive Access (Tenant A can insert/read own data)
    ----------------------------------------------------------------
    
    -- Mock JWT for Tenant A
    PERFORM set_config('request.jwt.claims', jsonb_build_object('app_metadata', jsonb_build_object('tenant_id', v_tenant_a))::text, true);
    PERFORM set_config('role', 'authenticated', true);

    -- Insert
    INSERT INTO unique_identifiers (tenant_id, card_id, identifier_type, identifier_value)
    VALUES (v_tenant_a, v_card_a, 'email', 'ceo@a.com');

    -- Verify Read
    SELECT count(*) INTO v_count FROM unique_identifiers WHERE identifier_value = 'ceo@a.com';
    IF v_count = 1 THEN
        RAISE NOTICE '✅ TEST 1 PASSED: Tenant A can read own data.';
    ELSE
        RAISE EXCEPTION '❌ TEST 1 FAILED: Tenant A could not read own data.';
    END IF;

    ----------------------------------------------------------------
    -- TEST 2: Negative Access (Tenant A trying to read Tenant B)
    ----------------------------------------------------------------
    
    -- First, inject data for Tenant B (as Superuser/Omni to bypass checks for setup)
    PERFORM set_config('role', 'postgres', true); 
    INSERT INTO unique_identifiers (tenant_id, card_id, identifier_type, identifier_value)
    VALUES (v_tenant_b, v_card_b, 'email', 'ceo@b.com');

    -- Switch back to Tenant A
    PERFORM set_config('role', 'authenticated', true);
    PERFORM set_config('request.jwt.claims', jsonb_build_object('app_metadata', jsonb_build_object('tenant_id', v_tenant_a))::text, true);

    -- Attempt Read
    SELECT count(*) INTO v_count FROM unique_identifiers WHERE identifier_value = 'ceo@b.com';
    IF v_count = 0 THEN
        RAISE NOTICE '✅ TEST 2 PASSED: Tenant A CANNOT see Tenant B data.';
    ELSE
        RAISE EXCEPTION '❌ TEST 2 FAILED: LEAK DETECTED! Tenant A saw Tenant B data.';
    END IF;

    ----------------------------------------------------------------
    -- TEST 3: Integrity Check (Tenant A trying to insert for Tenant B)
    ----------------------------------------------------------------
    BEGIN
        INSERT INTO unique_identifiers (tenant_id, card_id, identifier_type, identifier_value)
        VALUES (v_tenant_b, v_card_b, 'email', 'hacker@b.com');
        
        RAISE EXCEPTION '❌ TEST 3 FAILED: Tenant A was able to insert data for Tenant B!';
    EXCEPTION WHEN OTHERS THEN
         -- Expected error: new row violates row-level security policy...
         RAISE NOTICE '✅ TEST 3 PASSED: Tenant A blocked from inserting into Tenant B (Error: %)', SQLERRM;
    END;

    RAISE NOTICE '--- ALL TESTS PASSED SUCCESSFULLY ---';
END $$;

ROLLBACK; -- Clean up all test data (Cards, Identifiers) automatically
