
-- Migration: 127_optimize_cards_performance.sql
-- Description: Adds critical indexes to 'cards' table to support high-performance RLS filtering.
-- Also re-defines 'get_people_count' to strictly use 'cards' and optimized logic.

BEGIN;

-- 1. Indexing (The "Speed Pack")
-- Ensure these exist on CARDS table (since parties might be gone/deprecated).
CREATE INDEX IF NOT EXISTS idx_cards_tenant_id ON cards(tenant_id);
CREATE INDEX IF NOT EXISTS idx_cards_agent_id ON cards(agent_id);
CREATE INDEX IF NOT EXISTS idx_cards_hierarchy_path_gist ON cards USING GIST (hierarchy_path);
-- Combined index for Tenant+Type (Common filter)
CREATE INDEX IF NOT EXISTS idx_cards_tenant_type_status ON cards(tenant_id, type, status);

-- 2. Optimize get_people_count RPC
-- Uses variables to cache the RLS parameters, helping the planner (if we were using Security Definer).
-- But since we are SECURITY INVOKER, we rely on the Planner being smart about the RLS policy.
-- To help it, we ensure the query is simple and indexes are available.

CREATE OR REPLACE FUNCTION get_people_count(
    arg_tenant_id uuid,
    arg_filters jsonb DEFAULT '{}'::jsonb
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY INVOKER -- Respects RLS on 'cards'
SET search_path = public, pg_temp
AS $$
DECLARE
    v_total_rows bigint;
    v_where_clause text;
BEGIN
    -- Base Filter (Using 'cards' alias 'c')
    v_where_clause := format(' WHERE c.tenant_id = %L AND c.type = ''person'' ', arg_tenant_id);

    -- [Search]
    IF arg_filters->>'search' IS NOT NULL AND length(arg_filters->>'search') > 0 THEN
         -- Optimized: Use text search vector if available, or ILIKE for now (ensure trigram index exists)
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
    
    -- [Company Size]
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

    -- Execute
    EXECUTE 'SELECT count(*) FROM cards c ' || v_where_clause INTO v_total_rows;
    RETURN v_total_rows;
END;
$$;

COMMIT;
