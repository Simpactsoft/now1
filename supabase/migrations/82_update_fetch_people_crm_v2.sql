-- Update fetch_people_crm to support Array Filters for Role and Check Custom Fields
-- Fixes "No Results" when filtering by Role and allows Custom Role filtering

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
    ret_role_name text, -- Added Return Field for Debugging/Display
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

    -- Status (Support Array or String)
    IF arg_filters->'status' IS NOT NULL AND jsonb_typeof(arg_filters->'status') = 'array' THEN
        v_where_clause := v_where_clause || format(' AND p.status IN (SELECT jsonb_array_elements_text(%L::jsonb)) ', arg_filters->'status');
    ELSIF arg_filters->>'status' IS NOT NULL THEN
        v_where_clause := v_where_clause || format(' AND p.status = %L ', arg_filters->>'status');
    END IF;

    -- Role (Support Array or String + Custom Fields Fallback)
    IF arg_filters->'role_name' IS NOT NULL AND jsonb_typeof(arg_filters->'role_name') = 'array' THEN
         -- Check Membership Role OR Custom Field Role
         v_where_clause := v_where_clause || format(' AND (
            EXISTS (
                SELECT 1 FROM party_memberships pm 
                WHERE pm.person_id = p.id 
                AND pm.role_name IN (SELECT jsonb_array_elements_text(%L::jsonb))
            )
            OR 
            (p.custom_fields->>''role'') IN (SELECT jsonb_array_elements_text(%L::jsonb))
         )', arg_filters->'role_name', arg_filters->'role_name');
    ELSIF arg_filters->>'role_name' IS NOT NULL THEN
         -- Fallback for single string
         v_where_clause := v_where_clause || format(' AND (
            EXISTS (SELECT 1 FROM party_memberships pm WHERE pm.person_id = p.id AND pm.role_name = %L)
            OR (p.custom_fields->>''role'') = %L
         )', arg_filters->>'role_name', arg_filters->>'role_name');
    END IF;
    
    -- Company Size (Subquery)
    IF arg_filters->>'company_size' IS NOT NULL THEN
        v_where_clause := v_where_clause || format(' 
        AND EXISTS (
            SELECT 1 FROM party_memberships pm 
            JOIN parties org ON pm.organization_id = org.id
            JOIN organizations_ext oe ON org.id = oe.party_id
            WHERE pm.person_id = p.id AND oe.company_size = %L
        ) ', arg_filters->>'company_size');
    END IF;

    -- Industry (Subquery)
    IF arg_filters->>'industry' IS NOT NULL THEN
        v_where_clause := v_where_clause || format(' 
        AND EXISTS (
            SELECT 1 FROM party_memberships pm 
            JOIN parties org ON pm.organization_id = org.id
            JOIN organizations_ext oe ON org.id = oe.party_id
            WHERE pm.person_id = p.id AND oe.industry = %L
        ) ', arg_filters->>'industry');
    END IF;

    -- Tags (Array Contains)
    IF arg_filters->>'tags' IS NOT NULL THEN
         -- Support checking if tags array overlaps (OR logic) or contains (AND logic). 
         -- Usually filter chips imply OR if multiple selected? 
         -- Current fetchPeople sends array. Let's assume overlap (&&) for flexibility, or @> for strict.
         -- Previous implementation used @>. Let's stick strictly to passed JSON logic.
         -- If we want "Contains ANY", use &&. If "Contains ALL", use @>.
         -- Users usually expect ANY.
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
        -- Priority: Membership Role, then Custom Field Role
        coalesce(
            (SELECT role_name FROM party_memberships pm WHERE pm.person_id = p.id LIMIT 1),
            p.custom_fields->>'role'
        ) as ret_role_name,
        ' || v_total_rows || '::bigint
    FROM parties p '
    || v_where_clause ||
    ' ORDER BY ' || 
    (CASE 
        WHEN arg_sort_col = 'name' THEN 'p.display_name'
        WHEN arg_sort_col = 'status' THEN 'p.status'
        ELSE 'p.created_at' -- Changed default to created_at
    END) || ' ' || (CASE WHEN upper(arg_sort_dir) = 'ASC' THEN 'ASC' ELSE 'DESC' END) ||
    ' OFFSET ' || arg_start || ' LIMIT ' || arg_limit;

    RETURN QUERY EXECUTE v_query;
END;
$$;
