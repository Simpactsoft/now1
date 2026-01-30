
-- Migration: 157_inspect_tenants.sql
-- Description: Shows exactly which Tenants exist in Data vs Users.

SELECT 
    'DATA_TENANTS' as source,
    tenant_id, 
    count(*) as record_count 
FROM cards 
GROUP BY tenant_id 

UNION ALL

SELECT 
    'USER_TENANTS' as source,
    tenant_id, 
    count(*) as user_count
FROM profiles 
GROUP BY tenant_id

ORDER BY source, record_count DESC;
