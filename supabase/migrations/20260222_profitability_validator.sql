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
