AGENTS.md
CRITICAL: SINGLE SOURCE OF TRUTH This document serves as the SINGLE SOURCE OF TRUTH for all AI agents working on this codebase. Strict adherence to these standards is mandatory to ensure code quality, maintainability, and stability. Any deviation requires explicit user approval.

1. Project Identity & Architecture
We are building a High-Performance Multi-Tenant SaaS core.

Stack: PostgreSQL 16+ (Supabase compatible), Python FastAPI (Backend), React (Frontend).

Core Philosophy: "Database-Centric Security". RLS is the single source of truth for data isolation.

2. Database & Multi-Tenancy Rules (Strict)
Isolation Strategy: Shared Database, Row-Level Security (RLS).

Tenant ID: EVERY table (except global configs) MUST have a tenant_id (UUID) column.

Hierarchy: Use the ltree extension for the employees and organizations tables.

Path format: Top.Distributor.Dealer.Customer.

RLS Policy Standard:

NEVER use subqueries in RLS policies (e.g., id IN (SELECT...)).

ALWAYS use Session Variables (e.g., current_setting('app.current_tenant')) injected via Middleware/Hooks.

3. Performance & Data Generation
Bulk Operations: When seeding data, use COPY or UNNEST with arrays. Do not use loops in application code for inserts.

Synthetic Data: For stress testing, data must follow a Zipfian Distribution (Power Law) to simulate realistic disparity (e.g., one huge Enterprise tenant, many small ones).

Virtualization: Any UI list rendering > 50 items MUST use virtualization (e.g., ag-grid or react-virtuoso).

4. Coding Standards
Type Safety: No any. Use generic types generated from Supabase (Database['public']).

Client vs Server: Clearly separate Server Components (data fetching) from Client Components (interactivity).

Naming: Use snake_case for DB columns and camelCase for JS/TS variables.