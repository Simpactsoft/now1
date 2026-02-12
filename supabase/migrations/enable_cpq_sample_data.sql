-- ============================================================================
-- ADMIN SCRIPT: Enable CPQ Sample Data
-- Run this AFTER running the main migration to insert Gaming PC test data
-- ============================================================================

-- This enables the sample data that is commented out in the migration file
-- Use this for development and testing only

DO $$
DECLARE
    v_tenant_id UUID := '00000000-0000-0000-0000-000000000001'; -- Test tenant
    v_template_id UUID;
    v_cpu_group_id UUID;
    v_ram_group_id UUID;
    v_storage_group_id UUID;
    v_gpu_group_id UUID;
    v_acc_group_id UUID;
    v_i7_id UUID;
    v_i9_id UUID;
    v_ryzen_id UUID;
    v_ram16_id UUID;
    v_ram32_id UUID;
    v_ram64_id UUID;
BEGIN
    RAISE NOTICE 'Creating Gaming PC template...';
    
    -- Template
    INSERT INTO product_templates (id, tenant_id, name, description, base_price, is_active)
    VALUES (gen_random_uuid(), v_tenant_id, 'Custom Gaming PC', 
            'Build your perfect gaming desktop with our component selection', 1500.00, true)
    RETURNING id INTO v_template_id;
    
    RAISE NOTICE '✅ Template created: %', v_template_id;
    
    -- Option Groups
    INSERT INTO option_groups (id, tenant_id, template_id, name, selection_type, is_required, display_order, source_type)
    VALUES (gen_random_uuid(), v_tenant_id, v_template_id, 'Processor', 'single', true, 1, 'manual')
    RETURNING id INTO v_cpu_group_id;
    
    INSERT INTO option_groups (id, tenant_id, template_id, name, selection_type, is_required, display_order, source_type)
    VALUES (gen_random_uuid(), v_tenant_id, v_template_id, 'Memory (RAM)', 'single', true, 2, 'manual')
    RETURNING id INTO v_ram_group_id;
    
    INSERT INTO option_groups (id, tenant_id, template_id, name, selection_type, is_required, display_order, source_type)
    VALUES (gen_random_uuid(), v_tenant_id, v_template_id, 'Storage', 'single', true, 3, 'manual')
    RETURNING id INTO v_storage_group_id;
    
    INSERT INTO option_groups (id, tenant_id, template_id, name, selection_type, is_required, display_order, source_type)
    VALUES (gen_random_uuid(), v_tenant_id, v_template_id, 'Graphics Card', 'single', false, 4, 'manual')
    RETURNING id INTO v_gpu_group_id;
    
    INSERT INTO option_groups (id, tenant_id, template_id, name, selection_type, is_required, display_order, source_type, min_selections, max_selections)
    VALUES (gen_random_uuid(), v_tenant_id, v_template_id, 'Accessories', 'multiple', false, 5, 'manual', 0, NULL)
    RETURNING id INTO v_acc_group_id;
    
    RAISE NOTICE '✅ Created 5 option groups';
    
    -- Processor Options
    INSERT INTO options (id, tenant_id, group_id, name, price_modifier_type, price_modifier_amount, is_default, display_order)
    VALUES 
        (gen_random_uuid(), v_tenant_id, v_cpu_group_id, 'Intel Core i7-14700K', 'add', 0.00, true, 1)
    RETURNING id INTO v_i7_id;
    
    INSERT INTO options (id, tenant_id, group_id, name, price_modifier_type, price_modifier_amount, display_order)
    VALUES 
        (gen_random_uuid(), v_tenant_id, v_cpu_group_id, 'Intel Core i9-14900K', 'add', 300.00, 2)
    RETURNING id INTO v_i9_id;
    
    INSERT INTO options (id, tenant_id, group_id, name, price_modifier_type, price_modifier_amount, display_order)
    VALUES 
        (gen_random_uuid(), v_tenant_id, v_cpu_group_id, 'AMD Ryzen 9 7950X', 'add', 400.00, 3)
    RETURNING id INTO v_ryzen_id;
    
    -- RAM Options
    INSERT INTO options (id, tenant_id, group_id, name, price_modifier_type, price_modifier_amount, is_default, display_order)
    VALUES 
        (gen_random_uuid(), v_tenant_id, v_ram_group_id, '16GB DDR5-5600', 'add', 0.00, true, 1)
    RETURNING id INTO v_ram16_id;
    
    INSERT INTO options (id, tenant_id, group_id, name, price_modifier_type, price_modifier_amount, display_order)
    VALUES 
        (gen_random_uuid(), v_tenant_id, v_ram_group_id, '32GB DDR5-5600', 'add', 150.00, 2)
    RETURNING id INTO v_ram32_id;
    
    INSERT INTO options (id, tenant_id, group_id, name, price_modifier_type, price_modifier_amount, display_order)
    VALUES 
        (gen_random_uuid(), v_tenant_id, v_ram_group_id, '64GB DDR5-5600', 'add', 400.00, 3)
    RETURNING id INTO v_ram64_id;
    
    -- Storage Options
    INSERT INTO options (tenant_id, group_id, name, price_modifier_type, price_modifier_amount, is_default, display_order)
    VALUES 
        (v_tenant_id, v_storage_group_id, '512GB NVMe SSD', 'add', 0.00, true, 1),
        (v_tenant_id, v_storage_group_id, '1TB NVMe SSD', 'add', 100.00, false, 2),
        (v_tenant_id, v_storage_group_id, '2TB NVMe SSD', 'add', 250.00, false, 3);
    
    -- GPU Options
    INSERT INTO options (tenant_id, group_id, name, price_modifier_type, price_modifier_amount, display_order, is_available)
    VALUES 
        (v_tenant_id, v_gpu_group_id, 'NVIDIA RTX 4070', 'add', 500.00, 1, true),
        (v_tenant_id, v_gpu_group_id, 'NVIDIA RTX 4080', 'add', 900.00, 2, true),
        (v_tenant_id, v_gpu_group_id, 'NVIDIA RTX 4090', 'add', 1500.00, 3, true);
    
    -- Accessories
    INSERT INTO options (tenant_id, group_id, name, price_modifier_type, price_modifier_amount, display_order, description)
    VALUES 
        (v_tenant_id, v_acc_group_id, 'RGB Lighting Kit', 'add', 50.00, 1, 'Customizable RGB lighting for your case'),
        (v_tenant_id, v_acc_group_id, 'Liquid Cooling System', 'add', 200.00, 2, 'Advanced cooling for overclocking'),
        (v_tenant_id, v_acc_group_id, 'Wi-Fi 6E Card', 'add', 40.00, 3, 'Latest wireless connectivity'),
        (v_tenant_id, v_acc_group_id, 'Extended Warranty (3yr)', 'add', 150.00, 4, 'Full coverage for 3 years');
    
    RAISE NOTICE '✅ Created options: 3 CPUs, 3 RAM, 3 Storage, 3 GPUs, 4 Accessories';
    
    -- Configuration Rules
    -- Rule 1: i9 processor requires minimum 32GB RAM
    INSERT INTO configuration_rules (tenant_id, template_id, rule_type, name, error_message, 
                                     if_option_id, then_group_id, priority)
    VALUES (v_tenant_id, v_template_id, 'requires', 
            'i9 requires 32GB+ RAM',
            'The Intel Core i9-14900K requires a minimum of 32GB RAM for optimal performance.',
            v_i9_id, v_ram_group_id, 10);
    
    -- Rule 2: Ryzen 9 conflicts with 16GB RAM
    INSERT INTO configuration_rules (tenant_id, template_id, rule_type, name, error_message,
                                     if_option_id, then_option_id, priority)
    VALUES (v_tenant_id, v_template_id, 'conflicts',
            'Ryzen incompatible with 16GB',
            'AMD Ryzen 9 7950X requires a minimum of 32GB RAM.',
            v_ryzen_id, v_ram16_id, 20);
    
    -- Rule 3: Volume discount at 10+ units
    INSERT INTO configuration_rules (tenant_id, template_id, rule_type, name,
                                     quantity_min, discount_type, discount_value, priority)
    VALUES (v_tenant_id, v_template_id, 'price_tier',
            '10+ unit discount',
            10, 'percentage', 5.00, 100);
    
    -- Rule 4: Volume discount at 50+ units
    INSERT INTO configuration_rules (tenant_id, template_id, rule_type, name,
                                     quantity_min, discount_type, discount_value, priority)
    VALUES (v_tenant_id, v_template_id, 'price_tier',
            '50+ unit discount',
            50, 'percentage', 10.00, 101);
    
    RAISE NOTICE '✅ Created 4 configuration rules (requires, conflicts, 2x price_tier)';
    
    -- Presets (BMW "Sport Line" pattern)
    INSERT INTO template_presets (tenant_id, template_id, name, description, selected_options, display_order, badge_text)
    VALUES 
        (v_tenant_id, v_template_id, 'Performance', 'Top-tier components for maximum gaming performance',
         jsonb_build_object(v_cpu_group_id::text, v_i9_id::text, v_ram_group_id::text, v_ram32_id::text),
         1, 'Most Popular'),
        (v_tenant_id, v_template_id, 'Budget', 'Great gaming experience at an affordable price',
         jsonb_build_object(v_cpu_group_id::text, v_i7_id::text, v_ram_group_id::text, v_ram16_id::text),
         2, 'Best Value');
    
    RAISE NOTICE '✅ Created 2 presets (Performance, Budget)';
    
    -- Final summary
    RAISE NOTICE '';
    RAISE NOTICE '═══════════════════════════════════════════════════════════';
    RAISE NOTICE '✅ Gaming PC Template Created Successfully!';
    RAISE NOTICE '═══════════════════════════════════════════════════════════';
    RAISE NOTICE 'Template ID: %', v_template_id;
    RAISE NOTICE 'Base Price: $1,500.00';
    RAISE NOTICE '';
    RAISE NOTICE 'Option Groups: 5';
    RAISE NOTICE '  - Processor (required, 3 options)';
    RAISE NOTICE '  - Memory/RAM (required, 3 options)';
    RAISE NOTICE '  - Storage (required, 3 options)';
    RAISE NOTICE '  - Graphics Card (optional, 3 options)';
    RAISE NOTICE '  - Accessories (multiple, 4 options)';
    RAISE NOTICE '';
    RAISE NOTICE 'Rules: 4 (validation + pricing)';
    RAISE NOTICE 'Presets: 2 (Performance, Budget)';
    RAISE NOTICE '';
    RAISE NOTICE 'Test URL: /configurator/%', v_template_id;
    RAISE NOTICE '═══════════════════════════════════════════════════════════';
    
END $$;

-- Verify the data
SELECT 
    'Summary' AS table_name,
    (SELECT COUNT(*) FROM product_templates WHERE name = 'Custom Gaming PC') AS templates,
    (SELECT COUNT(*) FROM option_groups WHERE template_id IN (SELECT id FROM product_templates WHERE name = 'Custom Gaming PC')) AS groups,
    (SELECT COUNT(*) FROM options WHERE group_id IN (SELECT id FROM option_groups WHERE template_id IN (SELECT id FROM product_templates WHERE name = 'Custom Gaming PC'))) AS options,
    (SELECT COUNT(*) FROM configuration_rules WHERE template_id IN (SELECT id FROM product_templates WHERE name = 'Custom Gaming PC')) AS rules,
    (SELECT COUNT(*) FROM template_presets WHERE template_id IN (SELECT id FROM product_templates WHERE name = 'Custom Gaming PC')) AS presets;
