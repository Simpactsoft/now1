-- ========================================
-- Debug Script for Sedan Economy Template
-- ========================================

-- Step 1: Fix duplicate engine group
DELETE FROM option_groups 
WHERE template_id = (SELECT id FROM product_templates WHERE name = 'Sedan Economy')
AND name = 'מנוע'
AND created_at = (
    SELECT MAX(created_at) 
    FROM option_groups 
    WHERE template_id = (SELECT id FROM product_templates WHERE name = 'Sedan Economy')
    AND name = 'מנוע'
);

-- Step 2: Test RPC function for first group
SELECT 'Testing get_group_options RPC:' as test_name;
SELECT * FROM get_group_options(
    (SELECT id FROM option_groups 
     WHERE template_id = (SELECT id FROM product_templates WHERE name = 'Sedan Economy') 
     ORDER BY display_order LIMIT 1),
    (SELECT tenant_id FROM product_templates WHERE name = 'Sedan Economy')
);

-- Step 3: Check RLS on options table
SELECT 'Checking RLS on options table:' as test_name;
SELECT tablename, rowsecurity FROM pg_tables WHERE tablename = 'options';

-- Step 4: Show all option groups with their options
SELECT 'Full template data:' as test_name;
SELECT 
    og.id as group_id,
    og.name as group_name,
    og.display_order,
    (SELECT json_agg(
        json_build_object(
            'option_id', o.option_id,
            'option_name', o.option_name,
            'price', o.price_modifier_amount
        )
    ) FROM get_group_options(og.id, og.tenant_id) o) as options
FROM option_groups og
WHERE og.template_id = (SELECT id FROM product_templates WHERE name = 'Sedan Economy')
ORDER BY og.display_order;
