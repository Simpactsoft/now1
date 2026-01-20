-- Migration 46: Optimize Status and Role Filters
-- Fixes: Timeouts when filtering by Status or Role without a search term.
-- Reason: The RPC uses 'lower(col) IN (...)', which cannot use standard indexes.

-- 1. Index for Case-Insensitive Status Filter
-- Used by: AND lower(p.status) IN (...)
CREATE INDEX IF NOT EXISTS idx_parties_status_lower 
ON parties (lower(status));

-- 2. Index for Case-Insensitive Role Filter
-- Used by: AND lower(pm.role_name) IN (...)
CREATE INDEX IF NOT EXISTS idx_party_memberships_role_lower 
ON party_memberships (lower(role_name));

-- 3. Composite Index for Role Lookup (Performance Boost)
-- Optimizes the subquery: WHERE pm.person_id = p.id AND lower(pm.role_name) ...
CREATE INDEX IF NOT EXISTS idx_party_memberships_person_role_lower 
ON party_memberships (person_id, lower(role_name));

-- 4. Update Statistics again to ensure these new indexes are seen immediately
ANALYZE parties;
ANALYZE party_memberships;
