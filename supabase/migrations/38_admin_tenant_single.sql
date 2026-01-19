-- Phase 17.5: Admin Drill-Down - Single Fetch
-- Solves "Cannot coerce..." error by bypassing RLS for single tenant fetch.

DROP FUNCTION IF EXISTS get_admin_tenant(uuid);

CREATE OR REPLACE FUNCTION get_admin_tenant(arg_tenant_id uuid)
RETURNS TABLE (
    id uuid,
    name text,
    slug text,
    created_at timestamptz,
    status text,
    billing_status text
)
LANGUAGE plpgsql
SECURITY DEFINER -- God Mode
SET search_path = public, pg_temp
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        t.id,
        t.name,
        t.slug,
        t.created_at,
        t.status,
        t.billing_status
    FROM tenants t
    WHERE t.id = arg_tenant_id;
END;
$$;

-- Grant Permissions
GRANT EXECUTE ON FUNCTION get_admin_tenant(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION get_admin_tenant(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION get_admin_tenant(uuid) TO anon;

-- Force Cache Reload
NOTIFY pgrst, 'reload config';
