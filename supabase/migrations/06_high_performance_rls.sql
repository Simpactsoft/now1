-- Migration 06: High Performance RLS
-- Optimized for 1M+ rows index scanning.

-- 1. Split the policy into two: one for JWT, one for Session Variables.
-- This allows the Postgres optimizer to hit the index more reliably.

-- Cleanup
DROP POLICY IF EXISTS tenant_isolation_employees ON employees;

-- Level 1: JWT Access (Ideal for production)
CREATE POLICY employees_jwt_isolation ON employees
    FOR ALL
    TO authenticated
    USING (
        tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid
    );

-- Level 2: Session Variable Access (For Dashboard / God Mode Switcher)
CREATE POLICY employees_session_isolation ON employees
    FOR ALL
    TO anon, authenticated, service_role
    USING (
        tenant_id = current_setting('app.current_tenant', true)::uuid
    );

-- Level 3: Service Role / Admin Bypass
CREATE POLICY employees_admin_bypass ON employees
    FOR ALL
    TO service_role
    USING (true);

-- 2. Optimize the session setter
CREATE OR REPLACE FUNCTION set_session_tenant(tid uuid) 
RETURNS text 
LANGUAGE plpgsql 
SECURITY DEFINER
AS $$
BEGIN
    -- Set the config for the current transaction/session.
    -- Using false for is_local ensures it persists across the transaction if needed,
    -- but usually Server Actions handle this per request.
    PERFORM set_config('app.current_tenant', tid::text, false);
    RETURN 'OK';
END;
$$;

GRANT EXECUTE ON FUNCTION set_session_tenant(uuid) TO anon, authenticated, service_role;
