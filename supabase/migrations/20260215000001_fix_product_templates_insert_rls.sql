-- Fix product_templates RLS policies to work without JWT tenant_id
-- Instead of relying on JWT claims, we check tenant_id via the profiles table
-- This ensures tenant isolation at the database level

-- Drop existing policies
DROP POLICY IF EXISTS "Users can create templates in their tenant" ON product_templates;
DROP POLICY IF EXISTS "Users can update templates in their tenant" ON product_templates;
DROP POLICY IF EXISTS "Users can delete templates in their tenant" ON product_templates;
DROP POLICY IF EXISTS "Authenticated users can create templates" ON product_templates;
DROP POLICY IF EXISTS "Authenticated users can update templates" ON product_templates;
DROP POLICY IF EXISTS "Authenticated users can delete templates" ON product_templates;

-- Recreate policies with tenant isolation via profiles table
CREATE POLICY "Users can create templates in their tenant"
    ON product_templates FOR INSERT
    WITH CHECK (
        auth.role() = 'service_role'
        OR (
            auth.role() = 'authenticated'
            AND tenant_id = (
                SELECT p.tenant_id FROM profiles p WHERE p.id = auth.uid()
            )
        )
    );

CREATE POLICY "Users can update templates in their tenant"
    ON product_templates FOR UPDATE
    USING (
        auth.role() = 'service_role'
        OR (
            auth.role() = 'authenticated'
            AND tenant_id = (
                SELECT p.tenant_id FROM profiles p WHERE p.id = auth.uid()
            )
        )
    )
    WITH CHECK (
        auth.role() = 'service_role'
        OR (
            auth.role() = 'authenticated'
            AND tenant_id = (
                SELECT p.tenant_id FROM profiles p WHERE p.id = auth.uid()
            )
        )
    );

CREATE POLICY "Users can delete templates in their tenant"
    ON product_templates FOR DELETE
    USING (
        auth.role() = 'service_role'
        OR (
            auth.role() = 'authenticated'
            AND tenant_id = (
                SELECT p.tenant_id FROM profiles p WHERE p.id = auth.uid()
            )
        )
    );
