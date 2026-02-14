-- ===========================================================================
-- ADMIN SETUP SCRIPT (NOT A MIGRATION!)
-- ===========================================================================
-- ⚠️ WARNING: This is a MANUAL setup script, NOT a migration
-- ⚠️ DO NOT run this automatically
-- ⚠️ REPLACE the email placeholders before running
-- ===========================================================================

-- Step 1: Find your email (run this first to see available users)
SELECT email, id, created_at 
FROM auth.users 
ORDER BY created_at DESC 
LIMIT 10;

-- Step 2: Set admin user (⚠️ REPLACE YOUR_ADMIN_EMAIL!)
INSERT INTO public.user_roles (user_id, role, tenant_id)
SELECT 
  id,
  'admin',
  NULL
FROM auth.users
WHERE email = 'YOUR_ADMIN_EMAIL'  -- ⚠️ REPLACE THIS WITH ACTUAL EMAIL
ON CONFLICT (user_id) 
DO UPDATE SET 
  role = 'admin',
  updated_at = now();

-- Step 3: Verify it worked
SELECT 
  u.email,
  ur.role,
  ur.tenant_id,
  ur.created_at
FROM auth.users u
JOIN user_roles ur ON ur.user_id = u.id
WHERE u.email = 'YOUR_ADMIN_EMAIL';  -- ⚠️ REPLACE THIS WITH ACTUAL EMAIL

-- Should show: your email with role = 'admin' and tenant_id = NULL
