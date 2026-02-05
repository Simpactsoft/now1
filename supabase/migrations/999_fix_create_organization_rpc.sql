-- Migration: 999_fix_create_organization_rpc.sql
-- Description: Updates create_organization RPC to insert into 'cards' instead of the missing 'parties' table.

CREATE OR REPLACE FUNCTION create_organization(
    arg_tenant_id uuid,
    arg_name text,
    arg_tax_id text DEFAULT NULL,
    arg_company_size text DEFAULT NULL,
    arg_industry text DEFAULT NULL,
    arg_email text DEFAULT NULL,
    arg_phone text DEFAULT NULL,
    arg_address text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER -- God Mode
SET search_path = public, pg_temp
AS $$
DECLARE
    v_card_id uuid;
    v_contact_methods jsonb;
    v_custom_fields jsonb;
BEGIN
    -- 1. Construct Contact Methods JSON
    v_contact_methods := '[]'::jsonb;
    
    IF arg_email IS NOT NULL AND arg_email <> '' THEN
        v_contact_methods := v_contact_methods || jsonb_build_object('type', 'email', 'value', arg_email, 'is_primary', true);
    END IF;

    IF arg_phone IS NOT NULL AND arg_phone <> '' THEN
        v_contact_methods := v_contact_methods || jsonb_build_object('type', 'phone', 'value', arg_phone, 'is_primary', false);
    END IF;

    IF arg_address IS NOT NULL AND arg_address <> '' THEN
         v_contact_methods := v_contact_methods || jsonb_build_object('type', 'address', 'value', arg_address, 'is_primary', false);
    END IF;

    -- 2. Construct Custom Fields
    v_custom_fields := '{}'::jsonb;
    IF arg_tax_id IS NOT NULL THEN v_custom_fields := jsonb_set(v_custom_fields, '{tax_id}', to_jsonb(arg_tax_id)); END IF;
    IF arg_company_size IS NOT NULL THEN v_custom_fields := jsonb_set(v_custom_fields, '{company_size}', to_jsonb(arg_company_size)); END IF;
    IF arg_industry IS NOT NULL THEN v_custom_fields := jsonb_set(v_custom_fields, '{industry}', to_jsonb(arg_industry)); END IF;
    -- Also populate simple fields for easier access/backwards compatibility if needed, matching fetch logic
    IF arg_email IS NOT NULL THEN v_custom_fields := jsonb_set(v_custom_fields, '{email}', to_jsonb(arg_email)); END IF;
    IF arg_phone IS NOT NULL THEN v_custom_fields := jsonb_set(v_custom_fields, '{phone}', to_jsonb(arg_phone)); END IF;
    IF arg_address IS NOT NULL THEN v_custom_fields := jsonb_set(v_custom_fields, '{address}', to_jsonb(arg_address)); END IF;


    -- 3. Insert into Cards
    INSERT INTO cards (
        tenant_id,
        type,
        display_name,
        contact_methods,
        custom_fields,
        status,
        hierarchy_path,
        created_at,
        updated_at
    )
    VALUES (
        arg_tenant_id,
        'organization',
        arg_name,
        v_contact_methods,
        v_custom_fields,
        'prospect', -- Default status
        'org', -- Default hierarchy path
        now(),
        now()
    )
    RETURNING id INTO v_card_id;

    -- 4. Return the new object
    RETURN jsonb_build_object(
        'id', v_card_id,
        'display_name', arg_name,
        'type', 'organization'
    );
END;
$$;

-- Grant Permissions
GRANT EXECUTE ON FUNCTION create_organization(uuid, text, text, text, text, text, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION create_organization(uuid, text, text, text, text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION create_organization(uuid, text, text, text, text, text, text, text) TO anon;

-- Force Cache Reload
NOTIFY pgrst, 'reload config';
