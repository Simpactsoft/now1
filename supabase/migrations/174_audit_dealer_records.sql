
-- Migration: 174_audit_dealer_records.sql
-- Description: LIST ALL recent cards to find the "missing" ones.
-- This runs as Superuser, so it sees everything.

SELECT 
    c.id, 
    c.display_name, 
    c.hierarchy_path, 
    c.tenant_id, 
    c.created_at,
    (c.tenant_id = p.tenant_id) as matches_noam_tenant
FROM cards c
CROSS JOIN (SELECT tenant_id FROM profiles WHERE email = 'noam@dd.com') p
WHERE c.type = 'person'
AND c.created_at > (now() - interval '2 hours')
ORDER BY c.created_at DESC;
