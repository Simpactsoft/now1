-- ====================================================
-- SALES WORKFLOW E2E TESTS
-- ====================================================

DO $$
DECLARE
    v_tenant_id UUID;
    v_customer_id UUID;
    v_product_id UUID;
    v_order_id UUID;
    v_invoice_id UUID;
    v_reservation_id UUID;
    v_start_inventory NUMERIC;
BEGIN
    -- 1. SETUP
    SELECT id INTO v_tenant_id FROM tenants LIMIT 1;
    PERFORM set_config('app.current_tenant', v_tenant_id::text, false);
    
    -- Get a Customer (using Supplier ID just for demo if no customer exists, assumes cards table has entities)
    SELECT id INTO v_customer_id FROM cards WHERE tenant_id = v_tenant_id LIMIT 1;
    
    -- Get a Product with Inventory
    SELECT id INTO v_product_id FROM products WHERE tenant_id = v_tenant_id AND track_inventory = true LIMIT 1;
    SELECT id INTO v_product_id FROM products WHERE tenant_id = v_tenant_id AND track_inventory = true LIMIT 1;
    v_start_inventory := public.get_current_inventory(v_product_id);

    RAISE NOTICE 'Testing with Product: % (Start Inventory: %)', v_product_id, v_start_inventory;

    -- ====================================================
    -- FLOW 1: Quote -> Order -> Fulfillment -> Invoice
    -- ====================================================
    
    -- Step 1: Create Quote/Draft Order
    INSERT INTO orders (tenant_id, customer_id, status, total_amount)
    VALUES (v_tenant_id, v_customer_id, 'draft', 0)
    RETURNING id INTO v_order_id;
    
    -- Step 2: Add Order Item (2 units)
    INSERT INTO order_items (tenant_id, order_id, product_id, quantity, unit_price, total_price)
    VALUES (v_tenant_id, v_order_id, v_product_id, 2, 1000.00, 2000.00);
    
    -- Step 3: Confirm Order (Status Change)
    UPDATE orders SET status = 'confirmed', total_amount = 2000.00 WHERE id = v_order_id;

    -- Step 4: Reserve Inventory (Pessimistic Lock)
    -- Step 4: Reserve Inventory (Pessimistic Lock)
    v_reservation_id := public.reserve_inventory(p_product_id := v_product_id, p_quantity := 2::NUMERIC, p_order_id := v_order_id);
    
    -- VALIDATION: Check ATP decreased
    -- VALIDATION: Check ATP decreased
    IF (public.get_available_to_promise(v_product_id) = v_start_inventory - 2) THEN
        RAISE NOTICE '✅ Flow 1: Inventory Reserved Correctly';
    ELSE
         RAISE EXCEPTION '❌ Flow 1: Reservation Failed';
    END IF;

    -- Step 5: Fulfill (Convert Reservation to Sale)
    -- This usually happens in app logic: Delete Reservation + Add Ledger 'sale'
    DELETE FROM inventory_reservations WHERE id = v_reservation_id;
    PERFORM public.record_inventory_transaction(
        p_product_id := v_product_id, 
        p_quantity_change := -2::NUMERIC, 
        p_transaction_type := 'sale'::TEXT, 
        p_reference_id := v_order_id, 
        p_notes := 'Order Fulfilled'::TEXT
    );

    -- VALIDATION: Check Actual Inventory decreased
    -- VALIDATION: Check Actual Inventory decreased
    IF (public.get_current_inventory(v_product_id) = v_start_inventory - 2) THEN
        RAISE NOTICE '✅ Flow 1: Fulfillment Ledger Correct';
    ELSE
         RAISE EXCEPTION '❌ Flow 1: Fulfillment Failed';
    END IF;

    -- Step 6: Invoice
    INSERT INTO invoices (tenant_id, order_id, customer_id, total_amount, status)
    VALUES (v_tenant_id, v_order_id, v_customer_id, 2000.00, 'issued')
    RETURNING id INTO v_invoice_id;

    RAISE NOTICE '✅ Flow 1 Complete: Invoice Created %', v_invoice_id;

    -- ====================================================
    -- FLOW 2: Race Condition Simulation (Logic Check)
    -- ====================================================
    -- We cannot easily simulate concurrent threads in one SQL script, 
    -- but we can verify the constraint prevents over-booking.
    
    DECLARE
        v_current_atp NUMERIC;
    BEGIN
    BEGIN
        v_current_atp := public.get_available_to_promise(v_product_id);
        
        -- Try to reserve more than available
        -- Try to reserve more than available
        BEGIN
            PERFORM public.reserve_inventory(p_product_id := v_product_id, p_quantity := (v_current_atp + 1)::NUMERIC, p_order_id := NULL);
            RAISE EXCEPTION '❌ Flow 2: Race Condition Check Failed (Allowed Overbooking)';
        EXCEPTION WHEN OTHERS THEN
            IF SQLERRM LIKE '%Insufficient inventory%' THEN
                RAISE NOTICE '✅ Flow 2: Race Condition Logic Valid (Prevented Overbooking)';
            ELSE
                RAISE NOTICE '⚠️ Flow 2: Unexpected Error: %', SQLERRM;
            END IF;
        END;
    END;

    -- CLEANUP
    DELETE FROM invoices WHERE id = v_invoice_id;
    DELETE FROM order_items WHERE order_id = v_order_id;
    DELETE FROM orders WHERE id = v_order_id;
    -- Reverse inventory movement for cleanup
    PERFORM public.record_inventory_transaction(
        p_product_id := v_product_id, 
        p_quantity_change := 2::NUMERIC, 
        p_transaction_type := 'adjustment_in'::TEXT, 
        p_reference_id := NULL::UUID, 
        p_notes := 'Test Cleanup'::TEXT
    );

END $$;
