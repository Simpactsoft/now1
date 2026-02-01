
-- Migration: 202_get_my_tenants_v2.sql
-- Description: V2 of tenant discovery to bypass schema cache issues.

CREATE OR REPLACE FUNCTION get_my_tenants_v2()
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
    
    -- If no user, return empty
    IF current_user_id IS NULL THEN
        RETURN;
    END IF;

    -- 1. Check direct 'profiles' link
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

    IF FOUND THEN
        RETURN;
    END IF;

    -- 2. Check 'tenant_members'
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
    AND t.id NOT IN (SELECT tenant_id FROM profiles WHERE id = current_user_id);
END;
$$;

GRANT EXECUTE ON FUNCTION get_my_tenants_v2() TO authenticated, anon;
