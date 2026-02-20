-- Migration: Dynamic Legal Terms
-- Description: Adds tags to products and creates the legal_terms_templates table to power auto-generated terms.

BEGIN;

-- 1. Add tags to products
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}'::text[];

-- Create an index to quickly find products by tag (using GIN for array types is optimal)
CREATE INDEX IF NOT EXISTS idx_products_tags ON products USING GIN (tags);

-- 2. Create the templates table
CREATE TABLE IF NOT EXISTS legal_terms_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    trigger_tag TEXT NOT NULL,
    clause_name TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(tenant_id, trigger_tag)
);

COMMENT ON TABLE legal_terms_templates IS 'Stores legal clauses that are automatically appended to quotes when a product has a matching tag in the trigger_tag column.';

-- Enable RLS
ALTER TABLE legal_terms_templates ENABLE ROW LEVEL SECURITY;

-- 3. RLS Policies
CREATE POLICY legal_terms_select ON legal_terms_templates
    FOR SELECT TO authenticated
    USING (tenant_id = get_current_tenant_id() AND get_current_tenant_id() IS NOT NULL);

CREATE POLICY legal_terms_insert ON legal_terms_templates
    FOR INSERT TO authenticated
    WITH CHECK (tenant_id = get_current_tenant_id() AND get_current_tenant_id() IS NOT NULL);

CREATE POLICY legal_terms_update ON legal_terms_templates
    FOR UPDATE TO authenticated
    USING (tenant_id = get_current_tenant_id() AND get_current_tenant_id() IS NOT NULL)
    WITH CHECK (tenant_id = get_current_tenant_id() AND get_current_tenant_id() IS NOT NULL);

CREATE POLICY legal_terms_delete ON legal_terms_templates
    FOR DELETE TO authenticated
    USING (tenant_id = get_current_tenant_id() AND get_current_tenant_id() IS NOT NULL);

-- 4. Initial Seed (Optional: basic fallback or default templates per tenant can be added here)
-- We will leave it empty and let users define their own.

COMMIT;
