-- Phase 7: Galactic Seeding PART 1 (Rows 1 - 250,000)
-- Run this AFTER 13_galactic_setup.sql

DO $$
DECLARE
    galactic_id UUID := '00000000-0000-0000-0000-000000000003';
BEGIN
    -- Cleanup previous galactic data for this tenant
    DELETE FROM employees WHERE tenant_id = galactic_id;

    INSERT INTO employees (tenant_id, name, salary, org_path)
    SELECT 
        galactic_id,
        'Galactic ' || i as name,
        (random() * 100000 + 30000)::int as salary,
        text2ltree('corp.dept' || ((i % 10) + 1) || '.team' || ((i % 100) + 1)) as org_path
    FROM generate_series(1, 250000) s(i);
END $$;
