-- ============================================================================
-- CPQ Audit Log — tracks all changes to CPQ entities
-- ============================================================================

BEGIN;

-- Create the audit log table
CREATE TABLE IF NOT EXISTS cpq_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id),
    template_id UUID,  -- No FK constraint: audit entries must survive template deletion
    user_id UUID,
    action TEXT NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE')),
    entity_type TEXT NOT NULL CHECK (entity_type IN (
        'product_template', 'option_group', 'option', 
        'configuration_rule', 'template_preset'
    )),
    entity_id UUID NOT NULL,
    entity_name TEXT,
    changes JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Index for fast lookups by template
CREATE INDEX IF NOT EXISTS idx_cpq_audit_log_template 
    ON cpq_audit_log(template_id, created_at DESC);

-- Enable RLS
ALTER TABLE cpq_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cpq_audit_select" ON cpq_audit_log 
    FOR SELECT TO authenticated USING (true);
CREATE POLICY "cpq_audit_insert" ON cpq_audit_log 
    FOR INSERT TO authenticated WITH CHECK (true);

-- ============================================================================
-- Trigger function: logs changes automatically
-- ============================================================================

CREATE OR REPLACE FUNCTION cpq_audit_trigger_fn()
RETURNS TRIGGER AS $$
DECLARE
    v_template_id UUID;
    v_entity_name TEXT;
    v_changes JSONB;
BEGIN
    -- Determine template_id based on entity type
    IF TG_TABLE_NAME = 'product_templates' THEN
        v_template_id := COALESCE(NEW.id, OLD.id);
        v_entity_name := COALESCE(NEW.name, OLD.name);
    ELSIF TG_TABLE_NAME = 'option_groups' THEN
        v_template_id := COALESCE(NEW.template_id, OLD.template_id);
        v_entity_name := COALESCE(NEW.name, OLD.name);
    ELSIF TG_TABLE_NAME = 'options' THEN
        -- Need to look up the template_id via the group
        IF NEW IS NOT NULL THEN
            SELECT og.template_id, NEW.name INTO v_template_id, v_entity_name
            FROM option_groups og WHERE og.id = NEW.group_id;
        ELSE
            SELECT og.template_id, OLD.name INTO v_template_id, v_entity_name
            FROM option_groups og WHERE og.id = OLD.group_id;
        END IF;
    ELSIF TG_TABLE_NAME = 'configuration_rules' THEN
        v_template_id := COALESCE(NEW.template_id, OLD.template_id);
        v_entity_name := COALESCE(NEW.name, OLD.name);
    ELSIF TG_TABLE_NAME = 'template_presets' THEN
        v_template_id := COALESCE(NEW.template_id, OLD.template_id);
        v_entity_name := COALESCE(NEW.name, OLD.name);
    END IF;

    -- Build changes JSON
    IF TG_OP = 'INSERT' THEN
        v_changes := to_jsonb(NEW);
    ELSIF TG_OP = 'DELETE' THEN
        v_changes := to_jsonb(OLD);
    ELSIF TG_OP = 'UPDATE' THEN
        -- Only store changed columns
        v_changes := jsonb_build_object(
            'old', to_jsonb(OLD),
            'new', to_jsonb(NEW)
        );
    END IF;

    INSERT INTO cpq_audit_log (
        tenant_id, template_id, user_id, action,
        entity_type, entity_id, entity_name, changes
    ) VALUES (
        COALESCE(NEW.tenant_id, OLD.tenant_id),
        v_template_id,
        auth.uid(),
        TG_OP,
        CASE TG_TABLE_NAME
            WHEN 'product_templates' THEN 'product_template'
            WHEN 'option_groups' THEN 'option_group'
            WHEN 'options' THEN 'option'
            WHEN 'configuration_rules' THEN 'configuration_rule'
            WHEN 'template_presets' THEN 'template_preset'
        END,
        COALESCE(NEW.id, OLD.id),
        v_entity_name,
        v_changes
    );

    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- Create triggers on each CPQ table
-- ============================================================================

-- product_templates
DROP TRIGGER IF EXISTS cpq_audit_product_templates ON product_templates;
CREATE TRIGGER cpq_audit_product_templates
    AFTER INSERT OR UPDATE OR DELETE ON product_templates
    FOR EACH ROW EXECUTE FUNCTION cpq_audit_trigger_fn();

-- option_groups
DROP TRIGGER IF EXISTS cpq_audit_option_groups ON option_groups;
CREATE TRIGGER cpq_audit_option_groups
    AFTER INSERT OR UPDATE OR DELETE ON option_groups
    FOR EACH ROW EXECUTE FUNCTION cpq_audit_trigger_fn();

-- options
DROP TRIGGER IF EXISTS cpq_audit_options ON options;
CREATE TRIGGER cpq_audit_options
    AFTER INSERT OR UPDATE OR DELETE ON options
    FOR EACH ROW EXECUTE FUNCTION cpq_audit_trigger_fn();

-- configuration_rules
DROP TRIGGER IF EXISTS cpq_audit_configuration_rules ON configuration_rules;
CREATE TRIGGER cpq_audit_configuration_rules
    AFTER INSERT OR UPDATE OR DELETE ON configuration_rules
    FOR EACH ROW EXECUTE FUNCTION cpq_audit_trigger_fn();

-- template_presets
DROP TRIGGER IF EXISTS cpq_audit_template_presets ON template_presets;
CREATE TRIGGER cpq_audit_template_presets
    AFTER INSERT OR UPDATE OR DELETE ON template_presets
    FOR EACH ROW EXECUTE FUNCTION cpq_audit_trigger_fn();

COMMIT;
