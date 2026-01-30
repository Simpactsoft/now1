
-- Migration: 117_rebuild_audit_stack.sql
-- Description: Complete Nuke & Pave of Audit System to fix missing logs.
-- 1. Drops old table/triggers.
-- 2. Re-creates Table with correct FK.
-- 3. Re-creates Trigger (Safe Mode).
-- 4. Re-creates RLS (Tenant Members based).

BEGIN;

-- 1. Cleanup
DROP TRIGGER IF EXISTS trg_audit_cards ON cards;
DROP FUNCTION IF EXISTS log_activity();
DROP TABLE IF EXISTS audit_logs CASCADE;

-- 2. Create Table
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    table_name TEXT NOT NULL,
    record_id UUID NOT NULL,
    operation TEXT NOT NULL,
    old_values JSONB,
    new_values JSONB,
    changed_fields TEXT[],
    performed_by UUID NULL REFERENCES profiles(id) ON DELETE SET NULL, -- FK to Profiles
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now())
);

-- Indexes
CREATE INDEX idx_audit_record ON audit_logs(table_name, record_id);
CREATE INDEX idx_audit_tenant ON audit_logs(tenant_id);
CREATE INDEX idx_audit_created_at ON audit_logs(created_at DESC);

-- 3. RLS
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- WRITE: System only (Trigger) - No policy needed for users.

-- READ: Using tenant_members (More robust than profiles)
CREATE POLICY "Tenant Audit Visibility" ON audit_logs
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM tenant_members tm 
            WHERE tm.user_id = auth.uid() 
            AND tm.tenant_id = audit_logs.tenant_id
        )
    );

-- 4. Trigger Function (Robust)
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
    -- Actor Logic
    v_actor := auth.uid();
    IF v_actor IS NOT NULL THEN
        -- Verify FK validity
        SELECT EXISTS(SELECT 1 FROM profiles WHERE id = v_actor) INTO v_profile_exists;
        IF NOT v_profile_exists THEN
            v_actor := NULL; -- Valid: Table allows NULL
        END IF;
    END IF;

    -- Data Logic
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

    -- Insert
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
         -- Log error to Postgres logs but don't fail transaction
        RAISE WARNING 'Audit Log Failed: %', SQLERRM;
        RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Attach Trigger
CREATE TRIGGER trg_audit_cards
    AFTER INSERT OR UPDATE OR DELETE
    ON cards
    FOR EACH ROW
    EXECUTE FUNCTION log_activity();

COMMIT;
