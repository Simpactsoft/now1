
-- Migration: 275_relationship_rpcs.sql
-- Description: RPCs to handle relationships, bypassing PostgREST schema cache issues.

-- 1. Get Relationships
CREATE OR REPLACE FUNCTION get_entity_relationships(p_entity_id UUID)
RETURNS TABLE (
    rel_id UUID,
    rel_type TEXT,
    rel_type_id UUID,
    direction TEXT, -- 'forward' or 'inverse'
    target_id UUID,
    target_name TEXT,
    target_type TEXT,
    target_contact_methods JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    -- Case 1: Entity is Source (Forward)
    SELECT 
        er.id as rel_id,
        rt.name as rel_type,
        rt.id as rel_type_id,
        'forward' as direction,
        c.id as target_id,
        c.display_name as target_name,
        c.type as target_type,
        c.contact_methods as target_contact_methods
    FROM entity_relationships er
    JOIN relationship_types rt ON er.type_id = rt.id
    JOIN cards c ON er.target_id = c.id
    WHERE er.source_id = p_entity_id

    UNION ALL

    -- Case 2: Entity is Target (Inverse)
    SELECT 
        er.id as rel_id,
        COALESCE(rt.reverse_name, rt.name) as rel_type,
        rt.id as rel_type_id,
        'inverse' as direction,
        c.id as target_id,
        c.display_name as target_name,
        c.type as target_type,
        c.contact_methods as target_contact_methods
    FROM entity_relationships er
    JOIN relationship_types rt ON er.type_id = rt.id
    JOIN cards c ON er.source_id = c.id
    WHERE er.target_id = p_entity_id;
END;
$$;


-- 2. Add Relationship (With auto-create type)
CREATE OR REPLACE FUNCTION add_entity_relationship(
    p_tenant_id UUID,
    p_source_id UUID,
    p_target_id UUID,
    p_type_name TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_type_id UUID;
    v_rel_id UUID;
BEGIN
    -- 1. Find or create Type
    SELECT id INTO v_type_id 
    FROM relationship_types 
    WHERE tenant_id = p_tenant_id AND name ILIKE p_type_name
    LIMIT 1;

    IF v_type_id IS NULL THEN
        INSERT INTO relationship_types (tenant_id, name, is_directional)
        VALUES (p_tenant_id, p_type_name, true)
        RETURNING id INTO v_type_id;
    END IF;

    -- 2. Insert Relationship
    INSERT INTO entity_relationships (tenant_id, source_id, target_id, type_id)
    VALUES (p_tenant_id, p_source_id, p_target_id, v_type_id)
    RETURNING id INTO v_rel_id;

    RETURN v_rel_id;
END;
$$;

-- Permissions
GRANT EXECUTE ON FUNCTION get_entity_relationships(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_entity_relationships(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION add_entity_relationship(UUID, UUID, UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION add_entity_relationship(UUID, UUID, UUID, TEXT) TO service_role;
