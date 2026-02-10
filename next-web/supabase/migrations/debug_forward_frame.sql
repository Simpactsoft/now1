-- Check if Forward Frame Assembly has its own BOM header
SELECT 
    p.sku,
    p.name as product_name,
    bh.id as bom_header_id,
    bh.version,
    COUNT(bi.id) as item_count
FROM products p
LEFT JOIN bom_headers bh ON p.id = bh.product_id
LEFT JOIN bom_items bi ON bh.id = bi.bom_header_id
WHERE p.name ILIKE '%frame%assembly%'
    AND p.tenant_id = '00000000-0000-0000-0000-000000000003'
GROUP BY p.sku, p.name, bh.id, bh.version
ORDER BY p.name;

-- Find Forward Frame Assembly and its children in aircraft BOM
WITH aircraft_bom AS (
    SELECT bh.id as bom_header_id
    FROM products p
    JOIN bom_headers bh ON p.id = bh.product_id
    WHERE p.sku = 'AIRCRAFT-C172'
        AND p.tenant_id = '00000000-0000-0000-0000-000000000003'
)
SELECT 
    bi.level,
    bi.sequence,
    bi.parent_item_id,
    p.sku,
    p.name as component_name,
    bi.quantity,
    bi.is_assembly
FROM bom_items bi
JOIN products p ON bi.component_product_id = p.id
WHERE bi.bom_header_id = (SELECT bom_header_id FROM aircraft_bom)
    AND p.name ILIKE '%forward%frame%'
ORDER BY bi.level, bi.sequence;
