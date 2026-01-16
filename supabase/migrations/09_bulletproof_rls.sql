-- Migration 09: Bulletproof RLS & Session Cleanup
-- This script removes all legacy policies that might be causing crashes.

-- 1. Remove ALL known policies across both tables to ensure a clean slate
DROP POLICY IF EXISTS tenant_isolation_tenants ON tenants;
DROP POLICY IF EXISTS tenant_list_policy ON tenants;
DROP POLICY IF EXISTS tenant_isolation_employees ON employees;
DROP POLICY IF EXISTS employees_jwt_isolation ON employees;
DROP POLICY IF EXISTS employees_session_isolation ON employees;
DROP POLICY IF EXISTS employees_admin_bypass ON employees;

-- 2. Clean Tenant Access (Everyone can list tenants for the switcher)
CREATE POLICY tenant_list_policy ON tenants
    FOR SELECT TO anon, authenticated
    USING (true);

-- 3. Strict Employee Access (Only through authenticated JWT or session variable)
-- Note: We use the second parameter 'true' in current_setting to prevent crashes when uninitialized.
CREATE POLICY employees_session_isolation ON employees
    FOR SELECT TO anon, authenticated, service_role
    USING (
        tenant_id = COALESCE(
            (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid,
            NULLIF(current_setting('app.current_tenant', true), '')::uuid
        )
    );

-- 4. Service Role God Mode
CREATE POLICY employees_admin_bypass ON employees
    FOR ALL TO service_role
    USING (true);

-- 5. Ensure the gateway function exists and is correctly defined
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
        (p_filter_name = '' OR e.name ILIKE '%' || p_filter_name || '%')
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

GRANT EXECUTE ON FUNCTION fetch_employees_secure(uuid, int, int, text, text, text) TO anon, authenticated, service_role;
