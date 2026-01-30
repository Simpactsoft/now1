
-- Migration: 111_optimize_custom_fields.sql
-- Description: Adds a GIN index to 'custom_fields' to support fast JSON filtering.
-- Resolves timeouts when filtering by "Role", "Industry" or other dynamic attributes.

BEGIN;

-- 1. GIN Index on Custom Fields
-- Allows queries like: custom_fields @> '{"role": "CEO"}' to be instant.
-- Using jsonb_path_ops is faster for @> operators but doesn't support full-text search inside keys (usually fine).
CREATE INDEX IF NOT EXISTS idx_cards_custom_fields_gin 
ON cards USING GIN (custom_fields jsonb_path_ops);

-- 2. Specific Index for Role (Optimization)
-- Since 'role' is heavily used in joins/filters, extracting it might be faster than GIN for high cardinality.
-- But let's try the blanket GIN first as it covers ALL future fields (Industry, Size, etc).

-- 3. Party Memberships Index (If not exists)
-- Ensure joins for Role filtering are fast.
CREATE INDEX IF NOT EXISTS idx_party_memberships_person_tenant 
ON party_memberships (person_id, tenant_id);

CREATE INDEX IF NOT EXISTS idx_party_memberships_role_lower 
ON party_memberships (lower(role_name));

-- 4. Analyze again
ANALYZE cards;
ANALYZE party_memberships;

COMMIT;
