-- Migration: Fix get_entity_relationships RLS
-- Description: Updates the get_entity_relationships RPC to properly allow service_role bypass for the RelationshipManager.

BEGIN;

CREATE OR REPLACE FUNCTION get_entity_relationships(p_entity_id UUID)
RETURNS TABLE (
    rel_id UUID,
    rel_type TEXT,
    rel_type_id UUID,
    direction TEXT,
    target_id UUID,
    target_name TEXT,
    target_type TEXT,
    target_contact_methods JSONB,
    metadata JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_tenant_id UUID;
    v_role TEXT;
BEGIN
    -- SECURITY CHECK: Get tenant of entity
    SELECT c.tenant_id INTO v_tenant_id
    FROM cards c
    WHERE c.id = p_entity_id;
    
    IF v_tenant_id IS NULL THEN
        RETURN;
    END IF;

    -- Extract invoking role
    v_role := current_setting('request.jwt.claims', true)::jsonb->>'role';

    -- Bypass check for service_role
    IF v_role != 'service_role' THEN
        -- Standard check: Does user belong to tenant?
        PERFORM 1 FROM profiles p
        WHERE p.id = auth.uid() AND p.tenant_id = v_tenant_id;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Unauthorized: Access Denied to this Entity';
        END IF;
    END IF;

    -- Safe to Query
    RETURN QUERY
    SELECT 
        er.id as rel_id,
        rt.name as rel_type,
        rt.id as rel_type_id,
        'forward' as direction,
        c.id as target_id,
        c.display_name as target_name,
        c.type as target_type,
        c.contact_methods as target_contact_methods,
        er.metadata as metadata
    FROM entity_relationships er
    JOIN relationship_types rt ON er.type_id = rt.id
    JOIN cards c ON er.target_id = c.id
    WHERE er.source_id = p_entity_id
    
    UNION ALL

    SELECT 
        er.id as rel_id,
        COALESCE(rt.reverse_name, rt.name) as rel_type,
        rt.id as rel_type_id,
        'inverse' as direction,
        c.id as target_id,
        c.display_name as target_name,
        c.type as target_type,
        c.contact_methods as target_contact_methods,
        er.metadata as metadata
    FROM entity_relationships er
    JOIN relationship_types rt ON er.type_id = rt.id
    JOIN cards c ON er.source_id = c.id
    WHERE er.target_id = p_entity_id;
END;
$$;

GRANT EXECUTE ON FUNCTION get_entity_relationships(UUID) TO service_role, authenticated;

COMMIT;
