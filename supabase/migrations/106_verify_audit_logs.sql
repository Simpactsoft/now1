
-- Verification Script: 106_verify_audit_logs.sql
-- Description: Tests if CRUD operations on Cards truly generate Audit Logs.
-- WRAPPED IN ROLLBACK: No data persists.

BEGIN;

DO $$
DECLARE
    v_tenant_id UUID := '00000000-0000-0000-0000-000000000001';
    v_card_id UUID;
    v_log_count INTEGER;
    v_changed_fields TEXT[];
BEGIN
    RAISE NOTICE '--- STARTING VERIFICATION: AUDIT LOGS ---';

    -- 1. INSERT Validation
    INSERT INTO cards (tenant_id, type, display_name)
    VALUES (v_tenant_id, 'person', 'Audit Test Person')
    RETURNING id INTO v_card_id;

    SELECT COUNT(*) INTO v_log_count 
    FROM audit_logs 
    WHERE record_id = v_card_id AND operation = 'INSERT';

    IF v_log_count = 1 THEN
        RAISE NOTICE '✅ PASS: INSERT logged successfully';
    ELSE
        RAISE EXCEPTION '❌ FAIL: INSERT log missing';
    END IF;

    -- 2. UPDATE Validation
    UPDATE cards 
    SET display_name = 'Audit Test Person UPDATED' 
    WHERE id = v_card_id;

    SELECT changed_fields INTO v_changed_fields
    FROM audit_logs 
    WHERE record_id = v_card_id AND operation = 'UPDATE';
    
    -- Check if 'display_name' is in the changed fields array
    IF 'display_name' = ANY(v_changed_fields) THEN
        RAISE NOTICE '✅ PASS: UPDATE logged with correct changed_fields: %', v_changed_fields;
    ELSE
        RAISE EXCEPTION '❌ FAIL: UPDATE log missing or key not detected. Found: %', v_changed_fields;
    END IF;

    -- 3. DELETE Validation
    DELETE FROM cards WHERE id = v_card_id;

    SELECT COUNT(*) INTO v_log_count 
    FROM audit_logs 
    WHERE record_id = v_card_id AND operation = 'DELETE';

    IF v_log_count = 1 THEN
        RAISE NOTICE '✅ PASS: DELETE logged successfully';
    ELSE
        RAISE EXCEPTION '❌ FAIL: DELETE log missing';
    END IF;

END $$;

ROLLBACK;
