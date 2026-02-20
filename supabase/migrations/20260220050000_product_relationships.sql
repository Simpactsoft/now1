-- Migration: 20260220050000_product_relationships.sql
-- Description: Creates the mappings table for AI-assisted cross-selling and up-selling.

BEGIN;

CREATE TABLE IF NOT EXISTS product_relationships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    source_product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    target_product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    relationship_type TEXT NOT NULL CHECK (relationship_type IN ('upsell', 'cross_sell', 'accessory')),
    confidence_score NUMERIC(5,2) DEFAULT 100.0, -- Used for AI suggestions (0.0 to 100.0)
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(tenant_id, source_product_id, target_product_id, relationship_type)
);

-- Enable RLS
ALTER TABLE product_relationships ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "product_relationships_select" ON product_relationships
    FOR SELECT TO authenticated
    USING (tenant_id = get_current_tenant_id() AND get_current_tenant_id() IS NOT NULL);

CREATE POLICY "product_relationships_insert" ON product_relationships
    FOR INSERT TO authenticated
    WITH CHECK (tenant_id = get_current_tenant_id() AND get_current_tenant_id() IS NOT NULL);

CREATE POLICY "product_relationships_update" ON product_relationships
    FOR UPDATE TO authenticated
    USING (tenant_id = get_current_tenant_id() AND get_current_tenant_id() IS NOT NULL)
    WITH CHECK (tenant_id = get_current_tenant_id() AND get_current_tenant_id() IS NOT NULL);

CREATE POLICY "product_relationships_delete" ON product_relationships
    FOR DELETE TO authenticated
    USING (tenant_id = get_current_tenant_id() AND get_current_tenant_id() IS NOT NULL);

-- Required Index for performance since Quote Builder queries by source_product_id heavily
CREATE INDEX IF NOT EXISTS idx_product_relationships_source 
ON product_relationships (tenant_id, source_product_id);

NOTIFY pgrst, 'reload schema';

COMMIT;
