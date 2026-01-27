-- Migration: 73_enhance_metadata_engine.sql
-- Description: Fixes RLS and adds 'party' support. Includes 'users' view shim for stability.

-- 1. Shim: Ensure public.users exists (maps to auth.users) to prevent "relation users does not exist" errors
-- This is common in Supabase patterns where RLS policies or legacy queries might reference public.users
CREATE OR REPLACE VIEW public.users AS 
SELECT id, email, raw_user_meta_data, created_at, last_sign_in_at 
FROM auth.users;

-- 2. Relax Entity Type Check
ALTER TABLE attribute_definitions DROP CONSTRAINT IF EXISTS attribute_definitions_entity_type_check;
ALTER TABLE attribute_definitions ADD CONSTRAINT attribute_definitions_entity_type_check 
    CHECK (entity_type IN ('person', 'organization', 'party'));

-- 3. Fix RLS to use tenant_members for robustness
DROP POLICY IF EXISTS attr_def_read ON attribute_definitions;
DROP POLICY IF EXISTS attr_def_write ON attribute_definitions;
DROP POLICY IF EXISTS "Allow Tenant Admin Manage Attributes" ON attribute_definitions;
DROP POLICY IF EXISTS "Enable read access for tenant members" ON attribute_definitions;
DROP POLICY IF EXISTS "Enable write access for tenant members" ON attribute_definitions;

CREATE POLICY "Enable read access for tenant members" ON attribute_definitions
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM tenant_members tm 
            WHERE tm.user_id = auth.uid() 
            AND tm.tenant_id = attribute_definitions.tenant_id
        )
    );

CREATE POLICY "Enable write access for tenant members" ON attribute_definitions
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM tenant_members tm 
            WHERE tm.user_id = auth.uid() 
            AND tm.tenant_id = attribute_definitions.tenant_id
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM tenant_members tm 
            WHERE tm.user_id = auth.uid() 
            AND tm.tenant_id = attribute_definitions.tenant_id
        )
    );

-- 4. Update BI View Function
CREATE OR REPLACE FUNCTION rebuild_tenant_flat_view(p_tenant_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_sql text;
    v_cols text := '';
    v_slug text;
    r record;
BEGIN
    -- Get Tenant Slug for View Name
    SELECT slug INTO v_slug FROM tenants WHERE id = p_tenant_id;
    IF v_slug IS NULL THEN RAISE NOTICE 'Tenant slug not found for %', p_tenant_id; RETURN; END IF;

    -- Build Columns (Include 'person' AND 'party' attributes)
    FOR r IN (
        SELECT attribute_key, attribute_type 
        FROM attribute_definitions 
        WHERE tenant_id = p_tenant_id 
        AND entity_type IN ('person', 'party') 
        ORDER BY ui_order
    ) LOOP
        -- Cast based on type
        IF r.attribute_type = 'number' THEN
            v_cols := v_cols || format(', (custom_fields->>%L)::numeric AS %I', r.attribute_key, r.attribute_key);
        ELSIF r.attribute_type = 'boolean' THEN
            v_cols := v_cols || format(', (custom_fields->>%L)::boolean AS %I', r.attribute_key, r.attribute_key);
        ELSIF r.attribute_type = 'date' THEN
            v_cols := v_cols || format(', (custom_fields->>%L)::date AS %I', r.attribute_key, r.attribute_key);
        ELSE
            v_cols := v_cols || format(', custom_fields->>%L AS %I', r.attribute_key, r.attribute_key);
        END IF;
    END LOOP;

    -- SQL Injection Protection handled by %I (Identifier) formatting above
    v_sql := format(
        'CREATE OR REPLACE VIEW generated_views.view_%s_people AS ' ||
        'SELECT p.id, p.display_name, p.created_at %s ' ||
        'FROM parties p ' ||
        'WHERE p.tenant_id = %L AND p.type = ''person''',
        v_slug,     -- View Name suffix
        v_cols,     -- Custom Columns
        p_tenant_id -- Filter
    );

    -- Ensure schema exists
    CREATE SCHEMA IF NOT EXISTS generated_views;
    
    -- Execute
    EXECUTE v_sql;
    
    -- Grant access
    EXECUTE format('GRANT SELECT ON generated_views.view_%s_people TO authenticated', v_slug);
END;
$$;
