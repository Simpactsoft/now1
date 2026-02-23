-- =============================================================================
-- ACTIVITY MANAGEMENT ENGINE v2.2 — Schema Enhancements
-- Gemini Review Addendum Integration
-- =============================================================================

-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║  1. DATA LIFECYCLE & TENANT OFFBOARDING                                   ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝
CREATE TABLE tenant_deletion_progress (
    tenant_id       UUID NOT NULL,
    table_name      VARCHAR(100) NOT NULL,
    rows_deleted     BIGINT DEFAULT 0,
    total_rows       BIGINT,
    batch_size       INT DEFAULT 5000,
    status           VARCHAR(20) DEFAULT 'pending',
    started_at       TIMESTAMPTZ,
    completed_at     TIMESTAMPTZ,
    PRIMARY KEY (tenant_id, table_name)
);

ALTER TABLE tenant_deletion_progress ENABLE ROW LEVEL SECURITY;

-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║  2. CALENDAR COLOR SYNC REFERENCE                                         ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝
CREATE TABLE calendar_color_map (
    id               SERIAL PRIMARY KEY,
    google_color_id  VARCHAR(5) NOT NULL UNIQUE,
    google_name      VARCHAR(50) NOT NULL,
    hex_code         VARCHAR(7) NOT NULL,
    outlook_category VARCHAR(100) NOT NULL,
    crm_display_name VARCHAR(50) NOT NULL
);

ALTER TABLE calendar_color_map ENABLE ROW LEVEL SECURITY;

CREATE POLICY "calendar_color_map_read_all"
    ON calendar_color_map
    FOR SELECT
    TO authenticated
    USING (true);

-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║  3. ASC 606 COMMISSION ACCOUNTING FLOWS                                   ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝
ALTER TABLE commission_ledger ADD COLUMN IF NOT EXISTS
    accounting_type VARCHAR(20) DEFAULT 'immediate';
    -- Values: 'immediate', 'deferred', 'amortization',
    --         'clawback', 'write_down';

ALTER TABLE commission_ledger ADD COLUMN IF NOT EXISTS
    amortization_start DATE;

ALTER TABLE commission_ledger ADD COLUMN IF NOT EXISTS
    amortization_end DATE;

ALTER TABLE commission_ledger ADD COLUMN IF NOT EXISTS
    remaining_asset DECIMAL(12,2);

-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║  4. IMPERSONATION SECURITY HARDENING                                      ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝
-- Extract impersonation flag from JWT
CREATE OR REPLACE FUNCTION public.is_impersonated()
RETURNS BOOLEAN AS $$
    SELECT COALESCE(
        (current_setting('request.jwt.claim.is_impersonated', true))::BOOLEAN,
        FALSE
    );
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

-- Block ALL writes during impersonation on activities
CREATE POLICY "Block impersonation writes"
    ON activities
    FOR INSERT
    TO authenticated
    WITH CHECK (NOT public.is_impersonated());

CREATE POLICY "Block impersonation updates"
    ON activities
    FOR UPDATE
    TO authenticated
    USING (NOT public.is_impersonated());

CREATE POLICY "Block impersonation deletes"
    ON activities
    FOR DELETE
    TO authenticated
    USING (NOT public.is_impersonated());

CREATE TABLE impersonation_audit_log (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id       UUID NOT NULL,
    admin_user_id   UUID NOT NULL,
    target_user_id  UUID NOT NULL,
    action          VARCHAR(50) NOT NULL,
    endpoint        TEXT,
    started_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ended_at        TIMESTAMPTZ
);

ALTER TABLE impersonation_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "impersonation_audit_log_insert"
    ON impersonation_audit_log
    FOR INSERT
    TO authenticated
    WITH CHECK (true);
