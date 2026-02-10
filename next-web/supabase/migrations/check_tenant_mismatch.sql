-- Quick fix: Get your current tenant and update test data
SELECT 
    get_current_tenant_id() as your_tenant_id,
    (SELECT tenant_id FROM products WHERE sku = 'PC-DESK-001') as product_tenant_id,
    (SELECT tenant_id FROM bom_headers WHERE id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa') as bom_tenant_id;

-- If the tenant IDs don't match, you need to run fix_test_data_tenant.sql
-- But first, make sure you're logged in and have a tenant selected
