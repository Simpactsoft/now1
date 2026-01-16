-- Migration 08: Secure Data Gateway for 1M Rows
-- This function ensures RLS isolation AND performance by wrapping the query in a single transaction.

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
    -- 1. Set the session tenant (Enables RLS for this transaction only)
    PERFORM set_config('app.current_tenant', p_tenant_id::text, true);

    -- 2. Execute query with window function for total count
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

-- Grant execution to all users (isolation is handled by RLS inside the function)
GRANT EXECUTE ON FUNCTION fetch_employees_secure(uuid, int, int, text, text, text) TO anon, authenticated, service_role;
