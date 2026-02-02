-- Migration: 253_inspect_legacy_schema.sql
-- Description: Inspect schema of employees and people tables.

SELECT table_name, column_name, data_type 
FROM information_schema.columns 
WHERE table_name IN ('employees', 'people') 
ORDER BY table_name, ordinal_position;
