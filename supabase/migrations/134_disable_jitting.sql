
-- Migration: 134_disable_jitting.sql
-- Description:
-- 1. Drops potential "Distractor" indexes that might confuse the Planner (e.g. simple tenant_id index vs the Composite one).
-- 2. Refines fetch_people_crm to DISABLE JIT compilation and Sequential Scans. 
--    On 1.3M rows, JIT can add 500ms-2s overhead, and SeqScan is the root of the timeout.

BEGIN;

-- 1. Drop Distractor Indexes
-- If we have idx_cards_tenant_hierarchy_composite (Tenant+Path), we don't need a simple idx_cards_tenant_id for this query.
-- Keeping idx_cards_tenant_id might make the planner think "I can just scan Tenant and then Filter". We want "Scan Tenant+Path".
DROP INDEX IF EXISTS idx_cards_tenant_id;

-- 2. Configuration-Heavy Function Definition
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
SET statement_timeout = '60000ms' -- 60s (Last Resort)
SET enable_seqscan = off -- FORCE Index Usage
SET enable_sort = on
SET jit = off -- JIT often hurts OLTP queries with small result sets
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
             v_where_clause := v_where_clause || format(' AND c.hierarchy_path <@ %L::ltree ', v_auth_org_path::text);
        ELSE
             v_where_clause := v_where_clause || format(' AND c.agent_id = %L ', v_auth_user_id);
        END IF;
    END IF;

    -- [Filters]
    IF arg_filters->>'search' IS NOT NULL AND length(arg_filters->>'search') > 0 THEN
         v_where_clause := v_where_clause || format(' AND c.display_name ILIKE %L ', '%' || (arg_filters->>'search') || '%');
    END IF;

    -- [Filters - Simplified checks]
    IF arg_filters->'status' IS NOT NULL AND jsonb_array_length(arg_filters->'status') > 0 THEN
        v_where_clause := v_where_clause || format(' AND lower(c.status) = ANY(ARRAY(SELECT lower(x) FROM jsonb_array_elements_text(%L) t(x))) ', arg_filters->'status');
    ELSIF arg_filters->>'status' IS NOT NULL THEN
        v_where_clause := v_where_clause || format(' AND lower(c.status) = lower(%L) ', arg_filters->>'status');
    END IF;
    
    IF arg_filters->'tags' IS NOT NULL AND jsonb_array_length(arg_filters->'tags') > 0 THEN
         v_where_clause := v_where_clause || format(' AND c.tags && ARRAY(SELECT x FROM jsonb_array_elements_text(%L) t(x)) ', arg_filters->'tags');
    END IF;

    -- [Count]
    EXECUTE 'SELECT count(*) FROM cards c ' || v_where_clause INTO v_total_rows;


    -- [Main Query]
    -- Using MATERIALIZED to force ID fetch first
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
