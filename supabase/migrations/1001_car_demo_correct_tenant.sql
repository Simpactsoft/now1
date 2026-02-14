-- Clean up and re-create car demo with correct tenant_id
-- This fixes the tenant mismatch issue

-- First, delete the old template if it exists
DELETE FROM product_templates 
WHERE name = 'Sedan Economy' 
  AND tenant_id = '00000000-0000-0000-0000-000000000001';

-- Now create with the current active tenant (Nano Inc)
WITH template_info AS (
    SELECT '4c46ff9b-ee3e-41ae-9bd6-b1a83cbbc86c'::UUID as tenant_id
),

-- Create Car Template
car_template AS (
    INSERT INTO product_templates (
        id, tenant_id, name, description, base_price,
        display_mode, is_active, created_at, updated_at
    )
    SELECT 
        gen_random_uuid(),
        tenant_id,
        'Sedan Economy',
        'רכב משפחתי עם אפשרויות התאמה אישית',
        85000.00,
        'single_page',
        true,
        NOW(),
        NOW()
    FROM template_info
    RETURNING id, tenant_id
),

-- 1. Insert Engine Group
engine_group AS (
    INSERT INTO option_groups (
        id, tenant_id, template_id, name, description,
        selection_type, is_required, min_selections, max_selections,
        source_type, display_order, created_at, updated_at
    )
    SELECT 
        gen_random_uuid(),
        tenant_id,
        id,
        'מנוע',
        'בחר את נפח המנוע',
        'single', true, 1, 1, 'manual', 0,
        NOW(), NOW()
    FROM car_template
    RETURNING id, tenant_id
),
engine_options AS (
    INSERT INTO options (tenant_id, group_id, name, description, sku, price_modifier_type, price_modifier_amount, is_default, is_available, display_order, created_at, updated_at)
    SELECT 
        e.tenant_id, e.id,
        '1.2L טורבו (90 כ"ס)', 'מנוע חסכוני למשתמש העירוני', 'ENG-1.2T',
        'add', 0, true, true, 0, NOW(), NOW()
    FROM engine_group e
    UNION ALL
    SELECT 
        e.tenant_id, e.id,
        '1.5L טורבו (120 כ"ס)', 'איזון מושלם בין כוח לצריכה', 'ENG-1.5T',
        'add', 18000, false, true, 1, NOW(), NOW()
    FROM engine_group e
    UNION ALL
    SELECT 
        e.tenant_id, e.id,
        '2.0L טורבו (180 כ"ס)', 'ביצועים גבוהים לנהיגה דינמית', 'ENG-2.0T',
        'add', 35000, false, true, 2, NOW(), NOW()
    FROM engine_group e
    RETURNING 1
),

-- 2. Insert Equipment Package Group
equipment_group AS (
    INSERT INTO option_groups (
        id, tenant_id, template_id, name, description,
        selection_type, is_required, min_selections, max_selections,
        source_type, display_order, created_at, updated_at
    )
    SELECT 
        gen_random_uuid(),
        tenant_id,
        id,
        'חבילת אבזור',
        'בחר רמת אבזור',
        'single', true, 1, 1, 'manual', 1,
        NOW(), NOW()
    FROM car_template
    RETURNING id, tenant_id
),
equipment_options AS (
    INSERT INTO options (tenant_id, group_id, name, description, sku, price_modifier_type, price_modifier_amount, is_default, is_available, display_order, created_at, updated_at)
    SELECT 
        eq.tenant_id, eq.id,
        'Standard', 'אבזור בסיסי - מזגן, בקרת שיוט, Bluetooth', 'PKG-STD',
        'add', 0, true, true, 0, NOW(), NOW()
    FROM equipment_group eq
    UNION ALL
    SELECT 
        eq.tenant_id, eq.id,
        'Comfort', 'מושבי עור, מערכת ניווט, חיישני חניה, מצלמת רוורס', 'PKG-COM',
        'add', 25000, false, true, 1, NOW(), NOW()
    FROM equipment_group eq
    UNION ALL
    SELECT 
        eq.tenant_id, eq.id,
        'Premium', 'Comfort + גג פנורמה, מערכת סטריאו מתקדמת, מושבים מחוממים ומאווררים', 'PKG-PRM',
        'add', 45000, false, true, 2, NOW(), NOW()
    FROM equipment_group eq
    RETURNING 1
),

