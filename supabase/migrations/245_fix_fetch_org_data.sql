-- Migration: 245_fix_fetch_org_data.sql
-- Description: Update fetch_organization_profile to Robustly handle both Array and Object formats for contact_methods.
-- This is necessary because some legacy data uses Object format, while new data uses Array.
-- Strict RLS prevents client-side fallback, so the RPC must do the heavy lifting.

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
    tags jsonb, 
    custom_fields jsonb,
    ret_contact_methods jsonb, -- Return raw methods for debugging/updates
    ret_custom_fields jsonb    -- Alias for custom_fields for consistency
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
        p.custom_fields->>'avatar_url' as avatar_url,
        p.type::text,
        -- Smarter Email Extraction
        COALESCE(
             p.custom_fields->>'email',
             CASE 
                -- If Array: Use JSON Path
                WHEN jsonb_typeof(p.contact_methods) = 'array' THEN 
                    jsonb_path_query_first(p.contact_methods, '$[*] ? (@.type == "email").value') #>> '{}'
                -- If Object: Direct Key Access
                WHEN jsonb_typeof(p.contact_methods) = 'object' THEN 
                     p.contact_methods->>'email'
                ELSE NULL
             END
        ) as email,
        -- Smarter Phone Extraction
        COALESCE(
             p.custom_fields->>'phone',
             CASE 
                WHEN jsonb_typeof(p.contact_methods) = 'array' THEN 
                    jsonb_path_query_first(p.contact_methods, '$[*] ? (@.type == "phone").value') #>> '{}'
                WHEN jsonb_typeof(p.contact_methods) = 'object' THEN 
                     p.contact_methods->>'phone'
                ELSE NULL
             END
        ) as phone,
        -- City
        (p.custom_fields->>'city')::text as city,
        -- Country
        (p.custom_fields->>'country')::text as country,
        -- Website
        (p.custom_fields->>'website')::text as website,
        -- Industry
        (p.custom_fields->>'industry')::text as industry,
        -- Status
        coalesce(p.status, 'PROSPECT') as status,
        p.created_at,
        to_jsonb(p.tags) as tags,
        p.custom_fields,
        p.contact_methods as ret_contact_methods,
        p.custom_fields as ret_custom_fields
    FROM cards p
    WHERE p.id = arg_org_id 
      AND p.tenant_id = arg_tenant_id
      AND p.type = 'organization';
END;
$$;
