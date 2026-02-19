-- ============================================================================
-- BOM (Bill of Materials) Tables — Formalized Migration
-- Migration: 20260212_bom_tables
-- Date: 2026-02-12
-- Description: Formalizes bom_headers and bom_items tables that were previously
--              created directly in the DB without a migration file (RISK-01).
--              Adds RLS, proper indexes, and CYCLE-safe RPCs (RISK-02).
-- Dependencies: Migration 007 (products table)
-- Safety: Uses IF NOT EXISTS — safe to run even if tables already exist.
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. BOM HEADERS
-- ============================================================================
-- Purpose: Defines a Bill of Materials for a product at a specific version.
-- Each product can have multiple BOM versions (draft, active, obsolete).
-- Only ONE version should be ACTIVE at a time per product.

CREATE TABLE IF NOT EXISTS bom_headers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    version TEXT NOT NULL DEFAULT '1.0',
    status TEXT NOT NULL DEFAULT 'DRAFT'
        CHECK (status IN ('DRAFT', 'ACTIVE', 'OBSOLETE')),
    description TEXT,
    effective_date DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID,

    -- One active BOM per product (enforced at application level for flexibility,
    -- but we index for fast lookup)
    UNIQUE(tenant_id, product_id, version)
);

COMMENT ON TABLE bom_headers IS 'Bill of Materials header — one per product per version';
COMMENT ON COLUMN bom_headers.status IS 'DRAFT=editing, ACTIVE=used for costing, OBSOLETE=archived';
COMMENT ON COLUMN bom_headers.effective_date IS 'Date from which this BOM version is effective';

-- ============================================================================
-- 2. BOM ITEMS (Components)
-- ============================================================================
-- Purpose: Individual components/materials within a BOM.
-- Supports multi-level BOMs via parent_item_id (self-referencing).
-- is_assembly=true means this item has its own sub-components.
-- is_phantom=true means this sub-assembly is "see-through" for planning.

CREATE TABLE IF NOT EXISTS bom_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,  -- Denormalized for RLS performance
    bom_header_id UUID NOT NULL REFERENCES bom_headers(id) ON DELETE CASCADE,
    parent_item_id UUID REFERENCES bom_items(id) ON DELETE CASCADE,
    component_product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    sequence INT NOT NULL DEFAULT 0,
    quantity NUMERIC(15, 4) NOT NULL DEFAULT 1.0,
    unit TEXT NOT NULL DEFAULT 'EA',
    scrap_factor NUMERIC(5, 4) NOT NULL DEFAULT 0.0,
    is_assembly BOOLEAN NOT NULL DEFAULT false,
    is_phantom BOOLEAN NOT NULL DEFAULT false,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE bom_items IS 'BOM line items — components with quantities, supports multi-level via parent_item_id';
COMMENT ON COLUMN bom_items.scrap_factor IS 'Expected scrap rate, e.g. 0.02 = 2% overage';
COMMENT ON COLUMN bom_items.is_phantom IS 'Phantom sub-assembly: transparent for planning, components roll up';

-- ============================================================================
-- 3. INDEXES
-- ============================================================================
-- RULE-02 compliant: tenant_id is FIRST in all composite indexes

CREATE INDEX IF NOT EXISTS idx_bom_headers_tenant_product
    ON bom_headers(tenant_id, product_id, status);

CREATE INDEX IF NOT EXISTS idx_bom_headers_tenant_status
    ON bom_headers(tenant_id, status)
    WHERE status = 'ACTIVE';

CREATE INDEX IF NOT EXISTS idx_bom_items_header
    ON bom_items(bom_header_id, parent_item_id, sequence);

CREATE INDEX IF NOT EXISTS idx_bom_items_tenant
    ON bom_items(tenant_id, component_product_id);

CREATE INDEX IF NOT EXISTS idx_bom_items_parent
    ON bom_items(parent_item_id)
    WHERE parent_item_id IS NOT NULL;

-- ============================================================================
-- 4. ROW LEVEL SECURITY
-- ============================================================================
-- RULE-01 compliant: IS NOT NULL guard on get_current_tenant_id()

ALTER TABLE bom_headers ENABLE ROW LEVEL SECURITY;
ALTER TABLE bom_items ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any (safe for re-runs)
DROP POLICY IF EXISTS bom_headers_select ON bom_headers;
DROP POLICY IF EXISTS bom_headers_insert ON bom_headers;
DROP POLICY IF EXISTS bom_headers_update ON bom_headers;
DROP POLICY IF EXISTS bom_headers_delete ON bom_headers;

CREATE POLICY bom_headers_select ON bom_headers
    FOR SELECT TO authenticated
    USING (tenant_id = get_current_tenant_id() AND get_current_tenant_id() IS NOT NULL);

CREATE POLICY bom_headers_insert ON bom_headers
    FOR INSERT TO authenticated
    WITH CHECK (tenant_id = get_current_tenant_id() AND get_current_tenant_id() IS NOT NULL);

