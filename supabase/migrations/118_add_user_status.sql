
-- Migration: 118_add_user_status.sql
-- Description: Adds 'status' column to profiles to support "Freeze User" (Suspend) functionality.

BEGIN;

-- 1. Add status column
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active';

-- Optional: Add a check constraint if we want strict enum emulation
ALTER TABLE profiles 
ADD CONSTRAINT check_profile_status CHECK (status IN ('active', 'suspended', 'inactive'));

-- 2. Index for filtering active users
CREATE INDEX IF NOT EXISTS idx_profiles_status ON profiles(status);

COMMIT;
