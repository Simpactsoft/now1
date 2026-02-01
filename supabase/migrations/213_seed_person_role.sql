
-- Migration: 213_seed_person_role.sql
-- Description: Seeds the 'PERSON_ROLE' option set with standard values. 
-- Corrected for actual schema: option_sets has no name, option_values uses internal_code/label_i18n.
-- Corrected for constraint: ON CONFLICT must match (tenant_id, code).

BEGIN;

-- 1. Ensure the option set exists (Explicitly handling Global Set with NULL tenant_id)
INSERT INTO option_sets (tenant_id, code, description, is_locked)
VALUES (NULL, 'PERSON_ROLE', 'Standard functional roles for people', false)
ON CONFLICT (tenant_id, code) DO NOTHING;

-- 2. Seed Values via a temporary helper block
DO $$
DECLARE
    v_set_id uuid;
BEGIN
    -- Select the Global Set ID
    SELECT id INTO v_set_id FROM option_sets WHERE code = 'PERSON_ROLE' AND tenant_id IS NULL;

    -- Helper to insert if not exists
    create temporary table if not exists temp_roles (label text);
    insert into temp_roles (label) values 
        ('CEO'), ('CTO'), ('VP Sales'), ('Developer'), 
        ('Designer'), ('Product Manager'), ('HR Manager'), 
        ('Sales Rep'), ('Customer Success'), ('Employee'), ('Founder'), ('Marketing Manager');

    -- Insert values (Using internal_code and label_i18n)
    INSERT INTO option_values (option_set_id, internal_code, label_i18n, sort_order, is_active)
    SELECT 
        v_set_id, 
        lower(label), -- internal_code is lowercase
        jsonb_build_object('en', label, 'he', label), -- label_i18n
        row_number() over () * 10,
        true
    FROM temp_roles t
    WHERE NOT EXISTS (
        SELECT 1 FROM option_values ov 
        WHERE ov.option_set_id = v_set_id 
        AND lower(ov.internal_code) = lower(t.label)
    );
    
    DROP TABLE temp_roles;
END $$;

COMMIT;
