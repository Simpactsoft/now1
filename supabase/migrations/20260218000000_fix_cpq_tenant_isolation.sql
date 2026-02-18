-- ============================================================================
-- Fix CPQ tenant isolation: Replace USING(true) with proper tenant_id checks
-- ============================================================================
-- Previous migration (20260217200000_fix_cpq_rls_comprehensive.sql) set all
-- CPQ policies to USING(true), allowing any authenticated user to see all data.
-- This migration restores proper tenant isolation.
--
-- Strategy: 
--   - Tables WITH tenant_id: filter directly
--   - Tables WITHOUT tenant_id (options, option_overrides): join through parent
-- ============================================================================

BEGIN;

-- ==================== product_templates ====================
DROP POLICY IF EXISTS "cpq_templates_select" ON product_templates;
DROP POLICY IF EXISTS "cpq_templates_insert" ON product_templates;
DROP POLICY IF EXISTS "cpq_templates_update" ON product_templates;
DROP POLICY IF EXISTS "cpq_templates_delete" ON product_templates;

CREATE POLICY "cpq_templates_select" ON product_templates
    FOR SELECT TO authenticated
    USING (tenant_id IN (
        SELECT tm.tenant_id FROM tenant_members tm WHERE tm.user_id = auth.uid()
    ));

CREATE POLICY "cpq_templates_insert" ON product_templates
    FOR INSERT TO authenticated
    WITH CHECK (tenant_id IN (
        SELECT tm.tenant_id FROM tenant_members tm WHERE tm.user_id = auth.uid()
    ));

CREATE POLICY "cpq_templates_update" ON product_templates
    FOR UPDATE TO authenticated
    USING (tenant_id IN (
        SELECT tm.tenant_id FROM tenant_members tm WHERE tm.user_id = auth.uid()
    ))
    WITH CHECK (tenant_id IN (
        SELECT tm.tenant_id FROM tenant_members tm WHERE tm.user_id = auth.uid()
    ));

CREATE POLICY "cpq_templates_delete" ON product_templates
    FOR DELETE TO authenticated
    USING (tenant_id IN (
        SELECT tm.tenant_id FROM tenant_members tm WHERE tm.user_id = auth.uid()
    ));

-- ==================== option_groups (has tenant_id) ====================
DROP POLICY IF EXISTS "cpq_groups_select" ON option_groups;
DROP POLICY IF EXISTS "cpq_groups_insert" ON option_groups;
DROP POLICY IF EXISTS "cpq_groups_update" ON option_groups;
DROP POLICY IF EXISTS "cpq_groups_delete" ON option_groups;

CREATE POLICY "cpq_groups_select" ON option_groups
    FOR SELECT TO authenticated
    USING (tenant_id IN (
        SELECT tm.tenant_id FROM tenant_members tm WHERE tm.user_id = auth.uid()
    ));

CREATE POLICY "cpq_groups_insert" ON option_groups
    FOR INSERT TO authenticated
    WITH CHECK (tenant_id IN (
        SELECT tm.tenant_id FROM tenant_members tm WHERE tm.user_id = auth.uid()
    ));

CREATE POLICY "cpq_groups_update" ON option_groups
    FOR UPDATE TO authenticated
    USING (tenant_id IN (
        SELECT tm.tenant_id FROM tenant_members tm WHERE tm.user_id = auth.uid()
    ))
    WITH CHECK (tenant_id IN (
        SELECT tm.tenant_id FROM tenant_members tm WHERE tm.user_id = auth.uid()
    ));

CREATE POLICY "cpq_groups_delete" ON option_groups
    FOR DELETE TO authenticated
    USING (tenant_id IN (
        SELECT tm.tenant_id FROM tenant_members tm WHERE tm.user_id = auth.uid()
    ));

-- ==================== options (no tenant_id — join through option_groups) ====================
DROP POLICY IF EXISTS "cpq_options_select" ON options;
DROP POLICY IF EXISTS "cpq_options_insert" ON options;
DROP POLICY IF EXISTS "cpq_options_update" ON options;
DROP POLICY IF EXISTS "cpq_options_delete" ON options;

CREATE POLICY "cpq_options_select" ON options
    FOR SELECT TO authenticated
    USING (group_id IN (
        SELECT og.id FROM option_groups og WHERE og.tenant_id IN (
            SELECT tm.tenant_id FROM tenant_members tm WHERE tm.user_id = auth.uid()
        )
    ));

