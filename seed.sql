-- Phase 2: Massive Data Seeding
-- Optimized for speed. Run this in Supabase SQL Editor.

-- Increase timeout just in case
SET statement_timeout = 60000;

-- 0. Cleanup previous run
TRUNCATE TABLE employees, tenants CASCADE;

-- Disable triggers for performance
ALTER TABLE employees DISABLE TRIGGER trg_maintain_org_path;

-- Function to generate deterministic UUIDs
CREATE OR REPLACE FUNCTION deterministic_uuid(namespace uuid, key text) RETURNS uuid AS $$
BEGIN
    RETURN uuid_generate_v5(namespace, key);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

DO $$
DECLARE
    -- Namespaces for deterministic IDs
    nano_ns UUID := '00000000-0000-0000-0000-000000000001';
    orbit_ns UUID := '00000000-0000-0000-0000-000000000002';
    galactic_ns UUID := '00000000-0000-0000-0000-000000000003';
    
    nano_id UUID := deterministic_uuid(nano_ns, 'tenant');
    orbit_id UUID := deterministic_uuid(orbit_ns, 'tenant');
    galactic_id UUID := deterministic_uuid(galactic_ns, 'tenant');
BEGIN
    -- 1. Create Tenants
    INSERT INTO tenants (id, name, plan) VALUES
        (nano_id, 'Nano Inc', 'free'),
        (orbit_id, 'Orbit Systems', 'pro'),
        (galactic_id, 'Galactic Holdings', 'enterprise');

    -- 2. Seed Nano Inc (50 employees, Flat)
    INSERT INTO employees (id, tenant_id, manager_id, name, salary, org_path)
    SELECT
        deterministic_uuid(nano_ns, i::text),
        nano_id,
        CASE WHEN i = 1 THEN NULL ELSE deterministic_uuid(nano_ns, '1') END,
        'N_' || i,
        50000 + (random() * 50000)::int,
        CASE 
            WHEN i = 1 THEN text2ltree(replace(deterministic_uuid(nano_ns, '1')::text, '-', '_'))
            ELSE text2ltree(replace(deterministic_uuid(nano_ns, '1')::text, '-', '_') || '.' || replace(deterministic_uuid(nano_ns, i::text)::text, '-', '_'))
        END
    FROM generate_series(1, 50) i;

    -- 3. Seed Orbit Systems (5,000 employees, Depth ~5)
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

-- 4. Seed Galactic Holdings (1,000,000 employees)
-- OPTIMIZED: 3-Tier Shallow Tree (Root -> 1000 Managers -> 1000 Employees each)
-- This avoids deep recursion timeouts.

DO $$
DECLARE
    galactic_ns UUID := '00000000-0000-0000-0000-000000000003';
    galactic_id UUID := deterministic_uuid(galactic_ns, 'tenant');
    root_id UUID := deterministic_uuid(galactic_ns, '1');
    root_path ltree := text2ltree(replace(root_id::text, '-', '_'));
BEGIN
    -- Tier 1: CEO (1 row)
    INSERT INTO employees (id, tenant_id, manager_id, name, salary, org_path)
    VALUES (root_id, galactic_id, NULL, 'G_1', 100000, root_path);

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
    -- Each VP (Tier 2) manages ~1000 employees.
    -- Parent mapping: (i - 1002) / 1000 + 2
    -- Example: 
    -- i=1002 -> parent=2 (First VP)
    -- i=2001 -> parent=2
    -- i=2002 -> parent=3 (Second VP)
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

-- Re-enable triggers
ALTER TABLE employees ENABLE TRIGGER trg_maintain_org_path;
