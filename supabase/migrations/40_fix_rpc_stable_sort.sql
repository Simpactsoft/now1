-- Migration: Fix Unstable Sorting
-- Updates fetch_people_crm to include a deterministic tie-breaker (ID) in ORDER BY.

-- Drop first to allow replacement
DROP FUNCTION IF EXISTS fetch_people_crm(uuid, int, int, text, text, jsonb);

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
BEGIN
    -- 1. Base Filter
    v_where_clause := format(' WHERE p.tenant_id = %L AND p.type = ''person'' ', arg_tenant_id);

    -- 2. Add Filters
    -- Search
    IF arg_filters->>'search' IS NOT NULL AND length(arg_filters->>'search') > 0 THEN
         v_where_clause := v_where_clause || ' AND p.display_name ILIKE ''%'' || ' || quote_literal(arg_filters->>'search') || ' || ''%'' ';
    END IF;

    -- Status
    IF arg_filters->'status' IS NOT NULL THEN
        IF jsonb_typeof(arg_filters->'status') = 'array' THEN
            v_where_clause := v_where_clause || ' AND lower(p.status) IN (SELECT lower(value) FROM jsonb_array_elements_text(' || quote_literal(arg_filters->'status') || ')) ';
        ELSE
             v_where_clause := v_where_clause || format(' AND p.status ILIKE %L ', arg_filters->>'status');
        END IF;
    END IF;

    -- Role
    IF arg_filters->'role_name' IS NOT NULL THEN
        IF jsonb_typeof(arg_filters->'role_name') = 'array' THEN
            v_where_clause := v_where_clause || ' 
            AND EXISTS (
                SELECT 1 FROM party_memberships pm 
                WHERE pm.person_id = p.id 
                AND lower(pm.role_name) IN (SELECT lower(value) FROM jsonb_array_elements_text(' || quote_literal(arg_filters->'role_name') || '))
            ) ';
        ELSE
             v_where_clause := v_where_clause || format(' AND EXISTS (SELECT 1 FROM party_memberships pm WHERE pm.person_id = p.id AND pm.role_name ILIKE %L) ', arg_filters->>'role_name');
        END IF;
    END IF;

    -- Joined Year
    IF arg_filters->'joined_year' IS NOT NULL THEN
        IF jsonb_typeof(arg_filters->'joined_year') = 'array' THEN
             v_where_clause := v_where_clause || ' AND to_char(p.created_at, ''YYYY'') IN (SELECT value FROM jsonb_array_elements_text(' || quote_literal(arg_filters->'joined_year') || ')) ';
        ELSE
             v_where_clause := v_where_clause || format(' AND to_char(p.created_at, ''YYYY'') = %L ', arg_filters->>'joined_year');
        END IF;
    END IF;
    
    -- Tags
    IF arg_filters->'tags' IS NOT NULL THEN
        IF jsonb_typeof(arg_filters->'tags') = 'array' THEN
             v_where_clause := v_where_clause || format(' AND p.tags && ARRAY(SELECT value FROM jsonb_array_elements_text(%L))::text[] ', arg_filters->'tags');
        ELSE
             v_where_clause := v_where_clause || format(' AND p.tags @> ARRAY[%L]::text[] ', arg_filters->>'tags');
        END IF;
    END IF;

    -- 3. Get Total Count
    EXECUTE 'SELECT count(*) FROM parties p ' || v_where_clause INTO v_total_rows;

    -- 4. Sort Logic Construction
    v_sort_logic := (CASE 
        WHEN arg_sort_col = 'name' THEN 'p.display_name'
        WHEN arg_sort_col = 'status' THEN 'p.status'
        ELSE 'p.updated_at' 
    END) || ' ' || (CASE WHEN upper(arg_sort_dir) = 'ASC' THEN 'ASC' ELSE 'DESC' END);

    -- [NEW] Add Secondary Deterministic Sort (Tie-Breaker)
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
