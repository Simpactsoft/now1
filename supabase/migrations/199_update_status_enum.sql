-- Migration: 199_update_status_enum.sql
-- Description: Updates the 'status' constraint on profiles to include 'invited'.

BEGIN;

ALTER TABLE profiles DROP CONSTRAINT IF EXISTS check_profile_status;

ALTER TABLE profiles 
ADD CONSTRAINT check_profile_status CHECK (status IN ('active', 'suspended', 'inactive', 'invited'));

COMMIT;
