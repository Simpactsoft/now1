-- Verify the image URL updates
SELECT 
    custom_fields->>'sku' as sku,
    display_name as name,
    custom_fields->>'image_url' as image_url
FROM cards
WHERE type = 'product'
AND tenant_id = '00000000-0000-0000-0000-000000000003'
AND custom_fields->>'sku' IN (
    'AIRCRAFT-C172',
    'FUSELAGE-001',
    'WING-ASSY-L',
    'AL-SHEET-2024',
    'RIVET-AN470',
    'PAINT-AERO',
    'FASTENER-MS'
)
ORDER BY custom_fields->>'sku';
