
-- Migration: 180_check_sales_identity.sql
-- Description: Check why Sales Admin has Noam's name.

SELECT id, email, first_name, last_name, role, org_path
FROM profiles
WHERE email = 'sales@impactsoft.co.il';
