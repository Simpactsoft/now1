
-- Migration: 200_fix_get_my_tenants.sql
-- Description: Updates get_my_tenants to use 'profiles' table for membership check and removes insecure fallback.

CREATE OR REPLACE FUNCTION get_my_tenants()
RETURNS TABLE (
    id uuid,
    name text,
    slug text,
    role text
)
LANGUAGE plpgsql
SECURITY DEFINER 
SET search_path = public, auth, pg_temp
AS $$
DECLARE
    current_user_id uuid;
BEGIN
    current_user_id := auth.uid();
    
    -- If no user, return empty (secure by default)
    IF current_user_id IS NULL THEN
        RETURN;
    END IF;

    -- 1. Check direct 'profiles' link (Primary Source of Truth in this app)
    RETURN QUERY
    SELECT 
        t.id,
        t.name,
        t.slug,
        p.role
    FROM 
        public.tenants t
    JOIN 
        public.profiles p ON t.id = p.tenant_id
    WHERE 
        p.id = current_user_id;

    -- If found, we are done. 
    -- (If user has profile, they have 1 tenant. Returns that 1 row).
    -- If we want to support multiple, we should UNION with tenant_members.
    
    -- 2. Append 'tenant_members' matches (UNION) to allow multi-tenant access if configured
    RETURN QUERY
    SELECT 
        t.id,
        t.name,
        t.slug,
        tm.role
    FROM 
        public.tenants t
    JOIN 
        public.tenant_members tm ON t.id = tm.tenant_id
    WHERE 
        tm.user_id = current_user_id
    AND t.id NOT IN (SELECT tenant_id FROM profiles WHERE id = current_user_id); -- Avoid duplicates
        
    -- NO FALLBACK to "Select * from tenants". Secure by default.
END;
$$;

GRANT EXECUTE ON FUNCTION get_my_tenants() TO authenticated, anon;
