
-- Migration: 171_inspect_dealer_data.sql (Table Output)
-- Description: Returns inspection data as a TABLE so you can see it easily.

SELECT 
    'Noam Path' as metric, 
    org_path::text as value 
FROM profiles WHERE email = 'noam@dd.com'

UNION ALL

SELECT 
    'Cards at org.dealer1', 
    count(*)::text 
FROM cards 
WHERE hierarchy_path <@ 'org.dealer1'

UNION ALL

SELECT 
    'Cards created Last Hour', 
    count(*)::text 
FROM cards 
WHERE created_at > (now() - interval '1 hour');
