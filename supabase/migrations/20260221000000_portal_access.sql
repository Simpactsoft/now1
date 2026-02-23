-- Migration for Client Portal Access
-- This table allows mapping external users (Auth Users) to specific tenants and customer cards (CRM).
-- It allows a single email to be mapped to their specific organization in the NOW system.

CREATE TABLE IF NOT EXISTS portal_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    auth_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    card_id UUID NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(auth_user_id, tenant_id) -- A user can only have one mapping per tenant
);

-- Enable RLS
ALTER TABLE portal_users ENABLE ROW LEVEL SECURITY;

-- 1. Tenants can read their own portal users
CREATE POLICY "Tenants can read their own portal users"
    ON portal_users FOR SELECT
    USING (tenant_id = (SELECT auth.jwt() ->> 'tenant_id')::uuid);

-- 2. Tenants can manage their portal users
CREATE POLICY "Tenants can manage their portal users"
    ON portal_users FOR ALL
    USING (tenant_id = (SELECT auth.jwt() ->> 'tenant_id')::uuid)
    WITH CHECK (tenant_id = (SELECT auth.jwt() ->> 'tenant_id')::uuid);

-- 3. Portal users can read their own mapping
CREATE POLICY "Portal users can read their own mapping"
    ON portal_users FOR SELECT
    USING (auth_user_id = auth.uid());

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_portal_users_auth_id ON portal_users(auth_user_id);
CREATE INDEX IF NOT EXISTS idx_portal_users_tenant_id ON portal_users(tenant_id);
CREATE INDEX IF NOT EXISTS idx_portal_users_card_id ON portal_users(card_id);
