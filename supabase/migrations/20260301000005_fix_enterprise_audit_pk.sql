-- Patch v2: Enterprise Audit Trigger Fix
-- Description: PL/pgSQL compiles trigger functions against the specific table schema. Referencing `NEW.id` or `NEW.tenant_id` directly causes a `record "new" has no field...` error during compilation if those columns do not exist. We MUST use `to_jsonb()` for dynamic property access.

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
BEGIN
    -- Determine Actor
    v_actor := auth.uid();
    IF v_actor IS NULL THEN
        BEGIN
            v_actor := NULLIF(current_setting('app.current_user_id', true), '')::UUID;
        EXCEPTION WHEN OTHERS THEN
            v_actor := NULL;
        END;
    END IF;

    -- Determine Data and Record ID
    IF TG_OP = 'DELETE' THEN
        v_old_data := to_jsonb(OLD);
        v_new_data := NULL;
        
        -- Safely extract primary key dynamically
        v_record_id := COALESCE(v_old_data->>'id', v_old_data->>'card_id', 'UNKNOWN');
        
        -- Safely extract tenant dynamically
        v_tenant_id := (v_old_data->>'tenant_id')::UUID;
        
    ELSIF TG_OP = 'INSERT' THEN
        v_old_data := NULL;
        v_new_data := to_jsonb(NEW);
        
        -- Safely extract primary key dynamically
        v_record_id := COALESCE(v_new_data->>'id', v_new_data->>'card_id', 'UNKNOWN');
        
        -- Safely extract tenant dynamically
        v_tenant_id := (v_new_data->>'tenant_id')::UUID;
        
    ELSE -- UPDATE
        v_old_data := to_jsonb(OLD);
        v_new_data := to_jsonb(NEW);
        
        -- Safely extract primary key dynamically
        v_record_id := COALESCE(v_new_data->>'id', v_new_data->>'card_id', 'UNKNOWN');
        
        -- Safely extract tenant dynamically
        v_tenant_id := (v_new_data->>'tenant_id')::UUID;
        
        -- Calculate Changed Keys
        SELECT array_agg(key) INTO v_changed_keys
        FROM jsonb_each(v_new_data) ne
        WHERE ne.value IS DISTINCT FROM v_old_data -> ne.key
          AND ne.key != 'updated_at';
          
        IF v_changed_keys IS NULL OR array_length(v_changed_keys, 1) = 0 THEN
            RETURN NEW;
        END IF;
    END IF;

    IF v_tenant_id IS NULL THEN
        BEGIN
            v_tenant_id := NULLIF(current_setting('app.current_tenant_id', true), '')::UUID;
        EXCEPTION WHEN OTHERS THEN
            v_tenant_id := '00000000-0000-0000-0000-000000000000'::UUID;
        END;
    END IF;
    
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
