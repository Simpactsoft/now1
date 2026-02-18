-- ============================================================================
-- MacBook Pro Configurator - Sample Seed Data
-- Based on Apple MacBook Pro 2025 Configuration
-- ============================================================================
-- 
-- USAGE: Run this against your Supabase database.
--   Images are served from /cpq/macbook-pro/ in the Next.js public folder.
-- ============================================================================

DO $$
DECLARE
    v_tenant_id UUID;
    v_template_id UUID;
    v_group_chip UUID;
    v_group_memory UUID;
    v_group_storage UUID;
    v_group_display UUID;
    v_group_color UUID;
    v_group_adapter UUID;
    v_group_software UUID;
BEGIN
    -- Get the first tenant (adjust if needed)
    SELECT id INTO v_tenant_id FROM tenants LIMIT 1;
    
    IF v_tenant_id IS NULL THEN
        RAISE EXCEPTION 'No tenant found. Please create a tenant first.';
    END IF;

    -- ========================================================================
    -- 1. CREATE THE TEMPLATE
    -- ========================================================================
    INSERT INTO product_templates (
        tenant_id, name, description, base_price, display_mode, image_url, is_active
    ) VALUES (
        v_tenant_id,
        'MacBook Pro',
        'Configure your MacBook Pro with the chip, memory, storage, and display that''s right for you. Features the most advanced Apple silicon for pro workflows.',
        1599.00,
        'single_page',
        '/cpq/macbook-pro/hero.png',
        true
    ) RETURNING id INTO v_template_id;

    RAISE NOTICE 'Created template: % (ID: %)', 'MacBook Pro', v_template_id;

    -- ========================================================================
    -- 2. OPTION GROUPS
    -- ========================================================================

    -- Group: Chip (Processor)
    INSERT INTO option_groups (
        tenant_id, template_id, name, description, display_order,
        selection_type, is_required, min_selections, source_type,
        icon_url
    ) VALUES (
        v_tenant_id, v_template_id,
        'Chip',
        'Choose the Apple silicon chip that powers your MacBook Pro. More cores means more power for demanding pro workflows.',
        0, 'single', true, 1, 'manual',
        '/cpq/macbook-pro/chip-m4-pro.png'
    ) RETURNING id INTO v_group_chip;

    -- Group: Memory
    INSERT INTO option_groups (
        tenant_id, template_id, name, description, display_order,
        selection_type, is_required, min_selections, source_type,
        icon_url
    ) VALUES (
        v_tenant_id, v_template_id,
        'Memory',
        'Add memory to run more apps simultaneously and speed up demanding workflows like video editing and 3D rendering.',
        1, 'single', true, 1, 'manual',
        NULL
    ) RETURNING id INTO v_group_memory;

    -- Group: Storage
    INSERT INTO option_groups (
        tenant_id, template_id, name, description, display_order,
        selection_type, is_required, min_selections, source_type,
        icon_url
    ) VALUES (
        v_tenant_id, v_template_id,
        'Storage',
        'Choose the SSD storage capacity for your MacBook Pro. Store all your photos, videos, apps, and files.',
        2, 'single', true, 1, 'manual',
        NULL
    ) RETURNING id INTO v_group_storage;

    -- Group: Display
    INSERT INTO option_groups (
        tenant_id, template_id, name, description, display_order,
        selection_type, is_required, min_selections, source_type,
        icon_url
    ) VALUES (
        v_tenant_id, v_template_id,
        'Display',
        'The Liquid Retina XDR display delivers extreme dynamic range with 1000 nits sustained brightness and stunning color accuracy.',
        3, 'single', true, 1, 'manual',
        '/cpq/macbook-pro/display-standard.png'
    ) RETURNING id INTO v_group_display;

    -- Group: Color
    INSERT INTO option_groups (
        tenant_id, template_id, name, description, display_order,
        selection_type, is_required, min_selections, source_type,
        icon_url
    ) VALUES (
        v_tenant_id, v_template_id,
        'Color',
        'Choose your MacBook Pro finish.',
        4, 'single', true, 1, 'manual',
        NULL
    ) RETURNING id INTO v_group_color;

    -- Group: Power Adapter
    INSERT INTO option_groups (
        tenant_id, template_id, name, description, display_order,
        selection_type, is_required, min_selections, source_type,
        icon_url
    ) VALUES (
        v_tenant_id, v_template_id,
        'Power Adapter',
        'Select the power adapter that best suits your needs.',
        5, 'single', true, 1, 'manual',
        NULL
    ) RETURNING id INTO v_group_adapter;

    -- Group: Pre-installed Software
    INSERT INTO option_groups (
        tenant_id, template_id, name, description, display_order,
        selection_type, is_required, min_selections, source_type,
        icon_url
    ) VALUES (
        v_tenant_id, v_template_id,
        'Pre-installed Software',
        'Have professional apps pre-installed and ready to go out of the box.',
        6, 'single', false, 0, 'manual',
        NULL
    ) RETURNING id INTO v_group_software;

    -- ========================================================================
    -- 3. OPTIONS
    -- ========================================================================

    -- === CHIP OPTIONS ===
    INSERT INTO options (tenant_id, group_id, name, description, sku, price_modifier_type, price_modifier_amount, display_order, image_url, is_default, is_available) VALUES
    (v_tenant_id, v_group_chip,
     'Apple M4 chip',
     '10-core CPU, 10-core GPU, 16-core Neural Engine',
     'CHIP-M4', 'add', 0, 0,
     '/cpq/macbook-pro/chip-m4.png',
     true, true),
    (v_tenant_id, v_group_chip,
     'Apple M4 Pro chip',
     '12-core CPU, 16-core GPU, 16-core Neural Engine. Up to 2x faster than M4.',
     'CHIP-M4PRO', 'add', 200, 1,
     '/cpq/macbook-pro/chip-m4-pro.png',
     false, true),
    (v_tenant_id, v_group_chip,
     'Apple M4 Pro chip (14-core)',
     '14-core CPU, 20-core GPU, 16-core Neural Engine. Maximum M4 Pro performance.',
     'CHIP-M4PRO14', 'add', 400, 2,
     '/cpq/macbook-pro/chip-m4-pro.png',
     false, true),
    (v_tenant_id, v_group_chip,
     'Apple M4 Max chip',
     '14-core CPU, 32-core GPU, 16-core Neural Engine. The most powerful chip for MacBook Pro.',
     'CHIP-M4MAX', 'add', 900, 3,
     '/cpq/macbook-pro/chip-m4-max.png',
     false, true);

    -- === MEMORY OPTIONS ===
    INSERT INTO options (tenant_id, group_id, name, description, sku, price_modifier_type, price_modifier_amount, display_order, image_url, is_default, is_available) VALUES
    (v_tenant_id, v_group_memory,
     '16GB Unified Memory',
     'Great for everyday multitasking and light creative work.',
     'MEM-16', 'add', 0, 0, NULL, true, true),
    (v_tenant_id, v_group_memory,
     '24GB Unified Memory',
     'Ideal for demanding workflows like photo editing and development.',
     'MEM-24', 'add', 200, 1, NULL, false, true),
    (v_tenant_id, v_group_memory,
     '32GB Unified Memory',
     'Perfect for professional video editing and 3D rendering.',
     'MEM-32', 'add', 400, 2, NULL, false, true),
    (v_tenant_id, v_group_memory,
     '48GB Unified Memory',
     'Advanced multitasking and memory-intensive pro applications.',
     'MEM-48', 'add', 600, 3, NULL, false, true),
    (v_tenant_id, v_group_memory,
     '64GB Unified Memory',
     'Maximum memory for the most demanding workflows. Requires M4 Pro or M4 Max.',
     'MEM-64', 'add', 1000, 4, NULL, false, true),
    (v_tenant_id, v_group_memory,
     '128GB Unified Memory',
     'Extreme capacity for massive datasets. Requires M4 Max chip.',
     'MEM-128', 'add', 2200, 5, NULL, false, true);

    -- === STORAGE OPTIONS ===
    INSERT INTO options (tenant_id, group_id, name, description, sku, price_modifier_type, price_modifier_amount, display_order, image_url, is_default, is_available) VALUES
    (v_tenant_id, v_group_storage,
     '512GB SSD Storage',
     'For basic storage needs with fast read/write speeds.',
     'SSD-512', 'add', 0, 0, NULL, true, true),
    (v_tenant_id, v_group_storage,
     '1TB SSD Storage',
     'Room for larger projects, photo libraries, and app collections.',
     'SSD-1TB', 'add', 200, 1, NULL, false, true),
    (v_tenant_id, v_group_storage,
     '2TB SSD Storage',
     'Ample space for video projects, large datasets, and extensive libraries.',
     'SSD-2TB', 'add', 400, 2, NULL, false, true),
    (v_tenant_id, v_group_storage,
     '4TB SSD Storage',
     'Massive storage for professional workflows and large media collections.',
     'SSD-4TB', 'add', 800, 3, NULL, false, true),
    (v_tenant_id, v_group_storage,
     '8TB SSD Storage',
     'Maximum capacity for the most demanding storage needs. Requires M4 Max.',
     'SSD-8TB', 'add', 1600, 4, NULL, false, true);

    -- === DISPLAY OPTIONS ===
    INSERT INTO options (tenant_id, group_id, name, description, sku, price_modifier_type, price_modifier_amount, display_order, image_url, is_default, is_available) VALUES
    (v_tenant_id, v_group_display,
     'Standard Display',
     'Liquid Retina XDR display with 1000 nits sustained brightness.',
     'DISP-STD', 'add', 0, 0,
     '/cpq/macbook-pro/display-standard.png',
     true, true),
    (v_tenant_id, v_group_display,
     'Nano-texture Display',
     'Nano-texture glass reduces glare while maintaining image quality for any lighting environment.',
     'DISP-NANO', 'add', 150, 1,
     '/cpq/macbook-pro/display-nanotexture.png',
     false, true);

    -- === COLOR OPTIONS ===
    INSERT INTO options (tenant_id, group_id, name, description, sku, price_modifier_type, price_modifier_amount, display_order, image_url, is_default, is_available) VALUES
    (v_tenant_id, v_group_color,
     'Space Black',
     'Anodized with a breakthrough chemistry that creates a remarkably dark appearance.',
     'CLR-BLACK', 'add', 0, 0,
     '/cpq/macbook-pro/color-space-black.png',
     true, true),
    (v_tenant_id, v_group_color,
     'Silver',
     'Classic silver aluminum finish with a timeless, professional look.',
     'CLR-SILVER', 'add', 0, 1,
     '/cpq/macbook-pro/color-silver.png',
     false, true);

    -- === POWER ADAPTER OPTIONS ===
    INSERT INTO options (tenant_id, group_id, name, description, sku, price_modifier_type, price_modifier_amount, display_order, image_url, is_default, is_available) VALUES
    (v_tenant_id, v_group_adapter,
     '70W USB-C Power Adapter',
     'Compact adapter for everyday charging. Included at no extra cost.',
     'PWR-70W', 'add', 0, 0, NULL, true, true),
    (v_tenant_id, v_group_adapter,
     '96W USB-C Power Adapter',
     'Faster charging for power users who need a quick recharge.',
     'PWR-96W', 'add', 20, 1, NULL, false, true),
    (v_tenant_id, v_group_adapter,
     '140W USB-C Power Adapter',
     'Maximum wattage for fast-charging. Recommended for 16-inch models.',
     'PWR-140W', 'add', 20, 2, NULL, false, true);

    -- === SOFTWARE OPTIONS ===
    INSERT INTO options (tenant_id, group_id, name, description, sku, price_modifier_type, price_modifier_amount, display_order, image_url, is_default, is_available) VALUES
    (v_tenant_id, v_group_software,
     'Final Cut Pro',
     'Professional video editing software, pre-installed and ready to use.',
     'SW-FCP', 'add', 299.99, 0, NULL, false, true),
    (v_tenant_id, v_group_software,
     'Logic Pro',
     'Professional music production software with studio-quality instruments and effects.',
     'SW-LP', 'add', 199.99, 1, NULL, false, true);

    RAISE NOTICE '✅ MacBook Pro configurator created successfully!';
    RAISE NOTICE '   Template ID: %', v_template_id;
    RAISE NOTICE '   Groups: 7 (Chip, Memory, Storage, Display, Color, Power Adapter, Software)';
    RAISE NOTICE '   Total Options: 22';

END $$;
