
-- Migration: 224_move_orgs_to_tenant.sql
-- Description: Moves organization data from 'Nano Inc' to 'Galactic Stress Test'.

BEGIN;

DO $$
DECLARE
    v_source_tenant uuid := '4d145b9e-4a75-5567-a0af-bcc4a30891e5'; -- Nano Inc (Where data is)
    v_target_tenant uuid := '00000000-0000-0000-0000-000000000003'; -- Galactic Stress Test (Target)
    v_count int;
BEGIN
    -- Check if data exists in source
    SELECT count(*) INTO v_count FROM cards WHERE tenant_id = v_source_tenant AND type = 'organization';
    
    IF v_count > 0 THEN
        RAISE NOTICE 'Moving % organizations from % to % ...', v_count, v_source_tenant, v_target_tenant;
        
        -- Update the tenant_id
        UPDATE cards
        SET tenant_id = v_target_tenant
        WHERE tenant_id = v_source_tenant
        AND type = 'organization';
        
        RAISE NOTICE 'Move complete.';
    ELSE
        RAISE NOTICE 'No organizations found in source tenant. Skipping.';
    END IF;
    
END $$;

COMMIT;
