-- Migration: 76_update_create_person.sql
-- Description: Updates the create_person RPC to support custom_fields (needed for status and other attributes).

CREATE OR REPLACE FUNCTION create_person(
    arg_tenant_id uuid,
    arg_first_name text,
    arg_last_name text,
    arg_email text DEFAULT NULL,
    arg_phone text DEFAULT NULL,
    arg_custom_fields jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_party_id uuid;
    v_contact_methods jsonb;
BEGIN
    -- 1. Construct Contact Methods JSON
    v_contact_methods := '[]'::jsonb;
    
    IF arg_email IS NOT NULL AND arg_email <> '' THEN
        v_contact_methods := v_contact_methods || jsonb_build_object('type', 'email', 'value', arg_email, 'is_primary', true);
    END IF;

    IF arg_phone IS NOT NULL AND arg_phone <> '' THEN
        v_contact_methods := v_contact_methods || jsonb_build_object('type', 'phone', 'value', arg_phone, 'is_primary', false);
    END IF;

    -- 2. Insert into Supertype (Parties)
    -- Added custom_fields column
    INSERT INTO parties (tenant_id, type, display_name, contact_methods, custom_fields)
    VALUES (
        arg_tenant_id,
        'person',
        arg_first_name || ' ' || arg_last_name,
        v_contact_methods,
        arg_custom_fields
    )
    RETURNING id INTO v_party_id;

    -- 3. Insert into Subtype (People)
    INSERT INTO people (party_id, first_name, last_name)
    VALUES (
        v_party_id,
        arg_first_name,
        arg_last_name
    );

    -- 4. Return the new object
    RETURN jsonb_build_object(
        'id', v_party_id,
        'display_name', arg_first_name || ' ' || arg_last_name,
        'custom_fields', arg_custom_fields
    );
END;
$$;
