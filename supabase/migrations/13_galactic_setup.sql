-- Phase 7: Galactic Setup (Run this FIRST)
CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE INDEX IF NOT EXISTS idx_employees_tenant_path_gist 
ON employees 
USING GIST (tenant_id, org_path);

ANALYZE employees;
