
-- Migration: 230_grant_admin_access.sql
-- Description: Grant 'sales@impactsoft.co.il' membership in 'Nano Inc' to fix RLS visibility.

DO $$
DECLARE
    v_user_id uuid;
    v_tenant_id uuid := '4d145b9e-4a75-5567-a0af-bcc4a30891e5'; -- Nano Inc
BEGIN
    -- Get User ID
    SELECT id INTO v_user_id FROM auth.users WHERE email = 'sales@impactsoft.co.il';
    
    IF v_user_id IS NULL THEN
        RAISE NOTICE 'User sales@impactsoft.co.il not found.';
        RETURN;
    END IF;

    -- Check if member
    PERFORM 1 FROM tenant_members WHERE user_id = v_user_id AND tenant_id = v_tenant_id;
    
    IF FOUND THEN
        RAISE NOTICE 'User is already a member of Nano Inc.';
    ELSE
        RAISE NOTICE 'Adding User to Nano Inc...';
        INSERT INTO tenant_members (id, tenant_id, user_id, role, created_at, updated_at)
        VALUES (
            gen_random_uuid(),
            v_tenant_id,
            v_user_id,
            'system_admin', -- Grant highest privilege
            now(),
            now()
        );
        RAISE NOTICE 'Done.';
    END IF;
END $$;
