-- Migration 07: Fix Tenant Listing
-- Allows users to list tenants so they can pick one in the switcher.

DROP POLICY IF EXISTS tenant_isolation_tenants ON tenants;

CREATE POLICY tenant_list_policy ON tenants
    FOR SELECT
    TO anon, authenticated
    USING (true);

-- Ensure employees policy is still restrictive but performant
DROP POLICY IF EXISTS employees_session_isolation ON employees;
CREATE POLICY employees_session_isolation ON employees
    FOR SELECT
    TO anon, authenticated
    USING (
        tenant_id = current_setting('app.current_tenant', true)::uuid
    );
