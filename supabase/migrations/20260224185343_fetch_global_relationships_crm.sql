-- Migration: fetch_global_relationships_crm
-- Description: RPC for pulling a paginated list of all relationships in the tenant for the global grid.

CREATE OR REPLACE FUNCTION public.fetch_global_relationships_crm(
    arg_tenant_id uuid,
    arg_start integer,
    arg_limit integer,
    arg_sort_col text,
    arg_sort_dir text,
    arg_filters jsonb DEFAULT '{}'::jsonb
)
RETURNS TABLE(
    ret_total_count bigint,
    ret_id uuid,
    ret_created_at timestamptz,
    ret_metadata jsonb,
    
    -- Source Data
    source_id uuid,
    source_name text,
    source_type text,
    source_avatar_url text,
    source_email text,
    source_phone text,

    -- Target Data
    target_id uuid,
    target_name text,
    target_type text,
    target_avatar_url text,
    target_email text,
    target_phone text,

    -- Type Data
    rel_type_id uuid,
    rel_type_name text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_sql text;
    v_where_clause text := 'er.tenant_id = $1';
    v_order_clause text;
    v_param_search text := NULL;
    v_param_type_names text[] := NULL;
    v_param_source_types text[] := NULL;
    v_param_target_types text[] := NULL;
BEGIN
    -- 1. Parse Search Filter
    IF arg_filters ? 'search' AND (arg_filters->>'search') != '' THEN
        v_param_search := '%' || (arg_filters->>'search') || '%';
        v_where_clause := v_where_clause || ' AND (
            s_card.display_name ILIKE $4 OR 
            t_card.display_name ILIKE $4 OR
            rt.name ILIKE $4
        )';
    END IF;

    -- 2. Parse Other Filters (Optional Extensibility)
    IF arg_filters ? 'type_name' THEN
        SELECT array_agg(value#>>'{}') INTO v_param_type_names
        FROM jsonb_array_elements(arg_filters->'type_name');
        
        v_where_clause := v_where_clause || ' AND rt.name = ANY($5)';
    END IF;

    IF arg_filters ? 'source_type' THEN
        SELECT array_agg(value#>>'{}') INTO v_param_source_types
        FROM jsonb_array_elements(arg_filters->'source_type');
        v_where_clause := v_where_clause || ' AND s_card.type = ANY($6)';
    END IF;

    IF arg_filters ? 'target_type' THEN
        SELECT array_agg(value#>>'{}') INTO v_param_target_types
        FROM jsonb_array_elements(arg_filters->'target_type');
        v_where_clause := v_where_clause || ' AND t_card.type = ANY($7)';
    END IF;

    -- 3. Dynamic Sorting
    IF arg_sort_col = 'created_at' THEN
        v_order_clause := 'er.created_at ' || arg_sort_dir;
    ELSIF arg_sort_col = 'source_name'  THEN
        v_order_clause := 's_card.display_name ' || arg_sort_dir;
    ELSIF arg_sort_col = 'target_name'  THEN
        v_order_clause := 't_card.display_name ' || arg_sort_dir;
    ELSIF arg_sort_col = 'rel_type_name'  THEN
        v_order_clause := 'rt.name ' || arg_sort_dir;
    ELSE
        v_order_clause := 'er.created_at DESC';
    END IF;

    -- 4. Build Full Query
    v_sql := '
    WITH filter_match AS (
        SELECT 
            er.id
        FROM entity_relationships er
        INNER JOIN cards s_card ON er.source_id = s_card.id
        INNER JOIN cards t_card ON er.target_id = t_card.id
        INNER JOIN relationship_types rt ON er.type_id = rt.id
        WHERE ' || v_where_clause || '
    ),
    counted AS (
        SELECT count(*) AS total_count FROM filter_match
    ),
    paged AS (
        SELECT 
            er.id AS ret_id,
            er.created_at AS ret_created_at,
            er.metadata AS ret_metadata,
            
            s_card.id AS source_id,
            s_card.display_name AS source_name,
            s_card.type AS source_type,
            NULL::text AS source_avatar_url,
            CASE WHEN jsonb_typeof(COALESCE(s_card.contact_methods, ''[]''::jsonb)) = ''array'' THEN (SELECT m->>''value'' FROM jsonb_array_elements(s_card.contact_methods) m WHERE m->>''type'' = ''email'' LIMIT 1) ELSE NULL END AS source_email,
            CASE WHEN jsonb_typeof(COALESCE(s_card.contact_methods, ''[]''::jsonb)) = ''array'' THEN (SELECT m->>''value'' FROM jsonb_array_elements(s_card.contact_methods) m WHERE m->>''type'' = ''phone'' LIMIT 1) ELSE NULL END AS source_phone,

            t_card.id AS target_id,
            t_card.display_name AS target_name,
            t_card.type AS target_type,
            NULL::text AS target_avatar_url,
            CASE WHEN jsonb_typeof(COALESCE(t_card.contact_methods, ''[]''::jsonb)) = ''array'' THEN (SELECT m->>''value'' FROM jsonb_array_elements(t_card.contact_methods) m WHERE m->>''type'' = ''email'' LIMIT 1) ELSE NULL END AS target_email,
            CASE WHEN jsonb_typeof(COALESCE(t_card.contact_methods, ''[]''::jsonb)) = ''array'' THEN (SELECT m->>''value'' FROM jsonb_array_elements(t_card.contact_methods) m WHERE m->>''type'' = ''phone'' LIMIT 1) ELSE NULL END AS target_phone,

            rt.id AS rel_type_id,
            rt.name AS rel_type_name

        FROM entity_relationships er
        INNER JOIN filter_match fm ON er.id = fm.id
        INNER JOIN cards s_card ON er.source_id = s_card.id
        INNER JOIN cards t_card ON er.target_id = t_card.id
        INNER JOIN relationship_types rt ON er.type_id = rt.id
        ORDER BY ' || v_order_clause || '
        LIMIT $2 OFFSET $3
    )
    SELECT 
        (SELECT total_count FROM counted),
        p.*
    FROM paged p;
    ';

    -- RAISE NOTICE 'Executing SQL: %', v_sql;

    RETURN QUERY EXECUTE v_sql 
    USING 
        arg_tenant_id, 
        arg_limit, 
        arg_start,
        v_param_search,
        v_param_type_names,
        v_param_source_types,
        v_param_target_types;

END;
$$;

GRANT EXECUTE ON FUNCTION public.fetch_global_relationships_crm(uuid, integer, integer, text, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fetch_global_relationships_crm(uuid, integer, integer, text, text, jsonb) TO service_role;
