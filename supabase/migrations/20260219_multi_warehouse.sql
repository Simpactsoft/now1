-- ============================================================================
-- Multi-Warehouse Inventory
-- Migration: 20260219_multi_warehouse
-- Date: 2026-02-19
-- Description: Warehouses table, warehouse transfers, ALTER inventory_balances
--              to support per-warehouse stock, RPCs for warehouse operations.
-- Dependencies: 007_add_sales_inventory_tables, 20260217_inventory_balances
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. WAREHOUSES TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS warehouses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    code TEXT NOT NULL,
    name TEXT NOT NULL,
    address TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    is_default BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE(tenant_id, code)
);

COMMENT ON TABLE warehouses IS 'Physical or logical warehouse locations for inventory tracking';

CREATE INDEX IF NOT EXISTS idx_warehouses_tenant ON warehouses(tenant_id);
CREATE INDEX IF NOT EXISTS idx_warehouses_default ON warehouses(tenant_id, is_default) WHERE is_default = true;

-- RLS
ALTER TABLE warehouses ENABLE ROW LEVEL SECURITY;

CREATE POLICY warehouses_select ON warehouses FOR SELECT TO authenticated
    USING (tenant_id = get_current_tenant_id() AND get_current_tenant_id() IS NOT NULL);
CREATE POLICY warehouses_all ON warehouses FOR ALL TO authenticated
    USING (tenant_id = get_current_tenant_id() AND get_current_tenant_id() IS NOT NULL)
    WITH CHECK (tenant_id = get_current_tenant_id() AND get_current_tenant_id() IS NOT NULL);

-- ============================================================================
-- 2. WAREHOUSE TRANSFERS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS warehouse_transfers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    transfer_number SERIAL,
    from_warehouse_id UUID NOT NULL REFERENCES warehouses(id),
    to_warehouse_id UUID NOT NULL REFERENCES warehouses(id),
    product_id UUID NOT NULL REFERENCES products(id),
    quantity NUMERIC(15, 4) NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'completed', 'cancelled')),
    notes TEXT,
    requested_by UUID,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CHECK (from_warehouse_id != to_warehouse_id),
    CHECK (quantity > 0)
);

COMMENT ON TABLE warehouse_transfers IS 'Track inventory transfers between warehouses';

