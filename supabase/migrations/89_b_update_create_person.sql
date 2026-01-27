-- Migration: 89_b_update_create_person.sql (Fixed Variable Names)
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
SECURITY DEFINER
SET search_path = public, pg_temp
AS $func$
DECLARE
    v_card_id uuid;
    v_display_name text;
    v_contact_methods jsonb := '[]'::jsonb;
BEGIN
    v_display_name := trim(arg_first_name || ' ' || arg_last_name);

    IF arg_email IS NOT NULL AND length(arg_email) > 0 THEN
        v_contact_methods := v_contact_methods || jsonb_build_object('type', 'email', 'value', arg_email, 'is_primary', true);
    END IF;
    
    IF arg_phone IS NOT NULL AND length(arg_phone) > 0 THEN
        v_contact_methods := v_contact_methods || jsonb_build_object('type', 'phone', 'value', arg_phone, 'is_primary', true);
    END IF;

    INSERT INTO cards (
        tenant_id, 
        type, 
        display_name, 
        contact_methods, 
        custom_fields,
        tags,
        lifecycle_stage
    )
    VALUES (
        arg_tenant_id,
        'person',
        v_display_name,
        v_contact_methods,
        arg_custom_fields,
        arg_tags,
        'lead' 
    )
    RETURNING id INTO v_card_id;

    INSERT INTO people (
        card_id, 
        first_name, 
        last_name
    )
    VALUES (
        v_card_id,
        arg_first_name,
        arg_last_name
    );

    IF arg_email IS NOT NULL AND length(arg_email) > 0 THEN
        INSERT INTO unique_identifiers (tenant_id, card_id, identifier_type, identifier_value)
        VALUES (arg_tenant_id, v_card_id, 'email', arg_email)
        ON CONFLICT (tenant_id, identifier_type, identifier_value) DO NOTHING;
    END IF;

    IF arg_phone IS NOT NULL AND length(arg_phone) > 0 THEN
        INSERT INTO unique_identifiers (tenant_id, card_id, identifier_type, identifier_value)
        VALUES (arg_tenant_id, v_card_id, 'phone', arg_phone)
        ON CONFLICT (tenant_id, identifier_type, identifier_value) DO NOTHING;
    END IF;

    RETURN jsonb_build_object(
        'id', v_card_id,
        'display_name', v_display_name,
        'email', arg_email
    );
END;
$func$;
