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
