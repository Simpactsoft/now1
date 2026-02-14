-- Test if RLS is blocking option_groups

-- 1. Check RLS status
SELECT 
    schemaname,
    tablename, 
    rowsecurity as rls_enabled
FROM pg_tables 
WHERE tablename IN ('option_groups', 'options');

-- 2. Show all policies on these tables
SELECT 
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual
FROM pg_policies 
WHERE tablename IN ('option_groups', 'options')
ORDER BY tablename, policyname;

-- 3. Test direct query (bypass RLS as admin)
SELECT 
    og.id,
    og.name,
    og.template_id,
    og.tenant_id,
    COUNT(o.id) as options_count
FROM option_groups og
LEFT JOIN options o ON o.group_id = og.id
WHERE og.template_id = (SELECT id FROM product_templates WHERE name = 'Sedan Economy')
GROUP BY og.id, og.name, og.template_id, og.tenant_id
ORDER BY og.display_order;
