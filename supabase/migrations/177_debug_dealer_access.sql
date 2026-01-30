
-- Migration: 177_debug_dealer_access.sql
-- Description: Check Noam's profile config again.

SELECT 
    id, 
    email, 
    tenant_id, 
    org_path, 
    role,
    (SELECT count(*) FROM cards c WHERE c.type = 'person' AND c.hierarchy_path <@ profiles.org_path) as hypothetical_count
FROM profiles 
WHERE email = 'noam@dd.com';

-- Also check if fetch_people_crm is definer or invoker
SELECT prosecdef, proname FROM pg_proc WHERE proname = 'fetch_people_crm';
