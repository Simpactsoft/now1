-- ============================================================================
-- Critical Performance Indexes
-- Migration: 20260218_critical_indexes
-- Date: 2026-02-18
-- Description: Adds critical composite indexes identified as RISK-03.
--              All indexes: (1) tenant_id FIRST (RULE-02), (2) created
--              CONCURRENTLY for zero-downtime, (3) IS NOT NULL guard
--              reminder on all RLS policies.
-- ============================================================================

-- NOTE: CONCURRENTLY cannot run inside a transaction block.
-- Each index is a separate statement.

-- ============================================================================
-- 1. ORDERS: Primary lookup index
-- ============================================================================
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_tenant_status_date
    ON orders(tenant_id, status, created_at DESC);

-- ============================================================================
-- 2. ORDER ITEMS: Join performance
-- ============================================================================
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_order_items_order
    ON order_items(order_id, product_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_order_items_tenant
    ON order_items(tenant_id, product_id);

-- ============================================================================
-- 3. PRODUCTS: Category + search
-- ============================================================================
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_products_tenant_category
    ON products(tenant_id, category_id, name);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_products_tenant_sku
    ON products(tenant_id, sku);

-- Note: products.is_active does not exist yet — add this index after the column is created
-- CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_products_tenant_active
--     ON products(tenant_id, is_active)
--     WHERE is_active = true;

-- ============================================================================
-- 4. CONFIGURATIONS: CPQ lookup
-- ============================================================================
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_configurations_tenant_status
    ON configurations(tenant_id, status);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_configurations_template
    ON configurations(tenant_id, template_id);

-- ============================================================================
-- 5. CARDS (CRM): Primary lookup
-- ============================================================================
-- Note: cards.card_type does not exist yet — add this index after the column is created
-- CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_cards_tenant_type
--     ON cards(tenant_id, card_type);

-- ============================================================================
-- 6. RLS IS NOT NULL GUARD AUDIT
-- ============================================================================
-- This is a verification query, not an action. Run manually:
--
-- SELECT schemaname, tablename, policyname, qual
-- FROM pg_policies
-- WHERE qual NOT LIKE '%IS NOT NULL%'
--   AND qual LIKE '%get_current_tenant_id()%';
--
-- Any rows returned = policies missing IS NOT NULL guard (RISK-01).
