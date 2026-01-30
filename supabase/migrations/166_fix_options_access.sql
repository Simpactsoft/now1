
-- Migration: 166_fix_options_access.sql
-- Description: Ensures all users (including restricted Dealers) can read System Options (Global).

BEGIN;

-- 1. Enable RLS (Just in case)
ALTER TABLE option_sets ENABLE ROW LEVEL SECURITY;
ALTER TABLE option_values ENABLE ROW LEVEL SECURITY;

-- 2. Create/Replace Policy for Option Sets
-- Allow reading Global Sets (tenant_id IS NULL) OR Own Tenant Sets
DROP POLICY IF EXISTS "read_options_policy" ON option_sets;
CREATE POLICY "read_options_policy" ON option_sets
FOR SELECT
TO authenticated
USING (
    tenant_id IS NULL 
    OR 
    tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid())
);

-- 3. Create/Replace Policy for Option Values
-- Allow reading Global Values OR Own Tenant Values
DROP POLICY IF EXISTS "read_values_policy" ON option_values;
CREATE POLICY "read_values_policy" ON option_values
FOR SELECT
TO authenticated
USING (
    tenant_id IS NULL 
    OR 
    tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid())
);

COMMIT;
