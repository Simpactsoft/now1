-- Migration 69: Relax Search History RPCs for Guest/Zombie Users
-- Reason: To allow search history to work even when auth.uid() is NULL (e.g. broken session).
-- We now allow p_user_id to be NULL and use IS NOT DISTINCT FROM for comparisons.

-- 1. Relaxed Submit (Insert/Update)
CREATE OR REPLACE FUNCTION submit_search_history_secure(
    p_tenant_id uuid,
    p_term text,
    p_user_id uuid DEFAULT auth.uid() 
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    -- We removed the BLOCK that returned error on NULL user_id.
    -- Now we allow NULL user_id (effectively "anonymous" history for this tenant).

    -- 1. Delete existing for 'bump' effect
    DELETE FROM search_history
    WHERE tenant_id = p_tenant_id
      AND term = p_term
      AND user_id IS NOT DISTINCT FROM p_user_id; -- Handle NULL = NULL

    -- 2. Insert new
    INSERT INTO search_history (tenant_id, user_id, term)
    VALUES (p_tenant_id, p_user_id, p_term);

    RETURN jsonb_build_object('success', true);
EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- 2. Relaxed Fetch
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
      AND sh.user_id IS NOT DISTINCT FROM p_user_id -- Handle NULL = NULL
    ORDER BY sh.created_at DESC
    LIMIT 50;
END;
$$;

-- Grant permissions again just in case
GRANT EXECUTE ON FUNCTION submit_search_history_secure(uuid, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION submit_search_history_secure(uuid, text, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION submit_search_history_secure(uuid, text, uuid) TO anon;

GRANT EXECUTE ON FUNCTION get_search_history_secure(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION get_search_history_secure(uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION get_search_history_secure(uuid, uuid) TO anon;

NOTIFY pgrst, 'reload schema';