CREATE POLICY "cpq_options_insert" ON options
    FOR INSERT TO authenticated
    WITH CHECK (group_id IN (
        SELECT og.id FROM option_groups og WHERE og.tenant_id IN (
            SELECT tm.tenant_id FROM tenant_members tm WHERE tm.user_id = auth.uid()
        )
    ));

CREATE POLICY "cpq_options_update" ON options
    FOR UPDATE TO authenticated
    USING (group_id IN (
        SELECT og.id FROM option_groups og WHERE og.tenant_id IN (
            SELECT tm.tenant_id FROM tenant_members tm WHERE tm.user_id = auth.uid()
        )
    ))
    WITH CHECK (group_id IN (
        SELECT og.id FROM option_groups og WHERE og.tenant_id IN (
            SELECT tm.tenant_id FROM tenant_members tm WHERE tm.user_id = auth.uid()
        )
    ));

CREATE POLICY "cpq_options_delete" ON options
    FOR DELETE TO authenticated
    USING (group_id IN (
        SELECT og.id FROM option_groups og WHERE og.tenant_id IN (
            SELECT tm.tenant_id FROM tenant_members tm WHERE tm.user_id = auth.uid()
        )
    ));

-- ==================== option_overrides (no tenant_id — join through option_groups) ====================
DROP POLICY IF EXISTS "cpq_overrides_select" ON option_overrides;
DROP POLICY IF EXISTS "cpq_overrides_insert" ON option_overrides;
DROP POLICY IF EXISTS "cpq_overrides_update" ON option_overrides;
DROP POLICY IF EXISTS "cpq_overrides_delete" ON option_overrides;

CREATE POLICY "cpq_overrides_select" ON option_overrides
    FOR SELECT TO authenticated
    USING (group_id IN (
        SELECT og.id FROM option_groups og WHERE og.tenant_id IN (
            SELECT tm.tenant_id FROM tenant_members tm WHERE tm.user_id = auth.uid()
        )
    ));

CREATE POLICY "cpq_overrides_insert" ON option_overrides
    FOR INSERT TO authenticated
    WITH CHECK (group_id IN (
        SELECT og.id FROM option_groups og WHERE og.tenant_id IN (
            SELECT tm.tenant_id FROM tenant_members tm WHERE tm.user_id = auth.uid()
        )
    ));

CREATE POLICY "cpq_overrides_update" ON option_overrides
    FOR UPDATE TO authenticated
    USING (group_id IN (
        SELECT og.id FROM option_groups og WHERE og.tenant_id IN (
            SELECT tm.tenant_id FROM tenant_members tm WHERE tm.user_id = auth.uid()
        )
    ))
    WITH CHECK (group_id IN (
        SELECT og.id FROM option_groups og WHERE og.tenant_id IN (
            SELECT tm.tenant_id FROM tenant_members tm WHERE tm.user_id = auth.uid()
        )
    ));

CREATE POLICY "cpq_overrides_delete" ON option_overrides
    FOR DELETE TO authenticated
    USING (group_id IN (
        SELECT og.id FROM option_groups og WHERE og.tenant_id IN (
            SELECT tm.tenant_id FROM tenant_members tm WHERE tm.user_id = auth.uid()
        )
    ));

-- ==================== configuration_rules (has template_id → product_templates) ====================
DROP POLICY IF EXISTS "cpq_rules_select" ON configuration_rules;
DROP POLICY IF EXISTS "cpq_rules_insert" ON configuration_rules;
DROP POLICY IF EXISTS "cpq_rules_update" ON configuration_rules;
DROP POLICY IF EXISTS "cpq_rules_delete" ON configuration_rules;

CREATE POLICY "cpq_rules_select" ON configuration_rules
    FOR SELECT TO authenticated
    USING (template_id IN (
        SELECT pt.id FROM product_templates pt WHERE pt.tenant_id IN (
            SELECT tm.tenant_id FROM tenant_members tm WHERE tm.user_id = auth.uid()
        )
    ));

CREATE POLICY "cpq_rules_insert" ON configuration_rules
    FOR INSERT TO authenticated
    WITH CHECK (template_id IN (
        SELECT pt.id FROM product_templates pt WHERE pt.tenant_id IN (
            SELECT tm.tenant_id FROM tenant_members tm WHERE tm.user_id = auth.uid()
        )
    ));

