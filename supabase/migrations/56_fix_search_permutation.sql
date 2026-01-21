-- Migration 56: Fix Search Permutation (Split & AND)
-- Purpose: Allow search input like "Avraham Ariel" to find "Ariel Avraham".
-- Logic: Split search string by spaces.
--        If single word -> Use existing Hybrid logic (Prefix <3, Contains >=3).
--        If multiple words -> Require ALL words to appear (AND logic), order independent.

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
SET statement_timeout = 5000 -- Keep the 5s timeout
AS $$
DECLARE
    v_total_rows bigint;
    v_query text;
    v_where_clause text;
    v_sort_logic text;
    
    -- Filter Variables
    v_search_raw text;
    v_search_parts text[];
    v_part text;
    v_name_filter text;
    v_status_filter text[];
    v_role_filter text[];
    v_year_filter text[];
    v_tags_filter text[];
BEGIN
    -- 0. Parse JSON Filters (Standard)
    
    -- Status Filter
    IF arg_filters->'status' IS NOT NULL THEN
        IF jsonb_typeof(arg_filters->'status') = 'array' THEN
            SELECT array_agg(lower(trim(value))) INTO v_status_filter 
            FROM jsonb_array_elements_text(arg_filters->'status');
        ELSE
            IF strpos(arg_filters->>'status', ',') > 0 THEN
                 SELECT array_agg(lower(trim(x))) INTO v_status_filter
                 FROM unnest(string_to_array(arg_filters->>'status', ',')) t(x);
            ELSE
                 v_status_filter := ARRAY[lower(trim(arg_filters->>'status'))];
            END IF;
        END IF;
    END IF;

    -- Role Filter
    IF arg_filters->'role_name' IS NOT NULL THEN
        IF jsonb_typeof(arg_filters->'role_name') = 'array' THEN
            SELECT array_agg(lower(trim(value))) INTO v_role_filter 
            FROM jsonb_array_elements_text(arg_filters->'role_name');
        ELSE
            IF strpos(arg_filters->>'role_name', ',') > 0 THEN
                 SELECT array_agg(lower(trim(x))) INTO v_role_filter
                 FROM unnest(string_to_array(arg_filters->>'role_name', ',')) t(x);
            ELSE
                 v_role_filter := ARRAY[lower(trim(arg_filters->>'role_name'))];
            END IF;
        END IF;
    END IF;

    -- Joined Year Filter
    IF arg_filters->'joined_year' IS NOT NULL THEN
        IF jsonb_typeof(arg_filters->'joined_year') = 'array' THEN
            SELECT array_agg(trim(value)) INTO v_year_filter 
            FROM jsonb_array_elements_text(arg_filters->'joined_year');
        ELSE
            IF strpos(arg_filters->>'joined_year', ',') > 0 THEN
                 SELECT array_agg(trim(x)) INTO v_year_filter
                 FROM unnest(string_to_array(arg_filters->>'joined_year', ',')) t(x);
            ELSE
                 v_year_filter := ARRAY[trim(arg_filters->>'joined_year')];
            END IF;
        END IF;
    END IF;

    -- Tags Filter
    IF arg_filters->'tags' IS NOT NULL THEN
        IF jsonb_typeof(arg_filters->'tags') = 'array' THEN
            SELECT array_agg(trim(value)) INTO v_tags_filter 
            FROM jsonb_array_elements_text(arg_filters->'tags');
        ELSE
            IF strpos(arg_filters->>'tags', ',') > 0 THEN
                 SELECT array_agg(trim(x)) INTO v_tags_filter
                 FROM unnest(string_to_array(arg_filters->>'tags', ',')) t(x);
            ELSE
                 v_tags_filter := ARRAY[trim(arg_filters->>'tags')];
            END IF;
        END IF;
    END IF;


    -- 1. Base Filter
    v_where_clause := format(' WHERE p.tenant_id = %L AND p.type = ''person'' ', arg_tenant_id);

    -- 2. Apply Filters
    
    -- [GLOBAL SEARCH - IMPROVED PERMUTATION LOGIC]
    IF arg_filters->>'search' IS NOT NULL AND length(arg_filters->>'search') > 0 THEN
         v_search_raw := trim(arg_filters->>'search');
         -- Split by one or more spaces
         v_search_parts := regexp_split_to_array(v_search_raw, '\s+');
         
         IF array_length(v_search_parts, 1) = 1 THEN
             -- Single Word: Use Hybrid Logic (Prefix for short, Contains for long)
             IF length(v_search_raw) < 3 THEN
                 v_where_clause := v_where_clause || ' AND lower(p.display_name) LIKE ' || quote_literal(lower(v_search_raw) || '%');
             ELSE
                 v_where_clause := v_where_clause || ' AND p.display_name ILIKE ''%'' || ' || quote_literal(v_search_raw) || ' || ''%'' ';
             END IF;
         ELSE
             -- Multiple Words: Require ALL parts to match (AND logic)
             FOREACH v_part IN ARRAY v_search_parts LOOP
                 -- Ensure we don't process empty strings from split
                 IF length(v_part) > 0 THEN
                     v_where_clause := v_where_clause || ' AND p.display_name ILIKE ''%'' || ' || quote_literal(v_part) || ' || ''%'' ';
                 END IF;
             END LOOP;
         END IF;
    END IF;

    -- [NAME COLUMN FILTER] (Keep simple for column specific?)
    -- Let's apply same logic to ensure consistency? 
    -- User asked for "Search People", usually referring to Global Search. 
    -- But Name Filter should probably behave same. Let's start with Global only to be safe.
    IF arg_filters->>'name' IS NOT NULL AND length(arg_filters->>'name') > 0 THEN
         v_name_filter := arg_filters->>'name';
         IF length(v_name_filter) < 3 THEN
             v_where_clause := v_where_clause || ' AND lower(p.display_name) LIKE ' || quote_literal(lower(v_name_filter) || '%');
         ELSE
             v_where_clause := v_where_clause || ' AND p.display_name ILIKE ''%'' || ' || quote_literal(v_name_filter) || ' || ''%'' ';
         END IF;
    END IF;

    -- Status
    IF v_status_filter IS NOT NULL THEN
        v_where_clause := v_where_clause || format(' AND lower(p.status) = ANY(%L) ', v_status_filter);
    END IF;

    -- Role
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

    -- 4. Sort Logic
    v_sort_logic := (CASE 
        WHEN arg_sort_col = 'name' THEN 'p.display_name'
        WHEN arg_sort_col = 'status' THEN 'p.status'
        WHEN arg_sort_col = 'created_at' THEN 'p.created_at'
        WHEN arg_sort_col = 'role_name' THEN '(SELECT role_name FROM party_memberships pm WHERE pm.person_id = p.id LIMIT 1)'
        WHEN arg_sort_col = 'id' THEN 'p.id'
        ELSE 'p.created_at' 
    END) || ' ' || (CASE WHEN upper(arg_sort_dir) = 'ASC' THEN 'ASC' ELSE 'DESC' END);
    
    v_sort_logic := v_sort_logic || ', p.id ASC ';

    -- 5. Late Row Lookup Execution
    v_query := '
    WITH filtered_ids AS (
        SELECT p.id
        FROM parties p
        ' || v_where_clause || '
        ORDER BY ' || v_sort_logic || '
        OFFSET ' || arg_start || ' LIMIT ' || arg_limit || '
    )
    SELECT 
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
    FROM parties p
    JOIN filtered_ids fi ON p.id = fi.id
    ORDER BY ' || v_sort_logic;

    RETURN QUERY EXECUTE v_query;
END;
$$;
