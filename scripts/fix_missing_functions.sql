-- ====================================================
-- FIX: FORCE RE-CREATION OF SALES FUNCTIONS
-- ====================================================

BEGIN;

-- 1. DROP EXISTING TO CLEAR CONFUSION
DROP FUNCTION IF EXISTS public.record_inventory_transaction(UUID, NUMERIC, TEXT, UUID, TEXT);
DROP FUNCTION IF EXISTS public.reserve_inventory(UUID, NUMERIC, UUID, INT);
DROP FUNCTION IF EXISTS public.get_available_to_promise(UUID);
DROP FUNCTION IF EXISTS public.get_current_inventory(UUID);

-- 2. CREATE FUNCTIONS EXPLICITLY IN PUBLIC

-- Get Current Inventory
CREATE OR REPLACE FUNCTION public.get_current_inventory(p_product_id UUID)
RETURNS NUMERIC
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
    SELECT COALESCE(SUM(quantity_change), 0)
    FROM inventory_ledger
    WHERE product_id = p_product_id
    AND tenant_id = get_current_tenant_id();
$$;

-- Get ATP
CREATE OR REPLACE FUNCTION public.get_available_to_promise(p_product_id UUID)
RETURNS NUMERIC
LANGUAGE plpgsql STABLE SECURITY DEFINER
AS $$
DECLARE
    v_on_hand NUMERIC;
    v_reserved NUMERIC;
BEGIN
    SELECT COALESCE(SUM(quantity_change), 0) INTO v_on_hand
    FROM inventory_ledger
    WHERE product_id = p_product_id
    AND tenant_id = get_current_tenant_id();

    SELECT COALESCE(SUM(quantity), 0) INTO v_reserved
    FROM inventory_reservations
    WHERE product_id = p_product_id
    AND tenant_id = get_current_tenant_id()
    AND expires_at > now();

    RETURN v_on_hand - v_reserved;
END;
$$;

-- Reserve Inventory
CREATE OR REPLACE FUNCTION public.reserve_inventory(
    p_product_id UUID,
    p_quantity NUMERIC,
    p_order_id UUID DEFAULT NULL,
    p_duration_minutes INT DEFAULT 15
)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
    v_atp NUMERIC;
    v_reservation_id UUID;
    v_tenant_id UUID;
BEGIN
    v_tenant_id := get_current_tenant_id();
    v_atp := public.get_available_to_promise(p_product_id);
    
    IF v_atp < p_quantity THEN
        RAISE EXCEPTION 'Insufficient inventory. Available: %, Requested: %', v_atp, p_quantity;
    END IF;

    INSERT INTO inventory_reservations (tenant_id, product_id, order_id, quantity, expires_at)
    VALUES (
        v_tenant_id,
        p_product_id,
        p_order_id,
        p_quantity,
        now() + (p_duration_minutes || ' minutes')::INTERVAL
    )
    RETURNING id INTO v_reservation_id;

    RETURN v_reservation_id;
END;
$$;

-- Record Transaction (THE MISSING FUNCTION)
CREATE OR REPLACE FUNCTION public.record_inventory_transaction(
    p_product_id UUID,
    p_quantity_change NUMERIC,
    p_transaction_type TEXT,
    p_reference_id UUID DEFAULT NULL,
    p_notes TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
    v_ledger_id UUID;
BEGIN
    INSERT INTO inventory_ledger (
        tenant_id,
        product_id,
        quantity_change,
        transaction_type,
        reference_id,
        notes
    )
    VALUES (
        get_current_tenant_id(),
        p_product_id,
        p_quantity_change,
        p_transaction_type,
        p_reference_id,
        p_notes
    )
    RETURNING id INTO v_ledger_id;

    RETURN v_ledger_id;
END;
$$;

COMMIT;
