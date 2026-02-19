-- ============================================================================
-- IL Compliance: SHAAM Invoice Queue + Invoice ITA Fields
-- Migration: 20260216_il_shaam_compliance
-- Date: 2026-02-16
-- Description: Adds IL-specific fields for SHAAM compliance:
--              - Alteration to orders table for ITA invoice numbering
--              - il_shaam_queue table for invoices requiring SHAAM submission
-- Dependencies: orders table (migration 007), tenants table
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. Invoice-like fields on orders (for IL compliance)
-- ============================================================================
-- The NOW system currently uses orders as invoices.
-- TASK-011 will create a separate quotes table. For now, add ITA fields here.

-- ITA (Israel Tax Authority) allocated invoice number
ALTER TABLE orders ADD COLUMN IF NOT EXISTS
    ita_invoice_number TEXT DEFAULT NULL;

-- SHAAM submission reference ID (after successful reporting)
ALTER TABLE orders ADD COLUMN IF NOT EXISTS
    shaam_reference_id TEXT DEFAULT NULL;

-- Whether this invoice has been reported to SHAAM
ALTER TABLE orders ADD COLUMN IF NOT EXISTS
    shaam_reported BOOLEAN NOT NULL DEFAULT false;

-- SHAAM reporting timestamp
ALTER TABLE orders ADD COLUMN IF NOT EXISTS
    shaam_reported_at TIMESTAMPTZ DEFAULT NULL;

COMMENT ON COLUMN orders.ita_invoice_number IS 'ITA-allocated invoice number for Israeli tax compliance';
COMMENT ON COLUMN orders.shaam_reference_id IS 'SHAAM submission reference after successful reporting';

-- ============================================================================
-- 2. SHAAM Invoice Queue
-- ============================================================================
-- Purpose: Queues invoices exceeding the SHAAM threshold (₪25,000) for
--          submission to the Israel Tax Authority system.
-- Status flow: pending → submitted → confirmed / failed

CREATE TABLE IF NOT EXISTS il_shaam_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    order_id UUID NOT NULL,
    invoice_total NUMERIC(15, 2) NOT NULL,
    currency CHAR(3) NOT NULL DEFAULT 'ILS',
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'submitted', 'confirmed', 'failed', 'cancelled')),
    
    -- Submission details
    submission_payload JSONB DEFAULT NULL,
    response_payload JSONB DEFAULT NULL,
    shaam_reference TEXT DEFAULT NULL,
    error_message TEXT DEFAULT NULL,
    retry_count INT NOT NULL DEFAULT 0,
    max_retries INT NOT NULL DEFAULT 3,
    
    -- Timestamps
    submitted_at TIMESTAMPTZ DEFAULT NULL,
    confirmed_at TIMESTAMPTZ DEFAULT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE il_shaam_queue IS 'Queue for invoices requiring SHAAM reporting (≥₪25,000 threshold)';

-- ============================================================================
-- 3. INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_shaam_queue_tenant_status
    ON il_shaam_queue(tenant_id, status);

CREATE INDEX IF NOT EXISTS idx_shaam_queue_pending
    ON il_shaam_queue(tenant_id, created_at)
    WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_orders_ita_number
    ON orders(ita_invoice_number)
    WHERE ita_invoice_number IS NOT NULL;

-- ============================================================================
-- 4. ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE il_shaam_queue ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS il_shaam_queue_select ON il_shaam_queue;
DROP POLICY IF EXISTS il_shaam_queue_all ON il_shaam_queue;

CREATE POLICY il_shaam_queue_select ON il_shaam_queue
    FOR SELECT TO authenticated
    USING (tenant_id = get_current_tenant_id() AND get_current_tenant_id() IS NOT NULL);

CREATE POLICY il_shaam_queue_all ON il_shaam_queue
    FOR ALL TO authenticated
    USING (tenant_id = get_current_tenant_id() AND get_current_tenant_id() IS NOT NULL)
    WITH CHECK (tenant_id = get_current_tenant_id() AND get_current_tenant_id() IS NOT NULL);

-- ============================================================================
-- 5. SEED IL TAX DATA (if tax_zones/tax_classes/tax_rates exist)
-- ============================================================================
-- Only runs if the tables from TASK-005 exist. Safe to skip if they don't.

DO $$
DECLARE
    v_zone_id UUID;
    v_eilat_zone_id UUID;
    v_class_id UUID;
BEGIN
    -- Check if tax_zones table exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'tax_zones') THEN
        RAISE NOTICE 'tax_zones table not found — skipping IL tax seed data';
        RETURN;
    END IF;

    -- Note: Seed data requires a tenant_id. We insert for all existing tenants
    -- that have 'IL' in their compliance_plugins.
    -- For now, just create template data we can clone for new tenants.
    
    RAISE NOTICE 'IL SHAAM compliance migration complete. Tax seed data should be created via tenant onboarding.';
END;
$$;

-- ============================================================================
-- 6. UPDATED_AT TRIGGER
-- ============================================================================

DROP TRIGGER IF EXISTS trg_il_shaam_queue_updated_at ON il_shaam_queue;
CREATE TRIGGER trg_il_shaam_queue_updated_at
    BEFORE UPDATE ON il_shaam_queue
    FOR EACH ROW EXECUTE FUNCTION update_tax_updated_at();

COMMIT;
