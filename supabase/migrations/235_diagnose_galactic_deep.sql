
-- Migration: 235_diagnose_galactic_deep.sql
-- Description: Deep forensic analysis of Galactic Tenant data and permissions.

DO $$
DECLARE
    v_tenant_name text := 'Galactic Stress Test';
    v_tenant_id uuid;
    v_user_email text := 'sales@impactsoft.co.il';
    v_user_id uuid;
    v_org_count int;
    v_member_role text;
BEGIN
    RAISE NOTICE '========== DIAGNOSTIC START ==========';

    -- 1. Resolve Tenant ID
    SELECT id INTO v_tenant_id FROM tenants WHERE name = v_tenant_name;
    
    IF v_tenant_id IS NULL THEN
        RAISE NOTICE '❌ CRITICAL: Tenant "%" NOT FOUND in tenants table!', v_tenant_name;
        -- Try to find by partial match
        FOR v_tenant_id, v_tenant_name IN SELECT id, name FROM tenants WHERE name ILIKE '%Galactic%' LOOP
             RAISE NOTICE '   Found alternative: % (%)', v_tenant_name, v_tenant_id;
        END LOOP;
        RETURN;
    ELSE
        RAISE NOTICE '✅ Tenant Resolved: % (ID: %)', v_tenant_name, v_tenant_id;
    END IF;

    -- 2. Check Organization Count
    SELECT count(*) INTO v_org_count FROM cards 
    WHERE tenant_id = v_tenant_id AND type = 'organization';

    IF v_org_count = 0 THEN
        RAISE NOTICE '❌ Data Check: FOUND 0 ORGANIZATIONS in this tenant.';
        RAISE NOTICE '   Action Required: Re-run seeding specifically for ID %', v_tenant_id;
    ELSE
        RAISE NOTICE '✅ Data Check: Found % organizations.', v_org_count;
    END IF;

    -- 3. Check User Membership
    SELECT id INTO v_user_id FROM auth.users WHERE email = v_user_email;
    
    SELECT role INTO v_member_role FROM tenant_members 
    WHERE tenant_id = v_tenant_id AND user_id = v_user_id;

    IF v_member_role IS NULL THEN
        RAISE NOTICE '❌ Permission Check: User IS NOT A MEMBER of this tenant.';
        RAISE NOTICE '   Action Required: Insert into tenant_members.';
    ELSE
        RAISE NOTICE '✅ Permission Check: User is member with role: %', v_member_role;
        IF v_member_role != 'system_admin' THEN
             RAISE NOTICE '⚠️ WARNING: Role is "%", not "system_admin". This might be the issue.', v_member_role;
        END IF;
    END IF;

    RAISE NOTICE '========== DIAGNOSTIC END ============';
END $$;
