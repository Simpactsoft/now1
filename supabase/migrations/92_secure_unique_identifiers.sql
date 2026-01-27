-- Migration: 92_secure_unique_identifiers.sql
-- Description: Secures the 'unique_identifiers' table (created in migrate 88) by enabling RLS and adding strict policies.
-- Security Model: Strict Tenant Isolation using JWT Claims (High Performance).

BEGIN;

-- 1. Enable RLS
ALTER TABLE unique_identifiers ENABLE ROW LEVEL SECURITY;

-- 2. Define Policies
-- We use the High Performance pattern: using JWT claims directly to avoid Join/Subquery penalties.
-- Assuming 'app_metadata' -> 'tenant_id' is the standard claim location as per Migration 04/09.

-- POLICY: VIEW (SELECT)
-- Users can only see identifiers belonging to their tenant.
CREATE POLICY "Tenant Isolation Select" ON unique_identifiers
    FOR SELECT
    USING (
        tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid
    );

-- POLICY: INSERT
-- Users can only insert identifiers for their own tenant.
-- We also enforce that the inserted tenant_id matches the token to prevent spoofing.
CREATE POLICY "Tenant Isolation Insert" ON unique_identifiers
    FOR INSERT
    WITH CHECK (
        tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid
    );

-- POLICY: UPDATE
-- Users can update identifiers for their own tenant.
CREATE POLICY "Tenant Isolation Update" ON unique_identifiers
    FOR UPDATE
    USING (
        tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid
    )
    WITH CHECK (
        tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid
    );

-- POLICY: DELETE
-- Users can delete identifiers for their own tenant.
CREATE POLICY "Tenant Isolation Delete" ON unique_identifiers
    FOR DELETE
    USING (
        tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid
    );

-- 3. Service Role Bypass (For Admin/System operations)
-- Service Role needs full access to manage data across tenants if necessary (e.g. background jobs)
-- However, generally explicit policies for service_role are safer than implicit bypass if we want to be strict,
-- but standard Supabase practice allows service_role to bypass RLS by default. 
-- Just in case explicit grant is needed or if we want to be documented:
CREATE POLICY "Service Role Full Access" ON unique_identifiers
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

COMMIT;
