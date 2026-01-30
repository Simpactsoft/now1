
-- Migration: 110_fix_performance_timeout.sql
-- Description: Adds composite indexes to resolve dashboard timeouts.
-- Addresses the "Default Sort" (Created At) and "Status Filter" bottlenecks.

BEGIN;

-- 1. The "Default View" Accelerator
-- Optimizes: SELECT * FROM cards WHERE tenant_id=X AND type='person' ORDER BY created_at DESC
-- This eliminates the need to sort 1.6M rows in memory.
CREATE INDEX IF NOT EXISTS idx_cards_tenant_type_created_at_desc 
ON cards (tenant_id, type, created_at DESC);

-- 2. The "Status Filter" Accelerator
-- Optimizes: SELECT ... WHERE tenant_id=X AND lower(status) = 'lead'
-- Replaces/Augments the previous `idx_cards_tenant_type_status` which didn't handle lower()
CREATE INDEX IF NOT EXISTS idx_cards_tenant_type_status_lower 
ON cards (tenant_id, type, lower(status));

-- 3. The "Tags" Accelerator (if array is used)
-- Optimizes: WHERE tags && ARRAY['x']
CREATE INDEX IF NOT EXISTS idx_cards_tags_gin 
ON cards USING GIN (tags);

-- 4. Update Statistics
-- Forces the query planner to recognize the new indexes immediately.
ANALYZE cards;

COMMIT;
