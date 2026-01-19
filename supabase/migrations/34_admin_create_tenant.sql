-- Phase 17: Super Admin - Create Tenant RPC
-- Allows "God Mode" creation of new workspaces (Tenants).

CREATE OR REPLACE FUNCTION create_tenant_platform(
    arg_name text,
    arg_slug text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER -- God Mode
SET search_path = public, pg_temp
AS $$
DECLARE
    v_tenant_id uuid;
    v_slug text;
BEGIN
    -- 1. Generate Slug if missing
    IF arg_slug IS NULL OR arg_slug = '' THEN
        v_slug := lower(regexp_replace(arg_name, '[^a-zA-Z0-9]+', '_', 'g'));
    ELSE
        v_slug := arg_slug;
    END IF;

    -- 2. Insert Tenant
    INSERT INTO tenants (name, slug)
    VALUES (arg_name, v_slug)
    RETURNING id INTO v_tenant_id;

    -- 3. Return Result
    RETURN jsonb_build_object(
        'id', v_tenant_id,
        'name', arg_name,
        'slug', v_slug
    );
END;
$$;

-- Grant Permissions
GRANT EXECUTE ON FUNCTION create_tenant_platform(text, text) TO service_role;
GRANT EXECUTE ON FUNCTION create_tenant_platform(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION create_tenant_platform(text, text) TO anon;

-- Force Cache Reload
NOTIFY pgrst, 'reload config';
