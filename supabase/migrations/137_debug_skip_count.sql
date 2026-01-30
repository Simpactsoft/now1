
-- Migration: 137_debug_skip_count.sql
-- Description: DIAGNOSTIC ONLY.
-- Disable the COUNT(*) query inside fetch_people_crm to see if the List retrieval works.
-- If this loads instantly, the problem is 100% the Count (Missing Index).
-- If this fails, the problem is the List Query (Sort/Limit).

BEGIN;

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
SECURITY DEFINER
SET search_path = public, pg_temp
SET statement_timeout = '60000ms'
AS $$
DECLARE
    v_total_rows bigint;
    v_query text;
    v_where_clause text;
BEGIN
    -- Base: Tenant + Type Only
    v_where_clause := format(' WHERE c.tenant_id = %L AND c.type = ''person'' ', arg_tenant_id);

    -- [Filters omitted for brevity of diagnosis - kept simple]
    IF arg_filters->>'search' IS NOT NULL AND length(arg_filters->>'search') > 0 THEN
         v_where_clause := v_where_clause || format(' AND c.display_name ILIKE %L ', '%' || (arg_filters->>'search') || '%');
    END IF;

    -- SKIPPING COUNT FOR DIAGNOSIS
    v_total_rows := -1;

    -- [Main Query]
    v_query := 'SELECT 
        c.id, 
        c.display_name, 
        c.contact_methods, 
        coalesce(c.tags, ARRAY[]::text[]), 
        coalesce(c.status, ''lead''), 
        0 as rating, 
        c.last_interaction_at, 
        c.updated_at, 
        coalesce(
            (SELECT role_name FROM party_memberships pm WHERE pm.person_id = c.id LIMIT 1),
            c.custom_fields->>''role''
        ) as ret_role_name,
        ' || v_total_rows || '::bigint
    FROM cards c '
    || v_where_clause ||
    ' ORDER BY ' || 
    (CASE 
        WHEN arg_sort_col = 'name' THEN 'c.display_name'
        WHEN arg_sort_col = 'status' THEN 'c.status'
        ELSE 'c.created_at' 
    END) || ' ' || (CASE WHEN upper(arg_sort_dir) = 'ASC' THEN 'ASC' ELSE 'DESC' END) ||
    ' OFFSET ' || arg_start || ' LIMIT ' || arg_limit;

    RETURN QUERY EXECUTE v_query;
END;
$$;

COMMIT;
