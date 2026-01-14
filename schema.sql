-- Phase 1: Database Architecture

-- 1. Extensions
CREATE EXTENSION IF NOT EXISTS "ltree";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";

-- 2. Tenants Table
CREATE TABLE IF NOT EXISTS tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    plan TEXT NOT NULL DEFAULT 'free',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now())
);

-- 3. Employees Table
CREATE TABLE IF NOT EXISTS employees (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    manager_id UUID REFERENCES employees(id),
    name TEXT NOT NULL,
    salary INTEGER NOT NULL DEFAULT 0,
    org_path ltree,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now())
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_employees_tenant_id ON employees(tenant_id);
CREATE INDEX IF NOT EXISTS idx_employees_org_path_gist ON employees USING GIST (org_path);
CREATE INDEX IF NOT EXISTS idx_employees_manager_id ON employees(manager_id);

-- 4. Trigger to maintain org_path
CREATE OR REPLACE FUNCTION maintain_org_path() RETURNS TRIGGER AS $$
DECLARE
    parent_path ltree;
BEGIN
    IF NEW.manager_id IS NULL THEN
        NEW.org_path = text2ltree(replace(NEW.id::text, '-', '_'));
    ELSE
        SELECT org_path INTO parent_path FROM employees WHERE id = NEW.manager_id;
        IF parent_path IS NULL THEN
            RAISE EXCEPTION 'Manager % not found for employee %', NEW.manager_id, NEW.id;
        END IF;
        NEW.org_path = parent_path || text2ltree(replace(NEW.id::text, '-', '_'));
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_maintain_org_path
BEFORE INSERT OR UPDATE OF manager_id ON employees
FOR EACH ROW EXECUTE FUNCTION maintain_org_path();

-- 5. RLS Security
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;

-- Policy 1: Isolation (Users see only rows matching app.current_tenant)
-- Note: We cast current_setting to uuid. If it's missing, it will throw an error, which is good for strictness,
-- or we can handle it gracefully. The user asked for "Strict".
CREATE POLICY tenant_isolation_tenants ON tenants
    USING (id = current_setting('app.current_tenant')::uuid);

CREATE POLICY tenant_isolation_employees ON employees
    USING (tenant_id = current_setting('app.current_tenant')::uuid);

