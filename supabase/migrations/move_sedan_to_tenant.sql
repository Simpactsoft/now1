-- Update Sedan Economy to the correct tenant
-- Choose ONE of these options based on which tenant you're logged into:

-- Option 1: Move to the same tenant as "Custom Gaming PC" (00000000-0000-0000-0000-000000000001)
-- Uncomment this if you want it there:
/*
UPDATE product_templates 
SET tenant_id = '00000000-0000-0000-0000-000000000001'
WHERE name = 'Sedan Economy';

UPDATE option_groups 
SET tenant_id = '00000000-0000-0000-0000-000000000001'
WHERE template_id = (SELECT id FROM product_templates WHERE name = 'Sedan Economy');

UPDATE options
SET tenant_id = '00000000-0000-0000-0000-000000000001'
WHERE group_id IN (
    SELECT id FROM option_groups 
    WHERE template_id = (SELECT id FROM product_templates WHERE name = 'Sedan Economy')
);
*/

-- Option 2: Move to the same tenant as "מחשב על 1" (00000000-0000-0000-0000-000000000003)
-- Uncomment this if you want it there:
/*
UPDATE product_templates 
SET tenant_id = '00000000-0000-0000-0000-000000000003'
WHERE name = 'Sedan Economy';

UPDATE option_groups 
SET tenant_id = '00000000-0000-0000-0000-000000000003'
WHERE template_id = (SELECT id FROM product_templates WHERE name = 'Sedan Economy');

UPDATE options
SET tenant_id = '00000000-0000-0000-0000-000000000003'
WHERE group_id IN (
    SELECT id FROM option_groups 
    WHERE template_id = (SELECT id FROM product_templates WHERE name = 'Sedan Economy')
);
*/

-- Option 3: Keep it where it is (4c46ff9b-ee3e-41ae-9bd6-b1a83cbbc86c)
-- If this is the correct tenant, the issue might be RLS policies

-- After choosing, verify:
SELECT 
    pt.name,
    pt.tenant_id,
    COUNT(og.id) as groups_count
FROM product_templates pt
LEFT JOIN option_groups og ON pt.id = og.template_id
WHERE pt.name = 'Sedan Economy'
GROUP BY pt.name, pt.tenant_id;
