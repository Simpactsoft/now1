-- ============================================================================
-- Price Lists System
-- Migration: 20260220_price_lists
-- Date: 2026-02-19
-- Description: Customer-specific and time-bounded pricing. Supports multiple
--              price lists with priority resolution per customer.
-- Dependencies: products (007), cards (004), tenants
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. PRICE LISTS TABLE
-- ============================================================================
-- Named pricing tiers: "Retail", "VIP", "Wholesale", "Partner", etc.
-- Each can be currency-specific and have a validity window.

CREATE TABLE IF NOT EXISTS price_lists (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    currency CHAR(3) NOT NULL DEFAULT 'ILS',
    priority INT NOT NULL DEFAULT 0,  -- Higher = wins over lower priority lists
    is_active BOOLEAN NOT NULL DEFAULT true,
    valid_from DATE,
    valid_to DATE,
    created_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE(tenant_id, name),
    CHECK (valid_to IS NULL OR valid_from IS NULL OR valid_to >= valid_from)
);

COMMENT ON TABLE price_lists IS 'Named pricing tiers with priority and optional date range';
COMMENT ON COLUMN price_lists.priority IS 'Higher number wins when multiple lists apply to same customer';

-- ============================================================================
-- 2. PRICE LIST ITEMS TABLE
-- ============================================================================
-- Per-product price override within a price list.

CREATE TABLE IF NOT EXISTS price_list_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    price_list_id UUID NOT NULL REFERENCES price_lists(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    unit_price NUMERIC(15, 4) NOT NULL,
    min_quantity NUMERIC(15, 4) DEFAULT 1,  -- Quantity break pricing
    max_quantity NUMERIC(15, 4),
    discount_percent NUMERIC(5, 2) DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE(tenant_id, price_list_id, product_id, min_quantity)
);

COMMENT ON TABLE price_list_items IS 'Per-product pricing within a price list (supports quantity breaks)';

-- ============================================================================
-- 3. CUSTOMER PRICE LIST ASSIGNMENT
-- ============================================================================
-- Links customers (cards) to price lists. A customer can have multiple lists.

CREATE TABLE IF NOT EXISTS customer_price_list (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    customer_id UUID NOT NULL,
    price_list_id UUID NOT NULL REFERENCES price_lists(id) ON DELETE CASCADE,
    FOREIGN KEY (tenant_id, customer_id) REFERENCES cards(tenant_id, id) ON DELETE CASCADE,
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE(tenant_id, customer_id, price_list_id)
);

COMMENT ON TABLE customer_price_list IS 'M:N assignment of customers to price lists';

-- ============================================================================
-- 4. INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_price_lists_tenant_active
    ON price_lists(tenant_id, is_active, priority DESC);

CREATE INDEX IF NOT EXISTS idx_price_lists_tenant_dates
    ON price_lists(tenant_id, valid_from, valid_to)
    WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_price_list_items_lookup
    ON price_list_items(tenant_id, price_list_id, product_id);

CREATE INDEX IF NOT EXISTS idx_price_list_items_product
    ON price_list_items(tenant_id, product_id);

CREATE INDEX IF NOT EXISTS idx_customer_price_list_customer
    ON customer_price_list(tenant_id, customer_id);

CREATE INDEX IF NOT EXISTS idx_customer_price_list_list
    ON customer_price_list(tenant_id, price_list_id);

-- ============================================================================
-- 5. ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE price_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE price_list_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_price_list ENABLE ROW LEVEL SECURITY;

-- price_lists
DROP POLICY IF EXISTS price_lists_select ON price_lists;
DROP POLICY IF EXISTS price_lists_insert ON price_lists;
DROP POLICY IF EXISTS price_lists_update ON price_lists;
DROP POLICY IF EXISTS price_lists_delete ON price_lists;

CREATE POLICY price_lists_select ON price_lists FOR SELECT TO authenticated
    USING (tenant_id = get_current_tenant_id() AND get_current_tenant_id() IS NOT NULL);
