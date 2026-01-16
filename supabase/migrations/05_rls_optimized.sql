-- Migration 05: RLS Optimization with Custom Claims
-- Goal: Secure RLS using JWT claims while maintaining session flexibility for the dashboard.

-- 1. Helper to set session tenant (for the Dashboard Switcher)
CREATE OR REPLACE FUNCTION set_session_tenant(tid uuid) 
RETURNS text 
LANGUAGE plpgsql 
SECURITY DEFINER
AS $$
BEGIN
    PERFORM set_config('app.current_tenant', tid::text, false);
    RETURN 'OK';
END;
$$;

-- 2. Update Tenants Policy
DROP POLICY IF EXISTS tenant_isolation_tenants ON tenants;
CREATE POLICY tenant_isolation_tenants ON tenants
    USING (
        id = COALESCE(
            (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid,
            current_setting('app.current_tenant', true)::uuid
        )
        OR 
        (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
    );

-- 3. Update Employees Policy (Primary target for 1M rows)
DROP POLICY IF EXISTS tenant_isolation_employees ON employees;
CREATE POLICY tenant_isolation_employees ON employees
    USING (
        -- Primary: Check JWT claim (High performance, no session overhead)
        -- Secondary: Check session variable (For Dashboard Switcher / God Mode)
        tenant_id = COALESCE(
            (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid,
            current_setting('app.current_tenant', true)::uuid
        )
        OR
        -- Global Admin bypass
        (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
    );

-- 4. Grant access to these helpers
GRANT EXECUTE ON FUNCTION set_session_tenant(uuid) TO anon, authenticated, service_role;
