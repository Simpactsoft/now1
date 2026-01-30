
-- Migration: 160_fix_create_person_hierarchy.sql
-- Description: Fixes INSERT RLS Error for Dealers/Restricted Users.
-- Previous version hardcoded 'org' as the path, which failed if the user was restricted to 'org.dealer1'.
-- Now we inherit the User's `org_path` explicitly.

BEGIN;

CREATE OR REPLACE FUNCTION create_person(
    arg_tenant_id uuid, -- Ignored (Security)
    arg_first_name text,
    arg_last_name text DEFAULT '',
    arg_email text DEFAULT NULL,
    arg_phone text DEFAULT NULL,
    arg_custom_fields jsonb DEFAULT '{}'::jsonb,
    arg_tags text[] DEFAULT '{}'::text[]
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_card_id uuid;
    v_real_tenant_id uuid;
    v_real_hierarchy_path ltree;
    v_display_name text;
    v_contact_methods jsonb := '{}'::jsonb;
BEGIN
    -- 0. Security Hardening: Get Verified Tenant ID AND Path
    SELECT tenant_id, org_path 
    INTO v_real_tenant_id, v_real_hierarchy_path
    FROM profiles
    WHERE id = auth.uid();

    IF v_real_tenant_id IS NULL THEN
        RAISE EXCEPTION 'User profile not found or has no tenant_id';
    END IF;

    -- Default to 'org' if missing (Fail safe)
    IF v_real_hierarchy_path IS NULL THEN
        v_real_hierarchy_path := 'org'::ltree;
    END IF;

    -- 1. Prepare Data
    v_display_name := trim(arg_first_name || ' ' || arg_last_name);

    IF arg_email IS NOT NULL AND length(arg_email) > 0 THEN
        v_contact_methods := jsonb_set(v_contact_methods, '{email}', to_jsonb(arg_email));
    END IF;
    
    IF arg_phone IS NOT NULL AND length(arg_phone) > 0 THEN
         v_contact_methods := jsonb_set(v_contact_methods, '{phone}', to_jsonb(arg_phone));
    END IF;

    -- 2. Insert into Cards (Using Verified Tenant AND Path)
    INSERT INTO cards (
        tenant_id, 
        type, 
        hierarchy_path, -- [FIX] Use User's Path
        display_name, 
        contact_methods, 
        custom_fields,
        tags,
        status, 
        created_at
    )
    VALUES (
        v_real_tenant_id,
        'person',
        v_real_hierarchy_path, -- [FIX] Inherited
        v_display_name,
        v_contact_methods,
        arg_custom_fields,
        arg_tags,
        'lead',
        NOW()
    )
    RETURNING id INTO v_card_id;

    -- 3. Return Result
    RETURN jsonb_build_object(
        'id', v_card_id,
        'display_name', v_display_name,
        'email', arg_email,
        'hierarchy_path', v_real_hierarchy_path -- Debug info
    );
END;
$$;

COMMIT;
