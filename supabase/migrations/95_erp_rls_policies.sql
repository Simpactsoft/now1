
-- Migration: 95_erp_rls_policies.sql
-- Description: Enables "Cone of Visibility" RLS policies.
-- Phase 2 of the ERP Foundation Plan.

BEGIN;

-- 1. Helper Function: Get Current User's Path
-- Defined in PUBLIC schema to avoid permission issues with "auth" schema.
CREATE OR REPLACE FUNCTION public.user_org_path()
RETURNS ltree AS $$
    SELECT org_path FROM public.profiles WHERE id = auth.uid() LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- 2. Enable RLS on core tables (Safety Check)
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE cards ENABLE ROW LEVEL SECURITY;

-- 3. Policy: Profiles Visibility
-- Users can see their own profile.
CREATE POLICY "Users can see own profile" ON profiles
    FOR SELECT TO authenticated
    USING (id = auth.uid());

-- Managers can see profiles of their defined subordinates (Cone of Visibility)
CREATE POLICY "Managers can see subordinate profiles" ON profiles
    FOR SELECT TO authenticated
    USING (
        public.user_org_path() @> org_path 
        AND id != auth.uid() -- Optimization: separate own profile check
    );

-- 4. Policy: Cards Visibility (The Heart of the System)

-- A. Tenant Isolation (Already exists usually, but reinforcing)
-- Assuming 'cards' has a policy for tenant_id. We add the Hierarchy layer.

-- B. Hierarchy Access (Distributor -> Dealer -> Agent)
-- "I can see a card if my path is an ancestor of the card's hierarchy path"
DROP POLICY IF EXISTS "Hierarchy Visibility" ON cards;
CREATE POLICY "Hierarchy Visibility" ON cards
    FOR SELECT TO authenticated
    USING (
        -- 1. Match Tenant (Safety)
        tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid())
        AND
        -- 2. Match Hierarchy (Cone of Visibility)
        (
            -- Own Cards (Direct Assignment)
            agent_id = auth.uid()
            OR
            -- Downline Cards (Ancestry)
            public.user_org_path() @> hierarchy_path
        )
    );

-- C. Customer Access (Direct Ownership)
-- "I can see a card if I am the customer defined in it"
-- TODO: Implement this in Phase 4 (Portal). We need to decide if we link cards via 'owner_id' (if used for customer) or a new 'user_id' column.
-- Currently 'customer_id' column does not exist on cards.
/*
CREATE POLICY "Customer Personal Access" ON cards
    FOR SELECT TO authenticated
    USING (
        -- customer_id = auth.uid() 
        false -- Placeholder until schema update
    );
*/

-- 5. Policy: Card Editing Permissions
-- Usually tighter than viewing. For now, we allow editing if you have visibility + Role check.
-- (Simplified for this phase: If you can see it via hierarchy, you can edit it. 
--  We will refine this in RBAC phase).
CREATE POLICY "Hierarchy Edit" ON cards
    FOR UPDATE TO authenticated
    USING (
        public.user_org_path() @> hierarchy_path
    );

COMMIT;
