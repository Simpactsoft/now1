
-- Migration: 189_fix_profile_by_id.sql
-- Description: Update the profile for ID `ee693e10-55c5-42ae-8de0-96ebac31e34e` to match the auth email and role.
-- Previous updates used 'sales@impactsoft.co.il' which was NOT in the profiles table for this ID.

UPDATE public.profiles
SET 
  email = 'sales@impactsoft.co.il',
  first_name = 'System', 
  last_name = 'Admin', 
  role = 'distributor' -- Assuming 'distributor' is the intended admin role
WHERE id = 'ee693e10-55c5-42ae-8de0-96ebac31e34e';

-- Verify
SELECT id, email, first_name, last_name, role 
FROM public.profiles 
WHERE id = 'ee693e10-55c5-42ae-8de0-96ebac31e34e';
