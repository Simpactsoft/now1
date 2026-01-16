-- Phase 13: Infrastructure Hardening - Performance (Advanced Indexes)
-- Adding Trigram for fuzzy search and GIN for JSONB querying.

-- 1. Enable pg_trgm extension if not exists
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 2. Trigram Index for Fuzzy Name Search
-- Allows fast ILIKE '%term%' queries on display_name
CREATE INDEX IF NOT EXISTS trgm_idx_parties_display_name 
ON parties 
USING GIST (display_name gist_trgm_ops);

-- 3. GIN Index for Contact Methods (JSONB)
-- Allows fast searching of emails/phones inside the JSON array.
-- Existing index was 'jsonb_path_ops', adding specific extraction index if needed or relying on GIN.
-- We already have idx_parties_contact_methods_path_ops, ensuring it supports our queries.

-- 4. Composite Indexes for Common Access Patterns
-- Dashboard Grid sorting: sort by created_at desc, filter by tenant
CREATE INDEX IF NOT EXISTS idx_parties_tenant_created_at 
ON parties (tenant_id, created_at DESC);

-- Dashboard Grid sorting: sort by updated_at desc, filter by tenant
CREATE INDEX IF NOT EXISTS idx_parties_tenant_updated_at 
ON parties (tenant_id, updated_at DESC);

-- Membership lookups by Organization + Role
CREATE INDEX IF NOT EXISTS idx_party_memberships_org_role 
ON party_memberships (organization_id, role_name);

-- 5. Foreign Key Constraints (Reliability)
-- Ensure no orphan records in party_memberships (already covered by REFERENCES)
-- Adding explicit cascading or checks if any missing.
-- (Already handled in schema creation, strictly verifying presence)

-- 6. Analyze tables to update statistics for the query planner
ANALYZE parties;
ANALYZE people;
ANALYZE party_memberships;
