-- ============================================================================
-- Comprehensive RLS fix for ALL CPQ tables
-- Drops ALL existing CPQ policies and creates clean, permissive CRUD policies
-- for authenticated users.
-- ============================================================================

BEGIN;

-- ==================== product_templates ====================
DROP POLICY IF EXISTS "Users can view templates in their tenant" ON product_templates;
DROP POLICY IF EXISTS "Users can insert templates in their tenant" ON product_templates;
DROP POLICY IF EXISTS "Users can update templates in their tenant" ON product_templates;
DROP POLICY IF EXISTS "Users can delete templates in their tenant" ON product_templates;
DROP POLICY IF EXISTS "Allow read access to product_templates" ON product_templates;
DROP POLICY IF EXISTS "Allow insert product_templates" ON product_templates;
DROP POLICY IF EXISTS "Allow update product_templates" ON product_templates;
DROP POLICY IF EXISTS "Allow delete product_templates" ON product_templates;
DROP POLICY IF EXISTS "product_templates_insert_policy" ON product_templates;

CREATE POLICY "cpq_templates_select" ON product_templates FOR SELECT TO authenticated USING (true);
CREATE POLICY "cpq_templates_insert" ON product_templates FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "cpq_templates_update" ON product_templates FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "cpq_templates_delete" ON product_templates FOR DELETE TO authenticated USING (true);

-- ==================== option_groups ====================
DROP POLICY IF EXISTS "Users can view option groups in their tenant" ON option_groups;
DROP POLICY IF EXISTS "Users can insert option groups in their tenant" ON option_groups;
DROP POLICY IF EXISTS "Users can update option groups in their tenant" ON option_groups;
DROP POLICY IF EXISTS "Users can delete option groups in their tenant" ON option_groups;
DROP POLICY IF EXISTS "Allow read access to option_groups" ON option_groups;
DROP POLICY IF EXISTS "Allow insert option_groups" ON option_groups;
DROP POLICY IF EXISTS "Allow update option_groups" ON option_groups;
DROP POLICY IF EXISTS "Allow delete option_groups" ON option_groups;

CREATE POLICY "cpq_groups_select" ON option_groups FOR SELECT TO authenticated USING (true);
CREATE POLICY "cpq_groups_insert" ON option_groups FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "cpq_groups_update" ON option_groups FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "cpq_groups_delete" ON option_groups FOR DELETE TO authenticated USING (true);

-- ==================== options ====================
DROP POLICY IF EXISTS "Users can view options in their tenant" ON options;
DROP POLICY IF EXISTS "Users can insert options in their tenant" ON options;
DROP POLICY IF EXISTS "Users can update options in their tenant" ON options;
DROP POLICY IF EXISTS "Users can delete options in their tenant" ON options;
DROP POLICY IF EXISTS "Allow read access to options" ON options;
DROP POLICY IF EXISTS "Allow insert options" ON options;
DROP POLICY IF EXISTS "Allow update options" ON options;
DROP POLICY IF EXISTS "Allow delete options" ON options;

CREATE POLICY "cpq_options_select" ON options FOR SELECT TO authenticated USING (true);
CREATE POLICY "cpq_options_insert" ON options FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "cpq_options_update" ON options FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "cpq_options_delete" ON options FOR DELETE TO authenticated USING (true);

-- ==================== option_overrides ====================
DROP POLICY IF EXISTS "Users can view option overrides in their tenant" ON option_overrides;
DROP POLICY IF EXISTS "Users can insert option overrides in their tenant" ON option_overrides;
DROP POLICY IF EXISTS "Users can update option overrides in their tenant" ON option_overrides;
DROP POLICY IF EXISTS "Users can delete option overrides in their tenant" ON option_overrides;
DROP POLICY IF EXISTS "Allow read access to option_overrides" ON option_overrides;
DROP POLICY IF EXISTS "Allow update option_overrides" ON option_overrides;
DROP POLICY IF EXISTS "Allow delete option_overrides" ON option_overrides;

CREATE POLICY "cpq_overrides_select" ON option_overrides FOR SELECT TO authenticated USING (true);
CREATE POLICY "cpq_overrides_insert" ON option_overrides FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "cpq_overrides_update" ON option_overrides FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "cpq_overrides_delete" ON option_overrides FOR DELETE TO authenticated USING (true);

-- ==================== configuration_rules ====================
DROP POLICY IF EXISTS "Users can view rules in their tenant" ON configuration_rules;
DROP POLICY IF EXISTS "Users can insert rules in their tenant" ON configuration_rules;
DROP POLICY IF EXISTS "Users can update rules in their tenant" ON configuration_rules;
DROP POLICY IF EXISTS "Users can delete rules in their tenant" ON configuration_rules;
DROP POLICY IF EXISTS "Allow read access to configuration_rules" ON configuration_rules;
DROP POLICY IF EXISTS "Allow update configuration_rules" ON configuration_rules;
DROP POLICY IF EXISTS "Allow delete configuration_rules" ON configuration_rules;

CREATE POLICY "cpq_rules_select" ON configuration_rules FOR SELECT TO authenticated USING (true);
CREATE POLICY "cpq_rules_insert" ON configuration_rules FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "cpq_rules_update" ON configuration_rules FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "cpq_rules_delete" ON configuration_rules FOR DELETE TO authenticated USING (true);

-- ==================== template_presets ====================
DROP POLICY IF EXISTS "Users can view presets in their tenant" ON template_presets;
DROP POLICY IF EXISTS "Users can insert presets in their tenant" ON template_presets;
DROP POLICY IF EXISTS "Users can update presets in their tenant" ON template_presets;
DROP POLICY IF EXISTS "Users can delete presets in their tenant" ON template_presets;

CREATE POLICY "cpq_presets_select" ON template_presets FOR SELECT TO authenticated USING (true);
CREATE POLICY "cpq_presets_insert" ON template_presets FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "cpq_presets_update" ON template_presets FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "cpq_presets_delete" ON template_presets FOR DELETE TO authenticated USING (true);

-- ==================== configurations ====================
DROP POLICY IF EXISTS "Users can view configurations in their tenant" ON configurations;
DROP POLICY IF EXISTS "Users can insert configurations in their tenant" ON configurations;
DROP POLICY IF EXISTS "Users can update configurations in their tenant" ON configurations;
DROP POLICY IF EXISTS "Users can delete configurations in their tenant" ON configurations;

CREATE POLICY "cpq_configs_select" ON configurations FOR SELECT TO authenticated USING (true);
CREATE POLICY "cpq_configs_insert" ON configurations FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "cpq_configs_update" ON configurations FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "cpq_configs_delete" ON configurations FOR DELETE TO authenticated USING (true);

COMMIT;
