
-- Migration: 116_debug_audit_trigger_loud.sql
-- Description: LEAKY DEBUGGING - Removes Exception Handler to expose the real error.
-- WARNING: This will cause App Actions to FAIL if Logging fails. This is intended for finding the bug.

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
    
    -- Check if this actor actually has a profile
    IF v_actor IS NOT NULL THEN
        SELECT EXISTS(SELECT 1 FROM profiles WHERE id = v_actor) INTO v_profile_exists;
        IF NOT v_profile_exists THEN
            RAISE NOTICE 'Debug: Actor % has no profile. Setting to NULL.', v_actor;
            v_actor := NULL; 
        END IF;
    ELSE
        RAISE NOTICE 'Debug: Actor is NULL (System/Anon).';
    END IF;

    -- 2. Determine Tenant
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
        
        SELECT array_agg(key) INTO v_changed_keys
        FROM jsonb_each(v_new_data) ne
        WHERE ne.value IS DISTINCT FROM v_old_data -> ne.key;
    END IF;

    RAISE NOTICE 'Debug: Attempting Insert. Tenant: %, Table: %, Actor: %', v_tenant_id, TG_TABLE_NAME, v_actor;

    -- 3. Insert Log (LOUD MODE: No Exception Handler)
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
        v_actor
    );

    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMIT;
