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
