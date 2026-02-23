-- Replacing get_bom_tree to handle RLS and auth properly 

BEGIN;

DROP FUNCTION IF EXISTS get_bom_tree(uuid, text);
DROP FUNCTION IF EXISTS get_bom_tree(uuid, varchar);

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
SECURITY DEFINER -- SECURITY DEFINER bypasses RLS, executing as the owner
SET search_path = public
AS $$
DECLARE
    v_header_id UUID;
    v_max_depth CONSTANT INT := 20;
BEGIN
    SELECT bh.id INTO v_header_id
    FROM bom_headers bh
    WHERE bh.product_id = p_product_id
      AND bh.version = p_version
      AND bh.status = 'ACTIVE'
    LIMIT 1;

    IF v_header_id IS NULL THEN
        RETURN;
    END IF;

    RETURN QUERY
    WITH RECURSIVE bom_explosion AS (
        SELECT
            bi.id,
            bi.bom_header_id,
            bi.parent_item_id,
            bi.component_product_id,
            1 AS level,
            bi.sequence,
            bi.quantity,
            bi.quantity * (1 + bi.scrap_factor) AS total_quantity,
            bi.unit::TEXT, 
            bi.scrap_factor,
            bi.is_assembly,
            bi.is_phantom,
            p.sku,
            p.name,
            COALESCE(p.cost_price, 0) AS cost_price,
            COALESCE(p.list_price, 0) AS list_price,
            (bi.quantity * (1 + bi.scrap_factor) * COALESCE(p.cost_price, 0)) AS extended_cost,
            (bi.quantity * (1 + bi.scrap_factor) * COALESCE(p.list_price, 0)) AS extended_price,
            ARRAY[p.name]::TEXT[] AS path, 
            ARRAY[bi.component_product_id] AS visited_products

        FROM bom_items bi
        JOIN products p ON p.id = bi.component_product_id
        WHERE bi.bom_header_id = v_header_id
          AND bi.parent_item_id IS NULL

        UNION ALL

        SELECT
            child.id,
            child.bom_header_id,
            child.parent_item_id,
            child.component_product_id,
            parent.level + 1 AS level,
            child.sequence,
            child.quantity,
            parent.total_quantity * child.quantity * (1 + child.scrap_factor) AS total_quantity,
            child.unit::TEXT, 
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
            (parent.path || cp.name)::TEXT[] AS path, 
            (parent.visited_products || child.component_product_id)

        FROM bom_items child
        JOIN bom_explosion parent ON parent.id = child.parent_item_id
        JOIN products cp ON cp.id = child.component_product_id
        WHERE parent.level < v_max_depth
          AND child.component_product_id <> ALL(parent.visited_products)
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

-- We also need to fix calculate_bom_cost which probably has the same issue
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
    WHERE is_assembly = false;

    RETURN ROUND(v_total_cost, 2);
END;
$$;

NOTIFY pgrst, 'reload schema';

COMMIT;
