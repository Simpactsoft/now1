-- Phase 8: Deep Scroll Index Optimization
-- These "Covering Indexes" include tenant_id and the sort columns
-- to allow Postgres to resolve ORDER BY and OFFSET entirely within the index.

-- Optimized Index for Name Sorting
CREATE INDEX IF NOT EXISTS idx_employees_tenant_name_btree 
ON employees (tenant_id, name ASC);

-- Optimized Index for Salary Sorting
CREATE INDEX IF NOT EXISTS idx_employees_tenant_salary_btree 
ON employees (tenant_id, salary DESC);

-- Optimized Index for Date Sorting (Default)
CREATE INDEX IF NOT EXISTS idx_employees_tenant_created_btree 
ON employees (tenant_id, created_at DESC);

-- Re-analyze to update the planner
ANALYZE employees;
