-- DEBUG: Relaxed Fetch (Ignore User ID Filter)
CREATE OR REPLACE FUNCTION get_search_history_debug(
    p_tenant_id uuid
)
RETURNS TABLE (term text, created_at timestamptz, debug_user_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    RETURN QUERY
    SELECT sh.term, sh.created_at, sh.user_id
    FROM search_history sh
    WHERE sh.tenant_id = p_tenant_id
    ORDER BY sh.created_at DESC
    LIMIT 50;
END;
$$;

GRANT EXECUTE ON FUNCTION get_search_history_debug(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION get_search_history_debug(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION get_search_history_debug(uuid) TO anon;

NOTIFY pgrst, 'reload schema';
