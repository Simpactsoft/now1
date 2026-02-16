-- =============================================================================
-- COMPLETE CPQ RLS FIX
-- Run this entire script to fix all RLS policies
-- =============================================================================

BEGIN;

-- Drop ALL existing policies on CPQ tables
DROP POLICY IF EXISTS "Users can view active templates in their tenant" ON product_templates;
DROP POLICY IF EXISTS "Admins can manage templates" ON product_templates;
DROP POLICY IF EXISTS "Users can view templates in their tenant" ON product_templates;
DROP POLICY IF EXISTS "Users can insert templates in their tenant" ON product_templates;
DROP POLICY IF EXISTS "Users can update templates in their tenant" ON product_templates;
DROP POLICY IF EXISTS "Users can delete templates in their tenant" ON product_templates;

DROP POLICY IF EXISTS "Users can view option groups for visible templates" ON option_groups;
DROP POLICY IF EXISTS "Admins can manage option groups" ON option_groups;
DROP POLICY IF EXISTS "Users can view option groups in their tenant" ON option_groups;
DROP POLICY IF EXISTS "Users can insert option groups in their tenant" ON option_groups;
DROP POLICY IF EXISTS "Users can update option groups in their tenant" ON option_groups;
DROP POLICY IF EXISTS "Users can delete option groups in their tenant" ON option_groups;

DROP POLICY IF EXISTS "Users can view options for visible groups" ON options;
DROP POLICY IF EXISTS "Admins can manage options" ON options;
DROP POLICY IF EXISTS "Users can view options in their tenant" ON options;
DROP POLICY IF EXISTS "Users can insert options in their tenant" ON options;
DROP POLICY IF EXISTS "Users can update options in their tenant" ON options;
DROP POLICY IF EXISTS "Users can delete options in their tenant" ON options;

DROP POLICY IF EXISTS "Users can view option overrides" ON option_overrides;
DROP POLICY IF EXISTS "Admins can manage option overrides" ON option_overrides;
DROP POLICY IF EXISTS "Users can view option overrides in their tenant" ON option_overrides;
DROP POLICY IF EXISTS "Users can insert option overrides in their tenant" ON option_overrides;
DROP POLICY IF EXISTS "Users can update option overrides in their tenant" ON option_overrides;
DROP POLICY IF EXISTS "Users can delete option overrides in their tenant" ON option_overrides;

DROP POLICY IF EXISTS "Users can view active rules for templates" ON configuration_rules;
DROP POLICY IF EXISTS "Admins can manage rules" ON configuration_rules;
DROP POLICY IF EXISTS "Users can view rules in their tenant" ON configuration_rules;
DROP POLICY IF EXISTS "Users can insert rules in their tenant" ON configuration_rules;
DROP POLICY IF EXISTS "Users can update rules in their tenant" ON configuration_rules;
DROP POLICY IF EXISTS "Users can delete rules in their tenant" ON configuration_rules;

DROP POLICY IF EXISTS "Users can view active presets" ON template_presets;
DROP POLICY IF EXISTS "Admins can manage presets" ON template_presets;
DROP POLICY IF EXISTS "Users can view presets in their tenant" ON template_presets;
DROP POLICY IF EXISTS "Users can insert presets in their tenant" ON template_presets;
DROP POLICY IF EXISTS "Users can update presets in their tenant" ON template_presets;
DROP POLICY IF EXISTS "Users can delete presets in their tenant" ON template_presets;

-- Create new policies using profiles table with proper INSERT support
-- ==================================================================

-- PRODUCT_TEMPLATES
CREATE POLICY "Users can view templates in their tenant"
    ON product_templates FOR SELECT
    USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can insert templates in their tenant"
    ON product_templates FOR INSERT
    WITH CHECK (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can update templates in their tenant"
    ON product_templates FOR UPDATE
    USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can delete templates in their tenant"
    ON product_templates FOR DELETE
    USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));

-- OPTION_GROUPS  
CREATE POLICY "Users can view option groups in their tenant"
    ON option_groups FOR SELECT
    USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can insert option groups in their tenant"
    ON option_groups FOR INSERT
    WITH CHECK (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can update option groups in their tenant"
    ON option_groups FOR UPDATE
    USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can delete option groups in their tenant"
    ON option_groups FOR DELETE
    USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));

-- OPTIONS
CREATE POLICY "Users can view options in their tenant"
    ON options FOR SELECT
    USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can insert options in their tenant"
    ON options FOR INSERT
    WITH CHECK (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can update options in their tenant"
    ON options FOR UPDATE
    USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can delete options in their tenant"
    ON options FOR DELETE
    USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));

-- OPTION_OVERRIDES
CREATE POLICY "Users can view option overrides in their tenant"
    ON option_overrides FOR SELECT
    USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can insert option overrides in their tenant"
    ON option_overrides FOR INSERT
    WITH CHECK (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can update option overrides in their tenant"
    ON option_overrides FOR UPDATE
    USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can delete option overrides in their tenant"
    ON option_overrides FOR DELETE
    USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));

-- CONFIGURATION_RULES
CREATE POLICY "Users can view rules in their tenant"
    ON configuration_rules FOR SELECT
    USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can insert rules in their tenant"
    ON configuration_rules FOR INSERT
    WITH CHECK (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can update rules in their tenant"
    ON configuration_rules FOR UPDATE
    USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can delete rules in their tenant"
    ON configuration_rules FOR DELETE
    USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));

-- TEMPLATE_PRESETS
CREATE POLICY "Users can view presets in their tenant"
    ON template_presets FOR SELECT
    USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can insert presets in their tenant"
    ON template_presets FOR INSERT
    WITH CHECK (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can update presets in their tenant"
    ON template_presets FOR UPDATE
    USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can delete presets in their tenant"
    ON template_presets FOR DELETE
    USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));

COMMIT;

-- Verify the new policies
SELECT tablename, policyname, cmd 
FROM pg_policies 
WHERE tablename IN ('product_templates', 'option_groups', 'options', 'option_overrides', 'configuration_rules', 'template_presets')
ORDER BY tablename, cmd;
