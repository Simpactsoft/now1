-- Drop all existing custom policies for product_templates
-- This allows us to recreate them with the correct logic

DROP POLICY IF EXISTS "Users can create templates in their tenant" ON product_templates;
DROP POLICY IF EXISTS "Users can update templates in their tenant" ON product_templates;
DROP POLICY IF EXISTS "Users can delete templates in their tenant" ON product_templates;

-- Now recreate them with service_role bypass
CREATE POLICY "Users can create templates in their tenant"
    ON product_templates FOR INSERT
    WITH CHECK (
        auth.role() = 'service_role' 
        OR (
            tenant_id = (auth.jwt()->>'tenant_id')::uuid
            AND auth.role() = 'authenticated'
        )
    );

CREATE POLICY "Users can update templates in their tenant"
    ON product_templates FOR UPDATE
    USING (
        auth.role() = 'service_role'
        OR (
            tenant_id = (auth.jwt()->>'tenant_id')::uuid
            AND auth.role() = 'authenticated'
        )
    )
    WITH CHECK (
        auth.role() = 'service_role'
        OR (
            tenant_id = (auth.jwt()->>'tenant_id')::uuid
            AND auth.role() = 'authenticated'
        )
    );

CREATE POLICY "Users can delete templates in their tenant"
    ON product_templates FOR DELETE
    USING (
        auth.role() = 'service_role'
        OR (
            tenant_id = (auth.jwt()->>'tenant_id')::uuid
            AND auth.role() = 'authenticated'
        )
    );
