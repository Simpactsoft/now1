-- Phase 7: Batched Seeding RPC
-- This allows us to inject data programmatically in small bites.

CREATE OR REPLACE FUNCTION galactic_batch_insert(p_start_idx INT, p_batch_size INT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    galactic_id UUID := '00000000-0000-0000-0000-000000000003';
BEGIN
    INSERT INTO employees (tenant_id, name, salary, org_path)
    SELECT 
        galactic_id,
        'Galactic ' || i as name,
        (random() * 100000 + 30000)::int as salary,
        text2ltree('corp.dept' || ((i % 10) + 1) || '.team' || ((i % 100) + 1)) as org_path
    FROM generate_series(p_start_idx, p_start_idx + p_batch_size - 1) s(i);
END;
$$;

GRANT EXECUTE ON FUNCTION galactic_batch_insert(INT, INT) TO authenticated, anon;
