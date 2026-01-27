-- Migration: 77_fix_get_option_set_values.sql
-- Description: Drops and recreates the RPC function get_option_set_values to fix "structure of query does not match function result type".
-- Ensures strict type matching.

-- 1. Drop existing function to clear any cached type mismatches
DROP FUNCTION IF EXISTS get_option_set_values(VARCHAR, UUID, VARCHAR);

-- 2. Recreate the function with precise matching types
CREATE OR REPLACE FUNCTION get_option_set_values(
    p_set_code VARCHAR,
    p_tenant_id UUID,
    p_lang_code VARCHAR DEFAULT 'en'
)
RETURNS TABLE (
    value VARCHAR,       -- Matching internal_code (VARCHAR)
    label VARCHAR,       -- Matching COALESCE result (TEXT/VARCHAR)
    color VARCHAR,       -- Matching color (VARCHAR)
    icon VARCHAR,        -- Matching icon (VARCHAR)
    is_system BOOLEAN,   -- Matching boolean expression
    is_custom BOOLEAN,   -- Matching boolean expression
    payload JSONB        -- Matching to_jsonb result
) 
LANGUAGE plpgsql SECURITY DEFINER 
SET search_path = public, pg_temp
AS $$
DECLARE
    v_set_id UUID;
BEGIN
    -- 1. Resolve Set ID
    SELECT id INTO v_set_id
    FROM option_sets
    WHERE code = p_set_code
      AND (tenant_id = p_tenant_id OR tenant_id IS NULL)
    ORDER BY tenant_id NULLS LAST
    LIMIT 1;

    IF v_set_id IS NULL THEN
        RETURN; -- No set found, returns empty set
    END IF;

    -- 2. Fetch Merged Values using "Shadowing Logic"
    RETURN QUERY
    WITH raw_values AS (
        SELECT 
            ov.internal_code,
            ov.label_i18n,
            ov.color,
            ov.icon,
            ov.sort_order,
            ov.tenant_id,
            ov.attributes, -- Implicitly used in *
            ov.created_at,
            ov.updated_at,
            -- Determine Priority: 1 for Tenant Override, 2 for System Default
            ROW_NUMBER() OVER (
                PARTITION BY ov.internal_code 
                ORDER BY ov.tenant_id NULLS LAST
            ) as shadow_rank
        FROM option_values ov
        WHERE ov.option_set_id = v_set_id
          AND (ov.tenant_id = p_tenant_id OR ov.tenant_id IS NULL)
          AND ov.is_active = true
    )
    SELECT 
        rv.internal_code::VARCHAR as value,
        -- Label Resolution
        COALESCE(
            rv.label_i18n->>p_lang_code,
            rv.label_i18n->>'en',
            rv.internal_code
        )::VARCHAR as label,
        rv.color::VARCHAR,
        rv.icon::VARCHAR,
        (rv.tenant_id IS NULL)::BOOLEAN as is_system,
        (rv.tenant_id IS NOT NULL)::BOOLEAN as is_custom,
        to_jsonb(rv.*) as payload
    FROM raw_values rv
    WHERE rv.shadow_rank = 1
    ORDER BY rv.sort_order ASC, label ASC;
END;
$$;

NOTIFY pgrst, 'reload schema';
