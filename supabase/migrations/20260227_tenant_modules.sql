-- Migration: 20260227_tenant_modules.sql
-- Description: Tenant Module Visibility System
-- Allows super admins (distributors) to control which modules each tenant can access.
-- Dealers can also disable modules within their tenant scope.

BEGIN;

-- ============================================================================
-- 1. Module Definitions — master list of all available modules
-- ============================================================================
CREATE TABLE IF NOT EXISTS module_definitions (
    key TEXT PRIMARY KEY,
    display_name_en TEXT NOT NULL,
    display_name_he TEXT NOT NULL,
    category TEXT NOT NULL CHECK (category IN ('crm', 'sales', 'erp', 'admin')),
    default_enabled BOOLEAN NOT NULL DEFAULT true,
    sort_order INT NOT NULL DEFAULT 0,
    description_he TEXT,
    parent_module TEXT REFERENCES module_definitions(key),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- 2. Tenant Modules — per-tenant module activation
-- ============================================================================
CREATE TABLE IF NOT EXISTS tenant_modules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    module_key TEXT NOT NULL REFERENCES module_definitions(key) ON DELETE CASCADE,
    is_enabled BOOLEAN NOT NULL DEFAULT true,
    disabled_by UUID,
    disabled_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_tenant_module UNIQUE (tenant_id, module_key)
);

