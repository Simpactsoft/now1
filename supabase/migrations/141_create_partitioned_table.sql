
-- Migration: 141_create_partitioned_table.sql
-- Description: Step 1 of Production Migration.
-- Creates 'public.cards_new' which mirrors the optimized design from the Research phase.
-- This table is PARTITIONED by HASH(tenant_id) to solve the scale performance issues.

BEGIN;

-- 1. Create the Landing Table
-- We use 'cards_new' temporarily. It will be renamed to 'cards' in the final step.
CREATE TABLE public.cards_new (
    id UUID DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('person', 'organization')),
    
    -- Hierarchy (Ltree) 
    hierarchy_path LTREE NOT NULL CHECK (hierarchy_path <> '' AND nlevel(hierarchy_path) <= 20),
    agent_id UUID,

    -- Core Data
    display_name TEXT NOT NULL,
    status TEXT DEFAULT 'lead',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Flexible Data
    contact_methods JSONB DEFAULT '{}'::jsonb,
    custom_fields JSONB DEFAULT '{}'::jsonb,
    tags TEXT[] DEFAULT ARRAY[]::TEXT[],

    -- Generated Search Vector
    fts tsvector GENERATED ALWAYS AS (
        to_tsvector('english', display_name || ' ' || COALESCE(contact_methods::text, ''))
    ) STORED,

    -- COMPOSITE PK (Required for Partitioning)
    PRIMARY KEY (tenant_id, id)
) PARTITION BY HASH (tenant_id);

-- 2. Create Partitions (256 Shards)
DO $$
DECLARE
    i int;
BEGIN
    FOR i IN 0..255 LOOP
        EXECUTE format('CREATE TABLE public.cards_new_p%s PARTITION OF public.cards_new FOR VALUES WITH (MODULUS 256, REMAINDER %s)', i, i);
    END LOOP;
END $$;

-- 3. Create Indexes (The Performance Trinity)
-- A. Hierarchy Security (Nuclear Option)
CREATE INDEX idx_cards_new_tenant_hierarchy ON public.cards_new USING GIST (tenant_id, hierarchy_path);

-- B. Pagination Speed (Sort)
CREATE INDEX idx_cards_new_tenant_created ON public.cards_new USING btree (tenant_id, created_at DESC);

-- C. Search & Contains
CREATE INDEX idx_cards_new_contact_gin ON public.cards_new USING GIN (contact_methods jsonb_path_ops);
CREATE INDEX idx_cards_new_fts_gin ON public.cards_new USING GIN (fts);

-- 4. Enable RLS
ALTER TABLE public.cards_new ENABLE ROW LEVEL SECURITY;

-- 5. Copy RLS Logic (Strict Hierarchy)
-- Note: usage existing helper current_user_org_path()
CREATE POLICY "hierarchy_access_policy_new" ON public.cards_new
FOR ALL
USING (
    tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()) 
    AND
    hierarchy_path <@ (SELECT org_path FROM profiles WHERE id = auth.uid() LIMIT 1)
);

COMMIT;
