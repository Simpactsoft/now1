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
