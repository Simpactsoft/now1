-- Phase 8 (Hardened): Ultra-Performance Pagination
-- Nuclear Fix: Use unique prefixes for EVERYTHING to avoid ambiguity

-- First, DROP the old function to ensure signature changes are accepted
DROP FUNCTION IF EXISTS fetch_employees_secure(uuid, int, int, text, text, text);

CREATE OR REPLACE FUNCTION fetch_employees_secure(
    arg_tenant_id uuid,
    arg_start int DEFAULT 0,
    arg_limit int DEFAULT 100,
    arg_sort_col text DEFAULT 'created_at',
    arg_sort_dir text DEFAULT 'desc',
    arg_filter_name text DEFAULT ''
)
RETURNS TABLE (
    ret_id uuid,
    ret_name text,
    ret_salary int,
    ret_org_path ltree,
    ret_created_at timestamptz,
    ret_total_count bigint
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
SET statement_timeout = '30s'
AS $$
DECLARE
    v_total_rows bigint;
    v_dynamic_query text;
    v_order_clause text;
BEGIN
    -- Set session tenant for this transaction only
    PERFORM set_config('app.current_tenant', arg_tenant_id::text, true);

    -- 1. Optimized Count (Fast index scan) - Only if start is 0
    IF arg_start = 0 THEN
        SELECT count(*) INTO v_total_rows 
        FROM employees emp
        WHERE emp.tenant_id = arg_tenant_id 
        AND (arg_filter_name = '' OR emp.name ILIKE '%' || arg_filter_name || '%');
    ELSE
        v_total_rows := -1;
    END IF;

    -- 2. Construct Safe Sort Clause (Explicitly aliased to emp.)
    v_order_clause := 'emp.' || (CASE 
        WHEN arg_sort_col = 'name' THEN 'name'
        WHEN arg_sort_col = 'salary' THEN 'salary'
        ELSE 'created_at'
    END) || ' ' || (CASE WHEN upper(arg_sort_dir) = 'ASC' THEN 'ASC' ELSE 'DESC' END);

    -- 3. Dynamic Late Row Look-up
    v_dynamic_query := 'WITH keys AS (
        SELECT emp_inner.id FROM employees emp_inner
        WHERE emp_inner.tenant_id = $1 AND ($2 = '''' OR emp_inner.name ILIKE ''%'' || $2 || ''%'')
        ORDER BY ' || replace(v_order_clause, 'emp.', 'emp_inner.') || '
        OFFSET $3 LIMIT $4
    )
    SELECT emp.id, emp.name, emp.salary, emp.org_path, emp.created_at, $5
    FROM employees emp JOIN keys k ON emp.id = k.id
    ORDER BY ' || v_order_clause;

    RETURN QUERY EXECUTE v_dynamic_query 
    USING arg_tenant_id, arg_filter_name, arg_start, arg_limit, v_total_rows;
END;
$$;
