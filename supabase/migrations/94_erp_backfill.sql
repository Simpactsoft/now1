
-- Migration: 94_erp_backfill.sql
-- Description: Backfills profiles and hierarchy paths for existing data.
-- Phase 1.5 of the ERP Foundation Plan.

BEGIN;

-- 1. Backfill Profiles for ALL existing users in auth.users
-- This ensures that every user has a Profile and an Org Path.
INSERT INTO profiles (id, tenant_id, role, org_path, email)
SELECT 
    au.id,
    -- Attempt to find tenant from tenant_members table or use a fallback
    COALESCE(
        (SELECT tenant_id FROM tenant_members tm WHERE tm.user_id = au.id LIMIT 1),
        -- If not in tenant_members, try to grab ANY tenant (dev fallback)
        (SELECT id FROM tenants LIMIT 1),
        '00000000-0000-0000-0000-000000000000'::uuid
    ) as tenant_id,
    'agent'::app_role, -- Default everyone to agent
    text2ltree('root.' || replace(au.id::text, '-', '_')) as org_path,
    au.email
FROM auth.users au
ON CONFLICT (id) DO NOTHING;

-- 2. Update Cards Hierarchy Path
-- Now that profiles exist, we can stamp the cards with their owner's path.
UPDATE cards c
SET hierarchy_path = p.org_path
FROM profiles p
WHERE c.agent_id = p.id
AND c.hierarchy_path IS NULL;

-- 3. Fallback for cards without agent_id: Set to root
-- This ensures RLS policies won't hide them completely (assuming Root visibility).
UPDATE cards
SET hierarchy_path = text2ltree('root')
WHERE hierarchy_path IS NULL;

COMMIT;
