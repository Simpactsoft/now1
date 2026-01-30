
-- Migration: 191_inspect_rbac_tables.sql
-- Description: Check if role_permissions already exists with different cols

SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'role_permissions';
