
-- Migration: 272_entity_relationships.sql
-- Description: Adds configurable relationship types and generic entity-to-entity links.

BEGIN;

-- 1. Relationship Types (Configurable definition of links)
CREATE TABLE IF NOT EXISTS relationship_types (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name text NOT NULL, -- e.g. "Employee", "Vendor", "Partner"
    reverse_name text, -- e.g. "Employer", "Client" (optional, for directional links)
    is_directional boolean DEFAULT false, -- If true, A->B != B->A
    created_at timestamptz DEFAULT now(),
    
    CONSTRAINT uniq_rel_type_name_tenant UNIQUE (tenant_id, name)
);

-- RLS for relationship_types
ALTER TABLE relationship_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "view_rel_types" ON relationship_types
    FOR SELECT TO authenticated
    USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "manage_rel_types" ON relationship_types
    FOR ALL TO authenticated
    USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()) AND public.has_permission('settings.manage'));

-- 2. Entity Relationships (The actual links)
CREATE TABLE IF NOT EXISTS entity_relationships (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    source_id uuid NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
    target_id uuid NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
    type_id uuid NOT NULL REFERENCES relationship_types(id) ON DELETE CASCADE,
    
    metadata jsonb DEFAULT '{}'::jsonb, -- Store "Job Title", "Start Date" etc here flexibly
    created_at timestamptz DEFAULT now(),

    CONSTRAINT no_self_links CHECK (source_id != target_id),
    CONSTRAINT uniq_entity_link UNIQUE (source_id, target_id, type_id)
);

-- RLS for entity_relationships
ALTER TABLE entity_relationships ENABLE ROW LEVEL SECURITY;

CREATE POLICY "view_relationships" ON entity_relationships
    FOR SELECT TO authenticated
    USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "manage_relationships" ON entity_relationships
    FOR ALL TO authenticated
    USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()) AND public.has_permission('contacts.update'));

-- 3. Indexing for performance
CREATE INDEX idx_rel_source ON entity_relationships(source_id);
CREATE INDEX idx_rel_target ON entity_relationships(target_id);
CREATE INDEX idx_rel_type ON entity_relationships(type_id);

-- 4. Seed some default types for existing tenants? 
-- (Optional, but helpful. We'll do it via a quick DO block)
DO $$
DECLARE
    t record;
BEGIN
    FOR t IN SELECT id FROM tenants LOOP
        INSERT INTO relationship_types (tenant_id, name, reverse_name, is_directional)
        VALUES 
            (t.id, 'Employee', 'Employer', true),
            (t.id, 'Supplier', 'Client', true),
            (t.id, 'Partner', 'Partner', false)
        ON CONFLICT DO NOTHING;
    END LOOP;
END $$;

COMMIT;
