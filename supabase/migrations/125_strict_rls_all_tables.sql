
-- Migration: 125_strict_rls_all_tables.sql
-- Description: Applies Strict Hierarchy RLS to 'parties' AND 'cards'.
-- Ensures that Dealer/Agents only see their specific subtree, even if in the same Tenant.

BEGIN;

-- 1. Secure PARTIES Table
ALTER TABLE parties ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_parties ON parties;
-- Drop any loose policies
DROP POLICY IF EXISTS "Hierarchy Visibility" ON parties;

CREATE POLICY "Hierarchy Visibility" ON parties
    FOR SELECT TO authenticated
    USING (
        -- A. Tenant Isolation
        tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid() LIMIT 1)
        AND
        -- B. Hierarchy Cone
        (
            -- 1. I own it (Agent)
            -- Note: parties table might use 'owner_id' or we join to cards?
            -- Assuming parties has similar structure or is the same data. 
            -- If parties lacks agent_id, we map owner_id.
            -- Checking schema 21/40: parties has owner_id usually.
            (owner_id = auth.uid())
            OR
            -- 2. Ancestry (Manager)
            (
                public.user_org_path() IS NOT NULL 
                AND 
                hierarchy_path IS NOT NULL 
                AND 
                public.user_org_path() @> hierarchy_path
            )
            OR
            -- 3. Admin Override (Distributor Role)
            (
                EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'distributor')
            )
        )
    );


-- 2. Secure CARDS Table (Re-apply purely for consistency and NULL safety)
DROP POLICY IF EXISTS "Hierarchy Visibility" ON cards;

CREATE POLICY "Hierarchy Visibility" ON cards
    FOR SELECT TO authenticated
    USING (
        tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid() LIMIT 1)
        AND
        (
            agent_id = auth.uid()
            OR
            (
                public.user_org_path() IS NOT NULL 
                AND 
                hierarchy_path IS NOT NULL 
                AND 
                public.user_org_path() @> hierarchy_path
            )
            OR
            (
                EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'distributor')
            )
        )
    );

COMMIT;
