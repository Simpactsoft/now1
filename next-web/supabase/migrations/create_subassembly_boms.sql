-- ============================================================================
-- Create BOM Headers for Sub-Assemblies
-- Purpose: Give each sub-assembly its own independent BOM (ERP best practice)
-- ============================================================================

-- Find Forward Frame Assembly product ID
DO $$
DECLARE
    v_forward_frame_id UUID;
    v_forward_frame_header_id UUID;
    v_tenant_id UUID := '00000000-0000-0000-0000-000000000003';
    v_aircraft_bom_id UUID;
    v_parent_item_id UUID;
BEGIN
    -- 1. Get Forward Frame Assembly product
    SELECT id INTO v_forward_frame_id
    FROM products
    WHERE sku = 'FRAME-FWD-001' AND tenant_id = v_tenant_id;

    IF v_forward_frame_id IS NULL THEN
        RAISE NOTICE 'Forward Frame Assembly not found!';
        RETURN;
    END IF;

    RAISE NOTICE 'Found Forward Frame Assembly: %', v_forward_frame_id;

    -- 2. Check if BOM header already exists
    SELECT id INTO v_forward_frame_header_id
    FROM bom_headers
    WHERE product_id = v_forward_frame_id AND version = '1.0';

    IF v_forward_frame_header_id IS NOT NULL THEN
        RAISE NOTICE 'BOM header already exists for Forward Frame: %', v_forward_frame_header_id;
        RETURN;
    END IF;

    -- 3. Create BOM header for Forward Frame
    INSERT INTO bom_headers (tenant_id, product_id, version, status)
    VALUES (v_tenant_id, v_forward_frame_id, '1.0', 'ACTIVE')
    RETURNING id INTO v_forward_frame_header_id;

    RAISE NOTICE 'Created BOM header for Forward Frame: %', v_forward_frame_header_id;

    -- 4. Find children of Forward Frame in Aircraft BOM
    -- Get aircraft BOM header
    SELECT bh.id INTO v_aircraft_bom_id
    FROM products p
    JOIN bom_headers bh ON p.id = bh.product_id
    WHERE p.sku = 'AIRCRAFT-C172' AND p.tenant_id = v_tenant_id;

    -- Get Forward Frame's parent_item_id in aircraft BOM
    SELECT id INTO v_parent_item_id
    FROM bom_items
    WHERE bom_header_id = v_aircraft_bom_id
        AND component_product_id = v_forward_frame_id;

    RAISE NOTICE 'Forward Frame parent_item_id in aircraft: %', v_parent_item_id;

    -- 5. Copy children from Aircraft BOM to Forward Frame BOM
    INSERT INTO bom_items (
        tenant_id,
        bom_header_id,
        parent_item_id,
        component_product_id,
        level,
        sequence,
        quantity,
        unit,
        is_assembly,
        notes
    )
    SELECT
        v_tenant_id,
        v_forward_frame_header_id,  -- New BOM header
        NULL,  -- Root level in new BOM
        component_product_id,
        0,  -- Level 0 in new BOM (was level 2 in aircraft)
        sequence,
        quantity,
        unit,
        is_assembly,
        'Migrated from aircraft BOM'
    FROM bom_items
    WHERE bom_header_id = v_aircraft_bom_id
        AND parent_item_id = v_parent_item_id;  -- Children of Forward Frame

    RAISE NOTICE 'Copied % items to Forward Frame BOM', 
        (SELECT COUNT(*) FROM bom_items WHERE bom_header_id = v_forward_frame_header_id);

END $$;

-- ============================================================================
-- Verify Results
-- ============================================================================
SELECT 
    p.sku,
    p.name,
    bh.version,
    COUNT(bi.id) as component_count
FROM products p
JOIN bom_headers bh ON p.id = bh.product_id
LEFT JOIN bom_items bi ON bh.id = bi.bom_header_id
WHERE p.sku = 'FRAME-FWD-001'
GROUP BY p.sku, p.name, bh.version;
