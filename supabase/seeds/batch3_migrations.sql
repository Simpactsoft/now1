-- ============================================================================
-- BATCH 3: Account type resolution + atomic JE + tenant guards
-- Run this THIRD in Supabase SQL Editor (after batch 2)
-- ============================================================================

-- ============================================================================
-- Account Type Resolution Fix
-- Migration: 20260220_account_type_resolution
-- Date: 2026-02-20
-- Description: Adds account_sub_type column to chart_of_accounts for
--              role-based account lookups (cash, accounts_receivable, etc.).
--              Fixes all RPCs to use account_sub_type instead of hardcoded
--              account_number values.
-- Dependencies: 20260223_accounting_mvp, 20260220_invoice_account_fix,
--               20260220_purchase_orders, 20260220_payment_tracking
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. ADD account_sub_type COLUMN
-- ============================================================================
-- The existing account_type column uses broad categories (asset, liability,
-- equity, revenue, expense). We need a more specific column for role-based
-- lookups that are independent of the account numbering scheme.

ALTER TABLE chart_of_accounts
    ADD COLUMN IF NOT EXISTS account_sub_type TEXT;

-- Index for fast lookups by sub_type
CREATE INDEX IF NOT EXISTS idx_coa_sub_type
    ON chart_of_accounts(tenant_id, account_sub_type)
    WHERE account_sub_type IS NOT NULL;

-- ============================================================================
-- 2. POPULATE account_sub_type for known seeded accounts
-- ============================================================================
-- These UPDATEs match by account_number for initial population only.
-- After this, all RPC lookups will use account_sub_type exclusively.

UPDATE chart_of_accounts SET account_sub_type = 'cash'
    WHERE account_number = '1100' AND account_sub_type IS NULL;

UPDATE chart_of_accounts SET account_sub_type = 'accounts_receivable'
    WHERE account_number = '1300' AND account_sub_type IS NULL;

UPDATE chart_of_accounts SET account_sub_type = 'inventory'
    WHERE account_number = '1400' AND account_sub_type IS NULL;

UPDATE chart_of_accounts SET account_sub_type = 'accounts_payable'
    WHERE account_number = '2100' AND account_sub_type IS NULL;

UPDATE chart_of_accounts SET account_sub_type = 'tax_liability'
    WHERE account_number = '2200' AND account_sub_type IS NULL;

UPDATE chart_of_accounts SET account_sub_type = 'revenue'
    WHERE account_number = '4100' AND account_sub_type IS NULL;

UPDATE chart_of_accounts SET account_sub_type = 'cogs'
    WHERE account_number = '5100' AND account_sub_type IS NULL;

-- ============================================================================
-- 3. UPDATE seed_il_chart_of_accounts to include account_sub_type
-- ============================================================================

