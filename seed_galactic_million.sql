-- Phase 4: Galactic Million Stress Test (Batched Version)
-- Run these one at a time if the total script still feels heavy.

SET statement_timeout = 600000;
ALTER TABLE employees DISABLE TRIGGER trg_maintain_org_path;

-- 1. CLEANUP & INITIAL SETUP (Run this first)
DO $$
DECLARE
    galactic_id UUID := '00000000-0000-0000-0000-000000000003';
BEGIN
    DELETE FROM employees WHERE tenant_id = galactic_id;
END $$;

-- 2. BATCH 1: Rows 1 to 250,000
WITH RECURSIVE tree_batch AS (
    SELECT 
        i,
        'G_' || i as name,
        50000 + (random() * 50000)::int as salary,
        ('00000000-0000-0000-0000-' || LPAD(i::text, 12, '0'))::uuid as emp_id,
        CASE WHEN i = 1 THEN NULL ELSE ('00000000-0000-0000-0000-' || LPAD((floor((i - 2) / 3) + 1)::text, 12, '0'))::uuid END as mgr_id,
        text2ltree(replace(('00000000-0000-0000-0000-' || LPAD(i::text, 12, '0'))::text, '-', '_')) as path,
        1 as depth
    FROM generate_series(1, 1) i
    UNION ALL
    SELECT 
        i + 1,
        'G_' || (i + 1),
        50000 + (random() * 50000)::int,
        ('00000000-0000-0000-0000-' || LPAD((i + 1)::text, 12, '0'))::uuid,
        ('00000000-0000-0000-0000-' || LPAD((floor((i - 1) / 3) + 1)::text, 12, '0'))::uuid,
        text2ltree('path_will_be_calc_in_step_3'), -- Placeholder
        0
    FROM tree_batch WHERE i < 250000
)
-- To avoid the recursive path calculation bottleneck, 
-- we will use the mathematically derived manager IDs and then
-- a separate step to fix the ltree if needed, but for STRESS testing,
-- we can insert with a simplified path or use the recursive CTE 
-- just for the batch range.
INSERT INTO employees (id, tenant_id, manager_id, name, salary, org_path)
SELECT emp_id, '00000000-0000-0000-0000-000000000003', mgr_id, name, salary, NULL
FROM tree_batch;

-- [Instruction for User: I will provide a simpler, faster way below that avoids Recursive CTE entirely]
