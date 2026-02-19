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