CREATE OR REPLACE FUNCTION seed_il_chart_of_accounts(p_tenant_id UUID)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_count INT := 0;
BEGIN
    -- Assets (1xxx)
    INSERT INTO chart_of_accounts (tenant_id, account_number, name, account_type, account_sub_type, normal_balance, is_system, currency)
    VALUES
        (p_tenant_id, '1000', 'נכסים', 'asset', NULL, 'debit', true, 'ILS'),
        (p_tenant_id, '1100', 'קופה ומזומנים', 'asset', 'cash', 'debit', true, 'ILS'),
        (p_tenant_id, '1200', 'בנק - חשבון עו"ש', 'asset', NULL, 'debit', true, 'ILS'),
        (p_tenant_id, '1300', 'חייבים ולקוחות', 'asset', 'accounts_receivable', 'debit', true, 'ILS'),
        (p_tenant_id, '1400', 'מלאי', 'asset', 'inventory', 'debit', true, 'ILS'),
        (p_tenant_id, '1500', 'ציוד ורכוש קבוע', 'asset', NULL, 'debit', true, 'ILS')
    ON CONFLICT (tenant_id, account_number) DO UPDATE
        SET account_sub_type = EXCLUDED.account_sub_type
        WHERE chart_of_accounts.account_sub_type IS NULL;
    GET DIAGNOSTICS v_count = ROW_COUNT;

    -- Liabilities (2xxx)
    INSERT INTO chart_of_accounts (tenant_id, account_number, name, account_type, account_sub_type, normal_balance, is_system, currency)
    VALUES
        (p_tenant_id, '2000', 'התחייבויות', 'liability', NULL, 'credit', true, 'ILS'),
        (p_tenant_id, '2100', 'ספקים וזכאים', 'liability', 'accounts_payable', 'credit', true, 'ILS'),
        (p_tenant_id, '2200', 'מע"מ לשלם', 'liability', 'tax_liability', 'credit', true, 'ILS'),
        (p_tenant_id, '2300', 'מס הכנסה לשלם', 'liability', NULL, 'credit', true, 'ILS'),
        (p_tenant_id, '2400', 'הלוואות', 'liability', NULL, 'credit', true, 'ILS')
    ON CONFLICT (tenant_id, account_number) DO UPDATE
        SET account_sub_type = EXCLUDED.account_sub_type
        WHERE chart_of_accounts.account_sub_type IS NULL;

    -- Equity (3xxx)
    INSERT INTO chart_of_accounts (tenant_id, account_number, name, account_type, account_sub_type, normal_balance, is_system, currency)
    VALUES
        (p_tenant_id, '3000', 'הון עצמי', 'equity', NULL, 'credit', true, 'ILS'),
        (p_tenant_id, '3100', 'הון מניות', 'equity', NULL, 'credit', true, 'ILS'),
        (p_tenant_id, '3200', 'עודפים', 'equity', NULL, 'credit', true, 'ILS')
    ON CONFLICT (tenant_id, account_number) DO NOTHING;

    -- Revenue (4xxx)
    INSERT INTO chart_of_accounts (tenant_id, account_number, name, account_type, account_sub_type, normal_balance, is_system, currency)
    VALUES
        (p_tenant_id, '4000', 'הכנסות', 'revenue', NULL, 'credit', true, 'ILS'),
        (p_tenant_id, '4100', 'הכנסות ממכירות', 'revenue', 'revenue', 'credit', true, 'ILS'),
        (p_tenant_id, '4200', 'הכנסות משירותים', 'revenue', NULL, 'credit', true, 'ILS'),
        (p_tenant_id, '4300', 'הכנסות אחרות', 'revenue', NULL, 'credit', true, 'ILS')
    ON CONFLICT (tenant_id, account_number) DO UPDATE
        SET account_sub_type = EXCLUDED.account_sub_type
        WHERE chart_of_accounts.account_sub_type IS NULL;

    -- Expenses (5xxx-6xxx)
    INSERT INTO chart_of_accounts (tenant_id, account_number, name, account_type, account_sub_type, normal_balance, is_system, currency)
    VALUES
        (p_tenant_id, '5000', 'עלות המכר', 'expense', NULL, 'debit', true, 'ILS'),
        (p_tenant_id, '5100', 'רכש חומרים', 'expense', 'cogs', 'debit', true, 'ILS'),
        (p_tenant_id, '5200', 'עלויות ייצור', 'expense', NULL, 'debit', true, 'ILS'),
        (p_tenant_id, '6000', 'הוצאות תפעול', 'expense', NULL, 'debit', true, 'ILS'),
        (p_tenant_id, '6100', 'שכר עבודה', 'expense', NULL, 'debit', true, 'ILS'),
        (p_tenant_id, '6200', 'שכירות', 'expense', NULL, 'debit', true, 'ILS'),
        (p_tenant_id, '6300', 'ביטוח', 'expense', NULL, 'debit', true, 'ILS'),
        (p_tenant_id, '6400', 'פחת', 'expense', NULL, 'debit', true, 'ILS'),
        (p_tenant_id, '6500', 'הוצאות משרדיות', 'expense', NULL, 'debit', true, 'ILS'),
        (p_tenant_id, '6600', 'הוצאות שיווק ופרסום', 'expense', NULL, 'debit', true, 'ILS'),
        (p_tenant_id, '6700', 'הוצאות מימון', 'expense', NULL, 'debit', true, 'ILS')
    ON CONFLICT (tenant_id, account_number) DO UPDATE
        SET account_sub_type = EXCLUDED.account_sub_type
        WHERE chart_of_accounts.account_sub_type IS NULL;

    SELECT COUNT(*) INTO v_count FROM chart_of_accounts WHERE tenant_id = p_tenant_id;
    RETURN v_count;
