-- Migration: 79_update_person_rpcs_custom_fields.sql
-- Description: Updates create_person and update_person RPCs to correctly handle custom_fields (JSONB).
-- This ensures 'status' and other dynamic fields are saved to the database.

-- 1. Update create_person
CREATE OR REPLACE FUNCTION create_person(
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
    v_party_id UUID;
    v_person_id UUID;
    v_user_id UUID; -- For 'created_by'
BEGIN
    -- Get current user ID
    v_user_id := auth.uid();

    -- 1. Create Party
    INSERT INTO parties (
        tenant_id,
        type,
        name,
        display_name,
        email_addresses,
        phone_numbers,
        status, -- We map custom_fields->>'status' to the main status column as well if present
        tags,
        created_by
    )
    VALUES (
        arg_tenant_id,
        'person',
        arg_first_name || ' ' || arg_last_name,
        arg_first_name || ' ' || arg_last_name,
        CASE WHEN arg_email IS NOT NULL AND arg_email <> '' THEN ARRAY[arg_email] ELSE ARRAY[]::text[] END,
        CASE WHEN arg_phone IS NOT NULL AND arg_phone <> '' THEN ARRAY[arg_phone] ELSE ARRAY[]::text[] END,
        COALESCE(arg_custom_fields->>'status', 'new'), -- Default status from custom fields or 'new'
        ARRAY['prospect'], -- Default tag
        v_user_id
    )
    RETURNING id INTO v_party_id;

    -- 2. Create Person Role/Profile
    INSERT INTO people (
        id,
        tenant_id,
        first_name,
        last_name,
        custom_fields
    )
    VALUES (
        v_party_id, -- Sharing ID (One-to-One)
        arg_tenant_id,
        arg_first_name,
        arg_last_name,
        arg_custom_fields
    )
    RETURNING id INTO v_person_id;

    -- 3. Return Result
    RETURN jsonb_build_object(
        'success', true,
        'id', v_person_id
    );

EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object(
        'success', false,
        'error', SQLERRM
    );
END;
$$;

-- 2. Update update_person
CREATE OR REPLACE FUNCTION update_person(
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
    -- We use jsonb_concat to merge new custom fields into existing ones, ensuring we don't wipe other data.
    -- Or if we want strict replace, we use =. For now, lets MERGE.
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
