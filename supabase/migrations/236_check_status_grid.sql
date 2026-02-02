
-- Migration: 236_check_status_grid.sql
-- Description: Diagnostic query to show Tenant status in a grid format.

SELECT 
    t.name as tenant_name,
    t.id as tenant_id,
    (SELECT count(*) FROM cards c WHERE c.tenant_id = t.id AND c.type = 'organization') as org_count,
    (SELECT count(*) FROM tenant_members tm WHERE tm.tenant_id = t.id AND tm.user_id = (SELECT id FROM auth.users WHERE email = 'sales@impactsoft.co.il')) > 0 as is_member,
    (SELECT role FROM tenant_members tm WHERE tm.tenant_id = t.id AND tm.user_id = (SELECT id FROM auth.users WHERE email = 'sales@impactsoft.co.il')) as user_role
FROM 
    tenants t
WHERE 
    t.id IN (
        '4d145b9e-4a75-5567-a0af-bcc4a30891e5', -- Nano Inc
        '00000000-0000-0000-0000-000000000003'  -- Galactic Stress Test
    );
