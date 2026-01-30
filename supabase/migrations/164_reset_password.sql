
-- Migration: 164_reset_password.sql
-- Description: FORCE resets the password for im44pact.art@gmail.com to '123456'.
-- WARNING: Use only in Development!

UPDATE auth.users
SET encrypted_password = crypt('123456', gen_salt('bf'))
WHERE email = 'im44pact.art@gmail.com';
