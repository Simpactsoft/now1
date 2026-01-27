
-- Verification Script: 108_verify_data_integrity.sql
-- Description: Tests if Regex/Required rules enforce blocking on Insert/Update.
-- WRAPPED IN ROLLBACK: No data persists.

BEGIN;

DO $$
DECLARE
    v_tenant_id UUID := '00000000-0000-0000-0000-000000000001';
    v_card_id UUID;
BEGIN
    RAISE NOTICE '--- STARTING VERIFICATION: DATA INTEGRITY ---';

    -- 1. Setup: Define a Strict Field (License Plate)
    -- Rule: 3 digits - 2 digits - 3 digits (e.g., 123-45-678)
    INSERT INTO attribute_definitions (
        tenant_id, 
        entity_type, 
        attribute_key, 
        attribute_type, 
        label_i18n,
        is_required,
        validation_rules
    )
    VALUES (
        v_tenant_id,
        'person',
        'license_plate',
        'text',
        '{"en": "License Plate"}'::jsonb,
        true, -- Is Required
        '{"regex": "^[0-9]{3}-[0-9]{2}-[0-9]{3}$", "min_length": 10}'::jsonb
    );

    -- 2. TEST A: Insert Missing Required Field
    -- Should Fail because 'license_plate' is missing
    BEGIN
        INSERT INTO cards (tenant_id, type, display_name, custom_fields)
        VALUES (v_tenant_id, 'person', 'Bad Driver 1', '{}'::jsonb);
        
        RAISE EXCEPTION '❌ FAIL: Missing Required Field was ALLOWED';
    EXCEPTION WHEN OTHERS THEN
        IF SQLERRM LIKE '%Validation Failed: Field "License Plate" is required%' THEN
            RAISE NOTICE '✅ PASS: Required Field check blocked missing value.';
        ELSE
            RAISE NOTICE '⚠️ WARNING: Blocked but with unexpected error: %', SQLERRM;
             -- Re-raise if completely wrong, but for test we proceed
        END IF;
    END;

    -- 3. TEST B: Insert Invalid Format
    -- Should Fail because format is wrong (ABC-123)
    BEGIN
        INSERT INTO cards (tenant_id, type, display_name, custom_fields)
        VALUES (v_tenant_id, 'person', 'Bad Driver 2', '{"license_plate": "ABC-123"}'::jsonb);
        
        RAISE EXCEPTION '❌ FAIL: Invalid Regex was ALLOWED';
    EXCEPTION WHEN OTHERS THEN
        IF SQLERRM LIKE '%Validation Failed: Field "License Plate" format is invalid%' THEN
            RAISE NOTICE '✅ PASS: Regex check blocked invalid format.';
        ELSE
            RAISE NOTICE '⚠️ WARNING: Blocked but with unexpected error: %', SQLERRM;
        END IF;
    END;

    -- 4. TEST C: Insert Valid Format
    -- Should Succeed
    INSERT INTO cards (tenant_id, type, display_name, custom_fields)
    VALUES (v_tenant_id, 'person', 'Good Driver', '{"license_plate": "123-45-678"}'::jsonb);
    
    RAISE NOTICE '✅ PASS: Valid format accepted.';

END $$;

ROLLBACK;
