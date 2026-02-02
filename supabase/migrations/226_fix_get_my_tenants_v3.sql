
-- Migration: 226_fix_get_my_tenants_v3.sql
-- Description: Drop and recreate get_my_tenants_v2 to resolve 400 Bad Request (Ambiguity).

-- 1. DROP Existing to clear signature conflicts
DROP FUNCTION IF EXISTS get_my_tenants_v2();

-- 2. CREATE FRESH
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
    current_user_email text;
BEGIN
    current_user_id := auth.uid();
    
    -- Get email from auth.users (requires security definer)
    SELECT email INTO current_user_email FROM auth.users WHERE id = current_user_id;
    
    -- If no user, return empty
    IF current_user_id IS NULL THEN
        RETURN;
    END IF;

    -- *** SUPER ADMIN CHECK ***
    -- If email is specific, return ALL tenants
    IF current_user_email = 'sales@impactsoft.co.il' THEN
        RETURN QUERY
        SELECT 
            t.id,
            t.name,
            t.slug,
            'system_admin'::text as role
        FROM 
            public.tenants t;
        RETURN;
    END IF;

    -- STANDARD LOGIC (For everyone else)

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
    AND t.id NOT IN (
        SELECT t2.id 
        FROM public.tenants t2 
        JOIN public.profiles p2 ON t2.id = p2.tenant_id 
        WHERE p2.id = current_user_id
    ); -- Ensure no dupes
END;
$$;

-- 3. GRANT PERMISSIONS
GRANT EXECUTE ON FUNCTION get_my_tenants_v2() TO authenticated, anon;
