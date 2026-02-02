-- Migration: 243_ensure_org_rpcs.sql
-- Description: Consolidated migration to ensure all Organization fetch RPCs exist and are consistent.
-- Fixes potential "function not found" or recursion issues.

-- 1. DROP ALL related functions to start fresh
DROP FUNCTION IF EXISTS fetch_organizations_crm(uuid, integer, integer, text, text, jsonb);
DROP FUNCTION IF EXISTS fetch_organizations_data(uuid, integer, integer, text, text, jsonb);
DROP FUNCTION IF EXISTS get_organizations_count(uuid, jsonb);

-- 2. Define get_organizations_count
CREATE OR REPLACE FUNCTION get_organizations_count(
    arg_tenant_id uuid,
    arg_filters jsonb DEFAULT '{}'::jsonb
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_total_count bigint;
    v_where_clause text;
BEGIN
    v_where_clause := ' WHERE p.tenant_id = ' || quote_literal(arg_tenant_id) || ' AND p.type = ''organization'' ';

    -- Filters
    IF arg_filters->>'search' IS NOT NULL AND arg_filters->>'search' <> '' THEN
         v_where_clause := v_where_clause || format(' AND p.display_name ILIKE %L', '%' || (arg_filters->>'search') || '%');
    END IF;
    IF arg_filters->'status' IS NOT NULL AND jsonb_typeof(arg_filters->'status') = 'array' THEN
         v_where_clause := v_where_clause || format(' AND lower(p.status) IN (SELECT lower(x) FROM jsonb_array_elements_text(%L::jsonb) t(x))', arg_filters->'status');
    ELSIF arg_filters->>'status' IS NOT NULL THEN
         v_where_clause := v_where_clause || format(' AND lower(p.status) = lower(%L)', arg_filters->>'status');
    END IF;
    IF arg_filters->'industry' IS NOT NULL AND jsonb_typeof(arg_filters->'industry') = 'array' THEN
         v_where_clause := v_where_clause || format(' AND lower(p.custom_fields->>''industry'') IN (SELECT lower(x) FROM jsonb_array_elements_text(%L::jsonb) t(x))', arg_filters->'industry');
    END IF;
    IF arg_filters->'company_size' IS NOT NULL AND jsonb_typeof(arg_filters->'company_size') = 'array' THEN
         v_where_clause := v_where_clause || format(' AND lower(p.custom_fields->>''company_size'') IN (SELECT lower(x) FROM jsonb_array_elements_text(%L::jsonb) t(x))', arg_filters->'company_size');
    END IF;
    IF arg_filters->'tags' IS NOT NULL AND jsonb_typeof(arg_filters->'tags') = 'array' THEN
         v_where_clause := v_where_clause || format(' AND p.tags @> (SELECT array_agg(x) FROM jsonb_array_elements_text(%L::jsonb) t(x))', arg_filters->'tags');
    END IF;

    EXECUTE 'SELECT count(*) FROM cards p ' || v_where_clause INTO v_total_count;
    RETURN v_total_count;
END;
$$;

-- 3. Define fetch_organizations_data
CREATE OR REPLACE FUNCTION fetch_organizations_data(
    arg_tenant_id uuid,
    arg_start integer DEFAULT 0,
    arg_limit integer DEFAULT 50,
    arg_sort_col text DEFAULT 'updated_at',
    arg_sort_dir text DEFAULT 'desc',
    arg_filters jsonb DEFAULT '{}'::jsonb
)
RETURNS TABLE (
    ret_id uuid,
    ret_name text,
    ret_status text,
    ret_tags text[],
    ret_industry text,
    ret_size text,
    ret_updated_at timestamptz,
    ret_avatar_url text,
    ret_email text,
    ret_phone text,
    ret_website text,
    ret_city text,
    ret_country text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_where_clause text;
    v_order_clause text;
BEGIN
    v_where_clause := ' WHERE p.tenant_id = ' || quote_literal(arg_tenant_id) || ' AND p.type = ''organization'' ';

    -- Filters
    IF arg_filters->>'search' IS NOT NULL AND arg_filters->>'search' <> '' THEN
         v_where_clause := v_where_clause || format(' AND p.display_name ILIKE %L', '%' || (arg_filters->>'search') || '%');
    END IF;
    IF arg_filters->'status' IS NOT NULL AND jsonb_typeof(arg_filters->'status') = 'array' THEN
         v_where_clause := v_where_clause || format(' AND lower(p.status) IN (SELECT lower(x) FROM jsonb_array_elements_text(%L::jsonb) t(x))', arg_filters->'status');
    ELSIF arg_filters->>'status' IS NOT NULL THEN
         v_where_clause := v_where_clause || format(' AND lower(p.status) = lower(%L)', arg_filters->>'status');
    END IF;
    IF arg_filters->'industry' IS NOT NULL AND jsonb_typeof(arg_filters->'industry') = 'array' THEN
         v_where_clause := v_where_clause || format(' AND lower(p.custom_fields->>''industry'') IN (SELECT lower(x) FROM jsonb_array_elements_text(%L::jsonb) t(x))', arg_filters->'industry');
    END IF;
    IF arg_filters->'company_size' IS NOT NULL AND jsonb_typeof(arg_filters->'company_size') = 'array' THEN
         v_where_clause := v_where_clause || format(' AND lower(p.custom_fields->>''company_size'') IN (SELECT lower(x) FROM jsonb_array_elements_text(%L::jsonb) t(x))', arg_filters->'company_size');
    END IF;

    -- Sorting
    CASE arg_sort_col
        WHEN 'display_name' THEN v_order_clause := ' ORDER BY p.display_name ' || arg_sort_dir;
        WHEN 'status' THEN v_order_clause := ' ORDER BY p.status ' || arg_sort_dir;
        WHEN 'created_at' THEN v_order_clause := ' ORDER BY p.created_at ' || arg_sort_dir;
        ELSE v_order_clause := ' ORDER BY p.updated_at ' || arg_sort_dir;
    END CASE;

    RETURN QUERY EXECUTE format('
        SELECT
            p.id as ret_id,
            p.display_name as ret_name,
            coalesce(p.status, ''PROSPECT'') as ret_status,
            coalesce(p.tags, ARRAY[]::text[]) as ret_tags,
            p.custom_fields->>''industry'' as ret_industry,
            p.custom_fields->>''company_size'' as ret_size,
            p.updated_at as ret_updated_at,
            p.custom_fields->>''avatar_url'' as ret_avatar_url,
            p.custom_fields->>''email'' as ret_email,
            p.custom_fields->>''phone'' as ret_phone,
            p.custom_fields->>''website'' as ret_website,
            p.custom_fields->>''city'' as ret_city,
            p.custom_fields->>''country'' as ret_country
        FROM cards p
        %s
        %s
        LIMIT %L OFFSET %L
    ', v_where_clause, v_order_clause, arg_limit, arg_start);
END;
$$;

-- 4. Define fetch_organizations_crm (Wrapper)
CREATE OR REPLACE FUNCTION fetch_organizations_crm(
    arg_tenant_id uuid,
    arg_start integer DEFAULT 0,
    arg_limit integer DEFAULT 50,
    arg_sort_col text DEFAULT 'updated_at',
    arg_sort_dir text DEFAULT 'desc',
    arg_filters jsonb DEFAULT '{}'::jsonb
)
RETURNS TABLE (
    ret_id uuid,
    ret_name text,
    ret_status text,
    ret_tags text[],
    ret_industry text,
    ret_size text,
    ret_updated_at timestamptz,
    ret_avatar_url text,
    ret_email text,
    ret_phone text,
    ret_website text,
    ret_city text,
    ret_country text,
    ret_total_count bigint
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_total_count bigint;
BEGIN
    -- Call the count function
    v_total_count := get_organizations_count(arg_tenant_id, arg_filters);

    RETURN QUERY
    SELECT
        d.ret_id,
        d.ret_name,
        d.ret_status,
        d.ret_tags,
        d.ret_industry,
        d.ret_size,
        d.ret_updated_at,
        d.ret_avatar_url,
        d.ret_email,
        d.ret_phone,
        d.ret_website,
        d.ret_city,
        d.ret_country,
        v_total_count as ret_total_count
    FROM fetch_organizations_data(
        arg_tenant_id,
        arg_start,
        arg_limit,
        arg_sort_col,
        arg_sort_dir,
        arg_filters
    ) d;
END;
$$;
