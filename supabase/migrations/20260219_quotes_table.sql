-- ============================================================================
-- Quotes Table (Separate from Orders)
-- Migration: 20260219_quotes_table
-- Date: 2026-02-19
-- Description: Creates a dedicated quotes table separate from the orders table.
--              Quotes have their own lifecycle (draft → sent → accepted/rejected
--              → converted_to_order). When accepted, a quote generates an order.
-- Dependencies: tenants, cards (customers), products, currencies
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. QUOTES TABLE
-- ============================================================================
-- Purpose: Sales quotations with full lifecycle management.
-- Separate from orders: a quote is a PROPOSAL, an order is a COMMITMENT.

CREATE TABLE IF NOT EXISTS quotes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,

    -- Document identification
    quote_number TEXT NOT NULL,
    revision INT NOT NULL DEFAULT 1,

    -- Status lifecycle
    status TEXT NOT NULL DEFAULT 'draft'
        CHECK (status IN (
            'draft',              -- Being composed
            'pending_approval',   -- Sent for internal approval (if margin < min_margin_pct)
            'approved',           -- Internally approved, ready to send
            'sent',               -- Sent to customer
            'accepted',           -- Customer accepted
            'rejected',           -- Customer rejected
            'expired',            -- Past valid_until date
            'converted',          -- Converted to order
            'cancelled'           -- Manually cancelled
        )),

    -- Customer & contact
    customer_id UUID,
    customer_name TEXT,
    contact_name TEXT,
    contact_email TEXT,
    contact_phone TEXT,

    -- Dates
    quote_date DATE NOT NULL DEFAULT CURRENT_DATE,
    valid_until DATE,
    accepted_at TIMESTAMPTZ,
    converted_at TIMESTAMPTZ,

    -- Currency
    currency CHAR(3) NOT NULL DEFAULT 'ILS',
    exchange_rate NUMERIC(18, 8) DEFAULT 1.0,

    -- Totals (denormalized for fast display)
    subtotal NUMERIC(15, 2) NOT NULL DEFAULT 0,
    discount_total NUMERIC(15, 2) NOT NULL DEFAULT 0,
    tax_total NUMERIC(15, 2) NOT NULL DEFAULT 0,
    grand_total NUMERIC(15, 2) NOT NULL DEFAULT 0,

    -- Tax zone
    tax_zone_id UUID,

    -- Margin tracking (for approval workflow)
    total_cost NUMERIC(15, 2) DEFAULT 0,
    margin_pct NUMERIC(5, 2) DEFAULT NULL,

    -- Notes
    notes TEXT,
    internal_notes TEXT,
    terms_and_conditions TEXT,

    -- Conversion tracking
    converted_order_id UUID,

    -- Assigned sales rep
    assigned_to UUID,

    -- Metadata
    metadata JSONB DEFAULT '{}',
    created_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE(tenant_id, quote_number, revision)
);

COMMENT ON TABLE quotes IS 'Sales quotations with full lifecycle, separate from orders';
COMMENT ON COLUMN quotes.revision IS 'Version number — increments when quote is revised';
COMMENT ON COLUMN quotes.margin_pct IS 'Calculated margin % — used for approval routing when below tenant min_margin_pct';
COMMENT ON COLUMN quotes.converted_order_id IS 'FK to orders — set when status transitions to converted';

-- ============================================================================
-- 2. QUOTE ITEMS TABLE
-- ============================================================================
-- Purpose: Individual line items within a quote.

CREATE TABLE IF NOT EXISTS quote_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,  -- Denormalized for RLS
    quote_id UUID NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,

    -- Sequence
    line_number INT NOT NULL DEFAULT 0,

    -- Product reference (nullable for custom/ad-hoc line items)
    product_id UUID REFERENCES products(id) ON DELETE SET NULL,
    sku TEXT,
    description TEXT,

    -- Pricing
    unit_price NUMERIC(15, 4) NOT NULL DEFAULT 0,
    quantity NUMERIC(15, 4) NOT NULL DEFAULT 1,
    unit TEXT NOT NULL DEFAULT 'EA',
    discount_percent NUMERIC(5, 2) NOT NULL DEFAULT 0,
    line_total NUMERIC(15, 2) NOT NULL DEFAULT 0,

    -- Cost tracking (from BOM/CPQ)
    unit_cost NUMERIC(15, 4) DEFAULT 0,
    cost_source TEXT DEFAULT NULL,  -- 'bom', 'cpq', 'manual', 'list_price'

    -- Tax
    tax_class_id UUID,
    tax_amount NUMERIC(15, 2) DEFAULT 0,

    -- CPQ link (if this line came from a configured product)
    configuration_id UUID,
    configured_product_id UUID,

    -- Metadata
    notes TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE quote_items IS 'Line items within a quote, with BOM/CPQ cost tracking';
COMMENT ON COLUMN quote_items.cost_source IS 'How unit_cost was determined: bom, cpq, manual, list_price';

-- ============================================================================
-- 3. QUOTE NUMBERING FUNCTION
-- ============================================================================
-- Generates sequential quote numbers per tenant: QT-001, QT-002, etc.
-- Uses tenant.quote_prefix if set (from TASK-002).