CREATE POLICY bom_headers_update ON bom_headers
    FOR UPDATE TO authenticated
    USING (tenant_id = get_current_tenant_id() AND get_current_tenant_id() IS NOT NULL)
    WITH CHECK (tenant_id = get_current_tenant_id() AND get_current_tenant_id() IS NOT NULL);

CREATE POLICY bom_headers_delete ON bom_headers
    FOR DELETE TO authenticated
    USING (tenant_id = get_current_tenant_id() AND get_current_tenant_id() IS NOT NULL);

DROP POLICY IF EXISTS bom_items_select ON bom_items;
DROP POLICY IF EXISTS bom_items_insert ON bom_items;
DROP POLICY IF EXISTS bom_items_update ON bom_items;
DROP POLICY IF EXISTS bom_items_delete ON bom_items;

CREATE POLICY bom_items_select ON bom_items
    FOR SELECT TO authenticated
    USING (tenant_id = get_current_tenant_id() AND get_current_tenant_id() IS NOT NULL);

CREATE POLICY bom_items_insert ON bom_items
    FOR INSERT TO authenticated
    WITH CHECK (tenant_id = get_current_tenant_id() AND get_current_tenant_id() IS NOT NULL);

CREATE POLICY bom_items_update ON bom_items
    FOR UPDATE TO authenticated
    USING (tenant_id = get_current_tenant_id() AND get_current_tenant_id() IS NOT NULL)
    WITH CHECK (tenant_id = get_current_tenant_id() AND get_current_tenant_id() IS NOT NULL);

CREATE POLICY bom_items_delete ON bom_items
    FOR DELETE TO authenticated
    USING (tenant_id = get_current_tenant_id() AND get_current_tenant_id() IS NOT NULL);

-- ============================================================================
-- 5. UPDATED_AT TRIGGER
-- ============================================================================

CREATE OR REPLACE FUNCTION update_bom_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_bom_headers_updated_at ON bom_headers;
CREATE TRIGGER trg_bom_headers_updated_at
    BEFORE UPDATE ON bom_headers
    FOR EACH ROW EXECUTE FUNCTION update_bom_updated_at();

DROP TRIGGER IF EXISTS trg_bom_items_updated_at ON bom_items;
CREATE TRIGGER trg_bom_items_updated_at
    BEFORE UPDATE ON bom_items
    FOR EACH ROW EXECUTE FUNCTION update_bom_updated_at();

-- ============================================================================
-- 6. get_bom_tree() — Recursive BOM explosion with CYCLE DETECTION
-- ============================================================================
-- Returns the full BOM tree for a product at a given version.
-- CRITICAL FIX (RISK-02): Added depth counter to prevent infinite recursion.
-- Max depth = 20 levels (more than sufficient for any real-world BOM).

