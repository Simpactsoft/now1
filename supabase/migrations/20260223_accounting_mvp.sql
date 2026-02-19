-- ============================================================================
-- Accounting MVP — Double-Entry Journal
-- Migration: 20260223_accounting_mvp
-- Date: 2026-02-19
-- Description: Chart of accounts, journal entries, and journal lines with
--              balanced debit/credit enforcement. Foundation for financial
--              reporting (trial balance, P&L, balance sheet).
-- Dependencies: tenants
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. CHART OF ACCOUNTS
-- ============================================================================
-- Hierarchical account structure. Each account belongs to one of 5 types.

CREATE TABLE IF NOT EXISTS chart_of_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    parent_id UUID REFERENCES chart_of_accounts(id),
    account_number TEXT NOT NULL,       -- "1000", "1100", "2000", "4000"
    name TEXT NOT NULL,                 -- "Cash", "Accounts Receivable", "Revenue"
    account_type TEXT NOT NULL
        CHECK (account_type IN ('asset', 'liability', 'equity', 'revenue', 'expense')),
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    is_system BOOLEAN NOT NULL DEFAULT false,  -- System accounts can't be deleted
    currency CHAR(3) DEFAULT 'ILS',
    normal_balance TEXT NOT NULL DEFAULT 'debit'
        CHECK (normal_balance IN ('debit', 'credit')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE(tenant_id, account_number)
);

COMMENT ON TABLE chart_of_accounts IS 'Hierarchical chart of accounts with 5 account types';
COMMENT ON COLUMN chart_of_accounts.normal_balance IS 'Whether increases are debits or credits';

-- ============================================================================
-- 2. JOURNAL ENTRIES
-- ============================================================================
-- Header for a group of debit/credit lines.

CREATE TABLE IF NOT EXISTS journal_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    entry_number SERIAL,
    entry_date DATE NOT NULL DEFAULT CURRENT_DATE,
    posted_date TIMESTAMPTZ,
    status TEXT NOT NULL DEFAULT 'draft'
        CHECK (status IN ('draft', 'posted', 'voided')),
    memo TEXT,
    reference_type TEXT,       -- 'invoice', 'payment', 'manual', etc.
    reference_id UUID,         -- FK to the source document (order, invoice, etc.)
    created_by UUID,
    posted_by UUID,
    voided_by UUID,
    voided_at TIMESTAMPTZ,
    void_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE journal_entries IS 'Double-entry journal header — groups debit/credit lines';

-- ============================================================================
-- 3. JOURNAL LINES
-- ============================================================================
-- Individual debit or credit lines within a journal entry.

CREATE TABLE IF NOT EXISTS journal_lines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    journal_entry_id UUID NOT NULL REFERENCES journal_entries(id) ON DELETE CASCADE,
    account_id UUID NOT NULL REFERENCES chart_of_accounts(id) ON DELETE RESTRICT,
    line_number INT NOT NULL DEFAULT 0,
    description TEXT,
    debit NUMERIC(15, 2) NOT NULL DEFAULT 0,
    credit NUMERIC(15, 2) NOT NULL DEFAULT 0,
    currency CHAR(3) DEFAULT 'ILS',
    exchange_rate NUMERIC(18, 8) DEFAULT 1.0,
    base_debit NUMERIC(15, 2) NOT NULL DEFAULT 0,   -- Amount in base currency
    base_credit NUMERIC(15, 2) NOT NULL DEFAULT 0,  -- Amount in base currency
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CHECK (debit >= 0),
    CHECK (credit >= 0),
    CHECK (debit = 0 OR credit = 0)  -- A line is either debit OR credit, not both
);

COMMENT ON TABLE journal_lines IS 'Individual debit/credit lines within a journal entry';

-- ============================================================================
-- 4. INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_coa_tenant_type
    ON chart_of_accounts(tenant_id, account_type);

CREATE INDEX IF NOT EXISTS idx_coa_tenant_number
    ON chart_of_accounts(tenant_id, account_number);

