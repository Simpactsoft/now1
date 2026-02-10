-- Drop and recreate with SECURITY DEFINER to bypass RLS
DROP FUNCTION IF EXISTS get_tree_children(UUID, UUID, INT, INT);

CREATE OR REPLACE FUNCTION get_tree_children(
    p_bom_header_id UUID,
    p_parent_item_id UUID DEFAULT NULL,
    p_limit INT DEFAULT 100,
    p_offset INT DEFAULT 0
)
RETURNS TABLE (
    id UUID,
    component_product_id UUID,
    sku VARCHAR,
    name VARCHAR,
    level INT,
    quantity DECIMAL,
    unit_cost DECIMAL,
    extended_cost DECIMAL,
    is_assembly BOOLEAN,
    sequence INT,
    has_children BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER  -- This bypasses RLS and runs with function owner's permissions
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        bi.id,
        bi.component_product_id,
        p.sku::VARCHAR,
        p.name::VARCHAR,
        bi.level,
        bi.quantity::DECIMAL,
        p.cost_price::DECIMAL AS unit_cost,
        (bi.quantity * COALESCE(p.cost_price, 0))::DECIMAL AS extended_cost,
        bi.is_assembly,
        bi.sequence,
        EXISTS(
            SELECT 1 
            FROM bom_items child 
            WHERE child.parent_item_id = bi.id
        ) AS has_children
    FROM bom_items bi
    JOIN products p ON bi.component_product_id = p.id
    WHERE bi.bom_header_id = p_bom_header_id
      AND (
          (p_parent_item_id IS NULL AND bi.parent_item_id IS NULL) OR
          (bi.parent_item_id = p_parent_item_id)
      )
    ORDER BY bi.sequence
    LIMIT p_limit
    OFFSET p_offset;
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION get_tree_children(UUID, UUID, INT, INT) TO authenticated;

-- Test the function
SELECT * FROM get_tree_children('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', NULL, 10, 0);
