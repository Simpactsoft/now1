
-- Migration: 167_debug_dealer_permissions.sql
-- Description: Check the actual org_path of the Dealer to see why they see everything.

SELECT id, email, org_path, tenant_id 
FROM profiles 
WHERE email IN ('noam@dd.com', 'im44pact.art@gmail.com');

-- Also check active policies on cards
SELECT policyname, cmd, qual, with_check 
FROM pg_policies 
WHERE tablename = 'cards';
