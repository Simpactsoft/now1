-- Simple script to create just the aircraft product with the correct tenant_id
INSERT INTO products (tenant_id, sku, name, cost_price, list_price, track_inventory, status)
VALUES ('00000000-0000-0000-0000-000000000001', 'AIRCRAFT-C172', 'Light Aircraft C172', 0, 0, true, 'ACTIVE')
ON CONFLICT (sku, tenant_id) DO UPDATE 
SET name = EXCLUDED.name
RETURNING id, tenant_id, sku, name;

-- Now create a simple BOM for it using existing products
DO $$
DECLARE
    v_aircraft_id uuid;
    v_bom_header_id uuid;
    v_fuselage_id uuid;
    v_wing_id uuid;
BEGIN
    -- Get the aircraft ID
    SELECT id INTO v_aircraft_id FROM products WHERE sku = 'AIRCRAFT-C172' AND tenant_id = '00000000-0000-0000-0000-000000000001';
    
    -- Ensure FUSELAGE exists
    SELECT id INTO v_fuselage_id FROM products WHERE sku = 'FUSELAGE-001' AND tenant_id = '00000000-0000-0000-0000-000000000001' LIMIT 1;
    IF v_fuselage_id IS NULL THEN
        INSERT INTO products (tenant_id, sku, name, cost_price, list_price, track_inventory, status)
        VALUES ('00000000-0000-0000-0000-000000000001', 'FUSELAGE-001', 'Fuselage Section', 0, 0, true, 'ACTIVE')
        RETURNING id INTO v_fuselage_id;
    END IF;

    -- Ensure WING-ASSY-L exists
    SELECT id INTO v_wing_id FROM products WHERE sku = 'WING-ASSY-L' AND tenant_id = '00000000-0000-0000-0000-000000000001' LIMIT 1;
    IF v_wing_id IS NULL THEN
        INSERT INTO products (tenant_id, sku, name, cost_price, list_price, track_inventory, status)
        VALUES ('00000000-0000-0000-0000-000000000001', 'WING-ASSY-L', 'Left Wing Assembly', 0, 0, true, 'ACTIVE')
        RETURNING id INTO v_wing_id;
    END IF;
    
    IF v_aircraft_id IS NULL THEN
        RAISE EXCEPTION 'Aircraft not found!';
    END IF;
    
    -- Create BOM header if it doesn't exist
    INSERT INTO bom_headers (tenant_id, product_id, version, status, effective_date)
    VALUES ('00000000-0000-0000-0000-000000000001', v_aircraft_id, '1.0', 'ACTIVE', CURRENT_DATE)
    ON CONFLICT (product_id, version) DO UPDATE SET status = 'ACTIVE'
    RETURNING id INTO v_bom_header_id;
    
    -- Delete existing BOM items for this header to avoid duplicates
    DELETE FROM bom_items WHERE bom_header_id = v_bom_header_id;
    
    -- Add BOM items
    IF v_fuselage_id IS NOT NULL THEN
        INSERT INTO bom_items (tenant_id, bom_header_id, parent_item_id, component_product_id, quantity, sequence, is_assembly)
        VALUES ('00000000-0000-0000-0000-000000000001', v_bom_header_id, NULL, v_fuselage_id, 1, 10, true);
    END IF;
    
    IF v_wing_id IS NOT NULL THEN
        INSERT INTO bom_items (tenant_id, bom_header_id, parent_item_id, component_product_id, quantity, sequence, is_assembly)
        VALUES ('00000000-0000-0000-0000-000000000001', v_bom_header_id, NULL, v_wing_id, 2, 20, true);
    END IF;
    
    RAISE NOTICE 'Aircraft created/updated successfully!';
    RAISE NOTICE 'Aircraft ID: %', v_aircraft_id;
    RAISE NOTICE 'BOM Header ID: %', v_bom_header_id;
END $$;
