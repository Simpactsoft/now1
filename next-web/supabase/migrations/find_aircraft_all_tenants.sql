-- Find the aircraft - search ALL tenants
SELECT 
    id,
    tenant_id,
    sku,
    name,
    cost_price,
    created_at
FROM products
WHERE sku LIKE '%AIRCRAFT%' OR name LIKE '%Aircraft%'
ORDER BY created_at DESC;

-- Also check what tenant_id the app is using
SELECT current_setting('app.current_tenant_id', true) as current_tenant;
