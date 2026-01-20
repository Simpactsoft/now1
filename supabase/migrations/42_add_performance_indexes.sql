-- Migration: Add Performance Indexes
-- Fixes timeouts during search and complex filtering.

-- 1. Enable Trigram Extension for fast text search
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 2. Index for Search (display_name)
-- Uses GIN Trigram index which supports 'ILIKE %...%' queries efficiently
CREATE INDEX IF NOT EXISTS idx_parties_display_name_gin 
ON parties USING GIN (display_name gin_trgm_ops);

-- 3. Index for Status Filtering
CREATE INDEX IF NOT EXISTS idx_parties_status 
ON parties(status);

-- 4. Index for Tenant + Type (Base Filter)
CREATE INDEX IF NOT EXISTS idx_parties_tenant_type 
ON parties(tenant_id, type);

-- 5. Index for Role Filtering (Party Memberships)
-- Covers the lookup: WHERE person_id = X AND role_name = Y
CREATE INDEX IF NOT EXISTS idx_party_memberships_person_role 
ON party_memberships(person_id, role_name);

-- 6. Index for Joined Year (created_at)
CREATE INDEX IF NOT EXISTS idx_parties_created_at 
ON parties(created_at);

-- 7. Index for Tags (Array)
CREATE INDEX IF NOT EXISTS idx_parties_tags 
ON parties USING GIN (tags);
