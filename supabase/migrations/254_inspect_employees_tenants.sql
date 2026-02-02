-- Migration: 254_inspect_employees_tenants.sql
-- Description: Count employees by tenant to find the 2.25M records.

SELECT tenant_id, count(*) 
FROM employees 
GROUP BY tenant_id 
ORDER BY count(*) DESC
LIMIT 10;
