-- ============================================================================
-- BATCH 1: Core tables (financial reports, warehouses, quotes, invoices, prices, variants)
-- Run this FIRST in Supabase SQL Editor
-- ============================================================================

-- ============================================================================
-- Financial Reports: Profit & Loss + Balance Sheet RPCs
-- Migration: 20260219_financial_reports
-- Date: 2026-02-19
-- Description: Two reporting RPCs built on existing chart_of_accounts,
--              journal_entries, and journal_lines tables.
-- Dependencies: 20260223_accounting_mvp
-- ============================================================================

-- ============================================================================
-- 1. PROFIT & LOSS (P&L) — Date Range
-- ============================================================================
-- Returns revenue and expense accounts with their balances for a date range.
-- Revenue: balance = SUM(credit) - SUM(debit)
-- Expense: balance = SUM(debit) - SUM(credit)

CREATE OR REPLACE FUNCTION get_profit_and_loss(
    p_tenant_id UUID,
    p_from_date DATE,
    p_to_date DATE
)
RETURNS TABLE (
    account_id UUID,
    account_number TEXT,
    account_name TEXT,
    account_type TEXT,
    balance NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT
        coa.id,
        coa.account_number,
        coa.name,
        coa.account_type,
        CASE
            WHEN coa.account_type = 'revenue'
            THEN COALESCE(SUM(jl.credit), 0) - COALESCE(SUM(jl.debit), 0)
            WHEN coa.account_type = 'expense'
            THEN COALESCE(SUM(jl.debit), 0) - COALESCE(SUM(jl.credit), 0)
            ELSE 0::NUMERIC
        END AS balance
    FROM chart_of_accounts coa
        LEFT JOIN journal_lines jl ON jl.account_id = coa.id
            AND jl.tenant_id = p_tenant_id
        LEFT JOIN journal_entries je ON je.id = jl.journal_entry_id
            AND je.status = 'posted'
            AND je.entry_date >= p_from_date
            AND je.entry_date <= p_to_date
    WHERE coa.tenant_id = p_tenant_id
      AND coa.is_active = true
      AND coa.account_type IN ('revenue', 'expense')
    GROUP BY coa.id, coa.account_number, coa.name, coa.account_type
    HAVING COALESCE(SUM(jl.debit), 0) != 0 OR COALESCE(SUM(jl.credit), 0) != 0
    ORDER BY coa.account_number;
END;
$$;

COMMENT ON FUNCTION get_profit_and_loss IS 'P&L report: revenue and expense balances for a date range. Client computes Net Income = Σ revenue - Σ expense.';

-- ============================================================================
-- 2. BALANCE SHEET — As of Date
-- ============================================================================
-- Returns asset, liability, and equity accounts with their balances
-- as of a specific date, plus auto-calculated retained earnings.

CREATE OR REPLACE FUNCTION get_balance_sheet(
    p_tenant_id UUID,
    p_as_of_date DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE (
    account_id UUID,
    account_number TEXT,
    account_name TEXT,
    account_type TEXT,
    balance NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_retained_earnings NUMERIC;
BEGIN
    -- ========================================================================
    -- Step 1: Calculate retained earnings (net income to date)
    -- Retained Earnings = Σ revenue credits - Σ revenue debits
    --                    - (Σ expense debits - Σ expense credits)
    -- ========================================================================
    SELECT
        COALESCE(SUM(
            CASE
                WHEN coa.account_type = 'revenue' THEN jl.credit - jl.debit
                WHEN coa.account_type = 'expense' THEN jl.debit - jl.credit
                ELSE 0
            END
        ), 0) INTO v_retained_earnings
    FROM journal_lines jl
        JOIN journal_entries je ON je.id = jl.journal_entry_id
        JOIN chart_of_accounts coa ON coa.id = jl.account_id
    WHERE jl.tenant_id = p_tenant_id
      AND je.status = 'posted'
      AND je.entry_date <= p_as_of_date
      AND coa.account_type IN ('revenue', 'expense');

    -- Net income = revenue - expense (but we computed revenue - expense above
    -- using the sign convention, so: revenue contributes positive, expense negative)
    -- Actually: revenue line = credit - debit (positive for revenue)
    --           expense line = debit - credit (positive for expense)
    -- Retained earnings = revenue - expense
    v_retained_earnings := -v_retained_earnings;  -- flip: we want revenue - expense

    -- ========================================================================
    -- Step 2: Return balance sheet accounts
    -- ========================================================================
    RETURN QUERY

    -- Regular balance sheet accounts
    SELECT
        coa.id,
        coa.account_number,
        coa.name,
        coa.account_type,
        CASE
            WHEN coa.account_type = 'asset'
            THEN COALESCE(SUM(jl.debit), 0) - COALESCE(SUM(jl.credit), 0)
            WHEN coa.account_type IN ('liability', 'equity')
            THEN COALESCE(SUM(jl.credit), 0) - COALESCE(SUM(jl.debit), 0)
            ELSE 0::NUMERIC
        END AS balance
    FROM chart_of_accounts coa
        LEFT JOIN journal_lines jl ON jl.account_id = coa.id
            AND jl.tenant_id = p_tenant_id
        LEFT JOIN journal_entries je ON je.id = jl.journal_entry_id
            AND je.status = 'posted'
            AND je.entry_date <= p_as_of_date
    WHERE coa.tenant_id = p_tenant_id
      AND coa.is_active = true
      AND coa.account_type IN ('asset', 'liability', 'equity')
    GROUP BY coa.id, coa.account_number, coa.name, coa.account_type
    HAVING COALESCE(SUM(jl.debit), 0) != 0 OR COALESCE(SUM(jl.credit), 0) != 0

    UNION ALL

    -- Retained earnings (synthetic row)
    SELECT
        '00000000-0000-0000-0000-000000000000'::UUID,
        '3999'::TEXT,
        'עודפים שוטפים (רווח נקי)'::TEXT,
        'equity'::TEXT,
        v_retained_earnings

    ORDER BY account_number;
END;
$$;

COMMENT ON FUNCTION get_balance_sheet IS 'Balance sheet: asset/liability/equity balances as of date, with auto-calculated retained earnings.';

-- === END financial_reports ===

-- ============================================================================
-- Multi-Warehouse Inventory
-- Migration: 20260219_multi_warehouse
-- Date: 2026-02-19
-- Description: Warehouses table, warehouse transfers, ALTER inventory_balances
--              to support per-warehouse stock, RPCs for warehouse operations.
-- Dependencies: 007_add_sales_inventory_tables, 20260217_inventory_balances
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. WAREHOUSES TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS warehouses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    code TEXT NOT NULL,
    name TEXT NOT NULL,
    address TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    is_default BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE(tenant_id, code)
);

COMMENT ON TABLE warehouses IS 'Physical or logical warehouse locations for inventory tracking';

CREATE INDEX IF NOT EXISTS idx_warehouses_tenant ON warehouses(tenant_id);
CREATE INDEX IF NOT EXISTS idx_warehouses_default ON warehouses(tenant_id, is_default) WHERE is_default = true;

-- RLS
ALTER TABLE warehouses ENABLE ROW LEVEL SECURITY;

CREATE POLICY warehouses_select ON warehouses FOR SELECT TO authenticated
    USING (tenant_id = get_current_tenant_id() AND get_current_tenant_id() IS NOT NULL);
CREATE POLICY warehouses_all ON warehouses FOR ALL TO authenticated
    USING (tenant_id = get_current_tenant_id() AND get_current_tenant_id() IS NOT NULL)
    WITH CHECK (tenant_id = get_current_tenant_id() AND get_current_tenant_id() IS NOT NULL);

-- ============================================================================
-- 2. WAREHOUSE TRANSFERS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS warehouse_transfers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    transfer_number SERIAL,
    from_warehouse_id UUID NOT NULL REFERENCES warehouses(id),
    to_warehouse_id UUID NOT NULL REFERENCES warehouses(id),
    product_id UUID NOT NULL REFERENCES products(id),
    quantity NUMERIC(15, 4) NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'completed', 'cancelled')),
    notes TEXT,
    requested_by UUID,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CHECK (from_warehouse_id != to_warehouse_id),
    CHECK (quantity > 0)
);

