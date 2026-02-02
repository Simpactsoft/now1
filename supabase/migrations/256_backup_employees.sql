-- Migration: 256_backup_employees.sql
-- Description: Create a safe backup of the employees table before migration.

CREATE TABLE IF NOT EXISTS employees_backup_2026 AS
SELECT * FROM employees;

-- Verify count matches
DO $$
DECLARE
    v_orig_count bigint;
    v_back_count bigint;
BEGIN
    SELECT count(*) INTO v_orig_count FROM employees;
    SELECT count(*) INTO v_back_count FROM employees_backup_2026;
    
    RAISE NOTICE 'Original Count: %, Backup Count: %', v_orig_count, v_back_count;
    
    IF v_orig_count != v_back_count THEN
        RAISE EXCEPTION 'Backup failed! Counts do not match.';
    END IF;
END $$;
