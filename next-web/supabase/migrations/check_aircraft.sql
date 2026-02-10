-- Check if the aircraft was created
SELECT 
    id,
    tenant_id,
    sku,
    name,
    cost_price,
    status
FROM products
WHERE sku = 'AIRCRAFT-C172'
ORDER BY created_at DESC
LIMIT 5;

-- If not found, list recent products to see tenant_id
SELECT 
    id,
    tenant_id,
    sku,
    name,
    created_at
FROM products
ORDER BY created_at DESC
LIMIT 10;
