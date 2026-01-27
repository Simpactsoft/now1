-- Migration: 86_rapid_translation_fix.sql
-- Description: Define PERSON_STATUS options with translations.
-- This script is FAST and should not timeout.

BEGIN;

-- 1. Ensure the Option Set 'PERSON_STATUS' exists (Global)
INSERT INTO option_sets (code, description, is_locked)
VALUES ('PERSON_STATUS', 'Lifecycle status of a person', false)
ON CONFLICT (tenant_id, code) WHERE tenant_id IS NULL
DO NOTHING;

-- Capture the Set ID
DO $$
DECLARE
    v_set_id UUID;
BEGIN
    SELECT id INTO v_set_id FROM option_sets WHERE code = 'PERSON_STATUS' AND tenant_id IS NULL;

    -- 2. Upsert Default Values (Global)
    
    -- LEAD
    INSERT INTO option_values (option_set_id, internal_code, label_i18n, color, sort_order)
    VALUES (v_set_id, 'LEAD', '{"en": "Lead", "he": "ליד"}'::jsonb, '#3b82f6', 10)
    ON CONFLICT (option_set_id, tenant_id, internal_code) WHERE tenant_id IS NULL
    DO UPDATE SET label_i18n = EXCLUDED.label_i18n, color = EXCLUDED.color;

    -- QUALIFIED
    INSERT INTO option_values (option_set_id, internal_code, label_i18n, color, sort_order)
    VALUES (v_set_id, 'QUALIFIED', '{"en": "Qualified", "he": "מוסמך"}'::jsonb, '#8b5cf6', 20)
    ON CONFLICT (option_set_id, tenant_id, internal_code) WHERE tenant_id IS NULL
    DO UPDATE SET label_i18n = EXCLUDED.label_i18n, color = EXCLUDED.color;

    -- CUSTOMER
    INSERT INTO option_values (option_set_id, internal_code, label_i18n, color, sort_order)
    VALUES (v_set_id, 'CUSTOMER', '{"en": "Customer", "he": "לקוח"}'::jsonb, '#10b981', 30)
    ON CONFLICT (option_set_id, tenant_id, internal_code) WHERE tenant_id IS NULL
    DO UPDATE SET label_i18n = EXCLUDED.label_i18n, color = EXCLUDED.color;

    -- CHURNED
    INSERT INTO option_values (option_set_id, internal_code, label_i18n, color, sort_order)
    VALUES (v_set_id, 'CHURNED', '{"en": "Churned", "he": "נטש"}'::jsonb, '#ef4444', 90)
    ON CONFLICT (option_set_id, tenant_id, internal_code) WHERE tenant_id IS NULL
    DO UPDATE SET label_i18n = EXCLUDED.label_i18n, color = EXCLUDED.color;

    -- PARTNER
    INSERT INTO option_values (option_set_id, internal_code, label_i18n, color, sort_order)
    VALUES (v_set_id, 'PARTNER', '{"en": "Partner", "he": "שותף"}'::jsonb, '#f59e0b', 40)
    ON CONFLICT (option_set_id, tenant_id, internal_code) WHERE tenant_id IS NULL
    DO UPDATE SET label_i18n = EXCLUDED.label_i18n, color = EXCLUDED.color;

END $$;

COMMIT;
