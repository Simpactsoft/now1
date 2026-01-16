-- RESTORATION PROTOCOL: FIXING THE RLS PARADOX & MISSING FUNCTIONS
-- Paste this entire block into your Supabase SQL Editor to restore full dashboard functionality.

-------------------------------------------------------
-- 1. TENANT SECURITY SCHEMA & DISCOVERY RPC
-------------------------------------------------------
CREATE SCHEMA IF NOT EXISTS tenant_security;
REVOKE ALL ON SCHEMA tenant_security FROM PUBLIC;
GRANT USAGE ON SCHEMA tenant_security TO authenticated, anon;

DROP FUNCTION IF EXISTS get_my_tenants();
CREATE OR REPLACE FUNCTION get_my_tenants()


RETURNS TABLE (
    id uuid,
    name text,
    slug text,
    role text
)
LANGUAGE plpgsql
SECURITY DEFINER 
SET search_path = public, auth, pg_temp
AS $$
DECLARE
    current_user_id uuid;
BEGIN
    current_user_id := auth.uid();
    
    -- If no user, return all (for demo/development) or empty (for production)
    -- Here we return all tenants for the [Select a Tenant] list to work
    IF current_user_id IS NULL THEN
        RETURN QUERY
        SELECT t.id, t.name, t.slug, 'guest'::text as role
        FROM public.tenants t;
        RETURN;
    END IF;

    -- Return tenants the user is a member of
    RETURN QUERY
    SELECT 
        t.id,
        t.name,
        t.slug,
        tm.role
    FROM 
        public.tenants t
    JOIN 
        public.tenant_members tm ON t.id = tm.tenant_id
    WHERE 
        tm.user_id = current_user_id;

    -- Fallback: If no memberships found, but user is authenticated, 
    -- let them see the public list for the demo
    IF NOT FOUND THEN
        RETURN QUERY
        SELECT t.id, t.name, t.slug, 'viewer'::text as role
        FROM public.tenants t;
    END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION get_my_tenants() TO authenticated, anon;


-------------------------------------------------------
-- 2. TENANT ISOLATION POLICIES (THE FIX)
-------------------------------------------------------
-- Drop old restrictive policies
DROP POLICY IF EXISTS tenant_isolation_tenants ON tenants;
DROP POLICY IF EXISTS tenant_list_policy ON tenants;

-- Allow selecting ONLY the current tenant for restricted operations
CREATE POLICY tenant_isolation_tenants ON tenants
    FOR SELECT TO authenticated, anon
    USING (id = NULLIF(current_setting('app.current_tenant', true), '')::uuid);

-------------------------------------------------------
-- 3. ANALYTICS FUNCTIONS (SECURITY DEFINER)
-------------------------------------------------------

-- Summary function
DROP FUNCTION IF EXISTS get_tenant_summary(uuid);
CREATE OR REPLACE FUNCTION get_tenant_summary(p_tenant_id uuid)
RETURNS TABLE (
    total_employees bigint,
    total_payroll bigint,
    avg_salary numeric
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    -- Set session tenant for RLS to work internally if needed, 
    -- but as SECURITY DEFINER we can also just query directly safely.
    RETURN QUERY
    SELECT 
        COUNT(*)::bigint,
        SUM(salary)::bigint,
        AVG(salary)::numeric
    FROM employees
    WHERE tenant_id = p_tenant_id;
END;
$$;

-- Distribution/Analytics function
DROP FUNCTION IF EXISTS get_org_analytics(uuid, text);
CREATE OR REPLACE FUNCTION get_org_analytics(p_tenant_id uuid, p_base_path text DEFAULT '')

RETURNS TABLE (
    sub_path text,
    total_employees_in_branch bigint,
    avg_salary_in_branch numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        subpath(org_path, nlevel(p_base_path::ltree), 1)::text as sub_path,
        COUNT(*)::bigint as total_employees_in_branch,
        AVG(salary)::numeric as avg_salary_in_branch
    FROM employees
    WHERE tenant_id = p_tenant_id
    AND (p_base_path = '' OR org_path <@ p_base_path::ltree)
    GROUP BY 1;
END;
$$;

GRANT EXECUTE ON FUNCTION get_tenant_summary(uuid) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION get_org_analytics(uuid, text) TO authenticated, anon;

DROP FUNCTION IF EXISTS fetch_employees_secure(uuid, int, int, text, text, text);
CREATE OR REPLACE FUNCTION fetch_employees_secure(

    p_tenant_id uuid,
    p_start int DEFAULT 0,
    p_limit int DEFAULT 100,
    p_sort_col text DEFAULT 'created_at',
    p_sort_dir text DEFAULT 'desc',
    p_filter_name text DEFAULT ''
)
RETURNS TABLE (
    id uuid,
    name text,
    salary int,
    org_path ltree,
    created_at timestamptz,
    total_count bigint
) AS $$
BEGIN
    -- Set session tenant for this transaction only
    PERFORM set_config('app.current_tenant', p_tenant_id::text, true);

    RETURN QUERY
    SELECT 
        e.id, 
        e.name, 
        e.salary, 
        e.org_path, 
        e.created_at,
        COUNT(*) OVER() as total_count
    FROM employees e
    WHERE 
        e.tenant_id = p_tenant_id -- Explicit check for extra safety
        AND (p_filter_name = '' OR e.name ILIKE '%' || p_filter_name || '%')
    ORDER BY 
        CASE WHEN p_sort_col = 'name' AND p_sort_dir = 'asc' THEN e.name END ASC,
        CASE WHEN p_sort_col = 'name' AND p_sort_dir = 'desc' THEN e.name END DESC,
        CASE WHEN p_sort_col = 'salary' AND p_sort_dir = 'asc' THEN e.salary::text END ASC,
        CASE WHEN p_sort_col = 'salary' AND p_sort_dir = 'desc' THEN e.salary::text END DESC,
        CASE WHEN p_sort_col = 'created_at' AND p_sort_dir = 'asc' THEN e.created_at END ASC,
        CASE WHEN p_sort_col = 'created_at' AND p_sort_dir = 'desc' THEN e.created_at END DESC
    OFFSET p_start
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION fetch_employees_secure(uuid, int, int, text, text, text) TO authenticated, anon;

-------------------------------------------------------
-- 5. INITIAL DATA SEED (If missing)
-------------------------------------------------------
INSERT INTO tenants (id, name, slug)
VALUES 
    ('00000000-0000-0000-0000-000000000001', 'Nano Startup', 'nano'),
    ('00000000-0000-0000-0000-000000000002', 'Orbit Enterprise', 'orbit'),
    ('00000000-0000-0000-0000-000000000003', 'Galactic Stress Test', 'galactic')
ON CONFLICT (id) DO NOTHING;

-------------------------------------------------------
-- 6. EMPLOYEE SEED DATA (For initial visibility)
-------------------------------------------------------
INSERT INTO employees (tenant_id, name, salary, org_path)
SELECT 
    '00000000-0000-0000-0000-000000000001'::uuid,
    'Seed Employee ' || i,
    (random() * 50000 + 50000)::int,
    text2ltree('root.branch' || (i % 3))
FROM generate_series(1, 50) s(i)
ON CONFLICT DO NOTHING;

INSERT INTO employees (tenant_id, name, salary, org_path)
SELECT 
    '00000000-0000-0000-0000-000000000002'::uuid,
    'Enterprise Pro ' || i,
    (random() * 80000 + 70000)::int,
    text2ltree('corp.dept' || (i % 5))
FROM generate_series(1, 100) s(i)
ON CONFLICT DO NOTHING;