COMMENT ON TABLE warehouse_transfers IS 'Track inventory transfers between warehouses';

CREATE INDEX IF NOT EXISTS idx_wh_transfers_tenant ON warehouse_transfers(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_wh_transfers_product ON warehouse_transfers(tenant_id, product_id);

-- RLS
ALTER TABLE warehouse_transfers ENABLE ROW LEVEL SECURITY;

CREATE POLICY wh_transfers_select ON warehouse_transfers FOR SELECT TO authenticated
    USING (tenant_id = get_current_tenant_id() AND get_current_tenant_id() IS NOT NULL);
CREATE POLICY wh_transfers_all ON warehouse_transfers FOR ALL TO authenticated
    USING (tenant_id = get_current_tenant_id() AND get_current_tenant_id() IS NOT NULL)
    WITH CHECK (tenant_id = get_current_tenant_id() AND get_current_tenant_id() IS NOT NULL);

-- ============================================================================
-- 3. ALTER INVENTORY_BALANCES — Add warehouse_id
-- ============================================================================
-- Strategy:
--  1. Add warehouse_id column (nullable initially)
--  2. Create a default warehouse for each tenant that has existing balances
--  3. Backfill warehouse_id with the default warehouse
--  4. Make warehouse_id NOT NULL
--  5. Drop old unique constraint, add new one with warehouse_id

-- 3a. Add column
ALTER TABLE inventory_balances
    ADD COLUMN IF NOT EXISTS warehouse_id UUID REFERENCES warehouses(id);

-- 3b. Create default warehouses for existing tenants with balances
DO $$
DECLARE
    v_tenant UUID;
    v_wh_id UUID;
BEGIN
    FOR v_tenant IN
        SELECT DISTINCT tenant_id FROM inventory_balances WHERE warehouse_id IS NULL
    LOOP
        -- Check if a default warehouse already exists
        SELECT id INTO v_wh_id FROM warehouses
        WHERE tenant_id = v_tenant AND is_default = true LIMIT 1;

        IF v_wh_id IS NULL THEN
            INSERT INTO warehouses (tenant_id, code, name, is_default)
            VALUES (v_tenant, 'MAIN', 'Main Warehouse', true)
            RETURNING id INTO v_wh_id;
        END IF;

        -- Backfill
        UPDATE inventory_balances
        SET warehouse_id = v_wh_id
        WHERE tenant_id = v_tenant AND warehouse_id IS NULL;
    END LOOP;
END;
$$;

-- 3c. Make NOT NULL
ALTER TABLE inventory_balances ALTER COLUMN warehouse_id SET NOT NULL;

-- 3d. Drop old unique, add new
ALTER TABLE inventory_balances DROP CONSTRAINT IF EXISTS inventory_balances_tenant_id_product_id_key;
ALTER TABLE inventory_balances ADD CONSTRAINT inventory_balances_tenant_product_warehouse_key
    UNIQUE (tenant_id, product_id, warehouse_id);

-- ============================================================================
-- 4. ALTER INVENTORY_LEDGER — Make warehouse_id NOT NULL
-- ============================================================================

-- 4a. Backfill existing NULL warehouse_id entries
DO $$
DECLARE
    v_tenant UUID;
    v_wh_id UUID;
BEGIN
    FOR v_tenant IN
        SELECT DISTINCT tenant_id FROM inventory_ledger WHERE warehouse_id IS NULL
    LOOP
        SELECT id INTO v_wh_id FROM warehouses
        WHERE tenant_id = v_tenant AND is_default = true LIMIT 1;

        IF v_wh_id IS NOT NULL THEN
            UPDATE inventory_ledger
            SET warehouse_id = v_wh_id
            WHERE tenant_id = v_tenant AND warehouse_id IS NULL;
        END IF;
    END LOOP;
END;
$$;

-- 4b. Make NOT NULL and add FK
ALTER TABLE inventory_ledger ALTER COLUMN warehouse_id SET NOT NULL;

-- Add FK if not exists (safe via DO block)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'inventory_ledger_warehouse_id_fkey'
        AND table_name = 'inventory_ledger'
    ) THEN
        ALTER TABLE inventory_ledger
        ADD CONSTRAINT inventory_ledger_warehouse_id_fkey
        FOREIGN KEY (warehouse_id) REFERENCES warehouses(id);
    END IF;
END;
$$;

-- ============================================================================
-- 5. UPDATE TRIGGER — Include warehouse_id in balance UPSERT
-- ============================================================================

CREATE OR REPLACE FUNCTION update_inventory_balance()
RETURNS TRIGGER LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO inventory_balances (tenant_id, product_id, warehouse_id, quantity_on_hand, last_movement_at)
    VALUES (NEW.tenant_id, NEW.product_id, NEW.warehouse_id, NEW.quantity_change, NOW())
    ON CONFLICT (tenant_id, product_id, warehouse_id)
    DO UPDATE SET
        quantity_on_hand = inventory_balances.quantity_on_hand + EXCLUDED.quantity_on_hand,
        last_movement_at = NOW(),
        updated_at = NOW();

    RETURN NEW;
