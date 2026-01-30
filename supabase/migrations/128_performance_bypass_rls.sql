
-- Migration: 128_performance_bypass_rls.sql
-- Description: Switches get_people_count to SECURITY DEFINER to bypass RLS overhead.
-- Instead of relying on slow per-row RLS checks, we manually inject the security clauses into the optimized query.
-- This allows using GIST indexes for Hierarchy validation at speed.

BEGIN;

CREATE OR REPLACE FUNCTION get_people_count(
    arg_tenant_id uuid,
    arg_filters jsonb DEFAULT '{}'::jsonb
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER -- Critical: Run as Admin to bypass RLS Scans
SET search_path = public, pg_temp
AS $$
DECLARE
    v_total_rows bigint;
    v_where_clause text;
    v_auth_user_id uuid;
    v_auth_tenant_id uuid;
    v_auth_org_path ltree;
    v_is_distributor boolean;
BEGIN
    -- 1. Security Context Resolution (Run once at start)
    v_auth_user_id := auth.uid();
    
    SELECT tenant_id, org_path, (role = 'distributor')
    INTO v_auth_tenant_id, v_auth_org_path, v_is_distributor
    FROM profiles 
    WHERE id = v_auth_user_id;

    -- 2. Security Check: Block cross-tenant requests
    -- If the requested tenant_id doesn't match the user's real tenant, return 0 (or error).
    -- Returning 0 is safer for UI.
    IF v_auth_tenant_id IS DISTINCT FROM arg_tenant_id THEN
        RETURN 0;
    END IF;

    -- 3. Construct Optimized WHERE Clause
    -- Base: Tenant + Type
    v_where_clause := format(' WHERE c.tenant_id = %L AND c.type = ''person'' ', arg_tenant_id);

    -- Security: Hierarchy (Manual Injection of what RLS would do)
    -- Logic: Agent Owns OR Path Ancestor OR Distributor
    IF NOT v_is_distributor THEN
        v_where_clause := v_where_clause || format(' AND (
            c.agent_id = %L 
            OR 
            (c.hierarchy_path IS NOT NULL AND %L @> c.hierarchy_path)
        ) ', v_auth_user_id, v_auth_org_path);
    END IF;
    -- If Distributor, they see everything in tenant (which is already filtered by base clause), so no extra AND needed.

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
