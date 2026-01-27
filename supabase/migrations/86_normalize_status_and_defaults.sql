-- Migration: 86_normalize_status_and_defaults.sql
-- Description: define PERSON_STATUS options and normalize existing data.

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
    -- We use a temp table or loop to insert values.
    
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

    -- 3. Normalize Existing Data in 'parties' table
    -- Convert known variations to Uppercase Code

    -- Update 'lead', 'Lead' -> 'LEAD'
    UPDATE parties 
    SET status = 'LEAD' 
    WHERE type = 'person' AND lower(trim(status)) IN ('lead', 'new lead', 'new', 'פנייה', 'ליד');

    -- Update 'customer', 'Active' -> 'CUSTOMER'
    UPDATE parties 
    SET status = 'CUSTOMER' 
    WHERE type = 'person' AND lower(trim(status)) IN ('customer', 'active', 'לקוח');

    -- Update 'churned', 'lost' -> 'CHURNED'
    UPDATE parties 
    SET status = 'CHURNED' 
    WHERE type = 'person' AND lower(trim(status)) IN ('churned', 'lost', 'inactive', 'נטש');
    
    -- Update 'qualified' -> 'QUALIFIED'
    UPDATE parties 
    SET status = 'QUALIFIED' 
    WHERE type = 'person' AND lower(trim(status)) IN ('qualified', 'מוסמך');

    -- Update 'partner' -> 'PARTNER'
    UPDATE parties 
    SET status = 'PARTNER' 
    WHERE type = 'person' AND lower(trim(status)) IN ('partner', 'שותף');

    -- 4. Catch-all: Uppercase anything remaining to ensure consistency (e.g. 'Pending' -> 'PENDING')
    -- Only update if it's not already uppercase to avoid trigger spam
    UPDATE parties
    SET status = upper(trim(status))
    WHERE type = 'person' AND status IS NOT NULL AND status != upper(trim(status));
    
    -- 5. If we have orphaned statuses (uppercase but not in our list), we potentially should add them to options?
    -- For now, we leaves them as Uppercase codes. The UI will show the English code if no translation.

END $$;

COMMIT;
