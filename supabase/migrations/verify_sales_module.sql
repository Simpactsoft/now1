-- ====================================================
-- V3 SALES & INVENTORY MODULE VERIFICATION SCRIPT
-- ====================================================

DO $$
DECLARE
    v_tenant_id UUID;
    v_supplier_id UUID;
    v_cat_root_id UUID;
    v_product_id UUID;
    v_ledger_id UUID;
BEGIN
    -- 1. SETUP: Get Valid Context
    SELECT id INTO v_tenant_id FROM tenants LIMIT 1;
    IF v_tenant_id IS NULL THEN RAISE EXCEPTION 'No tenants found'; END IF;
    
    PERFORM set_config('app.current_tenant', v_tenant_id::text, false);
    
    SELECT id INTO v_supplier_id FROM cards WHERE tenant_id = v_tenant_id LIMIT 1;
    IF v_supplier_id IS NULL THEN 
        RAISE NOTICE '⚠️ No supplier found in cards table. Skipping integration test, but checking schema...';
    END IF;

    RAISE NOTICE 'Context Set: Tenant %', v_tenant_id;

    -- 2. TEST: Product Categories (Recursive ltree)
    INSERT INTO product_categories (tenant_id, name, parent_id)
    VALUES (v_tenant_id, 'Test Root', NULL)
    RETURNING id INTO v_cat_root_id;

    IF EXISTS (SELECT 1 FROM product_categories WHERE id = v_cat_root_id AND path = ('root.' || replace(v_cat_root_id::text, '-', '_'))::ltree) THEN
        RAISE NOTICE '✅ Category Tree: Root Path Correct';
    ELSE
        RAISE EXCEPTION '❌ Category Tree: Path Trigger Failed';
    END IF;

    -- 3. TEST: Product Creation (Integration with V2 Card)
    IF v_supplier_id IS NOT NULL THEN
        INSERT INTO products (tenant_id, supplier_id, category_id, sku, name, cost_price)
        VALUES (v_tenant_id, v_supplier_id, v_cat_root_id, 'TEST-SKU-999', 'Integration Test Product', 50.00)
        RETURNING id INTO v_product_id;

        RAISE NOTICE '✅ Product Creation: Success (Linked to Supplier %) ', v_supplier_id;
    END IF;

    -- 4. TEST: Inventory Ledger (Double Entry)
    IF v_product_id IS NOT NULL THEN
        v_ledger_id := record_inventory_transaction(v_product_id, 100, 'purchase', NULL, 'Initial Stock');
        
        IF (SELECT get_current_inventory(v_product_id)) = 100 THEN
            RAISE NOTICE '✅ Ledger: Balance Calculation Correct (100)';
        ELSE
            RAISE EXCEPTION '❌ Ledger: Balance Mismatch';
        END IF;

        -- Reserve 10 units
        PERFORM reserve_inventory(v_product_id, 10);
        
        -- Check ATP (Should be 90)
        IF (SELECT get_available_to_promise(v_product_id)) = 90 THEN
             RAISE NOTICE '✅ ATP: Calculation Correct (100 - 10 = 90)';
        ELSE
             RAISE EXCEPTION '❌ ATP: Calculation Failed';
        END IF;
    END IF;

    -- 5. CLEANUP (Strict Order)
    DELETE FROM inventory_reservations WHERE product_id = v_product_id;
    DELETE FROM inventory_ledger WHERE product_id = v_product_id;
    DELETE FROM products WHERE id = v_product_id;
    DELETE FROM product_categories WHERE id = v_cat_root_id;

    RAISE NOTICE '✅ Verification Complete: All Systems Normal';
END $$;