CREATE OR REPLACE FUNCTION generate_quote_number(p_tenant_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_prefix TEXT;
    v_next_num INT;
    v_result TEXT;
BEGIN
    -- Get tenant's quote prefix (default 'QT')
    SELECT COALESCE(quote_prefix, 'QT') INTO v_prefix
    FROM tenants
    WHERE id = p_tenant_id;

    IF v_prefix IS NULL THEN
        v_prefix := 'QT';
    END IF;

    -- Get next number (max + 1)
    SELECT COALESCE(MAX(
        CASE
            WHEN quote_number ~ ('^' || v_prefix || '-[0-9]+$')
            THEN CAST(SUBSTRING(quote_number FROM '[0-9]+$') AS INT)
            ELSE 0
        END
    ), 0) + 1
    INTO v_next_num
    FROM quotes
    WHERE tenant_id = p_tenant_id;

    -- Format: QT-001, QT-002, etc. (zero-padded to 3+ digits)
    v_result := v_prefix || '-' || LPAD(v_next_num::TEXT, GREATEST(3, LENGTH(v_next_num::TEXT)), '0');

    RETURN v_result;
END;
$$;

COMMENT ON FUNCTION generate_quote_number IS 'Generate sequential quote number per tenant using tenant.quote_prefix';

-- ============================================================================
-- 4. INDEXES (RULE-02: tenant_id first)
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_quotes_tenant_status
    ON quotes(tenant_id, status);

CREATE INDEX IF NOT EXISTS idx_quotes_tenant_customer
    ON quotes(tenant_id, customer_id);

CREATE INDEX IF NOT EXISTS idx_quotes_tenant_date
    ON quotes(tenant_id, quote_date DESC);

CREATE INDEX IF NOT EXISTS idx_quotes_tenant_number
    ON quotes(tenant_id, quote_number);

CREATE INDEX IF NOT EXISTS idx_quotes_expiring
    ON quotes(tenant_id, valid_until)
    WHERE status IN ('sent', 'approved') AND valid_until IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_quote_items_quote
    ON quote_items(quote_id, line_number);

CREATE INDEX IF NOT EXISTS idx_quote_items_tenant
    ON quote_items(tenant_id, product_id);

-- ============================================================================
-- 5. ROW LEVEL SECURITY (RULE-01: IS NOT NULL guard)
-- ============================================================================

ALTER TABLE quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE quote_items ENABLE ROW LEVEL SECURITY;

-- Quotes
DROP POLICY IF EXISTS quotes_select ON quotes;
DROP POLICY IF EXISTS quotes_insert ON quotes;
DROP POLICY IF EXISTS quotes_update ON quotes;
DROP POLICY IF EXISTS quotes_delete ON quotes;

CREATE POLICY quotes_select ON quotes
    FOR SELECT TO authenticated
    USING (tenant_id = get_current_tenant_id() AND get_current_tenant_id() IS NOT NULL);

CREATE POLICY quotes_insert ON quotes
    FOR INSERT TO authenticated
    WITH CHECK (tenant_id = get_current_tenant_id() AND get_current_tenant_id() IS NOT NULL);

CREATE POLICY quotes_update ON quotes
    FOR UPDATE TO authenticated
    USING (tenant_id = get_current_tenant_id() AND get_current_tenant_id() IS NOT NULL)
    WITH CHECK (tenant_id = get_current_tenant_id() AND get_current_tenant_id() IS NOT NULL);

CREATE POLICY quotes_delete ON quotes
    FOR DELETE TO authenticated
    USING (tenant_id = get_current_tenant_id() AND get_current_tenant_id() IS NOT NULL);

-- Quote Items
DROP POLICY IF EXISTS quote_items_select ON quote_items;
DROP POLICY IF EXISTS quote_items_insert ON quote_items;
DROP POLICY IF EXISTS quote_items_update ON quote_items;
DROP POLICY IF EXISTS quote_items_delete ON quote_items;

CREATE POLICY quote_items_select ON quote_items
    FOR SELECT TO authenticated
    USING (tenant_id = get_current_tenant_id() AND get_current_tenant_id() IS NOT NULL);

CREATE POLICY quote_items_insert ON quote_items
    FOR INSERT TO authenticated
    WITH CHECK (tenant_id = get_current_tenant_id() AND get_current_tenant_id() IS NOT NULL);

CREATE POLICY quote_items_update ON quote_items
    FOR UPDATE TO authenticated
    USING (tenant_id = get_current_tenant_id() AND get_current_tenant_id() IS NOT NULL)
    WITH CHECK (tenant_id = get_current_tenant_id() AND get_current_tenant_id() IS NOT NULL);

CREATE POLICY quote_items_delete ON quote_items
    FOR DELETE TO authenticated
    USING (tenant_id = get_current_tenant_id() AND get_current_tenant_id() IS NOT NULL);

-- ============================================================================
-- 6. UPDATED_AT TRIGGERS
-- ============================================================================

CREATE OR REPLACE FUNCTION update_quote_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_quotes_updated_at ON quotes;
CREATE TRIGGER trg_quotes_updated_at
    BEFORE UPDATE ON quotes
    FOR EACH ROW EXECUTE FUNCTION update_quote_updated_at();

DROP TRIGGER IF EXISTS trg_quote_items_updated_at ON quote_items;
CREATE TRIGGER trg_quote_items_updated_at
    BEFORE UPDATE ON quote_items
    FOR EACH ROW EXECUTE FUNCTION update_quote_updated_at();

-- ============================================================================
-- 7. AUTO-EXPIRE FUNCTION (can be called by cron or application)
-- ============================================================================

CREATE OR REPLACE FUNCTION expire_stale_quotes()
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_count INT;
BEGIN
    UPDATE quotes
    SET status = 'expired', updated_at = NOW()
    WHERE status IN ('sent', 'approved')
      AND valid_until IS NOT NULL
      AND valid_until < CURRENT_DATE;

    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$$;

COMMENT ON FUNCTION expire_stale_quotes IS 'Expire quotes past their valid_until date. Call via pg_cron or application scheduler.';

COMMIT;
