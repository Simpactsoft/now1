
-- Migration: 178_downgrade_dealer.sql
-- Description: FORCE Noam to be a Dealer (org.dealer1). He was likely promoted to Root (org) by accident.

UPDATE profiles
SET 
    org_path = 'org.dealer1',
    role = 'dealer'
WHERE email = 'noam@dd.com';

-- Verify the change
SELECT email, org_path, role FROM profiles WHERE email = 'noam@dd.com';
