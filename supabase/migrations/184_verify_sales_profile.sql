
-- Migration: 184_verify_sales_profile.sql
-- Description: Prove to us what is currently in the DB.

SELECT id, email, first_name, last_name, role 
FROM profiles 
WHERE email ILIKE '%sales%';
