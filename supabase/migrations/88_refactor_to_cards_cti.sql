-- Migration: 88_refactor_to_cards_cti.sql
-- Description: Refactors the 'Parties' Model to the Strict 'Cards' CTI Architecture.
-- Warning: This is a heavy DDL migration. It renames core tables and columns.

BEGIN;

-- 1. Rename Base Table: parties -> cards
ALTER TABLE IF EXISTS parties RENAME TO cards;
ALTER INDEX IF EXISTS parties_pkey RENAME TO cards_pkey;

-- 2. Add Blueprint Columns to cards
-- 2. Add Blueprint Columns to cards
-- readable_id
CREATE SEQUENCE IF NOT EXISTS cards_readable_id_seq;
ALTER TABLE cards 
    -- OPTIMIZATION: Created as NULL first to avoid full table rewrite on 1M+ rows.
    -- Backfill will be handled in a separate step or background job.
    ADD COLUMN IF NOT EXISTS readable_id BIGINT, 
    ADD COLUMN IF NOT EXISTS owner_id UUID, 
    ADD COLUMN IF NOT EXISTS lifecycle_stage TEXT DEFAULT 'lead',
    -- JSONB default '{}' is fast (metadata only) in Postgres 11+
    ADD COLUMN IF NOT EXISTS ai_attributes JSONB DEFAULT '{}'::jsonb;

-- Optional: Create index now (might be slow) or later.
-- CREATE UNIQUE INDEX IF NOT EXISTS idx_cards_readable_id ON cards(readable_id);
-- CREATE INDEX IF NOT EXISTS idx_cards_ai_attributes ON cards USING GIN (ai_attributes);

-- 3. Refactor Derived Entities
-- 3a. People
-- Rename FK column
ALTER TABLE people RENAME COLUMN party_id TO card_id;
-- Ensure constraint name reflects new reality (optional but clean)
ALTER TABLE people RENAME CONSTRAINT people_party_id_fkey TO people_card_id_fkey;

-- 3b. Organizations
-- Rename Table
ALTER TABLE IF EXISTS organizations_ext RENAME TO organizations;
-- Rename FK column
ALTER TABLE organizations RENAME COLUMN party_id TO card_id;
-- Rename Constraint
ALTER TABLE organizations RENAME CONSTRAINT organizations_ext_party_id_fkey TO organizations_card_id_fkey;
ALTER TABLE organizations RENAME CONSTRAINT organizations_ext_pkey TO organizations_pkey;

-- 4. Create Deduplication Table: unique_identifiers
CREATE TABLE IF NOT EXISTS unique_identifiers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    card_id UUID NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
    identifier_type TEXT NOT NULL, -- 'email', 'phone', 'domain', 'tax_id'
    identifier_value TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()),
    UNIQUE (tenant_id, identifier_type, identifier_value)
);

CREATE INDEX IF NOT EXISTS idx_unique_identifiers_lookup 
    ON unique_identifiers(tenant_id, identifier_type, identifier_value);

-- 5. Enable pgvector (Soft Requirement)
CREATE EXTENSION IF NOT EXISTS vector;
ALTER TABLE cards ADD COLUMN IF NOT EXISTS embedding vector(1536);

-- 6. Cleanup / Views
-- If there were views relying on 'parties', they might break. 
-- For strict architectural compliance, we assume app refactor follows.

COMMIT;
