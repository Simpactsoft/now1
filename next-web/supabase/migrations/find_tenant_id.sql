-- Find the tenant_id for "Galactic Stress Test"
SELECT id, name, created_at
FROM tenants
WHERE name LIKE '%Galactic%' OR name LIKE '%Stress%'
ORDER BY created_at DESC;

-- Also show all tenants to see what's available
SELECT id, name, created_at
FROM tenants
ORDER BY created_at DESC
LIMIT 10;
