CREATE OR REPLACE FUNCTION get_people_grouped(arg_tenant_id uuid, arg_group_field text)
RETURNS TABLE (group_key text, count bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $func$
BEGIN
    -- 1. GROUP BY TAGS (Directly on parties)
    IF arg_group_field = 'tags' THEN
        RETURN QUERY
        SELECT
            t.tag as group_key,
            COUNT(*)::bigint as count
        FROM parties p
        CROSS JOIN UNNEST(p.tags) t(tag)
        WHERE p.tenant_id = arg_tenant_id 
        AND p.type = 'person'
        GROUP BY t.tag
        ORDER BY count DESC;
        RETURN;
    END IF;

    -- 2. GROUP BY DIRECT PROPERTIES (Status, Dates) - No Join needed
    IF arg_group_field IN ('status', 'joined_year', 'joined_quarter', 'joined_month', 'joined_week') THEN
        RETURN QUERY EXECUTE format(
            'SELECT
                COALESCE(%s::text, ''Unknown'') as group_key,
                COUNT(*)::bigint as count
             FROM parties p
             WHERE p.tenant_id = %L 
             AND p.type = ''person''
             GROUP BY 1
             ORDER BY count DESC',
            CASE arg_group_field
                WHEN 'status'         THEN 'p.status'
                WHEN 'joined_year'    THEN 'to_char(p.created_at, ''YYYY'')'
                WHEN 'joined_quarter' THEN 'to_char(p.created_at, ''YYYY "Q"Q'')'
                WHEN 'joined_month'   THEN 'to_char(p.created_at, ''YYYY-MM'')'
                WHEN 'joined_week'    THEN 'to_char(p.created_at, ''IYYY "W"IW'')'
                ELSE '''Unknown'''
            END,
            arg_tenant_id
        );
        RETURN;
    END IF;

    -- 3. GROUP BY MEMBERSHIP/ORG PROPERTIES (Requires Left/Inner Join)
    -- This matches the original logic but only for fields that reside on the membership or org
    RETURN QUERY EXECUTE format(
        'SELECT
            COALESCE(%s::text, ''Unknown'') as group_key,
            COUNT(*)::bigint as count
         FROM party_memberships pm
         JOIN parties p_org ON pm.organization_id = p_org.id
         LEFT JOIN organizations_ext oe ON p_org.id = oe.party_id
         JOIN parties pp ON pm.person_id = pp.id 
         WHERE pm.tenant_id = %L
         AND pp.type = ''person''
         GROUP BY 1
         ORDER BY count DESC',
        CASE arg_group_field
            WHEN 'role_name'    THEN 'pm.role_name'
            WHEN 'company_size' THEN 'oe.company_size'
            WHEN 'industry'     THEN 'oe.industry'
            ELSE '''Unknown'''
        END,
        arg_tenant_id
    );
END;
$func$;

GRANT EXECUTE ON FUNCTION get_people_grouped(uuid, text) TO authenticated, service_role, anon;
