
-- Migration: 217_seed_organization_options.sql
-- Description: Seeds option sets for Organizations (Status, Industry, Size).

BEGIN;

-- 1. ORGANIZATION_STATUS
INSERT INTO option_sets (tenant_id, code, description, is_locked)
VALUES (NULL, 'ORGANIZATION_STATUS', 'Status lifecycle for organizations', false)
ON CONFLICT (tenant_id, code) DO NOTHING;

DO $$
DECLARE
    v_set_id uuid;
BEGIN
    SELECT id INTO v_set_id FROM option_sets WHERE code = 'ORGANIZATION_STATUS' AND tenant_id IS NULL;
    
    INSERT INTO option_values (option_set_id, internal_code, label_i18n, sort_order, is_active)
    VALUES 
    (v_set_id, 'PROSPECT', '{"en": "Prospect", "he": "מועמד"}', 10, true),
    (v_set_id, 'ACTIVE', '{"en": "Active", "he": "פעיל"}', 20, true),
    (v_set_id, 'PARTNER', '{"en": "Partner", "he": "שותף"}', 30, true),
    (v_set_id, 'CHURNED', '{"en": "Churned", "he": "עזב"}', 40, true)
    ON CONFLICT (option_set_id, tenant_id, internal_code) DO NOTHING;
END $$;


-- 2. ORGANIZATION_INDUSTRY
INSERT INTO option_sets (tenant_id, code, description, is_locked)
VALUES (NULL, 'ORGANIZATION_INDUSTRY', 'Industry verticals', false)
ON CONFLICT (tenant_id, code) DO NOTHING;

DO $$
DECLARE
    v_set_id uuid;
BEGIN
    SELECT id INTO v_set_id FROM option_sets WHERE code = 'ORGANIZATION_INDUSTRY' AND tenant_id IS NULL;
    
    INSERT INTO option_values (option_set_id, internal_code, label_i18n, sort_order, is_active)
    VALUES 
    (v_set_id, 'TECHNOLOGY', '{"en": "Technology", "he": "טכנולוגיה"}', 10, true),
    (v_set_id, 'FINANCE', '{"en": "Finance", "he": "פיננסים"}', 20, true),
    (v_set_id, 'HEALTHCARE', '{"en": "Healthcare", "he": "בריאות"}', 30, true),
    (v_set_id, 'RETAIL', '{"en": "Retail", "he": "קמעונאות"}', 40, true),
    (v_set_id, 'REAL_ESTATE', '{"en": "Real Estate", "he": "נדל\"ן"}', 50, true),
    (v_set_id, 'MANUFACTURING', '{"en": "Manufacturing", "he": "תעשייה"}', 60, true),
    (v_set_id, 'SERVICES', '{"en": "Services", "he": "שירותים"}', 70, true)
    ON CONFLICT (option_set_id, tenant_id, internal_code) DO NOTHING;
END $$;


-- 3. COMPANY_SIZE
INSERT INTO option_sets (tenant_id, code, description, is_locked)
VALUES (NULL, 'COMPANY_SIZE', 'Number of employees', false)
ON CONFLICT (tenant_id, code) DO NOTHING;

DO $$
DECLARE
    v_set_id uuid;
BEGIN
    SELECT id INTO v_set_id FROM option_sets WHERE code = 'COMPANY_SIZE' AND tenant_id IS NULL;
    
    INSERT INTO option_values (option_set_id, internal_code, label_i18n, sort_order, is_active)
    VALUES 
    (v_set_id, '1_10', '{"en": "1-10", "he": "1-10"}', 10, true),
    (v_set_id, '11_50', '{"en": "11-50", "he": "11-50"}', 20, true),
    (v_set_id, '51_200', '{"en": "51-200", "he": "51-200"}', 30, true),
    (v_set_id, '201_500', '{"en": "201-500", "he": "201-500"}', 40, true),
    (v_set_id, '500_PLUS', '{"en": "500+", "he": "500+"}', 50, true)
    ON CONFLICT (option_set_id, tenant_id, internal_code) DO NOTHING;
END $$;

COMMIT;
