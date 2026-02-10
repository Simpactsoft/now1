-- Create a complex 5-level BOM example: Light Aircraft
-- This script creates a product with deep hierarchy to test BOM tree view
-- Based on actual products table schema: tenant_id, sku, name, cost_price, list_price, track_inventory, status

DO $$
DECLARE
    v_tenant_id uuid;
    v_aircraft_id uuid;
    v_fuselage_id uuid;
    v_wing_id uuid;
    v_engine_id uuid;
    v_frame_id uuid;
    v_skin_id uuid;
    v_spar_id uuid;
    v_flap_id uuid;
    v_sheet_id uuid;
    v_rivet_id uuid;
    v_paint_id uuid;
    v_fastener_id uuid;
    v_bom_header_id uuid;
    v_fuselage_item_id uuid;
    v_wing_item_id uuid;
    v_frame_item_id uuid;
    v_skin_item_id uuid;
    v_spar_item_id uuid;
    v_flap_item_id uuid;
BEGIN
    -- Get tenant_id from currenttenant or use test tenant
    v_tenant_id := COALESCE(
        current_setting('app.current_tenant_id', true)::uuid,
        '00000000-0000-0000-0000-000000000001'::uuid
    );

    RAISE NOTICE 'Creating deep BOM for tenant: %', v_tenant_id;

    -- ===== LEVEL 4: Raw Materials (leaf nodes) =====
    INSERT INTO products (tenant_id, sku, name, cost_price, list_price, track_inventory, status)
    VALUES (v_tenant_id, 'AL-SHEET-2024', 'Aluminum Sheet 2024-T3', 45.00, 50, true, 'ACTIVE')
    RETURNING id INTO v_sheet_id;

    INSERT INTO products (tenant_id, sku, name, cost_price, list_price, track_inventory, status)
    VALUES (v_tenant_id, 'RIVET-AN470', 'AN470 Aluminum Rivets (100pcs)', 12.00, 15, true, 'ACTIVE')
    RETURNING id INTO v_rivet_id;

    INSERT INTO products (tenant_id, sku, name, cost_price, list_price, track_inventory, status)
    VALUES (v_tenant_id, 'PAINT-AERO', 'Aerospace Grade Paint (1L)', 85.00, 100, true, 'ACTIVE')
    RETURNING id INTO v_paint_id;

    INSERT INTO products (tenant_id, sku, name, cost_price, list_price, track_inventory, status)
    VALUES (v_tenant_id, 'FASTENER-MS', 'MS20470 Fasteners (50pcs)', 28.00, 35, true, 'ACTIVE')
    RETURNING id INTO v_fastener_id;

    -- ===== LEVEL 3: Sub-Components =====
    INSERT INTO products (tenant_id, sku, name, cost_price, list_price, track_inventory, status)
    VALUES (v_tenant_id, 'FRAME-FWD-001', 'Forward Frame Assembly', 0, 0, true, 'ACTIVE')
    RETURNING id INTO v_frame_id;

    INSERT INTO products (tenant_id, sku, name, cost_price, list_price, track_inventory, status)
    VALUES (v_tenant_id, 'SKIN-PANEL-L', 'Left Skin Panel Assembly', 0, 0, true, 'ACTIVE')
    RETURNING id INTO v_skin_id;

    INSERT INTO products (tenant_id, sku, name, cost_price, list_price, track_inventory, status)
    VALUES (v_tenant_id, 'SPAR-MAIN-001', 'Main Wing Spar', 0, 0, true, 'ACTIVE')
    RETURNING id INTO v_spar_id;

    INSERT INTO products (tenant_id, sku, name, cost_price, list_price, track_inventory, status)
    VALUES (v_tenant_id, 'FLAP-ASSY-L', 'Left Flap Assembly', 0, 0, true, 'ACTIVE')
    RETURNING id INTO v_flap_id;

    -- ===== LEVEL 2: Major Sub-Assemblies =====
    INSERT INTO products (tenant_id, sku, name, cost_price, list_price, track_inventory, status)
    VALUES (v_tenant_id, 'FUSELAGE-001', 'Fuselage Section', 0, 0, true, 'ACTIVE')
    RETURNING id INTO v_fuselage_id;

    INSERT INTO products (tenant_id, sku, name, cost_price, list_price, track_inventory, status)
    VALUES (v_tenant_id, 'WING-ASSY-L', 'Left Wing Assembly', 0, 0, true, 'ACTIVE')
    RETURNING id INTO v_wing_id;

    INSERT INTO products (tenant_id, sku, name, cost_price, list_price, track_inventory, status)
    VALUES (v_tenant_id, 'ENGINE-IO540', 'Engine Assembly IO-540', 45000, 55000, true, 'ACTIVE')
    RETURNING id INTO v_engine_id;

    -- ===== LEVEL 1: Top-Level Product (Aircraft) =====
    INSERT INTO products (tenant_id, sku, name, cost_price, list_price, track_inventory, status)
    VALUES (v_tenant_id, 'AIRCRAFT-C172', 'Light Aircraft C172', 0, 0, true, 'ACTIVE')
    RETURNING id INTO v_aircraft_id;

    -- ===== Create BOM Header =====
    INSERT INTO bom_headers (tenant_id, product_id, version, status, effective_date)
    VALUES (v_tenant_id, v_aircraft_id, '1.0', 'ACTIVE', CURRENT_DATE)
    RETURNING id INTO v_bom_header_id;

    -- ===== BOM Structure: Level 0 (Root - Aircraft itself) =====
    -- Note: Some systems represent the root product, others don't. We'll start with sub-assemblies.

    -- ===== BOM Structure: Level 1 (Major assemblies under Aircraft) =====
    INSERT INTO bom_items (tenant_id, bom_header_id, parent_item_id, component_product_id, quantity, level, sequence, is_assembly)
    VALUES (v_tenant_id, v_bom_header_id, NULL, v_fuselage_id, 1, 0, 10, true)
    RETURNING id INTO v_fuselage_item_id;

    INSERT INTO bom_items (tenant_id, bom_header_id, parent_item_id, component_product_id, quantity, level, sequence, is_assembly)
    VALUES (v_tenant_id, v_bom_header_id, NULL, v_wing_id, 2, 0, 20, true)
    RETURNING id INTO v_wing_item_id;

    INSERT INTO bom_items (tenant_id, bom_header_id, parent_item_id, component_product_id, quantity, level, sequence, is_assembly)
    VALUES (v_tenant_id, v_bom_header_id, NULL, v_engine_id, 1, 0, 30, false);

    -- ===== BOM Structure: Level 2 (under Fuselage) =====
    INSERT INTO bom_items (tenant_id, bom_header_id, parent_item_id, component_product_id, quantity, level, sequence, is_assembly)
    VALUES 
        (v_tenant_id, v_bom_header_id, v_fuselage_item_id, v_frame_id, 8, 1, 10, true),
        (v_tenant_id, v_bom_header_id, v_fuselage_item_id, v_skin_id, 12, 1, 20, true);

    -- ===== BOM Structure: Level 2 (under Wing) =====
    INSERT INTO bom_items (tenant_id, bom_header_id, parent_item_id, component_product_id, quantity, level, sequence, is_assembly)
    VALUES 
        (v_tenant_id, v_bom_header_id, v_wing_item_id, v_spar_id, 1, 1, 10, true),
        (v_tenant_id, v_bom_header_id, v_wing_item_id, v_flap_id, 1, 1, 20, true);

    -- Get level 2 bom_item IDs
    SELECT id INTO v_frame_item_id FROM bom_items WHERE component_product_id = v_frame_id AND bom_header_id = v_bom_header_id LIMIT 1;
    SELECT id INTO v_skin_item_id FROM bom_items WHERE component_product_id = v_skin_id AND bom_header_id = v_bom_header_id LIMIT 1;
    SELECT id INTO v_spar_item_id FROM bom_items WHERE component_product_id = v_spar_id AND bom_header_id = v_bom_header_id LIMIT 1;
    SELECT id INTO v_flap_item_id FROM bom_items WHERE component_product_id = v_flap_id AND bom_header_id = v_bom_header_id LIMIT 1;

    -- ===== BOM Structure: Level 3 (under Frame) =====
    INSERT INTO bom_items (tenant_id, bom_header_id, parent_item_id, component_product_id, quantity, level, sequence, is_assembly)
    VALUES 
        (v_tenant_id, v_bom_header_id, v_frame_item_id, v_sheet_id, 4, 2, 10, false),
        (v_tenant_id, v_bom_header_id, v_frame_item_id, v_rivet_id, 8, 2, 20, false),
        (v_tenant_id, v_bom_header_id, v_frame_item_id, v_fastener_id, 4, 2, 30, false);

    -- ===== BOM Structure: Level 3 (under Skin Panel) =====
    INSERT INTO bom_items (tenant_id, bom_header_id, parent_item_id, component_product_id, quantity, level, sequence, is_assembly)
    VALUES 
        (v_tenant_id, v_bom_header_id, v_skin_item_id, v_sheet_id, 6, 2, 10, false),
        (v_tenant_id, v_bom_header_id, v_skin_item_id, v_rivet_id, 12, 2, 20, false),
        (v_tenant_id, v_bom_header_id, v_skin_item_id, v_paint_id, 2, 2, 30, false);

    -- ===== BOM Structure: Level 3 (under Spar) =====
    INSERT INTO bom_items (tenant_id, bom_header_id, parent_item_id, component_product_id, quantity, level, sequence, is_assembly)
    VALUES 
        (v_tenant_id, v_bom_header_id, v_spar_item_id, v_sheet_id, 8, 2, 10, false),
        (v_tenant_id, v_bom_header_id, v_spar_item_id, v_rivet_id, 20, 2, 20, false),
        (v_tenant_id, v_bom_header_id, v_spar_item_id, v_fastener_id, 8, 2, 30, false);

    -- ===== BOM Structure: Level 3 (under Flap) =====
    INSERT INTO bom_items (tenant_id, bom_header_id, parent_item_id, component_product_id, quantity, level, sequence, is_assembly)
    VALUES 
        (v_tenant_id, v_bom_header_id, v_flap_item_id, v_sheet_id, 3, 2, 10, false),
        (v_tenant_id, v_bom_header_id, v_flap_item_id, v_rivet_id, 6, 2, 20, false);

    RAISE NOTICE '====================================';
    RAISE NOTICE 'Deep BOM created successfully!';
    RAISE NOTICE '====================================';
    RAISE NOTICE 'Aircraft ID: %', v_aircraft_id;
    RAISE NOTICE 'BOM Header ID: %', v_bom_header_id;
    RAISE NOTICE 'Tenant ID: %', v_tenant_id;
    RAISE NOTICE '';
    RAISE NOTICE 'Go to Products page and search for: Light Aircraft C172';
    RAISE NOTICE '====================================';
END $$;
