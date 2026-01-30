
-- Migration: 163_who_exists.sql
-- Description: Lists users in auth.users to find the correct email.

SELECT id, email, created_at
FROM auth.users
ORDER BY created_at DESC
LIMIT 10;
