
-- Migration: 143_optimize_production_rpc.sql
-- Description:
-- FIXED v5: Using STANDARD SINGLE QUOTES for function body.
-- Eliminates $function$ delimiters to bypass parser issues.
-- Note: Internal quotes are escaped using '' (double single quote).

BEGIN;

DROP FUNCTION IF EXISTS public.fetch_people_crm;

CREATE OR REPLACE FUNCTION public.fetch_people_crm(
    arg_tenant_id uuid DEFAULT NULL,
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
    ret_created_at timestamptz,
    ret_last_interaction timestamptz,
    ret_role_name text,
    ret_total_count bigint
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS '
DECLARE
    v_where_clause TEXT;
    v_total_rows BIGINT;
    v_query TEXT;
    v_sort_col TEXT;
BEGIN
    -- 1. Base Where Clause
    v_where_clause := '' WHERE true '';

    -- [Search]
    IF arg_filters->>''search'' IS NOT NULL AND length(arg_filters->>''search'') > 0 THEN
         v_where_clause := v_where_clause || format('' AND display_name ILIKE %L '', ''%'' || (arg_filters->>''search'') || ''%'');
    END IF;

    -- [Status]
    IF arg_filters->''status'' IS NOT NULL AND jsonb_array_length(arg_filters->''status'') > 0 THEN
        v_where_clause := v_where_clause || format('' AND lower(status) = ANY(ARRAY(SELECT lower(x) FROM jsonb_array_elements_text(%L) t(x))) '', arg_filters->''status'');
    ELSIF arg_filters->>''status'' IS NOT NULL THEN
        v_where_clause := v_where_clause || format('' AND lower(status) = lower(%L) '', arg_filters->>''status'');
    END IF;

    -- [Tags]
    IF arg_filters->''tags'' IS NOT NULL AND jsonb_array_length(arg_filters->''tags'') > 0 THEN
         v_where_clause := v_where_clause || format('' AND tags && ARRAY(SELECT x FROM jsonb_array_elements_text(%L) t(x)) '', arg_filters->''tags'');
    END IF;

    -- 2. Execute Count
    EXECUTE ''SELECT count(*) FROM cards '' || v_where_clause INTO v_total_rows;

    -- 3. Calculate Sort Column
    v_sort_col := CASE 
        WHEN arg_sort_col = ''ret_name'' OR arg_sort_col = ''name'' THEN ''display_name''
        WHEN arg_sort_col = ''ret_status'' OR arg_sort_col = ''status'' THEN ''status''
        ELSE ''created_at'' 
    END;

    -- 4. Execute Main Query
    -- Note: Triple escaping needed for inner string literals
    v_query := ''SELECT 
        id as ret_id,
        display_name as ret_name,
        contact_methods as ret_contact_info,
        coalesce(tags, ARRAY[]::text[]) as ret_tags,
        coalesce(status, ''''lead'''') as ret_status,
        0 as ret_rating,
        created_at as ret_created_at, 
        updated_at as ret_last_interaction, 
        NULL::text as ret_role_name, 
        '' || v_total_rows || ''::bigint as ret_total_count
    FROM cards ''
    || v_where_clause ||
    '' ORDER BY '' || v_sort_col || '' '' || (CASE WHEN upper(arg_sort_dir) = ''ASC'' THEN ''ASC'' ELSE ''DESC'' END) ||
    '' OFFSET '' || arg_start || '' LIMIT '' || arg_limit;

    RETURN QUERY EXECUTE v_query;
END;
';

COMMIT;
