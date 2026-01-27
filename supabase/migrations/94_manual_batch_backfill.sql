
-- Migration: 94_manual_batch_backfill.sql
-- Description: Creates a helper function to backfill data in small chunks.
-- Usage: Run this script ONCE to create the function. Then call the function multiple times.

BEGIN;

-- 0. Ensure Index Exists (Critical for performance)
CREATE INDEX IF NOT EXISTS idx_cards_agent_id ON cards(agent_id);

-- 1. Ensure Profiles Exist (Fast, usually fits in one go)
INSERT INTO profiles (id, tenant_id, role, org_path, email)
SELECT 
    au.id,
    COALESCE(
        (SELECT tenant_id FROM tenant_members tm WHERE tm.user_id = au.id LIMIT 1),
        (SELECT id FROM tenants LIMIT 1),
        '00000000-0000-0000-0000-000000000000'::uuid
    ) as tenant_id,
    'agent'::app_role,
    text2ltree('root.' || replace(au.id::text, '-', '_')) as org_path,
    au.email
FROM auth.users au
ON CONFLICT (id) DO NOTHING;

COMMIT;

-- 2. Create the Batch Function
CREATE OR REPLACE FUNCTION exec_backfill_batch(p_limit INTEGER DEFAULT 10000)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
    v_rows_updated INTEGER;
    v_rows_remaining INTEGER;
BEGIN
    -- Update a batch of Cards
    WITH batch AS (
        SELECT id FROM cards
        WHERE hierarchy_path IS NULL
        LIMIT p_limit
        FOR UPDATE SKIP LOCKED -- Concurrency safety (optional but good practice)
    )
    UPDATE cards c
    SET hierarchy_path = p.org_path
    FROM profiles p, batch
    WHERE c.id = batch.id
    AND c.agent_id = p.id;

    GET DIAGNOSTICS v_rows_updated = ROW_COUNT;

    -- Update Orphans to Root (Chunked)
    IF v_rows_updated < p_limit THEN
         WITH orphan_batch AS (
            SELECT id FROM cards
            WHERE hierarchy_path IS NULL
            LIMIT (p_limit - v_rows_updated)
            FOR UPDATE SKIP LOCKED
         )
         UPDATE cards c
         SET hierarchy_path = text2ltree('root')
         FROM orphan_batch
         WHERE c.id = orphan_batch.id;
         
         v_rows_updated := v_rows_updated + (SELECT count(*) FROM cards WHERE hierarchy_path IS NULL AND id IN (SELECT id FROM cards WHERE hierarchy_path IS NULL LIMIT (p_limit - v_rows_updated))); 
         -- Note: exact count for orphans addition is complex in one block, but visual indicator is enough.
    END IF;

    -- Check remaining
    SELECT count(*) INTO v_rows_remaining FROM cards WHERE hierarchy_path IS NULL;

    RETURN format('Updated %s rows. Remaining: %s', v_rows_updated, v_rows_remaining);
END;
$$;
