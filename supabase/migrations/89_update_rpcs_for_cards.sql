-- Migration: 89_update_rpcs_for_cards.sql
-- Description: Updates core RPCs to use 'cards' table instead of 'parties' following migration 88.
-- INCLUDES OPTIMIZATIONS from Migration 91 (Hybrid Search) to prevent timeouts.
-- INCLUDES FIX for 'name' filter.
-- INCLUDES FIX for 'tags' type mismatch.

-- 1. Update get_people_count to use 'cards'
CREATE OR REPLACE FUNCTION get_people_count(
    arg_tenant_id uuid,
    arg_filters jsonb DEFAULT '{}'::jsonb
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_total_rows bigint;
    v_where_clause text;
    v_search_term text;
BEGIN
    -- Base Filter: parties -> cards
    v_where_clause := format(' WHERE p.tenant_id = %L AND p.type = ''person'' ', arg_tenant_id);

    -- Search Optimization (Global Search)
    v_search_term := arg_filters->>'search';
    IF v_search_term IS NOT NULL AND length(v_search_term) > 0 THEN
         IF length(v_search_term) < 3 THEN
             -- Short term: Prefix Search (Anchored at start)
             v_where_clause := v_where_clause || ' AND p.display_name ILIKE ' || quote_literal(v_search_term || '%');
         ELSE
             -- Long term: Contains Search
             v_where_clause := v_where_clause || ' AND p.display_name ILIKE ' || quote_literal('%' || v_search_term || '%');
         END IF;
    END IF;

    -- Name Filter (Specific Column)
    -- Supports both exact/partial match logic similar to search but specific to name column
    IF arg_filters->'name' IS NOT NULL THEN
         IF jsonb_typeof(arg_filters->'name') = 'array' THEN
             v_where_clause := v_where_clause || format(' AND (
                EXISTS (SELECT 1 FROM jsonb_array_elements_text(%L::jsonb) t(x) WHERE p.display_name ILIKE ''%%'' || x || ''%%'')
             ) ', arg_filters->'name');
         ELSE
             v_where_clause := v_where_clause || ' AND p.display_name ILIKE ''%'' || ' || quote_literal(arg_filters->>'name') || ' || ''%'' ';
         END IF;
    END IF;

    -- Status
    IF arg_filters->'status' IS NOT NULL AND jsonb_typeof(arg_filters->'status') = 'array' THEN
        v_where_clause := v_where_clause || format(' AND lower(p.status) IN (SELECT lower(x) FROM jsonb_array_elements_text(%L::jsonb) t(x)) ', arg_filters->'status');
    ELSIF arg_filters->>'status' IS NOT NULL THEN
        v_where_clause := v_where_clause || format(' AND lower(p.status) = lower(%L) ', arg_filters->>'status');
    END IF;

    -- Role
    IF arg_filters->'role_name' IS NOT NULL AND jsonb_typeof(arg_filters->'role_name') = 'array' THEN
         v_where_clause := v_where_clause || format(' AND (
            EXISTS (
                SELECT 1 FROM party_memberships pm 
                WHERE pm.person_id = p.id 
                AND lower(trim(pm.role_name)) IN (SELECT lower(trim(x)) FROM jsonb_array_elements_text(%L::jsonb) t(x))
            )
            OR 
            (lower(trim(p.custom_fields->>''role''))) IN (SELECT lower(trim(x)) FROM jsonb_array_elements_text(%L::jsonb) t(x))
         )', arg_filters->'role_name', arg_filters->'role_name');
    ELSIF arg_filters->>'role_name' IS NOT NULL THEN
         v_where_clause := v_where_clause || format(' AND (
            EXISTS (SELECT 1 FROM party_memberships pm WHERE pm.person_id = p.id AND lower(trim(pm.role_name)) = lower(trim(%L)))
            OR (lower(trim(p.custom_fields->>''role''))) = lower(trim(%L))
         )', arg_filters->>'role_name', arg_filters->>'role_name');
    END IF;
    
    -- Company Size
    IF arg_filters->>'company_size' IS NOT NULL THEN
        v_where_clause := v_where_clause || format(' 
        AND EXISTS (
            SELECT 1 FROM party_memberships pm 
            JOIN cards org ON pm.organization_id = org.id
            JOIN organizations oe ON org.id = oe.card_id
            WHERE pm.person_id = p.id AND oe.company_size = %L
        ) ', arg_filters->>'company_size');
    END IF;

    -- Industry
    IF arg_filters->>'industry' IS NOT NULL THEN
        v_where_clause := v_where_clause || format(' 
        AND EXISTS (
            SELECT 1 FROM party_memberships pm 
            JOIN cards org ON pm.organization_id = org.id
            JOIN organizations oe ON org.id = oe.card_id
            WHERE pm.person_id = p.id AND oe.industry = %L
        ) ', arg_filters->>'industry');
    END IF;

    -- Tags
    IF arg_filters->>'tags' IS NOT NULL THEN
         IF jsonb_typeof(arg_filters->'tags') = 'array' THEN
            -- [Changed] Use @> (Contains All) instead of && (Overlap) for AND logic
            v_where_clause := v_where_clause || format(' AND p.tags @> (SELECT array_agg(x) FROM jsonb_array_elements_text(%L::jsonb) t(x)) ', arg_filters->'tags');
         ELSE
            v_where_clause := v_where_clause || format(' AND p.tags @> ARRAY[%L]::text[] ', arg_filters->>'tags');
         END IF;
    END IF;

    -- Join Date
    IF arg_filters->>'joined_year' IS NOT NULL THEN
        v_where_clause := v_where_clause || format(' AND to_char(p.created_at, ''YYYY'') = %L ', arg_filters->>'joined_year');
    END IF;

    -- Execute Count on cards
    EXECUTE 'SELECT count(*) FROM cards p ' || v_where_clause INTO v_total_rows;
    RETURN v_total_rows;
END;
$$;


-- 2. Update fetch_people_data to use 'cards'
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
    v_search_term text;
BEGIN
    -- Base Filter: parties -> cards
    v_where_clause := format(' WHERE p.tenant_id = %L AND p.type = ''person'' ', arg_tenant_id);

    -- Search Optimization (Global Search)
    v_search_term := arg_filters->>'search';
    IF v_search_term IS NOT NULL AND length(v_search_term) > 0 THEN
         IF length(v_search_term) < 3 THEN
             v_where_clause := v_where_clause || ' AND p.display_name ILIKE ' || quote_literal(v_search_term || '%');
         ELSE
             v_where_clause := v_where_clause || ' AND p.display_name ILIKE ' || quote_literal('%' || v_search_term || '%');
         END IF;
    END IF;

    -- Name Filter (Specific Column)
    IF arg_filters->'name' IS NOT NULL THEN
         IF jsonb_typeof(arg_filters->'name') = 'array' THEN
             v_where_clause := v_where_clause || format(' AND (
                EXISTS (SELECT 1 FROM jsonb_array_elements_text(%L::jsonb) t(x) WHERE p.display_name ILIKE ''%%'' || x || ''%%'')
             ) ', arg_filters->'name');
         ELSE
             v_where_clause := v_where_clause || ' AND p.display_name ILIKE ''%'' || ' || quote_literal(arg_filters->>'name') || ' || ''%'' ';
         END IF;
    END IF;

    -- Status
    IF arg_filters->'status' IS NOT NULL AND jsonb_typeof(arg_filters->'status') = 'array' THEN
        v_where_clause := v_where_clause || format(' AND lower(p.status) IN (SELECT lower(x) FROM jsonb_array_elements_text(%L::jsonb) t(x)) ', arg_filters->'status');
    ELSIF arg_filters->>'status' IS NOT NULL THEN
        v_where_clause := v_where_clause || format(' AND lower(p.status) = lower(%L) ', arg_filters->>'status');
    END IF;

    -- Role
    IF arg_filters->'role_name' IS NOT NULL AND jsonb_typeof(arg_filters->'role_name') = 'array' THEN
         v_where_clause := v_where_clause || format(' AND (
            EXISTS (
                SELECT 1 FROM party_memberships pm 
                WHERE pm.person_id = p.id 
                AND lower(trim(pm.role_name)) IN (SELECT lower(trim(x)) FROM jsonb_array_elements_text(%L::jsonb) t(x))
            )
            OR 
            (lower(trim(p.custom_fields->>''role''))) IN (SELECT lower(trim(x)) FROM jsonb_array_elements_text(%L::jsonb) t(x))
         )', arg_filters->'role_name', arg_filters->'role_name');
    ELSIF arg_filters->>'role_name' IS NOT NULL THEN
         v_where_clause := v_where_clause || format(' AND (
            EXISTS (SELECT 1 FROM party_memberships pm WHERE pm.person_id = p.id AND lower(trim(pm.role_name)) = lower(trim(%L)))
            OR (lower(trim(p.custom_fields->>''role''))) = lower(trim(%L))
         )', arg_filters->>'role_name', arg_filters->>'role_name');
    END IF;
    
    -- Company Size (Update JOINs)
    IF arg_filters->>'company_size' IS NOT NULL THEN
        v_where_clause := v_where_clause || format(' 
        AND EXISTS (
            SELECT 1 FROM party_memberships pm 
            JOIN cards org ON pm.organization_id = org.id
            JOIN organizations oe ON org.id = oe.card_id
            WHERE pm.person_id = p.id AND oe.company_size = %L
        ) ', arg_filters->>'company_size');
    END IF;

    -- Industry
    IF arg_filters->>'industry' IS NOT NULL THEN
        v_where_clause := v_where_clause || format(' 
        AND EXISTS (
            SELECT 1 FROM party_memberships pm 
            JOIN cards org ON pm.organization_id = org.id
            JOIN organizations oe ON org.id = oe.card_id
            WHERE pm.person_id = p.id AND oe.industry = %L
        ) ', arg_filters->>'industry');
    END IF;

    -- Tags
    IF arg_filters->>'tags' IS NOT NULL THEN
         IF jsonb_typeof(arg_filters->'tags') = 'array' THEN
            -- [Changed] Use @> (Contains All) instead of && (Overlap) for AND logic
            v_where_clause := v_where_clause || format(' AND p.tags @> (SELECT array_agg(x) FROM jsonb_array_elements_text(%L::jsonb) t(x)) ', arg_filters->'tags');
         ELSE
            v_where_clause := v_where_clause || format(' AND p.tags @> ARRAY[%L]::text[] ', arg_filters->>'tags');
         END IF;
    END IF;

    -- Join Date
    IF arg_filters->>'joined_year' IS NOT NULL THEN
        v_where_clause := v_where_clause || format(' AND to_char(p.created_at, ''YYYY'') = %L ', arg_filters->>'joined_year');
    END IF;

    -- Execute Main Query on cards
    v_query := format('SELECT 
        p.id, 
        p.display_name, 
        p.contact_methods, 
        coalesce(p.tags, ARRAY[]::text[]), 
        coalesce(p.status, ''lead''), 
        coalesce(p.rating, 0), 
        p.last_interaction_at, 
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


-- 3. Update fetch_person_profile to use 'cards'
DROP FUNCTION IF EXISTS fetch_person_profile(uuid, uuid);
CREATE OR REPLACE FUNCTION fetch_person_profile(
    arg_tenant_id uuid,
    arg_person_id uuid
)
RETURNS TABLE (
    id uuid,
    display_name text,
    avatar_url text,
    type text,
    email text,
    phone text,
    city text,
    country text,
    job_title text,
    employer text,
    created_at timestamptz,
    tags jsonb,
    custom_fields jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.id,
        p.display_name,
        p.avatar_url,
        p.type::text,
        -- Extract email using JSON Path (cleaner and safer)
        jsonb_path_query_first(p.contact_methods, '$[*] ? (@.type == "email").value') #>> '{}' as email,
        -- Extract phone using JSON Path
        jsonb_path_query_first(p.contact_methods, '$[*] ? (@.type == "phone").value') #>> '{}' as phone,
        -- Extract location from custom_fields
        (p.custom_fields->>'city')::text as city,
        (p.custom_fields->>'country')::text as country,
        -- Get latest role info if available
        m.role_name as job_title,
        org.display_name as employer,
        p.created_at,
        to_jsonb(coalesce(p.tags, ARRAY[]::text[])),
        p.custom_fields
    FROM cards p  -- UPDATED from parties
    LEFT JOIN party_memberships m ON p.id = m.person_id AND m.tenant_id = arg_tenant_id
    LEFT JOIN cards org ON m.organization_id = org.id -- UPDATED from parties
    WHERE p.id = arg_person_id AND p.tenant_id = arg_tenant_id;
END;
$$;
