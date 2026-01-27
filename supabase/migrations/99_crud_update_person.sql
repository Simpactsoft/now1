
CREATE OR REPLACE FUNCTION update_person(
    arg_id uuid, -- This is the PARTY ID (what the frontend uses)
    arg_tenant_id uuid,
    arg_first_name text,
    arg_last_name text,
    arg_email text DEFAULT NULL,
    arg_phone text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_contact_methods jsonb;
BEGIN
    -- 1. Verify Party exists and belongs to Tenant
    PERFORM 1 FROM parties WHERE id = arg_id AND tenant_id = arg_tenant_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Person not found or access denied');
    END IF;

    -- 2. Build Contact Methods JSON
    v_contact_methods := '[]'::jsonb;
    IF arg_email IS NOT NULL AND arg_email <> '' THEN
        v_contact_methods := v_contact_methods || jsonb_build_object('type', 'email', 'value', arg_email, 'is_primary', true);
    END IF;
    IF arg_phone IS NOT NULL AND arg_phone <> '' THEN
        v_contact_methods := v_contact_methods || jsonb_build_object('type', 'phone', 'value', arg_phone, 'is_primary', false);
    END IF;

    -- 3. Update Supertype (Parties)
    UPDATE parties
    SET display_name = arg_first_name || ' ' || arg_last_name,
        contact_methods = v_contact_methods,
        updated_at = now()
    WHERE id = arg_id;

    -- 4. Update Subtype (People)
    -- We assume the record exists in 'people' if it exists in 'parties' and type is 'person'.
    -- Or we can just try update.
    UPDATE people
    SET first_name = arg_first_name,
        last_name = arg_last_name
    WHERE party_id = arg_id;
    
    RETURN jsonb_build_object('success', true);
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;

$$;
