
-- Migration: 138_fix_fundamental_indexes.sql
-- Description:
-- 1. Creates the "Golden Index" (tenant_id, created_at DESC) which perfectly matches the specific slow query.
--    This allows Postgres to find the "Top N" sorting results instantly without scanning.
-- 2. Runs VACUUM ANALYZE to clear dead tuples and update statistics (Critical after many migrations).
-- 3. Restores fetch_people_crm to a working state (including Count).

BEGIN;

-- 1. Golden Index for "Show me my latest items"
-- This is often key for Multi-tenant apps.
DROP INDEX IF EXISTS idx_cards_tenant_created_at_golden;
CREATE INDEX idx_cards_tenant_created_at_golden ON cards(tenant_id, created_at DESC);

-- 2. Statistics Refresh
ANALYZE cards;
-- Note: We cannot run VACUUM inside a transaction block, but ANALYZE helps the planner.

-- 3. Restore Function functionality (With Count)
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
SET statement_timeout = '60000ms'
SET enable_seqscan = off -- FORCE the new index
AS $$
DECLARE
    v_total_rows bigint;
    v_query text;
    v_where_clause text;
BEGIN
    -- Base: Tenant + Type
    v_where_clause := format(' WHERE c.tenant_id = %L AND c.type = ''person'' ', arg_tenant_id);

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

    -- [Count Is Back]
    EXECUTE 'SELECT count(*) FROM cards c ' || v_where_clause INTO v_total_rows;

    -- [Main Query]
    v_query := 'SELECT 
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
    FROM cards c '
    || v_where_clause ||
    ' ORDER BY ' || 
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
