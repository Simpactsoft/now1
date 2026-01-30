
-- Migration: 119_fix_audit_rls_real.sql
-- Description: Fixes the RLS policy on audit_logs which referenced a non-existent 'tenant_members' table.
-- Reverts to using 'profiles' table for verification.

BEGIN;

DROP POLICY IF EXISTS "Tenant Audit Visibility" ON audit_logs;

-- Create Correct Policy using PROFILES
CREATE POLICY "Tenant Audit Visibility" ON audit_logs
    FOR SELECT TO authenticated
    USING (
        tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid())
    );

COMMIT;
