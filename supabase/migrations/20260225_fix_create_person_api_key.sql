-- Migration: 20260225_fix_create_person_api_key.sql
-- Description: Updates create_person to work with both authenticated users AND API key
-- (service_role) calls. When auth.uid() is NULL (API key scenario), we trust the
-- arg_tenant_id parameter since the caller is service_role (validated by the API layer).

BEGIN;

CREATE OR REPLACE FUNCTION create_person(
    arg_tenant_id uuid, -- Used when called via API key (service_role)
    arg_first_name text,
    arg_last_name text DEFAULT '',
    arg_email text DEFAULT NULL,
    arg_phone text DEFAULT NULL,
    arg_custom_fields jsonb DEFAULT '{}'::jsonb,
    arg_tags text[] DEFAULT '{}'::text[],
    arg_organization_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_card_id uuid;
    v_real_tenant_id uuid;
    v_display_name text;
    v_contact_methods jsonb := '{}'::jsonb;
    v_hierarchy_path ltree;
    v_caller_role text;
BEGIN
    -- 0. Security: Determine tenant_id based on caller context
    v_caller_role := current_setting('role', true);

    IF auth.uid() IS NOT NULL THEN
        -- Called by an authenticated user: look up tenant from profile (secure)
        SELECT tenant_id INTO v_real_tenant_id
        FROM profiles
        WHERE id = auth.uid();

        IF v_real_tenant_id IS NULL THEN
            RAISE EXCEPTION 'User profile not found or has no tenant_id';
        END IF;
    ELSIF v_caller_role = 'service_role' THEN
        -- Called via service_role (API key path): trust arg_tenant_id
        -- The API layer has already validated the API key and tenant scope
        IF arg_tenant_id IS NULL THEN
            RAISE EXCEPTION 'tenant_id is required for API key calls';
        END IF;
        v_real_tenant_id := arg_tenant_id;
    ELSE
        RAISE EXCEPTION 'Unauthorized: cannot determine tenant context';
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
        status,
        created_at
    )
    VALUES (
        v_real_tenant_id,
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

    -- 4. Return Result
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
