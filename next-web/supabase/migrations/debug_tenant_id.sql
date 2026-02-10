-- Check tenant_id in test data
SELECT 
    'bom_headers' as table_name,
    id,
    tenant_id,
    product_id
FROM bom_headers
WHERE id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'

UNION ALL

SELECT 
    'bom_items' as table_name,
    id,
    tenant_id,
    NULL as product_id
FROM bom_items
WHERE bom_header_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
LIMIT 5;
