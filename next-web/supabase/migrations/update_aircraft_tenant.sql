-- Update aircraft and all its components to the correct tenant: Galactic Stress Test
-- From: 00000000-0000-0000-0000-000000000001 (Nano Startup)
-- To:   00000000-0000-0000-0000-000000000003 (Galactic Stress Test)

BEGIN;

-- Update all aircraft-related products
UPDATE products 
SET tenant_id = '00000000-0000-0000-0000-000000000003'
WHERE sku IN (
    'AIRCRAFT-C172',
    'AL-SHEET-2024', 
    'RIVET-AN470', 
    'PAINT-AERO', 
    'FASTENER-MS',
    'FRAME-FWD-001', 
    'SKIN-PANEL-L', 
    'SPAR-MAIN-001', 
    'FLAP-ASSY-L',
    'FUSELAGE-001', 
    'WING-ASSY-L', 
    'ENGINE-IO540'
)
AND tenant_id = '00000000-0000-0000-0000-000000000001';

-- Update BOM headers
UPDATE bom_headers
SET tenant_id = '00000000-0000-0000-0000-000000000003'
WHERE product_id IN (
    SELECT id FROM products WHERE sku = 'AIRCRAFT-C172'
)
AND tenant_id = '00000000-0000-0000-0000-000000000001';

-- Update BOM items
UPDATE bom_items
SET tenant_id = '00000000-0000-0000-0000-000000000003'
WHERE bom_header_id IN (
    SELECT id FROM bom_headers 
    WHERE product_id IN (SELECT id FROM products WHERE sku = 'AIRCRAFT-C172')
)
AND tenant_id = '00000000-0000-0000-0000-000000000001';

COMMIT;

-- Verify the update
SELECT 
    sku,
    name,
    tenant_id,
    (SELECT name FROM tenants WHERE id = products.tenant_id) as tenant_name
FROM products
WHERE sku IN ('AIRCRAFT-C172', 'FUSELAGE-001', 'WING-ASSY-L')
ORDER BY sku;
