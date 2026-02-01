
-- Migration: 216_cleanup_status_duplicates.sql
-- Description: Normalizes status data to UPPERCASE and removes duplicate mixed-case option definitions.

BEGIN;

-- 1. Get the Option Set ID
DO $$
DECLARE
    v_set_id uuid;
BEGIN
    SELECT id INTO v_set_id FROM option_sets WHERE code = 'PERSON_STATUS';

    -- 2. Normalize Data in Cards Table (Safe to do generally for these specific values)
    -- We want to ensure that 'Lead' becomes 'LEAD' so it matches the remaining option.
    RAISE NOTICE 'Normalizing cards.status data to uppercase...';
    
    UPDATE cards 
    SET status = 'LEAD' 
    WHERE status = 'Lead' AND tenant_id IS NOT NULL; -- Tenant safety just in case, though cards always have tenant_id

    UPDATE cards 
    SET status = 'CUSTOMER' 
    WHERE status = 'Customer' AND tenant_id IS NOT NULL;

    UPDATE cards 
    SET status = 'CHURNED' 
    WHERE status = 'Churned' AND tenant_id IS NOT NULL;

    -- 3. Delete the Duplicate Option Values (The Mixed-Case ones)
    RAISE NOTICE 'Removing mixed-case option definitions...';
    
    DELETE FROM option_values 
    WHERE option_set_id = v_set_id 
      AND internal_code IN ('Lead', 'Customer', 'Churned')
      AND tenant_id IS NULL; -- Only delete system defaults, just in case a tenant created a custom override

END $$;

COMMIT;
