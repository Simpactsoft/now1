-- ============================================================================
-- Working SQL Queries - Galactic Stress Test Tenant
-- ============================================================================
-- Date: 2026-02-15
-- Purpose: Tested and verified queries for CPQ Configuration Templates
-- Tenant: Galactic Stress Test (00000000-0000-0000-0000-000000000003)
-- ============================================================================

-- ============================================================================
-- 1. SETUP & VERIFICATION QUERIES
-- ============================================================================

-- 1.1 Find Galactic Tenants
SELECT id, name 
FROM tenants 
WHERE name ILIKE '%galactic%' OR name ILIKE '%גלקטיק%';

/* Result:
  id: 4b1f650a-8e36-5a08-b37d-0829286b2442, name: "Galactic Holdings"
  id: 00000000-0000-0000-0000-000000000003, name: "Galactic Stress Test"
*/

-- 1.2 Find User ID
SELECT id, email 
FROM auth.users 
WHERE email = 'yb@impactsoft.co.il';

/* Result:
  id: 7ca5d523-e78c-4eaa-ab2d-29804fe92f47
*/

-- 1.3 Check User-Tenant Association
SELECT * FROM tenant_members 
WHERE user_id = '7ca5d523-e78c-4eaa-ab2d-29804fe92f47'::uuid;

/* Result:
  tenant_id: 4d145b9e-4a75-5567-a0af-bcc4a30891e5
  user_id: 7ca5d523-e78c-4eaa-ab2d-29804fe92f47
  role: "agent"
*/

-- ============================================================================
-- 2. USER-TENANT ASSOCIATION
-- ============================================================================

-- 2.1 Add User to Both Galactic Tenants
INSERT INTO tenant_members (user_id, tenant_id, role)
VALUES 
  ('7ca5d523-e78c-4eaa-ab2d-29804fe92f47'::uuid, '4b1f650a-8e36-5a08-b37d-0829286b2442'::uuid, 'member'),
  ('7ca5d523-e78c-4eaa-ab2d-29804fe92f47'::uuid, '00000000-0000-0000-0000-000000000003'::uuid, 'member')
ON CONFLICT (user_id, tenant_id) DO UPDATE SET role = 'member';

-- Success! User can now access both Galactic tenants

-- ============================================================================
-- 3. CHECK EXISTING PRODUCT TEMPLATES
-- ============================================================================

-- 3.1 Find Product Templates in Galactic Stress Test
SELECT id, name, base_price, is_active
FROM product_templates
WHERE tenant_id = '00000000-0000-0000-0000-000000000003'::uuid
  AND is_active = true
ORDER BY created_at DESC
LIMIT 10;

/* Result:
  id: d749e248-843f-497e-89fb-ed42b3f70a3d
  name: "Gaming Laptop Configurator"
  base_price: 1200.00
  
  id: 6988c976-9c75-4217-b1c1-79d16cafe381
  name: "מחשב על 1"
*/

-- 3.2 Check Option Groups for Gaming Laptop Template
SELECT 
  og.id as group_id,
  og.name as group_name,
  COUNT(o.id) as num_options
FROM option_groups og
LEFT JOIN options o ON o.group_id = og.id
WHERE og.template_id = 'd749e248-843f-497e-89fb-ed42b3f70a3d'::uuid
GROUP BY og.id, og.name
ORDER BY og.display_order;

/* Result:
  Processor: 3 options
  Memory: 3 options
  Graphics Card: 3 options
  Storage: 3 options
*/

-- ============================================================================
-- 4. CREATE CONFIGURATION TEMPLATES
-- ============================================================================

