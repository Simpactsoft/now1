
-- Verification Script: 102_verify_rbac.sql
-- Description: Verifies that Roles are correctly mapped to Permissions.
-- WRAPPED IN ROLLBACK: No data persists.

BEGIN;

DO $$
DECLARE
    v_has_perm BOOLEAN;
BEGIN
    RAISE NOTICE '--- STARTING VERIFICATION: RBAC ---';

    -- TEST 1: Check if DISTRIBUTOR has 'contacts.delete'
    -- We query the tables directly to verify the mapping logic
    SELECT EXISTS (
        SELECT 1 FROM role_permissions 
        WHERE role = 'distributor' 
        AND permission_id = 'contacts.delete'
    ) INTO v_has_perm;
    
    IF v_has_perm THEN
        RAISE NOTICE '✅ PASS: Distributor has DELETE permission';
    ELSE
        RAISE EXCEPTION '❌ FAIL: Distributor missing DELETE permission';
    END IF;

    -- TEST 2: Check if AGENT has 'contacts.delete'
    SELECT EXISTS (
        SELECT 1 FROM role_permissions 
        WHERE role = 'agent' 
        AND permission_id = 'contacts.delete'
    ) INTO v_has_perm;
    
    IF NOT v_has_perm THEN
        RAISE NOTICE '✅ PASS: Agent does NOT have DELETE permission';
    ELSE
        RAISE EXCEPTION '❌ FAIL: Agent INCORRECTLY has DELETE permission';
    END IF;

    -- TEST 3: Check if AGENT has 'contacts.create'
    SELECT EXISTS (
        SELECT 1 FROM role_permissions 
        WHERE role = 'agent' 
        AND permission_id = 'contacts.create'
    ) INTO v_has_perm;
    
    IF v_has_perm THEN
        RAISE NOTICE '✅ PASS: Agent has CREATE permission';
    ELSE
        RAISE EXCEPTION '❌ FAIL: Agent missing CREATE permission';
    END IF;

END $$;

ROLLBACK;