-- 3. Insert Color Group
color_group AS (
    INSERT INTO option_groups (
        id, tenant_id, template_id, name, description,
        selection_type, is_required, min_selections, max_selections,
        source_type, display_order, created_at, updated_at
    )
    SELECT 
        gen_random_uuid(),
        tenant_id,
        id,
        'צבע',
        'בחר צבע רכב',
        'single', true, 1, 1, 'manual', 2,
        NOW(), NOW()
    FROM car_template
    RETURNING id, tenant_id
),
color_options AS (
    INSERT INTO options (tenant_id, group_id, name, description, sku, price_modifier_type, price_modifier_amount, is_default, is_available, display_order, created_at, updated_at)
    SELECT 
        c.tenant_id, c.id,
        'לבן', 'צבע לבן סטנדרטי', 'CLR-WHT',
        'add', 0, true, true, 0, NOW(), NOW()
    FROM color_group c
    UNION ALL
    SELECT 
        c.tenant_id, c.id,
        'שחור מטאלי', 'צבע שחור מטאלי אלגנטי', 'CLR-BLK-M',
        'add', 3500, false, true, 1, NOW(), NOW()
    FROM color_group c
    UNION ALL
    SELECT 
        c.tenant_id, c.id,
        'כסוף מטאלי', 'צבע כסוף מטאלי קלאסי', 'CLR-SLV-M',
        'add', 3500, false, true, 2, NOW(), NOW()
    FROM color_group c
    UNION ALL
    SELECT 
        c.tenant_id, c.id,
        'כחול מטאלי', 'צבע כחול מטאלי מרשים', 'CLR-BLU-M',
        'add', 3500, false, true, 3, NOW(), NOW()
    FROM color_group c
    UNION ALL
    SELECT 
        c.tenant_id, c.id,
        'אדום מטאלי', 'צבע אדום מטאלי בולט', 'CLR-RED-M',
        'add', 5000, false, true, 4, NOW(), NOW()
    FROM color_group c
    RETURNING 1
),

-- 4. Insert Wheels Group
wheels_group AS (
    INSERT INTO option_groups (
        id, tenant_id, template_id, name, description,
        selection_type, is_required, min_selections, max_selections,
        source_type, display_order, created_at, updated_at
    )
    SELECT 
        gen_random_uuid(),
        tenant_id,
        id,
        'גלגלים',
        'בחר גודל וסגנון חישוקים',
        'single', true, 1, 1, 'manual', 3,
        NOW(), NOW()
    FROM car_template
    RETURNING id, tenant_id
),
wheels_options AS (
    INSERT INTO options (tenant_id, group_id, name, description, sku, price_modifier_type, price_modifier_amount, is_default, is_available, display_order, created_at, updated_at)
    SELECT 
        w.tenant_id, w.id,
        '16" פלסטיק', 'חישוקי פלסטיק 16 אינץ׳ סטנדרטיים', 'WHL-16-STD',
        'add', 0, true, true, 0, NOW(), NOW()
    FROM wheels_group w
    UNION ALL
    SELECT 
        w.tenant_id, w.id,
        '17" סגסוגת', 'חישוקי סגסוגת 17 אינץ׳', 'WHL-17-ALY',
        'add', 4000, false, true, 1, NOW(), NOW()
    FROM wheels_group w
    UNION ALL
    SELECT 
        w.tenant_id, w.id,
        '18" סגסוגת ספורט', 'חישוקי סגסוגת ספורטיביים 18 אינץ׳', 'WHL-18-SPT',
        'add', 8000, false, true, 2, NOW(), NOW()
    FROM wheels_group w
    RETURNING 1
),

-- 5. Insert Safety Features Group
safety_group AS (
    INSERT INTO option_groups (
        id, tenant_id, template_id, name, description,
        selection_type, is_required, min_selections, max_selections,
        source_type, display_order, created_at, updated_at
    )
    SELECT 
        gen_random_uuid(),
        tenant_id,
        id,
        'תוספות בטיחות',
        'הוסף תוספות בטיחות (עד 3)',
        'multiple', false, 0, 3, 'manual', 4,
        NOW(), NOW()
    FROM car_template
    RETURNING id, tenant_id
),
safety_options AS (
    INSERT INTO options (tenant_id, group_id, name, description, sku, price_modifier_type, price_modifier_amount, is_default, is_available, display_order, created_at, updated_at)
    SELECT 
        s.tenant_id, s.id,
        'בלימת חירום אוטומטית', 'מערכת AEB לזיהוי מכשולים ועוברי דרך', 'SAF-AEB',
        'add', 6000, false, true, 0, NOW(), NOW()
    FROM safety_group s
    UNION ALL
    SELECT 
        s.tenant_id, s.id,
        'שמירה על נתיב', 'מערכת LKA למניעת סטייה מנתיב', 'SAF-LKA',
        'add', 4500, false, true, 1, NOW(), NOW()
    FROM safety_group s
    UNION ALL
    SELECT 
        s.tenant_id, s.id,
        'זיהוי שטח מת', 'חיישנים לזיהוי רכבים בשטח המת', 'SAF-BSD',
        'add', 5000, false, true, 2, NOW(), NOW()
    FROM safety_group s
    UNION ALL
    SELECT 
        s.tenant_id, s.id,
        'מצלמת רוורס', 'מצלמת רוורס עם קווי הדרכה', 'SAF-RVC',
        'add', 2500, false, true, 3, NOW(), NOW()
    FROM safety_group s
    RETURNING 1
)

-- Final select to confirm
SELECT 
    (SELECT COUNT(*) FROM engine_options) as engine_opts,
    (SELECT COUNT(*) FROM equipment_options) as equipment_opts,
    (SELECT COUNT(*) FROM color_options) as color_opts,
    (SELECT COUNT(*) FROM wheels_options) as wheels_opts,
    (SELECT COUNT(*) FROM safety_options) as safety_opts;
