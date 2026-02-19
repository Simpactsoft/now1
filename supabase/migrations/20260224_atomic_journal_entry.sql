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
