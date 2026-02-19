-- ============================================================================
-- Inventory Balances Materialized View
-- Migration: 20260217_inventory_balances
-- Date: 2026-02-17
-- Description: Creates inventory_balances table as a materialized summary of
--              inventory_ledger, updated by trigger on INSERT. Replaces slow
--              SUM() queries with O(1) balance lookups.
-- Dependencies: products, inventory_ledger (migration 007)
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. INVENTORY BALANCES TABLE
-- ============================================================================
-- Purpose: Pre-computed stock balances per product per tenant.
-- Updated by trigger on inventory_ledger INSERT, so always in sync.

CREATE TABLE IF NOT EXISTS inventory_balances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    quantity_on_hand NUMERIC(15, 4) NOT NULL DEFAULT 0,
    quantity_reserved NUMERIC(15, 4) NOT NULL DEFAULT 0,
    quantity_available NUMERIC(15, 4) GENERATED ALWAYS AS
        (quantity_on_hand - quantity_reserved) STORED,
    last_movement_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE(tenant_id, product_id)
);

COMMENT ON TABLE inventory_balances IS 'Pre-computed stock balances, updated by ledger trigger';
COMMENT ON COLUMN inventory_balances.quantity_available IS 'Auto-computed: on_hand - reserved';

-- ============================================================================
-- 2. INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_inventory_balances_tenant
    ON inventory_balances(tenant_id);

CREATE INDEX IF NOT EXISTS idx_inventory_balances_product
    ON inventory_balances(tenant_id, product_id);

CREATE INDEX IF NOT EXISTS idx_inventory_balances_low_stock
    ON inventory_balances(tenant_id, quantity_on_hand)
    WHERE quantity_on_hand <= 0;

-- ============================================================================
-- 3. ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE inventory_balances ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS inventory_balances_select ON inventory_balances;
DROP POLICY IF EXISTS inventory_balances_all ON inventory_balances;

CREATE POLICY inventory_balances_select ON inventory_balances
    FOR SELECT TO authenticated
    USING (tenant_id = get_current_tenant_id() AND get_current_tenant_id() IS NOT NULL);

CREATE POLICY inventory_balances_all ON inventory_balances
    FOR ALL TO authenticated
    USING (tenant_id = get_current_tenant_id() AND get_current_tenant_id() IS NOT NULL)
    WITH CHECK (tenant_id = get_current_tenant_id() AND get_current_tenant_id() IS NOT NULL);

-- ============================================================================
-- 4. TRIGGER: Update balance on ledger INSERT
-- ============================================================================
-- Every inventory_ledger INSERT adjusts the corresponding balance.
-- Uses UPSERT (INSERT ... ON CONFLICT ... UPDATE) to auto-create rows.

CREATE OR REPLACE FUNCTION update_inventory_balance()
RETURNS TRIGGER LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO inventory_balances (tenant_id, product_id, quantity_on_hand, last_movement_at)
    VALUES (NEW.tenant_id, NEW.product_id, NEW.quantity_change, NOW())
    ON CONFLICT (tenant_id, product_id)
    DO UPDATE SET
        quantity_on_hand = inventory_balances.quantity_on_hand + EXCLUDED.quantity_on_hand,
        last_movement_at = NOW(),
        updated_at = NOW();

    RETURN NEW;
END;
$$;

-- Only apply if inventory_ledger exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'inventory_ledger') THEN
        -- Drop and recreate to be safe
        DROP TRIGGER IF EXISTS trg_inventory_balance_update ON inventory_ledger;
        CREATE TRIGGER trg_inventory_balance_update
            AFTER INSERT ON inventory_ledger
            FOR EACH ROW EXECUTE FUNCTION update_inventory_balance();
        RAISE NOTICE 'Inventory balance trigger created on inventory_ledger';
    ELSE
        RAISE NOTICE 'inventory_ledger table not found — trigger not created';
    END IF;
END;
$$;

-- ============================================================================
-- 5. BACKFILL existing balances from ledger
-- ============================================================================
-- Run once to populate balances from existing ledger data.
-- Safe to re-run (ON CONFLICT handles duplicates).

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'inventory_ledger') THEN
        INSERT INTO inventory_balances (tenant_id, product_id, quantity_on_hand, last_movement_at)
        SELECT
            tenant_id,
            product_id,
            SUM(quantity_change) AS quantity_on_hand,
            MAX(created_at) AS last_movement_at
        FROM inventory_ledger
        GROUP BY tenant_id, product_id
        ON CONFLICT (tenant_id, product_id)
        DO UPDATE SET
            quantity_on_hand = EXCLUDED.quantity_on_hand,
            last_movement_at = EXCLUDED.last_movement_at,
            updated_at = NOW();
        RAISE NOTICE 'Inventory balances backfilled from ledger';
    END IF;
END;
$$;

COMMIT;
