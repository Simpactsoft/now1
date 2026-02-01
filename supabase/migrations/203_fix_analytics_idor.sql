

-- Migration: 203_fix_analytics_idor.sql
-- Description: Secures analytics functions against IDOR by enforcing tenant ownership.
-- Severity: CRITICAL
-- Author: Antigravity (Opus 4.5 Remediation)

BEGIN;

-- [FIX] Drop existing functions first because return types might have changed or conflict
DROP FUNCTION IF EXISTS get_org_analytics(uuid, ltree);
DROP FUNCTION IF EXISTS get_tenant_summary(uuid);


-- 1. Secure get_org_analytics
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
DECLARE
    v_auth_tenant_id uuid;
BEGIN
    -- [SECURITY PATCH] Validate Tenant Ownership
    -- Trust anchor: auth.uid() -> profiles.tenant_id
    SELECT tenant_id INTO v_auth_tenant_id
    FROM public.profiles
    WHERE id = auth.uid();

    IF v_auth_tenant_id IS DISTINCT FROM p_tenant_id THEN
        RAISE EXCEPTION 'Access Denied: You do not belong to this tenant.';
    END IF;

    -- Ensure context
    PERFORM set_config('app.current_tenant', p_tenant_id::text, true);

    RETURN QUERY
    WITH department_nodes AS (
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
        (SELECT count(*) FROM employees e WHERE e.tenant_id = p_tenant_id AND e.org_path = dn.dept_path),
        (SELECT count(*) FROM employees e WHERE e.tenant_id = p_tenant_id AND e.org_path <@ dn.dept_path),
        (SELECT COALESCE(sum(salary), 0)::bigint FROM employees e WHERE e.tenant_id = p_tenant_id AND e.org_path <@ dn.dept_path),
        (SELECT COALESCE(avg(salary), 0)::numeric(12,2) FROM employees e WHERE e.tenant_id = p_tenant_id AND e.org_path <@ dn.dept_path)
    FROM department_nodes dn
    ORDER BY dn.dept_path;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- 2. Secure get_tenant_summary
CREATE OR REPLACE FUNCTION get_tenant_summary(p_tenant_id uuid)
RETURNS TABLE (
    total_employees bigint,
    total_payroll bigint,
    avg_salary numeric,
    max_depth int
) AS $$
DECLARE
    v_auth_tenant_id uuid;
BEGIN
    -- [SECURITY PATCH] Validate Tenant Ownership
    SELECT tenant_id INTO v_auth_tenant_id
    FROM public.profiles
    WHERE id = auth.uid();

    IF v_auth_tenant_id IS DISTINCT FROM p_tenant_id THEN
        RAISE EXCEPTION 'Access Denied: You do not belong to this tenant.';
    END IF;

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


COMMIT;
