-- Migration 245: Add order_type column to orders table
-- Purpose: Distinguish between quotes and regular orders

-- 1. Add order_type column
ALTER TABLE orders ADD COLUMN IF NOT EXISTS order_type TEXT DEFAULT 'order';

-- 2. Backfill existing rows
UPDATE orders SET order_type = 'order' WHERE order_type IS NULL;

-- 3. Make NOT NULL
ALTER TABLE orders ALTER COLUMN order_type SET NOT NULL;

-- 4. Add index for fast filtering by tenant + type
CREATE INDEX IF NOT EXISTS idx_orders_tenant_type ON orders(tenant_id, order_type);
