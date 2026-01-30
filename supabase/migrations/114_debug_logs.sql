
-- Debug Script: Check Audit Logs availability
-- RUN THIS via SQL Editor

DO $$
DECLARE
    v_tenant_id UUID := '00000000-0000-0000-0000-000000000003';
    v_count INT;
BEGIN
    SELECT count(*) INTO v_count 
    FROM audit_logs 
    WHERE tenant_id = v_tenant_id;

    RAISE NOTICE '--- DEBUG REPORT ---';
    RAISE NOTICE 'Tenant ID: %', v_tenant_id;
    RAISE NOTICE 'Total Logs Found: %', v_count;
    
    IF v_count = 0 THEN
        RAISE NOTICE '⚠️ No logs exist for this tenant. Please Perform an Action (Edit/Create Person) to generate a log.';
    ELSE
        RAISE NOTICE '✅ Logs exist. If UI is empty, check RLS or Fetch Logic.';
    END IF;
END $$;
