
-- Migration: 131_force_gist_plan.sql
-- Description: Optimizes fetch_people_crm by forcing a "Filter First, Sort Later" plan using a CTE Materialization barrier.
-- This forces the Query Planner to use the GIST Index for Hierarchy (fast filtering) before attempting to sort the results.
-- Essential for "Sparse" permission sets (like a single Dealer in a 1.3M row tenant).

BEGIN;

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
    ret_role_name text,
    ret_total_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
SET statement_timeout = '15000ms'
AS $$
DECLARE
    v_total_rows bigint;
    v_query text;
    v_where_clause text;
    v_auth_user_id uuid;
    v_auth_tenant_id uuid;
    v_auth_org_path ltree;
    v_is_distributor boolean;
BEGIN
    -- 1. Security Context
    v_auth_user_id := auth.uid();
    
    SELECT tenant_id, org_path, (role = 'distributor')
    INTO v_auth_tenant_id, v_auth_org_path, v_is_distributor
    FROM profiles 
    WHERE id = v_auth_user_id;

    IF v_auth_tenant_id IS DISTINCT FROM arg_tenant_id THEN
        RETURN; 
    END IF;

    -- 2. Construct WHERE (Same logic as before)
    v_where_clause := format(' WHERE c.tenant_id = %L AND c.type = ''person'' ', arg_tenant_id);

    IF NOT v_is_distributor THEN
        v_where_clause := v_where_clause || format(' AND (
            (c.hierarchy_path IS NOT NULL AND c.hierarchy_path <@ %L::ltree)
            OR 
            (c.agent_id = %L)
        ) ', v_auth_org_path::text, v_auth_user_id);
    END IF;

    -- Filters
    IF arg_filters->>'search' IS NOT NULL AND length(arg_filters->>'search') > 0 THEN
         v_where_clause := v_where_clause || format(' AND c.display_name ILIKE %L ', '%' || (arg_filters->>'search') || '%');
    END IF;

    IF arg_filters->'status' IS NOT NULL AND jsonb_array_length(arg_filters->'status') > 0 THEN
        v_where_clause := v_where_clause || format(' AND lower(c.status) = ANY(ARRAY(SELECT lower(x) FROM jsonb_array_elements_text(%L) t(x))) ', arg_filters->'status');
    ELSIF arg_filters->>'status' IS NOT NULL THEN
        v_where_clause := v_where_clause || format(' AND lower(c.status) = lower(%L) ', arg_filters->>'status');
    END IF;
    
    IF arg_filters->'tags' IS NOT NULL AND jsonb_array_length(arg_filters->'tags') > 0 THEN
         v_where_clause := v_where_clause || format(' AND c.tags && ARRAY(SELECT x FROM jsonb_array_elements_text(%L) t(x)) ', arg_filters->'tags');
    END IF;

    IF arg_filters->'role_name' IS NOT NULL AND jsonb_array_length(arg_filters->'role_name') > 0 THEN
         v_where_clause := v_where_clause || format(' AND (
            c.custom_fields @> ANY(ARRAY(SELECT jsonb_build_object(''role'', x) FROM jsonb_array_elements_text(%L) t(x)))
            OR 
            EXISTS (
                SELECT 1 FROM party_memberships pm 
                WHERE pm.person_id = c.id 
                AND lower(pm.role_name) = ANY(ARRAY(SELECT lower(x) FROM jsonb_array_elements_text(%L) t(x)))
            )
         )', arg_filters->'role_name', arg_filters->'role_name');
    END IF;
    
    IF arg_filters->>'company_size' IS NOT NULL THEN
        v_where_clause := v_where_clause || format(' 
        AND EXISTS (
            SELECT 1 FROM party_memberships pm 
            JOIN cards org ON pm.organization_id = org.id
            WHERE pm.person_id = c.id 
            AND org.type = ''organization''
            AND org.custom_fields->>''company_size'' = %L
        ) ', arg_filters->>'company_size');
    END IF;

    IF arg_filters->>'industry' IS NOT NULL THEN
        v_where_clause := v_where_clause || format(' 
        AND EXISTS (
            SELECT 1 FROM party_memberships pm 
            JOIN cards org ON pm.organization_id = org.id
            WHERE pm.person_id = c.id 
            AND org.type = ''organization''
            AND org.custom_fields->>''industry'' = %L
        ) ', arg_filters->>'industry');
    END IF;

    IF arg_filters->>'joined_year' IS NOT NULL THEN
        v_where_clause := v_where_clause || format(' AND to_char(c.created_at, ''YYYY'') = %L ', arg_filters->>'joined_year');
    END IF;


    -- 3. Calculate Count (Fast via Index)
    EXECUTE 'SELECT count(*) FROM cards c ' || v_where_clause INTO v_total_rows;


    -- 4. Main Query Optimization (FORCE MATERIALIZATION)
    -- We select IDs first in a CTE to force the Planner to apply filters (GIST Index) BEFORE sorting.
    -- Assuming result set after filtering is small (for Dealers).
    -- If result set is large (Distributor), CTE overhead is acceptable compared to current Timeout.
    
    v_query := '
    WITH visible_ids AS (
        SELECT c.id
        FROM cards c
        ' || v_where_clause || '
    )
    SELECT 
        c.id, 
        c.display_name, 
        c.contact_methods, 
        coalesce(c.tags, ARRAY[]::text[]), 
        coalesce(c.status, ''lead''), 
        0 as rating, 
        c.last_interaction_at, 
        c.updated_at, 
        coalesce(
            (SELECT role_name FROM party_memberships pm WHERE pm.person_id = c.id LIMIT 1),
            c.custom_fields->>''role''
        ) as ret_role_name,
        ' || v_total_rows || '::bigint
    FROM visible_ids vi
    JOIN cards c ON vi.id = c.id
    ORDER BY ' || 
    (CASE 
        WHEN arg_sort_col = 'name' THEN 'c.display_name'
        WHEN arg_sort_col = 'status' THEN 'c.status'
        ELSE 'c.created_at' 
    END) || ' ' || (CASE WHEN upper(arg_sort_dir) = 'ASC' THEN 'ASC' ELSE 'DESC' END) ||
    ' OFFSET ' || arg_start || ' LIMIT ' || arg_limit;

    RETURN QUERY EXECUTE v_query;
END;
$$;

COMMIT;
