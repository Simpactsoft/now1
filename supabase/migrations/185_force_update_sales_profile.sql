
-- Migration: 185_force_update_sales_profile.sql
-- Description: Brute force update. No checks. Just do it.

UPDATE profiles 
SET first_name = 'System', last_name = 'Admin', role = 'distributor'
WHERE email = 'sales@impactsoft.co.il';

UPDATE profiles 
SET first_name = 'System', last_name = 'Admin', role = 'distributor'
WHERE email = 'Sales@impactsoft.co.il';

-- Show us the result
SELECT email, first_name, last_name, role FROM profiles WHERE lower(email) = 'sales@impactsoft.co.il';
