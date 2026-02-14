-- ============================================================================
-- Seed Data: Admin User Setup
-- ============================================================================
-- This file should be run AFTER migrations to create your admin user
-- 
-- IMPORTANT: Replace 'your-email@example.com' with your actual email!
-- ============================================================================

-- Insert admin role for your user
-- This will be picked up by the Custom Access Token Hook on next login
INSERT INTO public.user_roles (user_id, role, tenant_id)
SELECT 
  id,
  'admin',
  NULL  -- Admins are not tied to specific tenant
FROM auth.users
WHERE email = 'your-email@example.com'  -- ⚠️ CHANGE THIS!
ON CONFLICT (user_id) 
DO UPDATE SET 
  role = 'admin',
  updated_at = now();

-- Verify it worked
SELECT 
  u.email,
  ur.role,
  ur.tenant_id,
  ur.created_at
FROM auth.users u
LEFT JOIN public.user_roles ur ON ur.user_id = u.id
WHERE u.email = 'your-email@example.com';  -- ⚠️ CHANGE THIS!

-- Expected output should show:
-- email: your-email@example.com
-- role: admin
-- tenant_id: NULL
-- created_at: <timestamp>
