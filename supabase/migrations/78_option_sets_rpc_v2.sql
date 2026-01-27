-- Migration: 78_option_sets_rpc_v2.sql
-- Description: Creates a V2 function for get_option_set_values to resolve persistent type mismatch errors.

DROP FUNCTION IF EXISTS get_option_set_values_v2(VARCHAR, UUID, VARCHAR);

CREATE OR REPLACE FUNCTION get_option_set_values_v2(
    p_set_code VARCHAR,
    p_tenant_id UUID,
    p_lang_code VARCHAR DEFAULT 'en'
)
RETURNS TABLE (
    value TEXT,          -- Changin VARCHAR to TEXT for maximum compatibility
    label TEXT,          -- Changing VARCHAR to TEXT
    color TEXT,
    icon TEXT,
    is_system BOOLEAN,
    is_custom BOOLEAN,
    payload JSONB
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
        RETURN;
    END IF;

    -- 2. Fetch Merged Values
    RETURN QUERY
    WITH raw_values AS (
        SELECT 
            ov.internal_code,
            ov.label_i18n,
            ov.color,
            ov.icon,
            ov.sort_order,
            ov.tenant_id,
            ov.attributes, 
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
        rv.internal_code::TEXT as value,
        COALESCE(
            rv.label_i18n->>p_lang_code,
            rv.label_i18n->>'en',
            rv.internal_code
        )::TEXT as label,
        rv.color::TEXT,
        rv.icon::TEXT,
        (rv.tenant_id IS NULL) as is_system,
        (rv.tenant_id IS NOT NULL) as is_custom,
        to_jsonb(rv.*) as payload
    FROM raw_values rv
    WHERE rv.shadow_rank = 1
    ORDER BY rv.sort_order ASC, label ASC;
END;
$$;

NOTIFY pgrst, 'reload schema';
