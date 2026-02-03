-- Migration: 281_update_relationship_rpc.sql
-- Description: RPC to update a relationship's type, creating the type if needed.

BEGIN;

CREATE OR REPLACE FUNCTION update_entity_relationship(
    p_tenant_id UUID,
    p_rel_id UUID,
    p_type_name TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_type_id UUID;
    v_updated_rel_id UUID;
BEGIN
    -- 1. Security Check: verify tenant ownership of the relationship
    -- (implicit in the update where clause, but good to check)
    PERFORM 1 FROM entity_relationships 
    WHERE id = p_rel_id AND tenant_id = p_tenant_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Relationship not found or access denied';
    END IF;

    -- 2. Find or create Type
    SELECT id INTO v_type_id 
    FROM relationship_types 
    WHERE tenant_id = p_tenant_id AND name ILIKE p_type_name
    LIMIT 1;

    IF v_type_id IS NULL THEN
        INSERT INTO relationship_types (tenant_id, name, is_directional)
        VALUES (p_tenant_id, p_type_name, true)
        RETURNING id INTO v_type_id;
    END IF;

    -- 3. Update Relationship
    UPDATE entity_relationships 
    SET type_id = v_type_id,
        updated_at = NOW()
    WHERE id = p_rel_id AND tenant_id = p_tenant_id
    RETURNING id INTO v_updated_rel_id;

    RETURN jsonb_build_object('success', true, 'id', v_updated_rel_id, 'type_id', v_type_id);
END;
$$;

-- Permissions
GRANT EXECUTE ON FUNCTION update_entity_relationship(UUID, UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION update_entity_relationship(UUID, UUID, TEXT) TO service_role;

COMMIT;
