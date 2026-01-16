-- Phase 10: Update RPC for Party Model
-- This updates fetch_employees_secure to query the new polymorphic structure.

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

    -- 1. Optimized Count (Fast index scan on memberships) - Only if start is 0
    IF arg_start = 0 THEN
        SELECT count(*) INTO v_total_rows
        FROM party_memberships m
        JOIN parties p ON m.person_id = p.id
        WHERE m.tenant_id = arg_tenant_id
        AND (arg_filter_name = '' OR p.display_name ILIKE '%' || arg_filter_name || '%');
    ELSE
        v_total_rows := -1;
    END IF;

    -- 2. Construct Safe Sort Clause
    -- We map the sort columns to the new structure
    v_order_clause := (CASE
        WHEN arg_sort_col = 'name' THEN 'p.display_name'
        WHEN arg_sort_col = 'salary' THEN 'm.salary'
        ELSE 'p.created_at'
    END) || ' ' || (CASE WHEN upper(arg_sort_dir) = 'ASC' THEN 'ASC' ELSE 'DESC' END);

    -- 3. Dynamic Late Row Look-up from the new structure
    v_dynamic_query := 'WITH keys AS (
        SELECT m_inner.id FROM party_memberships m_inner
        JOIN parties p_inner ON m_inner.person_id = p_inner.id
        WHERE m_inner.tenant_id = $1 AND ($2 = '''' OR p_inner.display_name ILIKE ''%'' || $2 || ''%'')
        ORDER BY ' || v_order_clause || '
        OFFSET $3 LIMIT $4
    )
    SELECT p.id as ret_id, p.display_name as ret_name, m.salary as ret_salary, m.org_path as ret_org_path, p.created_at as ret_created_at, $5
    FROM party_memberships m
    JOIN parties p ON m.person_id = p.id
    JOIN keys k ON m.id = k.id
    ORDER BY ' || v_order_clause;

    RETURN QUERY EXECUTE v_dynamic_query
    USING arg_tenant_id, arg_filter_name, arg_start, arg_limit, v_total_rows;
END;
$$;
