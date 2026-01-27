-- Migration: 90_ensure_cards_indexes.sql
-- Description: Re-applies critical performance indexes to the 'cards' table to resolve timeouts.
-- Previous indexes on 'parties' might not have carried over optimally or need explicit re-definition for the new name.

BEGIN;

-- 1. Enable pg_trgm for fuzzy search (if not already)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 2. Base Filter Index (Tenant + Type) - The most common filter
CREATE INDEX IF NOT EXISTS idx_cards_tenant_type 
ON cards (tenant_id, type);

-- 3. Status Filter (Case-Insensitive)
-- Critical for 'Status' dropdown filtering
CREATE INDEX IF NOT EXISTS idx_cards_status_lower 
ON cards (lower(status));

-- 4. Search Filter (Fuzzy Match on Name)
-- Critical for 'Search' bar performance
CREATE INDEX IF NOT EXISTS idx_cards_display_name_trgm 
ON cards USING GIN (display_name gin_trgm_ops);

-- 5. Sorting Index (Created At)
CREATE INDEX IF NOT EXISTS idx_cards_created_at 
ON cards (created_at DESC);

-- 6. Composite for Dashboard Counts (Tenant + Type + Status)
CREATE INDEX IF NOT EXISTS idx_cards_tenant_type_status 
ON cards (tenant_id, type, status);

-- 7. Analyze to update query planner statistics immediately
ANALYZE cards;

COMMIT;
