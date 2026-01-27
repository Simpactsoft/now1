-- Migration: 80_update_person_v2.sql
-- Description: Creates a V2 function for update_person to bypass schema cache issues.

CREATE OR REPLACE FUNCTION update_person_v2(
    arg_id UUID,
    arg_tenant_id UUID,
    arg_first_name TEXT,
    arg_last_name TEXT,
    arg_email TEXT DEFAULT NULL,
    arg_phone TEXT DEFAULT NULL,
    arg_custom_fields JSONB DEFAULT '{}'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_exists BOOLEAN;
BEGIN
    -- 1. Verify existence and tenant access
    SELECT EXISTS(
        SELECT 1 FROM parties 
        WHERE id = arg_id AND tenant_id = arg_tenant_id
    ) INTO v_exists;

    IF NOT v_exists THEN
        RETURN jsonb_build_object('success', false, 'error', 'Person not found or access denied');
    END IF;

    -- 2. Update Party (Common Fields)
    UPDATE parties
    SET 
        name = arg_first_name || ' ' || arg_last_name,
        display_name = arg_first_name || ' ' || arg_last_name,
        email_addresses = CASE WHEN arg_email IS NOT NULL AND arg_email <> '' THEN ARRAY[arg_email] ELSE email_addresses END,
        phone_numbers = CASE WHEN arg_phone IS NOT NULL AND arg_phone <> '' THEN ARRAY[arg_phone] ELSE phone_numbers END,
        status = COALESCE(arg_custom_fields->>'status', status), -- Update status if provided
        updated_at = now()
    WHERE id = arg_id;

    -- 3. Update Person (Specific Fields)
    UPDATE people
    SET 
        first_name = arg_first_name,
        last_name = arg_last_name,
        custom_fields = COALESCE(custom_fields, '{}'::jsonb) || arg_custom_fields,
        updated_at = now()
    WHERE id = arg_id;

    RETURN jsonb_build_object('success', true, 'id', arg_id);

EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object(
        'success', false,
        'error', SQLERRM
    );
END;
$$;

NOTIFY pgrst, 'reload schema';
