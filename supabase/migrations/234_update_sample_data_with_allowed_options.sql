-- Migration: 234_update_sample_data_with_allowed_options.sql
-- Description: Update sample data to use allowed_options instead of conflicts for minimum requirements

DO $$
DECLARE
    v_tenant_id UUID := '00000000-0000-0000-0000-000000000001';
    v_template_id UUID;
    v_ram_group_id UUID;
    v_i9_id UUID;
    v_ryzen_id UUID;
    v_ram32_id UUID;
    v_ram64_id UUID;
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

    -- Find RAM group
    SELECT id INTO v_ram_group_id
    FROM option_groups
    WHERE template_id = v_template_id
    AND name = 'Memory (RAM)'
    LIMIT 1;

    -- Find processor options
    SELECT o.id INTO v_i9_id
    FROM options o
    JOIN option_groups og ON o.group_id = og.id
    WHERE og.template_id = v_template_id
    AND o.name = 'Intel Core i9-14900K'
    LIMIT 1;

    SELECT o.id INTO v_ryzen_id
    FROM options o
    JOIN option_groups og ON o.group_id = og.id
    WHERE og.template_id = v_template_id
    AND o.name = 'AMD Ryzen 9 7950X'
    LIMIT 1;

    -- Find RAM options (32GB and 64GB)
    SELECT o.id INTO v_ram32_id
    FROM options o
    JOIN option_groups og ON o.group_id = og.id
    WHERE og.template_id = v_template_id
    AND o.name = '32GB DDR5-5600'
    LIMIT 1;

    SELECT o.id INTO v_ram64_id
    FROM options o
    JOIN option_groups og ON o.group_id = og.id
    WHERE og.template_id = v_template_id
    AND o.name = '64GB DDR5-5600'
    LIMIT 1;

    IF v_i9_id IS NULL OR v_ryzen_id IS NULL OR v_ram32_id IS NULL OR v_ram64_id IS NULL OR v_ram_group_id IS NULL THEN
        RAISE NOTICE 'Required options not found, skipping...';
        RETURN;
    END IF;

    -- Delete old conflict rules
    DELETE FROM configuration_rules
    WHERE template_id = v_template_id
    AND rule_type = 'conflicts'
    AND (
        (name LIKE '%i9%' AND name LIKE '%16GB%')
        OR (name LIKE '%Ryzen%' AND name LIKE '%16GB%')
    );

    -- Update i9 requires rule to use allowed_options
    UPDATE configuration_rules
    SET allowed_options = ARRAY[v_ram32_id, v_ram64_id]::UUID[]
    WHERE template_id = v_template_id
    AND rule_type = 'requires'
    AND if_option_id = v_i9_id
    AND then_group_id = v_ram_group_id;

    -- Update Ryzen conflict rule to requires with allowed_options
    DELETE FROM configuration_rules
    WHERE template_id = v_template_id
    AND rule_type = 'conflicts'
    AND if_option_id = v_ryzen_id;

    -- Add/update Ryzen requires rule with allowed_options
    INSERT INTO configuration_rules (
        tenant_id, 
        template_id, 
        rule_type, 
        name, 
        error_message,
        if_option_id, 
        then_group_id,
        allowed_options,
        priority,
        is_active
    )
    VALUES (
        v_tenant_id, 
        v_template_id, 
        'requires',
        'Ryzen requires 32GB+ RAM',
        'AMD Ryzen 9 7950X requires a minimum of 32GB RAM for optimal performance.',
        v_ryzen_id, 
        v_ram_group_id,
        ARRAY[v_ram32_id, v_ram64_id]::UUID[],
        10,
        true
    )
    ON CONFLICT DO NOTHING;

    RAISE NOTICE '✅ Updated sample data to use allowed_options approach';
    RAISE NOTICE 'i9 and Ryzen now require 32GB+ RAM using allowed_options';
    
END $$;