-- 4.1 Create 3 Gaming Laptop Configuration Templates
INSERT INTO configurations (
  tenant_id,
  template_id,
  template_name,
  is_template,
  selected_options,
  base_price,
  options_total,
  total_price,
  quantity,
  status,
  notes
) VALUES
  -- Budget Gaming Laptop
  (
    '00000000-0000-0000-0000-000000000003'::uuid,
    'd749e248-843f-497e-89fb-ed42b3f70a3d'::uuid,
    'Budget Gaming Laptop',
    true,
    '{"Processor": "Intel i5-13600K", "Memory": "16GB DDR5", "Graphics Card": "RTX 4060", "Storage": "512GB NVMe"}'::jsonb,
    1200.00,
    0.00,
    1200.00,
    1,
    'completed',
    'Entry-level gaming configuration'
  ),
  -- Standard Gaming Laptop
  (
    '00000000-0000-0000-0000-000000000003'::uuid,
    'd749e248-843f-497e-89fb-ed42b3f70a3d'::uuid,
    'Standard Gaming Laptop',
    true,
    '{"Processor": "Intel i7-13700K", "Memory": "32GB DDR5", "Graphics Card": "RTX 4070", "Storage": "1TB NVMe"}'::jsonb,
    1200.00,
    530.00,
    1730.00,
    1,
    'completed',
    'Most popular gaming configuration'
  ),
  -- Premium Gaming Laptop
  (
    '00000000-0000-0000-0000-000000000003'::uuid,
    'd749e248-843f-497e-89fb-ed42b3f70a3d'::uuid,
    'Premium Gaming Laptop',
    true,
    '{"Processor": "Intel i9-13900K", "Memory": "64GB DDR5", "Graphics Card": "RTX 4080", "Storage": "2TB NVMe"}'::jsonb,
    1200.00,
    1280.00,
    2480.00,
    1,
    'completed',
    'Ultimate gaming powerhouse'
  );

-- Success! 3 rows inserted

-- ============================================================================
-- 5. VERIFY CONFIGURATIONS CREATED
-- ============================================================================

-- 5.1 Check All Configuration Templates
SELECT 
  id,
  template_name,
  total_price,
  is_template,
  selected_options,
  created_at
FROM configurations
WHERE tenant_id = '00000000-0000-0000-0000-000000000003'::uuid
  AND is_template = true
ORDER BY total_price;

/* Result:
  id: d1ac2f60-d912-40fd-9f2e-246ace877c1a
  template_name: "Budget Gaming Laptop"
  total_price: 1200.00
  is_template: true
  selected_options: {"cpu": "Intel i5-13600K", "gpu": "RTX 4060", "ram": "16GB DDR5", "storage": "512GB NVMe"}
  created_at: 2026-02-14 09:25:52.458568+00
  
  id: a1f68a42-a77c-4f6b-a275-29cf8743e7b2
  template_name: "Standard Gaming Laptop"
  total_price: 1730.00
  is_template: true
  selected_options: {"cpu": "Intel i7-13700K", "gpu": "RTX 4070", "ram": "32GB DDR5", "storage": "1TB NVMe"}
  created_at: 2026-02-14 09:25:52.458568+00
  
  id: 93623b55-8529-4d3b-9e32-30c43993710e
  template_name: "Premium Gaming Laptop"
  total_price: 2480.00
  is_template: true
  selected_options: {"cpu": "Intel i9-13900K", "gpu": "RTX 4080", "ram": "64GB DDR5", "storage": "2TB NVMe"}
  created_at: 2026-02-14 09:25:52.458568+00
*/

-- 5.2 Count Templates
SELECT COUNT(*) as template_count
FROM configurations
WHERE is_template = true
  AND tenant_id = '00000000-0000-0000-0000-000000000003'::uuid;

/* Result:
  template_count: 3
*/

-- ============================================================================
-- 6. RLS DIAGNOSTICS
-- ============================================================================

-- 6.1 Check Existing RLS Policies
SELECT 
  policyname,
  cmd,
  qual
FROM pg_policies
WHERE tablename = 'configurations';

/* Result:
  - "Anyone can view shared configurations" (SELECT)
  - "Users can create configurations" (INSERT)
  - "Users can update own draft configurations" (UPDATE)
  - "Users can view own configurations" (SELECT)
  - "Users cannot delete configurations" (DELETE)
*/

