
-- Migration: 140_enable_research_demo.sql
-- Description:
-- UPDATED: Now includes proper Filtering logic (Search, Status, Tags) so the demo behaves realistically.

BEGIN;

CREATE OR REPLACE FUNCTION public.fetch_research_demo(
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
    ret_last_interaction timestamptz,
    ret_updated_at timestamptz,
    ret_role_name text,
    ret_total_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = research, public, pg_temp
AS $$
DECLARE
    v_demo_tenant_id UUID;
    v_demo_path LTREE;
    v_total_rows BIGINT;
    v_where_clause TEXT;
    v_query TEXT;
BEGIN
    -- 1. Auto-Detect the Seeded Tenant
    SELECT tenant_id INTO v_demo_tenant_id FROM research.cards LIMIT 1;
    v_demo_path := 'org.distributor.dealer1';

    -- 2. Build Dynamic WHERE Clause
    v_where_clause := format(' WHERE c.tenant_id = %L AND c.hierarchy_path <@ %L ', v_demo_tenant_id, v_demo_path);

    -- [Search]
    IF arg_filters->>'search' IS NOT NULL AND length(arg_filters->>'search') > 0 THEN
         v_where_clause := v_where_clause || format(' AND c.display_name ILIKE %L ', '%' || (arg_filters->>'search') || '%');
    END IF;

    -- [Status]
    IF arg_filters->'status' IS NOT NULL AND jsonb_array_length(arg_filters->'status') > 0 THEN
        v_where_clause := v_where_clause || format(' AND lower(c.status) = ANY(ARRAY(SELECT lower(x) FROM jsonb_array_elements_text(%L) t(x))) ', arg_filters->'status');
    ELSIF arg_filters->>'status' IS NOT NULL THEN
        v_where_clause := v_where_clause || format(' AND lower(c.status) = lower(%L) ', arg_filters->>'status');
    END IF;

    -- [Tags]
    IF arg_filters->'tags' IS NOT NULL AND jsonb_array_length(arg_filters->'tags') > 0 THEN
         v_where_clause := v_where_clause || format(' AND c.tags && ARRAY(SELECT x FROM jsonb_array_elements_text(%L) t(x)) ', arg_filters->'tags');
    END IF;


    -- 3. Execute Count
    EXECUTE 'SELECT count(*) FROM research.cards c ' || v_where_clause INTO v_total_rows;

    -- 4. Execute Main Query
    v_query := 'SELECT 
        c.id,
        c.display_name,
        c.contact_methods,
        coalesce(c.tags, ARRAY[]::text[]),
        coalesce(c.status, ''lead''),
        0 as rating,
        c.created_at, 
        c.created_at, 
        ''Research Contact''::text, 
        ' || v_total_rows || '::bigint
    FROM research.cards c '
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
