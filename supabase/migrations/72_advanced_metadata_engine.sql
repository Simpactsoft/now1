-- Migration: 72_advanced_metadata_engine.sql
-- Description: Adds BI Views generator and Validation functions.
-- Note: Dependent on 71_create_attribute_definitions.sql for the base table.

-- 1. Setup Extensions & Validation Logic
CREATE EXTENSION IF NOT EXISTS "pg_jsonschema" WITH SCHEMA extensions;

-- Fallback Validation Function
CREATE OR REPLACE FUNCTION validate_metadata_schema(p_schema jsonb, p_data jsonb)
RETURNS boolean LANGUAGE plpgsql IMMUTABLE AS $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'jsonb_matches_schema') THEN
        RETURN extensions.jsonb_matches_schema(p_schema, p_data);
    ELSE
        RETURN true; 
    END IF;
EXCEPTION WHEN OTHERS THEN
    RETURN true;
END;
$$;

-- 2. Automatic BI View Generator
-- This function dynamically creates a SQL VIEW for each tenant to flatten the EAV model
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

    -- Build Columns
    FOR r IN (
        SELECT attribute_key, attribute_type 
        FROM attribute_definitions 
        WHERE tenant_id = p_tenant_id AND entity_type = 'person'
        ORDER BY ui_order
    ) LOOP
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

    -- Drop previous view safely
    EXECUTE format('DROP VIEW IF EXISTS generated_views.view_%s_people CASCADE', v_slug);

    -- ensure schema exists
    CREATE SCHEMA IF NOT EXISTS generated_views;

    -- Construct View SQL
    v_sql := format(
        'CREATE OR REPLACE VIEW generated_views.view_%s_people AS ' ||
        'SELECT p.id, p.display_name, p.created_at %s ' ||
        'FROM parties p ' ||
        'WHERE p.tenant_id = %L AND p.type = ''person''',
        v_slug,     -- View Name suffix
        v_cols,     -- Custom Columns
        p_tenant_id -- Filter
    );
    
    -- Execute Create View
    EXECUTE v_sql;
    
    -- Grant access
    EXECUTE format('GRANT SELECT ON generated_views.view_%s_people TO authenticated', v_slug);
END;
$$;

-- 3. Trigger to Rebuild View on Schema Change
CREATE OR REPLACE FUNCTION trg_rebuild_view_func() RETURNS TRIGGER AS $$
BEGIN
    PERFORM rebuild_tenant_flat_view(COALESCE(NEW.tenant_id, OLD.tenant_id));
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_attr_def_changes ON attribute_definitions;
CREATE TRIGGER trg_attr_def_changes
    AFTER INSERT OR UPDATE OR DELETE ON attribute_definitions
    FOR EACH ROW
    EXECUTE FUNCTION trg_rebuild_view_func();

-- 4. Notify Schema Cache
NOTIFY pgrst, 'reload schema';
