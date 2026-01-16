-- Part 2: Orbit Systems
-- Run this SECOND.

SET statement_timeout = 60000;
ALTER TABLE employees DISABLE TRIGGER trg_maintain_org_path;

DO $$
DECLARE
    orbit_ns UUID := '00000000-0000-0000-0000-000000000002';
    orbit_id UUID := deterministic_uuid(orbit_ns, 'tenant');
BEGIN
    -- Seed Orbit Systems (5,000 employees)
    INSERT INTO employees (id, tenant_id, manager_id, name, salary, org_path)
    WITH RECURSIVE hierarchy AS (
        SELECT 
            1 as i, 
            deterministic_uuid(orbit_ns, '1') as uuid, 
            NULL::uuid as manager_uuid, 
            text2ltree(replace(deterministic_uuid(orbit_ns, '1')::text, '-', '_')) as path
        UNION ALL
        SELECT 
            gs.val,
            deterministic_uuid(orbit_ns, gs.val::text),
            h.uuid,
            h.path || text2ltree(replace(deterministic_uuid(orbit_ns, gs.val::text)::text, '-', '_'))
        FROM generate_series(2, 5000) AS gs(val)
        JOIN hierarchy h ON h.i = floor((gs.val - 2) / 6) + 1
    )
    SELECT 
        uuid, orbit_id, manager_uuid, 'O_' || i, 60000 + (random() * 40000)::int, path
    FROM hierarchy;
END $$;
