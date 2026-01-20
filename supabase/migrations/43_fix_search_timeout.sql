-- Migration 43: Fix Search Timeouts (Performance Pack)
-- Fixes: "canceling statement due to statement timeout"

-- 1. Enable Trigram Extension (Crucial for ILIKE search)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 2. Search Index (Magic Bullet for "Name" search)
-- Allows Postgres to search text instantly without scanning the whole table.
CREATE INDEX IF NOT EXISTS idx_parties_display_name_gin 
ON parties USING GIN (display_name gin_trgm_ops);

-- 3. Optimization for "Joined Year" Filters
-- We use a standard B-Tree index on created_at.
-- Postgres can use this for range queries effectively.
CREATE INDEX IF NOT EXISTS idx_parties_created_at 
ON parties(created_at);

-- 4. Status Filter Optimization
CREATE INDEX IF NOT EXISTS idx_parties_status 
ON parties(status);

-- 5. Role Filter Optimization (Composite Index)
-- Speed up the "EXISTS" subquery for roles
CREATE INDEX IF NOT EXISTS idx_party_memberships_person_role 
ON party_memberships(person_id, role_name);

-- 6. Tenant Security optimization
CREATE INDEX IF NOT EXISTS idx_parties_tenant_type 
ON parties(tenant_id, type);

COMMENT ON INDEX idx_parties_display_name_gin IS 'Powers the ultra-fast global search';
