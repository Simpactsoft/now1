-- Migration: 20260301000002_fix_toggle_tenant_module.sql
-- Description: Fix toggle_tenant_module to accept an optional p_user_id.

BEGIN;

-- ============================================================================
-- 1. RPC: Toggle a module for a tenant
-- ============================================================================
CREATE OR REPLACE FUNCTION toggle_tenant_module(
    p_tenant_id UUID,
    p_module_key TEXT,
    p_enabled BOOLEAN,
    p_user_id UUID DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID;
BEGIN
    -- Use the provided user ID if available, otherwise fallback to auth.uid()
    v_user_id := COALESCE(p_user_id, auth.uid());
    
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
