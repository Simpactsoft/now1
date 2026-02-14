-- Fix UNION type mismatch by casting both sides to text
-- The issue is that profiles.role is app_role enum but tenant_members.role is text

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
                'distributor' as role  -- Return as text, not app_role
            FROM public.tenants
            ORDER BY name ASC
        ) t;
        RETURN result;
    END IF;

    -- STANDARD LOGIC with explicit text casting
    SELECT json_agg(t) INTO result FROM (
        -- Standard user tenants
        SELECT 
            t.id,
            t.name,
            t.slug,
            p.role::text as role  -- Cast app_role to text
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
            tm.role::text as role  -- Ensure text type
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
