-- Add deeper BOM levels to enable drill-down
-- This adds sub-assemblies under Fuselage and Wing

DO $$
DECLARE
    v_bom_header_id uuid;
    v_fuselage_item_id uuid;
    v_wing_item_id uuid;
    v_frame_id uuid;
    v_skin_id uuid;
    v_spar_id uuid;
    v_flap_id uuid;
    v_sheet_id uuid;
    v_rivet_id uuid;
    v_paint_id uuid;
    v_fastener_id uuid;
    v_frame_item_id uuid;
    v_skin_item_id uuid;
    v_spar_item_id uuid;
    v_flap_item_id uuid;
BEGIN
    -- Get BOM header
    SELECT bh.id INTO v_bom_header_id
    FROM bom_headers bh
    JOIN products p ON bh.product_id = p.id
    WHERE p.sku = 'AIRCRAFT-C172'
    AND p.tenant_id = '00000000-0000-0000-0000-000000000003'
    LIMIT 1;

    IF v_bom_header_id IS NULL THEN
        RAISE EXCEPTION 'BOM header not found!';
    END IF;

    -- Get parent item IDs (Fuselage and Wing)
    SELECT bi.id INTO v_fuselage_item_id 
    FROM bom_items bi
    JOIN products p ON bi.component_product_id = p.id
    WHERE p.sku = 'FUSELAGE-001' 
    AND bi.bom_header_id = v_bom_header_id
    LIMIT 1;

    SELECT bi.id INTO v_wing_item_id 
    FROM bom_items bi
    JOIN products p ON bi.component_product_id = p.id
    WHERE p.sku = 'WING-ASSY-L' 
    AND bi.bom_header_id = v_bom_header_id
    LIMIT 1;

    -- Get product IDs for sub-assemblies
    SELECT id INTO v_frame_id FROM products WHERE sku = 'FRAME-FWD-001' AND tenant_id = '00000000-0000-0000-0000-000000000003';
    SELECT id INTO v_skin_id FROM products WHERE sku = 'SKIN-PANEL-L' AND tenant_id = '00000000-0000-0000-0000-000000000003';
    SELECT id INTO v_spar_id FROM products WHERE sku = 'SPAR-MAIN-001' AND tenant_id = '00000000-0000-0000-0000-000000000003';
    SELECT id INTO v_flap_id FROM products WHERE sku = 'FLAP-ASSY-L' AND tenant_id = '00000000-0000-0000-0000-000000000003';

    -- Get product IDs for raw materials
    SELECT id INTO v_sheet_id FROM products WHERE sku = 'AL-SHEET-2024' AND tenant_id = '00000000-0000-0000-0000-000000000003';
    SELECT id INTO v_rivet_id FROM products WHERE sku = 'RIVET-AN470' AND tenant_id = '00000000-0000-0000-0000-000000000003';
    SELECT id INTO v_paint_id FROM products WHERE sku = 'PAINT-AERO' AND tenant_id = '00000000-0000-0000-0000-000000000003';
    SELECT id INTO v_fastener_id FROM products WHERE sku = 'FASTENER-MS' AND tenant_id = '00000000-0000-0000-0000-000000000003';

    -- Add Level 2: Sub-assemblies under Fuselage
    INSERT INTO bom_items (tenant_id, bom_header_id, parent_item_id, component_product_id, quantity, level, sequence, is_assembly)
    VALUES 
        ('00000000-0000-0000-0000-000000000003', v_bom_header_id, v_fuselage_item_id, v_frame_id, 8, 1, 10, true),
        ('00000000-0000-0000-0000-000000000003', v_bom_header_id, v_fuselage_item_id, v_skin_id, 12, 1, 20, true)
    ON CONFLICT DO NOTHING;

    -- Add Level 2: Sub-assemblies under Wing
    INSERT INTO bom_items (tenant_id, bom_header_id, parent_item_id, component_product_id, quantity, level, sequence, is_assembly)
    VALUES 
        ('00000000-0000-0000-0000-000000000003', v_bom_header_id, v_wing_item_id, v_spar_id, 1, 1, 10, true),
        ('00000000-0000-0000-0000-000000000003', v_bom_header_id, v_wing_item_id, v_flap_id, 1, 1, 20, true)
    ON CONFLICT DO NOTHING;

    -- Get the newly created item IDs for Level 2
    SELECT id INTO v_frame_item_id FROM bom_items 
    WHERE component_product_id = v_frame_id AND bom_header_id = v_bom_header_id AND parent_item_id = v_fuselage_item_id LIMIT 1;
    
    SELECT id INTO v_skin_item_id FROM bom_items 
    WHERE component_product_id = v_skin_id AND bom_header_id = v_bom_header_id AND parent_item_id = v_fuselage_item_id LIMIT 1;
    
    SELECT id INTO v_spar_item_id FROM bom_items 
    WHERE component_product_id = v_spar_id AND bom_header_id = v_bom_header_id AND parent_item_id = v_wing_item_id LIMIT 1;
    
    SELECT id INTO v_flap_item_id FROM bom_items 
    WHERE component_product_id = v_flap_id AND bom_header_id = v_bom_header_id AND parent_item_id = v_wing_item_id LIMIT 1;

    -- Add Level 3: Raw materials under Frame
    IF v_frame_item_id IS NOT NULL THEN
        INSERT INTO bom_items (tenant_id, bom_header_id, parent_item_id, component_product_id, quantity, level, sequence, is_assembly)
        VALUES 
            ('00000000-0000-0000-0000-000000000003', v_bom_header_id, v_frame_item_id, v_sheet_id, 4, 2, 10, false),
            ('00000000-0000-0000-0000-000000000003', v_bom_header_id, v_frame_item_id, v_rivet_id, 8, 2, 20, false),
            ('00000000-0000-0000-0000-000000000003', v_bom_header_id, v_frame_item_id, v_fastener_id, 4, 2, 30, false)
        ON CONFLICT DO NOTHING;
    END IF;

    -- Add Level 3: Raw materials under Skin
    IF v_skin_item_id IS NOT NULL THEN
        INSERT INTO bom_items (tenant_id, bom_header_id, parent_item_id, component_product_id, quantity, level, sequence, is_assembly)
        VALUES 
            ('00000000-0000-0000-0000-000000000003', v_bom_header_id, v_skin_item_id, v_sheet_id, 6, 2, 10, false),
            ('00000000-0000-0000-0000-000000000003', v_bom_header_id, v_skin_item_id, v_rivet_id, 12, 2, 20, false),
            ('00000000-0000-0000-0000-000000000003', v_bom_header_id, v_skin_item_id, v_paint_id, 2, 2, 30, false)
        ON CONFLICT DO NOTHING;
    END IF;

    -- Add Level 3: Raw materials under Spar
    IF v_spar_item_id IS NOT NULL THEN
        INSERT INTO bom_items (tenant_id, bom_header_id, parent_item_id, component_product_id, quantity, level, sequence, is_assembly)
        VALUES 
            ('00000000-0000-0000-0000-000000000003', v_bom_header_id, v_spar_item_id, v_sheet_id, 8, 2, 10, false),
            ('00000000-0000-0000-0000-000000000003', v_bom_header_id, v_spar_item_id, v_rivet_id, 20, 2, 20, false),
            ('00000000-0000-0000-0000-000000000003', v_bom_header_id, v_spar_item_id, v_fastener_id, 8, 2, 30, false)
        ON CONFLICT DO NOTHING;
    END IF;

    -- Add Level 3: Raw materials under Flap
    IF v_flap_item_id IS NOT NULL THEN
        INSERT INTO bom_items (tenant_id, bom_header_id, parent_item_id, component_product_id, quantity, level, sequence, is_assembly)
        VALUES 
            ('00000000-0000-0000-0000-000000000003', v_bom_header_id, v_flap_item_id, v_sheet_id, 3, 2, 10, false),
            ('00000000-0000-0000-0000-000000000003', v_bom_header_id, v_flap_item_id, v_rivet_id, 6, 2, 20, false)
        ON CONFLICT DO NOTHING;
    END IF;

    RAISE NOTICE 'Deep BOM structure added successfully!';
    RAISE NOTICE 'Now you can drill down: Aircraft > Fuselage/Wing > Frame/Skin/Spar/Flap > Raw Materials';
END $$;
