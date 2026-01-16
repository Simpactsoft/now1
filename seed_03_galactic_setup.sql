-- Part 3: Galactic Holdings - Setup & VPs
-- Run this THIRD.

SET statement_timeout = 60000;
ALTER TABLE employees DISABLE TRIGGER trg_maintain_org_path;

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
    ON CONFLICT (id) DO NOTHING;

    -- Tier 2: 1,000 VPs (IDs 2..1001)
    INSERT INTO employees (id, tenant_id, manager_id, name, salary, org_path)
    SELECT
        deterministic_uuid(galactic_ns, i::text),
        galactic_id,
        root_id,
        'G_' || i,
        90000,
        root_path || text2ltree(replace(deterministic_uuid(galactic_ns, i::text)::text, '-', '_'))
    FROM generate_series(2, 1001) i
    ON CONFLICT (id) DO NOTHING;
END $$;
