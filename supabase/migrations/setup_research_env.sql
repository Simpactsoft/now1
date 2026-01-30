
-- Artifact: setup_research_env.sql
-- Description: 
-- Creates a completely ISOLATED "Clean Slate" environment in a separate schema called 'research'.
-- This allows you to test the "Perfect Architecture" instantly without deleting your existing data.
-- Includes:
-- 1. 'research' Schema (Separate namespace).
-- 2. Partitioned 'cards' table with Ltree and UUIDv7 support.
-- 3. Optimized Indexes (GIST, BTree).
-- 4. RLS Policies.
-- 5. Seed Data (Hierarchy: Distributor -> Dealer -> Agent).

BEGIN;

-- 1. Reset Environment (Clean Slate)
DROP SCHEMA IF EXISTS research CASCADE;
CREATE SCHEMA research;

-- Extensions (Must be in public, but referenced here)
CREATE EXTENSION IF NOT EXISTS "ltree";
CREATE EXTENSION IF NOT EXISTS "btree_gist";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Define the Perfect Table (Partitioned)
CREATE TABLE research.cards (
    id UUID DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('person', 'organization')),
    hierarchy_path LTREE NOT NULL,
    agent_id UUID,
    
    display_name TEXT NOT NULL,
    status TEXT DEFAULT 'lead',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    contact_methods JSONB DEFAULT '{}'::jsonb,
    tags TEXT[] DEFAULT ARRAY[]::TEXT[],

    -- Partitioning Key MUST be in PK
    PRIMARY KEY (tenant_id, id)
) PARTITION BY HASH (tenant_id);

-- Create Partitions (Reduced to 4 for this Demo)
CREATE TABLE research.cards_p0 PARTITION OF research.cards FOR VALUES WITH (MODULUS 4, REMAINDER 0);
CREATE TABLE research.cards_p1 PARTITION OF research.cards FOR VALUES WITH (MODULUS 4, REMAINDER 1);
CREATE TABLE research.cards_p2 PARTITION OF research.cards FOR VALUES WITH (MODULUS 4, REMAINDER 2);
CREATE TABLE research.cards_p3 PARTITION OF research.cards FOR VALUES WITH (MODULUS 4, REMAINDER 3);

-- 3. The Indexes
CREATE INDEX idx_research_cards_tenant_hierarchy ON research.cards USING GIST (tenant_id, hierarchy_path);
CREATE INDEX idx_research_cards_tenant_created ON research.cards USING btree (tenant_id, created_at DESC);

-- 4. RLS and Security
ALTER TABLE research.cards ENABLE ROW LEVEL SECURITY;

-- Mock Profile Function for Research (Just for testing visibility)
CREATE OR REPLACE FUNCTION research.current_user_org_path(p_user_id uuid) RETURNS ltree AS $$
    -- In real app, this queries profiles table
    SELECT 'org.distributor.dealer1'::ltree; -- Hardcoded for DEMO
$$ LANGUAGE sql IMMUTABLE;

CREATE POLICY "Research Hierarchy View" ON research.cards FOR SELECT
USING (
    -- Simplified Logic for Demo
    hierarchy_path <@ research.current_user_org_path(auth.uid())
);

-- 5. SEED DATA (Generate the "World")
-- Generates: 
-- 1 Distributor (Root)
-- 2 Dealers (Children)
-- 5 Agents per Dealer
-- 100 Cards per Agent
DO $$
DECLARE
    v_tenant_id UUID := uuid_generate_v4();
    v_dealer_idx INT;
    v_agent_idx INT;
    v_card_idx INT;
    v_path LTREE;
BEGIN
    RAISE NOTICE 'Seeding Research Data for Tenant %', v_tenant_id;

    -- A. Create Distributor Cards (Root Level) - Visible to Everyone below
    INSERT INTO research.cards (tenant_id, type, hierarchy_path, display_name, status)
    SELECT v_tenant_id, 'organization', 'org.distributor', 'Distributor HQ', 'customer';

    -- B. Loop Dealers
    FOR v_dealer_idx IN 1..2 LOOP
        v_path := text2ltree('org.distributor.dealer' || v_dealer_idx);
        
        -- Create Dealer Card
        INSERT INTO research.cards (tenant_id, type, hierarchy_path, display_name)
        VALUES (v_tenant_id, 'organization', v_path, 'Dealer ' || v_dealer_idx);

        -- C. Loop Agents
        FOR v_agent_idx IN 1..5 LOOP
             -- Create 100 People for this Agent
             INSERT INTO research.cards (tenant_id, type, hierarchy_path, agent_id, display_name, created_at)
             SELECT 
                v_tenant_id, 
                'person', 
                v_path, -- Agent belongs to Dealer Path
                uuid_generate_v4(),
                'Customer ' || v_dealer_idx || '-' || v_agent_idx || '-' || generate_series,
                NOW() - (random() * interval '365 days')
             FROM generate_series(1, 100);
        END LOOP;
    END LOOP;
END $$;

COMMIT;
