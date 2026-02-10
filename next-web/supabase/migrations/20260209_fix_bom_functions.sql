-- ============================================================================
-- BOM Functions Fix - Clean Version
-- Drop and recreate with correct type casting and column names
-- ============================================================================

-- Drop existing functions
DROP FUNCTION IF EXISTS get_bom_tree(UUID, VARCHAR);
DROP FUNCTION IF EXISTS calculate_bom_cost(UUID, VARCHAR);
DROP FUNCTION IF EXISTS explode_bom(UUID, DECIMAL, VARCHAR);

-- ============================================================================
-- Function: get_bom_tree
-- ============================================================================
CREATE OR REPLACE FUNCTION get_bom_tree(p_product_id UUID, p_version VARCHAR DEFAULT '1.0')
RETURNS TABLE (
    item_id UUID,
    component_id UUID,
    sku VARCHAR,
    name VARCHAR,
    level INT,
    quantity DECIMAL,
    unit_cost DECIMAL,
    extended_cost DECIMAL,
    is_assembly BOOLEAN,
    path TEXT
) AS $$
BEGIN
    RETURN QUERY
    WITH RECURSIVE bom_tree (
        t_id,
        t_component_id,
        t_sku,
        t_name,
        t_level,
        t_quantity,
        t_cost_price,
        t_extended_cost,
        t_is_assembly,
        t_path,
        t_sequence,
        t_id_path
    ) AS (
        -- Non-recursive term: root level
        SELECT 
            bi.id,
            bi.component_product_id,
            p.sku,
            p.name,
            bi.level,
            bi.quantity::DECIMAL,
            p.cost_price::DECIMAL,
            (bi.quantity * COALESCE(p.cost_price, 0))::DECIMAL,
            bi.is_assembly,
            REPEAT('  ', bi.level) || p.name,
            bi.sequence,
            ARRAY[bi.id]
        FROM bom_items bi
        JOIN products p ON bi.component_product_id = p.id
        JOIN bom_headers bh ON bi.bom_header_id = bh.id
        WHERE bh.product_id = p_product_id 
          AND bh.version = p_version
          AND bi.parent_item_id IS NULL
        
        UNION ALL
        
        -- Recursive term: child items
        SELECT 
            bi.id,
            bi.component_product_id,
            p.sku,
            p.name,
            bi.level,
            (bi.quantity * bt.t_quantity)::DECIMAL,
            p.cost_price::DECIMAL,
            (bi.quantity * bt.t_quantity * COALESCE(p.cost_price, 0))::DECIMAL,
            bi.is_assembly,
            bt.t_path || ' > ' || p.name,
            bi.sequence,
            bt.t_id_path || bi.id
        FROM bom_items bi
        JOIN bom_tree bt ON bi.parent_item_id = bt.t_id
        JOIN products p ON bi.component_product_id = p.id
        WHERE NOT bi.id = ANY(bt.t_id_path)
    )
    SELECT 
        t_id,
        t_component_id,
        t_sku::VARCHAR,
        t_name::VARCHAR,
        t_level,
        t_quantity,
        t_cost_price,
        t_extended_cost,
        t_is_assembly,
        t_path::TEXT
    FROM bom_tree
    ORDER BY t_level, t_sequence;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION get_bom_tree IS 'Returns hierarchical BOM tree for a product';

-- ============================================================================
-- Function: calculate_bom_cost
-- ============================================================================
CREATE OR REPLACE FUNCTION calculate_bom_cost(p_product_id UUID, p_version VARCHAR DEFAULT '1.0')
RETURNS DECIMAL AS $$
DECLARE
    v_total_cost DECIMAL;
BEGIN
    SELECT SUM(extended_cost) INTO v_total_cost
    FROM get_bom_tree(p_product_id, p_version)
    WHERE NOT is_assembly;
    
    RETURN COALESCE(v_total_cost, 0);
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION calculate_bom_cost IS 'Calculates total BOM cost';

-- ============================================================================
-- Function: explode_bom
-- ============================================================================
CREATE OR REPLACE FUNCTION explode_bom(p_product_id UUID, p_quantity DECIMAL DEFAULT 1, p_version VARCHAR DEFAULT '1.0')
RETURNS TABLE (
    component_sku VARCHAR,
    component_name VARCHAR,
    total_quantity DECIMAL,
    unit_cost DECIMAL,
    total_cost DECIMAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        t.sku::VARCHAR AS component_sku,
        t.name::VARCHAR AS component_name,
        SUM(t.quantity * p_quantity)::DECIMAL AS total_quantity,
        t.unit_cost::DECIMAL AS unit_cost,
        SUM(t.quantity * p_quantity * t.unit_cost)::DECIMAL AS total_cost
    FROM get_bom_tree(p_product_id, p_version) t
    WHERE NOT t.is_assembly
    GROUP BY t.sku, t.name, t.unit_cost
    ORDER BY t.sku;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION explode_bom IS 'Returns flattened shopping list';