END;
$$;

COMMENT ON FUNCTION seed_il_chart_of_accounts IS 'Seeds standard Israeli chart of accounts for a tenant (includes account_sub_type for role-based lookups)';

-- ============================================================================
-- 4. FIX issue_invoice — use account_sub_type
-- ============================================================================

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

    -- Lookup accounts by account_sub_type (not hardcoded numbers)
    SELECT id INTO v_receivable_account FROM chart_of_accounts
        WHERE tenant_id = v_invoice.tenant_id AND account_sub_type = 'accounts_receivable' LIMIT 1;
    SELECT id INTO v_revenue_account FROM chart_of_accounts
        WHERE tenant_id = v_invoice.tenant_id AND account_sub_type = 'revenue' LIMIT 1;
    SELECT id INTO v_vat_account FROM chart_of_accounts
        WHERE tenant_id = v_invoice.tenant_id AND account_sub_type = 'tax_liability' LIMIT 1;

    -- Hard failure if any required account is missing
    IF v_receivable_account IS NULL THEN
        RAISE EXCEPTION 'Required account type accounts_receivable not found for tenant %', v_invoice.tenant_id;
    END IF;

    IF v_revenue_account IS NULL THEN
        RAISE EXCEPTION 'Required account type revenue not found for tenant %', v_invoice.tenant_id;
    END IF;

    IF v_vat_account IS NULL THEN
        RAISE EXCEPTION 'Required account type tax_liability not found for tenant %', v_invoice.tenant_id;
    END IF;

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

COMMENT ON FUNCTION issue_invoice IS 'Issues a draft invoice: looks up accounts by account_sub_type, creates accounting entries (DR Receivable, CR Revenue + CR VAT) and marks as issued';

-- ============================================================================
-- 5. FIX receive_purchase_order — use account_sub_type
-- ============================================================================

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
        SELECT id INTO v_warehouse_id FROM warehouses
        WHERE tenant_id = v_po.tenant_id AND is_default = true LIMIT 1;
        IF v_warehouse_id IS NULL THEN
            RAISE EXCEPTION 'No warehouse specified on PO and no default warehouse found for tenant %', v_po.tenant_id;
        END IF;
    END IF;

    -- Lookup GL accounts by account_sub_type (not hardcoded numbers)
    SELECT id INTO v_inventory_account FROM chart_of_accounts
        WHERE tenant_id = v_po.tenant_id AND account_sub_type = 'inventory' LIMIT 1;
    SELECT id INTO v_ap_account FROM chart_of_accounts
        WHERE tenant_id = v_po.tenant_id AND account_sub_type = 'accounts_payable' LIMIT 1;

    IF v_inventory_account IS NULL THEN
        RAISE EXCEPTION 'Required account type inventory not found for tenant %', v_po.tenant_id;
    END IF;
    IF v_ap_account IS NULL THEN
        RAISE EXCEPTION 'Required account type accounts_payable not found for tenant %', v_po.tenant_id;
    END IF;

    -- Process each received item
    FOR v_recv IN SELECT * FROM jsonb_to_recordset(p_items) AS x(item_id UUID, received_qty NUMERIC)
    LOOP
        SELECT * INTO v_item FROM purchase_order_items
        WHERE id = v_recv.item_id AND po_id = p_po_id;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'PO item % not found on PO %', v_recv.item_id, p_po_id;
        END IF;

        IF v_recv.received_qty <= 0 THEN
            CONTINUE;
        END IF;

        IF (v_item.received_quantity + v_recv.received_qty) > v_item.quantity THEN
            RAISE EXCEPTION 'Over-receiving item %: ordered %, already received %, trying to receive %',
                v_recv.item_id, v_item.quantity, v_item.received_quantity, v_recv.received_qty;
        END IF;

        UPDATE purchase_order_items
        SET received_quantity = received_quantity + v_recv.received_qty,
            updated_at = NOW()
        WHERE id = v_recv.item_id;

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

    INSERT INTO journal_lines (tenant_id, journal_entry_id, account_id, debit, credit, description)
    VALUES (v_po.tenant_id, v_je_id, v_inventory_account, v_total_cost, 0,
            'Inventory from PO ' || v_po.po_number);

    INSERT INTO journal_lines (tenant_id, journal_entry_id, account_id, debit, credit, description)
    VALUES (v_po.tenant_id, v_je_id, v_ap_account, 0, v_total_cost,
            'AP for PO ' || v_po.po_number);

    UPDATE journal_entries SET status = 'posted', posted_date = NOW() WHERE id = v_je_id;

    UPDATE purchase_orders
    SET status = CASE WHEN v_all_received THEN 'received' ELSE 'partial' END,
        updated_at = NOW()
    WHERE id = p_po_id;

    RETURN v_je_id;
