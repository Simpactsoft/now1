
-- Migration: 205_fix_rpc_return_types.sql
-- Description: Explicitly casts ENUM 'app_role' to TEXT in RPCs to fix 400 Bad Request errors.

BEGIN;

-- 1. Fix get_my_tenants_v2
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
        p.role::text  -- [FIX] Explicit Cast
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
        tm.role::text -- [FIX] Explicit Cast
    FROM 
        public.tenants t
    JOIN 
        public.tenant_members tm ON t.id = tm.tenant_id
    WHERE 
        tm.user_id = current_user_id
    AND t.id NOT IN (SELECT tenant_id FROM profiles WHERE id = current_user_id);
END;
$$;


-- 2. Fix get_my_tenants (Legacy V1) - Just in case
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
    
    IF current_user_id IS NULL THEN
        RETURN;
    END IF;

    -- 1. Check direct 'profiles' link
    RETURN QUERY
    SELECT 
        t.id,
        t.name,
        t.slug,
        p.role::text -- [FIX] Explicit Cast
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
        tm.role::text -- [FIX] Explicit Cast
    FROM 
        public.tenants t
    JOIN 
        public.tenant_members tm ON t.id = tm.tenant_id
    WHERE 
        tm.user_id = current_user_id
    AND t.id NOT IN (SELECT tenant_id FROM profiles WHERE id = current_user_id);
        
END;
$$;

COMMIT;