CREATE INDEX IF NOT EXISTS idx_coa_parent
    ON chart_of_accounts(tenant_id, parent_id);

CREATE INDEX IF NOT EXISTS idx_journal_entries_tenant_status
    ON journal_entries(tenant_id, status);

CREATE INDEX IF NOT EXISTS idx_journal_entries_tenant_date
    ON journal_entries(tenant_id, entry_date DESC);

CREATE INDEX IF NOT EXISTS idx_journal_entries_ref
    ON journal_entries(tenant_id, reference_type, reference_id);

CREATE INDEX IF NOT EXISTS idx_journal_lines_entry
    ON journal_lines(journal_entry_id, line_number);

CREATE INDEX IF NOT EXISTS idx_journal_lines_account
    ON journal_lines(tenant_id, account_id);

CREATE INDEX IF NOT EXISTS idx_journal_lines_tenant
    ON journal_lines(tenant_id, journal_entry_id);

-- ============================================================================
-- 5. ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE chart_of_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal_lines ENABLE ROW LEVEL SECURITY;

-- chart_of_accounts
DROP POLICY IF EXISTS coa_select ON chart_of_accounts;
DROP POLICY IF EXISTS coa_insert ON chart_of_accounts;
DROP POLICY IF EXISTS coa_update ON chart_of_accounts;
DROP POLICY IF EXISTS coa_delete ON chart_of_accounts;

CREATE POLICY coa_select ON chart_of_accounts FOR SELECT TO authenticated
    USING (tenant_id = get_current_tenant_id() AND get_current_tenant_id() IS NOT NULL);
CREATE POLICY coa_insert ON chart_of_accounts FOR INSERT TO authenticated
    WITH CHECK (tenant_id = get_current_tenant_id() AND get_current_tenant_id() IS NOT NULL);
CREATE POLICY coa_update ON chart_of_accounts FOR UPDATE TO authenticated
    USING (tenant_id = get_current_tenant_id() AND get_current_tenant_id() IS NOT NULL)
    WITH CHECK (tenant_id = get_current_tenant_id() AND get_current_tenant_id() IS NOT NULL);
CREATE POLICY coa_delete ON chart_of_accounts FOR DELETE TO authenticated
    USING (tenant_id = get_current_tenant_id() AND get_current_tenant_id() IS NOT NULL
           AND is_system = false);

-- journal_entries
DROP POLICY IF EXISTS je_select ON journal_entries;
DROP POLICY IF EXISTS je_insert ON journal_entries;
DROP POLICY IF EXISTS je_update ON journal_entries;

CREATE POLICY je_select ON journal_entries FOR SELECT TO authenticated
    USING (tenant_id = get_current_tenant_id() AND get_current_tenant_id() IS NOT NULL);
CREATE POLICY je_insert ON journal_entries FOR INSERT TO authenticated
    WITH CHECK (tenant_id = get_current_tenant_id() AND get_current_tenant_id() IS NOT NULL);
CREATE POLICY je_update ON journal_entries FOR UPDATE TO authenticated
    USING (tenant_id = get_current_tenant_id() AND get_current_tenant_id() IS NOT NULL)
    WITH CHECK (tenant_id = get_current_tenant_id() AND get_current_tenant_id() IS NOT NULL);

-- journal_lines
DROP POLICY IF EXISTS jl_select ON journal_lines;
DROP POLICY IF EXISTS jl_insert ON journal_lines;
DROP POLICY IF EXISTS jl_update ON journal_lines;
DROP POLICY IF EXISTS jl_delete ON journal_lines;

CREATE POLICY jl_select ON journal_lines FOR SELECT TO authenticated
    USING (tenant_id = get_current_tenant_id() AND get_current_tenant_id() IS NOT NULL);
CREATE POLICY jl_insert ON journal_lines FOR INSERT TO authenticated
    WITH CHECK (tenant_id = get_current_tenant_id() AND get_current_tenant_id() IS NOT NULL);
