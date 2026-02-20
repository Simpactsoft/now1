-- ============================================================================
-- BATCH 2: RPCs + POs + Payments
-- Run this SECOND in Supabase SQL Editor (after batch 1)
-- ============================================================================

-- ============================================================================
-- Profitability Validator
-- Migration: 20260222_profitability_validator
-- Date: 2026-02-19
-- Description: Margin guard that blocks quotes below tenants.min_margin_pct
--              unless explicitly approved. Tracks approvals for audit.
-- Dependencies: quotes (20260219), tenants (20260213)
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. MARGIN APPROVALS TABLE
-- ============================================================================
-- Audit trail for low-margin quote approvals.

CREATE TABLE IF NOT EXISTS margin_approvals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    quote_id UUID NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
    requested_by UUID,
    approved_by UUID,
    margin_pct NUMERIC(5, 2) NOT NULL,
    min_required NUMERIC(5, 2) NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'approved', 'rejected')),
    notes TEXT,
    requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resolved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE margin_approvals IS 'Audit trail for low-margin quote approvals';

-- ============================================================================
-- 2. INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_margin_approvals_tenant
    ON margin_approvals(tenant_id, status);

CREATE INDEX IF NOT EXISTS idx_margin_approvals_quote
    ON margin_approvals(tenant_id, quote_id);

CREATE INDEX IF NOT EXISTS idx_margin_approvals_pending
    ON margin_approvals(tenant_id, status)
    WHERE status = 'pending';

-- ============================================================================
-- 3. ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE margin_approvals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS margin_approvals_select ON margin_approvals;
DROP POLICY IF EXISTS margin_approvals_insert ON margin_approvals;
DROP POLICY IF EXISTS margin_approvals_update ON margin_approvals;

CREATE POLICY margin_approvals_select ON margin_approvals FOR SELECT TO authenticated
    USING (tenant_id = get_current_tenant_id() AND get_current_tenant_id() IS NOT NULL);
CREATE POLICY margin_approvals_insert ON margin_approvals FOR INSERT TO authenticated
    WITH CHECK (tenant_id = get_current_tenant_id() AND get_current_tenant_id() IS NOT NULL);
CREATE POLICY margin_approvals_update ON margin_approvals FOR UPDATE TO authenticated
    USING (tenant_id = get_current_tenant_id() AND get_current_tenant_id() IS NOT NULL)
    WITH CHECK (tenant_id = get_current_tenant_id() AND get_current_tenant_id() IS NOT NULL);

-- ============================================================================
-- 4. validate_quote_margin() RPC
-- ============================================================================
-- Computes margin %, compares to tenants.min_margin_pct.
-- If below → sets quote status to 'pending_approval' and creates approval request.

