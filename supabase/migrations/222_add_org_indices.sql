
-- Migration: 222_add_org_indices.sql
-- Description: Adds indices to cards table to optimize Organization lookups.

BEGIN;

-- 1. Main Filter Index (Tenant + Type)
-- This is critical for WHERE tenant_id = X AND type = 'organization'
CREATE INDEX IF NOT EXISTS idx_cards_tenant_type_custom
    ON cards (tenant_id, type);

-- 2. Sorting Support (Updated At)
-- Helps with ORDER BY updated_at DESC which is default
CREATE INDEX IF NOT EXISTS idx_cards_org_sort_updated
    ON cards (tenant_id, type, updated_at DESC);

-- 3. Sorting Support (Name)
-- Helps with ORDER BY display_name ASC
CREATE INDEX IF NOT EXISTS idx_cards_org_sort_name
    ON cards (tenant_id, type, display_name ASC);

-- 4. Status Filtering
-- Helps with WHERE status = X
CREATE INDEX IF NOT EXISTS idx_cards_org_status
    ON cards (tenant_id, type, status);

-- Analyze to update query planner
ANALYZE cards;

COMMIT;
