-- ============================================================================
-- RLS POLICY TEMPLATE
-- ============================================================================
-- Copy this template for every new table that needs RLS policies.
--
-- Usage:
-- 1. Replace TABLE_NAME with your actual table name
-- 2. Adjust policy names if needed
-- 3. Add any custom logic to the WHERE clauses if needed
-- ============================================================================

-- Enable RLS
ALTER TABLE TABLE_NAME ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- SELECT Policy
-- ============================================================================
CREATE POLICY "Users can view TABLE_NAME in their tenant"
ON TABLE_NAME FOR SELECT
USING (
  tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid())
);

-- ============================================================================
-- INSERT Policy
-- ============================================================================
-- CRITICAL: INSERT uses WITH CHECK, not USING!
CREATE POLICY "Users can insert TABLE_NAME in their tenant"
ON TABLE_NAME FOR INSERT
WITH CHECK (
  tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid())
);

-- ============================================================================
-- UPDATE Policy
-- ============================================================================
CREATE POLICY "Users can update TABLE_NAME in their tenant"
ON TABLE_NAME FOR UPDATE
USING (
  tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid())
);

-- ============================================================================
-- DELETE Policy
-- ============================================================================
CREATE POLICY "Users can delete TABLE_NAME in their tenant"
ON TABLE_NAME FOR DELETE
USING (
  tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid())
);

-- ============================================================================
-- Grant Permissions
-- ============================================================================
GRANT ALL ON TABLE_NAME TO authenticated;

-- ============================================================================
-- Verification Queries
-- ============================================================================
-- Run these to verify the policies were created correctly:

-- 1. Check RLS is enabled
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' AND tablename = 'TABLE_NAME';
-- Expected: rowsecurity = true

-- 2. Check all 4 policies exist
SELECT policyname, cmd, qual, with_check
FROM pg_policies
WHERE tablename = 'TABLE_NAME'
ORDER BY cmd;
-- Expected: 4 rows (DELETE, INSERT, SELECT, UPDATE)

-- 3. Verify INSERT uses WITH CHECK (not USING)
SELECT policyname, cmd, with_check
FROM pg_policies
WHERE tablename = 'TABLE_NAME' AND cmd = 'INSERT';
-- Expected: with_check should contain "tenant_id"
