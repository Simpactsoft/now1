-- Phase 10: RPC for Client-Side Chunked Cleanup
-- This function allows an external script to drive the cleanup process in small, safe batches to avoid timeouts.

CREATE OR REPLACE FUNCTION cleanup_legacy_party_batch(arg_batch_size INTEGER)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET statement_timeout = '60s'
AS $$
DECLARE
    v_deleted_count INTEGER;
BEGIN
    -- Delete a batch of persons who have NO membership records
    -- Using the optimized EXISTS and LIMIT within subquery pattern
    DELETE FROM parties p
    WHERE p.id IN (
        SELECT id
        FROM parties
        WHERE type = 'person'
        AND NOT EXISTS (SELECT 1 FROM party_memberships m WHERE m.person_id = parties.id)
        LIMIT arg_batch_size
    )
    AND p.type = 'person'; -- Redundant safety check

    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;

    -- If no legacy persons found, try to clean up O_ prefixed records (legacy schema remnants)
    IF v_deleted_count = 0 THEN
        DELETE FROM parties
        WHERE id IN (
             SELECT id
             FROM parties
             WHERE display_name LIKE 'O_%'
             LIMIT arg_batch_size
        );
        GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
    END IF;

    RETURN v_deleted_count;
END;
$$;
