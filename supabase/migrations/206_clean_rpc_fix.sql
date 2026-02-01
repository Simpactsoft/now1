
-- Migration: 206_clean_rpc_fix.sql
-- Description: Drops and Recreates get_my_tenants RPCs to ensure correct return types and casting.
-- Fixes 400 Bad Request / 42P13 errors by removing old signatures first.

BEGIN;

-- 1. Drop existing functions to allow signature/return type changes
DROP FUNCTION IF EXISTS get_my_tenants_v2();
DROP FUNCTION IF EXISTS get_my_tenants();

-- 2. Create get_my_tenants_v2 (New Version)
CREATE FUNCTION get_my_tenants_v2()
RETURNS TABLE (
    id uuid,
    name text,
    slug text,
    role text -- Note: Postgres expects TEXT, we will cast ENUM to TEXT
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
        p.role::text  -- [FIX] Explicit Cast (app_role -> text)
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
        tm.role::text -- [FIX] Explicit Cast (app_role -> text)
    FROM 
        public.tenants t
    JOIN 
        public.tenant_members tm ON t.id = tm.tenant_id
    WHERE 
        tm.user_id = current_user_id
    AND t.id NOT IN (SELECT tenant_id FROM profiles WHERE id = current_user_id);
END;
$$;

-- 3. Create get_my_tenants (Legacy V1) - Keeps compatibility
CREATE FUNCTION get_my_tenants()
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
    
    IF current_user_id IS NULL THEN
        RETURN;
    END IF;

    -- 1. Check direct 'profiles' link
    RETURN QUERY
    SELECT 
        t.id,
        t.name,
        t.slug,
        p.role::text 
    FROM 
        public.tenants t
    JOIN 
        public.profiles p ON t.id = p.tenant_id
    WHERE 
        p.id = current_user_id;

    -- 2. Append 'tenant_members' matches
    RETURN QUERY
    SELECT 
        t.id,
        t.name,
        t.slug,
        tm.role::text 
    FROM 
        public.tenants t
    JOIN 
        public.tenant_members tm ON t.id = tm.tenant_id
    WHERE 
        tm.user_id = current_user_id
    AND t.id NOT IN (SELECT tenant_id FROM profiles WHERE id = current_user_id);
END;
$$;

-- 4. Grant Permissions (Required after Drop/Create)
GRANT EXECUTE ON FUNCTION get_my_tenants_v2() TO authenticated, anon;
GRANT EXECUTE ON FUNCTION get_my_tenants() TO authenticated, anon;

COMMIT;