CREATE POLICY price_lists_insert ON price_lists FOR INSERT TO authenticated
    WITH CHECK (tenant_id = get_current_tenant_id() AND get_current_tenant_id() IS NOT NULL);
CREATE POLICY price_lists_update ON price_lists FOR UPDATE TO authenticated
    USING (tenant_id = get_current_tenant_id() AND get_current_tenant_id() IS NOT NULL)
    WITH CHECK (tenant_id = get_current_tenant_id() AND get_current_tenant_id() IS NOT NULL);
CREATE POLICY price_lists_delete ON price_lists FOR DELETE TO authenticated
    USING (tenant_id = get_current_tenant_id() AND get_current_tenant_id() IS NOT NULL);

-- price_list_items
DROP POLICY IF EXISTS price_list_items_select ON price_list_items;
DROP POLICY IF EXISTS price_list_items_insert ON price_list_items;
DROP POLICY IF EXISTS price_list_items_update ON price_list_items;
DROP POLICY IF EXISTS price_list_items_delete ON price_list_items;

CREATE POLICY price_list_items_select ON price_list_items FOR SELECT TO authenticated
    USING (tenant_id = get_current_tenant_id() AND get_current_tenant_id() IS NOT NULL);
CREATE POLICY price_list_items_insert ON price_list_items FOR INSERT TO authenticated
    WITH CHECK (tenant_id = get_current_tenant_id() AND get_current_tenant_id() IS NOT NULL);
CREATE POLICY price_list_items_update ON price_list_items FOR UPDATE TO authenticated
    USING (tenant_id = get_current_tenant_id() AND get_current_tenant_id() IS NOT NULL)
    WITH CHECK (tenant_id = get_current_tenant_id() AND get_current_tenant_id() IS NOT NULL);
CREATE POLICY price_list_items_delete ON price_list_items FOR DELETE TO authenticated
    USING (tenant_id = get_current_tenant_id() AND get_current_tenant_id() IS NOT NULL);

-- customer_price_list
DROP POLICY IF EXISTS customer_price_list_select ON customer_price_list;
DROP POLICY IF EXISTS customer_price_list_insert ON customer_price_list;
DROP POLICY IF EXISTS customer_price_list_update ON customer_price_list;
DROP POLICY IF EXISTS customer_price_list_delete ON customer_price_list;

CREATE POLICY customer_price_list_select ON customer_price_list FOR SELECT TO authenticated
    USING (tenant_id = get_current_tenant_id() AND get_current_tenant_id() IS NOT NULL);
CREATE POLICY customer_price_list_insert ON customer_price_list FOR INSERT TO authenticated
    WITH CHECK (tenant_id = get_current_tenant_id() AND get_current_tenant_id() IS NOT NULL);
CREATE POLICY customer_price_list_update ON customer_price_list FOR UPDATE TO authenticated
    USING (tenant_id = get_current_tenant_id() AND get_current_tenant_id() IS NOT NULL)
    WITH CHECK (tenant_id = get_current_tenant_id() AND get_current_tenant_id() IS NOT NULL);
CREATE POLICY customer_price_list_delete ON customer_price_list FOR DELETE TO authenticated
    USING (tenant_id = get_current_tenant_id() AND get_current_tenant_id() IS NOT NULL);

-- ============================================================================
-- 6. get_effective_price() RPC
-- ============================================================================
-- Resolves the best price for a product+customer combination.
-- Priority:
--   1. Customer-specific price list (highest priority wins)
--   2. General active price list (highest priority, within date range)
--   3. Fallback: products.list_price

