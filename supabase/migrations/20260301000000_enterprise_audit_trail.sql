-- Migration: 20260301000000_enterprise_audit_trail.sql
-- Description: Enterprise-grade Audit Trail foundation supporting Next.js Server Actions via app.current_tenant_id and app.current_user_id.

BEGIN;

-- 1. Create Enterprise Audit Logs Table
CREATE TABLE IF NOT EXISTS enterprise_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    table_name TEXT NOT NULL,
    record_id TEXT NOT NULL,
    operation TEXT NOT NULL CHECK (operation IN ('INSERT', 'UPDATE', 'DELETE')),
    
    old_data JSONB,
    new_data JSONB,
    changed_fields TEXT[],
    
    performed_by UUID, -- Can be null if system action
    request_ip INET,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now())
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_ent_audit_record ON enterprise_audit_logs(table_name, record_id);
CREATE INDEX IF NOT EXISTS idx_ent_audit_tenant ON enterprise_audit_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ent_audit_created_at ON enterprise_audit_logs(created_at DESC);

-- Enable RLS
ALTER TABLE enterprise_audit_logs ENABLE ROW LEVEL SECURITY;

-- 2. Create the robust trigger function
CREATE OR REPLACE FUNCTION enterprise_audit_trigger_func()
RETURNS TRIGGER AS $$
DECLARE
    v_old_data JSONB;
    v_new_data JSONB;
    v_changed_keys TEXT[];
    v_tenant_id UUID;
    v_actor UUID;
    v_record_id TEXT;
BEGIN
    -- Determine Actor: Try auth.uid() first, then fallback to current_setting for Server Actions
    v_actor := auth.uid();
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
        
        -- Try to get tenant_id from record, fallback to setting
        BEGIN
            v_tenant_id := OLD.tenant_id;
        EXCEPTION WHEN OTHERS THEN
            v_tenant_id := NULLIF(current_setting('app.current_tenant_id', true), '')::UUID;
        END;
        
    ELSIF TG_OP = 'INSERT' THEN
        v_old_data := NULL;
        v_new_data := to_jsonb(NEW);
        v_record_id := NEW.id::TEXT;
        
        BEGIN
            v_tenant_id := NEW.tenant_id;
        EXCEPTION WHEN OTHERS THEN
            v_tenant_id := NULLIF(current_setting('app.current_tenant_id', true), '')::UUID;
        END;
        
    ELSE -- UPDATE
        v_old_data := to_jsonb(OLD);
        v_new_data := to_jsonb(NEW);
        v_record_id := NEW.id::TEXT;
        
        BEGIN
            v_tenant_id := NEW.tenant_id;
        EXCEPTION WHEN OTHERS THEN
            v_tenant_id := NULLIF(current_setting('app.current_tenant_id', true), '')::UUID;
        END;
        
        -- Calculate Changed Keys
        SELECT array_agg(key) INTO v_changed_keys
        FROM jsonb_each(v_new_data) ne
        WHERE ne.value IS DISTINCT FROM v_old_data -> ne.key
          AND ne.key != 'updated_at';
          
        -- Optimization: Skip logging if no meaningful fields changed
        IF v_changed_keys IS NULL OR array_length(v_changed_keys, 1) = 0 THEN
            RETURN NEW;
        END IF;
    END IF;

    -- Fallback for tenant_id if table doesn't have it and setting was empty
    IF v_tenant_id IS NULL THEN
        v_tenant_id := '00000000-0000-0000-0000-000000000000'::UUID; -- Global or System fallback
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

-- 3. Create Helper Function to attach the audit trigger easily
CREATE OR REPLACE FUNCTION enable_enterprise_audit(p_table_name TEXT)
RETURNS VOID AS $$
BEGIN
    EXECUTE format('
        DROP TRIGGER IF EXISTS trg_ent_audit_%1$I ON %1$I;
        CREATE TRIGGER trg_ent_audit_%1$I
        AFTER INSERT OR UPDATE OR DELETE ON %1$I
        FOR EACH ROW EXECUTE FUNCTION enterprise_audit_trigger_func();
    ', p_table_name);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Enable Audit on Critical Tables (Phase 2 & 3 targets)
SELECT enable_enterprise_audit('quotes');
SELECT enable_enterprise_audit('organizations');
SELECT enable_enterprise_audit('journal_entries');
SELECT enable_enterprise_audit('products');
SELECT enable_enterprise_audit('invoices');
SELECT enable_enterprise_audit('payments');

COMMIT;
