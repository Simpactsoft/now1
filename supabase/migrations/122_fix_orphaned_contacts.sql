
-- Migration: 122_fix_orphaned_contacts.sql
-- Description:
-- 1. Rescues "lost" contacts (like 'Noam') that were created with a TenantID mismatch (e.g. stale cookie vs real profile).
-- 2. Updates create_person to forcefully use the Profile's Tenant ID, ignoring the frontend argument.

BEGIN;

-- Part 1: Rescue Operation
-- Find cards where the assigned agent belongs to a DIFFERENT tenant than the card itself, 
-- and move the card to the agent's tenant.
-- This assumes the Agent/Creator is the source of truth.

UPDATE cards c
SET tenant_id = p.tenant_id
FROM profiles p
WHERE c.agent_id = p.id
AND c.tenant_id != p.tenant_id;

-- Also update unique_identifiers if needed (harder because constraints, but let's try)
-- Note: cascading updates usually handle this if FKs are set, but here we update the parent Card.

-- Part 2: Harden create_person
-- We override the 'arg_tenant_id' with the actual user's tenant_id from their profile.
-- This prevents "Stale Cookie" bugs.

CREATE OR REPLACE FUNCTION create_person(
    arg_tenant_id uuid, -- Kept for signature compatibility, but IGNORED (unless Service Role)
    arg_first_name text,
    arg_last_name text DEFAULT '',
    arg_email text DEFAULT NULL,
    arg_phone text DEFAULT NULL,
    arg_custom_fields jsonb DEFAULT '{}'::jsonb,
    arg_tags text[] DEFAULT '{}'::text[]
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $func$
DECLARE
    v_card_id uuid;
    v_display_name text;
    v_contact_methods jsonb := '[]'::jsonb;
    v_real_tenant_id uuid;
    v_agent_id uuid;
BEGIN
    -- 1. Resolve Tenant ID securely
    -- If user is authenticated, use their Profile's Tenant.
    -- If Service Role (admin), assume arg_tenant_id is correct.
    
    IF auth.role() = 'service_role' THEN
        v_real_tenant_id := arg_tenant_id;
    ELSE
        SELECT tenant_id, id INTO v_real_tenant_id, v_agent_id
        FROM profiles 
        WHERE id = auth.uid();
        
        IF v_real_tenant_id IS NULL THEN
            RAISE EXCEPTION 'User has no profile or tenant assigned.';
        END IF;
    END IF;

    v_display_name := trim(arg_first_name || ' ' || arg_last_name);

    IF arg_email IS NOT NULL AND length(arg_email) > 0 THEN
        v_contact_methods := v_contact_methods || jsonb_build_object('type', 'email', 'value', arg_email, 'is_primary', true);
    END IF;
    
    IF arg_phone IS NOT NULL AND length(arg_phone) > 0 THEN
        v_contact_methods := v_contact_methods || jsonb_build_object('type', 'phone', 'value', arg_phone, 'is_primary', true);
    END IF;

    INSERT INTO cards (
        tenant_id, 
        type, 
        display_name, 
        contact_methods, 
        custom_fields,
        tags,
        lifecycle_stage,
        agent_id -- Assign creator explicitly
    )
    VALUES (
        v_real_tenant_id, -- Forced correct tenant
        'person',
        v_display_name,
        v_contact_methods,
        arg_custom_fields,
        arg_tags,
        'lead',
        v_agent_id
    )
    RETURNING id INTO v_card_id;

    INSERT INTO people (
        card_id, 
        first_name, 
        last_name
    )
    VALUES (
        v_card_id,
        arg_first_name,
        arg_last_name
    );

    IF arg_email IS NOT NULL AND length(arg_email) > 0 THEN
        INSERT INTO unique_identifiers (tenant_id, card_id, identifier_type, identifier_value)
        VALUES (v_real_tenant_id, v_card_id, 'email', arg_email)
        ON CONFLICT (tenant_id, identifier_type, identifier_value) DO NOTHING;
    END IF;

    IF arg_phone IS NOT NULL AND length(arg_phone) > 0 THEN
        INSERT INTO unique_identifiers (tenant_id, card_id, identifier_type, identifier_value)
        VALUES (v_real_tenant_id, v_card_id, 'phone', arg_phone)
        ON CONFLICT (tenant_id, identifier_type, identifier_value) DO NOTHING;
    END IF;

    RETURN jsonb_build_object(
        'id', v_card_id,
        'display_name', v_display_name,
        'email', arg_email,
        'tenant_id', v_real_tenant_id -- Return where it actually went
    );
END;
$func$;

COMMIT;