CREATE POLICY jl_update ON journal_lines FOR UPDATE TO authenticated
    USING (tenant_id = get_current_tenant_id() AND get_current_tenant_id() IS NOT NULL)
    WITH CHECK (tenant_id = get_current_tenant_id() AND get_current_tenant_id() IS NOT NULL);
CREATE POLICY jl_delete ON journal_lines FOR DELETE TO authenticated
    USING (tenant_id = get_current_tenant_id() AND get_current_tenant_id() IS NOT NULL);

-- ============================================================================
-- 6. post_journal_entry() RPC
-- ============================================================================
-- Validates that debits = credits, then posts the entry.

CREATE OR REPLACE FUNCTION post_journal_entry(
    p_entry_id UUID,
    p_posted_by UUID DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_total_debits NUMERIC;
    v_total_credits NUMERIC;
    v_status TEXT;
    v_line_count INT;
BEGIN
    -- Check entry exists and is draft
    SELECT status INTO v_status
    FROM journal_entries
    WHERE id = p_entry_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Journal entry % not found', p_entry_id;
    END IF;

    IF v_status != 'draft' THEN
        RAISE EXCEPTION 'Journal entry % is not in draft status (current: %)', p_entry_id, v_status;
    END IF;

    -- Validate at least 2 lines
    SELECT COUNT(*) INTO v_line_count
    FROM journal_lines
    WHERE journal_entry_id = p_entry_id;

    IF v_line_count < 2 THEN
        RAISE EXCEPTION 'Journal entry must have at least 2 lines (has %)', v_line_count;
    END IF;

    -- Validate debits = credits
    SELECT
        COALESCE(SUM(debit), 0),
        COALESCE(SUM(credit), 0)
    INTO v_total_debits, v_total_credits
    FROM journal_lines
    WHERE journal_entry_id = p_entry_id;

    IF v_total_debits != v_total_credits THEN
        RAISE EXCEPTION 'Unbalanced entry: debits (%) != credits (%)',
            v_total_debits, v_total_credits;
    END IF;

    IF v_total_debits = 0 THEN
        RAISE EXCEPTION 'Journal entry has no amounts';
    END IF;

    -- Post
    UPDATE journal_entries
    SET status = 'posted',
        posted_date = NOW(),
        posted_by = p_posted_by,
        updated_at = NOW()
    WHERE id = p_entry_id;

    RETURN TRUE;
END;
$$;

COMMENT ON FUNCTION post_journal_entry IS 'Validates debit=credit balance and posts journal entry';

-- ============================================================================
-- 7. void_journal_entry() RPC
-- ============================================================================

CREATE OR REPLACE FUNCTION void_journal_entry(
    p_entry_id UUID,
    p_voided_by UUID DEFAULT NULL,
    p_reason TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    UPDATE journal_entries
    SET status = 'voided',
        voided_by = p_voided_by,
        voided_at = NOW(),
        void_reason = p_reason,
        updated_at = NOW()
    WHERE id = p_entry_id
      AND status = 'posted';

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Journal entry % not found or not in posted status', p_entry_id;
    END IF;

    RETURN TRUE;
END;
$$;

-- ============================================================================
-- 8. get_account_balance() RPC
-- ============================================================================

CREATE OR REPLACE FUNCTION get_account_balance(
    p_account_id UUID,
    p_from_date DATE DEFAULT NULL,
    p_to_date DATE DEFAULT NULL
)
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_debits NUMERIC;
    v_credits NUMERIC;
    v_normal TEXT;
BEGIN
    -- Get normal balance direction
    SELECT normal_balance INTO v_normal
    FROM chart_of_accounts
    WHERE id = p_account_id;

    -- Sum posted lines
    SELECT
        COALESCE(SUM(jl.debit), 0),
        COALESCE(SUM(jl.credit), 0)
    INTO v_debits, v_credits
    FROM journal_lines jl
        JOIN journal_entries je ON je.id = jl.journal_entry_id
    WHERE jl.account_id = p_account_id
      AND je.status = 'posted'
      AND (p_from_date IS NULL OR je.entry_date >= p_from_date)
      AND (p_to_date IS NULL OR je.entry_date <= p_to_date);

    -- Return balance based on normal direction
    IF v_normal = 'debit' THEN
        RETURN v_debits - v_credits;
    ELSE
        RETURN v_credits - v_debits;
    END IF;
END;
$$;

-- ============================================================================
-- 9. get_trial_balance() RPC
-- ============================================================================

CREATE OR REPLACE FUNCTION get_trial_balance(
    p_tenant_id UUID,
    p_as_of_date DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE (
    account_id UUID,
    account_number TEXT,
    account_name TEXT,
    account_type TEXT,
    debit_balance NUMERIC,
    credit_balance NUMERIC
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
            WHEN coa.normal_balance = 'debit'
            THEN GREATEST(COALESCE(SUM(jl.debit), 0) - COALESCE(SUM(jl.credit), 0), 0)
            ELSE 0::NUMERIC
        END AS debit_bal,
        CASE
            WHEN coa.normal_balance = 'credit'
            THEN GREATEST(COALESCE(SUM(jl.credit), 0) - COALESCE(SUM(jl.debit), 0), 0)
            ELSE 0::NUMERIC
        END AS credit_bal
    FROM chart_of_accounts coa
        LEFT JOIN journal_lines jl ON jl.account_id = coa.id
        LEFT JOIN journal_entries je ON je.id = jl.journal_entry_id
            AND je.status = 'posted'
            AND je.entry_date <= p_as_of_date
    WHERE coa.tenant_id = p_tenant_id
      AND coa.is_active = true
    GROUP BY coa.id, coa.account_number, coa.name, coa.account_type, coa.normal_balance
    HAVING COALESCE(SUM(jl.debit), 0) != 0 OR COALESCE(SUM(jl.credit), 0) != 0
    ORDER BY coa.account_number;
END;
$$;

COMMENT ON FUNCTION get_trial_balance IS 'Returns trial balance with debit/credit columns for all accounts with activity';

-- ============================================================================
-- 10. SEED: Israel Standard Chart of Accounts
-- ============================================================================
-- Seeds a standard IL chart when a tenant has 'IL' in compliance_plugins.
-- This is a helper function, called manually or during onboarding.

CREATE OR REPLACE FUNCTION seed_il_chart_of_accounts(
    p_tenant_id UUID
)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_count INT := 0;
BEGIN
    -- Assets (1xxx)
    INSERT INTO chart_of_accounts (tenant_id, account_number, name, account_type, normal_balance, is_system, currency)
    VALUES
        (p_tenant_id, '1000', 'נכסים', 'asset', 'debit', true, 'ILS'),
        (p_tenant_id, '1100', 'קופה ומזומנים', 'asset', 'debit', true, 'ILS'),
        (p_tenant_id, '1200', 'בנק - חשבון עו"ש', 'asset', 'debit', true, 'ILS'),
        (p_tenant_id, '1300', 'חייבים ולקוחות', 'asset', 'debit', true, 'ILS'),
        (p_tenant_id, '1400', 'מלאי', 'asset', 'debit', true, 'ILS'),
        (p_tenant_id, '1500', 'ציוד ורכוש קבוע', 'asset', 'debit', true, 'ILS')
    ON CONFLICT (tenant_id, account_number) DO NOTHING;
    GET DIAGNOSTICS v_count = ROW_COUNT;

    -- Liabilities (2xxx)
    INSERT INTO chart_of_accounts (tenant_id, account_number, name, account_type, normal_balance, is_system, currency)
    VALUES
        (p_tenant_id, '2000', 'התחייבויות', 'liability', 'credit', true, 'ILS'),
        (p_tenant_id, '2100', 'ספקים וזכאים', 'liability', 'credit', true, 'ILS'),
        (p_tenant_id, '2200', 'מע"מ לשלם', 'liability', 'credit', true, 'ILS'),
        (p_tenant_id, '2300', 'מס הכנסה לשלם', 'liability', 'credit', true, 'ILS'),
        (p_tenant_id, '2400', 'הלוואות', 'liability', 'credit', true, 'ILS')
    ON CONFLICT (tenant_id, account_number) DO NOTHING;

    -- Equity (3xxx)
    INSERT INTO chart_of_accounts (tenant_id, account_number, name, account_type, normal_balance, is_system, currency)
    VALUES
        (p_tenant_id, '3000', 'הון עצמי', 'equity', 'credit', true, 'ILS'),
        (p_tenant_id, '3100', 'הון מניות', 'equity', 'credit', true, 'ILS'),
        (p_tenant_id, '3200', 'עודפים', 'equity', 'credit', true, 'ILS')
    ON CONFLICT (tenant_id, account_number) DO NOTHING;

    -- Revenue (4xxx)
    INSERT INTO chart_of_accounts (tenant_id, account_number, name, account_type, normal_balance, is_system, currency)
    VALUES
        (p_tenant_id, '4000', 'הכנסות', 'revenue', 'credit', true, 'ILS'),
        (p_tenant_id, '4100', 'הכנסות ממכירות', 'revenue', 'credit', true, 'ILS'),
        (p_tenant_id, '4200', 'הכנסות משירותים', 'revenue', 'credit', true, 'ILS'),
        (p_tenant_id, '4300', 'הכנסות אחרות', 'revenue', 'credit', true, 'ILS')
    ON CONFLICT (tenant_id, account_number) DO NOTHING;

    -- Expenses (5xxx-6xxx)
    INSERT INTO chart_of_accounts (tenant_id, account_number, name, account_type, normal_balance, is_system, currency)
    VALUES
        (p_tenant_id, '5000', 'עלות המכר', 'expense', 'debit', true, 'ILS'),
        (p_tenant_id, '5100', 'רכש חומרים', 'expense', 'debit', true, 'ILS'),
        (p_tenant_id, '5200', 'עלויות ייצור', 'expense', 'debit', true, 'ILS'),
        (p_tenant_id, '6000', 'הוצאות תפעול', 'expense', 'debit', true, 'ILS'),
        (p_tenant_id, '6100', 'שכר עבודה', 'expense', 'debit', true, 'ILS'),
        (p_tenant_id, '6200', 'שכירות', 'expense', 'debit', true, 'ILS'),
        (p_tenant_id, '6300', 'ביטוח', 'expense', 'debit', true, 'ILS'),
        (p_tenant_id, '6400', 'פחת', 'expense', 'debit', true, 'ILS'),
        (p_tenant_id, '6500', 'הוצאות משרדיות', 'expense', 'debit', true, 'ILS'),
        (p_tenant_id, '6600', 'הוצאות שיווק ופרסום', 'expense', 'debit', true, 'ILS'),
        (p_tenant_id, '6700', 'הוצאות מימון', 'expense', 'debit', true, 'ILS')
    ON CONFLICT (tenant_id, account_number) DO NOTHING;

    SELECT COUNT(*) INTO v_count FROM chart_of_accounts WHERE tenant_id = p_tenant_id;
    RETURN v_count;
END;
$$;

COMMENT ON FUNCTION seed_il_chart_of_accounts IS 'Seeds standard Israeli chart of accounts for a tenant';

-- ============================================================================
-- 11. updated_at triggers
-- ============================================================================

CREATE OR REPLACE FUNCTION update_accounting_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_coa_updated_at ON chart_of_accounts;
CREATE TRIGGER trg_coa_updated_at
    BEFORE UPDATE ON chart_of_accounts
    FOR EACH ROW EXECUTE FUNCTION update_accounting_updated_at();

DROP TRIGGER IF EXISTS trg_je_updated_at ON journal_entries;
CREATE TRIGGER trg_je_updated_at
    BEFORE UPDATE ON journal_entries
    FOR EACH ROW EXECUTE FUNCTION update_accounting_updated_at();

COMMIT;
