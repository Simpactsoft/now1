
-- Migration: 94_optimization_and_backfill.sql
-- Description: Optimizes and backfills data. 
-- Fixes timeouts by adding missing index before update.

BEGIN;

-- 0. CRITICAL OPTIMIZATION: Index on agent_id
-- This was likely missing and causing the update to be slow (Timeout).
CREATE INDEX IF NOT EXISTS idx_cards_agent_id ON cards(agent_id);

-- 1. Backfill Profiles (Fast)
INSERT INTO profiles (id, tenant_id, role, org_path, email)
SELECT 
    au.id,
    COALESCE(
        (SELECT tenant_id FROM tenant_members tm WHERE tm.user_id = au.id LIMIT 1),
        (SELECT id FROM tenants LIMIT 1), -- Fallback
        '00000000-0000-0000-0000-000000000000'::uuid
    ) as tenant_id,
    'agent'::app_role,
    text2ltree('root.' || replace(au.id::text, '-', '_')) as org_path,
    au.email
FROM auth.users au
ON CONFLICT (id) DO NOTHING;

-- 2. Update Cards Hierarchy Path (Now optimized with index)
-- We use a single batch update. If this still times out, we will need to batch it manually.
UPDATE cards c
SET hierarchy_path = p.org_path
FROM profiles p
WHERE c.agent_id = p.id
AND c.hierarchy_path IS NULL;

-- 3. Fallback for orphans
UPDATE cards
SET hierarchy_path = text2ltree('root')
WHERE hierarchy_path IS NULL;

COMMIT;
