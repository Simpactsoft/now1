-- Migration 10: Hierarchical Analytics functions
-- Optimized for 1M+ rows using ltree indexes.

CREATE OR REPLACE FUNCTION get_org_analytics(
    p_tenant_id uuid,
    p_base_path ltree DEFAULT ''::ltree
)
RETURNS TABLE (
    sub_path text,
    direct_employees bigint,
    total_employees_in_branch bigint,
    total_salary_in_branch bigint,
    avg_salary_in_branch numeric
) AS $$
BEGIN
    -- Ensure isolation
    PERFORM set_config('app.current_tenant', p_tenant_id::text, true);

    RETURN QUERY
    WITH department_nodes AS (
        -- Find immediate children of the base_path
        -- If base_path is empty, we find top-level nodes (depth 1)
        SELECT DISTINCT 
            CASE 
                WHEN p_base_path = ''::ltree THEN subpath(org_path, 0, 1)
                ELSE subpath(org_path, 0, nlevel(p_base_path) + 1)
            END as dept_path
        FROM employees
        WHERE 
            tenant_id = p_tenant_id
            AND (p_base_path = ''::ltree OR org_path <@ p_base_path)
    )
    SELECT 
        dn.dept_path::text,
        -- Count employees exactly AT this path
        (SELECT count(*) FROM employees e WHERE e.tenant_id = p_tenant_id AND e.org_path = dn.dept_path),
        -- Count all employees in this branch (recursive)
        (SELECT count(*) FROM employees e WHERE e.tenant_id = p_tenant_id AND e.org_path <@ dn.dept_path),
        -- Sum salary in this branch
        (SELECT COALESCE(sum(salary), 0)::bigint FROM employees e WHERE e.tenant_id = p_tenant_id AND e.org_path <@ dn.dept_path),
        -- Avg salary
        (SELECT COALESCE(avg(salary), 0)::numeric(12,2) FROM employees e WHERE e.tenant_id = p_tenant_id AND e.org_path <@ dn.dept_path)
    FROM department_nodes dn
    ORDER BY dn.dept_path;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Global stats summary function
CREATE OR REPLACE FUNCTION get_tenant_summary(p_tenant_id uuid)
RETURNS TABLE (
    total_employees bigint,
    total_payroll bigint,
    avg_salary numeric,
    max_depth int
) AS $$
BEGIN
    PERFORM set_config('app.current_tenant', p_tenant_id::text, true);

    RETURN QUERY
    SELECT 
        count(*),
        COALESCE(sum(salary), 0)::bigint,
        COALESCE(avg(salary), 0)::numeric(12,2),
        COALESCE(max(nlevel(org_path)), 0)
    FROM employees
    WHERE tenant_id = p_tenant_id;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_org_analytics(uuid, ltree) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION get_tenant_summary(uuid) TO anon, authenticated, service_role;
