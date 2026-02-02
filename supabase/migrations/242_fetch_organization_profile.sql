
-- Migration: 242_fetch_organization_profile.sql
-- Description: Fetch single organization profile (Security Definer to bypass RLS for View Page)

DROP FUNCTION IF EXISTS fetch_organization_profile(uuid, uuid);

CREATE OR REPLACE FUNCTION fetch_organization_profile(
    arg_tenant_id uuid,
    arg_org_id uuid
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
    website text,
    industry text,
    status text,
    created_at timestamptz,
    tags jsonb, -- Returning as jsonb to match profile structure, even if text[] column
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
        p.custom_fields->>'avatar_url' as avatar_url, -- Avatar for orgs usually in custom_fields
        p.type::text,
        -- Extract email
        COALESCE(
             p.custom_fields->>'email',
             jsonb_path_query_first(p.contact_methods, '$[*] ? (@.type == "email").value') #>> '{}'
        ) as email,
        -- Extract phone
        COALESCE(
             p.custom_fields->>'phone',
             jsonb_path_query_first(p.contact_methods, '$[*] ? (@.type == "phone").value') #>> '{}'
        ) as phone,
        -- Extract location
        (p.custom_fields->>'city')::text as city,
        (p.custom_fields->>'country')::text as country,
        -- Website
        (p.custom_fields->>'website')::text as website,
        -- Industry
        (p.custom_fields->>'industry')::text as industry,
        -- Status
        coalesce(p.status, 'PROSPECT') as status,
        p.created_at,
        to_jsonb(p.tags) as tags, -- Casting array to jsonb
        p.custom_fields
    FROM cards p -- 'parties' alias 'p' in original but table is 'cards' now usually?
                 -- Migration 26 used 'parties'. 
                 -- Assuming 'cards' is the view or table. 'cards' is usually the main table now.
                 -- Let's check 26 again. It says 'FROM parties p'. 
                 -- Wait, 'parties' might be a view or the old name.
                 -- In 241 we used 'FROM cards p'.
                 -- Let's use 'FROM cards p'.
    WHERE p.id = arg_org_id 
      AND p.tenant_id = arg_tenant_id
      AND p.type = 'organization';
END;
$$;
