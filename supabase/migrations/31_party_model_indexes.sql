-- Phase 13: Infrastructure Hardening - Missing Indexes
-- Addressing gaps identified in the schema audit.

-- 1. GIN Index for Custom Fields (JSONB)
-- Allows performant searching on arbitrary keys inside custom_fields (e.g., 'custom_fields @> {"vip": true}')
CREATE INDEX IF NOT EXISTS idx_parties_custom_fields 
ON parties 
USING GIN (custom_fields);

-- 2. Standard Index for Last Name Sorting
-- Essential for "Sort by Last Name" in CRM views, which is distinct from display_name.
CREATE INDEX IF NOT EXISTS idx_people_last_name 
ON people (last_name);

-- 3. Analyze to update stats immediately
ANALYZE parties;
ANALYZE people;
