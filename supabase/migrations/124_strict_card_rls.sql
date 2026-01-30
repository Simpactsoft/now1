
-- Migration: 124_strict_card_rls.sql
-- Description: Re-applies STRICT Row Level Security on 'cards' to ensure Tenant and Hierarchy isolation.
-- Prevents "Dealer" from seeing global counts.

BEGIN;

-- 1. Ensure RLS is ON
ALTER TABLE cards ENABLE ROW LEVEL SECURITY;

-- 2. Drop potential conflicting/loose policies
DROP POLICY IF EXISTS "Hierarchy Visibility" ON cards;
DROP POLICY IF EXISTS "Hierarchy Insert" ON cards;
DROP POLICY IF EXISTS "Hierarchy Edit" ON cards;
DROP POLICY IF EXISTS "Hierarchy Delete" ON cards;
DROP POLICY IF EXISTS "Customer Personal Access" ON cards;
-- Drop any other policies that might be polluting
DROP POLICY IF EXISTS "Enable read access for all users" ON cards;
DROP POLICY IF EXISTS "Give me everything" ON cards;

-- 3. Re-create Strict Visibility Policy
CREATE POLICY "Hierarchy Visibility" ON cards
    FOR SELECT TO authenticated
    USING (
        -- A. Tenant Check (Must Match Profile)
        tenant_id = (
            SELECT tenant_id FROM profiles 
            WHERE id = auth.uid()
            LIMIT 1
        )
        AND
        -- B. Hierarchy Check (Cone of Visibility)
        (
            -- 1. If I am the direct agent
            agent_id = auth.uid()
            OR
            -- 2. If I am an ancestor in the org tree (Manager)
            -- We use EXISTS to avoid re-calculating function multiple times if possible, 
            -- or just call public.user_org_path() which is cached/stable per statement usually.
            (
                public.user_org_path() IS NOT NULL 
                AND 
                hierarchy_path IS NOT NULL 
                AND 
                public.user_org_path() @> hierarchy_path
            )
            OR
            -- 3. Fallback: If I created it (owner_id logic if exists, otherwise rely on agent_id)
            -- For now, purely Agent + Hierarchy.
            -- Special Case: 'distributor' role sees EVERYTHING in their Tenant
            (
                EXISTS (
                    SELECT 1 FROM profiles 
                    WHERE id = auth.uid() 
                    AND role = 'distributor'
                )
            )
        )
    );

-- 4. Basic Write Policies
CREATE POLICY "Hierarchy Edit" ON cards
    FOR ALL TO authenticated
    USING (
        tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid())
        AND (
            agent_id = auth.uid() 
            OR 
            EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'distributor')
        )
    );

COMMIT;
