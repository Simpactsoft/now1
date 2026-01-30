
-- Migration: 186_dump_auth_data.sql
-- Description: Check the hidden 'auth.users' table to see if the name is cached there.

SELECT id, email, raw_user_meta_data 
FROM auth.users 
WHERE email ILIKE '%sales%';
