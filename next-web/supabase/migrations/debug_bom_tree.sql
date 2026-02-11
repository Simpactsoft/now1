WITH RECURSIVE bom_tree AS (
    SELECT 
        bh.id as bom_header_id,
        bh.product_id
    FROM bom_headers bh
    JOIN products p ON p.id = bh.product_id
    WHERE p.sku = 'AIRCRAFT-C172' 
      AND bh.status = 'ACTIVE'
    LIMIT 1
),
bom_hierarchy AS (
    SELECT
        p.id::text as item_id,
        p.name,
        p.sku,
        0 as level,
        p.name as path,
        NULL::uuid as parent_item_id,
        0::DECIMAL(10,4) as quantity,
        COALESCE(p.cost_price, 0) as unit_cost,
        0.0 as extended_cost,
        bt.bom_header_id
    FROM bom_tree bt
    JOIN products p ON p.id = bt.product_id
    
    UNION ALL
    
    SELECT
        bi.id::text as item_id,
        p.name,
        p.sku,
        bh.level + 1 as level,
        bh.path || ' > ' || p.name as path,
        bi.parent_item_id,
        bi.quantity,
        COALESCE(p.cost_price, 0) as unit_cost,
        bi.quantity * COALESCE(p.cost_price, 0) as extended_cost,
        bh.bom_header_id
    FROM bom_hierarchy bh
    JOIN bom_items bi ON bi.bom_header_id = bh.bom_header_id
                      AND ((bh.level = 0 AND bi.parent_item_id IS NULL) OR (bh.level > 0 AND bi.parent_item_id::text = bh.item_id))
    JOIN products p ON p.id = bi.component_product_id
)
SELECT 
    level,
    path,
    item_id,
    sku,
    name,
    quantity,
    unit_cost,
    extended_cost,
    parent_item_id
FROM bom_hierarchy
ORDER BY path;