-- Policy 2: Hierarchy (Managers see themselves AND all descendants)
-- Constraint: Do NOT use subqueries.
-- We assume the user querying has their own Context (e.g. they are an employee).
-- But typically RLS uses a "current_user_id" or similar setting to know WHO is asking.
-- The user said: "Managers see themselves AND all descendants (<@ operator)".
-- This implies we need to know the 'current_employee_id' or 'current_user_path' from the session.
-- Since the user didn't specify a 'current_user' mechanism, I will assume we might have 'app.current_user_path' or similar injected.
-- However, strict compliance says "Users see only rows matching app.current_tenant" AND "Managers see themselves AND all descendants".
-- If I only restrict by tenant, then all employees in the tenant are visible.
-- So Policy 1 is the base. Policy 2 is likely an *additional* restriction or the *real* restriction?
-- Usually policies are ORed if multiple exist for the same operation.
-- If I want intersection (AND), I should put them in one policy or rely on RLS logic.
-- Actually, the user likely means: Restrict by Tenant AND (Restrict by Hierarchy).
-- But RLS policies on the same table are ORed effectively? No, "If multiple policies are defined... the combining logic is OR".
-- So if I have "Tenant Isolation" (allows all in tenant) AND "Hierarchy" (allows only descendants), then "Tenant Isolation" will open it up to everyone in the tenant.
-- Thus, I must combine them.
--
-- BUT, typically "Isolation" implies "You can't see other *tenants*".
-- "Hierarchy" implies "Within my tenant, I can only see my team".
-- So the policy should be:
-- (tenant_id = ...) AND ( (org_path <@ current_user_path) OR (id = current_user_id) )
--
-- The user instructions:
-- Policy 1 (Isolation): Users see only rows matching app.current_tenant.
-- Policy 2 (Hierarchy): Managers see themselves AND all descendants (<@ operator).
--
-- The user listed them as separate items.
-- If they are separate policies:
-- Policy 1: `tenant_id = ...` -> Result: All rows in tenant.
-- Policy 2: `...` -> Result: Subtree.
-- Union of (All rows) U (Subtree) = All rows.
-- This defeats the hierarchy purpose if Policy 1 is just `tenant_id = ...`.
--
-- INTERPRETATION:
-- The user might mean:
-- 1. Tenant Isolation is the BASE requirement (always active).
-- 2. Hierarchy is the SPECIFIC access rule for employees viewing employees.
-- So I should implement ONE policy that does BOTH, OOOOR...
-- Maybe Policy 1 is for "Admin" and Policy 2 is for "Manager"?
-- The prompt doesn't distinguish roles.
--
-- Let's look at "Policy 1 (Isolation): Users see only rows matching app.current_tenant."
-- If that is the ONLY rule for "Users", then they see everything in the tenant.
-- Maybe "Policy 2" is for a specific role?
--
-- Re-reading: "Policy 2 (Hierarchy): Managers see themselves AND all descendants (<@ operator)."
--
-- If I seek Strict RLS:
-- It is likely that the user wants to demonstrate both capabilities.
-- Or maybe the user implies that the "Hierarchy" policy *refines* the visibility?
-- RLS policies are permissive. You need at least one to pass.
-- If I create `policy_tenant` allowing everything in tenant, then `policy_hierarchy` is redundant.
--
-- Correct Approach for "Database-Centric Security":
-- We probably need `app.current_user_role`.
-- If role = 'admin', see all in tenant.
-- If role = 'manager', see subtree.
--
-- Since the user didn't specify roles, I will assume a standard implementation where we check a session variable for the user's path.
-- `current_setting('app.current_user_path', true)`
--
-- I will define ONE policy for `employees` that combines them to ensure safety, or separate them if they apply to different roles?
-- PROMPT says: "Policy 1... Policy 2..."
-- I will add BOTH variables to the check.
--
-- Actually, usually `Policy 1` applies to the table `tenants` (to see your own tenant) and `employees` (to see basic info?).
-- Let's stick to the prompt text.
-- "Policy 1... Policy 2..."
-- I will implement them as part of the SAME policy for `employees` table to ensure AND logic, or use `AS RESTRICTIVE` (Postgres 10+ supports permissive, Postgres 16 supports `AS RESTRICTIVE` policies).
-- "RLS is the single source of truth".
--
-- To be safe and strict (as requested):
-- I will create a Permissive Policy for Tenant Isolation.
-- AND a RESTRICTIVE Policy for Hierarchy?
-- Postgres allows `CREATE POLICY ... AS RESTRICTIVE`.
-- This enforces that the row MUST pass this policy IN ADDITION to the permissive ones.
-- THIS IS PERFECT.
--
-- So:
-- Policy 1 (Permissive): `tenant_id = current_settings(...)`
-- Policy 2 (Restrictive): `org_path <@ ...`
--
-- Wait, if I do that, then a non-manager (leaf) can only see themselves?
-- "Managers see themselves AND all descendants".
-- A leaf employee sees only themselves (descendant of self).
-- This fits.
--
-- I need `app.current_user_path` or `app.current_user_id` to derive path.
-- I'll rely on `app.current_user_path` being set.
--
-- Plan:
-- 1. Policy Isolation (Permissive): `tenant_id = app.current_tenant`
-- 2. Policy Hierarchy (Restrictive): `org_path <@ current_setting('app.current_user_path')::ltree`
--
-- One catch: `app.current_user_path` might not be known if we just have `user_id`.
-- But the prompt says "Do NOT use subqueries... Use current_setting()".
-- So the application must fetch the path and set it in the config `set_config('app.current_user_path', ...)` before querying.
-- This aligns with "Database-Centric Security" where the app prepares the session context.

-- Final plan for schema.sql:
-- Use `CREATE POLICY ... AS PERMISSIVE` for Isolation.
-- Use `CREATE POLICY ... AS RESTRICTIVE` for Hierarchy. (Requires PG 10+, we are on 16+).

