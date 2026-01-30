
-- Migration: 181_fix_sales_name.sql
-- Description: Fix the identity crisis. Rename 'sales@impactsoft.co.il' to 'System Admin'

UPDATE profiles
SET 
    first_name = 'System',
    last_name = 'Admin'
WHERE email = 'sales@impactsoft.co.il';

-- Verify
SELECT email, first_name, last_name, role FROM profiles WHERE email = 'sales@impactsoft.co.il';
