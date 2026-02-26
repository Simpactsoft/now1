-- Migration: 20260301000002_audit_trail_headers.sql
-- Description: Updates the Enterprise Audit Trail to securely extract standard PostgREST request headers for server-side actions.

BEGIN;

CREATE OR REPLACE FUNCTION enterprise_audit_trigger_func()
RETURNS TRIGGER AS $$
DECLARE
    v_old_data JSONB;
    v_new_data JSONB;
    v_changed_keys TEXT[];
    v_tenant_id UUID;
    v_actor UUID;
    v_record_id TEXT;
    v_headers JSON;
BEGIN
    -- Determine Actor: 
    -- 1. Try auth.uid()
    -- 2. Fallback to custom 'x-audit-user-id' header from PostgREST
    -- 3. Fallback to current_setting (if run locally outside PostgREST)
    
    v_actor := auth.uid();
    
    IF v_actor IS NULL THEN
        BEGIN
            v_headers := current_setting('request.headers', true)::JSON;
            v_actor := NULLIF(v_headers->>'x-audit-user-id', '')::UUID;
        EXCEPTION WHEN OTHERS THEN
            v_actor := NULL;
        END;
    END IF;
    
    IF v_actor IS NULL THEN
        BEGIN
            v_actor := NULLIF(current_setting('app.current_user_id', true), '')::UUID;
        EXCEPTION WHEN OTHERS THEN
            v_actor := NULL;
        END;
    END IF;

    -- Determine Data and Tenant
    IF TG_OP = 'DELETE' THEN
        v_old_data := to_jsonb(OLD);
        v_new_data := NULL;
        v_record_id := OLD.id::TEXT;
        
        BEGIN
            v_tenant_id := OLD.tenant_id;
        EXCEPTION WHEN OTHERS THEN
            v_tenant_id := NULL;
        END;
        
    ELSIF TG_OP = 'INSERT' THEN
        v_old_data := NULL;
        v_new_data := to_jsonb(NEW);
        v_record_id := NEW.id::TEXT;
        
        BEGIN
            v_tenant_id := NEW.tenant_id;
        EXCEPTION WHEN OTHERS THEN
            v_tenant_id := NULL;
        END;
        
    ELSE -- UPDATE
        v_old_data := to_jsonb(OLD);
        v_new_data := to_jsonb(NEW);
        v_record_id := NEW.id::TEXT;
        
        BEGIN
            v_tenant_id := NEW.tenant_id;
        EXCEPTION WHEN OTHERS THEN
            v_tenant_id := NULL;
        END;
        
        -- Calculate Changed Keys
        SELECT array_agg(key) INTO v_changed_keys
        FROM jsonb_each(v_new_data) ne
        WHERE ne.value IS DISTINCT FROM v_old_data -> ne.key
          AND ne.key != 'updated_at';
          
        IF v_changed_keys IS NULL OR array_length(v_changed_keys, 1) = 0 THEN
            RETURN NEW;
        END IF;
    END IF;

    -- Try to get tenant_id from headers if it wasn't on the record
    IF v_tenant_id IS NULL THEN
        BEGIN
            v_headers := current_setting('request.headers', true)::JSON;
            v_tenant_id := NULLIF(v_headers->>'x-audit-tenant-id', '')::UUID;
        EXCEPTION WHEN OTHERS THEN
            v_tenant_id := NULL;
        END;
    END IF;

    -- Fallback for tenant_id if setting was empty
    IF v_tenant_id IS NULL THEN
        v_tenant_id := '00000000-0000-0000-0000-000000000000'::UUID;
    END IF;

    -- Insert Log
    INSERT INTO enterprise_audit_logs (
        tenant_id,
        table_name,
        record_id,
        operation,
        old_data,
        new_data,
        changed_fields,
        performed_by
    )
    VALUES (
        v_tenant_id,
        TG_TABLE_NAME::TEXT,
        v_record_id,
        TG_OP,
        v_old_data,
        v_new_data,
        v_changed_keys,
        v_actor
    );

    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

COMMIT;
