
-- Migration: 159_add_status_to_rpc.sql
-- Description: Adds 'status' column to fetch_person_profile RPC.
-- This ensures the Detail View receives the status directly from the query.

BEGIN;

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
    custom_fields jsonb,
    status text -- [NEW] Field
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
        p.custom_fields,
        p.status::text -- [NEW] Select
    FROM cards p 
    LEFT JOIN party_memberships m ON p.id = m.person_id AND m.tenant_id = arg_tenant_id
    LEFT JOIN cards org ON m.organization_id = org.id 
    WHERE p.id = arg_person_id; 
    -- Note: Removed tenant check in previous step for visibility, keeping it loose for now via RLS
END;
$$;

COMMIT;
