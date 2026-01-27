-- Split fetch_people_crm into two functions: one for data, one for count
-- This avoids the expensive count(*) on every page load

-- 1. Create function to get ONLY the count (cheaper, but still needs indexes)
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
            JOIN parties org ON pm.organization_id = org.id
            JOIN organizations_ext oe ON org.id = oe.party_id
            WHERE pm.person_id = p.id AND oe.company_size = %L
        ) ', arg_filters->>'company_size');
    END IF;

    -- Industry
    IF arg_filters->>'industry' IS NOT NULL THEN
        v_where_clause := v_where_clause || format(' 
        AND EXISTS (
            SELECT 1 FROM party_memberships pm 
            JOIN parties org ON pm.organization_id = org.id
            JOIN organizations_ext oe ON org.id = oe.party_id
            WHERE pm.person_id = p.id AND oe.industry = %L
        ) ', arg_filters->>'industry');
    END IF;

    -- Tags
    IF arg_filters->>'tags' IS NOT NULL THEN
         IF jsonb_typeof(arg_filters->'tags') = 'array' THEN
            v_where_clause := v_where_clause || format(' AND p.tags && (SELECT array_agg(x) FROM jsonb_array_elements_text(%L::jsonb) t(x)) ', arg_filters->'tags');
         ELSE
            v_where_clause := v_where_clause || format(' AND p.tags @> ARRAY[%L]::text[] ', arg_filters->>'tags');
         END IF;
    END IF;

    -- Join Date Logic
    IF arg_filters->>'joined_year' IS NOT NULL THEN
        v_where_clause := v_where_clause || format(' AND to_char(p.created_at, ''YYYY'') = %L ', arg_filters->>'joined_year');
    END IF;

    -- Execute Count
    EXECUTE 'SELECT count(*) FROM parties p ' || v_where_clause INTO v_total_rows;
    RETURN v_total_rows;
END;
$$;


-- 2. Create optimized fetch_people_data function (No Count)
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
    -- Removed ret_total_count
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
            JOIN parties org ON pm.organization_id = org.id
            JOIN organizations_ext oe ON org.id = oe.party_id
            WHERE pm.person_id = p.id AND oe.company_size = %L
        ) ', arg_filters->>'company_size');
    END IF;

    -- Industry
    IF arg_filters->>'industry' IS NOT NULL THEN
        v_where_clause := v_where_clause || format(' 
        AND EXISTS (
            SELECT 1 FROM party_memberships pm 
            JOIN parties org ON pm.organization_id = org.id
            JOIN organizations_ext oe ON org.id = oe.party_id
            WHERE pm.person_id = p.id AND oe.industry = %L
        ) ', arg_filters->>'industry');
    END IF;

    -- Tags
    IF arg_filters->>'tags' IS NOT NULL THEN
         IF jsonb_typeof(arg_filters->'tags') = 'array' THEN
            v_where_clause := v_where_clause || format(' AND p.tags && (SELECT array_agg(x) FROM jsonb_array_elements_text(%L::jsonb) t(x)) ', arg_filters->'tags');
         ELSE
            v_where_clause := v_where_clause || format(' AND p.tags @> ARRAY[%L]::text[] ', arg_filters->>'tags');
         END IF;
    END IF;

    -- Join Date Logic
    IF arg_filters->>'joined_year' IS NOT NULL THEN
        v_where_clause := v_where_clause || format(' AND to_char(p.created_at, ''YYYY'') = %L ', arg_filters->>'joined_year');
    END IF;

    -- Execute Main Query
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
    FROM parties p 
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
