-- Part 1: Setup & Nano Inc
-- Run this FIRST.

-- 1. Cleanup & Config
SET statement_timeout = 60000;
TRUNCATE TABLE employees, tenants CASCADE;
ALTER TABLE employees DISABLE TRIGGER trg_maintain_org_path;

-- 2. Helper Function (Must verify it exists)
CREATE OR REPLACE FUNCTION deterministic_uuid(namespace uuid, key text) RETURNS uuid AS $$
BEGIN
    RETURN uuid_generate_v5(namespace, key);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

DO $$
DECLARE
    -- Namespaces
    nano_ns UUID := '00000000-0000-0000-0000-000000000001';
    orbit_ns UUID := '00000000-0000-0000-0000-000000000002';
    galactic_ns UUID := '00000000-0000-0000-0000-000000000003';
    
    nano_id UUID := deterministic_uuid(nano_ns, 'tenant');
    orbit_id UUID := deterministic_uuid(orbit_ns, 'tenant');
    galactic_id UUID := deterministic_uuid(galactic_ns, 'tenant');
BEGIN
    -- 3. Create ALL Tenants (so IDs exist for later scripts)
    INSERT INTO tenants (id, name, plan) VALUES
        (nano_id, 'Nano Inc', 'free'),
        (orbit_id, 'Orbit Systems', 'pro'),
        (galactic_id, 'Galactic Holdings', 'enterprise');

    -- 4. Seed Nano Inc (50 employees)
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
    
END $$;
