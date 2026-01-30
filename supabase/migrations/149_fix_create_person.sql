
-- Migration: 149_fix_create_person.sql
-- Description: Updates create_person to match the new 'cards' only schema.
-- Removes writes to 'people', 'unique_identifiers', and missing columns 'lifecycle_stage'.

BEGIN;

-- Drop old signatures to be safe
DROP FUNCTION IF EXISTS create_person(uuid,text,text,text,text,jsonb);
DROP FUNCTION IF EXISTS create_person(uuid,text,text,text,text,jsonb,text[]);

CREATE OR REPLACE FUNCTION create_person(
    arg_tenant_id uuid,
    arg_first_name text,
    arg_last_name text DEFAULT '',
    arg_email text DEFAULT NULL,
    arg_phone text DEFAULT NULL,
    arg_custom_fields jsonb DEFAULT '{}'::jsonb,
    arg_tags text[] DEFAULT '{}'::text[]
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER -- Changed to INVOKER to respect RLS (user must have permission to create in this tenant)
SET search_path = public, pg_temp
AS $$
DECLARE
    v_card_id uuid;
    v_display_name text;
    v_contact_methods jsonb := '{}'::jsonb;
    v_hierarchy_path ltree;
BEGIN
    -- 1. Prepare Data
    v_display_name := trim(arg_first_name || ' ' || arg_last_name);

    IF arg_email IS NOT NULL AND length(arg_email) > 0 THEN
        v_contact_methods := jsonb_set(v_contact_methods, '{email}', to_jsonb(arg_email));
    END IF;
    
    IF arg_phone IS NOT NULL AND length(arg_phone) > 0 THEN
         v_contact_methods := jsonb_set(v_contact_methods, '{phone}', to_jsonb(arg_phone));
    END IF;

    -- 2. Determine Hierarchy Path
    -- For now, default to 'org'. ideally we fetch this from the user's profile defaults or parent logic.
    v_hierarchy_path := 'org'::ltree;

    -- 3. Insert into Cards
    INSERT INTO cards (
        tenant_id, 
        type, 
        hierarchy_path,
        display_name, 
        contact_methods, 
        custom_fields,
        tags,
        status, -- Replaced lifecycle_stage with status
        created_at
    )
    VALUES (
        arg_tenant_id,
        'person',
        v_hierarchy_path,
        v_display_name,
        v_contact_methods,
        arg_custom_fields,
        arg_tags,
        'lead', -- Default status
        NOW()
    )
    RETURNING id INTO v_card_id;

    -- 4. Return Result
    RETURN jsonb_build_object(
        'id', v_card_id,
        'display_name', v_display_name,
        'email', arg_email
    );
END;
$$;

COMMIT;
