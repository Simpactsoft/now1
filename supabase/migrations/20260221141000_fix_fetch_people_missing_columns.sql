-- Migration: Fix fetch_people_crm "last_interaction_at does not exist"
-- Description: Overwrites `fetch_people_crm` and `fetch_people_data` to safely drop `c.last_interaction_at` and ensure stable loading of the people views.

BEGIN;

CREATE OR REPLACE FUNCTION fetch_people_data(
    arg_tenant_id uuid,
    arg_start integer DEFAULT 0,
    arg_limit integer DEFAULT 100,
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
    ret_rating integer,  
    ret_last_interaction timestamptz,
    ret_updated_at timestamptz,
    ret_role_name text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_query text;
    v_where_clause text;
BEGIN
    -- Base Filter
    v_where_clause := format(' WHERE p.tenant_id = %L AND p.type = ''person'' ', arg_tenant_id);

    -- Search
    IF arg_filters->>'search' IS NOT NULL AND length(arg_filters->>'search') > 0 THEN
         v_where_clause := v_where_clause || ' AND p.display_name ILIKE ''%'' || ' || quote_literal(arg_filters->>'search') || ' || ''%'' ';
    END IF;

    -- Status
    IF arg_filters->'status' IS NOT NULL AND jsonb_typeof(arg_filters->'status') = 'array' THEN
        v_where_clause := v_where_clause || format(' AND lower(p.status) IN (SELECT lower(x) FROM jsonb_array_elements_text(%L::jsonb) t(x)) ', arg_filters->'status');
    ELSIF arg_filters->>'status' IS NOT NULL THEN
        v_where_clause := v_where_clause || format(' AND lower(p.status) = lower(%L) ', arg_filters->>'status');
    END IF;

    -- Role (Updated: Handle 'contact' default)
    IF arg_filters->'role_name' IS NOT NULL AND jsonb_typeof(arg_filters->'role_name') = 'array' THEN
         v_where_clause := v_where_clause || format(' AND (
            -- 1. Explicit Role Matches
            EXISTS (
                SELECT 1 FROM party_memberships pm 
                WHERE pm.person_id = p.id 
                AND lower(pm.role_name) ILIKE ANY (SELECT ''%%'' || lower(x) || ''%%'' FROM jsonb_array_elements_text(%L::jsonb) t(x))
            )
            OR 
            (lower(p.custom_fields->>''role'') ILIKE ANY (SELECT ''%%'' || lower(x) || ''%%'' FROM jsonb_array_elements_text(%L::jsonb) t(x)))
            
            -- 2. Implicit "contact" Match
            OR (
                (NOT EXISTS (SELECT 1 FROM party_memberships pm WHERE pm.person_id = p.id) AND p.custom_fields->>''role'' IS NULL)
                AND 
                (''contact'' ILIKE ANY (SELECT ''%%'' || lower(x) || ''%%'' FROM jsonb_array_elements_text(%L::jsonb) t(x)))
            )
         )', arg_filters->'role_name', arg_filters->'role_name', arg_filters->'role_name');
    ELSIF arg_filters->>'role_name' IS NOT NULL THEN
         v_where_clause := v_where_clause || format(' AND (
            EXISTS (SELECT 1 FROM party_memberships pm WHERE pm.person_id = p.id AND lower(pm.role_name) ILIKE ''%%'' || lower(%L) || ''%%'')
            OR (lower(p.custom_fields->>''role'') ILIKE ''%%'' || lower(%L) || ''%%'')
            OR (
                (NOT EXISTS (SELECT 1 FROM party_memberships pm WHERE pm.person_id = p.id) AND p.custom_fields->>''role'' IS NULL)
                AND (''contact'' ILIKE ''%%'' || lower(%L) || ''%%'')
            )
         )', arg_filters->>'role_name', arg_filters->>'role_name', arg_filters->>'role_name');
    END IF;
    
    -- Tags
    IF arg_filters->>'tags' IS NOT NULL THEN
         IF jsonb_typeof(arg_filters->'tags') = 'array' THEN
            v_where_clause := v_where_clause || format(' AND p.tags && (SELECT array_agg(x) FROM jsonb_array_elements_text(%L::jsonb) t(x)) ', arg_filters->'tags');
         ELSE
            v_where_clause := v_where_clause || format(' AND p.tags @> ARRAY[%L]::text[] ', arg_filters->>'tags');
         END IF;
    END IF;

    v_query := format('SELECT 
        p.id, 
        p.display_name, 
        p.contact_methods, 
        coalesce(p.tags, ARRAY[]::text[]), 
        coalesce(p.status, ''lead''), 
        0 as ret_rating, 
        null::timestamptz as ret_last_interaction, 
        p.updated_at, 
        coalesce(
            (SELECT role_name FROM party_memberships pm WHERE pm.person_id = p.id LIMIT 1),
            jsonb_extract_path_text(p.custom_fields, ''role'')
        ) as ret_role_name
    FROM cards p 
    %s
    ORDER BY %s %s
    OFFSET %s LIMIT %s',
        v_where_clause,
        CASE 
            WHEN arg_sort_col = 'name' THEN 'p.display_name'
            WHEN arg_sort_col = 'status' THEN 'p.status'
            ELSE 'p.created_at' 
        END,
        CASE WHEN upper(arg_sort_dir) = 'ASC' THEN 'ASC' ELSE 'DESC' END,
        arg_start,
        arg_limit
    );

    RETURN QUERY EXECUTE v_query;
END;
$$;

-- Wrapper function
CREATE OR REPLACE FUNCTION fetch_people_crm(
    arg_tenant_id uuid,
    arg_start integer DEFAULT 0,
    arg_limit integer DEFAULT 100,
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
    ret_rating integer,  
    ret_last_interaction timestamptz,
    ret_updated_at timestamptz,
    ret_role_name text,
    ret_total_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_total_count bigint;
BEGIN
    v_total_count := get_people_count(arg_tenant_id, arg_filters);

    RETURN QUERY 
    SELECT 
        d.ret_id,
        d.ret_name,
        d.ret_contact_info,
        d.ret_tags,
        d.ret_status,
        d.ret_rating,
        d.ret_last_interaction,
        d.ret_updated_at,
        d.ret_role_name,
        v_total_count as ret_total_count
    FROM fetch_people_data(
        arg_tenant_id, 
        arg_start, 
        arg_limit, 
        arg_sort_col, 
        arg_sort_dir, 
        arg_filters
    ) d;
END;
$$;

GRANT EXECUTE ON FUNCTION fetch_people_crm(uuid, integer, integer, text, text, jsonb) TO authenticated, anon;

COMMIT;
