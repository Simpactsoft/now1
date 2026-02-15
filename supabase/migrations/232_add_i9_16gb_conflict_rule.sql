-- Migration: 232_add_i9_16gb_conflict_rule.sql
-- Description: Add conflict rule for i9 processor with 16GB RAM
-- This complements the existing 'requires' rule by explicitly blocking incompatible options

DO $$
DECLARE
    v_tenant_id UUID := '00000000-0000-0000-0000-000000000001';
    v_template_id UUID;
    v_i9_id UUID;
    v_ram16_id UUID;
BEGIN
    -- Find the Gaming PC template
    SELECT id INTO v_template_id
    FROM product_templates
    WHERE name = 'Custom Gaming PC'
    AND tenant_id = v_tenant_id
    LIMIT 1;

    IF v_template_id IS NULL THEN
        RAISE NOTICE 'Gaming PC template not found, skipping...';
        RETURN;
    END IF;

    -- Find i9 processor option
    SELECT o.id INTO v_i9_id
    FROM options o
    JOIN option_groups og ON o.group_id = og.id
    WHERE og.template_id = v_template_id
    AND o.name = 'Intel Core i9-14900K'
    LIMIT 1;

    -- Find 16GB RAM option
    SELECT o.id INTO v_ram16_id
    FROM options o
    JOIN option_groups og ON o.group_id = og.id
    WHERE og.template_id = v_template_id
    AND o.name = '16GB DDR5-5600'
    LIMIT 1;

    IF v_i9_id IS NULL OR v_ram16_id IS NULL THEN
        RAISE NOTICE 'Required options not found, skipping...';
        RETURN;
    END IF;

    -- Add conflict rule: i9 conflicts with 16GB RAM
    INSERT INTO configuration_rules (
        tenant_id, 
        template_id, 
        rule_type, 
        name, 
        error_message,
        if_option_id, 
        then_option_id, 
        priority,
        is_active
    )
    VALUES (
        v_tenant_id, 
        v_template_id, 
        'conflicts',
        'i9 incompatible with 16GB',
        'The Intel Core i9-14900K requires a minimum of 32GB RAM for optimal performance.',
        v_i9_id, 
        v_ram16_id, 
        15,
        true
    )
    ON CONFLICT DO NOTHING;

    RAISE NOTICE '✅ Added conflict rule: i9 <-> 16GB RAM';
    RAISE NOTICE 'i9 ID: %', v_i9_id;
    RAISE NOTICE '16GB ID: %', v_ram16_id;
    
END $$;
