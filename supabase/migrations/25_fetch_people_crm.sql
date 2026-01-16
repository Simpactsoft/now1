-- Phase 11: CRM Core
-- This RPC fetches ALL people (employees + prospects) for the CRM view.
-- It queries the 'parties' and 'people' tables directly, bypassing the 'party_memberships' requirement.

DROP FUNCTION IF EXISTS fetch_people_crm(uuid, int, int, text, text, text);

CREATE OR REPLACE FUNCTION fetch_people_crm(
    arg_tenant_id uuid,
    arg_start int DEFAULT 0,
    arg_limit int DEFAULT 100,
    arg_sort_col text DEFAULT 'created_at',
    arg_sort_dir text DEFAULT 'desc',
    arg_filter_name text DEFAULT ''
)
RETURNS TABLE (
    ret_id uuid,
    ret_name text,
    ret_contact_info jsonb,
    ret_tags jsonb,
    ret_updated_at timestamptz,
    ret_total_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
SET statement_timeout = '30s'
AS $$
DECLARE
    v_total_rows bigint;
    v_dynamic_query text;
    v_order_clause text;
BEGIN
    -- Set session tenant (good practice for future RLS)
    PERFORM set_config('app.current_tenant', arg_tenant_id::text, true);

    -- 1. Optimized Count
    IF arg_start = 0 THEN
        SELECT count(*) INTO v_total_rows
        FROM parties p
        WHERE p.tenant_id = arg_tenant_id
        AND p.type = 'person'
        AND (arg_filter_name = '' OR p.display_name ILIKE '%' || arg_filter_name || '%');
    ELSE
        v_total_rows := -1;
    END IF;

    -- 2. Sort Clause
    v_order_clause := (CASE
        WHEN arg_sort_col = 'name' THEN 'p.display_name'
        ELSE 'p.updated_at'
    END) || ' ' || (CASE WHEN upper(arg_sort_dir) = 'ASC' THEN 'ASC' ELSE 'DESC' END);

    -- 3. Dynamic Query
    v_dynamic_query := 'WITH keys AS (
        SELECT p.id 
        FROM parties p
        WHERE p.tenant_id = $1 
        AND p.type = ''person''';

    -- Robust Search Logic: Use ILIKE ALL(array)
    -- We bind the array of patterns to $6
    IF arg_filter_name <> '' THEN
        v_dynamic_query := v_dynamic_query || ' AND p.display_name ILIKE ALL($6)';
    END IF;

    v_dynamic_query := v_dynamic_query || '
        ORDER BY ' || v_order_clause || '
        OFFSET $3 LIMIT $4
    )
    SELECT 
        p.id as ret_id, 
        p.display_name as ret_name, 
        p.contact_methods as ret_contact_info,
        p.custom_fields as ret_tags,
        p.updated_at as ret_updated_at, 
        $5
    FROM parties p
    JOIN keys k ON p.id = k.id
    ORDER BY ' || v_order_clause;

    -- Prepare search patterns: 'Term' -> '%Term%'
    -- We filter out empty strings to avoid '%%' matching everything unnecessarily
    RETURN QUERY EXECUTE v_dynamic_query
    USING 
        arg_tenant_id,      -- $1
        arg_filter_name,    -- $2 (unused in new logic but kept for index alignment if needed, logic uses $6)
        arg_start,          -- $3
        arg_limit,          -- $4
        v_total_rows,       -- $5
        ARRAY(              -- $6
            SELECT '%' || word || '%'
            FROM unnest(string_to_array(trim(arg_filter_name), ' ')) as word
            WHERE length(word) > 0
        );
END;
$$;
