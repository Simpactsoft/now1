-- Add demo option groups to Custom Gaming PC template
-- Simple version without DECLARE block

-- First, get tenant_id for the template
WITH template_info AS (
    SELECT tenant_id 
    FROM product_templates 
    WHERE id = '68f22ad9-60f8-4aa2-add6-0df203aaf109'
),

-- 1. Insert Processor Group
processor_group AS (
    INSERT INTO option_groups (
        id, tenant_id, template_id, name, description,
        selection_type, is_required, min_selections, max_selections,
        source_type, display_order, created_at, updated_at
    )
    SELECT 
        gen_random_uuid(),
        tenant_id,
        '68f22ad9-60f8-4aa2-add6-0df203aaf109',
        'Processor',
        'Choose your CPU - the brain of your laptop',
        'single', true, 1, 1, 'manual', 0,
        NOW(), NOW()
    FROM template_info
    RETURNING id, tenant_id
),
processor_options AS (
    INSERT INTO options (tenant_id, group_id, name, description, sku, price_modifier_type, price_modifier_amount, is_default, is_available, display_order, created_at, updated_at)
    SELECT 
        p.tenant_id, p.id,
        'Intel Core i5-12400', '6 cores, 12 threads, 2.5GHz base', 'CPU-I5-12400',
        'add', 0, true, true, 0, NOW(), NOW()
    FROM processor_group p
    UNION ALL
    SELECT 
        p.tenant_id, p.id,
        'Intel Core i7-12700', '12 cores, 20 threads, 2.1GHz base', 'CPU-I7-12700',
        'add', 500, false, true, 1, NOW(), NOW()
    FROM processor_group p
    UNION ALL
    SELECT 
        p.tenant_id, p.id,
        'Intel Core i9-12900K', '16 cores, 24 threads, 3.2GHz base', 'CPU-I9-12900K',
        'add', 1200, false, true, 2, NOW(), NOW()
    FROM processor_group p
    RETURNING 1
),

-- 2. Insert RAM Group
ram_group AS (
    INSERT INTO option_groups (
        id, tenant_id, template_id, name, description,
        selection_type, is_required, min_selections, max_selections,
        source_type, display_order, created_at, updated_at
    )
    SELECT 
        gen_random_uuid(),
        tenant_id,
        '68f22ad9-60f8-4aa2-add6-0df203aaf109',
        'RAM',
        'Select memory capacity',
        'single', true, 1, 1, 'manual', 1,
        NOW(), NOW()
    FROM template_info
    RETURNING id, tenant_id
),
ram_options AS (
    INSERT INTO options (tenant_id, group_id, name, description, sku, price_modifier_type, price_modifier_amount, is_default, is_available, display_order, created_at, updated_at)
    SELECT 
        r.tenant_id, r.id,
        '8GB DDR4', 'Perfect for basic tasks', 'RAM-8GB',
        'add', 0, true, true, 0, NOW(), NOW()
    FROM ram_group r
    UNION ALL
    SELECT 
        r.tenant_id, r.id,
        '16GB DDR4', 'Great for multitasking', 'RAM-16GB',
        'add', 200, false, true, 1, NOW(), NOW()
    FROM ram_group r
    UNION ALL
    SELECT 
        r.tenant_id, r.id,
        '32GB DDR4', 'Professional workloads', 'RAM-32GB',
        'add', 600, false, true, 2, NOW(), NOW()
    FROM ram_group r
    UNION ALL
    SELECT 
        r.tenant_id, r.id,
        '64GB DDR5', 'Extreme performance', 'RAM-64GB',
        'add', 1500, false, true, 3, NOW(), NOW()
    FROM ram_group r
    RETURNING 1
),

-- 3. Insert Storage Group
storage_group AS (
    INSERT INTO option_groups (
        id, tenant_id, template_id, name, description,
        selection_type, is_required, min_selections, max_selections,
        source_type, display_order, created_at, updated_at
    )
    SELECT 
        gen_random_uuid(),
        tenant_id,
        '68f22ad9-60f8-4aa2-add6-0df203aaf109',
        'Storage',
        'Choose storage capacity and speed',
        'single', true, 1, 1, 'manual', 2,
        NOW(), NOW()
    FROM template_info
    RETURNING id, tenant_id
),
storage_options AS (
    INSERT INTO options (tenant_id, group_id, name, description, sku, price_modifier_type, price_modifier_amount, is_default, is_available, display_order, created_at, updated_at)
    SELECT 
        s.tenant_id, s.id,
        '256GB NVMe SSD', 'Fast boot and app loading', 'SSD-256GB',
        'add', 0, true, true, 0, NOW(), NOW()
    FROM storage_group s
    UNION ALL
    SELECT 
        s.tenant_id, s.id,
        '512GB NVMe SSD', 'Recommended for most users', 'SSD-512GB',
        'add', 300, false, true, 1, NOW(), NOW()
    FROM storage_group s
    UNION ALL
    SELECT 
        s.tenant_id, s.id,
        '1TB NVMe SSD', 'Store everything locally', 'SSD-1TB',
        'add', 700, false, true, 2, NOW(), NOW()
    FROM storage_group s
    UNION ALL
    SELECT 
        s.tenant_id, s.id,
        '2TB NVMe SSD', 'Maximum capacity', 'SSD-2TB',
        'add', 1400, false, true, 3, NOW(), NOW()
    FROM storage_group s
    RETURNING 1
),

-- 4. Insert Accessories Group
accessories_group AS (
    INSERT INTO option_groups (
        id, tenant_id, template_id, name, description,
        selection_type, is_required, min_selections, max_selections,
        source_type, display_order, created_at, updated_at
    )
    SELECT 
        gen_random_uuid(),
        tenant_id,
        '68f22ad9-60f8-4aa2-add6-0df203aaf109',
        'Accessories',
        'Add optional accessories (select up to 3)',
        'multiple', false, 0, 3, 'manual', 3,
        NOW(), NOW()
    FROM template_info
    RETURNING id, tenant_id
),
accessories_options AS (
    INSERT INTO options (tenant_id, group_id, name, description, sku, price_modifier_type, price_modifier_amount, is_default, is_available, display_order, created_at, updated_at)
    SELECT 
        a.tenant_id, a.id,
        'Wireless Mouse', 'Bluetooth 5.0 ergonomic mouse', 'ACC-MOUSE',
        'add', 150, false, true, 0, NOW(), NOW()
    FROM accessories_group a
    UNION ALL
    SELECT 
        a.tenant_id, a.id,
        'USB-C Hub', '7-in-1 hub with HDMI, USB 3.0', 'ACC-HUB',
        'add', 250, false, true, 1, NOW(), NOW()
    FROM accessories_group a
    UNION ALL
    SELECT 
        a.tenant_id, a.id,
        'Laptop Bag', 'Premium padded carrying case', 'ACC-BAG',
        'add', 300, false, true, 2, NOW(), NOW()
    FROM accessories_group a
    UNION ALL
    SELECT 
        a.tenant_id, a.id,
        'Extended Warranty', '2 additional years coverage', 'ACC-WARRANTY',
        'add', 800, false, true, 3, NOW(), NOW()
    FROM accessories_group a
    RETURNING 1
)

-- Final select to confirm
SELECT 
    (SELECT COUNT(*) FROM processor_options) as processor_opts,
    (SELECT COUNT(*) FROM ram_options) as ram_opts,
    (SELECT COUNT(*) FROM storage_options) as storage_opts,
    (SELECT COUNT(*) FROM accessories_options) as accessories_opts;
