
-- Migration: 169_fix_rpc_security.sql
-- Description: Switches fetch_people_crm to SECURITY INVOKER.
-- Crucial for RLS enforcement. Previously was DEFINER, bypassing all RLS checks.

DROP FUNCTION IF EXISTS fetch_people_crm(uuid, integer, integer, text, text, jsonb);

CREATE OR REPLACE FUNCTION fetch_people_crm(
    arg_tenant_id uuid,
    arg_start int DEFAULT 0,
    arg_limit int DEFAULT 100,
    arg_sort_col text DEFAULT 'created_at',
    arg_sort_dir text DEFAULT 'desc',
    arg_filters jsonb DEFAULT '{}'::jsonb
)
RETURNS TABLE (
    ret_id uuid,
    ret_name text,
    ret_contact_info jsonb,
    ret_tags text[], 
    ret_status text, 
    ret_rating int,  
    ret_last_interaction timestamptz,
    ret_updated_at timestamptz,
    ret_role_name text, 
    ret_total_count bigint
)
LANGUAGE plpgsql
SECURITY INVOKER  -- [FIX] Was DEFINER (Unsafe)
SET search_path = public, pg_temp
AS $$
DECLARE
    v_total_rows bigint;
    v_query text;
    v_where_clause text;
BEGIN
    -- 1. Base Filter (Using 'cards' table now)
    v_where_clause := format(' WHERE p.tenant_id = %L AND p.type = ''person'' ', arg_tenant_id);

    -- 2. Add Filters
    -- Search
    IF arg_filters->>'search' IS NOT NULL AND length(arg_filters->>'search') > 0 THEN
         v_where_clause := v_where_clause || ' AND p.display_name ILIKE ''%'' || ' || quote_literal(arg_filters->>'search') || ' || ''%'' ';
    END IF;

    -- Status
    IF arg_filters->'status' IS NOT NULL AND jsonb_typeof(arg_filters->'status') = 'array' THEN
        v_where_clause := v_where_clause || format(' AND p.status IN (SELECT jsonb_array_elements_text(%L::jsonb)) ', arg_filters->'status');
    ELSIF arg_filters->>'status' IS NOT NULL THEN
        v_where_clause := v_where_clause || format(' AND p.status = %L ', arg_filters->>'status');
    END IF;

    -- Tags
    IF arg_filters->>'tags' IS NOT NULL THEN
         IF jsonb_typeof(arg_filters->'tags') = 'array' THEN
            v_where_clause := v_where_clause || format(' AND p.tags && (SELECT array_agg(x) FROM jsonb_array_elements_text(%L::jsonb) t(x)) ', arg_filters->'tags');
         ELSE
            v_where_clause := v_where_clause || format(' AND p.tags @> ARRAY[%L]::text[] ', arg_filters->>'tags');
         END IF;
    END IF;

    -- 3. Get Total Count (RLS Applied automatically via INVOKER)
    EXECUTE 'SELECT count(*) FROM cards p ' || v_where_clause INTO v_total_rows;

    -- 4. Execute Main Query
    v_query := 'SELECT 
        p.id, 
        p.display_name, 
        p.contact_methods, 
        coalesce(p.tags, ARRAY[]::text[]), 
        coalesce(p.status, ''lead''), 
        0::int as rating, 
        created_at as last_interaction_at, -- placeholder
        created_at as updated_at, 
        p.custom_fields->>''role'' as ret_role_name,
        ' || v_total_rows || '::bigint
    FROM cards p '
    || v_where_clause ||
    ' ORDER BY p.created_at DESC OFFSET ' || arg_start || ' LIMIT ' || arg_limit;

    RETURN QUERY EXECUTE v_query;
END;
$$;
