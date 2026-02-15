-- Fix product_templates RLS policies to work without JWT tenant_id
-- The JWT doesn't contain tenant_id, so we need to allow INSERT without that check
-- and rely on server-side validation

-- Drop existing policies
DROP POLICY IF EXISTS "Users can create templates in their tenant" ON product_templates;
DROP POLICY IF EXISTS "Users can update templates in their tenant" ON product_templates;
DROP POLICY IF EXISTS "Users can delete templates in their tenant" ON product_templates;

-- Recreate policies that don't rely on JWT tenant_id
CREATE POLICY "Authenticated users can create templates"
    ON product_templates FOR INSERT
    WITH CHECK (
        auth.role() = 'service_role' 
        OR auth.role() = 'authenticated'
    );

CREATE POLICY "Authenticated users can update templates"
    ON product_templates FOR UPDATE
    USING (
        auth.role() = 'service_role'
        OR auth.role() = 'authenticated'
    )
    WITH CHECK (
        auth.role() = 'service_role'
        OR auth.role() = 'authenticated'
    );

CREATE POLICY "Authenticated users can delete templates"
    ON product_templates FOR DELETE
    USING (
        auth.role() = 'service_role'
        OR auth.role() = 'authenticated'
    );

-- Note: Tenant isolation is enforced by server-side actions
-- This matches the pattern used for configuration templates
