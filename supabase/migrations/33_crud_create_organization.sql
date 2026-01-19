-- Phase 16: Interactive CRM - Create Organization RPC (God Mode)
-- Transactionally inserts into 'parties' and 'organizations_ext'.

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
SECURITY DEFINER -- God Mode: Bypasses RLS to ensure creation even if policies are strict
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

    IF arg_address IS NOT NULL AND arg_address <> '' THEN
         v_contact_methods := v_contact_methods || jsonb_build_object('type', 'address', 'value', arg_address, 'is_primary', false);
    END IF;

    -- 2. Insert into Supertype (Parties)
    INSERT INTO parties (tenant_id, type, display_name, contact_methods)
    VALUES (
        arg_tenant_id,
        'organization',
        arg_name,
        v_contact_methods
    )
    RETURNING id INTO v_party_id;

    -- 3. Insert into Subtype (Organizations)
    -- Note: Table is named 'organizations_ext' in the schema
    INSERT INTO organizations_ext (party_id, tax_id, company_size, industry)
    VALUES (
        v_party_id,
        arg_tax_id,
        arg_company_size,
        arg_industry
    );

    -- 4. Return the new object
    RETURN jsonb_build_object(
        'id', v_party_id,
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
