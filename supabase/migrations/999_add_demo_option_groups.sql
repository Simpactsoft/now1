-- Add demo option groups and options to the first CPQ template
-- This creates a realistic laptop configuration example

-- Get the first template ID
DO $$
DECLARE
    v_template_id UUID;
    v_tenant_id UUID;
    v_processor_group_id UUID;
    v_ram_group_id UUID;
    v_storage_group_id UUID;
    v_accessories_group_id UUID;
BEGIN
    -- Get the first template and its tenant
    SELECT id, tenant_id INTO v_template_id, v_tenant_id
    FROM product_templates
    LIMIT 1;

    IF v_template_id IS NULL THEN
        RAISE NOTICE 'No templates found. Please create a template first.';
        RETURN;
    END IF;

    RAISE NOTICE 'Adding demo option groups to template: %', v_template_id;

    -- 1. Processor Group (Single selection, Required)
    INSERT INTO option_groups (
        id,
        tenant_id,
        template_id,
        name,
        description,
        selection_type,
        is_required,
        min_selections,
        max_selections,
        source_type,
        display_order,
        created_at,
        updated_at
    ) VALUES (
        gen_random_uuid(),
        v_tenant_id,
        v_template_id,
        'Processor',
        'Choose your CPU - the brain of your laptop',
        'single',
        true,
        1,
        1,
        'manual',
        0,
        NOW(),
        NOW()
    ) RETURNING id INTO v_processor_group_id;

    -- Processor Options
    INSERT INTO options (tenant_id, group_id, name, description, sku, price_modifier_type, price_modifier_amount, is_default, is_available, display_order, created_at, updated_at)
    VALUES
        (v_tenant_id, v_processor_group_id, 'Intel Core i5-12400', '6 cores, 12 threads, 2.5GHz base', 'CPU-I5-12400', 'add', 0, true, true, 0, NOW(), NOW()),
        (v_tenant_id, v_processor_group_id, 'Intel Core i7-12700', '12 cores, 20 threads, 2.1GHz base', 'CPU-I7-12700', 'add', 500, false, true, 1, NOW(), NOW()),
        (v_tenant_id, v_processor_group_id, 'Intel Core i9-12900K', '16 cores, 24 threads, 3.2GHz base', 'CPU-I9-12900K', 'add', 1200, false, true, 2, NOW(), NOW());

    -- 2. RAM Group (Single selection, Required)
    INSERT INTO option_groups (
        id,
        tenant_id,
        template_id,
        name,
        description,
        selection_type,
        is_required,
        min_selections,
        max_selections,
        source_type,
        display_order,
        created_at,
        updated_at
    ) VALUES (
        gen_random_uuid(),
        v_tenant_id,
        v_template_id,
        'RAM',
        'Select memory capacity',
        'single',
        true,
        1,
        1,
        'manual',
        1,
        NOW(),
        NOW()
    ) RETURNING id INTO v_ram_group_id;

    -- RAM Options
    INSERT INTO options (tenant_id, group_id, name, description, sku, price_modifier_type, price_modifier_amount, is_default, is_available, display_order, created_at, updated_at)
    VALUES
        (v_tenant_id, v_ram_group_id, '8GB DDR4', 'Perfect for basic tasks', 'RAM-8GB', 'add', 0, true, true, 0, NOW(), NOW()),
        (v_tenant_id, v_ram_group_id, '16GB DDR4', 'Great for multitasking', 'RAM-16GB', 'add', 200, false, true, 1, NOW(), NOW()),
        (v_tenant_id, v_ram_group_id, '32GB DDR4', 'Professional workloads', 'RAM-32GB', 'add', 600, false, true, 2, NOW(), NOW()),
        (v_tenant_id, v_ram_group_id, '64GB DDR5', 'Extreme performance', 'RAM-64GB', 'add', 1500, false, true, 3, NOW(), NOW());

    -- 3. Storage Group (Single selection, Required)
    INSERT INTO option_groups (
        id,
        tenant_id,
        template_id,
        name,
        description,
        selection_type,
        is_required,
        min_selections,
        max_selections,
        source_type,
        display_order,
        created_at,
        updated_at
    ) VALUES (
        gen_random_uuid(),
        v_tenant_id,
        v_template_id,
        'Storage',
        'Choose storage capacity and speed',
        'single',
        true,
        1,
        1,
        'manual',
        2,
        NOW(),
        NOW()
    ) RETURNING id INTO v_storage_group_id;

    -- Storage Options
    INSERT INTO options (tenant_id, group_id, name, description, sku, price_modifier_type, price_modifier_amount, is_default, is_available, display_order, created_at, updated_at)
    VALUES
        (v_tenant_id, v_storage_group_id, '256GB NVMe SSD', 'Fast boot and app loading', 'SSD-256GB', 'add', 0, true, true, 0, NOW(), NOW()),
        (v_tenant_id, v_storage_group_id, '512GB NVMe SSD', 'Recommended for most users', 'SSD-512GB', 'add', 300, false, true, 1, NOW(), NOW()),
        (v_tenant_id, v_storage_group_id, '1TB NVMe SSD', 'Store everything locally', 'SSD-1TB', 'add', 700, false, true, 2, NOW(), NOW()),
        (v_tenant_id, v_storage_group_id, '2TB NVMe SSD', 'Maximum capacity', 'SSD-2TB', 'add', 1400, false, true, 3, NOW(), NOW());

    -- 4. Accessories Group (Multiple selection, Optional)
    INSERT INTO option_groups (
        id,
        tenant_id,
        template_id,
        name,
        description,
        selection_type,
        is_required,
        min_selections,
        max_selections,
        source_type,
        display_order,
        created_at,
        updated_at
    ) VALUES (
        gen_random_uuid(),
        v_tenant_id,
        v_template_id,
        'Accessories',
        'Add optional accessories (select up to 3)',
        'multiple',
        false,
        0,
        3,
        'manual',
        3,
        NOW(),
        NOW()
    ) RETURNING id INTO v_accessories_group_id;

    -- Accessories Options
    INSERT INTO options (tenant_id, group_id, name, description, sku, price_modifier_type, price_modifier_amount, is_default, is_available, display_order, created_at, updated_at)
    VALUES
        (v_tenant_id, v_accessories_group_id, 'Wireless Mouse', 'Bluetooth 5.0 ergonomic mouse', 'ACC-MOUSE', 'add', 150, false, true, 0, NOW(), NOW()),
        (v_tenant_id, v_accessories_group_id, 'USB-C Hub', '7-in-1 hub with HDMI, USB 3.0', 'ACC-HUB', 'add', 250, false, true, 1, NOW(), NOW()),
        (v_tenant_id, v_accessories_group_id, 'Laptop Bag', 'Premium padded carrying case', 'ACC-BAG', 'add', 300, false, true, 2, NOW(), NOW()),
        (v_tenant_id, v_accessories_group_id, 'Extended Warranty', '2 additional years coverage', 'ACC-WARRANTY', 'add', 800, false, true, 3, NOW(), NOW());

    RAISE NOTICE 'Demo option groups created successfully!';
    RAISE NOTICE 'Groups: Processor, RAM, Storage, Accessories';
    RAISE NOTICE 'Total options: 15';

END $$;
