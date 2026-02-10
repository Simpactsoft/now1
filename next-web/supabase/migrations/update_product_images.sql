-- Update products with image URLs in custom_fields
UPDATE cards
SET custom_fields = jsonb_set(
    COALESCE(custom_fields, '{}'::jsonb),
    '{image_url}',
    to_jsonb(CASE 
        WHEN custom_fields->>'sku' = 'AIRCRAFT-C172' THEN '/images/products/aircraft-c172.png'
        WHEN custom_fields->>'sku' = 'FUSELAGE-001' THEN '/images/products/fuselage-001.png'
        WHEN custom_fields->>'sku' = 'WING-ASSY-L' THEN '/images/products/wing-assy-l.png'
        WHEN custom_fields->>'sku' = 'AL-SHEET-2024' THEN '/images/products/al-sheet-2024.png'
        WHEN custom_fields->>'sku' = 'RIVET-AN470' THEN '/images/products/rivet-an470.png'
        WHEN custom_fields->>'sku' = 'PAINT-AERO' THEN '/images/products/paint-aero.png'
        WHEN custom_fields->>'sku' = 'FASTENER-MS' THEN '/images/products/fastener-ms.png'
    END)
)
WHERE type = 'product'
AND custom_fields->>'sku' IN (
    'AIRCRAFT-C172',
    'FUSELAGE-001',
    'WING-ASSY-L',
    'AL-SHEET-2024',
    'RIVET-AN470',
    'PAINT-AERO',
    'FASTENER-MS'
)
AND tenant_id = '00000000-0000-0000-0000-000000000003';
