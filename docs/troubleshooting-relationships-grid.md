# Troubleshooting: Empty Relationships Grid (Global View)

## The Symptom
The Global Relationships Grid (`/dashboard/relationships`) displays **"No Rows To Show"** (or returns 0 items in the Network tab), even though there are thousands of relationship records seeded in the database.

This issue turned out to have **multiple layers of failures**, spanning from the PostgreSQL Database (RPC and RLS) all the way up to the Next.js Frontend.

---

## Layer 1: Database RPC Crashing Silently

### 1. Missing Columns in Dynamic SQL
The RPC `fetch_global_relationships_crm` was dynamically selecting `s_card.avatar_url` and `t_card.avatar_url`. However, the unified `cards` table in V2 **does not have** an `avatar_url` column.
- **Result:** The SQL query failed internally with `column "avatar_url" does not exist`, causing the RPC to return `null` or 0 rows silently.
- **Fix:** Replaced the non-existent column mappings with `NULL::text AS source_avatar_url`.

### 2. JSONB Parsing on NULL or Empty Objects `{}`
The RPC attempted to extract emails and phones using `jsonb_array_elements(contact_methods)`.
- If `contact_methods` was `NULL` (like in our seeded cards) or an empty object `{}`, the `jsonb_array_elements` function crashed the entire query because it expects a JSON array `[]`.
- **Fix:** Wrapped the extraction in a type-checker and COALESCE:
  ```sql
  CASE 
    WHEN jsonb_typeof(COALESCE(s_card.contact_methods, '[]'::jsonb)) = 'array' 
    THEN (SELECT m->>'value' FROM jsonb_array_elements(s_card.contact_methods) m WHERE m->>'type' = 'email' LIMIT 1) 
    ELSE NULL 
  END AS source_email
  ```

---

## Layer 2: Permissions (RLS & Grants)

### 3. Missing Table-Level Grants
Even with RLS policies in place, the `entity_relationships` table lacked the basic `GRANT SELECT` permissions for the `authenticated` role.
- **Result:** Calling the debug endpoint returned `count: null` (access denied), rather than `0` (empty data).
- **Fix:** Explicitly granted privileges:
  ```sql
  GRANT SELECT, INSERT, UPDATE, DELETE ON entity_relationships TO authenticated;
  GRANT SELECT ON relationship_types TO authenticated;
  ```

### 4. Incorrect RLS Policies
The initial RLS policies for `entity_relationships` were checking tenant validation against a legacy or incorrect table `profiles` instead of `user_profiles`, causing the condition to always fail.
- **Fix:** Dropped the old policies and recreated them using the robust, system-wide `get_current_tenant_id()` function:
  ```sql
  CREATE POLICY "view_relationships" ON entity_relationships
      FOR SELECT TO authenticated
      USING (tenant_id = get_current_tenant_id());
  ```

### 5. Missing Execution Grants on the RPC
A new RPC function needs explicit execution permissions. Without it, the Next.js API running as the `authenticated` role was denied access to execute the RPC.
- **Fix:** Added execution grants to the end of the SQL migration:
  ```sql
  GRANT EXECUTE ON FUNCTION public.fetch_global_relationships_crm(uuid, integer, integer, text, text, jsonb) TO authenticated;
  GRANT EXECUTE ON FUNCTION public.fetch_global_relationships_crm(uuid, integer, integer, text, text, jsonb) TO service_role;
  ```

---

## Layer 3: Next.js Frontend Component

### 6. Missing API Connection (`onFetchData`) in `useEntityView`
The API was finally returning the 77,000+ records successfully to the Next.js backend, but the Grid in the UI was still empty.
- **Root Cause:** The `RelationshipsGlobalWrapper.tsx` Component configured the `useEntityView` hook with `serverSide: true`, but **failed to provide the `onFetchData` function**. Without this prop, the hook never triggered the server action to fetch data, falling back instead to the empty `initialData` array.
- **Fix:** 
  1. Created a new Server Action: `fetchGlobalRelationshipsAction` in `actions/relationships.ts`.
  2. Implemented the `onFetchData` callback inside `RelationshipsGlobalWrapper.tsx`, pointing it to the new server action, mapping the filters and pagination properties exactly as the RPC dictates.

---

## Takeaways for Future Debugging:
1. **Never assume the backend is failing if the UI is empty:** Always check the browser DevTools "Network" tab first. In this case, the `/api/relationships` endpoint was successfully returning 77,000 records, proving the bug was on the client side (`useEntityView` misconfiguration).
2. **If a count query returns `null` instead of `0` in Supabase:** You are likely missing a `GRANT SELECT` permission on the table itself, not just an RLS policy.
3. **Migrating to Unified Tables (like `cards`):** Always double-check dynamic SQL scripts (like RPCs) for legacy column names (e.g., `avatar_url` vs checking `metadata`).
4. **JSONB Array safety:** Always use `jsonb_typeof` before invoking `jsonb_array_elements` to gracefully handle `NULL` or `{}` payload gaps safely.