-- 6.2 Check JWT Content
SELECT 
  auth.jwt() ->> 'tenant_id' as jwt_tenant_id,
  auth.jwt() ->> 'email' as jwt_email;

/* Result:
  jwt_tenant_id: null
  jwt_email: null
  
  ISSUE: JWT doesn't contain tenant_id!
*/

-- 6.3 Check Product Templates RLS (for reference)
SELECT policyname, cmd, qual
FROM pg_policies
WHERE tablename = 'product_templates';

/* Result:
  - Uses auth.jwt() ->> 'tenant_id' for filtering
  - BUT our JWT is null, so this approach won't work!
*/

-- ============================================================================
-- 7. RLS FIX
-- ============================================================================

-- 7.1 Drop Old Policy (if exists)
DROP POLICY IF EXISTS "Users can view configuration templates in their tenant" ON configurations;

-- 7.2 Add New Permissive Policy
CREATE POLICY "Authenticated users can view configuration templates"
ON configurations
FOR SELECT
TO authenticated
USING (is_template = true);

-- Success! Policy created

-- 7.3 Verify Policy Added
SELECT policyname 
FROM pg_policies 
WHERE tablename = 'configurations' 
  AND policyname LIKE '%template%';

/* Result:
  "Authenticated users can view configuration templates"
*/

-- ============================================================================
-- 8. FINAL VERIFICATION
-- ============================================================================

-- 8.1 Verify Templates Visible
SELECT 
  template_name,
  total_price,
  selected_options
FROM configurations
WHERE tenant_id = '00000000-0000-0000-0000-000000000003'::uuid
  AND is_template = true;

/* Result: ✅ 3 templates visible */

-- ============================================================================
-- 9. CLEANUP / TROUBLESHOOTING QUERIES
-- ============================================================================

-- 9.1 Delete All Configurations for Tenant (if needed)
-- CAUTION: Use only for cleanup!
-- DELETE FROM configurations 
-- WHERE tenant_id = '00000000-0000-0000-0000-000000000003'::uuid;

-- 9.2 Check for Duplicate Templates
SELECT 
  template_name, 
  COUNT(*) as count
FROM configurations
WHERE is_template = true
  AND tenant_id = '00000000-0000-0000-0000-000000000003'::uuid
GROUP BY template_name
HAVING COUNT(*) > 1;

/* Result: No duplicates */

-- 9.3 Find All Configurations (not just templates)
SELECT 
  id,
  template_name,
  is_template,
  user_id,
  status,
  created_at
FROM configurations
WHERE tenant_id = '00000000-0000-0000-0000-000000000003'::uuid
ORDER BY created_at DESC
LIMIT 20;

-- ============================================================================
-- 10. USEFUL ADMIN QUERIES
-- ============================================================================

-- 10.1 Show All Tenants with Configuration Count
SELECT 
  t.id,
  t.name,
  COUNT(c.id) as config_count,
  COUNT(c.id) FILTER (WHERE c.is_template = true) as template_count
FROM tenants t
LEFT JOIN configurations c ON c.tenant_id = t.id
GROUP BY t.id, t.name
ORDER BY template_count DESC, config_count DESC;

-- 10.2 Most Popular Configuration Templates
SELECT 
  c.template_name,
  COUNT(clones.id) as times_cloned
FROM configurations c
LEFT JOIN configurations clones ON clones.source_configuration_id = c.id
WHERE c.is_template = true
GROUP BY c.id, c.template_name
ORDER BY times_cloned DESC;

-- ============================================================================
-- NOTES
-- ============================================================================
/*
1. Template IDs are stable - d749e248-843f-497e-89fb-ed42b3f70a3d for Gaming Laptop
2. Configuration IDs change on re-creation
3. tenant_id must be explicitly cast to ::uuid
4. selected_options must be cast to ::jsonb
5. JWT doesn't contain tenant_id - use cookie-based filtering in server actions
6. RLS policy is permissive (is_template = true), security enforced in code
*/
