-- Phase 7: Galactic Seeding (1,000,000 Rows - BATCHED)
-- This script uses a loop to insert 1,000,000 rows in batches of 100,000
-- to avoid "upstream timeout" errors in the SQL Editor.

DO $$
DECLARE
    galactic_id UUID := '00000000-0000-0000-0000-000000000003';
    batch_size INT := 100000;
    i INT;
BEGIN
    -- Ensure tenant exists
    INSERT INTO tenants (id, name, slug)
    VALUES (galactic_id, 'Galactic Stress Test', 'galactic')
    ON CONFLICT (id) DO NOTHING;

    -- Clear previous data
    DELETE FROM employees WHERE tenant_id = galactic_id;

    -- Loop to insert 1,000,000 rows in batches
    FOR i IN 0..9 LOOP
        RAISE NOTICE 'Inserting batch % (rows % to %)', i+1, i*batch_size + 1, (i+1)*batch_size;
        
        INSERT INTO employees (tenant_id, name, salary, org_path)
        SELECT 
            galactic_id,
            'Galactic Unit ' || (i*batch_size + s.id) as name,
            (random() * 100000 + 30000)::int as salary,
            text2ltree(
                'corp' || 
                '.dept' || (((i*batch_size + s.id) % 10) + 1) || 
                '.team' || (((i*batch_size + s.id) % 100) + 1) || 
                '.group' || (((i*batch_size + s.id) % 1000) + 1)
            ) as org_path
        FROM generate_series(1, batch_size) AS s(id);
        
        COMMIT; -- Commit each batch separately to clear logs and memory
    END LOOP;
END $$;

-- Final statistics update
ANALYZE employees;
