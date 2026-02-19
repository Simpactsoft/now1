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
