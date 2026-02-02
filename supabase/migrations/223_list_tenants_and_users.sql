
-- Migration: 223_list_tenants_and_users.sql
-- Description: Helper to match User Email to Tenant ID.

SELECT 
    t.id as tenant_id, 
    t.name as tenant_name,
    count(p.id) as user_count,
    -- Simple array of up to 5 emails to identify the group
    array_agg(p.email) FILTER (WHERE p.email IS NOT NULL) as sample_users
FROM tenants t
LEFT JOIN profiles p ON p.tenant_id = t.id
GROUP BY t.id, t.name
ORDER BY user_count DESC;
