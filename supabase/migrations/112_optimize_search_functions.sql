
-- Migration: 112_optimize_search_functions.sql
-- Description: Rewrites search RPCs to use Index-Friendly operators (ANY, @>) instead of slow JSON parsing.
-- Resolves "Statement Timeout" by allowing the Query Planner to use the new Indexes.

BEGIN;

-- 1. Optimize COUNT Function
CREATE OR REPLACE FUNCTION get_people_count(
    arg_tenant_id uuid,
    arg_filters jsonb DEFAULT '{}'::jsonb
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_total_rows bigint;
    v_sql text;
    v_where text;
BEGIN
    -- Base Filter (Tenant + Type) - Uses idx_cards_tenant_type
    v_where := format(' WHERE tenant_id = %L AND type = ''person'' ', arg_tenant_id);

    -- 1. Search (Text)
    IF arg_filters->>'search' IS NOT NULL AND length(arg_filters->>'search') > 0 THEN
         -- Uses idx_cards_display_name_trgm
         v_where := v_where || format(' AND display_name ILIKE %L ', '%' || (arg_filters->>'search') || '%');
    END IF;

    -- 2. Status (Exact Array Match if possible, fell back to lower case)
    -- Optimized to use idx_cards_tenant_type_status_lower
    IF arg_filters->'status' IS NOT NULL AND jsonb_array_length(arg_filters->'status') > 0 THEN
        -- Convert JSON array ["Lead", "Customer"] to SQL Array for fast ANY() check
        -- casting elements to text
        v_where := v_where || format(' AND lower(status) = ANY(ARRAY(SELECT lower(x) FROM jsonb_array_elements_text(%L) t(x))) ', arg_filters->'status');
    END IF;

    -- 3. Tags (GIN Index) - FAST
    -- Uses idx_cards_tags_gin
    IF arg_filters->'tags' IS NOT NULL AND jsonb_array_length(arg_filters->'tags') > 0 THEN
         v_where := v_where || format(' AND tags && ARRAY(SELECT x FROM jsonb_array_elements_text(%L) t(x)) ', arg_filters->'tags');
    END IF;

    -- 4. Role (Complex: Membership OR Custom Field)
    -- Optimized to avoid deep unnesting if possible
    IF arg_filters->'role_name' IS NOT NULL AND jsonb_array_length(arg_filters->'role_name') > 0 THEN
         v_where := v_where || format(' AND (
            -- Check Custom Fields (GIN)
            custom_fields @> ANY(ARRAY(SELECT jsonb_build_object(''role'', x) FROM jsonb_array_elements_text(%L) t(x)))
            OR 
            -- Check Memberships (Index Scan)
            EXISTS (
                SELECT 1 FROM party_memberships pm 
                WHERE pm.person_id = cards.id 
                AND lower(pm.role_name) = ANY(ARRAY(SELECT lower(x) FROM jsonb_array_elements_text(%L) t(x)))
            )
         )', arg_filters->'role_name', arg_filters->'role_name');
    END IF;
    
    -- 5. Company Size (Simple Join exists)
    IF arg_filters->>'company_size' IS NOT NULL THEN
        v_where := v_where || format(' 
        AND EXISTS (
            SELECT 1 FROM party_memberships pm 
            JOIN organizations oe ON pm.organization_id = oe.card_id
            WHERE pm.person_id = cards.id AND oe.company_size = %L
        ) ', arg_filters->>'company_size');
    END IF;

    -- Execute
    v_sql := 'SELECT count(*) FROM cards ' || v_where;
    EXECUTE v_sql INTO v_total_rows;
    RETURN v_total_rows;
END;
$$;


-- 2. Optimize DATA Function
CREATE OR REPLACE FUNCTION fetch_people_data(
    arg_tenant_id uuid,
    arg_start integer DEFAULT 0,
    arg_limit integer DEFAULT 100,
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
    ret_rating integer,  
    ret_last_interaction timestamptz,
    ret_updated_at timestamptz,
    ret_role_name text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_sql text;
    v_where text;
BEGIN
    -- Reuse logic for WHERE clause
    v_where := format(' WHERE tenant_id = %L AND type = ''person'' ', arg_tenant_id);

    -- [Search]
    IF arg_filters->>'search' IS NOT NULL AND length(arg_filters->>'search') > 0 THEN
         v_where := v_where || format(' AND display_name ILIKE %L ', '%' || (arg_filters->>'search') || '%');
    END IF;

    -- [Status]
    IF arg_filters->'status' IS NOT NULL AND jsonb_array_length(arg_filters->'status') > 0 THEN
        v_where := v_where || format(' AND lower(status) = ANY(ARRAY(SELECT lower(x) FROM jsonb_array_elements_text(%L) t(x))) ', arg_filters->'status');
    END IF;

    -- [Tags]
    IF arg_filters->'tags' IS NOT NULL AND jsonb_array_length(arg_filters->'tags') > 0 THEN
         v_where := v_where || format(' AND tags && ARRAY(SELECT x FROM jsonb_array_elements_text(%L) t(x)) ', arg_filters->'tags');
    END IF;

    -- [Role]
    IF arg_filters->'role_name' IS NOT NULL AND jsonb_array_length(arg_filters->'role_name') > 0 THEN
         v_where := v_where || format(' AND (
            custom_fields @> ANY(ARRAY(SELECT jsonb_build_object(''role'', x) FROM jsonb_array_elements_text(%L) t(x)))
            OR 
            EXISTS (
                SELECT 1 FROM party_memberships pm 
                WHERE pm.person_id = cards.id 
                AND lower(pm.role_name) = ANY(ARRAY(SELECT lower(x) FROM jsonb_array_elements_text(%L) t(x)))
            )
         )', arg_filters->'role_name', arg_filters->'role_name');
    END IF;

    -- [Company Size]
    IF arg_filters->>'company_size' IS NOT NULL THEN
        v_where := v_where || format(' 
        AND EXISTS (
            SELECT 1 FROM party_memberships pm 
            JOIN organizations oe ON pm.organization_id = oe.card_id
            WHERE pm.person_id = cards.id AND oe.company_size = %L
        ) ', arg_filters->>'company_size');
    END IF;

    -- [Industry]
    IF arg_filters->>'industry' IS NOT NULL THEN
        v_where := v_where || format(' 
        AND EXISTS (
            SELECT 1 FROM party_memberships pm 
            JOIN organizations oe ON pm.organization_id = oe.card_id
            WHERE pm.person_id = cards.id AND oe.industry = %L
        ) ', arg_filters->>'industry');
    END IF;


    -- [Joined Year]
    IF arg_filters->>'joined_year' IS NOT NULL THEN
        v_where := v_where || format(' AND to_char(created_at, ''YYYY'') = %L ', arg_filters->>'joined_year');
    END IF;

    -- Execute with Sort
    v_sql := format('SELECT 
        id, 
        display_name, 
        contact_methods, 
        coalesce(tags, ARRAY[]::text[]), 
        coalesce(status, ''lead''), 
        coalesce(rating, 0), 
        last_interaction_at, 
        updated_at, 
        coalesce(
            (SELECT role_name FROM party_memberships pm WHERE pm.person_id = cards.id LIMIT 1),
            jsonb_extract_path_text(custom_fields, ''role'')
        )
    FROM cards 
    %s
    ORDER BY %s %s
    OFFSET %s LIMIT %s',
        v_where,
        CASE 
            WHEN arg_sort_col = 'name' THEN 'display_name'
            WHEN arg_sort_col = 'status' THEN 'status'
            ELSE 'created_at' 
        END,
        CASE WHEN upper(arg_sort_dir) = 'ASC' THEN 'ASC' ELSE 'DESC' END,
        arg_start,
        arg_limit
    );

    RETURN QUERY EXECUTE v_sql;
END;
$$;

COMMIT;