CREATE INDEX IF NOT EXISTS idx_wh_transfers_tenant ON warehouse_transfers(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_wh_transfers_product ON warehouse_transfers(tenant_id, product_id);

-- RLS
ALTER TABLE warehouse_transfers ENABLE ROW LEVEL SECURITY;

CREATE POLICY wh_transfers_select ON warehouse_transfers FOR SELECT TO authenticated
    USING (tenant_id = get_current_tenant_id() AND get_current_tenant_id() IS NOT NULL);
CREATE POLICY wh_transfers_all ON warehouse_transfers FOR ALL TO authenticated
    USING (tenant_id = get_current_tenant_id() AND get_current_tenant_id() IS NOT NULL)
    WITH CHECK (tenant_id = get_current_tenant_id() AND get_current_tenant_id() IS NOT NULL);

-- ============================================================================
-- 3. ALTER INVENTORY_BALANCES — Add warehouse_id
-- ============================================================================
-- Strategy:
--  1. Add warehouse_id column (nullable initially)
--  2. Create a default warehouse for each tenant that has existing balances
--  3. Backfill warehouse_id with the default warehouse
--  4. Make warehouse_id NOT NULL
--  5. Drop old unique constraint, add new one with warehouse_id

-- 3a. Add column
ALTER TABLE inventory_balances
    ADD COLUMN IF NOT EXISTS warehouse_id UUID REFERENCES warehouses(id);

-- 3b. Create default warehouses for existing tenants with balances
DO $$
DECLARE
    v_tenant UUID;
    v_wh_id UUID;
BEGIN
    FOR v_tenant IN
        SELECT DISTINCT tenant_id FROM inventory_balances WHERE warehouse_id IS NULL
    LOOP
        -- Check if a default warehouse already exists
        SELECT id INTO v_wh_id FROM warehouses
        WHERE tenant_id = v_tenant AND is_default = true LIMIT 1;

        IF v_wh_id IS NULL THEN
            INSERT INTO warehouses (tenant_id, code, name, is_default)
            VALUES (v_tenant, 'MAIN', 'Main Warehouse', true)
            RETURNING id INTO v_wh_id;
        END IF;

        -- Backfill
        UPDATE inventory_balances
        SET warehouse_id = v_wh_id
        WHERE tenant_id = v_tenant AND warehouse_id IS NULL;
    END LOOP;
END;
$$;

-- 3c. Make NOT NULL
ALTER TABLE inventory_balances ALTER COLUMN warehouse_id SET NOT NULL;

-- 3d. Drop old unique, add new
ALTER TABLE inventory_balances DROP CONSTRAINT IF EXISTS inventory_balances_tenant_id_product_id_key;
ALTER TABLE inventory_balances ADD CONSTRAINT inventory_balances_tenant_product_warehouse_key
    UNIQUE (tenant_id, product_id, warehouse_id);

-- ============================================================================
-- 4. ALTER INVENTORY_LEDGER — Make warehouse_id NOT NULL
-- ============================================================================

-- 4a. Backfill existing NULL warehouse_id entries
DO $$
DECLARE
    v_tenant UUID;
    v_wh_id UUID;
BEGIN
    FOR v_tenant IN
        SELECT DISTINCT tenant_id FROM inventory_ledger WHERE warehouse_id IS NULL
    LOOP
        SELECT id INTO v_wh_id FROM warehouses
        WHERE tenant_id = v_tenant AND is_default = true LIMIT 1;

        IF v_wh_id IS NOT NULL THEN
            UPDATE inventory_ledger
            SET warehouse_id = v_wh_id
            WHERE tenant_id = v_tenant AND warehouse_id IS NULL;
        END IF;
    END LOOP;
END;
$$;

-- 4b. Make NOT NULL and add FK
ALTER TABLE inventory_ledger ALTER COLUMN warehouse_id SET NOT NULL;

-- Add FK if not exists (safe via DO block)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'inventory_ledger_warehouse_id_fkey'
        AND table_name = 'inventory_ledger'
    ) THEN
        ALTER TABLE inventory_ledger
        ADD CONSTRAINT inventory_ledger_warehouse_id_fkey
        FOREIGN KEY (warehouse_id) REFERENCES warehouses(id);
    END IF;
END;
$$;

-- ============================================================================
-- 5. UPDATE TRIGGER — Include warehouse_id in balance UPSERT
-- ============================================================================

CREATE OR REPLACE FUNCTION update_inventory_balance()
RETURNS TRIGGER LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO inventory_balances (tenant_id, product_id, warehouse_id, quantity_on_hand, last_movement_at)
    VALUES (NEW.tenant_id, NEW.product_id, NEW.warehouse_id, NEW.quantity_change, NOW())
    ON CONFLICT (tenant_id, product_id, warehouse_id)
    DO UPDATE SET
        quantity_on_hand = inventory_balances.quantity_on_hand + EXCLUDED.quantity_on_hand,
        last_movement_at = NOW(),
        updated_at = NOW();

    RETURN NEW;
END;
$$;

-- ============================================================================
-- 6. RPCs
-- ============================================================================

