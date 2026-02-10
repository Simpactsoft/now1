-- Bypass RLS to see ALL products including the aircraft
SET ROLE postgres;  -- Run as superuser to bypass RLS

SELECT 
    id,
    tenant_id,
    sku,
    name,
    cost_price,
    created_at
FROM products
WHERE sku = 'AIRCRAFT-C172' OR name LIKE '%Aircraft%'
ORDER BY created_at DESC;

-- If still not found, check if the INSERT even happened
SELECT COUNT(*) as total_aircraft_parts
FROM products
WHERE sku IN ('AL-SHEET-2024', 'RIVET-AN470', 'FUSELAGE-001', 'WING-ASSY-L', 'AIRCRAFT-C172');

-- Reset role
RESET ROLE;