END;
$$;

COMMENT ON FUNCTION receive_purchase_order IS 'Receives goods on a PO: uses account_sub_type for GL lookups, updates inventory, creates journal entry (DR Inventory, CR AP)';

-- ============================================================================
-- 6. FIX post_payment — use account_sub_type
-- ============================================================================

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

    -- Lookup GL accounts by account_sub_type (not hardcoded numbers)
    SELECT id INTO v_cash_account FROM chart_of_accounts
        WHERE tenant_id = v_pay.tenant_id AND account_sub_type = 'cash' LIMIT 1;
    SELECT id INTO v_ar_account FROM chart_of_accounts
        WHERE tenant_id = v_pay.tenant_id AND account_sub_type = 'accounts_receivable' LIMIT 1;
    SELECT id INTO v_ap_account FROM chart_of_accounts
        WHERE tenant_id = v_pay.tenant_id AND account_sub_type = 'accounts_payable' LIMIT 1;

    IF v_cash_account IS NULL THEN
        RAISE EXCEPTION 'Required account type cash not found for tenant %', v_pay.tenant_id;
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
            RAISE EXCEPTION 'Required account type accounts_receivable not found for tenant %', v_pay.tenant_id;
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
            RAISE EXCEPTION 'Required account type accounts_payable not found for tenant %', v_pay.tenant_id;
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

COMMENT ON FUNCTION post_payment IS 'Posts a payment: uses account_sub_type for GL lookups, creates journal entry, updates invoice paid status';

-- ============================================================================
-- 7. void_payment — NO FIX NEEDED
-- ============================================================================
-- void_payment does NOT perform any account_number lookups.
-- It reverses journal lines by swapping debit/credit from the original JE.
-- No changes required.

COMMIT;

-- === END account_type_resolution ===

-- ============================================================================
-- Migration: 20260224 — Atomic Journal Entry RPC
-- Description: Single-transaction RPC for creating journal entries + lines
-- ============================================================================

