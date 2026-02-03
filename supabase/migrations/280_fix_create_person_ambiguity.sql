-- Migration: 280_fix_create_person_ambiguity.sql
-- Description: Consolidate create_person signatures to avoid ambiguity.

BEGIN;

-- Drop all known variations to be safe
DROP FUNCTION IF EXISTS public.create_person(uuid, text, text, text, text, jsonb, text[]);
DROP FUNCTION IF EXISTS public.create_person(uuid, text, text, text, text, jsonb, text[], uuid);

-- Create the Unified Function
CREATE OR REPLACE FUNCTION create_person(
    arg_tenant_id uuid, -- Kept for signature compatibility, but IGNORED
    arg_first_name text,
    arg_last_name text DEFAULT '',
    arg_email text DEFAULT NULL,
    arg_phone text DEFAULT NULL,
    arg_custom_fields jsonb DEFAULT '{}'::jsonb,
    arg_tags text[] DEFAULT '{}'::text[],
    arg_organization_id uuid DEFAULT NULL -- Optional new argument
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_card_id uuid;
    v_real_tenant_id uuid; -- The verified tenant ID
    v_display_name text;
    v_contact_methods jsonb := '{}'::jsonb;
    v_hierarchy_path ltree;
BEGIN
    -- 0. Security Hardening: Get Verified Tenant ID
    SELECT tenant_id INTO v_real_tenant_id
    FROM profiles
    WHERE id = auth.uid();

    IF v_real_tenant_id IS NULL THEN
        RAISE EXCEPTION 'User profile not found or has no tenant_id';
    END IF;

    -- 1. Prepare Data
    v_display_name := trim(arg_first_name || ' ' || arg_last_name);

    IF arg_email IS NOT NULL AND length(arg_email) > 0 THEN
        v_contact_methods := jsonb_set(v_contact_methods, '{email}', to_jsonb(arg_email));
    END IF;
    
    IF arg_phone IS NOT NULL AND length(arg_phone) > 0 THEN
         v_contact_methods := jsonb_set(v_contact_methods, '{phone}', to_jsonb(arg_phone));
    END IF;

    -- 2. Determine Hierarchy Path
    -- We use 'org' as default, assuming alignment from prev scripts
    v_hierarchy_path := 'org'::ltree;

    -- 3. Insert into Cards (Using Verified Tenant ID)
    INSERT INTO cards (
        tenant_id, 
        type, 
        hierarchy_path,
        display_name, 
        contact_methods, 
        custom_fields,
        tags,
        status, 
        created_at
    )
    VALUES (
        v_real_tenant_id, -- FORCE USAGE OF REAL ID
        'person',
        v_hierarchy_path,
        v_display_name,
        v_contact_methods,
        arg_custom_fields,
        arg_tags,
        'lead',
        NOW()
    )
    RETURNING id INTO v_card_id;

    -- 4. Handle Organization Link (Future proofing, logic can be added here)
    -- If arg_organization_id is provided, we could link it here.
    -- For now, we just return the person, caller can handle linking.

    -- 5. Return Result
    RETURN jsonb_build_object(
        'id', v_card_id,
        'display_name', v_display_name,
        'email', arg_email
    );
END;
$$;

GRANT EXECUTE ON FUNCTION create_person TO authenticated;
GRANT EXECUTE ON FUNCTION create_person TO service_role;

COMMIT;
