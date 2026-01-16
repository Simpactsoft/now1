-- Part 6: Galactic Batch 3 (Rows 500,001 - 750,000)
-- Run this SIXTH.

SET statement_timeout = 60000;
ALTER TABLE employees DISABLE TRIGGER trg_maintain_org_path;

DO $$
DECLARE
    galactic_ns UUID := '00000000-0000-0000-0000-000000000003';
    galactic_id UUID := deterministic_uuid(galactic_ns, 'tenant');
    root_id UUID := deterministic_uuid(galactic_ns, '1');
    root_path ltree := text2ltree(replace(root_id::text, '-', '_'));
BEGIN
    INSERT INTO employees (id, tenant_id, manager_id, name, salary, org_path)
    SELECT
        deterministic_uuid(galactic_ns, i::text),
        galactic_id,
        deterministic_uuid(galactic_ns, (floor((i - 1002) / 999) + 2)::text),
        'G_' || i,
        50000,
        root_path || 
        text2ltree(replace(deterministic_uuid(galactic_ns, (floor((i - 1002) / 999) + 2)::text)::text, '-', '_')) || 
        text2ltree(replace(deterministic_uuid(galactic_ns, i::text)::text, '-', '_'))
    FROM generate_series(500001, 750000) i
    ON CONFLICT (id) DO NOTHING;
END $$;
