# Master Troubleshooting & Architecture Guide

This document is a unified reference for recurring technical challenges, architectural patterns, and troubleshooting steps encountered in the project. It consolidates knowledge from RLS, RPC, Zod validation, and frontend rendering issues.

---

## 🇮🇱 תמצית המדריך (Hebrew Summary)
מדריך זה מאחד את כל הידע הטכני שנצבר מהתמודדות עם תקלות רוחביות במערכת. הנקודות המרכזיות הן:

1.  **אבטחת מידע (RLS) ומסד הנתונים:**
    *   בשימוש ב-`adminClient` (Service Role) ב-Server Actions, ה-`auth.uid()` הוא `NULL`. יש להעביר את ה-User ID בצורה מפורשת ל-RPC ולהשתמש ב-`COALESCE(p_user_id, auth.uid())`.
    *   שגיאות "No Rows To Show" נובעות לרוב מ-RLS או מחוסר ב-`GRANT SELECT` על הטבלאות לתפקיד `authenticated`.
    *   יש להימנע משימוש ב-`auth.jwt()` בתוך פוליסיז ולהעדיף בדיקה מול טבלת ה-`profiles`.

2.  **אימות נתונים (Zod Validation):**
    *   ההבדל בין `null` ל-`undefined` קריטי: בשדות אופציונליים שיכולים לקבל `null` מהלקוח, יש להשתמש ב-`.nullable().optional()`.
    *   הימנעו משימוש ב-`.default()` עם `safeParse` אם הערך עלול להישלח כ-`undefined`.

3.  **ממשק משתמש (Frontend):**
    *   בעבודה עם גרידים (Data Grids) במצב SSR, חובה לוודא שפונקציית ה-`onFetchData` מחוברת ל-Server Action המתאים.
    *   בעיות של טקסט קטוע (Cut-off) או Overflow נפתרות לרוב על ידי שימוש ב-`flex-wrap` או React Portals למודאלים.

---

## 1. Database & Security (RLS/RPC)

### The "adminClient" & `auth.uid()` Pitfall
When calling a database RPC from a Server Action using `createAdminClient()` (Service Role Key), the database session does **not** have the user's JWT context. 
*   **The Problem:** `auth.uid()` returns `NULL`, causing "Not authenticated" exceptions or empty results.
*   **The Fix:** Explicitly pass the user ID as a parameter.
    ```sql
    CREATE FUNCTION my_rpc(p_user_id UUID DEFAULT NULL) ...
    v_user_id := COALESCE(p_user_id, auth.uid());
    ```

### RLS Diagnostic Checklist
1.  **Check Table Existence:** Ensure the table exists in the `public` schema.
2.  **Verify RLS is Enabled:** `ALTER TABLE x ENABLE ROW LEVEL SECURITY;`.
3.  **Grants:** Ensure `GRANT SELECT, INSERT... ON table TO authenticated;`.
4.  **Insert Policy:** `INSERT` requires `WITH CHECK`, while `SELECT/UPDATE` use `USING`.
5.  **Tenant Isolation:** Always filter by `tenant_id`. Use `profiles` lookup instead of `auth.jwt()` for stability.

### JSONB Safety
When extracting elements from JSONB columns:
*   **Risk:** `jsonb_array_elements` crashes on `NULL` or `{}` (objects).
*   **Fix:** Check type first: `CASE WHEN jsonb_typeof(col) = 'array' THEN ... ELSE NULL END`.

---

## 2. Validation Failures (Zod)

### Null vs. Undefined
*   `.optional()` = Accepts `undefined` or missing key.
*   `.nullable()` = Accepts `null`.
*   `.nullable().optional()` = Use this for most database-linked optional fields to avoid "Expected string, received null" errors.

### Coercion
Use `z.coerce.number()` when receiving values from form inputs or URL params that arrive as strings but should be numeric.

---

## 3. Frontend & Rendering Patterns

### Data Grid Context Loss (SSR)
When using a Grid with `serverSide: true` (e.g., `useEntityView` hook):
*   **Issue:** The grid remains empty if `onFetchData` is not provided.
*   **Fix:** Ensure the component wrapper implements `onFetchData` and calls a dedicated Server Action.

### Layout & Overflow
*   **Clipped Content:** Check parents for `overflow: hidden`. 
*   **Modals:** Use **Portals** to ensure dropdowns and modas aren't cut off by restrictive parent containers.

---

## 4. CPQ (Configure-Price-Quote) Specifics
*   **Product Template:** Defines options/rules (Configurator).
*   **Configuration:** Saves specific user choices (reusable template or quote item).
*   **Security:** CPQ templates are scoped to `tenant_id`. Always verify isolation via `getConfigurationTemplates` server action filtering.

---

## 5. TL;DR Takeaways
1.  **Empty Response?** Check Network tab. If API returns data but UI is empty, it's a frontend binding issue. If API returns `[]`, it's RLS or RPC SQL error.
2.  **Permission Error?** Check if you ran `GRANT EXECUTE` on the RPC for the `authenticated` role.
3.  **Zod Error?** Check if the client is sending `null` vs `undefined`.

## 6. Lesson Learning & Architecture Implementation
When implementing a new feature based on lessons learned:
1.  **Check the Architect Briefing:** Ensure the pattern (e.g., `account_sub_type` resolution) is followed.
2.  **Verify Service Role Context:** If a Server Action fails with RLS/Auth issues, check if it's using an `adminClient` without passing an explicit `user_id`.
3.  **Cross-Document Sync:** Ensure that any fix made in `bom-rls-troubleshooting.md` is also reflected in the `master-troubleshooting-guide.md` to keep the knowledge base current.

---
**Last Updated:** 2026-02-28
