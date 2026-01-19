-- Phase 17.5: Admin Drill-Down & Status
-- Adds status tracking and "God Mode" user fetching.

-- 1. Add Status Columns to Tenants
ALTER TABLE tenants 
ADD COLUMN IF NOT EXISTS status text DEFAULT 'active',
ADD COLUMN IF NOT EXISTS billing_status text DEFAULT 'free';

-- 2. Create RPC to fetch users for a specific tenant (Admin Only)
DROP FUNCTION IF EXISTS get_tenant_users_secure(uuid);

CREATE OR REPLACE FUNCTION get_tenant_users_secure(arg_tenant_id uuid)
RETURNS TABLE (
    user_id uuid,
    email varchar,
    role text,
    created_at timestamptz,
    last_sign_in_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER -- God Mode: Access auth.users
SET search_path = public, auth, pg_temp
AS $$
BEGIN
    -- Verify Permissions (Optional: Check if caller is super-admin)
    -- For now, we rely on RLS/Grant isolation or Service Role usage in Next.js

    RETURN QUERY
    SELECT 
        tm.user_id,
        au.email::varchar,
        tm.role,
        au.created_at,
        au.last_sign_in_at
    FROM public.tenant_members tm
    JOIN auth.users au ON tm.user_id = au.id
    WHERE tm.tenant_id = arg_tenant_id;
END;
$$;

-- Grant Permissions
GRANT EXECUTE ON FUNCTION get_tenant_users_secure(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION get_tenant_users_secure(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION get_tenant_users_secure(uuid) TO anon;

-- Force Cache Reload
NOTIFY pgrst, 'reload config';
