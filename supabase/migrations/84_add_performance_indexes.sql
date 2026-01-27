-- Optimizing fetch_people_crm performance to prevent statement timeouts
-- Adding composite indexes to support the most common access patterns (Tenant + Type + Sort/Filter)

-- 1. Support default sort (created_at desc) and filtering by tenant/type
CREATE INDEX IF NOT EXISTS idx_parties_tenant_type_created_at 
ON parties (tenant_id, type, created_at DESC);

-- 2. Support sorting/filtering by status
-- Note: 'status' column is assumed to exist from intermediate migrations
CREATE INDEX IF NOT EXISTS idx_parties_tenant_type_status 
ON parties (tenant_id, type, status);

-- 3. Support sorting by Last Interaction
CREATE INDEX IF NOT EXISTS idx_parties_tenant_type_interaction
ON parties (tenant_id, type, last_interaction_at DESC);

-- 4. Support partial search on display_name
-- Standard btree helps with prefix search (LIKE 'foo%'), but ILIKE '%foo%' needs pg_trgm.
-- Since we don't know if pg_trgm is enabled, we'll start with a standard index for equality/sorting.
CREATE INDEX IF NOT EXISTS idx_parties_tenant_type_name
ON parties (tenant_id, type, display_name);
