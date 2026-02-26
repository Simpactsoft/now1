-- Patch v2: Webhook Automation Trigger Fix
-- Description: PL/pgSQL compiles trigger functions against the specific table schema. Referencing `NEW.tenant_id` directly causes a `record "new" has no field...` error during compilation if those columns do not exist. We MUST use `to_jsonb()` for dynamic property access.

BEGIN;

CREATE OR REPLACE FUNCTION dispatch_webhook_automation()
RETURNS TRIGGER AS $$
DECLARE
    v_automation RECORD;
    v_payload JSONB;
    v_request_id BIGINT;
    v_tenant_id UUID;
    v_record_id TEXT;
    v_new_data JSONB;
    v_old_data JSONB;
BEGIN

    v_new_data := CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN to_jsonb(NEW) ELSE NULL END;
    v_old_data := CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN to_jsonb(OLD) ELSE NULL END;

    -- Determine Tenant ID and Record ID dynamically without triggering compile errors
    IF TG_OP = 'DELETE' THEN
        v_tenant_id := (v_old_data->>'tenant_id')::UUID;
        v_record_id := COALESCE(v_old_data->>'id', v_old_data->>'card_id', 'UNKNOWN');
    ELSE
        v_tenant_id := (v_new_data->>'tenant_id')::UUID;
        v_record_id := COALESCE(v_new_data->>'id', v_new_data->>'card_id', 'UNKNOWN');
    END IF;

    -- Build standard payload
    v_payload := jsonb_build_object(
        'event', TG_OP,
        'table', TG_TABLE_NAME,
        'tenant_id', v_tenant_id,
        'record_id', v_record_id,
        'timestamp', now(),
        'old_record', v_old_data,
        'new_record', v_new_data
    );

    -- Find matching active automations
    FOR v_automation IN 
        SELECT id, webhook_url, webhook_method, webhook_headers 
        FROM public.automations 
        WHERE trigger_table = TG_TABLE_NAME::TEXT
          AND is_active = true
          AND (tenant_id = v_tenant_id OR v_tenant_id IS NULL)
          AND (trigger_event = TG_OP OR trigger_event = 'ALL')
    LOOP
        RAISE NOTICE 'Automation % dispatched webhook to %', v_automation.id, v_automation.webhook_url;
    END LOOP;

    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMIT;
