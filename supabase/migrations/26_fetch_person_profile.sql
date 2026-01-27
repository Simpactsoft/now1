-- Phase 12: Person Profile RPC
-- Aggregates data from parties, people, and party_memberships for a 360 view.

DROP FUNCTION IF EXISTS fetch_person_profile(uuid, uuid);

CREATE OR REPLACE FUNCTION fetch_person_profile(
    arg_tenant_id uuid,
    arg_person_id uuid
)
RETURNS TABLE (
    id uuid,
    display_name text,
    avatar_url text,
    type text,
    email text,
    phone text,
    city text,
    country text,
    job_title text,
    employer text,
    created_at timestamptz,
    tags jsonb,
    custom_fields jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.id,
        p.display_name,
        p.avatar_url,
        p.type::text,
        -- Extract email using JSON Path (cleaner and safer)
        jsonb_path_query_first(p.contact_methods, '$[*] ? (@.type == "email").value') #>> '{}' as email,
        -- Extract phone using JSON Path
        jsonb_path_query_first(p.contact_methods, '$[*] ? (@.type == "phone").value') #>> '{}' as phone,
        -- Extract location from custom_fields
        (p.custom_fields->>'city')::text as city,
        (p.custom_fields->>'country')::text as country,
        -- Get latest role info if available
        m.role_name as job_title,
        org.display_name as employer,
        p.created_at,
        p.tags,
        p.custom_fields
    FROM parties p
    LEFT JOIN party_memberships m ON p.id = m.person_id AND m.tenant_id = arg_tenant_id
    LEFT JOIN parties org ON m.organization_id = org.id
    WHERE p.id = arg_person_id AND p.tenant_id = arg_tenant_id;
END;
$$;
