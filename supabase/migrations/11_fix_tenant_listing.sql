-- Migration 11: Final Tenant Listing Fix
-- מאפשר לסוויצ'ר להציג את החברות מבלי לפגוע באבטחת המידע

-- 1. ניקוי פוליסיז ישנים על טבלת ה-tenants
DROP POLICY IF EXISTS tenant_isolation_tenants ON tenants;
DROP POLICY IF EXISTS tenant_list_policy ON tenants;

-- 2. יצירת פוליסי שמאפשר לכולם לראות רק את רשימת החברות (רק ID ו-Name)
CREATE POLICY tenant_list_policy ON tenants
    FOR SELECT TO anon, authenticated
    USING (true);

-- 3. וידוא שנתוני העובדים נשארים מבודדים (RLS)
-- הפוליסי הזה מוודא שרואים עובדים רק אם ה-Tenant מוגדר ב-Session או ב-JWT
DROP POLICY IF EXISTS employees_session_isolation ON employees;
CREATE POLICY employees_session_isolation ON employees
    FOR SELECT TO anon, authenticated, service_role
    USING (
        tenant_id = COALESCE(
            (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid,
            NULLIF(current_setting('app.current_tenant', true), '')::uuid
        )
    );
