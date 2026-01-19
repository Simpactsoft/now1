-- Phase 17.5: Admin Dashboard - God Mode Fetch
-- Solves the "Grid not visible" issue by bypassing RLS for the Admin Dashboard.

-- RPC to fetch ALL tenants with user counts
DROP FUNCTION IF EXISTS get_admin_tenants();

CREATE OR REPLACE FUNCTION get_admin_tenants()
RETURNS TABLE (
    id uuid,
    name text,
    slug text,
    created_at timestamptz,
    status text,
    billing_status text,
    user_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER -- God Mode: Bypasses RLS on tenants table
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
        t.billing_status,
        COUNT(tm.user_id)::bigint as user_count
    FROM tenants t
    LEFT JOIN tenant_members tm ON t.id = tm.tenant_id
    GROUP BY t.id;
END;
$$;

-- Grant Permissions
GRANT EXECUTE ON FUNCTION get_admin_tenants() TO service_role;
GRANT EXECUTE ON FUNCTION get_admin_tenants() TO authenticated;
GRANT EXECUTE ON FUNCTION get_admin_tenants() TO anon;

-- Force Cache Reload
NOTIFY pgrst, 'reload config';
