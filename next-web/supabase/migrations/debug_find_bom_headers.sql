-- Find all BOM headers in the system
SELECT 
    bh.id as bom_header_id,
    bh.product_id,
    p.sku,
    p.name as product_name,
    bh.version,
    COUNT(bi.id) as total_items,
    bh.created_at
FROM bom_headers bh
JOIN products p ON bh.product_id = p.id
LEFT JOIN bom_items bi ON bi.bom_header_id = bh.id
GROUP BY bh.id, bh.product_id, p.sku, p.name, bh.version, bh.created_at
ORDER BY bh.created_at DESC;
