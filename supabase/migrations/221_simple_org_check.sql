
-- Migration: 221_simple_org_check.sql
-- Description: Simple SELECT to visualize Organization counts per Tenant.
-- Guaranteed to show in Results tab.

SELECT 
    tenant_id,
    type,
    count(*) as total_count,
    array_agg(display_name) FILTER (WHERE display_name IS NOT NULL) AS sample_names_slice
FROM cards
WHERE type = 'organization'
GROUP BY tenant_id, type;