CREATE POLICY "cpq_rules_update" ON configuration_rules
    FOR UPDATE TO authenticated
    USING (template_id IN (
        SELECT pt.id FROM product_templates pt WHERE pt.tenant_id IN (
            SELECT tm.tenant_id FROM tenant_members tm WHERE tm.user_id = auth.uid()
        )
    ))
    WITH CHECK (template_id IN (
        SELECT pt.id FROM product_templates pt WHERE pt.tenant_id IN (
            SELECT tm.tenant_id FROM tenant_members tm WHERE tm.user_id = auth.uid()
        )
    ));

CREATE POLICY "cpq_rules_delete" ON configuration_rules
    FOR DELETE TO authenticated
    USING (template_id IN (
        SELECT pt.id FROM product_templates pt WHERE pt.tenant_id IN (
            SELECT tm.tenant_id FROM tenant_members tm WHERE tm.user_id = auth.uid()
        )
    ));

-- ==================== template_presets (has template_id → product_templates) ====================
DROP POLICY IF EXISTS "cpq_presets_select" ON template_presets;
DROP POLICY IF EXISTS "cpq_presets_insert" ON template_presets;
DROP POLICY IF EXISTS "cpq_presets_update" ON template_presets;
DROP POLICY IF EXISTS "cpq_presets_delete" ON template_presets;

CREATE POLICY "cpq_presets_select" ON template_presets
    FOR SELECT TO authenticated
    USING (template_id IN (
        SELECT pt.id FROM product_templates pt WHERE pt.tenant_id IN (
            SELECT tm.tenant_id FROM tenant_members tm WHERE tm.user_id = auth.uid()
        )
    ));

CREATE POLICY "cpq_presets_insert" ON template_presets
    FOR INSERT TO authenticated
    WITH CHECK (template_id IN (
        SELECT pt.id FROM product_templates pt WHERE pt.tenant_id IN (
            SELECT tm.tenant_id FROM tenant_members tm WHERE tm.user_id = auth.uid()
        )
    ));

CREATE POLICY "cpq_presets_update" ON template_presets
    FOR UPDATE TO authenticated
    USING (template_id IN (
        SELECT pt.id FROM product_templates pt WHERE pt.tenant_id IN (
            SELECT tm.tenant_id FROM tenant_members tm WHERE tm.user_id = auth.uid()
        )
    ))
    WITH CHECK (template_id IN (
        SELECT pt.id FROM product_templates pt WHERE pt.tenant_id IN (
            SELECT tm.tenant_id FROM tenant_members tm WHERE tm.user_id = auth.uid()
        )
    ));

CREATE POLICY "cpq_presets_delete" ON template_presets
    FOR DELETE TO authenticated
    USING (template_id IN (
        SELECT pt.id FROM product_templates pt WHERE pt.tenant_id IN (
            SELECT tm.tenant_id FROM tenant_members tm WHERE tm.user_id = auth.uid()
        )
    ));

-- ==================== configurations (has tenant_id) ====================
DROP POLICY IF EXISTS "cpq_configs_select" ON configurations;
DROP POLICY IF EXISTS "cpq_configs_insert" ON configurations;
DROP POLICY IF EXISTS "cpq_configs_update" ON configurations;
DROP POLICY IF EXISTS "cpq_configs_delete" ON configurations;

CREATE POLICY "cpq_configs_select" ON configurations
    FOR SELECT TO authenticated
    USING (tenant_id IN (
        SELECT tm.tenant_id FROM tenant_members tm WHERE tm.user_id = auth.uid()
    ));

CREATE POLICY "cpq_configs_insert" ON configurations
    FOR INSERT TO authenticated
    WITH CHECK (tenant_id IN (
        SELECT tm.tenant_id FROM tenant_members tm WHERE tm.user_id = auth.uid()
    ));

CREATE POLICY "cpq_configs_update" ON configurations
    FOR UPDATE TO authenticated
    USING (tenant_id IN (
        SELECT tm.tenant_id FROM tenant_members tm WHERE tm.user_id = auth.uid()
    ))
    WITH CHECK (tenant_id IN (
        SELECT tm.tenant_id FROM tenant_members tm WHERE tm.user_id = auth.uid()
    ));

CREATE POLICY "cpq_configs_delete" ON configurations
    FOR DELETE TO authenticated
    USING (tenant_id IN (
        SELECT tm.tenant_id FROM tenant_members tm WHERE tm.user_id = auth.uid()
    ));

COMMIT;
