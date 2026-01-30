
-- Migration: 126_replace_parties_with_cards.sql
-- Description: Updates fetch_people_crm to use 'cards' table directly, bypassing the broken/missing 'parties' relation.
-- Also reinforces RLS on 'cards'.

BEGIN;

-- 1. Secure CARDS Table (Strict RLS)
ALTER TABLE cards ENABLE ROW LEVEL SECURITY;
-- Force RLS even for checking consistency
-- ALTER TABLE cards FORCE ROW LEVEL SECURITY; 

DROP POLICY IF EXISTS "Hierarchy Visibility" ON cards;

CREATE POLICY "Hierarchy Visibility" ON cards
    FOR SELECT TO authenticated
    USING (
        -- A. Tenant Isolation (Strict)
        tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid() LIMIT 1)
        AND
        -- B. Hierarchy Cone
        (
            -- 1. Agent Ownership
            agent_id = auth.uid()
            OR
            -- 2. Ancestry
            (
                public.user_org_path() IS NOT NULL 
                AND 
                hierarchy_path IS NOT NULL 
                AND 
                public.user_org_path() @> hierarchy_path
            )
            OR
            -- 3. Distributor Override
            (
                EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'distributor')
            )
        )
    );

-- 2. Refactor fetch_people_crm to use CARDS
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
SECURITY INVOKER -- Respects RLS
SET search_path = public, pg_temp
AS $$
DECLARE
    v_total_rows bigint;
    v_query text;
    v_where_clause text;
BEGIN
    -- 1. Base Filter (Using 'cards' alias 'c')
    v_where_clause := format(' WHERE c.tenant_id = %L AND c.type = ''person'' ', arg_tenant_id);

    -- 2. Add Filters
    -- Search
    IF arg_filters->>'search' IS NOT NULL AND length(arg_filters->>'search') > 0 THEN
         v_where_clause := v_where_clause || ' AND c.display_name ILIKE ''%'' || ' || quote_literal(arg_filters->>'search') || ' || ''%'' ';
    END IF;

    -- Status
    IF arg_filters->'status' IS NOT NULL AND jsonb_typeof(arg_filters->'status') = 'array' THEN
        v_where_clause := v_where_clause || format(' AND c.status IN (SELECT jsonb_array_elements_text(%L::jsonb)) ', arg_filters->'status');
    ELSIF arg_filters->>'status' IS NOT NULL THEN
        v_where_clause := v_where_clause || format(' AND c.status = %L ', arg_filters->>'status');
    END IF;

    -- Role
    IF arg_filters->'role_name' IS NOT NULL AND jsonb_typeof(arg_filters->'role_name') = 'array' THEN
         v_where_clause := v_where_clause || format(' AND (
            EXISTS (
                SELECT 1 FROM party_memberships pm 
                WHERE pm.person_id = c.id 
                AND pm.role_name IN (SELECT jsonb_array_elements_text(%L::jsonb))
            )
            OR 
            (c.custom_fields->>''role'') IN (SELECT jsonb_array_elements_text(%L::jsonb))
         )', arg_filters->'role_name', arg_filters->'role_name');
    ELSIF arg_filters->>'role_name' IS NOT NULL THEN
         v_where_clause := v_where_clause || format(' AND (
            EXISTS (SELECT 1 FROM party_memberships pm WHERE pm.person_id = c.id AND pm.role_name = %L)
            OR (c.custom_fields->>''role'') = %L
         )', arg_filters->>'role_name', arg_filters->>'role_name');
    END IF;
    
    -- Company Size (Linked via Membership)
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

    -- Industry
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

    -- Tags
    IF arg_filters->>'tags' IS NOT NULL THEN
         IF jsonb_typeof(arg_filters->'tags') = 'array' THEN
            v_where_clause := v_where_clause || format(' AND c.tags && (SELECT array_agg(x) FROM jsonb_array_elements_text(%L::jsonb) t(x)) ', arg_filters->'tags');
         ELSE
            v_where_clause := v_where_clause || format(' AND c.tags @> ARRAY[%L]::text[] ', arg_filters->>'tags');
         END IF;
    END IF;

    -- Join Date
    IF arg_filters->>'joined_year' IS NOT NULL THEN
        v_where_clause := v_where_clause || format(' AND to_char(c.created_at, ''YYYY'') = %L ', arg_filters->>'joined_year');
    END IF;

    -- 3. Get Total Count (Using 'cards' table)
    EXECUTE 'SELECT count(*) FROM cards c ' || v_where_clause INTO v_total_rows;

    -- 4. Execute Main Query
    v_query := 'SELECT 
        c.id, 
        c.display_name, 
        c.contact_methods, 
        coalesce(c.tags, ARRAY[]::text[]), 
        coalesce(c.status, ''lead''), 
        0 as rating, -- c.rating might not exist on cards base schema, defaulting 0
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