-- 6a. create_warehouse
CREATE OR REPLACE FUNCTION create_warehouse(
    p_tenant_id UUID,
    p_code TEXT,
    p_name TEXT,
    p_address TEXT DEFAULT NULL,
    p_is_default BOOLEAN DEFAULT false
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_id UUID;
    v_count INT;
BEGIN
    -- If making default, unset existing default
    IF p_is_default THEN
        UPDATE warehouses SET is_default = false
        WHERE tenant_id = p_tenant_id AND is_default = true;
    END IF;

    -- If this is the first warehouse, auto-set as default
    SELECT COUNT(*) INTO v_count FROM warehouses WHERE tenant_id = p_tenant_id;
    IF v_count = 0 THEN
        p_is_default := true;
    END IF;

    INSERT INTO warehouses (tenant_id, code, name, address, is_default)
    VALUES (p_tenant_id, p_code, p_name, p_address, p_is_default)
    RETURNING id INTO v_id;

    RETURN v_id;
END;
$$;

COMMENT ON FUNCTION create_warehouse IS 'Create a warehouse, optionally setting as default';

-- 6b. execute_warehouse_transfer
CREATE OR REPLACE FUNCTION execute_warehouse_transfer(
    p_transfer_id UUID,
    p_executed_by UUID DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_transfer warehouse_transfers%ROWTYPE;
    v_available NUMERIC;
BEGIN
    -- Get transfer
    SELECT * INTO v_transfer FROM warehouse_transfers WHERE id = p_transfer_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Transfer % not found', p_transfer_id;
    END IF;

    IF v_transfer.status != 'pending' THEN
        RAISE EXCEPTION 'Transfer % is not pending (status: %)', p_transfer_id, v_transfer.status;
    END IF;

    -- Check source warehouse has sufficient stock
    SELECT COALESCE(quantity_on_hand, 0) INTO v_available
    FROM inventory_balances
    WHERE tenant_id = v_transfer.tenant_id
      AND product_id = v_transfer.product_id
      AND warehouse_id = v_transfer.from_warehouse_id;

    IF v_available < v_transfer.quantity THEN
        RAISE EXCEPTION 'Insufficient stock: available % but requested %', v_available, v_transfer.quantity;
    END IF;

    -- Deduct from source (negative ledger entry)
    INSERT INTO inventory_ledger (tenant_id, product_id, warehouse_id, transaction_type, quantity_change, reference_id, notes)
    VALUES (v_transfer.tenant_id, v_transfer.product_id, v_transfer.from_warehouse_id, 'transfer_out',
            -v_transfer.quantity, p_transfer_id, 'Transfer to ' || v_transfer.to_warehouse_id);

    -- Add to destination (positive ledger entry)
    INSERT INTO inventory_ledger (tenant_id, product_id, warehouse_id, transaction_type, quantity_change, reference_id, notes)
    VALUES (v_transfer.tenant_id, v_transfer.product_id, v_transfer.to_warehouse_id, 'transfer_in',
            v_transfer.quantity, p_transfer_id, 'Transfer from ' || v_transfer.from_warehouse_id);

    -- Mark completed
    UPDATE warehouse_transfers
    SET status = 'completed',
        completed_at = NOW()
    WHERE id = p_transfer_id;

    RETURN TRUE;
END;
$$;

COMMENT ON FUNCTION execute_warehouse_transfer IS 'Atomically moves stock between warehouses via ledger entries';

-- 6c. get_warehouse_stock
CREATE OR REPLACE FUNCTION get_warehouse_stock(
    p_tenant_id UUID,
    p_warehouse_id UUID
)
RETURNS TABLE (
    product_id UUID,
    sku TEXT,
    product_name TEXT,
    quantity_on_hand NUMERIC,
    quantity_reserved NUMERIC,
    quantity_available NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT
        p.id,
        p.sku,
        p.name,
        ib.quantity_on_hand,
        ib.quantity_reserved,
        ib.quantity_available
    FROM inventory_balances ib
        JOIN products p ON p.id = ib.product_id
    WHERE ib.tenant_id = p_tenant_id
      AND ib.warehouse_id = p_warehouse_id
    ORDER BY p.sku;
END;
$$;

COMMENT ON FUNCTION get_warehouse_stock IS 'Returns stock levels for all products in a specific warehouse';

-- ============================================================================
-- 7. updated_at trigger for warehouses
-- ============================================================================

CREATE OR REPLACE FUNCTION update_warehouses_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_warehouses_updated_at ON warehouses;
CREATE TRIGGER trg_warehouses_updated_at
    BEFORE UPDATE ON warehouses
    FOR EACH ROW EXECUTE FUNCTION update_warehouses_updated_at();

COMMIT;
