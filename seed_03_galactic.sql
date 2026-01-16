-- Part 3: Galactic Holdings (1 Million Rows)
-- Run this LAST.

SET statement_timeout = 300000; -- 5 Minutes
ALTER TABLE employees DISABLE TRIGGER trg_maintain_org_path;

-- OPTIMIZED: 3-Tier Shallow Tree (Root -> 1000 Managers -> 1000 Employees each)
DO $$
DECLARE
    galactic_ns UUID := '00000000-0000-0000-0000-000000000003';
    galactic_id UUID := deterministic_uuid(galactic_ns, 'tenant');
    root_id UUID := deterministic_uuid(galactic_ns, '1');
    root_path ltree := text2ltree(replace(root_id::text, '-', '_'));
BEGIN
    -- Tier 1: CEO (1 row)
    INSERT INTO employees (id, tenant_id, manager_id, name, salary, org_path)
    VALUES (root_id, galactic_id, NULL, 'G_1', 100000, root_path)
    ON CONFLICT DO NOTHING; -- In case rerun

    -- Tier 2: 1,000 VPs (IDs 2..1001) - Direct report to CEO
    INSERT INTO employees (id, tenant_id, manager_id, name, salary, org_path)
    SELECT
        deterministic_uuid(galactic_ns, i::text),
        galactic_id,
        root_id,
        'G_' || i,
        90000,
        root_path || text2ltree(replace(deterministic_uuid(galactic_ns, i::text)::text, '-', '_'))
    FROM generate_series(2, 1001) i;

    -- Tier 3: 999,000 Employees (IDs 1002..1,000,001)
    INSERT INTO employees (id, tenant_id, manager_id, name, salary, org_path)
    SELECT
        deterministic_uuid(galactic_ns, i::text),
        galactic_id,
        deterministic_uuid(galactic_ns, (floor((i - 1002) / 999) + 2)::text), -- Parent ID calculation
        'G_' || i,
        50000,
        root_path || 
        text2ltree(replace(deterministic_uuid(galactic_ns, (floor((i - 1002) / 999) + 2)::text)::text, '-', '_')) || 
        text2ltree(replace(deterministic_uuid(galactic_ns, i::text)::text, '-', '_'))
    FROM generate_series(1002, 1000001) i;
    
END $$;

-- Re-enable triggers (Might take a moment to index)
ALTER TABLE employees ENABLE TRIGGER trg_maintain_org_path;
