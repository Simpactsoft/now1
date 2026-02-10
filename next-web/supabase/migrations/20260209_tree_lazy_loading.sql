-- ============================================================================
-- Hierarchical Tree Lazy Loading - Database Layer
-- ============================================================================
-- Purpose: Enable server-side lazy loading for hierarchical tree structures
-- Use cases: BOM, WBS, Categories, Org Charts
-- ============================================================================

-- ============================================================================
-- Function: get_tree_children
-- Description: Fetches direct children of a parent node with pagination
-- ============================================================================
CREATE OR REPLACE FUNCTION get_tree_children(
    p_bom_header_id UUID,
    p_parent_item_id UUID DEFAULT NULL,
    p_limit INT DEFAULT 100,
    p_offset INT DEFAULT 0
)
RETURNS TABLE (
    item_id UUID,
    component_id UUID,
    parent_id UUID,
    sku VARCHAR,
    name VARCHAR,
    level INT,
    quantity DECIMAL,
    unit_cost DECIMAL,
    extended_cost DECIMAL,
    is_assembly BOOLEAN,
    sequence INT,
    has_children BOOLEAN,
    child_count INT
) AS $$
BEGIN
    RETURN QUERY
    WITH direct_children AS (
        -- Get direct children of the specified parent
        SELECT 
            bi.id AS id,
            bi.component_product_id AS component_product_id,
            bi.parent_item_id AS parent_item_id,
            p.sku AS sku,
            p.name AS name,
            bi.level AS level,
            bi.quantity::DECIMAL AS quantity,
            p.cost_price::DECIMAL AS cost_price,
            (bi.quantity * COALESCE(p.cost_price, 0))::DECIMAL AS extended_cost,
            bi.is_assembly AS is_assembly,
            bi.sequence AS sequence
        FROM bom_items bi
        JOIN products p ON bi.component_product_id = p.id
        WHERE bi.bom_header_id = p_bom_header_id
          AND (
              (p_parent_item_id IS NULL AND bi.parent_item_id IS NULL) OR 
              (bi.parent_item_id = p_parent_item_id)
          )
        ORDER BY bi.sequence
        LIMIT p_limit
        OFFSET p_offset
    ),
    children_count AS (
        -- Count children for each node to determine has_children flag
        SELECT 
            bi.parent_item_id,
            COUNT(*) as count
        FROM bom_items bi
        WHERE bi.bom_header_id = p_bom_header_id
        GROUP BY bi.parent_item_id
    )
    SELECT 
        dc.id::UUID,
        dc.component_product_id::UUID,
        dc.parent_item_id::UUID,
        dc.sku::VARCHAR,
        dc.name::VARCHAR,
        dc.level,
        dc.quantity,
        dc.cost_price,
        dc.extended_cost,
        dc.is_assembly,
        dc.sequence,
        COALESCE(cc.count, 0) > 0 AS has_children,
        COALESCE(cc.count, 0)::INT AS child_count
    FROM direct_children dc
    LEFT JOIN children_count cc ON cc.parent_item_id = dc.id;
END;
$$ LANGUAGE plpgsql STABLE SECURITY INVOKER;

COMMENT ON FUNCTION get_tree_children IS 'Fetches direct children of a tree node with pagination for lazy loading';

-- ============================================================================
-- Performance Indexes
-- ============================================================================

-- Index for parent-based queries (critical for lazy loading)
CREATE INDEX IF NOT EXISTS idx_bom_items_parent_header 
ON bom_items(bom_header_id, parent_item_id, sequence);

-- Index for counting children
CREATE INDEX IF NOT EXISTS idx_bom_items_header_parent 
ON bom_items(bom_header_id, parent_item_id);

COMMENT ON INDEX idx_bom_items_parent_header IS 'Optimizes lazy loading queries by parent_id';
COMMENT ON INDEX idx_bom_items_header_parent IS 'Optimizes child count queries';

-- ============================================================================
-- Test Queries
-- ============================================================================

-- Test 1: Get root level items (parent_id = NULL)
-- SELECT * FROM get_tree_children('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', NULL, 10, 0);

-- Test 2: Get children of a specific parent (use actual item_id from Test 1 results)
-- SELECT * FROM get_tree_children('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '<item-id-from-test-1>', 10, 0);

-- Test 3: Check index usage (should use idx_bom_items_parent_header)
-- EXPLAIN ANALYZE SELECT * FROM get_tree_children('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', NULL, 10, 0);
