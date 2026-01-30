
-- Migration: 129_fix_timeout_real.sql
-- Description:
-- 1. Backfills missing 'hierarchy_path' on cards (Critical for GIST performance).
-- 2. Optimizes 'get_people_count' to use strictly Index-Friendly operators (<@) and increase timeouts.

BEGIN;

-- 1. Backfill Hierarchy Path (Safe Update)
-- Updates cards that have an Agent but no Path.
-- Uses the Agent's profile path.
UPDATE cards c
SET hierarchy_path = p.org_path
FROM profiles p
WHERE c.agent_id = p.id
AND c.hierarchy_path IS NULL;

-- 2. Ensure Index is Valid (Reindex concurrently not allowed in transaction, but normal CREATE IF NOT EXISTS is fine)
-- We assume idx_cards_hierarchy_path_gist exists from 127.

-- 3. Redefine Function with Optimizations
CREATE OR REPLACE FUNCTION get_people_count(
    arg_tenant_id uuid,
    arg_filters jsonb DEFAULT '{}'::jsonb
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
SET statement_timeout = '5000ms' -- Grant 5s for this analytical query
AS $$
DECLARE
    v_total_rows bigint;
    v_where_clause text;
    v_auth_user_id uuid;
    v_auth_tenant_id uuid;
    v_auth_org_path ltree;
    v_is_distributor boolean;
BEGIN
    -- 1. Resolve Auth
    v_auth_user_id := auth.uid();
    
    SELECT tenant_id, org_path, (role = 'distributor')
    INTO v_auth_tenant_id, v_auth_org_path, v_is_distributor
    FROM profiles 
    WHERE id = v_auth_user_id;

    -- Security Guard
    IF v_auth_tenant_id IS DISTINCT FROM arg_tenant_id THEN
        RETURN 0;
    END IF;

    -- 2. Construct WHERE
    v_where_clause := format(' WHERE c.tenant_id = %L AND c.type = ''person'' ', arg_tenant_id);

    -- 3. Filter Hierarchy (The Optimization)
    -- Instead of OR logic, we rely on the Hierarchy Path being correct (Backfilled above).
    -- Using <@ (Is Contained By) allows GIST index to find all cards that are descendants of the User.
    -- e.g. CardPath (Root.Distributor.Dealer.Agent) <@ UserPath (Root.Distributor.Dealer) -> TRUE
    IF NOT v_is_distributor THEN
        -- Check if path exists. If NULL (legacy/broken), fallback to agent_id (slower but necessary safety)
        -- But we try to prioritize the Index Path.
        v_where_clause := v_where_clause || format(' AND (
            (c.hierarchy_path IS NOT NULL AND c.hierarchy_path <@ %L::ltree)
            OR 
            (c.hierarchy_path IS NULL AND c.agent_id = %L)
        ) ', v_auth_org_path::text, v_auth_user_id);
    END IF;

    -- [Search]
    IF arg_filters->>'search' IS NOT NULL AND length(arg_filters->>'search') > 0 THEN
         v_where_clause := v_where_clause || format(' AND c.display_name ILIKE %L ', '%' || (arg_filters->>'search') || '%');
    END IF;

    -- [Status]
    IF arg_filters->'status' IS NOT NULL AND jsonb_array_length(arg_filters->'status') > 0 THEN
        v_where_clause := v_where_clause || format(' AND lower(c.status) = ANY(ARRAY(SELECT lower(x) FROM jsonb_array_elements_text(%L) t(x))) ', arg_filters->'status');
    END IF;

    -- [Tags]
    IF arg_filters->'tags' IS NOT NULL AND jsonb_array_length(arg_filters->'tags') > 0 THEN
         v_where_clause := v_where_clause || format(' AND c.tags && ARRAY(SELECT x FROM jsonb_array_elements_text(%L) t(x)) ', arg_filters->'tags');
    END IF;

    -- [Role]
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

    -- Execute
    EXECUTE 'SELECT count(*) FROM cards c ' || v_where_clause INTO v_total_rows;
    RETURN v_total_rows;
END;
$$;

COMMIT;
