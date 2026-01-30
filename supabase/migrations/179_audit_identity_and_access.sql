
-- Migration: 179_audit_identity_and_access.sql
-- Description: Check who is who, and what they can TRULY see.

-- 1. Check Profiles: Does 'sales' exist? Is it somehow linked to Noam?
SELECT id, email, first_name, last_name, role, org_path 
FROM profiles 
WHERE email IN ('sales@dd.com', 'noam@dd.com');

-- 2. Simulate NOAM (Dealer) - Should see ~3 records
SET ROLE authenticated;
SET request.jwt.claim.sub = (SELECT id FROM profiles WHERE email = 'noam@dd.com');
SET request.jwt.claim.role = 'authenticated';

SELECT 
    'NOAM_VIEW' as test_user,
    count(*) as visible_cards
FROM cards 
WHERE type = 'person';

-- 3. Simulate SALES (Admin) - Should see ~5000+ records
SET request.jwt.claim.sub = (SELECT id FROM profiles WHERE email = 'sales@dd.com');

SELECT 
    'SALES_VIEW' as test_user,
    count(*) as visible_cards
FROM cards 
WHERE type = 'person';

-- Reset
RESET ROLE;
