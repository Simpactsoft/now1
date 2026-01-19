-- Phase 17: Super Admin - Strict English Tenants
-- Enforces English-only Slugs and simplifies creation.

-- 1. Add JSONB column (reserved for future use, e.g. descriptions or UI labels)
ALTER TABLE tenants 
ADD COLUMN IF NOT EXISTS name_translations JSONB DEFAULT '{}'::jsonb;

-- 2. Drop old versions to avoid conflicts
DROP FUNCTION IF EXISTS create_tenant_platform(text, text, text, text);
DROP FUNCTION IF EXISTS create_tenant_platform(text, text, text);
DROP FUNCTION IF EXISTS create_tenant_platform(text, text);

-- 3. Create Strict RPC
CREATE OR REPLACE FUNCTION create_tenant_platform(
    arg_name text, 
    arg_slug text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_tenant_id uuid;
    v_slug text;
BEGIN
    -- 1. Generate Slug if missing (STRICT English/Latin only)
    IF arg_slug IS NULL OR arg_slug = '' THEN
        -- Replace non-alphanumeric characters with underscore
        v_slug := lower(regexp_replace(arg_name, '[^a-zA-Z0-9]+', '_', 'g'));
        v_slug := trim(both '_' from v_slug);
    ELSE
        -- Ensure provided slug is also clean (optional, but good practice)
        v_slug := lower(regexp_replace(arg_slug, '[^a-zA-Z0-9_]+', '', 'g'));
    END IF;

    -- 2. Insert Tenant
    INSERT INTO tenants (name, slug)
    VALUES (arg_name, v_slug)
    RETURNING id INTO v_tenant_id;

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

NOTIFY pgrst, 'reload config';
