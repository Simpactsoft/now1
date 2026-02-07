-- ====================================================
-- SAMPLE DATA GENERATOR FOR SALES & INVENTORY MODULE
-- ====================================================

DO $$
DECLARE
    v_tenant_id UUID;
    v_supplier_id UUID;
    
    -- Category IDs
    v_cat_elec UUID;
    v_cat_laptops UUID;
    v_cat_biz_laptops UUID;
    v_cat_gaming_laptops UUID;
    v_cat_access UUID;
    v_cat_mice UUID;
    v_cat_keyboards UUID;
    
    v_cat_clothing UUID;
    v_cat_men UUID;
    v_cat_women UUID;

    -- Product IDs
    v_prod_dell UUID;
    v_prod_hp UUID;
    v_prod_razer UUID;
    v_prod_mx_master UUID;
    v_prod_keychron UUID;
    
    -- Config
    v_user_id UUID := auth.uid(); -- Might be null in direct SQL execution, handle gracefully
BEGIN
    -- 1. SETUP CONTEXT
    SELECT id INTO v_tenant_id FROM tenants LIMIT 1;
    IF v_tenant_id IS NULL THEN RAISE EXCEPTION 'No tenants found'; END IF;
    PERFORM set_config('app.current_tenant', v_tenant_id::text, false);
    
    SELECT id INTO v_supplier_id FROM cards WHERE tenant_id = v_tenant_id LIMIT 1;

    RAISE NOTICE 'Generating Data for Tenant: %', v_tenant_id;

    -- 2. CATEGORIES (Hierarchy)
    -- Electronics
    INSERT INTO product_categories (tenant_id, name, parent_id) VALUES (v_tenant_id, 'Electronics', NULL) RETURNING id INTO v_cat_elec;
    
    INSERT INTO product_categories (tenant_id, name, parent_id) VALUES (v_tenant_id, 'Laptops', v_cat_elec) RETURNING id INTO v_cat_laptops;
    INSERT INTO product_categories (tenant_id, name, parent_id) VALUES (v_tenant_id, 'Business Laptops', v_cat_laptops) RETURNING id INTO v_cat_biz_laptops;
    INSERT INTO product_categories (tenant_id, name, parent_id) VALUES (v_tenant_id, 'Gaming Laptops', v_cat_laptops) RETURNING id INTO v_cat_gaming_laptops;
    
    INSERT INTO product_categories (tenant_id, name, parent_id) VALUES (v_tenant_id, 'Accessories', v_cat_elec) RETURNING id INTO v_cat_access;
    INSERT INTO product_categories (tenant_id, name, parent_id) VALUES (v_tenant_id, 'Mice', v_cat_access) RETURNING id INTO v_cat_mice;
    INSERT INTO product_categories (tenant_id, name, parent_id) VALUES (v_tenant_id, 'Keyboards', v_cat_access) RETURNING id INTO v_cat_keyboards;

    -- Clothing
    INSERT INTO product_categories (tenant_id, name, parent_id) VALUES (v_tenant_id, 'Clothing', NULL) RETURNING id INTO v_cat_clothing;
    INSERT INTO product_categories (tenant_id, name, parent_id) VALUES (v_tenant_id, 'Men', v_cat_clothing) RETURNING id INTO v_cat_men;
    INSERT INTO product_categories (tenant_id, name, parent_id) VALUES (v_tenant_id, 'Women', v_cat_clothing) RETURNING id INTO v_cat_women;

    RAISE NOTICE '✅ Categories Created';

    -- 3. PRODUCTS
    -- Laptops
    INSERT INTO products (tenant_id, category_id, supplier_id, sku, name, cost_price, list_price, track_inventory)
    VALUES 
    (v_tenant_id, v_cat_biz_laptops, v_supplier_id, 'LAP-DELL-LAT', 'Dell Latitude 7420', 1200.00, 1500.00, true) RETURNING id INTO v_prod_dell;
    
    INSERT INTO products (tenant_id, category_id, supplier_id, sku, name, cost_price, list_price, track_inventory)
    VALUES 
    (v_tenant_id, v_cat_biz_laptops, v_supplier_id, 'LAP-HP-PRO', 'HP ProBook 450', 900.00, 1100.00, true) RETURNING id INTO v_prod_hp;

    INSERT INTO products (tenant_id, category_id, supplier_id, sku, name, cost_price, list_price, track_inventory)
    VALUES 
    (v_tenant_id, v_cat_gaming_laptops, v_supplier_id, 'LAP-RAZER-BLADE', 'Razer Blade 15', 2000.00, 2500.00, true) RETURNING id INTO v_prod_razer;

    -- Accessories
    INSERT INTO products (tenant_id, category_id, supplier_id, sku, name, cost_price, list_price, track_inventory)
    VALUES 
    (v_tenant_id, v_cat_mice, v_supplier_id, 'ACC-MX-MASTER', 'Logitech MX Master 3', 80.00, 100.00, true) RETURNING id INTO v_prod_mx_master;

    INSERT INTO products (tenant_id, category_id, supplier_id, sku, name, cost_price, list_price, track_inventory)
    VALUES 
    (v_tenant_id, v_cat_keyboards, v_supplier_id, 'ACC-KEYCHRON-Q1', 'Keychron Q1 Pro', 150.00, 200.00, true) RETURNING id INTO v_prod_keychron;

    -- Clothing (No Inventory Tracking for Services/Made-to-order - Example)
    INSERT INTO products (tenant_id, category_id, sku, name, cost_price, list_price, track_inventory)
    VALUES 
    (v_tenant_id, v_cat_men, 'CLO-SUIT-TAILOR', 'Custom Tailored Suit', 500.00, 1000.00, false);

    RAISE NOTICE '✅ Products Created';

    -- 4. INVENTORY (Initial Stock)
    -- 4. INVENTORY (Initial Stock)
    -- Add 100 units to Laptops
    PERFORM public.record_inventory_transaction(
        p_product_id := v_prod_dell, 
        p_quantity_change := 50::NUMERIC, 
        p_transaction_type := 'adjustment_in'::TEXT, 
        p_reference_id := NULL::UUID, 
        p_notes := 'Initial Stock'::TEXT
    );
    PERFORM public.record_inventory_transaction(
        p_product_id := v_prod_hp, 
        p_quantity_change := 30::NUMERIC, 
        p_transaction_type := 'adjustment_in'::TEXT, 
        p_reference_id := NULL::UUID, 
        p_notes := 'Initial Stock'::TEXT
    );
    PERFORM public.record_inventory_transaction(
        p_product_id := v_prod_razer, 
        p_quantity_change := 10::NUMERIC, 
        p_transaction_type := 'adjustment_in'::TEXT, 
        p_reference_id := NULL::UUID, 
        p_notes := 'Initial Stock'::TEXT
    );
    
    -- Add 200 units to Accessories
    PERFORM public.record_inventory_transaction(
        p_product_id := v_prod_mx_master, 
        p_quantity_change := 100::NUMERIC, 
        p_transaction_type := 'adjustment_in'::TEXT, 
        p_reference_id := NULL::UUID, 
        p_notes := 'Initial Stock'::TEXT
    );
    PERFORM public.record_inventory_transaction(
        p_product_id := v_prod_keychron, 
        p_quantity_change := 50::NUMERIC, 
        p_transaction_type := 'adjustment_in'::TEXT, 
        p_reference_id := NULL::UUID, 
        p_notes := 'Initial Stock'::TEXT
    );

    RAISE NOTICE '✅ Inventory Initialized';

    -- 5. VALIDATION
    IF (SELECT public.get_current_inventory(v_prod_dell)) = 50 THEN
        RAISE NOTICE '✅ Validation: Stock Levels Correct';
    ELSE
        RAISE WARNING '⚠️ Validation: Stock Levels Incorrect';
    END IF;

END $$;