CREATE OR REPLACE FUNCTION get_effective_price(
    p_tenant_id UUID,
    p_product_id UUID,
    p_customer_id UUID DEFAULT NULL,
    p_quantity NUMERIC DEFAULT 1,
    p_date DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE (
    effective_price NUMERIC(15, 4),
    price_list_id UUID,
    price_list_name TEXT,
    price_source TEXT  -- 'customer_list', 'general_list', 'base_price'
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_price RECORD;
BEGIN
    -- Strategy 1: Customer-assigned price lists (highest priority first)
    IF p_customer_id IS NOT NULL THEN
        SELECT
            pli.unit_price,
            pl.id AS list_id,
            pl.name AS list_name
        INTO v_price
        FROM customer_price_list cpl
            JOIN price_lists pl ON pl.id = cpl.price_list_id
            JOIN price_list_items pli ON pli.price_list_id = pl.id
                AND pli.product_id = p_product_id
                AND pli.tenant_id = p_tenant_id
        WHERE cpl.tenant_id = p_tenant_id
          AND cpl.customer_id = p_customer_id
          AND pl.is_active = true
          AND (pl.valid_from IS NULL OR pl.valid_from <= p_date)
          AND (pl.valid_to IS NULL OR pl.valid_to >= p_date)
          AND pli.min_quantity <= p_quantity
          AND (pli.max_quantity IS NULL OR pli.max_quantity >= p_quantity)
        ORDER BY pl.priority DESC, pli.min_quantity DESC
        LIMIT 1;

        IF FOUND THEN
            RETURN QUERY SELECT v_price.unit_price, v_price.list_id, v_price.list_name, 'customer_list'::TEXT;
            RETURN;
        END IF;
    END IF;

    -- Strategy 2: General price lists (not customer-specific)
    SELECT
        pli.unit_price,
        pl.id AS list_id,
        pl.name AS list_name
    INTO v_price
    FROM price_lists pl
        JOIN price_list_items pli ON pli.price_list_id = pl.id
            AND pli.product_id = p_product_id
            AND pli.tenant_id = p_tenant_id
    WHERE pl.tenant_id = p_tenant_id
      AND pl.is_active = true
      AND (pl.valid_from IS NULL OR pl.valid_from <= p_date)
      AND (pl.valid_to IS NULL OR pl.valid_to >= p_date)
      AND pli.min_quantity <= p_quantity
      AND (pli.max_quantity IS NULL OR pli.max_quantity >= p_quantity)
      -- Exclude lists that are assigned to specific customers only
      AND NOT EXISTS (
          SELECT 1 FROM customer_price_list cpl2
          WHERE cpl2.price_list_id = pl.id AND cpl2.tenant_id = p_tenant_id
      )
    ORDER BY pl.priority DESC, pli.min_quantity DESC
    LIMIT 1;

    IF FOUND THEN
        RETURN QUERY SELECT v_price.unit_price, v_price.list_id, v_price.list_name, 'general_list'::TEXT;
        RETURN;
    END IF;

    -- Strategy 3: Fallback to product base price
    RETURN QUERY
    SELECT
        p.list_price::NUMERIC(15,4),
        NULL::UUID,
        'Base Price'::TEXT,
        'base_price'::TEXT
    FROM products p
    WHERE p.id = p_product_id
      AND p.tenant_id = p_tenant_id;
END;
$$;

COMMENT ON FUNCTION get_effective_price IS 'Resolves best price: customer list → general list → base price';

-- ============================================================================
-- 7. update_at trigger
-- ============================================================================

CREATE OR REPLACE FUNCTION update_price_list_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_price_lists_updated_at ON price_lists;
CREATE TRIGGER trg_price_lists_updated_at
    BEFORE UPDATE ON price_lists
    FOR EACH ROW EXECUTE FUNCTION update_price_list_updated_at();

DROP TRIGGER IF EXISTS trg_price_list_items_updated_at ON price_list_items;
CREATE TRIGGER trg_price_list_items_updated_at
    BEFORE UPDATE ON price_list_items
    FOR EACH ROW EXECUTE FUNCTION update_price_list_updated_at();

COMMIT;
