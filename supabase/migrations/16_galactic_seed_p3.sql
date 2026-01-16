-- Phase 7: Galactic Seeding PART 3 (Rows 500,001 - 750,000)
DO $$
DECLARE
    galactic_id UUID := '00000000-0000-0000-0000-000000000003';
BEGIN
    INSERT INTO employees (tenant_id, name, salary, org_path)
    SELECT 
        galactic_id,
        'Galactic ' || i as name,
        (random() * 100000 + 30000)::int as salary,
        text2ltree('corp.dept' || ((i % 10) + 1) || '.team' || ((i % 100) + 1)) as org_path
    FROM generate_series(500001, 750000) s(i);
END $$;
