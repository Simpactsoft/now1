# System Architecture Map

**Last Updated:** 2026-01-29
**Status:** Production Ready (Post-Audit)

---

## 1. Data Model & Relationships

The system utilizes a **Single-Table Design** (`cards`) partitioned by Tenant for maximum scale and isolation.

### Core Entities
*   **Tenants:** The top-level isolation unit. Every record belongs to exactly one `tenant_id`.
*   **Hierarchy (`ltree`):** Defines the organizational structure within a Tenant.
    *   **Root:** `org` (Headquarters).
    *   **Dealers:** `org.dealer1`, `org.dealer2`.
    *   **Customers:** Attached to specific nodes in the hierarchy.
*   **Cards (`public.cards`):** The unified entity table.
    *   Replaces legacy `people`, `organizations`, `parties`.
    *   Stores: `display_name`, `contact_methods` (JSONB), `custom_fields` (JSONB), `status`.
*   **Profiles (`public.profiles`):** Links Supabase `auth.users` to the Data Model.
    *   Stores: `tenant_id`, `org_path` (Security Context).

### Relationships
*   **User -> Data:** A User sees data if:
    1.  `user.tenant_id == data.tenant_id`
    2.  `data.hierarchy_path` is a descendant of `user.org_path`.
*   **Person -> Organization:** Managed via `party_memberships` (Link table).

---

## 2. Current Tech Stack

### Frontend
*   **Framework:** Next.js 15+ (App Router, Server Actions).
*   **Language:** TypeScript / React.
*   **Styling:** Tailwind CSS + Shadcn/UI (Radix).
*   **Data Grid:** AG Grid Enterprise (High performance data tables).

### Backend (Supabase)
*   **Database:** PostgreSQL 16+.
*   **Auth:** Supabase Auth (GoTrue).
*   **Storage:** Supabase Storage.
*   **Logic:** PL/pgSQL RPCs (Remote Procedure Calls) for critical operations.

---

## 3. Security State

**Status:** ✅ Passed Security/Penetration Audit (Jan 2026).

### Authentication Flow
1.  **Login:** User authenticates via Supabase Auth (Email/Password or SSO).
2.  **Context Loading:** App fetches `profile` to determine `tenant_id` and `org_path`.
3.  **Session:** Session token is attached to all requests.

### Authorization (RLS)
The "Cone of Visibility" model is strictly enforced at the Database Row Level:
*   **Read:** Users only see rows within their assigned hierarchy path.
*   **Write:** Users can only create/edit rows within their assigned hierarchy path.
*   **Isolation:** Cross-tenant access is cryptographically impossible via Partitioning protection.

---

## 4. Key Endpoints & Modules

### Modules
*   **Dealers Dashboard:** Grid view of all Leads/Customers assigned to the dealer.
*   **Customer Profile:** 360-degree view (Timeline, Details, Custom Fields).
*   **Admin Console:** Tenant management and global settings.

### Critical Server Actions
*   `fetchPeople.ts`: Secure search grid (calls `fetch_people_crm` RPC).
*   `createPerson.ts`: Validated creation logic (calls `create_person` RPC).
*   `updatePerson.ts`: Audited update logic.

---

## 5. Deployment

*   **Environment:** Production (Supabase Cloud).
*   **CI/CD:** GitHub Actions (implied).
