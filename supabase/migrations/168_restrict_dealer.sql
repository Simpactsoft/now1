
-- Migration: 168_restrict_dealer.sql
-- Description: Fixes security leak where NULL org_path defaulted to Admin ('org').

BEGIN;

-- 1. Fix the specific user (Noam)
-- Assign him to a sub-node 'org.dealer1'
UPDATE profiles 
SET org_path = 'org.dealer1'::ltree 
WHERE email = 'noam@dd.com';

-- 2. HARDEN THE POLICY (Critical Security Fix)
-- Previous Logic: COALESCE(org_path, 'org') -> If NULL, allowed everything!
-- New Logic: COALESCE(org_path, 'empty') -> If NULL, allow nothing.
-- You MUST have an explicit path to see data.

DROP POLICY IF EXISTS "cards_isolation_policy" ON cards;

CREATE POLICY "cards_isolation_policy" ON cards
FOR ALL
USING (
    tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid())
    AND
    hierarchy_path <@ (
        SELECT COALESCE(org_path, 'non_existent_path'::ltree) 
        FROM profiles 
        WHERE id = auth.uid()
    )
)
WITH CHECK (
     tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid())
    AND
    hierarchy_path <@ (
        SELECT COALESCE(org_path, 'non_existent_path'::ltree) 
        FROM profiles 
        WHERE id = auth.uid()
    )
);

COMMIT;
