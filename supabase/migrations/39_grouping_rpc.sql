CREATE OR REPLACE FUNCTION get_people_grouped(arg_tenant_id uuid, arg_group_field text)
RETURNS TABLE (group_key text, count bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $func$
BEGIN
    IF arg_group_field = 'tags' THEN
        RETURN QUERY
        SELECT
            t.tag as group_key,
            COUNT(*)::bigint as count
        FROM party_memberships pm
        JOIN parties p_org ON pm.organization_id = p_org.id
        LEFT JOIN organizations_ext oe ON p_org.id = oe.party_id
        JOIN people p_person ON pm.person_id = p_person.party_id
        JOIN parties pp ON p_person.party_id = pp.id
        CROSS JOIN UNNEST(pp.tags) t(tag)
        WHERE pm.tenant_id = arg_tenant_id
        GROUP BY t.tag
        ORDER BY count DESC;
        RETURN;
    END IF;

    RETURN QUERY EXECUTE format(
        'SELECT
            COALESCE(%s::text, ''Unknown'') as group_key,
            COUNT(*)::bigint as count
         FROM party_memberships pm
         JOIN parties p_org ON pm.organization_id = p_org.id
         LEFT JOIN organizations_ext oe ON p_org.id = oe.party_id
         JOIN people p_person ON pm.person_id = p_person.party_id
         JOIN parties pp ON p_person.party_id = pp.id 
         WHERE pm.tenant_id = %L
         GROUP BY 1
         ORDER BY count DESC',
        CASE arg_group_field
            WHEN 'role_name'    THEN 'pm.role_name'
            WHEN 'company_size' THEN 'oe.company_size'
            WHEN 'industry'     THEN 'oe.industry'
            WHEN 'gender'       THEN 'p_person.gender'
            WHEN 'status'       THEN 'pp.status'
            WHEN 'joined_year'    THEN 'to_char(pp.created_at, ''YYYY'')'
            WHEN 'joined_quarter' THEN 'to_char(pp.created_at, ''YYYY "Q"Q'')'
            WHEN 'joined_month'   THEN 'to_char(pp.created_at, ''YYYY-MM'')'
            WHEN 'joined_week'    THEN 'to_char(pp.created_at, ''IYYY "W"IW'')'
            ELSE '''Unknown'''
        END,
        arg_tenant_id
    );
END;
$func$;

GRANT EXECUTE ON FUNCTION get_people_grouped(uuid, text) TO authenticated, service_role, anon;

SELECT 1;
