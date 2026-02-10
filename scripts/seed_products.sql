-- Seed Product Categories
WITH new_root AS (
  INSERT INTO product_categories (tenant_id, name, path, parent_id)
  SELECT 
    id as tenant_id, 
    'Electronics' as name, 
    'Electronics'::ltree as path, 
    NULL as parent_id
  FROM tenants
  LIMIT 1
  RETURNING id, tenant_id, path
),
child_cat AS (
  INSERT INTO product_categories (tenant_id, name, path, parent_id)
  SELECT 
    r.tenant_id, 
    'Laptops', 
    r.path || 'Laptops', 
    r.id
  FROM new_root r
  RETURNING id, tenant_id
)
-- Seed Products
INSERT INTO products (tenant_id, name, sku, cost_price, list_price, track_inventory, category_id)
SELECT 
  c.tenant_id,
  'ProBook X1',
  'PB-X1-001',
  800.00,
  1200.00,
  true,
  c.id
FROM child_cat c;

-- Add another product
WITH new_root AS (
    SELECT id, tenant_id, path FROM product_categories WHERE name = 'Electronics' LIMIT 1
)
INSERT INTO products (tenant_id, name, sku, cost_price, list_price, track_inventory, category_id)
SELECT 
  tenant_id,
  'Wireless Mouse',
  'MS-WL-002',
  15.00,
  29.99,
  true,
  id
FROM new_root;
