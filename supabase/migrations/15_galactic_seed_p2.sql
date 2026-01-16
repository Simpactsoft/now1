-- Phase 7: Galactic Seeding PART 2 (Rows 250,001 - 500,000)
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
    FROM generate_series(250001, 500000) s(i);
END $$;