CREATE OR REPLACE FUNCTION validate_quote_margin(
    p_quote_id UUID
)
RETURNS TABLE (
    margin_pct NUMERIC(5, 2),
    min_required NUMERIC(5, 2),
    is_below_minimum BOOLEAN,
    requires_approval BOOLEAN,
    approval_id UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_tenant_id UUID;
    v_grand_total NUMERIC;
    v_total_cost NUMERIC;
    v_margin_pct NUMERIC(5, 2);
    v_min_margin NUMERIC(5, 2);
    v_below BOOLEAN;
    v_approval_id UUID;
BEGIN
    -- Get quote details
    SELECT q.tenant_id, q.grand_total, q.total_cost
    INTO v_tenant_id, v_grand_total, v_total_cost
    FROM quotes q
    WHERE q.id = p_quote_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Quote % not found', p_quote_id;
    END IF;

    -- Compute margin
    IF v_grand_total > 0 AND v_total_cost IS NOT NULL THEN
        v_margin_pct := ROUND(((v_grand_total - v_total_cost) / v_grand_total) * 100, 2);
    ELSE
        v_margin_pct := 100.00; -- No cost data = assume full margin
    END IF;

    -- Get tenant minimum margin
    SELECT COALESCE(t.min_margin_pct, 0)
    INTO v_min_margin
    FROM tenants t
    WHERE t.id = v_tenant_id;

    v_below := v_margin_pct < v_min_margin;

    -- Update quote with computed margin
    UPDATE quotes
    SET margin_pct = v_margin_pct,
        updated_at = NOW()
    WHERE id = p_quote_id;

    -- If below minimum, create approval request + change status
    IF v_below THEN
        INSERT INTO margin_approvals (tenant_id, quote_id, margin_pct, min_required, status)
        VALUES (v_tenant_id, p_quote_id, v_margin_pct, v_min_margin, 'pending')
        RETURNING id INTO v_approval_id;

        UPDATE quotes
        SET status = 'pending_approval',
            updated_at = NOW()
        WHERE id = p_quote_id
          AND status IN ('draft', 'approved');
    END IF;

    RETURN QUERY SELECT v_margin_pct, v_min_margin, v_below, v_below, v_approval_id;
END;
$$;

COMMENT ON FUNCTION validate_quote_margin IS 'Checks quote margin against tenant minimum, auto-creates approval if below';

-- ============================================================================
-- 5. approve_margin() RPC
-- ============================================================================
-- Manager approval: logs approval and advances quote status.

CREATE OR REPLACE FUNCTION approve_margin(
    p_quote_id UUID,
    p_approver_id UUID,
    p_notes TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_approval_id UUID;
BEGIN
    -- Find pending approval
    SELECT id INTO v_approval_id
    FROM margin_approvals
    WHERE quote_id = p_quote_id
      AND status = 'pending'
    ORDER BY requested_at DESC
    LIMIT 1;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'No pending approval found for quote %', p_quote_id;
    END IF;

    -- Approve
    UPDATE margin_approvals
    SET status = 'approved',
        approved_by = p_approver_id,
        notes = COALESCE(p_notes, notes),
        resolved_at = NOW()
    WHERE id = v_approval_id;

    -- Advance quote status
    UPDATE quotes
    SET status = 'approved',
        updated_at = NOW()
    WHERE id = p_quote_id
      AND status = 'pending_approval';

    RETURN TRUE;
END;
$$;

-- ============================================================================
-- 6. reject_margin() RPC
-- ============================================================================

CREATE OR REPLACE FUNCTION reject_margin(
    p_quote_id UUID,
    p_rejector_id UUID,
    p_notes TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_approval_id UUID;
BEGIN
    SELECT id INTO v_approval_id
    FROM margin_approvals
    WHERE quote_id = p_quote_id
      AND status = 'pending'
    ORDER BY requested_at DESC
    LIMIT 1;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'No pending approval found for quote %', p_quote_id;
    END IF;

    UPDATE margin_approvals
    SET status = 'rejected',
        approved_by = p_rejector_id,
        notes = COALESCE(p_notes, notes),
        resolved_at = NOW()
    WHERE id = v_approval_id;

    -- Return quote to draft
    UPDATE quotes
    SET status = 'draft',
        updated_at = NOW()
    WHERE id = p_quote_id
      AND status = 'pending_approval';

    RETURN TRUE;
END;
$$;

COMMIT;

-- === END profitability_validator ===

-- ============================================================================
-- Invoice Account Fix
-- Migration: 20260220_invoice_account_fix
-- Date: 2026-02-20
-- Description: Fix issue_invoice RPC to RAISE EXCEPTION when GL accounts
--              (1300, 4100, 2200) are missing, instead of silently skipping
--              the journal entry. Ensures accounting integrity.
-- Dependencies: 20260219_invoice_generation
-- ============================================================================

BEGIN;

-- Replace issue_invoice with hard failure on missing accounts
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

    -- Hard failure if any required account is missing
    IF v_receivable_account IS NULL THEN
        RAISE EXCEPTION 'Missing GL account: Receivables (1300) not found for tenant %', v_invoice.tenant_id;
    END IF;

    IF v_revenue_account IS NULL THEN
        RAISE EXCEPTION 'Missing GL account: Revenue (4100) not found for tenant %', v_invoice.tenant_id;
    END IF;

    IF v_vat_account IS NULL THEN
        RAISE EXCEPTION 'Missing GL account: VAT Payable (2200) not found for tenant %', v_invoice.tenant_id;
    END IF;

    -- Create journal entry header (always executes — accounts are guaranteed above)
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
    IF v_invoice.vat_amount > 0 THEN
        INSERT INTO journal_lines (tenant_id, journal_entry_id, account_id, debit, credit, memo)
        VALUES (v_invoice.tenant_id, v_je_id, v_vat_account, 0, v_invoice.vat_amount,
                'VAT on invoice ' || v_invoice.invoice_number);
    END IF;

    -- Post the journal entry
    UPDATE journal_entries SET status = 'posted' WHERE id = v_je_id;

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

COMMENT ON FUNCTION issue_invoice IS 'Issues a draft invoice: raises exception if GL accounts missing, creates accounting entries (DR Receivables, CR Revenue + CR VAT) and marks as issued';

COMMIT;

-- === END invoice_account_fix ===

-- ============================================================================
-- Purchase Orders
-- Migration: 20260220_purchase_orders
-- Date: 2026-02-20
-- Description: Vendors, purchase orders, PO items tables. Renames
--              invoice_number_sequences → document_number_sequences.
--              RPCs for PO lifecycle: submit, approve, receive, cancel.
--              Receive creates inventory entries + journal entry.
-- Dependencies: 007_add_sales_inventory_tables, 20260219_invoice_generation,
--               20260219_multi_warehouse, 20260223_accounting_mvp,
--               20260215_tax_engine, 20260221_product_variants
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. RENAME invoice_number_sequences → document_number_sequences
-- ============================================================================

ALTER TABLE IF EXISTS invoice_number_sequences RENAME TO document_number_sequences;

-- Add document_type column (default 'invoice' for backward compat)
ALTER TABLE document_number_sequences
    ADD COLUMN IF NOT EXISTS document_type TEXT NOT NULL DEFAULT 'invoice';

-- Drop old unique, add new one with document_type
ALTER TABLE document_number_sequences
    DROP CONSTRAINT IF EXISTS invoice_number_sequences_tenant_id_prefix_year_key;

ALTER TABLE document_number_sequences
    ADD CONSTRAINT document_number_sequences_tenant_type_prefix_year_key
    UNIQUE (tenant_id, document_type, prefix, year);

-- ============================================================================
-- 2. REPLACE generate_invoice_number with generate_document_number
-- ============================================================================

CREATE OR REPLACE FUNCTION generate_document_number(
    p_tenant_id UUID,
    p_document_type TEXT DEFAULT 'invoice',
    p_prefix TEXT DEFAULT NULL
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_year INT := EXTRACT(YEAR FROM CURRENT_DATE)::INT;
    v_next INT;
    v_prefix TEXT;
BEGIN
    -- Default prefix based on document type
    IF p_prefix IS NOT NULL THEN
        v_prefix := p_prefix;
    ELSIF p_document_type = 'invoice' THEN
        v_prefix := 'INV';
    ELSIF p_document_type = 'po' THEN
        v_prefix := 'PO';
    ELSIF p_document_type = 'payment' THEN
        v_prefix := 'PAY';
    ELSE
        v_prefix := UPPER(LEFT(p_document_type, 3));
    END IF;

    INSERT INTO document_number_sequences (tenant_id, document_type, prefix, year, last_number)
    VALUES (p_tenant_id, p_document_type, v_prefix, v_year, 1)
    ON CONFLICT (tenant_id, document_type, prefix, year)
    DO UPDATE SET last_number = document_number_sequences.last_number + 1
    RETURNING last_number INTO v_next;

    RETURN v_prefix || '-' || v_year::TEXT || '-' || LPAD(v_next::TEXT, 4, '0');
END;
$$;

COMMENT ON FUNCTION generate_document_number IS 'Generates next sequential document number per tenant/type/year';

-- Keep backward-compat wrapper
CREATE OR REPLACE FUNCTION generate_invoice_number(
    p_tenant_id UUID,
    p_prefix TEXT DEFAULT 'INV'
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN generate_document_number(p_tenant_id, 'invoice', p_prefix);
END;
$$;

-- ============================================================================
-- 3. VENDORS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS vendors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    name TEXT NOT NULL,
    contact_name TEXT,
    email TEXT,
    phone TEXT,
    address_line1 TEXT,
    address_line2 TEXT,
    city TEXT,
    country TEXT DEFAULT 'IL',
    tax_id TEXT,
    payment_terms_days INTEGER DEFAULT 30,
    notes TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE vendors IS 'Supplier/vendor master data for purchase orders';

-- Unique tax_id per tenant (only when not null)
CREATE UNIQUE INDEX IF NOT EXISTS idx_vendors_tenant_taxid
    ON vendors(tenant_id, tax_id) WHERE tax_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_vendors_tenant ON vendors(tenant_id);
CREATE INDEX IF NOT EXISTS idx_vendors_tenant_active ON vendors(tenant_id, is_active);

-- RLS
ALTER TABLE vendors ENABLE ROW LEVEL SECURITY;

CREATE POLICY vendors_select ON vendors FOR SELECT TO authenticated
    USING (tenant_id = get_current_tenant_id() AND get_current_tenant_id() IS NOT NULL);
CREATE POLICY vendors_all ON vendors FOR ALL TO authenticated
    USING (tenant_id = get_current_tenant_id() AND get_current_tenant_id() IS NOT NULL)
    WITH CHECK (tenant_id = get_current_tenant_id() AND get_current_tenant_id() IS NOT NULL);

-- ============================================================================
-- 4. PURCHASE ORDERS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS purchase_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    po_number TEXT NOT NULL,
    vendor_id UUID NOT NULL REFERENCES vendors(id),
    status TEXT NOT NULL DEFAULT 'draft'
        CHECK (status IN ('draft', 'submitted', 'approved', 'received', 'partial', 'cancelled')),
    order_date DATE DEFAULT CURRENT_DATE,
    expected_delivery_date DATE,
    warehouse_id UUID REFERENCES warehouses(id),
    tax_zone_id UUID REFERENCES tax_zones(id),
    subtotal NUMERIC(15, 2) NOT NULL DEFAULT 0,
    tax_amount NUMERIC(15, 2) NOT NULL DEFAULT 0,
    total NUMERIC(15, 2) NOT NULL DEFAULT 0,
    currency TEXT DEFAULT 'ILS',
    notes TEXT,
    created_by UUID,
    approved_by UUID,
    approved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE(tenant_id, po_number)
);

COMMENT ON TABLE purchase_orders IS 'Purchase orders sent to vendors for procurement';

CREATE INDEX IF NOT EXISTS idx_po_tenant_status ON purchase_orders(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_po_vendor ON purchase_orders(tenant_id, vendor_id);
CREATE INDEX IF NOT EXISTS idx_po_warehouse ON purchase_orders(tenant_id, warehouse_id);

-- RLS
ALTER TABLE purchase_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY po_select ON purchase_orders FOR SELECT TO authenticated
    USING (tenant_id = get_current_tenant_id() AND get_current_tenant_id() IS NOT NULL);
CREATE POLICY po_all ON purchase_orders FOR ALL TO authenticated
    USING (tenant_id = get_current_tenant_id() AND get_current_tenant_id() IS NOT NULL)
    WITH CHECK (tenant_id = get_current_tenant_id() AND get_current_tenant_id() IS NOT NULL);

-- ============================================================================
-- 5. PURCHASE ORDER ITEMS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS purchase_order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    po_id UUID NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL,
    product_id UUID REFERENCES products(id),
    variant_id UUID REFERENCES product_variants(id),
    description TEXT NOT NULL,
    quantity NUMERIC(15, 4) NOT NULL CHECK (quantity > 0),
    received_quantity NUMERIC(15, 4) NOT NULL DEFAULT 0 CHECK (received_quantity >= 0),
    unit_price NUMERIC(15, 4) NOT NULL CHECK (unit_price >= 0),
    tax_rate NUMERIC(5, 4) NOT NULL DEFAULT 0,
    line_total NUMERIC(15, 2) GENERATED ALWAYS AS (ROUND(quantity * unit_price, 2)) STORED,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE purchase_order_items IS 'Line items for purchase orders';

CREATE INDEX IF NOT EXISTS idx_po_items_po ON purchase_order_items(po_id);
CREATE INDEX IF NOT EXISTS idx_po_items_product ON purchase_order_items(product_id);

-- RLS
ALTER TABLE purchase_order_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY po_items_select ON purchase_order_items FOR SELECT TO authenticated
    USING (tenant_id = get_current_tenant_id() AND get_current_tenant_id() IS NOT NULL);
CREATE POLICY po_items_all ON purchase_order_items FOR ALL TO authenticated
    USING (tenant_id = get_current_tenant_id() AND get_current_tenant_id() IS NOT NULL)
    WITH CHECK (tenant_id = get_current_tenant_id() AND get_current_tenant_id() IS NOT NULL);

-- ============================================================================
-- 6. RPCs
-- ============================================================================

-- 6a. submit_purchase_order
CREATE OR REPLACE FUNCTION submit_purchase_order(p_po_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_po purchase_orders%ROWTYPE;
    v_item_count INT;
    v_invalid_count INT;
BEGIN
    SELECT * INTO v_po FROM purchase_orders WHERE id = p_po_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Purchase order % not found', p_po_id;
    END IF;

    IF v_po.status != 'draft' THEN
        RAISE EXCEPTION 'PO % is not in draft status (current: %)', p_po_id, v_po.status;
    END IF;

    -- Validate has items
    SELECT COUNT(*) INTO v_item_count FROM purchase_order_items WHERE po_id = p_po_id;
    IF v_item_count = 0 THEN
        RAISE EXCEPTION 'PO % has no items', p_po_id;
    END IF;

    -- Validate all items have qty > 0
    SELECT COUNT(*) INTO v_invalid_count
    FROM purchase_order_items WHERE po_id = p_po_id AND quantity <= 0;
    IF v_invalid_count > 0 THEN
        RAISE EXCEPTION 'PO % has % items with invalid quantity', p_po_id, v_invalid_count;
    END IF;

    UPDATE purchase_orders
    SET status = 'submitted', updated_at = NOW()
    WHERE id = p_po_id;

    RETURN TRUE;
END;
$$;

COMMENT ON FUNCTION submit_purchase_order IS 'Validates and submits a draft PO';

-- 6b. approve_purchase_order
CREATE OR REPLACE FUNCTION approve_purchase_order(
    p_po_id UUID,
    p_approved_by UUID DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_po purchase_orders%ROWTYPE;
BEGIN
    SELECT * INTO v_po FROM purchase_orders WHERE id = p_po_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Purchase order % not found', p_po_id;
    END IF;

    IF v_po.status != 'submitted' THEN
        RAISE EXCEPTION 'PO % is not in submitted status (current: %)', p_po_id, v_po.status;
    END IF;

    UPDATE purchase_orders
    SET status = 'approved',
        approved_by = p_approved_by,
        approved_at = NOW(),
        updated_at = NOW()
    WHERE id = p_po_id;

    RETURN TRUE;
END;
$$;

COMMENT ON FUNCTION approve_purchase_order IS 'Approves a submitted PO';

-- 6c. receive_purchase_order
-- p_items = array of {"item_id": uuid, "received_qty": numeric}
CREATE OR REPLACE FUNCTION receive_purchase_order(
    p_po_id UUID,
    p_items JSONB,
    p_received_by UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_po purchase_orders%ROWTYPE;
    v_item RECORD;
    v_recv RECORD;
    v_all_received BOOLEAN := TRUE;
    v_any_received BOOLEAN := FALSE;
    v_je_id UUID;
    v_total_cost NUMERIC := 0;
    v_inventory_account UUID;
    v_ap_account UUID;
    v_warehouse_id UUID;
BEGIN
    -- Get PO
    SELECT * INTO v_po FROM purchase_orders WHERE id = p_po_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Purchase order % not found', p_po_id;
    END IF;

    IF v_po.status NOT IN ('approved', 'partial') THEN
        RAISE EXCEPTION 'PO % cannot receive goods (status: %)', p_po_id, v_po.status;
    END IF;

    -- Determine warehouse
    v_warehouse_id := v_po.warehouse_id;
    IF v_warehouse_id IS NULL THEN
        -- Use default warehouse for tenant
        SELECT id INTO v_warehouse_id FROM warehouses
        WHERE tenant_id = v_po.tenant_id AND is_default = true LIMIT 1;
        IF v_warehouse_id IS NULL THEN
            RAISE EXCEPTION 'No warehouse specified on PO and no default warehouse found for tenant %', v_po.tenant_id;
        END IF;
    END IF;

    -- Lookup GL accounts by account_number
    SELECT id INTO v_inventory_account FROM chart_of_accounts
        WHERE tenant_id = v_po.tenant_id AND account_number = '1400' LIMIT 1;
    SELECT id INTO v_ap_account FROM chart_of_accounts
        WHERE tenant_id = v_po.tenant_id AND account_number = '2100' LIMIT 1;

    IF v_inventory_account IS NULL THEN
        RAISE EXCEPTION 'Missing GL account: Inventory (1400) not found for tenant %', v_po.tenant_id;
    END IF;
    IF v_ap_account IS NULL THEN
        RAISE EXCEPTION 'Missing GL account: Accounts Payable (2100) not found for tenant %', v_po.tenant_id;
    END IF;

    -- Process each received item
    FOR v_recv IN SELECT * FROM jsonb_to_recordset(p_items) AS x(item_id UUID, received_qty NUMERIC)
    LOOP
        -- Get the PO item
        SELECT * INTO v_item FROM purchase_order_items
        WHERE id = v_recv.item_id AND po_id = p_po_id;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'PO item % not found on PO %', v_recv.item_id, p_po_id;
        END IF;

        IF v_recv.received_qty <= 0 THEN
            CONTINUE; -- skip zero/negative
        END IF;

        -- Check not over-receiving
        IF (v_item.received_quantity + v_recv.received_qty) > v_item.quantity THEN
            RAISE EXCEPTION 'Over-receiving item %: ordered %, already received %, trying to receive %',
                v_recv.item_id, v_item.quantity, v_item.received_quantity, v_recv.received_qty;
        END IF;

        -- Update received quantity
        UPDATE purchase_order_items
        SET received_quantity = received_quantity + v_recv.received_qty,
            updated_at = NOW()
        WHERE id = v_recv.item_id;

        -- Create inventory ledger entry
        IF v_item.product_id IS NOT NULL THEN
            INSERT INTO inventory_ledger (
                tenant_id, product_id, warehouse_id,
                transaction_type, quantity_change, reference_id, notes
            ) VALUES (
                v_po.tenant_id, v_item.product_id, v_warehouse_id,
                'po_receipt', v_recv.received_qty, p_po_id,
                'PO ' || v_po.po_number || ' receipt'
            );
        END IF;

        v_total_cost := v_total_cost + ROUND(v_recv.received_qty * v_item.unit_price, 2);
        v_any_received := TRUE;
    END LOOP;

    IF NOT v_any_received THEN
        RAISE EXCEPTION 'No items were received';
    END IF;

    -- Check if all items fully received
    SELECT bool_and(received_quantity >= quantity) INTO v_all_received
    FROM purchase_order_items WHERE po_id = p_po_id;

    -- Create journal entry: DR Inventory, CR Accounts Payable
    INSERT INTO journal_entries (tenant_id, entry_date, memo, status, reference_type, reference_id, created_by)
    VALUES (
        v_po.tenant_id, CURRENT_DATE,
        'PO ' || v_po.po_number || ' goods received',
        'draft', 'purchase_order', p_po_id, p_received_by
    )
    RETURNING id INTO v_je_id;

    -- DR: Inventory asset
    INSERT INTO journal_lines (tenant_id, journal_entry_id, account_id, debit, credit, description)
    VALUES (v_po.tenant_id, v_je_id, v_inventory_account, v_total_cost, 0,
            'Inventory from PO ' || v_po.po_number);

    -- CR: Accounts Payable
    INSERT INTO journal_lines (tenant_id, journal_entry_id, account_id, debit, credit, description)
    VALUES (v_po.tenant_id, v_je_id, v_ap_account, 0, v_total_cost,
            'AP for PO ' || v_po.po_number);

    -- Post journal entry
    UPDATE journal_entries SET status = 'posted', posted_date = NOW() WHERE id = v_je_id;

    -- Update PO status
    UPDATE purchase_orders
    SET status = CASE WHEN v_all_received THEN 'received' ELSE 'partial' END,
        updated_at = NOW()
    WHERE id = p_po_id;

    RETURN v_je_id;
END;
$$;

COMMENT ON FUNCTION receive_purchase_order IS 'Receives goods on a PO: updates inventory, creates journal entry (DR Inventory, CR AP)';

-- 6d. cancel_purchase_order
CREATE OR REPLACE FUNCTION cancel_purchase_order(p_po_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_status TEXT;
BEGIN
    SELECT status INTO v_status FROM purchase_orders WHERE id = p_po_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Purchase order % not found', p_po_id;
    END IF;

    IF v_status NOT IN ('draft', 'submitted') THEN
        RAISE EXCEPTION 'Cannot cancel PO in status: %', v_status;
    END IF;

    UPDATE purchase_orders
    SET status = 'cancelled', updated_at = NOW()
    WHERE id = p_po_id;

    RETURN TRUE;
END;
$$;

COMMENT ON FUNCTION cancel_purchase_order IS 'Cancels a draft or submitted PO';

-- ============================================================================
-- 7. TRIGGERS: updated_at
-- ============================================================================

CREATE OR REPLACE FUNCTION update_vendors_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_vendors_updated_at ON vendors;
CREATE TRIGGER trg_vendors_updated_at
    BEFORE UPDATE ON vendors
    FOR EACH ROW EXECUTE FUNCTION update_vendors_updated_at();

CREATE OR REPLACE FUNCTION update_po_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_po_updated_at ON purchase_orders;
CREATE TRIGGER trg_po_updated_at
    BEFORE UPDATE ON purchase_orders
    FOR EACH ROW EXECUTE FUNCTION update_po_updated_at();

CREATE OR REPLACE FUNCTION update_po_items_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_po_items_updated_at ON purchase_order_items;
CREATE TRIGGER trg_po_items_updated_at
    BEFORE UPDATE ON purchase_order_items
    FOR EACH ROW EXECUTE FUNCTION update_po_items_updated_at();

COMMIT;

-- === END purchase_orders ===

-- ============================================================================
-- Payment Tracking
-- Migration: 20260220_payment_tracking
-- Date: 2026-02-20
-- Description: Payments, payment_allocations, invoice amount_paid/balance_due,
--              RPCs for post_payment, void_payment.
-- Dependencies: 007_add_sales_inventory_tables, 20260219_invoice_generation,
--               20260220_purchase_orders, 20260223_accounting_mvp
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. PAYMENTS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    payment_number TEXT NOT NULL,
    payment_type TEXT NOT NULL
        CHECK (payment_type IN ('customer_receipt', 'vendor_payment')),
    entity_type TEXT NOT NULL
        CHECK (entity_type IN ('customer', 'vendor')),
    entity_id UUID NOT NULL,     -- references cards.id (customer) or vendors.id
    payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
    payment_method TEXT NOT NULL DEFAULT 'bank_transfer'
        CHECK (payment_method IN ('cash', 'bank_transfer', 'check', 'credit_card', 'other')),
    amount NUMERIC(15, 2) NOT NULL CHECK (amount > 0),
    currency TEXT NOT NULL DEFAULT 'ILS',
    reference TEXT,              -- check number, transfer ref, etc.
    status TEXT NOT NULL DEFAULT 'draft'
        CHECK (status IN ('draft', 'posted', 'void')),
    journal_entry_id UUID REFERENCES journal_entries(id),
    notes TEXT,
    created_by UUID,
    posted_at TIMESTAMPTZ,
    voided_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE(tenant_id, payment_number)
);

COMMENT ON TABLE payments IS 'Customer receipts and vendor payments';

CREATE INDEX IF NOT EXISTS idx_payments_tenant_status ON payments(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_payments_type ON payments(tenant_id, payment_type);
CREATE INDEX IF NOT EXISTS idx_payments_entity ON payments(tenant_id, entity_type, entity_id);

-- RLS
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY payments_select ON payments FOR SELECT TO authenticated
    USING (tenant_id = get_current_tenant_id() AND get_current_tenant_id() IS NOT NULL);
CREATE POLICY payments_all ON payments FOR ALL TO authenticated
    USING (tenant_id = get_current_tenant_id() AND get_current_tenant_id() IS NOT NULL)
    WITH CHECK (tenant_id = get_current_tenant_id() AND get_current_tenant_id() IS NOT NULL);

-- ============================================================================
-- 2. PAYMENT ALLOCATIONS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS payment_allocations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    payment_id UUID NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
    invoice_id UUID REFERENCES invoices(id),
    po_id UUID REFERENCES purchase_orders(id),
    amount NUMERIC(15, 2) NOT NULL CHECK (amount > 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Must link to either invoice or PO, not both
    CHECK (
        (invoice_id IS NOT NULL AND po_id IS NULL)
        OR (invoice_id IS NULL AND po_id IS NOT NULL)
    )
);

COMMENT ON TABLE payment_allocations IS 'Allocates payment amounts to specific invoices or purchase orders';

CREATE INDEX IF NOT EXISTS idx_alloc_payment ON payment_allocations(payment_id);
CREATE INDEX IF NOT EXISTS idx_alloc_invoice ON payment_allocations(invoice_id) WHERE invoice_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_alloc_po ON payment_allocations(po_id) WHERE po_id IS NOT NULL;

-- RLS
ALTER TABLE payment_allocations ENABLE ROW LEVEL SECURITY;

CREATE POLICY alloc_select ON payment_allocations FOR SELECT TO authenticated
    USING (tenant_id = get_current_tenant_id() AND get_current_tenant_id() IS NOT NULL);
CREATE POLICY alloc_all ON payment_allocations FOR ALL TO authenticated
    USING (tenant_id = get_current_tenant_id() AND get_current_tenant_id() IS NOT NULL)
    WITH CHECK (tenant_id = get_current_tenant_id() AND get_current_tenant_id() IS NOT NULL);

-- ============================================================================
-- 3. ALTER INVOICES — add amount_paid + balance_due
-- ============================================================================

ALTER TABLE invoices ADD COLUMN IF NOT EXISTS amount_paid NUMERIC(15, 2) NOT NULL DEFAULT 0;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS balance_due NUMERIC(15, 2);

-- Initialize balance_due for existing invoices
UPDATE invoices SET balance_due = COALESCE(total_amount, 0) - amount_paid
WHERE balance_due IS NULL;

-- Trigger to keep balance_due in sync
CREATE OR REPLACE FUNCTION update_invoice_balance_due()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.balance_due := COALESCE(NEW.total_amount, 0) - NEW.amount_paid;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_invoice_balance_due ON invoices;
CREATE TRIGGER trg_invoice_balance_due
    BEFORE INSERT OR UPDATE ON invoices
    FOR EACH ROW EXECUTE FUNCTION update_invoice_balance_due();

-- ============================================================================
-- 4. RPCs
-- ============================================================================

-- 4a. post_payment
CREATE OR REPLACE FUNCTION post_payment(p_payment_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_pay payments%ROWTYPE;
    v_alloc_sum NUMERIC;
    v_je_id UUID;
    v_cash_account UUID;
    v_ar_account UUID;
    v_ap_account UUID;
    v_alloc RECORD;
    v_inv_paid_sum NUMERIC;
BEGIN
    -- Get payment
    SELECT * INTO v_pay FROM payments WHERE id = p_payment_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Payment % not found', p_payment_id;
    END IF;

    IF v_pay.status != 'draft' THEN
        RAISE EXCEPTION 'Payment % is not in draft status (current: %)', p_payment_id, v_pay.status;
    END IF;

    -- Validate allocations sum equals payment amount
    SELECT COALESCE(SUM(amount), 0) INTO v_alloc_sum
    FROM payment_allocations WHERE payment_id = p_payment_id;

    IF v_alloc_sum != v_pay.amount THEN
        RAISE EXCEPTION 'Allocation total (%) does not match payment amount (%)',
            v_alloc_sum, v_pay.amount;
    END IF;

    -- Lookup GL accounts by account_number
    SELECT id INTO v_cash_account FROM chart_of_accounts
        WHERE tenant_id = v_pay.tenant_id AND account_number = '1100' LIMIT 1;
    SELECT id INTO v_ar_account FROM chart_of_accounts
        WHERE tenant_id = v_pay.tenant_id AND account_number = '1300' LIMIT 1;
    SELECT id INTO v_ap_account FROM chart_of_accounts
        WHERE tenant_id = v_pay.tenant_id AND account_number = '2100' LIMIT 1;

    IF v_cash_account IS NULL THEN
        RAISE EXCEPTION 'Missing GL account: Cash/Bank (1100) not found for tenant %', v_pay.tenant_id;
    END IF;

    -- Create journal entry
    INSERT INTO journal_entries (tenant_id, entry_date, memo, status, reference_type, reference_id, created_by)
    VALUES (
        v_pay.tenant_id, v_pay.payment_date,
        CASE v_pay.payment_type
            WHEN 'customer_receipt' THEN 'Customer receipt ' || v_pay.payment_number
            WHEN 'vendor_payment' THEN 'Vendor payment ' || v_pay.payment_number
        END,
        'draft', 'payment', p_payment_id, v_pay.created_by
    )
    RETURNING id INTO v_je_id;

    IF v_pay.payment_type = 'customer_receipt' THEN
        -- DR Cash, CR Accounts Receivable
        IF v_ar_account IS NULL THEN
            RAISE EXCEPTION 'Missing GL account: Accounts Receivable (1300) not found for tenant %', v_pay.tenant_id;
        END IF;

        INSERT INTO journal_lines (tenant_id, journal_entry_id, account_id, debit, credit, description)
        VALUES (v_pay.tenant_id, v_je_id, v_cash_account, v_pay.amount, 0,
                'Receipt ' || v_pay.payment_number);

        INSERT INTO journal_lines (tenant_id, journal_entry_id, account_id, debit, credit, description)
        VALUES (v_pay.tenant_id, v_je_id, v_ar_account, 0, v_pay.amount,
                'Receipt ' || v_pay.payment_number);

        -- Update invoice amount_paid for each allocation
        FOR v_alloc IN SELECT * FROM payment_allocations WHERE payment_id = p_payment_id AND invoice_id IS NOT NULL
        LOOP
            UPDATE invoices
            SET amount_paid = amount_paid + v_alloc.amount,
                updated_at = NOW()
            WHERE id = v_alloc.invoice_id;

            -- Check if invoice is fully paid
            SELECT amount_paid INTO v_inv_paid_sum FROM invoices WHERE id = v_alloc.invoice_id;
            UPDATE invoices
            SET status = CASE
                WHEN v_inv_paid_sum >= COALESCE(total_amount, 0) THEN 'paid'
                ELSE status
            END
            WHERE id = v_alloc.invoice_id AND status = 'issued';
        END LOOP;

    ELSIF v_pay.payment_type = 'vendor_payment' THEN
        -- DR Accounts Payable, CR Cash
        IF v_ap_account IS NULL THEN
            RAISE EXCEPTION 'Missing GL account: Accounts Payable (2100) not found for tenant %', v_pay.tenant_id;
        END IF;

        INSERT INTO journal_lines (tenant_id, journal_entry_id, account_id, debit, credit, description)
        VALUES (v_pay.tenant_id, v_je_id, v_ap_account, v_pay.amount, 0,
                'Payment ' || v_pay.payment_number);

        INSERT INTO journal_lines (tenant_id, journal_entry_id, account_id, debit, credit, description)
        VALUES (v_pay.tenant_id, v_je_id, v_cash_account, 0, v_pay.amount,
                'Payment ' || v_pay.payment_number);
    END IF;

    -- Post journal entry
    UPDATE journal_entries SET status = 'posted', posted_date = NOW() WHERE id = v_je_id;

    -- Update payment status
    UPDATE payments
    SET status = 'posted',
        journal_entry_id = v_je_id,
        posted_at = NOW(),
        updated_at = NOW()
    WHERE id = p_payment_id;

    RETURN v_je_id;
END;
$$;

COMMENT ON FUNCTION post_payment IS 'Posts a payment: creates journal entry, updates invoice paid status';

-- 4b. void_payment
CREATE OR REPLACE FUNCTION void_payment(p_payment_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_pay payments%ROWTYPE;
    v_je_id UUID;
    v_rev_je_id UUID;
    v_line RECORD;
    v_alloc RECORD;
BEGIN
    -- Get payment
    SELECT * INTO v_pay FROM payments WHERE id = p_payment_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Payment % not found', p_payment_id;
    END IF;

    IF v_pay.status != 'posted' THEN
        RAISE EXCEPTION 'Payment % is not posted (current: %)', p_payment_id, v_pay.status;
    END IF;

    v_je_id := v_pay.journal_entry_id;

    -- Create reversing journal entry
    INSERT INTO journal_entries (tenant_id, entry_date, memo, status, reference_type, reference_id, created_by)
    VALUES (
        v_pay.tenant_id, CURRENT_DATE,
        'VOID: ' || v_pay.payment_number,
        'draft', 'payment_void', p_payment_id, v_pay.created_by
    )
    RETURNING id INTO v_rev_je_id;

    -- Reverse each line (swap debit/credit)
    FOR v_line IN SELECT * FROM journal_lines WHERE journal_entry_id = v_je_id
    LOOP
        INSERT INTO journal_lines (tenant_id, journal_entry_id, account_id, debit, credit, description)
        VALUES (v_line.tenant_id, v_rev_je_id, v_line.account_id,
                v_line.credit, v_line.debit,
                'VOID: ' || COALESCE(v_line.description, ''));
    END LOOP;

    -- Post reversing JE
    UPDATE journal_entries SET status = 'posted', posted_date = NOW() WHERE id = v_rev_je_id;

    -- Reverse invoice amount_paid for customer receipt allocations
    IF v_pay.payment_type = 'customer_receipt' THEN
        FOR v_alloc IN SELECT * FROM payment_allocations WHERE payment_id = p_payment_id AND invoice_id IS NOT NULL
        LOOP
            UPDATE invoices
            SET amount_paid = GREATEST(amount_paid - v_alloc.amount, 0),
                status = CASE
                    WHEN status = 'paid' THEN 'issued'
                    ELSE status
                END,
                updated_at = NOW()
            WHERE id = v_alloc.invoice_id;
        END LOOP;
    END IF;

    -- Update payment status
    UPDATE payments
    SET status = 'void',
        voided_at = NOW(),
        updated_at = NOW()
    WHERE id = p_payment_id;

    RETURN v_rev_je_id;
END;
$$;

COMMENT ON FUNCTION void_payment IS 'Voids a posted payment: creates reversing JE, recalculates invoice status';

-- ============================================================================
-- 5. TRIGGERS: updated_at
-- ============================================================================

CREATE OR REPLACE FUNCTION update_payments_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_payments_updated_at ON payments;
CREATE TRIGGER trg_payments_updated_at
    BEFORE UPDATE ON payments
    FOR EACH ROW EXECUTE FUNCTION update_payments_updated_at();

COMMIT;

-- === END payment_tracking ===

