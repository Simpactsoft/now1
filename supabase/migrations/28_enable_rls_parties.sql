-- Phase 13: Infrastructure Hardening - Security (RLS)
-- Enabling Row Level Security on all Party Model tables to ensure strict tenant isolation.

-- 1. Enable RLS on tables
ALTER TABLE parties ENABLE ROW LEVEL SECURITY;
ALTER TABLE people ENABLE ROW LEVEL SECURITY;
ALTER TABLE organizations_ext ENABLE ROW LEVEL SECURITY;
ALTER TABLE party_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE action_timeline ENABLE ROW LEVEL SECURITY;

-- 2. Create Policy: Tenant Isolation
-- Users can only SELECT/INSERT/UPDATE/DELETE rows where the tenant_id matches their session config.
-- This relies on the app setting `app.current_tenant` (which our RPCs do).

-- Policy for PARTIES
DROP POLICY IF EXISTS tenant_isolation_parties ON parties;
CREATE POLICY tenant_isolation_parties ON parties
    USING (tenant_id = current_setting('app.current_tenant', true)::uuid)
    WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::uuid);

-- Policy for PEOPLE (Inherits tenant check via join to parties, or needs denormalized tenant_id)
-- Note: 'people' is a subtype 1:1 with 'parties'. We can check the parent 'parties' table or rely on join.
-- Ideally, subtypes should inherit RLS, but Postgres doesn't do inheritance RLS automatically for joined tables like this.
-- Optimization: We added tenant_id to parties, but people table relies on party_id.
-- To make RLS efficient on 'people' without joins, we often DENORMALIZE tenant_id to subtypes.
-- However, for now, we will perform a check against the parent 'parties' table.
DROP POLICY IF EXISTS tenant_isolation_people ON people;
CREATE POLICY tenant_isolation_people ON people
    USING (party_id IN (SELECT id FROM parties WHERE tenant_id = current_setting('app.current_tenant', true)::uuid))
    WITH CHECK (party_id IN (SELECT id FROM parties WHERE tenant_id = current_setting('app.current_tenant', true)::uuid));

-- Policy for PARTY_MEMBERSHIPS (Has distinct tenant_id)
DROP POLICY IF EXISTS tenant_isolation_memberships ON party_memberships;
CREATE POLICY tenant_isolation_memberships ON party_memberships
    USING (tenant_id = current_setting('app.current_tenant', true)::uuid)
    WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::uuid);

-- Policy for ACTION_TIMELINE (Has distinct tenant_id)
DROP POLICY IF EXISTS tenant_isolation_timeline ON action_timeline;
CREATE POLICY tenant_isolation_timeline ON action_timeline
    USING (tenant_id = current_setting('app.current_tenant', true)::uuid)
    WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::uuid);

-- 3. Explicitly allow Service Role (for seeding/admin scripts) to bypass RLS
-- (Service role uses a special role 'service_role' in Supabase)
-- Note: By default, service_role is a superuser or has bypassrls, but explicit policies are good for clarity.
-- Supabase service_role has BYPASSRLS attribute, so no specific policy needed for it.
