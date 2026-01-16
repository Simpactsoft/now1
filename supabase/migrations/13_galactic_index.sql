-- Phase 7: Galactic Index Optimization
-- This migration adds a GiST index on (tenant_id, org_path) to ensure sub-millisecond
-- hierarchical traversal even with millions of rows.

-- UUID does not have a default GiST operator class. 
-- We must enable the btree_gist extension to support it.
CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE INDEX IF NOT EXISTS idx_employees_tenant_path_gist 
ON employees 
USING GIST (tenant_id, org_path);

-- Analyze the table to update statistics
ANALYZE employees;
