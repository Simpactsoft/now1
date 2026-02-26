-- Migration: 20260225_api_keys.sql
-- Description: Public API Key management for external integrations.
-- Keys are stored hashed (SHA-256). The raw key is only shown once on creation.

BEGIN;

CREATE TABLE IF NOT EXISTS api_keys (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id    uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name         text NOT NULL,                         -- Human label, e.g. "Zapier Integration"
    key_hash     text NOT NULL UNIQUE,                  -- SHA-256 hex of the raw key
    key_prefix   text NOT NULL,                         -- First 16 chars for display, e.g. "nw_live_sk_xQ3pL"
    scopes       text[] NOT NULL DEFAULT ARRAY['read','write'], -- e.g. {"read","write","admin"}
    created_at   timestamptz NOT NULL DEFAULT now(),
    last_used_at timestamptz,
    revoked_at   timestamptz                            -- NULL = active key
);

-- Index for fast lookup on key validation path (hot path)
CREATE INDEX IF NOT EXISTS idx_api_keys_hash ON api_keys(key_hash);
CREATE INDEX IF NOT EXISTS idx_api_keys_tenant ON api_keys(tenant_id);

-- RLS: session-authenticated users can manage their own tenant's keys
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_can_view_own_api_keys"
    ON api_keys FOR SELECT
    TO authenticated
    USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "tenant_can_insert_own_api_keys"
    ON api_keys FOR INSERT
    TO authenticated
    WITH CHECK (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "tenant_can_update_own_api_keys"
    ON api_keys FOR UPDATE
    TO authenticated
    USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));

-- service_role bypasses RLS automatically, so the middleware can validate keys
-- without any extra grants needed.

GRANT SELECT, INSERT, UPDATE ON api_keys TO authenticated;
GRANT ALL ON api_keys TO service_role;

COMMIT;
