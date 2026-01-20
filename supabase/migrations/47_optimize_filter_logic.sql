-- Migration 47: Optimize Filter Logic (Array Handing)
-- Fixes: Timeouts due to inefficient JSON operations in WHERE clause.

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
    ret_role_name text,
    ret_last_interaction timestamptz,
    ret_updated_at timestamptz,
    ret_total_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_total_rows bigint;
    v_query text;
    v_where_clause text;
    v_sort_logic text;
    
    -- Filter Variables
    v_search_term text;
    v_status_filter text[];
    v_role_filter text[];
    v_year_filter text[];
    v_tags_filter text[];
BEGIN
    -- 0. Parse JSON Filters into Native Arrays (Performance Optimization)
    -- This extracts values ONCE, instead of inside the query loop.
    
    -- Status Filter
    IF arg_filters->'status' IS NOT NULL AND jsonb_typeof(arg_filters->'status') = 'array' THEN
        SELECT array_agg(lower(value)) INTO v_status_filter 
        FROM jsonb_array_elements_text(arg_filters->'status');
    ELSIF arg_filters->'status' IS NOT NULL THEN
        v_status_filter := ARRAY[lower(arg_filters->>'status')];
    END IF;

    -- Role Filter
    IF arg_filters->'role_name' IS NOT NULL AND jsonb_typeof(arg_filters->'role_name') = 'array' THEN
        SELECT array_agg(lower(value)) INTO v_role_filter 
        FROM jsonb_array_elements_text(arg_filters->'role_name');
    ELSIF arg_filters->'role_name' IS NOT NULL THEN
        v_role_filter := ARRAY[lower(arg_filters->>'role_name')];
    END IF;

    -- Joined Year Filter
    IF arg_filters->'joined_year' IS NOT NULL AND jsonb_typeof(arg_filters->'joined_year') = 'array' THEN
        SELECT array_agg(value) INTO v_year_filter 
        FROM jsonb_array_elements_text(arg_filters->'joined_year');
    ELSIF arg_filters->'joined_year' IS NOT NULL THEN
        v_year_filter := ARRAY[arg_filters->>'joined_year'];
    END IF;

    -- Tags Filter
    IF arg_filters->'tags' IS NOT NULL AND jsonb_typeof(arg_filters->'tags') = 'array' THEN
        SELECT array_agg(value) INTO v_tags_filter 
        FROM jsonb_array_elements_text(arg_filters->'tags');
    ELSIF arg_filters->'tags' IS NOT NULL THEN
        v_tags_filter := ARRAY[arg_filters->>'tags'];
    END IF;


    -- 1. Base Filter
    v_where_clause := format(' WHERE p.tenant_id = %L AND p.type = ''person'' ', arg_tenant_id);

    -- 2. Apply Filters using Native Arrays
    
    -- [SMART SEARCH LOGIC]
    IF arg_filters->>'search' IS NOT NULL AND length(arg_filters->>'search') > 0 THEN
         v_search_term := arg_filters->>'search';
         IF length(v_search_term) < 3 THEN
             -- Short search: Prefix match (uses B-Tree)
             v_where_clause := v_where_clause || ' AND lower(p.display_name) LIKE ' || quote_literal(lower(v_search_term) || '%');
         ELSE
             -- Long search: Trigram match (uses GIN)
             v_where_clause := v_where_clause || ' AND p.display_name ILIKE ''%'' || ' || quote_literal(v_search_term) || ' || ''%'' ';
         END IF;
    END IF;

    -- Status (Optimized with ANY + Functional Index)
    IF v_status_filter IS NOT NULL THEN
        v_where_clause := v_where_clause || format(' AND lower(p.status) = ANY(%L) ', v_status_filter);
    END IF;

    -- Role (Optimized with ANY + Functional Index)
    IF v_role_filter IS NOT NULL THEN
        v_where_clause := v_where_clause || format(' 
            AND EXISTS (
                SELECT 1 FROM party_memberships pm 
                WHERE pm.person_id = p.id 
                AND lower(pm.role_name) = ANY(%L)
            ) ', v_role_filter);
    END IF;

    -- Joined Year
    IF v_year_filter IS NOT NULL THEN
        v_where_clause := v_where_clause || format(' AND to_char(p.created_at, ''YYYY'') = ANY(%L) ', v_year_filter);
    END IF;
    
    -- Tags
    IF v_tags_filter IS NOT NULL THEN
         v_where_clause := v_where_clause || format(' AND p.tags && %L::text[] ', v_tags_filter);
    END IF;

    -- 3. Get Total Count
    EXECUTE 'SELECT count(*) FROM parties p ' || v_where_clause INTO v_total_rows;

    -- 4. Sort Logic Construction
    v_sort_logic := (CASE 
        WHEN arg_sort_col = 'name' THEN 'p.display_name'
        WHEN arg_sort_col = 'status' THEN 'p.status'
        WHEN arg_sort_col = 'created_at' THEN 'p.created_at'
        WHEN arg_sort_col = 'role_name' THEN '(SELECT role_name FROM party_memberships pm WHERE pm.person_id = p.id LIMIT 1)'
        WHEN arg_sort_col = 'id' THEN 'p.id'
        ELSE 'p.updated_at' 
    END) || ' ' || (CASE WHEN upper(arg_sort_dir) = 'ASC' THEN 'ASC' ELSE 'DESC' END);

    v_sort_logic := v_sort_logic || ', p.id ASC ';

    -- 5. Execute Main Query
    v_query := 'SELECT 
        p.id, 
        p.display_name, 
        p.contact_methods, 
        coalesce(p.tags, ARRAY[]::text[]), 
        coalesce(p.status, ''lead''), 
        coalesce(p.rating, 0),
        (SELECT role_name FROM party_memberships pm WHERE pm.person_id = p.id LIMIT 1),
        p.last_interaction_at, 
        p.updated_at, 
        ' || v_total_rows || '::bigint
    FROM parties p '
    || v_where_clause ||
    ' ORDER BY ' || v_sort_logic ||
    ' OFFSET ' || arg_start || ' LIMIT ' || arg_limit;

    RETURN QUERY EXECUTE v_query;
END;
$$;
