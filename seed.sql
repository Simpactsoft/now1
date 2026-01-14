-- Phase 2: Massive Data Seeding
-- Optimized for speed. Run this in Supabase SQL Editor.

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
    nano_id UUID := gen_random_uuid();
    orbit_id UUID := gen_random_uuid();
    galactic_id UUID := gen_random_uuid();
    
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
    -- Manager: N_CEO (ID: 1). Others report to 1.
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
    -- Fanout: ~5-10. 
    -- Logic: Manager = floor((i-2)/5) + 1. (Index 1 is CEO).
    INSERT INTO employees (id, tenant_id, manager_id, name, salary, org_path)
    WITH RECURSIVE hierarchy AS (
        -- Root
        SELECT 
            1 as i, 
            deterministic_uuid(orbit_ns, '1') as uuid, 
            NULL::uuid as manager_uuid, 
            text2ltree(replace(deterministic_uuid(orbit_ns, '1')::text, '-', '_')) as path
        
        UNION ALL
        
        -- Children
        SELECT 
            i,
            deterministic_uuid(orbit_ns, i::text),
            h.uuid,
            h.path || text2ltree(replace(deterministic_uuid(orbit_ns, i::text)::text, '-', '_'))
        FROM generate_series(2, 5000) i
        JOIN hierarchy h ON h.i = floor((i - 2) / 6) + 1 -- Fanout 6
    )
    SELECT 
        uuid, orbit_id, manager_uuid, 'O_' || i, 60000 + (random() * 40000)::int, path
    FROM hierarchy;

    -- 4. Seed Galactic Holdings (1,000,000 employees)
    -- OPTIMIZED GENERATION
    -- Using a mathematical approach to avoid deep recursion overhead for 1M rows? 
    -- Actually, simple generate_series with calculated path might be faster if we limit depth.
    -- Strict math: i (child) -> i/10 (parent).
    -- Path: 1 -> 1.
    -- 10 -> 1.10
    -- 100 -> 1.10.100
    -- We can construct the path string using string manipulation functions or arrays.
    
    -- Function to build path string numerically: 1.10.100
    -- Then we replace with UUIDs? That's expensive.
    --
    -- COMPROMISE for Performance: 
    -- For Galactic, to hit < 30s, we might use a simplified path structure OR 
    -- ensure the levels are generated in batches.
    -- 
    -- Let's stick to the "Correct" UUID path but optimized.
    -- Since we can't easily compute UUID path mathematically without lookups,
    -- allow a simpler "simulated" path for the Stress Test volume?
    -- No, User asked for "Highest Standards".
    -- 
    -- FASTEST WAY:
    -- Use a temporary table or CTE to generate levels.
    -- Start with 1.
    -- Insert Level 1 (10 items).
    -- Insert Level 2 (100 items).
    -- ...
    
    DECLARE
        level_start INT := 1;
        level_end INT := 1;
        current_level INT := 0;
        fanout CONSTANT INT := 10;
        total_target CONSTANT INT := 1000000;
        
    BEGIN
        -- Insert Root (ID 1)
        INSERT INTO employees (id, tenant_id, manager_id, name, salary, org_path)
        VALUES (
            deterministic_uuid(galactic_ns, '1'),
            galactic_id,
            NULL,
            'G_1',
            100000,
            text2ltree(replace(deterministic_uuid(galactic_ns, '1')::text, '-', '_'))
        );

        -- Loop levels until we hit total
        -- Level 1: 2..11 (10 items)  Manager: 1.
        -- Level 2: 12..111 (100 items). Manager: (parent from prev level).
        -- To be efficient, we can map ID strictly:
        -- Parent(i) = floor((i - 2) / fanout) + 1. (Standard Heap array logic).
        
        -- Since RECURSIVE CTE is clean, let's try to see if it holds for 1M.
        -- Batch size approach:
        -- Insert 1..1M.
        -- We can just compute the parent ID mathematically.
        -- But PATH requires the chain.
        -- 
        -- "Method: Use generate_series and calculating ltree paths in memory (CTE)"
        -- I will trust Postgres CTE engine for this.
        -- Note: Limit recursion depth if needed, but here depth is log10(1M) = 6.
        -- The issue is the join volume.
        
        -- To prevent memory explosion in one go, maybe chunk it?
        -- Actually 1M rows in a CTE might be pushing it for 'standard' un-tuned dev DB.
        -- PROPOSAL: Use a simplified path for Galactic to ensure success?
        -- "Top.Distributor..." -> user example.
        -- 
        -- Real Optimization:
        -- Just insert them without paths first? No, "bypass trigger".
        -- 
        -- Let's do a strict mathematical path generation using a custom function or simple loop logic.
        -- Or assume 1M is fast enough on server.
        -- 
        -- I'll use the HEAP logic: parent = floor((i-2)/10) + 1.
        -- And I will accept that generating 1M UUID paths in a CTE is the proposed solution.
        --
    END;
END $$;

-- Execution for Galactic (Separate Statement to avoid transaction timeout/limits if coupled)
-- Using a standard recursive CTE for 1M rows.
WITH RECURSIVE galactic_tree AS (
    SELECT 
        1 AS i, 
        deterministic_uuid('00000000-0000-0000-0000-000000000003', '1') AS id, 
        NULL::uuid AS manager_id, 
        text2ltree(replace(deterministic_uuid('00000000-0000-0000-0000-000000000003', '1')::text, '-', '_')) AS path
    UNION ALL
    SELECT 
        i,
        deterministic_uuid('00000000-0000-0000-0000-000000000003', i::text),
        parent.id,
        parent.path || text2ltree(replace(deterministic_uuid('00000000-0000-0000-0000-000000000003', i::text)::text, '-', '_'))
    FROM generate_series(2, 1000000) i
    JOIN galactic_tree parent ON parent.i = floor((i - 2) / 10) + 1
)
INSERT INTO employees (id, tenant_id, manager_id, name, salary, org_path)
SELECT 
    id, 
    deterministic_uuid('00000000-0000-0000-0000-000000000003', 'tenant'), -- Tenant ID
    manager_id, 
    'G_' || i, 
    50000, 
    path
FROM galactic_tree;

-- Re-enable triggers
ALTER TABLE employees ENABLE TRIGGER trg_maintain_org_path;
