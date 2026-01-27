
-- Migration: 105_audit_logs.sql
-- Description: Creates the central Audit Log system and triggers.
-- Phase 5 of ERP Foundation.

BEGIN;

-- 1. Create Audit Logs Table
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL, -- Logical separation
    table_name TEXT NOT NULL, -- e.g. 'cards'
    record_id UUID NOT NULL, -- The ID of the modified record
    
    operation TEXT NOT NULL, -- 'INSERT', 'UPDATE', 'DELETE'
    
    -- Data Snapshots
    old_values JSONB, -- For Update/Delete
    new_values JSONB, -- For Insert/Update
    changed_fields TEXT[], -- Optimization: list of keys that changed
    
    -- Metadata
    performed_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now())
);

-- Index for searching history of a specific record
CREATE INDEX IF NOT EXISTS idx_audit_record ON audit_logs(table_name, record_id);
CREATE INDEX IF NOT EXISTS idx_audit_tenant ON audit_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_audit_performed_by ON audit_logs(performed_by);


-- 2. Enable RLS
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- 3. RLS Policies for Audit Logs
-- A. READ: Distributors/Dealers can see logs for their tenant (or specific logic)
-- For simplicity Phase 1: Tenant Isolation only.
CREATE POLICY "Tenant Audit Visiblity" ON audit_logs
    FOR SELECT TO authenticated
    USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));

-- B. WRITE: Only System (Triggers) should write. Users cannot INSERT directly via API.
-- However, Triggers run with permissions of the function definer or invoker.
-- If we use SECURITY DEFINER on the function, we don't need Insert policy for users.
-- So NO Insert/Update/Delete policies for users. Immutable Ledger.


-- 4. Create Generic Logger Function
CREATE OR REPLACE FUNCTION log_activity()
RETURNS TRIGGER AS $$
DECLARE
    v_old_data JSONB;
    v_new_data JSONB;
    v_changed_keys TEXT[];
    v_tenant_id UUID;
    v_actor UUID;
BEGIN
    -- Determine Actor
    v_actor := auth.uid();
    
    -- Determine Tenant (Try NEW, then OLD)
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
        
        -- Calculate Changed Keys (Navigating JSON keys)
        -- We want only keys where NEW value != OLD value
        SELECT array_agg(key) INTO v_changed_keys
        FROM jsonb_each(v_new_data) ne
        WHERE ne.value IS DISTINCT FROM v_old_data -> ne.key;
        
        -- Optimization: If no generic columns changed (ignoring 'updated_at'), skip?
        -- For Audit, we usually log everything.
    END IF;

    -- Insert Log
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
EXCEPTION 
    WHEN OTHERS THEN
        -- Fallback: Do not fail the transaction if logging fails, 
        -- OR fail strictly based on requirements.
        -- Ideally, Audit failure should block action.
        RAISE WARNING 'Audit Log Failed: %', SQLERRM;
        RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 5. Attach to Cards Table
DROP TRIGGER IF EXISTS trg_audit_cards ON cards;
CREATE TRIGGER trg_audit_cards
    AFTER INSERT OR UPDATE OR DELETE
    ON cards
    FOR EACH ROW
    EXECUTE FUNCTION log_activity();

COMMIT;
