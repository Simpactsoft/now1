-- Revert DB lowercasing normalization to uppercase matching option_values

BEGIN;

-- 1. Revert existing statuses to upper
UPDATE cards
SET status = upper(trim(status))
WHERE status IS NOT NULL;

-- 2. Provide sensible defaults where missing
UPDATE cards
SET status = 'LEAD'
WHERE (status IS NULL OR trim(status) = '') AND type = 'person';

UPDATE cards
SET status = 'PROSPECT'
WHERE (status IS NULL OR trim(status) = '') AND type = 'organization';

UPDATE cards
SET status = 'LEAD'
WHERE status IS NULL OR trim(status) = '';

-- 3. Replace create_person to NOT lowercase arg_status
CREATE OR REPLACE FUNCTION create_person(
    arg_tenant_id uuid,
    arg_first_name text,
    arg_last_name text DEFAULT '',
    arg_email text DEFAULT NULL,
    arg_phone text DEFAULT NULL,
    arg_custom_fields jsonb DEFAULT '{}'::jsonb,
    arg_tags text[] DEFAULT '{}'::text[],
    arg_organization_id uuid DEFAULT NULL,
    arg_status text DEFAULT 'LEAD'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_card_id uuid;
    v_real_tenant_id uuid;
    v_display_name text;
    v_contact_methods jsonb := '{}'::jsonb;
    v_hierarchy_path ltree;
BEGIN
    SELECT tenant_id INTO v_real_tenant_id
    FROM profiles
    WHERE id = auth.uid();

    IF v_real_tenant_id IS NULL THEN
        RAISE EXCEPTION 'User profile not found or has no tenant_id';
    END IF;

    v_display_name := trim(arg_first_name || ' ' || arg_last_name);

    IF arg_email IS NOT NULL AND length(arg_email) > 0 THEN
        v_contact_methods := jsonb_set(v_contact_methods, '{email}', to_jsonb(arg_email));
    END IF;
    
    IF arg_phone IS NOT NULL AND length(arg_phone) > 0 THEN
         v_contact_methods := jsonb_set(v_contact_methods, '{phone}', to_jsonb(arg_phone));
    END IF;

    v_hierarchy_path := 'org'::ltree;

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
        upper(arg_status),
        NOW()
    )
    RETURNING id INTO v_card_id;

    RETURN jsonb_build_object(
        'id', v_card_id,
        'display_name', v_display_name,
        'email', arg_email
    );
END;
$$;


-- 4. Replace create_organization to NOT lowercase arg_status
CREATE OR REPLACE FUNCTION create_organization(
    arg_tenant_id uuid,
    arg_name text,
    arg_tax_id text DEFAULT NULL,
    arg_company_size text DEFAULT NULL,
    arg_industry text DEFAULT NULL,
    arg_email text DEFAULT NULL,
    arg_phone text DEFAULT NULL,
    arg_address text DEFAULT NULL,
    arg_status text DEFAULT 'PROSPECT',
    arg_tags text[] DEFAULT '{}'::text[]
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_card_id uuid;
    v_contact_methods jsonb;
    v_custom_fields jsonb;
BEGIN
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

    v_custom_fields := '{}'::jsonb;
    IF arg_tax_id IS NOT NULL THEN v_custom_fields := jsonb_set(v_custom_fields, '{tax_id}', to_jsonb(arg_tax_id)); END IF;
    IF arg_company_size IS NOT NULL THEN v_custom_fields := jsonb_set(v_custom_fields, '{company_size}', to_jsonb(arg_company_size)); END IF;
    IF arg_industry IS NOT NULL THEN v_custom_fields := jsonb_set(v_custom_fields, '{industry}', to_jsonb(arg_industry)); END IF;
    IF arg_email IS NOT NULL THEN v_custom_fields := jsonb_set(v_custom_fields, '{email}', to_jsonb(arg_email)); END IF;
    IF arg_phone IS NOT NULL THEN v_custom_fields := jsonb_set(v_custom_fields, '{phone}', to_jsonb(arg_phone)); END IF;
    IF arg_address IS NOT NULL THEN v_custom_fields := jsonb_set(v_custom_fields, '{address}', to_jsonb(arg_address)); END IF;

    INSERT INTO cards (
        tenant_id,
        type,
        display_name,
        contact_methods,
        custom_fields,
        status,
        tags,
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
        upper(arg_status),
        arg_tags,
        'org',
        now(),
        now()
    )
    RETURNING id INTO v_card_id;

    RETURN jsonb_build_object(
        'id', v_card_id,
        'display_name', arg_name,
        'type', 'organization'
    );
END;
$$;

COMMIT;
