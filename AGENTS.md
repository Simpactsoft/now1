# AGENTS.md
> [!IMPORTANT]
> **CRITICAL: SINGLE SOURCE OF TRUTH**
> This document serves as the SINGLE SOURCE OF TRUTH for all AI agents working on this codebase. Strict adherence to these standards is mandatory to ensure code quality, maintainability, and stability. Any deviation requires explicit user approval.

## 1. Project Identity & Architecture
We are building a High-Performance Multi-Tenant SaaS core.

- **Stack**: PostgreSQL 16+ (Supabase compatible), Python FastAPI (Backend), React (Next.js 15 Frontend).
- **Core Philosophy**: "Database-Centric Security". RLS is the single source of truth for data isolation.

## 2. Database Constraints (Strict Enforcement)
- **Multi-Tenancy**: EVERY table (except global configs) must have a `tenant_id` (UUID) column.
- **RLS**: `ALTER TABLE... ENABLE ROW LEVEL SECURITY` must be applied immediately after table creation.
- **Hierarchy**: The `employees` and `organizations` tables MUST use the `ltree` extension. **DO NOT** use recursive CTEs for standard reads.
- **Indexing**: All foreign keys and RLS columns (`tenant_id`, `org_path`) must be indexed. Use `GiST` for ltree.

## 3. Performance & Scalability Rules
- **Data Seeding**: Use `COPY` or batched `INSERT` operations using `generate_series`. **NEVER** verify insertions row-by-row during massive seeding.
- **Policy Optimization**: RLS policies must avoid subqueries. Rely on `current_setting('app.claims...')` session variables injected by the middleware.

## 4. Tenant Profiles for Testing
When generating seed data, you must strictly adhere to these profiles:
1.  **Tenant A (Startup)**: 50 employees, flat hierarchy (depth=2).
2.  **Tenant B (Mid-Market)**: 5,000 employees, balanced hierarchy (depth=6).
3.  **Tenant C (Enterprise)**: 1,000,000 employees, deep complex hierarchy (depth=15, varied span-of-control).

## 5. Workflows & Standard Procedures
For specific implementation tasks, refer to the workflows in `.agent/workflows/`.

### Available Workflows:
- **[Create Data Grid Component](.agent/workflows/create_grid_component.md)**: Standards for creating tables/grids (Persistence, Search, Layout). Follow this strictly for any new list view.