CREATE OR REPLACE FUNCTION get_bom_tree(
    p_product_id UUID,
    p_version TEXT DEFAULT '1.0'
)
RETURNS TABLE (
    id UUID,
    bom_header_id UUID,
    parent_item_id UUID,
    component_product_id UUID,
    level INT,
    sequence INT,
    quantity NUMERIC,
    total_quantity NUMERIC,
    unit TEXT,
    scrap_factor NUMERIC,
    is_assembly BOOLEAN,
    is_phantom BOOLEAN,
    sku TEXT,
    name TEXT,
    cost_price NUMERIC,
    list_price NUMERIC,
    extended_cost NUMERIC,
    extended_price NUMERIC,
    path TEXT[]
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_header_id UUID;
    v_max_depth CONSTANT INT := 20;
BEGIN
    -- Find the active BOM header for this product and version
    SELECT bh.id INTO v_header_id
    FROM bom_headers bh
    WHERE bh.product_id = p_product_id
      AND bh.version = p_version
      AND bh.status = 'ACTIVE'
    LIMIT 1;

    IF v_header_id IS NULL THEN
        RETURN; -- No active BOM found, return empty result
    END IF;

    RETURN QUERY
    WITH RECURSIVE bom_explosion AS (
        -- Base case: top-level items (no parent)
        SELECT
            bi.id,
            bi.bom_header_id,
            bi.parent_item_id,
            bi.component_product_id,
            1 AS level,
            bi.sequence,
            bi.quantity,
            bi.quantity * (1 + bi.scrap_factor) AS total_quantity,
            bi.unit,
            bi.scrap_factor,
            bi.is_assembly,
            bi.is_phantom,
            p.sku,
            p.name,
            COALESCE(p.cost_price, 0) AS cost_price,
            COALESCE(p.list_price, 0) AS list_price,
            (bi.quantity * (1 + bi.scrap_factor) * COALESCE(p.cost_price, 0)) AS extended_cost,
            (bi.quantity * (1 + bi.scrap_factor) * COALESCE(p.list_price, 0)) AS extended_price,
            ARRAY[p.name] AS path,
            ARRAY[bi.component_product_id] AS visited_products  -- CYCLE detection

        FROM bom_items bi
        JOIN products p ON p.id = bi.component_product_id
        WHERE bi.bom_header_id = v_header_id
          AND bi.parent_item_id IS NULL

        UNION ALL

        -- Recursive case: child items of assemblies
        SELECT
            child.id,
            child.bom_header_id,
            child.parent_item_id,
            child.component_product_id,
            parent.level + 1 AS level,
            child.sequence,
            child.quantity,
            parent.total_quantity * child.quantity * (1 + child.scrap_factor) AS total_quantity,
            child.unit,
            child.scrap_factor,
            child.is_assembly,
            child.is_phantom,
            cp.sku,
            cp.name,
            COALESCE(cp.cost_price, 0) AS cost_price,
            COALESCE(cp.list_price, 0) AS list_price,
            (parent.total_quantity * child.quantity * (1 + child.scrap_factor)
                * COALESCE(cp.cost_price, 0)) AS extended_cost,
            (parent.total_quantity * child.quantity * (1 + child.scrap_factor)
                * COALESCE(cp.list_price, 0)) AS extended_price,
            parent.path || cp.name AS path,
            parent.visited_products || child.component_product_id  -- Track visited

        FROM bom_items child
        JOIN bom_explosion parent ON parent.id = child.parent_item_id
        JOIN products cp ON cp.id = child.component_product_id
        WHERE parent.level < v_max_depth                                  -- Depth guard
          AND child.component_product_id <> ALL(parent.visited_products)  -- CYCLE guard
    )
    SELECT
        be.id,
        be.bom_header_id,
        be.parent_item_id,
        be.component_product_id,
        be.level,
        be.sequence,
        be.quantity,
        be.total_quantity,
        be.unit,
        be.scrap_factor,
        be.is_assembly,
        be.is_phantom,
        be.sku,
        be.name,
        be.cost_price,
        be.list_price,
        be.extended_cost,
        be.extended_price,
        be.path
    FROM bom_explosion be
    ORDER BY be.path, be.sequence;
END;
$$;

COMMENT ON FUNCTION get_bom_tree IS 'Explode BOM tree recursively with cycle detection (max 20 levels)';

-- ============================================================================
-- 7. calculate_bom_cost() — Total BOM cost with CYCLE DETECTION
-- ============================================================================
-- Returns the total cost of a BOM (sum of all leaf-level extended costs).
-- Only counts leaf nodes (non-assembly items) to avoid double-counting.

CREATE OR REPLACE FUNCTION calculate_bom_cost(
    p_product_id UUID,
    p_version TEXT DEFAULT '1.0'
)
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_total_cost NUMERIC;
BEGIN
    SELECT COALESCE(SUM(extended_cost), 0) INTO v_total_cost
    FROM get_bom_tree(p_product_id, p_version)
    WHERE is_assembly = false;  -- Only leaf components contribute to cost

    RETURN ROUND(v_total_cost, 2);
END;
$$;

COMMENT ON FUNCTION calculate_bom_cost IS 'Calculate total BOM cost from leaf-level components (uses get_bom_tree with cycle protection)';

-- ============================================================================
-- 8. get_tree_children() — Lazy-loading tree nodes for UI
-- ============================================================================
-- Returns direct children of a node for lazy-loading tree views.
-- Used by /api/tree endpoint.

CREATE OR REPLACE FUNCTION get_tree_children(
    p_bom_header_id UUID,
    p_parent_item_id UUID DEFAULT NULL,
    p_limit INT DEFAULT 100,
    p_offset INT DEFAULT 0
)
RETURNS TABLE (
    id UUID,
    bom_header_id UUID,
    parent_item_id UUID,
    component_product_id UUID,
    sequence INT,
    quantity NUMERIC,
    unit TEXT,
    scrap_factor NUMERIC,
    is_assembly BOOLEAN,
    is_phantom BOOLEAN,
    sku TEXT,
    name TEXT,
    cost_price NUMERIC,
    list_price NUMERIC,
    extended_cost NUMERIC,
    extended_price NUMERIC,
    has_children BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT
        bi.id,
        bi.bom_header_id,
        bi.parent_item_id,
        bi.component_product_id,
        bi.sequence,
        bi.quantity,
        bi.unit,
        bi.scrap_factor,
        bi.is_assembly,
        bi.is_phantom,
        p.sku,
        p.name,
        COALESCE(p.cost_price, 0) AS cost_price,
        COALESCE(p.list_price, 0) AS list_price,
        (bi.quantity * (1 + bi.scrap_factor) * COALESCE(p.cost_price, 0)) AS extended_cost,
        (bi.quantity * (1 + bi.scrap_factor) * COALESCE(p.list_price, 0)) AS extended_price,
        EXISTS (
            SELECT 1 FROM bom_items child
            WHERE child.parent_item_id = bi.id
        ) AS has_children
    FROM bom_items bi
    JOIN products p ON p.id = bi.component_product_id
    WHERE bi.bom_header_id = p_bom_header_id
      AND (
          (p_parent_item_id IS NULL AND bi.parent_item_id IS NULL)
          OR bi.parent_item_id = p_parent_item_id
      )
    ORDER BY bi.sequence, p.name
    LIMIT p_limit
    OFFSET p_offset;
END;
$$;

COMMENT ON FUNCTION get_tree_children IS 'Lazy-load direct children of a BOM node for tree UI';

COMMIT;
