
-- Migration: 142_migrate_data.sql
-- Description: Step 2 of Production Migration.
-- Copies all data from legacy 'cards' to new partitioned 'cards_new'.
-- Strategy: Single INSERT statement (optimized by Postgres 14+ for partitioning).
-- Safety: 'ON CONFLICT DO NOTHING' allows restart ability.

BEGIN;

-- 1. Increase Timeout for this heavy operation
SET statement_timeout = '300000ms'; -- 5 Minutes

-- 2. Data Migration
-- We copy ALL columns. 
-- Note: 'hierarchy_path' was backfilled in previous migrations (129), so it should be populated.
-- We default fallback to 'org' if it's missing to satisfy NOT NULL.

INSERT INTO public.cards_new (
    id,
    tenant_id,
    type,
    hierarchy_path,
    agent_id,
    display_name,
    status,
    created_at,
    updated_at,
    contact_methods,
    custom_fields,
    tags
)
SELECT
    id,
    tenant_id,
    type,
    COALESCE(hierarchy_path, 'org'::ltree), -- Safety fallback
    agent_id,
    display_name,
    status,
    created_at,
    updated_at,
    contact_methods,
    custom_fields,
    tags
FROM public.cards
WHERE tenant_id IS NOT NULL -- Basic integrity check
ON CONFLICT (tenant_id, id) DO NOTHING;

-- 3. Analyze the new table to update statistics immediately
ANALYZE public.cards_new;

COMMIT;
