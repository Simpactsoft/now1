# BOM (Bill of Materials) RLS & RPC Troubleshooting Guide

## Overview
This document details a complex issue encountered where the Bill of Materials (BOM) tree structure for a product refused to render in the UI, consistently returning an empty array `[]` despite the data existing in the database.

It serves as a technical post-mortem and a reference for future architecture involving Supabase RPC (Remote Procedure Calls), RLS (Row Level Security), Next.js API Routes, and React UI components.

---

## The Problem

### Symptoms
1. **Empty UI:** The Bill of Materials tab on the Product View showed "0 items" even when components were linked.
2. **Empty API Response:** Navigating to `/api/bom/[productId]` returned `{ tree: [] }`.
3. **Database Success:** Running direct SQL queries as the postgres `postgres` user or via the `test-bom.js` script with the Service Role Key successfully returned the BOM tree (e.g., 11 items).

### Root Causes (The "Trifecta" of Failures)
This issue was caused by three consecutive failures across different layers of the stack:

#### 1. Middleware / API Context Loss
Next.js API routes (`app/api/...`) interact with Supabase using `@/lib/supabase/server`. However, the Supabase server client often lacks the custom headers (specifically, `x-tenant-id`) that the database's RLS policies (`get_current_tenant_id()`) expect in order to authorize reads. 
When the API route explicitly queried `bom_headers` using `.select()`, Supabase RLS blocked the read silently, returning 0 rows. 
**Result:** The API route bailed out early and returned an empty tree.

#### 2. RPC Execution Context (Row Level Security)
The database function `get_bom_tree` contained recursive logic to traverse `bom_items`. By default, Postgres functions run with the privileges and context of the *caller* (the anonymous or authenticated API user). 
Because the API user was missing the correct `tenant_id` context inside the RPC execution environment, the internal `SELECT * FROM bom_items` queries within the function were blocked by RLS policies.
**Result:** Even if the RPC was called, it executed against "invisible" rows and returned an empty table.

#### 3. Frontend Component Type Mismatch (Silent Crash)
Once the database and API issues were resolved to deliver the data, the frontend component `BomTreeView.tsx` failed to render. 
The Postgres RPC was returning the hierarchy path as a native Postgres array (`TEXT[]`), resulting in JSON like `path: ["Assembly", "Component"]`. However, the Ag-Grid / React UI component expected a string (e.g., `"Assembly > Component"`) and attempted to run `.split(' > ')` on the array.
**Result:** The JavaScript execution crashed silently, resulting in an empty or blank rendering area for the Tree Grid without explicit console errors blocking the whole app.

---

## The Solution

To prevent this in the future, the following architectural fixes were applied:

### Fix 1: API Routing - Avoid Raw Queries on RLS-Heavy Tables
Instead of fighting RLS inside API routes by querying `bom_headers` directly (which requires heavy spoofing of tenant claims), the API route was refactored.
- **Before:** Queried `bom_headers`. Fails if tenant claim is missing.
- **After:** Queries `products` (which handles tenant mapping smoothly via `.eq("tenant_id", tenantId)`) to authorize the user, then delegates entirely to the RPC.

### Fix 2: Database RPC - Use `SECURITY DEFINER`
When an RPC function needs to aggregate complex cross-table data for the user (like exploding a BOM), it should bypass RLS internally *if and only if* authorization is handled before the data is returned.
- **Fix:** Added `SECURITY DEFINER` and `SET search_path = public` to the `get_bom_tree` and `calculate_bom_cost` database functions.
- **Why:** This forces the function to execute as the database owner, bypassing RLS internally so the recursive query can see all `bom_items`. The API route protects against unauthorized access by verifying ownership of the root `product_id` before calling the RPC.

### Fix 3: Frontend - Defensive Programming for Types
Strict typing is vital when data crosses the Postgres -> Next.js -> React boundary.
- **Fix:** `BomTreeView.tsx` and `BomTab.tsx` were updated to safely normalize the `path` variable.
  ```typescript
  // Normalization logic: Handle both Array and String formats defensively
  const pathParts = Array.isArray(node.path) ? node.path : (node.path as string).split(' > ');
  ```

---

## Future Takeaways / TL;DR
1. **Check RLS First:** If data exists for the `postgres` user but not for the API, it is *always* RLS.
2. **RPC Context:** If an RPC aggregates nested data, consider `SECURITY DEFINER`, but secure the entry point (the API parameter).
3. **Data Type Defenses:** When debugging silent empty UI components, `console.log` the raw API response and check if `.map`, `.filter`, or `.split` are being called on unexpected types (like Arrays instead of Strings).

---

## Extended Knowledge Base: Common Patterns & Repeated Failures

The following sections synthesize recurring issues encountered across the project, serving as a master reference for debugging without needing repeated reminders.

### 1. RLS Security Architecture & Multi-Tenant Data Isolation

**The Problem:** Cross-tenant data exposure or blocked queries due to strictly/incorrectly written RLS policies.
- **`auth.jwt()` Pitfall:** `auth.jwt() ->> 'tenant_id'` may be null or unreliable depending on the authentication flow.
- **The Correct Approach:** 
  1. For `SELECT`, `UPDATE`, and `DELETE` policies, use a fallback to the `profiles` table if needed: 
     `USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()))`
  2. For `INSERT` policies, you **MUST** use `WITH CHECK`:
     `WITH CHECK (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()))`
  3. **Server Actions** must filter explicitly (e.g., `.eq("tenant_id", tenantId)`) reading the tenant ID from cookies or the `profiles` database table, not just relying on JWT metadata.

### 2. Zod Validation Failures

**The Problem:** "Validation failed" or "Expected string, received null" errors silently breaking form submissions.
- **`null` vs `undefined`:** `.optional()` expects `undefined`. If the client sends `null`, it will fail.
  - *Fix:* Use `.nullable().optional()` for fields that can be either.
- **`.default()` with `undefined`:** `.default("value")` might not behave as expected if the client explicitly sends `undefined` during `safeParse`.
  - *Fix:* Use `.optional()` for fields that can be omitted.

### 3. Frontend: Overflow, Cut-Off Issues, and Context Loss

**The Problem (Overflow):** Elements (like steps, layout grids) getting clipped at the edges of the screen.
- **Root Cause:** A parent container has `overflow: hidden`, `overflow-x: auto/scroll`, or a restrictive `padding`/`max-width`.
- **Fixes:**
  - *Horizontal Lists:* Instead of forcing a horizontal scroll with `overflow-x`, use `flex-wrap: wrap` first.
  - *Scroll Needed:* Ensure inner containers have sufficient `padding` and `scroll-padding-inline`.
  - *Fullscreen/Modals:* Use **React Portals** (`createPortal(..., document.body)`) to escape restricted parent containers.

**The Problem (Context Loss):** Browser APIs like `requestFullscreen()` fail with "API can only be initiated by a user gesture".
- **Root Cause:** The user gesture context is lost if called inside a `useEffect` or after complex async operations.
- **Fix:** Keep operations close to the event handler or use `setTimeout(async () => { ... }, 0)` inside the `onClick` handler to maintain the gesture chain while allowing React to render.
