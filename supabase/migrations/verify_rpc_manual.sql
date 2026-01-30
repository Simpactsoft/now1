
-- Migration: verify_rpc_manual.sql
-- Description: Debug script to check raw output of fetch_people_crm.
-- We want to see if 'ret_status' is actually being returned and populated.

BEGIN;

DO $$
DECLARE
    v_tenant_id UUID;
    v_results JSONB;
BEGIN
    -- 1. Get the aligned tenant
    SELECT tenant_id INTO v_tenant_id FROM profiles LIMIT 1;
    
    RAISE NOTICE 'Testing RPC for Tenant: %', v_tenant_id;

    -- 2. Call RPC via SQL
    SELECT jsonb_agg(t) INTO v_results
    FROM public.fetch_people_crm(
        arg_tenant_id := v_tenant_id,
        arg_limit := 3
    ) t;

    -- 3. Print Results (Focus on ret_status)
    RAISE NOTICE 'RPC Output Sample: %', jsonb_pretty(v_results);
    
    -- 4. Check specific field existence
    IF (v_results->0->>'ret_status') IS NULL THEN
         RAISE NOTICE 'CRITICAL: ret_status is MISSING or NULL inside the JSON response!';
    ELSE
         RAISE NOTICE 'SUCCESS: ret_status found: %', v_results->0->>'ret_status';
    END IF;

END $$;

ROLLBACK; -- Don't save anything, just debug.
