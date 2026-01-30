
-- Migration: 155_debug_as_table.sql
-- Description: Debug script that returns a TABLE RESULT (Row) instead of console logs.
-- This ensures you can see the output in your SQL Editor grid.

SELECT 
    'Debug Report' as check_name,
    p.tenant_id as user_tenant_id,
    c.data_tenant_id as actual_data_tenant_id,
    c.card_count as cards_in_data_tenant,
    CASE 
        WHEN p.tenant_id = c.data_tenant_id THEN 'MATCH - OK' 
        ELSE 'MISMATCH - ERROR' 
    END as status
FROM 
    -- 1. Get the first user profile found
    (SELECT tenant_id FROM profiles LIMIT 1) p
CROSS JOIN 
    -- 2. Get the tenant that actually has the most data
    (SELECT tenant_id as data_tenant_id, count(*) as card_count FROM cards GROUP BY tenant_id ORDER BY count(*) DESC LIMIT 1) c;
