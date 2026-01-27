-- Migration: 75_seed_person_status.sql
-- Description: Seeds a global 'PERSON_STATUS' option set and adds a 'status' attribute to all existing tenants.

DO $$
DECLARE
    v_set_id UUID;
BEGIN
    -- 1. Create the Global Option Set if it doesn't exist
    INSERT INTO option_sets (tenant_id, code, description, is_locked)
    VALUES (NULL, 'PERSON_STATUS', 'Lifecycle status for a person', true)
    ON CONFLICT (tenant_id, code) WHERE tenant_id IS NULL DO UPDATE SET updated_at = now()
    RETURNING id INTO v_set_id;

    -- If not returned (because of conflict without update affecting ID?), fetch it
    IF v_set_id IS NULL THEN
        SELECT id INTO v_set_id FROM option_sets WHERE code = 'PERSON_STATUS' AND tenant_id IS NULL;
    END IF;

    -- 2. Insert Option Values (English & Hebrew)
    -- We use ON CONFLICT to ensure idempotency.
    
    -- Value: NEW
    INSERT INTO option_values (option_set_id, tenant_id, internal_code, label_i18n, sort_order, color)
    VALUES (v_set_id, NULL, 'NEW', '{"en": "New", "he": "חדש"}', 10, '#3b82f6')
    ON CONFLICT (option_set_id, tenant_id, internal_code) WHERE tenant_id IS NULL 
    DO UPDATE SET label_i18n = EXCLUDED.label_i18n, color = EXCLUDED.color;

    -- Value: CONTACTED
    INSERT INTO option_values (option_set_id, tenant_id, internal_code, label_i18n, sort_order, color)
    VALUES (v_set_id, NULL, 'CONTACTED', '{"en": "Contacted", "he": "נוצר קשר"}', 20, '#eab308')
    ON CONFLICT (option_set_id, tenant_id, internal_code) WHERE tenant_id IS NULL 
    DO UPDATE SET label_i18n = EXCLUDED.label_i18n, color = EXCLUDED.color;
    
    -- Value: QUALIFIED
    INSERT INTO option_values (option_set_id, tenant_id, internal_code, label_i18n, sort_order, color)
    VALUES (v_set_id, NULL, 'QUALIFIED', '{"en": "Qualified", "he": "מוסמך"}', 30, '#22c55e')
    ON CONFLICT (option_set_id, tenant_id, internal_code) WHERE tenant_id IS NULL 
    DO UPDATE SET label_i18n = EXCLUDED.label_i18n, color = EXCLUDED.color;

    -- Value: LOST
    INSERT INTO option_values (option_set_id, tenant_id, internal_code, label_i18n, sort_order, color)
    VALUES (v_set_id, NULL, 'LOST', '{"en": "Lost", "he": "אבוד"}', 90, '#ef4444')
    ON CONFLICT (option_set_id, tenant_id, internal_code) WHERE tenant_id IS NULL 
    DO UPDATE SET label_i18n = EXCLUDED.label_i18n, color = EXCLUDED.color;

    -- 3. Provision the Field for All Existing Tenants
    -- This inserts the 'status' attribute definition into every tenant found in the tenants table.
    -- (We use separate INSERT queries to handle conflicts gracefully if some tenants already have it)
    
    INSERT INTO attribute_definitions (
        tenant_id, 
        entity_type, 
        attribute_key, 
        attribute_type, 
        label_i18n, 
        options_config, 
        ui_order
    )
    SELECT 
        id as tenant_id,
        'person',
        'status',
        'select',
        '{"en": "Status", "he": "סטטוס"}'::jsonb,
        jsonb_build_array(jsonb_build_object('set_code', 'PERSON_STATUS')),
        0 -- Top priority
    FROM tenants
    ON CONFLICT (tenant_id, entity_type, attribute_key) 
    DO UPDATE SET 
        attribute_type = 'select',
        options_config = jsonb_build_array(jsonb_build_object('set_code', 'PERSON_STATUS'));

END $$;
