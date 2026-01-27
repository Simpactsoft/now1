
-- Migration: 98_cascade_path_changes.sql
-- Description: Automatically updates Cards when an Agent moves in the hierarchy.
-- Phase 3 of ERP Foundation.

BEGIN;

-- 1. Create the Cascade Function
-- This function runs whenever a Profile's org_path changes.
CREATE OR REPLACE FUNCTION cascade_org_path_changes()
RETURNS TRIGGER AS $$
BEGIN
    -- Only run if org_path actually changed
    IF (OLD.org_path IS DISTINCT FROM NEW.org_path) THEN
        
        -- Update all cards owned by this agent (agent_id)
        -- to reflect the new hierarchy path.
        -- This ensures RLS visibility moves with the agent.
        UPDATE cards
        SET hierarchy_path = NEW.org_path
        WHERE agent_id = NEW.id;
        
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. Bind Trigger to Profiles
DROP TRIGGER IF EXISTS trg_cascade_path ON profiles;
CREATE TRIGGER trg_cascade_path
    AFTER UPDATE OF org_path
    ON profiles
    FOR EACH ROW
    EXECUTE FUNCTION cascade_org_path_changes();


-- 3. Create the Maintenance Function (Reverse Direction)
-- This function runs whenever a Card is assigned to a NEW Agent.
-- It ensures the card adopts the agent's path immediately.
CREATE OR REPLACE FUNCTION maintain_card_hierarchy()
RETURNS TRIGGER AS $$
DECLARE
    v_agent_path ltree;
BEGIN
    -- Only run if agent_id changed or it's a new insert
    IF (TG_OP = 'INSERT' OR OLD.agent_id IS DISTINCT FROM NEW.agent_id) THEN
        
        IF NEW.agent_id IS NOT NULL THEN
            -- Lookup the agent's path
            SELECT org_path INTO v_agent_path
            FROM profiles
            WHERE id = NEW.agent_id;
            
            -- Set it (if found)
            IF v_agent_path IS NOT NULL THEN
                NEW.hierarchy_path := v_agent_path;
            ELSE
                -- Fallback: If agent has no profile (shouldn't happen), default to root?
                -- Or leave null? Better to leave NULL or existing to avoid security hole.
                -- For now, we do nothing if agent not found.
                NULL; 
            END IF;
        END IF;

    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. Bind Trigger to Cards
DROP TRIGGER IF EXISTS trg_maintain_card_path ON cards;
CREATE TRIGGER trg_maintain_card_path
    BEFORE INSERT OR UPDATE OF agent_id
    ON cards
    FOR EACH ROW
    EXECUTE FUNCTION maintain_card_hierarchy();

COMMIT;
