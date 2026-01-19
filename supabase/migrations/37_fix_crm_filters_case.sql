-- Migration: Fix CRM Filters Case Sensitivity
-- Updates fetch_people_crm to use case-insensitive matching for filters.

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
BEGIN
    -- 1. Base Filter
    v_where_clause := format(' WHERE p.tenant_id = %L AND p.type = ''person'' ', arg_tenant_id);

    -- 2. Add Filters
    -- Search
    IF arg_filters->>'search' IS NOT NULL AND length(arg_filters->>'search') > 0 THEN
         v_where_clause := v_where_clause || ' AND p.display_name ILIKE ''%'' || ' || quote_literal(arg_filters->>'search') || ' || ''%'' ';
    END IF;

    -- Status (Case Insensitive)
    IF arg_filters->>'status' IS NOT NULL THEN
        -- Using ILIKE or LOWER comparison to ensure "Customer" matches "customer"
        v_where_clause := v_where_clause || format(' AND p.status ILIKE %L ', arg_filters->>'status');
    END IF;

    -- Role (Subquery, Case Insensitive)
    IF arg_filters->>'role_name' IS NOT NULL THEN
        v_where_clause := v_where_clause || format(' AND EXISTS (SELECT 1 FROM party_memberships pm WHERE pm.person_id = p.id AND pm.role_name ILIKE %L) ', arg_filters->>'role_name');
    END IF;
    
    -- Company Size (Subquery, Case Insensitive)
    IF arg_filters->>'company_size' IS NOT NULL THEN
        v_where_clause := v_where_clause || format(' 
        AND EXISTS (
            SELECT 1 FROM party_memberships pm 
            JOIN parties org ON pm.organization_id = org.id
            JOIN organizations_ext oe ON org.id = oe.party_id
            WHERE pm.person_id = p.id AND oe.company_size ILIKE %L
        ) ', arg_filters->>'company_size');
    END IF;

    -- Industry (Subquery, Case Insensitive)
    IF arg_filters->>'industry' IS NOT NULL THEN
        v_where_clause := v_where_clause || format(' 
        AND EXISTS (
            SELECT 1 FROM party_memberships pm 
            JOIN parties org ON pm.organization_id = org.id
            JOIN organizations_ext oe ON org.id = oe.party_id
            WHERE pm.person_id = p.id AND oe.industry ILIKE %L
        ) ', arg_filters->>'industry');
    END IF;

    -- Tags (Array Contains) - Case sensitive usually for arrays, but let's keep standard behavior for now.
    -- Arrays are harder to ILIKE without unnesting. Keeping it standard.
    IF arg_filters->>'tags' IS NOT NULL THEN
        v_where_clause := v_where_clause || format(' AND p.tags @> ARRAY[%L]::text[] ', arg_filters->>'tags');
    END IF;

    -- Join Date Logic (Year/Month/Quarter)
    -- We filter on p.created_at using to_char matches
    IF arg_filters->>'joined_year' IS NOT NULL THEN
        v_where_clause := v_where_clause || format(' AND to_char(p.created_at, ''YYYY'') = %L ', arg_filters->>'joined_year');
    END IF;
    
    IF arg_filters->>'joined_month' IS NOT NULL THEN
        v_where_clause := v_where_clause || format(' AND to_char(p.created_at, ''YYYY-MM'') = %L ', arg_filters->>'joined_month');
    END IF;
    
    IF arg_filters->>'joined_quarter' IS NOT NULL THEN
        v_where_clause := v_where_clause || format(' AND to_char(p.created_at, ''YYYY "Q"Q'') = %L ', arg_filters->>'joined_quarter');
    END IF;
    
    -- Added: joined_week
    IF arg_filters->>'joined_week' IS NOT NULL THEN
        v_where_clause := v_where_clause || format(' AND to_char(p.created_at, ''IYYY-IW'') = %L ', arg_filters->>'joined_week');
    END IF;

    -- 3. Get Total Count
    EXECUTE 'SELECT count(*) FROM parties p ' || v_where_clause INTO v_total_rows;

    -- 4. Execute Main Query
    v_query := 'SELECT 
        p.id, 
        p.display_name, 
        p.contact_methods, 
        coalesce(p.tags, ARRAY[]::text[]), 
        coalesce(p.status, ''lead''), 
        coalesce(p.rating, 0), 
        p.last_interaction_at, 
        p.updated_at, 
        ' || v_total_rows || '::bigint
    FROM parties p '
    || v_where_clause ||
    ' ORDER BY ' || 
    (CASE 
        WHEN arg_sort_col = 'name' THEN 'p.display_name'
        WHEN arg_sort_col = 'status' THEN 'p.status'
        ELSE 'p.updated_at' 
    END) || ' ' || (CASE WHEN upper(arg_sort_dir) = 'ASC' THEN 'ASC' ELSE 'DESC' END) ||
    ' OFFSET ' || arg_start || ' LIMIT ' || arg_limit;

    RETURN QUERY EXECUTE v_query;
END;
$$;
