
-- Migration: 109_fix_flat_view_trigger.sql
-- Description: Fixes rebuild_tenant_flat_view to use 'cards' instead of 'parties'.
-- Phase 6 Stability Fix.

BEGIN;

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
    -- FIX: Changed 'FROM parties p' to 'FROM cards p'
    -- Also ensure custom_fields exists on cards (it does).
    v_sql := format(
        'CREATE OR REPLACE VIEW generated_views.view_%s_people AS ' ||
        'SELECT p.id, p.display_name, p.created_at %s ' ||
        'FROM cards p ' ||
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

COMMIT;
