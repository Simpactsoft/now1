
-- Migration: 187_fix_auth_metadata.sql
-- Description: Fix the root cause in auth.users metadata.

UPDATE auth.users
SET raw_user_meta_data = jsonb_set(
    jsonb_set(
        raw_user_meta_data, 
        '{first_name}', 
        '"System"'
    ),
    '{last_name}', 
    '"Admin"'
)
WHERE email = 'sales@impactsoft.co.il';

-- Verify
SELECT id, email, raw_user_meta_data 
FROM auth.users 
WHERE email = 'sales@impactsoft.co.il';
