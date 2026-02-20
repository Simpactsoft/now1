-- ============================================================================
-- Fix: Add Admin Bypass to Quotes & Quote Items RLS Policies
-- ============================================================================
-- Date: 2026-02-19
-- Problem: quotes/quote_items RLS only uses get_current_tenant_id() which
--          returns NULL for admin users, blocking all inserts.
-- Fix: Replace policies with tenant_or_admin pattern matching CPQ tables.
-- ============================================================================

-- ============================================================================
-- QUOTES TABLE
-- ============================================================================

DROP POLICY IF EXISTS quotes_select ON quotes;
DROP POLICY IF EXISTS quotes_insert ON quotes;
DROP POLICY IF EXISTS quotes_update ON quotes;
DROP POLICY IF EXISTS quotes_delete ON quotes;

CREATE POLICY quotes_select ON quotes
    FOR SELECT TO authenticated
    USING (
        tenant_id = (SELECT get_tenant_id_from_jwt())
        OR (SELECT is_admin())
    );

CREATE POLICY quotes_insert ON quotes
    FOR INSERT TO authenticated
    WITH CHECK (
        tenant_id = (SELECT get_tenant_id_from_jwt())
        OR (SELECT is_admin())
    );

CREATE POLICY quotes_update ON quotes
    FOR UPDATE TO authenticated
    USING (
        tenant_id = (SELECT get_tenant_id_from_jwt())
        OR (SELECT is_admin())
    )
    WITH CHECK (
        tenant_id = (SELECT get_tenant_id_from_jwt())
        OR (SELECT is_admin())
    );

CREATE POLICY quotes_delete ON quotes
    FOR DELETE TO authenticated
    USING (
        tenant_id = (SELECT get_tenant_id_from_jwt())
        OR (SELECT is_admin())
    );

-- ============================================================================
-- QUOTE ITEMS TABLE
-- ============================================================================

DROP POLICY IF EXISTS quote_items_select ON quote_items;
DROP POLICY IF EXISTS quote_items_insert ON quote_items;
DROP POLICY IF EXISTS quote_items_update ON quote_items;
DROP POLICY IF EXISTS quote_items_delete ON quote_items;

CREATE POLICY quote_items_select ON quote_items
    FOR SELECT TO authenticated
    USING (
        tenant_id = (SELECT get_tenant_id_from_jwt())
        OR (SELECT is_admin())
    );

CREATE POLICY quote_items_insert ON quote_items
    FOR INSERT TO authenticated
    WITH CHECK (
        tenant_id = (SELECT get_tenant_id_from_jwt())
        OR (SELECT is_admin())
    );

CREATE POLICY quote_items_update ON quote_items
    FOR UPDATE TO authenticated
    USING (
        tenant_id = (SELECT get_tenant_id_from_jwt())
        OR (SELECT is_admin())
    )
    WITH CHECK (
        tenant_id = (SELECT get_tenant_id_from_jwt())
        OR (SELECT is_admin())
    );

CREATE POLICY quote_items_delete ON quote_items
    FOR DELETE TO authenticated
    USING (
        tenant_id = (SELECT get_tenant_id_from_jwt())
        OR (SELECT is_admin())
    );

-- Done
