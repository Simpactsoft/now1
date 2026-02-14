-- ===========================================================================
-- CHANGE ADMIN SCRIPT (NOT A MIGRATION!)
-- ===========================================================================
-- ⚠️ WARNING: This is a MANUAL admin change script
-- ⚠️ REPLACE both email placeholders before running
-- ===========================================================================

-- Remove admin from old user (⚠️ REPLACE OLD_ADMIN_EMAIL)
UPDATE public.user_roles 
SET role = 'user' 
WHERE user_id = (
  SELECT id FROM auth.users 
  WHERE email = 'OLD_ADMIN_EMAIL'  -- ⚠️ REPLACE THIS
);

-- Set new admin (⚠️ REPLACE NEW_ADMIN_EMAIL)
INSERT INTO public.user_roles (user_id, role, tenant_id)
SELECT 
  id,
  'admin',
  NULL
FROM auth.users
WHERE email = 'NEW_ADMIN_EMAIL'  -- ⚠️ REPLACE THIS
ON CONFLICT (user_id) 
DO UPDATE SET 
  role = 'admin',
  updated_at = now();

-- Verify the change
SELECT 
  u.email,
  ur.role,
  ur.tenant_id
FROM auth.users u
JOIN user_roles ur ON ur.user_id = u.id
WHERE u.email IN ('OLD_ADMIN_EMAIL', 'NEW_ADMIN_EMAIL');  -- ⚠️ REPLACE BOTH
