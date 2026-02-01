
-- Migration: 214_inspect_status_duplicates.sql
-- Description: Inspects the option_values for PERSON_STATUS to find duplicates.

DO $$
DECLARE
    v_set_id uuid;
    r record;
BEGIN
    SELECT id INTO v_set_id FROM option_sets WHERE code = 'PERSON_STATUS';
    
    RAISE NOTICE 'Inspecting PERSON_STATUS (Set ID: %)', v_set_id;
    
    FOR r IN 
        SELECT id, tenant_id, internal_code, label_i18n, is_active 
        FROM option_values 
        WHERE option_set_id = v_set_id
    LOOP
        RAISE NOTICE 'Value: % | Tenant: % | Code: % | Label: %', r.id, r.tenant_id, r.internal_code, r.label_i18n;
    END LOOP;
END $$;