END;
$$;

-- ============================================================================
-- 6. RPCs
-- ============================================================================

-- 6a. create_warehouse
CREATE OR REPLACE FUNCTION create_warehouse(
    p_tenant_id UUID,
    p_code TEXT,
    p_name TEXT,
    p_address TEXT DEFAULT NULL,
    p_is_default BOOLEAN DEFAULT false
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_id UUID;
    v_count INT;
BEGIN
    -- If making default, unset existing default
    IF p_is_default THEN
        UPDATE warehouses SET is_default = false
        WHERE tenant_id = p_tenant_id AND is_default = true;
    END IF;

    -- If this is the first warehouse, auto-set as default
    SELECT COUNT(*) INTO v_count FROM warehouses WHERE tenant_id = p_tenant_id;
    IF v_count = 0 THEN
        p_is_default := true;
    END IF;

    INSERT INTO warehouses (tenant_id, code, name, address, is_default)
    VALUES (p_tenant_id, p_code, p_name, p_address, p_is_default)
    RETURNING id INTO v_id;

    RETURN v_id;
END;
$$;

COMMENT ON FUNCTION create_warehouse IS 'Create a warehouse, optionally setting as default';

-- 6b. execute_warehouse_transfer
CREATE OR REPLACE FUNCTION execute_warehouse_transfer(
    p_transfer_id UUID,
    p_executed_by UUID DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_transfer warehouse_transfers%ROWTYPE;
    v_available NUMERIC;
BEGIN
    -- Get transfer
    SELECT * INTO v_transfer FROM warehouse_transfers WHERE id = p_transfer_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Transfer % not found', p_transfer_id;
    END IF;

    IF v_transfer.status != 'pending' THEN
        RAISE EXCEPTION 'Transfer % is not pending (status: %)', p_transfer_id, v_transfer.status;
    END IF;

    -- Check source warehouse has sufficient stock
    SELECT COALESCE(quantity_on_hand, 0) INTO v_available
    FROM inventory_balances
    WHERE tenant_id = v_transfer.tenant_id
      AND product_id = v_transfer.product_id
      AND warehouse_id = v_transfer.from_warehouse_id;

    IF v_available < v_transfer.quantity THEN
        RAISE EXCEPTION 'Insufficient stock: available % but requested %', v_available, v_transfer.quantity;
    END IF;

    -- Deduct from source (negative ledger entry)
    INSERT INTO inventory_ledger (tenant_id, product_id, warehouse_id, transaction_type, quantity_change, reference_id, notes)
    VALUES (v_transfer.tenant_id, v_transfer.product_id, v_transfer.from_warehouse_id, 'transfer_out',
            -v_transfer.quantity, p_transfer_id, 'Transfer to ' || v_transfer.to_warehouse_id);

    -- Add to destination (positive ledger entry)
    INSERT INTO inventory_ledger (tenant_id, product_id, warehouse_id, transaction_type, quantity_change, reference_id, notes)
    VALUES (v_transfer.tenant_id, v_transfer.product_id, v_transfer.to_warehouse_id, 'transfer_in',
            v_transfer.quantity, p_transfer_id, 'Transfer from ' || v_transfer.from_warehouse_id);

    -- Mark completed
    UPDATE warehouse_transfers
    SET status = 'completed',
        completed_at = NOW()
    WHERE id = p_transfer_id;

    RETURN TRUE;
END;
$$;

COMMENT ON FUNCTION execute_warehouse_transfer IS 'Atomically moves stock between warehouses via ledger entries';

-- 6c. get_warehouse_stock
CREATE OR REPLACE FUNCTION get_warehouse_stock(
    p_tenant_id UUID,
    p_warehouse_id UUID
)
RETURNS TABLE (
    product_id UUID,
    sku TEXT,
    product_name TEXT,
    quantity_on_hand NUMERIC,
    quantity_reserved NUMERIC,
    quantity_available NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT
        p.id,
        p.sku,
        p.name,
        ib.quantity_on_hand,
        ib.quantity_reserved,
        ib.quantity_available
    FROM inventory_balances ib
        JOIN products p ON p.id = ib.product_id
    WHERE ib.tenant_id = p_tenant_id
      AND ib.warehouse_id = p_warehouse_id
    ORDER BY p.sku;
END;
$$;

COMMENT ON FUNCTION get_warehouse_stock IS 'Returns stock levels for all products in a specific warehouse';

-- ============================================================================
-- 7. updated_at trigger for warehouses
-- ============================================================================

CREATE OR REPLACE FUNCTION update_warehouses_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_warehouses_updated_at ON warehouses;
CREATE TRIGGER trg_warehouses_updated_at
    BEFORE UPDATE ON warehouses
    FOR EACH ROW EXECUTE FUNCTION update_warehouses_updated_at();

COMMIT;

-- === END multi_warehouse ===

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

-- === END quotes_table ===

-- ============================================================================
-- Invoice Generation
-- Migration: 20260219_invoice_generation
-- Date: 2026-02-19
-- Description: Expand invoices table, add invoice_items, invoice_number_sequences,
--              and RPCs for invoice lifecycle management.
-- Dependencies: 007_add_sales_inventory_tables, 20260223_accounting_mvp
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. ALTER INVOICES TABLE — Expand columns
-- ============================================================================

ALTER TABLE invoices ADD COLUMN IF NOT EXISTS invoice_number TEXT;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS issue_date DATE DEFAULT CURRENT_DATE;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS subtotal NUMERIC(15, 2) DEFAULT 0;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS vat_rate NUMERIC(5, 4) DEFAULT 0.17;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS vat_amount NUMERIC(15, 2) DEFAULT 0;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'ILS';
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS issued_by UUID;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS journal_entry_id UUID REFERENCES journal_entries(id);
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Update status CHECK — allow broader set of statuses
-- We'll use a NOT NULL default approach since the column exists
DO $$
BEGIN
    -- Drop existing constraint if exists; create new one
    ALTER TABLE invoices DROP CONSTRAINT IF EXISTS invoices_status_check;
    ALTER TABLE invoices ADD CONSTRAINT invoices_status_check
        CHECK (status IN ('draft', 'issued', 'paid', 'cancelled', 'void'));
EXCEPTION WHEN OTHERS THEN NULL;
END;
$$;

-- Add unique constraint on invoice_number per tenant
ALTER TABLE invoices ADD CONSTRAINT invoices_tenant_number_key
    UNIQUE (tenant_id, invoice_number);

CREATE INDEX IF NOT EXISTS idx_invoices_tenant_status ON invoices(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_invoices_invoice_number ON invoices(tenant_id, invoice_number);

-- ============================================================================
-- 2. INVOICE ITEMS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS invoice_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id),
    description TEXT NOT NULL,
    quantity NUMERIC(15, 4) NOT NULL DEFAULT 1,
    unit_price NUMERIC(15, 2) NOT NULL,
    line_total NUMERIC(15, 2) NOT NULL,
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE invoice_items IS 'Line items for invoices';

CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice ON invoice_items(invoice_id);

-- RLS
ALTER TABLE invoice_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY invoice_items_select ON invoice_items FOR SELECT TO authenticated
    USING (tenant_id = get_current_tenant_id() AND get_current_tenant_id() IS NOT NULL);
CREATE POLICY invoice_items_all ON invoice_items FOR ALL TO authenticated
    USING (tenant_id = get_current_tenant_id() AND get_current_tenant_id() IS NOT NULL)
    WITH CHECK (tenant_id = get_current_tenant_id() AND get_current_tenant_id() IS NOT NULL);

-- ============================================================================
-- 3. INVOICE NUMBER SEQUENCES TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS invoice_number_sequences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    prefix TEXT NOT NULL DEFAULT 'INV',
    year INT NOT NULL DEFAULT EXTRACT(YEAR FROM CURRENT_DATE)::INT,
    last_number INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE(tenant_id, prefix, year)
);

COMMENT ON TABLE invoice_number_sequences IS 'Per-tenant, per-year invoice numbering sequences';

-- RLS
ALTER TABLE invoice_number_sequences ENABLE ROW LEVEL SECURITY;

CREATE POLICY inv_seq_select ON invoice_number_sequences FOR SELECT TO authenticated
    USING (tenant_id = get_current_tenant_id() AND get_current_tenant_id() IS NOT NULL);
CREATE POLICY inv_seq_all ON invoice_number_sequences FOR ALL TO authenticated
    USING (tenant_id = get_current_tenant_id() AND get_current_tenant_id() IS NOT NULL)
    WITH CHECK (tenant_id = get_current_tenant_id() AND get_current_tenant_id() IS NOT NULL);

-- ============================================================================
-- 4. RPCs
-- ============================================================================

-- 4a. generate_invoice_number
-- Returns next invoice number in format: INV-2026-0001
CREATE OR REPLACE FUNCTION generate_invoice_number(
    p_tenant_id UUID,
    p_prefix TEXT DEFAULT 'INV'
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_year INT := EXTRACT(YEAR FROM CURRENT_DATE)::INT;
    v_next INT;
BEGIN
    INSERT INTO invoice_number_sequences (tenant_id, prefix, year, last_number)
    VALUES (p_tenant_id, p_prefix, v_year, 1)
    ON CONFLICT (tenant_id, prefix, year)
    DO UPDATE SET last_number = invoice_number_sequences.last_number + 1
    RETURNING last_number INTO v_next;

    RETURN p_prefix || '-' || v_year::TEXT || '-' || LPAD(v_next::TEXT, 4, '0');
END;
$$;

COMMENT ON FUNCTION generate_invoice_number IS 'Generates next sequential invoice number per tenant/year';

-- 4b. create_invoice_from_quote
-- Creates an invoice from an existing quote (order), copying line items
CREATE OR REPLACE FUNCTION create_invoice_from_quote(
    p_tenant_id UUID,
    p_order_id UUID,
    p_issued_by UUID DEFAULT NULL,
    p_vat_rate NUMERIC DEFAULT 0.17,
    p_notes TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_invoice_id UUID;
    v_order RECORD;
    v_invoice_number TEXT;
    v_subtotal NUMERIC;
    v_vat_amount NUMERIC;
BEGIN
    -- Get order
    SELECT * INTO v_order FROM orders WHERE id = p_order_id AND tenant_id = p_tenant_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Order % not found', p_order_id;
    END IF;

    -- Generate invoice number
    v_invoice_number := generate_invoice_number(p_tenant_id);

    -- Calculate subtotal from order items
    SELECT COALESCE(SUM(total_price), 0) INTO v_subtotal
    FROM order_items WHERE order_id = p_order_id;

    v_vat_amount := ROUND(v_subtotal * p_vat_rate, 2);

    -- Create invoice
    INSERT INTO invoices (
        tenant_id, order_id, customer_id, invoice_number, status,
        issue_date, subtotal, vat_rate, vat_amount, total_amount,
        currency, notes, issued_by, due_date
    ) VALUES (
        p_tenant_id, p_order_id, v_order.customer_id, v_invoice_number, 'draft',
        CURRENT_DATE, v_subtotal, p_vat_rate, v_vat_amount, v_subtotal + v_vat_amount,
        COALESCE(v_order.currency, 'ILS'), p_notes, p_issued_by,
        CURRENT_DATE + INTERVAL '30 days'
    )
    RETURNING id INTO v_invoice_id;

    -- Copy order items to invoice items
    INSERT INTO invoice_items (tenant_id, invoice_id, product_id, description, quantity, unit_price, line_total, sort_order)
    SELECT
        p_tenant_id,
        v_invoice_id,
        oi.product_id,
        COALESCE(p.name, 'Item'),
        oi.quantity,
        oi.unit_price,
        oi.total_price,
        ROW_NUMBER() OVER (ORDER BY oi.created_at)
    FROM order_items oi
        LEFT JOIN products p ON p.id = oi.product_id
    WHERE oi.order_id = p_order_id;

    RETURN v_invoice_id;
END;
$$;

COMMENT ON FUNCTION create_invoice_from_quote IS 'Creates a draft invoice from a quote, copying all line items';

-- 4c. issue_invoice — Mark as issued and create journal entry
CREATE OR REPLACE FUNCTION issue_invoice(
    p_invoice_id UUID,
    p_issued_by UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_invoice RECORD;
    v_je_id UUID;
    v_receivable_account UUID;
    v_revenue_account UUID;
    v_vat_account UUID;
BEGIN
    -- Get invoice
    SELECT * INTO v_invoice FROM invoices WHERE id = p_invoice_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Invoice % not found', p_invoice_id;
    END IF;

    IF v_invoice.status != 'draft' THEN
        RAISE EXCEPTION 'Invoice % is not in draft status (current: %)', p_invoice_id, v_invoice.status;
    END IF;

    -- Lookup accounts (Israeli CoA)
    -- 1300 Receivables, 4100 Revenue, 2200 VAT Payable
    SELECT id INTO v_receivable_account FROM chart_of_accounts
        WHERE tenant_id = v_invoice.tenant_id AND account_number = '1300' LIMIT 1;
    SELECT id INTO v_revenue_account FROM chart_of_accounts
        WHERE tenant_id = v_invoice.tenant_id AND account_number = '4100' LIMIT 1;
    SELECT id INTO v_vat_account FROM chart_of_accounts
        WHERE tenant_id = v_invoice.tenant_id AND account_number = '2200' LIMIT 1;

    -- Create journal entry (only if accounts exist)
    IF v_receivable_account IS NOT NULL AND v_revenue_account IS NOT NULL THEN
        -- Create journal entry header
        INSERT INTO journal_entries (tenant_id, entry_date, memo, status, created_by)
        VALUES (
            v_invoice.tenant_id,
            CURRENT_DATE,
            'Invoice ' || v_invoice.invoice_number || ' issued',
            'draft',
            p_issued_by
        )
        RETURNING id INTO v_je_id;

        -- DR: Accounts Receivable (total_amount)
        INSERT INTO journal_lines (tenant_id, journal_entry_id, account_id, debit, credit, memo)
        VALUES (v_invoice.tenant_id, v_je_id, v_receivable_account, v_invoice.total_amount, 0,
                'Invoice ' || v_invoice.invoice_number);

        -- CR: Revenue (subtotal)
        INSERT INTO journal_lines (tenant_id, journal_entry_id, account_id, debit, credit, memo)
        VALUES (v_invoice.tenant_id, v_je_id, v_revenue_account, 0, v_invoice.subtotal,
                'Revenue from invoice ' || v_invoice.invoice_number);

        -- CR: VAT Payable (vat_amount) if applicable
        IF v_vat_account IS NOT NULL AND v_invoice.vat_amount > 0 THEN
            INSERT INTO journal_lines (tenant_id, journal_entry_id, account_id, debit, credit, memo)
            VALUES (v_invoice.tenant_id, v_je_id, v_vat_account, 0, v_invoice.vat_amount,
                    'VAT on invoice ' || v_invoice.invoice_number);
        END IF;

        -- Post the journal entry
        UPDATE journal_entries SET status = 'posted' WHERE id = v_je_id;
    END IF;

    -- Mark invoice as issued
    UPDATE invoices
    SET status = 'issued',
        journal_entry_id = v_je_id,
        issued_by = p_issued_by,
        updated_at = NOW()
    WHERE id = p_invoice_id;

    RETURN v_je_id;
END;
$$;

COMMENT ON FUNCTION issue_invoice IS 'Issues a draft invoice: creates accounting entries (DR Receivables, CR Revenue + CR VAT) and marks as issued';

-- 4d. cancel_invoice
CREATE OR REPLACE FUNCTION cancel_invoice(
    p_invoice_id UUID,
    p_reason TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_invoice RECORD;
BEGIN
    SELECT * INTO v_invoice FROM invoices WHERE id = p_invoice_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Invoice % not found', p_invoice_id;
    END IF;

    IF v_invoice.status NOT IN ('draft', 'issued') THEN
        RAISE EXCEPTION 'Cannot cancel invoice in status: %', v_invoice.status;
    END IF;

    -- If there's a linked journal entry that's posted, void it
    IF v_invoice.journal_entry_id IS NOT NULL THEN
        UPDATE journal_entries
        SET status = 'voided',
            memo = COALESCE(memo, '') || ' [VOIDED: Invoice cancelled' || COALESCE(': ' || p_reason, '') || ']'
        WHERE id = v_invoice.journal_entry_id AND status = 'posted';
    END IF;

    -- Cancel the invoice
    UPDATE invoices
    SET status = 'cancelled',
        cancelled_at = NOW(),
        updated_at = NOW()
    WHERE id = p_invoice_id;

    RETURN TRUE;
END;
$$;

COMMENT ON FUNCTION cancel_invoice IS 'Cancels an invoice and voids its journal entry if posted';

-- ============================================================================
-- 5. updated_at trigger for invoices
-- ============================================================================

CREATE OR REPLACE FUNCTION update_invoices_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_invoices_updated_at ON invoices;
CREATE TRIGGER trg_invoices_updated_at
    BEFORE UPDATE ON invoices
    FOR EACH ROW EXECUTE FUNCTION update_invoices_updated_at();

COMMIT;

-- === END invoice_generation ===

-- ============================================================================
-- Price Lists System
-- Migration: 20260220_price_lists
-- Date: 2026-02-19
-- Description: Customer-specific and time-bounded pricing. Supports multiple
--              price lists with priority resolution per customer.
-- Dependencies: products (007), cards (004), tenants
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. PRICE LISTS TABLE
-- ============================================================================
-- Named pricing tiers: "Retail", "VIP", "Wholesale", "Partner", etc.
-- Each can be currency-specific and have a validity window.

CREATE TABLE IF NOT EXISTS price_lists (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    currency CHAR(3) NOT NULL DEFAULT 'ILS',
    priority INT NOT NULL DEFAULT 0,  -- Higher = wins over lower priority lists
    is_active BOOLEAN NOT NULL DEFAULT true,
    valid_from DATE,
    valid_to DATE,
    created_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE(tenant_id, name),
    CHECK (valid_to IS NULL OR valid_from IS NULL OR valid_to >= valid_from)
);

COMMENT ON TABLE price_lists IS 'Named pricing tiers with priority and optional date range';
COMMENT ON COLUMN price_lists.priority IS 'Higher number wins when multiple lists apply to same customer';

-- ============================================================================
-- 2. PRICE LIST ITEMS TABLE
-- ============================================================================
-- Per-product price override within a price list.

CREATE TABLE IF NOT EXISTS price_list_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    price_list_id UUID NOT NULL REFERENCES price_lists(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    unit_price NUMERIC(15, 4) NOT NULL,
    min_quantity NUMERIC(15, 4) DEFAULT 1,  -- Quantity break pricing
    max_quantity NUMERIC(15, 4),
    discount_percent NUMERIC(5, 2) DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE(tenant_id, price_list_id, product_id, min_quantity)
);

COMMENT ON TABLE price_list_items IS 'Per-product pricing within a price list (supports quantity breaks)';

-- ============================================================================
-- 3. CUSTOMER PRICE LIST ASSIGNMENT
-- ============================================================================
-- Links customers (cards) to price lists. A customer can have multiple lists.

CREATE TABLE IF NOT EXISTS customer_price_list (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    customer_id UUID NOT NULL,
    price_list_id UUID NOT NULL REFERENCES price_lists(id) ON DELETE CASCADE,
    FOREIGN KEY (tenant_id, customer_id) REFERENCES cards(tenant_id, id) ON DELETE CASCADE,
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE(tenant_id, customer_id, price_list_id)
);

COMMENT ON TABLE customer_price_list IS 'M:N assignment of customers to price lists';

-- ============================================================================
-- 4. INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_price_lists_tenant_active
    ON price_lists(tenant_id, is_active, priority DESC);

CREATE INDEX IF NOT EXISTS idx_price_lists_tenant_dates
    ON price_lists(tenant_id, valid_from, valid_to)
    WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_price_list_items_lookup
    ON price_list_items(tenant_id, price_list_id, product_id);

CREATE INDEX IF NOT EXISTS idx_price_list_items_product
    ON price_list_items(tenant_id, product_id);

CREATE INDEX IF NOT EXISTS idx_customer_price_list_customer
    ON customer_price_list(tenant_id, customer_id);

CREATE INDEX IF NOT EXISTS idx_customer_price_list_list
    ON customer_price_list(tenant_id, price_list_id);

-- ============================================================================
-- 5. ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE price_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE price_list_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_price_list ENABLE ROW LEVEL SECURITY;

-- price_lists
DROP POLICY IF EXISTS price_lists_select ON price_lists;
DROP POLICY IF EXISTS price_lists_insert ON price_lists;
DROP POLICY IF EXISTS price_lists_update ON price_lists;
DROP POLICY IF EXISTS price_lists_delete ON price_lists;

CREATE POLICY price_lists_select ON price_lists FOR SELECT TO authenticated
    USING (tenant_id = get_current_tenant_id() AND get_current_tenant_id() IS NOT NULL);
CREATE POLICY price_lists_insert ON price_lists FOR INSERT TO authenticated
    WITH CHECK (tenant_id = get_current_tenant_id() AND get_current_tenant_id() IS NOT NULL);
CREATE POLICY price_lists_update ON price_lists FOR UPDATE TO authenticated
    USING (tenant_id = get_current_tenant_id() AND get_current_tenant_id() IS NOT NULL)
    WITH CHECK (tenant_id = get_current_tenant_id() AND get_current_tenant_id() IS NOT NULL);
CREATE POLICY price_lists_delete ON price_lists FOR DELETE TO authenticated
    USING (tenant_id = get_current_tenant_id() AND get_current_tenant_id() IS NOT NULL);

-- price_list_items
DROP POLICY IF EXISTS price_list_items_select ON price_list_items;
DROP POLICY IF EXISTS price_list_items_insert ON price_list_items;
DROP POLICY IF EXISTS price_list_items_update ON price_list_items;
DROP POLICY IF EXISTS price_list_items_delete ON price_list_items;

CREATE POLICY price_list_items_select ON price_list_items FOR SELECT TO authenticated
    USING (tenant_id = get_current_tenant_id() AND get_current_tenant_id() IS NOT NULL);
CREATE POLICY price_list_items_insert ON price_list_items FOR INSERT TO authenticated
    WITH CHECK (tenant_id = get_current_tenant_id() AND get_current_tenant_id() IS NOT NULL);
CREATE POLICY price_list_items_update ON price_list_items FOR UPDATE TO authenticated
    USING (tenant_id = get_current_tenant_id() AND get_current_tenant_id() IS NOT NULL)
    WITH CHECK (tenant_id = get_current_tenant_id() AND get_current_tenant_id() IS NOT NULL);
CREATE POLICY price_list_items_delete ON price_list_items FOR DELETE TO authenticated
    USING (tenant_id = get_current_tenant_id() AND get_current_tenant_id() IS NOT NULL);

-- customer_price_list
DROP POLICY IF EXISTS customer_price_list_select ON customer_price_list;
DROP POLICY IF EXISTS customer_price_list_insert ON customer_price_list;
DROP POLICY IF EXISTS customer_price_list_update ON customer_price_list;
DROP POLICY IF EXISTS customer_price_list_delete ON customer_price_list;

CREATE POLICY customer_price_list_select ON customer_price_list FOR SELECT TO authenticated
    USING (tenant_id = get_current_tenant_id() AND get_current_tenant_id() IS NOT NULL);
CREATE POLICY customer_price_list_insert ON customer_price_list FOR INSERT TO authenticated
    WITH CHECK (tenant_id = get_current_tenant_id() AND get_current_tenant_id() IS NOT NULL);
CREATE POLICY customer_price_list_update ON customer_price_list FOR UPDATE TO authenticated
    USING (tenant_id = get_current_tenant_id() AND get_current_tenant_id() IS NOT NULL)
    WITH CHECK (tenant_id = get_current_tenant_id() AND get_current_tenant_id() IS NOT NULL);
CREATE POLICY customer_price_list_delete ON customer_price_list FOR DELETE TO authenticated
    USING (tenant_id = get_current_tenant_id() AND get_current_tenant_id() IS NOT NULL);

-- ============================================================================
-- 6. get_effective_price() RPC
-- ============================================================================
-- Resolves the best price for a product+customer combination.
-- Priority:
--   1. Customer-specific price list (highest priority wins)
--   2. General active price list (highest priority, within date range)
--   3. Fallback: products.list_price

CREATE OR REPLACE FUNCTION get_effective_price(
    p_tenant_id UUID,
    p_product_id UUID,
    p_customer_id UUID DEFAULT NULL,
    p_quantity NUMERIC DEFAULT 1,
    p_date DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE (
    effective_price NUMERIC(15, 4),
    price_list_id UUID,
    price_list_name TEXT,
    price_source TEXT  -- 'customer_list', 'general_list', 'base_price'
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_price RECORD;
BEGIN
    -- Strategy 1: Customer-assigned price lists (highest priority first)
    IF p_customer_id IS NOT NULL THEN
        SELECT
            pli.unit_price,
            pl.id AS list_id,
            pl.name AS list_name
        INTO v_price
        FROM customer_price_list cpl
            JOIN price_lists pl ON pl.id = cpl.price_list_id
            JOIN price_list_items pli ON pli.price_list_id = pl.id
                AND pli.product_id = p_product_id
                AND pli.tenant_id = p_tenant_id
        WHERE cpl.tenant_id = p_tenant_id
          AND cpl.customer_id = p_customer_id
          AND pl.is_active = true
          AND (pl.valid_from IS NULL OR pl.valid_from <= p_date)
          AND (pl.valid_to IS NULL OR pl.valid_to >= p_date)
          AND pli.min_quantity <= p_quantity
          AND (pli.max_quantity IS NULL OR pli.max_quantity >= p_quantity)
        ORDER BY pl.priority DESC, pli.min_quantity DESC
        LIMIT 1;

        IF FOUND THEN
            RETURN QUERY SELECT v_price.unit_price, v_price.list_id, v_price.list_name, 'customer_list'::TEXT;
            RETURN;
        END IF;
    END IF;

    -- Strategy 2: General price lists (not customer-specific)
    SELECT
        pli.unit_price,
        pl.id AS list_id,
        pl.name AS list_name
    INTO v_price
    FROM price_lists pl
        JOIN price_list_items pli ON pli.price_list_id = pl.id
            AND pli.product_id = p_product_id
            AND pli.tenant_id = p_tenant_id
    WHERE pl.tenant_id = p_tenant_id
      AND pl.is_active = true
      AND (pl.valid_from IS NULL OR pl.valid_from <= p_date)
      AND (pl.valid_to IS NULL OR pl.valid_to >= p_date)
      AND pli.min_quantity <= p_quantity
      AND (pli.max_quantity IS NULL OR pli.max_quantity >= p_quantity)
      -- Exclude lists that are assigned to specific customers only
      AND NOT EXISTS (
          SELECT 1 FROM customer_price_list cpl2
          WHERE cpl2.price_list_id = pl.id AND cpl2.tenant_id = p_tenant_id
      )
    ORDER BY pl.priority DESC, pli.min_quantity DESC
    LIMIT 1;

    IF FOUND THEN
        RETURN QUERY SELECT v_price.unit_price, v_price.list_id, v_price.list_name, 'general_list'::TEXT;
        RETURN;
    END IF;

    -- Strategy 3: Fallback to product base price
    RETURN QUERY
    SELECT
        p.list_price::NUMERIC(15,4),
        NULL::UUID,
        'Base Price'::TEXT,
        'base_price'::TEXT
    FROM products p
    WHERE p.id = p_product_id
      AND p.tenant_id = p_tenant_id;
END;
$$;

COMMENT ON FUNCTION get_effective_price IS 'Resolves best price: customer list → general list → base price';

-- ============================================================================
-- 7. update_at trigger
-- ============================================================================

CREATE OR REPLACE FUNCTION update_price_list_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_price_lists_updated_at ON price_lists;
CREATE TRIGGER trg_price_lists_updated_at
    BEFORE UPDATE ON price_lists
    FOR EACH ROW EXECUTE FUNCTION update_price_list_updated_at();

DROP TRIGGER IF EXISTS trg_price_list_items_updated_at ON price_list_items;
CREATE TRIGGER trg_price_list_items_updated_at
    BEFORE UPDATE ON price_list_items
    FOR EACH ROW EXECUTE FUNCTION update_price_list_updated_at();

COMMIT;

-- === END price_lists ===

-- ============================================================================
-- Product Variants System
-- Migration: 20260221_product_variants
-- Date: 2026-02-19
-- Description: Adds parent/child product pattern for variants (sizes, colors,
--              materials). Parent products get has_variants flag, child variants
--              have their own SKU, pricing, and inventory.
-- Dependencies: products (007)
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. ADD has_variants FLAG TO PRODUCTS
-- ============================================================================

ALTER TABLE products ADD COLUMN IF NOT EXISTS has_variants BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN products.has_variants IS 'True if this product is a parent with variants';

-- ============================================================================
-- 2. VARIANT ATTRIBUTES TABLE
-- ============================================================================
-- Defines what attributes a tenant uses for variants: Color, Size, Material, etc.

CREATE TABLE IF NOT EXISTS variant_attributes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    name TEXT NOT NULL,                 -- "Color", "Size", "Material"
    display_name TEXT,                  -- Localized display name
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE(tenant_id, name)
);

COMMENT ON TABLE variant_attributes IS 'Variant dimension definitions per tenant (e.g., Color, Size)';

-- ============================================================================
-- 3. VARIANT ATTRIBUTE VALUES TABLE
-- ============================================================================
-- Allowed values per attribute: Red, Blue, Green for Color; S, M, L for Size.

CREATE TABLE IF NOT EXISTS variant_attribute_values (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    attribute_id UUID NOT NULL REFERENCES variant_attributes(id) ON DELETE CASCADE,
    value TEXT NOT NULL,                -- "Red", "M", "Cotton"
    display_value TEXT,                 -- Localized display value
    color_hex TEXT,                     -- Optional: hex color for swatches (#FF0000)
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE(tenant_id, attribute_id, value)
);

COMMENT ON TABLE variant_attribute_values IS 'Allowed values for each variant attribute';

-- ============================================================================
-- 4. PRODUCT VARIANTS TABLE
-- ============================================================================
-- Child products linked to a parent, with their own SKU, pricing, and attributes.

CREATE TABLE IF NOT EXISTS product_variants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    parent_product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    sku TEXT NOT NULL,
    name TEXT,                          -- Auto-generated or overridden: "T-Shirt - Red / M"
    attribute_values JSONB NOT NULL DEFAULT '{}',  -- {"color": "Red", "size": "M"}
    cost_price NUMERIC(15, 2) DEFAULT 0,
    list_price NUMERIC(15, 2) DEFAULT 0,
    weight NUMERIC(10, 3),
    barcode TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    image_url TEXT,
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE(tenant_id, sku),
    UNIQUE(tenant_id, parent_product_id, attribute_values)
);

COMMENT ON TABLE product_variants IS 'Child products with specific attribute combinations';
COMMENT ON COLUMN product_variants.attribute_values IS 'JSONB map of attribute_name → value, e.g. {"color":"Red","size":"M"}';

-- ============================================================================
-- 5. INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_variant_attributes_tenant
    ON variant_attributes(tenant_id, sort_order);

CREATE INDEX IF NOT EXISTS idx_variant_attribute_values_attr
    ON variant_attribute_values(tenant_id, attribute_id, sort_order);

CREATE INDEX IF NOT EXISTS idx_product_variants_parent
    ON product_variants(tenant_id, parent_product_id);

CREATE INDEX IF NOT EXISTS idx_product_variants_sku
    ON product_variants(tenant_id, sku);

CREATE INDEX IF NOT EXISTS idx_product_variants_attrs
    ON product_variants USING GIN (attribute_values);

CREATE INDEX IF NOT EXISTS idx_products_has_variants
    ON products(tenant_id, has_variants)
    WHERE has_variants = true;

-- ============================================================================
-- 6. ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE variant_attributes ENABLE ROW LEVEL SECURITY;
ALTER TABLE variant_attribute_values ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_variants ENABLE ROW LEVEL SECURITY;

-- variant_attributes
DROP POLICY IF EXISTS variant_attributes_select ON variant_attributes;
DROP POLICY IF EXISTS variant_attributes_insert ON variant_attributes;
DROP POLICY IF EXISTS variant_attributes_update ON variant_attributes;
DROP POLICY IF EXISTS variant_attributes_delete ON variant_attributes;

CREATE POLICY variant_attributes_select ON variant_attributes FOR SELECT TO authenticated
    USING (tenant_id = get_current_tenant_id() AND get_current_tenant_id() IS NOT NULL);
CREATE POLICY variant_attributes_insert ON variant_attributes FOR INSERT TO authenticated
    WITH CHECK (tenant_id = get_current_tenant_id() AND get_current_tenant_id() IS NOT NULL);
CREATE POLICY variant_attributes_update ON variant_attributes FOR UPDATE TO authenticated
    USING (tenant_id = get_current_tenant_id() AND get_current_tenant_id() IS NOT NULL)
    WITH CHECK (tenant_id = get_current_tenant_id() AND get_current_tenant_id() IS NOT NULL);
CREATE POLICY variant_attributes_delete ON variant_attributes FOR DELETE TO authenticated
    USING (tenant_id = get_current_tenant_id() AND get_current_tenant_id() IS NOT NULL);

-- variant_attribute_values
DROP POLICY IF EXISTS variant_attribute_values_select ON variant_attribute_values;
DROP POLICY IF EXISTS variant_attribute_values_insert ON variant_attribute_values;
DROP POLICY IF EXISTS variant_attribute_values_update ON variant_attribute_values;
DROP POLICY IF EXISTS variant_attribute_values_delete ON variant_attribute_values;

CREATE POLICY variant_attribute_values_select ON variant_attribute_values FOR SELECT TO authenticated
    USING (tenant_id = get_current_tenant_id() AND get_current_tenant_id() IS NOT NULL);
CREATE POLICY variant_attribute_values_insert ON variant_attribute_values FOR INSERT TO authenticated
    WITH CHECK (tenant_id = get_current_tenant_id() AND get_current_tenant_id() IS NOT NULL);
CREATE POLICY variant_attribute_values_update ON variant_attribute_values FOR UPDATE TO authenticated
    USING (tenant_id = get_current_tenant_id() AND get_current_tenant_id() IS NOT NULL)
    WITH CHECK (tenant_id = get_current_tenant_id() AND get_current_tenant_id() IS NOT NULL);
CREATE POLICY variant_attribute_values_delete ON variant_attribute_values FOR DELETE TO authenticated
    USING (tenant_id = get_current_tenant_id() AND get_current_tenant_id() IS NOT NULL);

-- product_variants
DROP POLICY IF EXISTS product_variants_select ON product_variants;
DROP POLICY IF EXISTS product_variants_insert ON product_variants;
DROP POLICY IF EXISTS product_variants_update ON product_variants;
DROP POLICY IF EXISTS product_variants_delete ON product_variants;

CREATE POLICY product_variants_select ON product_variants FOR SELECT TO authenticated
    USING (tenant_id = get_current_tenant_id() AND get_current_tenant_id() IS NOT NULL);
CREATE POLICY product_variants_insert ON product_variants FOR INSERT TO authenticated
    WITH CHECK (tenant_id = get_current_tenant_id() AND get_current_tenant_id() IS NOT NULL);
CREATE POLICY product_variants_update ON product_variants FOR UPDATE TO authenticated
    USING (tenant_id = get_current_tenant_id() AND get_current_tenant_id() IS NOT NULL)
    WITH CHECK (tenant_id = get_current_tenant_id() AND get_current_tenant_id() IS NOT NULL);
CREATE POLICY product_variants_delete ON product_variants FOR DELETE TO authenticated
    USING (tenant_id = get_current_tenant_id() AND get_current_tenant_id() IS NOT NULL);

-- ============================================================================
-- 7. get_product_variants() RPC
-- ============================================================================

CREATE OR REPLACE FUNCTION get_product_variants(
    p_product_id UUID,
    p_tenant_id UUID DEFAULT NULL
)
RETURNS TABLE (
    variant_id UUID,
    sku TEXT,
    variant_name TEXT,
    attribute_values JSONB,
    cost_price NUMERIC,
    list_price NUMERIC,
    is_active BOOLEAN,
    barcode TEXT,
    sort_order INT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_tenant_id UUID;
BEGIN
    -- Resolve tenant from product if not provided
    IF p_tenant_id IS NULL THEN
        SELECT tenant_id INTO v_tenant_id FROM products WHERE id = p_product_id;
    ELSE
        v_tenant_id := p_tenant_id;
    END IF;

    RETURN QUERY
    SELECT
        pv.id,
        pv.sku,
        pv.name,
        pv.attribute_values,
        pv.cost_price,
        pv.list_price,
        pv.is_active,
        pv.barcode,
        pv.sort_order
    FROM product_variants pv
    WHERE pv.parent_product_id = p_product_id
      AND pv.tenant_id = v_tenant_id
    ORDER BY pv.sort_order, pv.sku;
END;
$$;

-- ============================================================================
-- 8. Auto-generate variant name trigger
-- ============================================================================
-- When a variant is inserted/updated, auto-build name from parent + attributes.

CREATE OR REPLACE FUNCTION generate_variant_name()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
    v_parent_name TEXT;
    v_attr_parts TEXT[];
    v_key TEXT;
    v_val TEXT;
BEGIN
    -- Only auto-generate if name is not explicitly set
    IF NEW.name IS NOT NULL AND NEW.name != '' THEN
        RETURN NEW;
    END IF;

    -- Get parent product name
    SELECT name INTO v_parent_name FROM products WHERE id = NEW.parent_product_id;

    -- Build attribute string from JSONB
    FOR v_key, v_val IN SELECT * FROM jsonb_each_text(NEW.attribute_values) ORDER BY 1
    LOOP
        v_attr_parts := array_append(v_attr_parts, v_val);
    END LOOP;

    NEW.name := v_parent_name || ' - ' || array_to_string(v_attr_parts, ' / ');
    NEW.updated_at := NOW();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_generate_variant_name ON product_variants;
CREATE TRIGGER trg_generate_variant_name
    BEFORE INSERT OR UPDATE ON product_variants
    FOR EACH ROW EXECUTE FUNCTION generate_variant_name();

-- ============================================================================
-- 9. updated_at trigger
-- ============================================================================

CREATE OR REPLACE FUNCTION update_variant_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_variant_attributes_updated_at ON variant_attributes;
CREATE TRIGGER trg_variant_attributes_updated_at
    BEFORE UPDATE ON variant_attributes
    FOR EACH ROW EXECUTE FUNCTION update_variant_updated_at();

DROP TRIGGER IF EXISTS trg_product_variants_updated_at ON product_variants;
CREATE TRIGGER trg_product_variants_updated_at
    BEFORE UPDATE ON product_variants
    FOR EACH ROW EXECUTE FUNCTION update_variant_updated_at();

COMMIT;

-- === END product_variants ===

