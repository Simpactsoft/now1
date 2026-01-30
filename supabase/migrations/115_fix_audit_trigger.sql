
-- Migration: 115_fix_audit_trigger.sql
-- Description: Makes log_activity() robust against Missing Profiles.
-- Prevents "Foreign Key Violation" from silently killing the log when the user has no profile.

BEGIN;

CREATE OR REPLACE FUNCTION log_activity()
RETURNS TRIGGER AS $$
DECLARE
    v_old_data JSONB;
    v_new_data JSONB;
    v_changed_keys TEXT[];
    v_tenant_id UUID;
    v_actor UUID;
    v_profile_exists BOOLEAN;
BEGIN
    -- 1. Determine Actor (Safely)
    v_actor := auth.uid();
    
    -- Check if this actor actually has a profile (to satisfy Foreign Key in 113)
    IF v_actor IS NOT NULL THEN
        SELECT EXISTS(SELECT 1 FROM profiles WHERE id = v_actor) INTO v_profile_exists;
        IF NOT v_profile_exists THEN
            v_actor := NULL; -- Log as "System/Unknown" instead of failing
        END IF;
    END IF;

    -- 2. Determine Tenant (Try NEW, then OLD)
    IF TG_OP = 'DELETE' THEN
        v_tenant_id := OLD.tenant_id;
        v_old_data := to_jsonb(OLD);
    ELSIF TG_OP = 'INSERT' THEN
        v_tenant_id := NEW.tenant_id;
        v_new_data := to_jsonb(NEW);
    ELSE -- UPDATE
        v_tenant_id := NEW.tenant_id;
        v_old_data := to_jsonb(OLD);
        v_new_data := to_jsonb(NEW);
        
        -- Calculate Changed Keys
        SELECT array_agg(key) INTO v_changed_keys
        FROM jsonb_each(v_new_data) ne
        WHERE ne.value IS DISTINCT FROM v_old_data -> ne.key;
    END IF;

    -- 3. Insert Log (Now safe with valid/null v_actor)
    INSERT INTO audit_logs (
        tenant_id,
        table_name,
        record_id,
        operation,
        old_values,
        new_values,
        changed_fields,
        performed_by
    )
    VALUES (
        v_tenant_id,
        TG_TABLE_NAME::TEXT,
        COALESCE(NEW.id, OLD.id),
        TG_OP,
        v_old_data,
        v_new_data,
        v_changed_keys,
        v_actor -- Will be valid UUID or NULL
    );

    RETURN COALESCE(NEW, OLD);
EXCEPTION 
    WHEN OTHERS THEN
        -- Still catch unexpected errors, but now FK won't trigger this.
        RAISE WARNING 'Audit Log Failed: %', SQLERRM;
        RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMIT;
