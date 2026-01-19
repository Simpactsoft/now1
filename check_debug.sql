-- Debug Script: Check Data Integrity (Pure SQL Version)

-- 1. Tenant Counts
SELECT 
    t.name as tenant_name, 
    t.id as tenant_id, 
    count(p.id) as party_count
FROM tenants t
LEFT JOIN parties p ON t.id = p.tenant_id
GROUP BY t.id, t.name
ORDER BY party_count DESC;

-- 2. People Table Count
SELECT count(*) as total_people_in_table FROM people;

-- 3. Check Orbit Tenant specifically
SELECT id, name FROM tenants WHERE name ILIKE 'Orbit%';

-- 4. Test fetch_people_crm RPC (First 5 rows)
DO $$
DECLARE
    v_tenant_id uuid;
    v_count int;
BEGIN
    SELECT id INTO v_tenant_id FROM tenants WHERE name ILIKE 'Orbit%' LIMIT 1;
    
    -- Test Plain Count
    SELECT count(*) INTO v_count FROM parties WHERE tenant_id = v_tenant_id;
    RAISE NOTICE 'Plain Count check inside DO block: %', v_count;
    
    -- We can't easily SELECT form a set-returning function in DO block to stdout, but we can verify it runs
    PERFORM fetch_people_crm(
        v_tenant_id, 
        0, -- start
        5, -- limit
        'updated_at', -- sort
        'desc', -- dir
        '{}'::jsonb -- filters
    );
    RAISE NOTICE 'RPC executed successfully.';
END $$;
