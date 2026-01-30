
-- Migration: 133_fix_planner_materialized.sql
-- Description:
-- 1. Runs ANALYZE to update table statistics (Critical for Planner).
-- 2. Updates fetch_people_crm to use "AS MATERIALIZED" in the CTE.
--    This prevents the Planner from "inlining" the logic and mistakenly choosing a "Sort-First" plan (Index Scan on created_at) which causes timeouts on sparse data.

BEGIN;

-- 1. Update Statistics (Crucial for large tables)
ANALYZE cards;

-- 2. "The Iron Wall" Query Optimization
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
SET statement_timeout = '30000ms' -- 30s Safety
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
    -- [Security Context]
    v_auth_user_id := auth.uid();
    
    SELECT tenant_id, org_path, (role = 'distributor')
    INTO v_auth_tenant_id, v_auth_org_path, v_is_distributor
    FROM profiles 
    WHERE id = v_auth_user_id;

    IF v_auth_tenant_id IS DISTINCT FROM arg_tenant_id THEN
        RETURN; 
    END IF;

    -- [WHERE Logic]
    v_where_clause := format(' WHERE c.tenant_id = %L AND c.type = ''person'' ', arg_tenant_id);

    IF NOT v_is_distributor THEN
        IF v_auth_org_path IS NOT NULL THEN
             -- Strict Hierarchy Check using Index
             v_where_clause := v_where_clause || format(' AND c.hierarchy_path <@ %L::ltree ', v_auth_org_path::text);
        ELSE
             -- Fallback
             v_where_clause := v_where_clause || format(' AND c.agent_id = %L ', v_auth_user_id);
        END IF;
    END IF;

    -- [Filters]
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

    -- [Count Execution]
    EXECUTE 'SELECT count(*) FROM cards c ' || v_where_clause INTO v_total_rows;


    -- [Main Query - MATERIALIZED CTE]
    -- AS MATERIALIZED enforces that this block runs independently and completely BEFORE being joined.
    -- This guarantees that we use the specific indexes (GIST/Tenant) to find the ID set,
    -- and ONLY THEN do we join back to sort/paginate.
    -- This kills the "Bad Plan" where Postgres tries to scan the 'created_at' index on the whole table.
    
    v_query := '
    WITH visible_ids AS MATERIALIZED (
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
