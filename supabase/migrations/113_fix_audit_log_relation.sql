
-- Migration: 113_fix_audit_log_relation.sql
-- Description: Adds a secondary Foreign Key to 'profiles' to allow PostgREST to join Actor Name.
-- Resolves the API error: "Could not find a relationship between 'audit_logs' and 'performed_by'"

BEGIN;

-- 1. Add Explicit FK to Profiles (Public Schema)
-- This allows: .select('*, performed_by(first_name, last_name)') via PostgREST
ALTER TABLE audit_logs 
ADD CONSTRAINT audit_logs_performed_by_fkey_profiles 
FOREIGN KEY (performed_by) 
REFERENCES profiles(id)
ON DELETE SET NULL; -- If user is deleted, keep log but clear link (or CASCADE? Log should persist usually)

-- 2. Performance Index (if missing, though performed_by likely indexed)
-- 105 created idx_audit_performed_by, so we are good.

-- 3. Fix potential RLS issue for "System" actors (NULL performed_by)
-- If performed_by is NULL (System), the JOIN is just empty, which is fine.

COMMIT;
