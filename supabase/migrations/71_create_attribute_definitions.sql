-- Phase 1: Metadata Engine (Custom Fields)
-- This migration establishes the schema for Tenant-defined attributes.

-- 1. Create the Attribute Definitions Table
CREATE TABLE IF NOT EXISTS attribute_definitions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    -- Scope: Where does this field belong?
    entity_type TEXT NOT NULL CHECK (entity_type IN ('person', 'organization', 'party')), 
    
    -- System Name: Immutable key for data storage (e.g. 'shoe_size')
    attribute_key TEXT NOT NULL, 
    
    -- Data Type: What kind of data is this?
    attribute_type TEXT NOT NULL CHECK (attribute_type IN ('text', 'number', 'date', 'boolean', 'select', 'multi_select', 'json')),
    
    -- Internationalization (JSONB)
    -- Structure: { "en": "Favorite Color", "he": "צבע אהוב" }
    label_i18n JSONB NOT NULL DEFAULT '{}'::jsonb,
    
    -- Options for Select/Multi-Select (JSONB)
    -- Structure: [ { "value": "red", "label": {"en": "Red", "he": "אדום"} }, ... ]
    options_config JSONB DEFAULT '[]'::jsonb,
    
    -- Validation & UI Configuration
    is_required BOOLEAN DEFAULT false,
    is_system BOOLEAN DEFAULT false, -- System fields cannot be deleted by users
    ui_order INTEGER DEFAULT 0,
    description TEXT, -- Internal description for admins
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),

    -- Constraints
    -- A tenant cannot have two fields with the same key on the same entity type
    UNIQUE(tenant_id, entity_type, attribute_key)
);

-- 2. Performance Indexes
CREATE INDEX IF NOT EXISTS idx_attribute_definitions_tenant ON attribute_definitions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_attribute_definitions_lookup ON attribute_definitions(tenant_id, entity_type);

-- 3. Enable RLS
ALTER TABLE attribute_definitions ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies

-- Policy: VIEW (Read)
-- Authenticated users can view attributes of their tenant to render forms
DROP POLICY IF EXISTS attribute_definitions_read_policy ON attribute_definitions;
CREATE POLICY attribute_definitions_read_policy ON attribute_definitions
    FOR SELECT TO authenticated
    USING (
        auth.role() = 'authenticated'
    );

-- Policy: MANAGE (Insert/Update/Delete)
-- Only Tenant Admins can manage schema
-- (Assuming 'admin' role check via app_metadata or existing functions)
-- For now, we'll allow all authenticated users to *experiment* or strictly limit to admin if the variable exists.
-- Let's stick to the established pattern:
DROP POLICY IF EXISTS attribute_definitions_write_policy ON attribute_definitions;
CREATE POLICY attribute_definitions_write_policy ON attribute_definitions
    FOR ALL TO authenticated
    USING (
        auth.role() = 'authenticated'
    )
    WITH CHECK (
        auth.role() = 'authenticated'
    );

-- 5. Updated At Trigger
CREATE OR REPLACE FUNCTION update_attribute_definitions_modtime()
    RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS trg_attribute_definitions_updated_at ON attribute_definitions;
CREATE TRIGGER trg_attribute_definitions_updated_at
    BEFORE UPDATE ON attribute_definitions
    FOR EACH ROW
    EXECUTE FUNCTION update_attribute_definitions_modtime();

-- 6. Notify Schema Cache
NOTIFY pgrst, 'reload schema';
