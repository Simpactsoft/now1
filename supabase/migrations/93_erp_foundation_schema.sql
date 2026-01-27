
-- Migration: 93_erp_foundation_schema.sql
-- Description: Sets up the ERP Foundation layer using ltree for hierarchical access control.
-- Phase 1 of the ERP Foundation Plan.

BEGIN;

-- 1. Enable ltree extension
CREATE EXTENSION IF NOT EXISTS ltree;

-- 2. Create Role Enum if not exists
DO $$ BEGIN
    CREATE TYPE app_role AS ENUM ('distributor', 'dealer', 'agent', 'customer');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 3. Create Profiles Table (Links auth.users to Hierarchy)
-- This table is the "Security Context" for every user.
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL, -- Logical separation
    role app_role DEFAULT 'agent',
    
    -- Hierarchy Path (ltree)
    -- Format: Root.DistributorID.DealerID.AgentID
    org_path ltree NOT NULL,
    
    -- Optional: Parent ID for easier management (though ltree stores the structure)
    parent_id UUID REFERENCES profiles(id),
    
    first_name TEXT,
    last_name TEXT,
    email TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now())
);

-- Index for fast hierarchy queries (The "Magic" Index)
CREATE INDEX IF NOT EXISTS idx_profiles_org_path_gist ON profiles USING GIST (org_path);
CREATE INDEX IF NOT EXISTS idx_profiles_tenant_id ON profiles(tenant_id);

-- 4. Denormalize Hierarchy into Cards (Business Objects)
-- This allows O(1) filtering: "Show me all cards under this distributor"
ALTER TABLE cards 
    ADD COLUMN IF NOT EXISTS hierarchy_path ltree,
    ADD COLUMN IF NOT EXISTS agent_id UUID REFERENCES profiles(id); 

-- Index for card hierarchy
CREATE INDEX IF NOT EXISTS idx_cards_hierarchy_path_gist ON cards USING GIST (hierarchy_path);

-- 5. Maintenance Trigger: Auto-assign path to cards
-- When a card is created by an agent, stamp it with the agent's path.
CREATE OR REPLACE FUNCTION maintain_card_hierarchy()
RETURNS TRIGGER AS $$
BEGIN
    -- If hierarchy_path is not explicitly set, derive it from the agent/creator
    IF NEW.hierarchy_path IS NULL THEN
        -- Standard Flow: Use the assigned agent's path
        IF NEW.agent_id IS NOT NULL THEN
            SELECT org_path INTO NEW.hierarchy_path
            FROM profiles
            WHERE id = NEW.agent_id;
        -- Fallback: If no agent assigned, try to use the current user's profile path
        ELSE
            SELECT org_path INTO NEW.hierarchy_path
            FROM profiles
            WHERE id = auth.uid();
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger definition
DROP TRIGGER IF EXISTS trg_maintain_card_hierarchy ON cards;
CREATE TRIGGER trg_maintain_card_hierarchy
    BEFORE INSERT OR UPDATE OF agent_id ON cards
    FOR EACH ROW
    EXECUTE FUNCTION maintain_card_hierarchy();


-- 6. Trigger for Profile Path Maintenance (Basic)
-- If parent_id changes, update the path. (Simplified version for now)
CREATE OR REPLACE FUNCTION maintain_profile_path()
RETURNS TRIGGER AS $$
DECLARE
    v_parent_path ltree;
BEGIN
    IF NEW.parent_id IS NOT NULL THEN
        SELECT org_path INTO v_parent_path FROM profiles WHERE id = NEW.parent_id;
        -- Append current ID to parent path
        -- Note: UUIDs usually need replacing dashes for ltree compatibility, 
        -- but for simplicity we assume text2ltree handles it or we clean IDs.
        -- Ideally, use a cleaner slug or cleaned UUID.
        NEW.org_path := v_parent_path || text2ltree(replace(NEW.id::text, '-', '_'));
    ELSE
        -- Root Node
        NEW.org_path := text2ltree('root.' || replace(NEW.id::text, '-', '_'));
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger definition
DROP TRIGGER IF EXISTS trg_maintain_profile_path ON profiles;
CREATE TRIGGER trg_maintain_profile_path
    BEFORE INSERT OR UPDATE OF parent_id ON profiles
    FOR EACH ROW
    EXECUTE FUNCTION maintain_profile_path();

COMMIT;
