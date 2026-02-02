
-- Migration: 228_get_tenants_json_rpc.sql
-- Description: New JSON-returning RPC to bypass 400 Bad Request issues.

CREATE OR REPLACE FUNCTION get_tenants_json()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER 
SET search_path = public, auth, pg_temp
AS $$
DECLARE
    current_user_id uuid;
    current_user_email text;
    result json;
BEGIN
    current_user_id := auth.uid();
    
    -- Get email from auth.users (requires security definer)
    SELECT email INTO current_user_email FROM auth.users WHERE id = current_user_id;

    -- *** SUPER ADMIN CHECK ***
    IF current_user_email = 'sales@impactsoft.co.il' THEN
        SELECT json_agg(t) INTO result FROM (
            SELECT 
                id,
                name,
                slug,
                'system_admin' as role
            FROM public.tenants
            ORDER BY name ASC
        ) t;
        RETURN result;
    END IF;

    -- STANDARD LOGIC
    SELECT json_agg(t) INTO result FROM (
        -- Standard user tenants
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
            p.id = current_user_id
            
        UNION
        
        -- Member tenants
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
        AND t.id NOT IN (SELECT tenant_id FROM profiles WHERE id = current_user_id)
    ) t;

    RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION get_tenants_json() TO authenticated, anon;