CREATE OR REPLACE FUNCTION create_journal_entry(
    p_tenant_id UUID,
    p_date DATE DEFAULT CURRENT_DATE,
    p_memo TEXT DEFAULT NULL,
    p_reference_type TEXT DEFAULT 'manual',
    p_reference_id UUID DEFAULT NULL,
    p_created_by UUID DEFAULT NULL,
    p_lines JSONB DEFAULT '[]'::JSONB
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_entry_id UUID;
    v_line JSONB;
    v_line_num INT := 0;
    v_total_debits NUMERIC := 0;
    v_total_credits NUMERIC := 0;
    v_line_count INT;
BEGIN
    -- ========================================================================
    -- 1. Tenant ownership check
    -- ========================================================================
    IF p_tenant_id != get_current_tenant_id() THEN
        RAISE EXCEPTION 'tenant_mismatch: access denied';
    END IF;

    -- ========================================================================
    -- 2. Validate lines
    -- ========================================================================
    v_line_count := jsonb_array_length(p_lines);

    IF v_line_count < 2 THEN
        RAISE EXCEPTION 'Journal entry must have at least 2 lines (got %)', v_line_count;
    END IF;

    -- Pre-validate totals before any inserts
    SELECT
        COALESCE(SUM((l->>'debit')::NUMERIC), 0),
        COALESCE(SUM((l->>'credit')::NUMERIC), 0)
    INTO v_total_debits, v_total_credits
    FROM jsonb_array_elements(p_lines) AS l;

    IF v_total_debits = 0 AND v_total_credits = 0 THEN
        RAISE EXCEPTION 'Journal entry has no amounts';
    END IF;

    IF v_total_debits != v_total_credits THEN
        RAISE EXCEPTION 'Unbalanced entry: debits (%) != credits (%)', v_total_debits, v_total_credits;
    END IF;

    -- Validate each line has valid constraints
    FOR v_line IN SELECT * FROM jsonb_array_elements(p_lines) LOOP
        IF (v_line->>'debit')::NUMERIC < 0 OR (v_line->>'credit')::NUMERIC < 0 THEN
            RAISE EXCEPTION 'Debit and credit amounts must be non-negative';
        END IF;

        IF (v_line->>'debit')::NUMERIC > 0 AND (v_line->>'credit')::NUMERIC > 0 THEN
            RAISE EXCEPTION 'A line cannot have both debit and credit amounts';
        END IF;

        -- Verify account exists and belongs to tenant
        IF NOT EXISTS (
            SELECT 1 FROM chart_of_accounts
            WHERE id = (v_line->>'account_id')::UUID
              AND tenant_id = p_tenant_id
              AND is_active = true
        ) THEN
            RAISE EXCEPTION 'Account % not found or inactive for this tenant', v_line->>'account_id';
        END IF;
    END LOOP;

    -- ========================================================================
    -- 3. Insert journal entry header
    -- ========================================================================
    INSERT INTO journal_entries (
        tenant_id, entry_date, memo, reference_type, reference_id, created_by
    ) VALUES (
        p_tenant_id, p_date, p_memo, p_reference_type, p_reference_id, p_created_by
    )
    RETURNING id INTO v_entry_id;

    -- ========================================================================
    -- 4. Insert journal lines
    -- ========================================================================
    FOR v_line IN SELECT * FROM jsonb_array_elements(p_lines) LOOP
        v_line_num := v_line_num + 1;

        INSERT INTO journal_lines (
            tenant_id, journal_entry_id, account_id, line_number,
            description, debit, credit, base_debit, base_credit
        ) VALUES (
            p_tenant_id,
            v_entry_id,
            (v_line->>'account_id')::UUID,
            v_line_num,
            v_line->>'description',
            COALESCE((v_line->>'debit')::NUMERIC, 0),
            COALESCE((v_line->>'credit')::NUMERIC, 0),
            COALESCE((v_line->>'debit')::NUMERIC, 0),
            COALESCE((v_line->>'credit')::NUMERIC, 0)
        );
    END LOOP;

    RETURN v_entry_id;
END;
$$;

COMMENT ON FUNCTION create_journal_entry IS 'Atomic creation of journal entry + lines in a single transaction. Validates balance, account ownership, and tenant access.';

-- === END atomic_journal_entry ===

-- ============================================================================
-- Migration: 20260225 — RPC Tenant Guards
-- Description: Add tenant ownership checks to SECURITY DEFINER RPCs
-- ============================================================================

-- ============================================================================
-- 1. validate_quote_margin() — add tenant check
-- ============================================================================

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

    -- *** TENANT GUARD ***
    IF v_tenant_id != get_current_tenant_id() THEN
        RAISE EXCEPTION 'tenant_mismatch: access denied';
    END IF;

    -- Compute margin
    IF v_grand_total > 0 AND v_total_cost IS NOT NULL THEN
        v_margin_pct := ROUND(((v_grand_total - v_total_cost) / v_grand_total) * 100, 2);
    ELSE
        v_margin_pct := 100.00;
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

-- ============================================================================
-- 2. approve_margin() — add tenant check
-- ============================================================================

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
    v_tenant_id UUID;
BEGIN
    -- Get tenant from quote
    SELECT tenant_id INTO v_tenant_id
    FROM quotes
    WHERE id = p_quote_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Quote % not found', p_quote_id;
    END IF;

    -- *** TENANT GUARD ***
    IF v_tenant_id != get_current_tenant_id() THEN
        RAISE EXCEPTION 'tenant_mismatch: access denied';
    END IF;

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
-- 3. reject_margin() — add tenant check
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
    v_tenant_id UUID;
BEGIN
    -- Get tenant from quote
    SELECT tenant_id INTO v_tenant_id
    FROM quotes
    WHERE id = p_quote_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Quote % not found', p_quote_id;
    END IF;

    -- *** TENANT GUARD ***
    IF v_tenant_id != get_current_tenant_id() THEN
        RAISE EXCEPTION 'tenant_mismatch: access denied';
    END IF;

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

-- === END rpc_tenant_guards ===

