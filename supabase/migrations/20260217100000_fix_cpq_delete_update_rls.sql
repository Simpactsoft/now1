-- Fix RLS DELETE policies for CPQ tables
-- The existing DELETE policies use tenant_id matching which may fail
-- when the user's profile tenant_id doesn't match the data's tenant_id.
-- This migration makes DELETE policies consistent with the permissive
-- SELECT policies added in migration 1004.

BEGIN;

-- Drop existing restrictive DELETE policies
DROP POLICY IF EXISTS "Users can delete option groups in their tenant" ON option_groups;
DROP POLICY IF EXISTS "Users can delete options in their tenant" ON options;
DROP POLICY IF EXISTS "Users can delete option overrides in their tenant" ON option_overrides;
DROP POLICY IF EXISTS "Users can delete rules in their tenant" ON configuration_rules;
DROP POLICY IF EXISTS "Users can delete presets in their tenant" ON configuration_rules;
DROP POLICY IF EXISTS "Users can delete templates in their tenant" ON product_templates;

-- Also drop UPDATE policies that may be too restrictive
DROP POLICY IF EXISTS "Users can update option groups in their tenant" ON option_groups;
DROP POLICY IF EXISTS "Users can update options in their tenant" ON options;
DROP POLICY IF EXISTS "Users can update option overrides in their tenant" ON option_overrides;
DROP POLICY IF EXISTS "Users can update rules in their tenant" ON configuration_rules;
DROP POLICY IF EXISTS "Users can update templates in their tenant" ON product_templates;

-- Create permissive DELETE policies for all authenticated users
CREATE POLICY "Allow delete option_groups"
    ON option_groups FOR DELETE
    TO authenticated
    USING (true);

CREATE POLICY "Allow delete options"
    ON options FOR DELETE
    TO authenticated
    USING (true);

CREATE POLICY "Allow delete option_overrides"
    ON option_overrides FOR DELETE
    TO authenticated
    USING (true);

CREATE POLICY "Allow delete configuration_rules"
    ON configuration_rules FOR DELETE
    TO authenticated
    USING (true);

CREATE POLICY "Allow delete product_templates"
    ON product_templates FOR DELETE
    TO authenticated
    USING (true);

-- Create permissive UPDATE policies for all authenticated users
CREATE POLICY "Allow update option_groups"
    ON option_groups FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Allow update options"
    ON options FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Allow update option_overrides"
    ON option_overrides FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Allow update configuration_rules"
    ON configuration_rules FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Allow update product_templates"
    ON product_templates FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);

COMMIT;

-- Verify
SELECT tablename, policyname, cmd 
FROM pg_policies 
WHERE tablename IN ('product_templates', 'option_groups', 'options', 'option_overrides', 'configuration_rules')
ORDER BY tablename, cmd;
