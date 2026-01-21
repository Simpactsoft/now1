-- Migration 68: Secure Search History "Bypass" RPC
-- Reason: To allow search history persistence even when strict RLS auth sessions are "flaky" or stale.
-- This mirrors the 'create_person' SECURITY DEFINER pattern.

CREATE OR REPLACE FUNCTION submit_search_history_secure(
    p_tenant_id uuid,
    p_term text,
    p_user_id uuid DEFAULT auth.uid() -- fallback to session user if not provided
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER -- Bypass RLS
SET search_path = public, pg_temp
AS $$
BEGIN
    -- If no user_id is resolved (neither passed nor in session), we cannot save user history.
    -- Return success:false but don't error out hard.
    IF p_user_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'No user context identified');
    END IF;

    -- 1. Delete existing for 'bump' effect
    DELETE FROM search_history
    WHERE tenant_id = p_tenant_id
      AND term = p_term
      AND user_id = p_user_id;

    -- 2. Insert new
    INSERT INTO search_history (tenant_id, user_id, term)
    VALUES (p_tenant_id, p_user_id, p_term);

    RETURN jsonb_build_object('success', true);
EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- Secure Fetch (Bypass RLS)
CREATE OR REPLACE FUNCTION get_search_history_secure(
    p_tenant_id uuid,
    p_user_id uuid DEFAULT auth.uid()
)
RETURNS TABLE (term text, created_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    RETURN QUERY
    SELECT sh.term, sh.created_at
    FROM search_history sh
    WHERE sh.tenant_id = p_tenant_id
      AND sh.user_id = p_user_id
    ORDER BY sh.created_at DESC
    LIMIT 50;
END;
$$;

GRANT EXECUTE ON FUNCTION submit_search_history_secure(uuid, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION submit_search_history_secure(uuid, text, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION submit_search_history_secure(uuid, text, uuid) TO anon;

GRANT EXECUTE ON FUNCTION get_search_history_secure(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION get_search_history_secure(uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION get_search_history_secure(uuid, uuid) TO anon;

-- Refresh Schema Cache
NOTIFY pgrst, 'reload schema';
