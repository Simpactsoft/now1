-- Migration: 1000_fix_relationship_metadata.sql
-- Description: Updates relationship RPCs to support arbitrary metadata (e.g. startDate, jobTitle).

-- 1. Update get_entity_relationships to return metadata
DROP FUNCTION IF EXISTS get_entity_relationships(uuid);

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
    metadata JSONB -- Added metadata
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
        c.contact_methods as target_contact_methods,
        er.metadata
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
        c.contact_methods as target_contact_methods,
        er.metadata
    FROM entity_relationships er
    JOIN relationship_types rt ON er.type_id = rt.id
    JOIN cards c ON er.source_id = c.id
    WHERE er.target_id = p_entity_id;
END;
$$;


-- 2. Update add_entity_relationship to accept metadata
-- Remove old signature to prevent ambiguity
DROP FUNCTION IF EXISTS add_entity_relationship(uuid, uuid, uuid, text);

CREATE OR REPLACE FUNCTION add_entity_relationship(
    p_tenant_id UUID,
    p_source_id UUID,
    p_target_id UUID,
    p_type_name TEXT,
    p_metadata JSONB DEFAULT '{}'::jsonb -- Added metadata
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
    INSERT INTO entity_relationships (tenant_id, source_id, target_id, type_id, metadata)
    VALUES (p_tenant_id, p_source_id, p_target_id, v_type_id, p_metadata)
    RETURNING id INTO v_rel_id;

    RETURN v_rel_id;
END;
$$;


-- 3. Update/Create update_entity_relationship
DROP FUNCTION IF EXISTS update_entity_relationship(uuid, uuid, text, jsonb);

CREATE OR REPLACE FUNCTION update_entity_relationship(
    p_tenant_id UUID,
    p_rel_id UUID,
    p_type_name TEXT DEFAULT NULL,
    p_metadata JSONB DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_type_id UUID;
BEGIN
    -- Update Type if provided
    IF p_type_name IS NOT NULL THEN
        -- Find or create Type
        SELECT id INTO v_type_id 
        FROM relationship_types 
        WHERE tenant_id = p_tenant_id AND name ILIKE p_type_name
        LIMIT 1;

        IF v_type_id IS NULL THEN
            INSERT INTO relationship_types (tenant_id, name, is_directional)
            VALUES (p_tenant_id, p_type_name, true)
            RETURNING id INTO v_type_id;
        END IF;

        UPDATE entity_relationships
        SET type_id = v_type_id
        WHERE id = p_rel_id AND tenant_id = p_tenant_id;
    END IF;

    -- Update Metadata if provided
    IF p_metadata IS NOT NULL THEN
        UPDATE entity_relationships
        SET metadata = p_metadata
        WHERE id = p_rel_id AND tenant_id = p_tenant_id;
    END IF;

    RETURN TRUE;
END;
$$;

-- Grant Permissions
GRANT EXECUTE ON FUNCTION get_entity_relationships(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION get_entity_relationships(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION add_entity_relationship(UUID, UUID, UUID, TEXT, JSONB) TO service_role;
GRANT EXECUTE ON FUNCTION add_entity_relationship(UUID, UUID, UUID, TEXT, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION update_entity_relationship(UUID, UUID, TEXT, JSONB) TO service_role;
GRANT EXECUTE ON FUNCTION update_entity_relationship(UUID, UUID, TEXT, JSONB) TO authenticated;

-- Force Cache Reload
NOTIFY pgrst, 'reload config';
