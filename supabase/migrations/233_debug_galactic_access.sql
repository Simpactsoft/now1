
-- Migration: 233_debug_galactic_access.sql
-- Description: Diagnose why Galactic Stress Test is empty.

DO $$
DECLARE
    v_tenant_id uuid := '00000000-0000-0000-0000-000000000003';
    v_user_email text := 'sales@impactsoft.co.il';
    v_org_count int;
    v_member_exists boolean;
    v_user_id uuid;
BEGIN
    -- 1. Check Data
    SELECT count(*) INTO v_org_count FROM cards WHERE tenant_id = v_tenant_id AND type = 'organization';
    RAISE NOTICE '--- DATA CHECK ---';
    RAISE NOTICE 'Organizations in Galactic: %', v_org_count;

    -- 2. Check Membership
    SELECT id INTO v_user_id FROM auth.users WHERE email = v_user_email;
    SELECT EXISTS(SELECT 1 FROM tenant_members WHERE tenant_id = v_tenant_id AND user_id = v_user_id) INTO v_member_exists;
    
    RAISE NOTICE '--- PERMISSION CHECK ---';
    RAISE NOTICE 'User % (ID: %) Is Member of Galactic? %', v_user_email, v_user_id, v_member_exists;

    IF v_org_count > 0 AND NOT v_member_exists THEN
        RAISE NOTICE 'CONCLUSION: Data exists but user is not a member. Run migration to add membership.';
    ELSIF v_org_count = 0 THEN
        RAISE NOTICE 'CONCLUSION: Seeding failed. No data found.';
    ELSE
        RAISE NOTICE 'CONCLUSION: Data exists and user is member. Check Frontend filter or cache.';
    END IF;

END $$;