CREATE INDEX IF NOT EXISTS idx_tenant_modules_tenant ON tenant_modules(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_modules_key ON tenant_modules(module_key);

-- ============================================================================
-- 3. RLS Policies
-- ============================================================================
ALTER TABLE tenant_modules ENABLE ROW LEVEL SECURITY;

-- Read: anyone can read modules for their own tenant
DROP POLICY IF EXISTS tenant_modules_read ON tenant_modules;
CREATE POLICY tenant_modules_read ON tenant_modules
    FOR SELECT
    USING (tenant_id = get_current_tenant_id());

-- Write: only distributor/dealer roles can modify (enforced at app level)
DROP POLICY IF EXISTS tenant_modules_write ON tenant_modules;
CREATE POLICY tenant_modules_write ON tenant_modules
    FOR ALL
    USING (tenant_id = get_current_tenant_id())
    WITH CHECK (tenant_id = get_current_tenant_id());

-- module_definitions is global — no RLS needed (public read-only)
-- No RLS on module_definitions, accessible to all authenticated users

-- ============================================================================
-- 4. Seed module definitions
-- ============================================================================
INSERT INTO module_definitions (key, display_name_en, display_name_he, category, default_enabled, sort_order, description_he, parent_module) VALUES
    -- CRM modules
    ('people',           'People',           'אנשי קשר',           'crm',   true,  10, 'ניהול אנשי קשר', NULL),
    ('organizations',    'Organizations',    'ארגונים',             'crm',   true,  20, 'ניהול ארגונים', NULL),
    ('relationships',    'Relationships',    'קשרים',              'crm',   true,  30, 'ניהול קשרים בין ישויות', NULL),
    ('activities',       'Activities',       'זרם פעילויות',       'crm',   true,  40, 'מעקב אחר פעילויות ומשימות', NULL),
    ('tasks',            'Tasks',            'משימות',             'crm',   true,  45, 'ניהול משימות', NULL),
    
    -- Sales modules
    ('leads',            'Leads',            'לידים',              'sales', true,  50, 'ניהול לידים נכנסים', NULL),
    ('pipelines',        'Pipelines',        'צינורות מכירה',      'sales', true,  55, 'ניהול פייפליינים ועסקאות', NULL),
    ('quotes',           'Quotes',           'הצעות מחיר',         'sales', true,  60, 'יצירת וניהול הצעות מחיר', NULL),
    ('commissions',      'Commissions',      'עמלות',              'sales', false, 65, 'מעקב אחר עמלות', NULL),
    
    -- ERP modules
    ('products',         'Products',         'מוצרים',             'erp',   true,  70, 'ניהול קטלוג מוצרים', NULL),
    ('cpq',              'CPQ',              'קונפיגורטור CPQ',    'erp',   false, 75, 'Configure-Price-Quote engine', NULL),
    ('purchase_orders',  'Purchase Orders',  'הזמנות רכש',         'erp',   false, 80, 'ניהול הזמנות רכש מספקים', NULL),
    ('payments',         'Payments',         'תשלומים',            'erp',   false, 85, 'ניהול תשלומים והקצאות', NULL),
    
    -- Admin modules
    ('import_data',      'Import Data',      'ייבוא נתונים',       'admin', true,  90, 'ייבוא נתונים מקבצי CSV/Excel', NULL)
ON CONFLICT (key) DO NOTHING;

-- ============================================================================
-- 5. RPC: Get tenant modules with status
-- ============================================================================
CREATE OR REPLACE FUNCTION get_tenant_modules(p_tenant_id UUID)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_result jsonb;
BEGIN
    SELECT jsonb_agg(
        jsonb_build_object(
            'key', md.key,
            'display_name_en', md.display_name_en,
            'display_name_he', md.display_name_he,
            'category', md.category,
            'default_enabled', md.default_enabled,
            'sort_order', md.sort_order,
            'description_he', md.description_he,
            'is_enabled', COALESCE(tm.is_enabled, md.default_enabled),
            'has_override', tm.id IS NOT NULL,
            'disabled_by', tm.disabled_by,
            'disabled_at', tm.disabled_at
        ) ORDER BY md.sort_order
    ) INTO v_result
    FROM module_definitions md
    LEFT JOIN tenant_modules tm ON tm.module_key = md.key AND tm.tenant_id = p_tenant_id;

    RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$;

-- ============================================================================
-- 6. RPC: Get enabled module keys for current tenant (for sidebar/routing)
-- ============================================================================
CREATE OR REPLACE FUNCTION get_enabled_modules()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_tenant_id UUID;
    v_result jsonb;
BEGIN
    -- Get tenant from auth metadata
    v_tenant_id := (
        SELECT raw_app_meta_data->>'tenant_id'
        FROM auth.users
        WHERE id = auth.uid()
    );

    IF v_tenant_id IS NULL THEN
        -- Fallback to session setting
        v_tenant_id := current_setting('app.current_tenant', true)::uuid;
    END IF;

    IF v_tenant_id IS NULL THEN
        RETURN '[]'::jsonb;
    END IF;

    -- Return array of enabled module keys
    SELECT jsonb_agg(md.key ORDER BY md.sort_order) INTO v_result
    FROM module_definitions md
    LEFT JOIN tenant_modules tm ON tm.module_key = md.key AND tm.tenant_id = v_tenant_id
    WHERE COALESCE(tm.is_enabled, md.default_enabled) = true;

    RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$;

-- ============================================================================
-- 7. RPC: Toggle a module for a tenant
-- ============================================================================
CREATE OR REPLACE FUNCTION toggle_tenant_module(
    p_tenant_id UUID,
    p_module_key TEXT,
    p_enabled BOOLEAN
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID;
BEGIN
    v_user_id := auth.uid();
    
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    -- Verify module exists
    IF NOT EXISTS (SELECT 1 FROM module_definitions WHERE key = p_module_key) THEN
        RAISE EXCEPTION 'Module % does not exist', p_module_key;
    END IF;

    -- Upsert the tenant_module record
    INSERT INTO tenant_modules (tenant_id, module_key, is_enabled, disabled_by, disabled_at, updated_at)
    VALUES (
        p_tenant_id,
        p_module_key,
        p_enabled,
        CASE WHEN NOT p_enabled THEN v_user_id ELSE NULL END,
        CASE WHEN NOT p_enabled THEN now() ELSE NULL END,
        now()
    )
    ON CONFLICT (tenant_id, module_key) DO UPDATE SET
        is_enabled = EXCLUDED.is_enabled,
        disabled_by = CASE WHEN NOT EXCLUDED.is_enabled THEN v_user_id ELSE NULL END,
        disabled_at = CASE WHEN NOT EXCLUDED.is_enabled THEN now() ELSE NULL END,
        updated_at = now();

    RETURN jsonb_build_object(
        'success', true,
        'module_key', p_module_key,
        'is_enabled', p_enabled
    );
END;
$$;

-- Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';

COMMIT;
