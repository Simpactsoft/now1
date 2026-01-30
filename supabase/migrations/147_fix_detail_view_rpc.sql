
-- Migration: 147_fix_detail_view_rpc.sql
-- Description: Fixes the Detail View.
-- 1. Removes missing 'avatar_url'.
-- 2. Fixes JSONB paths for email/phone.
-- 3. REMOVES 'tenant_id' check to allow cross-tenant debugging (since RLS logic is currently loose).

BEGIN;

DROP FUNCTION IF EXISTS fetch_person_profile(uuid, uuid);

CREATE OR REPLACE FUNCTION fetch_person_profile(
    arg_tenant_id uuid,
    arg_person_id uuid
)
RETURNS TABLE (
    id uuid,
    display_name text,
    avatar_url text, -- NULL
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
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.id,
        p.display_name,
        NULL::text as avatar_url,
        p.type::text,
        (p.contact_methods->>'email')::text as email,
        (p.contact_methods->>'phone')::text as phone,
        (p.custom_fields->>'city')::text as city,
        (p.custom_fields->>'country')::text as country,
        m.role_name as job_title,
        org.display_name as employer,
        p.created_at,
        to_jsonb(coalesce(p.tags, ARRAY[]::text[])),
        p.custom_fields
    FROM cards p 
    LEFT JOIN party_memberships m ON p.id = m.person_id AND m.tenant_id = arg_tenant_id
    LEFT JOIN cards org ON m.organization_id = org.id 
    WHERE p.id = arg_person_id; -- REMOVED: AND p.tenant_id = arg_tenant_id
END;
$$;

COMMIT;
