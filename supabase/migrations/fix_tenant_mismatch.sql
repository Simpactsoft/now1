-- Show where Sedan Economy is and all other templates

SELECT 
    pt.name as template_name,
    pt.tenant_id,
    pt.is_active
FROM product_templates pt
ORDER BY pt.name;

