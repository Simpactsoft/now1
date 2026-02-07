-- Migration: 951_patch_security_rpcs.sql
-- Description: Security Patch for Entity Relationship RPCs.
-- Fixes Critical Vulnerability: Missing tenant isolation checks in SECURITY DEFINER functions.

-- 0. Drop existing functions to allow return type/signature changes
DROP FUNCTION IF EXISTS get_entity_relationships(UUID);
DROP FUNCTION IF EXISTS add_entity_relationship(UUID, UUID, UUID, TEXT); -- Old signature
DROP FUNCTION IF EXISTS add_entity_relationship(UUID, UUID, UUID, TEXT, JSONB); -- New signature (for idempotency)

-- 1. Secure get_entity_relationships
CREATE OR REPLACE FUNCTION get_entity_relationships(p_entity_id UUID)
RETURNS TABLE (
    rel_id UUID,
    rel_type TEXT,
    rel_type_id UUID,
    direction TEXT, -- 'forward' or 'inverse'
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
BEGIN
    -- SECURITY CHECK: Verify user belongs to the same tenant as the requested entity
    SELECT c.tenant_id INTO v_tenant_id
    FROM cards c
    WHERE c.id = p_entity_id;
    
    IF v_tenant_id IS NULL THEN
        RETURN;
    END IF;

    -- Check if auth user maps to this tenant
    PERFORM 1 FROM profiles p
    WHERE p.id = auth.uid() AND p.tenant_id = v_tenant_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Unauthorized: Access Denied to this Entity';
    END IF;

    -- Proceed with query (Safe)
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
        er.metadata as metadata
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
        er.metadata as metadata
    FROM entity_relationships er
    JOIN relationship_types rt ON er.type_id = rt.id
    JOIN cards c ON er.source_id = c.id
    WHERE er.target_id = p_entity_id;
END;
$$;


-- 2. Secure add_entity_relationship
CREATE OR REPLACE FUNCTION add_entity_relationship(
    p_tenant_id UUID,
    p_source_id UUID,
    p_target_id UUID,
    p_type_name TEXT,
    p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_type_id UUID;
    v_rel_id UUID;
BEGIN
    -- SECURITY CHECK: Verify executing user belongs to the passed p_tenant_id
    PERFORM 1 FROM profiles p
    WHERE p.id = auth.uid() AND p.tenant_id = p_tenant_id;

    IF NOT FOUND THEN
         RAISE EXCEPTION 'Unauthorized: User does not belong to the requested tenant';
    END IF;

    -- Optional: Verify source and target also belong to this tenant (Defense in Depth)
    PERFORM 1 FROM cards WHERE id = p_source_id AND tenant_id = p_tenant_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Invalid Source ID for this Tenant'; END IF;
    
    PERFORM 1 FROM cards WHERE id = p_target_id AND tenant_id = p_tenant_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Invalid Target ID for this Tenant'; END IF;


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
